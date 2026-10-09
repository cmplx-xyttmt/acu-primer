// What comes after an answer. Pure logic, no Svelte and no network, so it's tested directly.
//
// Two levels, never three:
//   main level      a wrong answer opens a fallback (the one for that wrong answer, or the
//                   check's general fallback for an unplanned answer).
//   fallback level  the student has had their fallback. A wrong answer to the simpler
//                   question, or to the original question on the retry, ends in the
//                   "go back through the material" step, and the student carries on.

import type { Check, Fallback, SimpleCheck } from "./lesson.ts";
import type { Grade } from "./grading.ts";

export type Level = "main" | "fallback";

export type FallbackStep = {
  kind: "fallback";
  reason: "known" | "unplanned";
  wrongAnswerIndex?: number; // set when reason is "known"
  misconception?: string;
  reExplanation?: string; // only parts the author left switched on
  simplerQuestion?: SimpleCheck;
};

export type Step = { kind: "move-on" } | FallbackStep | { kind: "material" };

function enabledParts(fallback: Fallback) {
  return {
    reExplanation: fallback.reExplanation?.enabled ? fallback.reExplanation.text : undefined,
    simplerQuestion: fallback.simplerQuestion?.enabled ? fallback.simplerQuestion.check : undefined,
  };
}

const isEmpty = (parts: ReturnType<typeof enabledParts>) => !parts.reExplanation && !parts.simplerQuestion;

/** After an answer to the check itself. */
export function afterMainAnswer(check: Check, grade: Grade, level: Level): Step {
  if (grade.kind === "right") return { kind: "move-on" };
  if (level === "fallback") return { kind: "material" };

  if (grade.kind === "known-wrong") {
    const wrong = check.wrongAnswers[grade.index];
    const parts = enabledParts(wrong.fallback);
    // If the author switched off both parts for this wrong answer, the general fallback
    // still gives the student something.
    if (!isEmpty(parts))
      return {
        kind: "fallback",
        reason: "known",
        wrongAnswerIndex: grade.index,
        misconception: wrong.misconception.text,
        ...parts,
      };
  }
  return { kind: "fallback", reason: "unplanned", ...enabledParts(check.generalFallback) };
}

/** After an answer to a fallback's simpler question. There is no level below this one. */
export function afterSimplerAnswer(right: boolean): "retry-main" | "material" {
  return right ? "retry-main" : "material";
}
