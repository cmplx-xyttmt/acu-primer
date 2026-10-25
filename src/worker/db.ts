// Small helpers around D1 queries.

import type { AuthorChapter, AuthorLesson, AuthorSubject, ChapterCard, ChapterResponse, Lesson, LessonStatus, SubjectCard } from "../shared/lesson.ts";
import { reviewState, stepContent, type Suggestion } from "../shared/review.ts";
import type { NewBook } from "../shared/bookPlan.ts";
import type { StudentEvent, StudentSummary } from "../shared/events.ts";

interface ChapterRow {
  id: string;
  slug: string;
  title: string;
  show_unreviewed: number;
}

interface LessonRow {
  id: string;
  position: number;
  status: LessonStatus;
  content: string;
}

// The chapter and every lesson a student may see, in full. Unreviewed lessons are included
// only when the owner has switched that on.
export async function getVisibleChapter(db: D1Database, slug: string): Promise<ChapterResponse | null> {
  const chapter = await db
    .prepare(
      `SELECT c.id, c.slug, c.title, c.overview, c.show_unreviewed, s.slug AS subject_slug, s.title AS subject_title
       FROM chapters c LEFT JOIN subjects s ON s.id = c.subject_id WHERE c.slug = ?`,
    )
    .bind(slug)
    .first<ChapterRow & { overview: string | null; subject_slug: string | null; subject_title: string | null }>();
  if (!chapter) return null;

  const showUnreviewed = chapter.show_unreviewed === 1;
  const { results } = await db
    .prepare(
      `SELECT id, position, status, content FROM lessons
       WHERE chapter_id = ? AND (status = 'reviewed' OR ?)
       ORDER BY position`,
    )
    .bind(chapter.id, showUnreviewed ? 1 : 0)
    .all<LessonRow>();

  return {
    chapter: { slug: chapter.slug, title: chapter.title, overview: chapter.overview, showUnreviewed },
    subject: chapter.subject_slug ? { slug: chapter.subject_slug, title: chapter.subject_title ?? "" } : null,
    lessons: results.map((row) => ({
      id: row.id,
      position: row.position,
      status: row.status,
      content: JSON.parse(row.content),
    })),
  };
}

interface AuthorLessonRow {
  id: string;
  chapter_id: string;
  position: number;
  title: string;
  status: LessonStatus;
  updated_at: string;
  signed_off_at: string | null;
  source_pages?: string | null; // "pp. 32-35", from the pages it was drafted from
}

const lessonSummary = (row: AuthorLessonRow) => ({
  id: row.id,
  chapterId: row.chapter_id,
  position: row.position,
  title: row.title,
  status: row.status,
  updatedAt: row.updated_at,
  signedOffAt: row.signed_off_at,
  sourcePages: row.source_pages ?? null,
});

// Every subject with its chapters, their lessons and marks, for the author's home screen.
// Chapters without a subject come last, in a group with an empty id.
export async function authorSubjects(db: D1Database): Promise<AuthorSubject[]> {
  const [subjects, chapters, lessons] = await db.batch([
    db.prepare("SELECT id, slug, title, overview, brief, book FROM subjects ORDER BY position, title"),
    db.prepare("SELECT id, slug, title, overview, subject_id, show_unreviewed, plan FROM chapters ORDER BY position, title"),
    db.prepare(
      `SELECT l.id, l.chapter_id, l.position, l.title, l.status, l.updated_at, l.signed_off_at, s.pages AS source_pages
       FROM lessons l LEFT JOIN sources s ON s.id = l.source_id ORDER BY l.position`,
    ),
  ]);
  const lessonRows = lessons.results as unknown as AuthorLessonRow[];
  const chapterRows = chapters.results as unknown as (ChapterRow & { overview: string | null; subject_id: string | null; plan: string | null })[];
  const toChapter = (c: (typeof chapterRows)[number]): AuthorChapter => ({
    id: c.id,
    slug: c.slug,
    title: c.title,
    overview: c.overview,
    subjectId: c.subject_id,
    showUnreviewed: c.show_unreviewed === 1,
    lessons: lessonRows.filter((l) => l.chapter_id === c.id).map(lessonSummary),
    plan: c.plan ? JSON.parse(c.plan) : null,
  });
  const result: AuthorSubject[] = (subjects.results as unknown as { id: string; slug: string; title: string; overview: string | null; brief: string | null; book: string | null }[]).map(
    (s) => ({ ...s, book: s.book ? JSON.parse(s.book) : null, chapters: chapterRows.filter((c) => c.subject_id === s.id).map(toChapter) }),
  );
  const loose = chapterRows.filter((c) => !c.subject_id || !result.some((s) => s.id === c.subject_id));
  if (loose.length > 0) result.push({ id: "", slug: "", title: "Chapters without a subject", overview: null, brief: null, book: null, chapters: loose.map(toChapter) });
  return result;
}

