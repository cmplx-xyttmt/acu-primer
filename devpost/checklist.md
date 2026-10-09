---
doc: checklist
status: approved
---

# Build Checklist

Build mode: learn (chosen Sep 25, 2026)

## Slices

- [x] **1. A student can play a small stats lesson at a link**
  Becomes usable: Open `/c/openintro-sampling`, type a name, see the module overview with progress, press **Continue**, and move through a short hand-written 5.1 lesson one module at a time, answering pick-an-answer and type-a-number checks correctly. Progress survives a reload for the same name. The same thing works at the deployed `workers.dev` link.
  Why now: Everything else lands on this path (scaffold, lesson schema, D1, the course API, the player shell, the theme). Deploying on day one surfaces Cloudflare surprises while the app is still tiny.
  PRD ref: `prd.md > The Core Journey` (steps 4-5), `prd.md > Course overview and progress`, `prd.md > Modules and checks`, `prd.md > Look and Feel`
  Spec ref: `spec.md > Stack`, `spec.md > Where It Runs and How Someone Tries It`, `spec.md > Look and Feel`, `spec.md > Components > Lesson format`, `spec.md > Components > Player`, `spec.md > Components > Baseline lesson import`, `spec.md > Components > Worker API`, `spec.md > Data Model`, `spec.md > File Structure`
  Build: Scaffold Vite + Svelte 5 + `@cloudflare/vite-plugin` + Wrangler per the file structure, with `package.json` scripts, `wrangler.jsonc` (D1 binding `DB`, SPA assets), `.dev.vars.example` and a README stub. Write `migrations/0001_init.sql`. Write the Zod lesson schema in `src/shared/lesson.ts` (all fields, including wrong answers, general fallback, alternatives, and the no-third-level rule). Write a short hand-written 5.1 fixture lesson in `content/` and `scripts/import-lesson.ts`. Add `GET /api/courses/:slug` (reviewed lessons only). Build the router, `theme.css` with both modes and bundled fonts, KaTeX in `math.ts`, `NameEntry`, `CourseOverview` (with the empty-course note), `ModuleView`, `Select` and `NumberInput` (right answers only for now), and `progress.ts`. Deploy.
  Verify (mechanical): `npm run build` and `npx tsc --noEmit` pass; `npm test` passes `tests/lesson.test.ts` (accepts the fixture, rejects a simpler question that carries its own fallback); import the fixture into local D1 and `curl` `/api/courses/openintro-sampling` returns it; with `npm run dev`, drive the player in the browser through name entry, overview and every module; after `npm run deploy`, `curl` the deployed course endpoint and load the deployed page.
  Learner check: Open the local link (and then the deployed one), type your name, press **Continue**, and answer every check correctly. Reload the page, type the same name, and see that **Continue** takes you to where you stopped. Say whether the look (light and dark) and the module-to-module movement feel the way you pictured.
  Commit: `Play a hand-written stats lesson at a link`

- [ ] **2. A wrong answer changes the lesson's course**
  Becomes usable: In the same lesson, picking a specific wrong option shows the fallback written for that misconception (re-explanation, simpler question, or both). Typing an unanticipated number shows the general fallback with the PRD's wording. Failing the simpler question shows "go back through the material," and the student carries on. No third level appears.
  Why now: This is the student half of the kernel. It's the demo's most likely "oh, that's cool" beat, and the pure logic is easy to test before any model writes lessons for it.
  PRD ref: `prd.md > The Core Journey` (steps 6-7), `prd.md > Fallbacks after a wrong answer`
  Spec ref: `spec.md > Components > Grading and flow logic`, `spec.md > Components > Player`, `spec.md > Look and Feel`
  Build: Write `src/shared/grading.ts` (right / known-wrong / unplanned, number tolerance) and `src/shared/flow.ts` (next module, which fallback, material suggestion) with `tests/grading.test.ts` and `tests/flow.test.ts`. Add `Fallback.svelte` with the rise motion and the "Not quite" copy, and wire both into `ModuleView`. Extend the fixture so each check has known wrong answers, a general fallback, and at least one simpler question.
  Verify (mechanical): `npm test` passes, covering a known wrong option, an unplanned number, a number within tolerance, a failed simpler question returning the material suggestion, and no path reaching a third level; in the browser, walk each of those three wrong-answer paths in the fixture.
  Learner check: Play the lesson and get a check wrong on purpose three ways: pick a wrong option, type a number nobody would expect, and then fail the simpler question. Say what you saw each time and whether the help felt like it fit the mistake.
  Commit: `Fallbacks per wrong answer with a two-level stop`

