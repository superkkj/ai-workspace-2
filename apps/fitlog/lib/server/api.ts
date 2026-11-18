import type { Answer, Choice, Fit, Followup, Purpose, Question, Report, Session, Shoe, ShoeReference, Width } from "../contracts";
import { ApiError, distance, elapsedDays, firstUsedAt, fit, oneOf, optionalShoeId, purpose, questionInput, readJson, shoeInput, size, text, uuid, verifyOrigin } from "./validation";
import type { Input } from "./validation";

export interface Identity { userId: string }
export interface ApiContext {
  db?: D1Database;
  user: Identity | null;
  moderatorUserIds?: string;
  now?: Date;
}

interface ShoeRow {
  id: string; user_id: string; request_id: string; request_fingerprint: string | null; brand: string; model: string;
  size: number; width: Width; fit: Fit; purpose: Purpose; memo: string; created_at: string;
}
interface QuestionRow {
  id: string; user_id: string; request_id: string; request_fingerprint: string | null; title: string; body: string;
  purpose: Purpose; width: Width; target_model: string; reference_json: string | null;
  nickname: string; hidden: number; created_at: string; reply_count: number;
  c_brand: string | null; c_model: string | null; c_size: number | null; c_created_at: string | null;
  r_body: string | null; r_fit: Fit | null; r_distance_km: number | null;
  r_first_used_at: string | null; r_created_at: string | null; r_updated_at: string | null;
}
interface AnswerRow {
  id: string; question_id: string; user_id: string; request_id: string; request_fingerprint: string | null; body: string;
  nickname: string; reference_json: string | null; created_at: string; hidden: number;
}
interface ChoiceRow { question_id: string; brand: string; model: string; size: number; created_at: string }
interface ReviewRow { question_id: string; body: string; fit: Fit; distance_km: number | null; first_used_at: string; created_at: string; updated_at: string }
interface ReportRow {
  id: string; user_id: string; request_id: string; target_type: "question" | "answer";
  question_id: string; answer_id: string | null; reason: string;
  status: Report["status"]; created_at: string; content_preview?: string;
}

const QUESTION_FROM = `FROM questions q
 LEFT JOIN choices c ON c.question_id = q.id
 LEFT JOIN reviews r ON r.question_id = q.id`;
const QUESTION_SELECT = `SELECT q.*,
 (SELECT COUNT(*) FROM answers a WHERE a.question_id = q.id AND a.hidden = 0) AS reply_count,
 c.brand AS c_brand, c.model AS c_model, c.size AS c_size, c.created_at AS c_created_at,
 r.body AS r_body, r.fit AS r_fit, r.distance_km AS r_distance_km,
 r.first_used_at AS r_first_used_at, r.created_at AS r_created_at, r.updated_at AS r_updated_at
 ${QUESTION_FROM}`;

function reference(raw: string | null): ShoeReference | null { return raw ? JSON.parse(raw) as ShoeReference : null; }
function shoeView(row: ShoeRow): Shoe {
  return { id: row.id, brand: row.brand, model: row.model, size: row.size, width: row.width, fit: row.fit, purpose: row.purpose, memo: row.memo, createdAt: row.created_at };
}
function choiceView(row: ChoiceRow): Choice { return { brand: row.brand, model: row.model, size: row.size, createdAt: row.created_at }; }
function reviewView(row: ReviewRow): Followup {
  return { body: row.body, fit: row.fit, distanceKm: row.distance_km, firstUsedAt: row.first_used_at, daysUsed: elapsedDays(row.first_used_at, new Date(row.updated_at)), createdAt: row.created_at, updatedAt: row.updated_at };
}

// Hash only the normalized original input, never mutable records or derived snapshots.
// This stays valid when an item is edited or its reference shoe is later removed.
async function requestFingerprint(input: object): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(input)));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

function verifyRequestFingerprint(saved: string | null, requested: string): void {
  // Legacy rows have no recoverable original input. Do not invent a hash from their current data.
  if (saved !== null && saved !== requested) {
    throw new ApiError(409, "같은 저장 요청에 다른 내용이 들어왔어요. 먼저 이전 저장 결과를 확인해 주세요.", "REQUEST_ID_CONFLICT");
  }
}

