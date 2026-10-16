// Drafting and revising with Claude (slices 3b and 6), all behind the author gate. Every call is
// logged in the spend table, and calls stop once the month's spend reaches MONTHLY_BUDGET_USD.

import Anthropic, { toFile } from "@anthropic-ai/sdk";
import { apiKey, draftLesson, reviseStep, type Usage } from "../claude.ts";
import {
  authorLesson,
  courseForDrafting,
  getSource,
  insertDraft,
  monthSpend,
  recordSpend,
  resolveSuggestions,
  saveLessonContent,
  saveSource,
  updateCourse,
} from "../db.ts";
import { json } from "../http.ts";
import type { Ctx } from "../index.ts";
import { changedParts, setFallbackPart, swapAlternative, type EditResult } from "../../shared/lessonEdits.ts";
import { lessonProblems } from "../../shared/lessonChecks.ts";
import { keepSwitches } from "../../shared/wire.ts";
import { OUTCOMES_STEP } from "../../shared/review.ts";
import catalogue from "../../../catalogues/sampling-distributions.json";

const budget = (env: Env) => Number(env.MONTHLY_BUDGET_USD) || 15;

function client(env: Env): Anthropic | null {
  const key = apiKey(env);
  return key ? new Anthropic({ apiKey: key }) : null;
}

// Refuse before spending anything: no key, or the month's budget is used up.
async function readyToSpend(env: Env): Promise<{ ok: true; client: Anthropic } | { ok: false; res: Response }> {
  const c = client(env);
  if (!c) return { ok: false, res: json({ error: "No Claude API key on this server (ANTHROPIC_API_KEY or CLAUDE_API_KEY)." }, 503) };
  const spent = await monthSpend(env.DB);
  if (spent >= budget(env))
    return { ok: false, res: json({ error: `This month's Claude budget ($${budget(env)}) is used up: $${spent.toFixed(2)} spent.` }, 402) };
  return { ok: true, client: c };
}

const log = (env: Env, kind: "draft" | "revise", lessonId: string | null, u: Usage) =>
  recordSpend(env.DB, { kind, model: env.DRAFT_MODEL, lessonId, ...u });

// GET /api/author/budget — what's been spent on Claude this month, against the limit.
export async function getBudget({ env }: Ctx): Promise<Response> {
  return json({ spentUsd: await monthSpend(env.DB), budgetUsd: budget(env), model: env.DRAFT_MODEL, hasKey: !!apiKey(env) });
}

// PUT /api/author/courses/:id — { showUnreviewed?: boolean, brief?: string | null }
export async function putCourse({ env, request }: Ctx, courseId: string): Promise<Response> {
  const body = (await request.json().catch(() => null)) as { showUnreviewed?: unknown; brief?: unknown } | null;
  const change: { showUnreviewed?: boolean; brief?: string | null } = {};
  if (typeof body?.showUnreviewed === "boolean") change.showUnreviewed = body.showUnreviewed;
  if (typeof body?.brief === "string") change.brief = body.brief.trim().slice(0, 4000) || null;
  if (body?.brief === null) change.brief = null;
  if (Object.keys(change).length === 0) return json({ error: "Send { showUnreviewed } and/or { brief }." }, 400);
  if (!(await updateCourse(env.DB, courseId, change))) return json({ error: "No course with that id." }, 404);
  return json({ id: courseId, ...change });
}

// POST /api/author/sources?courseId=&title=&pages= — body: the cut pages as application/pdf.
// Uploads them to Anthropic's Files API (free) and remembers the file id for drafting.
export async function postSource({ env, request, url }: Ctx): Promise<Response> {
  const courseId = url.searchParams.get("courseId") ?? "";
  const title = (url.searchParams.get("title") ?? "").trim();
  const pages = (url.searchParams.get("pages") ?? "").trim();
  if (!courseId || !title || !pages) return json({ error: "Give ?courseId=, &title= and &pages=." }, 400);
  if (!(await courseForDrafting(env.DB, courseId))) return json({ error: "No course with that id." }, 404);
  const c = client(env);
  if (!c) return json({ error: "No Claude API key on this server." }, 503);
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength === 0 || bytes.byteLength > 20 * 1024 * 1024) return json({ error: "Send the cut pages: a PDF up to 20 MB." }, 400);
  const file = await c.files.upload({ file: await toFile(bytes, `${title.replace(/\W+/g, "-")}.pdf`, { type: "application/pdf" }) });
  const id = await saveSource(env.DB, { courseId, title, pages, fileId: file.id });
  return json({ sourceId: id, kb: Math.round(bytes.byteLength / 1024) });
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

