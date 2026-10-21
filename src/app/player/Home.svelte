<script lang="ts">
  // The home page: a card per subject, and Continue for whatever this browser played last.
  import type { SubjectCard } from "../../shared/lesson.ts";
  import { fetchSubjects } from "../lib/api.ts";
  import { lastPlayed } from "../lib/lastPlayed.ts";
  import ThemeSwitch from "./ThemeSwitch.svelte";

  let subjects = $state<SubjectCard[] | null>(null);
  let error = $state("");
  fetchSubjects().then((s) => (subjects = s), (e) => (error = e.message));
  const last = lastPlayed();
</script>

<div class="corner"><ThemeSwitch /></div>
<main class="page wide">
  <h1>acu-primer</h1>
  <p class="muted lede">Short, interactive lessons that change course when you get something wrong, written with a person checking every one.</p>

  {#if last}
    <a class="continue" href="/s/{last.subjectSlug}/{last.chapterSlug}">
      <span class="muted">Continue</span>
      <strong>{last.chapterTitle}</strong>
    </a>
  {/if}

  {#if error}<p class="muted">{error}</p>{/if}
  {#if subjects}
    {#if subjects.length === 0}
      <p class="muted">Nothing is ready to study yet.</p>
    {:else}
      <ul class="cards">
        {#each subjects as s (s.slug)}
          <li>
            <a class="card" href="/s/{s.slug}">
              <span class="title">{s.title}</span>
              {#if s.overview}<span class="overview">{s.overview}</span>{/if}
              <span class="meta">{s.chapters.length} chapter{s.chapters.length === 1 ? "" : "s"}</span>
            </a>
          </li>
        {/each}
      </ul>
    {/if}
  {/if}

  <p class="muted author">Writing or reviewing lessons? <a href="/author">Author side</a></p>
</main>

<style>
  .corner {
    display: flex;
    justify-content: flex-end;
    max-width: 52rem;
    margin: 0 auto;
    padding: 0.9rem 16px 0;
  }
  .wide {
    max-width: 52rem;
  }
  .lede {
    max-width: 34rem;
  }
  .continue {
    display: grid;
    gap: 0.15rem;
    margin: 1.25rem 0 0.5rem;
    padding: 0.9rem 1.1rem;
    border-radius: var(--radius);
    background: var(--fallback-bg);
    border-left: 4px solid var(--accent);
    color: var(--text);
    text-decoration: none;
  }
  .cards {
    list-style: none;
    padding: 0;
    margin: 1.25rem 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 16rem), 1fr));
    gap: 0.9rem;
  }
  .card {
    display: grid;
    gap: 0.4rem;
    height: 100%;
    padding: 1.1rem 1.2rem;
    background: var(--surface);
    border: 2px solid transparent;
    border-radius: var(--radius);
    color: var(--text);
    text-decoration: none;
  }
  .card:hover {
    border-color: var(--hover-border);
  }
  .title {
    font-weight: 700;
    font-size: 1.1rem;
  }
  .overview {
    color: var(--text-2);
    font-size: 0.92rem;
  }
  .meta {
    color: var(--text-2);
    font-size: 0.82rem;
    margin-top: auto;
  }
  .author {
    margin-top: 2.5rem;
    font-size: 0.9rem;
  }
  a {
    color: var(--accent);
  }
</style>
