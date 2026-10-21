<script lang="ts">
  // One subject: its overview and a card per chapter students can open.
  import type { SubjectCard } from "../../shared/lesson.ts";
  import { fetchSubject } from "../lib/api.ts";
  import Logo from "../Logo.svelte";
  import ChapterCards from "./ChapterCards.svelte";
  import ThemeSwitch from "./ThemeSwitch.svelte";
  import ArrowLeft from "@lucide/svelte/icons/arrow-left";

  let { slug }: { slug: string } = $props();
  let subject = $state<SubjectCard | null>(null);
  let error = $state("");
  // svelte-ignore state_referenced_locally (App.svelte re-creates this per subject)
  fetchSubject(slug).then((s) => (subject = s), (e) => (error = e.message));
</script>

<div class="topbar">
  <a class="home" href="/" aria-label="All subjects"><Logo size={24} /></a>
  <ThemeSwitch />
</div>
<main class="page wide">
  {#if error}
    <h1>Can't open this subject</h1>
    <p class="muted">{error}</p>
  {:else if !subject}
    <p class="muted">Loading…</p>
  {:else}
    <section class="banner">
      <a class="up" href="/"><ArrowLeft size={14} aria-hidden="true" />All subjects</a>
      <h1>{subject.title}</h1>
      {#if subject.overview}<p class="muted lede">{subject.overview}</p>{/if}
    </section>
    {#if subject.chapters.length === 0}
      <p class="muted">No chapters are ready in this subject yet.</p>
    {:else}
      <h2>Chapters</h2>
      <ChapterCards subjectSlug={subject.slug} chapters={subject.chapters} />
    {/if}
  {/if}
</main>

<style>
  .topbar {
    max-width: 52rem;
    margin: 0 auto;
    padding: 0.8rem 16px 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .home {
    text-decoration: none;
  }
  .wide {
    max-width: 52rem;
  }
  .up {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.86rem;
    font-weight: 600;
    text-decoration: none;
  }
  .lede {
    margin: 0;
  }
  h2 {
    font-size: 1.15rem;
    margin: 1.4rem 0 0.4rem;
  }
</style>
