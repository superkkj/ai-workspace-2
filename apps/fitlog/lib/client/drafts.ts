export type FormValues = Record<string, string>;
export type WriteMethod = "POST" | "PATCH" | "PUT";
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
export interface PendingSubmission<V extends FormValues> {
  path: string;
  method: WriteMethod;
  body: Record<string, unknown>;
  values: V;
  startedAt: number;
  recovery?: "REQUEST_ID_CONFLICT" | "REMOTE_RECORD_CHANGED";
}
export interface DraftRecord<V extends FormValues> {
  version: 1;
  values: V;
  pending: PendingSubmission<V> | null;
}
export type DraftRead<V extends FormValues> =
  | { status: "loaded"; record: DraftRecord<V> }
  | { status: "empty" | "unavailable" | "invalid" };

export function draftKey(userId: string | undefined, kind: string, targetId: string): string | null {
  if (!userId) return null;
  return ["fitlog-draft-v1", userId, kind, targetId].map(encodeURIComponent).join(":");
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function matchesValues<V extends FormValues>(value: unknown, initial: V): value is V {
  return object(value) && Object.keys(value).length === Object.keys(initial).length
    && Object.keys(initial).every(key => typeof value[key] === "string" && (value[key] as string).length <= 10000);
}

export function readDraft<V extends FormValues>(storage: StorageLike | null, key: string | null, initial: V, request: { path: string; method: WriteMethod }): DraftRead<V> {
  if (!storage || !key) return { status: "unavailable" };
  let raw: string | null;
  try { raw = storage.getItem(key); } catch { return { status: "unavailable" }; }
  if (raw === null) return { status: "empty" };
  try {
    if (raw.length > 80000) return { status: "invalid" };
    const record: unknown = JSON.parse(raw);
    // A tombstone prevents an old pending request from returning if removeItem fails.
    if (object(record) && record.version === 1 && record.cleared === true) return { status: "empty" };
    if (!object(record) || record.version !== 1 || !matchesValues(record.values, initial)) return { status: "invalid" };
    if (record.pending !== null) {
      const pending = record.pending;
      if (!object(pending) || pending.path !== request.path || pending.method !== request.method
        || !object(pending.body) || !matchesValues(pending.values, initial)
        || typeof pending.startedAt !== "number" || !Number.isFinite(pending.startedAt)
        || (pending.recovery !== undefined && pending.recovery !== "REQUEST_ID_CONFLICT" && pending.recovery !== "REMOTE_RECORD_CHANGED")) return { status: "invalid" };
    }
    return { status: "loaded", record: record as unknown as DraftRecord<V> };
  } catch { return { status: "invalid" }; }
}

export function writeDraft<V extends FormValues>(storage: StorageLike | null, key: string | null, values: V, pending: PendingSubmission<V> | null): boolean {
  if (!storage || !key) return false;
  try {
    storage.setItem(key, JSON.stringify({ version: 1, values, pending } satisfies DraftRecord<V>));
    return true;
  } catch { return false; }
}

export function clearDraft(storage: StorageLike | null, key: string | null): boolean {
  if (!storage || !key) return false;
  try { storage.removeItem(key); return true; } catch {
    try { storage.setItem(key, JSON.stringify({ version: 1, cleared: true })); return true; } catch { return false; }
  }
}

export function captureSubmission<V extends FormValues>(request: { path: string; method: WriteMethod }, body: Record<string, unknown>, values: V): PendingSubmission<V> {
  // Capture immutable wire data before starting fetch. Later edits cannot alter a retry.
  return JSON.parse(JSON.stringify({ ...request, body, values, startedAt: Date.now() })) as PendingSubmission<V>;
}

export function settleDetachedDraft<V extends FormValues>(storage: StorageLike | null, key: string | null, pending: PendingSubmission<V>, confirmed: boolean): boolean {
  const current = readDraft(storage, key, pending.values, pending);
  if (current.status === "empty") return true;
  if (current.status !== "loaded") return false;
  // A late response from a closed form must not clear or overwrite newer edits.
  if (JSON.stringify(current.record.pending) !== JSON.stringify(pending)) return true;
  return confirmed ? clearDraft(storage, key) : writeDraft(storage, key, current.record.values, null);
}

export type ConflictClearResult = "cleared" | "cancelled" | "storage_unavailable" | "changed";

export function clearConfirmedConflict<V extends FormValues>(storage: StorageLike | null, key: string | null, pending: PendingSubmission<V>, userConfirmed: boolean): ConflictClearResult {
  if (!userConfirmed || !pending.recovery) return "cancelled";
  const current = readDraft(storage, key, pending.values, pending);
  if (current.status === "empty") return "cleared";
  if (current.status !== "loaded") return "storage_unavailable";
  if (JSON.stringify(current.record.pending) !== JSON.stringify(pending)) return "changed";
  return clearDraft(storage, key) ? "cleared" : "storage_unavailable";
}
