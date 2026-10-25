// Write a whole subject from the local database into a content folder: every chapter with its
// outline (the sections still to draft), and every lesson. The import reads it back, so a
// subject made with Start from a book and drafted in the app can go into git and onto the
// live site with its undrafted chapters too.
//
//   npm run export:subject -- algorithms-by-jeff-erickson content/erickson
//   npm run import:remote -- content/erickson
//
// Each lesson keeps the status it has locally, so sign off first. Only commit lessons from a
// book whose license allows it (OpenIntro: CC BY-SA, Erickson: CC BY). An O'Reilly book doesn't.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { Lesson } from "../src/shared/lesson.ts";
import { BookInfo, ChapterPlan } from "../src/shared/bookPlan.ts";

const [slug, out] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
if (!slug || !out) {
  console.error("Usage: tsx scripts/export-subject.ts <subject slug> <folder>");
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

const [subject] = query<{ id: string; slug: string; title: string; overview: string | null; brief: string | null; book: string | null }>(
  `SELECT id, slug, title, overview, brief, book FROM subjects WHERE slug = ${sql(slug)}`,
);
if (!subject) {
  console.error(`✘ No subject with the slug "${slug}" in the local database.`);
  process.exit(1);
}
const chapters = query<{ id: string; slug: string; title: string; overview: string | null; show_unreviewed: number; position: number; plan: string | null }>(
  `SELECT id, slug, title, overview, show_unreviewed, position, plan FROM chapters WHERE subject_id = ${sql(subject.id)} ORDER BY position`,
);
const lessons = query<{ chapter_id: string; position: number; status: "reviewed" | "unreviewed"; content: string }>(
  `SELECT l.chapter_id, l.position, l.status, l.content FROM lessons l JOIN chapters c ON c.id = l.chapter_id
   WHERE c.subject_id = ${sql(subject.id)} ORDER BY l.position`,
);

mkdirSync(out, { recursive: true });
const subjectFile = {
  slug: subject.slug,
  title: subject.title,
  ...(subject.overview ? { overview: subject.overview } : {}),
  ...(subject.brief ? { brief: subject.brief } : {}),
  ...(subject.book ? { book: BookInfo.parse(JSON.parse(subject.book)) } : {}),
  chapters: chapters.map((c) => ({
    slug: c.slug,
    title: c.title,
    ...(c.overview ? { overview: c.overview } : {}),
    position: c.position,
    showUnreviewed: c.show_unreviewed === 1,
    ...(c.plan ? { plan: ChapterPlan.parse(JSON.parse(c.plan)) } : {}),
    lessons: lessons
      .filter((l) => l.chapter_id === c.id)
      .map((l) => {
        const lesson = Lesson.parse(JSON.parse(l.content));
        const file = `${lesson.id}.json`;
        writeFileSync(join(out, file), JSON.stringify(lesson, null, 2) + "\n");
        console.log(`✓ ${file}: "${lesson.title}", ${l.status}`);
        return { file, position: l.position, status: l.status };
      }),
  })),
};
writeFileSync(join(out, "subject.json"), JSON.stringify(subjectFile, null, 2) + "\n");
console.log(`✓ ${join(out, "subject.json")}: ${chapters.length} chapters, ${lessons.length} lesson${lessons.length === 1 ? "" : "s"}`);
