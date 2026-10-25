// Draft calls to Claude. Used by the Worker's draft route and by scripts/try-draft.ts, so it
// touches nothing Worker-specific: just the SDK, the lesson schema and the code checks.
//
// One draft = one streamed request with the book pages (by Files API id), the chapter brief, the
// misconception catalogue (if any) and the lesson rules. One revision = one module (or the
// outcomes) and the author's suggestions. Claude must answer in the JSON Schema (structured
// outputs); the reply then has to pass the Zod schema and lessonProblems(); if it doesn't, the
// problems go back to Claude once, and after that the author sees an error.

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { Lesson, Module, type Module as ModuleT } from "../shared/lesson.ts";
import { lessonProblems } from "../shared/lessonChecks.ts";
import { WIRE_NOTES, WireLesson, WireModule, lessonFromWire, moduleFromWire, moduleToWire } from "../shared/wire.ts";

// Kept byte-for-byte stable so the prompt cache can reuse it across drafts.
// When and how to add an exploration (slice 8). Shared with the draft-lesson skill.
export const EXPLORE_RULES = `Explorations:
An exploration is a small interactive piece inside a module: the student locks in a prediction, then changes something and sees what happens. It is only worth adding where all three hold:
1. There is something the student can change (a number, a choice, the next step) and a consequence they can see.
2. Seeing that consequence teaches one of the lesson's outcomes better than reading about it would.
3. Students commonly get the consequence wrong, so a prediction can surprise them.
If any of these fails, add no exploration; most modules have none, and a lesson with none is fine. At most 2 per lesson. In "why", say what the student changes, what they should see, and the misconception it targets. If you can't say all three, leave it out.

Put it in a module's "exploreJson" as a JSON string with these fields:
{"why": "...", "prompt": "what to do", "prediction": {"prompt": "...", "options": [{"id": "a", "text": "..."}, ...2 to 5], "answer": "<the id of the option that matches what the student will see>"}, "thinkAbout": "shown if the prediction didn't match, after the app says what really happens: a short explanation of why, aimed at the thinking behind the wrong predictions", "notice": "what to notice, shown once they've changed something", "widget": <one of the widgets below>}

The widgets (the app draws them; you only configure them):
- Formula: {"kind": "formula", "inputs": [{"id": "n", "label": "Sample size $n$", "values": [25, 100, 400, 1600], "start": 100}], "expression": "sqrt(p * (1 - p) / n)", "result": {"label": "Standard error", "unit": "", "decimals": 3}, "plotOver": "n"}. 1 to 3 inputs, each with 2 to 12 values; "start" is one of them. The expression may use only the input ids, numbers, + - * / ^, parentheses, pi, e, and sqrt abs exp ln log10 log2 sin cos tan floor ceil round min max. Every input must change the result. "plotOver" (optional) is an input id to plot the result across. Use it for anything with a formula.
- Sampling: {"kind": "sampling", "p": 0.88, "sizes": [10, 100, 1000], "start": 10, "draws": 1000}. Draws "draws" random samples of each size from a population where a share p says yes, and plots the sample proportions. For sampling variability in statistics only.
- Stepper: {"kind": "stepper", "frames": [{"caption": "...", "cells": [{"label": "PC", "value": "0x10", "mark": true}, ...]}, ...]}. 2 to 16 steps the student moves through, each a row of up to 12 labelled cells and a caption; cells that change are highlighted for them. Use it for a process over time: an algorithm on an array, a process changing state, a sequence of events. Every frame must be right: check each one against the pages.
- Scenarios: {"kind": "scenarios", "inputs": [{"id": "policy", "label": "Scheduler", "options": [{"id": "fifo", "label": "First come"}, {"id": "sjf", "label": "Shortest first"}]}], "outcomes": [{"when": {"policy": "fifo"}, "text": "..."}, ...]}. 1 to 3 inputs with 2 to 5 options each, and exactly one outcome for every combination. Use it for "what if" comparisons with no formula, in any subject.
Prefer formula or sampling when the result can be computed, so the app computes it; use stepper or scenarios only when it can't. The prediction's answer must be what the widget really shows: work it out from the widget's settings before you write it.`;

