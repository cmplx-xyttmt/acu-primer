<script lang="ts">
  import { route } from "./router.svelte.ts";
  import Player from "./player/Player.svelte";
  import Home from "./player/Home.svelte";
  import NotFound from "./player/NotFound.svelte";
  import SubjectPage from "./player/SubjectPage.svelte";
  import AuthorGate from "./author/AuthorGate.svelte";
  import AuthorHome from "./author/AuthorHome.svelte";
  import Review from "./author/Review.svelte";
  import Students from "./author/Students.svelte";
  import StudentLog from "./author/StudentLog.svelte";
  import Session from "./author/Session.svelte";
  import BookStart from "./author/BookStart.svelte";

  // Students: / (subjects) → /s/<subject> (chapters) → /s/<subject>/<chapter> (the player).
  const chapterMatch = $derived(route.path.match(/^\/s\/([a-z0-9-]+)\/([a-z0-9-]+)\/?$/));
  const subjectMatch = $derived(route.path.match(/^\/s\/([a-z0-9-]+)\/?$/));
  const reviewMatch = $derived(route.path.match(/^\/author\/lessons\/([a-z0-9-]+)\/?$/));
  const authorHome = $derived(/^\/author\/?$/.test(route.path));
  const studentsMatch = $derived(route.path.match(/^\/author\/chapters\/([a-z0-9-]+)\/students\/?$/));
  const draftMatch = $derived(route.path.match(/^\/author\/chapters\/([a-z0-9-]+)\/draft\/?$/));
  const logMatch = $derived(route.path.match(/^\/author\/chapters\/([a-z0-9-]+)\/log\/?$/));
  const logParams = $derived(logMatch ? new URLSearchParams(route.search) : null);
  const newBook = $derived(/^\/author\/books\/new\/?$/.test(route.path));

  // Links from the Oct 16 deploy, before subjects: /c/<chapter>. Only these two chapters existed.
  const OLD_CHAPTERS: Record<string, string> = { "openintro-sampling": "/s/openintro-statistics/openintro-sampling" };
  $effect(() => {
    const old = route.path.match(/^\/c\/([a-z0-9-]+)\/?$/);
    if (old && OLD_CHAPTERS[old[1]]) {
      history.replaceState({}, "", OLD_CHAPTERS[old[1]]);
      dispatchEvent(new PopStateEvent("popstate")); // the router reads the new address
    }
  });
</script>

{#if newBook}
  <AuthorGate>
    {#snippet children({ onLocked })}
      <BookStart {onLocked} />
    {/snippet}
  </AuthorGate>
{:else if draftMatch}
  <AuthorGate>
    {#snippet children({ onLocked })}
      {#key draftMatch[1]}
        <Session chapterId={draftMatch[1]} {onLocked} />
      {/key}
    {/snippet}
  </AuthorGate>
{:else if studentsMatch}
  <AuthorGate>
    {#snippet children({ onLocked })}
      {#key studentsMatch[1]}
        <Students chapterId={studentsMatch[1]} {onLocked} />
      {/key}
    {/snippet}
  </AuthorGate>
{:else if logMatch && logParams}
  <AuthorGate>
    {#snippet children({ onLocked })}
      {#key route.search}
        <StudentLog
          chapterId={logMatch[1]}
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
{:else if chapterMatch}
  {#key chapterMatch[2]}
    <Player subjectSlug={chapterMatch[1]} slug={chapterMatch[2]} />
  {/key}
{:else if subjectMatch}
  {#key subjectMatch[1]}
    <SubjectPage slug={subjectMatch[1]} />
  {/key}
{:else if route.path === "/" || route.path === "/index.html"}
  <Home />
{:else}
  <NotFound />
{/if}
