<script lang="ts">
  import type { CourseResponse } from "../../shared/lesson.ts";
  import { lessonProgress, type CourseProgress } from "../lib/progress.ts";
  import ThemeSwitch from "./ThemeSwitch.svelte";

  let {
    data,
    name,
    progress,
    onOpen,
    onChangeName,
  }: {
    data: CourseResponse;
    name: string;
    progress: CourseProgress;
    onOpen: (lessonId: string) => void;
    onChangeName: () => void;
  } = $props();

  const rows = $derived(
    data.lessons.map((l) => {
      const p = lessonProgress(progress, l.id);
      const total = l.content.modules.length;
      return { ...l, total, done: p.completed ? total : p.done.length, completed: p.completed };
    }),
  );

  // Continue goes to the first lesson not finished yet, at the module where the student stopped.
  const next = $derived(rows.find((r) => !r.completed) ?? null);
  const started = $derived(rows.some((r) => r.done > 0));
</script>

<main class="page">
  <div class="hello">
    <p class="muted">
      Hi, {name}.
      <button class="btn-quiet" onclick={onChangeName}>Not you?</button>
    </p>
    <ThemeSwitch />
  </div>
  <h1>{data.course.title}</h1>

  {#if rows.length === 0}
    <p class="muted">Nothing is ready in this course yet.</p>
  {:else}
    <ul>
      {#each rows as row (row.id)}
        <li>
          <button class="row" onclick={() => onOpen(row.id)}>
            <span class="title">
              {row.content.title}
              {#if row.status === "unreviewed"}<span class="badge">Not yet reviewed</span>{/if}
            </span>
            <span class="num count">{row.done} / {row.total}</span>
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
