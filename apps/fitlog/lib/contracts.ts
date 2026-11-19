export type Width = "narrow" | "regular" | "wide";
export type Fit = "tight" | "good" | "loose";
export type Purpose = "daily" | "long" | "speed" | "race";
export type QuestionStatus = "open" | "chosen" | "reviewed";

export interface ShoeReference {
  brand: string;
  model: string;
  size: number;
  width: Width;
  fit: Fit;
}
export interface Shoe extends ShoeReference {
  id: string;
  purpose: Purpose;
  memo: string;
  createdAt: string;
}
export interface Choice {
  brand: string;
  model: string;
  size: number;
  createdAt: string;
}
export interface Followup {
  body: string;
  fit: Fit;
  distanceKm: number | null;
  firstUsedAt: string;
  daysUsed: number;
  createdAt: string;
  updatedAt: string;
}
export interface Question {
  id: string;
  title: string;
  body: string;
  purpose: Purpose;
  width: Width;
  targetModel: string;
  reference: ShoeReference | null;
  nickname: string;
  status: QuestionStatus;
  createdAt: string;
  replyCount: number;
  isMine: boolean;
  choice: Choice | null;
  review: Followup | null;
}
export interface Answer {
  id: string;
  body: string;
  nickname: string;
  reference: ShoeReference | null;
  isMine: boolean;
  createdAt: string;
}
export interface Session {
  user: { id?: string; nickname: string } | null;
  canModerate: boolean;
}
export interface QuestionDetail {
  item: Question;
  answers: Answer[];
}
export interface Report {
  id: string;
  targetType: "question" | "answer";
  targetId: string;
  reason: string;
  status: "pending" | "hidden" | "dismissed";
  createdAt: string;
  contentPreview: string;
}
export const WIDTH_LABELS: Record<Width, string> = { narrow: "좁은 편", regular: "보통", wide: "넓은 편" };
export const FIT_LABELS: Record<Fit, string> = { tight: "조금 작아요", good: "잘 맞아요", loose: "조금 커요" };
export const PURPOSE_LABELS: Record<Purpose, string> = { daily: "일상 러닝", long: "장거리", speed: "속도 훈련", race: "대회" };
export const STATUS_LABELS: Record<QuestionStatus, string> = { open: "답변 기다리는 중", chosen: "선택 완료", reviewed: "착용 후기 도착" };
