<script lang="ts">
  // The author home: subjects, each with its learner brief and its chapters; each chapter with
  // its lessons and marks and the show-unreviewed switch. New subject and New chapter start
  // them (slice 9). The look gets its proper buttons and badges in slice 10.
  import type { AuthorChapter, AuthorSubject } from "../../shared/lesson.ts";
  import { BRIEF_PRESETS } from "../../shared/briefPresets.ts";
  import { authorApi, ApiError } from "../lib/api.ts";
  import { navigate } from "../router.svelte.ts";
  import ThemeSwitch from "../player/ThemeSwitch.svelte";
  import Mark from "./Mark.svelte";

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

  function go(e: MouseEvent, to: string) {
    e.preventDefault();
    navigate(to);
  }
</script>

<main class="page wide">
  <div class="head">
    <h1>Author</h1>
    <ThemeSwitch />
  </div>
  {#if budget}
    <p class="muted budget">
      Claude this month: <span class="num">${budget.spentUsd.toFixed(2)}</span> of <span class="num">${budget.budgetUsd}</span> ({budget.model}){budget.hasKey ? "" : ", no API key on this server"}.
    </p>
  {/if}
  {#if error}<p class="error">{error}</p>{/if}

  {#if newSubject}
    <section class="form">
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
  {:else}
    <button class="btn new" onclick={() => (newSubject = { title: "", overview: "", preset: "", brief: "" })}>New subject</button>
  {/if}

  {#if !subjects}
    <p class="muted">Loading…</p>
  {:else if subjects.length === 0}
    <p class="muted">No subjects yet. Start one with New subject.</p>
  {:else}
    {#each subjects as s (s.id || "loose")}
      <section class="subject">
        <div class="subject-head">
          <h2>{s.title}</h2>
          {#if s.id && !editing[s.id]}<button class="btn-quiet" onclick={() => startEdit(s)}>Edit overview and brief</button>{/if}
        </div>

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
                <a href="/author/chapters/{c.id}/draft" onclick={(e) => go(e, `/author/chapters/${c.id}/draft`)}>Draft a lesson</a>
                <a href="/author/chapters/{c.id}/students" onclick={(e) => go(e, `/author/chapters/${c.id}/students`)}>Students</a>
                {#if s.slug}<a href="/s/{s.slug}/{c.slug}">Open as a student</a>{/if}
              </span>
            </div>
            {#if c.overview}<p class="muted small">{c.overview}</p>{/if}
            <label class="switch">
              <input type="checkbox" checked={c.showUnreviewed} onchange={() => toggle(c)} />
              Show unreviewed lessons to students
            </label>
            <ul>
              {#each c.lessons as lesson (lesson.id)}
                <li>
                  <a href="/author/lessons/{lesson.id}" onclick={(e) => go(e, `/author/lessons/${lesson.id}`)}>{lesson.title}</a>
                  <span class="right-side">
                    <Mark status={lesson.status} />
                    <a class="review" href="/author/lessons/{lesson.id}" onclick={(e) => go(e, `/author/lessons/${lesson.id}`)}>
                      {lesson.status === "reviewed" ? "View" : "Review"}
                    </a>
                  </span>
                </li>
              {:else}
                <li class="muted">No lessons yet: use Draft a lesson.</li>
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
            <button class="btn-quiet add" onclick={() => (newChapter[s.id] = { title: "", overview: "" })}>+ New chapter</button>
          {/if}
        {/if}
      </section>
    {/each}
  {/if}
</main>

<style>
  .wide {
    max-width: 52rem;
  }
  .head,
  .subject-head,
  .chapter-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 1rem;
    flex-wrap: wrap;
  }
  .budget {
    margin: 0.25rem 0 0;
    font-size: 0.9rem;
  }
  .new {
    margin: 1rem 0 0.5rem;
  }
  .subject {
    margin-top: 1.5rem;
    padding: 1.1rem 1.2rem;
    background: var(--surface);
    border-radius: var(--radius);
  }
  h2 {
    margin: 0;
    font-size: 1.2rem;
  }
  h3 {
    margin: 0;
    font-size: 1rem;
  }
  .brief {
    font-size: 0.88rem;
    color: var(--text-2);
  }
  .label {
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-right: 0.35rem;
  }
  .chapter {
    margin-top: 1rem;
    padding: 0.9rem 1rem;
    background: var(--bg);
    border-radius: var(--radius);
  }
  .small {
    font-size: 0.9rem;
    margin: 0.3rem 0 0;
  }
  .links {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
    font-size: 0.92rem;
  }
  a {
    color: var(--accent);
  }
  .switch {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    margin: 0.6rem 0;
    font-size: 0.9rem;
  }
  ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 0.5rem;
  }
  li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }
  .right-side {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  .review {
    font-weight: 600;
    font-size: 0.9rem;
    padding: 0.2rem 0.7rem;
    border: 1px solid var(--accent);
    border-radius: var(--radius);
    text-decoration: none;
  }
  .add {
    margin-top: 0.9rem;
  }
  .form {
    display: grid;
    gap: 0.8rem;
    margin: 1rem 0;
    padding: 1rem 1.1rem;
    background: var(--surface);
    border-radius: var(--radius);
  }
  .form.inner {
    background: var(--bg);
  }
  label {
    display: grid;
    gap: 0.3rem;
    font-weight: 600;
    font-size: 0.9rem;
  }
  .switch {
    display: flex;
    font-weight: 400;
  }
  textarea,
  input[type="text"] {
    font: inherit;
    font-weight: 400;
    color: var(--text);
    background: var(--bg);
    border: 2px solid var(--border);
    border-radius: var(--radius);
    padding: 0.5rem 0.7rem;
    width: 100%;
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
    padding: 0.25rem 0.7rem;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: var(--bg);
  }
  .preset:hover {
    border-color: var(--hover-border);
  }
  .preset.on {
    border-color: var(--accent);
    color: var(--accent);
    font-weight: 600;
  }
  .row {
    display: flex;
    gap: 1rem;
    align-items: center;
  }
  .error {
    color: var(--wrong);
  }
</style>
