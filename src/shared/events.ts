// What the player records about a student (spec.md > Data Model > events). One schema, used by
// the browser to build events and by the Worker to check a batch before saving it.

import { z } from "zod";

export const EVENT_TYPES = [
  "lesson.started",
  "module.entered",
  "check.answered",
  "fallback.shown",
  "material.suggested",
  "module.skipped",
  "lesson.completed",
] as const;

export const StudentEvent = z.strictObject({
  id: z.string().min(8).max(64), // made in the browser, so sending one twice saves it once
  chapterSlug: z.string().min(1).max(100),
  lessonId: z.string().min(1).max(200).nullable(),
  studentName: z.string().min(1).max(100),
  deviceId: z.string().min(8).max(64),
  type: z.enum(EVENT_TYPES),
  payload: z.record(z.string(), z.unknown()),
  clientTime: z.string().max(40), // ISO time on the student's device; the log sorts by it
});

export const EventBatch = z.strictObject({ events: z.array(StudentEvent).min(1).max(100) });

export type StudentEvent = z.infer<typeof StudentEvent>;
export type EventType = (typeof EVENT_TYPES)[number];

// Payloads, as the player writes them and the student log reads them.
export interface AnsweredPayload {
  moduleId: string;
  moduleTitle: string;
  checkId: string;
  level: "main" | "retry" | "simpler"; // the check itself, the retry after a fallback, or a simpler question
  answerText: string; // what the student picked or typed, as they saw it
  result: "right" | "known-wrong" | "unplanned";
  misconception?: string; // for a known wrong answer
}

export interface FallbackPayload {
  moduleId: string;
  moduleTitle: string;
  reason: "known" | "unplanned";
  misconception?: string;
  parts: ("reExplanation" | "simplerQuestion")[];
}

export interface ModulePayload {
  moduleId: string;
  moduleTitle: string;
  index: number;
}

// The author's view of the students in a chapter.
export interface StudentSummary {
  name: string;
  deviceId: string;
  lastSeen: string;
  lessons: number; // lessons touched
  events: number;
}
