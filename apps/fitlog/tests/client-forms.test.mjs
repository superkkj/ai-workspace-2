import assert from "node:assert/strict";
import { after, test } from "node:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const root = fileURLToPath(new URL("../", import.meta.url));
const temporary = await mkdtemp(join(tmpdir(), "fitlog-forms-test-"));
async function compile(name) {
  const output = await build({ entryPoints: [join(root, `lib/client/${name}.ts`)], bundle: true, platform: "node", format: "esm", write: false });
  const path = join(temporary, `${name}.mjs`);
  await writeFile(path, output.outputFiles[0].text);
  return import(pathToFileURL(path).href);
}
const { draftKey, writeDraft, readDraft, clearDraft, captureSubmission, settleDetachedDraft, clearConfirmedConflict } = await compile("drafts");
const { ApiError, api, retainPending, sendSubmission } = await compile("submission");
after(() => rm(temporary, { recursive: true, force: true }));

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, value); }
  removeItem(key) { this.values.delete(key); }
}
const request = { path: "/api/questions", method: "POST" };
const empty = { title: "", body: "", referenceShoeId: "" };
const written = { title: "다음 신발 질문 초안", body: "작성하다가 닫아도 이 내용은 이어서 쓸 수 있어야 해요.", referenceShoeId: "shoe-a" };

test("drafts restore after closing and stay isolated by user, form and target", () => {
  const storage = new MemoryStorage();
  const key = draftKey("alice", "question", "new");
  assert.equal(writeDraft(storage, key, written, null), true);
  assert.deepEqual(readDraft(storage, key, empty, request), { status: "loaded", record: { version: 1, values: written, pending: null } });
  for (const other of [draftKey("bob", "question", "new"), draftKey("alice", "answer", "new"), draftKey("alice", "question", "another")]) {
    assert.equal(readDraft(storage, other, empty, request).status, "empty");
  }
});

test("an unknown user never reads or writes a shared draft key", () => {
  const storage = { getItem() { assert.fail("must not read"); }, setItem() { assert.fail("must not write"); }, removeItem() { assert.fail("must not remove"); } };
  assert.equal(draftKey(undefined, "question", "new"), null);
  assert.equal(draftKey("", "question", "new"), null);
  assert.equal(readDraft(storage, null, empty, request).status, "unavailable");
  assert.equal(writeDraft(storage, null, written, null), false);
  assert.equal(clearDraft(storage, null), false);
});

test("storage denial and quota errors are reported without throwing or claiming a save", () => {
  const storage = { getItem() { throw new Error("denied"); }, setItem() { throw new Error("quota"); }, removeItem() { throw new Error("denied"); } };
  assert.equal(readDraft(storage, "a", empty, request).status, "unavailable");
  assert.equal(writeDraft(storage, "a", written, null), false);
  assert.equal(clearDraft(storage, "a"), false);
});

test("malformed drafts and a pending request for a different resource are not replayed", () => {
  const storage = new MemoryStorage();
  storage.setItem("a", "broken JSON");
  assert.equal(readDraft(storage, "a", empty, request).status, "invalid");
  const pending = captureSubmission({ path: "/api/shoes", method: "POST" }, { requestId: crypto.randomUUID() }, written);
  writeDraft(storage, "a", written, pending);
  assert.equal(readDraft(storage, "a", empty, request).status, "invalid");
});

test("discard or successful save clears only the corresponding draft", () => {
  const storage = new MemoryStorage();
  writeDraft(storage, "a", written, null);
  writeDraft(storage, "b", { ...written, body: "다른 폼에 작성 중인 내용" }, null);
  assert.equal(clearDraft(storage, "a"), true);
  assert.equal(readDraft(storage, "a", empty, request).status, "empty");
  assert.equal(readDraft(storage, "b", empty, request).status, "loaded");
});

test("a cleared tombstone prevents stale pending replay when removeItem fails", () => {
  const storage = new MemoryStorage();
  writeDraft(storage, "a", written, captureSubmission(request, { requestId: crypto.randomUUID(), ...written }, written));
  storage.removeItem = () => { throw new Error("cannot remove"); };
  assert.equal(clearDraft(storage, "a"), true);
  assert.equal(readDraft(storage, "a", empty, request).status, "empty");
});

