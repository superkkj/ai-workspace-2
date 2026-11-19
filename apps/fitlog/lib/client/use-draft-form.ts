"use client";

import { useEffect, useRef, useState } from "react";
import { captureSubmission, clearConfirmedConflict, clearDraft, draftKey, readDraft, settleDetachedDraft, writeDraft, type FormValues, type PendingSubmission, type StorageLike, type WriteMethod } from "./drafts";
import { ApiError, retainPending, sendSubmission } from "./submission";

function sessionStore(): StorageLike | null {
  try { return window.sessionStorage; } catch { return null; }
}

export function useDraftForm<V extends FormValues>(options: {
  userId?: string;
  kind: string;
  targetId: string;
  initialValues: V;
  path: string;
  method: WriteMethod;
}) {
  const key = draftKey(options.userId, options.kind, options.targetId);
  const defaults = useRef(options.initialValues);
  const [values, setValues] = useState<V>(options.initialValues);
  const valuesRef = useRef(values);
  const [pending, setPending] = useState<PendingSubmission<V> | null>(null);
  const pendingRef = useRef<PendingSubmission<V> | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [storageOkay, setStorageOkay] = useState(false);
  const [restored, setRestored] = useState(false);
  const lock = useRef(false);
  const mounted = useRef(false);
  const generation = useRef(0);
  const dirty = JSON.stringify(values) !== JSON.stringify(defaults.current);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    generation.current += 1;
    lock.current = false;
    setBusy(false);
    defaults.current = options.initialValues;
    const loaded = readDraft(sessionStore(), key, defaults.current, options);
    const nextPending = loaded.status === "loaded" ? loaded.record.pending : null;
    const nextValues = loaded.status === "loaded" ? nextPending?.values ?? loaded.record.values : defaults.current;
    valuesRef.current = nextValues;
    pendingRef.current = nextPending;
    setValues(nextValues);
    setPending(nextPending);
    setRestored(loaded.status === "loaded");
    setStorageOkay(loaded.status === "loaded" || loaded.status === "empty");
    setError(loaded.status === "invalid" ? "이전에 보관한 초안을 읽지 못했어요. 내 기록에서 저장 여부를 확인해 주세요." : "");
    setConfirmed(false);
    setReady(true);
    // A form's identity, rather than fetched shoe-list changes, controls restoration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, options.path, options.method]);

  useEffect(() => {
    if (confirmed || (!dirty && !pending) || storageOkay) return;
    const protect = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [dirty, pending, storageOkay, confirmed]);

  function persist(nextValues: V, nextPending: PendingSubmission<V> | null) {
    const saved = writeDraft(sessionStore(), key, nextValues, nextPending);
    setStorageOkay(saved);
    return saved;
  }

  function change<K extends keyof V>(field: K, value: V[K]) {
    if (!ready || lock.current || pendingRef.current || confirmed) return;
    const next = { ...valuesRef.current, [field]: value };
    valuesRef.current = next;
    setValues(next);
    persist(next, null);
  }

  function changeMany(patch: Partial<V>) {
    if (!ready || lock.current || pendingRef.current || confirmed) return;
    const next = { ...valuesRef.current, ...patch };
    valuesRef.current = next;
    setValues(next);
    persist(next, null);
  }

  function discard() {
    if (lock.current || pendingRef.current) return;
    const cleared = clearDraft(sessionStore(), key);
    valuesRef.current = defaults.current;
    setValues(defaults.current);
    setRestored(false);
    setStorageOkay(cleared);
    setError(cleared ? "" : "이 브라우저의 임시 보관 내용을 지우지 못했어요. 창을 다시 열 때 이전 내용이 나타날 수 있어요.");
  }

  function close(onClose: () => void) {
    if (lock.current) return;
    if (confirmed) { onClose(); return; }
    if ((dirty || pendingRef.current) && !storageOkay) {
      if (pendingRef.current) {
        setError("저장 결과가 아직 확인되지 않았고 임시 보관도 사용할 수 없어요. 이 창에서 ‘저장 확인 다시 시도’를 눌러 확인해 주세요.");
        return;
      }
      if (!window.confirm("이 브라우저에서 초안을 보관할 수 없어 창을 닫으면 입력이 사라져요. 닫을까요?")) return;
    }
    onClose();
  }

  function resolveConflict(onClose: () => void) {
    const request = pendingRef.current;
    if (lock.current || !request?.recovery) return;
    const accepted = window.confirm("현재 질문이나 내 신발장·내 기록에서 이전 저장 결과를 확인했나요? 필요한 원래 내용은 ‘보낸 내용 보기’에서 먼저 복사해 주세요. 확인했다면 이 창의 초안만 정리해요. 이미 저장된 기록은 바뀌지 않으며 새 기록을 자동으로 만들지 않아요.");
    if (!accepted) return;
    const cleared = clearConfirmedConflict(sessionStore(), key, request, true);
    if (cleared === "cancelled") return;
    if (cleared === "changed") {
      window.alert("현재 창과 다른 초안이 보관되어 있어 그 초안은 정리하지 않았어요. 창을 다시 열면 현재 보관된 초안을 확인할 수 있어요.");
      onClose();
      return;
    }
    pendingRef.current = null;
    setPending(null);
    valuesRef.current = defaults.current;
    setValues(defaults.current);
    setError("");
    if (cleared === "storage_unavailable") {
      window.alert("이 창의 미확정 초안은 정리했어요. 브라우저에 보관된 내용은 지우지 못해 다음에 이전 초안이 다시 나타날 수 있어요. 이미 서버에 저장된 기록은 그대로이며 새 기록을 만들지는 않았어요.");
    }
    onClose();
  }

  async function submit<T>(body: (requestId: string) => Record<string, unknown>, onSaved: (item: T) => void | Promise<void>) {
    if (!ready || lock.current || confirmed) return;
    lock.current = true;
    const startedGeneration = generation.current;
    const stillHere = () => mounted.current && generation.current === startedGeneration;
    setBusy(true);
    setError("");
    let request = pendingRef.current;
    const hadUnconfirmedAttempt = request !== null;
    if (!request) {
      try { request = captureSubmission({ path: options.path, method: options.method }, body(crypto.randomUUID()), valuesRef.current); }
      catch (cause) {
        setError(cause instanceof Error ? cause.message : "입력 내용을 확인해 주세요.");
        lock.current = false;
        setBusy(false);
        return;
      }
      pendingRef.current = request;
      setPending(request);
      persist(request.values, request);
    }
    let item: T;
    try { item = await sendSubmission<T, V>(request, fetch, { previouslyUncertain: hadUnconfirmedAttempt }); }
    catch (cause) {
      if (!stillHere()) {
        if (!retainPending(cause, hadUnconfirmedAttempt)) settleDetachedDraft(sessionStore(), key, request, false);
        return;
      }
      if (!retainPending(cause, hadUnconfirmedAttempt)) {
        pendingRef.current = null;
        setPending(null);
        persist(valuesRef.current, null);
      } else if (cause instanceof ApiError && (cause.code === "REQUEST_ID_CONFLICT" || cause.code === "REMOTE_RECORD_CHANGED")) {
        request = { ...request, recovery: cause.code };
        pendingRef.current = request;
        setPending(request);
        persist(request.values, request);
      }
      setError(cause instanceof Error ? cause.message : "저장 결과를 확인하지 못했어요. 다시 확인해 주세요.");
      lock.current = false;
      setBusy(false);
      return;
    }
    if (!stillHere()) {
      settleDetachedDraft(sessionStore(), key, request, true);
      return;
    }
    // The write has succeeded. A later UI callback failure must never resubmit it.
    pendingRef.current = null;
    setPending(null);
    setConfirmed(true);
    const cleared = clearDraft(sessionStore(), key);
    setStorageOkay(cleared);
    lock.current = false;
    setBusy(false);
    try { await onSaved(item); }
    catch { setError("기록은 저장됐지만 화면을 갱신하지 못했어요. 창을 닫고 새로고침해 확인해 주세요."); }
  }

  return { values, change, changeMany, pending, ready, busy, error, storageOkay, restored, dirty, confirmed, discard, close, resolveConflict, submit };
}
