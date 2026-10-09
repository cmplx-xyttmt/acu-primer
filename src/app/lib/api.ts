// Fetch helpers for /api/*.

import type { AuthorCourse, AuthorLesson, CourseResponse } from "../../shared/lesson.ts";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(body.error ?? `Request failed (${res.status}).`, res.status);
  return body as T;
}

export function fetchCourse(slug: string) {
  return request<CourseResponse>(`/api/courses/${slug}`);
}

// The author passphrase, typed once and kept in this browser (spec.md > Components > Author
// gate). Sent as a header with every author request.
const PASSPHRASE_KEY = "acu:authorPassphrase";

export function savedPassphrase(): string {
  try {
    return localStorage.getItem(PASSPHRASE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function savePassphrase(passphrase: string) {
  try {
    if (passphrase) localStorage.setItem(PASSPHRASE_KEY, passphrase);
    else localStorage.removeItem(PASSPHRASE_KEY);
  } catch {
    // Storage unavailable: the author types it again next visit.
  }
}

function author<T>(url: string, init: RequestInit = {}) {
  return request<T>(url, {
    ...init,
    headers: { ...init.headers, "x-author-passphrase": savedPassphrase(), "content-type": "application/json" },
  });
}

export const authorApi = {
  courses: () => author<{ courses: AuthorCourse[] }>("/api/author/courses").then((r) => r.courses),
  lesson: (id: string) => author<AuthorLesson>(`/api/author/lessons/${id}`),
  signOff: (id: string) => author<AuthorLesson>(`/api/author/lessons/${id}/signoff`, { method: "POST" }),
  setShowUnreviewed: (courseId: string, showUnreviewed: boolean) =>
    author(`/api/author/courses/${courseId}`, { method: "PUT", body: JSON.stringify({ showUnreviewed }) }),
};
