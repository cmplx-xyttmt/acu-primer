<script lang="ts">
  // The authoring session (slice 3b): pick the book PDF and a page range, and Claude drafts a
  // lesson from just those pages. The PDF stays on this laptop; only the cut pages are sent.
  // The draft is saved unreviewed and then goes through the step-by-step review.
  import type { AuthorChapter, AuthorSubject } from "../../shared/lesson.ts";
  import { authorApi, streamDraft, ApiError } from "../lib/api.ts";
  import { navigate } from "../router.svelte.ts";
  import ThemeSwitch from "../player/ThemeSwitch.svelte";

  let { chapterId, onLocked }: { chapterId: string; onLocked: () => void } = $props();

  let chapter = $state<AuthorChapter | null>(null);
  let subject = $state<AuthorSubject | null>(null);
  let budget = $state<{ spentUsd: number; budgetUsd: number; model: string; hasKey: boolean } | null>(null);
  let file = $state<File | null>(null);
  let book = $state("");
  let pages = $state("");
  let section = $state("");

  let phase = $state<"form" | "cutting" | "uploading" | "drafting" | "done" | "failed">("form");
  let chars = $state(0);
  let attempt = $state(1);
  let seconds = $state(0);
  let result = $state<{ lessonId: string; cost: number; seconds: number; attempts: number } | null>(null);
  let error = $state("");
  let timer: ReturnType<typeof setInterval> | undefined;

  function fail(err: unknown) {
    if (err instanceof ApiError && err.status === 401) return onLocked();
    error = err instanceof Error ? err.message : "Something went wrong.";
    phase = "failed";
    clearInterval(timer);
  }

  // svelte-ignore state_referenced_locally (App.svelte re-creates this per chapter)
  authorApi.subjects().then((subjects) => {
    subject = subjects.find((s) => s.chapters.some((c) => c.id === chapterId)) ?? null;
    chapter = subject?.chapters.find((c) => c.id === chapterId) ?? null;
  }, fail);
  const loadBudget = () => authorApi.budget().then((b) => (budget = b), fail);
  loadBudget();

  const ready = $derived(!!file && book.trim() && pages.trim() && section.trim() && phase !== "cutting" && phase !== "uploading" && phase !== "drafting");
  const left = $derived(budget ? budget.budgetUsd - budget.spentUsd : 0);

  async function draft() {
    if (!file) return;
    error = "";
    chars = 0;
    attempt = 1;
    seconds = 0;
    try {
      phase = "cutting";
      const { cutPages } = await import("../lib/pdfPages.ts"); // only loaded here, never for students
      const cut = await cutPages(await file.arrayBuffer(), pages);
      phase = "uploading";
      const { sourceId } = await authorApi.uploadSource(chapterId, book.trim(), `pp. ${pages.trim()}`, cut);
      phase = "drafting";
      const started = Date.now();
      timer = setInterval(() => (seconds = Math.round((Date.now() - started) / 1000)), 1000);
      await streamDraft(sourceId, section.trim(), (e) => {
        if ("alive" in e) {
          seconds = e.alive;
        } else if ("chars" in e) {
          chars = e.chars;
          attempt = e.attempt;
        } else if ("done" in e) {
          result = { lessonId: e.done, cost: e.usage.costUsd, seconds: e.seconds, attempts: e.attempts };
          phase = "done";
        } else {
          error = e.error + (e.usage ? ` (this attempt cost $${e.usage.costUsd.toFixed(3)})` : "");
          phase = "failed";
        }
      });
      if (phase === "drafting") throw new Error("The connection closed before the draft finished.");
    } catch (err) {
      fail(err);
    } finally {
      clearInterval(timer);
      loadBudget();
    }
  }

  const go = (e: MouseEvent, to: string) => {
    e.preventDefault();
    navigate(to);
  };
</script>

<div class="top">
  <a href="/author" onclick={(e) => go(e, "/author")}>All lessons</a>
  <ThemeSwitch />
</div>

