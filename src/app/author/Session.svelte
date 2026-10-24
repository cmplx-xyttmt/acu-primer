<script lang="ts">
  // The authoring session (slice 3b): pick the book PDF and a page range, and Claude drafts a
  // lesson from just those pages. For a chapter made from a book (Oct 23), its sections are
  // listed. Since Oct 24 the author ticks any number of them (or all not yet drafted) and they
  // draft one after another in this tab, each saved as soon as it's done; a failed one doesn't
  // stop the rest. The PDF stays on this laptop; only the cut pages are sent. Drafting on the
  // server, so the tab can close, is noted for later in devpost/checklist.md.
  import type { AuthorChapter, AuthorSubject } from "../../shared/lesson.ts";
  import { authorApi, streamDraft, ApiError } from "../lib/api.ts";
  import { navigate } from "../router.svelte.ts";
  import AuthorBar from "./AuthorBar.svelte";
  import FileUp from "@lucide/svelte/icons/file-up";
  import WandSparkles from "@lucide/svelte/icons/wand-sparkles";
  import BookOpen from "@lucide/svelte/icons/book-open";
  import CircleCheck from "@lucide/svelte/icons/circle-check";
  import CircleX from "@lucide/svelte/icons/circle-x";
  import CircleDashed from "@lucide/svelte/icons/circle-dashed";
  import LoaderCircle from "@lucide/svelte/icons/loader-circle";
  import ExternalLink from "@lucide/svelte/icons/external-link";
  import { keepBook, keptBook } from "../lib/bookStore.ts";
  import type { Section } from "../../shared/bookPlan.ts";

  let { chapterId, onLocked }: { chapterId: string; onLocked: () => void } = $props();

  let chapter = $state<AuthorChapter | null>(null);
  let subject = $state<AuthorSubject | null>(null);
  let budget = $state<{ spentUsd: number; budgetUsd: number; model: string; hasKey: boolean; fake?: boolean } | null>(null);
  let file = $state<File | null>(null);
  let book = $state("");
  let pages = $state(""); // typed by hand, when no section is ticked
  let section = $state("");
  let error = $state("");

  // What a draft has cost and taken so far (Oct 16 to 23: $1.08 to $1.30, 6 to 10½ minutes).
  const EACH_USD = 1.2;
  const EACH_MIN = 8;
  // Below this much left in the month, the next draft isn't started.
  const MIN_LEFT_USD = 1.5;

  // svelte-ignore state_referenced_locally (App.svelte re-creates this per chapter)
  let keptName = $state(""); // the PDF found in this browser, if any
  const loadSubjects = () =>
    authorApi.subjects().then(async (subjects) => {
      subject = subjects.find((s) => s.chapters.some((c) => c.id === chapterId)) ?? null;
      chapter = subject?.chapters.find((c) => c.id === chapterId) ?? null;
      if (subject?.book && !file) {
        book = subject.book.title;
        const kept = await keptBook(subject.id);
        if (kept) {
          file = kept;
          keptName = kept.name;
        }
      }
    }, fail);
  loadSubjects();

  function fail(err: unknown) {
    if (err instanceof ApiError && err.status === 401) return onLocked();
    error = err instanceof Error ? err.message : "Something went wrong.";
  }

  // A section was drafted already if a lesson in the chapter was drafted from its pages. The
  // title match is for older lessons; it alone missed sections Claude renamed (Oct 24).
  const bare = (s: string) => s.toLowerCase().replace(/^[\d.]+\s*/, "").replace(/[^a-z0-9]+/g, " ").trim();
  const drafted = (s: Section) =>
    !!chapter?.lessons.some((l) => l.sourcePages === `pp. ${s.pages}` || bare(l.title).includes(bare(s.title)));
  const keyOf = (s: Section) => `${s.pages} ${s.title}`;
  const sections = $derived(chapter?.plan?.sections ?? []);

  let ticked = $state<string[]>([]);
  const toggle = (s: Section) => (ticked = ticked.includes(keyOf(s)) ? ticked.filter((k) => k !== keyOf(s)) : [...ticked, keyOf(s)]);
  const notDrafted = $derived(sections.filter((s) => !drafted(s)));
  const tickAll = () => (ticked = notDrafted.map(keyOf));

  function pickFile(f: File | null) {
    file = f;
    keptName = "";
    // Keep it for next time, for a subject made from a book.
    if (f && subject?.book) keepBook(subject.id, f).then((ok) => ok && (keptName = f.name));
  }
  const loadBudget = () => authorApi.budget().then((b) => (budget = b), fail);
  loadBudget();
  const left = $derived(budget ? budget.budgetUsd - budget.spentUsd : 0);

  // What Draft will do: the ticked sections in book order, or the one typed by hand.
  const planned = $derived<{ title: string; pages: string }[]>(
    ticked.length > 0
      ? sections.filter((s) => ticked.includes(keyOf(s)))
      : pages.trim() && section.trim()
        ? [{ title: section.trim(), pages: pages.trim() }]
        : [],
  );
  const canDraft = $derived(!!file && !!book.trim() && planned.length > 0 && !!budget?.hasKey && left > 0);

  // --- The queue ------------------------------------------------------------------------
  type Item = {
    title: string;
    pages: string;
    state: "waiting" | "cutting" | "uploading" | "drafting" | "done" | "failed" | "skipped";
    chars: number;
    attempt: number;
    seconds: number;
    lessonId?: string;
    cost?: number;
    attempts?: number;
    note?: string; // why it failed or was skipped
  };
  let queue = $state<Item[]>([]);
  let phase = $state<"form" | "running" | "finished">("form");
  let stopAfterThis = $state(false);

  async function draftOne(item: Item, bytes: ArrayBuffer) {
    item.state = "cutting";
    const { cutPages } = await import("../lib/pdfPages.ts"); // only loaded here, never for students
    const cut = await cutPages(bytes, item.pages);
    item.state = "uploading";
    const { sourceId } = await authorApi.uploadSource(chapterId, book.trim(), `pp. ${item.pages}`, cut);
    item.state = "drafting";
    const started = Date.now();
    const timer = setInterval(() => (item.seconds = Math.round((Date.now() - started) / 1000)), 1000);
    try {
      await streamDraft(sourceId, item.title, (e) => {
        if ("alive" in e) {
          item.seconds = e.alive;
        } else if ("chars" in e) {
          item.chars = e.chars;
          item.attempt = e.attempt;
        } else if ("done" in e) {
          Object.assign(item, { state: "done", lessonId: e.done, cost: e.usage.costUsd, seconds: e.seconds, attempts: e.attempts });
        } else {
          Object.assign(item, { state: "failed", cost: e.usage?.costUsd, note: e.error + (e.usage ? ` (this attempt cost $${e.usage.costUsd.toFixed(2)})` : "") });
        }
      });
      if (item.state === "drafting") throw new Error("The connection closed before the draft finished.");
    } finally {
      clearInterval(timer);
    }
  }

  async function run() {
    if (!file || !canDraft) return;
    error = "";
    stopAfterThis = false;
    queue = planned.map((p) => ({ ...p, state: "waiting", chars: 0, attempt: 1, seconds: 0 }));
    phase = "running";
    const bytes = await file.arrayBuffer();
    for (const item of queue) {
      if (stopAfterThis) {
        Object.assign(item, { state: "skipped", note: "Stopped before it started." });
        continue;
      }
      await loadBudget();
      if (left < MIN_LEFT_USD) {
        Object.assign(item, { state: "skipped", note: `Less than $${MIN_LEFT_USD.toFixed(2)} left of this month's Claude budget.` });
        continue;
      }
      try {
        await draftOne(item, bytes);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return onLocked();
        Object.assign(item, { state: "failed", note: err instanceof Error ? err.message : "Something went wrong." });
      }
    }
    phase = "finished";
    ticked = [];
    pages = "";
    section = "";
    loadBudget();
    loadSubjects(); // so the sections just drafted show as Drafted
  }

  // Closing the tab loses the draft in progress; the browser asks first while the queue runs.
  $effect(() => {
    if (phase !== "running") return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    addEventListener("beforeunload", warn);
    return () => removeEventListener("beforeunload", warn);
  });

  const doneItems = $derived(queue.filter((i) => i.state === "done"));
  const spent = $derived(queue.reduce((n, i) => n + (i.cost ?? 0), 0)); // failed attempts cost too
  const minutes = (n: number) => (n < 60 ? `${n} min` : `${Math.floor(n / 60)} h ${n % 60 ? `${n % 60} min` : ""}`.trim());

  const go = (e: MouseEvent, to: string) => {
    e.preventDefault();
    navigate(to);
  };
