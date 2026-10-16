<script lang="ts">
  // Courses, their lessons and marks, and the owner's show-unreviewed switch.
  import type { AuthorCourse } from "../../shared/lesson.ts";
  import { authorApi, ApiError } from "../lib/api.ts";
  import { navigate } from "../router.svelte.ts";
  import ThemeSwitch from "../player/ThemeSwitch.svelte";
  import Mark from "./Mark.svelte";

  let { onLocked }: { onLocked: () => void } = $props();

  let courses = $state<AuthorCourse[] | null>(null);
  let error = $state("");

  function fail(err: unknown) {
    if (err instanceof ApiError && err.status === 401) onLocked();
    else error = err instanceof Error ? err.message : "Something went wrong.";
  }

  authorApi.courses().then((c) => (courses = c), fail);

  let budget = $state<{ spentUsd: number; budgetUsd: number; model: string; hasKey: boolean } | null>(null);
  authorApi.budget().then((b) => (budget = b), fail);

  // The course brief: who the learner is and how they learn. Every draft for the course gets it.
  let briefs = $state<Record<string, string>>({});
  let savedBrief = $state<Record<string, boolean>>({});
  async function saveBrief(course: AuthorCourse) {
    try {
      await authorApi.setBrief(course.id, briefs[course.id] ?? "");
      savedBrief[course.id] = true;
    } catch (err) {
      fail(err);
    }
  }

  async function toggle(course: AuthorCourse) {
    const next = !course.showUnreviewed;
    try {
      await authorApi.setShowUnreviewed(course.id, next);
      course.showUnreviewed = next;
    } catch (err) {
      fail(err);
    }
  }

  function go(e: MouseEvent, to: string) {
    e.preventDefault();
    navigate(to);
  }
</script>

<main class="page wide">
  <div class="head">
    <h1>Author</h1>
    <ThemeSwitch />
  </div>
  {#if error}<p class="error">{error}</p>{/if}
  {#if budget}
    <p class="muted budget">
      Claude this month: <span class="num">${budget.spentUsd.toFixed(2)}</span> of <span class="num">${budget.budgetUsd}</span> ({budget.model}){budget.hasKey ? "" : ", no API key on this server"}.
    </p>
  {/if}

  {#if !courses}
    <p class="muted">Loading…</p>
  {:else if courses.length === 0}
    <p class="muted">No courses yet. Import one with <code>npm run import:local -- content/&lt;course&gt;</code>.</p>
  {:else}
    {#each courses as course (course.id)}
      <section class="course">
        <div class="course-head">
          <h2>{course.title}</h2>
          <span class="links">
            <a href="/author/courses/{course.id}/draft" onclick={(e) => go(e, `/author/courses/${course.id}/draft`)}>Draft a lesson</a>
            <a href="/author/courses/{course.id}/students" onclick={(e) => go(e, `/author/courses/${course.id}/students`)}>Students</a>
            <a href="/c/{course.slug}" onclick={(e) => go(e, `/c/${course.slug}`)}>Open as a student</a>
          </span>
        </div>
        <details class="brief">
          <summary>Course brief{course.brief ? "" : " (none yet)"}</summary>
          <p class="muted">Who the learner is and how they want to learn. Every draft for this course follows it.</p>
          <textarea
            rows="4"
            value={briefs[course.id] ?? course.brief ?? ""}
            oninput={(e) => ((briefs[course.id] = (e.currentTarget as HTMLTextAreaElement).value), (savedBrief[course.id] = false))}
            placeholder="e.g. I'm a software engineer learning operating systems on my own. I learn by doing: give me commands to run on my Mac."
          ></textarea>
          <button class="btn-quiet" onclick={() => saveBrief(course)}>{savedBrief[course.id] ? "Saved ✓" : "Save the brief"}</button>
        </details>
        <label class="switch">
          <input type="checkbox" checked={course.showUnreviewed} onchange={() => toggle(course)} />
          Show unreviewed lessons to students
        </label>
        <ul>
          {#each course.lessons as lesson (lesson.id)}
            <li>
              <a href="/author/lessons/{lesson.id}" onclick={(e) => go(e, `/author/lessons/${lesson.id}`)}>
                {lesson.title}
              </a>
              <span class="right-side">
                <Mark status={lesson.status} />
                <a
                  class="review"
                  href="/author/lessons/{lesson.id}"
                  onclick={(e) => go(e, `/author/lessons/${lesson.id}`)}
                >
                  {lesson.status === "reviewed" ? "View" : "Review"}
                </a>
              </span>
            </li>
          {:else}
            <li class="muted">No lessons in this course yet.</li>
          {/each}
        </ul>
      </section>
    {/each}
  {/if}
</main>

<style>
  .wide {
    max-width: 52rem;
  }
  .head,
  .course-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 1rem;
    flex-wrap: wrap;
  }
  .course {
    margin-top: 1.5rem;
    padding: 1rem 1.1rem;
    background: var(--surface);
    border-radius: var(--radius);
  }
  h2 {
    margin: 0;
    font-size: 1.1rem;
  }
  a {
    color: var(--accent);
  }
  .switch {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    margin: 0.75rem 0;
    font-size: 0.92rem;
  }
  ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 0.5rem;
  }
  li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
  }
  .brief {
    margin-top: 0.6rem;
    font-size: 0.92rem;
  }
  .brief summary {
    cursor: pointer;
    color: var(--text-2);
  }
  .brief textarea {
    width: 100%;
    font: inherit;
    color: var(--text);
    background: var(--bg);
    border: 2px solid var(--border);
    border-radius: var(--radius);
    padding: 0.5rem 0.7rem;
    margin: 0.3rem 0;
  }
  .budget {
    margin: 0.25rem 0 0;
    font-size: 0.9rem;
  }
  .links {
    display: flex;
    gap: 1rem;
  }
  .right-side {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  .review {
    font-weight: 600;
    font-size: 0.9rem;
    padding: 0.2rem 0.7rem;
    border: 1px solid var(--accent);
    border-radius: var(--radius);
    text-decoration: none;
  }
  .error {
    color: var(--wrong);
  }
</style>
