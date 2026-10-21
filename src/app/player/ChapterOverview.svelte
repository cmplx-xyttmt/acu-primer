<script lang="ts">
  import type { ChapterResponse } from "../../shared/lesson.ts";
  import { isComplete, lessonProgress, type ChapterProgress } from "../lib/progress.ts";
  import ThemeSwitch from "./ThemeSwitch.svelte";
  import Logo from "../Logo.svelte";
  import ArrowLeft from "@lucide/svelte/icons/arrow-left";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import Check from "@lucide/svelte/icons/check";
  import Play from "@lucide/svelte/icons/play";

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

<div class="topbar">
  <a class="home" href="/" aria-label="All subjects"><Logo size={24} /></a>
  <span class="who">
    <span class="muted">{name}</span>
    <button class="btn-quiet btn-sm" onclick={onChangeName}>Not you?</button>
    <ThemeSwitch />
  </span>
</div>

<main class="page">
  <section class="banner">
    {#if data.subject}
      <a class="up" href="/s/{data.subject.slug}"><ArrowLeft size={14} aria-hidden="true" />{data.subject.title}</a>
    {/if}
    <h1>{data.chapter.title}</h1>
    {#if data.chapter.overview}<p class="muted lede">{data.chapter.overview}</p>{/if}
  </section>

  {#if rows.length === 0}
    <p class="muted">Nothing is ready in this chapter yet.</p>
  {:else}
    <ul>
      {#each rows as row, i (row.id)}
        <li>
          <button class="row card" onclick={() => onIntro(row.id)}>
            <span class="step-dot num" class:complete={row.completed}>
              {#if row.completed}<Check size={16} aria-hidden="true" />{:else}{i + 1}{/if}
            </span>
            <span class="text">
              <span class="title">{row.content.title}</span>
              <span class="meta">
                <span class="num">{row.done} / {row.total} modules</span>
                {#if row.skipped > 0}<span class="badge badge-draft">{row.skipped} skipped</span>{/if}
                {#if row.status === "unreviewed"}<span class="badge badge-draft">Not yet reviewed</span>{/if}
              </span>
              <span class="bar"><span style="width: {(100 * row.done) / row.total}%"></span></span>
            </span>
            <ChevronRight size={20} aria-hidden="true" />
          </button>
        </li>
      {/each}
    </ul>

    {#if next}
      <button class="btn go" onclick={() => onOpen(next.id)}>
        <Play size={17} aria-hidden="true" />{started ? "Continue" : "Start"}
      </button>
    {:else}
      <p class="done"><span class="badge badge-done"><Check size={14} aria-hidden="true" />Finished</span> You've finished every lesson here. Pick one above to go through it again.</p>
    {/if}
  {/if}
</main>

<style>
  .topbar {
    max-width: 40rem;
    margin: 0 auto;
    padding: 0.8rem 16px 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
  }
  .home {
    text-decoration: none;
  }
  .who {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.9rem;
  }
  .up {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.86rem;
    font-weight: 600;
    text-decoration: none;
  }
  .lede {
    margin: 0;
  }
  ul {
    list-style: none;
    padding: 0;
    margin: 0 0 1.5rem;
    display: grid;
    gap: 0.7rem;
  }
  .row {
    width: 100%;
    text-align: left;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.9rem;
    padding: 0.95rem 1rem;
    color: var(--text);
    transition: transform 140ms ease, box-shadow 140ms ease, border-color 140ms ease;
  }
  .row:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-lift);
    border-color: var(--hover-border);
  }
  .row > :global(svg) {
    color: var(--text-2);
  }
  .step-dot {
    display: inline-grid;
    place-items: center;
    width: 2.1rem;
    height: 2.1rem;
    border-radius: 999px;
    background: var(--accent-soft);
    color: var(--accent);
    font-weight: 700;
    font-size: 0.9rem;
  }
  .step-dot.complete {
    background: var(--done-bg);
    color: var(--done);
  }
  .text {
    display: grid;
    gap: 0.3rem;
    min-width: 0;
  }
  .title {
    font-weight: 700;
  }
  .meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem;
    color: var(--text-2);
    font-size: 0.84rem;
  }
  .bar {
    height: 5px;
    border-radius: 3px;
    background: var(--surface);
    overflow: hidden;
  }
  .bar span {
    display: block;
    height: 100%;
    background: var(--accent);
    border-radius: 3px;
  }
  .go {
    font-size: 1.02rem;
    padding: 0.8rem 1.6rem;
  }
  .done {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    color: var(--text-2);
  }
</style>