// --- The student side: subjects and their chapters ----------------------------------------

// Chapters a student can see: those with at least one visible lesson (reviewed, or any when
// the chapter shows unreviewed lessons). Each card carries its lessons' module ids for progress.
async function visibleChapterCards(db: D1Database, subjectId: string | null): Promise<(ChapterCard & { subjectId: string | null })[]> {
  const { results } = await db
    .prepare(
      `SELECT c.slug, c.title, c.overview, c.subject_id, c.position AS cpos, l.id AS lesson_id, l.title AS lesson_title, l.content, l.position AS lpos
       FROM chapters c JOIN lessons l ON l.chapter_id = c.id
       WHERE (l.status = 'reviewed' OR c.show_unreviewed = 1) ${subjectId === null ? "" : "AND c.subject_id = ?"}
       ORDER BY c.position, c.title, l.position`,
    )
    .bind(...(subjectId === null ? [] : [subjectId]))
    .all<{ slug: string; title: string; overview: string | null; subject_id: string | null; lesson_id: string; lesson_title: string; content: string }>();
  const cards = new Map<string, ChapterCard & { subjectId: string | null }>();
  for (const r of results) {
    if (!cards.has(r.slug)) cards.set(r.slug, { slug: r.slug, title: r.title, overview: r.overview, subjectId: r.subject_id, lessons: [] });
    const modules = (JSON.parse(r.content) as Lesson).modules.map((m) => m.id);
    cards.get(r.slug)!.lessons.push({ id: r.lesson_id, title: r.lesson_title, moduleIds: modules });
  }
  return [...cards.values()];
}

/** The home page: every subject with at least one visible chapter. */
export async function publicSubjects(db: D1Database): Promise<SubjectCard[]> {
  const [subjects, cards] = await Promise.all([
    db.prepare("SELECT id, slug, title, overview FROM subjects ORDER BY position, title").all<{ id: string; slug: string; title: string; overview: string | null }>(),
    visibleChapterCards(db, null),
  ]);
  return subjects.results
    .map((s) => ({ slug: s.slug, title: s.title, overview: s.overview, chapters: cards.filter((c) => c.subjectId === s.id).map(({ subjectId: _, ...c }) => c) }))
    .filter((s) => s.chapters.length > 0);
}

/** A subject's page: its overview and its visible chapters. */
export async function publicSubject(db: D1Database, slug: string): Promise<SubjectCard | null> {
  const s = await db.prepare("SELECT id, slug, title, overview FROM subjects WHERE slug = ?").bind(slug).first<{ id: string; slug: string; title: string; overview: string | null }>();
  if (!s) return null;
  const cards = await visibleChapterCards(db, s.id);
  return { slug: s.slug, title: s.title, overview: s.overview, chapters: cards.map(({ subjectId: _, ...c }) => c) };
}

// --- Creating and editing subjects and chapters (author side) ------------------------------

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "untitled";

// A slug not yet used in the table: "ostep", then "ostep-2", "ostep-3", ... No LIKE here: D1
// refuses LIKE patterns over 50 bytes, and a slug can be 50 characters (Oct 24, a long chapter title).
async function takenSlugs(db: D1Database, table: "subjects" | "chapters", base: string): Promise<Set<string>> {
  const { results } = await db
    .prepare(`SELECT slug FROM ${table} WHERE slug = ? OR substr(slug, 1, ?) = ?`)
    .bind(base, base.length + 1, `${base}-`)
    .all<{ slug: string }>();
  return new Set(results.map((r) => r.slug));
}
const nextFree = (taken: ReadonlySet<string>, base: string) => {
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
};
const freeSlug = async (db: D1Database, table: "subjects" | "chapters", base: string) => nextFree(await takenSlugs(db, table, base), base);

