// The Worker: everything under /api/. Static files (the Svelte app) are served before this
// runs, per the "assets" block in wrangler.jsonc.

import { json } from "./http.ts";
import { getCourse } from "./routes/courses.ts";

type Handler = (env: Env, ...params: string[]) => Promise<Response>;

const routes: [method: string, pattern: RegExp, handler: Handler][] = [
  ["GET", /^\/api\/courses\/([a-z0-9-]+)$/, getCourse],
];

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    for (const [method, pattern, handler] of routes) {
      const match = pathname.match(pattern);
      if (match && request.method === method) {
        try {
          return await handler(env, ...match.slice(1));
        } catch (err) {
          console.error(err);
          return json({ error: "Something went wrong on the server." }, 500);
        }
      }
    }
    return json({ error: "Not found." }, 404);
  },
} satisfies ExportedHandler<Env>;
