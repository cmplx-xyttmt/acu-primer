<script lang="ts">
  // Before the first module: what the student will be able to do by the end, and every
  // module ahead of them.
  import type { Lesson } from "../../shared/lesson.ts";
  import { renderInline } from "../lib/math.ts";
  import type { LessonProgress } from "../lib/progress.ts";
  import LessonOutline from "./LessonOutline.svelte";
  import ThemeSwitch from "./ThemeSwitch.svelte";
  import ArrowLeft from "@lucide/svelte/icons/arrow-left";
  import Check from "@lucide/svelte/icons/check";
  import List from "@lucide/svelte/icons/list";
  import Play from "@lucide/svelte/icons/play";
  import Target from "@lucide/svelte/icons/target";

  let {
    lesson,
    progress,
    onStart,
    onPick,
    onExit,
  }: {
    lesson: Lesson;
    progress: LessonProgress;
    onStart: () => void; // where Continue would open
    onPick: (index: number) => void;
    onExit: () => void;
  } = $props();

  const started = $derived(progress.done.length > 0 || progress.skipped.length > 0);
</script>

<div class="top">
  <button class="btn-quiet btn-sm" onclick={onExit}><ArrowLeft size={16} aria-hidden="true" />Overview</button>
  <ThemeSwitch />
</div>

<main class="page">
  <section class="banner">
  <span class="label">Lesson</span>
  <h1>{lesson.title}</h1>
  <p class="muted source">{lesson.source.book}, {lesson.source.pages}</p>

  </section>

  <h2><Target size={18} aria-hidden="true" />By the end, you'll be able to</h2>
  <ul class="outcomes">
    {#each lesson.outcomes as outcome}
      <li><span class="tick"><Check size={15} aria-hidden="true" /></span><span>{@html renderInline(outcome)}</span></li>
    {/each}
  </ul>

  <h2><List size={18} aria-hidden="true" />{lesson.modules.length} modules</h2>
  <LessonOutline {lesson} {progress} here={null} {onPick} />

  <button class="btn go" onclick={onStart}><Play size={17} aria-hidden="true" />{started ? "Continue" : "Start"}</button>
</main>

<style>
  .top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    max-width: 40rem;
    margin: 0 auto;
    padding: 0.9rem 16px 0;
  }
  h1 {
    margin-bottom: 0.25rem;
  }
  .source {
    margin-top: 0;
    font-size: 0.9rem;
  }
  h2 {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    font-size: 1rem;
    margin: 1.75rem 0 0.6rem;
  }
  .outcomes {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.5rem;
  }
  .outcomes li {
    display: flex;
    gap: 0.55rem;
    align-items: flex-start;
  }
  .tick {
    display: inline-grid;
    place-items: center;
    flex: none;
    width: 1.4rem;
    height: 1.4rem;
    margin-top: 0.1rem;
    border-radius: 999px;
    background: var(--accent-soft);
    color: var(--accent);
  }
  .go {
    margin-top: 1.75rem;
  }
</style>
