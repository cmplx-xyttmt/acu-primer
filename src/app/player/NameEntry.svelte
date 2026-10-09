<script lang="ts">
  import { lastName } from "../lib/progress.ts";
  import ThemeSwitch from "./ThemeSwitch.svelte";

  let { title, onStart }: { title: string; onStart: (name: string) => void } = $props();

  let name = $state(lastName());
</script>

<div class="corner"><ThemeSwitch /></div>
<main class="page entry">
  <h1>{title}</h1>
  <form
    onsubmit={(e) => {
      e.preventDefault();
      if (name.trim()) onStart(name);
    }}
  >
    <label for="name">Your name</label>
    <!-- svelte-ignore a11y_autofocus (the only field on the page) -->
    <input id="name" type="text" bind:value={name} autocomplete="name" autofocus />
    <button class="btn" type="submit" disabled={!name.trim()}>Start</button>
  </form>
</main>

<style>
  .corner {
    display: flex;
    justify-content: flex-end;
    max-width: 40rem;
    margin: 0 auto;
    padding: 0.9rem 16px 0;
  }
  .entry {
    padding-top: 14vh;
  }
  form {
    display: grid;
    gap: 0.75rem;
    margin-top: 2rem;
  }
  label {
    font-weight: 600;
  }
  .btn {
    justify-self: start;
  }
</style>
