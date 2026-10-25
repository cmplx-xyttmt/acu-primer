// Check a content folder's lesson files against the schema and load them into D1.
//
//   npm run import:local -- content/openintro-sampling
//   npm run import:remote -- content/erickson
//
// A folder holds either subject.json (a whole subject: its chapters with their outlines and
// lessons, as `npm run export:subject` writes it) or chapter.json (one chapter and its
// subject), plus one JSON file per lesson. The subject is created if it doesn't exist; its
// title and overview are updated, and its brief only when the file gives one. Chapters are
// matched by slug and their outlines kept. Re-running updates lessons with the same id. A
// lesson signed off in the app keeps its sign-off as long as its content is unchanged;
// changed content takes the status from the file again, because the sign-off was for the old
// version.

import { existsSync, readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { Lesson } from "../src/shared/lesson.ts";
import { lessonProblems } from "../src/shared/lessonChecks.ts";
import { BookInfo, ChapterPlan } from "../src/shared/bookPlan.ts";

interface LessonEntry {
  file: string;
  position: number;
  status: "reviewed" | "unreviewed";
}
interface ChapterIn {
  slug: string;
  title: string;
  overview?: string;
  position?: number; // left out in chapter.json: a new chapter goes last
  // Show lessons nobody has signed off yet, with a "Not yet reviewed" mark. Usually set
  // with the switch on the author side; when this is left out, the import doesn't touch it.
  showUnreviewed?: boolean;
  plan?: unknown; // the sections still to draft, from Start from a book
  lessons: LessonEntry[];
}
interface SubjectIn {
  slug: string;
  title: string;
  overview?: string;
  brief?: string;
  book?: unknown;
  chapters: ChapterIn[];
}

const args = process.argv.slice(2);
const target = args.includes("--remote") ? "--remote" : "--local";
const dir = args.find((a) => !a.startsWith("--"));
if (!dir) {
  console.error("Usage: tsx scripts/import-lesson.ts [--local|--remote] <content folder>");
  process.exit(1);
}

const sql = (value: string | number | null) =>
  value === null ? "NULL" : typeof value === "number" ? String(value) : `'${value.replaceAll("'", "''")}'`;

let subject: SubjectIn;
if (existsSync(join(dir, "subject.json"))) {
  subject = JSON.parse(readFileSync(join(dir, "subject.json"), "utf8"));
} else {
  const { subject: sub, ...chapter } = JSON.parse(readFileSync(join(dir, "chapter.json"), "utf8"));
  if (!sub?.slug || !sub?.title) {
    console.error(`✘ ${join(dir, "chapter.json")} needs a "subject": { "slug", "title" }.`);
    process.exit(1);
  }
  subject = { ...sub, chapters: [chapter] };
}
if (!subject.slug || !subject.title || !Array.isArray(subject.chapters)) {
  console.error(`✘ ${dir}: the subject needs a slug, a title and chapters.`);
  process.exit(1);
}
const now = new Date().toISOString();
const book = subject.book === undefined ? null : JSON.stringify(BookInfo.parse(subject.book));

const statements = [
  `INSERT INTO subjects (id, slug, title, overview, brief, position, created_at, book)
   VALUES (${sql(subject.slug)}, ${sql(subject.slug)}, ${sql(subject.title)}, ${sql(subject.overview ?? null)}, ${sql(subject.brief ?? null)},
           (SELECT COALESCE(MAX(position), 0) + 1 FROM subjects), ${sql(now)}, ${sql(book)})
   ON CONFLICT (id) DO UPDATE SET title = excluded.title, overview = COALESCE(excluded.overview, subjects.overview),
     book = COALESCE(excluded.book, subjects.book)${subject.brief === undefined ? "" : ", brief = excluded.brief"};`,
];
for (const chapter of subject.chapters) {
  const plan = chapter.plan === undefined ? null : JSON.stringify(ChapterPlan.parse(chapter.plan));
  const position =
    chapter.position ?? `(SELECT COALESCE(MAX(position), 0) + 1 FROM chapters WHERE subject_id = ${sql(subject.slug)})`;
  statements.push(
    `INSERT INTO chapters (id, slug, title, overview, subject_id, position, show_unreviewed, plan)
     VALUES (${sql(chapter.slug)}, ${sql(chapter.slug)}, ${sql(chapter.title)}, ${sql(chapter.overview ?? null)}, ${sql(subject.slug)},
             ${position}, ${chapter.showUnreviewed ? 1 : 0}, ${sql(plan)})
     ON CONFLICT (id) DO UPDATE SET title = excluded.title, subject_id = excluded.subject_id,
       overview = COALESCE(excluded.overview, chapters.overview), plan = COALESCE(excluded.plan, chapters.plan)${
         chapter.position === undefined ? "" : ", position = excluded.position"
       }${chapter.showUnreviewed === undefined ? "" : ", show_unreviewed = excluded.show_unreviewed"};`,
  );
}

let failed = false;
for (const [chapterId, entry] of subject.chapters.flatMap((c) => c.lessons.map((l) => [c.slug, l] as const))) {
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
// --persist-to=<dir> loads into a copy of the local database instead (for trying an import).
const persist = args.find((a) => a.startsWith("--persist-to="));
execFileSync("npx", ["wrangler", "d1", "execute", "acu-primer", target, "-c", "wrangler.jsonc", "--file", file, ...(persist ? ["--persist-to", persist.split("=")[1]] : [])], {
  stdio: "inherit",
});

function z_pretty(error: import("zod").ZodError) {
  return error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
}
