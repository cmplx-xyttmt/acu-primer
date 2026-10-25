<script lang="ts">
  // The home page: who acu-primer is, Continue for whatever this browser played last, and a
  // card per subject.
  import type { SubjectCard } from "../../shared/lesson.ts";
  import { fetchSubjects } from "../lib/api.ts";
  import { lastPlayed } from "../lib/lastPlayed.ts";
  import { lastName, rememberName } from "../lib/progress.ts";
  import Logo from "../Logo.svelte";
  import ThemeSwitch from "./ThemeSwitch.svelte";
  import BookOpen from "@lucide/svelte/icons/book-open";
  import Play from "@lucide/svelte/icons/play";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import PenLine from "@lucide/svelte/icons/pen-line";

  let subjects = $state<SubjectCard[] | null>(null);
  let error = $state("");
  fetchSubjects().then((s) => (subjects = s), (e) => (error = e.message));
  const last = lastPlayed();
  // A first visit (nothing played yet) gets one chapter to start with: the one with the
  // sampling exploration and the hints for each wrong answer. Hidden if it isn't public.
  const START_HERE = { subject: "openintro-statistics", chapter: "openintro-sampling" };
  const startHere = $derived(
    subjects?.find((s) => s.slug === START_HERE.subject)?.chapters.find((c) => c.slug === START_HERE.chapter) ?? null,
  );
  let who = $state(lastName());
  let editing = $state(false);
  let draftName = $state("");

  function saveName(e: SubmitEvent) {
    e.preventDefault();
    if (!draftName.trim()) return;
    rememberName(draftName);
    who = lastName();
    editing = false;
  }
</script>

<div class="topbar">
  <Logo size={26} />
  <span class="who">
    {#if who && !editing}
      <span class="muted">{who}</span>
      <button class="btn-quiet btn-sm" onclick={() => ((draftName = who), (editing = true))}>Not you?</button>
    {/if}
    <ThemeSwitch />
  </span>
</div>

<main class="page wide">
  {#if editing}
    <form class="rename card" onsubmit={saveName}>
      <label for="rename">Your name</label>
      <!-- svelte-ignore a11y_autofocus (opened by pressing "Not you?") -->
      <input id="rename" type="text" bind:value={draftName} autocomplete="name" autofocus />
      <button class="btn btn-sm" type="submit" disabled={!draftName.trim()}>Save</button>
      <button class="btn-quiet btn-sm" type="button" onclick={() => (editing = false)}>Cancel</button>
    </form>
  {/if}
  <section class="hero banner">
    <Logo size={64} wordmark={false} />
    <div>
      <h1>acu-primer</h1>
      <p class="muted">Short, interactive lessons designed to help you grasp concepts faster. Study subjects curated by instructors, or create your own interactive courses quickly using AI.</p>
    </div>
  </section>

  {#if !last && startHere}
    <a class="continue card" href="/s/{START_HERE.subject}/{START_HERE.chapter}">
      <span class="play"><Play size={18} aria-hidden="true" /></span>
      <span>
        <span class="label">New here? Start with a short lesson</span>
        <strong>{startHere.title}</strong>
      </span>
      <ChevronRight size={20} aria-hidden="true" />
    </a>
  {:else if last}
    <a class="continue card" href="/s/{last.subjectSlug}/{last.chapterSlug}">
      <span class="play"><Play size={18} aria-hidden="true" /></span>
      <span>
        <span class="label">Continue{who ? ` as ${who}` : ""}</span>
        <strong>{last.chapterTitle}</strong>
      </span>
      <ChevronRight size={20} aria-hidden="true" />
    </a>
  {/if}

  <h2>Subjects</h2>
  {#if error}<p class="muted">{error}</p>{/if}
  {#if subjects}
    {#if subjects.length === 0}
      <p class="muted">Nothing is ready to study yet.</p>
    {:else}
      <ul class="cards">
        {#each subjects as s (s.slug)}
          <li>
            <a class="card subject" href="/s/{s.slug}">
              <span class="band"><BookOpen size={22} aria-hidden="true" /></span>
              <span class="body">
                <span class="title">{s.title}</span>
                {#if s.overview}<span class="overview">{s.overview}</span>{/if}
                <span class="badge">{s.chapters.length} chapter{s.chapters.length === 1 ? "" : "s"}</span>
              </span>
            </a>
          </li>
        {/each}
      </ul>
    {/if}
  {/if}

  <p class="author"><a class="btn-quiet btn-sm" href="/author"><PenLine size={15} aria-hidden="true" />Writing or reviewing lessons? Author side</a></p>
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
  .who {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  .rename {
    margin-top: 0.8rem;
    padding: 0.8rem 1rem;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.6rem;
  }
  .rename label {
    font-weight: 600;
  }
  .rename input {
    flex: 1 1 10rem;
    min-width: 0;
  }
  .wide {
    max-width: 52rem;
  }
  .hero {
    display: flex;
    gap: 1.2rem;
    align-items: center;
    padding: 1.6rem 1.5rem;
  }
  .hero h1 {
    margin: 0 0 0.4rem;
    font-size: 1.6rem;
  }
  .hero p {
    margin: 0;
    max-width: 34rem;
  }
  .continue {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.9rem;
    padding: 0.9rem 1.1rem;
    margin-bottom: 1.5rem;
  }
  .continue span {
    display: grid;
  }
  .play {
    display: grid;
    place-items: center;
    width: 2.4rem;
    height: 2.4rem;
    border-radius: 999px;
    background: var(--accent);
    color: var(--accent-text);
  }
  h2 {
    font-size: 1.15rem;
    margin: 1.4rem 0 0.6rem;
  }
  .cards {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 16rem), 1fr));
    gap: 1rem;
  }
  .subject {
    display: grid;
    grid-template-rows: auto 1fr;
    height: 100%;
    overflow: hidden;
  }
  .band {
    display: flex;
    align-items: center;
    padding: 0.9rem 1.1rem;
    background: var(--banner);
    color: var(--accent);
  }
  .body {
    display: grid;
    align-content: start;
    gap: 0.45rem;
    padding: 0.9rem 1.1rem 1.1rem;
  }
  .title {
    font-weight: 700;
    font-size: 1.08rem;
  }
  .overview {
    color: var(--text-2);
    font-size: 0.9rem;
  }
  .body .badge {
    justify-self: start;
  }
  .author {
    margin-top: 2.5rem;
  }
  @media (max-width: 560px) {
    .hero {
      flex-direction: column;
      align-items: flex-start;
    }
  }
</style>
