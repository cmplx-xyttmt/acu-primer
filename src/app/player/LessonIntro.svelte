<script lang="ts">
  // Before the first module: what the student will be able to do by the end, and every
  // module ahead of them.
  import type { Lesson } from "../../shared/lesson.ts";
  import { renderInline } from "../lib/math.ts";
  import type { LessonProgress } from "../lib/progress.ts";
  import LessonOutline from "./LessonOutline.svelte";
  import ThemeSwitch from "./ThemeSwitch.svelte";

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
  <button class="btn-quiet" onclick={onExit}>Overview</button>
  <ThemeSwitch />
</div>

<main class="page">
  <h1>{lesson.title}</h1>
  <p class="muted source">{lesson.source.book}, {lesson.source.pages}</p>

  <h2>By the end, you'll be able to</h2>
  <ul class="outcomes">
    {#each lesson.outcomes as outcome}
      <li>{@html renderInline(outcome)}</li>
    {/each}
  </ul>

  <h2>{lesson.modules.length} modules</h2>
  <LessonOutline {lesson} {progress} here={null} {onPick} />

  <button class="btn go" onclick={onStart}>{started ? "Continue" : "Start"}</button>
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
    font-size: 1rem;
    margin: 1.75rem 0 0.6rem;
  }
  .outcomes {
    margin: 0;
    padding-left: 1.2rem;
    display: grid;
    gap: 0.35rem;
  }
  .go {
    margin-top: 1.75rem;
  }
</style>