</script>

<AuthorBar back={{ href: "/author", label: "Your subjects" }} />

<main class="page wide">
  <h1>Draft lessons</h1>
  <p class="muted">{subject?.title ? `${subject.title} · ` : ""}{chapter ? chapter.title : "…"}</p>
  {#if subject}
    <p class="muted brief-note">
      {subject.brief ? `Drafts follow the subject's learner brief: "${subject.brief.slice(0, 140)}${subject.brief.length > 140 ? "…" : ""}"` : "This subject has no learner brief yet, so drafts assume first-year university students. Add one on the author home."}
    </p>
  {/if}

  {#if budget?.fake}
    <p class="fake">
      <strong>Fake drafting is on</strong> (started with <code>npm run dev:fake</code>). Nothing goes to Claude and nothing is spent: each draft takes about
      12 seconds and saves a copy of the OSTEP 4.4 sample lesson, titled "[Fake]" and the section's name. Delete them from the author home when you're done.
    </p>
  {/if}
  {#if budget}
    <p class="budget" class:low={left < 2}>
      Claude this month: <span class="num">${budget.spentUsd.toFixed(2)}</span> of <span class="num">${budget.budgetUsd}</span> spent.
      A draft has cost $1.10 to $1.30 and taken 6 to 10 minutes ({budget.model}, high effort).
      {#if !budget.hasKey}<strong>No API key on this server, so drafting won't work.</strong>{/if}
    </p>
  {/if}

  {#if phase === "form"}
    {#if chapter?.plan}
      <section class="sections">
        <h2><BookOpen size={18} aria-hidden="true" />Sections in this chapter</h2>
        {#if sections.length === 0}
          <p class="muted">The book's contents didn't list sections for this chapter, which runs over pp. {chapter.plan.pages}. Type the pages for one lesson below.</p>
        {:else}
          <div class="pick-head">
            <p class="muted">Each section becomes one lesson. Tick the ones to draft.</p>
            <span class="pick-all">
              {#if notDrafted.length > 0}<button class="btn-secondary btn-sm" onclick={tickAll}>Tick all not yet drafted ({notDrafted.length})</button>{/if}
              {#if ticked.length > 0}<button class="btn-quiet btn-sm" onclick={() => (ticked = [])}>Clear</button>{/if}
            </span>
          </div>
          <ul>
            {#each sections as s (keyOf(s))}
              <li class:chosen={ticked.includes(keyOf(s))}>
                <label class="row-pick">
                  <input type="checkbox" checked={ticked.includes(keyOf(s))} onchange={() => toggle(s)} />
                  <span class="t">{s.title}</span>
                </label>
                <span class="muted num">pp. {s.pages}</span>
                {#if drafted(s)}<span class="badge badge-done">Drafted</span>{/if}
              </li>
            {/each}
          </ul>
        {/if}
      </section>
    {/if}

    <form
      onsubmit={(e) => {
        e.preventDefault();
        run();
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
      {#if ticked.length === 0}
        {#snippet byHand()}
          <label>
            Pages, as your PDF viewer numbers them
            <input type="text" bind:value={pages} placeholder="170-180" />
          </label>
          <label>
            Section
            <input type="text" bind:value={section} placeholder="5.1 Point estimates and sampling variability" />
          </label>
        {/snippet}
        {#if sections.length > 0}
          <details class="by-hand">
            <summary>Or type the pages for one lesson yourself</summary>
            <div class="by-hand-fields">{@render byHand()}</div>
          </details>
        {:else}
          {@render byHand()}
        {/if}
      {/if}

      {#if planned.length > 0}
        <p class="estimate">
          {planned.length === 1 ? "One lesson" : `${planned.length} lessons`}: about <span class="num">${(planned.length * EACH_USD).toFixed(2)}</span>
          and {minutes(planned.length * EACH_MIN)}{planned.length > 1 ? ", drafted one after another" : ""}. Keep this tab open until {planned.length > 1 ? "they're" : "it's"} done.
          {#if planned.length * EACH_USD > left}
            <strong>That's more than the ${left.toFixed(2)} left this month, so the last ones will be skipped.</strong>
          {/if}
        </p>
      {/if}
      <button class="btn" type="submit" disabled={!canDraft}>
        <WandSparkles size={17} aria-hidden="true" />{planned.length > 1 ? `Draft ${planned.length} lessons` : "Draft"}
      </button>
      {#if file && planned.length === 0}
        <p class="muted hint">{sections.length ? "Tick a section above, or type the pages for one lesson." : "Fill in the pages and the section to draft."}</p>
      {/if}
    </form>
    {#if error}<p class="error">{error}</p>{/if}
  {:else}
    <section class="queue">
      <h2>
        {#if phase === "running"}
          Drafting {queue.length === 1 ? "one lesson" : `${queue.length} lessons`}
        {:else}
          Drafted {doneItems.length} of {queue.length}, for about <span class="num">${spent.toFixed(2)}</span>
        {/if}
      </h2>
      {#if phase === "running"}
        <p class="muted">Keep this tab open: closing it loses the lesson being drafted. Each one is saved as soon as it's done, as "written by the model, not yet reviewed". Review opens in a new tab, so the drafting carries on here.</p>
      {:else}
        <p class="muted">Each is saved as "written by the model, not yet reviewed", and students won't see it until you sign it off.</p>
      {/if}
      <ol>
        {#each queue as item (item.pages + item.title)}
          <li class="item {item.state}">
            <span class="icon" aria-hidden="true">
              {#if item.state === "done"}<CircleCheck size={18} />
              {:else if item.state === "failed"}<CircleX size={18} />
              {:else if item.state === "waiting" || item.state === "skipped"}<CircleDashed size={18} />
              {:else}<LoaderCircle size={18} class="spin" />{/if}
            </span>
            <span class="what">
              <span class="t">{item.title} <span class="muted num">pp. {item.pages}</span></span>
              <span class="muted small">
                {#if item.state === "waiting"}Waiting
                {:else if item.state === "cutting"}Cutting the pages…
                {:else if item.state === "uploading"}Sending the pages…
                {:else if item.state === "drafting"}
                  {item.chars === 0
                    ? `Claude is thinking about the pages (${item.seconds} s)`
                    : `Writing: ${item.chars.toLocaleString()} characters, ${item.seconds} s${item.attempt > 1 ? ", second attempt after fixing problems" : ""}`}
                {:else if item.state === "done"}
                  Drafted in {Math.round((item.seconds ?? 0) / 60)} min{(item.attempts ?? 1) > 1 ? ` (${item.attempts} attempts)` : ""}, about ${(item.cost ?? 0).toFixed(2)}
                {:else}{item.note}{/if}
              </span>
            </span>
            {#if item.state === "done" && item.lessonId}
              {#if phase === "running"}
                <!-- A new tab while drafting, so this screen (and the drafts it's running) stays open. -->
                <a class="btn btn-sm" href="/author/lessons/{item.lessonId}" target="_blank" rel="noopener">Review<ExternalLink size={14} aria-hidden="true" /></a>
              {:else}
                <a class="btn btn-sm" href="/author/lessons/{item.lessonId}" onclick={(e) => go(e, `/author/lessons/${item.lessonId}`)}>Review</a>
              {/if}
            {/if}
          </li>
        {/each}
      </ol>
      {#if phase === "running" && queue.filter((i) => i.state === "waiting").length > 0}
        <button class="btn-quiet" disabled={stopAfterThis} onclick={() => (stopAfterThis = true)}>
          {stopAfterThis ? "Stopping after this one" : "Stop after this one"}
        </button>
      {/if}
      {#if phase === "finished"}
        <!-- Only when there's something left to draft: sections without a lesson (failed or
             stopped ones included), or any chapter whose pages are typed by hand. -->
        {#if notDrafted.length > 0}
          <button class="btn-secondary" onclick={() => ((phase = "form"), (queue = []), tickAll())}>
            Draft the {notDrafted.length === 1 ? "section" : `${notDrafted.length} sections`} not drafted yet
          </button>
        {:else if sections.length === 0}
          <button class="btn-secondary" onclick={() => ((phase = "form"), (queue = []))}>Draft another lesson from this chapter</button>
        {:else}
          <p class="muted">Every section in this chapter has a lesson now.</p>
        {/if}
      {/if}
    </section>
  {/if}
</main>

<style>
  .wide {
    max-width: 52rem;
  }
  a:not(.btn) {
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
  }
  .row-pick {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    flex: 1 1 14rem;
    cursor: pointer;
  }
  .row-pick input {
    width: 1.1rem;
    height: 1.1rem;
    accent-color: var(--accent);
    flex: none;
  }
  .pick-head {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem 1rem;
  }
  .pick-head p {
    margin: 0.3rem 0;
  }
  .pick-all {
    display: flex;
    gap: 0.4rem;
  }
  .by-hand summary {
    cursor: pointer;
    color: var(--accent);
    font-size: 0.92rem;
  }
  .by-hand-fields {
    display: grid;
    gap: 0.9rem;
    margin-top: 0.8rem;
  }
  .estimate {
    margin: 0;
    font-size: 0.92rem;
  }
  .queue h2 {
    font-size: 1.15rem;
    margin: 1.4rem 0 0.3rem;
  }
  .queue ol {
    list-style: none;
    padding: 0;
    margin: 0.8rem 0 1rem;
    display: grid;
    gap: 0.4rem;
  }
  .item {
    display: flex;
    align-items: center;
    gap: 0.7rem;
    padding: 0.6rem 0.8rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--card);
  }
  .item .icon {
    display: flex;
    flex: none;
    color: var(--text-3, var(--text-2));
  }
  .item.done .icon {
    color: var(--right);
  }
  .item.failed .icon {
    color: var(--wrong);
  }
  .item.cutting .icon,
  .item.uploading .icon,
  .item.drafting .icon {
    color: var(--accent);
  }
  .item.drafting {
    border-color: var(--accent);
  }
  .what {
    display: grid;
    gap: 0.1rem;
    flex: 1 1 auto;
    min-width: 0;
  }
  .small {
    font-size: 0.85rem;
  }
  .item :global(.spin) {
    animation: spin 1.2s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .item :global(.spin) {
      animation: none;
    }
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
  .fake {
    padding: 0.7rem 0.9rem;
    border: 1px dashed var(--accent);
    border-radius: var(--radius);
    background: var(--accent-soft);
    font-size: 0.92rem;
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
  .error {
    color: var(--wrong);
  }
</style>
