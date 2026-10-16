import { describe, expect, it } from "vitest";
import { OUTCOMES_STEP, canApprove, reviewState, reviewSteps, stepContent, type Suggestion } from "../src/shared/review.ts";
import { lesson } from "./fixture.ts";

const allSteps = () => new Set(reviewSteps(lesson).map((s) => s.id));
const suggestion = (stepId: string, status: Suggestion["status"] = "open"): Suggestion => ({
  id: `s-${stepId}-${status}`,
  lessonId: lesson.id,
  stepId,
  part: "reading",
  partLabel: "Reading",
  text: "Say what n is here.",
  status,
  note: null,
  createdAt: "2026-10-16T10:00:00Z",
  resolvedAt: null,
});

describe("review steps", () => {
  it("starts with the outcomes, then one step per module", () => {
    const steps = reviewSteps(lesson);
    expect(steps[0].id).toBe(OUTCOMES_STEP);
    expect(steps.length).toBe(lesson.modules.length + 1);
    expect(stepContent(lesson, OUTCOMES_STEP)).toEqual(lesson.outcomes);
    expect(stepContent(lesson, "m2")).toEqual(lesson.modules[1]);
  });
});

describe("reviewState", () => {
  it("refuses sign-off until every step is approved", () => {
    const approved = allSteps();
    approved.delete("m3");
    const state = reviewState(lesson, approved, []);
    expect(state.canSignOff).toBe(false);
    expect(state.blockers).toEqual(["1 step not approved yet"]);
  });

  it("refuses sign-off while a suggestion is open, even with everything approved", () => {
    const state = reviewState(lesson, allSteps(), [suggestion("m2")]);
    expect(state.canSignOff).toBe(false);
    expect(state.blockers).toEqual(["1 suggestion still open"]);
    expect(state.steps.find((s) => s.id === "m2")?.open).toBe(1);
  });

  it("allows sign-off when everything is approved and suggestions are resolved or withdrawn", () => {
    const state = reviewState(lesson, allSteps(), [suggestion("m2", "resolved"), suggestion("m4", "withdrawn")]);
    expect(state.canSignOff).toBe(true);
    expect(state.approved).toBe(state.total);
  });
});

describe("canApprove", () => {
  it("blocks approving a step that has an open suggestion", () => {
    expect(canApprove("m2", [suggestion("m2")])).toBe(false);
    expect(canApprove("m2", [suggestion("m2", "resolved")])).toBe(true);
    expect(canApprove("m3", [suggestion("m2")])).toBe(true);
  });
});
