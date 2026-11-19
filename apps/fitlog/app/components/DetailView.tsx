"use client";
import { ArrowRight, Check, CheckCheck, Flag, Info, MessageCircle, Pencil, Plus, Trash2 } from "lucide-react";
import type { Answer, Question, QuestionDetail } from "../../lib/contracts";
import { FIT_LABELS, PURPOSE_LABELS, WIDTH_LABELS } from "../../lib/contracts";
import { ReferenceCard, StatusPill } from "./Cards";
import ShoeArt from "./ShoeArt";
import { humanDate } from "./ui";

interface Props {
  detail: QuestionDetail;
  example: boolean;
  onAction: (action: "answer" | "choice" | "review" | "edit", question: Question) => void;
  onNew: () => void;
  onDeleteQuestion: (question: Question) => void;
  onDeleteAnswer: (question: Question, answer: Answer) => void;
  onDeleteReview: (question: Question) => void;
  onReport: (targetId: string, targetType: "question" | "answer") => void;
}

export default function DetailView({ detail, example, onAction, onNew, onDeleteQuestion, onDeleteAnswer, onDeleteReview, onReport }: Props) {
  const { item: question, answers } = detail;
  return <div className="detail-grid"><article className="detail-main">
    {example && <div className="notice example-notice"><Info size={17} /><span><b>가상 예시</b> · 사용 흐름을 설명하는 글이에요. 실제 후기나 제품 추천이 아니에요.</span></div>}
    <div className="detail-heading"><div className="detail-tags"><StatusPill status={question.status} /><span className="tag">{PURPOSE_LABELS[question.purpose]}</span><span className="tag">발볼 {WIDTH_LABELS[question.width]}</span></div><h1>{question.title}</h1><div className="detail-author"><span className={`avatar avatar-${question.status}`}>{question.nickname.slice(0, 1)}</span><b>{question.nickname}</b><span>{example ? "가상 기록" : humanDate(question.createdAt)}</span>{!example && !question.isMine && <button className="icon-button report-icon" aria-label="질문 신고하기" onClick={() => onReport(question.id, "question")}><Flag size={16} /></button>}</div></div>
    {!example && question.isMine && <section className="mobile-next-step" aria-label="내 기록의 다음 단계"><div><span className="eyebrow">NEXT STEP</span><h2>{question.review ? "달려 본 경험을 더해 주세요." : question.choice ? "신어 본 뒤의 이야기를 남겨요." : "내가 고른 한 켤레도 남겨요."}</h2><p>{question.choice ? "내 기록에서 언제든 이어 쓸 수 있어요." : "답변이 없어도 선택과 후기를 이어갈 수 있어요."}</p></div><button className="btn btn-primary btn-small" onClick={() => onAction(question.choice ? "review" : "choice", question)}>{question.review ? "후기 수정하기" : question.choice ? "후기 이어 쓰기" : "선택 이어 기록하기"}<ArrowRight size={16} /></button></section>}
    <div className="detail-body">{question.body}</div>
    {question.reference && <ReferenceCard reference={question.reference} />}
    {question.targetModel && <p className="considering"><span>고민한 모델</span>{question.targetModel}</p>}
    <section className="answers-section"><header className="section-heading"><div><span className="eyebrow">RUNNER TO RUNNER</span><h2>먼저 신어본 이야기 <span>{answers.length}</span></h2></div>{!example && <button className="btn btn-secondary btn-small" onClick={() => onAction("answer", question)}><Plus size={16} />경험 남기기</button>}</header>
      {answers.length ? <div className="answer-list">{answers.map(answer => <div className="answer" key={answer.id}><div className="answer-heading"><span className="author-inline"><span className="avatar avatar-answer">{answer.nickname.slice(0, 1)}</span><b>{answer.nickname}</b><span className="muted">{example ? "가상 답변" : humanDate(answer.createdAt)}</span></span>{!example && (answer.isMine ? <button className="icon-button" aria-label="내 답변 삭제" onClick={() => onDeleteAnswer(question, answer)}><Trash2 size={15} /></button> : <button className="icon-button" aria-label="답변 신고하기" onClick={() => onReport(answer.id, "answer")}><Flag size={15} /></button>)}</div><p>{answer.body}</p>{answer.reference && <ReferenceCard compact reference={answer.reference} />}</div>)}</div> : <div className="answer-empty"><MessageCircle size={22} /><p>아직 도착한 경험이 없어요.<br /><span>비슷한 신발을 신어 봤다면 첫 이야기를 남겨 주세요.</span></p></div>}
    </section>
    {question.choice && <section className="choice-section"><div className="section-kicker"><span>02</span> THE CHOICE</div><div className="choice-inner"><div><p>질문 이후, 이 한 켤레를 골랐어요.</p><h2>{question.choice.brand}<br /><strong>{question.choice.model}</strong></h2><span className="choice-size">{question.choice.size}<small>mm</small></span></div><ShoeArt simple tone="sage" className="choice-shoe" /></div>{question.isMine && !example && !question.review && <button className="text-button" onClick={() => onAction("choice", question)}><Pencil size={14} />선택 수정</button>}</section>}
    {question.review && <section className="review-section"><div className="section-kicker"><span>03</span> AFTER THE RUN</div><header className="review-header"><h2>직접 달려 본 뒤의 기록</h2><span className="review-period">{question.review.daysUsed === 0 ? "첫날 기록" : `작성 당시 ${question.review.daysUsed}일 사용`}{example ? " · 예시" : ""}</span></header><div className="review-facts"><span><CheckCheck size={16} />{FIT_LABELS[question.review.fit]}</span><span>시작 {question.review.firstUsedAt}</span>{question.review.distanceKm !== null && <span>{question.review.distanceKm}km 기록</span>}</div><p className="review-body">{question.review.body}</p><div className="review-bottom"><span>개인이 직접 남긴 착용 경험이에요.</span>{question.isMine && !example && <div><button className="text-button" onClick={() => onAction("review", question)}><Pencil size={14} />수정</button><button className="text-button muted" onClick={() => onDeleteReview(question)}><Trash2 size={14} />삭제</button></div>}</div></section>}
  </article><aside className="detail-aside"><div className="journey-card"><span className="eyebrow">ONE PAIR, ONE STORY</span><h3>질문에서<br />나만의 답까지.</h3><ol className="journey"><li className="complete"><span><Check size={14} /></span><div><strong>조건을 담은 질문</strong><p>잘 맞는 신발이 비교의 기준으로</p></div></li><li className={question.choice ? "complete" : ""}><span>{question.choice ? <Check size={14} /> : "2"}</span><div><strong>직접 고른 한 켤레</strong><p>고민 이후의 선택을 기록</p></div></li><li className={question.review ? "complete" : ""}><span>{question.review ? <Check size={14} /> : "3"}</span><div><strong>달려 본 뒤의 후기</strong><p>실제 착용감으로 이야기를 완성</p></div></li></ol>
    {example ? <button className="btn btn-primary full-width" onClick={onNew}>나의 질문 시작하기<ArrowRight size={16} /></button> : question.isMine ? <><button className="btn btn-primary full-width" onClick={() => onAction(question.choice ? "review" : "choice", question)}>{question.review ? "착용 후기 수정하기" : question.choice ? "착용 후기 남기기" : "선택한 신발 기록하기"}<ArrowRight size={16} /></button><div className="owner-actions"><button className="text-button" onClick={() => onAction("edit", question)}><Pencil size={14} />질문 수정</button><button className="text-button muted" onClick={() => onDeleteQuestion(question)}><Trash2 size={14} />삭제</button></div>{question.review && <p className="field-hint">선택한 신발을 바꾸려면 연결된 후기를 먼저 삭제해 주세요.</p>}</> : <button className="btn btn-primary full-width" onClick={() => onAction("answer", question)}>나의 경험 보태기<Plus size={16} /></button>}
  </div><p className="aside-footnote">같은 신발도 발과 달리는 환경에 따라<br />다르게 느껴질 수 있어요.</p></aside></div>;
}
