<script lang="ts">
  // Every module title in order, with where the student stands on each. Reached modules can
  // be opened; later ones are shown but locked, so the checks can't be skipped by jumping.
  import type { Lesson } from "../../shared/lesson.ts";
  import { isReached, type LessonProgress } from "../lib/progress.ts";

  let {
    lesson,
    progress,
    here,
    onPick,
  }: {
    lesson: Lesson;
    progress: LessonProgress;
    here: number | null; // the module on screen, if any
    onPick: (index: number) => void;
  } = $props();

  const ids = $derived(lesson.modules.map((m) => m.id));
</script>

<ol class="outline">
  {#each lesson.modules as mod, i (mod.id)}
    {@const passed = progress.done.includes(mod.id)}
    {@const skipped = !passed && progress.skipped.includes(mod.id)}
    {@const open = isReached(progress, ids, i)}
    <li>
      <button class="item" class:here={here === i} disabled={!open} onclick={() => onPick(i)}>
        <span class="num mark" aria-hidden="true">{passed ? "✓" : skipped ? "–" : i + 1}</span>
        <span class="title">{mod.title}</span>
        <span class="state">
          {#if here === i}You're here{:else if skipped}Skipped{:else if !open}Locked{/if}
        </span>
      </button>
    </li>
  {/each}
</ol>

<style>
  .outline {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.25rem;
  }
  .item {
    width: 100%;
    display: grid;
    grid-template-columns: 1.75rem minmax(0, 1fr) auto;
    gap: 0.6rem;
    align-items: center;
    text-align: left;
    background: none;
    border: 1px solid transparent;
    border-radius: var(--radius);
    padding: 0.5rem 0.6rem;
  }
  .item:hover:not(:disabled) {
    background: var(--surface);
  }
  .item:disabled {
    cursor: default;
    color: var(--text-2);
    opacity: 0.6;
  }
  .item.here {
    border-color: var(--accent);
  }
  .mark {
    display: inline-flex;
    justify-content: center;
    align-items: center;
    width: 1.6rem;
    height: 1.6rem;
    border-radius: 999px;
    background: var(--surface);
    font-size: 0.8rem;
  }
  .state {
    font-size: 0.8rem;
    color: var(--text-2);
    white-space: nowrap;
  }
</style>
