import type { Purpose, Question, QuestionStatus, Width } from "../contracts";

export type AppTab = "community" | "closet" | "mine" | "moderation";
export type FeedMode = "live" | "examples";
export type SelectedQuestion = { id: string; example: boolean } | null;
export interface NavigationState {
  tab: AppTab;
  mode: FeedMode;
  selected: SelectedQuestion;
  q: string;
  purpose: Purpose | "";
  width: Width | "";
  status: QuestionStatus | "";
}

export const DEFAULT_NAVIGATION: NavigationState = {
  tab: "community", mode: "live", selected: null,
  q: "", purpose: "", width: "", status: "",
};

function option<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? value as T : fallback;
}
function recordId(value: string | null): string | null {
  if (!value || value.length > 128 || /[\s\u0000-\u001f]/.test(value)) return null;
  return value;
}

/** Read every navigation field, including an explicit return from examples to live records. */
export function readNavigation(search: string): NavigationState {
  const params = new URLSearchParams(search);
  let tab = option(params.get("tab"), ["community", "closet", "mine", "moderation"] as const, "community");
  let mode: FeedMode = params.get("mode") === "examples" && tab === "community" ? "examples" : "live";
  const questionId = recordId(params.get("question"));
  const exampleId = recordId(params.get("example"));
  let selected: SelectedQuestion = null;
  if (questionId) {
    selected = { id: questionId, example: false };
    mode = "live";
    if (tab !== "community" && tab !== "mine") tab = "community";
  } else if (exampleId) {
    selected = { id: exampleId, example: true };
    tab = "community";
    mode = "examples";
  }
  return {
    tab, mode, selected,
    q: (params.get("q") ?? "").slice(0, 100),
    purpose: option(params.get("purpose"), ["", "daily", "long", "speed", "race"] as const, ""),
    width: option(params.get("width"), ["", "narrow", "regular", "wide"] as const, ""),
    status: option(params.get("status"), ["", "open", "chosen", "reviewed"] as const, ""),
  };
}

/** URLSearchParams preserves Korean text and escapes reserved characters. */
export function navigationSearch(state: NavigationState): string {
  const params = new URLSearchParams();
  if (state.tab !== "community") params.set("tab", state.tab);
  if (state.mode === "examples" && state.tab === "community") params.set("mode", "examples");
  if (state.q) params.set("q", state.q.slice(0, 100));
  if (state.purpose) params.set("purpose", state.purpose);
  if (state.width) params.set("width", state.width);
  if (state.status) params.set("status", state.status);
  if (state.selected) params.set(state.selected.example ? "example" : "question", state.selected.id);
  const query = params.toString();
  return query ? `?${query}` : "";
}

/** Examples search the same visible fields as the live feed. */
export function questionMatchesSearch(question: Question, query: string): boolean {
  const text = [question.title, question.body, question.targetModel,
    question.reference?.brand, question.reference?.model,
    question.choice?.brand, question.choice?.model, question.review?.body].join(" ").toLowerCase();
  return text.includes(query.trim().toLowerCase());
}