// POST /api/author/drafts — { sourceId, section }. Streams progress as one JSON object per
// line ({ chars }), then { done: lessonId, usage } or { error }. The lesson is saved, unreviewed,
// only when it passes every check. A tab closed mid-draft loses that draft (spec failure mode).
export async function postDraft({ env, request }: Ctx): Promise<Response> {
  const body = (await request.json().catch(() => null)) as { sourceId?: unknown; section?: unknown } | null;
  const sourceId = typeof body?.sourceId === "string" ? body.sourceId : "";
  const section = typeof body?.section === "string" ? body.section.trim() : "";
  if (!sourceId || !section) return json({ error: "Send { sourceId, section }." }, 400);
  const source = await getSource(env.DB, sourceId);
  if (!source) return json({ error: "No source with that id. Upload the pages first." }, 404);
  const course = await courseForDrafting(env.DB, source.course_id);
  if (!course) return json({ error: "That source's course is gone." }, 404);
  const ready = await readyToSpend(env);
  if (!ready.ok) return ready.res;

  const lessonId = `${course.id}-${slug(section)}-${crypto.randomUUID().slice(0, 6)}`;
  // The only catalogue so far is for sampling distributions; other topics draft without one.
  const useCatalogue = /sampl|estimat|standard error|proportion/i.test(`${course.title} ${section}`);
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
  const send = (obj: object) => writer.write(new TextEncoder().encode(JSON.stringify(obj) + "\n"));

  (async () => {
    let last = 0;
    let chars = 0;
    // A line every 10 seconds: Opus thinks for minutes before writing anything, and this keeps
    // the author informed and the connection from looking idle.
    const started = Date.now();
    const heartbeat = setInterval(() => send({ alive: Math.round((Date.now() - started) / 1000), phase: chars > 0 ? "writing" : "thinking" }), 10_000);
    try {
      const result = await draftLesson(
        ready.client,
        env.DRAFT_MODEL,
        { fileId: source.anthropic_file_id, lessonId, book: source.title, section, pages: source.pages, brief: course.brief, catalogue: useCatalogue ? catalogue : undefined },
        (n, attempt) => {
          chars = n;
          if (n - last >= 1500) {
            last = n;
            send({ chars: n, attempt });
          }
        },
      );
      await log(env, "draft", result.ok ? lessonId : null, result.usage);
      if (result.ok) {
        await insertDraft(env.DB, course.id, source.id, result.value);
        await send({ done: lessonId, usage: result.usage, seconds: Math.round(result.ms / 1000), attempts: result.attempts });
      } else {
        await send({ error: result.error, usage: result.usage });
      }
    } catch (err) {
      console.error(err);
      await send({ error: err instanceof Anthropic.APIError ? `Claude API: ${err.message}` : "The draft failed on the server." });
    } finally {
      clearInterval(heartbeat);
      await writer.close();
    }
  })();

  return new Response(readable, { headers: { "content-type": "application/x-ndjson", "cache-control": "no-store" } });
}

// POST /api/author/lessons/:id/steps/:stepId/revise — apply the step's open suggestions with
// Claude. The new version replaces the step, keeps the author's switches, and resolves the
// suggestions with a note on what changed. The step then needs approving again.
export async function postRevise({ env }: Ctx, lessonId: string, stepId: string): Promise<Response> {
  const lesson = await authorLesson(env.DB, lessonId);
  if (!lesson) return json({ error: "No lesson with that id." }, 404);
  const open = lesson.review.suggestions.filter((s) => s.stepId === stepId && s.status === "open");
  if (open.length === 0) return json({ error: "This step has no open suggestions to apply." }, 409);
  const ready = await readyToSpend(env);
  if (!ready.ok) return ready.res;
  const course = await courseForDrafting(env.DB, lesson.courseId);

  const result = await reviseStep(ready.client, env.DRAFT_MODEL, {
    lesson: lesson.content,
    stepId,
    instructions: open.map((s) => ({ part: s.part, partLabel: s.partLabel, text: s.text })),
    brief: course?.brief,
  });
  await log(env, "revise", lessonId, result.usage);
  if (!result.ok) return json({ error: result.error, usage: result.usage }, 502);

  let content = lesson.content;
  let note: string;
  if (stepId === OUTCOMES_STEP && result.value.outcomes) {
    content = { ...content, outcomes: result.value.outcomes };
    note = `Claude revised the outcomes ($${result.usage.costUsd.toFixed(3)}).`;
  } else if (result.value.module) {
    const before = content.modules.find((m) => m.id === stepId);
    const after = before ? keepSwitches(before, result.value.module) : result.value.module;
    content = { ...content, modules: content.modules.map((m) => (m.id === stepId ? after : m)) };
    const parts = changedParts(before, after);
    note = parts.length ? `Claude changed: ${parts.join(", ")} ($${result.usage.costUsd.toFixed(3)}).` : "Claude made no changes.";
  } else {
    return json({ error: "The revision came back empty." }, 502);
  }
  await saveLessonContent(env.DB, lessonId, content);
  await resolveSuggestions(env.DB, open.map((s) => s.id), note);
  return json({ lesson: await authorLesson(env.DB, lessonId), usage: result.usage, note });
}

// POST /api/author/lessons/:id/edits — { kind: "swap", moduleId, alternativeId }
//   or { kind: "switch", moduleId, which: number | "general", part, enabled }. No Claude call.
export async function postEdit({ env, request }: Ctx, lessonId: string): Promise<Response> {
  const lesson = await authorLesson(env.DB, lessonId);
  if (!lesson) return json({ error: "No lesson with that id." }, 404);
  const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  let result: EditResult;
  if (b?.kind === "swap" && typeof b.moduleId === "string" && typeof b.alternativeId === "string") {
    result = swapAlternative(lesson.content, b.moduleId, b.alternativeId);
  } else if (
    b?.kind === "switch" &&
    typeof b.moduleId === "string" &&
    (typeof b.which === "number" || b.which === "general") &&
    (b.part === "reExplanation" || b.part === "simplerQuestion") &&
    typeof b.enabled === "boolean"
  ) {
    result = setFallbackPart(lesson.content, b.moduleId, b.which, b.part, b.enabled);
  } else {
    return json({ error: "Send a swap or a switch edit." }, 400);
  }
  if (!result.ok) return json({ error: result.error }, 400);
  const problems = lessonProblems(result.lesson);
  if (problems.length > 0) return json({ error: `That edit would break the lesson: ${problems[0]}` }, 400);
  await saveLessonContent(env.DB, lessonId, result.lesson);
  return json(await authorLesson(env.DB, lessonId));
}
