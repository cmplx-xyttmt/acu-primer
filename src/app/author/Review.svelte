<script lang="ts">
  // The whole lesson in order with every branch open: each check's options with the right
  // one marked, its explanation, each anticipated wrong answer with its misconception (and
  // where that came from), its hints and simpler question, the general fallback, and the
  // alternatives. One sign-off per lesson.
  import type { AuthorLesson, Check, AlternativeCheck, Fallback, SimpleCheck } from "../../shared/lesson.ts";
  import { authorApi, ApiError } from "../lib/api.ts";
  import { renderInline, renderReading } from "../lib/math.ts";
  import { navigate } from "../router.svelte.ts";
  import ThemeSwitch from "../player/ThemeSwitch.svelte";
  import Mark from "./Mark.svelte";

  let { lessonId, onLocked }: { lessonId: string; onLocked: () => void } = $props();

  let lesson = $state<AuthorLesson | null>(null);
  let error = $state("");
  let confirming = $state(false);
  let signing = $state(false);

  function fail(err: unknown) {
    if (err instanceof ApiError && err.status === 401) onLocked();
    else error = err instanceof Error ? err.message : "Something went wrong.";
  }

  // svelte-ignore state_referenced_locally (App.svelte re-creates Review per lesson)
  authorApi.lesson(lessonId).then((l) => (lesson = l), fail);

  async function signOff() {
    signing = true;
    try {
      lesson = await authorApi.signOff(lessonId);
      confirming = false;
    } catch (err) {
      fail(err);
    } finally {
      signing = false;
    }
  }

  function back(e: MouseEvent) {
    e.preventDefault();
    navigate("/author");
  }

  const answerText = (c: Check | AlternativeCheck | SimpleCheck) =>
    c.type === "select"
      ? (c.options.find((o) => o.id === c.answer)?.text ?? c.answer)
      : `${c.answer}${c.unit ? ` ${c.unit}` : ""} (± ${c.tolerance})`;

  // HTML: the option's text goes through renderInline so its math renders (and is escaped).
  const wrongLabel = (c: Check | AlternativeCheck, i: number) => {
    const w = c.wrongAnswers[i];
    if (c.type === "select" && "optionId" in w.match) {
      const id = w.match.optionId;
      return `Picks “${renderInline(c.options.find((o) => o.id === id)?.text ?? id)}”`;
    }
    if ("min" in w.match) return `Types between ${w.match.min} and ${w.match.max}`;
    return "";
  };

  const hasHelp = (f: Fallback) => !!(f.reExplanation || f.simplerQuestion);
</script>

