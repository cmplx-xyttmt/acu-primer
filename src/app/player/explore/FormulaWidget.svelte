<script lang="ts">
  // The formula widget: each input is a row of values to tap; the result shows as a number and,
  // if the lesson asks, as a line over one input's values with the current setting marked. The
  // formula goes through src/shared/formula.ts, never through JavaScript.
  import type { Widget } from "../../../shared/lesson.ts";
  import { evaluate, parseFormula } from "../../../shared/formula.ts";
  import { renderInline } from "../../lib/math.ts";

  type FormulaW = Extract<Widget, { kind: "formula" }>;
  let { widget, active, onProgress }: { widget: FormulaW; active: boolean; onProgress: (tries: number) => void } = $props();

  // svelte-ignore state_referenced_locally (re-created per module)
  let vars = $state<Record<string, number>>(Object.fromEntries(widget.inputs.map((i) => [i.id, i.start])));
  const tree = $derived(parseFormula(widget.expression, widget.inputs.map((i) => i.id)));
  const result = $derived(evaluate(tree, vars));
  let tried = new Set<string>();

  function pick(id: string, v: number) {
    vars[id] = v;
    tried.add(JSON.stringify(vars));
    // The start setting doesn't count as a change.
    const changed = widget.inputs.some((i) => vars[i.id] !== i.start) || tried.size > 1;
    onProgress(changed ? tried.size : 0);
  }

  const fmt = (x: number) => (Number.isFinite(x) ? x.toFixed(widget.result.decimals) : "–");

  // The plot: the result across plotOver's values, with the others held where they are.
  // The input's values are spaced evenly (they're choices, often 25, 100, 400, 1600, which
  // would crowd together on a linear axis).
  const W = 520, H = 210, PAD = 34, LEFT = 64;
  const plot = $derived.by(() => {
    if (!widget.plotOver) return null;
    const input = widget.inputs.find((i) => i.id === widget.plotOver)!;
    const xs = [...input.values].sort((a, b) => a - b);
    const pts = xs.map((x) => ({ x, y: evaluate(tree, { ...vars, [input.id]: x }) }));
    const ys = pts.map((p) => p.y).filter(Number.isFinite);
    const y0 = Math.min(0, ...ys), y1 = Math.max(...ys) || 1;
    const sx = (x: number) => LEFT + (xs.indexOf(x) / Math.max(1, xs.length - 1)) * (W - LEFT - PAD);
    const sy = (y: number) => H - PAD - ((y - y0) / (y1 - y0 || 1)) * (H - 2 * PAD);
    return { input, pts: pts.map((p) => ({ ...p, sx: sx(p.x), sy: sy(p.y) })), y0, y1, sy };
  });
</script>

<div class="formula" class:inactive={!active}>
  {#each widget.inputs as input (input.id)}
    <div class="input">
      <span class="label">{@html renderInline(input.label)}</span>
      <div class="values" role="radiogroup" aria-label={input.label}>
        {#each input.values as v}
          <button class="value num" class:on={vars[input.id] === v} role="radio" aria-checked={vars[input.id] === v} disabled={!active} onclick={() => pick(input.id, v)}>{v}</button>
        {/each}
      </div>
    </div>
  {/each}

  <div class="result">
    <span class="label">{@html renderInline(widget.result.label)}</span>
    <strong class="num big">{fmt(result)}{widget.result.unit ? ` ${widget.result.unit}` : ""}</strong>
  </div>

  {#if plot}
    <svg viewBox="0 0 {W} {H}" role="img" aria-label="{widget.result.label} for each {plot.input.label}">
      <line x1={LEFT - 10} y1={H - PAD} x2={W - PAD + 10} y2={H - PAD} class="axis" />
      <line x1={LEFT - 10} y1={PAD - 10} x2={LEFT - 10} y2={H - PAD} class="axis" />
      <polyline points={plot.pts.filter((p) => Number.isFinite(p.y)).map((p) => `${p.sx},${p.sy}`).join(" ")} class="line" />
      {#each plot.pts as p}
        <circle cx={p.sx} cy={p.sy} r={p.x === vars[plot.input.id] ? 7 : 3.5} class:here={p.x === vars[plot.input.id]} />
        <text x={p.sx} y={H - PAD + 16} class="tick">{p.x}</text>
      {/each}
      <text x={LEFT - 16} y={plot.sy(plot.y1) + 4} class="tick end">{fmt(plot.y1)}</text>
      <text x={LEFT - 16} y={plot.sy(plot.y0) + 4} class="tick end">{fmt(plot.y0)}</text>
      <text x={W / 2} y={H - 2} class="axis-label" text-anchor="middle">{plot.input.label.replace(/\$/g, "")}</text>
    </svg>
  {/if}
</div>

<style>
  .formula {
    display: grid;
    gap: 0.9rem;
  }
  .inactive {
    opacity: 0.55;
  }
  .input {
    display: grid;
    gap: 0.35rem;
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
  .result {
    display: flex;
    align-items: baseline;
    gap: 0.75rem;
    flex-wrap: wrap;
  }
  .big {
    font-size: 1.6rem;
    color: var(--accent);
  }
  svg {
    width: 100%;
    max-width: 34rem;
    height: auto;
  }
  .axis {
    stroke: var(--border-strong);
    stroke-width: 1.5;
  }
  .line {
    fill: none;
    stroke: var(--accent);
    stroke-width: 2.5;
  }
  circle {
    fill: var(--card);
    stroke: var(--accent);
    stroke-width: 2;
  }
  circle.here {
    fill: var(--accent);
  }
  .tick,
  .axis-label {
    font-size: 12px;
    fill: var(--text-2);
  }
  .tick {
    text-anchor: middle;
  }
  .tick.end {
    text-anchor: end;
  }
</style>
