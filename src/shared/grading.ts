// Grades a student's answer against a check, in the browser, so grading needs no connection.
// A full check can recognise a known wrong answer (one the author anticipated, which names a
// misconception). A simpler question has no known wrong answers, so it's right or unplanned.

import type { Check, SimpleCheck } from "./lesson.ts";

export type Answer =
  | { type: "select"; optionId: string }
  | { type: "number"; value: number }
  | { type: "sort"; placements: Record<string, string> }; // item id → category id

export type Grade =
  | { kind: "right" }
  | { kind: "known-wrong"; index: number } // index into check.wrongAnswers
  | { kind: "unplanned" };

// Floating-point slack, so 0.86 typed for an answer of 0.86 with tolerance 0.005 never fails
// on a rounding error in the last bit.
const EPSILON = 1e-9;

export function isRight(check: Check | SimpleCheck, answer: Answer): boolean {
  if (check.type === "select" && answer.type === "select") return answer.optionId === check.answer;
  if (check.type === "number" && answer.type === "number")
    return Math.abs(answer.value - check.answer) <= check.tolerance + EPSILON;
  if (check.type === "sort" && answer.type === "sort") return check.items.every((i) => answer.placements[i.id] === i.category);
  return false;
}

export function grade(check: Check | SimpleCheck, answer: Answer): Grade {
  if (isRight(check, answer)) return { kind: "right" };
  if (!("wrongAnswers" in check)) return { kind: "unplanned" };

  const index =
    check.type === "select" && answer.type === "select"
      ? check.wrongAnswers.findIndex((w) => w.match.optionId === answer.optionId)
      : check.type === "number" && answer.type === "number"
        ? check.wrongAnswers.findIndex(
            (w) => answer.value >= w.match.min - EPSILON && answer.value <= w.match.max + EPSILON,
          )
        : check.type === "sort" && answer.type === "sort"
          ? // The first anticipated misplacement the student made, in the author's order.
            check.wrongAnswers.findIndex((w) => answer.placements[w.match.itemId] === w.match.categoryId)
          : -1;
  return index >= 0 ? { kind: "known-wrong", index } : { kind: "unplanned" };
}
