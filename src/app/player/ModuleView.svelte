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
  import ArrowLeft from "@lucide/svelte/icons/arrow-left";
  import ArrowRight from "@lucide/svelte/icons/arrow-right";
  import List from "@lucide/svelte/icons/list";
  import X from "@lucide/svelte/icons/x";
  import CircleCheck from "@lucide/svelte/icons/circle-check";
  import Undo2 from "@lucide/svelte/icons/undo-2";
  import LessonOutline from "./LessonOutline.svelte";
  import { record } from "../lib/eventQueue.ts";
  import type { AnsweredPayload, FallbackPayload } from "../../shared/events.ts";
  import type { SimpleCheck } from "../../shared/lesson.ts";
  import type { LessonProgress } from "../lib/progress.ts";

  let {
    lesson,
    index,
    progress,
    onNext,
    onSkip,
    onBack,
    onExit,
    onJump,
  }: {
    lesson: Lesson;
    index: number;
    progress: LessonProgress;
    onNext: () => void;
    onSkip: () => void; // "Skip for now" after the last hint: move on without passing
    onBack: () => void;
    onExit: () => void;
    onJump: (index: number) => void; // open a module the student has reached, from Contents
  } = $props();

  let contents = $state<HTMLDialogElement>();

  // Where each check stands during this visit, by module id. A module finished before
  // (going back to re-read it) counts as right, with the right answer shown and locked.
  interface CheckState {
    level: Level; // "fallback" once the student has had their fallback
    attempt: number; // bumped on each retry, so the check starts blank again
    fallback: FallbackStep | null;
    simpler: "none" | "right" | "wrong";
    retrying: boolean;
    afterLastHint: boolean; // retrying after the material suggestion: no hints left
    end: "none" | "right" | "material";
  }
  const fresh = (): CheckState => ({
    level: "main",
    attempt: 0,
    fallback: null,
    simpler: "none",
    retrying: false,
    afterLastHint: false,
    end: "none",
  });
  let checks = $state<Record<string, CheckState>>({});

  const mod = $derived(lesson.modules[index]);
  const total = $derived(lesson.modules.length);
  const reread = $derived(progress.done.includes(mod.id));
  const cs = $derived(checks[mod.id] ?? fresh());
  // Finished on an earlier visit and nothing answered since: show the right answer, locked.
  const showSaved = $derived(reread && !(mod.id in checks));
  const end = $derived(showSaved ? "saved" : cs.end);
  const mainLocked = $derived(end !== "none" || (cs.fallback !== null && !cs.retrying));
  // Green for a right answer, red for a wrong one while its hint (or the last-hint message) shows.
  const mark = $derived<"right" | "wrong" | null>(
    end === "right" || end === "saved"
      ? "right"
      : end === "material" || (cs.fallback !== null && !cs.retrying)
        ? "wrong"
        : null,
  );
  const canMoveOn = $derived(!mod.check || end === "right" || end === "saved");

  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const move = { y: 12, duration: reduceMotion ? 0 : 180 };

  function set(change: Partial<CheckState>) {
    checks[mod.id] = { ...cs, ...change };
  }

  // What the student picked or typed, as they saw it, for the author's log.
  const answerText = (c: SimpleCheck, a: Answer) =>
    a.type === "select" && c.type === "select"
      ? (c.options.find((o) => o.id === a.optionId)?.text ?? a.optionId)
      : a.type === "number"
        ? String(a.value)
        : "";

  function log(type: "check.answered" | "fallback.shown" | "material.suggested", payload: object) {
    record(type, lesson.id, { moduleId: mod.id, moduleTitle: mod.title, ...payload });
  }

  function answerMain(a: Answer) {
    if (!mod.check) return;
    const g = grade(mod.check, a);
    log("check.answered", {
      checkId: mod.check.id,
      level: cs.level === "main" ? "main" : "retry",
      answerText: answerText(mod.check as SimpleCheck, a),
      result: g.kind,
      misconception: g.kind === "known-wrong" ? mod.check.wrongAnswers[g.index].misconception.text : undefined,
    } satisfies Omit<AnsweredPayload, "moduleId" | "moduleTitle">);
    const step = afterMainAnswer(mod.check, g, cs.level);
    if (step.kind === "move-on") set({ end: "right" });
    else if (step.kind === "material") {
      set({ end: "material" });
      log("material.suggested", {});
    } else {
      set({ fallback: step, level: "fallback" });
      log("fallback.shown", {
        reason: step.reason,
        misconception: step.misconception,
        parts: [
          ...(step.reExplanation ? (["reExplanation"] as const) : []),
          ...(step.simplerQuestion ? (["simplerQuestion"] as const) : []),
        ],
      } satisfies Omit<FallbackPayload, "moduleId" | "moduleTitle">);
    }
  }

  function answerSimpler(a: Answer) {
    const simpler = cs.fallback?.simplerQuestion;
    if (!simpler) return;
    const right = grade(simpler, a).kind === "right";
    log("check.answered", {
      checkId: `${mod.check?.id}-simpler`,
      level: "simpler",
      answerText: answerText(simpler, a),
      result: right ? "right" : "unplanned",
    } satisfies Omit<AnsweredPayload, "moduleId" | "moduleTitle">);
    if (!right) log("material.suggested", {});
    // Right: the hint folds away and the original question opens again straight away.
    if (afterSimplerAnswer(right) === "retry-main")
      set({ simpler: "right", retrying: true, attempt: cs.attempt + 1 });
    else set({ simpler: "wrong", end: "material" });
  }

  function retry() {
    set({ retrying: true, attempt: cs.attempt + 1 });
  }

  // After the last hint: another go at the original question, as many times as the student
  // likes. The level stays "fallback", so a wrong answer brings the same message back.
  function retryAfterLastHint() {
    set({ retrying: true, afterLastHint: true, attempt: cs.attempt + 1, end: "none" });
  }
