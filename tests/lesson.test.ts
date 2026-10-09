import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Lesson } from "../src/shared/lesson.ts";

const fixture = JSON.parse(
  readFileSync(new URL("../content/openintro-sampling/5.1-point-estimates.json", import.meta.url), "utf8"),
);

describe("lesson schema", () => {
  it("accepts the hand-written 5.1 fixture", () => {
    expect(Lesson.safeParse(fixture).success).toBe(true);
  });

  it("rejects a simpler question that carries fallbacks of its own (no third level)", () => {
    const lesson = structuredClone(fixture);
    lesson.modules[0].check.wrongAnswers[0].fallback.simplerQuestion = {
      enabled: true,
      check: {
        type: "select",
        prompt: "Is 0.887 from everyone, or from the people asked?",
        options: [
          { id: "a", text: "Everyone" },
          { id: "b", text: "The people asked" },
        ],
        answer: "b",
        generalFallback: { reExplanation: { enabled: true, text: "A third level." } },
      },
    };
    const result = Lesson.safeParse(lesson);
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain("generalFallback");
  });

  it("accepts the same simpler question without its own fallback", () => {
    const lesson = structuredClone(fixture);
    lesson.modules[0].check.wrongAnswers[0].fallback.simplerQuestion = {
      enabled: true,
      check: {
        type: "select",
        prompt: "Is 0.887 from everyone, or from the people asked?",
        options: [
          { id: "a", text: "Everyone" },
          { id: "b", text: "The people asked" },
        ],
        answer: "b",
      },
    };
    expect(Lesson.safeParse(lesson).success).toBe(true);
  });

  it("rejects a check without an explanation", () => {
    const lesson = structuredClone(fixture);
    delete lesson.modules[0].check.explanation;
    expect(Lesson.safeParse(lesson).success).toBe(false);
  });

  it("rejects a lesson without outcomes", () => {
    const lesson = structuredClone(fixture);
    lesson.outcomes = [];
    expect(Lesson.safeParse(lesson).success).toBe(false);
    delete lesson.outcomes;
    expect(Lesson.safeParse(lesson).success).toBe(false);
  });

  it("rejects a select check whose answer type is wrong", () => {
    const lesson = structuredClone(fixture);
    lesson.modules[0].check.answer = 2;
    expect(Lesson.safeParse(lesson).success).toBe(false);
  });
});