export const DRAFT_RULES = `You write interactive lessons for acu-primer, from pages of a textbook or another reading. A chapter author will review and edit every lesson before any student sees it.

Who reads the lesson: the chapter brief, if there is one, says who the learner is and how they want to learn; follow it. Without a brief, assume first-year university students working alone, often on a phone.

What to write: one lesson covering the section in the pages you're given, as JSON matching the schema.

Outcomes first. Write 3 to 5 outcomes: what a student can do by the end, one line each, starting with a verb ("Estimate...", "Explain why..."). Every module must serve one of them, and together the modules must cover the section's main ideas.

Modules:
- One idea per module. Reading is short: at most about 150 words, in 1 to 3 paragraphs.
- A check or an exploration at least every other module. Never two modules in a row without a check, except the last module, which may be a short summary.
- If a stretch of text has no sensible check, split it into more modules instead of writing a trivial check.
- Define every term and symbol in plain words where it's first used, and say again what each symbol means wherever a formula appears.
- Stay with what the pages teach. You may explain it differently, but don't add new methods or facts.

Checks:
- Use only the check types in the schema: "select" (pick one option), "number" (type a number) and "sort" (put each item in its category).
- Sort checks: 2 to 4 categories and 4 to 8 short items, for ideas that come in kinds (which error is which, which state a process is in, which case of a rule applies). Each wrong answer is one item a student would put in a particular wrong category.
- Mostly checks that ask the student to explain why, compare, predict or apply; recall at most a third.
- Number checks: say in the prompt how to round. Set "tolerance" to cover that rounding. Make every wrong-answer range reachable at that rounding, and never overlapping the right answer plus or minus the tolerance.
- Select checks: 3 or 4 options. Wrong options must be things a real student might believe, never jokes. Put the right option in a different position from check to check.
- Every check and alternative has an "explanation": one to three sentences on why the right answer is right, shown after a right answer. Explain the reasoning, don't just restate the answer, so a student who guessed learns why.

Wrong answers and fallbacks:
- Each anticipated wrong answer names the misconception behind it. If you're given a misconception catalogue, use an entry whenever one fits: set source to {"kind": "catalogue", "reference": <the entry's reference>}. Otherwise, or if there's no catalogue for the topic, write your own and set source to {"kind": "model"}. Never label your own guess as "catalogue".
- Each wrong answer gets a fallback aimed at its misconception: a re-explanation from a different angle than the reading (not a repeat of it), and, where it helps, a simpler question on the same idea (one step instead of several, or smaller numbers). Set "enabled": true on both.
- Every check also gets a general fallback for answers nobody anticipated.
- A simpler question never has wrong answers or fallbacks of its own.
- Give each check 1 or 2 alternatives: different checks for the same idea, complete with their own wrong answers and fallbacks, so the author can swap one in.

Text format:
- Paragraphs are separated by a blank line. Inline math is $...$ and display math is $$...$$, in LaTeX. **bold** and *italic* are allowed. No headings, lists, tables or links.
- Remember that LaTeX backslashes must be escaped in JSON ("\\\\hat{p}").
- A dollar sign that isn't math must be written \\\\$.

Ids: modules m1, m2, ...; checks c1, c2, ... in order, alternatives c1a, c1b, ...; options a, b, c, d.

${EXPLORE_RULES}`;

export interface DraftRequest {
  fileId: string; // the cut pages, uploaded with the Files API
  lessonId: string;
  book: string; // e.g. "OpenIntro Statistics, 4th ed."
  section: string; // e.g. "5.1 Point estimates and sampling variability"
  pages: string; // e.g. "pp. 170-180"
  brief?: string | null; // the chapter brief: who the learner is, how they learn
  catalogue?: unknown; // the misconception catalogue for the topic, if there is one
}

export interface Usage {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
  costUsd: number;
}

export type CallResult<T> =
  | { ok: true; value: T; usage: Usage; attempts: number; ms: number }
  | { ok: false; error: string; usage: Usage; attempts: number; ms: number };

