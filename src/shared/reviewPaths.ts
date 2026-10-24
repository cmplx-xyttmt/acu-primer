// The paths a student can take through one check, for review by playing it (slice 11). The
// author plays the module as a student; each answer ticks the path it would take, so the
// review screen can say which hints the author hasn't seen yet. Pure, so it's tested directly.

import type { Check } from "./lesson.ts";
import type { Grade } from "./grading.ts";

export type PathId = "right" | "other" | `wrong.${number}`;

export interface ReviewPath {
  id: PathId;
  label: string; // plain text: what the student does to take this path
}

const num = (n: number) => String(+n.toFixed(6));

export function reviewPaths(check: Check): ReviewPath[] {
  const wrong: ReviewPath[] = check.wrongAnswers.map((w, i) => {
    const id = `wrong.${i}` as const;
    if ("optionId" in w.match && check.type === "select") {
      const optionId = w.match.optionId;
      return { id, label: `Picks "${check.options.find((o) => o.id === optionId)?.text ?? optionId}"` };
    }
    if ("itemId" in w.match && check.type === "sort") {
      const m = w.match;
      const item = check.items.find((x) => x.id === m.itemId)?.text ?? m.itemId;
      const cat = check.categories.find((x) => x.id === m.categoryId)?.label ?? m.categoryId;
      return { id, label: `Puts "${item}" in "${cat}"` };
    }
    if ("min" in w.match)
      return { id, label: w.match.min === w.match.max ? `Types ${num(w.match.min)}` : `Types ${num(w.match.min)} to ${num(w.match.max)}` };
    return { id, label: `Wrong answer ${i + 1}` };
  });
  const right =
    check.type === "select"
      ? `Picks "${check.options.find((o) => o.id === check.answer)?.text ?? check.answer}" (right)`
      : check.type === "sort"
        ? "Sorts every item into its category (right)"
        : `Types ${num(check.answer)}${check.unit ? ` ${check.unit}` : ""} (right, ± ${num(check.tolerance)})`;
  // A select check whose options are all planned for (the right one plus a wrong answer for each
  // of the rest) leaves a student no unplanned answer to give, so there's no such path.
  const allPlanned =
    check.type === "select" &&
    check.options.every((o) => o.id === check.answer || check.wrongAnswers.some((w) => "optionId" in w.match && w.match.optionId === o.id));
  return [{ id: "right", label: right }, ...wrong, ...(allPlanned ? [] : [{ id: "other" as const, label: "Any other answer" }])];
}

/** The path an answer took, from its grade. */
export function pathOf(grade: Grade): PathId {
  return grade.kind === "right" ? "right" : grade.kind === "known-wrong" ? `wrong.${grade.index}` : "other";
}

/** The paths not seen yet, in the order they're listed. */
export function untried(paths: ReviewPath[], seen: ReadonlySet<PathId>): ReviewPath[] {
  return paths.filter((p) => !seen.has(p.id));
}

/** What the coach line suggests next. */
export type CoachStep =
  | { kind: "right" } // start with the right answer
  | { kind: "wrong"; left: number } // wrong answers the author anticipated, still to try
  | { kind: "other" } // only the unplanned answer is left
  | { kind: "done" };

export function coachStep(paths: ReviewPath[], seen: ReadonlySet<PathId>): CoachStep {
  const left = untried(paths, seen);
  if (left.length === 0) return { kind: "done" };
  if (left.some((p) => p.id === "right")) return { kind: "right" };
  const wrong = left.filter((p) => p.id.startsWith("wrong.")).length;
  return wrong > 0 ? { kind: "wrong", left: wrong } : { kind: "other" };
}
