// Small helpers around D1 queries.

import type { AuthorCourse, AuthorLesson, CourseResponse, LessonStatus } from "../shared/lesson.ts";

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

export async function authorLesson(db: D1Database, lessonId: string): Promise<AuthorLesson | null> {
  const row = await db
    .prepare(
      "SELECT id, course_id, position, title, status, updated_at, signed_off_at, content FROM lessons WHERE id = ?",
    )
    .bind(lessonId)
    .first<AuthorLessonRow & { content: string }>();
  return row ? { ...lessonSummary(row), content: JSON.parse(row.content) } : null;
}

// One sign-off per lesson: status becomes "reviewed" and the time is recorded.
export async function signOffLesson(db: D1Database, lessonId: string): Promise<AuthorLesson | null> {
  await db
    .prepare("UPDATE lessons SET status = 'reviewed', signed_off_at = ? WHERE id = ?")
    .bind(new Date().toISOString(), lessonId)
    .run();
  return authorLesson(db, lessonId);
}

export async function updateShowUnreviewed(db: D1Database, courseId: string, show: boolean): Promise<boolean> {
  const result = await db
    .prepare("UPDATE courses SET show_unreviewed = ? WHERE id = ?")
    .bind(show ? 1 : 0, courseId)
    .run();
  return result.meta.changes > 0;
}