export async function createSubject(db: D1Database, s: { title: string; overview: string | null; brief: string | null }) {
  const slug = await freeSlug(db, "subjects", slugify(s.title));
  const pos = await db.prepare("SELECT COALESCE(MAX(position), 0) + 1 AS next FROM subjects").first<{ next: number }>();
  await db
    .prepare("INSERT INTO subjects (id, slug, title, overview, brief, position, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(slug, slug, s.title, s.overview, s.brief, pos?.next ?? 1, new Date().toISOString())
    .run();
  return { id: slug, slug };
}

export async function updateSubject(db: D1Database, id: string, change: { title?: string; overview?: string | null; brief?: string | null }): Promise<boolean> {
  const sets: string[] = [];
  const values: (string | null)[] = [];
  for (const [k, v] of Object.entries(change)) if (v !== undefined) sets.push(`${k} = ?`), values.push(v);
  if (sets.length === 0) return false;
  const r = await db.prepare(`UPDATE subjects SET ${sets.join(", ")} WHERE id = ?`).bind(...values, id).run();
  return r.meta.changes > 0;
}

export async function createChapter(db: D1Database, subjectId: string, c: { title: string; overview: string | null }) {
  const subject = await db.prepare("SELECT id FROM subjects WHERE id = ?").bind(subjectId).first();
  if (!subject) return null;
  const slug = await freeSlug(db, "chapters", slugify(c.title));
  const pos = await db.prepare("SELECT COALESCE(MAX(position), 0) + 1 AS next FROM chapters WHERE subject_id = ?").bind(subjectId).first<{ next: number }>();
  await db
    .prepare("INSERT INTO chapters (id, slug, title, overview, subject_id, position, show_unreviewed) VALUES (?, ?, ?, ?, ?, ?, 0)")
    .bind(slug, slug, c.title, c.overview, subjectId, pos?.next ?? 1)
    .run();
  return { id: slug, slug };
}

/** A subject made from a book, with its chapters, in one batch (POST /api/author/books), so a
 *  failure leaves nothing half made. Slugs are worked out first, then everything is written at once. */
export async function createBook(db: D1Database, b: NewBook): Promise<{ id: string; slug: string }> {
  const slug = await freeSlug(db, "subjects", slugify(b.subject.title));
  const pos = await db.prepare("SELECT COALESCE(MAX(position), 0) + 1 AS next FROM subjects").first<{ next: number }>();
  const taken = new Set<string>();
  const chapterSlugs: string[] = [];
  for (const c of b.chapters) {
    const base = slugify(c.title);
    for (const t of await takenSlugs(db, "chapters", base)) taken.add(t);
    const s = nextFree(taken, base);
    taken.add(s);
    chapterSlugs.push(s);
  }
  await db.batch([
    db
      .prepare("INSERT INTO subjects (id, slug, title, overview, brief, position, created_at, book) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(slug, slug, b.subject.title, b.subject.overview || null, b.subject.brief || null, pos?.next ?? 1, new Date().toISOString(), JSON.stringify(b.book)),
    ...b.chapters.map((c, i) =>
      db
        .prepare("INSERT INTO chapters (id, slug, title, overview, subject_id, position, show_unreviewed, plan) VALUES (?, ?, ?, ?, ?, ?, 0, ?)")
        .bind(chapterSlugs[i], chapterSlugs[i], c.title, c.overview || null, slug, i + 1, JSON.stringify(c.plan)),
    ),
  ]);
  return { id: slug, slug };
}

// --- Deleting (Oct 24) ---------------------------------------------------------------------
// A delete takes everything inside with it: lessons, their approvals and suggestions, uploaded
// sources, and students' events. The spend log stays, as the record of what Claude cost.

/** What a delete would remove, for the confirmation, or null if there's no such thing. */
export async function deletionSummary(db: D1Database, kind: "subject" | "chapter" | "lesson", id: string) {
  const row = await db.prepare(`SELECT title FROM ${kind === "subject" ? "subjects" : kind === "chapter" ? "chapters" : "lessons"} WHERE id = ?`).bind(id).first<{ title: string }>();
  if (!row) return null;
  const chapterIds =
    kind === "subject"
      ? (await db.prepare("SELECT id FROM chapters WHERE subject_id = ?").bind(id).all<{ id: string }>()).results.map((r) => r.id)
      : kind === "chapter"
        ? [id]
        : [];
  return { title: row.title, chapterIds };
}

const lessonStatements = (db: D1Database, where: string, value: string) => [
  db.prepare(`DELETE FROM step_approvals WHERE lesson_id IN (SELECT id FROM lessons WHERE ${where})`).bind(value),
  db.prepare(`DELETE FROM suggestions WHERE lesson_id IN (SELECT id FROM lessons WHERE ${where})`).bind(value),
];

export async function deleteLesson(db: D1Database, id: string) {
  await db.batch([
    ...lessonStatements(db, "id = ?", id),
    db.prepare("DELETE FROM events WHERE lesson_id = ?").bind(id),
    db.prepare("DELETE FROM lessons WHERE id = ?").bind(id),
  ]);
}

const chapterStatements = (db: D1Database, id: string) => [
  ...lessonStatements(db, "chapter_id = ?", id),
  db.prepare("DELETE FROM events WHERE chapter_id = ?").bind(id),
  db.prepare("DELETE FROM lessons WHERE chapter_id = ?").bind(id),
  db.prepare("DELETE FROM sources WHERE chapter_id = ?").bind(id),
  db.prepare("DELETE FROM chapters WHERE id = ?").bind(id),
];

export async function deleteChapter(db: D1Database, id: string) {
  await db.batch(chapterStatements(db, id));
}

export async function deleteSubject(db: D1Database, id: string, chapterIds: string[]) {
  await db.batch([...chapterIds.flatMap((c) => chapterStatements(db, c)), db.prepare("DELETE FROM subjects WHERE id = ?").bind(id)]);
}

async function sha256(value: unknown): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(value)));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