- [ ] **3. The author turns a book section into a draft lesson with Claude**
  Becomes usable: Behind the author gate, the author picks the OpenIntro PDF, types the 5.1 page range, presses **Draft**, and watches progress stream in. A schema-valid lesson appears as a list of modules, checks, wrong answers (each misconception labelled "catalogue" or "model's guess") and fallbacks, saved as unreviewed. **Preview** opens it in the player.
  Why now: The Claude call is the biggest unknown: structured outputs against a large schema, PDF pages through the Files API, streaming, draft time, cost, and Worker CPU on the free plan. Finding out on slice 3 leaves room to adjust the lesson format while little depends on it. The gate comes with it because this slice adds paid routes to a public link.
  PRD ref: `prd.md > The Core Journey` (steps 1-2), `prd.md > Authoring session`
  Spec ref: `spec.md > The Core Journey Through the System`, `spec.md > Components > Authoring session`, `spec.md > Components > Claude calls`, `spec.md > Components > Misconception catalogues`, `spec.md > Components > Author gate`, `spec.md > External Services and Dependencies`, `spec.md > Important Failure Modes`, `spec.md > Decisions and Open Issues`
  Build: Read the claude-api skill's TypeScript docs first. Write `catalogues/sampling-distributions.json` from published sources (for Isaac to check). Add `pdfPages.ts`, `POST /api/author/sources` (Files API upload), `POST /api/author/lessons`, and a streamed `POST /api/author/lessons/:id/draft` in `claude.ts` (structured output from the Zod schema, effort `high`, prompt caching, stop-reason check, one retry on a failed Zod check, "The draft didn't come back in a usable form" with **Try again**). Add `AuthorHome.svelte` and a first `Session.svelte` (pick pages, draft, list, preview). Settle the gate: check whether Access can cover only the author paths on `workers.dev`, otherwise use the `AUTHOR_PASSPHRASE` fallback in `auth.ts`.
  Verify (mechanical): Unit test that the lesson JSON Schema generated from Zod is accepted as a structured-output format (or a one-off call succeeds); one real draft from the 5.1 pages locally that passes the Zod check and saves with status `unreviewed`; record draft time, `usage` tokens and cost under Revisions or the spec's open issues; `curl` an author route on the deployed link without the gate credential returns 401/403; one deployed draft completes without a CPU-limit error (or the limit is recorded and handled per the failure mode).
  Learner check: Open `/author`, get past the gate, cut the 5.1 pages from your OpenIntro PDF, and press **Draft**. Watch it arrive, then press **Preview** and play a few modules. Say how long it took, whether the checks and misconceptions look like something you'd use, and what you'd want to change.
  Commit: `Draft a lesson from book pages with Claude`

- [ ] **4. The author signs a lesson off, and only then do students see it**
  Becomes usable: The review screen shows the whole lesson in order with every fallback expanded, the mark ("written by the model, not yet reviewed" or "reviewed by a person"), and a **Sign off** button. Before sign-off the lesson doesn't appear at the course link; after, it does. The owner's **Show unreviewed lessons to students** switch shows unreviewed lessons with an obvious badge in the player.
  Why now: Sign-off is what makes the draft from slice 3 reach a student, and "verified before it ships" is half of what makes acu-primer different from asking a chatbot for a quiz.
  PRD ref: `prd.md > The Core Journey` (step 3), `prd.md > Review and sign-off`, `prd.md > States and Boundaries`
  Spec ref: `spec.md > Components > Lesson review and sign-off`, `spec.md > Components > Worker API`, `spec.md > Data Model`
  Build: `Review.svelte`, `POST /api/author/lessons/:id/signoff`, `PUT /api/author/courses/:id`, marks in `AuthorHome`, visibility rules in `GET /api/courses/:slug`, and the "not yet reviewed" badge in `CourseOverview`.
  Verify (mechanical): `curl` the course endpoint before sign-off (draft absent), after sign-off (present), and with the switch on for a second unreviewed lesson (present, flagged unreviewed); check the badge renders in the player.
  Learner check: Open the drafted lesson's review screen and read a few fallback branches. Open the course link in another window and see it isn't there. Sign it off, reload the course link, and see it appear.
  Commit: `Review screen, sign-off and lesson visibility`

