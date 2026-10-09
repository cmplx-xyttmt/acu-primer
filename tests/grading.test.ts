import { describe, expect, it } from "vitest";
import { grade } from "../src/shared/grading.ts";
import { check } from "./fixture.ts";

describe("grade", () => {
  it("marks the right option right", () => {
    expect(grade(check("m1"), { type: "select", optionId: "b" })).toEqual({ kind: "right" });
  });

  it("recognises a known wrong option", () => {
    expect(grade(check("m1"), { type: "select", optionId: "c" })).toEqual({ kind: "known-wrong", index: 1 });
  });

  it("treats a wrong option nobody anticipated as unplanned", () => {
    expect(grade(check("m5"), { type: "select", optionId: "d" })).toEqual({ kind: "unplanned" });
  });

  it("accepts a number within the tolerance", () => {
    expect(grade(check("m2"), { type: "number", value: 0.86 })).toEqual({ kind: "right" });
    expect(grade(check("m4"), { type: "number", value: 0.01 })).toEqual({ kind: "right" });
    expect(grade(check("m4"), { type: "number", value: 0.0103 })).toEqual({ kind: "right" });
  });

  it("recognises a known wrong number by its range, including at the rounding the prompt asks for", () => {
    expect(grade(check("m2"), { type: "number", value: 43 })).toEqual({ kind: "known-wrong", index: 0 });
    // m4 asks for three decimals; forgetting the square root rounds to 0.000.
    expect(grade(check("m4"), { type: "number", value: 0 })).toEqual({ kind: "known-wrong", index: 0 });
    expect(grade(check("m4"), { type: "number", value: 0.03 })).toEqual({ kind: "known-wrong", index: 1 });
  });

  it("treats an unexpected number as unplanned", () => {
    expect(grade(check("m2"), { type: "number", value: 7 })).toEqual({ kind: "unplanned" });
  });

  it("grades a simpler question as right or unplanned only", () => {
    const simpler = check("m2").wrongAnswers[0].fallback.simplerQuestion!.check;
    expect(grade(simpler, { type: "number", value: 0.7 })).toEqual({ kind: "right" });
    expect(grade(simpler, { type: "number", value: 7 })).toEqual({ kind: "unplanned" });
  });
});
