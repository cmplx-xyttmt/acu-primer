<script lang="ts">
  import type { Answer } from "../../../shared/grading.ts";
  import type { Check, SimpleCheck } from "../../../shared/lesson.ts";
  import { renderInline } from "../../lib/math.ts";

  type NumberCheck = Extract<Check | SimpleCheck, { type: "number" }>;
  let {
    check,
    locked,
    shown,
    mark = null,
    onAnswer,
  }: { check: NumberCheck; locked: boolean; shown: boolean; mark?: "right" | "wrong" | null; onAnswer: (a: Answer) => void } = $props();

  // shown: the student finished this module before and came back to re-read it.
  // svelte-ignore state_referenced_locally (ModuleView re-creates this per module)
  let raw = $state(shown ? String(check.answer) : "");
  const value = $derived(Number(raw.trim().replace(",", ".")));
  const valid = $derived(raw.trim() !== "" && Number.isFinite(value));
</script>

<p class="prompt">{@html renderInline(check.prompt)}</p>
<form
  onsubmit={(e) => {
    e.preventDefault();
    if (valid) onAnswer({ type: "number", value });
  }}
>
  <input class="num" class:right={mark === "right"} class:wrong={mark === "wrong"} type="text" inputmode="decimal" bind:value={raw} disabled={locked} aria-label="Your answer" />
  {#if check.unit}<span class="muted">{check.unit}</span>{/if}
  {#if !locked}
    <button class="btn" type="submit" disabled={!valid}>Check</button>
  {/if}
</form>

<style>
  .prompt {
    font-weight: 600;
  }
  form {
    display: flex;
    gap: 0.75rem;
    align-items: center;
    margin-top: 1rem;
  }
  input {
    max-width: 10rem;
  }
  input.right {
    border-color: var(--right);
    background: var(--right-bg);
  }
  input.wrong {
    border-color: var(--wrong);
    background: var(--wrong-bg);
  }
</style>
