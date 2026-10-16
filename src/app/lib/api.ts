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

// status 0: no connection, and no saved copy either (fetch itself failed).
export const OFFLINE = 0;

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new ApiError("No connection.", OFFLINE);
  }
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
  budget: () => author<{ spentUsd: number; budgetUsd: number; model: string; hasKey: boolean }>("/api/author/budget"),
  setBrief: (courseId: string, brief: string) =>
    author(`/api/author/courses/${courseId}`, { method: "PUT", body: JSON.stringify({ brief }) }),
  uploadSource: (courseId: string, title: string, pages: string, pdf: Uint8Array) =>
    request<{ sourceId: string; kb: number }>(
      `/api/author/sources?courseId=${encodeURIComponent(courseId)}&title=${encodeURIComponent(title)}&pages=${encodeURIComponent(pages)}`,
      { method: "POST", headers: { "x-author-passphrase": savedPassphrase(), "content-type": "application/pdf" }, body: pdf as BufferSource },
    ),
  revise: (id: string, stepId: string) =>
    author<{ lesson: AuthorLesson; note: string; usage: { costUsd: number } }>(`/api/author/lessons/${id}/steps/${stepId}/revise`, { method: "POST" }),
  swap: (id: string, moduleId: string, alternativeId: string) =>
    author<AuthorLesson>(`/api/author/lessons/${id}/edits`, { method: "POST", body: JSON.stringify({ kind: "swap", moduleId, alternativeId }) }),
  setPart: (id: string, moduleId: string, which: number | "general", part: "reExplanation" | "simplerQuestion", enabled: boolean) =>
    author<AuthorLesson>(`/api/author/lessons/${id}/edits`, { method: "POST", body: JSON.stringify({ kind: "switch", moduleId, which, part, enabled }) }),
  withdraw: (suggestionId: string) =>
    author<AuthorLesson>(`/api/author/suggestions/${suggestionId}/withdraw`, { method: "POST" }),
  setShowUnreviewed: (courseId: string, showUnreviewed: boolean) =>
    author(`/api/author/courses/${courseId}`, { method: "PUT", body: JSON.stringify({ showUnreviewed }) }),
};

export type DraftEvent =
  | { chars: number; attempt: number }
  | { alive: number; phase: "thinking" | "writing" }
  | { done: string; usage: { costUsd: number; input: number; output: number }; seconds: number; attempts: number }
  | { error: string; usage?: { costUsd: number } };

/** Start a draft and read its progress, one JSON object per line, until it ends. */
export async function streamDraft(sourceId: string, section: string, onEvent: (e: DraftEvent) => void): Promise<void> {
  const res = await fetch("/api/author/drafts", {
    method: "POST",
    headers: { "x-author-passphrase": savedPassphrase(), "content-type": "application/json" },
    body: JSON.stringify({ sourceId, section }),
  });
  if (!res.ok || !res.body) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.error ?? `Request failed (${res.status}).`, res.status);
  }
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (line) onEvent(JSON.parse(line));
    }
  }
}
