import { getVisibleChapter } from "../db.ts";
import { json } from "../http.ts";
import type { Ctx } from "../index.ts";

// GET /api/chapters/:slug — anyone. One response carries the whole visible chapter, so a
// single online visit is enough for the service worker to cache it (slice 7).
export async function getChapter({ env }: Ctx, slug: string): Promise<Response> {
  const chapter = await getVisibleChapter(env.DB, slug);
  if (!chapter) return json({ error: "No chapter at this address." }, 404);
  return json(chapter);
}