interface SuggestionRow {
  id: string;
  lesson_id: string;
  step_id: string;
  part: string;
  part_label: string;
  text: string;
  status: Suggestion["status"];
  note: string | null;
  created_at: string;
  resolved_at: string | null;
}

const suggestionFromRow = (r: SuggestionRow): Suggestion => ({
  id: r.id,
  lessonId: r.lesson_id,
  stepId: r.step_id,
  part: r.part,
  partLabel: r.part_label,
  text: r.text,
  status: r.status,
  note: r.note,
  createdAt: r.created_at,
  resolvedAt: r.resolved_at,
});

// Approvals count only while the step's content still hashes the same as when approved.
async function reviewFor(db: D1Database, lessonId: string, content: Lesson) {
  const [approvals, suggestions] = await db.batch([
    db.prepare("SELECT step_id, content_hash FROM step_approvals WHERE lesson_id = ?").bind(lessonId),
    db.prepare("SELECT * FROM suggestions WHERE lesson_id = ? ORDER BY created_at").bind(lessonId),
  ]);
  const approvedSteps: string[] = [];
  for (const a of approvals.results as unknown as { step_id: string; content_hash: string }[]) {
    const current = stepContent(content, a.step_id);
    if (current !== null && (await sha256(current)) === a.content_hash) approvedSteps.push(a.step_id);
  }
  return {
    approvedSteps,
    suggestions: (suggestions.results as unknown as SuggestionRow[]).map(suggestionFromRow),
  };
}

export async function authorLesson(db: D1Database, lessonId: string): Promise<AuthorLesson | null> {
  const row = await db
    .prepare(
      "SELECT id, chapter_id, position, title, status, updated_at, signed_off_at, content FROM lessons WHERE id = ?",
    )
    .bind(lessonId)
    .first<AuthorLessonRow & { content: string }>();
  if (!row) return null;
  const content = JSON.parse(row.content) as Lesson;
  return { ...lessonSummary(row), content, review: await reviewFor(db, lessonId, content) };
}