- [ ] **5. The author sees one student's path through the lesson**
  Becomes usable: Every student action is recorded and sent to the Worker. The author's student list shows each name, a shortened device id, last seen and lessons touched. One student's log shows, in order, modules entered, each answer, right or wrong, the misconception it hit, the fallback shown, the material suggestion, and time taken. This closes the whole loop.
  Why now: With this slice the kernel's four steps work end to end on the signed-off draft, which is the proof of concept's definition of done. Everything after it makes the loop better rather than making it exist.
  PRD ref: `prd.md > The Core Journey` (step 8), `prd.md > Per-student view`
  Spec ref: `spec.md > Components > Progress and event queue`, `spec.md > Components > Per-student view`, `spec.md > Data Model`, `spec.md > Components > Worker API`
  Build: `src/shared/events.ts`, `eventQueue.ts` (localStorage queue, browser-made ids, batches on start, on `online`, every 30 seconds, removed only after the Worker confirms), device id, `POST /api/events` ignoring duplicate ids, the two student routes, `Students.svelte` (with the empty note) and `StudentLog.svelte` sorted by client time.
  Verify (mechanical): Post the same event batch twice with `curl` and confirm one row per id in D1; play the lesson in the browser as a new student, get a check wrong and fail the fallback, then confirm the student log route returns wrong answer, misconception, fallback and second wrong answer in order.
  Learner check: Play the signed-off draft as a student named "Demo", get a check wrong and fail the fallback. Open the author's student list, click "Demo", and read their path. Say whether the log tells you what you'd want to know.
  Commit: `Record student events and show the per-student log`

- [ ] **6. The author shapes the draft instead of accepting it**
  Becomes usable: In the authoring session, each check shows the tool's alternative options and the author can swap one in. Each wrong answer has on/off switches for the re-explanation and the simpler question. Each part has a "tell the tool what to change" box that revises only that part. Every accepted change is saved.
  Why now: The loop works with a draft accepted as-is. Shaping it is what makes the result something you'd put your name to, and the first real draft (slice 3) plus your review (slice 4) will have shown which controls matter most.
  PRD ref: `prd.md > Authoring session`, `prd.md > Product Decisions`
  Spec ref: `spec.md > Components > Authoring session`, `spec.md > Components > Claude calls`, `spec.md > Components > Worker API`
  Build: Alternatives picker and fallback switches in `Session.svelte` saved through `PUT /api/author/lessons/:id`; `POST /api/author/lessons/:id/revise` with a part-sized JSON Schema, effort `medium`, Zod check and one retry; the player respects switched-off fallback types.
  Verify (mechanical): Unit test that a fallback with its re-explanation switched off makes `flow.ts` skip it; a real revise call on one check returns a schema-valid part and the saved lesson changes only that part (diff the stored JSON before and after); swapping an alternative persists across a reload.
  Learner check: Open the draft in the session. Swap one check for an alternative, switch off a re-explanation on one wrong answer, and ask the tool to change one check ("make this one harder"). Preview and confirm each change shows up the way you asked.
  Commit: `Shape drafts: alternatives, fallback switches, revise`

- [ ] **7. The lesson keeps working offline**
  Becomes usable: After a course has been opened once, turning the network off still lets the student reload, play every module, check and fallback, and see the same fonts and formulas. Events made offline appear in the per-student view once the network is back. A course never opened shows "Open this course once with a connection, then it works offline."
  Why now: Offline sits on top of a finished player and event queue, so it waits until both exist. It's still before the extra check types so the service worker's caching is proven on the demo lesson.
  PRD ref: `prd.md > Offline`, `prd.md > States and Boundaries`
  Spec ref: `spec.md > Components > Offline support`, `spec.md > Decisions and Open Issues` (where published lessons live)
  Build: Configure `vite-plugin-pwa` (precache app, fonts, KaTeX; network-first with cache fallback for `GET /api/courses/*`), register it in `main.ts`, call `navigator.storage.persist()`, and add the never-opened message.
  Verify (mechanical): `npm run build` emits the service worker with the fonts and KaTeX in its precache list; in the browser (built preview or deployed), load the course, switch the network off, reload, play through every module including one fallback, switch the network back on, and confirm the offline events arrive in D1.
  Learner check: Open the course on the deployed link, then turn your wifi off. Reload, play to the end with at least one wrong answer, and turn wifi back on. Open the student view and find the events you made offline. (This is the check you asked about in `4-spec`.)
  Commit: `Offline play with queued events`

