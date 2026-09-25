<script lang="ts">
  // One module at a time: reading, then the check. Moving forward never reloads the page.
  import { fly } from "svelte/transition";
  import type { Lesson } from "../../shared/lesson.ts";
  import { isRight, type Answer } from "../../shared/grading.ts";
  import { renderReading } from "../lib/math.ts";
  import Select from "./checks/Select.svelte";
  import NumberInput from "./checks/NumberInput.svelte";

  let {
    lesson,
    startIndex,
    onModuleDone,
    onLessonDone,
    onExit,
  }: {
    lesson: Lesson;
    startIndex: number;
    onModuleDone: (moduleId: string, nextIndex: number) => void;
    onLessonDone: () => void;
    onExit: () => void;
  } = $props();

  // svelte-ignore state_referenced_locally
  let index = $state(Math.min(startIndex, lesson.modules.length - 1));
  let result = $state<"none" | "right" | "wrong">("none");

  const mod = $derived(lesson.modules[index]);
  const total = $derived(lesson.modules.length);
  const canMoveOn = $derived(!mod.check || result === "right");

  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const move = { y: 12, duration: reduceMotion ? 0 : 180 };

  function answer(a: Answer) {
    if (!mod.check) return;
    // Slice 2 replaces "try again" with the fallback for this wrong answer.
    result = isRight(mod.check, a) ? "right" : "wrong";
  }

  function next() {
    onModuleDone(mod.id, index + 1);
    if (index + 1 >= total) {
      onLessonDone();
      return;
    }
    index += 1;
    result = "none";
    scrollTo({ top: 0 });
  }
</script>

<div class="top">
  <button class="btn-quiet" onclick={onExit}>Overview</button>
  <span class="num count">{index + 1} / {total}</span>
</div>
<div class="bar"><span style="width: {(100 * (index + 1)) / total}%"></span></div>

<main class="page">
  {#key index}
    <article in:fly={move}>
      <h2>{mod.title}</h2>
      <div class="reading">{@html renderReading(mod.reading)}</div>

      {#if mod.check}
        <section class="check">
          {#if mod.check.type === "select"}
            <Select check={mod.check} locked={result === "right"} onAnswer={answer} />
          {:else if mod.check.type === "number"}
            <NumberInput check={mod.check} locked={result === "right"} onAnswer={answer} />
          {/if}

          {#if result === "right"}
            <p class="feedback right">Right.</p>
          {:else if result === "wrong"}
            <p class="feedback">Not quite. Have another look and try again.</p>
          {/if}
        </section>
      {/if}

      {#if canMoveOn}
        <button class="btn next" onclick={next}>{index + 1 >= total ? "Finish lesson" : "Continue"}</button>
      {/if}
    </article>
  {/key}
</main>

<style>
  .top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    max-width: 40rem;
    margin: 0 auto;
    padding: 0.9rem 16px 0.5rem;
  }
  .count {
    color: var(--text-2);
    font-size: 0.9rem;
  }
  .bar {
    height: 3px;
    background: var(--border);
  }
  .bar span {
    display: block;
    height: 100%;
    background: var(--accent);
    transition: width var(--move) ease-out;
  }
  h2 {
    margin-top: 0.5rem;
  }
  .reading :global(.display-math) {
    overflow-x: auto;
    margin: 1rem 0;
  }
  .check {
    margin-top: 2rem;
  }
  .feedback {
    font-weight: 600;
    margin: 1rem 0 0;
  }
  .right {
    color: var(--right);
  }
  .next {
    margin-top: 1.75rem;
  }
</style>
