// Secrets aren't in wrangler.jsonc, so `wrangler types` can't see them. Locally they come
// from .dev.vars; in production from `npx wrangler secret put <NAME>`.
interface Secrets {
  AUTHOR_PASSPHRASE?: string;
  ANTHROPIC_API_KEY?: string;
}
interface Env extends Secrets {}
declare namespace Cloudflare {
  interface Env extends Secrets {}
}
