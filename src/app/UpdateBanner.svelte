<script lang="ts">
  // Shown when a new deploy is waiting (lib/appUpdate.svelte.ts). It's applied on the next
  // page change anyway; Reload applies it now.
  import { appUpdate } from "./lib/appUpdate.svelte.ts";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";
</script>

{#if appUpdate.ready}
  <div class="update" role="status">
    <span>A new version of acu-primer is ready.</span>
    <button class="btn btn-sm" onclick={() => appUpdate.now()}><RefreshCw size={15} aria-hidden="true" />Reload</button>
  </div>
{/if}

<style>
  .update {
    position: fixed;
    left: 50%;
    bottom: 16px;
    transform: translateX(-50%);
    z-index: 50;
    width: max-content;
    max-width: calc(100% - 32px);
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.6rem 0.9rem;
    padding: 0.6rem 0.75rem 0.6rem 1rem;
    background: var(--card);
    color: var(--text);
    border: 2px solid var(--border);
    border-radius: var(--radius);
    box-shadow: 0 6px 24px rgba(0, 0, 0, 0.18);
    font-size: 0.92rem;
  }
</style>
