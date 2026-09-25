// Student progress, kept in localStorage per course and name (spec.md > Data Model).
// The same name on the same device picks up where it stopped. localStorage can be missing
// or full (private windows), so every access is wrapped and the app still works without it.

export interface LessonProgress {
  done: string[]; // module ids finished
  current: number; // module index to continue from
  completed: boolean;
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
  return progress[lessonId] ?? { done: [], current: 0, completed: false };
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
