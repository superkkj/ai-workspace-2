"use client";

import { useState, type FormEvent } from "react";
import { Info, LockKeyhole, Trash2 } from "lucide-react";
import type { Answer, Choice, Fit, Followup, Purpose, Question, Session, Shoe, Width } from "../../lib/contracts";
import { FIT_LABELS, PURPOSE_LABELS, WIDTH_LABELS } from "../../lib/contracts";
import { api, Field, FormError, Modal, SaveButton, todaySeoul, useFormAction } from "./ui";

type Close = { onClose: () => void };

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
function Footer({ busy, onClose, label }: Close & { busy: boolean; label?: string }) {
  return <footer className="form-footer"><button type="button" className="btn btn-ghost" disabled={busy} onClick={onClose}>취소</button><SaveButton busy={busy}>{label ?? "저장하기"}</SaveButton></footer>;
}

export function ShoeForm({ shoe, onClose, onSaved }: Close & { shoe?: Shoe; onSaved: (item: Shoe) => void | Promise<void> }) {
  const [brand, setBrand] = useState(shoe?.brand ?? "");
  const [model, setModel] = useState(shoe?.model ?? "");
  const [size, setSize] = useState(String(shoe?.size ?? ""));
  const [width, setWidth] = useState<Width>(shoe?.width ?? "regular");
  const [fit, setFit] = useState<Fit>(shoe?.fit ?? "good");
  const [purpose, setPurpose] = useState<Purpose>(shoe?.purpose ?? "daily");
  const [memo, setMemo] = useState(shoe?.memo ?? "");
  const { busy, error, execute } = useFormAction();
  function submit(event: FormEvent) {
    event.preventDefault();
    void execute(async requestId => {
      const payload = { requestId, brand: formText(brand, 1, 40, "브랜드"), model: formText(model, 1, 80, "모델명"), size: shoeSize(size), width, fit, purpose, memo: memo.trim() };
      const result = await api<{ item: Shoe }>(shoe ? `/api/shoes/${shoe.id}` : "/api/shoes", { method: shoe ? "PATCH" : "POST", body: JSON.stringify(payload) });
      await onSaved(result.item);
    });
  }
  return <Modal title={shoe ? "신발 기록 수정" : "내 신발장에 한 켤레 추가"} subtitle="지금 신는 신발이 다음 선택의 기준이 돼요." onClose={onClose} busy={busy}>
    <form onSubmit={submit}><fieldset disabled={busy}>
      <div className="notice notice-neutral"><LockKeyhole size={16} /><span>신발장과 메모는 나만 볼 수 있어요.</span></div>
      <div className="form-grid"><Field label="브랜드"><input autoComplete="off" required maxLength={40} value={brand} onChange={e => setBrand(e.target.value)} placeholder="예: 내가 신는 신발의 브랜드" /></Field><Field label="모델명"><input autoComplete="off" required maxLength={80} value={model} onChange={e => setModel(e.target.value)} placeholder="모델명과 버전을 적어 주세요" /></Field></div>
      <div className="form-grid"><Field label="사이즈 (mm)"><input type="number" required min={180} max={350} step={5} inputMode="numeric" value={size} onChange={e => setSize(e.target.value)} placeholder="예: 270" /></Field><Field label="내 발볼"><select value={width} onChange={e => setWidth(e.target.value as Width)}><Options labels={WIDTH_LABELS} /></select></Field></div>
      <div className="form-grid"><Field label="이 신발의 착용감"><select value={fit} onChange={e => setFit(e.target.value as Fit)}><Options labels={FIT_LABELS} /></select></Field><Field label="주로 달리는 방식"><select value={purpose} onChange={e => setPurpose(e.target.value as Purpose)}><Options labels={PURPOSE_LABELS} /></select></Field></div>
      <Field label="나만의 메모 · 선택" hint="앞쪽 공간, 뒤꿈치 느낌 등 기억하고 싶은 내용을 적어 보세요."><textarea rows={3} maxLength={500} value={memo} onChange={e => setMemo(e.target.value)} placeholder="이 신발은 어떤 상황에서 편했나요?" /></Field>
    </fieldset><FormError error={error} /><Footer busy={busy} onClose={onClose} label={shoe ? "기록 수정하기" : "신발 기록하기"} /></form>
  </Modal>;
}

