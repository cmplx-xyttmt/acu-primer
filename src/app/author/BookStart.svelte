<script lang="ts">
  // Start from a book (Oct 23): pick a PDF and the app makes a subject with a chapter for each
  // of the book's chapters, and each chapter's sections as lessons to draft. The plan comes
  // from the PDF's bookmarks (free, instant). When they don't list sections, Claude reads the
  // contents pages instead (a few cents). Nothing is drafted here: each section is drafted
  // with one click later, because a draft costs about $1.30. The PDF stays in this browser.
  import { BRIEF_PRESETS } from "../../shared/briefPresets.ts";
  import { pageOffset, planFromContents, planFromOutline, sectionsOverview, type Contents, type OutlineItem, type PlannedChapter } from "../../shared/bookPlan.ts";
  import { authorApi, ApiError } from "../lib/api.ts";
  import { keepBook } from "../lib/bookStore.ts";
  import { navigate } from "../router.svelte.ts";
  import AuthorBar from "./AuthorBar.svelte";
  import FileUp from "@lucide/svelte/icons/file-up";
  import BookOpen from "@lucide/svelte/icons/book-open";
  import WandSparkles from "@lucide/svelte/icons/wand-sparkles";

  let { onLocked }: { onLocked: () => void } = $props();

  let file = $state<File | null>(null);
  let phase = $state<"pick" | "reading" | "plan" | "creating">("pick");
  let error = $state("");
  let pageCount = $state(0);
  let outline = $state<OutlineItem[]>([]);
  let chapters = $state<(PlannedChapter & { on: boolean })[]>([]);
  let title = $state("");
  let overview = $state("");
  let preset = $state("");
  let brief = $state("");

  // Reading the contents pages with Claude, when the bookmarks don't list sections.
  let contentsPages = $state("");
  let readingContents = $state(false);
  let contents = $state<Contents | null>(null);
  let contentsCost = $state<number | null>(null);
  let pdfPageOfPrinted = $state(""); // asked when the page gap can't be worked out

  const withSections = $derived(chapters.filter((c) => c.on && c.sections.length > 0).length);
  const picked = $derived(chapters.filter((c) => c.on));
  const firstPrinted = $derived(contents?.chapters.find((c) => c.printedPage !== null)?.printedPage ?? null);

  function fail(err: unknown) {
    if (err instanceof ApiError && err.status === 401) return onLocked();
    error = err instanceof Error ? err.message : "Something went wrong.";
  }

  const fromFileName = (name: string) => name.replace(/\.pdf$/i, "").replace(/[_]+/g, " ").trim();

  async function choose(f: File | null) {
    if (!f) return;
    file = f;
    error = "";
    phase = "reading";
    try {
      const { readBook } = await import("../lib/pdfOutline.ts"); // pdf-lib, only on the author side
      const book = await readBook(await f.arrayBuffer());
      pageCount = book.pageCount;
      outline = book.outline;
      title = book.title && book.title.length > 3 ? book.title : fromFileName(f.name);
      setPlan(planFromOutline(book.outline, book.pageCount));
      // Guess the contents pages from a "Contents" bookmark, for the Claude fallback.
      const toc = chapters.find((c) => /contents/i.test(c.title));
      contentsPages = toc ? toc.pages : "";
      phase = "plan";
    } catch (err) {
      phase = "pick";
      fail(err instanceof Error ? new Error(`Couldn't read that PDF: ${err.message}`) : err);
    }
  }

  function setPlan(plan: PlannedChapter[]) {
    chapters = plan.map((c) => ({ ...c, on: c.likelyChapter }));
  }

  async function readContentsPages() {
    if (!file || !contentsPages.trim()) return;
    readingContents = true;
    error = "";
    try {
      const { cutPages } = await import("../lib/pdfPages.ts");
      const cut = await cutPages(await file.arrayBuffer(), contentsPages);
      const r = await authorApi.readContents(cut);
      contents = r.contents;
      contentsCost = r.usage.costUsd;
      applyContents();
    } catch (err) {
      fail(err);
    } finally {
      readingContents = false;
    }
  }

  function applyContents() {
    if (!contents) return;
    let gap = pageOffset(contents, outline);
    if (gap === null && firstPrinted !== null && Number(pdfPageOfPrinted) > 0) gap = Number(pdfPageOfPrinted) - firstPrinted;
    if (gap !== null) setPlan(planFromContents(contents, gap, pageCount));
  }
  const needsGap = $derived(!!contents && pageOffset(contents, outline) === null);

  async function create() {
    if (!file || picked.length === 0 || !title.trim()) return;
    phase = "creating";
    error = "";
    try {
      const subject = await authorApi.createBook({
        subject: { title: title.trim(), overview: overview.trim(), brief: brief.trim() },
        book: { title: title.trim(), fileName: file.name.slice(0, 300), size: file.size, pageCount },
        chapters: picked.map((c) => ({ title: c.title, overview: sectionsOverview(c.sections), plan: { pages: c.pages, sections: c.sections } })),
      });
      await keepBook(subject.id, file);
      navigate("/author");
    } catch (err) {
      phase = "plan";
      fail(err);
    }
  }