test("lost write response restores the exact original payload and request id for one safe retry", async () => {
  const storage = new MemoryStorage();
  const input = { ...written };
  const body = { requestId: crypto.randomUUID(), ...input };
  const pending = captureSubmission(request, body, input);
  assert.equal(writeDraft(storage, "a", input, pending), true);
  const rows = new Map();
  const sent = [];
  let dropped = false;
  const fetcher = async (path, options) => {
    assert.equal(path, request.path);
    assert.equal(options.method, "POST");
    const data = JSON.parse(options.body);
    sent.push(data);
    if (!rows.has(data.requestId)) rows.set(data.requestId, { id: "saved-question", ...data });
    if (!dropped) { dropped = true; throw new TypeError("Failed to fetch"); }
    return Response.json({ item: rows.get(data.requestId) });
  };
  await assert.rejects(sendSubmission(pending, fetcher), error => error instanceof ApiError && error.uncertain && retainPending(error));
  input.body = "나중의 화면 입력은 원전송을 바꿀 수 없어요.";
  body.body = "원본 객체를 바꿔도 전송 스냅샷은 유지돼요.";
  const restored = readDraft(storage, "a", empty, request);
  assert.equal(restored.status, "loaded");
  const saved = await sendSubmission(restored.record.pending, fetcher);
  assert.equal(rows.size, 1);
  assert.deepEqual(sent[0], sent[1]);
  assert.equal(saved.body, written.body);
  assert.equal(restored.record.pending.values.body, written.body);
});

test("definite validation failures allow editing while server failures and id conflicts retain the original request", async () => {
  const pending = captureSubmission(request, { requestId: crypto.randomUUID(), ...written }, written);
  for (const [status, code, retain] of [[400, "VALIDATION_ERROR", false], [401, "UNAUTHORIZED", false], [500, "INTERNAL_ERROR", true], [409, "REQUEST_ID_CONFLICT", true]]) {
    await assert.rejects(sendSubmission(pending, async () => Response.json({ error: "요청 확인이 필요해요.", code }, { status })), error => {
      assert.equal(error.code, code);
      assert.equal(retainPending(error), retain);
      return true;
    });
  }
});

test("HTML sign-in responses and missing item payloads never count as a successful write", async () => {
  const pending = captureSubmission(request, { requestId: crypto.randomUUID(), ...written }, written);
  for (const response of [new Response("<html>Sign in required</html>", { status: 200 }), Response.json({ ok: true })]) {
    await assert.rejects(sendSubmission(pending, async () => response), error => error instanceof ApiError && error.code === "INVALID_RESPONSE" && retainPending(error));
  }
});

test("network errors are expressed in Korean and request credentials stay same-origin", async () => {
  await assert.rejects(api("/api/questions", {}, async (_path, options) => {
    assert.equal(options.credentials, "same-origin");
    assert.equal(options.cache, "no-store");
    throw new TypeError("Failed to fetch");
  }), error => error instanceof ApiError && error.message.includes("연결") && !error.message.includes("Failed to fetch"));
});

test("late responses from closed forms never clear or overwrite a newer draft", () => {
  const storage = new MemoryStorage();
  const pending = captureSubmission(request, { requestId: crypto.randomUUID(), ...written }, written);
  writeDraft(storage, "a", written, pending);
  assert.equal(settleDetachedDraft(storage, "a", pending, false), true);
  const edited = { ...written, body: "새로 연 창에서 수정한 내용이 우선이에요." };
  writeDraft(storage, "a", edited, null);
  assert.equal(settleDetachedDraft(storage, "a", pending, false), true);
  assert.equal(settleDetachedDraft(storage, "a", pending, true), true);
  assert.equal(readDraft(storage, "a", empty, request).record.values.body, edited.body);
  writeDraft(storage, "a", written, pending);
  assert.equal(settleDetachedDraft(storage, "a", pending, true), true);
  assert.equal(readDraft(storage, "a", empty, request).status, "empty");
});

