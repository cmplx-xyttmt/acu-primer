// The author's direct edits to a lesson (slice 6), pure so they're tested directly. Each takes a
// lesson and returns a new one, or an error in plain words.

import type { Lesson, Module } from "./lesson.ts";

export type EditResult = { ok: true; lesson: Lesson } | { ok: false; error: string };

function withModule(lesson: Lesson, moduleId: string, change: (m: Module) => Module | string): EditResult {
  const i = lesson.modules.findIndex((m) => m.id === moduleId);
  if (i < 0) return { ok: false, error: "No module with that id in this lesson." };
  const next = change(structuredClone(lesson.modules[i]));
  if (typeof next === "string") return { ok: false, error: next };
  return { ok: true, lesson: { ...lesson, modules: lesson.modules.map((m, j) => (j === i ? next : m)) } };
}

/** Put an alternative in the check's place. The old check becomes an alternative, so nothing
 *  is lost and the author can swap back. */
export function swapAlternative(lesson: Lesson, moduleId: string, alternativeId: string): EditResult {
  return withModule(lesson, moduleId, (m) => {
    if (!m.check) return "This module has no check.";
    const alt = m.check.alternatives.find((a) => a.id === alternativeId);
    if (!alt) return "No alternative with that id on this check.";
    const { alternatives, ...current } = m.check;
    const others = alternatives.filter((a) => a.id !== alternativeId);
    m.check = { ...alt, alternatives: [current, ...others] } as Module["check"] & object;
    return m;
  });
}

export type FallbackRef = number | "general"; // a wrong answer's index, or the general fallback

/** Switch a fallback part (the re-explanation or the simpler question) on or off. */
export function setFallbackPart(
  lesson: Lesson,
  moduleId: string,
  which: FallbackRef,
  part: "reExplanation" | "simplerQuestion",
  enabled: boolean,
): EditResult {
  return withModule(lesson, moduleId, (m) => {
    if (!m.check) return "This module has no check.";
    const fallback = which === "general" ? m.check.generalFallback : m.check.wrongAnswers[which]?.fallback;
    if (!fallback) return "No wrong answer at that position.";
    const target = fallback[part];
    if (!target) return `That fallback has no ${part === "reExplanation" ? "re-explanation" : "simpler question"}.`;
    target.enabled = enabled;
    return m;
  });
}

/** Which parts of a module differ between two versions, in the review screen's words. */
export function changedParts(before: Module | undefined, after: Module): string[] {
  if (!before) return ["the whole module"];
  const parts: string[] = [];
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  if (before.title !== after.title) parts.push("title");
  if (before.reading !== after.reading) parts.push("reading");
  const b = before.check;
  const a = after.check;
  if (!b || !a) {
    if (!same(b, a)) parts.push("check");
    return parts;
  }
  const { explanation: be, wrongAnswers: bw, generalFallback: bg, alternatives: ba, ...bCore } = b;
  const { explanation: ae, wrongAnswers: aw, generalFallback: ag, alternatives: aa, ...aCore } = a;
  if (!same(bCore, aCore)) parts.push("check");
  if (be !== ae) parts.push("explanation");
  const n = Math.max(bw.length, aw.length);
  for (let i = 0; i < n; i++) if (!same(bw[i], aw[i])) parts.push(`wrong answer ${i + 1}`);
  if (!same(bg, ag)) parts.push("general fallback");
  if (!same(ba, aa)) parts.push("alternatives");
  return parts;
}
