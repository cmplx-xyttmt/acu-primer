// Student progress, kept in localStorage per course and name (spec.md > Data Model).
// The same name on the same device picks up where it stopped. localStorage can be missing
// or full (private windows), so every access is wrapped and the app still works without it.

export interface LessonProgress {
  done: string[]; // module ids passed (or read, for a module with no check)
  skipped: string[]; // module ids the student skipped after the last hint; not passed
  current: number; // furthest module index reached; the lesson's length once at the end
}

export type CourseProgress = Record<string, LessonProgress>; // by lesson id

const LAST_NAME_KEY = "acu:lastName";

export const normalizeName = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();

const key = (slug: string, name: string) => `acu:progress:${slug}:${normalizeName(name)}`;

function read<T>(k: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(k);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(k: string, value: unknown) {
  try {
    localStorage.setItem(k, typeof value === "string" ? value : JSON.stringify(value));
  } catch {
    // Storage unavailable: progress lasts only for this visit.
  }
}

export function loadProgress(slug: string, name: string): CourseProgress {
  return read<CourseProgress>(key(slug, name), {});
}

export function saveProgress(slug: string, name: string, progress: CourseProgress) {
  write(key(slug, name), progress);
}

export function lessonProgress(progress: CourseProgress, lessonId: string): LessonProgress {
  const saved = progress[lessonId];
  return { done: saved?.done ?? [], skipped: saved?.skipped ?? [], current: saved?.current ?? 0 };
}

// The rules for moving through a lesson. Pure, so tests/progress.test.ts can check them.

/** The student passed a module (or read one with no check). Clears an earlier skip. */
export function passModule(p: LessonProgress, moduleId: string, index: number): LessonProgress {
  return {
    done: p.done.includes(moduleId) ? p.done : [...p.done, moduleId],
    skipped: p.skipped.filter((id) => id !== moduleId),
    current: Math.max(p.current, index + 1),
  };
}

/** The student chose "Skip for now" after the last hint. The module stays not passed. */
export function skipModule(p: LessonProgress, moduleId: string, index: number): LessonProgress {
  return {
    done: p.done,
    skipped: p.done.includes(moduleId) || p.skipped.includes(moduleId) ? p.skipped : [...p.skipped, moduleId],
    current: Math.max(p.current, index + 1),
  };
}

/** Complete means every module passed; skipped ones hold it back. */
export function isComplete(p: LessonProgress, moduleIds: string[]): boolean {
  return moduleIds.every((id) => p.done.includes(id));
}

/** Where Continue opens: where the student stopped, then the first skipped module once
 *  they've reached the end, and the start again for a complete lesson. */
export function resumeIndex(p: LessonProgress, moduleIds: string[]): number {
  if (p.current < moduleIds.length) return p.current;
  const firstSkipped = moduleIds.findIndex((id) => p.skipped.includes(id) && !p.done.includes(id));
  return firstSkipped >= 0 ? firstSkipped : 0;
}

export function lastName(): string {
  try {
    return localStorage.getItem(LAST_NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

export function rememberName(name: string) {
  write(LAST_NAME_KEY, name.trim());
}
