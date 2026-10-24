<script lang="ts">
  // The author home: subjects, each with its learner brief and its chapters; each chapter with
  // its lessons and marks and the show-unreviewed switch. New subject and New chapter start
  // them (slice 9). The look gets its proper buttons and badges in slice 10.
  import type { AuthorChapter, AuthorSubject } from "../../shared/lesson.ts";
  import { BRIEF_PRESETS } from "../../shared/briefPresets.ts";
  import { authorApi, ApiError } from "../lib/api.ts";
  import { navigate } from "../router.svelte.ts";
  import Mark from "./Mark.svelte";
  import AuthorBar from "./AuthorBar.svelte";
  import BookUp from "@lucide/svelte/icons/book-up";
  import Plus from "@lucide/svelte/icons/plus";
  import WandSparkles from "@lucide/svelte/icons/wand-sparkles";
  import Users from "@lucide/svelte/icons/users";
  import Eye from "@lucide/svelte/icons/eye";
  import PenLine from "@lucide/svelte/icons/pen-line";
  import BookOpen from "@lucide/svelte/icons/book-open";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import DeleteDialog from "./DeleteDialog.svelte";
  import { forgetBook } from "../lib/bookStore.ts";

  let { onLocked }: { onLocked: () => void } = $props();

  let subjects = $state<AuthorSubject[] | null>(null);
  let error = $state("");
  let budget = $state<{ spentUsd: number; budgetUsd: number; model: string; hasKey: boolean } | null>(null);

  function fail(err: unknown) {
    if (err instanceof ApiError && err.status === 401) onLocked();
    else error = err instanceof Error ? err.message : "Something went wrong.";
  }
  const load = () => authorApi.subjects().then((s) => (subjects = s), fail);
  load();
  authorApi.budget().then((b) => (budget = b), fail);

  // --- New subject ------------------------------------------------------------------------
  let newSubject = $state<{ title: string; overview: string; preset: string; brief: string } | null>(null);
  function pickPreset(form: { preset: string; brief: string }, id: string) {
    form.preset = id;
    const p = BRIEF_PRESETS.find((x) => x.id === id);
    if (p) form.brief = p.brief; // fills the box; the author edits from there
  }
  async function createSubject() {
    if (!newSubject?.title.trim()) return;
    try {
      await authorApi.createSubject({ title: newSubject.title, overview: newSubject.overview, brief: newSubject.brief });
      newSubject = null;
      await load();
    } catch (err) {
      fail(err);
    }
  }

  // --- Editing a subject's overview and brief ----------------------------------------------
  let editing = $state<Record<string, { overview: string; preset: string; brief: string }>>({});
  const startEdit = (s: AuthorSubject) => (editing[s.id] = { overview: s.overview ?? "", preset: "", brief: s.brief ?? "" });
  async function saveSubject(s: AuthorSubject) {
    const e = editing[s.id];
    try {
      await authorApi.updateSubject(s.id, { overview: e.overview, brief: e.brief });
      delete editing[s.id];
      await load();
    } catch (err) {
      fail(err);
    }
  }

  // --- New chapter ------------------------------------------------------------------------
  let newChapter = $state<Record<string, { title: string; overview: string }>>({});
  async function createChapter(s: AuthorSubject) {
    const c = newChapter[s.id];
    if (!c?.title.trim()) return;
    try {
      await authorApi.createChapter(s.id, c);
      delete newChapter[s.id];
      await load();
    } catch (err) {
      fail(err);
    }
  }

  async function toggle(chapter: AuthorChapter) {
    const next = !chapter.showUnreviewed;
    try {
      await authorApi.setShowUnreviewed(chapter.id, next);
      chapter.showUnreviewed = next;
    } catch (err) {
      fail(err);
    }
  }

  // Deleting (Oct 24): one dialog for subjects, chapters and lessons.
  type Deleting = { kind: "subject" | "chapter" | "lesson"; id: string; title: string; takes: string; book?: boolean };
  let deleting = $state<Deleting | null>(null);
  const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;
  function askDeleteSubject(s: AuthorSubject) {
    const lessons = s.chapters.reduce((n, c) => n + c.lessons.length, 0);
    deleting = { kind: "subject", id: s.id, title: s.title, takes: `its ${plural(s.chapters.length, "chapter")} and ${plural(lessons, "lesson")}, their reviews, and students' answers in them`, book: !!s.book };
  }
  function askDeleteChapter(c: AuthorChapter) {
    deleting = { kind: "chapter", id: c.id, title: c.title, takes: `its ${plural(c.lessons.length, "lesson")}, their reviews, and students' answers in them` };
  }
  function askDeleteLesson(l: { id: string; title: string }) {
    deleting = { kind: "lesson", id: l.id, title: l.title, takes: "its reviews and suggestions, and students' answers in it" };
  }
  async function confirmDelete(typed: string) {
    if (!deleting) return;
    const d = deleting;
    await authorApi.remove(`${d.kind}s` as "subjects" | "chapters" | "lessons", d.id, typed);
    if (d.kind === "subject" && d.book) await forgetBook(d.id);
    deleting = null;
    await load();
  }

  // Collapsible subjects (Oct 24): the list grows quickly once a book brings 13 chapters. Closed
  // at first; which ones are open is remembered on this browser only, as a convenience.
  const OPEN_KEY = "acu-author-open-subjects";
  let open = $state<Record<string, boolean>>(readOpen());
  function readOpen(): Record<string, boolean> {
    try {
      return JSON.parse(localStorage.getItem(OPEN_KEY) ?? "{}") ?? {};
    } catch {
      return {};
    }
  }
  function setOpen(key: string, value: boolean) {
    open[key] = value;
    try {
      localStorage.setItem(OPEN_KEY, JSON.stringify(open));
    } catch {
      // private window or blocked storage: it just won't be remembered
    }
  }
  const keyOf = (s: AuthorSubject) => s.id || "loose";
  function summary(s: AuthorSubject) {
    const lessons = s.chapters.flatMap((c) => c.lessons);
    const toReview = lessons.filter((l) => l.status !== "reviewed").length;
    return [plural(s.chapters.length, "chapter"), plural(lessons.length, "lesson"), ...(toReview ? [`${toReview} to review`] : [])].join(" · ");
  }

  function go(e: MouseEvent, to: string) {
    e.preventDefault();
    navigate(to);
  }
