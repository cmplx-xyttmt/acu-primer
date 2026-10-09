// Check a lesson file the way the Worker will check a draft from the API: the Zod schema,
// then lessonProblems() (the checks done by code). Exits non-zero if anything is wrong.
//
//   npx tsx scripts/check-lesson.ts content/<course>/<lesson>.json

import { readFileSync } from "node:fs";
import { Lesson } from "../src/shared/lesson.ts";
import { lessonProblems } from "../src/shared/lessonChecks.ts";

const path = process.argv[2];
if (!path) {
  console.error("Usage: npx tsx scripts/check-lesson.ts <lesson.json>");
  process.exit(1);
}

let raw: unknown;
try {
  raw = JSON.parse(readFileSync(path, "utf8"));
} catch (err) {
  console.error(`✘ ${path} isn't valid JSON: ${(err as Error).message}`);
  process.exit(1);
}

const parsed = Lesson.safeParse(raw);
if (!parsed.success) {
  console.error(`✘ ${path} doesn't match the lesson schema:`);
  for (const issue of parsed.error.issues.slice(0, 30)) console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
  process.exit(1);
}

const lesson = parsed.data;
const problems = lessonProblems(lesson);
if (problems.length > 0) {
  console.error(`✘ ${path} has ${problems.length} problem(s):`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

const checks = lesson.modules.flatMap((m) => (m.check ? [m.check] : []));
const wrong = checks.flatMap((c) => c.wrongAnswers.map((w) => w.misconception));
const fromCatalogue = wrong.filter((m) => m.source.kind === "catalogue").length;
console.log(`✓ "${lesson.title}"`);
console.log(`  ${lesson.outcomes.length} outcomes, ${lesson.modules.length} modules, ${checks.length} checks`);
console.log(`  ${wrong.length} known wrong answers: ${fromCatalogue} from the catalogue, ${wrong.length - fromCatalogue} the model's guesses`);
console.log(`  ${checks.reduce((n, c) => n + c.alternatives.length, 0)} alternative checks for the author to choose from`);
