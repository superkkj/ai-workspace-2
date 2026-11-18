"use client";

import { useState, type FormEvent } from "react";
import { Info, LockKeyhole, RefreshCw, Trash2 } from "lucide-react";
import type { Answer, Choice, Fit, Followup, Purpose, Question, Session, Shoe, Width } from "../../lib/contracts";
import { FIT_LABELS, PURPOSE_LABELS, WIDTH_LABELS } from "../../lib/contracts";
import { useDraftForm } from "../../lib/client/use-draft-form";
import type { FormValues, PendingSubmission } from "../../lib/client/drafts";
import { api, Field, FormError, Modal, SaveButton, todaySeoul, useFormAction } from "./ui";

type Close = { onClose: () => void };
type DraftOwner = { userId?: string };
type ShoeList = { shoes: Shoe[]; shoesLoading?: boolean; shoesError?: string; onRetryShoes?: () => void };

function formText(value: string, min: number, max: number, label: string) {
  const text = value.trim();
  if (text.length < min || text.length > max) throw new Error(`${label}은(는) 공백을 제외한 내용으로 ${min}~${max}자 입력해 주세요.`);
  return text;
}
function shoeSize(value: string) {
  const size = Number(value);
  if (!Number.isFinite(size) || size < 180 || size > 350 || size % 5 !== 0) throw new Error("사이즈는 180~350mm 사이에서 5mm 단위로 입력해 주세요.");
  return size;
}
function Options({ labels }: { labels: Record<string, string> }) { return <>{Object.entries(labels).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</>; }
function Footer({ busy, onClose, label, pending = false, confirmed = false, draft = false }: Close & { busy: boolean; label?: string; pending?: boolean; confirmed?: boolean; draft?: boolean }) {
  return <footer className="form-footer"><button type="button" className="btn btn-ghost" disabled={busy} onClick={onClose}>{draft ? "닫기" : "취소"}</button><SaveButton busy={busy} disabled={confirmed}>{confirmed ? "저장 완료" : pending ? "저장 확인 다시 시도" : label ?? "저장하기"}</SaveButton></footer>;
}
function sentText(values: FormValues): string {
  const labels: Record<string, string> = { brand: "브랜드", model: "모델명", size: "사이즈(mm)", width: "발볼", fit: "착용감", purpose: "러닝 용도", memo: "나만의 메모", title: "질문 제목", body: "작성 내용", targetModel: "고민하는 모델", firstUsedAt: "처음 사용한 날짜", distanceKm: "누적 거리(km)" };
  return Object.entries(values).filter(([key, value]) => labels[key] && value).map(([key, value]) => {
    const displayed = key === "width" ? WIDTH_LABELS[value as Width] ?? value : key === "fit" ? FIT_LABELS[value as Fit] ?? value : key === "purpose" ? PURPOSE_LABELS[value as Purpose] ?? value : value;
    return `${labels[key]}: ${displayed}`;
  }).join("\n");
}
function DraftNotice({ form, onClose }: Close & { form: { ready: boolean; busy: boolean; pending: PendingSubmission<FormValues> | null; confirmed: boolean; storageOkay: boolean; restored: boolean; dirty: boolean; discard: () => void; resolveConflict: (onClose: () => void) => void } }) {
  if (!form.ready || form.confirmed) return null;
  if (form.pending) return <><div className="notice notice-neutral" role="status"><Info size={17} /><div><span>{form.busy ? "저장 결과를 확인하고 있어요." : form.pending.recovery ? "보낸 내용과 현재 기록이 달라요. 창을 닫고 내 신발장이나 내 기록에서 최신 내용을 확인해 주세요." : "저장 결과를 아직 확인하지 못했어요. 처음 보낸 내용과 현재 기록을 다시 확인해요."}<br />{form.storageOkay ? "이 창을 닫아도 같은 탭에서 다시 열면 확인을 이어갈 수 있어요." : "임시 보관을 사용할 수 없어 이 창에서 저장 결과를 확인해 주세요."}</span>{form.pending.recovery && !form.busy && <p><button type="button" className="text-button" onClick={() => form.resolveConflict(onClose)}>이전 기록 확인 후 초안 정리</button></p>}</div></div><details><summary className="text-button">보낸 내용 보기 · 복사 가능</summary><Field label="확인 중인 원래 내용"><textarea readOnly rows={5} value={sentText(form.pending.values)} /></Field></details></>;
  return <div className="notice notice-neutral" role="status"><Info size={17} /><div><span>{!form.storageOkay ? "이 브라우저에서는 초안을 임시 보관할 수 없어요. 입력을 마칠 때까지 창을 유지해 주세요." : form.restored ? "이 탭에 보관한 초안을 불러왔어요." : "작성 중인 내용은 이 탭에 임시 보관돼요. 닫기나 새로고침 뒤에도 이어 쓸 수 있어요."}</span>{form.storageOkay && <p className="field-hint">탭을 완전히 닫으면 초안이 사라질 수 있어요. 서버에 저장하려면 아래 저장 버튼을 눌러 주세요.</p>}{(form.dirty || form.restored) && <button type="button" className="text-button" onClick={form.discard}>초안 버리기</button>}</div></div>;
}
function ReferenceField({ shoes, shoesLoading = false, shoesError = "", onRetryShoes, value, onChange, answer = false }: ShoeList & { value: string; onChange: (id: string) => void; answer?: boolean }) {
  const missing = Boolean(value) && !shoesLoading && !shoesError && !shoes.some(shoe => shoe.id === value);
  return <><Field label={answer ? "함께 보여 줄 내 신발 · 선택" : "기준이 되는 내 신발 · 선택"} hint={shoesLoading ? "내 신발을 불러오고 있어요." : shoesError ? "목록을 다시 불러오거나 기준 신발 없이 계속할 수 있어요." : missing ? "초안의 기준 신발을 찾을 수 없어요. 다른 신발을 고르거나 기준 신발 없이 작성해 주세요." : value ? "브랜드·모델·사이즈·발볼·착용감만 공유돼요. 개인 메모는 공유되지 않아요." : shoes.length ? "원하는 신발을 고르거나 기준 신발 없이 작성할 수 있어요." : "아직 신발 기록이 없어요. 기준 신발 없이도 작성할 수 있어요."}>
    <select value={value} onChange={event => onChange(event.target.value)} disabled={shoesLoading}>
      <option value="">{answer ? "신발 정보 없이 답변하기" : "기준 신발 없이 질문하기"}</option>
      {value && !shoes.some(shoe => shoe.id === value) && <option value={value} disabled>{shoesLoading ? "선택한 신발 확인 중…" : "이전 기준 신발 · 다시 선택해 주세요"}</option>}
      {shoes.map(shoe => <option key={shoe.id} value={shoe.id}>{shoe.brand} {shoe.model} · {shoe.size}mm</option>)}
    </select>
  </Field>{shoesError && <div className="notice notice-error" role="alert"><span>내 신발 목록을 불러오지 못했어요. {onRetryShoes && <button type="button" className="text-button" onClick={onRetryShoes}><RefreshCw size={14} />다시 불러오기</button>}</span></div>}</>;
}
function validateReference(value: string, { shoes, shoesLoading, shoesError }: ShoeList) {
  if (!value) return;
  if (shoesLoading) throw new Error("기준 신발을 불러온 뒤 다시 저장해 주세요.");
  if (shoesError || !shoes.some(shoe => shoe.id === value)) throw new Error("기준 신발을 다시 선택하거나 기준 신발 없이 작성해 주세요.");
}

export function ShoeForm({ shoe, userId, onClose, onSaved }: Close & DraftOwner & { shoe?: Shoe; onSaved: (item: Shoe) => void | Promise<void> }) {
  const form = useDraftForm({ userId, kind: "shoe", targetId: shoe?.id ?? "new", path: shoe ? `/api/shoes/${shoe.id}` : "/api/shoes", method: shoe ? "PATCH" : "POST", initialValues: {
    brand: shoe?.brand ?? "", model: shoe?.model ?? "", size: String(shoe?.size ?? ""), width: shoe?.width ?? "regular" as Width, fit: shoe?.fit ?? "good" as Fit, purpose: shoe?.purpose ?? "daily" as Purpose, memo: shoe?.memo ?? "",
  } });
  const v = form.values;
  const close = () => form.close(onClose);
  function submit(event: FormEvent) {
    event.preventDefault();
    void form.submit<Shoe>(requestId => ({ requestId, brand: formText(v.brand, 1, 40, "브랜드"), model: formText(v.model, 1, 80, "모델명"), size: shoeSize(v.size), width: v.width, fit: v.fit, purpose: v.purpose, memo: v.memo.trim() }), onSaved);
  }
  return <Modal title={shoe ? "신발 기록 수정" : "내 신발장에 한 켤레 추가"} subtitle="지금 신는 신발이 다음 선택의 기준이 돼요." onClose={close} busy={form.busy}>
    <form onSubmit={submit}><DraftNotice form={form} onClose={onClose} /><fieldset disabled={!form.ready || form.busy || Boolean(form.pending) || form.confirmed}>
      <div className="notice notice-neutral"><LockKeyhole size={16} /><span>신발장과 메모는 나만 볼 수 있어요.</span></div>
      <div className="form-grid"><Field label="브랜드"><input autoComplete="off" required maxLength={40} value={v.brand} onChange={e => form.change("brand", e.target.value)} placeholder="예: 내가 신는 신발의 브랜드" /></Field><Field label="모델명"><input autoComplete="off" required maxLength={80} value={v.model} onChange={e => form.change("model", e.target.value)} placeholder="모델명과 버전을 적어 주세요" /></Field></div>
      <div className="form-grid"><Field label="사이즈 (mm)"><input type="number" required min={180} max={350} step={5} inputMode="numeric" value={v.size} onChange={e => form.change("size", e.target.value)} placeholder="예: 270" /></Field><Field label="내 발볼"><select value={v.width} onChange={e => form.change("width", e.target.value as Width)}><Options labels={WIDTH_LABELS} /></select></Field></div>
      <div className="form-grid"><Field label="이 신발의 착용감"><select value={v.fit} onChange={e => form.change("fit", e.target.value as Fit)}><Options labels={FIT_LABELS} /></select></Field><Field label="주로 달리는 방식"><select value={v.purpose} onChange={e => form.change("purpose", e.target.value as Purpose)}><Options labels={PURPOSE_LABELS} /></select></Field></div>
      <Field label="나만의 메모 · 선택" hint="앞쪽 공간, 뒤꿈치 느낌 등 기억하고 싶은 내용을 적어 보세요."><textarea rows={3} maxLength={500} value={v.memo} onChange={e => form.change("memo", e.target.value)} placeholder="이 신발은 어떤 상황에서 편했나요?" /></Field>
    </fieldset><FormError error={form.error} /><Footer busy={form.busy} pending={Boolean(form.pending)} confirmed={form.confirmed} onClose={close} draft label={shoe ? "기록 수정하기" : "신발 기록하기"} /></form>
  </Modal>;
}

export function QuestionForm({ question, userId, initialReferenceShoeId, shoes, shoesLoading, shoesError, onRetryShoes, onClose, onSaved }: Close & DraftOwner & ShoeList & { question?: Question; initialReferenceShoeId?: string; onSaved: (item: Question) => void | Promise<void> }) {
  const initialShoe = shoes.find(shoe => shoe.id === initialReferenceShoeId);
  const form = useDraftForm({ userId, kind: "question", targetId: question?.id ?? "new", path: question ? `/api/questions/${question.id}` : "/api/questions", method: question ? "PATCH" : "POST", initialValues: {
    title: question?.title ?? "", body: question?.body ?? "", targetModel: question?.targetModel ?? "", referenceShoeId: question ? "" : initialReferenceShoeId ?? "", purpose: question?.purpose ?? initialShoe?.purpose ?? "daily" as Purpose, width: question?.width ?? initialShoe?.width ?? "regular" as Width,
  } });
  const v = form.values;
  const close = () => form.close(onClose);
  const shoeList = { shoes, shoesLoading, shoesError, onRetryShoes };
  function submit(event: FormEvent) {
    event.preventDefault();
    void form.submit<Question>(requestId => {
      if (!question) validateReference(v.referenceShoeId, shoeList);
      return { requestId, title: formText(v.title, 5, 100, "제목"), body: formText(v.body, 10, 3000, "질문 내용"), purpose: v.purpose, width: v.width, targetModel: v.targetModel.trim(), ...(!question && v.referenceShoeId ? { referenceShoeId: v.referenceShoeId } : {}) };
    }, onSaved);
  }
  return <Modal title={question ? "질문 수정하기" : "다음 한 켤레, 물어보세요"} subtitle="나의 조건을 함께 적으면 더 가까운 경험을 만날 수 있어요." onClose={close} busy={form.busy} wide>
    <form onSubmit={submit}><DraftNotice form={form} onClose={onClose} /><fieldset disabled={!form.ready || form.busy || Boolean(form.pending) || form.confirmed}>
      <Field label="어떤 점이 궁금한가요?" hint="5~100자. 한 가지 고민이 드러나게 적어 주세요."><input required minLength={5} maxLength={100} value={v.title} onChange={e => form.change("title", e.target.value)} placeholder="예: 발볼이 넓은 편인데, 어떤 착용감을 비교해 보면 좋을까요?" /></Field>
      {!question ? <ReferenceField {...shoeList} value={v.referenceShoeId} onChange={id => { const shoe = shoes.find(item => item.id === id); form.changeMany({ referenceShoeId: id, ...(shoe ? { width: shoe.width, purpose: shoe.purpose } : {}) }); }} /> : question.reference ? <div className="notice notice-neutral"><Info size={16} /><span>처음 공유한 기준 신발은 그대로 남아요: {question.reference.brand} {question.reference.model} · {question.reference.size}mm</span></div> : null}
      <div className="form-grid"><Field label="달리는 용도"><select value={v.purpose} onChange={e => form.change("purpose", e.target.value as Purpose)}><Options labels={PURPOSE_LABELS} /></select></Field><Field label="내 발볼"><select value={v.width} onChange={e => form.change("width", e.target.value as Width)}><Options labels={WIDTH_LABELS} /></select></Field></div>
      <Field label="고민하는 모델 · 선택"><input maxLength={80} value={v.targetModel} onChange={e => form.change("targetModel", e.target.value)} placeholder="아직 정하지 않았다면 비워 두세요" /></Field>
      <Field label="질문 내용" hint={`${v.body.length.toLocaleString()} / 3,000자`}><textarea required minLength={10} maxLength={3000} rows={5} value={v.body} onChange={e => form.change("body", e.target.value)} placeholder="지금 신발의 어떤 점이 잘 맞거나 불편한가요? 비슷한 경험을 나눌 수 있도록 달리는 상황을 적어 주세요." /></Field>
      <p className="field-hint">질문과 선택한 신발 정보는 다른 이용자가 볼 수 있어요. 연락처나 개인 정보는 적지 말아 주세요.</p>
    </fieldset><FormError error={form.error} /><Footer busy={form.busy} pending={Boolean(form.pending)} confirmed={form.confirmed} onClose={close} draft label={question ? "질문 수정하기" : "질문 올리기"} /></form>
  </Modal>;
}

export function AnswerForm({ question, userId, shoes, shoesLoading, shoesError, onRetryShoes, onClose, onSaved }: Close & DraftOwner & ShoeList & { question: Question; onSaved: (item: Answer) => void | Promise<void> }) {
  const form = useDraftForm({ userId, kind: "answer", targetId: question.id, path: `/api/questions/${question.id}/answers`, method: "POST", initialValues: { body: "", referenceShoeId: "" } });
  const v = form.values;
  const close = () => form.close(onClose);
  const shoeList = { shoes, shoesLoading, shoesError, onRetryShoes };
  const submit = (event: FormEvent) => { event.preventDefault(); void form.submit<Answer>(requestId => { validateReference(v.referenceShoeId, shoeList); return { requestId, body: formText(v.body, 10, 3000, "답변"), ...(v.referenceShoeId ? { referenceShoeId: v.referenceShoeId } : {}) }; }, onSaved); };
  return <Modal title="먼저 신어본 경험을 나눠요" subtitle={question.title} onClose={close} busy={form.busy}>
    <form onSubmit={submit}><DraftNotice form={form} onClose={onClose} /><fieldset disabled={!form.ready || form.busy || Boolean(form.pending) || form.confirmed}>
      <ReferenceField {...shoeList} value={v.referenceShoeId} onChange={id => form.change("referenceShoeId", id)} answer />
      <Field label="나의 경험" hint="직접 사용한 상황과 착용감을 적어 주세요. 모두에게 같은 결과를 보장하지는 않아요."><textarea required minLength={10} maxLength={3000} rows={6} value={v.body} onChange={e => form.change("body", e.target.value)} placeholder="어떤 신발을 어떤 상황에서 신어 봤나요? 질문자의 조건과 다른 점도 함께 알려 주세요." /></Field>
    </fieldset><FormError error={form.error} /><Footer busy={form.busy} pending={Boolean(form.pending)} confirmed={form.confirmed} onClose={close} draft label="경험 남기기" /></form>
  </Modal>;
}

export function ChoiceForm({ question, userId, onClose, onSaved }: Close & DraftOwner & { question: Question; onSaved: (item: Choice) => void | Promise<void> }) {
  const form = useDraftForm({ userId, kind: "choice", targetId: question.id, path: `/api/questions/${question.id}/choice`, method: "PUT", initialValues: { brand: question.choice?.brand ?? "", model: question.choice?.model ?? "", size: String(question.choice?.size ?? "") } });
  const v = form.values;
  const close = () => form.close(onClose);
  const submit = (event: FormEvent) => { event.preventDefault(); void form.submit<Choice>(() => ({ brand: formText(v.brand, 1, 40, "브랜드"), model: formText(v.model, 1, 80, "모델명"), size: shoeSize(v.size) }), onSaved); };
  return <Modal title={question.choice ? "선택한 신발 수정" : "어떤 한 켤레를 골랐나요?"} subtitle="질문 이후의 선택을 이어 남겨 주세요." onClose={close} busy={form.busy}>
    <form onSubmit={submit}><DraftNotice form={form} onClose={onClose} /><fieldset disabled={!form.ready || form.busy || Boolean(form.pending) || form.confirmed}><Field label="브랜드"><input required maxLength={40} value={v.brand} onChange={e => form.change("brand", e.target.value)} placeholder="선택한 신발의 브랜드" /></Field><Field label="모델명"><input required maxLength={80} value={v.model} onChange={e => form.change("model", e.target.value)} placeholder="모델명과 버전" /></Field><Field label="선택한 사이즈 (mm)"><input type="number" min={180} max={350} step={5} inputMode="numeric" required value={v.size} onChange={e => form.change("size", e.target.value)} placeholder="예: 270" /></Field><p className="field-hint">답변이 없어도 나의 선택과 후기를 이어 기록할 수 있어요.</p></fieldset><FormError error={form.error} /><Footer busy={form.busy} pending={Boolean(form.pending)} confirmed={form.confirmed} onClose={close} draft label="선택 기록하기" /></form>
  </Modal>;
}

export function ReviewForm({ question, userId, onClose, onSaved }: Close & DraftOwner & { question: Question; onSaved: (item: Followup) => void | Promise<void> }) {
  const form = useDraftForm({ userId, kind: "review", targetId: question.id, path: `/api/questions/${question.id}/review`, method: "PUT", initialValues: { body: question.review?.body ?? "", fit: question.review?.fit ?? "good" as Fit, firstUsedAt: question.review?.firstUsedAt ?? todaySeoul(), distanceKm: question.review?.distanceKm == null ? "" : String(question.review.distanceKm) } });
  const v = form.values;
  const close = () => form.close(onClose);
  const submit = (event: FormEvent) => { event.preventDefault(); void form.submit<Followup>(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v.firstUsedAt) || v.firstUsedAt > todaySeoul()) throw new Error("실제로 사용을 시작한 날짜를 오늘 또는 이전 날짜로 입력해 주세요.");
    const distance = v.distanceKm.trim() === "" ? null : Number(v.distanceKm);
    if (distance !== null && (!Number.isFinite(distance) || distance < 0 || distance > 10000)) throw new Error("달린 거리는 0~10,000km 사이로 입력하거나 비워 주세요.");
    return { body: formText(v.body, 10, 3000, "후기"), fit: v.fit, firstUsedAt: v.firstUsedAt, distanceKm: distance };
  }, onSaved); };
  return <Modal title={question.review ? "착용 후기 수정" : "신어 본 뒤, 이야기를 이어 주세요"} subtitle={question.choice ? `${question.choice.brand} ${question.choice.model} · ${question.choice.size}mm` : undefined} onClose={close} busy={form.busy}>
    <form onSubmit={submit}><DraftNotice form={form} onClose={onClose} /><fieldset disabled={!form.ready || form.busy || Boolean(form.pending) || form.confirmed}><div className="form-grid"><Field label="처음 사용한 날짜"><input type="date" required max={todaySeoul()} value={v.firstUsedAt} onChange={e => form.change("firstUsedAt", e.target.value)} /></Field><Field label="누적 거리 (km) · 선택"><input type="number" min={0} max={10000} step="any" inputMode="decimal" value={v.distanceKm} onChange={e => form.change("distanceKm", e.target.value)} placeholder="기록한 경우만 입력" /></Field></div><Field label="실제로 신어 본 착용감"><select value={v.fit} onChange={e => form.change("fit", e.target.value as Fit)}><Options labels={FIT_LABELS} /></select></Field><Field label="사용 후기" hint="처음 기대했던 점과 직접 느낀 점을 함께 남기면 도움이 돼요."><textarea required minLength={10} maxLength={3000} rows={6} value={v.body} onChange={e => form.change("body", e.target.value)} placeholder="처음 고민했던 부분은 어땠나요? 달린 상황과 착용감을 적어 주세요." /></Field><div className="notice notice-neutral"><Info size={16} /><span>사용 기간은 후기를 작성한 날을 기준으로 남아요. 시간이 지나도 자동으로 더 오래 사용한 후기가 되지는 않아요.</span></div></fieldset><FormError error={form.error} /><Footer busy={form.busy} pending={Boolean(form.pending)} confirmed={form.confirmed} onClose={close} draft label="착용 후기 남기기" /></form>
  </Modal>;
}

