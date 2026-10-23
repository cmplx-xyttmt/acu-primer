// The Worker: everything under /api/. Static files (the Svelte app) are served before this
// runs, per the "assets" block in wrangler.jsonc.

import { authorGate } from "./auth.ts";
import { json } from "./http.ts";
import { getChapter } from "./routes/chapters.ts";
import { getSubject, getSubjects } from "./routes/subjects.ts";
import { postEvents } from "./routes/events.ts";
import { getBudget, putChapter, postSource, postDraft, postRevise, postEdit, postSubject, putSubject, postChapter, postBook, postContents } from "./routes/drafting.ts";
import {
  listSubjects,
  getLesson,
  signOff,
    approve,
  unapprove,
  suggest,
  withdraw,
  students,
  studentLog,
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
  ["GET", new RegExp(`^/api/chapters/${id}$`), getChapter],
  ["GET", /^\/api\/subjects$/, getSubjects],
  ["GET", new RegExp(`^/api/subjects/${id}$`), getSubject],
  ["POST", /^\/api\/events$/, postEvents],
  ["GET", /^\/api\/author\/subjects$/, listSubjects],
  ["POST", /^\/api\/author\/subjects$/, postSubject],
  ["POST", /^\/api\/author\/books$/, postBook],
  ["POST", /^\/api\/author\/books\/contents$/, postContents],
  ["PUT", new RegExp(`^/api/author/subjects/${id}$`), putSubject],
  ["POST", new RegExp(`^/api/author/subjects/${id}/chapters$`), postChapter],
  ["GET", new RegExp(`^/api/author/lessons/${id}$`), getLesson],
  ["POST", new RegExp(`^/api/author/lessons/${id}/signoff$`), signOff],
  ["PUT", new RegExp(`^/api/author/chapters/${id}$`), putChapter],
  ["GET", /^\/api\/author\/budget$/, getBudget],
  ["POST", /^\/api\/author\/sources$/, postSource],
  ["POST", /^\/api\/author\/drafts$/, postDraft],
  ["POST", new RegExp(`^/api/author/lessons/${id}/steps/${stepId}/revise$`), postRevise],
  ["POST", new RegExp(`^/api/author/lessons/${id}/edits$`), postEdit],
  ["POST", new RegExp(`^/api/author/lessons/${id}/steps/${stepId}/approval$`), approve],
  ["DELETE", new RegExp(`^/api/author/lessons/${id}/steps/${stepId}/approval$`), unapprove],
  ["POST", new RegExp(`^/api/author/lessons/${id}/suggestions$`), suggest],
  ["POST", new RegExp(`^/api/author/suggestions/${id}/withdraw$`), withdraw],
  ["GET", new RegExp(`^/api/author/chapters/${id}/students$`), students],
  ["GET", new RegExp(`^/api/author/chapters/${id}/student-events$`), studentLog],
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