</script>

<AuthorBar />
<main class="page wide">
  <div class="head">
    <h1>Your subjects</h1>
    {#if !newSubject}
      <span class="starts">
        <a class="btn" href="/author/books/new" onclick={(e) => go(e, "/author/books/new")}><BookUp size={18} aria-hidden="true" />Start from a book</a>
        <button class="btn-secondary" onclick={() => (newSubject = { title: "", overview: "", preset: "", brief: "" })}><Plus size={18} aria-hidden="true" />New subject</button>
      </span>
    {/if}
  </div>
  {#if budget}
    <p class="muted budget">
      <WandSparkles size={14} aria-hidden="true" /> Claude this month: <span class="num">${budget.spentUsd.toFixed(2)}</span> of <span class="num">${budget.budgetUsd}</span> ({budget.model}){budget.hasKey ? "" : ", no API key on this server"}
    </p>
  {/if}
  {#if error}<p class="error">{error}</p>{/if}

  {#if newSubject}
    <section class="form card">
      <h2>New subject</h2>
      <p class="muted">A subject is usually a book; its chapters are its chapters, or single articles.</p>
      <label>Title <input type="text" bind:value={newSubject.title} placeholder="Operating Systems: Three Easy Pieces" /></label>
      <label>Overview, for students <textarea rows="2" bind:value={newSubject.overview} placeholder="What the subject covers, in a sentence or two."></textarea></label>
      <fieldset>
        <legend>Who's learning (the learner brief every draft follows)</legend>
        <div class="presets">
          {#each BRIEF_PRESETS as p (p.id)}
            <button type="button" class="preset" class:on={newSubject.preset === p.id} onclick={() => pickPreset(newSubject!, p.id)}>{p.label}</button>
          {/each}
          <button type="button" class="preset" class:on={newSubject.preset === "own"} onclick={() => ((newSubject!.preset = "own"), (newSubject!.brief = ""))}>Write my own</button>
        </div>
        <textarea rows="4" bind:value={newSubject.brief} placeholder="Pick a profile above to start from, or describe the learner yourself."></textarea>
      </fieldset>
      <div class="row">
        <button class="btn" disabled={!newSubject.title.trim()} onclick={createSubject}>Create subject</button>
        <button class="btn-quiet" onclick={() => (newSubject = null)}>Cancel</button>
      </div>
    </section>
  {/if}

  {#if !subjects}
    <p class="muted">Loading…</p>
  {:else if subjects.length === 0}
    <p class="muted">No subjects yet. Start one with New subject.</p>
  {:else}
    {#each subjects as s (s.id || "loose")}
      {@const isOpen = !!open[keyOf(s)] || !!(s.id && editing[s.id])}
      <section class="subject card">
        <div class="subject-head">
          <h2>
            <button class="toggle" aria-expanded={isOpen} aria-controls="subject-{keyOf(s)}" onclick={() => setOpen(keyOf(s), !isOpen)}>
              <ChevronRight class="chevron" size={20} aria-hidden="true" />
              <BookOpen size={20} aria-hidden="true" />
              <span class="subject-title">
                {s.title}
                <span class="summary muted">{summary(s)}{isOpen ? "" : " · click to open"}</span>
              </span>
            </button>
          </h2>
          {#if isOpen && s.id && !editing[s.id]}
            <span class="links">
              <button class="btn-quiet btn-sm" onclick={() => startEdit(s)}><PenLine size={15} aria-hidden="true" />Edit overview and brief</button>
              <button class="btn-quiet btn-sm danger" onclick={() => askDeleteSubject(s)}><Trash2 size={15} aria-hidden="true" />Delete subject</button>
            </span>
          {/if}
        </div>

        {#if isOpen}
        <div class="subject-body" id="subject-{keyOf(s)}">
        {#if s.id && editing[s.id]}
          {@const e = editing[s.id]}
          <div class="form inner">
            <label>Overview, for students <textarea rows="2" bind:value={e.overview}></textarea></label>
            <fieldset>
              <legend>Learner brief</legend>
              <div class="presets">
                {#each BRIEF_PRESETS as p (p.id)}
                  <button type="button" class="preset" class:on={e.preset === p.id} onclick={() => pickPreset(e, p.id)}>{p.label}</button>
                {/each}
              </div>
              <textarea rows="4" bind:value={e.brief}></textarea>
            </fieldset>
            <div class="row">
              <button class="btn" onclick={() => saveSubject(s)}>Save</button>
              <button class="btn-quiet" onclick={() => delete editing[s.id]}>Cancel</button>
            </div>
          </div>
        {:else if s.id}
          {#if s.overview}<p class="muted">{s.overview}</p>{/if}
          <p class="brief"><span class="label">Learner brief</span> {s.brief ?? "None yet: drafts assume first-year university students."}</p>
        {:else}
          <p class="muted">These chapters aren't in a subject.</p>
        {/if}

        {#each s.chapters as c (c.id)}
          <div class="chapter">
            <div class="chapter-head">
              <h3>{c.title}</h3>
              <span class="links">
                <a class="btn-secondary btn-sm" href="/author/chapters/{c.id}/draft" onclick={(e) => go(e, `/author/chapters/${c.id}/draft`)}><WandSparkles size={15} aria-hidden="true" />Draft lessons</a>
                <a class="btn-quiet btn-sm" href="/author/chapters/{c.id}/students" onclick={(e) => go(e, `/author/chapters/${c.id}/students`)}><Users size={15} aria-hidden="true" />Students</a>
                {#if s.slug}<a class="btn-quiet btn-sm" href="/s/{s.slug}/{c.slug}"><Eye size={15} aria-hidden="true" />As a student</a>{/if}
                <button class="btn-quiet btn-sm danger" aria-label="Delete chapter {c.title}" title="Delete chapter" onclick={() => askDeleteChapter(c)}><Trash2 size={15} aria-hidden="true" /><span class="wide-only">Delete</span></button>
              </span>
            </div>
            {#if c.overview}<p class="muted small">{c.overview}</p>{/if}
            <label class="switch">
              <input type="checkbox" checked={c.showUnreviewed} onchange={() => toggle(c)} />
              Show unreviewed lessons to students
            </label>
            <ul>
              {#each c.lessons as lesson (lesson.id)}
                <li class="lesson">
                  <span class="lesson-title">
                    <span>{lesson.title}</span>
                    <Mark status={lesson.status} short />
                  </span>
                  <a
                    class={lesson.status === "reviewed" ? "btn-secondary btn-sm" : "btn btn-sm"}
                    href="/author/lessons/{lesson.id}"
                    onclick={(e) => go(e, `/author/lessons/${lesson.id}`)}
                  >
                    {lesson.status === "reviewed" ? "View" : "Review"}
                  </a>
                  <button class="btn-quiet btn-sm danger icon" aria-label="Delete lesson {lesson.title}" title="Delete lesson" onclick={() => askDeleteLesson(lesson)}><Trash2 size={15} aria-hidden="true" /></button>
                </li>
              {:else}
                <li class="muted">No lessons yet: use Draft lessons.</li>
              {/each}
            </ul>
          </div>
        {/each}

        {#if s.id}
          {#if newChapter[s.id]}
            {@const nc = newChapter[s.id]}
            <div class="form inner">
              <label>Chapter title <input type="text" bind:value={nc.title} placeholder="Processes and limited direct execution" /></label>
              <label>Overview, for students <textarea rows="2" bind:value={nc.overview}></textarea></label>
              <div class="row">
                <button class="btn" disabled={!nc.title.trim()} onclick={() => createChapter(s)}>Create chapter</button>
                <button class="btn-quiet" onclick={() => delete newChapter[s.id]}>Cancel</button>
              </div>
            </div>
          {:else}
            <button class="btn-secondary btn-sm add" onclick={() => (newChapter[s.id] = { title: "", overview: "" })}><Plus size={15} aria-hidden="true" />New chapter</button>
          {/if}
        {/if}
        </div>
        {/if}
      </section>
    {/each}
  {/if}
</main>

{#if deleting}
  <DeleteDialog kind={deleting.kind} title={deleting.title} takes={deleting.takes} onConfirm={confirmDelete} onClose={() => (deleting = null)} />
{/if}

<style>
  .lesson .lesson-title {
    flex: 1 1 auto;
  }
  .icon {
    padding-left: 0.4rem;
    padding-right: 0.4rem;
  }
  @media (max-width: 480px) {
    .wide-only {
      display: none;
    }
  }
  .starts {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .wide {
    max-width: 52rem;
  }
  .head,
  .subject-head,
  .chapter-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }
  .head h1 {
    margin: 0.4rem 0;
  }
  .budget {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    margin: 0.1rem 0 0;
    font-size: 0.86rem;
  }
  .subject {
    margin-top: 1.4rem;
    padding: 1.2rem 1.25rem 1.3rem;
  }
  h2 {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0;
    font-size: 1.2rem;
  }
  h2 :global(svg) {
    color: var(--accent);
    flex: none;
  }
  .toggle {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.2rem 0.4rem 0.2rem 0.15rem;
    margin-left: -0.15rem;
    border: 0;
    border-radius: var(--radius-sm);
    background: none;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .toggle:hover {
    background: var(--accent-soft);
  }
  .toggle :global(.chevron) {
    transition: transform 160ms ease;
  }
  .toggle[aria-expanded="true"] :global(.chevron) {
    transform: rotate(90deg);
  }
  @media (prefers-reduced-motion: reduce) {
    .toggle :global(.chevron) {
      transition: none;
    }
  }
  .subject-title {
    display: grid;
    gap: 0.1rem;
  }
  .summary {
    font-size: 0.85rem;
    font-weight: 400;
  }

  h3 {
    margin: 0;
    font-size: 1rem;
  }
  .brief {
    font-size: 0.86rem;
    color: var(--text-2);
    margin: 0.5rem 0 0;
  }
  .brief .label {
    margin-right: 0.35rem;
  }
  .chapter {
    margin-top: 1rem;
    padding: 0.95rem 1rem;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius);
  }
  .small {
    font-size: 0.9rem;
    margin: 0.35rem 0 0;
  }
  .links {
    display: flex;
    gap: 0.35rem;
    flex-wrap: wrap;
  }
  .switch {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    margin: 0.7rem 0 0.6rem;
    font-size: 0.88rem;
    font-weight: 400;
    color: var(--text-2);
  }
  ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 0.4rem;
  }
  .lesson {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.75rem;
    padding: 0.55rem 0.7rem;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
  }
  .lesson-title {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.25rem 0.6rem;
    min-width: 0;
  }
  .add {
    margin-top: 0.9rem;
  }
  .form {
    display: grid;
    gap: 0.8rem;
    margin: 1rem 0;
    padding: 1.1rem 1.2rem;
  }
  .form h2 {
    font-size: 1.1rem;
  }
  .form.inner {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius);
  }
  label {
    display: grid;
    gap: 0.3rem;
    font-weight: 600;
    font-size: 0.9rem;
  }
  fieldset {
    border: 0;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 0.5rem;
  }
  legend {
    font-weight: 600;
    font-size: 0.9rem;
    margin-bottom: 0.4rem;
  }
  .presets {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }
  .preset {
    font-size: 0.82rem;
    padding: 0.3rem 0.75rem;
    border-radius: 999px;
    border: 1px solid var(--border-strong);
    background: var(--card);
    transition: border-color 120ms ease, background-color 120ms ease;
  }
  .preset:hover {
    border-color: var(--hover-border);
    background: var(--accent-soft);
  }
  .preset.on {
    border-color: var(--accent);
    background: var(--accent-soft);
    color: var(--accent);
    font-weight: 600;
  }
  .row {
    display: flex;
    gap: 0.6rem;
    align-items: center;
  }
  .error {
    color: var(--wrong);
  }
</style>