export function NicknameForm({ nickname, onClose, onSaved }: Close & { nickname: string; onSaved: (session: Session) => void | Promise<void> }) {
  const [value, setValue] = useState(nickname);
  const { busy, error, execute } = useFormAction();
  return <Modal title="어떤 이름으로 달릴까요?" subtitle="앞으로 쓰는 글에 표시될 닉네임이에요." onClose={onClose} busy={busy}>
    <form onSubmit={event => { event.preventDefault(); void execute(async () => { const result = await api<Session>("/api/session", { method: "PATCH", body: JSON.stringify({ nickname: formText(value, 2, 20, "닉네임") }) }); await onSaved(result); }); }}><fieldset disabled={busy}><Field label="닉네임" hint="2~20자. 실명이나 이메일을 쓰지 않아도 괜찮아요."><input required minLength={2} maxLength={20} value={value} onChange={e => setValue(e.target.value)} autoComplete="nickname" /></Field><p className="field-hint">이미 작성한 글의 이름은 작성 당시 모습으로 남아요.</p></fieldset><FormError error={error} /><Footer busy={busy} onClose={onClose} /></form>
  </Modal>;
}

export function ReportForm({ targetId, targetType, onClose, onSaved }: Close & { targetId: string; targetType: "question" | "answer"; onSaved: () => void | Promise<void> }) {
  const [reason, setReason] = useState("");
  const { busy, error, execute } = useFormAction();
  return <Modal title="살펴볼 내용 알려 주세요" subtitle="신고는 저장되며 확인 전까지 글이 자동으로 숨겨지지는 않아요." onClose={onClose} busy={busy}>
    <form onSubmit={event => { event.preventDefault(); void execute(async requestId => { await api("/api/reports", { method: "POST", body: JSON.stringify({ requestId, targetId, targetType, reason: formText(reason, 5, 500, "신고 사유") }) }); await onSaved(); }); }}><fieldset disabled={busy}><Field label="신고 사유"><textarea required minLength={5} maxLength={500} rows={5} value={reason} onChange={e => setReason(e.target.value)} placeholder="광고, 부적절한 내용, 개인정보 노출 등 확인할 부분을 적어 주세요." /></Field></fieldset><FormError error={error} /><Footer busy={busy} onClose={onClose} label="신고 제출하기" /></form>
  </Modal>;
}

export function ConfirmModal({ title, description, onConfirm, onClose }: Close & { title: string; description: string; onConfirm: () => Promise<void> }) {
  const { busy, error, execute } = useFormAction();
  return <Modal title={title} onClose={onClose} busy={busy}><p className="confirm-description">{description}</p><FormError error={error} /><footer className="form-footer"><button className="btn btn-ghost" disabled={busy} onClick={onClose}>취소</button><button className="btn btn-danger" disabled={busy} onClick={() => void execute(async () => { await onConfirm(); onClose(); })}><Trash2 size={17} />{busy ? "삭제하는 중…" : "삭제하기"}</button></footer></Modal>;
}
