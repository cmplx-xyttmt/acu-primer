// The author gate (spec.md > Components > Author gate), passphrase version: one owner,
// one secret, AUTHOR_PASSPHRASE. The author types it once; the browser sends it as the
// x-author-passphrase header on every /api/author/* request.
//
// If AUTHOR_PASSPHRASE isn't set, the author side is open only on localhost (so `npm run dev`
// works without a .dev.vars) and closed everywhere else: a deploy that forgot the secret
// fails closed, never open.

export type Gate = { ok: true } | { ok: false; status: 401 | 503; error: string };

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

async function digest(text: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
}

// Compares hashes byte by byte without stopping early, so the time taken doesn't leak how
// much of a guess was right.
async function sameSecret(given: string, expected: string): Promise<boolean> {
  const [a, b] = await Promise.all([digest(given), digest(expected)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function authorGate(url: URL, given: string | null, expected: string | undefined): Promise<Gate> {
  if (!expected) {
    if (LOCAL_HOSTS.has(url.hostname)) return { ok: true };
    return { ok: false, status: 503, error: "The author side isn't set up on this server yet." };
  }
  if (given && (await sameSecret(given, expected))) return { ok: true };
  return { ok: false, status: 401, error: "Wrong or missing author passphrase." };
}
