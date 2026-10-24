import { describe, expect, it } from "vitest";
import { grade } from "../src/shared/grading.ts";
import { coachStep, pathOf, reviewPaths, untried, type PathId } from "../src/shared/reviewPaths.ts";
import { check } from "./fixture.ts";

describe("reviewPaths", () => {
  it("lists the right answer, each anticipated wrong answer, then any other answer", () => {
    const c = check("m5");
    const paths = reviewPaths(c);
    expect(paths.map((p) => p.id)).toEqual(["right", ...c.wrongAnswers.map((_, i) => `wrong.${i}`), "other"]);
    expect(paths[0].label).toMatch(/^Picks ".+" \(right\)$/);
    expect(paths[1].label).toMatch(/^Picks "/);
  });

  it("has no unplanned path when every option of a select check is planned for", () => {
    const c = check("m1");
    expect(reviewPaths(c).map((p) => p.id)).toEqual(["right", ...c.wrongAnswers.map((_, i) => `wrong.${i}`)]);
  });

  it("names a number check's wrong answers by their range", () => {
    const paths = reviewPaths(check("m2"));
    const w = check("m2").wrongAnswers[0].match as { min: number; max: number };
    expect(paths[1].label).toBe(w.min === w.max ? `Types ${w.min}` : `Types ${w.min} to ${w.max}`);
    expect(paths[0].label).toMatch(/^Types .+ \(right, ± .+\)$/);
  });
});

describe("pathOf", () => {
  it("maps each grade to its path", () => {
    expect(pathOf(grade(check("m1"), { type: "select", optionId: "b" }))).toBe("right");
    expect(pathOf(grade(check("m1"), { type: "select", optionId: "c" }))).toBe("wrong.1");
    expect(pathOf(grade(check("m5"), { type: "select", optionId: "d" }))).toBe("other");
    expect(pathOf(grade(check("m2"), { type: "number", value: 7 }))).toBe("other");
  });
});

describe("untried and coachStep", () => {
  const paths = reviewPaths(check("m5"));
  const wrongs = paths.filter((p) => p.id.startsWith("wrong.")).length;

  it("starts with the right answer", () => {
    expect(coachStep(paths, new Set())).toEqual({ kind: "right" });
    expect(untried(paths, new Set())).toHaveLength(paths.length);
  });

  it("then counts down the anticipated wrong answers", () => {
    expect(coachStep(paths, new Set<PathId>(["right"]))).toEqual({ kind: "wrong", left: wrongs });
    expect(coachStep(paths, new Set<PathId>(["right", "wrong.0"]))).toEqual({ kind: "wrong", left: wrongs - 1 });
  });

  it("asks for the unplanned answer last, then is done", () => {
    const allButOther = new Set(paths.filter((p) => p.id !== "other").map((p) => p.id));
    expect(coachStep(paths, allButOther)).toEqual({ kind: "other" });
    expect(coachStep(paths, new Set([...allButOther, "other" as const]))).toEqual({ kind: "done" });
    expect(untried(paths, new Set([...allButOther, "other" as const]))).toEqual([]);
  });

  it("still asks for the right answer if the author tried the wrong ones first", () => {
    expect(coachStep(paths, new Set<PathId>(["wrong.0", "other"]))).toEqual({ kind: "right" });
  });
});
