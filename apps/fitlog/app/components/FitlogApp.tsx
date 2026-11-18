"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, Check, ChevronDown, Info, LoaderCircle, LockKeyhole, Pencil, Plus, RefreshCw, Search, SlidersHorizontal, Trash2, UserRound, X } from "lucide-react";
import type { Answer, Purpose, Question, QuestionDetail, QuestionStatus, Report, Session, Shoe, Width } from "../../lib/contracts";
import { FIT_LABELS, PURPOSE_LABELS, WIDTH_LABELS } from "../../lib/contracts";
import { EXAMPLE_DETAILS } from "../../lib/examples";
import { AnswerForm, ChoiceForm, ConfirmModal, NicknameForm, QuestionForm, ReportForm, ReviewForm, ShoeForm } from "./Forms";
import { EmptyState, LoadingRows, Logo, QuestionCard } from "./Cards";
import DetailView from "./DetailView";
import ShoeArt from "./ShoeArt";
import { api, humanDate, Modal, SignInContent } from "./ui";

type Tab = "community" | "closet" | "mine" | "moderation";
type ModalState =
  | { kind: "shoe"; shoe?: Shoe }
  | { kind: "question"; question?: Question }
  | { kind: "answer" | "choice" | "review"; question: Question }
  | { kind: "nickname" }
  | { kind: "report"; targetId: string; targetType: "question" | "answer" }
  | { kind: "confirm"; title: string; description: string; onConfirm: () => Promise<void> }
  | { kind: "signin" | "principles" }
  | null;

