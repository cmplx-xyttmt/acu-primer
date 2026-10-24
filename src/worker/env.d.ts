// Secrets aren't in wrangler.jsonc, so `wrangler types` can't see them. Locally they come
// from .dev.vars; in production from `npx wrangler secret put <NAME>`.
interface Secrets {
  AUTHOR_PASSPHRASE?: string;
  ANTHROPIC_API_KEY?: string;
  CLAUDE_API_KEY?: string; // the same key under the name Isaac uses in .env
  FAKE_DRAFTS?: string; // "1" or "some-fail": fake drafting, local addresses only (fakeDraft.ts)
}
interface Env extends Secrets {}
declare namespace Cloudflare {
  interface Env extends Secrets {}
}
