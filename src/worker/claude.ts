// Draft calls to Claude. Used by the Worker's draft route and by scripts/try-draft.ts, so it
// touches nothing Worker-specific: just the SDK, the lesson schema and the code checks.
//
// One draft = one streamed request with the book pages (by Files API id), the misconception
// catalogue and the lesson rules. Claude must answer in the lesson JSON Schema (structured
// outputs). The reply then has to pass the Zod schema and lessonProblems(); if it doesn't,
// the problems go back to Claude once, and after that the author sees an error.

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { Lesson } from "../shared/lesson.ts";
import { lessonProblems } from "../shared/lessonChecks.ts";

// Kept byte-for-byte stable so the prompt cache can reuse it across drafts.
export const DRAFT_RULES = `You write interactive lessons for acu-primer, from pages of a textbook. A course author will review and edit every lesson before any student sees it.

Who reads the lesson: first-year university students working alone, often on a phone.

What to write: one lesson covering the section in the pages you're given, as JSON matching the schema.

Outcomes first. Write 3 to 5 outcomes: what a student can do by the end, one line each, starting with a verb ("Estimate...", "Explain why..."). Every module must serve one of them, and together the modules must cover the section's main ideas.

Modules:
- One idea per module. Reading is short: at most about 150 words, in 1 to 3 paragraphs.
- A check at least every other module. Never two modules in a row without a check, except the last module, which may be a short summary.
- If a stretch of text has no sensible check, split it into more modules instead of writing a trivial check.
- Define every symbol in plain words where it's first used, and say again what each symbol means wherever a formula appears. Say which quantity is from the sample and which is from the population.
- Stay with what the pages teach. You may explain it differently, but don't add new methods or facts.

Checks:
- Use only the check types in the schema: "select" (pick one option) and "number" (type a number).
- Mix the kinds: some recall, some apply a formula, and at least a third that ask the student to explain why, compare, or predict.
- Number checks: say in the prompt how to round. Set "tolerance" to cover that rounding. Make every wrong-answer range reachable at that rounding, and never overlapping the right answer plus or minus the tolerance.
- Select checks: 3 or 4 options. Wrong options must be things a real student might believe, never jokes.

Wrong answers and fallbacks:
- Each anticipated wrong answer names the misconception behind it. Use the misconception catalogue you're given whenever an entry fits: set source to {"kind": "catalogue", "reference": <the entry's reference>}. If nothing in the catalogue fits, write your own and set source to {"kind": "model"}. Never label your own guess as "catalogue".
- Each wrong answer gets a fallback aimed at its misconception: a re-explanation from a different angle than the reading (not a repeat of it), and, where it helps, a simpler question on the same idea (one step instead of several, or smaller numbers). Set "enabled": true on both.
- Every check also gets a general fallback for answers nobody anticipated.
- A simpler question never has wrong answers or fallbacks of its own.
- Give each check 1 or 2 alternatives: different checks for the same idea, complete with their own wrong answers and fallbacks, so the author can swap one in.

Text format:
- Paragraphs are separated by a blank line. Inline math is $...$ and display math is $$...$$, in LaTeX. **bold** and *italic* are allowed. No headings, lists, tables or links.
- Remember that LaTeX backslashes must be escaped in JSON ("\\\\hat{p}").
- A dollar sign that isn't math must be written \\\\$.

Ids: modules m1, m2, ...; checks c1, c2, ... in order, alternatives c1a, c1b, ...; options a, b, c, d.`;

export interface DraftRequest {
  fileId: string; // the cut pages, uploaded with the Files API
  lessonId: string;
  book: string; // e.g. "OpenIntro Statistics, 4th ed."
  section: string; // e.g. "5.1 Point estimates and sampling variability"
  pages: string; // e.g. "pp. 170-181"
  catalogue: unknown; // the misconception catalogue JSON for this topic
}

export interface DraftUsage {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
  costUsd: number;
}

export type DraftResult =
  | { ok: true; lesson: Lesson; usage: DraftUsage; attempts: number; ms: number }
  | { ok: false; error: string; usage: DraftUsage; attempts: number; ms: number };

