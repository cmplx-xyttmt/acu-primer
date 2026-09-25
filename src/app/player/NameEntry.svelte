<script lang="ts">
  import { lastName } from "../lib/progress.ts";

  let { title, onStart }: { title: string; onStart: (name: string) => void } = $props();

  let name = $state(lastName());
</script>

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
  .entry {
    padding-top: 18vh;
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
