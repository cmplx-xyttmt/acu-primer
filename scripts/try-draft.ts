// Try the Claude calls from the command line, apart from the web app. Every call costs money,
// so each run prints its tokens and cost.
//
//   npx tsx scripts/try-draft.ts --probe
//       One tiny lesson, no PDF, low effort: proves the model accepts the lesson schema (cents).
//   npx tsx scripts/try-draft.ts <book.pdf> <pages> "<section>" [--book "<title>"] [--yes]
//       Cuts the pages, counts the input tokens (free), and drafts only with --yes.
//       The lesson goes to content/drafts/ (gitignored).
//
// The key comes from ANTHROPIC_API_KEY or CLAUDE_API_KEY, in the environment or in .env /
// .dev.vars, the same places the Worker reads.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import Anthropic, { toFile } from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { cutPages } from "../src/app/lib/pdfPages.ts";
import { DRAFT_RULES, apiKey, draftLesson, type Usage } from "../src/worker/claude.ts";
import { WIRE_NOTES, WireLesson, lessonFromWire } from "../src/shared/wire.ts";
import { Lesson } from "../src/shared/lesson.ts";
import { lessonProblems } from "../src/shared/lessonChecks.ts";

function fileVars(): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const file of [".env", ".dev.vars"])
    if (existsSync(file))
      for (const line of readFileSync(file, "utf8").split("\n")) {
        const m = line.match(/^([A-Z_]+)=(.*)$/);
        if (m) vars[m[1]] = m[2].trim().replace(/^"|"$/g, "");
      }
  return vars;
}

const key = apiKey({ ...fileVars(), ...process.env });
if (!key) {
  console.error("No ANTHROPIC_API_KEY or CLAUDE_API_KEY in the environment, .env or .dev.vars.");
  process.exit(1);
}
const client = new Anthropic({ apiKey: key });
const model = readFileSync("wrangler.jsonc", "utf8").match(/"DRAFT_MODEL":\s*"([^"]+)"/)?.[1] ?? "claude-opus-5-5";
const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

const report = (u: Usage, ms: number, attempts: number) => {
  console.log(`${model}, ${attempts} attempt(s), ${(ms / 1000).toFixed(0)} s`);
  console.log(`tokens: ${u.input} in, ${u.cacheWrite} cache write, ${u.cacheRead} cache read, ${u.output} out (incl. thinking)`);
  console.log(`cost: about $${u.costUsd.toFixed(3)}`);
};

if (args.includes("--probe")) {
  const started = Date.now();
  const message = await client.messages
    .stream({
      model,
      max_tokens: 16000,
      system: `${DRAFT_RULES}\n\n${WIRE_NOTES}`,
      output_config: { effort: "low", format: zodOutputFormat(WireLesson) },
      messages: [
        {
          role: "user",
          content:
            'Write a very short lesson (2 modules, 1 check, 1 wrong answer, no alternatives) on adding two fractions with the same denominator. Lesson id "probe", source {"book": "probe", "pages": "none"}. There is no course brief and no misconception catalogue.',
        },
      ],
    })
    .finalMessage();
  const u = message.usage;
  const cost = (u.input_tokens * 4 + (u.cache_creation_input_tokens ?? 0) * 5 + u.output_tokens * 20) / 1e6;
  const text = message.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  const wire = lessonFromWire(WireLesson.parse(JSON.parse(text)));
  const parsed = Lesson.safeParse(wire.ok ? wire.lesson : null);
  if (!wire.ok) console.log(`wire conversion: ${wire.problems.join("; ")}`);
  console.log(`stop: ${message.stop_reason}; schema ${parsed.success ? "✓ accepted and the reply validates" : "✘ " + parsed.error.issues[0]?.message}`);
  if (parsed.success) console.log(`code checks: ${lessonProblems(parsed.data).join("; ") || "none"}`);
  console.log(`${model}, ${((Date.now() - started) / 1000).toFixed(0)} s, ${u.input_tokens} in / ${u.output_tokens} out, about $${cost.toFixed(3)}`);
  process.exit(parsed.success ? 0 : 1);
}

const [pdfPath, pages, section] = args.filter((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--book"));
if (!pdfPath || !pages || !section) {
  console.error('Usage: npx tsx scripts/try-draft.ts <book.pdf> <pages> "<section>" [--book "<title>"] [--yes]');
  process.exit(1);
}
const book = flag("--book") ?? "OpenIntro Statistics, 4th ed.";
const cut = await cutPages(readFileSync(pdfPath), pages);
console.log(`Cut pages ${pages}: ${(cut.length / 1024).toFixed(0)} KB`);

const file = await client.files.upload({
  file: await toFile(cut, `section-${section.split(" ")[0]}.pdf`, { type: "application/pdf" }),
});
console.log(`Uploaded (free): ${file.id}`);

const count = await client.messages.countTokens({
  model,
  system: DRAFT_RULES,
  messages: [{ role: "user", content: [{ type: "document", source: { type: "file", file_id: file.id } }, { type: "text", text: section }] }],
});
console.log(`Input: about ${count.input_tokens} tokens = $${((count.input_tokens * 4) / 1e6).toFixed(3)} before output.`);
if (!args.includes("--yes")) {
  console.log("Not drafting: add --yes to spend on the draft (output usually costs more than input).");
  process.exit(0);
}

const catalogue = existsSync("catalogues/sampling-distributions.json")
  ? JSON.parse(readFileSync("catalogues/sampling-distributions.json", "utf8"))
  : undefined;
let last = 0;
const result = await draftLesson(
  client,
  model,
  { fileId: file.id, lessonId: `api-draft-${Date.now()}`, book, section, pages: `pp. ${pages}`, catalogue },
  (chars, attempt) => {
    if (chars - last >= 2000) {
      last = chars;
      process.stdout.write(`\r  attempt ${attempt}: ${chars} characters…`);
    }
  },
);
console.log();
report(result.usage, result.ms, result.attempts);
if (!result.ok) {
  console.error(result.error);
  process.exit(1);
}
mkdirSync("content/drafts", { recursive: true });
const out = `content/drafts/${result.value.id}.json`;
writeFileSync(out, JSON.stringify(result.value, null, 2) + "\n");
const checks = result.value.modules.filter((m) => m.check).length;
console.log(`✓ "${result.value.title}": ${result.value.modules.length} modules, ${checks} checks → ${out}`);
