<script lang="ts">
  // Review by playing (slice 11): one module plays as the student sees it, with the same check
  // and hint components. A coach line says what to try next, and a checklist ticks each path a
  // student can take (the right answer, each anticipated wrong answer, any other answer). What
  // only the author sees (the misconception, the "shown to students" switches) sits in a violet
  // "Author's view" box. Suggestions pin to a part from the button in its margin.
  import { fade } from "svelte/transition";
  import type { Fallback as FallbackParts, Module } from "../../shared/lesson.ts";
  import type { Suggestion } from "../../shared/review.ts";
  import { grade, type Answer, type Grade } from "../../shared/grading.ts";
  import { afterMainAnswer, type FallbackStep } from "../../shared/flow.ts";
  import { coachStep, pathOf, reviewPaths, type PathId } from "../../shared/reviewPaths.ts";
  import { renderInline, renderReading } from "../lib/math.ts";
  import Select from "../player/checks/Select.svelte";
  import NumberInput from "../player/checks/NumberInput.svelte";
  import Sort from "../player/checks/Sort.svelte";
  import ExploreView from "../player/explore/ExploreView.svelte";
  import Fallback from "../player/Fallback.svelte";
  import Part from "./Part.svelte";
  import CircleCheck from "@lucide/svelte/icons/circle-check";
  import CircleDashed from "@lucide/svelte/icons/circle-dashed";
  import RotateCcw from "@lucide/svelte/icons/rotate-ccw";

  let {
    mod,
    seen,
    busy,
    onSeen,
    partSuggestions,
    suggestFor,
    onWithdraw,
    setPart,
    setExploreOn,
  }: {
    mod: Module;
    seen: PathId[];
    busy: boolean;
    onSeen: (path: PathId) => void;
    partSuggestions: (part: string) => Suggestion[];
    suggestFor: (part: string, partLabel: string) => (text: string) => Promise<void>;
    onWithdraw: (id: string) => Promise<void>;
    setPart: (moduleId: string, which: number | "general", part: "reExplanation" | "simplerQuestion", enabled: boolean) => void;
    setExploreOn: (moduleId: string, enabled: boolean) => void;
  } = $props();
  // The exploration plays first, as for students; "Play it again" starts it over.
  let exploreRun = $state(0);

  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const check = $derived(mod.check);
  const paths = $derived(check ? reviewPaths(check) : []);
  const seenSet = $derived(new Set(seen));
  const coach = $derived(coachStep(paths, seenSet));

  // The last answer on this visit: which path it took, and the hint it brought up.
  let attempt = $state(0);
  let result = $state<{ path: PathId; fallback: FallbackStep | null; picked: boolean } | null>(null);
  let simpler = $state<"none" | "right" | "wrong">("none");

  function show(g: Grade, picked: boolean) {
    if (!check) return;
    const step = afterMainAnswer(check, g, "main");
    result = { path: pathOf(g), fallback: step.kind === "fallback" ? step : null, picked };
    simpler = "none";
    onSeen(result.path);
  }
  const answer = (a: Answer) => check && show(grade(check, a), true);
  // A select check may have no option left that nobody planned for, so the general hint is
  // shown on request.
  const showOther = () => show({ kind: "unplanned" }, false);
  function answerSimpler(a: Answer) {
    const q = result?.fallback?.simplerQuestion;
    if (q) simpler = grade(q, a).kind === "right" ? "right" : "wrong";
  }
  function again() {
    result = null;
    simpler = "none";
    attempt += 1;
  }

  const mark = $derived(!result || !result.picked ? null : result.path === "right" ? "right" : "wrong");
  // The wrong answer this hint belongs to, if any. A wrong answer with both its parts switched
  // off gets the general hint instead; the author's box says so.
  const wrongIndex = $derived(result?.path.startsWith("wrong.") ? Number(result.path.slice(6)) : null);
  const usesGeneral = $derived(result?.fallback?.reason === "unplanned");
  const partId = $derived(usesGeneral || wrongIndex === null ? "check.generalFallback" : `check.wrongAnswers.${wrongIndex}`);
  const partLabel = $derived(
    usesGeneral || wrongIndex === null ? "General fallback for unplanned answers" : `Wrong answer: ${paths[wrongIndex + 1]?.label ?? ""}`,
  );
</script>

