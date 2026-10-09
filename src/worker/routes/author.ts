// Author routes, all behind the gate in index.ts.

import { authorCourses, authorLesson, signOffLesson, updateShowUnreviewed } from "../db.ts";
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

// POST /api/author/lessons/:id/signoff — mark as reviewed by a person.
export async function signOff({ env }: Ctx, lessonId: string): Promise<Response> {
  const lesson = await signOffLesson(env.DB, lessonId);
  if (!lesson) return json({ error: "No lesson with that id." }, 404);
  return json(lesson);
}

// PUT /api/author/courses/:id — { showUnreviewed: boolean }, the owner's switch.
export async function setShowUnreviewed({ env, request }: Ctx, courseId: string): Promise<Response> {
  const body = (await request.json().catch(() => null)) as { showUnreviewed?: unknown } | null;
  if (typeof body?.showUnreviewed !== "boolean") return json({ error: "Send { showUnreviewed: true | false }." }, 400);
  const ok = await updateShowUnreviewed(env.DB, courseId, body.showUnreviewed);
  if (!ok) return json({ error: "No course with that id." }, 404);
  return json({ id: courseId, showUnreviewed: body.showUnreviewed });
}