export function isModerator(user: Identity | null, configuredIds?: string): boolean {
  return Boolean(user && configuredIds?.split(",").map(v => v.trim()).filter(Boolean).includes(user.userId));
}

class Service {
  db: D1Database;
  user: Identity | null;
  now: Date;
  canModerate: boolean;

  constructor(context: ApiContext) {
    if (!context.db) throw new ApiError(503, "저장소에 잠시 연결할 수 없어요. 잠시 후 다시 시도해 주세요.", "STORAGE_UNAVAILABLE");
    this.db = context.db;
    this.user = context.user;
    this.now = context.now ?? new Date();
    this.canModerate = isModerator(context.user, context.moderatorUserIds);
  }

  auth(): string {
    if (!this.user?.userId) throw new ApiError(401, "로그인한 뒤 이용해 주세요.", "AUTH_REQUIRED");
    return this.user.userId;
  }
  moderator(): void {
    this.auth();
    if (!this.canModerate) throw new ApiError(403, "신고 관리 권한이 없어요.", "FORBIDDEN");
  }
  timestamp(): string { return this.now.toISOString(); }
  async nickname(): Promise<string> {
    const row = await this.db.prepare("SELECT nickname FROM profiles WHERE user_id = ?").bind(this.auth()).first<{ nickname: string }>();
    return row?.nickname ?? "러너";
  }
  async session(): Promise<Session> {
    return { user: this.user ? { id: this.user.userId, nickname: await this.nickname() } : null, canModerate: this.canModerate };
  }
  async updateProfile(input: Input): Promise<Session> {
    const nickname = text(input.nickname, "닉네임", 2, 20);
    await this.db.prepare("INSERT INTO profiles (user_id, nickname) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET nickname = excluded.nickname").bind(this.auth(), nickname).run();
    return this.session();
  }
  async ownedShoe(id: string): Promise<ShoeRow> {
    const row = await this.db.prepare("SELECT * FROM shoes WHERE id = ? AND user_id = ?").bind(id, this.auth()).first<ShoeRow>();
    if (!row) throw new ApiError(404, "내 신발장에서 이 신발을 찾지 못했어요.", "NOT_FOUND");
    return row;
  }
  async shoeSnapshot(value: unknown): Promise<string | null> {
    const id = optionalShoeId(value);
    if (!id) return null;
    const row = await this.ownedShoe(id);
    const snapshot: ShoeReference = { brand: row.brand, model: row.model, size: row.size, width: row.width, fit: row.fit };
    return JSON.stringify(snapshot);
  }
  async listShoes(): Promise<{ items: Shoe[] }> {
    const { results } = await this.db.prepare("SELECT * FROM shoes WHERE user_id = ? ORDER BY created_at DESC, id DESC").bind(this.auth()).all<ShoeRow>();
    return { items: results.map(shoeView) };
  }
  async createShoe(input: Input): Promise<{ item: Shoe }> {
    const userId = this.auth();
    const data = shoeInput(input);
    const requestId = uuid(input.requestId);
    const fingerprint = await requestFingerprint(data);
    await this.db.prepare(`INSERT INTO shoes (id, user_id, request_id, request_fingerprint, brand, model, size, width, fit, purpose, memo, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(user_id, request_id) DO NOTHING`)
      .bind(crypto.randomUUID(), userId, requestId, fingerprint, data.brand, data.model, data.size, data.width, data.fit, data.purpose, data.memo, this.timestamp()).run();
    const row = await this.db.prepare("SELECT * FROM shoes WHERE user_id = ? AND request_id = ?").bind(userId, requestId).first<ShoeRow>();
    if (!row) throw new Error("shoe_create_missing");
    verifyRequestFingerprint(row.request_fingerprint, fingerprint);
    return { item: shoeView(row) };
  }
  async updateShoe(id: string, input: Input): Promise<{ item: Shoe }> {
    await this.ownedShoe(id);
    const d = shoeInput(input);
    await this.db.prepare("UPDATE shoes SET brand = ?, model = ?, size = ?, width = ?, fit = ?, purpose = ?, memo = ? WHERE id = ? AND user_id = ?")
      .bind(d.brand, d.model, d.size, d.width, d.fit, d.purpose, d.memo, id, this.auth()).run();
    return { item: shoeView(await this.ownedShoe(id)) };
  }
  async deleteShoe(id: string): Promise<{ ok: true }> {
    const userId = this.auth();
    // Missing and unowned records share the same response; ownership stays in the DELETE.
    await this.db.prepare("DELETE FROM shoes WHERE id = ? AND user_id = ?").bind(id, userId).run();
    return { ok: true };
  }

