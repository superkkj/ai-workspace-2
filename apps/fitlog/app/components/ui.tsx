"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ArrowRight, Check, LoaderCircle, X } from "lucide-react";
export { ApiError, api } from "../../lib/client/submission";

export function humanDate(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", timeZone: "Asia/Seoul" }).format(date);
}

export function todaySeoul(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date());
}

export function Field({ label, hint, children, className = "" }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return <label className={`field ${className}`}><span className="field-label">{label}</span>{children}{hint && <span className="field-hint">{hint}</span>}</label>;
}

export function FormError({ error }: { error: string }) {
  return error ? <p className="form-error" role="alert">{error}</p> : null;
}

export function SaveButton({ busy, disabled = false, children = "저장하기" }: { busy: boolean; disabled?: boolean; children?: ReactNode }) {
  return <button className="btn btn-primary" disabled={busy || disabled} type="submit">{busy ? <LoaderCircle size={17} className="spin" /> : <Check size={17} />}{busy ? "저장하는 중…" : children}</button>;
}

export function Modal({ title, subtitle, children, onClose, busy = false, wide = false }: { title: string; subtitle?: string; children: ReactNode; onClose: () => void; busy?: boolean; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  const busyRef = useRef(busy);
  busyRef.current = busy;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() => {
      const focusable = ref.current?.querySelector<HTMLElement>("input:not([type='hidden']), textarea, select, button, a[href]");
      (focusable ?? ref.current)?.focus();
    });
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busyRef.current) { event.preventDefault(); closeRef.current(); }
      if (event.key === "Tab") {
        const nodes = [...(ref.current?.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex='0']") ?? [])].filter(el => !el.matches(":disabled") && el.getClientRects().length > 0);
        const first = nodes[0]; const last = nodes[nodes.length - 1];
        if (!first) { event.preventDefault(); ref.current?.focus(); return; }
        if (event.shiftKey && (document.activeElement === first || !ref.current?.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => { cancelAnimationFrame(frame); document.removeEventListener("keydown", handleKey); document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <div className={`modal ${wide ? "modal-wide" : ""}`} role="dialog" aria-modal="true" aria-labelledby={id} ref={ref} tabIndex={-1}>
      <header className="modal-heading"><div><span className="eyebrow">YOUR NEXT PAIR</span><h2 id={id}>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button type="button" className="icon-button" onClick={onClose} disabled={busy} aria-label="창 닫기"><X size={21} /></button></header>
      <div className="modal-content">{children}</div>
    </div>
  </div>;
}

export function useFormAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const requestId = useRef("");
  const execute = async (action: (requestId: string) => Promise<void>) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    if (!requestId.current) requestId.current = crypto.randomUUID();
    try { await action(requestId.current); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "저장하지 못했어요. 입력 내용은 그대로 남아 있어요."); }
    finally { setBusy(false); lock.current = false; }
  };
  return { busy, error, setError, execute };
}

export function SignInContent({ onClose }: { onClose: () => void }) {
  return <div className="sign-in-content"><div className="round-symbol"><ArrowRight size={29} /></div><h3>나의 경험이<br />누군가의 다음 한 켤레로.</h3><p>로그인하면 신발을 기록하고,<br />다른 러너와 질문과 경험을 나눌 수 있어요.</p><a className="btn btn-primary" href="/signin-with-chatgpt?return_to=%2F" target="_top">ChatGPT로 계속하기 <ArrowRight size={17} /></a><button className="text-button muted" onClick={onClose}>먼저 둘러볼게요</button></div>;
}