export function QuestionForm({ question, shoes, onClose, onSaved }: Close & { question?: Question; shoes: Shoe[]; onSaved: (item: Question) => void | Promise<void> }) {
  const [title, setTitle] = useState(question?.title ?? "");
  const [body, setBody] = useState(question?.body ?? "");
  const [targetModel, setTargetModel] = useState(question?.targetModel ?? "");
  const [referenceShoeId, setReferenceShoeId] = useState("");
  const [purpose, setPurpose] = useState<Purpose>(question?.purpose ?? "daily");
  const [width, setWidth] = useState<Width>(question?.width ?? "regular");
  const { busy, error, execute } = useFormAction();
  function submit(event: FormEvent) {
    event.preventDefault();
    void execute(async requestId => {
      const payload = { requestId, title: formText(title, 5, 100, "제목"), body: formText(body, 10, 3000, "질문 내용"), purpose, width, targetModel: targetModel.trim(), ...(!question && referenceShoeId ? { referenceShoeId } : {}) };
      const result = await api<{ item: Question }>(question ? `/api/questions/${question.id}` : "/api/questions", { method: question ? "PATCH" : "POST", body: JSON.stringify(payload) });
      await onSaved(result.item);
    });
  }
  return <Modal title={question ? "질문 수정하기" : "다음 한 켤레, 물어보세요"} subtitle="나의 조건을 함께 적으면 더 가까운 경험을 만날 수 있어요." onClose={onClose} busy={busy} wide>
    <form onSubmit={submit}><fieldset disabled={busy}>
      <Field label="어떤 점이 궁금한가요?" hint="5~100자. 한 가지 고민이 드러나게 적어 주세요."><input required minLength={5} maxLength={100} value={title} onChange={e => setTitle(e.target.value)} placeholder="예: 발볼이 넓은 편인데, 어떤 착용감을 비교해 보면 좋을까요?" /></Field>
      {!question ? <Field label="기준이 되는 내 신발 · 선택" hint={referenceShoeId ? "브랜드·모델·사이즈·발볼·착용감만 이 질문에 공유돼요. 개인 메모는 공유되지 않아요." : "신발 기록이 없어도 질문할 수 있어요."}><select value={referenceShoeId} onChange={e => { setReferenceShoeId(e.target.value); const shoe = shoes.find(s => s.id === e.target.value); if (shoe) { setWidth(shoe.width); setPurpose(shoe.purpose); } }}><option value="">기준 신발 없이 질문하기</option>{shoes.map(shoe => <option key={shoe.id} value={shoe.id}>{shoe.brand} {shoe.model} · {shoe.size}mm</option>)}</select></Field> : question.reference ? <div className="notice notice-neutral"><Info size={16} /><span>처음 공유한 기준 신발은 그대로 남아요: {question.reference.brand} {question.reference.model} · {question.reference.size}mm</span></div> : null}
      <div className="form-grid"><Field label="달리는 용도"><select value={purpose} onChange={e => setPurpose(e.target.value as Purpose)}><Options labels={PURPOSE_LABELS} /></select></Field><Field label="내 발볼"><select value={width} onChange={e => setWidth(e.target.value as Width)}><Options labels={WIDTH_LABELS} /></select></Field></div>
      <Field label="고민하는 모델 · 선택"><input maxLength={80} value={targetModel} onChange={e => setTargetModel(e.target.value)} placeholder="아직 정하지 않았다면 비워 두세요" /></Field>
      <Field label="질문 내용" hint={`${body.length.toLocaleString()} / 3,000자`}><textarea required minLength={10} maxLength={3000} rows={5} value={body} onChange={e => setBody(e.target.value)} placeholder="지금 신발의 어떤 점이 잘 맞거나 불편한가요? 비슷한 경험을 나눌 수 있도록 달리는 상황을 적어 주세요." /></Field>
      <p className="field-hint">질문과 선택한 신발 정보는 다른 이용자가 볼 수 있어요. 연락처나 개인 정보는 적지 말아 주세요.</p>
    </fieldset><FormError error={error} /><Footer busy={busy} onClose={onClose} label={question ? "질문 수정하기" : "질문 올리기"} /></form>
  </Modal>;
}

export function AnswerForm({ question, shoes, onClose, onSaved }: Close & { question: Question; shoes: Shoe[]; onSaved: (item: Answer) => void | Promise<void> }) {
  const [body, setBody] = useState("");
  const [referenceShoeId, setReferenceShoeId] = useState("");
  const { busy, error, execute } = useFormAction();
  const submit = (event: FormEvent) => { event.preventDefault(); void execute(async requestId => {
    const result = await api<{ item: Answer }>(`/api/questions/${question.id}/answers`, { method: "POST", body: JSON.stringify({ requestId, body: formText(body, 10, 3000, "답변"), ...(referenceShoeId ? { referenceShoeId } : {}) }) });
    await onSaved(result.item);
  }); };
  return <Modal title="먼저 신어본 경험을 나눠요" subtitle={question.title} onClose={onClose} busy={busy}>
    <form onSubmit={submit}><fieldset disabled={busy}>
      <Field label="함께 보여 줄 내 신발 · 선택" hint="선택하면 모델·사이즈·발볼·착용감만 함께 공유돼요."><select value={referenceShoeId} onChange={e => setReferenceShoeId(e.target.value)}><option value="">신발 정보 없이 답변하기</option>{shoes.map(shoe => <option key={shoe.id} value={shoe.id}>{shoe.brand} {shoe.model} · {shoe.size}mm</option>)}</select></Field>
      <Field label="나의 경험" hint="직접 사용한 상황과 착용감을 적어 주세요. 모두에게 같은 결과를 보장하지는 않아요."><textarea required minLength={10} maxLength={3000} rows={6} value={body} onChange={e => setBody(e.target.value)} placeholder="어떤 신발을 어떤 상황에서 신어 봤나요? 질문자의 조건과 다른 점도 함께 알려 주세요." /></Field>
    </fieldset><FormError error={error} /><Footer busy={busy} onClose={onClose} label="경험 남기기" /></form>
  </Modal>;
}

