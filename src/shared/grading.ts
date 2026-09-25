// Grades a student's answer against a check, in the browser, so grading needs no connection.
// Slice 1 only needs "is this right?". Slice 2 adds known-wrong and unplanned results.

import type { Check, SimpleCheck } from "./lesson.ts";

export type Answer = { type: "select"; optionId: string } | { type: "number"; value: number };

export function isRight(check: Check | SimpleCheck, answer: Answer): boolean {
  if (check.type === "select" && answer.type === "select") return answer.optionId === check.answer;
  if (check.type === "number" && answer.type === "number")
    return Math.abs(answer.value - check.answer) <= check.tolerance + 1e-9;
  return false;
}