  questionView(row: QuestionRow): Question {
    const choice: Choice | null = row.c_brand !== null ? { brand: row.c_brand, model: row.c_model!, size: row.c_size!, createdAt: row.c_created_at! } : null;
    const review: Followup | null = row.r_body !== null ? { body: row.r_body, fit: row.r_fit!, distanceKm: row.r_distance_km, firstUsedAt: row.r_first_used_at!, daysUsed: elapsedDays(row.r_first_used_at!, new Date(row.r_updated_at!)), createdAt: row.r_created_at!, updatedAt: row.r_updated_at! } : null;
    return {
      id: row.id, title: row.title, body: row.body, purpose: row.purpose, width: row.width,
      targetModel: row.target_model, reference: reference(row.reference_json), nickname: row.nickname,
      status: review ? "reviewed" : choice ? "chosen" : "open", createdAt: row.created_at,
      replyCount: row.reply_count, isMine: row.user_id === this.user?.userId, choice, review,
    };
  }
  answerView(row: AnswerRow): Answer {
    return { id: row.id, body: row.body, nickname: row.nickname, reference: reference(row.reference_json), isMine: row.user_id === this.user?.userId, createdAt: row.created_at };
  }
  async visibleQuestion(id: string): Promise<QuestionRow> {
    const row = await this.db.prepare(`${QUESTION_SELECT} WHERE q.id = ? AND q.hidden = 0`).bind(id).first<QuestionRow>();
    if (!row) throw new ApiError(404, "질문을 찾지 못했어요. 삭제되거나 숨겨진 글일 수 있어요.", "NOT_FOUND");
    return row;
  }
  async ownedQuestion(id: string): Promise<{ id: string }> {
    const row = await this.db.prepare("SELECT id FROM questions WHERE id = ? AND user_id = ?").bind(id, this.auth()).first<{ id: string }>();
    if (!row) throw new ApiError(404, "수정할 질문을 찾지 못했어요.", "NOT_FOUND");
    return row;
  }
  async listQuestions(url: URL): Promise<{ items: Question[]; total: number }> {
    const conditions = ["q.hidden = 0"];
    const values: (string | number)[] = [];
    const q = text(url.searchParams.get("q") ?? "", "검색어", 0, 100);
    if (q) {
      const pattern = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
      conditions.push("(q.title LIKE ? ESCAPE '\\' OR q.body LIKE ? ESCAPE '\\' OR q.target_model LIKE ? ESCAPE '\\' OR COALESCE(q.reference_json, '') LIKE ? ESCAPE '\\' OR COALESCE(c.brand, '') LIKE ? ESCAPE '\\' OR COALESCE(c.model, '') LIKE ? ESCAPE '\\' OR COALESCE(r.body, '') LIKE ? ESCAPE '\\')");
      values.push(pattern, pattern, pattern, pattern, pattern, pattern, pattern);
    }
    const selectedPurpose = url.searchParams.get("purpose");
    if (selectedPurpose && selectedPurpose !== "all") { conditions.push("q.purpose = ?"); values.push(purpose(selectedPurpose)); }
    const selectedWidth = url.searchParams.get("width");
    if (selectedWidth && selectedWidth !== "all") { conditions.push("q.width = ?"); values.push(oneOf(selectedWidth, ["narrow", "regular", "wide"], "발볼")); }
    const status = url.searchParams.get("status");
    if (status && status !== "all") {
      const selected = oneOf(status, ["open", "chosen", "reviewed"], "진행 상태");
      conditions.push(selected === "reviewed" ? "r.question_id IS NOT NULL" : selected === "chosen" ? "c.question_id IS NOT NULL AND r.question_id IS NULL" : "c.question_id IS NULL");
    }
    if (url.searchParams.get("mine") === "1") { conditions.push("q.user_id = ?"); values.push(this.auth()); }
    const where = conditions.join(" AND ");
    const [data, total] = await Promise.all([
      this.db.prepare(`${QUESTION_SELECT} WHERE ${where} ORDER BY q.created_at DESC, q.id DESC LIMIT 100`).bind(...values).all<QuestionRow>(),
      this.db.prepare(`SELECT COUNT(*) AS count ${QUESTION_FROM} WHERE ${where}`).bind(...values).first<{ count: number }>(),
    ]);
    return { items: data.results.map(r => this.questionView(r)), total: total?.count ?? 0 };
  }
  async questionDetail(id: string): Promise<{ item: Question; answers: Answer[] }> {
    const row = await this.visibleQuestion(id);
    const answers = await this.db.prepare("SELECT * FROM answers WHERE question_id = ? AND hidden = 0 ORDER BY created_at, id").bind(id).all<AnswerRow>();
    return { item: this.questionView(row), answers: answers.results.map(a => this.answerView(a)) };
  }
  async createQuestion(input: Input): Promise<{ item: Question }> {
    const userId = this.auth();
    const d = questionInput(input);
    const requestId = uuid(input.requestId);
    const referenceShoeId = optionalShoeId(input.referenceShoeId);
    const fingerprint = await requestFingerprint({ ...d, referenceShoeId });
    const existing = await this.db.prepare("SELECT id, request_fingerprint FROM questions WHERE user_id = ? AND request_id = ?").bind(userId, requestId).first<{ id: string; request_fingerprint: string | null }>();
    if (existing) {
      verifyRequestFingerprint(existing.request_fingerprint, fingerprint);
      return { item: this.questionView(await this.visibleQuestion(existing.id)) };
    }
    const snapshot = await this.shoeSnapshot(referenceShoeId);
    const nickname = await this.nickname();
    await this.db.prepare(`INSERT INTO questions (id, user_id, request_id, request_fingerprint, title, body, purpose, width, target_model, reference_json, nickname, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(user_id, request_id) DO NOTHING`)
      .bind(crypto.randomUUID(), userId, requestId, fingerprint, d.title, d.body, d.purpose, d.width, d.targetModel, snapshot, nickname, this.timestamp()).run();
    const row = await this.db.prepare("SELECT id, request_fingerprint FROM questions WHERE user_id = ? AND request_id = ?").bind(userId, requestId).first<{ id: string; request_fingerprint: string | null }>();
    if (!row) throw new Error("question_create_missing");
    verifyRequestFingerprint(row.request_fingerprint, fingerprint);
    return { item: this.questionView(await this.visibleQuestion(row.id)) };
  }
  async updateQuestion(id: string, input: Input): Promise<{ item: Question }> {
    await this.ownedQuestion(id);
    await this.visibleQuestion(id);
    const d = questionInput(input);
    await this.db.prepare("UPDATE questions SET title = ?, body = ?, purpose = ?, width = ?, target_model = ? WHERE id = ? AND user_id = ?")
      .bind(d.title, d.body, d.purpose, d.width, d.targetModel, id, this.auth()).run();
    return { item: this.questionView(await this.visibleQuestion(id)) };
  }
  async deleteQuestion(id: string): Promise<{ ok: true }> {
    const userId = this.auth();
    // D1 foreign keys cascade answers, choices, reviews, and reports in one atomic statement.
    await this.db.prepare("DELETE FROM questions WHERE id = ? AND user_id = ?").bind(id, userId).run();
    return { ok: true };
  }
  async createAnswer(questionId: string, input: Input): Promise<{ item: Answer }> {
    const userId = this.auth();
    await this.visibleQuestion(questionId);
    const body = text(input.body, "답변", 10, 3000);
    const requestId = uuid(input.requestId);
    const referenceShoeId = optionalShoeId(input.referenceShoeId);
    const fingerprint = await requestFingerprint({ questionId, body, referenceShoeId });
    const existing = await this.db.prepare("SELECT * FROM answers WHERE user_id = ? AND request_id = ?").bind(userId, requestId).first<AnswerRow>();
    if (existing) {
      if (existing.question_id !== questionId) throw new ApiError(409, "이미 다른 질문에서 사용한 요청이에요. 새 답변을 작성해 주세요.", "REQUEST_ID_CONFLICT");
      verifyRequestFingerprint(existing.request_fingerprint, fingerprint);
      return { item: this.answerView(existing) };
    }
    const snapshot = await this.shoeSnapshot(referenceShoeId);
    await this.db.prepare(`INSERT INTO answers (id, question_id, user_id, request_id, request_fingerprint, body, reference_json, nickname, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(user_id, request_id) DO NOTHING`)
      .bind(crypto.randomUUID(), questionId, userId, requestId, fingerprint, body, snapshot, await this.nickname(), this.timestamp()).run();
    const row = await this.db.prepare("SELECT * FROM answers WHERE user_id = ? AND request_id = ?").bind(userId, requestId).first<AnswerRow>();
    if (!row) throw new Error("answer_create_missing");
    if (row.question_id !== questionId) throw new ApiError(409, "이미 다른 질문에서 사용한 요청이에요.", "REQUEST_ID_CONFLICT");
    verifyRequestFingerprint(row.request_fingerprint, fingerprint);
    return { item: this.answerView(row) };
  }
  async deleteAnswer(questionId: string, answerId: string): Promise<{ ok: true }> {
    const userId = this.auth();
    await this.db.prepare("DELETE FROM answers WHERE id = ? AND question_id = ? AND user_id = ?").bind(answerId, questionId, userId).run();
    return { ok: true };
  }
  async choose(questionId: string, input: Input): Promise<{ item: Choice }> {
    await this.ownedQuestion(questionId);
    await this.visibleQuestion(questionId);
    const brand = text(input.brand, "브랜드", 1, 40);
    const model = text(input.model, "모델", 1, 80);
    const shoeSize = size(input.size);
    const saved = await this.db.prepare(`INSERT INTO choices (question_id, brand, model, size, created_at)
      SELECT ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM reviews WHERE question_id = ?)
      ON CONFLICT(question_id) DO UPDATE SET brand = excluded.brand, model = excluded.model, size = excluded.size
      WHERE NOT EXISTS (SELECT 1 FROM reviews WHERE question_id = excluded.question_id)`)
      .bind(questionId, brand, model, shoeSize, this.timestamp(), questionId).run();
    if (!saved.meta.changes) throw new ApiError(409, "착용 후기를 먼저 삭제한 뒤 선택한 신발을 바꿀 수 있어요.", "REVIEW_EXISTS");
    const row = await this.db.prepare("SELECT * FROM choices WHERE question_id = ?").bind(questionId).first<ChoiceRow>();
    if (!row) throw new Error("choice_missing");
    return { item: choiceView(row) };
  }
  async saveReview(questionId: string, input: Input): Promise<{ item: Followup }> {
    await this.ownedQuestion(questionId);
    await this.visibleQuestion(questionId);
    const body = text(input.body, "착용 후기", 10, 3000);
    const feeling = fit(input.fit);
    const km = distance(input.distanceKm);
    const startedAt = firstUsedAt(input.firstUsedAt, this.now);
    const saved = await this.db.prepare(`INSERT INTO reviews (question_id, body, fit, distance_km, first_used_at, created_at, updated_at)
      SELECT ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM choices WHERE question_id = ?)
      ON CONFLICT(question_id) DO UPDATE SET body = excluded.body, fit = excluded.fit, distance_km = excluded.distance_km,
      first_used_at = excluded.first_used_at, updated_at = excluded.updated_at
      WHERE reviews.body IS NOT excluded.body OR reviews.fit IS NOT excluded.fit
      OR reviews.distance_km IS NOT excluded.distance_km OR reviews.first_used_at IS NOT excluded.first_used_at`)
      .bind(questionId, body, feeling, km, startedAt, this.timestamp(), this.timestamp(), questionId).run();
    const row = await this.db.prepare("SELECT * FROM reviews WHERE question_id = ?").bind(questionId).first<ReviewRow>();
    if (!saved.meta.changes && !row) throw new ApiError(409, "선택한 신발을 먼저 기록해 주세요.", "CHOICE_REQUIRED");
    if (!row) throw new Error("review_missing");
    return { item: reviewView(row) };
  }
  async deleteReview(questionId: string): Promise<{ ok: true }> {
    await this.ownedQuestion(questionId);
    await this.db.prepare("DELETE FROM reviews WHERE question_id = ?").bind(questionId).run();
    return { ok: true };
  }
  async report(input: Input): Promise<{ ok: true }> {
    const userId = this.auth();
    const targetType = oneOf(input.targetType, ["question", "answer"], "신고 대상");
    const targetId = uuid(input.targetId, "신고 대상 정보");
    const requestId = uuid(input.requestId);
    const reason = text(input.reason, "신고 사유", 5, 500);
    const existing = await this.db.prepare("SELECT * FROM reports WHERE user_id = ? AND request_id = ?").bind(userId, requestId).first<ReportRow>();
    if (existing) {
      if (existing.target_type !== targetType || (targetType === "question" ? existing.question_id : existing.answer_id) !== targetId) throw new ApiError(409, "신고 요청이 다른 글에 사용됐어요.", "REQUEST_CONFLICT");
      return { ok: true };
    }
    let questionId: string;
    if (targetType === "question") { await this.visibleQuestion(targetId); questionId = targetId; }
    else {
      const answer = await this.db.prepare("SELECT a.question_id FROM answers a JOIN questions q ON q.id = a.question_id WHERE a.id = ? AND a.hidden = 0 AND q.hidden = 0").bind(targetId).first<{ question_id: string }>();
      if (!answer) throw new ApiError(404, "신고할 답변을 찾지 못했어요.", "NOT_FOUND");
      questionId = answer.question_id;
    }
    await this.db.prepare(`INSERT INTO reports (id, user_id, request_id, target_type, question_id, answer_id, reason, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(user_id, request_id) DO NOTHING`)
      .bind(crypto.randomUUID(), userId, requestId, targetType, questionId, targetType === "answer" ? targetId : null, reason, this.timestamp()).run();
    const saved = await this.db.prepare("SELECT * FROM reports WHERE user_id = ? AND request_id = ?").bind(userId, requestId).first<ReportRow>();
    if (!saved || saved.target_type !== targetType || (targetType === "question" ? saved.question_id : saved.answer_id) !== targetId) throw new ApiError(409, "신고 요청이 다른 글에 사용됐어요.", "REQUEST_CONFLICT");
    return { ok: true };
  }
  async listReports(): Promise<{ items: Report[] }> {
    this.moderator();
    const rows = await this.db.prepare(`SELECT rp.*, CASE WHEN rp.target_type = 'question' THEN q.title || ' ' || q.body ELSE a.body END AS content_preview
      FROM reports rp JOIN questions q ON q.id = rp.question_id LEFT JOIN answers a ON a.id = rp.answer_id
      ORDER BY CASE WHEN rp.status = 'pending' THEN 0 ELSE 1 END, rp.created_at DESC LIMIT 100`).all<ReportRow>();
    return { items: rows.results.map(r => ({ id: r.id, targetType: r.target_type, targetId: r.target_type === "question" ? r.question_id : r.answer_id!, reason: r.reason, status: r.status, createdAt: r.created_at, contentPreview: (r.content_preview ?? "").slice(0, 300) })) };
  }
  async moderate(id: string, input: Input): Promise<{ ok: true }> {
    this.moderator();
    const action = oneOf(input.action, ["hide", "dismiss"], "처리 방법");
    const report = await this.db.prepare("SELECT * FROM reports WHERE id = ?").bind(id).first<ReportRow>();
    if (!report) throw new ApiError(404, "신고를 찾지 못했어요.", "NOT_FOUND");
    const status = action === "hide" ? "hidden" : "dismissed";
    if (report.status === status) return { ok: true };
    if (report.status !== "pending") throw new ApiError(409, "이미 처리한 신고예요.", "REPORT_RESOLVED");
    if (action === "hide") {
      const hide = report.target_type === "question"
        ? this.db.prepare("UPDATE questions SET hidden = 1 WHERE id = ? AND EXISTS (SELECT 1 FROM reports WHERE id = ? AND status = 'pending')").bind(report.question_id, id)
        : this.db.prepare("UPDATE answers SET hidden = 1 WHERE id = ? AND EXISTS (SELECT 1 FROM reports WHERE id = ? AND status = 'pending')").bind(report.answer_id, id);
      const result = await this.db.batch([hide, this.db.prepare("UPDATE reports SET status = 'hidden' WHERE id = ? AND status = 'pending'").bind(id)]);
      if (!result[1].meta.changes) throw new ApiError(409, "다른 요청에서 이미 처리한 신고예요.", "REPORT_RESOLVED");
    } else {
      const result = await this.db.prepare("UPDATE reports SET status = 'dismissed' WHERE id = ? AND status = 'pending'").bind(id).run();
      if (!result.meta.changes) throw new ApiError(409, "다른 요청에서 이미 처리한 신고예요.", "REPORT_RESOLVED");
    }
    return { ok: true };
  }
}

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff", "Vary": "Cookie" } });
}