<main class="page wide">
  <h1>Draft a lesson</h1>
  <p class="muted">{subject?.title ? `${subject.title} · ` : ""}{chapter ? chapter.title : "…"}</p>
  {#if subject}
    <p class="muted brief-note">
      {subject.brief ? `Drafts follow the subject's learner brief: "${subject.brief.slice(0, 140)}${subject.brief.length > 140 ? "…" : ""}"` : "This subject has no learner brief yet, so drafts assume first-year university students. Add one on the author home."}
    </p>
  {/if}

  {#if budget}
    <p class="budget" class:low={left < 2}>
      Claude this month: <span class="num">${budget.spentUsd.toFixed(2)}</span> of <span class="num">${budget.budgetUsd}</span> spent.
      The first real draft (11 pages, {budget.model}, high effort) took 10½ minutes and cost $1.28.
      {#if !budget.hasKey}<strong>No API key on this server, so drafting won't work.</strong>{/if}
    </p>
  {/if}

  {#if phase === "done" && result}
    <section class="done">
      <h2>Drafted</h2>
      <p>
        In {result.seconds} s{result.attempts > 1 ? ` (${result.attempts} attempts)` : ""}, for about
        <span class="num">${result.cost.toFixed(2)}</span>. It's saved as "written by the model, not yet reviewed", and students won't see it until you sign it off.
      </p>
      <a class="btn" href="/author/lessons/{result.lessonId}" onclick={(e) => go(e, `/author/lessons/${result!.lessonId}`)}>Review it step by step</a>
    </section>
  {:else}
    <form
      onsubmit={(e) => {
        e.preventDefault();
        if (ready) draft();
      }}
    >
      <label>
        Book or reading (PDF, stays on this laptop)
        <input type="file" accept="application/pdf" onchange={(e) => (file = (e.currentTarget as HTMLInputElement).files?.[0] ?? null)} />
      </label>
      <label>
        Book title, as students should see it
        <input type="text" bind:value={book} placeholder="OpenIntro Statistics, 4th ed." />
      </label>
      <label>
        Pages, as your PDF viewer numbers them
        <input type="text" bind:value={pages} placeholder="170-180" />
      </label>
      <label>
        Section
        <input type="text" bind:value={section} placeholder="5.1 Point estimates and sampling variability" />
      </label>
      <button class="btn" type="submit" disabled={!ready || (budget ? left <= 0 || !budget.hasKey : true)}>Draft</button>
    </form>

    {#if phase === "cutting"}<p class="muted">Cutting the pages…</p>{/if}
    {#if phase === "uploading"}<p class="muted">Sending the pages…</p>{/if}
    {#if phase === "drafting"}
      <p class="progress">
        {#if chars === 0}
          Claude is thinking about the pages ({seconds} s). At high effort this can take several minutes before any of the lesson appears.
        {:else}
          Claude is writing the lesson: <span class="num">{chars.toLocaleString()}</span> characters so far, {seconds} s{attempt > 1 ? ", second attempt after fixing problems" : ""}.
        {/if}
        Keep this tab open: closing it loses the draft. A draft of about ten pages has taken around 10 minutes.
      </p>
    {/if}
    {#if error}<p class="error">{error}</p>{/if}
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
  .brief-note {
    font-size: 0.88rem;
  }
  .budget {
    padding: 0.6rem 0.9rem;
    background: var(--surface);
    border-radius: var(--radius);
    font-size: 0.92rem;
  }
  .budget.low {
    border-left: 3px solid var(--wrong);
  }
  form {
    display: grid;
    gap: 0.9rem;
    margin-top: 1.25rem;
  }
  label {
    display: grid;
    gap: 0.35rem;
    font-weight: 600;
    font-size: 0.92rem;
  }
  input[type="file"] {
    font: inherit;
    font-weight: 400;
  }
  .btn {
    justify-self: start;
    text-decoration: none;
  }
  .progress {
    margin-top: 1rem;
  }
  .done {
    margin-top: 1rem;
  }
  .error {
    color: var(--wrong);
  }
</style>
