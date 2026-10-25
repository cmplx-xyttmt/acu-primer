import { describe, expect, it } from "vitest";
import { EventBatch } from "../src/shared/events.ts";

const event = (over: object = {}) => ({
  id: "0f8fad5b-d9cb-469f-a165-70867728950e",
  chapterSlug: "openintro-sampling",
  lessonId: "openintro-5-1-fixture",
  studentName: "Demo",
  deviceId: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  type: "check.answered",
  payload: { moduleId: "m1", result: "known-wrong" },
  clientTime: "2026-10-16T10:00:00.000Z",
  ...over,
});

describe("event batches", () => {
  it("accepts a valid batch", () => {
    expect(EventBatch.safeParse({ events: [event()] }).success).toBe(true);
  });

  it("rejects an unknown event type and an empty or oversized batch", () => {
    expect(EventBatch.safeParse({ events: [event({ type: "hacked" })] }).success).toBe(false);
    expect(EventBatch.safeParse({ events: [] }).success).toBe(false);
    expect(EventBatch.safeParse({ events: Array.from({ length: 101 }, () => event()) }).success).toBe(false);
  });

  it("rejects a payload over 4 KB and a time that isn't ISO", () => {
    expect(EventBatch.safeParse({ events: [event({ payload: { text: "x".repeat(5000) } })] }).success).toBe(false);
    expect(EventBatch.safeParse({ events: [event({ clientTime: "yesterday" })] }).success).toBe(false);
  });

  it("rejects extra fields, so the Worker only stores what it expects", () => {
    expect(EventBatch.safeParse({ events: [event({ isAuthor: true })] }).success).toBe(false);
  });
});
