// Fetch helpers for /api/*.

import type { CourseResponse } from "../../shared/lesson.ts";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(body.error ?? `Request failed (${res.status}).`, res.status);
  return body as T;
}

export function fetchCourse(slug: string) {
  return getJson<CourseResponse>(`/api/courses/${slug}`);
}
