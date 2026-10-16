// The flat "wire" format Claude writes lessons in, and the converters to and from the lesson
// format the rest of the app uses.
//
// Why a second format: structured outputs compile the JSON Schema into a grammar, and the
// lesson schema is too big for it ("The compiled grammar is too large", found in slice 3b).
// Two things multiply the grammar: optional fields, and either-or shapes (a check is a select
// OR a number). The wire format has neither: every field is always present, with null for
// "not used", and a check has both answerOption and answerNumber, one of them null.
// The converter turns a wire lesson into a lesson, or says what's wrong so Claude can retry.

import { z } from "zod";
import type { AlternativeCheck, Check, Fallback, Lesson, Misconception, Module, SimpleCheck } from "./lesson.ts";

const text = z.string();

const WireMisconception = z.strictObject({
  text,
  source: z.strictObject({ kind: z.enum(["catalogue", "model"]), reference: text.nullable() }),
});

const WireSimpleCheck = z.strictObject({
  type: z.enum(["select", "number"]),
  prompt: text,
  options: z.array(z.strictObject({ id: text, text })).nullable(), // select only
  answerOption: text.nullable(), // select only: the right option's id
  answerNumber: z.number().nullable(), // number only
  tolerance: z.number().nullable(), // number only
  unit: text.nullable(), // number only, optional
});

const WireFallback = z.strictObject({
  reExplanation: text.nullable(),
  simplerQuestion: WireSimpleCheck.nullable(),
});

const WireWrongAnswer = z.strictObject({
  optionId: text.nullable(), // select: the wrong option
  min: z.number().nullable(), // number: the wrong value's range
  max: z.number().nullable(),
  misconception: WireMisconception,
  fallback: WireFallback,
});

export const WireCheck = WireSimpleCheck.extend({
  id: text,
  explanation: text,
  wrongAnswers: z.array(WireWrongAnswer),
  generalFallback: WireFallback,
});

export const WireModule = z.strictObject({
  id: text,
  title: text,
  reading: text,
  check: WireCheck.nullable(),
  alternatives: z.array(WireCheck), // empty when the module has no check
});

export const WireLesson = z.strictObject({
  id: text,
  title: text,
  source: z.strictObject({ book: text, pages: text }),
  outcomes: z.array(text),
  modules: z.array(WireModule),
});

export type WireCheck = z.infer<typeof WireCheck>;
export type WireModule = z.infer<typeof WireModule>;
export type WireLesson = z.infer<typeof WireLesson>;

/** Appended to the drafting rules: how the wire format's fields are used. */
export const WIRE_NOTES = `How to fill in the JSON format:
- Every field is always present. Use null for a field that doesn't apply.
- A "select" check fills "options" and "answerOption" (the right option's id) and sets "answerNumber", "tolerance" and "unit" to null.
- A "number" check fills "answerNumber" and "tolerance" (and "unit", or null) and sets "options" and "answerOption" to null.
- A wrong answer on a select check fills "optionId" and sets "min" and "max" to null; on a number check it fills "min" and "max" and sets "optionId" to null.
- A misconception from the catalogue has source {"kind": "catalogue", "reference": <the entry's reference>}; your own has {"kind": "model", "reference": null}.
- A fallback's "reExplanation" or "simplerQuestion" is null when there isn't one.
- A module without a check has "check": null and "alternatives": [].`;

// --- wire → lesson ----------------------------------------------------------------------

type Problems = string[];

function simple(w: z.infer<typeof WireSimpleCheck>, where: string, p: Problems): SimpleCheck | null {
  if (w.type === "select") {
    if (!w.options || w.answerOption === null) {
      p.push(`${where}: a select check needs "options" and "answerOption"`);
      return null;
    }
    return { type: "select", prompt: w.prompt, options: w.options, answer: w.answerOption };
  }
  if (w.answerNumber === null || w.tolerance === null) {
    p.push(`${where}: a number check needs "answerNumber" and "tolerance"`);
    return null;
  }
  return {
    type: "number",
    prompt: w.prompt,
    answer: w.answerNumber,
    tolerance: w.tolerance,
    ...(w.unit ? { unit: w.unit } : {}),
  };
}

function misconception(w: z.infer<typeof WireMisconception>): Misconception {
  return {
    text: w.text,
    source: w.source.kind === "catalogue" && w.source.reference ? { kind: "catalogue", reference: w.source.reference } : { kind: "model" },
  };
}

function fallback(w: z.infer<typeof WireFallback>, where: string, p: Problems): Fallback {
  const f: Fallback = {};
  if (w.reExplanation) f.reExplanation = { enabled: true, text: w.reExplanation };
  if (w.simplerQuestion) {
    const s = simple(w.simplerQuestion, `${where} simpler question`, p);
    if (s) f.simplerQuestion = { enabled: true, check: s };
  }
  return f;
}

