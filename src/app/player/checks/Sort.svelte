<script lang="ts">
  // Sort into categories (slice 8). Tap an item, then tap the category it belongs in; tap a
  // placed item to pick it up again. Works with taps alone, so there's no dragging on a phone.
  // Like a wrong pick elsewhere, a wrong sort is marked as a whole and never shows which items
  // were in the right place.
  import type { Answer } from "../../../shared/grading.ts";
  import type { Check } from "../../../shared/lesson.ts";
  import { renderInline } from "../../lib/math.ts";
  import CircleCheck from "@lucide/svelte/icons/circle-check";
  import CircleX from "@lucide/svelte/icons/circle-x";

  type SortCheck = Extract<Check, { type: "sort" }>;
  let {
    check,
    locked,
    shown,
    mark = null,
    onAnswer,
  }: { check: SortCheck; locked: boolean; shown: boolean; mark?: "right" | "wrong" | null; onAnswer: (a: Answer) => void } = $props();

  // svelte-ignore state_referenced_locally (re-created per module and per attempt)
  let placed = $state<Record<string, string>>(shown ? Object.fromEntries(check.items.map((i) => [i.id, i.category])) : {});
  let holding = $state<string | null>(null);

  const unplaced = $derived(check.items.filter((i) => !(i.id in placed)));
  const done = $derived(unplaced.length === 0);

  function tapItem(id: string) {
    if (locked) return;
    if (id in placed) {
      delete placed[id];
      holding = id;
    } else holding = holding === id ? null : id;
  }
  function tapCategory(cat: string) {
    if (locked || !holding) return;
    placed[holding] = cat;
    holding = unplaced.find((i) => i.id !== holding)?.id ?? null;
  }
</script>

<p class="prompt">{@html renderInline(check.prompt)}</p>

{#if !locked && unplaced.length > 0}
  <p class="muted how">{holding ? "Now tap the category it belongs in." : "Tap an item, then the category it belongs in."}</p>
  <div class="tray">
    {#each unplaced as item (item.id)}
      <button class="chip" class:holding={holding === item.id} aria-pressed={holding === item.id} onclick={() => tapItem(item.id)}>
        {@html renderInline(item.text)}
      </button>
    {/each}
  </div>
{/if}

<div class="cats" class:shake={mark === "wrong"} class:right={mark === "right"} class:wrong={mark === "wrong"}>
  {#each check.categories as cat (cat.id)}
    <div class="cat" class:target={!!holding && !locked}>
      <button class="cat-head" disabled={locked || !holding} onclick={() => tapCategory(cat.id)}>
        {@html renderInline(cat.label)}
      </button>
      <div class="placed">
        {#each check.items.filter((i) => placed[i.id] === cat.id) as item (item.id)}
          <button class="chip in" disabled={locked} onclick={() => tapItem(item.id)}>{@html renderInline(item.text)}</button>
        {/each}
      </div>
    </div>
  {/each}
</div>

{#if mark === "right"}<p class="verdict right"><span class="pop"><CircleCheck size={20} aria-hidden="true" /></span></p>{/if}
{#if mark === "wrong"}<p class="verdict wrong"><CircleX size={20} aria-hidden="true" /></p>{/if}

{#if !locked}
  <button class="btn" disabled={!done} onclick={() => onAnswer({ type: "sort", placements: { ...placed } })}>Check</button>
{/if}

<style>
  .prompt {
    font-weight: 600;
  }
  .how {
    margin: 0.5rem 0;
    font-size: 0.92rem;
  }
  .tray {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }
  .chip {
    background: var(--card);
    border: 2px solid var(--border);
    border-radius: 999px;
    padding: 0.4rem 0.85rem;
    box-shadow: 0 2px 0 var(--border);
    color: var(--text);
    text-align: left;
  }
  .chip:hover:not(:disabled) {
    border-color: var(--hover-border);
  }
  .chip.holding {
    border-color: var(--accent);
    background: var(--accent-soft);
    transform: translateY(-2px);
  }
  .chip:disabled {
    cursor: default;
  }
  .cats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 11rem), 1fr));
    gap: 0.75rem;
    margin-bottom: 1.25rem;
  }
  .cat {
    border: 2px dashed var(--border);
    border-radius: var(--radius);
    padding: 0.5rem;
    min-height: 6rem;
    display: grid;
    align-content: start;
    gap: 0.5rem;
  }
  .cat.target {
    border-color: var(--hover-border);
  }
  .cats.right .cat {
    border-style: solid;
    border-color: var(--right);
    background: var(--right-bg);
  }
  .cats.wrong .cat {
    border-style: solid;
    border-color: var(--wrong);
    background: var(--wrong-bg);
  }
  .cat-head {
    border: none;
    background: var(--surface);
    border-radius: var(--radius-sm);
    padding: 0.45rem 0.6rem;
    font-weight: 700;
    color: var(--text);
    text-align: left;
  }
  .cat.target .cat-head {
    background: var(--accent-soft);
  }
  .placed {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }
  .verdict {
    display: flex;
    margin: -0.5rem 0 0.75rem;
  }
  .verdict.right {
    color: var(--right);
  }
  .verdict.wrong {
    color: var(--wrong);
  }
</style>
