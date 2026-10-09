import { describe, expect, it } from "vitest";
import { afterMainAnswer, afterSimplerAnswer, type Step } from "../src/shared/flow.ts";
import { grade } from "../src/shared/grading.ts";
import type { Check } from "../src/shared/lesson.ts";
import { check, lesson } from "./fixture.ts";

describe("afterMainAnswer", () => {
  it("moves on after a right answer, at either level", () => {
    expect(afterMainAnswer(check("m1"), { kind: "right" }, "main")).toEqual({ kind: "move-on" });
    expect(afterMainAnswer(check("m1"), { kind: "right" }, "fallback")).toEqual({ kind: "move-on" });
  });

  it("shows the fallback written for a known wrong option, with both parts in order", () => {
    const step = afterMainAnswer(check("m1"), grade(check("m1"), { type: "select", optionId: "a" }), "main");
    expect(step).toMatchObject({
      kind: "fallback",
      reason: "known",
      wrongAnswerIndex: 0,
      misconception: "Treats a number computed from a sample as the population parameter.",
    });
    expect(step.kind === "fallback" && step.reExplanation).toContain("describes **everyone**");
    expect(step.kind === "fallback" && step.simplerQuestion?.prompt).toBe("Where did the number 0.887 come from?");
  });

  it("shows the general fallback for an unplanned number", () => {
    const step = afterMainAnswer(check("m2"), grade(check("m2"), { type: "number", value: 7 }), "main");
    expect(step).toMatchObject({ kind: "fallback", reason: "unplanned" });
    expect(step.kind === "fallback" && step.reExplanation).toContain("Find $x$");
  });

  it("uses the general fallback when the author switched off both parts of a known one", () => {
    const c: Check = structuredClone(check("m1"));
    c.wrongAnswers[1].fallback.reExplanation!.enabled = false;
    const step = afterMainAnswer(c, { kind: "known-wrong", index: 1 }, "main");
    expect(step).toMatchObject({ kind: "fallback", reason: "unplanned" });
  });

  it("leaves out a part the author switched off", () => {
    const c: Check = structuredClone(check("m1"));
    c.wrongAnswers[0].fallback.simplerQuestion!.enabled = false;
    const step = afterMainAnswer(c, { kind: "known-wrong", index: 0 }, "main");
    expect(step).toMatchObject({ kind: "fallback", reason: "known" });
    expect(step.kind === "fallback" && step.simplerQuestion).toBeUndefined();
  });

  it("suggests going back through the material after a wrong retry", () => {
    expect(afterMainAnswer(check("m1"), { kind: "known-wrong", index: 0 }, "fallback")).toEqual({ kind: "material" });
    expect(afterMainAnswer(check("m2"), { kind: "unplanned" }, "fallback")).toEqual({ kind: "material" });
  });
});

describe("afterSimplerAnswer", () => {
  it("sends a right answer back to the original question and a wrong one to the material", () => {
    expect(afterSimplerAnswer(true)).toBe("retry-main");
    expect(afterSimplerAnswer(false)).toBe("material");
  });
});

describe("no third level", () => {
  // Walk every wrong answer of every check in the fixture through the worst case: wrong at
  // the main level, wrong on the simpler question (or the retry). Every path must end at
  // "material" within two steps, and no simpler question may carry fallbacks of its own.
  it("ends every wrong path at the material suggestion within two levels", () => {
    for (const mod of lesson.modules) {
      if (!mod.check) continue;
      const grades = [
        ...mod.check.wrongAnswers.map((_, index) => ({ kind: "known-wrong" as const, index })),
        { kind: "unplanned" as const },
      ];
      for (const g of grades) {
        const first: Step = afterMainAnswer(mod.check, g, "main");
        expect(first.kind).toBe("fallback");
        if (first.kind !== "fallback") continue;
        if (first.simplerQuestion) {
          expect(first.simplerQuestion).not.toHaveProperty("wrongAnswers");
          expect(first.simplerQuestion).not.toHaveProperty("generalFallback");
          expect(afterSimplerAnswer(false)).toBe("material");
        }
        expect(afterMainAnswer(mod.check, g, "fallback")).toEqual({ kind: "material" });
      }
    }
  });
});
