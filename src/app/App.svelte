<script lang="ts">
  import { route } from "./router.svelte.ts";
  import Player from "./player/Player.svelte";

  const courseMatch = $derived(route.path.match(/^\/c\/([a-z0-9-]+)\/?$/));
</script>

{#if courseMatch}
  {#key courseMatch[1]}
    <Player slug={courseMatch[1]} />
  {/key}
{:else}
  <main class="page">
    <h1>acu-primer</h1>
    <p class="muted">Short, interactive lessons that change course when you get something wrong.</p>
    <p><a href="/c/openintro-sampling">Open the sampling distributions course</a></p>
  </main>
{/if}