export type ReviewResult = { ok: true; lesson: AuthorLesson } | { ok: false; status: 404 | 409; error: string };

// One sign-off per lesson, allowed only when every step is approved and nothing is open.
export async function signOffLesson(db: D1Database, lessonId: string): Promise<ReviewResult> {
  const lesson = await authorLesson(db, lessonId);
  if (!lesson) return { ok: false, status: 404, error: "No lesson with that id." };
  const state = reviewState(lesson.content, new Set(lesson.review.approvedSteps), lesson.review.suggestions);
  if (!state.canSignOff) return { ok: false, status: 409, error: `Not ready to sign off: ${state.blockers.join(", ")}.` };
  await db
    .prepare("UPDATE lessons SET status = 'reviewed', signed_off_at = ? WHERE id = ?")
    .bind(new Date().toISOString(), lessonId)
    .run();
  return { ok: true, lesson: (await authorLesson(db, lessonId))! };
}

export async function approveStep(db: D1Database, lessonId: string, stepId: string): Promise<ReviewResult> {
  const lesson = await authorLesson(db, lessonId);
  if (!lesson) return { ok: false, status: 404, error: "No lesson with that id." };
  const content = stepContent(lesson.content, stepId);
  if (content === null) return { ok: false, status: 404, error: "No step with that id in this lesson." };
  if (lesson.review.suggestions.some((g) => g.stepId === stepId && g.status === "open"))
    return { ok: false, status: 409, error: "This step has an open suggestion. Withdraw it or let the revision resolve it first." };
  await db
    .prepare(
      `INSERT INTO step_approvals (lesson_id, step_id, content_hash, approved_at) VALUES (?, ?, ?, ?)
       ON CONFLICT (lesson_id, step_id) DO UPDATE SET content_hash = excluded.content_hash, approved_at = excluded.approved_at`,
    )
    .bind(lessonId, stepId, await sha256(content), new Date().toISOString())
    .run();
  return { ok: true, lesson: (await authorLesson(db, lessonId))! };
}

export async function unapproveStep(db: D1Database, lessonId: string, stepId: string): Promise<ReviewResult> {
  await db.prepare("DELETE FROM step_approvals WHERE lesson_id = ? AND step_id = ?").bind(lessonId, stepId).run();
  const lesson = await authorLesson(db, lessonId);
  return lesson ? { ok: true, lesson } : { ok: false, status: 404, error: "No lesson with that id." };
}

// A new suggestion also takes back that step's approval: the author wants it changed.
export async function addSuggestion(
  db: D1Database,
  lessonId: string,
  s: { stepId: string; part: string; partLabel: string; text: string },
): Promise<ReviewResult> {
  const lesson = await authorLesson(db, lessonId);
  if (!lesson) return { ok: false, status: 404, error: "No lesson with that id." };
  if (stepContent(lesson.content, s.stepId) === null)
    return { ok: false, status: 404, error: "No step with that id in this lesson." };
  await db.batch([
    db
      .prepare(
        "INSERT INTO suggestions (id, lesson_id, step_id, part, part_label, text, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'open', ?)",
      )
      .bind(crypto.randomUUID(), lessonId, s.stepId, s.part, s.partLabel, s.text, new Date().toISOString()),
    db.prepare("DELETE FROM step_approvals WHERE lesson_id = ? AND step_id = ?").bind(lessonId, s.stepId),
  ]);
  return { ok: true, lesson: (await authorLesson(db, lessonId))! };
}

// The author withdraws an open suggestion (resolving is the revision's job, done by script).
export async function withdrawSuggestion(db: D1Database, suggestionId: string): Promise<ReviewResult> {
  const row = await db.prepare("SELECT lesson_id, status FROM suggestions WHERE id = ?").bind(suggestionId).first<{
    lesson_id: string;
    status: string;
  }>();
  if (!row) return { ok: false, status: 404, error: "No suggestion with that id." };
  if (row.status !== "open") return { ok: false, status: 409, error: "Only an open suggestion can be withdrawn." };
  await db
    .prepare("UPDATE suggestions SET status = 'withdrawn', resolved_at = ? WHERE id = ?")
    .bind(new Date().toISOString(), suggestionId)
    .run();
  return { ok: true, lesson: (await authorLesson(db, row.lesson_id))! };
}