{#snippet switches(f: FallbackParts, which: number | "general")}
  {#if f.reExplanation}
    <label class="switch">
      <input type="checkbox" checked={f.reExplanation.enabled} disabled={busy} onchange={() => setPart(mod.id, which, "reExplanation", !f.reExplanation!.enabled)} />
      Re-explanation shown to students
    </label>
  {/if}
  {#if f.simplerQuestion}
    <label class="switch">
      <input type="checkbox" checked={f.simplerQuestion.enabled} disabled={busy} onchange={() => setPart(mod.id, which, "simplerQuestion", !f.simplerQuestion!.enabled)} />
      Simpler question shown to students
    </label>
  {/if}
{/snippet}

<div class="play" class:has-check={!!check}>
  <div class="col">
    <h2>{mod.title}</h2>
    <Part margin label="Reading" suggestions={partSuggestions("reading")} onSuggest={suggestFor("reading", "Reading")} {onWithdraw}>
      <div class="reading">{@html renderReading(mod.reading)}</div>
    </Part>

    {#if mod.explore}
      {@const e = mod.explore}
      <div class="author-view">
        <span class="badge badge-review">Author's view</span>
        <p><strong>Why it's here:</strong> {@html renderInline(e.why)}</p>
        <label class="switch">
          <input type="checkbox" checked={e.enabled} disabled={busy} onchange={() => setExploreOn(mod.id, !e.enabled)} />
          Exploration shown to students
        </label>
        <p class="muted">Try it twice: once predicting right, once predicting wrong, to see the explanation a wrong prediction gets.</p>
      </div>
      <Part margin label="Exploration" suggestions={partSuggestions("explore")} onSuggest={suggestFor("explore", "Exploration")} {onWithdraw}>
        {#key exploreRun}
          <ExploreView explore={e} onDone={() => {}} />
        {/key}
      </Part>
      <button class="btn-quiet btn-sm again" onclick={() => (exploreRun += 1)}><RotateCcw size={15} aria-hidden="true" />Play the exploration again</button>
    {/if}

    {#if check}
      {#key `${coach.kind}-${seen.length}`}
        <p class="coach" in:fade={{ duration: reduceMotion ? 0 : 220 }}>
          {#if coach.kind === "right"}
            Answer as a student would. Start with the right answer to see the explanation students get.
          {:else if coach.kind === "wrong"}
            {check.type === "select"
              ? "Now pick a wrong answer from the list to see its hint."
              : check.type === "sort"
                ? "Now sort with one of the mistakes in the list (put that item in the wrong category) to see its hint."
                : "Now type a wrong answer from the list to see its hint."}
            {coach.left === 1 ? "One more to go." : `${coach.left} more to go.`}
          {:else if coach.kind === "other"}
            Last one: an answer nobody planned for.
            <button class="btn-sm btn-secondary" onclick={showOther}>Show what that student gets</button>
          {:else}
            That's every path. Approve the module, or suggest a change from the margin.
          {/if}
        </p>
      {/key}

      <section class="check">
        <Part margin label="Check" suggestions={partSuggestions("check")} onSuggest={suggestFor("check", "Check")} {onWithdraw}>
          {#key attempt}
            {#if check.type === "select"}
              <Select {check} locked={!!result} shown={false} {mark} onAnswer={answer} />
            {:else if check.type === "sort"}
              <Sort {check} locked={!!result} shown={false} {mark} onAnswer={answer} />
            {:else}
              <NumberInput {check} locked={!!result} shown={false} {mark} onAnswer={answer} />
            {/if}
          {/key}
        </Part>

        {#if result?.path === "right"}
          <Part
            margin
            label="After a right answer"
            suggestions={partSuggestions("check.explanation")}
            onSuggest={suggestFor("check.explanation", "Explanation after a right answer")}
            {onWithdraw}
          >
            <p class="feedback right"><span class="pop"><CircleCheck size={22} aria-hidden="true" /></span>Right.</p>
            <div class="explanation">{@html renderReading(check.explanation)}</div>
          </Part>
        {:else if result}
          {#if !result.picked}<p class="muted unplanned">A student gives an answer nobody planned for:</p>{/if}
          <div class="author-view">
            <span class="badge badge-review">Author's view</span>
            {#if wrongIndex !== null}
              {@const w = check.wrongAnswers[wrongIndex]}
              <p>
                Misconception: {@html renderInline(w.misconception.text)}
                <span class="source">{w.misconception.source.kind === "catalogue" ? `catalogue: ${w.misconception.source.reference}` : "the model's guess"}</span>
              </p>
              {#if usesGeneral}<p class="muted">Both parts of this hint are switched off, so the student gets the general hint below.</p>{/if}
              {@render switches(w.fallback, wrongIndex)}
            {:else}
              <p>The general hint, for any answer the author didn't anticipate.</p>
              {@render switches(check.generalFallback, "general")}
            {/if}
          </div>
          {#key `${partId}-${attempt}`}
            <Part margin label={partLabel} suggestions={partSuggestions(partId)} onSuggest={suggestFor(partId, partLabel)} {onWithdraw}>
              {#if result.fallback}
                <Fallback step={result.fallback} collapsed={false} onSimplerAnswer={answerSimpler} onRetry={again} />
              {/if}
            </Part>
          {/key}
          {#if simpler === "right"}
            <p class="next right">Right. The student would now try the original question again.</p>
          {:else if simpler === "wrong"}
            <p class="next">Not right. The student would be told to go back through the material, then try again or skip for now.</p>
          {/if}
        {/if}

        {#if result}
          <button class="btn-quiet btn-sm again" onclick={again}><RotateCcw size={15} aria-hidden="true" />Answer again</button>
        {/if}
        {#if check.alternatives.length > 0}
          <p class="muted alts">
            This check has {check.alternatives.length === 1 ? "an alternative" : `${check.alternatives.length} alternatives`}.
            Switch to Every branch to see {check.alternatives.length === 1 ? "it" : "them"} or swap one in.
          </p>
        {/if}
      </section>
    {:else}
      <p class="coach">This module has no question. Read it, then approve it or suggest a change from the margin.</p>
    {/if}
  </div>

  {#if check}
    <aside class="paths" aria-label="Paths a student can take">
      <p class="label">Paths seen <span class="num">{paths.filter((p) => seenSet.has(p.id)).length} / {paths.length}</span></p>
      <div class="meter"><span style="width: {(100 * paths.filter((p) => seenSet.has(p.id)).length) / paths.length}%"></span></div>
      <ul>
        {#each paths as p (p.id)}
          <li class:seen={seenSet.has(p.id)}>
            {#if seenSet.has(p.id)}
              <span class="tick pop"><CircleCheck size={17} aria-hidden="true" /></span>
            {:else}
              <span class="tick"><CircleDashed size={17} aria-hidden="true" /></span>
            {/if}
            <span>
              {@html renderInline(p.label)}
              {#if p.id === "other" && !seenSet.has(p.id) && coach.kind !== "other"}
                <button class="link" onclick={showOther}>show it</button>
              {/if}
            </span>
          </li>
        {/each}
      </ul>
    </aside>
  {/if}
</div>

<style>
  .play {
    display: grid;
    gap: 1.5rem;
    grid-template-columns: minmax(0, 1fr);
  }
  @media (min-width: 820px) {
    .play.has-check {
      grid-template-columns: minmax(0, 1fr) 14rem;
    }
    .paths {
      position: sticky;
      top: 4.5rem;
      align-self: start;
      order: 2;
    }
  }
  /* On a phone the checklist comes first, above the reading, as a short list. */
  @media (max-width: 819px) {
    .paths {
      order: -1;
    }
  }
  h2 {
    margin: 0.75rem 0 0.5rem;
  }
  .reading :global(.display-math) {
    overflow-x: auto;
  }
  .coach {
    margin: 1.5rem 0 0.5rem;
    padding: 0.7rem 0.9rem;
    border: 2px dashed var(--review-edge);
    border-radius: var(--radius);
    background: var(--review-bg);
    color: var(--text);
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 0.75rem;
    align-items: center;
  }
  .check {
    margin-top: 0.5rem;
  }
  .feedback {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    font-weight: 700;
    margin: 1rem 0 0;
  }
  .feedback .pop {
    display: inline-flex;
  }
  .right {
    color: var(--right);
  }
  .explanation :global(p) {
    margin: 0.35rem 0 0;
  }
  .unplanned {
    margin: 1rem 0 0;
  }
  .author-view {
    margin: 1rem 2.4rem 0 0;
    padding: 0.7rem 0.9rem;
    border: 1px dashed var(--review-edge);
    border-radius: var(--radius);
    font-size: 0.92rem;
    display: grid;
    gap: 0.4rem;
  }
  .author-view .badge {
    justify-self: start;
  }
  .author-view p {
    margin: 0;
  }
  .source {
    margin-left: 0.35rem;
    font-size: 0.8rem;
    color: var(--review);
  }
  .switch {
    display: flex;
    gap: 0.4rem;
    align-items: center;
    color: var(--text-2);
    font-size: 0.88rem;
  }
  .next {
    margin: 0.75rem 0 0;
    font-weight: 600;
  }
  .again {
    margin-top: 1rem;
  }
  .alts {
    margin: 1rem 0 0;
    font-size: 0.9rem;
  }
  .paths {
    padding: 0.8rem 0.9rem;
    border: 1px solid var(--review-edge);
    border-radius: var(--radius);
    background: var(--card);
    font-size: 0.9rem;
  }
  .paths .label {
    display: flex;
    justify-content: space-between;
    margin: 0;
  }
  .meter {
    height: 5px;
    margin: 0.5rem 0 0.6rem;
    border-radius: 999px;
    background: var(--surface);
    overflow: hidden;
  }
  .meter span {
    display: block;
    height: 100%;
    background: var(--review-edge);
    transition: width var(--move, 200ms) ease-out;
  }
  .paths ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.45rem;
  }
  .paths li {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 0.45rem;
    align-items: start;
    color: var(--text-2);
    overflow-wrap: anywhere;
  }
  .paths li.seen {
    color: var(--text);
  }
  .tick {
    display: inline-flex;
    margin-top: 0.1rem;
    color: var(--text-2);
  }
  .seen .tick {
    color: var(--right);
  }
  .link {
    padding: 0;
    border: none;
    background: none;
    color: var(--review);
    text-decoration: underline;
    font-size: inherit;
    cursor: pointer;
  }
</style>
