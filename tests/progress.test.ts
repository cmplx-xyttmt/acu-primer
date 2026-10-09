import { describe, expect, it } from "vitest";
import {
  isComplete,
  isReached,
  passModule,
  resumeIndex,
  skipModule,
  type LessonProgress,
} from "../src/app/lib/progress.ts";

const ids = ["m1", "m2", "m3"];
const start: LessonProgress = { done: [], skipped: [], current: 0 };

describe("moving through a lesson", () => {
  it("resumes where the student stopped", () => {
    const p = passModule(start, "m1", 0);
    expect(resumeIndex(p, ids)).toBe(1);
    expect(isComplete(p, ids)).toBe(false);
  });

  it("re-reading an earlier module never moves the resume point back", () => {
    let p = passModule(passModule(start, "m1", 0), "m2", 1);
    p = passModule(p, "m1", 0);
    expect(p.current).toBe(2);
  });

  it("a skipped module is not passed, and the lesson isn't complete", () => {
    const p = passModule(passModule(skipModule(start, "m1", 0), "m2", 1), "m3", 2);
    expect(p.done).toEqual(["m2", "m3"]);
    expect(p.skipped).toEqual(["m1"]);
    expect(isComplete(p, ids)).toBe(false);
  });

  it("once at the end, Continue goes back to the first skipped module", () => {
    const p = skipModule(passModule(skipModule(start, "m1", 0), "m2", 1), "m3", 2);
    expect(resumeIndex(p, ids)).toBe(0);
    const later = passModule(p, "m1", 0);
    expect(later.skipped).toEqual(["m3"]);
    expect(resumeIndex(later, ids)).toBe(2);
  });

  it("passing every skipped module completes the lesson, and Continue starts it over", () => {
    let p = skipModule(passModule(passModule(start, "m1", 0), "m2", 1), "m3", 2);
    p = passModule(p, "m3", 2);
    expect(p.skipped).toEqual([]);
    expect(isComplete(p, ids)).toBe(true);
    expect(resumeIndex(p, ids)).toBe(0);
  });

  it("skipping a module already passed changes nothing", () => {
    const p = skipModule(passModule(start, "m1", 0), "m1", 0);
    expect(p.skipped).toEqual([]);
    expect(p.done).toEqual(["m1"]);
  });
});

describe("isReached", () => {
  it("opens modules up to where the student stopped, and locks the rest", () => {
    const p = passModule(start, "m1", 0);
    expect([0, 1, 2].map((i) => isReached(p, ids, i))).toEqual([true, true, false]);
  });

  it("keeps the last module reachable once the lesson's end is reached", () => {
    const p = passModule(passModule(passModule(start, "m1", 0), "m2", 1), "m3", 2);
    expect([0, 1, 2].map((i) => isReached(p, ids, i))).toEqual([true, true, true]);
  });

  it("on a first visit, only module 1 is open", () => {
    expect([0, 1, 2].map((i) => isReached(start, ids, i))).toEqual([true, false, false]);
  });
});
