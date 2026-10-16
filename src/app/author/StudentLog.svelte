<script lang="ts">
  // One student's path through the course, in the order it happened on their device: modules
  // entered, each answer (right or wrong, which misconception), the hints shown, the material
  // suggestion, skips, and the time since the previous step.
  import { authorApi, ApiError, type LoggedEvent } from "../lib/api.ts";
  import { renderInline } from "../lib/math.ts";
  import { navigate } from "../router.svelte.ts";
  import ThemeSwitch from "../player/ThemeSwitch.svelte";

  let { courseId, name, device, onLocked }: { courseId: string; name: string; device: string; onLocked: () => void } =
    $props();

  let events = $state<LoggedEvent[] | null>(null);
  let error = $state("");

  // svelte-ignore state_referenced_locally (App.svelte re-creates this per student)
  authorApi.studentLog(courseId, name, device).then(
    (e) => (events = e),
    (err) => (err instanceof ApiError && err.status === 401 ? onLocked() : (error = err.message)),
  );

  const go = (e: MouseEvent, to: string) => {
    e.preventDefault();
    navigate(to);
  };

  function gap(prev: LoggedEvent | undefined, e: LoggedEvent): string {
    if (!prev) return "";
    const s = Math.round((Date.parse(e.clientTime) - Date.parse(prev.clientTime)) / 1000);
    if (s < 1) return "+0s";
    if (s < 60) return `+${s}s`;
    if (s < 3600) return `+${Math.floor(s / 60)}m ${s % 60}s`;
    return `+${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  }

  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const level = (p: Record<string, unknown>) =>
    p.level === "retry" ? " (second try)" : p.level === "simpler" ? " (simpler question)" : "";
</script>

<div class="top">
  <a href="/author/courses/{courseId}/students" onclick={(e) => go(e, `/author/courses/${courseId}/students`)}>All students</a>
  <ThemeSwitch />
</div>
<main class="page wide">
  <h1>{name}</h1>
  <p class="muted">Device <span class="num">{device.slice(0, 8)}</span>. Times are from the student's device.</p>
  {#if error}<p class="error">{error}</p>{/if}
  {#if !events}
    {#if !error}<p class="muted">Loading…</p>{/if}
  {:else if events.length === 0}
    <p>Nothing recorded for this student yet.</p>
  {:else}
    <ol class="log">
      {#each events as e, i (e.id)}
        {@const p = e.payload}
        <li class={e.type.replace(".", "-")} class:wrong={e.type === "check.answered" && p.result !== "right"}>
          <span class="time num">{i === 0 ? new Date(e.clientTime).toLocaleString() : gap(events[i - 1], e)}</span>
          <span class="what">
            {#if e.type === "lesson.started"}
              <strong>Started</strong> {str(p.title)}
            {:else if e.type === "module.entered"}
              Module {Number(p.index) + 1}: {str(p.moduleTitle)}
            {:else if e.type === "check.answered"}
              Answered{level(p)} “{@html renderInline(str(p.answerText))}”:
              {#if p.result === "right"}<span class="ok">right</span>
              {:else if p.result === "known-wrong"}<span class="bad">wrong</span>, misconception: {@html renderInline(str(p.misconception))}
              {:else}<span class="bad">wrong</span>, not an anticipated answer{/if}
            {:else if e.type === "fallback.shown"}
              Shown {Array.isArray(p.parts) ? p.parts.map((x) => (x === "reExplanation" ? "a re-explanation" : "a simpler question")).join(" and ") : "a hint"}
              {p.reason === "unplanned" ? "(general fallback)" : ""}
            {:else if e.type === "material.suggested"}
              <span class="bad">Told to go back through the material</span>
            {:else if e.type === "module.skipped"}
              <span class="bad">Skipped</span> module {Number(p.index) + 1}: {str(p.moduleTitle)}
            {:else if e.type === "lesson.completed"}
              <strong class="ok">Completed</strong> {str(p.title)}
            {:else}
              {e.type}
            {/if}
          </span>
        </li>
      {/each}
    </ol>
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
  .log {
    list-style: none;
    padding: 0;
    margin: 1rem 0;
    font-size: 0.95rem;
  }
  .log li {
    display: grid;
    grid-template-columns: 7.5rem minmax(0, 1fr);
    gap: 0.75rem;
    padding: 0.4rem 0;
    border-bottom: 1px solid var(--border);
  }
  .log li.module-entered {
    color: var(--text-2);
  }
  .log li.lesson-started {
    margin-top: 0.75rem;
  }
  .log li.wrong {
    background: var(--wrong-bg);
  }
  .time {
    color: var(--text-2);
    font-size: 0.85rem;
  }
  .ok {
    color: var(--right);
    font-weight: 600;
  }
  .bad {
    color: var(--wrong);
    font-weight: 600;
  }
  .error {
    color: var(--wrong);
  }
  @media (max-width: 560px) {
    .log li {
      grid-template-columns: 1fr;
      gap: 0.1rem;
    }
  }
</style>
