// Every student action becomes an event in a queue in localStorage, sent to POST /api/events in
// batches: when the app starts, when the browser says it's back online, and every 30 seconds.
// An event leaves the queue only after the Worker confirms it saved it, so nothing is lost
// offline. Ids are made here, so a batch sent twice is saved once.

import type { EventType, StudentEvent } from "../../shared/events.ts";

const QUEUE_KEY = "acu:eventQueue";
const DEVICE_KEY = "acu:deviceId";
const MAX_QUEUE = 5000; // a very long offline stretch drops the oldest, not the newest

function read(): StudentEvent[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function write(queue: StudentEvent[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-MAX_QUEUE)));
  } catch {
    // Storage full or unavailable: events from this visit may not reach the author.
  }
}

/** A random id made once per browser, so two students with the same name on different
 *  devices show up separately. */
export function deviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return "no-storage-" + crypto.randomUUID();
  }
}

let student: { chapterSlug: string; name: string } | null = null;

export function setStudent(chapterSlug: string, name: string) {
  student = { chapterSlug, name: name.trim() };
}

export function record(type: EventType, lessonId: string | null, payload: object) {
  if (!student) return;
  const event: StudentEvent = {
    id: crypto.randomUUID(),
    chapterSlug: student.chapterSlug,
    lessonId,
    studentName: student.name,
    deviceId: deviceId(),
    type,
    payload: payload as Record<string, unknown>,
    clientTime: new Date().toISOString(),
  };
  write([...read(), event]);
  // Send soon, but not on every click: answers often come in quick runs.
  clearTimeout(soon);
  soon = setTimeout(flush, 2000);
}

let soon: ReturnType<typeof setTimeout> | undefined;
let sending = false;

export async function flush() {
  if (sending || !navigator.onLine) return;
  const batch = read().slice(0, 100);
  if (batch.length === 0) return;
  sending = true;
  try {
    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ events: batch }),
    });
    // A 400 or 413 means the server will never take this batch (an event it refuses), so it's
    // dropped too; otherwise it would block every later event from this browser.
    if (res.ok || res.status === 400 || res.status === 413) {
      const sent = new Set(batch.map((e) => e.id));
      write(read().filter((e) => !sent.has(e.id)));
      if (read().length > 0) setTimeout(flush, 0); // more waiting: send the next batch
    }
  } catch {
    // Offline or the server didn't answer: the events stay queued for the next try.
  } finally {
    sending = false;
  }
}

let started = false;

export function startSending() {
  if (started) return;
  started = true;
  addEventListener("online", flush);
  setInterval(flush, 30_000);
  flush();
}

export const queuedCount = () => read().length;
