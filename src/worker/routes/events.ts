import { EventBatch } from "../../shared/events.ts";
import { saveEvents } from "../db.ts";
import { json } from "../http.ts";
import type { Ctx } from "../index.ts";

// POST /api/events — anyone (students). A batch of up to 100 events; ids already saved are
// ignored, so the browser can safely send a batch again after a dropped connection.
export async function postEvents({ env, request }: Ctx): Promise<Response> {
  const parsed = EventBatch.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "Send { events: [...] } with 1 to 100 valid events." }, 400);
  return json(await saveEvents(env.DB, parsed.data.events));
}
