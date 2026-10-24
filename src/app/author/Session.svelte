<script lang="ts">
  // The authoring session (slice 3b): pick the book PDF and a page range, and Claude drafts a
  // lesson from just those pages. For a chapter made from a book (Oct 23), its sections are
  // listed: picking one fills in the pages and title, and the PDF kept in this browser is used. The PDF stays on this laptop; only the cut pages are sent.
  // The draft is saved unreviewed and then goes through the step-by-step review.
  import type { AuthorChapter, AuthorSubject } from "../../shared/lesson.ts";
  import { authorApi, streamDraft, ApiError } from "../lib/api.ts";
  import { navigate } from "../router.svelte.ts";
  import AuthorBar from "./AuthorBar.svelte";
  import FileUp from "@lucide/svelte/icons/file-up";
  import WandSparkles from "@lucide/svelte/icons/wand-sparkles";
  import BookOpen from "@lucide/svelte/icons/book-open";
  import CircleCheck from "@lucide/svelte/icons/circle-check";
  import { keepBook, keptBook } from "../lib/bookStore.ts";
  import type { Section } from "../../shared/bookPlan.ts";

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
  let keptName = $state(""); // the PDF found in this browser, if any
  authorApi.subjects().then(async (subjects) => {
    subject = subjects.find((s) => s.chapters.some((c) => c.id === chapterId)) ?? null;
    chapter = subject?.chapters.find((c) => c.id === chapterId) ?? null;
    if (subject?.book) {
      book = subject.book.title;
      const kept = await keptBook(subject.id);
      if (kept) {
        file = kept;
        keptName = kept.name;
      }
    }
  }, fail);

  // A section was drafted already if a lesson in the chapter carries its title (without the number).
  const bare = (s: string) => s.toLowerCase().replace(/^[\d.]+\s*/, "").replace(/[^a-z0-9]+/g, " ").trim();
  const drafted = (s: Section) => !!chapter?.lessons.some((l) => bare(l.title).includes(bare(s.title)));
  function useSection(s: Section) {
    section = s.title;
    pages = s.pages;
  }
  function pickFile(f: File | null) {
    file = f;
    keptName = "";
    // Keep it for next time, for a subject made from a book.
    if (f && subject?.book) keepBook(subject.id, f).then((ok) => ok && (keptName = f.name));
  }
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

<AuthorBar back={{ href: "/author", label: "Your subjects" }} />

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

  {#if chapter?.plan && phase !== "done"}
    <section class="sections">
      <h2><BookOpen size={18} aria-hidden="true" />Sections in this chapter</h2>
      {#if chapter.plan.sections.length === 0}
        <p class="muted">The book's contents didn't list sections for this chapter, which runs over pp. {chapter.plan.pages}. Type the pages for one lesson below.</p>
      {:else}
        <p class="muted">Each section becomes one lesson. Pick one to fill in the form below.</p>
        <ul>
          {#each chapter.plan.sections as s (s.title + s.pages)}
            <li class:chosen={section === s.title && pages === s.pages}>
              <span class="t">{s.title}</span>
              <span class="muted num">pp. {s.pages}</span>
              {#if drafted(s)}<span class="badge badge-done">Drafted</span>{/if}
              <button class="btn-quiet btn-sm" onclick={() => useSection(s)}>{section === s.title && pages === s.pages ? "Chosen" : "Use this section"}</button>
            </li>
          {/each}
        </ul>
      {/if}
    </section>
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
        {#if file && keptName === file.name}
          <!-- The book kept from Start from a book: nothing to upload (Oct 24, Isaac read the old
               "Choose PDF" button as being asked for the file again). -->
          <span class="kept"><CircleCheck size={16} aria-hidden="true" />Using the book kept in this browser: {file.name} ({(file.size / 1048576).toFixed(1)} MB). Nothing to upload.</span>
        {/if}
        <span class="picker">
          <span class={file && keptName === file.name ? "btn-quiet btn-sm" : "btn-secondary btn-sm"}><FileUp size={15} aria-hidden="true" />{file && keptName === file.name ? "Use a different PDF" : "Choose PDF"}</span>
          {#if !(file && keptName === file.name)}
            <span class="muted">{file ? `${file.name} (${Math.round(file.size / 1024)} KB)` : subject?.book ? `Pick ${subject.book.fileName} again (it isn't kept in this browser)` : "No file chosen"}</span>
          {/if}
          <input type="file" accept="application/pdf" onchange={(e) => pickFile((e.currentTarget as HTMLInputElement).files?.[0] ?? null)} />
        </span>
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
      <button class="btn" type="submit" disabled={!ready || (budget ? left <= 0 || !budget.hasKey : true)}><WandSparkles size={17} aria-hidden="true" />Draft</button>
      {#if file && !(pages.trim() && section.trim()) && phase === "form"}
        <p class="muted hint">{chapter?.plan?.sections.length ? "Pick a section above to fill in the pages and the section." : "Fill in the pages and the section to draft."}</p>
      {/if}
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
  .wide {
    max-width: 52rem;
  }
  a {
    color: var(--accent);
  }
  .sections ul {
    list-style: none;
    padding: 0;
    margin: 0.5rem 0 0;
    display: grid;
    gap: 0.35rem;
  }
  .sections li {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 0.75rem;
    padding: 0.45rem 0.75rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--card);
  }
  .sections li.chosen {
    border-color: var(--accent);
    background: var(--accent-soft);
  }
  .sections .t {
    font-weight: 600;
    flex: 1 1 14rem;
  }
  .sections h2 {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 1.1rem;
    margin: 1.4rem 0 0.2rem;
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
  .picker {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.7rem;
    font-weight: 400;
  }
  .kept {
    display: flex;
    align-items: flex-start;
    gap: 0.45rem;
    font-weight: 400;
    color: var(--text-2);
  }
  .kept :global(svg) {
    flex: none;
    margin-top: 0.15rem;
    color: var(--right);
  }
  .hint {
    margin: -0.3rem 0 0;
    font-size: 0.88rem;
  }
  .picker input[type="file"] {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
  }
  .picker:focus-within .btn-secondary {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
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