export default function FitlogApp() {
  const [tab, setTab] = useState<Tab>("community");
  const [mode, setMode] = useState<"live" | "examples">("live");
  const [session, setSession] = useState<Session>({ user: null, canModerate: false });
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionError, setSessionError] = useState("");
  const [sessionRevision, setSessionRevision] = useState(0);
  const [shoes, setShoes] = useState<Shoe[]>([]);
  const [shoesLoading, setShoesLoading] = useState(false);
  const [shoesError, setShoesError] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [revision, setRevision] = useState(0);
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [purpose, setPurpose] = useState<Purpose | "">("");
  const [width, setWidth] = useState<Width | "">("");
  const [status, setStatus] = useState<QuestionStatus | "">("");
  const [selected, setSelected] = useState<{ id: string; example: boolean } | null>(null);
  const [detail, setDetail] = useState<QuestionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [modal, setModal] = useState<ModalState>(null);
  const [toast, setToast] = useState("");
  const [reports, setReports] = useState<Report[]>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState("");
  const [reportBusy, setReportBusy] = useState("");
  const signedIn = Boolean(session.user);

  useEffect(() => {
    let ignore = false; setSessionError("");
    api<Session>("/api/session").then(result => { if (!ignore) { setSession(result); setSessionReady(true); } }).catch(error => { if (!ignore) { setSessionError(error.message); setSessionReady(true); } });
    return () => { ignore = true; };
  }, [sessionRevision]);
  useEffect(() => { const timeout = window.setTimeout(() => setSearch(q.trim()), 230); return () => window.clearTimeout(timeout); }, [q]);
  useEffect(() => {
    const readLocation = () => { const params = new URLSearchParams(window.location.search); const id = params.get("question") ?? params.get("example"); if (params.has("example")) setMode("examples"); setSelected(id ? { id, example: params.has("example") } : null); };
    readLocation(); window.addEventListener("popstate", readLocation); return () => window.removeEventListener("popstate", readLocation);
  }, []);
  useEffect(() => { if (!toast) return; const timeout = window.setTimeout(() => setToast(""), 4500); return () => window.clearTimeout(timeout); }, [toast]);
  useEffect(() => {
    if (!signedIn) { setShoes([]); return; }
    let ignore = false; setShoesLoading(true); setShoesError("");
    api<{ items: Shoe[] }>("/api/shoes").then(result => { if (!ignore) setShoes(result.items); }).catch(error => { if (!ignore) setShoesError(error.message); }).finally(() => { if (!ignore) setShoesLoading(false); });
    return () => { ignore = true; };
  }, [signedIn, revision]);
  useEffect(() => {
    if (tab === "closet" || tab === "moderation" || (tab === "mine" && !signedIn)) return;
    let ignore = false; setLoading(true); setListError("");
    const params = new URLSearchParams();
    if (search) params.set("q", search); if (purpose) params.set("purpose", purpose); if (width) params.set("width", width); if (status) params.set("status", status); if (tab === "mine") params.set("mine", "1");
    api<{ items: Question[]; total: number }>(`/api/questions?${params}`).then(result => { if (!ignore) { setQuestions(result.items); setTotal(result.total); } }).catch(error => { if (!ignore) setListError(error.message); }).finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [tab, search, purpose, width, status, signedIn, revision]);
  useEffect(() => {
    if (!selected) { setDetail(null); setDetailError(""); return; }
    if (selected.example) { const example = EXAMPLE_DETAILS.find(d => d.item.id === selected.id); setDetail(example ?? null); setDetailError(example ? "" : "찾는 예시가 없어요."); setDetailLoading(false); return; }
    let ignore = false; setDetail(null); setDetailLoading(true); setDetailError("");
    api<QuestionDetail>(`/api/questions/${encodeURIComponent(selected.id)}`).then(result => { if (!ignore) setDetail(result); }).catch(error => { if (!ignore) setDetailError(error.message); }).finally(() => { if (!ignore) setDetailLoading(false); });
    return () => { ignore = true; };
  }, [selected, revision]);
  useEffect(() => {
    if (tab !== "moderation" || !session.canModerate) return;
    let ignore = false; setReportLoading(true); setReportError("");
    api<{ items: Report[] }>("/api/reports").then(result => { if (!ignore) setReports(result.items); }).catch(error => { if (!ignore) setReportError(error.message); }).finally(() => { if (!ignore) setReportLoading(false); });
    return () => { ignore = true; };
  }, [tab, session.canModerate, revision]);

  const exampleQuestions = useMemo(() => EXAMPLE_DETAILS.map(d => d.item).filter(item => (!purpose || item.purpose === purpose) && (!width || item.width === width) && (!status || item.status === status) && (!search || [item.title, item.body, item.targetModel, item.reference?.model].join(" ").toLowerCase().includes(search.toLowerCase()))), [purpose, width, status, search]);
  const visibleQuestions = mode === "examples" && tab === "community" ? exampleQuestions : questions;
  const hasFilters = Boolean(search || purpose || width || status);
  function clearFilters() { setQ(""); setSearch(""); setPurpose(""); setWidth(""); setStatus(""); }
  function changeSelection(value: { id: string; example: boolean } | null) {
    setSelected(value); const url = new URL(window.location.href); url.searchParams.delete("question"); url.searchParams.delete("example"); if (value) url.searchParams.set(value.example ? "example" : "question", value.id); window.history.pushState(null, "", `${url.pathname}${url.search}`); window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function navigate(next: Tab) { setTab(next); setMode("live"); clearFilters(); changeSelection(null); }
  function gated(action: Exclude<ModalState, null>) { setModal(signedIn ? action : { kind: "signin" }); }
  function updated(message: string) { setModal(null); setRevision(n => n + 1); setToast(message); }
  function deleteQuestion(question: Question) { setModal({ kind: "confirm", title: "이 질문을 삭제할까요?", description: "질문과 연결된 답변, 선택, 후기도 함께 삭제돼요. 내 신발장의 기록은 그대로 남아요.", onConfirm: async () => { await api(`/api/questions/${question.id}`, { method: "DELETE" }); changeSelection(null); setRevision(n => n + 1); setToast("질문과 연결된 기록을 삭제했어요."); } }); }
  function deleteShoe(shoe: Shoe) { setModal({ kind: "confirm", title: "신발장에서 삭제할까요?", description: `${shoe.brand} ${shoe.model} 기록을 삭제해요. 이미 질문이나 답변에 공유한 당시의 신발 정보는 그대로 남아요.`, onConfirm: async () => { await api(`/api/shoes/${shoe.id}`, { method: "DELETE" }); setRevision(n => n + 1); setToast("신발 기록을 삭제했어요."); } }); }
  function deleteAnswer(question: Question, answer: Answer) { setModal({ kind: "confirm", title: "내 답변을 삭제할까요?", description: "답변에 함께 공유한 신발 정보도 이 답변에서 삭제돼요.", onConfirm: async () => { await api(`/api/questions/${question.id}/answers/${answer.id}`, { method: "DELETE" }); setRevision(n => n + 1); setToast("답변을 삭제했어요."); } }); }
  function deleteReview(question: Question) { setModal({ kind: "confirm", title: "착용 후기를 삭제할까요?", description: "후기만 삭제되고 질문과 선택한 신발은 남아요. 나중에 다시 후기를 작성할 수 있어요.", onConfirm: async () => { await api(`/api/questions/${question.id}/review`, { method: "DELETE" }); setRevision(n => n + 1); setToast("착용 후기를 삭제했어요."); } }); }
  async function moderate(id: string, action: "hide" | "dismiss") { if (reportBusy) return; setReportBusy(id); setReportError(""); try { await api(`/api/reports/${id}`, { method: "PATCH", body: JSON.stringify({ action }) }); setRevision(n => n + 1); setToast(action === "hide" ? "신고된 글을 숨겼어요." : "신고 확인을 마쳤어요."); } catch (error) { setReportError(error instanceof Error ? error.message : "처리하지 못했어요."); } finally { setReportBusy(""); } }

  return <div className="app-shell"><a className="skip-link" href="#main-content">본문으로 건너뛰기</a>
    <header className="site-header"><div className="header-inner"><button className="brand-button" onClick={() => navigate("community")} aria-label="핏로그 홈"><Logo /></button><nav className="main-nav" aria-label="주 메뉴"><button className={tab === "community" ? "active" : ""} onClick={() => navigate("community")}>둘러보기</button><button className={tab === "closet" ? "active" : ""} onClick={() => navigate("closet")}>내 신발장</button><button className={tab === "mine" ? "active" : ""} onClick={() => navigate("mine")}>내 기록</button>{session.canModerate && <button className={tab === "moderation" ? "active" : ""} onClick={() => navigate("moderation")}>신고 관리</button>}</nav><div className="header-actions"><button className="profile-button" disabled={!sessionReady} onClick={() => gated({ kind: "nickname" })} aria-label={signedIn ? "닉네임 변경" : "로그인"}>{sessionReady ? <UserRound size={19} /> : <LoaderCircle size={18} className="spin" />}<span>{session.user?.nickname ?? "로그인"}</span></button><button className="btn btn-dark header-write" onClick={() => gated({ kind: "question" })}><Plus size={16} /><span>질문 쓰기</span></button></div></div></header>
    {sessionError && <div className="connection-strip" role="alert"><span>로그인 상태를 확인하지 못했어요.</span><button onClick={() => setSessionRevision(n => n + 1)}>다시 확인 <RefreshCw size={13} /></button></div>}
    <main id="main-content">
      {selected ? <section className="page-width detail-page"><button className="back-button" onClick={() => changeSelection(null)}><ArrowLeft size={17} />{selected.example ? "예시 둘러보기" : "질문 목록으로"}</button>{detailLoading ? <LoadingRows /> : detailError || !detail ? <EmptyState title="이 기록을 불러오지 못했어요" description={detailError || "잠시 후 다시 확인해 주세요."}><button className="btn btn-secondary" onClick={() => setRevision(n => n + 1)}><RefreshCw size={16} />다시 시도</button></EmptyState> : <DetailView detail={detail} example={selected.example} onAction={(action, question) => gated(action === "edit" ? { kind: "question", question } : { kind: action, question })} onNew={() => gated({ kind: "question" })} onDeleteQuestion={deleteQuestion} onDeleteAnswer={deleteAnswer} onDeleteReview={deleteReview} onReport={(targetId, targetType) => gated({ kind: "report", targetId, targetType })} />}</section> : <>
        {tab === "community" && <><section className="hero page-width"><div className="hero-copy"><div className="hero-eyebrow"><span /> EVERY RUNNER HAS A DIFFERENT FIT</div><h1>다음 한 켤레,<br />먼저 신어본<br /><span>러너에게.</span></h1><p>사이즈표 밖의 이야기가 필요할 때.<br />나와 비슷한 러너의 경험에서 시작해 보세요.</p><div className="hero-actions"><button className="btn btn-primary" onClick={() => gated({ kind: "question" })}>내 조건으로 물어보기 <ArrowUpRight size={18} /></button><a href="#community-feed" className="hero-scroll">이야기 둘러보기 <ArrowDown size={15} /></a></div></div><div className="hero-visual" aria-hidden="true"><div className="track-lines"><i /><i /><i /><i /></div><span className="visual-overline">THE NEXT PAIR<br /><b>STARTS HERE.</b></span><div className="hero-shoe"><ShoeArt /></div><span className="visual-stamp">FIT<br /><span>NOT JUST SIZE.</span></span><div className="shoe-caption"><span className="caption-line" /><div><strong>같은 사이즈, 다른 경험.</strong><span>나의 기록이 더 나은 질문으로.</span></div></div><span className="visual-number">01—03</span></div></section><div className="process-strip"><div className="page-width process-inner"><span><b>01</b> 잘 맞는 신발을 기준으로</span><ArrowRight size={16} /><span><b>02</b> 비슷한 러너에게 묻고</span><ArrowRight size={16} /><span><b>03</b> 신어 본 후기로 이어져요</span></div></div></>}
        {tab === "closet" ? <section className="page-width personal-page"><header className="personal-heading"><div><span className="eyebrow">MY SHOE CABINET</span><h1>내 발이 기억하는 한 켤레.</h1><p>지금 신는 신발을 기록하면, 다음 질문의 기준이 생겨요.</p></div><button className="btn btn-primary" onClick={() => gated({ kind: "shoe" })}><Plus size={17} />신발 추가</button></header><div className="privacy-note"><LockKeyhole size={15} />신발장과 메모는 나만 볼 수 있어요. 질문할 때 필요한 정보만 골라 공유해요.</div>{!sessionReady || shoesLoading ? <LoadingRows /> : !signedIn ? <EmptyState icon="shoe" title="나만의 신발장을 열어 보세요" description="로그인하면 기기와 관계없이 내 신발 기록을 이어 볼 수 있어요."><button className="btn btn-primary" onClick={() => setModal({ kind: "signin" })}>로그인하고 기록하기<ArrowRight size={16} /></button></EmptyState> : shoesError ? <EmptyState title="신발장을 불러오지 못했어요" description={shoesError}><button className="btn btn-secondary" onClick={() => setRevision(n => n + 1)}>다시 시도</button></EmptyState> : shoes.length ? <div className="shoe-grid">{shoes.map((shoe, index) => <article className="shoe-card" key={shoe.id}><div className={`shoe-card-art tone-${index % 3}`}><span className="shoe-card-index">PAIR {String(index + 1).padStart(2, "0")}</span><span className="fit-pill">{FIT_LABELS[shoe.fit]}</span><ShoeArt simple tone={index % 3 === 1 ? "sage" : index % 3 === 2 ? "sand" : "orange"} /></div><div className="shoe-card-body"><span className="shoe-brand">{shoe.brand}</span><h2>{shoe.model}</h2><div className="shoe-card-specs"><strong>{shoe.size}<span>mm</span></strong><span>발볼 {WIDTH_LABELS[shoe.width]}</span><span>{PURPOSE_LABELS[shoe.purpose]}</span></div>{shoe.memo && <p className="shoe-memo">{shoe.memo}</p>}<div className="shoe-card-bottom"><span><LockKeyhole size={13} />나만 보기</span><div><button className="icon-button" aria-label={`${shoe.model} 수정`} onClick={() => setModal({ kind: "shoe", shoe })}><Pencil size={16} /></button><button className="icon-button" aria-label={`${shoe.model} 삭제`} onClick={() => deleteShoe(shoe)}><Trash2 size={16} /></button></div></div></div></article>)}<button className="shoe-add-card" onClick={() => setModal({ kind: "shoe" })}><span><Plus size={26} /></span><strong>한 켤레 더 기록하기</strong><p>신발마다 다른 착용감을 기억해요.</p></button></div> : <EmptyState icon="shoe" title="첫 한 켤레부터, 가볍게." description="브랜드와 모델, 사이즈, 착용감만 적으면 충분해요."><button className="btn btn-primary" onClick={() => setModal({ kind: "shoe" })}><Plus size={17} />첫 신발 기록하기</button></EmptyState>}</section> : tab === "moderation" ? <section className="page-width personal-page"><header className="personal-heading"><div><span className="eyebrow">COMMUNITY CARE</span><h1>신고 관리</h1><p>신고 내용과 대상 글을 확인하고 처리해 주세요.</p></div></header>{reportError && <div className="notice notice-error" role="alert">{reportError}</div>}{!session.canModerate ? <EmptyState title="운영 권한이 필요해요" description="이 화면은 지정된 운영자만 사용할 수 있어요." /> : reportLoading ? <LoadingRows /> : reports.length ? <div className="reports-list">{reports.map(report => <article className="report-card" key={report.id}><header><span className="tag">{report.targetType === "question" ? "질문" : "답변"}</span><b>{report.status === "pending" ? "확인 대기" : report.status === "hidden" ? "숨김 처리" : "확인 완료"}</b><span>{humanDate(report.createdAt)}</span></header><p className="report-content">{report.contentPreview || "대상 내용이 없어요."}</p><p><strong>신고 사유</strong> {report.reason}</p>{report.status === "pending" && <footer><button className="btn btn-secondary btn-small" disabled={Boolean(reportBusy)} onClick={() => void moderate(report.id, "dismiss")}>조치 없이 완료</button><button className="btn btn-dark btn-small" disabled={Boolean(reportBusy)} onClick={() => void moderate(report.id, "hide")}>{reportBusy === report.id ? "처리 중…" : "대상 글 숨기기"}</button></footer>}</article>)}</div> : <EmptyState title="확인할 신고가 없어요" description="신고가 접수되면 이곳에서 확인할 수 있어요." />}</section> : <section id="community-feed" className={`page-width community-section ${tab === "mine" ? "personal-page" : ""}`}>
          <header className="section-heading community-heading"><div><span className="eyebrow">{tab === "mine" ? "MY RUNNING STORIES" : "FIND YOUR NEXT PAIR"}</span><h2>{tab === "mine" ? "내 질문, 나의 다음 이야기." : "러너들의 다음 한 켤레"}</h2><p>{tab === "mine" ? "고민했던 순간부터 직접 신어 본 뒤까지 이어 남겨요." : "어떤 고민으로 시작해서, 어떤 선택으로 이어졌을까요?"}</p></div>{tab === "community" && <div className="mode-switch" aria-label="목록 종류"><button aria-pressed={mode === "live"} className={mode === "live" ? "active" : ""} onClick={() => { setMode("live"); clearFilters(); }}>커뮤니티</button><button aria-pressed={mode === "examples"} className={mode === "examples" ? "active" : ""} onClick={() => { setMode("examples"); clearFilters(); }}>가상 예시 <ArrowUpRight size={13} /></button></div>}</header>
          <div className="community-grid"><div className="feed-main"><div className="feed-filters"><label className="search-box"><Search size={19} /><input aria-label="질문 검색" maxLength={100} value={q} onChange={event => setQ(event.target.value)} placeholder="모델명이나 궁금한 점을 찾아보세요" />{q && <button aria-label="검색어 지우기" onClick={() => setQ("")}><X size={16} /></button>}</label><div className="filter-row"><span className="filter-caption"><SlidersHorizontal size={15} />내 조건으로</span><label className="select-wrap"><span className="sr-only">러닝 용도</span><select value={purpose} onChange={event => setPurpose(event.target.value as Purpose | "")}><option value="">모든 용도</option>{Object.entries(PURPOSE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><ChevronDown size={13} /></label><label className="select-wrap"><span className="sr-only">발볼 조건</span><select value={width} onChange={event => setWidth(event.target.value as Width | "")}><option value="">모든 발볼</option>{Object.entries(WIDTH_LABELS).map(([key, label]) => <option key={key} value={key}>발볼 {label}</option>)}</select><ChevronDown size={13} /></label>{hasFilters && <button className="filter-reset" onClick={clearFilters}>초기화</button>}</div></div>
            <div className="status-tabs" aria-label="질문 진행 상태">{[["", "전체"], ["open", "답변 기다리는 중"], ["chosen", "선택 완료"], ["reviewed", "착용 후기"]].map(([key, label]) => <button key={key} className={status === key ? "active" : ""} aria-pressed={status === key} onClick={() => setStatus(key as QuestionStatus | "")}>{label}</button>)}</div>
            {mode === "examples" && tab === "community" && <div className="sample-banner"><Info size={16} /><p><b>처음이라면, 가상 예시로 둘러보세요.</b><span>아래 글은 사용 흐름을 보여 주는 예시이며 실제 후기·참여 수에 포함되지 않아요.</span></p></div>}
            {tab === "mine" && !signedIn ? <EmptyState title="나의 이야기를 이어 보세요" description="로그인하면 내가 남긴 질문과 선택, 후기를 한곳에서 볼 수 있어요."><button className="btn btn-primary" onClick={() => setModal({ kind: "signin" })}>로그인하기 <ArrowRight size={16} /></button></EmptyState> : loading && mode === "live" ? <LoadingRows /> : listError && mode === "live" ? <EmptyState title="이야기를 불러오지 못했어요" description={listError}><button className="btn btn-secondary" onClick={() => setRevision(n => n + 1)}><RefreshCw size={16} />다시 시도</button>{tab === "community" && <button className="text-button" onClick={() => { setMode("examples"); clearFilters(); }}>가상 예시 둘러보기 <ArrowRight size={15} /></button>}</EmptyState> : visibleQuestions.length ? <><div className="list-meta"><span>{mode === "examples" ? "가상 예시" : `${total.toLocaleString()}개의 이야기`}</span><span>{mode === "examples" ? "질문 → 선택 → 후기" : total > 100 ? "최신 100개 표시" : "최신 등록순"}</span></div><div className="question-list">{visibleQuestions.map(question => <QuestionCard key={question.id} question={question} example={mode === "examples" && tab === "community"} onClick={() => changeSelection({ id: question.id, example: mode === "examples" && tab === "community" })} />)}</div></> : hasFilters ? <EmptyState icon="search" title="아직 이 조건의 이야기는 없어요" description="조건을 조금 넓히거나, 궁금한 점을 직접 물어보세요."><button className="btn btn-secondary" onClick={clearFilters}>검색 조건 초기화</button></EmptyState> : <EmptyState title={tab === "mine" ? "나의 첫 질문을 남겨 보세요" : "첫 이야기가 시작되는 곳."} description={tab === "mine" ? "답변을 기다린 뒤, 어떤 신발을 골랐는지도 이어 기록할 수 있어요." : "지금 신발의 착용감과 다음 한 켤레의 고민을 나눠 주세요."}><button className="btn btn-primary" onClick={() => gated({ kind: "question" })}><Plus size={17} />첫 질문 남기기</button>{tab === "community" && <button className="text-button" onClick={() => setMode("examples")}>먼저 예시 볼게요 <ArrowRight size={15} /></button>}</EmptyState>}
            {mode === "live" && tab === "community" && !hasFilters && !loading && !listError && !questions.length && <div className="walkthrough-teaser"><div><span className="eyebrow">HOW IT WORKS</span><h3>질문 다음에도,<br />이야기는 계속돼요.</h3></div><div className="mini-steps"><span><i>1</i>궁금한 점을 물어보고</span><span><i>2</i>선택한 신발을 남기고</span><span><i>3</i>실제로 신어 본 뒤의 후기까지</span></div><button className="round-arrow" aria-label="가상 예시로 사용 흐름 보기" onClick={() => setMode("examples")}><ArrowUpRight size={22} /></button></div>}
          </div><aside className="feed-aside"><div className="closet-prompt"><div className="aside-topline"><span className="eyebrow">MY REFERENCE</span><LockKeyhole size={14} /></div><h3>좋은 질문은<br /><span>내 신발장에서.</span></h3><div className="aside-shoe"><ShoeArt simple tone="sage" /></div>{signedIn && shoes.length ? <><p><b>{shoes[0].brand} {shoes[0].model}</b><br />{shoes[0].size}mm · {FIT_LABELS[shoes[0].fit]}</p><button className="btn btn-secondary full-width" onClick={() => navigate("closet")}>내 신발장 보기 <ArrowRight size={16} /></button></> : <><p>지금 잘 맞는 신발 한 켤레.<br />그 기록이 다음 선택의 기준이 돼요.</p><button className="btn btn-secondary full-width" onClick={() => gated({ kind: "shoe" })}>내 신발 기록하기 <Plus size={16} /></button></>}<span className="aside-private"><LockKeyhole size={12} />내 기록은 나만 볼 수 있어요</span></div><div className="editor-note"><span className="note-number">A NOTE FOR RUNNERS</span><h3>정답보다,<br />가까운 경험을.</h3><p>같은 사이즈도 발 모양과 달리는 방식에 따라 다르게 느껴져요. 내 조건과 닮은 경험을 참고해 보세요.</p><button className="text-button" onClick={() => setModal({ kind: "principles" })}>핏로그의 기록 원칙 <ArrowUpRight size={14} /></button></div></aside></div>
        </section>}
      </>}
    </main>
    <footer className="site-footer page-width"><div><Logo small /><span>EVERY FIT HAS A STORY.</span></div><p>질문에서 선택, 다음 러닝까지.<br className="mobile-only" /> 러너의 경험을 이어 기록해요.</p><button onClick={() => setModal({ kind: "principles" })}>기록의 원칙 <ArrowUpRight size={14} /></button></footer>
    {toast && <div className="toast" role="status"><Check size={17} /><span>{toast}</span><button aria-label="알림 닫기" onClick={() => setToast("")}><X size={15} /></button></div>}
    {modal?.kind === "shoe" && <ShoeForm shoe={modal.shoe} onClose={() => setModal(null)} onSaved={() => updated(modal.shoe ? "신발 기록을 수정했어요." : "내 신발장에 한 켤레를 기록했어요.")} />}
    {modal?.kind === "question" && <QuestionForm question={modal.question} shoes={shoes} onClose={() => setModal(null)} onSaved={question => { updated(modal.question ? "질문을 수정했어요." : "질문을 올렸어요. 선택과 후기도 이어 남겨 주세요."); setMode("live"); changeSelection({ id: question.id, example: false }); }} />}
    {modal?.kind === "answer" && <AnswerForm question={modal.question} shoes={shoes} onClose={() => setModal(null)} onSaved={() => updated("경험을 나눠 주셔서 고마워요.")} />}
    {modal?.kind === "choice" && <ChoiceForm question={modal.question} onClose={() => setModal(null)} onSaved={() => updated("선택한 신발을 기록했어요. 신어 본 뒤 후기도 남겨 주세요.")} />}
    {modal?.kind === "review" && <ReviewForm question={modal.question} onClose={() => setModal(null)} onSaved={() => updated("착용 후기를 연결했어요.")} />}
    {modal?.kind === "nickname" && <NicknameForm nickname={session.user?.nickname ?? "러너"} onClose={() => setModal(null)} onSaved={value => { setSession(value); updated("앞으로 쓸 글에 새로운 닉네임이 표시돼요."); }} />}
    {modal?.kind === "report" && <ReportForm targetId={modal.targetId} targetType={modal.targetType} onClose={() => setModal(null)} onSaved={() => updated("신고를 저장했어요.")} />}
    {modal?.kind === "confirm" && <ConfirmModal title={modal.title} description={modal.description} onConfirm={modal.onConfirm} onClose={() => setModal(null)} />}
    {modal?.kind === "signin" && <Modal title="핏로그에 오신 걸 환영해요" onClose={() => setModal(null)}><SignInContent onClose={() => setModal(null)} /></Modal>}
    {modal?.kind === "principles" && <Modal title="핏로그의 기록 원칙" subtitle="누군가의 경험을 더 잘 읽을 수 있도록." onClose={() => setModal(null)}><div className="principles-list"><div><span>01</span><h3>조건과 함께 기록해요.</h3><p>기존 신발, 사이즈, 발볼, 달리는 용도를 함께 남겨요. 개인 메모는 신발장에서 나만 볼 수 있어요.</p></div><div><span>02</span><h3>선택 이후도 이어 남겨요.</h3><p>실제로 무엇을 골랐는지, 사용한 뒤 느낌은 어땠는지 질문에 연결해요. 사용 기간을 지어내지 않아요.</p></div><div><span>03</span><h3>개인의 경험으로 읽어요.</h3><p>착용감은 사람마다 달라요. 게시물은 검증된 구매 인증이나 사이즈 보장이 아니며, 가상 예시는 별도로 표시해요.</p></div></div></Modal>}
  </div>;
}
