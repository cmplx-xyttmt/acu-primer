<script lang="ts">
  // The sampling widget: draw many random samples of size n from a population where a share p
  // says yes, and plot each sample's proportion (p̂). The last run stays in grey under the new
  // one, so changing n shows the spread change. The x axis is fixed, so runs compare fairly.
  import type { Widget } from "../../../shared/lesson.ts";
  import { renderInline } from "../../lib/math.ts";
  import Shuffle from "@lucide/svelte/icons/shuffle";

  type SamplingW = Extract<Widget, { kind: "sampling" }>;
  let { widget, active, onProgress }: { widget: SamplingW; active: boolean; onProgress: (tries: number) => void } = $props();

  // svelte-ignore state_referenced_locally (re-created per module)
  let n = $state(widget.start);
  let runs = $state<{ n: number; phats: number[] }[]>([]);
  const sizesRun = new Set<number>();

  function draw() {
    const phats = new Array<number>(widget.draws);
    for (let s = 0; s < widget.draws; s++) {
      let yes = 0;
      for (let i = 0; i < n; i++) if (Math.random() < widget.p) yes++;
      phats[s] = yes / n;
    }
    runs = [...runs.slice(-1), { n, phats }];
    sizesRun.add(n);
    // Two different sample sizes run counts as having changed something.
    onProgress(sizesRun.size >= 2 ? sizesRun.size : 0);
  }

  const BINS = 32, W = 560, H = 210, PAD = 30;
  const smallest = $derived(Math.min(...widget.sizes));
  const spread = $derived(4 * Math.sqrt((widget.p * (1 - widget.p)) / smallest));
  const lo = $derived(Math.max(0, widget.p - spread));
  const hi = $derived(Math.min(1, widget.p + spread));
  function bins(phats: number[]) {
    const c = new Array(BINS).fill(0);
    for (const x of phats) {
      const b = Math.floor(((x - lo) / (hi - lo)) * BINS);
      if (b >= 0 && b < BINS) c[b]++;
    }
    return c;
  }
  const counts = $derived(runs.map((r) => bins(r.phats)));
  // Each run is scaled to its own tallest bar, so the shapes compare (a wide run spreads its
  // samples over more bars, and would look flat next to a narrow one).
  const tops = $derived(counts.map((c) => Math.max(1, ...c)));
  const bw = (W - 2 * PAD) / BINS;
  const sd = (xs: number[]) => {
    const m = xs.reduce((a, b) => a + b, 0) / xs.length;
    return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
  };
  const sx = (x: number) => PAD + ((x - lo) / (hi - lo)) * (W - 2 * PAD);
  const last = $derived(runs.at(-1));
  const before = $derived(runs.length > 1 ? runs[0] : null);
</script>

<div class="sampling" class:inactive={!active}>
  <div class="controls">
    <span class="label">{@html renderInline("Sample size $n$")}</span>
    <div class="values" role="radiogroup" aria-label="Sample size">
      {#each widget.sizes as s}
        <button class="value num" class:on={n === s} role="radio" aria-checked={n === s} disabled={!active} onclick={() => (n = s)}>{s}</button>
      {/each}
    </div>
    <button class="btn btn-sm" disabled={!active} onclick={draw}><Shuffle size={15} aria-hidden="true" />Draw {widget.draws.toLocaleString()} samples</button>
  </div>

  <svg viewBox="0 0 {W} {H}" role="img" aria-label="Histogram of sample proportions">
    {#if counts.length > 1}
      {#each counts[0] as c, b}
        <rect class="old" x={PAD + b * bw + 1} width={bw - 2} y={H - PAD - (c / tops[0]) * (H - 2 * PAD)} height={(c / tops[0]) * (H - 2 * PAD)} />
      {/each}
    {/if}
    {#if counts.length > 0}
      {#each counts.at(-1)! as c, b}
        <rect class="new" x={PAD + b * bw + 1} width={bw - 2} y={H - PAD - (c / tops.at(-1)!) * (H - 2 * PAD)} height={(c / tops.at(-1)!) * (H - 2 * PAD)} />
      {/each}
    {/if}
    <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} class="axis" />
    <line x1={sx(widget.p)} y1={PAD - 6} x2={sx(widget.p)} y2={H - PAD} class="p" />
    <text x={sx(widget.p)} y={PAD - 10} class="tick">p = {widget.p}</text>
    {#each [lo, (lo + widget.p) / 2, widget.p, (widget.p + hi) / 2, hi] as t}
      <text x={sx(t)} y={H - PAD + 16} class="tick">{t.toFixed(2)}</text>
    {/each}
    {#if counts.length === 0}
      <text x={W / 2} y={H / 2} class="empty">Pick a sample size and draw.</text>
    {/if}
  </svg>

  {#if last}
    {@const sorted = [...last.phats].sort((a, b) => a - b)}
    <p class="stats num">
      <span class="swatch new"></span>{@html renderInline(`$n = ${last.n}$: the middle 95% of $\\hat p$ runs from ${sorted[Math.floor(sorted.length * 0.025)].toFixed(3)} to ${sorted[Math.floor(sorted.length * 0.975)].toFixed(3)}; spread (SD) ${sd(last.phats).toFixed(3)}`)}
    </p>
    {#if before}
      <p class="stats num muted"><span class="swatch old"></span>{@html renderInline(`$n = ${before.n}$ (the run before): spread (SD) ${sd(before.phats).toFixed(3)}`)}</p>
    {/if}
  {/if}
</div>

<style>
  .sampling {
    display: grid;
    gap: 0.8rem;
  }
  .inactive {
    opacity: 0.55;
  }
  .controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.6rem;
  }
  .label {
    font-size: 0.88rem;
    font-weight: 600;
    color: var(--text-2);
  }
  .values {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }
  .value {
    min-width: 3rem;
    padding: 0.35rem 0.7rem;
    border: 2px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--card);
    color: var(--text);
    box-shadow: 0 2px 0 var(--border);
  }
  .value.on {
    border-color: var(--accent);
    background: var(--accent-soft);
    font-weight: 700;
  }
  svg {
    width: 100%;
    height: auto;
  }
  rect.new {
    fill: var(--accent);
    opacity: 0.85;
  }
  rect.old {
    fill: var(--text-2);
    opacity: 0.3;
  }
  .axis {
    stroke: var(--border-strong);
    stroke-width: 1.5;
  }
  .p {
    stroke: var(--fallback-edge);
    stroke-width: 2;
    stroke-dasharray: 4 4;
  }
  .tick {
    font-size: 12px;
    fill: var(--text-2);
    text-anchor: middle;
  }
  .empty {
    font-size: 15px;
    fill: var(--text-2);
    text-anchor: middle;
  }
  .stats {
    margin: 0;
    font-size: 0.9rem;
    display: flex;
    align-items: center;
    gap: 0.45rem;
    flex-wrap: wrap;
  }
  .swatch {
    width: 0.8rem;
    height: 0.8rem;
    border-radius: 3px;
    display: inline-block;
  }
  .swatch.new {
    background: var(--accent);
  }
  .swatch.old {
    background: var(--text-2);
    opacity: 0.4;
  }
</style>
