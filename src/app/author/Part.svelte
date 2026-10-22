<script lang="ts">
  // One reviewable part of a step (the reading, the check, a hint...), with a way to pin a
  // suggestion to it and the suggestions already pinned there. In review by playing (slice 11)
  // the part has no box: a small button in its margin, faint until the part is hovered.
  import type { Snippet } from "svelte";
  import MessageSquarePlus from "@lucide/svelte/icons/message-square-plus";
  import type { Suggestion } from "../../shared/review.ts";

  let {
    label,
    suggestions,
    onSuggest,
    onWithdraw,
    margin = false,
    children,
  }: {
    label: string;
    margin?: boolean;
    suggestions: Suggestion[]; // this part's, any status
    onSuggest: (text: string) => Promise<void>;
    onWithdraw: (id: string) => Promise<void>;
    children: Snippet;
  } = $props();

  let writing = $state(false);
  let text = $state("");
  let saving = $state(false);

  async function save() {
    saving = true;
    try {
      await onSuggest(text.trim());
      text = "";
      writing = false;
    } finally {
      saving = false;
    }
  }
</script>

<div class="part" class:margin class:has-open={suggestions.some((s) => s.status === "open")}>
  {#if margin}
    {#if !writing}
      <button class="pin" title="Suggest a change to: {label}" aria-label="Suggest a change to: {label}" onclick={() => (writing = true)}>
        <MessageSquarePlus size={17} aria-hidden="true" />
      </button>
    {/if}
  {:else}
    <div class="part-head">
      <span class="label">{label}</span>
      {#if !writing}
        <button class="btn-quiet" onclick={() => (writing = true)}>Suggest a change</button>
      {/if}
    </div>
  {/if}
  {@render children()}

  {#each suggestions as s (s.id)}
    <div class="suggestion {s.status}">
      <span class="who">{s.status === "open" ? "Your suggestion" : s.status === "resolved" ? "Resolved" : "Withdrawn"}</span>
      <p>{s.text}</p>
      {#if s.note}<p class="note">What changed: {s.note}</p>{/if}
      {#if s.status === "open"}
        <button class="btn-quiet" onclick={() => onWithdraw(s.id)}>Withdraw</button>
      {/if}
    </div>
  {/each}

  {#if writing}
    <form
      onsubmit={(e) => {
        e.preventDefault();
        if (text.trim()) save();
      }}
    >
      <!-- svelte-ignore a11y_autofocus (opened by the author's click) -->
      <textarea bind:value={text} rows="3" placeholder={margin ? `${label}: what should change, and why?` : "What should change here, and why?"} autofocus></textarea>
      <div class="actions">
        <button class="btn" type="submit" disabled={!text.trim() || saving}>{saving ? "Saving…" : "Save suggestion"}</button>
        <button class="btn-quiet" type="button" onclick={() => ((writing = false), (text = ""))}>Cancel</button>
      </div>
    </form>
  {/if}
</div>

<style>
  .part {
    margin-top: 0.9rem;
    padding: 0.7rem 0.9rem;
    border: 1px solid var(--border);
    border-radius: var(--radius);
  }
  .part.has-open {
    border-color: var(--accent);
  }
  .part.margin {
    position: relative;
    margin-top: 0;
    padding: 0.1rem 2.4rem 0.1rem 0;
    border: none;
    border-radius: 0;
  }
  .part.margin.has-open {
    border-right: 3px solid var(--review-edge);
  }
  .pin {
    position: absolute;
    top: 0.2rem;
    right: 0;
    display: grid;
    place-items: center;
    width: 2rem;
    height: 2rem;
    padding: 0;
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--review);
    opacity: 0.3;
    transition: opacity 120ms ease, background-color 120ms ease;
  }
  .part.margin:hover .pin,
  .pin:focus-visible {
    opacity: 1;
    background: var(--review-bg);
    border-color: var(--review-edge);
  }
  @media (hover: none) {
    .pin {
      opacity: 0.85;
    }
  }
  .part-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 1rem;
    margin-bottom: 0.3rem;
  }
  .label {
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--text-2);
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  .part-head .btn-quiet {
    font-size: 0.85rem;
  }
  .suggestion {
    margin-top: 0.6rem;
    padding: 0.5rem 0.75rem;
    border-left: 3px solid var(--accent);
    background: var(--fallback-bg);
    border-radius: var(--radius);
  }
  .suggestion.resolved {
    border-left-color: var(--right);
    opacity: 0.8;
  }
  .suggestion.withdrawn {
    border-left-color: var(--border);
    opacity: 0.6;
  }
  .suggestion p {
    margin: 0.2rem 0;
  }
  .who {
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--text-2);
  }
  .note {
    color: var(--text-2);
    font-size: 0.9rem;
  }
  form {
    margin-top: 0.6rem;
    display: grid;
    gap: 0.5rem;
  }
  textarea {
    font: inherit;
    color: var(--text);
    background: var(--surface);
    border: 2px solid var(--border);
    border-radius: var(--radius);
    padding: 0.5rem 0.7rem;
    resize: vertical;
  }
  textarea:focus {
    outline: none;
    border-color: var(--accent);
  }
  .actions {
    display: flex;
    gap: 1rem;
    align-items: center;
  }
</style>
