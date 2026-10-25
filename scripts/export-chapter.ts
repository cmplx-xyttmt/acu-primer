// Write a chapter from the local database into a content folder, in the shape the import
// reads, so a lesson drafted and signed off in the app can go into git and onto the live site.
//
//   npm run export:chapter -- recursion            (writes content/recursion/)
//   npm run export:chapter -- recursion content/erickson-recursion
//   npm run import:remote -- content/erickson-recursion
//
// Each lesson keeps the status it has locally, so sign off first. Only commit lessons from a
// book whose license allows it (OpenIntro: CC BY-SA, Erickson: CC BY). An O'Reilly book doesn't.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { Lesson } from "../src/shared/lesson.ts";

const [slug, out = join("content", slug ?? "")] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
if (!slug) {
  console.error("Usage: tsx scripts/export-chapter.ts <chapter slug> [folder]");
  process.exit(1);
}

const sql = (v: string) => `'${v.replaceAll("'", "''")}'`;
function query<T>(command: string): T[] {
  const raw = execFileSync("npx", ["wrangler", "d1", "execute", "acu-primer", "--local", "-c", "wrangler.jsonc", "--json", "--command", command], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
  return (JSON.parse(raw) as { results: T[] }[])[0].results;
}

const [chapter] = query<{ id: string; slug: string; title: string; overview: string | null; show_unreviewed: number; s_slug: string; s_title: string; s_overview: string | null; s_brief: string | null }>(
  `SELECT c.id, c.slug, c.title, c.overview, c.show_unreviewed, s.slug AS s_slug, s.title AS s_title, s.overview AS s_overview, s.brief AS s_brief
   FROM chapters c JOIN subjects s ON s.id = c.subject_id WHERE c.slug = ${sql(slug)}`,
);
if (!chapter) {
  console.error(`✘ No chapter with the slug "${slug}" in the local database.`);
  process.exit(1);
}
const lessons = query<{ id: string; position: number; status: "reviewed" | "unreviewed"; content: string }>(
  `SELECT id, position, status, content FROM lessons WHERE chapter_id = ${sql(chapter.id)} ORDER BY position`,
);

mkdirSync(out, { recursive: true });
const entries = lessons.map((l) => {
  const lesson = Lesson.parse(JSON.parse(l.content));
  const file = `${lesson.id}.json`;
  writeFileSync(join(out, file), JSON.stringify(lesson, null, 2) + "\n");
  console.log(`✓ ${file}: "${lesson.title}", ${l.status}`);
  return { file, position: l.position, status: l.status };
});
const chapterFile = {
  subject: {
    slug: chapter.s_slug,
    title: chapter.s_title,
    ...(chapter.s_overview ? { overview: chapter.s_overview } : {}),
    ...(chapter.s_brief ? { brief: chapter.s_brief } : {}),
  },
  slug: chapter.slug,
  title: chapter.title,
  ...(chapter.overview ? { overview: chapter.overview } : {}),
  showUnreviewed: chapter.show_unreviewed === 1,
  lessons: entries,
};
writeFileSync(join(out, "chapter.json"), JSON.stringify(chapterFile, null, 2) + "\n");
console.log(`✓ ${join(out, "chapter.json")}: ${entries.length} lesson${entries.length === 1 ? "" : "s"}`);
