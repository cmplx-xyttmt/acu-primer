// Small helpers around D1 queries.

import type { CourseResponse, LessonStatus } from "../shared/lesson.ts";

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
