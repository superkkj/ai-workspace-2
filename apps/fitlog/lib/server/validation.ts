import type { Fit, Purpose, Width } from "../contracts";

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, message: string, code = "INVALID_REQUEST") {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export type Input = Record<string, unknown>;

export function text(value: unknown, label: string, min: number, max: number, fallback?: string): string {
  if (value === undefined && fallback !== undefined) value = fallback;
  if (typeof value !== "string") throw new ApiError(400, `${label}을(를) 확인해 주세요.`);
  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) {
    throw new ApiError(400, `${label}은(는) ${min === 0 ? "" : `${min}~`}${max}자 ${min === 0 ? "이내" : "사이"}로 입력해 주세요.`);
  }
  return trimmed;
}

export function oneOf<T extends string>(value: unknown, values: readonly T[], label: string): T {
  if (typeof value !== "string" || !values.includes(value as T)) throw new ApiError(400, `${label}을(를) 선택해 주세요.`);
  return value as T;
}

export const width = (value: unknown): Width => oneOf(value, ["narrow", "regular", "wide"], "발볼");
export const fit = (value: unknown): Fit => oneOf(value, ["tight", "good", "loose"], "착용감");
export const purpose = (value: unknown): Purpose => oneOf(value, ["daily", "long", "speed", "race"], "러닝 목적");

export function size(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 180 || value > 350 || value % 5 !== 0) {
    throw new ApiError(400, "사이즈는 180~350mm 사이에서 5mm 단위로 입력해 주세요.");
  }
  return value;
}

export function uuid(value: unknown, label = "요청 정보"): string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw new ApiError(400, `${label}가 올바르지 않아요. 화면을 새로 열고 다시 시도해 주세요.`);
  }
  return value.toLowerCase();
}

export function optionalShoeId(value: unknown): string | null {
  return value === undefined || value === null || value === "" ? null : uuid(value, "기준 신발 정보");
}

export function todayInSeoul(now = new Date()): string {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function elapsedDays(date: string, now = new Date()): number {
  return Math.floor((Date.parse(`${todayInSeoul(now)}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / 86_400_000);
}

export function firstUsedAt(value: unknown, now = new Date()): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new ApiError(400, "처음 신은 날짜를 입력해 주세요.");
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value || value > todayInSeoul(now)) {
    throw new ApiError(400, "처음 신은 날짜는 실제 날짜이며 오늘 이전 또는 오늘이어야 해요.");
  }
  return value;
}

export function distance(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 10000) throw new ApiError(400, "달린 거리는 0~10,000km 사이로 입력해 주세요.");
  return value;
}

export function shoeInput(input: Input) {
  return {
    brand: text(input.brand, "브랜드", 1, 40),
    model: text(input.model, "모델", 1, 80),
    size: size(input.size),
    width: width(input.width),
    fit: fit(input.fit),
    purpose: purpose(input.purpose),
    memo: text(input.memo, "메모", 0, 500, ""),
  };
}

export function questionInput(input: Input) {
  return {
    title: text(input.title, "제목", 5, 100),
    body: text(input.body, "질문 내용", 10, 3000),
    purpose: purpose(input.purpose),
    width: width(input.width),
    targetModel: text(input.targetModel, "궁금한 모델", 0, 80, ""),
  };
}

export async function readJson(request: Request): Promise<Input> {
  const contentType = request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  if (contentType !== "application/json") throw new ApiError(415, "요청 형식이 올바르지 않아요.");
  const maxBytes = 32_768;
  if (Number(request.headers.get("content-length") ?? 0) > maxBytes) throw new ApiError(413, "입력 내용이 너무 길어요.");
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, "입력 내용을 확인해 주세요.");
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new ApiError(413, "입력 내용이 너무 길어요.");
    }
    chunks.push(value);
  }
  const combined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { combined.set(chunk, offset); offset += chunk.byteLength; }
  let parsed: unknown;
  try { parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(combined)); }
  catch { throw new ApiError(400, "입력 형식을 읽지 못했어요. 다시 시도해 주세요."); }
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") throw new ApiError(400, "입력 형식을 확인해 주세요.");
  return parsed as Input;
}

export function verifyOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") throw new ApiError(403, "이 화면에서 다시 요청해 주세요.", "ORIGIN_REJECTED");
  if (origin) {
    let valid = false;
    try { valid = new URL(origin).origin === new URL(request.url).origin; } catch { /* invalid origin */ }
    if (!valid) throw new ApiError(403, "이 화면에서 다시 요청해 주세요.", "ORIGIN_REJECTED");
  }
}