- [ ] **8. Sorting and predict-then-simulate checks**
  Becomes usable: The player can show and grade "sort into categories" and "predict, then run the simulation." In the simulation check the student commits to a prediction, then draws many samples of size n and sees the p̂ values plotted. The tool can propose both types in a draft.
  Why now: These make the stats lesson feel like more than a quiz, but the loop is proven without them, so they come after the kernel and offline. They'd be the first thing to cut if time runs short.
  PRD ref: `prd.md > Modules and checks` (the first supported list)
  Spec ref: `spec.md > Components > Player` (check components), `spec.md > Components > Lesson format`, `spec.md > Data Model` (`sim.run` event)
  Build: `Categorize.svelte`, `PredictSimulate.svelte` and `SamplingSim.svelte` (configured by p, sample sizes and the question; no model-written code), grading for both in `grading.ts`, the `sim.run` event, and one example of each in the fixture. Make sure the draft prompt lists both types.
  Verify (mechanical): `npm test` covers grading for a categorize answer (right, known mistake, unplanned) and a prediction; in the browser, play both checks in the fixture, including a wrong answer on each; one fresh draft (or a revise call) produces at least one of the new types that passes the Zod check.
  Learner check: Play the sorting check and the simulation check. Make a prediction, run the simulation with a small and then a large sample size, and say whether the picture helps the idea land.
  Commit: `Categorize and predict-then-simulate checks`

## Hands-on Checkpoints

- [ ] Early usable behavior explored — after slice 2: the student side with fallbacks, so its feel shapes everything the tool will generate
- [ ] Whole loop tried end to end — after slice 5: draft, sign off, play as a student, read the log
- [ ] Final kick-the-tires exploration and feedback completed

## Final Review

- [ ] Final review complete — feedback resolved and learner confirms ready to ship

## Code Tour and App Map

- [ ] Learning activity complete — guided route, focused alternative, prior practice connected, or brief recap
- [ ] Optional edit and transfer reflection addressed — offered/declined/already covered/not applicable as appropriate
- [ ] `devpost/app-map.html` generated from finished code, checked, and shown, including a project-grounded practice to reuse

Activity and evidence: [what actually happened; real document/test/code references; unfinished work if interrupted]
Route and stops: [actual paths and symbols; guided stops completed, or reference-only route]
Edit outcome: [tried/kept/reverted/declined/not applicable; verification if changed]
Reflection: [offered/answered/declined/already covered — personal answer belongs only in the ignored profile]
Activity mode: [live app and editor, explicit static fallback, focused alternative, prior practice, or recap]

## Revisions
- The router is `src/app/router.svelte.ts`, not `router.ts` — Svelte 5 runes (reactive `$state`) only work in `.svelte` and `.svelte.ts` files.
- Added `src/app/player/Player.svelte` (loads the course, switches between name entry, overview and modules) and `src/worker/http.ts` (the `json()` helper) — neither was in the file structure; both keep the listed files small.
- Three TypeScript configs (`tsconfig.json` for the app, `tsconfig.worker.json`, `tsconfig.node.json` for scripts and tests) instead of one — browser and Worker types clash in a single config.
- TypeScript pinned to 6 — svelte-check 4.7 doesn't accept TypeScript 7 yet.
- The lesson schema has only the `select` and `number` check types for now — `categorize` and `predict_simulate` join the union in slice 8, so the schema never describes a type the player can't show.
- Slice 1 status at the end of the Sep 25 session: everything built and verified locally (tests, type checks, build, `curl`, full playthrough in Chrome); the deploy is still to do because Wrangler needs `npx wrangler login`. Saved as a checkpoint commit; the box gets ticked after the deployed checks pass. Deployed Oct 9 to https://acu-primer.cmplxxyttmt.workers.dev after a D1 config fix (see commit b2ad15b); Isaac ran the learner check and the test checklist.
- Added a light/dark switch (Auto, Light, Dark) on every player screen, and a **Back** button that returns to the previous module for re-reading, with the browser's Back button doing the same — Isaac's slice 1 review found no way to see the other theme or to go back. `prd.md > Look and Feel`, `prd.md > Screens and Layout` and `spec.md > Look and Feel`, `spec.md > Components > Player` updated to match.
- Slice 2's fixture rewrite also fixes the content: symbols defined at each formula (what $p$, $\hat{p}$ and $n$ are, and why the SE formula uses $p$), module 4's check uses $\hat{p}$, and at least one check asks for reasoning; slice 3's draft prompt gains the same two rules — Isaac found the slice 1 fixture easy to pass but thin, and was confused by $p$ versus $\hat{p}$ in the SE formula. Later pipeline ideas recorded in `authoring-pipeline.md`.
- After a fallback, the student tries the original question once more (after reading a re-explanation, or after getting the simpler question right); a wrong simpler question or a wrong retry ends in the material suggestion — the PRD said what happens when the fallback fails but not whether the student returns to the original question. Recorded in `prd.md > Fallbacks after a wrong answer`.
- The fixture now has 7 modules (a new "Sample size, not population size" check) and every check has a fallback per known wrong answer; `tests/fixture.ts` loads it for the grading and flow tests.
