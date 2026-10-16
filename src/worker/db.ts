// Small helpers around D1 queries.

import type { AuthorCourse, AuthorLesson, CourseResponse, Lesson, LessonStatus } from "../shared/lesson.ts";
import { reviewState, stepContent, type Suggestion } from "../shared/review.ts";

interface CourseRow {
  id: string;
  slug: string;
  title: string;
  show_unreviewed: number;
}

interface LessonRow {
  id: string;
  position: number;
  status: LessonStatus;
  content: string;
}

// The course and every lesson a student may see, in full. Unreviewed lessons are included
// only when the owner has switched that on.
export async function getVisibleCourse(db: D1Database, slug: string): Promise<CourseResponse | null> {
  const course = await db
    .prepare("SELECT id, slug, title, show_unreviewed FROM courses WHERE slug = ?")
    .bind(slug)
    .first<CourseRow>();
  if (!course) return null;

  const showUnreviewed = course.show_unreviewed === 1;
  const { results } = await db
    .prepare(
      `SELECT id, position, status, content FROM lessons
       WHERE course_id = ? AND (status = 'reviewed' OR ?)
       ORDER BY position`,
    )
    .bind(course.id, showUnreviewed ? 1 : 0)
    .all<LessonRow>();

  return {
    course: { slug: course.slug, title: course.title, showUnreviewed },
    lessons: results.map((row) => ({
      id: row.id,
      position: row.position,
      status: row.status,
      content: JSON.parse(row.content),
    })),
  };
}

interface AuthorLessonRow {
  id: string;
  course_id: string;
  position: number;
  title: string;
  status: LessonStatus;
  updated_at: string;
  signed_off_at: string | null;
}

const lessonSummary = (row: AuthorLessonRow) => ({
  id: row.id,
  courseId: row.course_id,
  position: row.position,
  title: row.title,
  status: row.status,
  updatedAt: row.updated_at,
  signedOffAt: row.signed_off_at,
});

// Every course with its lessons and their marks, for the author's home screen.
export async function authorCourses(db: D1Database): Promise<AuthorCourse[]> {
  const [courses, lessons] = await db.batch([
    db.prepare("SELECT id, slug, title, show_unreviewed FROM courses ORDER BY title"),
    db.prepare(
      "SELECT id, course_id, position, title, status, updated_at, signed_off_at FROM lessons ORDER BY position",
    ),
  ]);
  const lessonRows = lessons.results as unknown as AuthorLessonRow[];
  return (courses.results as unknown as CourseRow[]).map((c) => ({
    id: c.id,
    slug: c.slug,
    title: c.title,
    showUnreviewed: c.show_unreviewed === 1,
    lessons: lessonRows.filter((l) => l.course_id === c.id).map(lessonSummary),
  }));
}

async function sha256(value: unknown): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(value)));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

interface SuggestionRow {
  id: string;
  lesson_id: string;
  step_id: string;
  part: string;
  part_label: string;
  text: string;
  status: Suggestion["status"];
  note: string | null;
  created_at: string;
  resolved_at: string | null;
}

const suggestionFromRow = (r: SuggestionRow): Suggestion => ({
  id: r.id,
  lessonId: r.lesson_id,
  stepId: r.step_id,
  part: r.part,
  partLabel: r.part_label,
  text: r.text,
  status: r.status,
  note: r.note,
  createdAt: r.created_at,
  resolvedAt: r.resolved_at,
});

// Approvals count only while the step's content still hashes the same as when approved.
async function reviewFor(db: D1Database, lessonId: string, content: Lesson) {
  const [approvals, suggestions] = await db.batch([
    db.prepare("SELECT step_id, content_hash FROM step_approvals WHERE lesson_id = ?").bind(lessonId),
    db.prepare("SELECT * FROM suggestions WHERE lesson_id = ? ORDER BY created_at").bind(lessonId),
  ]);
  const approvedSteps: string[] = [];
  for (const a of approvals.results as unknown as { step_id: string; content_hash: string }[]) {
    const current = stepContent(content, a.step_id);
    if (current !== null && (await sha256(current)) === a.content_hash) approvedSteps.push(a.step_id);
  }
  return {
    approvedSteps,
    suggestions: (suggestions.results as unknown as SuggestionRow[]).map(suggestionFromRow),
  };
}

export async function authorLesson(db: D1Database, lessonId: string): Promise<AuthorLesson | null> {
  const row = await db
    .prepare(
      "SELECT id, course_id, position, title, status, updated_at, signed_off_at, content FROM lessons WHERE id = ?",
    )
    .bind(lessonId)
    .first<AuthorLessonRow & { content: string }>();
  if (!row) return null;
  const content = JSON.parse(row.content) as Lesson;
  return { ...lessonSummary(row), content, review: await reviewFor(db, lessonId, content) };
}