{#snippet simpleCheck(c: SimpleCheck)}
  <p class="q">{@html renderInline(c.prompt)}</p>
  {#if c.type === "select"}
    <ul class="options">
      {#each c.options as o (o.id)}
        <li class:right={o.id === c.answer}>{@html renderInline(o.text)}</li>
      {/each}
    </ul>
  {:else}
    <p class="answer">Answer: <span class="num">{answerText(c)}</span></p>
  {/if}
{/snippet}

{#snippet fallback(f: Fallback)}
  {#if f.reExplanation}
    <div class="part" class:off={!f.reExplanation.enabled}>
      <span class="tag">Re-explanation{f.reExplanation.enabled ? "" : " (switched off)"}</span>
      {@html renderReading(f.reExplanation.text)}
    </div>
  {/if}
  {#if f.simplerQuestion}
    <div class="part" class:off={!f.simplerQuestion.enabled}>
      <span class="tag">Simpler question{f.simplerQuestion.enabled ? "" : " (switched off)"}</span>
      {@render simpleCheck(f.simplerQuestion.check)}
    </div>
  {/if}
{/snippet}

{#snippet fullCheck(c: Check | AlternativeCheck)}
  {@render simpleCheck(c)}
  <div class="part explain">
    <span class="tag">After a right answer</span>
    {@html renderReading(c.explanation)}
  </div>
  {#each c.wrongAnswers as w, i}
    <div class="branch">
      <p class="when">{@html wrongLabel(c, i)}</p>
      <p class="misconception">
        Misconception: {@html renderInline(w.misconception.text)}
        <span class="source" class:guess={w.misconception.source.kind === "model"}>
          {w.misconception.source.kind === "catalogue"
            ? `catalogue: ${w.misconception.source.reference}`
            : "model's guess"}
        </span>
      </p>
      {@render fallback(w.fallback)}
    </div>
  {/each}
  <div class="branch">
    <p class="when">Any other wrong answer</p>
    {#if hasHelp(c.generalFallback)}
      {@render fallback(c.generalFallback)}
    {:else}
      <p class="muted">No general fallback: the student is asked to try again.</p>
    {/if}
  </div>
{/snippet}

<div class="top">
  <a href="/author" onclick={back}>All lessons</a>
  <ThemeSwitch />
</div>

<main class="page wide">
  {#if error}<p class="error">{error}</p>{/if}
  {#if !lesson}
    {#if !error}<p class="muted">Loading…</p>{/if}
  {:else}
    {@const l = lesson.content}
    <header>
      <h1>{l.title}</h1>
      <p class="muted">{l.source.book}, {l.source.pages}</p>
      <div class="status">
        <Mark status={lesson.status} />
        {#if lesson.status === "reviewed" && lesson.signedOffAt}
          <span class="muted">Signed off {new Date(lesson.signedOffAt).toLocaleString()}</span>
        {/if}
      </div>
    </header>

    <section>
      <h2>Outcomes</h2>
      <ul>
        {#each l.outcomes as o}<li>{@html renderInline(o)}</li>{/each}
      </ul>
    </section>

    {#each l.modules as m, i (m.id)}
      <section class="module">
        <h2><span class="num">{i + 1}.</span> {m.title}</h2>
        <div class="reading">{@html renderReading(m.reading)}</div>
        {#if m.check}
          <div class="check">
            {@render fullCheck(m.check)}
            {#if m.check.alternatives.length > 0}
              <details>
                <summary>{m.check.alternatives.length} alternative check{m.check.alternatives.length > 1 ? "s" : ""} the tool proposed</summary>
                {#each m.check.alternatives as alt (alt.id)}
                  <div class="alt">{@render fullCheck(alt)}</div>
                {/each}
              </details>
            {/if}
          </div>
        {/if}
      </section>
    {/each}

    <footer>
      {#if lesson.status === "reviewed"}
        <p>This lesson is signed off. Students see it in the course.</p>
      {:else if confirming}
        <p>Sign off this lesson? Students will see it in the course.</p>
        <div class="buttons">
          <button class="btn" onclick={signOff} disabled={signing}>{signing ? "Signing off…" : "Yes, sign off"}</button>
          <button class="btn-quiet" onclick={() => (confirming = false)}>Not yet</button>
        </div>
      {:else}
        <p class="muted">Read every branch above before signing off.</p>
        <button class="btn" onclick={() => (confirming = true)}>Sign off</button>
      {/if}
    </footer>
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
  header h1 {
    margin-bottom: 0.25rem;
  }
  .status {
    display: flex;
    gap: 0.75rem;
    align-items: center;
    flex-wrap: wrap;
  }
  h2 {
    font-size: 1.05rem;
    margin: 1.75rem 0 0.5rem;
  }
  .module {
    border-top: 1px solid var(--border);
  }
  .reading :global(.display-math) {
    overflow-x: auto;
  }
  .check {
    margin-top: 0.75rem;
    padding: 0.8rem 1rem;
    background: var(--surface);
    border-radius: var(--radius);
    font-size: 0.95rem;
  }
  .q {
    font-weight: 600;
    margin: 0 0 0.4rem;
  }
  .options {
    margin: 0;
    padding-left: 1.2rem;
  }
  .options li.right {
    color: var(--right);
    font-weight: 600;
  }
  .options li.right::after {
    content: " ✓";
  }
  .answer {
    margin: 0;
    color: var(--right);
    font-weight: 600;
  }
  .branch {
    margin-top: 0.8rem;
    padding: 0.6rem 0.8rem;
    border-left: 3px solid var(--border);
    background: var(--bg);
    border-radius: var(--radius);
  }
  .when {
    margin: 0;
    font-weight: 600;
  }
  .misconception {
    margin: 0.25rem 0;
  }
  .source {
    display: inline-block;
    margin-left: 0.35rem;
    font-size: 0.8rem;
    color: var(--right);
  }
  .source.guess {
    color: var(--accent);
  }
  .part {
    margin-top: 0.5rem;
  }
  .part.off {
    opacity: 0.55;
  }
  .part :global(p) {
    margin: 0.25rem 0;
  }
  .tag {
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--text-2);
  }
  .explain {
    margin-top: 0.6rem;
  }
  details {
    margin-top: 0.8rem;
  }
  summary {
    cursor: pointer;
    color: var(--text-2);
  }
  .alt {
    margin-top: 0.6rem;
    padding-top: 0.6rem;
    border-top: 1px dashed var(--border);
  }
  footer {
    margin-top: 2rem;
    padding-top: 1rem;
    border-top: 1px solid var(--border);
  }
  .buttons {
    display: flex;
    gap: 1rem;
    align-items: center;
  }
  .error {
    color: var(--wrong);
  }
</style>