export function ChoiceForm({ question, onClose, onSaved }: Close & { question: Question; onSaved: (item: Choice) => void | Promise<void> }) {
  const [brand, setBrand] = useState(question.choice?.brand ?? "");
  const [model, setModel] = useState(question.choice?.model ?? "");
  const [size, setSize] = useState(String(question.choice?.size ?? ""));
  const { busy, error, execute } = useFormAction();
  const submit = (event: FormEvent) => { event.preventDefault(); void execute(async () => {
    const result = await api<{ item: Choice }>(`/api/questions/${question.id}/choice`, { method: "PUT", body: JSON.stringify({ brand: formText(brand, 1, 40, "브랜드"), model: formText(model, 1, 80, "모델명"), size: shoeSize(size) }) });
    await onSaved(result.item);
  }); };
  return <Modal title={question.choice ? "선택한 신발 수정" : "어떤 한 켤레를 골랐나요?"} subtitle="질문 이후의 선택을 이어 남겨 주세요." onClose={onClose} busy={busy}>
    <form onSubmit={submit}><fieldset disabled={busy}><Field label="브랜드"><input required maxLength={40} value={brand} onChange={e => setBrand(e.target.value)} placeholder="선택한 신발의 브랜드" /></Field><Field label="모델명"><input required maxLength={80} value={model} onChange={e => setModel(e.target.value)} placeholder="모델명과 버전" /></Field><Field label="선택한 사이즈 (mm)"><input type="number" min={180} max={350} step={5} required value={size} onChange={e => setSize(e.target.value)} placeholder="예: 270" /></Field><p className="field-hint">답변이 없어도 나의 선택과 후기를 이어 기록할 수 있어요.</p></fieldset><FormError error={error} /><Footer busy={busy} onClose={onClose} label="선택 기록하기" /></form>
  </Modal>;
}

export function ReviewForm({ question, onClose, onSaved }: Close & { question: Question; onSaved: (item: Followup) => void | Promise<void> }) {
  const [body, setBody] = useState(question.review?.body ?? "");
  const [fit, setFit] = useState<Fit>(question.review?.fit ?? "good");
  const [firstUsedAt, setFirstUsedAt] = useState(question.review?.firstUsedAt ?? todaySeoul());
  const [distanceKm, setDistanceKm] = useState(question.review?.distanceKm == null ? "" : String(question.review.distanceKm));
  const { busy, error, execute } = useFormAction();
  const submit = (event: FormEvent) => { event.preventDefault(); void execute(async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(firstUsedAt) || firstUsedAt > todaySeoul()) throw new Error("실제로 사용을 시작한 날짜를 오늘 또는 이전 날짜로 입력해 주세요.");
    const distance = distanceKm.trim() === "" ? null : Number(distanceKm);
    if (distance !== null && (!Number.isFinite(distance) || distance < 0 || distance > 10000)) throw new Error("달린 거리는 0~10,000km 사이로 입력하거나 비워 주세요.");
    const result = await api<{ item: Followup }>(`/api/questions/${question.id}/review`, { method: "PUT", body: JSON.stringify({ body: formText(body, 10, 3000, "후기"), fit, firstUsedAt, distanceKm: distance }) });
    await onSaved(result.item);
  }); };
  return <Modal title={question.review ? "착용 후기 수정" : "신어 본 뒤, 이야기를 이어 주세요"} subtitle={question.choice ? `${question.choice.brand} ${question.choice.model} · ${question.choice.size}mm` : undefined} onClose={onClose} busy={busy}>
    <form onSubmit={submit}><fieldset disabled={busy}><div className="form-grid"><Field label="처음 사용한 날짜"><input type="date" required max={todaySeoul()} value={firstUsedAt} onChange={e => setFirstUsedAt(e.target.value)} /></Field><Field label="누적 거리 (km) · 선택"><input type="number" min={0} max={10000} step="any" value={distanceKm} onChange={e => setDistanceKm(e.target.value)} placeholder="기록한 경우만 입력" /></Field></div><Field label="실제로 신어 본 착용감"><select value={fit} onChange={e => setFit(e.target.value as Fit)}><Options labels={FIT_LABELS} /></select></Field><Field label="사용 후기" hint="처음 기대했던 점과 직접 느낀 점을 함께 남기면 도움이 돼요."><textarea required minLength={10} maxLength={3000} rows={6} value={body} onChange={e => setBody(e.target.value)} placeholder="처음 고민했던 부분은 어땠나요? 달린 상황과 착용감을 적어 주세요." /></Field><div className="notice notice-neutral"><Info size={16} /><span>사용 기간은 후기를 작성한 날을 기준으로 남아요. 시간이 지나도 자동으로 더 오래 사용한 후기가 되지는 않아요.</span></div></fieldset><FormError error={error} /><Footer busy={busy} onClose={onClose} label="착용 후기 남기기" /></form>
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
