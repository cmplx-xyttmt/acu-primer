import { describe, expect, it } from "vitest";
import { evaluate, FormulaError, parseFormula } from "../src/shared/formula.ts";
import { grade } from "../src/shared/grading.ts";
import { Check, Explore, Lesson, type Module } from "../src/shared/lesson.ts";
import { exploreProblems, lessonProblems } from "../src/shared/lessonChecks.ts";
import { setExplore } from "../src/shared/lessonEdits.ts";
import { reviewPaths } from "../src/shared/reviewPaths.ts";
import { WireLesson, lessonFromWire, lessonToWire } from "../src/shared/wire.ts";
import { lesson as fixture } from "./fixture.ts";

const misc = { text: "Thinks bias shrinks with a bigger sample.", source: { kind: "model" as const } };
const sortCheck = Check.parse({
  id: "c-sort",
  type: "sort",
  prompt: "Sort each error.",
  categories: [
    { id: "samp", label: "Sampling error" },
    { id: "bias", label: "Bias" },
  ],
  items: [
    { id: "a", text: "A leading question", category: "bias" },
    { id: "b", text: "Luck of the draw", category: "samp" },
    { id: "c", text: "Only asking people online", category: "bias" },
  ],
  explanation: "Bias pushes every sample the same way.",
  wrongAnswers: [{ match: { itemId: "a", categoryId: "samp" }, misconception: misc, fallback: { reExplanation: { enabled: true, text: "More people, same lean." } } }],
  generalFallback: {},
  alternatives: [],
});

const formulaExplore = Explore.parse({
  enabled: true,
  why: "The student changes n and sees the standard error shrink with its square root.",
  prompt: "Change the sample size.",
  prediction: { prompt: "If n is four times bigger, the standard error…", options: [{ id: "half", text: "halves" }, { id: "quarter", text: "is a quarter" }], answer: "half" },
  thinkAbout: "n sits under a square root.",
  notice: "Four times the sample, half the error.",
  widget: {
    kind: "formula",
    inputs: [
      { id: "p", label: "p", values: [0.5, 0.88], start: 0.88 },
      { id: "n", label: "n", values: [100, 400, 1600], start: 100 },
    ],
    expression: "sqrt(p * (1 - p) / n)",
    result: { label: "Standard error", decimals: 4 },
    plotOver: "n",
  },
});

describe("formula", () => {
  it("evaluates arithmetic, powers, functions and constants", () => {
    const t = parseFormula("sqrt(p * (1 - p) / n) + 2^3 - -1 + max(1, 2) * pi * 0", ["p", "n"]);
    expect(evaluate(t, { p: 0.5, n: 100 })).toBeCloseTo(0.05 + 8 + 1 + 0);
  });
  it("refuses anything that isn't arithmetic on the inputs", () => {
    for (const bad of ["alert(1)", "p.constructor", "n; 1", "q + 1", "[1]", "p = 2", "`x`", "fetch('/')"])
      expect(() => parseFormula(bad, ["p", "n"])).toThrow(FormulaError);
  });
});

describe("sort checks", () => {
  it("grades all-right, a known misplacement, and an unplanned one", () => {
    expect(grade(sortCheck, { type: "sort", placements: { a: "bias", b: "samp", c: "bias" } })).toEqual({ kind: "right" });
    expect(grade(sortCheck, { type: "sort", placements: { a: "samp", b: "samp", c: "bias" } })).toEqual({ kind: "known-wrong", index: 0 });
    expect(grade(sortCheck, { type: "sort", placements: { a: "bias", b: "bias", c: "bias" } })).toEqual({ kind: "unplanned" });
  });
  it("names the paths for review", () => {
    expect(reviewPaths(sortCheck).map((p) => p.label)).toEqual([
      "Sorts every item into its category (right)",
      'Puts "A leading question" in "Sampling error"',
      "Any other answer",
    ]);
  });
});

describe("exploration checks", () => {
  it("passes a working formula exploration", () => {
    expect(exploreProblems(formulaExplore, "x")).toEqual([]);
  });
  it("flags a formula that can't be read, an input that does nothing, and a bad answer", () => {
    const e = structuredClone(formulaExplore);
    e.prediction.answer = "third";
    if (e.widget.kind !== "formula") throw new Error();
    e.widget.expression = "sqrt(p * (1 - p) / 100)"; // n no longer matters
    const problems = exploreProblems(e, "x");
    expect(problems.join("\n")).toMatch(/answer "third"/);
    expect(problems.join("\n")).toMatch(/changing "n" never changes the result/);
    e.widget.expression = "sqrt(p *";
    expect(exploreProblems(e, "x").join("\n")).toMatch(/can't be read/);
  });
  it("needs one scenario outcome per combination", () => {
    const e = Explore.parse({
      ...formulaExplore,
      widget: {
        kind: "scenarios",
        inputs: [{ id: "flood", label: "Nile flood", options: [{ id: "low", label: "Low" }, { id: "high", label: "High" }] }],
        outcomes: [{ when: { flood: "low" }, text: "A poor harvest." }, { when: { flood: "low" }, text: "Again." }],
      },
    });
    const p = exploreProblems(e, "x").join("\n");
    expect(p).toMatch(/no outcome for flood=high/);
    expect(p).toMatch(/more than one outcome for flood=low/);
  });
});

describe("lessons with explorations and sort checks", () => {
  const withNew: Lesson = {
    ...fixture,
    modules: [{ ...fixture.modules[0], explore: formulaExplore, check: sortCheck } as Module, ...fixture.modules.slice(1)],
  };
  it("pass the lesson checks, and count an exploration as something to do", () => {
    expect(lessonProblems(withNew)).toEqual([]);
  });
  it("round-trip through the wire format", () => {
    const wire = WireLesson.parse(lessonToWire(withNew));
    const back = lessonFromWire(wire);
    expect(back.ok && back.lesson).toEqual(withNew);
  });
  it("report a broken exploration from Claude in words it can fix", () => {
    const wire = lessonToWire(withNew);
    wire.modules[0].exploreJson = JSON.stringify({ why: "x" });
    const back = lessonFromWire(wire);
    expect(back.ok).toBe(false);
    if (!back.ok) expect(back.problems.join("\n")).toMatch(/module .* exploration (prompt|prediction|widget)/);
  });
  it("can switch an exploration off", () => {
    const r = setExplore(withNew, withNew.modules[0].id, false);
    expect(r.ok && r.lesson.modules[0].explore?.enabled).toBe(false);
  });
});
