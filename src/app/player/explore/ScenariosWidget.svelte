<script lang="ts">
  // The scenarios widget: pick an option for each input and read the outcome the lesson wrote
  // for that combination. Seeing two different combinations counts as having changed something.
  import { fade } from "svelte/transition";
  import type { Widget } from "../../../shared/lesson.ts";
  import { renderReading, renderInline } from "../../lib/math.ts";

  type ScenariosW = Extract<Widget, { kind: "scenarios" }>;
  let { widget, active, onProgress }: { widget: ScenariosW; active: boolean; onProgress: (tries: number) => void } = $props();

  // svelte-ignore state_referenced_locally (re-created per module)
  let chosen = $state<Record<string, string>>(Object.fromEntries(widget.inputs.map((i) => [i.id, i.options[0].id])));
  const seen = new Set<string>();
  const key = (c: Record<string, string>) => widget.inputs.map((i) => c[i.id]).join("|");
  const outcome = $derived(widget.outcomes.find((o) => widget.inputs.every((i) => o.when[i.id] === chosen[i.id])));
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  function pick(input: string, option: string) {
    chosen[input] = option;
    seen.add(key(chosen));
    onProgress(seen.size >= 2 ? seen.size : 0);
  }
  $effect(() => {
    if (active && seen.size === 0) seen.add(key(chosen));
  });
</script>

<div class="scenarios" class:inactive={!active}>
  {#each widget.inputs as input (input.id)}
    <div class="input">
      <span class="label">{@html renderInline(input.label)}</span>
      <div class="options" role="radiogroup" aria-label={input.label}>
        {#each input.options as o (o.id)}
          <button class="opt" class:on={chosen[input.id] === o.id} role="radio" aria-checked={chosen[input.id] === o.id} disabled={!active} onclick={() => pick(input.id, o.id)}>
            {@html renderInline(o.label)}
          </button>
        {/each}
      </div>
    </div>
  {/each}
  {#key key(chosen)}
    <div class="outcome card" in:fade={{ duration: reduceMotion ? 0 : 200 }}>
      {#if outcome}{@html renderReading(outcome.text)}{:else}<p class="muted">No outcome written for this combination.</p>{/if}
    </div>
  {/key}
</div>

<style>
  .scenarios {
    display: grid;
    gap: 0.9rem;
  }
  .inactive {
    opacity: 0.55;
  }
  .input {
    display: grid;
    gap: 0.35rem;
  }
  .label {
    font-size: 0.88rem;
    font-weight: 600;
    color: var(--text-2);
  }
  .options {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }
  .opt {
    padding: 0.4rem 0.8rem;
    border: 2px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--card);
    color: var(--text);
    box-shadow: 0 2px 0 var(--border);
    text-align: left;
  }
  .opt.on {
    border-color: var(--accent);
    background: var(--accent-soft);
    font-weight: 700;
  }
  .outcome {
    padding: 0.9rem 1.1rem;
  }
  .outcome :global(p) {
    margin: 0.3rem 0;
  }
</style>
