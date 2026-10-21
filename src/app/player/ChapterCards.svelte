<script lang="ts">
  // A card per chapter, with this browser's progress for the last name typed here.
  import type { ChapterCard } from "../../shared/lesson.ts";
  import { lastName, loadProgress, lessonProgress } from "../lib/progress.ts";

  let { subjectSlug, chapters }: { subjectSlug: string; chapters: ChapterCard[] } = $props();

  const name = lastName();
  function progress(c: ChapterCard) {
    const p = name ? loadProgress(c.slug, name) : {};
    let done = 0;
    let total = 0;
    for (const l of c.lessons) {
      const lp = lessonProgress(p, l.id);
      total += l.moduleIds.length;
      done += l.moduleIds.filter((id) => lp.done.includes(id)).length;
    }
    return { done, total };
  }
</script>

<ul class="cards">
  {#each chapters as c, i (c.slug)}
    {@const p = progress(c)}
    <li>
      <a class="card chapter" href="/s/{subjectSlug}/{c.slug}">
        <span class="label">Chapter {i + 1}</span>
        <span class="title">{c.title}</span>
        {#if c.overview}<span class="overview">{c.overview}</span>{/if}
        <span class="meta num">
          {c.lessons.length} lesson{c.lessons.length === 1 ? "" : "s"} · {p.done} / {p.total} modules
        </span>
        <span class="bar"><span style="width: {p.total ? (100 * p.done) / p.total : 0}%"></span></span>
      </a>
    </li>
  {/each}
</ul>

<style>
  .cards {
    list-style: none;
    padding: 0;
    margin: 0.6rem 0 1rem;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 16rem), 1fr));
    gap: 1rem;
  }
  .chapter {
    display: grid;
    gap: 0.4rem;
    height: 100%;
    padding: 1rem 1.1rem 1.1rem;
    border-top: 4px solid var(--accent);
  }
  .title {
    font-weight: 700;
    font-size: 1.05rem;
  }
  .overview {
    color: var(--text-2);
    font-size: 0.9rem;
  }
  .meta {
    color: var(--text-2);
    font-size: 0.82rem;
    margin-top: auto;
  }
  .bar {
    height: 5px;
    border-radius: 3px;
    background: var(--surface);
    overflow: hidden;
  }
  .bar span {
    display: block;
    height: 100%;
    background: var(--accent);
  }
</style>
