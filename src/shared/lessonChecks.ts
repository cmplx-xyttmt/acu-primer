// Checks done by code that the schema can't express. A drafted lesson must pass the Zod
// schema and come back from here with no problems before it's saved; otherwise the
// problems go back to Claude for one retry.

import type { AlternativeCheck, Check, Explore, Lesson, SimpleCheck } from "./lesson.ts";
import { combinations, evaluate, FormulaError, parseFormula } from "./formula.ts";

type AnyCheck = Check | AlternativeCheck | SimpleCheck;

function checkProblems(c: AnyCheck, where: string): string[] {
  const problems: string[] = [];
  if (c.type === "select") {
    const ids = c.options.map((o) => o.id);
    if (new Set(ids).size !== ids.length) problems.push(`${where}: option ids repeat`);
    if (!ids.includes(c.answer)) problems.push(`${where}: the answer "${c.answer}" is not one of the option ids`);
    if ("wrongAnswers" in c)
      for (const w of c.wrongAnswers) {
        if (w.match.optionId === c.answer) problems.push(`${where}: a wrong answer matches the right option`);
        if (!ids.includes(w.match.optionId))
          problems.push(`${where}: wrong answer "${w.match.optionId}" is not one of the option ids`);
      }
  } else if (c.type === "sort") {
    const cats = c.categories.map((x) => x.id);
    const items = c.items.map((x) => x.id);
    if (new Set(cats).size !== cats.length) problems.push(`${where}: category ids repeat`);
    if (new Set(items).size !== items.length) problems.push(`${where}: item ids repeat`);
    for (const it of c.items)
      if (!cats.includes(it.category)) problems.push(`${where}: item "${it.id}" belongs in "${it.category}", which isn't a category`);
    for (const w of c.wrongAnswers) {
      const it = c.items.find((x) => x.id === w.match.itemId);
      if (!it) problems.push(`${where}: wrong answer item "${w.match.itemId}" isn't one of the items`);
      if (!cats.includes(w.match.categoryId)) problems.push(`${where}: wrong answer category "${w.match.categoryId}" isn't a category`);
      if (it && it.category === w.match.categoryId) problems.push(`${where}: a wrong answer puts "${it.id}" in its right category`);
    }
  } else {
    if ("wrongAnswers" in c)
      for (const w of c.wrongAnswers) {
        if (w.match.min > w.match.max) problems.push(`${where}: a wrong-answer range has min above max`);
        const lo = c.answer - c.tolerance;
        const hi = c.answer + c.tolerance;
        if (w.match.min <= hi && w.match.max >= lo)
          problems.push(`${where}: a wrong-answer range [${w.match.min}, ${w.match.max}] overlaps the right answer`);
      }
  }
  if ("wrongAnswers" in c)
    for (const [i, w] of c.wrongAnswers.entries()) {
      const s = w.fallback.simplerQuestion?.check;
      if (s) problems.push(...checkProblems(s, `${where} wrong answer ${i + 1} simpler question`));
    }
  if ("generalFallback" in c && c.generalFallback.simplerQuestion)
    problems.push(...checkProblems(c.generalFallback.simplerQuestion.check, `${where} general simpler question`));
  return problems;
}

