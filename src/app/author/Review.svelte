<script lang="ts">
  // Step-by-step review (slice 4b). The lesson is reviewed one step at a time: its outcomes,
  // then each module with every branch open. The author approves a step with one tick, or
  // pins suggestions to its parts. Sign off is the last step, and it unlocks (on the server
  // too) only when every step is approved and no suggestion is open.
  import type { AuthorLesson, Check, AlternativeCheck, Fallback, SimpleCheck } from "../../shared/lesson.ts";
  import { OUTCOMES_STEP, canApprove, reviewState, type Suggestion } from "../../shared/review.ts";
  import { authorApi, ApiError } from "../lib/api.ts";
  import { renderInline, renderReading } from "../lib/math.ts";
  import { navigate } from "../router.svelte.ts";
  import ThemeSwitch from "../player/ThemeSwitch.svelte";
  import Mark from "./Mark.svelte";
  import Part from "./Part.svelte";

  let { lessonId, onLocked }: { lessonId: string; onLocked: () => void } = $props();

  let lesson = $state<AuthorLesson | null>(null);
  let error = $state("");
  let stepIndex = $state(0);
  let confirming = $state(false);
  let busy = $state(false);

  const rs = $derived(
    lesson ? reviewState(lesson.content, new Set(lesson.review.approvedSteps), lesson.review.suggestions) : null,
  );
  // The step list plus a last "Sign off" step.
  const onSignOffStep = $derived(!!rs && stepIndex >= rs.steps.length);
  const step = $derived(rs && !onSignOffStep ? rs.steps[stepIndex] : null);
  const mod = $derived(lesson && step && step.id !== OUTCOMES_STEP ? lesson.content.modules.find((m) => m.id === step.id) : null);

  function fail(err: unknown) {
    if (err instanceof ApiError && err.status === 401) onLocked();
    else error = err instanceof Error ? err.message : "Something went wrong.";
  }

  async function run(call: () => Promise<AuthorLesson>) {
    busy = true;
    error = "";
    try {
      lesson = await call();
    } catch (err) {
      fail(err);
    } finally {
      busy = false;
    }
  }

  // svelte-ignore state_referenced_locally (App.svelte re-creates Review per lesson)
  authorApi.lesson(lessonId).then((l) => {
    lesson = l;
    // Start at the first step that still needs a look.
    const s = reviewState(l.content, new Set(l.review.approvedSteps), l.review.suggestions);
    const first = s.steps.findIndex((x) => !x.approved || x.open > 0);
    stepIndex = first >= 0 ? first : s.steps.length;
  }, fail);

  function goToStep(i: number) {
    stepIndex = i;
    confirming = false;
    scrollTo({ top: 0 });
  }

  async function approveAndNext() {
    if (!step) return;
    await run(() => authorApi.approve(lessonId, step.id));
    if (!error) goToStep(stepIndex + 1);
  }

  const partSuggestions = (part: string) =>
    (lesson?.review.suggestions ?? []).filter((s: Suggestion) => s.stepId === step?.id && s.part === part);

  const suggestFor = (part: string, partLabel: string) => (text: string) =>
    run(() => authorApi.suggest(lessonId, { stepId: step!.id, part, partLabel, text }));
  const withdraw = (id: string) => run(() => authorApi.withdraw(id));

  function back(e: MouseEvent) {
    e.preventDefault();
    navigate("/author");
  }

  const answerText = (c: Check | AlternativeCheck | SimpleCheck) =>
    c.type === "select"
      ? (c.options.find((o) => o.id === c.answer)?.text ?? c.answer)
      : `${c.answer}${c.unit ? ` ${c.unit}` : ""} (± ${c.tolerance})`;

  // Plain text, stored with a suggestion so the revision knows which branch it was about.
  const wrongLabelText = (c: Check | AlternativeCheck, i: number) => {
    const w = c.wrongAnswers[i];
    if (c.type === "select" && "optionId" in w.match) {
      const id = w.match.optionId;
      return `Wrong answer: picks "${c.options.find((o) => o.id === id)?.text ?? id}"`;
    }
    if ("min" in w.match) return `Wrong answer: types between ${w.match.min} and ${w.match.max}`;
    return `Wrong answer ${i + 1}`;
  };
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
    <div class="sub" class:off={!f.reExplanation.enabled}>
      <span class="tag">Re-explanation{f.reExplanation.enabled ? "" : " (switched off)"}</span>
      {@html renderReading(f.reExplanation.text)}
    </div>
  {/if}
  {#if f.simplerQuestion}
    <div class="sub" class:off={!f.simplerQuestion.enabled}>
      <span class="tag">Simpler question{f.simplerQuestion.enabled ? "" : " (switched off)"}</span>
      {@render simpleCheck(f.simplerQuestion.check)}
    </div>
  {/if}
  {#if !f.reExplanation && !f.simplerQuestion}
    <p class="muted">No help here: the student is asked to try again.</p>
  {/if}
{/snippet}

{#snippet altCheck(c: AlternativeCheck)}
  {@render simpleCheck(c)}
  <div class="sub"><span class="tag">After a right answer</span>{@html renderReading(c.explanation)}</div>
  {#each c.wrongAnswers as w, i}
    <div class="sub">
      <span class="tag">{wrongLabelText(c, i)}: {w.misconception.source.kind === "catalogue" ? "catalogue" : "model's guess"}</span>
      {@render fallback(w.fallback)}
    </div>
  {/each}
{/snippet}

<div class="top">
  <a href="/author" onclick={back}>All lessons</a>
  <ThemeSwitch />
</div>

<main class="page wide">
  {#if !lesson || !rs}
    {#if error}<p class="error">{error}</p>{:else}<p class="muted">Loading…</p>{/if}
  {:else}
    <header>
      <h1>{lesson.content.title}</h1>
      <div class="status">
        <Mark status={lesson.status} />
        <span class="muted num">
          {rs.approved} of {rs.total} steps approved{rs.open > 0 ? ` · ${rs.open} open suggestion${rs.open === 1 ? "" : "s"}` : ""}
        </span>
      </div>
      <div class="bar"><span style="width: {(100 * rs.approved) / rs.total}%"></span></div>
    </header>

    <nav class="steps" aria-label="Review steps">
      {#each rs.steps as s, i (s.id)}
        <button
          class="step"
          class:current={i === stepIndex}
          class:approved={s.approved}
          class:flagged={s.open > 0}
          title={s.title}
          onclick={() => goToStep(i)}
        >
          {s.id === OUTCOMES_STEP ? "Outcomes" : i}{s.approved ? " ✓" : ""}{s.open > 0 ? " •" : ""}
        </button>
      {/each}
      <button class="step" class:current={onSignOffStep} onclick={() => goToStep(rs.steps.length)}>Sign off</button>
    </nav>

    {#if error}<p class="error">{error}</p>{/if}

    {#if step}
      <section>
        <h2>{step.title}</h2>

        {#if step.id === OUTCOMES_STEP}
          <Part
            label="Outcomes"
            suggestions={partSuggestions("outcomes")}
            onSuggest={suggestFor("outcomes", "Outcomes")}
            onWithdraw={withdraw}
          >
            <ul>
              {#each lesson.content.outcomes as o}<li>{@html renderInline(o)}</li>{/each}
            </ul>
          </Part>
        {:else if mod}
          <Part label="Reading" suggestions={partSuggestions("reading")} onSuggest={suggestFor("reading", "Reading")} onWithdraw={withdraw}>
            <div class="reading">{@html renderReading(mod.reading)}</div>
          </Part>

          {#if mod.check}
            {@const c = mod.check}
            <Part label="Check" suggestions={partSuggestions("check")} onSuggest={suggestFor("check", "Check")} onWithdraw={withdraw}>
              {@render simpleCheck(c)}
            </Part>
            <Part
              label="After a right answer"
              suggestions={partSuggestions("check.explanation")}
              onSuggest={suggestFor("check.explanation", "Explanation after a right answer")}
              onWithdraw={withdraw}
            >
              {@html renderReading(c.explanation)}
            </Part>
            {#each c.wrongAnswers as w, i}
              <Part
                label={`Wrong answer ${i + 1}`}
                suggestions={partSuggestions(`check.wrongAnswers.${i}`)}
                onSuggest={suggestFor(`check.wrongAnswers.${i}`, wrongLabelText(c, i))}
                onWithdraw={withdraw}
              >
                <p class="when">{wrongLabelText(c, i).replace("Wrong answer: ", "Student ")}</p>
                <p class="misconception">
                  Misconception: {@html renderInline(w.misconception.text)}
                  <span class="source" class:guess={w.misconception.source.kind === "model"}>
                    {w.misconception.source.kind === "catalogue" ? `catalogue: ${w.misconception.source.reference}` : "model's guess"}
                  </span>
                </p>
                {@render fallback(w.fallback)}
              </Part>
            {/each}
            <Part
              label="Any other wrong answer"
              suggestions={partSuggestions("check.generalFallback")}
              onSuggest={suggestFor("check.generalFallback", "General fallback for unplanned answers")}
              onWithdraw={withdraw}
            >
              {@render fallback(c.generalFallback)}
            </Part>
            {#if c.alternatives.length > 0}
              <Part
                label={`${c.alternatives.length} alternative check${c.alternatives.length > 1 ? "s" : ""}`}
                suggestions={partSuggestions("check.alternatives")}
                onSuggest={suggestFor("check.alternatives", "Alternative checks")}
                onWithdraw={withdraw}
              >
                <details>
                  <summary>Show the checks the tool proposed instead</summary>
                  {#each c.alternatives as alt (alt.id)}
                    <div class="alt">{@render altCheck(alt)}</div>
                  {/each}
                </details>
              </Part>
            {/if}
          {:else}
            <p class="muted">This module has no check.</p>
          {/if}
        {/if}

        <div class="decide">
          {#if step.approved}
            <p class="ok">Approved ✓</p>
            <button class="btn-quiet" disabled={busy} onclick={() => run(() => authorApi.unapprove(lessonId, step.id))}>
              Take back the approval
            </button>
          {:else if !canApprove(step.id, lesson.review.suggestions)}
            <p class="muted">
              This step has an open suggestion, so it can't be approved yet. A revision will resolve it, or you can
              withdraw it.
            </p>
          {:else}
            <button class="btn" disabled={busy} onclick={approveAndNext}>Approve and go on</button>
          {/if}
        </div>

        <div class="moves">
          <button class="btn-quiet" disabled={stepIndex === 0} onclick={() => goToStep(stepIndex - 1)}>Previous</button>
          <button class="btn-quiet" onclick={() => goToStep(stepIndex + 1)}>
            {stepIndex + 1 >= rs.steps.length ? "To sign-off" : "Next, without approving"}
          </button>
        </div>
      </section>
    {:else}
      <section class="signoff">
        <h2>Sign off</h2>
        {#if lesson.status === "reviewed"}
          <p>This lesson is signed off. Students see it in the course.</p>
        {:else if !rs.canSignOff}
          <p>Not ready to sign off yet: {rs.blockers.join(", ")}.</p>
          {#if rs.open > 0}
            <p class="muted">
              Open suggestions get applied by a revision: run <code>/revise-lesson</code> in Claude Code in the acu-primer
              folder. The parts it changes come back here for you to approve again.
            </p>
          {/if}
          <ul class="todo">
            {#each rs.steps as s, i (s.id)}
              {#if !s.approved || s.open > 0}
                <li><button class="btn-quiet" onclick={() => goToStep(i)}>{s.title}</button>{s.open > 0 ? " (open suggestion)" : ""}</li>
              {/if}
            {/each}
          </ul>
        {:else if confirming}
          <p>Every step is approved. Sign off this lesson? Students will see it in the course.</p>
          <div class="buttons">
            <button class="btn" disabled={busy} onclick={() => run(() => authorApi.signOff(lessonId)).then(() => (confirming = false))}>
              {busy ? "Signing off…" : "Yes, sign off"}
            </button>
            <button class="btn-quiet" onclick={() => (confirming = false)}>Not yet</button>
          </div>
        {:else}
          <p>Every step is approved and no suggestions are open.</p>
          <button class="btn" onclick={() => (confirming = true)}>Sign off</button>
        {/if}
      </section>
    {/if}
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
    margin-bottom: 0.35rem;
  }
  .status {
    display: flex;
    gap: 0.75rem;
    align-items: center;
    flex-wrap: wrap;
    font-size: 0.92rem;
  }
  .bar {
    height: 4px;
    margin-top: 0.6rem;
    border-radius: 2px;
    background: var(--border);
    overflow: hidden;
  }
  .bar span {
    display: block;
    height: 100%;
    background: var(--right);
  }
  .steps {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    margin: 1rem 0 0.5rem;
  }
  .step {
    font-size: 0.85rem;
    padding: 0.2rem 0.6rem;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: none;
    color: var(--text-2);
  }
  .step.approved {
    color: var(--right);
    border-color: var(--right);
  }
  .step.flagged {
    color: var(--accent);
    border-color: var(--accent);
  }
  .step.current {
    background: var(--surface);
    color: var(--text);
    font-weight: 600;
  }
  h2 {
    font-size: 1.15rem;
    margin: 1.25rem 0 0.25rem;
  }
  .reading :global(.display-math) {
    overflow-x: auto;
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
  .sub {
    margin-top: 0.5rem;
  }
  .sub.off {
    opacity: 0.55;
  }
  .sub :global(p) {
    margin: 0.25rem 0;
  }
  .tag {
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--text-2);
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
  .decide {
    margin-top: 1.5rem;
    padding-top: 1rem;
    border-top: 1px solid var(--border);
    display: flex;
    gap: 1rem;
    align-items: center;
    flex-wrap: wrap;
  }
  .ok {
    color: var(--right);
    font-weight: 600;
    margin: 0;
  }
  .moves {
    display: flex;
    justify-content: space-between;
    margin-top: 1rem;
  }
  .signoff .todo {
    padding-left: 1.2rem;
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
