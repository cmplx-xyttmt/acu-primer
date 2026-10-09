// Try one draft from the command line, before (and apart from) the web app:
//
//   npx tsx scripts/try-draft.ts <book.pdf> <pages> <section>
//   npx tsx scripts/try-draft.ts ~/Books/openintro.pdf 170-181 "5.1 Point estimates and sampling variability"
//
// Cuts the pages, uploads them with the Files API, asks Claude for a lesson, and prints
// time, tokens and cost. The lesson goes to content/drafts/ (gitignored). Needs
// ANTHROPIC_API_KEY, read from .dev.vars like the Worker does.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import Anthropic, { toFile } from "@anthropic-ai/sdk";
import { cutPages } from "../src/app/lib/pdfPages.ts";
import { draftLesson } from "../src/worker/claude.ts";

const [pdfPath, pages, section] = process.argv.slice(2);
if (!pdfPath || !pages || !section) {
  console.error('Usage: npx tsx scripts/try-draft.ts <book.pdf> <pages> "<section number and title>"');
  process.exit(1);
}

// Same key the Worker uses locally.
if (!process.env.ANTHROPIC_API_KEY && existsSync(".dev.vars")) {
  const line = readFileSync(".dev.vars", "utf8").match(/^ANTHROPIC_API_KEY=(.+)$/m);
  if (line) process.env.ANTHROPIC_API_KEY = line[1].trim().replace(/^"|"$/g, "");
}
const model = readFileSync("wrangler.jsonc", "utf8").match(/"DRAFT_MODEL":\s*"([^"]+)"/)?.[1] ?? "claude-opus-5-5";
const client = new Anthropic();

const cut = await cutPages(readFileSync(pdfPath), pages);
console.log(`Cut pages ${pages}: ${(cut.length / 1024).toFixed(0)} KB`);

const file = await client.files.upload({
  file: await toFile(cut, `section-${section.split(" ")[0]}.pdf`, { type: "application/pdf" }),
});
console.log(`Uploaded: ${file.id}`);

const catalogue = existsSync("catalogues/sampling-distributions.json")
  ? JSON.parse(readFileSync("catalogues/sampling-distributions.json", "utf8"))
  : { misconceptions: [] };

let last = 0;
const result = await draftLesson(
  client,
  model,
  {
    fileId: file.id,
    lessonId: `draft-${Date.now()}`,
    book: "OpenIntro Statistics, 4th ed.",
    section,
    pages: `pp. ${pages}`,
    catalogue,
  },
  (chars, attempt) => {
    if (chars - last >= 2000) {
      last = chars;
      process.stdout.write(`\r  attempt ${attempt}: ${chars} characters…`);
    }
  },
);
console.log();

const u = result.usage;
console.log(`${model}, ${result.attempts} attempt(s), ${(result.ms / 1000).toFixed(0)} s`);
console.log(`tokens: ${u.input} in, ${u.cacheWrite} cache write, ${u.cacheRead} cache read, ${u.output} out (incl. thinking)`);
console.log(`cost: about $${u.costUsd.toFixed(2)}`);

if (!result.ok) {
  console.error(result.error);
  process.exit(1);
}
mkdirSync("content/drafts", { recursive: true });
const out = `content/drafts/${result.lesson.id}.json`;
writeFileSync(out, JSON.stringify(result.lesson, null, 2) + "\n");
const checks = result.lesson.modules.filter((m) => m.check).length;
console.log(`✓ "${result.lesson.title}": ${result.lesson.modules.length} modules, ${checks} checks → ${out}`);
