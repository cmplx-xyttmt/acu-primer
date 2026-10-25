<script lang="ts">
  // Step-by-step review (slice 4b). The lesson is reviewed one step at a time: its outcomes,
  // then each module. The author approves a step with one tick, or pins suggestions to its
  // parts. Sign off is the last step, and it unlocks (on the server too) only when every step
  // is approved and no suggestion is open.
  // Slice 11: a module is reviewed by playing it (ReviewPlayer), inside a violet frame;
  // "Every branch" shows all its branches at once instead.
  import type { AuthorLesson, Check, AlternativeCheck, Fallback, SimpleCheck, Widget } from "../../shared/lesson.ts";
  import { OUTCOMES_STEP, canApprove, reviewState, type Suggestion } from "../../shared/review.ts";
  import { authorApi, ApiError } from "../lib/api.ts";
  import { renderInline, renderReading } from "../lib/math.ts";
  import AuthorBar from "./AuthorBar.svelte";
  import Mark from "./Mark.svelte";
  import Part from "./Part.svelte";
  import ReviewPlayer from "./ReviewPlayer.svelte";
  import { reviewPaths, untried, type PathId } from "../../shared/reviewPaths.ts";
  import Play from "@lucide/svelte/icons/play";
  import Download from "@lucide/svelte/icons/download";
  import Layers from "@lucide/svelte/icons/layers";

  let { lessonId, onLocked }: { lessonId: string; onLocked: () => void } = $props();

  let lesson = $state<AuthorLesson | null>(null);
  let error = $state("");
  let stepIndex = $state(0);
  let confirming = $state(false);
  let busy = $state(false);

  // Play or every branch, remembered on this browser.
  const VIEW_KEY = "acu:reviewView";
  let view = $state<"play" | "branches">(readView());
  function readView(): "play" | "branches" {
    try {
      return localStorage.getItem(VIEW_KEY) === "branches" ? "branches" : "play";
    } catch {
      return "play";
    }
  }
  function setView(v: "play" | "branches") {
    view = v;
    asking = false;
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {}
  }
  // The paths the author has seen while playing, per module, for this visit.
  let seenByStep = $state<Record<string, PathId[]>>({});
  const markSeen = (stepId: string) => (path: PathId) => {
    const now = seenByStep[stepId] ?? [];
    if (!now.includes(path)) seenByStep[stepId] = [...now, path];
  };
  // Approving before every path is seen asks once, with the paths still to see.
  let asking = $state(false);
  let justApproved = $state<string | null>(null);

  const rs = $derived(
    lesson ? reviewState(lesson.content, new Set(lesson.review.approvedSteps), lesson.review.suggestions) : null,
  );
  // The step list plus a last "Sign off" step.
  const onSignOffStep = $derived(!!rs && stepIndex >= rs.steps.length);
  const step = $derived(rs && !onSignOffStep ? rs.steps[stepIndex] : null);
  const mod = $derived(lesson && step && step.id !== OUTCOMES_STEP ? lesson.content.modules.find((m) => m.id === step.id) : null);
  const pathsLeft = $derived(mod?.check && step ? untried(reviewPaths(mod.check), new Set(seenByStep[step.id] ?? [])) : []);
  const pathsTotal = $derived(mod?.check ? reviewPaths(mod.check).length : 0);

  function fail(err: unknown) {
    if (err instanceof ApiError && err.status === 401) onLocked();
    else error = err instanceof Error ? err.message : "Something went wrong.";
  }

  // True when the call worked, so a caller can keep what the author typed when it didn't.
  async function run(call: () => Promise<AuthorLesson>): Promise<boolean> {
    busy = true;
    error = "";
    try {
      lesson = await call();
      return true;
    } catch (err) {
      fail(err);
      return false;
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

  // The lesson as a file, for the Download link once it's signed off (I16).
  const lessonFile = $derived(
    lesson ? `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(lesson.content, null, 2) + "\n")}` : "",
  );

  function goToStep(i: number) {
    stepIndex = i;
    reviseNote = "";
    confirming = false;
    asking = false;
    scrollTo({ top: 0 });
  }

  async function approveAndNext() {
    if (!step) return;
    const id = step.id;
    await run(() => authorApi.approve(lessonId, id));
    if (error) return;
    justApproved = id;
    goToStep(stepIndex + 1);
  }
  function tryApprove() {
    if (view === "play" && pathsLeft.length > 0 && !asking) asking = true;
    else approveAndNext();
  }

  const partSuggestions = (part: string) =>
    (lesson?.review.suggestions ?? []).filter((s: Suggestion) => s.stepId === step?.id && s.part === part);

  const suggestFor = (part: string, partLabel: string) => (text: string) =>
    run(() => authorApi.suggest(lessonId, { stepId: step!.id, part, partLabel, text }));
  const withdraw = async (id: string) => void (await run(() => authorApi.withdraw(id)));

  // Slice 6: shaping the draft. Claude applies a step's open suggestions (one paid call), or the
  // author swaps in an alternative or switches a hint on or off (no call).
  let reviseNote = $state("");
  async function applyWithClaude() {
    if (!step || !okToChange()) return;
    reviseNote = "";
    busy = true;
    error = "";
    try {
      const r = await authorApi.revise(lessonId, step.id);
      lesson = r.lesson;
      delete seenByStep[step.id]; // the module changed, so its paths need seeing again
      reviseNote = r.note;
    } catch (err) {
      fail(err);
    } finally {
      busy = false;
    }
  }
  // Changing a signed-off lesson's content hides it from students until it's signed off again
  // (saveLessonContent), so the author is asked first.
  const okToChange = () =>
    lesson?.status !== "reviewed" ||
    confirm("This lesson is live. Changing it hides it from students until you approve the step and sign off again.");
  const swapIn = async (moduleId: string, altId: string) => {
    if (okToChange() && (await run(() => authorApi.swap(lessonId, moduleId, altId)))) delete seenByStep[moduleId];
  };
  const setPart = async (moduleId: string, which: number | "general", part: "reExplanation" | "simplerQuestion", enabled: boolean) => {
    if (okToChange()) await run(() => authorApi.setPart(lessonId, moduleId, which, part, enabled));
  };
  const setExploreOn = async (moduleId: string, enabled: boolean) => {
    if (okToChange()) await run(() => authorApi.setExplore(lessonId, moduleId, enabled));
  };

  // One line on how an exploration's widget is set up, for the Every branch view.
  const widgetSummary = (w: Widget) =>
    w.kind === "formula"
      ? `Formula ${w.expression}, inputs ${w.inputs.map((i) => `${i.id} in {${i.values.join(", ")}}`).join("; ")}${w.plotOver ? `, plotted over ${w.plotOver}` : ""}`
      : w.kind === "sampling"
        ? `Sampling: p = ${w.p}, sample sizes ${w.sizes.join(", ")}, ${w.draws} samples a run`
        : w.kind === "stepper"
          ? `Stepper: ${w.frames.length} steps`
          : `Scenarios: ${w.inputs.map((i) => i.label).join(" × ")}, ${w.outcomes.length} outcomes`;


  const answerText = (c: Check | AlternativeCheck | SimpleCheck) =>
    c.type === "select"
      ? (c.options.find((o) => o.id === c.answer)?.text ?? c.answer)
      : c.type === "sort"
        ? "every item in its category"
        : `${c.answer}${c.unit ? ` ${c.unit}` : ""} (± ${c.tolerance})`;

  // Plain text, stored with a suggestion so the revision knows which branch it was about.
  const wrongLabelText = (c: Check | AlternativeCheck, i: number) => {
    const w = c.wrongAnswers[i];
    if (c.type === "select" && "optionId" in w.match) {
      const id = w.match.optionId;
      return `Wrong answer: picks "${c.options.find((o) => o.id === id)?.text ?? id}"`;
    }
    if ("min" in w.match) return `Wrong answer: types between ${w.match.min} and ${w.match.max}`;
    if (c.type === "sort" && "itemId" in w.match) {
      const m = w.match;
      return `Wrong answer: puts "${c.items.find((x) => x.id === m.itemId)?.text ?? m.itemId}" in "${c.categories.find((x) => x.id === m.categoryId)?.label ?? m.categoryId}"`;
    }
    return `Wrong answer ${i + 1}`;
  };
</script>

{#snippet simpleCheck(c: SimpleCheck | Check | AlternativeCheck)}
  <p class="q">{@html renderInline(c.prompt)}</p>
  {#if c.type === "sort"}
    <ul class="options">
      {#each c.categories as cat (cat.id)}
        <li><strong>{@html renderInline(cat.label)}</strong>: {@html c.items.filter((i) => i.category === cat.id).map((i) => renderInline(i.text)).join(", ")}</li>
      {/each}
    </ul>
  {:else if c.type === "select"}
    <ul class="options">
      {#each c.options as o (o.id)}
        <li class:right={o.id === c.answer}>{@html renderInline(o.text)}</li>
      {/each}
    </ul>
  {:else}
    <p class="answer">Answer: <span class="num">{answerText(c)}</span></p>
  {/if}
{/snippet}

{#snippet toggle(on: boolean, moduleId: string | null, which: number | "general" | null, part: "reExplanation" | "simplerQuestion")}
  {#if moduleId !== null && which !== null}
    <label class="toggle">
      <input type="checkbox" checked={on} disabled={busy} onchange={() => setPart(moduleId, which, part, !on)} />
      shown to students
    </label>
  {/if}
{/snippet}

{#snippet fallback(f: Fallback, moduleId: string | null = null, which: number | "general" | null = null)}
  {#if f.reExplanation}
    <div class="sub" class:off={!f.reExplanation.enabled}>
      <span class="tag">Re-explanation{f.reExplanation.enabled ? "" : " (switched off)"}</span>
      {@render toggle(f.reExplanation.enabled, moduleId, which, "reExplanation")}
      {@html renderReading(f.reExplanation.text)}
    </div>
  {/if}
  {#if f.simplerQuestion}
    <div class="sub" class:off={!f.simplerQuestion.enabled}>
      <span class="tag">Simpler question{f.simplerQuestion.enabled ? "" : " (switched off)"}</span>
      {@render toggle(f.simplerQuestion.enabled, moduleId, which, "simplerQuestion")}
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

<AuthorBar back={{ href: "/author", label: "Your subjects" }} />
{#if view === "play"}
  <div class="frame" aria-hidden="true"></div>
  <div class="mode-bar">
    <span class="badge badge-review">Review mode</span>
    <span class="mode-text">You're playing this lesson as a student would. Students never see this bar.</span>
  </div>
{/if}

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
      <div class="views" role="group" aria-label="How to review">
        <button class="btn-sm" class:on={view === "play"} aria-pressed={view === "play"} onclick={() => setView("play")}>
          <Play size={15} aria-hidden="true" />Play
        </button>
        <button class="btn-sm" class:on={view === "branches"} aria-pressed={view === "branches"} onclick={() => setView("branches")}>
          <Layers size={15} aria-hidden="true" />Every branch
        </button>
      </div>
    </header>

    <nav class="steps" aria-label="Review steps">
      {#each rs.steps as s, i (s.id)}
        <button
          class="step"
          class:current={i === stepIndex}
          class:approved={s.approved}
          class:flagged={s.open > 0}
          class:pop={s.id === justApproved && s.approved}
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
        {#if !(mod && view === "play")}<h2>{step.title}</h2>{/if}

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
        {:else if mod && view === "play"}
          {#key mod.id}
            <ReviewPlayer
              {setExploreOn}
              {mod}
              {busy}
              seen={seenByStep[mod.id] ?? []}
              onSeen={markSeen(mod.id)}
              {partSuggestions}
              {suggestFor}
              onWithdraw={withdraw}
              {setPart}
            />
          {/key}
        {:else if mod}
          <Part label="Reading" suggestions={partSuggestions("reading")} onSuggest={suggestFor("reading", "Reading")} onWithdraw={withdraw}>
            <div class="reading">{@html renderReading(mod.reading)}</div>
          </Part>

          {#if mod.explore}
            {@const e = mod.explore}
            <Part label="Exploration" suggestions={partSuggestions("explore")} onSuggest={suggestFor("explore", "Exploration")} onWithdraw={withdraw}>
              <div class="sub" class:off={!e.enabled}>
                <label class="toggle">
                  <input type="checkbox" checked={e.enabled} disabled={busy} onchange={() => setExploreOn(mod.id, !e.enabled)} />
                  shown to students
                </label>
                <span class="tag">Why it's here (authors only)</span>
                <p>{@html renderInline(e.why)}</p>
                <span class="tag">What the student does</span>
                {@html renderReading(e.prompt)}
                <span class="tag">Prediction</span>
                <p class="q">{@html renderInline(e.prediction.prompt)}</p>
                <ul class="options">
                  {#each e.prediction.options as o (o.id)}<li class:right={o.id === e.prediction.answer}>{@html renderInline(o.text)}</li>{/each}
                </ul>
                <span class="tag">Widget</span>
                <p class="muted">{widgetSummary(e.widget)}</p>
                <span class="tag">If the prediction didn't match: why</span>
                {@html renderReading(e.thinkAbout)}
                <span class="tag">What to notice</span>
                {@html renderReading(e.notice)}
              </div>
            </Part>
          {/if}
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
                {@render fallback(w.fallback, mod.id, i)}
              </Part>
            {/each}
            <Part
              label="Any other wrong answer"
              suggestions={partSuggestions("check.generalFallback")}
              onSuggest={suggestFor("check.generalFallback", "General fallback for unplanned answers")}
              onWithdraw={withdraw}
            >
              {@render fallback(c.generalFallback, mod.id, "general")}
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
                    <div class="alt">
                      {@render altCheck(alt)}
                      <button class="btn-quiet" disabled={busy} onclick={() => swapIn(mod.id, alt.id)}>Use this check instead</button>
                    </div>
                  {/each}
                </details>
              </Part>
            {/if}
          {:else}
            <p class="muted">This module has no check.</p>
          {/if}
        {/if}

        {#if reviseNote}<p class="ok note">{reviseNote}</p>{/if}
        <div class="decide" class:dock={view === "play"}>
          {#if view === "play" && mod?.check && !step.approved}
            <p class="dock-status muted">
              {pathsLeft.length === 0
                ? "Every path seen."
                : `${pathsTotal - pathsLeft.length} of ${pathsTotal} paths seen.`}
            </p>
          {/if}
          {#if asking && pathsLeft.length > 0}
            <p class="asking">
              You haven't tried {pathsLeft.length === 1 ? "one path" : `${pathsLeft.length} paths`} yet:
              {pathsLeft.map((p) => p.label).join("; ")}. Approve anyway?
            </p>
            <button class="btn" disabled={busy} onclick={approveAndNext}>Approve anyway</button>
            <button class="btn-quiet" onclick={() => (asking = false)}>Keep playing</button>
          {:else if step.approved}
            <p class="ok">Approved ✓</p>
            <button class="btn-quiet" disabled={busy} onclick={() => run(() => authorApi.unapprove(lessonId, step.id))}>
              Take back the approval
            </button>
          {:else if !canApprove(step.id, lesson.review.suggestions)}
            <p class="muted">
              This step has {step.open === 1 ? "an open suggestion" : `${step.open} open suggestions`}, so it can't be approved yet.
              Let Claude apply {step.open === 1 ? "it" : "them"} (one call, usually a few cents to about $0.30), or withdraw.
            </p>
            <button class="btn" disabled={busy} onclick={applyWithClaude}>{busy ? "Claude is revising…" : "Apply with Claude"}</button>
          {:else}
            <button class="btn" disabled={busy} onclick={tryApprove}>{view === "play" && mod ? "Approve module" : "Approve and go on"}</button>
          {/if}
        </div>

        <div class="moves">
          <button class="btn-quiet" disabled={stepIndex === 0} onclick={() => goToStep(stepIndex - 1)}>Previous</button>
          <button class="btn-quiet" onclick={() => goToStep(stepIndex + 1)}>
            {stepIndex + 1 >= rs.steps.length ? "To sign-off" : step.approved ? "Next" : "Next, without approving"}
          </button>
        </div>
      </section>
    {:else}
      <section class="signoff">
        <h2>Sign off</h2>
        {#if lesson.status === "reviewed"}
          <p>This lesson is signed off. Students see it in the chapter.</p>
          <p class="muted">
            <a class="btn-quiet btn-sm" href={lessonFile} download="{lesson.id}.json"><Download size={15} aria-hidden="true" />Download the lesson file</a>
            The JSON the import reads, for keeping the lesson in git or loading it on another server
            (<code>npm run export:chapter</code> writes the whole chapter folder).
          </p>
        {:else if !rs.canSignOff}
          <p>Not ready to sign off yet: {rs.blockers.join(", ")}.</p>
          {#if rs.open > 0}
            <p class="muted">
              To clear an open suggestion, open its step and press Apply with Claude, or withdraw the suggestion.
              The parts Claude changes come back here for you to approve again.
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
          <p>Every step is approved. Sign off this lesson? Students will see it in the chapter.</p>
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
  .wide {
    max-width: 52rem;
  }
  /* Review mode's frame: a violet edge round the window and a bar students never see. */
  .frame {
    position: fixed;
    inset: 0;
    border: 3px solid var(--review-edge);
    pointer-events: none;
    z-index: 30;
  }
  .mode-bar {
    position: sticky;
    top: 0;
    z-index: 20;
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 0.75rem;
    align-items: center;
    justify-content: center;
    padding: 0.45rem 16px;
    background: var(--review-bg);
    border-bottom: 1px solid var(--review-edge);
    font-size: 0.88rem;
    color: var(--review);
  }
  .views {
    display: inline-flex;
    margin-top: 0.8rem;
    padding: 3px;
    gap: 3px;
    border: 1px solid var(--border);
    border-radius: 999px;
    background: var(--surface);
  }
  .views button {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    border: none;
    border-radius: 999px;
    padding: 0.25rem 0.8rem;
    background: none;
    color: var(--text-2);
    font-weight: 600;
  }
  .views button.on {
    background: var(--card);
    color: var(--text);
    box-shadow: var(--shadow);
  }
  .dock {
    position: sticky;
    bottom: 0;
    z-index: 10;
    margin-top: 1.5rem;
    padding: 0.8rem 1rem;
    border: 1px solid var(--review-edge);
    border-radius: var(--radius);
    background: var(--card);
    box-shadow: var(--shadow-lift);
  }
  .dock-status {
    margin: 0;
    flex: 1 1 12rem;
  }
  .asking {
    margin: 0;
    flex: 1 1 100%;
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
  .wide:has(.dock) .step.current {
    box-shadow: 0 0 0 2px var(--review-edge);
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
  .note {
    margin-top: 1rem;
  }
  .toggle {
    float: right;
    font-size: 0.8rem;
    color: var(--text-2);
    display: flex;
    gap: 0.3rem;
    align-items: center;
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