export type ReviewResult = { ok: true; lesson: AuthorLesson } | { ok: false; status: 404 | 409; error: string };

// One sign-off per lesson, allowed only when every step is approved and nothing is open.
export async function signOffLesson(db: D1Database, lessonId: string): Promise<ReviewResult> {
  const lesson = await authorLesson(db, lessonId);
  if (!lesson) return { ok: false, status: 404, error: "No lesson with that id." };
  const state = reviewState(lesson.content, new Set(lesson.review.approvedSteps), lesson.review.suggestions);
  if (!state.canSignOff) return { ok: false, status: 409, error: `Not ready to sign off: ${state.blockers.join(", ")}.` };
  await db
    .prepare("UPDATE lessons SET status = 'reviewed', signed_off_at = ? WHERE id = ?")
    .bind(new Date().toISOString(), lessonId)
    .run();
  return { ok: true, lesson: (await authorLesson(db, lessonId))! };
}

export async function approveStep(db: D1Database, lessonId: string, stepId: string): Promise<ReviewResult> {
  const lesson = await authorLesson(db, lessonId);
  if (!lesson) return { ok: false, status: 404, error: "No lesson with that id." };
  const content = stepContent(lesson.content, stepId);
  if (content === null) return { ok: false, status: 404, error: "No step with that id in this lesson." };
  if (lesson.review.suggestions.some((g) => g.stepId === stepId && g.status === "open"))
    return { ok: false, status: 409, error: "This step has an open suggestion. Withdraw it or let the revision resolve it first." };
  await db
    .prepare(
      `INSERT INTO step_approvals (lesson_id, step_id, content_hash, approved_at) VALUES (?, ?, ?, ?)
       ON CONFLICT (lesson_id, step_id) DO UPDATE SET content_hash = excluded.content_hash, approved_at = excluded.approved_at`,
    )
    .bind(lessonId, stepId, await sha256(content), new Date().toISOString())
    .run();
  return { ok: true, lesson: (await authorLesson(db, lessonId))! };
}

export async function unapproveStep(db: D1Database, lessonId: string, stepId: string): Promise<ReviewResult> {
  await db.prepare("DELETE FROM step_approvals WHERE lesson_id = ? AND step_id = ?").bind(lessonId, stepId).run();
  const lesson = await authorLesson(db, lessonId);
  return lesson ? { ok: true, lesson } : { ok: false, status: 404, error: "No lesson with that id." };
}

// A new suggestion also takes back that step's approval: the author wants it changed.
export async function addSuggestion(
  db: D1Database,
  lessonId: string,
  s: { stepId: string; part: string; partLabel: string; text: string },
): Promise<ReviewResult> {
  const lesson = await authorLesson(db, lessonId);
  if (!lesson) return { ok: false, status: 404, error: "No lesson with that id." };
  if (stepContent(lesson.content, s.stepId) === null)
    return { ok: false, status: 404, error: "No step with that id in this lesson." };
  await db.batch([
    db
      .prepare(
        "INSERT INTO suggestions (id, lesson_id, step_id, part, part_label, text, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'open', ?)",
      )
      .bind(crypto.randomUUID(), lessonId, s.stepId, s.part, s.partLabel, s.text, new Date().toISOString()),
    db.prepare("DELETE FROM step_approvals WHERE lesson_id = ? AND step_id = ?").bind(lessonId, s.stepId),
  ]);
  return { ok: true, lesson: (await authorLesson(db, lessonId))! };
}

// The author withdraws an open suggestion (resolving is the revision's job, done by script).
export async function withdrawSuggestion(db: D1Database, suggestionId: string): Promise<ReviewResult> {
  const row = await db.prepare("SELECT lesson_id, status FROM suggestions WHERE id = ?").bind(suggestionId).first<{
    lesson_id: string;
    status: string;
  }>();
  if (!row) return { ok: false, status: 404, error: "No suggestion with that id." };
  if (row.status !== "open") return { ok: false, status: 409, error: "Only an open suggestion can be withdrawn." };
  await db
    .prepare("UPDATE suggestions SET status = 'withdrawn', resolved_at = ? WHERE id = ?")
    .bind(new Date().toISOString(), suggestionId)
    .run();
  return { ok: true, lesson: (await authorLesson(db, row.lesson_id))! };
}

export async function updateShowUnreviewed(db: D1Database, courseId: string, show: boolean): Promise<boolean> {
  const result = await db
    .prepare("UPDATE courses SET show_unreviewed = ? WHERE id = ?")
    .bind(show ? 1 : 0, courseId)
    .run();
  return result.meta.changes > 0;
}
