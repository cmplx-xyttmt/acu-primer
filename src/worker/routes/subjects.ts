import { publicSubject, publicSubjects } from "../db.ts";
import { json } from "../http.ts";
import type { Ctx } from "../index.ts";

// GET /api/subjects — anyone: every subject with a chapter students can open (the home page).
export async function getSubjects({ env }: Ctx): Promise<Response> {
  return json({ subjects: await publicSubjects(env.DB) });
}

// GET /api/subjects/:slug — anyone: one subject's overview and its visible chapters.
export async function getSubject({ env }: Ctx, slug: string): Promise<Response> {
  const subject = await publicSubject(env.DB, slug);
  return subject ? json(subject) : json({ error: "No subject at this address." }, 404);
}
