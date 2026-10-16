// Fetch helpers for /api/*.

import type { AuthorCourse, AuthorLesson, CourseResponse } from "../../shared/lesson.ts";
import type { StudentSummary } from "../../shared/events.ts";

export interface LoggedEvent {
  id: string;
  lessonId: string | null;
  type: string;
  payload: Record<string, unknown>;
  clientTime: string;
}

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
  approve: (id: string, stepId: string) =>
    author<AuthorLesson>(`/api/author/lessons/${id}/steps/${stepId}/approval`, { method: "POST" }),
  unapprove: (id: string, stepId: string) =>
    author<AuthorLesson>(`/api/author/lessons/${id}/steps/${stepId}/approval`, { method: "DELETE" }),
  suggest: (id: string, s: { stepId: string; part: string; partLabel: string; text: string }) =>
    author<AuthorLesson>(`/api/author/lessons/${id}/suggestions`, { method: "POST", body: JSON.stringify(s) }),
  students: (courseId: string) =>
    author<{ students: StudentSummary[] }>(`/api/author/courses/${courseId}/students`).then((r) => r.students),
  studentLog: (courseId: string, name: string, device: string) =>
    author<{ events: LoggedEvent[] }>(
      `/api/author/courses/${courseId}/student-events?name=${encodeURIComponent(name)}&device=${encodeURIComponent(device)}`,
    ).then((r) => r.events),
  withdraw: (suggestionId: string) =>
    author<AuthorLesson>(`/api/author/suggestions/${suggestionId}/withdraw`, { method: "POST" }),
  setShowUnreviewed: (courseId: string, showUnreviewed: boolean) =>
    author(`/api/author/courses/${courseId}`, { method: "PUT", body: JSON.stringify({ showUnreviewed }) }),
};
