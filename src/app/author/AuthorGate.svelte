<script lang="ts">
  // Wraps the author side. Children render once the passphrase works; a 401 from any author
  // request brings the passphrase form back (onLocked).
  import type { Snippet } from "svelte";
  import { authorApi, ApiError, savePassphrase, savedPassphrase } from "../lib/api.ts";

  let { children }: { children: Snippet<[{ onLocked: () => void }]> } = $props();

  let phase = $state<"checking" | "locked" | "open" | "unavailable">("checking");
  let typed = $state(savedPassphrase());
  let error = $state("");

  async function check() {
    try {
      await authorApi.courses();
      phase = "open";
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        phase = "locked";
        error = savedPassphrase() ? "That passphrase didn't work." : "";
      } else if (err instanceof ApiError && err.status === 503) {
        phase = "unavailable";
        error = err.message;
      } else {
        phase = "locked";
        error = err instanceof Error ? err.message : "Couldn't reach the server.";
      }
    }
  }
  check();

  function onLocked() {
    savePassphrase("");
    typed = "";
    phase = "locked";
  }
</script>

{#if phase === "open"}
  {@render children({ onLocked })}
{:else if phase === "checking"}
  <main class="page"><p class="muted">Loading…</p></main>
{:else if phase === "unavailable"}
  <main class="page">
    <h1>Author side</h1>
    <p class="muted">{error}</p>
  </main>
{:else}
  <main class="page gate">
    <h1>Author side</h1>
    <form
      onsubmit={(e) => {
        e.preventDefault();
        savePassphrase(typed.trim());
        phase = "checking";
        check();
      }}
    >
      <label for="passphrase">Passphrase</label>
      <input id="passphrase" type="password" bind:value={typed} autocomplete="current-password" />
      {#if error}<p class="error">{error}</p>{/if}
      <button class="btn" type="submit" disabled={!typed.trim()}>Open</button>
    </form>
  </main>
{/if}

<style>
  .gate {
    padding-top: 14vh;
  }
  form {
    display: grid;
    gap: 0.75rem;
    margin-top: 1.5rem;
  }
  label {
    font-weight: 600;
  }
  input {
    font: inherit;
    color: var(--text);
    background: var(--surface);
    border: 2px solid var(--border);
    border-radius: var(--radius);
    padding: 0.65rem 0.9rem;
  }
  input:focus {
    outline: none;
    border-color: var(--accent);
  }
  .error {
    color: var(--wrong);
    margin: 0;
  }
  .btn {
    justify-self: start;
  }
</style>
