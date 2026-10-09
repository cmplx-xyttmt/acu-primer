<script lang="ts">
  // One module at a time: reading, then the check. Player decides which module shows, so
  // the in-app Back button and the browser's Back button follow the same history.
  import { fly } from "svelte/transition";
  import type { Lesson } from "../../shared/lesson.ts";
  import { grade, type Answer } from "../../shared/grading.ts";
  import { afterMainAnswer, afterSimplerAnswer, type FallbackStep, type Level } from "../../shared/flow.ts";
  import { renderReading } from "../lib/math.ts";
  import Select from "./checks/Select.svelte";
  import NumberInput from "./checks/NumberInput.svelte";
  import ThemeSwitch from "./ThemeSwitch.svelte";
  import Fallback from "./Fallback.svelte";

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

  // Where each check stands during this visit, by module id. A module finished before
  // (going back to re-read it) counts as right, with the right answer shown and locked.
  interface CheckState {
    level: Level; // "fallback" once the student has had their fallback
    attempt: number; // bumped on each retry, so the check starts blank again
    fallback: FallbackStep | null;
    simpler: "none" | "right" | "wrong";
    retrying: boolean;
    end: "none" | "right" | "material";
  }
  const fresh = (): CheckState => ({
    level: "main",
    attempt: 0,
    fallback: null,
    simpler: "none",
    retrying: false,
    end: "none",
  });
  let checks = $state<Record<string, CheckState>>({});

  const mod = $derived(lesson.modules[index]);
  const total = $derived(lesson.modules.length);
  const reread = $derived(done.includes(mod.id));
  const cs = $derived(checks[mod.id] ?? fresh());
  // Finished on an earlier visit and nothing answered since: show the right answer, locked.
  const showSaved = $derived(reread && !(mod.id in checks));
  const end = $derived(showSaved ? "saved" : cs.end);
  const mainLocked = $derived(end !== "none" || (cs.fallback !== null && !cs.retrying));
  const canMoveOn = $derived(!mod.check || end !== "none");

  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const move = { y: 12, duration: reduceMotion ? 0 : 180 };

  function set(change: Partial<CheckState>) {
    checks[mod.id] = { ...cs, ...change };
  }

  function answerMain(a: Answer) {
    if (!mod.check) return;
    const step = afterMainAnswer(mod.check, grade(mod.check, a), cs.level);
    if (step.kind === "move-on") set({ end: "right" });
    else if (step.kind === "material") set({ end: "material" });
    else set({ fallback: step, level: "fallback" });
  }

  function answerSimpler(a: Answer) {
    const simpler = cs.fallback?.simplerQuestion;
    if (!simpler) return;
    const right = grade(simpler, a).kind === "right";
    // Right: the hint folds away and the original question opens again straight away.
    if (afterSimplerAnswer(right) === "retry-main")
      set({ simpler: "right", retrying: true, attempt: cs.attempt + 1 });
    else set({ simpler: "wrong", end: "material" });
  }

  function retry() {
    set({ retrying: true, attempt: cs.attempt + 1 });
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
          {#key cs.attempt}
            {#if mod.check.type === "select"}
              <Select check={mod.check} locked={mainLocked} shown={showSaved} onAnswer={answerMain} />
            {:else if mod.check.type === "number"}
              <NumberInput check={mod.check} locked={mainLocked} shown={showSaved} onAnswer={answerMain} />
            {/if}
          {/key}

          <!-- The verdict sits right under the question it belongs to; the hint comes after. -->
          {#if end === "none" && cs.retrying}
            <p class="feedback">
              {cs.simpler === "right" ? "Right. Now try the original question again." : "Now try the original question again."}
            </p>
          {:else if end === "right"}
            <p class="feedback right">Right.</p>
          {:else if end === "saved"}
            <p class="feedback muted">You've already done this one.</p>
          {:else if end === "material"}
            <p class="material">
              Still not quite, and that was the last hint for this question. It's worth going back through
              the material more carefully (Back takes you to earlier modules). You can carry on when you're
              ready.
            </p>
          {/if}

          {#if cs.fallback}
            <Fallback
              step={cs.fallback}
              collapsed={cs.retrying || cs.simpler !== "none" || end !== "none"}
              onSimplerAnswer={answerSimpler}
              onRetry={retry}
            />
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
  .material {
    margin: 1.25rem 0 0;
    padding: 0.9rem 1.1rem;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text-2);
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
