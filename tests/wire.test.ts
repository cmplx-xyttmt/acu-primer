import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Lesson } from "../src/shared/lesson.ts";
import { WireLesson, keepSwitches, lessonFromWire, lessonToWire } from "../src/shared/wire.ts";
import { lesson as fixture } from "./fixture.ts";

const draft = Lesson.parse(
  JSON.parse(readFileSync(new URL("./fixtures/5.1-point-estimates-draft.json", import.meta.url), "utf8")),
);

// The wire format can't say "switched off" or carry simpler-question explanations, so compare
// with those normalised: every part on, no simpler-question explanation.
function normalise(l: Lesson): Lesson {
  const c = structuredClone(l);
  const fb = (f: { reExplanation?: { enabled: boolean }; simplerQuestion?: { enabled: boolean; check: { explanation?: string } } }) => {
    if (f.reExplanation) f.reExplanation.enabled = true;
    if (f.simplerQuestion) {
      f.simplerQuestion.enabled = true;
      delete f.simplerQuestion.check.explanation;
    }
  };
  for (const m of c.modules)
    if (m.check)
      for (const ch of [m.check, ...m.check.alternatives]) {
        ch.wrongAnswers.forEach((w) => fb(w.fallback));
        fb(ch.generalFallback);
      }
  return c;
}

describe("the wire format", () => {
  it("round-trips the hand-written fixture and the 5.1 draft (with alternatives)", () => {
    for (const l of [fixture, draft]) {
      const wire = WireLesson.parse(lessonToWire(l));
      const back = lessonFromWire(wire);
      expect(back.ok).toBe(true);
      if (back.ok) expect(back.lesson).toEqual(normalise(l));
    }
  });

  it("explains what's missing when a select check has no options", () => {
    const wire = lessonToWire(fixture);
    wire.modules[0].check!.options = null;
    const back = lessonFromWire(wire);
    expect(back.ok).toBe(false);
    if (!back.ok) expect(back.problems.join()).toContain('a select check needs "options" and "answerOption"');
  });

  it("keeps the author's switched-off parts through a revision", () => {
    const before = structuredClone(fixture.modules[0]);
    before.check!.wrongAnswers[0].fallback.reExplanation!.enabled = false;
    const after = structuredClone(fixture.modules[0]);
    after.reading += " (revised)";
    expect(keepSwitches(before, after).check!.wrongAnswers[0].fallback.reExplanation!.enabled).toBe(false);
  });
});
