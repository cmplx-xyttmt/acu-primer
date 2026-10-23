<script lang="ts">
  // An exploration (slice 8): predict, then change something and see what happens. The student
  // locks in a prediction before the widget wakes up (delMas, Garfield & Chance 1999: a
  // prediction that turns out wrong is what makes the result stick). Once they've changed
  // something, "what to notice" appears, and if the prediction didn't match, a "think about
  // why" note too. The prediction is never marked wrong.
  import { fly } from "svelte/transition";
  import type { Explore } from "../../../shared/lesson.ts";
  import { renderInline, renderReading } from "../../lib/math.ts";
  import FormulaWidget from "./FormulaWidget.svelte";
  import SamplingWidget from "./SamplingWidget.svelte";
  import StepperWidget from "./StepperWidget.svelte";
  import ScenariosWidget from "./ScenariosWidget.svelte";
  import FlaskConical from "@lucide/svelte/icons/flask-conical";
  import Lock from "@lucide/svelte/icons/lock";
  import Lightbulb from "@lucide/svelte/icons/lightbulb";
  import Eye from "@lucide/svelte/icons/eye";

  let {
    explore,
    shownBefore = false,
    onPredicted,
    onDone,
  }: {
    explore: Explore;
    shownBefore?: boolean; // finished on an earlier visit: open, with the notes showing
    onPredicted?: (optionText: string, matched: boolean) => void;
    onDone: (tries: number) => void;
  } = $props();

  // svelte-ignore state_referenced_locally (re-created per module)
  let picked = $state<string | null>(null);
  // svelte-ignore state_referenced_locally
  let locked = $state(shownBefore);
  // svelte-ignore state_referenced_locally
  let done = $state(shownBefore);

  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const rise = { y: 10, duration: reduceMotion ? 0 : 220 };
  const pickedText = $derived(explore.prediction.options.find((o) => o.id === picked)?.text ?? "");
  const matched = $derived(picked === explore.prediction.answer);

  function lockIn() {
    if (!picked) return;
    locked = true;
    onPredicted?.(pickedText, matched);
  }
  function progress(tries: number) {
    if (tries > 0 && !done) {
      done = true;
      onDone(tries);
    }
  }
</script>

<section class="explore">
  <span class="label tag"><FlaskConical size={15} aria-hidden="true" />Explore</span>
  <div class="prompt">{@html renderReading(explore.prompt)}</div>

  <div class="predict" class:locked>
    <p class="q">{@html renderInline(explore.prediction.prompt)}</p>
    {#if !locked}
      <div class="options" role="radiogroup">
        {#each explore.prediction.options as o (o.id)}
          <button class="option" class:picked={picked === o.id} role="radio" aria-checked={picked === o.id} onclick={() => (picked = o.id)}>
            {@html renderInline(o.text)}
          </button>
        {/each}
      </div>
      <button class="btn" disabled={!picked} onclick={lockIn}><Lock size={16} aria-hidden="true" />Lock in my prediction</button>
    {:else if picked}
      <p class="mine"><Lock size={15} aria-hidden="true" />Your prediction: <strong>{@html renderInline(pickedText)}</strong></p>
    {/if}
  </div>

  <div class="widget" aria-disabled={!locked}>
    {#if !locked}<p class="muted wait">Lock in a prediction first, then try it.</p>{/if}
    {#if explore.widget.kind === "formula"}
      <FormulaWidget widget={explore.widget} active={locked} onProgress={progress} />
    {:else if explore.widget.kind === "sampling"}
      <SamplingWidget widget={explore.widget} active={locked} onProgress={progress} />
    {:else if explore.widget.kind === "stepper"}
      <StepperWidget widget={explore.widget} active={locked} onProgress={progress} />
    {:else}
      <ScenariosWidget widget={explore.widget} active={locked} onProgress={progress} />
    {/if}
  </div>

  {#if done}
    {#if picked && !matched}
      <aside class="margin-note think" in:fly={rise}>
        <span class="label"><Lightbulb size={14} aria-hidden="true" />Think about it</span>
        {@html renderReading(explore.thinkAbout)}
      </aside>
    {/if}
    <aside class="notice" in:fly={rise}>
      <span class="label"><Eye size={14} aria-hidden="true" />What to notice</span>
      {@html renderReading(explore.notice)}
    </aside>
  {/if}
</section>

<style>
  .explore {
    margin-top: 1.75rem;
    padding: 1rem 1.1rem 1.2rem;
    border: 2px solid var(--border);
    border-radius: var(--radius);
    background: var(--card);
    display: grid;
    gap: 0.9rem;
  }
  .tag {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    color: var(--accent);
  }
  .prompt :global(p) {
    margin: 0.2rem 0;
  }
  .q {
    font-weight: 600;
    margin: 0;
  }
  .options {
    display: grid;
    gap: 0.5rem;
    margin: 0.75rem 0 1rem;
  }
  .option {
    text-align: left;
    background: var(--card);
    border: 2px solid var(--border);
    border-radius: var(--radius);
    padding: 0.65rem 0.9rem;
    box-shadow: 0 2px 0 var(--border);
    color: var(--text);
  }
  .option:hover {
    border-color: var(--hover-border);
  }
  .option.picked {
    border-color: var(--accent);
    background: var(--accent-soft);
  }
  .mine {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex-wrap: wrap;
    margin: 0.5rem 0 0;
    color: var(--text-2);
  }
  .widget {
    border-top: 1px dashed var(--border);
    padding-top: 0.9rem;
  }
  .wait {
    margin: 0 0 0.6rem;
    font-size: 0.9rem;
  }
  .think,
  .notice {
    padding: 0.8rem 1rem;
  }
  .think .label {
    color: var(--fallback-edge);
  }
  .notice {
    border-left: 4px solid var(--accent);
    background: var(--accent-soft);
    border-radius: var(--radius-sm);
  }
  .think .label,
  .notice .label {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
  }
  .think :global(p),
  .notice :global(p) {
    margin: 0.3rem 0 0;
  }
</style>