/** The API key, under either name (the SDK's ANTHROPIC_API_KEY, or CLAUDE_API_KEY). */
export const apiKey = (env: { ANTHROPIC_API_KEY?: string; CLAUDE_API_KEY?: string }) =>
  env.ANTHROPIC_API_KEY || env.CLAUDE_API_KEY || "";

// $ per million tokens (spec.md > External Services). Cache writes cost 1.25x input.
const RATES: Record<string, { input: number; output: number; cacheRead: number }> = {
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2 },
  "claude-sonnet-5": { input: 2, output: 10, cacheRead: 0.2 },
};

export const emptyUsage = (): Usage => ({ input: 0, output: 0, cacheWrite: 0, cacheRead: 0, costUsd: 0 });

function addUsage(total: Usage, model: string, u: Anthropic.Usage) {
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

// A sentence an author can act on, for errors from the Claude API (a busy API, a rate limit, a
// refused key). Null for anything else, which stays a server error.
export function apiErrorMessage(err: unknown): string | null {
  if (err instanceof Anthropic.APIConnectionError) return "Couldn't reach Claude. Check the connection and try again.";
  if (!(err instanceof Anthropic.APIError)) return null;
  if (err.status === 429) return "Claude has had too many requests for now. Try again in a minute.";
  if (err.status === 529 || (err.status ?? 0) >= 500) return "Claude is busy right now. Try again in a few minutes.";
  if (err.status === 401 || err.status === 403) return "The Claude API key was refused. Check CLAUDE_API_KEY on the server.";
  return `Claude API: ${err.message}`;
}

/**
 * One structured call with a single retry: stream the reply, parse it as JSON, check it with
 * `validate` (schema plus code checks). On problems, Claude sees its reply and the problems
 * once; after that the caller gets an error. Nothing half-valid is ever returned.
 */
async function structuredCall<T>(
  client: Anthropic,
  model: string,
  opts: {
    system: string;
    format: ReturnType<typeof zodOutputFormat>;
    effort: "low" | "medium" | "high";
    maxTokens: number;
    messages: Anthropic.MessageParam[];
    validate: (raw: unknown) => { ok: true; value: T } | { ok: false; problems: string[] };
    onProgress?: (chars: number, attempt: number) => void;
  },
): Promise<CallResult<T>> {
  const started = Date.now();
  const usage = emptyUsage();
  const messages = [...opts.messages];

  for (let attempt = 1; attempt <= 2; attempt++) {
    let chars = 0;
    const stream = client.messages.stream({
      model,
      max_tokens: opts.maxTokens,
      system: [{ type: "text", text: opts.system, cache_control: { type: "ephemeral" } }],
      output_config: { effort: opts.effort, format: opts.format },
      messages,
    });
    stream.on("text", (delta) => {
      chars += delta.length;
      opts.onProgress?.(chars, attempt);
    });
    const fail = (error: string): CallResult<T> => ({ ok: false, error, usage, attempts: attempt, ms: Date.now() - started });
    let message: Anthropic.Message;
    try {
      message = await stream.finalMessage();
    } catch (err) {
      // An API error on the retry still returns the first attempt's usage, so it gets logged.
      const readable = apiErrorMessage(err);
      if (readable === null) throw err;
      return fail(readable);
    }
    addUsage(usage, model, message.usage);

    if (message.stop_reason === "refusal") return fail("Claude declined this request.");
    if (message.stop_reason === "max_tokens") return fail("The reply ran past the length limit.");

    const text = message.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    let problems: string[];
    try {
      const checked = opts.validate(JSON.parse(text));
      if (checked.ok) return { ok: true, value: checked.value, usage, attempts: attempt, ms: Date.now() - started };
      problems = checked.problems;
    } catch {
      problems = ["the reply was not valid JSON"];
    }
    if (attempt === 2) return fail(`The reply didn't come back in a usable form: ${problems.slice(0, 5).join("; ")}`);
    messages.push(
      { role: "assistant", content: message.content },
      {
        role: "user",
        content: `Your reply has these problems. Fix them and return the whole thing again:\n- ${problems.slice(0, 20).join("\n- ")}`,
      },
    );
  }
  throw new Error("unreachable");
}

// Claude writes the flat wire format (src/shared/wire.ts), because the lesson schema itself is
// too big for structured outputs' grammar. Its notes go after the rules, so the system prompt
// stays one stable, cacheable block.
const SYSTEM = `${DRAFT_RULES}\n\n${WIRE_NOTES}`;
const LESSON_FORMAT = zodOutputFormat(WireLesson);

const issues = (e: z.ZodError) => e.issues.map((i) => `${i.path.join(".")}: ${i.message}`);

// Wire → lesson → the lesson schema → the code checks. Any problem goes back for the retry.
function checkLesson(raw: unknown): { ok: true; value: Lesson } | { ok: false; problems: string[] } {
  const wire = WireLesson.safeParse(raw);
  if (!wire.success) return { ok: false, problems: issues(wire.error) };
  const converted = lessonFromWire(wire.data);
  if (!converted.ok) return { ok: false, problems: converted.problems };
  const parsed = Lesson.safeParse(converted.lesson);
  if (!parsed.success) return { ok: false, problems: issues(parsed.error) };
  const problems = lessonProblems(parsed.data);
  return problems.length === 0 ? { ok: true, value: parsed.data } : { ok: false, problems };
}

/** Draft one lesson from book pages. onProgress gets the characters received so far. */
export function draftLesson(
  client: Anthropic,
  model: string,
  req: DraftRequest,
  onProgress?: (chars: number, attempt: number) => void,
): Promise<CallResult<Lesson>> {
  const context = [
    req.brief ? `Chapter brief:\n${req.brief}` : "There is no chapter brief.",
    req.catalogue
      ? `Misconception catalogue for this topic:\n${JSON.stringify(req.catalogue, null, 2)}`
      : "There is no misconception catalogue for this topic, so every misconception is your own and labelled {\"kind\": \"model\"}.",
  ].join("\n\n");
  return structuredCall(client, model, {
    system: SYSTEM,
    format: LESSON_FORMAT,
    effort: "high",
    maxTokens: 64000,
    validate: checkLesson,
    onProgress,
    messages: [
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
              `Write the lesson for ${req.section} of ${req.book} (${req.pages}), from the pages above.\n\n` +
              `Use lesson id "${req.lessonId}" and source {"book": ${JSON.stringify(req.book)}, "pages": ${JSON.stringify(`${req.section}, ${req.pages}`)}}.\n\n` +
              context,
          },
        ],
      },
    ],
  });
}

