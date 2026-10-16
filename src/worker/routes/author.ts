// Author routes, all behind the gate in index.ts.

import {
  addSuggestion,
  approveStep,
  authorCourses,
  authorLesson,
  signOffLesson,
  unapproveStep,
  updateShowUnreviewed,
  withdrawSuggestion,
  courseStudents,
  studentEvents,
  type ReviewResult,
} from "../db.ts";
import { json } from "../http.ts";
import type { Ctx } from "../index.ts";

// GET /api/author/courses — every course with its lessons and their marks (no lesson content).
export async function listCourses({ env }: Ctx): Promise<Response> {
  return json({ courses: await authorCourses(env.DB) });
}

// GET /api/author/lessons/:id — one lesson in full, whatever its status, for the review screen.
export async function getLesson({ env }: Ctx, lessonId: string): Promise<Response> {
  const lesson = await authorLesson(env.DB, lessonId);
  if (!lesson) return json({ error: "No lesson with that id." }, 404);
  return json(lesson);
}

const reply = (result: ReviewResult) =>
  result.ok ? json(result.lesson) : json({ error: result.error }, result.status);

// POST /api/author/lessons/:id/signoff — mark as reviewed by a person, once every step is
// approved and no suggestion is open (409 otherwise, with the reasons).
export async function signOff({ env }: Ctx, lessonId: string): Promise<Response> {
  return reply(await signOffLesson(env.DB, lessonId));
}

// POST / DELETE /api/author/lessons/:id/steps/:stepId/approval — approve a step, or take it back.
export async function approve({ env }: Ctx, lessonId: string, stepId: string): Promise<Response> {
  return reply(await approveStep(env.DB, lessonId, stepId));
}

export async function unapprove({ env }: Ctx, lessonId: string, stepId: string): Promise<Response> {
  return reply(await unapproveStep(env.DB, lessonId, stepId));
}

// POST /api/author/lessons/:id/suggestions — { stepId, part, partLabel, text }
export async function suggest({ env, request }: Ctx, lessonId: string): Promise<Response> {
  const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const field = (k: string) => (typeof b?.[k] === "string" ? (b[k] as string).trim() : "");
  const s = { stepId: field("stepId"), part: field("part"), partLabel: field("partLabel"), text: field("text") };
  if (!s.stepId || !s.part || !s.partLabel || !s.text)
    return json({ error: "Send { stepId, part, partLabel, text }, all non-empty." }, 400);
  if (s.text.length > 4000) return json({ error: "Keep a suggestion under 4,000 characters." }, 400);
  return reply(await addSuggestion(env.DB, lessonId, s));
}

// POST /api/author/suggestions/:id/withdraw
export async function withdraw({ env }: Ctx, suggestionId: string): Promise<Response> {
  return reply(await withdrawSuggestion(env.DB, suggestionId));
}

// PUT /api/author/courses/:id — { showUnreviewed: boolean }, the owner's switch.
export async function setShowUnreviewed({ env, request }: Ctx, courseId: string): Promise<Response> {
  const body = (await request.json().catch(() => null)) as { showUnreviewed?: unknown } | null;
  if (typeof body?.showUnreviewed !== "boolean") return json({ error: "Send { showUnreviewed: true | false }." }, 400);
  const ok = await updateShowUnreviewed(env.DB, courseId, body.showUnreviewed);
  if (!ok) return json({ error: "No course with that id." }, 404);
  return json({ id: courseId, showUnreviewed: body.showUnreviewed });
}

// GET /api/author/courses/:id/students — everyone who has opened the course, newest first.
export async function students({ env }: Ctx, courseId: string): Promise<Response> {
  return json({ students: await courseStudents(env.DB, courseId) });
}

// GET /api/author/courses/:id/student-events?name=...&device=... — one student's log.
// (A query string, not a path segment: a typed name can contain any character.)
export async function studentLog({ env, url }: Ctx, courseId: string): Promise<Response> {
  const name = url.searchParams.get("name");
  const device = url.searchParams.get("device");
  if (!name || !device) return json({ error: "Give ?name= and &device=." }, 400);
  return json({ events: await studentEvents(env.DB, courseId, name, device) });
}