/** An exploration's widget must work for every setting the student can choose. */
export function exploreProblems(e: Explore, where: string): string[] {
  const problems: string[] = [];
  const opts = e.prediction.options.map((o) => o.id);
  if (new Set(opts).size !== opts.length) problems.push(`${where}: prediction option ids repeat`);
  if (!opts.includes(e.prediction.answer)) problems.push(`${where}: the prediction's answer "${e.prediction.answer}" is not one of its options`);
  const w = e.widget;
  if (w.kind === "formula") {
    const ids = w.inputs.map((x) => x.id);
    if (new Set(ids).size !== ids.length) problems.push(`${where}: input ids repeat`);
    for (const x of w.inputs) if (!x.values.includes(x.start)) problems.push(`${where}: input "${x.id}" starts at ${x.start}, which isn't one of its values`);
    if (w.plotOver && !ids.includes(w.plotOver)) problems.push(`${where}: plotOver "${w.plotOver}" isn't an input`);
    try {
      const tree = parseFormula(w.expression, ids);
      const all = combinations(w.inputs);
      if (all.some((vars) => !Number.isFinite(evaluate(tree, vars))))
        problems.push(`${where}: the formula gives no number for some settings (dividing by zero, or a square root of a negative?)`);
      // An input that never changes the result is a control that does nothing.
      const start = Object.fromEntries(w.inputs.map((x) => [x.id, x.start]));
      for (const x of w.inputs) {
        const results = new Set(x.values.map((v) => evaluate(tree, { ...start, [x.id]: v }).toFixed(9)));
        if (results.size === 1) problems.push(`${where}: changing "${x.id}" never changes the result`);
      }
    } catch (err) {
      if (err instanceof FormulaError) problems.push(`${where}: the formula can't be read: ${err.message}`);
      else throw err;
    }
  } else if (w.kind === "sampling") {
    if (!w.sizes.includes(w.start)) problems.push(`${where}: the start size ${w.start} isn't one of the sizes`);
    if (new Set(w.sizes).size !== w.sizes.length) problems.push(`${where}: sample sizes repeat`);
  } else if (w.kind === "scenarios") {
    const ids = w.inputs.map((x) => x.id);
    if (new Set(ids).size !== ids.length) problems.push(`${where}: input ids repeat`);
    const key = (when: Record<string, string>) => ids.map((id) => `${id}=${when[id]}`).join("&");
    const wanted = w.inputs.reduce<Record<string, string>[]>(
      (acc, x) => acc.flatMap((c) => x.options.map((o) => ({ ...c, [x.id]: o.id }))),
      [{}],
    );
    const have = new Map<string, number>();
    for (const o of w.outcomes) {
      if (Object.keys(o.when).sort().join() !== [...ids].sort().join()) problems.push(`${where}: an outcome's "when" must name every input once`);
      have.set(key(o.when), (have.get(key(o.when)) ?? 0) + 1);
    }
    for (const c of wanted) {
      const n = have.get(key(c)) ?? 0;
      if (n === 0) problems.push(`${where}: no outcome for ${key(c)}`);
      if (n > 1) problems.push(`${where}: more than one outcome for ${key(c)}`);
    }
  }
  return problems;
}

// Every piece of text a student might see, with where it is, for the text checks below.
function texts(value: unknown, path: string, out: [string, string][] = []): [string, string][] {
  if (typeof value === "string") out.push([path, value]);
  else if (Array.isArray(value)) value.forEach((v, i) => texts(v, `${path}[${i}]`, out));
  else if (value && typeof value === "object")
    for (const [k, v] of Object.entries(value))
      if (k !== "id" && k !== "match" && k !== "source" && k !== "answer") texts(v, path ? `${path}.${k}` : k, out);
  return out;
}

function textProblems(lesson: Lesson): string[] {
  const problems: string[] = [];
  for (const [where, text] of texts(lesson, "")) {
    // $ signs must pair up, or math renders in the wrong places (\$ is a literal dollar).
    if ((text.replace(/\\\$/g, "").match(/\$/g) ?? []).length % 2 === 1) problems.push(`${where}: unbalanced $`);
    // A backslash before a quote shows up on screen; it's a JSON-escaping slip.
    if (text.includes('\\"')) problems.push(`${where}: stray backslash before a quote (\\")`);
  }
  return problems;
}

export function lessonProblems(lesson: Lesson): string[] {
  const problems: string[] = [...textProblems(lesson)];
  const moduleIds = lesson.modules.map((m) => m.id);
  if (new Set(moduleIds).size !== moduleIds.length) problems.push("module ids repeat");
  const checkIds: string[] = [];

  lesson.modules.forEach((m, i) => {
    const where = `module ${m.id}`;
    if (m.explore) problems.push(...exploreProblems(m.explore, `${where} exploration`));
    const active = (x: (typeof lesson.modules)[number]) => !!x.check || !!x.explore;
    if (!m.check) {
      if (!active(m) && i > 0 && !active(lesson.modules[i - 1]) && i < lesson.modules.length - 1)
        problems.push(`${where}: two modules in a row without a check`);
      return;
    }
    checkIds.push(m.check.id);
    problems.push(...checkProblems(m.check, `${where} check`));
    for (const alt of m.check.alternatives) {
      checkIds.push(alt.id);
      problems.push(...checkProblems(alt, `${where} alternative ${alt.id}`));
    }
  });
  if (new Set(checkIds).size !== checkIds.length) problems.push("check ids repeat");
  return problems;
}
