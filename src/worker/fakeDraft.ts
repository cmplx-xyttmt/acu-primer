// Fake drafting (Oct 24), for trying the drafting screens without spending Claude credits or
// waiting ten minutes a lesson. On with `npm run dev:fake` (FAKE_DRAFTS=1), and only ever on a
// local address, so a stray setting can't reach the deployed site. No Claude call is made: the
// pages aren't uploaded, and each "draft" streams made-up progress for about 12 seconds, then
// saves a copy of the OpenIntro 5.1 sample lesson titled "[Fake] <section>", costing $0.
// FAKE_DRAFTS=some-fail makes every second draft fail, to see how the queue copes.

import { Lesson } from "../shared/lesson.ts";
import sample from "../../content/openintro-sampling/5.1-point-estimates.json";

export type FakeMode = "off" | "all-done" | "some-fail";

export function fakeMode(env: Env, url: URL): FakeMode {
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (!local || !env.FAKE_DRAFTS || env.FAKE_DRAFTS === "0") return "off";
  return env.FAKE_DRAFTS === "some-fail" ? "some-fail" : "all-done";
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
let count = 0; // per Worker instance; good enough to alternate locally

/** Stream a fake draft's progress in the real draft's format, and save the lesson. */
export async function fakeDraft(
  mode: FakeMode,
  input: { lessonId: string; section: string; book: string; pages: string },
  send: (obj: object) => Promise<void>,
  save: (lesson: Lesson) => Promise<void>,
): Promise<void> {
  const started = Date.now();
  const seconds = () => Math.round((Date.now() - started) / 1000);
  for (let i = 0; i < 2; i++) {
    await wait(2000);
    await send({ alive: seconds(), phase: "thinking" });
  }
  for (let n = 1500; n <= 12000; n += 1500) {
    await wait(1000);
    await send({ chars: n, attempt: 1 });
  }
  const usage = { costUsd: 0, input: 0, output: 0 };
  if (mode === "some-fail" && count++ % 2 === 1) {
    await send({ error: "Fake failure (FAKE_DRAFTS=some-fail): every second fake draft fails.", usage });
    return;
  }
  const lesson = Lesson.parse({ ...sample, id: input.lessonId, title: `[Fake] ${input.section}`, source: { book: input.book, pages: input.pages } });
  await save(lesson);
  await send({ done: input.lessonId, usage, seconds: seconds(), attempts: 1 });
}