/** Production identity is injected by app/chatgpt-auth.ts, never a client-supplied field. */
export async function handleApi(request: Request, context: ApiContext): Promise<Response> {
  try {
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/api\//, "").replace(/\/$/, "").split("/");
    const method = request.method.toUpperCase();
    const write = method !== "GET" && method !== "HEAD";
    if (write) {
      if (!context.user?.userId) throw new ApiError(401, "로그인한 뒤 이용해 주세요.", "AUTH_REQUIRED");
      verifyOrigin(request);
    }
    if (method === "GET" && path.join("/") === "session" && !context.user) return json({ user: null, canModerate: false });
    const service = new Service(context);
    if (path[0] === "session" && path.length === 1) {
      if (method === "GET") return json(await service.session());
      if (method === "PATCH") return json(await service.updateProfile(await readJson(request)));
    }
    if (path[0] === "shoes") {
      if (path.length === 1 && method === "GET") return json(await service.listShoes());
      if (path.length === 1 && method === "POST") return json(await service.createShoe(await readJson(request)), 201);
      if (path.length === 2) {
        const id = uuid(path[1], "신발 정보");
        if (method === "PATCH") return json(await service.updateShoe(id, await readJson(request)));
        if (method === "DELETE") return json(await service.deleteShoe(id));
      }
    }
    if (path[0] === "questions") {
      if (path.length === 1 && method === "GET") return json(await service.listQuestions(url));
      if (path.length === 1 && method === "POST") return json(await service.createQuestion(await readJson(request)), 201);
      if (path.length >= 2) {
        const id = uuid(path[1], "질문 정보");
        if (path.length === 2) {
          if (method === "GET") return json(await service.questionDetail(id));
          if (method === "PATCH") return json(await service.updateQuestion(id, await readJson(request)));
          if (method === "DELETE") return json(await service.deleteQuestion(id));
        }
        if (path.length === 3) {
          if (path[2] === "answers" && method === "POST") return json(await service.createAnswer(id, await readJson(request)), 201);
          if (path[2] === "choice" && method === "PUT") return json(await service.choose(id, await readJson(request)));
          if (path[2] === "review" && method === "PUT") return json(await service.saveReview(id, await readJson(request)));
          if (path[2] === "review" && method === "DELETE") return json(await service.deleteReview(id));
        }
        if (path.length === 4 && path[2] === "answers" && method === "DELETE") return json(await service.deleteAnswer(id, uuid(path[3], "답변 정보")));
      }
    }
    if (path[0] === "reports") {
      if (path.length === 1 && method === "POST") return json(await service.report(await readJson(request)), 201);
      if (path.length === 1 && method === "GET") return json(await service.listReports());
      if (path.length === 2 && method === "PATCH") return json(await service.moderate(uuid(path[1], "신고 정보"), await readJson(request)));
    }
    throw new ApiError(404, "요청한 기능을 찾지 못했어요.", "NOT_FOUND");
  } catch (error) {
    if (error instanceof ApiError) return json({ error: error.message, code: error.code }, error.status);
    console.error("[fitlog] API request failed", error instanceof Error ? error.name : "UnknownError");
    if (error instanceof Error && /no such table|database.*unavailable/i.test(error.message)) {
      return json({ error: "저장소를 준비 중이에요. 잠시 후 다시 시도해 주세요.", code: "STORAGE_UNAVAILABLE" }, 503);
    }
    return json({ error: "저장하거나 불러오지 못했어요. 입력 내용은 유지하고 잠시 후 다시 시도해 주세요.", code: "INTERNAL_ERROR" }, 500);
  }
}
