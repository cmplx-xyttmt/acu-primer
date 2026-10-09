<script lang="ts">
  // One module at a time: reading, then the check. Player decides which module shows, so
  // the in-app Back button and the browser's Back button follow the same history.
  import { fly } from "svelte/transition";
  import type { Lesson } from "../../shared/lesson.ts";
  import { isRight, type Answer } from "../../shared/grading.ts";
  import { renderReading } from "../lib/math.ts";
  import Select from "./checks/Select.svelte";
  import NumberInput from "./checks/NumberInput.svelte";
  import ThemeSwitch from "./ThemeSwitch.svelte";

  let {
    lesson,
    index,
    done,
    onNext,
    onBack,
    onExit,
  }: {
    lesson: Lesson;
    index: number;
    done: string[]; // ids of modules already finished
    onNext: () => void;
    onBack: () => void;
    onExit: () => void;
  } = $props();

  // Answers given during this visit, by module id. A module finished before (going back to
  // re-read it) counts as answered right, with the right answer shown and locked.
  let answered = $state<Record<string, "right" | "wrong">>({});

  const mod = $derived(lesson.modules[index]);
  const total = $derived(lesson.modules.length);
  const reread = $derived(done.includes(mod.id));
  const result = $derived(answered[mod.id] ?? (reread ? "right" : "none"));
  const canMoveOn = $derived(!mod.check || result === "right");

  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const move = { y: 12, duration: reduceMotion ? 0 : 180 };

  function answer(a: Answer) {
    if (!mod.check) return;
    // Slice 2 replaces "try again" with the fallback for this wrong answer.
    answered[mod.id] = isRight(mod.check, a) ? "right" : "wrong";
  }
</script>

<div class="top">
  <button class="btn-quiet" onclick={onExit}>Overview</button>
  <span class="right-side">
    <span class="num count">{index + 1} / {total}</span>
    <ThemeSwitch />
  </span>
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
            <Select check={mod.check} locked={result === "right"} shown={reread} onAnswer={answer} />
          {:else if mod.check.type === "number"}
            <NumberInput check={mod.check} locked={result === "right"} shown={reread} onAnswer={answer} />
          {/if}

          {#if result === "right"}
            <p class="feedback right">Right.</p>
          {:else if result === "wrong"}
            <p class="feedback">Not quite. Have another look and try again.</p>
          {/if}
        </section>
      {/if}

      <div class="moves">
        <button class="btn-quiet" onclick={onBack}>Back</button>
        {#if canMoveOn}
          <button class="btn" onclick={onNext}>{index + 1 >= total ? "Finish lesson" : "Continue"}</button>
        {/if}
      </div>
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
  .moves {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 1.75rem;
  }
  .right-side {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
</style>