// Save a batch of student events, ignoring ids already saved (a batch can arrive twice).
// Returns how many were accepted (already-saved ids among them are ignored by the database)
// and how many named a chapter students can't see (those are skipped): one that doesn't exist,
// or has no lesson a student can open.
export async function saveEvents(db: D1Database, events: StudentEvent[]): Promise<{ accepted: number; unknownChapter: number }> {
  const slugs = [...new Set(events.map((e) => e.chapterSlug))];
  const known = await db
    .prepare(
      `SELECT c.id, c.slug FROM chapters c
       WHERE c.slug IN (${slugs.map(() => "?").join(",")})
         AND EXISTS (SELECT 1 FROM lessons l WHERE l.chapter_id = c.id AND (l.status = 'reviewed' OR c.show_unreviewed = 1))`,
    )
    .bind(...slugs)
    .all<{ id: string; slug: string }>();
  const chapterIds = new Map(known.results.map((c) => [c.slug, c.id]));
  const now = new Date().toISOString();
  const statements = events
    .filter((e) => chapterIds.has(e.chapterSlug))
    .map((e) =>
      db
        .prepare(
          `INSERT OR IGNORE INTO events (id, chapter_id, lesson_id, student_name, device_id, type, payload, client_time, received_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(e.id, chapterIds.get(e.chapterSlug)!, e.lessonId, e.studentName, e.deviceId, e.type, JSON.stringify(e.payload), e.clientTime, now),
    );
  if (statements.length > 0) await db.batch(statements);
  return { accepted: statements.length, unknownChapter: events.length - statements.length };
}

// Students who have opened a chapter: one row per name (ignoring case) and device.
export async function chapterStudents(db: D1Database, chapterId: string): Promise<StudentSummary[]> {
  const { results } = await db
    .prepare(
      `SELECT MAX(student_name) AS name, device_id, MAX(client_time) AS last_seen,
              COUNT(DISTINCT lesson_id) AS lessons, COUNT(*) AS events
       FROM events WHERE chapter_id = ?
       GROUP BY LOWER(TRIM(student_name)), device_id
       ORDER BY last_seen DESC`,
    )
    .bind(chapterId)
    .all<{ name: string; device_id: string; last_seen: string; lessons: number; events: number }>();
  return results.map((r) => ({ name: r.name, deviceId: r.device_id, lastSeen: r.last_seen, lessons: r.lessons, events: r.events }));
}

export interface LoggedEvent {
  id: string;
  lessonId: string | null;
  type: string;
  payload: Record<string, unknown>;
  clientTime: string;
}

// One student's events in the order they happened on their device (not the order they arrived,
// which differs for events sent after being offline).
export async function studentEvents(db: D1Database, chapterId: string, name: string, deviceId: string): Promise<LoggedEvent[]> {
  const { results } = await db
    .prepare(
      `SELECT id, lesson_id, type, payload, client_time FROM events
       WHERE chapter_id = ? AND LOWER(TRIM(student_name)) = LOWER(TRIM(?)) AND device_id = ?
       ORDER BY client_time, received_at`,
    )
    .bind(chapterId, name, deviceId)
    .all<{ id: string; lesson_id: string | null; type: string; payload: string; client_time: string }>();
  return results.map((r) => ({ id: r.id, lessonId: r.lesson_id, type: r.type, payload: JSON.parse(r.payload), clientTime: r.client_time }));
}

// --- Drafting and revising with Claude (slices 3b and 6) --------------------------------

const monthStart = () => new Date().toISOString().slice(0, 7) + "-01";

export async function monthSpend(db: D1Database): Promise<number> {
  const row = await db.prepare("SELECT COALESCE(SUM(cost_usd), 0) AS total FROM spend WHERE at >= ?").bind(monthStart()).first<{ total: number }>();
  return row?.total ?? 0;
}

export async function recordSpend(
  db: D1Database,
  s: { kind: "draft" | "revise" | "contents"; model: string; lessonId: string | null; input: number; output: number; cacheWrite: number; cacheRead: number; costUsd: number },
) {
  await db
    .prepare(
      `INSERT INTO spend (id, at, kind, model, lesson_id, input_tokens, output_tokens, cache_write_tokens, cache_read_tokens, cost_usd)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(crypto.randomUUID(), new Date().toISOString(), s.kind, s.model, s.lessonId, s.input, s.output, s.cacheWrite, s.cacheRead, s.costUsd)
    .run();
}

export async function chapterForDrafting(db: D1Database, chapterId: string) {
  // The brief lives on the chapter's subject (slice 9).
  return db
    .prepare("SELECT c.id, c.slug, c.title, s.brief FROM chapters c LEFT JOIN subjects s ON s.id = c.subject_id WHERE c.id = ?")
    .bind(chapterId)
    .first<{ id: string; slug: string; title: string; brief: string | null }>();
}

export async function updateChapter(db: D1Database, chapterId: string, change: { showUnreviewed?: boolean; title?: string; overview?: string | null }): Promise<boolean> {
  const sets: string[] = [];
  const values: (string | number | null)[] = [];
  if (change.showUnreviewed !== undefined) sets.push("show_unreviewed = ?"), values.push(change.showUnreviewed ? 1 : 0);
  if (change.title !== undefined) sets.push("title = ?"), values.push(change.title);
  if (change.overview !== undefined) sets.push("overview = ?"), values.push(change.overview);
  if (sets.length === 0) return false;
  const result = await db.prepare(`UPDATE chapters SET ${sets.join(", ")} WHERE id = ?`).bind(...values, chapterId).run();
  return result.meta.changes > 0;
}

export async function saveSource(db: D1Database, s: { chapterId: string; title: string; pages: string; fileId: string }): Promise<string> {
  const id = crypto.randomUUID();
  await db
    .prepare("INSERT INTO sources (id, chapter_id, title, pages, anthropic_file_id, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(id, s.chapterId, s.title, s.pages, s.fileId, new Date().toISOString())
    .run();
  return id;
}

export async function getSource(db: D1Database, sourceId: string) {
  return db
    .prepare("SELECT id, chapter_id, title, pages, anthropic_file_id FROM sources WHERE id = ?")
    .bind(sourceId)
    .first<{ id: string; chapter_id: string; title: string; pages: string; anthropic_file_id: string }>();
}

// A new draft goes at the end of its chapter, unreviewed.
export async function insertDraft(db: D1Database, chapterId: string, sourceId: string, lesson: Lesson) {
  const pos = await db.prepare("SELECT COALESCE(MAX(position), 0) + 1 AS next FROM lessons WHERE chapter_id = ?").bind(chapterId).first<{ next: number }>();
  await db
    .prepare(
      `INSERT INTO lessons (id, chapter_id, source_id, position, title, status, content, updated_at, signed_off_at)
       VALUES (?, ?, ?, ?, ?, 'unreviewed', ?, ?, NULL)`,
    )
    .bind(lesson.id, chapterId, sourceId, pos?.next ?? 1, lesson.title, JSON.stringify(lesson), new Date().toISOString())
    .run();
}

/** Save edited content. Changed content voids a sign-off: the sign-off was for the old version.
 *  (Approvals of unchanged steps survive, because they're checked by hash.) */
export async function saveLessonContent(db: D1Database, lessonId: string, content: Lesson) {
  await db
    .prepare(
      `UPDATE lessons SET content = ?1, title = ?2, updated_at = ?3,
         status = CASE WHEN content = ?1 THEN status ELSE 'unreviewed' END,
         signed_off_at = CASE WHEN content = ?1 THEN signed_off_at ELSE NULL END
       WHERE id = ?4`,
    )
    .bind(JSON.stringify(content), content.title, new Date().toISOString(), lessonId)
    .run();
}

export async function resolveSuggestions(db: D1Database, ids: string[], note: string) {
  if (ids.length === 0) return;
  const now = new Date().toISOString();
  await db.batch(
    ids.map((id) =>
      db.prepare("UPDATE suggestions SET status = 'resolved', note = ?, resolved_at = ? WHERE id = ? AND status = 'open'").bind(note, now, id),
    ),
  );
}
