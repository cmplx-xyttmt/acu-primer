// The chapter this browser played last, for the home page's Continue card.

const KEY = "acu:lastChapter";

export interface LastPlayed {
  subjectSlug: string;
  chapterSlug: string;
  chapterTitle: string;
}

export function lastPlayed(): LastPlayed | null {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "null");
  } catch {
    return null;
  }
}

export function rememberPlayed(p: LastPlayed) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // Storage unavailable: no Continue card next time.
  }
}
