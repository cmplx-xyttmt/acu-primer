// Check a course folder's lesson files against the schema and load them into D1.
//
//   npm run import:local -- content/openintro-sampling
//   npm run import:remote -- content/openintro-sampling
//
// The folder holds course.json (slug, title, lessons with file/position/status) and one
// JSON file per lesson. Re-running updates lessons with the same id. A lesson signed off in
// the app keeps its sign-off as long as its content is unchanged; changed content takes the
// status from course.json again, because the sign-off was for the old version.

import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { Lesson } from "../src/shared/lesson.ts";
import { lessonProblems } from "../src/shared/lessonChecks.ts";

interface CourseFile {
  slug: string;
  title: string;
  // Show lessons nobody has signed off yet, with a "Not yet reviewed" mark. Usually set
  // with the switch on the author side; when this is left out, the import doesn't touch it.
  showUnreviewed?: boolean;
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
  `INSERT INTO courses (id, slug, title, show_unreviewed)
   VALUES (${sql(courseId)}, ${sql(course.slug)}, ${sql(course.title)}, ${course.showUnreviewed ? 1 : 0})
   ON CONFLICT (id) DO UPDATE SET title = excluded.title${
     course.showUnreviewed === undefined ? "" : ", show_unreviewed = excluded.show_unreviewed"
   };`,
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
  const problems = lessonProblems(lesson);
  if (problems.length > 0) {
    console.error(`✘ ${entry.file} has problems:\n${problems.map((p) => `  ${p}`).join("\n")}`);
    failed = true;
    continue;
  }
  console.log(`✓ ${entry.file}: "${lesson.title}", ${lesson.modules.length} modules, ${entry.status}`);
  statements.push(
    `INSERT INTO lessons (id, course_id, source_id, position, title, status, content, updated_at, signed_off_at)
     VALUES (${sql(lesson.id)}, ${sql(courseId)}, NULL, ${entry.position}, ${sql(lesson.title)}, ${sql(entry.status)},
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
