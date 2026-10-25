import { EventBatch } from "../../shared/events.ts";
import { saveEvents } from "../db.ts";
import { json } from "../http.ts";
import type { Ctx } from "../index.ts";

// POST /api/events — anyone (students). A batch of up to 100 events; ids already saved are
// ignored, so the browser can safely send a batch again after a dropped connection.
// The route is open to anyone, so a body over 64 KB is refused before it's read as JSON.
const MAX_BODY = 64 * 1024;

export async function postEvents({ env, request }: Ctx): Promise<Response> {
  const text = await request.text();
  if (text.length > MAX_BODY) return json({ error: "Send at most 64 KB of events at a time." }, 413);
  let body: unknown = null;
  try {
    body = JSON.parse(text);
  } catch {}
  const parsed = EventBatch.safeParse(body);
  if (!parsed.success) return json({ error: "Send { events: [...] } with 1 to 100 valid events." }, 400);
  return json(await saveEvents(env.DB, parsed.data.events));
}