function check(w: WireCheck, where: string, p: Problems): AlternativeCheck | null {
  const base = simple(w, where, p);
  if (!base) return null;
  const general = fallback(w.generalFallback, `${where} general fallback`, p);
  if (base.type === "select") {
    const wrongAnswers = w.wrongAnswers.flatMap((a, i) => {
      if (a.optionId === null) {
        p.push(`${where} wrong answer ${i + 1}: a select check's wrong answer needs "optionId"`);
        return [];
      }
      return [{ match: { optionId: a.optionId }, misconception: misconception(a.misconception), fallback: fallback(a.fallback, `${where} wrong answer ${i + 1}`, p) }];
    });
    return { id: w.id, ...base, explanation: w.explanation, wrongAnswers, generalFallback: general };
  }
  const wrongAnswers = w.wrongAnswers.flatMap((a, i) => {
    if (a.min === null || a.max === null) {
      p.push(`${where} wrong answer ${i + 1}: a number check's wrong answer needs "min" and "max"`);
      return [];
    }
    return [{ match: { min: a.min, max: a.max }, misconception: misconception(a.misconception), fallback: fallback(a.fallback, `${where} wrong answer ${i + 1}`, p) }];
  });
  return { id: w.id, ...base, explanation: w.explanation, wrongAnswers, generalFallback: general };
}

export function moduleFromWire(w: WireModule, p: Problems): Module {
  const m: Module = { id: w.id, title: w.title, reading: w.reading };
  if (w.check) {
    const c = check(w.check, `module ${w.id} check`, p);
    const alternatives = w.alternatives.flatMap((a) => {
      const alt = check(a, `module ${w.id} alternative ${a.id}`, p);
      return alt ? [alt] : [];
    });
    if (c) m.check = { ...c, alternatives } as Check;
  }
  return m;
}

export function lessonFromWire(w: WireLesson): { ok: true; lesson: Lesson } | { ok: false; problems: Problems } {
  const problems: Problems = [];
  const lesson: Lesson = {
    id: w.id,
    title: w.title,
    source: w.source,
    outcomes: w.outcomes,
    modules: w.modules.map((m) => moduleFromWire(m, problems)),
  };
  return problems.length === 0 ? { ok: true, lesson } : { ok: false, problems };
}

// --- lesson → wire (for sending a lesson back to Claude, and for the round-trip test) ----

function simpleToWire(c: SimpleCheck): z.infer<typeof WireSimpleCheck> {
  return c.type === "select"
    ? { type: "select", prompt: c.prompt, options: c.options, answerOption: c.answer, answerNumber: null, tolerance: null, unit: null }
    : { type: "number", prompt: c.prompt, options: null, answerOption: null, answerNumber: c.answer, tolerance: c.tolerance, unit: c.unit ?? null };
}

function fallbackToWire(f: Fallback): z.infer<typeof WireFallback> {
  return {
    reExplanation: f.reExplanation?.text ?? null,
    simplerQuestion: f.simplerQuestion ? simpleToWire(f.simplerQuestion.check) : null,
  };
}

function checkToWire(c: Check | AlternativeCheck): WireCheck {
  return {
    ...simpleToWire(c),
    id: c.id,
    explanation: c.explanation,
    wrongAnswers: c.wrongAnswers.map((a) => ({
      optionId: "optionId" in a.match ? a.match.optionId : null,
      min: "min" in a.match ? a.match.min : null,
      max: "max" in a.match ? a.match.max : null,
      misconception: {
        text: a.misconception.text,
        source: a.misconception.source.kind === "catalogue" ? { kind: "catalogue", reference: a.misconception.source.reference } : { kind: "model", reference: null },
      },
      fallback: fallbackToWire(a.fallback),
    })),
    generalFallback: fallbackToWire(c.generalFallback),
  };
}

export function moduleToWire(m: Module): WireModule {
  return {
    id: m.id,
    title: m.title,
    reading: m.reading,
    check: m.check ? checkToWire(m.check) : null,
    alternatives: m.check ? m.check.alternatives.map(checkToWire) : [],
  };
}

export function lessonToWire(l: Lesson): WireLesson {
  return { id: l.id, title: l.title, source: l.source, outcomes: l.outcomes, modules: l.modules.map(moduleToWire) };
}

/**
 * After a revision, keep the author's on/off switches: a fallback part the author switched off
 * stays off in the revised module wherever the same wrong answer (same position) still has it.
 */
export function keepSwitches(before: Module, after: Module): Module {
  if (!before.check || !after.check) return after;
  const copy = (from: Fallback, to: Fallback) => {
    if (from.reExplanation && to.reExplanation) to.reExplanation.enabled = from.reExplanation.enabled;
    if (from.simplerQuestion && to.simplerQuestion) to.simplerQuestion.enabled = from.simplerQuestion.enabled;
  };
  const next = structuredClone(after);
  before.check.wrongAnswers.forEach((w, i) => {
    const target = next.check!.wrongAnswers[i];
    if (target) copy(w.fallback, target.fallback);
  });
  copy(before.check.generalFallback, next.check!.generalFallback);
  return next;
}
