// Checks done by code that the schema can't express. A drafted lesson must pass the Zod
// schema and come back from here with no problems before it's saved; otherwise the
// problems go back to Claude for one retry.

import type { AlternativeCheck, Check, Lesson, SimpleCheck } from "./lesson.ts";

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
    if (!m.check) {
      if (i > 0 && !lesson.modules[i - 1].check && i < lesson.modules.length - 1)
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
