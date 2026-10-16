// The rules of step-by-step review (slice 4b), pure so they're tested directly. The Worker
// uses them to refuse a sign-off, and the review screen to show progress.
//
// A lesson is reviewed in steps: its outcomes, then each module. The author approves a step
// with one tick, or leaves suggestions pinned to a part of it. An approval stores a hash of
// the step's content, so if a revision changes that step, the approval no longer counts.

import type { Lesson } from "./lesson.ts";

export const OUTCOMES_STEP = "_outcomes";

export type SuggestionStatus = "open" | "resolved" | "withdrawn";

export interface Suggestion {
  id: string;
  lessonId: string;
  stepId: string;
  part: string;
  partLabel: string;
  text: string;
  status: SuggestionStatus;
  note: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface ReviewStep {
  id: string;
  title: string;
}

export function reviewSteps(lesson: Lesson): ReviewStep[] {
  return [
    { id: OUTCOMES_STEP, title: "Outcomes" },
    ...lesson.modules.map((m, i) => ({ id: m.id, title: `${i + 1}. ${m.title}` })),
  ];
}

/** What an approval of this step covers; its hash is stored with the approval. */
export function stepContent(lesson: Lesson, stepId: string): unknown {
  if (stepId === OUTCOMES_STEP) return lesson.outcomes;
  return lesson.modules.find((m) => m.id === stepId) ?? null;
}

export interface ReviewState {
  steps: (ReviewStep & { approved: boolean; open: number })[];
  approved: number;
  total: number;
  open: number;
  canSignOff: boolean;
  blockers: string[]; // why sign-off isn't possible yet, in plain words
}

/**
 * @param approvedSteps step ids whose stored approval still matches the step's content
 * @param suggestions   all suggestions for this lesson
 */
export function reviewState(lesson: Lesson, approvedSteps: Set<string>, suggestions: Suggestion[]): ReviewState {
  const steps = reviewSteps(lesson).map((s) => ({
    ...s,
    approved: approvedSteps.has(s.id),
    open: suggestions.filter((g) => g.stepId === s.id && g.status === "open").length,
  }));
  const approved = steps.filter((s) => s.approved).length;
  const open = suggestions.filter((g) => g.status === "open").length;
  const blockers: string[] = [];
  const unapproved = steps.length - approved;
  if (unapproved > 0) blockers.push(`${unapproved} step${unapproved === 1 ? "" : "s"} not approved yet`);
  if (open > 0) blockers.push(`${open} suggestion${open === 1 ? "" : "s"} still open`);
  return { steps, approved, total: steps.length, open, canSignOff: blockers.length === 0, blockers };
}

/** A step with an open suggestion can't be approved until the suggestion is dealt with. */
export function canApprove(stepId: string, suggestions: Suggestion[]): boolean {
  return !suggestions.some((g) => g.stepId === stepId && g.status === "open");
}
