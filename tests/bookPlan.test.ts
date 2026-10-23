import { describe, expect, it } from "vitest";
import { NewBook, pageOffset, planFromContents, planFromOutline, sectionsOverview, type OutlineItem } from "../src/shared/bookPlan.ts";

const o = (title: string, page: number | null, children: OutlineItem[] = []): OutlineItem => ({ title, page, children });

// Shaped like OpenIntro Statistics' bookmarks (PDF pages, not printed ones).
const openintro = [
  o("Contents", 3),
  o("Preface", 5),
  o("1 Introduction to data", 7, [o("1.1 Case study", 9), o("1.2 Data basics", 12), o("1.3 Sampling", 22)]),
  o("2 Summarizing data", 39, [o("2.1 Numerical data", 41), o("2.2 Categorical data", 61)]),
  o("Index", 420),
];

describe("planFromOutline", () => {
  it("makes chapters with sections and page ranges that end where the next begins", () => {
    const plan = planFromOutline(openintro, 422);
    expect(plan.map((c) => [c.title, c.pages, c.likelyChapter])).toEqual([
      ["Contents", "3-4", false],
      ["Preface", "5-6", false],
      ["1 Introduction to data", "7-38", true],
      ["2 Summarizing data", "39-419", true],
      ["Index", "420-422", false],
    ]);
    expect(plan[2].sections).toEqual([
      { title: "1.1 Case study", pages: "9-11" },
      { title: "1.2 Data basics", pages: "12-21" },
      { title: "1.3 Sampling", pages: "22-38" },
    ]);
  });

  it("looks inside a single top-level bookmark and flattens parts", () => {
    const book = [o("The Book", 1, [o("Part I", 2, [o("Ch 1", 3), o("Ch 2", 10)]), o("Part II", 20, [o("Ch 3", 21)])])];
    expect(planFromOutline(book, 30).map((c) => [c.title, c.pages])).toEqual([
      ["Ch 1", "3-9"],
      ["Ch 2", "10-20"],
      ["Ch 3", "21-30"],
    ]);
  });

  it("skips bookmarks without a page, and copes with one-page sections", () => {
    const plan = planFromOutline([o("A", 1, [o("A.1", 1), o("A.2", null), o("A.3", 2)]), o("B", 3)], 3);
    expect(plan[0].sections).toEqual([
      { title: "A.1", pages: "1" },
      { title: "A.3", pages: "2" },
    ]);
  });

  it("leaves out exercise sections and unticks lettered appendices", () => {
    const plan = planFromOutline([o("1 Data", 1, [o("1.1 Basics", 1), o("1.5 Exercises", 4), o("Review Questions", 5)]), o("A Exercise solutions", 6), o("A Tour of Python", 8)], 9);
    expect(plan[0].sections.map((s) => s.title)).toEqual(["1.1 Basics"]);
    expect(plan.map((c) => c.likelyChapter)).toEqual([true, false, false]);
    expect(planFromOutline([o("A Tour of Python", 1), o("Basics", 3)], 5)[0].likelyChapter).toBe(true);
  });

  it("returns nothing for a PDF without bookmarks", () => {
    expect(planFromOutline([], 100)).toEqual([]);
  });
});

it("writes a plain overview from the sections, and the request shape checks", () => {
  expect(sectionsOverview([{ title: "5.1 Point estimates", pages: "170-180" }, { title: "5.2 Confidence intervals", pages: "181-188" }])).toBe(
    "Covers Point estimates; Confidence intervals.",
  );
  const ok = NewBook.safeParse({
    subject: { title: "OpenIntro Statistics", overview: "", brief: "" },
    book: { title: "OpenIntro Statistics", fileName: "os4.pdf", size: 10, pageCount: 422 },
    chapters: [{ title: "1 Introduction to data", overview: "", plan: { pages: "7-38", sections: [{ title: "1.1", pages: "9-11" }] } }],
  });
  expect(ok.success).toBe(true);
});

describe("from contents pages", () => {
  const contents = {
    chapters: [
      { title: "Preface", printedPage: null, sections: [] },
      { title: "5 Foundations for inference", printedPage: 168, sections: [{ title: "5.1 Point estimates", printedPage: 170 }, { title: "5.2 Confidence intervals", printedPage: 181 }] },
      { title: "6 Inference for categorical data", printedPage: 206, sections: [{ title: "6.1 A single proportion", printedPage: 208 }] },
    ],
  };
  it("finds the printed-to-PDF page gap from matching bookmarks", () => {
    const outline = [o("5 Foundations for inference", 180), o("6 Inference for categorical data", 218)];
    expect(pageOffset(contents, outline)).toBe(12);
    expect(pageOffset(contents, [])).toBeNull();
  });
  it("turns printed pages into PDF page ranges", () => {
    const plan = planFromContents(contents, 12, 422);
    expect(plan.map((c) => [c.title, c.pages])).toEqual([
      ["5 Foundations for inference", "180-217"],
      ["6 Inference for categorical data", "218-422"],
    ]);
    expect(plan[0].sections).toEqual([
      { title: "5.1 Point estimates", pages: "182-192" },
      { title: "5.2 Confidence intervals", pages: "193-217" },
    ]);
  });
});
