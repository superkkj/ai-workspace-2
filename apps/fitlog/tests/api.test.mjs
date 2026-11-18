import assert from "node:assert/strict";
import { after, test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const root = fileURLToPath(new URL("../", import.meta.url));
const temporary = await mkdtemp(join(tmpdir(), "fitlog-api-test-"));
const compiled = await build({ entryPoints: [join(root, "lib/server/api.ts")], bundle: true, platform: "node", format: "esm", write: false });
const entry = join(temporary, "api.mjs");
await writeFile(entry, compiled.outputFiles[0].text);
const { handleApi } = await import(pathToFileURL(entry).href);
after(() => rm(temporary, { recursive: true, force: true }));
const migrations = await Promise.all((await readdir(join(root, "drizzle"))).filter(n => n.endsWith(".sql")).sort().map(n => readFile(join(root, "drizzle", n), "utf8")));

// Execute the application's real generated SQL and real API SQL in SQLite.
// Only the D1 transport shape is adapted; no application query or decision is mocked.
class SqliteD1 {
  constructor() {
    this.sqlite = new DatabaseSync(":memory:");
    this.sqlite.exec("PRAGMA foreign_keys = ON");
    for (const migration of migrations) this.sqlite.exec(migration);
  }
  prepare(sql) {
    const database = this;
    class Statement {
      constructor(values = []) { this.values = values; }
      bind(...values) { return new Statement(values); }
      async first(column) {
        const row = database.sqlite.prepare(sql).get(...this.values) ?? null;
        return column && row ? row[column] : row;
      }
      async all() { return { results: database.sqlite.prepare(sql).all(...this.values), success: true, meta: { changes: 0 } }; }
      execute() {
        const result = database.sqlite.prepare(sql).run(...this.values);
        return { results: [], success: true, meta: { changes: Number(result.changes) } };
      }
      async run() { return this.execute(); }
    }
    return new Statement();
  }
  async batch(statements) {
    this.sqlite.exec("BEGIN");
    try {
      const results = statements.map(statement => statement.execute());
      this.sqlite.exec("COMMIT");
      return results;
    } catch (error) { this.sqlite.exec("ROLLBACK"); throw error; }
  }
  count(table) { return this.sqlite.prepare(`SELECT COUNT(*) AS total FROM ${table}`).get().total; }
  close() { this.sqlite.close(); }
}

const alice = { userId: "test-alice" };
const bob = { userId: "test-bob" };
const moderator = { userId: "test-moderator" };
const now = new Date("2026-11-18T06:00:00Z");

function fixture(t) {
  const db = new SqliteD1();
  t.after(() => db.close());
  async function api(method, path, body, user = alice, options = {}) {
    const headers = { ...(body !== undefined ? { "content-type": "application/json" } : {}), ...options.headers };
    const request = new Request(`https://fitlog.test/api/${path}`, { method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    const response = await handleApi(request, { db, user, now, ...options.context });
    const data = await response.json();
    return { status: response.status, data, headers: response.headers };
  }
  return { db, api };
}

function shoe(overrides = {}) { return { requestId: crypto.randomUUID(), brand: "예시 브랜드", model: "기준 러너", size: 270, width: "wide", fit: "good", purpose: "daily", memo: "내 비공개 개인 메모", ...overrides }; }
function question(overrides = {}) { return { requestId: crypto.randomUUID(), title: "다음 러닝화 사이즈가 궁금해요", body: "기존 신발은 잘 맞는데 다음 모델의 발볼 경험이 궁금해요.", purpose: "daily", width: "wide", targetModel: "새 러너", ...overrides }; }
function answer(overrides = {}) { return { requestId: crypto.randomUUID(), body: "저는 같은 기준 신발을 사용했고 매장에서 직접 착화해 봤어요.", ...overrides }; }
function review(overrides = {}) { return { body: "직접 신어 보니 발볼과 길이가 편안하게 맞았어요.", fit: "good", distanceKm: 12.5, firstUsedAt: "2026-11-18", ...overrides }; }
const chosen = { brand: "예시 브랜드", model: "선택 러너", size: 275 };

test("fresh migrations have no fabricated community data; anonymous reads and no-store responses work", async t => {
  const { db, api } = fixture(t);
  const session = await api("GET", "session", undefined, null);
  assert.deepEqual(session.data, { user: null, canModerate: false });
  const list = await api("GET", "questions", undefined, null);
  assert.equal(list.status, 200);
  assert.deepEqual(list.data, { items: [], total: 0 });
  assert.match(list.headers.get("cache-control"), /no-store/);
  assert.equal(db.count("questions"), 0);
  assert.equal(db.count("reviews"), 0);
});

test("all unauthenticated mutations and private shoe / mine reads are rejected", async t => {
  const { api } = fixture(t);
  const id = crypto.randomUUID();
  for (const [method, path, data] of [
    ["PATCH", "session", { nickname: "러너님", userId: alice.userId }],
    ["POST", "shoes", shoe()], ["PATCH", `shoes/${id}`, shoe()], ["DELETE", `shoes/${id}`],
    ["POST", "questions", question()], ["PATCH", `questions/${id}`, question()], ["DELETE", `questions/${id}`],
    ["POST", `questions/${id}/answers`, answer()], ["DELETE", `questions/${id}/answers/${id}`],
    ["PUT", `questions/${id}/choice`, chosen], ["PUT", `questions/${id}/review`, review()], ["DELETE", `questions/${id}/review`],
    ["POST", "reports", {}], ["PATCH", `reports/${id}`, { action: "hide" }],
  ]) {
    const result = await api(method, path, data, null);
    assert.equal(result.status, 401, `${method} ${path}`);
    assert.equal(result.data.code, "AUTH_REQUIRED");
    assert.match(result.headers.get("cache-control"), /no-store/);
  }
  assert.equal((await api("GET", "shoes", undefined, null)).status, 401);
  assert.equal((await api("GET", "questions?mine=1", undefined, null)).status, 401);
});

test("session returns only the signed-in person's ID and nickname; public posts never expose identity/email/memo", async t => {
  const { api } = fixture(t);
  assert.deepEqual((await api("GET", "session")).data, { user: { id: alice.userId, nickname: "러너" }, canModerate: false });
  assert.equal((await api("PATCH", "session", { nickname: "  천천히러너  " })).status, 200);
  const s = (await api("POST", "shoes", shoe())).data.item;
  const q = (await api("POST", "questions", question({ referenceShoeId: s.id, userId: bob.userId }))).data.item;
  assert.equal(q.nickname, "천천히러너");
  assert.equal(q.isMine, true);
  await api("PATCH", "session", { nickname: "새로운닉네임" });
  const publicData = (await api("GET", `questions/${q.id}`, undefined, bob)).data;
  assert.equal(publicData.item.nickname, "천천히러너");
  const serialized = JSON.stringify(publicData);
  for (const value of [alice.userId, bob.userId, "email", "user_id", "userId", "내 비공개 개인 메모", s.id]) assert.equal(serialized.includes(value), false, value);
});

test("shoe writes validate real inputs, trim values, and isolate each owner's records", async t => {
  const { db, api } = fixture(t);
  for (const invalid of [{ brand: " " }, { model: " " }, { size: 271 }, { size: 355 }, { size: "270" }, { width: "extra" }, { fit: "unknown" }, { purpose: "medical" }, { memo: "x".repeat(501) }]) {
    assert.equal((await api("POST", "shoes", shoe(invalid))).status, 400, JSON.stringify(invalid));
  }
  const s = (await api("POST", "shoes", shoe({ brand: "  브랜드  " }))).data.item;
  assert.equal(s.brand, "브랜드");
  assert.equal((await api("GET", "shoes", undefined, bob)).data.items.length, 0);
  assert.equal((await api("PATCH", `shoes/${s.id}`, shoe(), bob)).status, 404);
  assert.equal((await api("DELETE", `shoes/${s.id}`, undefined, bob)).status, 404);
  assert.equal((await api("PATCH", `shoes/${s.id}`, shoe({ model: "수정 러너" }))).data.item.model, "수정 러너");
  assert.equal(db.count("shoes"), 1);
});

test("concurrent duplicate creates produce one record per user and request, not a second insertion", async t => {
  const { db, api } = fixture(t);
  const body = shoe();
  const [a, b] = await Promise.all([api("POST", "shoes", body), api("POST", "shoes", body)]);
  assert.equal(a.status, 201); assert.equal(b.status, 201);
  assert.equal(a.data.item.id, b.data.item.id);
  assert.equal(db.count("shoes"), 1);
  const other = await api("POST", "shoes", body, bob);
  assert.notEqual(other.data.item.id, a.data.item.id);
  assert.equal(db.count("shoes"), 2);
  const qbody = question();
  const [q1, q2] = await Promise.all([api("POST", "questions", qbody), api("POST", "questions", qbody)]);
  assert.equal(q1.data.item.id, q2.data.item.id);
  assert.equal(db.count("questions"), 1);
});

test("private shoes cannot be attached by another user and shared snapshots survive editing/deletion", async t => {
  const { api } = fixture(t);
  const s = (await api("POST", "shoes", shoe())).data.item;
  assert.equal((await api("POST", "questions", question({ referenceShoeId: s.id }), bob)).status, 404);
  const create = question({ referenceShoeId: s.id });
  const q = (await api("POST", "questions", create)).data.item;
  assert.equal((await api("POST", `questions/${q.id}/answers`, answer({ referenceShoeId: s.id }), bob)).status, 404);
  await api("PATCH", `shoes/${s.id}`, shoe({ model: "변경된 모델", size: 280 }));
  await api("DELETE", `shoes/${s.id}`);
  const detail = (await api("GET", `questions/${q.id}`)).data;
  assert.equal(detail.item.reference.model, "기준 러너");
  assert.equal(detail.item.reference.size, 270);
  assert.equal((await api("POST", "questions", create)).data.item.id, q.id, "retry after shoe deletion should reuse original question");
});

test("only question authors can edit/delete/choose/review; answering doesn't grant ownership", async t => {
  const { api } = fixture(t);
  const q = (await api("POST", "questions", question())).data.item;
  const a = (await api("POST", `questions/${q.id}/answers`, answer(), bob)).data.item;
  for (const [method, suffix, body] of [["PATCH", "", question()], ["DELETE", ""], ["PUT", "/choice", chosen], ["PUT", "/review", review()], ["DELETE", "/review"]]) {
    assert.equal((await api(method, `questions/${q.id}${suffix}`, body, bob)).status, 404, method + suffix);
  }
  assert.equal((await api("DELETE", `questions/${q.id}/answers/${a.id}`)).status, 404, "question author cannot delete somebody else's answer");
  assert.equal((await api("DELETE", `questions/${q.id}/answers/${a.id}`, undefined, bob)).status, 200);
  assert.equal((await api("GET", `questions/${q.id}`, undefined, bob)).data.item.isMine, false);
});

test("question → answer → choice → follow-up persists, and deleting follow-up safely permits changing choice", async t => {
  const { db, api } = fixture(t);
  const q = (await api("POST", "questions", question())).data.item;
  assert.equal(q.status, "open");
  assert.equal((await api("PUT", `questions/${q.id}/review`, review())).status, 409);
  await api("POST", `questions/${q.id}/answers`, answer(), bob);
  await api("PUT", `questions/${q.id}/choice`, chosen);
  assert.equal((await api("GET", `questions/${q.id}`)).data.item.status, "chosen");
  const r = await api("PUT", `questions/${q.id}/review`, review({ firstUsedAt: "2026-10-19" }));
  assert.equal(r.status, 200); assert.equal(r.data.item.daysUsed, 30);
  const detail = (await api("GET", `questions/${q.id}`)).data;
  assert.equal(detail.item.status, "reviewed"); assert.equal(detail.item.replyCount, 1); assert.equal(detail.answers.length, 1);
  assert.equal(detail.item.choice.model, chosen.model); assert.equal(detail.item.review.distanceKm, 12.5);
  await api("PUT", `questions/${q.id}/review`, review({ body: "후기를 다시 정리했어요. 실제 착용 느낌을 기록합니다." }));
  assert.equal(db.count("reviews"), 1, "updating a review must not create a duplicate");
  assert.equal((await api("PUT", `questions/${q.id}/choice`, { ...chosen, model: "다른 신발" })).status, 409);
  assert.equal((await api("GET", `questions/${q.id}`)).data.item.choice.model, chosen.model);
  await api("DELETE", `questions/${q.id}/review`);
  assert.equal((await api("GET", `questions/${q.id}`)).data.item.status, "chosen");
  assert.equal((await api("PUT", `questions/${q.id}/choice`, { ...chosen, model: "다른 신발" })).status, 200);
});

test("review usage days stay at the written observation date, not the date someone later opens it", async t => {
  const { api } = fixture(t);
  const q = (await api("POST", "questions", question())).data.item;
  await api("PUT", `questions/${q.id}/choice`, chosen);
  const initial = await api("PUT", `questions/${q.id}/review`, review());
  assert.equal(initial.data.item.daysUsed, 0);
  const later = { context: { now: new Date("2026-12-18T06:00:00Z") } };
  const reopened = await api("GET", `questions/${q.id}`, undefined, alice, later);
  assert.equal(reopened.data.item.review.daysUsed, 0);
  assert.equal((await api("GET", "questions", undefined, alice, later)).data.items[0].review.daysUsed, 0);
  const edited = await api("PUT", `questions/${q.id}/review`, review({ body: "한 달 뒤에 다시 신어 본 경험을 추가해서 기록합니다." }), alice, later);
  assert.equal(edited.data.item.daysUsed, 30);
  assert.equal(edited.data.item.createdAt, initial.data.item.createdAt);
  assert.notEqual(edited.data.item.updatedAt, initial.data.item.updatedAt);
});

test("date and numeric checks reject impossible/future days and use Asia/Seoul's calendar", async t => {
  const { api } = fixture(t);
  const q = (await api("POST", "questions", question())).data.item;
  await api("PUT", `questions/${q.id}/choice`, chosen);
  for (const invalid of [{ firstUsedAt: "2026-11-19" }, { firstUsedAt: "2026-02-30" }, { firstUsedAt: "11/18/2026" }, { distanceKm: -1 }, { distanceKm: 10001 }, { distanceKm: "10" }]) {
    assert.equal((await api("PUT", `questions/${q.id}/review`, review(invalid))).status, 400, JSON.stringify(invalid));
  }
  const koreanMidnight = await api("PUT", `questions/${q.id}/review`, review(), alice, { context: { now: new Date("2026-11-17T15:01:00Z") } });
  assert.equal(koreanMidnight.status, 200); assert.equal(koreanMidnight.data.item.daysUsed, 0);
});

test("answer retries are idempotent and cannot retarget the same request ID to another question", async t => {
  const { db, api } = fixture(t);
  const q1 = (await api("POST", "questions", question())).data.item;
  const q2 = (await api("POST", "questions", question())).data.item;
  const payload = answer();
  const [a1, a2] = await Promise.all([api("POST", `questions/${q1.id}/answers`, payload, bob), api("POST", `questions/${q1.id}/answers`, payload, bob)]);
  assert.equal(a1.data.item.id, a2.data.item.id); assert.equal(db.count("answers"), 1);
  assert.equal((await api("POST", `questions/${q2.id}/answers`, payload, bob)).status, 409);
  assert.equal((await api("DELETE", `questions/${q2.id}/answers/${a1.data.item.id}`, undefined, bob)).status, 404);
});

test("search escaping and state/owner filters return actual matching posts", async t => {
  const { api } = fixture(t);
  const q1 = (await api("POST", "questions", question({ title: "발볼 100% 기준으로 고르고 싶어요" }))).data.item;
  await api("POST", "questions", question({ purpose: "race", width: "narrow" }), bob);
  await api("PUT", `questions/${q1.id}/choice`, chosen);
  assert.equal((await api("GET", "questions?q=%25")).data.total, 1, "literal percent must not match every question");
  assert.equal((await api("GET", "questions?q=" + encodeURIComponent("' OR 1=1 --"))).data.total, 0);
  assert.equal((await api("GET", "questions?purpose=race&width=narrow")).data.total, 1);
  assert.equal((await api("GET", "questions?status=chosen")).data.items[0].id, q1.id);
  assert.equal((await api("GET", "questions?status=reviewed")).data.total, 0);
  assert.equal((await api("GET", "questions?mine=1")).data.total, 1);
  assert.equal((await api("GET", "questions?status=made-up")).status, 400);
});

test("question deletion atomically cascades its answers, choices, reviews and both report types", async t => {
  const { db, api } = fixture(t);
  const q = (await api("POST", "questions", question())).data.item;
  const a = (await api("POST", `questions/${q.id}/answers`, answer(), bob)).data.item;
  await api("PUT", `questions/${q.id}/choice`, chosen);
  await api("PUT", `questions/${q.id}/review`, review());
  await api("POST", "reports", { requestId: crypto.randomUUID(), targetType: "question", targetId: q.id, reason: "질문 내용을 확인해 주세요." }, bob);
  await api("POST", "reports", { requestId: crypto.randomUUID(), targetType: "answer", targetId: a.id, reason: "답변 내용을 확인해 주세요." });
  assert.equal(db.count("reports"), 2);
  assert.equal((await api("DELETE", `questions/${q.id}`)).status, 200);
  for (const table of ["questions", "answers", "choices", "reviews", "reports"]) assert.equal(db.count(table), 0, table);
  assert.equal((await api("GET", `questions/${q.id}`)).status, 404);
});

test("moderation is explicit allowlist-only; hidden answers no longer appear or count", async t => {
  const { db, api } = fixture(t);
  const q = (await api("POST", "questions", question())).data.item;
  const a = (await api("POST", `questions/${q.id}/answers`, answer(), bob)).data.item;
  const report = { requestId: crypto.randomUUID(), targetType: "answer", targetId: a.id, reason: "반복 홍보성 답변을 확인해 주세요." };
  await api("POST", "reports", report);
  await api("POST", "reports", report);
  assert.equal(db.count("reports"), 1);
  assert.equal((await api("POST", "reports", { ...report, targetType: "question", targetId: q.id })).status, 409);
  assert.equal((await api("GET", "reports", undefined, moderator)).status, 403, "no automatic first-user/admin role");
  const opts = { context: { moderatorUserIds: " test-moderator , " } };
  assert.equal((await api("GET", "session", undefined, moderator, opts)).data.canModerate, true);
  const id = (await api("GET", "reports", undefined, moderator, opts)).data.items[0].id;
  assert.equal((await api("PATCH", `reports/${id}`, { action: "hide" }, bob, opts)).status, 403);
  assert.equal((await api("PATCH", `reports/${id}`, { action: "hide" }, moderator, opts)).status, 200);
  assert.equal((await api("GET", `questions/${q.id}`)).data.answers.length, 0);
  assert.equal((await api("GET", "questions")).data.items[0].replyCount, 0);
});

test("competing moderation decisions preserve atomic visibility/status consistency", async t => {
  const { db, api } = fixture(t);
  const q = (await api("POST", "questions", question())).data.item;
  await api("POST", "reports", { requestId: crypto.randomUUID(), targetType: "question", targetId: q.id, reason: "확인이 필요한 게시글입니다." }, bob);
  const opts = { context: { moderatorUserIds: moderator.userId } };
  const id = (await api("GET", "reports", undefined, moderator, opts)).data.items[0].id;
  const results = await Promise.all([api("PATCH", `reports/${id}`, { action: "dismiss" }, moderator, opts), api("PATCH", `reports/${id}`, { action: "hide" }, moderator, opts)]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
  const status = db.sqlite.prepare("SELECT status FROM reports WHERE id = ?").get(id).status;
  const hidden = db.sqlite.prepare("SELECT hidden FROM questions WHERE id = ?").get(q.id).hidden;
  assert.equal(hidden, status === "hidden" ? 1 : 0);
});

test("cross-origin, malformed/oversized JSON, and unavailable storage fail safely", async t => {
  const { api, db } = fixture(t);
  assert.equal((await api("POST", "shoes", shoe(), alice, { headers: { origin: "https://unrelated.test" } })).status, 403);
  assert.equal((await api("POST", "shoes", shoe(), alice, { headers: { "sec-fetch-site": "cross-site" } })).status, 403);
  assert.equal((await api("POST", "shoes", shoe(), alice, { headers: { "content-type": "text/plain" } })).status, 415);
  assert.equal((await api("POST", "shoes", shoe({ memo: "가".repeat(15000) }))).status, 413);
  const malformed = await handleApi(new Request("https://fitlog.test/api/shoes", { method: "POST", headers: { "content-type": "application/json" }, body: "{" }), { db, user: alice, now });
  assert.equal(malformed.status, 400);
  const unavailable = await handleApi(new Request("https://fitlog.test/api/session"), { user: alice, now });
  assert.equal(unavailable.status, 503);
  const response = await unavailable.json();
  assert.equal(response.code, "STORAGE_UNAVAILABLE");
  assert.equal(JSON.stringify(response).includes("SELECT"), false);
  assert.equal(db.count("shoes"), 0);
});
