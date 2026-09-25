// Check a course folder's lesson files against the schema and load them into D1.
//
//   npm run import:local -- content/openintro-sampling
//   npm run import:remote -- content/openintro-sampling
//
// The folder holds course.json (slug, title, lessons with file/position/status) and one
// JSON file per lesson. Re-running replaces the lessons with the same id.

import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { Lesson } from "../src/shared/lesson.ts";

interface CourseFile {
  slug: string;
  title: string;
  lessons: { file: string; position: number; status: "reviewed" | "unreviewed" }[];
}

const args = process.argv.slice(2);
const target = args.includes("--remote") ? "--remote" : "--local";
const dir = args.find((a) => !a.startsWith("--"));
if (!dir) {
  console.error("Usage: tsx scripts/import-lesson.ts [--local|--remote] <course folder>");
  process.exit(1);
}

const sql = (value: string | number | null) =>
  value === null ? "NULL" : typeof value === "number" ? String(value) : `'${value.replaceAll("'", "''")}'`;

const course: CourseFile = JSON.parse(readFileSync(join(dir, "course.json"), "utf8"));
const courseId = course.slug;
const now = new Date().toISOString();

const statements = [
  `INSERT INTO courses (id, slug, title) VALUES (${sql(courseId)}, ${sql(course.slug)}, ${sql(course.title)})
   ON CONFLICT (id) DO UPDATE SET title = excluded.title;`,
];

let failed = false;
for (const entry of course.lessons) {
  const parsed = Lesson.safeParse(JSON.parse(readFileSync(join(dir, entry.file), "utf8")));
  if (!parsed.success) {
    console.error(`✘ ${entry.file} doesn't match the lesson schema:\n${z_pretty(parsed.error)}`);
    failed = true;
    continue;
  }
  const lesson = parsed.data;
  console.log(`✓ ${entry.file}: "${lesson.title}", ${lesson.modules.length} modules, ${entry.status}`);
  statements.push(
    `INSERT INTO lessons (id, course_id, source_id, position, title, status, content, updated_at, signed_off_at)
     VALUES (${sql(lesson.id)}, ${sql(courseId)}, NULL, ${entry.position}, ${sql(lesson.title)}, ${sql(entry.status)},
             ${sql(JSON.stringify(lesson))}, ${sql(now)}, ${sql(entry.status === "reviewed" ? now : null)})
     ON CONFLICT (id) DO UPDATE SET position = excluded.position, title = excluded.title, status = excluded.status,
       content = excluded.content, updated_at = excluded.updated_at, signed_off_at = excluded.signed_off_at;`,
  );
}
if (failed) process.exit(1);

const file = join(mkdtempSync(join(tmpdir(), "acu-import-")), "import.sql");
writeFileSync(file, statements.join("\n"));
execFileSync("npx", ["wrangler", "d1", "execute", "acu-primer", target, "--file", file], { stdio: "inherit" });

function z_pretty(error: import("zod").ZodError) {
  return error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
}