// --- Revising one step (slice 6) ---------------------------------------------------------

const Outcomes = z.strictObject({ outcomes: z.array(z.string()) });
const OUTCOMES_FORMAT = zodOutputFormat(Outcomes);
const MODULE_FORMAT = zodOutputFormat(WireModule);

export interface ReviseRequest {
  lesson: Lesson; // the whole lesson, for context
  stepId: string; // a module id, or "_outcomes"
  instructions: { part: string; partLabel: string; text: string }[]; // the author's open suggestions
  brief?: string | null;
}

/**
 * Revise one review step to the author's suggestions. Returns the new step: a module, or
 * the outcomes list. The rest of the lesson goes along as context only.
 */
export function reviseStep(
  client: Anthropic,
  model: string,
  req: ReviseRequest,
): Promise<CallResult<{ module?: ModuleT; outcomes?: string[] }>> {
  const isOutcomes = req.stepId === "_outcomes";
  const found = req.lesson.modules.find((m) => m.id === req.stepId);
  const current = isOutcomes ? { outcomes: req.lesson.outcomes } : found ? moduleToWire(found) : null;
  const asks = req.instructions.map((i) => `- On ${i.partLabel} (${i.part}): ${i.text}`).join("\n");
  const text =
    (req.brief ? `Chapter brief:\n${req.brief}\n\n` : "") +
    // Context, kept small to keep the cost down: the lesson's outcomes and its module titles.
    `The lesson "${req.lesson.title}" has these outcomes:\n${req.lesson.outcomes.map((o) => `- ${o}`).join("\n")}\n` +
    `and these modules: ${req.lesson.modules.map((m) => `${m.id} "${m.title}"`).join(", ")}.\n\n` +
    `Revise ${isOutcomes ? "its outcomes" : `module "${req.stepId}"`}, which is currently:\n${JSON.stringify(current, null, 2)}\n\n` +
    `The author asks for these changes:\n${asks}\n\n` +
    `Change what the author asked for, and only that, following the lesson rules. Keep every other field, and every id, exactly as it is. ` +
    `Return the whole ${isOutcomes ? "outcomes object" : "module"}.`;

  type Revised = { module?: ModuleT; outcomes?: string[] };
  return structuredCall<Revised>(client, model, {
    system: SYSTEM,
    format: isOutcomes ? OUTCOMES_FORMAT : MODULE_FORMAT,
    effort: "medium",
    maxTokens: 16000,
    messages: [{ role: "user", content: text }],
    validate: (raw): { ok: true; value: Revised } | { ok: false; problems: string[] } => {
      if (isOutcomes) {
        const parsed = Outcomes.safeParse(raw);
        if (!parsed.success) return { ok: false, problems: issues(parsed.error) };
        const checked = Lesson.shape.outcomes.safeParse(parsed.data.outcomes);
        return checked.success ? { ok: true, value: { outcomes: checked.data } } : { ok: false, problems: issues(checked.error) };
      }
      const wire = WireModule.safeParse(raw);
      if (!wire.success) return { ok: false, problems: issues(wire.error) };
      const converted: string[] = [];
      const parsed = Module.safeParse(moduleFromWire(wire.data, converted));
      if (converted.length > 0) return { ok: false, problems: converted };
      if (!parsed.success) return { ok: false, problems: issues(parsed.error) };
      if (parsed.data.id !== req.stepId) return { ok: false, problems: [`the module id must stay "${req.stepId}"`] };
      // The revised module has to pass the code checks inside the lesson it goes back into.
      const lesson = { ...req.lesson, modules: req.lesson.modules.map((m) => (m.id === req.stepId ? parsed.data : m)) };
      const problems = lessonProblems(lesson);
      return problems.length === 0 ? { ok: true, value: { module: parsed.data } } : { ok: false, problems };
    },
  });
}

