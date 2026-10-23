<script lang="ts">
  // The stepper widget: a sequence of states the lesson wrote (a row of labelled cells and a
  // caption), stepped through one at a time. Cells whose value changed since the last step are
  // highlighted, and cells the lesson marks get a ring. Reaching the last step counts as done.
  import type { Widget } from "../../../shared/lesson.ts";
  import { renderInline } from "../../lib/math.ts";
  import ChevronLeft from "@lucide/svelte/icons/chevron-left";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import RotateCcw from "@lucide/svelte/icons/rotate-ccw";

  type StepperW = Extract<Widget, { kind: "stepper" }>;
  let { widget, active, onProgress }: { widget: StepperW; active: boolean; onProgress: (tries: number) => void } = $props();

  let at = $state(0);
  const frame = $derived(widget.frames[at]);
  const prev = $derived(at > 0 ? widget.frames[at - 1] : null);
  const changed = (i: number) => !!prev && prev.cells[i]?.value !== frame.cells[i].value;

  function go(i: number) {
    at = Math.max(0, Math.min(widget.frames.length - 1, i));
    if (at === widget.frames.length - 1) onProgress(widget.frames.length);
  }
</script>

<div class="stepper" class:inactive={!active}>
  <div class="cells" style="--n: {frame.cells.length}">
    {#each frame.cells as cell, i (i)}
      <div class="cell" class:changed={changed(i)} class:mark={cell.mark}>
        {#if cell.label}<span class="cell-label">{@html renderInline(cell.label)}</span>{/if}
        <span class="cell-value num">{@html renderInline(cell.value)}</span>
      </div>
    {/each}
  </div>
  {#key at}
    <p class="caption">{@html renderInline(frame.caption)}</p>
  {/key}
  <div class="moves">
    <button class="btn-quiet btn-sm" disabled={!active || at === 0} onclick={() => go(at - 1)}><ChevronLeft size={16} aria-hidden="true" />Back</button>
    <span class="count num">Step {at + 1} of {widget.frames.length}</span>
    {#if at < widget.frames.length - 1}
      <button class="btn btn-sm" disabled={!active} onclick={() => go(at + 1)}>Next step<ChevronRight size={16} aria-hidden="true" /></button>
    {:else}
      <button class="btn-secondary btn-sm" disabled={!active} onclick={() => go(0)}><RotateCcw size={15} aria-hidden="true" />From the start</button>
    {/if}
  </div>
</div>

<style>
  .stepper {
    display: grid;
    gap: 0.8rem;
  }
  .inactive {
    opacity: 0.55;
  }
  .cells {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 5.5rem), 1fr));
    gap: 0.5rem;
  }
  .cell {
    display: grid;
    gap: 0.2rem;
    justify-items: center;
    padding: 0.6rem 0.4rem;
    border: 2px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--card);
    transition: background-color var(--move, 200ms) ease, border-color var(--move, 200ms) ease;
    text-align: center;
  }
  .cell.changed {
    background: var(--fallback-bg);
    border-color: var(--fallback-edge);
  }
  .cell.mark {
    box-shadow: 0 0 0 3px var(--accent);
  }
  .cell-label {
    font-size: 0.78rem;
    color: var(--text-2);
    font-weight: 600;
  }
  .cell-value {
    font-weight: 700;
    font-size: 1.05rem;
    overflow-wrap: anywhere;
  }
  .caption {
    margin: 0;
    min-height: 2.8em;
  }
  .moves {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }
  .count {
    font-size: 0.88rem;
    color: var(--text-2);
  }
</style>