</script>

<AuthorBar back={{ href: "/author", label: "Your subjects" }} />

<main class="page wide">
  <h1>Start from a book</h1>
  <p class="muted">
    Pick a book's PDF. Its chapters become chapters here, and each chapter's sections become lessons you can draft one at a
    time. Nothing is drafted yet, and the PDF stays on this laptop.
  </p>

  {#if phase === "pick" || phase === "reading"}
    <label class="picker">
      <span class="btn"><FileUp size={17} aria-hidden="true" />Choose a book (PDF)</span>
      <span class="muted">{phase === "reading" ? "Reading its bookmarks…" : "No file chosen"}</span>
      <input type="file" accept="application/pdf" disabled={phase === "reading"} onchange={(e) => choose((e.currentTarget as HTMLInputElement).files?.[0] ?? null)} />
    </label>
  {:else}
    <p class="file"><BookOpen size={16} aria-hidden="true" />{file?.name} · {pageCount} pages</p>

    <label class="field">
      Subject title, as students should see it
      <input type="text" bind:value={title} />
    </label>

    <section class="plan">
      <h2>Chapters</h2>
      {#if chapters.length === 0}
        <p class="note">This PDF has no bookmarks, so its chapters can't be read from it directly.</p>
      {:else}
        <p class="muted">
          From the PDF's {contents ? "contents pages" : "bookmarks"}: {chapters.length} entries, {withSections} with sections. Untick
          anything that isn't a chapter (front and back matter start unticked).
        </p>
      {/if}

      {#if chapters.length > 0}
        <ul class="chapters">
          {#each chapters as c, i (i)}
            <li class:off={!c.on}>
              <label class="row">
                <input type="checkbox" bind:checked={c.on} />
                <span class="t">{c.title}</span>
                <span class="muted num">pp. {c.pages}</span>
              </label>
              {#if c.sections.length > 0}
                <details>
                  <summary>{c.sections.length} section{c.sections.length === 1 ? "" : "s"}, each a lesson to draft</summary>
                  <ul class="sections">
                    {#each c.sections as s}<li>{s.title} <span class="muted num">pp. {s.pages}</span></li>{/each}
                  </ul>
                </details>
              {:else}
                <span class="muted small">No sections listed: drafting picks pages by hand.</span>
              {/if}
            </li>
          {/each}
        </ul>
      {/if}

      {#if withSections === 0 || contents}
        <div class="contents card">
          {#if !contents}
            <p>
              <strong>Find the sections from the contents pages.</strong> The bookmarks don't list sections{chapters.length === 0 ? " (there are none)" : ""}. Claude can read the book's
              contents pages and list every chapter and section, for a few cents.
            </p>
          {:else}
            <p>
              Read from the contents pages: {contents.chapters.length} chapters{contentsCost !== null ? `, for $${contentsCost.toFixed(3)}` : ""}.
            </p>
          {/if}
          {#if !contents}
            <label class="field">
              Contents pages, as your PDF viewer numbers them
              <input type="text" bind:value={contentsPages} placeholder="3-6" />
            </label>
            <button class="btn-secondary" disabled={readingContents || !contentsPages.trim()} onclick={readContentsPages}>
              <WandSparkles size={16} aria-hidden="true" />{readingContents ? "Claude is reading the contents…" : "Read the contents pages"}
            </button>
          {:else if needsGap}
            <p>
              The page numbers printed in a book often differ from the PDF's own. The contents say the first chapter starts on page
              {firstPrinted}: which page is that in your PDF viewer?
            </p>
            <label class="field">
              PDF page of printed page {firstPrinted}
              <input type="text" inputmode="numeric" bind:value={pdfPageOfPrinted} />
            </label>
            <button class="btn-secondary" disabled={!(Number(pdfPageOfPrinted) > 0)} onclick={applyContents}>Use these page numbers</button>
          {/if}
        </div>
      {/if}
    </section>

    <section>
      <h2>For students</h2>
      <label class="field">
        Overview (optional): a sentence or two students see on the subject page
        <textarea rows="2" bind:value={overview}></textarea>
      </label>
      <p class="label">Who's learning (optional, every draft follows it)</p>
      <div class="presets">
        {#each BRIEF_PRESETS as p (p.id)}
          <button type="button" class="preset" class:on={preset === p.id} onclick={() => ((preset = p.id), (brief = p.brief))}>{p.label}</button>
        {/each}
      </div>
      {#if preset}<textarea rows="3" bind:value={brief}></textarea>{/if}
    </section>

    <div class="go">
      <button class="btn" disabled={phase === "creating" || picked.length === 0 || !title.trim()} onclick={create}>
        {phase === "creating" ? "Creating…" : `Create the subject and ${picked.length} chapter${picked.length === 1 ? "" : "s"}`}
      </button>
      <button class="btn-quiet" onclick={() => ((phase = "pick"), (file = null), (chapters = []), (contents = null))}>Choose another PDF</button>
    </div>
  {/if}

  {#if error}<p class="error">{error}</p>{/if}
</main>

<style>
  .wide {
    max-width: 52rem;
  }
  .picker {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.8rem;
    margin-top: 1.5rem;
  }
  .picker input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
  }
  .file {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-weight: 600;
    margin-top: 1.25rem;
  }
  .field {
    display: grid;
    gap: 0.35rem;
    font-weight: 600;
    font-size: 0.92rem;
    margin: 0.9rem 0;
  }
  h2 {
    font-size: 1.1rem;
    margin: 1.6rem 0 0.4rem;
  }
  .chapters {
    list-style: none;
    padding: 0;
    margin: 0.75rem 0;
    display: grid;
    gap: 0.4rem;
  }
  .chapters > li {
    padding: 0.55rem 0.8rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--card);
  }
  .chapters > li.off {
    opacity: 0.55;
  }
  .row {
    display: flex;
    align-items: baseline;
    gap: 0.6rem;
    flex-wrap: wrap;
  }
  .row .t {
    font-weight: 600;
    flex: 1 1 12rem;
  }
  details {
    margin: 0.3rem 0 0 1.8rem;
    font-size: 0.9rem;
  }
  summary {
    cursor: pointer;
    color: var(--text-2);
  }
  .sections {
    margin: 0.4rem 0 0;
    padding-left: 1.1rem;
  }
  .small {
    display: block;
    margin-left: 1.8rem;
    font-size: 0.85rem;
  }
  .note {
    font-weight: 600;
  }
  .contents {
    padding: 0.9rem 1rem;
    margin-top: 0.75rem;
  }
  .contents p {
    margin: 0 0 0.6rem;
  }
  .presets {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-bottom: 0.6rem;
  }
  .preset {
    padding: 0.3rem 0.7rem;
    border: 1px solid var(--border);
    border-radius: 999px;
    background: var(--card);
    color: var(--text);
    font-size: 0.88rem;
  }
  .preset.on {
    border-color: var(--accent);
    background: var(--accent-soft);
  }
  textarea {
    width: 100%;
    font: inherit;
  }
  .go {
    display: flex;
    flex-wrap: wrap;
    gap: 0.8rem;
    align-items: center;
    margin-top: 1.6rem;
  }
  .error {
    color: var(--wrong);
  }
</style>
