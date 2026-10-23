# Explorations: prior art and a first parts library

Research for the `explore` module (Oct 23, 2026). The decision going in: option C. We hand-build small parts, the model composes them in JSON inside the lesson, and nothing the model writes is run as code. This page looks at how other projects did it, how well models write this kind of JSON, and what to build first.

## What other projects did

Almost every declarative system I looked at has a way out to code. That was the most useful finding, because it's the thing we have to leave out.

**Idyll** (MIT, [idyll-lang.org](https://idyll-lang.org/docs/components)) is the closest match to option C. An article declares variables, and components read and write them. Its built-in set is small: inputs (Range, Select, Radio, Boolean, Button, Text Input, Action), outputs (Chart, Table, Display, Equation, SVG), layout (Scroller, Stepper, Aside) and logic (Conditional, Loop, Switch). The catch is `[derived]` variables and backtick props, which are JavaScript expressions that Idyll evaluates. Anything interesting in an Idyll article ends up in one of those or in a custom React component. The repo hasn't had a commit since Feb 2023.

**Bret Victor's Tangle** ([worrydream.com/Tangle](http://worrydream.com/Tangle/), MIT in the source header) marks numbers in prose as draggable (`data-var`, `data-min`, `data-max`, `data-step`), and a JavaScript `update` function recomputes the others. The component set is tiny: an adjustable number, a toggle, a formatted output. The model is always hand-written code.

**Nicky Case's explorables** ([ncase.me](https://ncase.me), most repos CC0, for example [ncase/trust](https://github.com/ncase/trust)) are hand-built per topic. Nothing is composed. What they show is pacing: one control, one surprising result, then words. "The Evolution of Trust" makes you play a round before it shows a single number.

**Seeing Theory** (Brown, Apache-2.0, [github.com/seeingtheory/seeing-theory](https://github.com/seeingtheory/seeing-theory)) is hand-written D3 per chapter. Its CLT and sampling pages use the parts we need: a distribution picker, a sample-size slider, a "draw" button and a histogram that fills in. It doesn't ask for a prediction.

**PhET** (sims [CC-BY 4.0](https://phet.colorado.edu/en/licensing), sim code mostly GPL-3.0, the Scenery library MIT) builds each simulation by hand on shared libraries. Teachers configure through query parameters, not composition. Their design guidance on "implicit scaffolding" (few controls, sensible defaults) fits a phone screen.

**Mathigon** (now part of Amplify; [mathigon/textbooks](https://github.com/mathigon/textbooks) has no license file, so treat the content as all rights reserved) writes course text in Markdown with custom elements (`x-slider`, `x-geopad`, `x-coordinate-system`, `x-var`) and wires them with a TypeScript file per section. So again, the wiring is code.

**Distill** (template Apache-2.0, articles CC-BY) has no shared component library. Each figure is bespoke. It's the bar for quality, not a pattern to copy.

**Brilliant** doesn't publish its problem types. The one public source is the [Diagrammar talk at Strange Loop 2022](https://thestrangeloop.com/2022/diagrammar-simply-make-interactive-diagrams.html). Their authors write parametric diagrams in an Elm-based tool. Authors at Brilliant write code, but in a small language made for it.

**VisuAlgo** ([visualgo.net](https://visualgo.net)) steps through algorithms on an array or graph, with a "quiz" mode that asks what the next state will be. The source is not open (free for non-commercial use, code on request). The pattern is what's worth copying: the student types an input array, then steps forward and back, and the pseudocode line lights up.

**The OSTEP homework simulators** ([ostep-homework](https://github.com/remzi-arpacidusseau/ostep-homework), no license file, so read them and don't copy the code) are the clearest template for the OS lessons. They're deterministic, small, and already built around "predict, then run with `-c` to check".

- `process-run.py` takes a process list (`-l 5:100,4:0`, meaning 5 instructions at 100% CPU, then 4 instructions at 0% CPU, so all I/O), an I/O length (`-L`), a switch rule (`SWITCH_ON_IO` or `SWITCH_ON_END`) and an I/O-done rule (`IO_RUN_LATER` or `IO_RUN_IMMEDIATE`). The output is a table with one row per tick, one column per process (`RUN:cpu`, `RUN:io`, `READY`, `BLOCKED`, `DONE`), and columns for CPU busy and I/O busy. `-p` prints utilisation stats.
- `scheduler.py` takes a policy (FIFO, SJF, RR), job lengths (`-l 5,10,15`) and a quantum (`-q`). It prints the run trace and, per job, response, turnaround and wait times with their averages.

The process-run table is our OSTEP output part, more or less exactly.

**Vega-Lite** (BSD-3, [vega.github.io](https://vega.github.io/vega-lite/)) is the best-known JSON grammar a model could write. It has a cost for us. Measured on bundlephobia today, `vega` is 182 KB gzipped and `vega-lite` another 90 KB. By default Vega compiles its expression strings with the `Function` constructor. You can avoid that with [vega-interpreter](https://www.npmjs.com/package/vega-interpreter), which is about 10% slower. Vega-Lite is for charts of data. It has no idea of a simulation step or a process state, so we'd still need our own model layer underneath.

**Observable Plot** (ISC, [observablehq.com/plot](https://observablehq.com/plot/)) is 130 KB gzipped. Its options are JavaScript objects with functions in places, so a model can't target it as plain JSON without a translation layer.

So the plan of hand-drawn SVG in Svelte looks right to me. A histogram, a step timeline, an array of bars and a table are each maybe 50 to 150 lines of Svelte, and they cost almost nothing next to 270 KB of Vega for a PWA that has to load on a phone with a weak connection.

## How well do models write declarative specs?

Briefly, they're good at the syntax and less reliable on meaning. What I found:

- [Visualization Generation with LLMs: An Evaluation (arXiv 2401.11255)](https://arxiv.org/abs/2401.11255) ran GPT-3.5 on nvBench to Vega-Lite. Few-shot prompts beat zero-shot. Failures were misread data fields and grammar errors in the spec.
- [Evaluating LLMs for Visualization Generation and Understanding (arXiv 2507.22890)](https://arxiv.org/abs/2507.22890) found GPT-4o gave usable Vega-Lite for about 70% of 24 charts. Some charts looked right but had wrong labels.
- [IterGen (arXiv 2410.07295)](https://arxiv.org/abs/2410.07295) gets better results by checking field names and allowed values while generating and backing up on a violation.
- [Do LLMs understand data visualization rules? (arXiv 2602.20137)](https://arxiv.org/abs/2602.20137) found frontier models follow an output format reliably but miss subtle rules.

These are mostly older models on a big grammar, so I'd treat the numbers as a floor. Two failure modes carry over, though. A spec can be valid and still wrong ("looks right, wrong label"). And field references drift. For us that suggests three things. Keep the schema small, with enums wherever a value comes from a fixed set. Validate references (an output's `of` has to name something the simulation produces) in Zod with a `superRefine`, not only types. And let the player compute every right answer, so the model never does the arithmetic. The reviewer playing the module is the check on "valid but wrong", which is already how lessons are reviewed.

## Recommendation: parts and widgets

One idea makes this work without code. A **simulation** is a hand-written pure function from parameters to a result (a dataset or a trace of steps). **Inputs** set parameters by name. **Outputs** draw named fields of the result. The model picks a simulation, fills in its parameters, and lists inputs and outputs that refer to them. Nothing is evaluated, and there's no wiring beyond names.

The subject knowledge lives in the simulations, and those are hand-written per subject. I don't see a way around that, and I don't think we should try. A "generic computation" part would turn into a programming language.

### Parts

**Inputs.** The student changes something. This is Naps's "changing" level.

- `choice`: pick one of a few values (n = 10, 50, 100, 400; or `on_io` / `on_end`). Fields: `id`, `label`, `options`, `start`. Better on a phone than a slider, and every value the student can reach is one the reviewer can try.
- `slider`: fields `id`, `label`, `min`, `max`, `step`, `start`. For later, when a continuous value matters.
- `list`: edit a short list of numbers or tokens (job lengths, an input array). Fields: `id`, `label`, `start`, `maxItems`, `itemMin`, `itemMax`. Later.

**Actions.**

- `run`: compute the whole result and show it. Optionally `repeat` adds another batch to the same chart, so "draw 1,000 more" works.
- `step`: forward one step, back one step, reset. For trace simulations only. Stepping back matters. VisuAlgo and process-run both let you look at a tick again.

**Outputs.**

- `histogram`: fields `of`, `bins` (`min`, `max`, `width`), `keepPrevious` (draw the last run in grey so the change in spread is visible), `markers` (vertical lines at named values, like the true p).
- `stat`: one number from the result, with a label and decimals (SD of p̂, average turnaround, CPU busy %).
- `timeline`: rows are processes or jobs, columns are ticks, each cell a state with a fixed colour and a text label so it works without colour. With `step`, columns appear one at a time. This one part covers process-run, the scheduler, and later user mode against kernel mode for limited direct execution.
- `array`: a row of boxes or bars with highlighted indices and a pointer label (i, j, pivot). For CLRS.
- `table`: rows of a trace (tick, PID, event). Fine as the fallback for anything.

**Simulations** (hand-written, pure, seeded where random):

- `sample_proportion`: `p`, `n`, `samples`, `seed`. Returns `phat[]`, `mean`, `sd`, `theorySd` (√(p(1−p)/n)).
- `sample_mean`: a named population from a fixed list (`uniform`, `right_skewed`, `bimodal`), `n`, `samples`, `seed`. Later, for the CLT.
- `process_run`: explicit instruction lists per process (`["cpu","cpu","io","cpu"]`), `ioLength`, `switch`, `ioDone`. Returns ticks of states, `totalTicks`, `cpuBusyPct`, `doneAt` per process. No randomness, which makes predictions gradable to the tick.
- `schedule`: `policy` (fifo, sjf, rr), `jobs` (lengths, arrival 0 at first), `quantum`. Returns the run trace and per-job response, turnaround and wait, with averages.
- `array_trace`: `algorithm` from a fixed list (`insertion_sort`, `partition`, `binary_search`), `array`, `target` where needed. Returns a list of states (array, highlights, pointers, line of pseudocode) and counts (comparisons, swaps).

**The prediction.** This is one part every exploration has, and the widget stays locked until it's answered.

- `choice` prediction: "When n goes from 25 to 400, the spread of p̂ will…" with options. Graded: the lesson names the right option, and wrong options can carry a misconception, as checks do today.
- `number` prediction: "At what tick does process B finish?" Graded against a value the player computes from the simulation (`answer: { fromSim: "doneAt.B" }`) with a tolerance. The model never supplies the number.
- For random simulations, grade against the theory field (`theorySd`), not against what one run showed. Show both after. Otherwise an unlucky run marks a right prediction wrong.

After the prediction, the module asks for at least one change (`requireChange: ["n"]`), then shows a short **reconcile** text: the explanation plus "you predicted X, the run showed Y". I'd leave the reconcile ungraded for now. A free-text "explain" needs a model or a self-score, and that's later.

**Events** for the author's log: `predicted` (value, right or not), `changed` (input, from, to), `ran`, `stepped` (direction, step number), `reset`, `finished`. These map onto the content-graph examples ("re-rolled 5 times", "never changed n").

### Widgets

A widget is a preset composition: one simulation, its usual inputs and outputs, so the model fills in a handful of parameters instead of the whole layout. I'd have the drafting prompt use widgets by default and save raw parts for when Isaac asks. It's a smaller schema, and the findings above say smaller schemas fail less.

1. **Sampling distribution** (`sample_proportion` + `choice` on n + `run` + `histogram` with `keepPrevious` + `stat` SD). Serves OpenIntro 5.1 now, and the CLT and confidence-interval coverage later. The student predicts what happens to the spread when n grows, then flips n and runs. Graded by option, or by number against `theorySd`. This one is the slice 8 `PredictSimulate` widget, rebuilt on parts.
2. **Process timeline** (`process_run` + `choice` on switch or ioDone + `step` + `timeline` + `stat` CPU busy %). Serves OSTEP processes, process states and I/O overlap. The student predicts when a process finishes or what CPU use will be, then steps tick by tick. Graded exactly.
3. **Scheduler** (`schedule` + `choice` on policy + `timeline` + `stat` average turnaround and response). Serves OSTEP scheduling, and it gives a clear surprise: SJF wins on turnaround, RR on response. Graded exactly.
4. **Algorithm stepper** (`array_trace` + `step` + `array` + highlighted pseudocode line). Serves CLRS insertion sort, partition and binary search. The student predicts the array after the next pass, or the number of comparisons. A "what's the array after this step" prediction needs an array-entry input, so I'd start with counts and choice.
5. **Formula explorer**, later. Sliders, then a line plot of a formula (the SE curve against n; maths functions). This is the only one that needs a formula, so it's the one that needs the evaluator below.

Context switches and limited direct execution fit the timeline part with a different simulation (user mode, trap, kernel, return-from-trap rows). That's a second OSTEP simulation, not a new widget.

### What fits by Oct 26

About a day of build time is enough for one complete widget and its shell, if the shell is the part done carefully. Realistic:

- The `explore` module type in `lesson.ts`, with the prediction lock, `requireChange`, the reconcile text, and the events.
- `sample_proportion`, `choice` input, `run`, `histogram`, `stat`. This is the sampling distribution widget, which slice 8 needed anyway.
- If there's time left, `process_run` and `timeline` with `step`. That's maybe three to four hours. The simulation is short, but stepping and the timeline layout on a phone are fiddly, and I'd rather have one widget a reviewer can play than two half-done ones.

The scheduler, the algorithm stepper, `list` input, `slider`, and anything with formulas can wait.

## JSON sketches

Both sketches are what goes in a module's `explore` field, in place of `check`. Every field is a literal, an enum or a reference to an input `id`. The Zod schema is a discriminated union on `widget`, and a `superRefine` checks that each `{ "input": "..." }` names a declared input and each `fromSim` names a field the simulation returns.

The sampling one:

```json
{
  "id": "explore-spread",
  "widget": "sampling_distribution",
  "sim": { "p": 0.88, "n": { "input": "n" }, "samples": 1000, "seed": 7 },
  "inputs": [
    { "id": "n", "kind": "choice", "label": "Sample size n", "options": [25, 100, 400], "start": 25 }
  ],
  "prediction": {
    "kind": "choice",
    "prompt": "You'll draw 1,000 samples of size 25, then 1,000 of size 400. What happens to the spread of the p̂ values?",
    "options": [
      { "id": "narrower", "text": "It gets narrower" },
      { "id": "same", "text": "It stays about the same" },
      { "id": "wider", "text": "It gets wider" }
    ],
    "answer": "narrower",
    "wrongAnswers": [
      { "optionId": "same", "misconception": { "text": "Thinks sample size affects only the centre, not the spread", "source": { "kind": "catalogue", "reference": "delMas, Garfield & Chance 1999" } } }
    ]
  },
  "outputs": [
    { "kind": "histogram", "of": "phat", "bins": { "min": 0.6, "max": 1, "width": 0.01 }, "keepPrevious": true, "markers": [{ "at": "p", "label": "true p" }] },
    { "kind": "stat", "of": "sd", "label": "SD of p̂", "decimals": 3 }
  ],
  "requireChange": ["n"],
  "reconcile": "Larger samples give p̂ values that sit closer to p. The spread shrinks with √n, so 16 times the sample size gives a quarter of the spread."
}
```

The OSTEP one:

```json
{
  "id": "explore-io-overlap",
  "widget": "process_timeline",
  "sim": {
    "processes": [
      { "id": "B", "program": ["io", "cpu"] },
      { "id": "A", "program": ["cpu", "cpu", "cpu", "cpu"] }
    ],
    "ioLength": 5,
    "switch": { "input": "switch" },
    "ioDone": "run_later"
  },
  "inputs": [
    { "id": "switch", "kind": "choice", "label": "When to switch", "options": ["on_end", "on_io"], "start": "on_end" }
  ],
  "prediction": {
    "kind": "number",
    "prompt": "The OS only switches when a process ends. B runs first. How many ticks until both are done?",
    "answer": { "fromSim": "totalTicks" },
    "tolerance": 0
  },
  "outputs": [
    { "kind": "timeline", "of": "states" },
    { "kind": "stat", "of": "cpuBusyPct", "label": "CPU busy", "unit": "%" }
  ],
  "requireChange": ["switch"],
  "reconcile": "With on_end, the CPU sits idle while B waits for its I/O. With on_io, the OS runs A during B's I/O, so the total drops by about the I/O length."
}
```

The player runs the simulation with the inputs' start values to get the answer for the prediction. The author tool can run it the same way and show the reviewer the computed answer next to the prompt, which catches a prompt that doesn't match its own parameters. Someone should check one detail here. The prompt says "B runs first", and the simulation has to agree (process order is list order, as in process-run). Order also decides whether the change teaches anything: with A first, A never does I/O, so `on_io` changes nothing. That's the kind of "valid but wrong" a reviewer catches by playing it, and a simple lint could flag (an input whose values all give the same result).

### If formulas are needed later

The formula explorer is the only widget that needs one. The options I checked:

- **expr-eval** (MIT, 7.5 KB gzipped) had two 2025 CVEs. [CVE-2025-12735](https://nvd.nist.gov/vuln/detail/CVE-2025-12735) is a crafted context object passed to `evaluate()` leading to code execution, and [CVE-2025-13204](https://nvd.nist.gov/vuln/detail/CVE-2025-13204) is prototype pollution. The original package looks unmaintained (last push Aug 2024), and advisories point to `expr-eval-fork`, but they disagree about which fork version is fixed. I wouldn't use it.
- **mathjs** (Apache-2.0, 197 KB gzipped) hasn't used `eval` since version 4. Its [security page](https://mathjs.org/docs/expressions/security.html) says to disable `import`, `createUnit` and `reviver`, and to run untrusted expressions in a Web Worker you can kill. It's safe enough with those steps, but large for one widget.
- **jsep** (MIT, 3.5 KB gzipped) only parses into a syntax tree. We'd write the evaluator: numbers, named variables from the widget's inputs, `+ - * / ^`, unary minus, and a short allowlist of functions (`sqrt`, `abs`, `log`, `exp`, `min`, `max`). That's about 60 lines with no property access, no calls outside the allowlist and no way to reach `Object`.

I'd go with jsep plus our own small evaluator, and reject any formula at validation time that uses a name or function outside the lists. Vega's own answer to the same problem (its interpreter walks a syntax tree instead of building a `Function`) is the same idea.
