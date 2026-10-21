// Check a chapter folder's lesson files against the schema and load them into D1.
//
//   npm run import:local -- content/openintro-sampling
//   npm run import:remote -- content/openintro-sampling
//
// The folder holds chapter.json (its subject, slug, title, overview, lessons with
// file/position/status) and one JSON file per lesson. The subject is created if it doesn't
// exist; its title and overview are updated, and its brief only when chapter.json gives one. Re-running updates lessons with the same id. A lesson signed off in
// the app keeps its sign-off as long as its content is unchanged; changed content takes the
// status from chapter.json again, because the sign-off was for the old version.

import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { Lesson } from "../src/shared/lesson.ts";
import { lessonProblems } from "../src/shared/lessonChecks.ts";

interface ChapterFile {
  subject: { slug: string; title: string; overview?: string; brief?: string };
  slug: string;
  title: string;
  overview?: string;
  // Show lessons nobody has signed off yet, with a "Not yet reviewed" mark. Usually set
  // with the switch on the author side; when this is left out, the import doesn't touch it.
  showUnreviewed?: boolean;
  lessons: { file: string; position: number; status: "reviewed" | "unreviewed" }[];
}

const args = process.argv.slice(2);
const target = args.includes("--remote") ? "--remote" : "--local";
const dir = args.find((a) => !a.startsWith("--"));
if (!dir) {
  console.error("Usage: tsx scripts/import-lesson.ts [--local|--remote] <chapter folder>");
  process.exit(1);
}

const sql = (value: string | number | null) =>
  value === null ? "NULL" : typeof value === "number" ? String(value) : `'${value.replaceAll("'", "''")}'`;

const chapter: ChapterFile = JSON.parse(readFileSync(join(dir, "chapter.json"), "utf8"));
const chapterId = chapter.slug;
const now = new Date().toISOString();

if (!chapter.subject?.slug || !chapter.subject?.title) {
  console.error(`✘ ${join(dir, "chapter.json")} needs a "subject": { "slug", "title" }.`);
  process.exit(1);
}
const subject = chapter.subject;

const statements = [
  `INSERT INTO subjects (id, slug, title, overview, brief, position, created_at)
   VALUES (${sql(subject.slug)}, ${sql(subject.slug)}, ${sql(subject.title)}, ${sql(subject.overview ?? null)}, ${sql(subject.brief ?? null)},
           (SELECT COALESCE(MAX(position), 0) + 1 FROM subjects), ${sql(now)})
   ON CONFLICT (id) DO UPDATE SET title = excluded.title, overview = COALESCE(excluded.overview, subjects.overview)${
     subject.brief === undefined ? "" : ", brief = excluded.brief"
   };`,
  `INSERT INTO chapters (id, slug, title, overview, subject_id, position, show_unreviewed)
   VALUES (${sql(chapterId)}, ${sql(chapter.slug)}, ${sql(chapter.title)}, ${sql(chapter.overview ?? null)}, ${sql(subject.slug)},
           (SELECT COALESCE(MAX(position), 0) + 1 FROM chapters WHERE subject_id = ${sql(subject.slug)}), ${chapter.showUnreviewed ? 1 : 0})
   ON CONFLICT (id) DO UPDATE SET title = excluded.title, subject_id = excluded.subject_id,
     overview = COALESCE(excluded.overview, chapters.overview)${
       chapter.showUnreviewed === undefined ? "" : ", show_unreviewed = excluded.show_unreviewed"
     };`,
];

let failed = false;
for (const entry of chapter.lessons) {
  const parsed = Lesson.safeParse(JSON.parse(readFileSync(join(dir, entry.file), "utf8")));
  if (!parsed.success) {
    console.error(`✘ ${entry.file} doesn't match the lesson schema:\n${z_pretty(parsed.error)}`);
    failed = true;
    continue;
  }
  const lesson = parsed.data;
  const problems = lessonProblems(lesson);
  if (problems.length > 0) {
    console.error(`✘ ${entry.file} has problems:\n${problems.map((p) => `  ${p}`).join("\n")}`);
    failed = true;
    continue;
  }
  console.log(`✓ ${entry.file}: "${lesson.title}", ${lesson.modules.length} modules, ${entry.status}`);
  statements.push(
    `INSERT INTO lessons (id, chapter_id, source_id, position, title, status, content, updated_at, signed_off_at)
     VALUES (${sql(lesson.id)}, ${sql(chapterId)}, NULL, ${entry.position}, ${sql(lesson.title)}, ${sql(entry.status)},
             ${sql(JSON.stringify(lesson))}, ${sql(now)}, ${sql(entry.status === "reviewed" ? now : null)})
     ON CONFLICT (id) DO UPDATE SET position = excluded.position, title = excluded.title,
       status = CASE WHEN lessons.content = excluded.content THEN lessons.status ELSE excluded.status END,
       signed_off_at = CASE WHEN lessons.content = excluded.content THEN lessons.signed_off_at ELSE excluded.signed_off_at END,
       updated_at = CASE WHEN lessons.content = excluded.content THEN lessons.updated_at ELSE excluded.updated_at END,
       content = excluded.content;`,
  );
}
if (failed) process.exit(1);

const file = join(mkdtempSync(join(tmpdir(), "acu-import-")), "import.sql");
writeFileSync(file, statements.join("\n"));
// -c skips the redirect to the last build's config in .wrangler/deploy/config.json.
execFileSync("npx", ["wrangler", "d1", "execute", "acu-primer", target, "-c", "wrangler.jsonc", "--file", file], {
  stdio: "inherit",
});

function z_pretty(error: import("zod").ZodError) {
  return error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
}