import { Contents } from "../shared/bookPlan.ts";

// --- Reading a book's contents pages (starting from a book, Oct 23) ------------------------

const CONTENTS_FORMAT = zodOutputFormat(Contents);

const CONTENTS_SYSTEM = `You are given pages from the start of a book, as a PDF. Find its table of contents among them, and list its chapters and their numbered sections, in order, exactly as printed. If the pages contain no table of contents, return an empty list of chapters.
- Each chapter: its title with its number if it has one ("5 Foundations for inference"), and the page number printed next to it.
- Each section: its title with its number ("5.1 Point estimates and sampling variability") and its printed page.
- Leave out sub-sections below the first level (5.1.1), exercises and chapter reviews. Include front and back matter (Preface, Index, Appendix) as chapters with no sections, so the author can untick them.
- Use the printed page numbers as numbers. If a page number is a roman numeral or missing, use null.
- Copy titles; don't rephrase or invent anything.
- Also report "pageNumberSeen": one page among those you were given that has an ordinary (arabic, not roman) page number printed on it, as its position among the given pages (the first page given is 1) and the number printed on it. Prefer a page after the table of contents. Use null if no given page shows one.`;

/** Read a book's contents pages (a small cut PDF) into chapters and sections, with printed pages. */
export function readContents(client: Anthropic, model: string, pdf: Uint8Array): Promise<CallResult<Contents>> {
  let binary = "";
  for (let i = 0; i < pdf.length; i += 0x8000) binary += String.fromCharCode(...pdf.subarray(i, i + 0x8000));
  return structuredCall<Contents>(client, model, {
    system: CONTENTS_SYSTEM,
    format: CONTENTS_FORMAT,
    effort: "low",
    maxTokens: 12000,
    messages: [
      {
        role: "user",
        content: [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: btoa(binary) } },
          { type: "text", text: "Find the table of contents in these pages and list its chapters and sections." },
        ],
      },
    ],
    // An empty list means "no contents in these pages": the author is asked instead, with no retry.
    validate: (raw) => {
      const c = Contents.safeParse(raw);
      return c.success ? { ok: true, value: c.data } : { ok: false, problems: issues(c.error) };
    },
  });
}
