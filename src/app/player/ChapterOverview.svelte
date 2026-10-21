<script lang="ts">
  import type { ChapterResponse } from "../../shared/lesson.ts";
  import { isComplete, lessonProgress, type ChapterProgress } from "../lib/progress.ts";
  import ThemeSwitch from "./ThemeSwitch.svelte";

  let {
    data,
    name,
    progress,
    onOpen,
    onIntro,
    onChangeName,
  }: {
    data: ChapterResponse;
    name: string;
    progress: ChapterProgress;
    onOpen: (lessonId: string) => void; // straight to where the student stopped
    onIntro: (lessonId: string) => void; // the lesson's outcomes and module list
    onChangeName: () => void;
  } = $props();

  const rows = $derived(
    data.lessons.map((l) => {
      const p = lessonProgress(progress, l.id);
      const ids = l.content.modules.map((m) => m.id);
      return {
        ...l,
        total: ids.length,
        done: ids.filter((id) => p.done.includes(id)).length,
        skipped: ids.filter((id) => p.skipped.includes(id) && !p.done.includes(id)).length,
        completed: isComplete(p, ids),
      };
    }),
  );

  // Continue goes to the first lesson not complete yet: where the student stopped, or back to a
  // skipped module once they have reached the end.
  const next = $derived(rows.find((r) => !r.completed) ?? null);
  const started = $derived(rows.some((r) => r.done > 0 || r.skipped > 0));
</script>

<main class="page">
  <div class="hello">
    <p class="muted">
      Hi, {name}.
      <button class="btn-quiet" onclick={onChangeName}>Not you?</button>
    </p>
    <ThemeSwitch />
  </div>
  {#if data.subject}
    <a class="up" href="/s/{data.subject.slug}">← {data.subject.title}</a>
  {/if}
  <h1>{data.chapter.title}</h1>
  {#if data.chapter.overview}<p class="muted">{data.chapter.overview}</p>{/if}

  {#if rows.length === 0}
    <p class="muted">Nothing is ready in this chapter yet.</p>
  {:else}
    <ul>
      {#each rows as row (row.id)}
        <li>
          <button class="row" onclick={() => onIntro(row.id)}>
            <span class="title">
              {row.content.title}
              {#if row.status === "unreviewed"}<span class="badge">Not yet reviewed</span>{/if}
            </span>
            <span class="num count">
              {row.done} / {row.total}{#if row.skipped > 0}<span class="skipped">· {row.skipped} skipped</span>{/if}
            </span>
            <span class="bar"><span style="width: {(100 * row.done) / row.total}%"></span></span>
          </button>
        </li>
      {/each}
    </ul>

    {#if next}
      <button class="btn" onclick={() => onOpen(next.id)}>{started ? "Continue" : "Start"}</button>
    {:else}
      <p class="muted">You've finished every lesson here. Pick one above to go through it again.</p>
    {/if}
  {/if}
</main>

<style>
  .up {
    display: inline-block;
    margin-top: 0.75rem;
    color: var(--accent);
    font-size: 0.9rem;
  }
  .hello {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
  }
  .hello p {
    margin: 0;
  }
  ul {
    list-style: none;
    padding: 0;
    margin: 1.5rem 0 2rem;
    display: grid;
    gap: 0.75rem;
  }
  .row {
    width: 100%;
    text-align: left;
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 0.5rem 1rem;
    align-items: center;
    background: var(--surface);
    border: 2px solid transparent;
    border-radius: var(--radius);
    padding: 1rem 1.1rem;
  }
  .row:hover {
    border-color: var(--hover-border);
  }
  .title {
    font-weight: 600;
  }
  .skipped {
    color: var(--accent);
    margin-left: 0.4em;
  }
  .count {
    color: var(--text-2);
    font-size: 0.9rem;
  }
  .bar {
    grid-column: 1 / -1;
    height: 4px;
    border-radius: 2px;
    background: var(--border);
    overflow: hidden;
  }
  .bar span {
    display: block;
    height: 100%;
    background: var(--accent);
  }
  .badge {
    margin-left: 0.5rem;
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.1rem 0.45rem;
    border-radius: 999px;
    border: 1px solid var(--accent);
    color: var(--accent);
    white-space: nowrap;
  }
</style>
