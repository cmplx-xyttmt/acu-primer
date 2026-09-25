import { getVisibleCourse } from "../db.ts";
import { json } from "../http.ts";

// GET /api/courses/:slug — anyone. One response carries the whole visible course, so a
// single online visit is enough for the service worker to cache it (slice 7).
export async function getCourse(env: Env, slug: string): Promise<Response> {
  const course = await getVisibleCourse(env.DB, slug);
  if (!course) return json({ error: "No course at this address." }, 404);
  return json(course);
}