test("auth or validation refusals after a lost response never discard the original request identity", async () => {
  const storage = new MemoryStorage();
  const pending = captureSubmission(request, { requestId: crypto.randomUUID(), ...written }, written);
  writeDraft(storage, "a", written, pending);
  const rows = new Map();
  const ids = [];
  const failures = [0, 401, 403, 400, 404];
  const fetcher = async (_path, options) => {
    const body = JSON.parse(options.body);
    ids.push(body.requestId);
    const failure = failures.shift();
    if (failure === 0) {
      rows.set(body.requestId, { id: "already-saved", ...body });
      throw new TypeError("response lost after commit");
    }
    if (failure) return Response.json({ error: "이번 요청은 거절됐어요." }, { status: failure });
    if (!rows.has(body.requestId)) rows.set(body.requestId, { id: "duplicate", ...body });
    return Response.json({ item: rows.get(body.requestId) });
  };
  await assert.rejects(sendSubmission(pending, fetcher), error => retainPending(error));
  for (const _status of [401, 403, 400, 404]) {
    const restored = readDraft(storage, "a", empty, request).record.pending;
    await assert.rejects(sendSubmission(restored, fetcher), error => {
      assert.equal(retainPending(error, true), true);
      return true;
    });
    assert.equal(readDraft(storage, "a", empty, request).record.pending.body.requestId, pending.body.requestId);
  }
  const saved = await sendSubmission(readDraft(storage, "a", empty, request).record.pending, fetcher);
  assert.equal(saved.id, "already-saved");
  assert.equal(rows.size, 1);
  assert.equal(new Set(ids).size, 1);
});

test("first updates write normally while retries confirm all four record types with GET only", async () => {
  const shoe = { id: "shoe-a", brand: "브랜드", model: "모델", size: 270, width: "wide", fit: "good", purpose: "daily", memo: "개인 메모" };
  const question = { id: "question-a", isMine: true, title: "질문 제목입니다", body: "수정한 질문 본문입니다.", purpose: "daily", width: "wide", targetModel: "다음 모델", reference: { model: "기존 신발" } };
  const choice = { brand: "브랜드", model: "선택 모델", size: 270, createdAt: "2026-11-18T06:00:00Z" };
  const review = { body: "수정한 실제 사용 후기입니다.", fit: "good", firstUsedAt: "2026-11-18", distanceKm: 5, updatedAt: "2026-11-18T06:00:00Z", daysUsed: 0 };
  const cases = [
    { path: "/api/shoes/shoe-a", method: "PATCH", readPath: "/api/shoes", body: { ...shoe, requestId: crypto.randomUUID() }, response: { items: [shoe] }, expected: shoe },
    { path: "/api/questions/question-a", method: "PATCH", readPath: "/api/questions/question-a", body: { title: question.title, body: question.body, purpose: question.purpose, width: question.width, targetModel: question.targetModel, requestId: crypto.randomUUID() }, response: { item: question }, expected: question },
    { path: "/api/questions/question-a/choice", method: "PUT", readPath: "/api/questions/question-a", body: { brand: choice.brand, model: choice.model, size: choice.size }, response: { item: { ...question, choice } }, expected: choice },
    { path: "/api/questions/question-a/review", method: "PUT", readPath: "/api/questions/question-a", body: { body: review.body, fit: review.fit, firstUsedAt: review.firstUsedAt, distanceKm: review.distanceKm }, response: { item: { ...question, review } }, expected: review },
  ];
  for (const item of cases) {
    const pending = captureSubmission(item, item.body, written);
    const first = await sendSubmission(pending, async (path, options) => {
      assert.equal(path, item.path);
      assert.equal(options.method, item.method);
      return Response.json({ item: item.expected });
    });
    assert.deepEqual(first, item.expected);
    const retried = await sendSubmission(pending, async (path, options) => {
      assert.equal(path, item.readPath);
      assert.equal(options.method ?? "GET", "GET");
      assert.equal(options.body, undefined);
      return Response.json(item.response);
    }, { previouslyUncertain: true });
    assert.deepEqual(retried, item.expected);
  }
});

