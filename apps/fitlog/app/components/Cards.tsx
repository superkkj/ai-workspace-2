"use client";
import type { ReactNode } from "react";
import { ArrowUpRight, Footprints, MessageCircle, Search, CheckCheck } from "lucide-react";
import type { Question, QuestionStatus, ShoeReference } from "../../lib/contracts";
import { FIT_LABELS, PURPOSE_LABELS, STATUS_LABELS, WIDTH_LABELS } from "../../lib/contracts";
import { humanDate } from "./ui";

export function Logo({ small = false }: { small?: boolean }) {
  return <span className={`brand ${small ? "brand-small" : ""}`}><span className="brand-mark" aria-hidden="true"><i /><i /><i /></span><span>fitlog<span className="brand-dot">.</span></span></span>;
}
export function StatusPill({ status }: { status: QuestionStatus }) {
  return <span className={`status-pill status-${status}`}><i aria-hidden="true" />{STATUS_LABELS[status]}</span>;
}
export function ReferenceCard({ reference, compact = false }: { reference: ShoeReference; compact?: boolean }) {
  return <div className={`reference-card ${compact ? "reference-compact" : ""}`}><span className="reference-icon"><Footprints size={compact ? 17 : 21} /></span><div><span className="reference-label">기준이 된 신발</span><strong>{reference.brand} {reference.model}<em>{reference.size}mm</em></strong><span className="reference-meta">발볼 {WIDTH_LABELS[reference.width]}<i />{FIT_LABELS[reference.fit]}</span></div></div>;
}
export function QuestionCard({ question, example = false, onClick }: { question: Question; example?: boolean; onClick: () => void }) {
  return <button className={`question-card ${question.status === "reviewed" ? "question-reviewed" : ""}`} onClick={onClick}>
    <div className="question-card-top"><StatusPill status={question.status} /><div className="question-card-labels">{example && <span className="sample-label">가상 예시</span>}<span>{PURPOSE_LABELS[question.purpose]}</span><span>발볼 {WIDTH_LABELS[question.width]}</span></div></div>
    <h3>{question.title}<ArrowUpRight size={21} className="card-arrow" /></h3>
    <p className="question-excerpt">{question.body.split("\n")[0]}</p>
    {question.reference && <div className="card-reference"><Footprints size={15} /><span>{question.reference.brand} {question.reference.model}</span><b>{question.reference.size}mm</b></div>}
    {question.choice && <div className="card-choice-line"><span>선택한 신발</span><strong>{question.choice.brand} {question.choice.model}</strong><span>{question.choice.size}mm</span></div>}
    {question.review && <div className="card-review-line"><CheckCheck size={15} /><span>선택 이후의 착용 후기가 연결됐어요.</span></div>}
    <div className="question-card-bottom"><span className="author-inline"><span className={`avatar avatar-${question.status}`}>{question.nickname.slice(0, 1) || "R"}</span>{question.nickname}<span className="subtle-dot">·</span><span className="muted">{example ? "흐름 보기" : humanDate(question.createdAt)}</span></span><span className="reply-count"><MessageCircle size={16} />{question.replyCount}<span className="sr-only">개의 답변</span></span></div>
  </button>;
}
export function EmptyState({ icon = "question", title, description, children }: { icon?: "question" | "shoe" | "search"; title: string; description: string; children?: ReactNode }) {
  return <div className="empty-state"><span className="empty-symbol">{icon === "shoe" ? <Footprints size={29} /> : icon === "search" ? <Search size={28} /> : <MessageCircle size={28} />}</span><h3>{title}</h3><p>{description}</p>{children && <div className="empty-actions">{children}</div>}</div>;
}
export function LoadingRows() { return <div className="loading-rows" role="status" aria-label="불러오는 중">{[0, 1].map(i => <div key={i} className="loading-row"><span /><b /><p /><em /></div>)}</div>; }
