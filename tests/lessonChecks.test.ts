import { describe, expect, it } from "vitest";
import { lessonProblems } from "../src/shared/lessonChecks.ts";
import type { Lesson } from "../src/shared/lesson.ts";
import { lesson } from "./fixture.ts";

describe("lessonProblems", () => {
  it("finds nothing wrong with the hand-written fixture", () => {
    expect(lessonProblems(lesson)).toEqual([]);
  });

  it("catches a right answer that isn't an option", () => {
    const l: Lesson = structuredClone(lesson);
    const c = l.modules[0].check!;
    if (c.type === "select") c.answer = "z";
    expect(lessonProblems(l).join()).toContain('the answer "z" is not one of the option ids');
  });

  it("catches a wrong-answer range that overlaps the right answer", () => {
    const l: Lesson = structuredClone(lesson);
    const c = l.modules[1].check!;
    if (c.type === "number") c.wrongAnswers[0].match = { min: 0.8, max: 0.9 };
    expect(lessonProblems(l).join()).toContain("overlaps the right answer");
  });

  it("catches unbalanced math delimiters", () => {
    const l: Lesson = structuredClone(lesson);
    l.modules[0].reading += " costs $5";
    expect(lessonProblems(l).join()).toContain("modules[0].reading: unbalanced $");
  });

  it("catches unbalanced math in a fallback, not only in readings", () => {
    const l: Lesson = structuredClone(lesson);
    l.modules[0].check!.generalFallback.reExplanation!.text += " $p";
    expect(lessonProblems(l).join()).toContain("generalFallback.reExplanation.text: unbalanced $");
  });

  it("catches a stray backslash before a quote", () => {
    const l: Lesson = structuredClone(lesson);
    l.modules[1].reading = 'the share who say \\"yes\\"';
    expect(lessonProblems(l).join()).toContain("stray backslash before a quote");
  });
});
