<script lang="ts">
  import type { Answer } from "../../../shared/grading.ts";
  import type { Check, SimpleCheck } from "../../../shared/lesson.ts";
  import { renderInline } from "../../lib/math.ts";

  type SelectCheck = Extract<Check | SimpleCheck, { type: "select" }>;
  let { check, locked, onAnswer }: { check: SelectCheck; locked: boolean; onAnswer: (a: Answer) => void } =
    $props();

  let picked = $state<string | null>(null);
</script>

<p class="prompt">{@html renderInline(check.prompt)}</p>
<div class="options" role="radiogroup">
  {#each check.options as option (option.id)}
    <button
      class="option"
      class:picked={picked === option.id}
      role="radio"
      aria-checked={picked === option.id}
      disabled={locked}
      onclick={() => (picked = option.id)}
    >
      {@html renderInline(option.text)}
    </button>
  {/each}
</div>
{#if !locked}
  <button class="btn" disabled={!picked} onclick={() => picked && onAnswer({ type: "select", optionId: picked })}>
    Check
  </button>
{/if}

<style>
  .prompt {
    font-weight: 600;
  }
  .options {
    display: grid;
    gap: 0.6rem;
    margin: 1rem 0 1.25rem;
  }
  .option {
    text-align: left;
    background: var(--surface);
    border: 2px solid var(--border);
    border-radius: var(--radius);
    padding: 0.75rem 1rem;
  }
  .option:hover:not(:disabled) {
    border-color: var(--hover-border);
  }
  .option.picked {
    border-color: var(--accent);
  }
  .option:disabled {
    cursor: default;
  }
</style>
