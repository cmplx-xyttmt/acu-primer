<script lang="ts">
  // The help a student gets after a wrong answer: a re-explanation aimed at their
  // misconception, a simpler question, or both, in that order. It rises in under the check,
  // and folds down to one line once the student moves on from it (back to the original
  // question, or to the material suggestion), so their attention goes back up to the check.
  import { fly, slide } from "svelte/transition";
  import type { Answer } from "../../shared/grading.ts";
  import type { FallbackStep } from "../../shared/flow.ts";
  import { renderInline, renderReading } from "../lib/math.ts";
  import Select from "./checks/Select.svelte";
  import NumberInput from "./checks/NumberInput.svelte";

  let {
    step,
    collapsed,
    onSimplerAnswer,
    onRetry,
  }: {
    step: FallbackStep;
    collapsed: boolean;
    onSimplerAnswer: (a: Answer) => void;
    onRetry: () => void;
  } = $props();

  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const rise = { y: 10, duration: reduceMotion ? 0 : 200 };
  const fold = { duration: reduceMotion ? 0 : 180 };

  let reopened = $state(false);

  function arrive(node: HTMLElement) {
    node.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "nearest" });
  }
</script>

{#if !collapsed}
  <aside class="fallback" in:fly={rise} out:slide={fold} use:arrive>
    <p class="lead">
      Not quite.
      {#if step.reason === "unplanned"}
        {step.simplerQuestion
          ? "Try this simpler question first."
          : "Have another look at the reading, or think it through, and try again."}
      {/if}
    </p>

    {#if step.reExplanation}
      {#if step.reason === "unplanned"}<p class="label">Another way to see it</p>{/if}
      <div class="text">{@html renderReading(step.reExplanation)}</div>
    {/if}

    {#if step.simplerQuestion}
      <div class="simpler">
        {#if step.reason === "known"}<p class="label">Try this one first</p>{/if}
        {#if step.simplerQuestion.type === "select"}
          <Select check={step.simplerQuestion} locked={false} shown={false} onAnswer={onSimplerAnswer} />
        {:else}
          <NumberInput check={step.simplerQuestion} locked={false} shown={false} onAnswer={onSimplerAnswer} />
        {/if}
      </div>
    {:else}
      <button class="btn" onclick={onRetry}>Try the question again</button>
    {/if}
  </aside>
{:else}
  <div class="folded">
    <button class="btn-quiet" onclick={() => (reopened = !reopened)} aria-expanded={reopened}>
      {reopened ? "Hide the hint" : "Show the hint again"}
    </button>
    {#if reopened}
      <div class="fallback quiet" transition:slide={fold}>
        {#if step.reExplanation}
          <div class="text">{@html renderReading(step.reExplanation)}</div>
        {/if}
        {#if step.simplerQuestion}
          <p class="text">
            Simpler question: {@html renderInline(step.simplerQuestion.prompt)}
          </p>
        {/if}
      </div>
    {/if}
  </div>
{/if}

<style>
  .fallback {
    margin-top: 1.25rem;
    padding: 1rem 1.1rem 1.1rem;
    background: var(--fallback-bg);
    border-left: 3px solid var(--fallback-edge);
    border-radius: var(--radius);
  }
  .quiet {
    margin-top: 0.5rem;
    padding: 0.6rem 1rem;
  }
  .lead {
    font-weight: 600;
    margin: 0 0 0.5rem;
  }
  .label {
    margin: 0.75rem 0 0;
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-2);
  }
  .text :global(p),
  p.text {
    margin: 0.4rem 0;
  }
  .simpler {
    margin-top: 0.75rem;
  }
  .btn {
    margin-top: 1rem;
  }
  .folded {
    margin-top: 1rem;
    font-size: 0.9rem;
  }
</style>
