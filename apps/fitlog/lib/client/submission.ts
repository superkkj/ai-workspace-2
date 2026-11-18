import type { FormValues, PendingSubmission } from "./drafts";

export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string, public uncertain = false) {
    super(message);
    this.name = "ApiError";
  }
}

export async function api<T>(path: string, options: RequestInit = {}, fetcher: typeof fetch = fetch): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (options.signal?.aborted) abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(abort, 20000);
  try {
    const response = await fetcher(path, {
      ...options,
      signal: controller.signal,
      cache: "no-store",
      credentials: "same-origin",
      headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers },
    });
    const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
    if (!response.ok) {
      const message = typeof payload?.error === "string" ? payload.error
        : response.status === 401 ? "로그인 상태를 다시 확인해 주세요. 입력한 내용은 유지돼요."
          : "요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.";
      throw new ApiError(message, response.status, typeof payload?.code === "string" ? payload.code : undefined, response.status >= 500 || response.status === 408);
    }
    if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
      throw new ApiError("서버의 저장 결과를 확인하지 못했어요. 같은 요청으로 다시 확인해 주세요.", response.status, "INVALID_RESPONSE", true);
    }
    return payload as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(controller.signal.aborted
      ? "응답이 늦어 저장 결과를 확인하지 못했어요. 연결을 확인한 뒤 다시 시도해 주세요."
      : "연결이 끊겨 저장 결과를 확인하지 못했어요. 연결을 확인한 뒤 다시 시도해 주세요.", 0, "NETWORK_ERROR", true);
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abort);
  }
}

export function retainPending(error: unknown, hadUnconfirmedAttempt = false): boolean {
  // A refusal on a later attempt cannot prove that an earlier lost response
  // did not commit. Keep its original request identity until confirmed.
  return hadUnconfirmedAttempt || !(error instanceof ApiError) || error.uncertain || error.code === "REQUEST_ID_CONFLICT" || error.code === "REQUEST_CONFLICT";
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function changedRecord(): ApiError {
  return new ApiError("보낸 내용과 현재 기록이 달라 저장 여부를 확인할 수 없어요. 내 신발장이나 내 기록에서 최신 내용을 확인해 주세요.", 409, "REMOTE_RECORD_CHANGED", true);
}

async function confirmPreviousUpdate<T, V extends FormValues>(pending: PendingSubmission<V>, fetcher: typeof fetch): Promise<T> {
  let current: unknown;
  let fields: string[];
  try {
    const shoe = /^\/api\/shoes\/([^/?#]+)$/.exec(pending.path);
    const question = /^\/api\/questions\/([^/?#]+)(?:\/(choice|review))?$/.exec(pending.path);
    if (shoe && pending.method === "PATCH") {
      const result = await api<{ items?: unknown[] }>("/api/shoes", {}, fetcher);
      current = result.items?.find(item => record(item) && item.id === shoe[1]);
      fields = ["brand", "model", "size", "width", "fit", "purpose", "memo"];
    } else if (question) {
      const result = await api<{ item?: Record<string, unknown> }>(`/api/questions/${question[1]}`, {}, fetcher);
      if (!record(result.item)) throw changedRecord();
      if (!result.item.isMine) throw new ApiError("이 기록의 수정 권한을 다시 확인해 주세요.", 403, "FORBIDDEN");
      if (question[2] === "choice" && pending.method === "PUT") {
        current = result.item.choice;
        fields = ["brand", "model", "size"];
      } else if (question[2] === "review" && pending.method === "PUT") {
        current = result.item.review;
        fields = ["body", "fit", "firstUsedAt", "distanceKm"];
      } else if (!question[2] && pending.method === "PATCH") {
        current = result.item;
        fields = ["title", "body", "purpose", "width", "targetModel"];
      } else throw changedRecord();
    } else throw changedRecord();
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) throw changedRecord();
    throw error;
  }
  if (!record(current) || fields.some(field => current[field] !== pending.body[field])) throw changedRecord();
  return current as T;
}

export async function sendSubmission<T, V extends FormValues>(pending: PendingSubmission<V>, fetcher: typeof fetch = fetch, options: { previouslyUncertain?: boolean } = {}): Promise<T> {
  // A retry of an update must not overwrite a newer edit. Read and compare only;
  // even an apparently unsaved update needs an explicit fresh editing decision.
  if (options.previouslyUncertain && pending.method !== "POST") return confirmPreviousUpdate<T, V>(pending, fetcher);
  const response = await api<{ item?: T }>(pending.path, { method: pending.method, body: JSON.stringify(pending.body) }, fetcher);
  if (!record(response.item)) {
    throw new ApiError("저장된 기록을 확인하지 못했어요. 같은 요청으로 다시 확인해 주세요.", 200, "INVALID_RESPONSE", true);
  }
  return response.item;
}