test("uncertain update retries never overwrite changed or deleted records", async () => {
  const pending = captureSubmission({ path: "/api/questions/question-a/review", method: "PUT" }, { body: "처음 제출한 후기입니다.", fit: "good", firstUsedAt: "2026-11-18", distanceKm: null }, written);
  for (const response of [
    Response.json({ item: { isMine: true, review: { body: "다른 창에서 새로 수정한 내용입니다.", fit: "good", firstUsedAt: "2026-11-18", distanceKm: null } } }),
    Response.json({ item: { isMine: true, review: null } }),
    Response.json({ error: "삭제된 질문이에요." }, { status: 404 }),
  ]) {
    await assert.rejects(sendSubmission(pending, async (_path, options) => {
      assert.equal(options.method ?? "GET", "GET", "an uncertain update must not issue a write");
      return response;
    }, { previouslyUncertain: true }), error => error instanceof ApiError && error.code === "REMOTE_RECORD_CHANGED" && retainPending(error, true));
  }
});

test("update confirmation respects current ownership and does not mistake another user's record for success", async () => {
  const pending = captureSubmission({ path: "/api/questions/question-a/choice", method: "PUT" }, { brand: "브랜드", model: "모델", size: 270 }, written);
  await assert.rejects(sendSubmission(pending, async () => Response.json({ item: { isMine: false, choice: pending.body } }), { previouslyUncertain: true }), error => error instanceof ApiError && error.status === 403 && retainPending(error, true));
});

test("a conflicted local draft is cleared only after explicit confirmation and never deletes another draft", () => {
  const storage = new MemoryStorage();
  const pending = { ...captureSubmission(request, { requestId: crypto.randomUUID(), ...written }, written), recovery: "REQUEST_ID_CONFLICT" };
  writeDraft(storage, "a", written, pending);
  writeDraft(storage, "b", written, null);
  const restored = readDraft(storage, "a", empty, request).record.pending;
  assert.equal(restored.recovery, "REQUEST_ID_CONFLICT");
  assert.equal(clearConfirmedConflict(storage, "a", restored, false), "cancelled");
  assert.equal(readDraft(storage, "a", empty, request).status, "loaded");
  assert.equal(clearConfirmedConflict(storage, "a", restored, true), "cleared");
  assert.equal(readDraft(storage, "a", empty, request).status, "empty");
  assert.equal(readDraft(storage, "b", empty, request).status, "loaded");
  writeDraft(storage, "a", { ...written, body: "새로 작성한 초안" }, null);
  assert.equal(clearConfirmedConflict(storage, "a", restored, true), "changed");
  assert.equal(readDraft(storage, "a", empty, request).record.values.body, "새로 작성한 초안");
});

test("confirmed conflict cleanup distinguishes unavailable storage from another draft without deleting either", () => {
  const pending = { ...captureSubmission(request, { requestId: crypto.randomUUID(), ...written }, written), recovery: "REMOTE_RECORD_CHANGED" };
  const blocked = { getItem() { throw new Error("storage denied"); }, setItem() { assert.fail("must not write after a denied read"); }, removeItem() { assert.fail("must not delete after a denied read"); } };
  assert.equal(clearConfirmedConflict(blocked, "a", pending, false), "cancelled");
  assert.equal(clearConfirmedConflict(blocked, "a", pending, true), "storage_unavailable");
  assert.equal(clearConfirmedConflict(null, "a", pending, true), "storage_unavailable");
  const storage = new MemoryStorage();
  writeDraft(storage, "a", written, pending);
  const before = storage.getItem("a");
  storage.removeItem = () => { throw new Error("cannot remove"); };
  storage.setItem = () => { throw new Error("cannot write tombstone"); };
  assert.equal(clearConfirmedConflict(storage, "a", pending, true), "storage_unavailable");
  assert.equal(storage.getItem("a"), before);
  const other = new MemoryStorage();
  const newer = { ...pending, startedAt: pending.startedAt + 1, body: { ...pending.body, requestId: crypto.randomUUID() } };
  writeDraft(other, "a", written, newer);
  assert.equal(clearConfirmedConflict(other, "a", pending, true), "changed");
  assert.equal(readDraft(other, "a", empty, request).record.pending.body.requestId, newer.body.requestId);
});
