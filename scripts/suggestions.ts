// Open review suggestions, for the /revise-lesson skill (and for a person to look at):
//
//   npx tsx scripts/suggestions.ts list [--local|--remote] [lesson-id]
//   npx tsx scripts/suggestions.ts resolve [--local|--remote] <suggestion-id> "<what changed>"
//
// `list` prints each open suggestion with its lesson file, step and part. `resolve` marks one
// resolved with a note the author sees on the review screen. Defaults to --local.

import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const target = args.includes("--remote") ? "--remote" : "--local";
const [command, ...rest] = args.filter((a) => !a.startsWith("--"));

function d1(sql: string): Record<string, unknown>[] {
  const out = execFileSync(
    "npx",
    ["wrangler", "d1", "execute", "acu-primer", target, "-c", "wrangler.jsonc", "--json", "--command", sql],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  const parsed = JSON.parse(out) as { results: Record<string, unknown>[] }[];
  return parsed.flatMap((p) => p.results ?? []);
}

const q = (v: string) => `'${v.replaceAll("'", "''")}'`;

// Lesson id → its file under content/, from every course.json.
function lessonFiles(): Map<string, string> {
  const files = new Map<string, string>();
  for (const dir of readdirSync("content", { withFileTypes: true })) {
    const coursePath = join("content", dir.name, "course.json");
    if (!dir.isDirectory() || !existsSync(coursePath)) continue;
    for (const entry of JSON.parse(readFileSync(coursePath, "utf8")).lessons as { file: string }[]) {
      const path = join("content", dir.name, entry.file);
      if (existsSync(path)) files.set(JSON.parse(readFileSync(path, "utf8")).id, path);
    }
  }
  return files;
}

if (command === "list") {
  const lessonId = rest[0];
  const rows = d1(
    `SELECT id, lesson_id, step_id, part, part_label, text, created_at FROM suggestions WHERE status = 'open'${
      lessonId ? ` AND lesson_id = ${q(lessonId)}` : ""
    } ORDER BY lesson_id, created_at`,
  );
  const files = lessonFiles();
  if (rows.length === 0) console.log(`No open suggestions (${target.slice(2)}).`);
  for (const r of rows) {
    console.log(`\n${r.id}`);
    console.log(`  lesson: ${r.lesson_id}  →  ${files.get(String(r.lesson_id)) ?? "(no file found in content/)"}`);
    console.log(`  step:   ${r.step_id}   part: ${r.part}  (${r.part_label})`);
    console.log(`  says:   ${r.text}`);
  }
} else if (command === "resolve") {
  const [id, note] = rest;
  if (!id || !note) {
    console.error('Usage: npx tsx scripts/suggestions.ts resolve [--local|--remote] <id> "<what changed>"');
    process.exit(1);
  }
  d1(
    `UPDATE suggestions SET status = 'resolved', note = ${q(note)}, resolved_at = ${q(new Date().toISOString())} WHERE id = ${q(id)} AND status = 'open'`,
  );
  const [row] = d1(`SELECT status FROM suggestions WHERE id = ${q(id)}`);
  console.log(row?.status === "resolved" ? `✓ ${id} resolved` : `✘ ${id} not found or not open`);
} else {
  console.error("Usage: npx tsx scripts/suggestions.ts list|resolve [--local|--remote] ...");
  process.exit(1);
}