</script>

<div class="top">
  <span class="left-side">
    <button class="btn-quiet btn-sm" aria-label="Overview" onclick={onExit}><ArrowLeft size={16} aria-hidden="true" /><span class="wide-only">Overview</span></button>
    <button class="btn-quiet btn-sm" aria-label="Contents" onclick={() => contents?.showModal()}><List size={16} aria-hidden="true" /><span class="wide-only">Contents</span></button>
  </span>
  <span class="right-side">
    <span class="num count"><span class="wide-only">Module </span>{index + 1}<span class="wide-only"> of </span><span class="narrow-only"> / </span>{total}</span>
    <ThemeSwitch />
  </span>
</div>
<div class="bar"><span style="width: {(100 * (index + 1)) / total}%"></span></div>

<dialog
  bind:this={contents}
  class="contents"
  aria-label="Contents"
  onclick={(e) => e.target === contents && contents?.close()}
>
  <div class="contents-head">
    <strong>{lesson.title}</strong>
    <button class="btn-quiet btn-sm" onclick={() => contents?.close()}><X size={16} aria-hidden="true" />Close</button>
  </div>
  <LessonOutline
    {lesson}
    {progress}
    here={index}
    onPick={(i) => {
      contents?.close();
      if (i !== index) onJump(i);
    }}
  />
</dialog>

<main class="page">
  {#key index}
    <article in:fly={move}>
      <h2>{mod.title}</h2>
      <div class="reading">{@html renderReading(mod.reading)}</div>

      {#if mod.check}
        <section class="check">
          {#key cs.attempt}
            {#if mod.check.type === "select"}
              <Select check={mod.check} locked={mainLocked} shown={showSaved} {mark} onAnswer={answerMain} />
            {:else if mod.check.type === "number"}
              <NumberInput check={mod.check} locked={mainLocked} shown={showSaved} {mark} onAnswer={answerMain} />
            {/if}
          {/key}

          <!-- The verdict sits right under the question it belongs to; the hint comes after. -->
          {#if end === "none" && cs.retrying}
            <p class="feedback">
              {cs.afterLastHint
                ? "Have another go. There are no more hints for this one."
                : cs.simpler === "right"
                  ? "Right. Now try the original question again."
                  : "Now try the original question again."}
            </p>
          {:else if end === "right"}
            <p class="feedback right"><span class="pop"><CircleCheck size={22} aria-hidden="true" /></span>Right.</p>
            <div class="explanation">{@html renderReading(mod.check.explanation)}</div>
          {:else if end === "saved"}
            <p class="feedback muted"><CircleCheck size={20} aria-hidden="true" />You've already done this one.</p>
            <div class="explanation">{@html renderReading(mod.check.explanation)}</div>
          {:else if end === "material"}
            <div class="material card">
              <p>
                Still not quite, and that was the last hint for this question. It's worth going back through
                the material more carefully (Back takes you to earlier modules). Then try again, or skip it
                for now and come back to it later.
              </p>
              <button class="btn-secondary" onclick={retryAfterLastHint}><Undo2 size={16} aria-hidden="true" />Try again</button>
            </div>
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
        <button class="btn-quiet" onclick={onBack}><ArrowLeft size={16} aria-hidden="true" />Back</button>
        {#if canMoveOn}
          <button class="btn" onclick={onNext}>{index + 1 >= total ? "Finish lesson" : "Continue"}<ArrowRight size={17} aria-hidden="true" /></button>
        {:else if end === "material"}
          <button class="btn-secondary" onclick={onSkip}>Skip for now<ArrowRight size={16} aria-hidden="true" /></button>
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
  .narrow-only {
    display: none;
  }
  @media (max-width: 480px) {
    .wide-only {
      display: none;
    }
    .narrow-only {
      display: inline;
    }
  }
  .count {
    color: var(--text-2);
    font-size: 0.9rem;
  }
  .bar {
    height: 6px;
    background: var(--surface);
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
    display: flex;
    align-items: center;
    gap: 0.45rem;
    font-weight: 700;
    margin: 1rem 0 0;
  }
  .feedback .pop {
    display: inline-flex;
  }
  .right {
    color: var(--right);
  }
  .explanation :global(p) {
    margin: 0.35rem 0 0;
  }
  .material p {
    margin: 0 0 0.9rem;
  }
  .material {
    margin: 1.25rem 0 0;
    padding: 1rem 1.1rem;
    color: var(--text-2);
  }
  .moves {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 1.75rem;
  }
  .left-side {
    display: flex;
    gap: 1rem;
  }
  .contents {
    width: min(34rem, calc(100vw - 32px));
    max-height: calc(100vh - 64px);
    padding: 1rem;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--bg);
    color: var(--text);
  }
  .contents::backdrop {
    background: rgb(0 0 0 / 0.45);
  }
  .contents-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 1rem;
    margin-bottom: 0.75rem;
  }
  .right-side {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
</style>
