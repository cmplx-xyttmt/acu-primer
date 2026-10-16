import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { afterMainAnswer } from "../src/shared/flow.ts";
import { Lesson } from "../src/shared/lesson.ts";
import { lessonProblems } from "../src/shared/lessonChecks.ts";
import { changedParts, setFallbackPart, swapAlternative } from "../src/shared/lessonEdits.ts";

const draft = Lesson.parse(
  JSON.parse(readFileSync(new URL("../content/openintro-sampling/5.1-point-estimates-draft.json", import.meta.url), "utf8")),
);

describe("swapAlternative", () => {
  it("puts the alternative in place and keeps the old check as an alternative", () => {
    const r = swapAlternative(draft, "m1", "c1a");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const check = r.lesson.modules[0].check!;
    expect(check.id).toBe("c1a");
    expect(check.alternatives.map((a) => a.id)).toEqual(["c1"]);
    expect(lessonProblems(r.lesson)).toEqual([]);
    // and back again
    const back = swapAlternative(r.lesson, "m1", "c1");
    expect(back.ok && back.lesson.modules[0].check!.id).toBe("c1");
  });

  it("refuses an unknown alternative", () => {
    expect(swapAlternative(draft, "m1", "nope")).toEqual({ ok: false, error: "No alternative with that id on this check." });
  });
});

describe("setFallbackPart", () => {
  it("switches a re-explanation off, and the player then skips it", () => {
    const r = setFallbackPart(draft, "m1", 0, "reExplanation", false);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const check = r.lesson.modules[0].check!;
    const step = afterMainAnswer(check, { kind: "known-wrong", index: 0 }, "main");
    expect(step.kind === "fallback" && step.reExplanation).toBeUndefined();
    expect(step.kind === "fallback" && step.simplerQuestion).toBeDefined();
  });

  it("explains when the part doesn't exist", () => {
    const r = setFallbackPart(draft, "m1", 1, "simplerQuestion", false);
    expect(r).toEqual({ ok: false, error: "That fallback has no simpler question." });
  });
});

describe("changedParts", () => {
  it("names exactly the parts that changed", () => {
    const before = draft.modules[1];
    const after = structuredClone(before);
    after.reading += " More.";
    after.check!.wrongAnswers[1].fallback.reExplanation!.text += " More.";
    expect(changedParts(before, after)).toEqual(["reading", "wrong answer 2"]);
  });
});
