<script lang="ts">
  // One subject: its overview and a card per chapter students can open.
  import type { SubjectCard } from "../../shared/lesson.ts";
  import { fetchSubject } from "../lib/api.ts";
  import ChapterCards from "./ChapterCards.svelte";
  import ThemeSwitch from "./ThemeSwitch.svelte";

  let { slug }: { slug: string } = $props();
  let subject = $state<SubjectCard | null>(null);
  let error = $state("");
  // svelte-ignore state_referenced_locally (App.svelte re-creates this per subject)
  fetchSubject(slug).then((s) => (subject = s), (e) => (error = e.message));
</script>

<div class="top">
  <a href="/">All subjects</a>
  <ThemeSwitch />
</div>
<main class="page wide">
  {#if error}
    <h1>Can't open this subject</h1>
    <p class="muted">{error}</p>
  {:else if !subject}
    <p class="muted">Loading…</p>
  {:else}
    <h1>{subject.title}</h1>
    {#if subject.overview}<p class="muted">{subject.overview}</p>{/if}
    {#if subject.chapters.length === 0}
      <p class="muted">No chapters are ready in this subject yet.</p>
    {:else}
      <ChapterCards subjectSlug={subject.slug} chapters={subject.chapters} />
    {/if}
  {/if}
</main>

<style>
  .top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    max-width: 52rem;
    margin: 0 auto;
    padding: 0.9rem 16px 0;
  }
  .wide {
    max-width: 52rem;
  }
  a {
    color: var(--accent);
  }
</style>
