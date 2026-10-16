// The Worker: everything under /api/. Static files (the Svelte app) are served before this
// runs, per the "assets" block in wrangler.jsonc.

import { authorGate } from "./auth.ts";
import { json } from "./http.ts";
import { getCourse } from "./routes/courses.ts";
import {
  listCourses,
  getLesson,
  signOff,
  setShowUnreviewed,
  approve,
  unapprove,
  suggest,
  withdraw,
} from "./routes/author.ts";

export interface Ctx {
  request: Request;
  env: Env;
  url: URL;
}

type Handler = (ctx: Ctx, ...params: string[]) => Promise<Response>;

const id = "([a-z0-9-]+)";
const stepId = "([a-z0-9_-]+)"; // module ids, or "_outcomes"
const routes: [method: string, pattern: RegExp, handler: Handler][] = [
  ["GET", new RegExp(`^/api/courses/${id}$`), getCourse],
  ["GET", /^\/api\/author\/courses$/, listCourses],
  ["GET", new RegExp(`^/api/author/lessons/${id}$`), getLesson],
  ["POST", new RegExp(`^/api/author/lessons/${id}/signoff$`), signOff],
  ["PUT", new RegExp(`^/api/author/courses/${id}$`), setShowUnreviewed],
  ["POST", new RegExp(`^/api/author/lessons/${id}/steps/${stepId}/approval$`), approve],
  ["DELETE", new RegExp(`^/api/author/lessons/${id}/steps/${stepId}/approval$`), unapprove],
  ["POST", new RegExp(`^/api/author/lessons/${id}/suggestions$`), suggest],
  ["POST", new RegExp(`^/api/author/suggestions/${id}/withdraw$`), withdraw],
];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    for (const [method, pattern, handler] of routes) {
      const match = url.pathname.match(pattern);
      if (!match || request.method !== method) continue;
      try {
        if (url.pathname.startsWith("/api/author/")) {
          const gate = await authorGate(url, request.headers.get("x-author-passphrase"), env.AUTHOR_PASSPHRASE);
          if (!gate.ok) return json({ error: gate.error }, gate.status);
        }
        return await handler({ request, env, url }, ...match.slice(1));
      } catch (err) {
        console.error(err);
        return json({ error: "Something went wrong on the server." }, 500);
      }
    }
    return json({ error: "Not found." }, 404);
  },
} satisfies ExportedHandler<Env>;