// Claude Opus 5.5 rates, $ per million tokens (spec.md > External Services). Sonnet 5 is
// cheaper; the estimate is only for display and the spend log.
const RATES: Record<string, { input: number; output: number; cacheRead: number }> = {
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2 },
  "claude-sonnet-5": { input: 2, output: 10, cacheRead: 0.2 },
};

function addUsage(total: DraftUsage, model: string, u: Anthropic.Usage) {
  const rate = RATES[model] ?? RATES["claude-opus-5-5"];
  total.input += u.input_tokens;
  total.output += u.output_tokens;
  total.cacheWrite += u.cache_creation_input_tokens ?? 0;
  total.cacheRead += u.cache_read_input_tokens ?? 0;
  total.costUsd +=
    (u.input_tokens * rate.input +
      (u.cache_creation_input_tokens ?? 0) * rate.input * 1.25 +
      (u.cache_read_input_tokens ?? 0) * rate.cacheRead +
      u.output_tokens * rate.output) /
    1_000_000;
}

const FORMAT = zodOutputFormat(Lesson);

/**
 * Draft one lesson. onProgress gets the number of JSON characters received so far, so the
 * author can watch it arrive.
 */
export async function draftLesson(
  client: Anthropic,
  model: string,
  req: DraftRequest,
  onProgress?: (chars: number, attempt: number) => void,
): Promise<DraftResult> {
  const started = Date.now();
  const usage: DraftUsage = { input: 0, output: 0, cacheWrite: 0, cacheRead: 0, costUsd: 0 };

  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: [
        {
          type: "document",
          source: { type: "file", file_id: req.fileId },
          title: `${req.book}, ${req.pages}`,
          cache_control: { type: "ephemeral" },
        },
        {
          type: "text",
          text:
            `Write the lesson for section ${req.section} of ${req.book} (${req.pages}), from the pages above.\n\n` +
            `Use lesson id "${req.lessonId}" and source {"book": ${JSON.stringify(req.book)}, "pages": ${JSON.stringify(`Section ${req.section}, ${req.pages}`)}}.\n\n` +
            `Misconception catalogue for this topic:\n${JSON.stringify(req.catalogue, null, 2)}`,
        },
      ],
    },
  ];

  for (let attempt = 1; attempt <= 2; attempt++) {
    let chars = 0;
    const stream = client.messages.stream({
      model,
      max_tokens: 64000,
      system: [{ type: "text", text: DRAFT_RULES, cache_control: { type: "ephemeral" } }],
      output_config: { effort: "high", format: FORMAT },
      messages,
    });
    stream.on("text", (delta) => {
      chars += delta.length;
      onProgress?.(chars, attempt);
    });
    const message = await stream.finalMessage();
    addUsage(usage, model, message.usage);

    const done = (error: string): DraftResult => ({ ok: false, error, usage, attempts: attempt, ms: Date.now() - started });
    if (message.stop_reason === "refusal") return done("Claude declined to write this lesson.");
    if (message.stop_reason === "max_tokens") return done("The draft ran past the length limit.");

    const text = message.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    let problems: string[];
    try {
      const parsed = Lesson.safeParse(JSON.parse(text));
      if (parsed.success) {
        problems = lessonProblems(parsed.data);
        if (problems.length === 0)
          return { ok: true, lesson: parsed.data, usage, attempts: attempt, ms: Date.now() - started };
      } else {
        problems = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
      }
    } catch {
      problems = ["the reply was not valid JSON"];
    }

    if (attempt === 2) return done(`The draft didn't come back in a usable form: ${problems.slice(0, 5).join("; ")}`);
    // One retry: Claude sees its own draft and what was wrong with it.
    messages.push(
      { role: "assistant", content: message.content },
      {
        role: "user",
        content: `That lesson has these problems. Fix them and return the whole lesson again:\n- ${problems.slice(0, 20).join("\n- ")}`,
      },
    );
  }
  throw new Error("unreachable");
}
