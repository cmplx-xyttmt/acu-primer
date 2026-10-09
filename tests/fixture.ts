import { readFileSync } from "node:fs";
import { Lesson } from "../src/shared/lesson.ts";

export const lesson = Lesson.parse(
  JSON.parse(readFileSync(new URL("../content/openintro-sampling/5.1-point-estimates.json", import.meta.url), "utf8")),
);

export function check(moduleId: string) {
  const c = lesson.modules.find((m) => m.id === moduleId)?.check;
  if (!c) throw new Error(`module ${moduleId} has no check`);
  return c;
}
