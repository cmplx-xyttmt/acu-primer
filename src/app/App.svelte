<script lang="ts">
  import { route } from "./router.svelte.ts";
  import Player from "./player/Player.svelte";
  import AuthorGate from "./author/AuthorGate.svelte";
  import AuthorHome from "./author/AuthorHome.svelte";
  import Review from "./author/Review.svelte";
  import Students from "./author/Students.svelte";
  import StudentLog from "./author/StudentLog.svelte";

  const courseMatch = $derived(route.path.match(/^\/c\/([a-z0-9-]+)\/?$/));
  const reviewMatch = $derived(route.path.match(/^\/author\/lessons\/([a-z0-9-]+)\/?$/));
  const authorHome = $derived(/^\/author\/?$/.test(route.path));
  const studentsMatch = $derived(route.path.match(/^\/author\/courses\/([a-z0-9-]+)\/students\/?$/));
  const logMatch = $derived(route.path.match(/^\/author\/courses\/([a-z0-9-]+)\/log\/?$/));
  const logParams = $derived(logMatch ? new URLSearchParams(route.search) : null);
</script>

{#if studentsMatch}
  <AuthorGate>
    {#snippet children({ onLocked })}
      {#key studentsMatch[1]}
        <Students courseId={studentsMatch[1]} {onLocked} />
      {/key}
    {/snippet}
  </AuthorGate>
{:else if logMatch && logParams}
  <AuthorGate>
    {#snippet children({ onLocked })}
      {#key route.search}
        <StudentLog
          courseId={logMatch[1]}
          name={logParams.get("name") ?? ""}
          device={logParams.get("device") ?? ""}
          {onLocked}
        />
      {/key}
    {/snippet}
  </AuthorGate>
{:else if reviewMatch}
  <AuthorGate>
    {#snippet children({ onLocked })}
      {#key reviewMatch[1]}
        <Review lessonId={reviewMatch[1]} {onLocked} />
      {/key}
    {/snippet}
  </AuthorGate>
{:else if authorHome}
  <AuthorGate>
    {#snippet children({ onLocked })}
      <AuthorHome {onLocked} />
    {/snippet}
  </AuthorGate>
{:else if courseMatch}
  {#key courseMatch[1]}
    <Player slug={courseMatch[1]} />
  {/key}
{:else}
  <main class="page">
    <h1>acu-primer</h1>
    <p class="muted">Short, interactive lessons that change course when you get something wrong.</p>
    <p><a href="/c/openintro-sampling">Open the sampling distributions course</a></p>
    <p class="muted">Writing or reviewing lessons? <a href="/author">Go to the author side</a> (asks for the passphrase).</p>
  </main>
{/if}
