---
doc: spec
status: approved
---

# acu-primer — Technical Spec

## How This Works, In Plain Language
acu-primer is one Cloudflare project with three pieces, deployed with one command.

1. **The app in the browser.** It's written in Svelte and holds both the player and the author side. It's a single page, so moving between modules doesn't reload anything, which gives the smooth feel the PRD asks for. A **service worker** (a small script the browser keeps for this site) saves a copy of the app and each course the student has opened. That's how the player keeps working offline. Progress and not-yet-sent events are kept in the browser's `localStorage`, which is a small store the browser keeps for one site.

2. **The Worker.** This is the server code, one TypeScript program that answers everything under `/api/`. It lists courses and lessons, saves student events, signs lessons off, and talks to Claude. It holds the Anthropic API key, so the key never reaches a browser.

3. **D1.** This is the database, a SQLite file that Cloudflare manages. It holds courses, lessons (each lesson is one JSON document), sign-offs and events.

A lesson is a JSON document in a format we design fresh for this repo, drawing on the content graph's ideas but not its code. The player reads it, the tool writes it, and one schema file checks it on both sides. Authors never see it.

When the author builds a lesson, the browser cuts the pages for one section out of the book PDF and sends only those pages. The Worker passes them to Claude (Opus 5.5), which returns a lesson draft in the lesson format. Every edit the author asks for is another short call. Nothing a model writes reaches a student until the author signs the lesson off.

Why this shape and nothing bigger: it's the smallest setup that gives a link anyone can open, a database, a place to keep the key secret, and offline play. Cloudflare's free tier covers all of it, so the budget goes to Claude calls.

## The Core Journey Through the System
PRD ref: `prd.md > The Core Journey`.

1. **The author starts a lesson.** They open `/author` and get past the gate (see `Components > Author gate`). They pick the OpenIntro PDF on their laptop and type the page range for 5.1. The browser cuts those pages into a small PDF with pdf-lib, and sends it to `POST /api/author/sources`. The Worker uploads it to Anthropic's Files API and saves the returned file id in D1. The book itself never leaves the laptop, and only the cut pages do.
2. **The author and the tool build it together.** `POST /api/author/lessons/:id/draft` asks Claude for a lesson draft. The request carries the file id, the lesson schema, the misconception catalogue for the topic, and instructions. The Worker streams progress to the browser and checks the finished JSON against the schema, then saves it in D1 with status `unreviewed`. The session screen shows modules, checks, alternative checks and fallbacks. Each change the author asks for ("make this check harder") goes to `POST /api/author/lessons/:id/revise` along with the one part being changed. The tool returns a new version of that part. The Worker checks it and saves the lesson.
3. **The author signs it off.** `POST /api/author/lessons/:id/signoff` sets the status to `reviewed` and records the time.
4. **A student arrives.** They open `/c/openintro-sampling`. The static files load the app, which calls `GET /api/courses/openintro-sampling`. The Worker returns only signed-off lessons (or all of them if the owner switched that on). The student types a name, and the app loads their progress from `localStorage`.
5. **The student works through modules.** The app shows one module at a time from the lesson JSON. Answers are graded in the browser by `shared/grading.ts`, so grading needs no connection. Each action adds an event to the queue in `localStorage`, and the queue is sent to `POST /api/events` when online.
6. **The student gets a check wrong.** `shared/grading.ts` works out whether the answer matches a known wrong answer. `shared/flow.ts` decides what comes next: that wrong answer's fallback, or the check's general fallback for an unplanned answer.
7. **The student fails the fallback too.** `shared/flow.ts` sees the student is already at the fallback level and returns the "go back through the material" step. There's no third level.
8. **The author sees what happened.** `/author/students` calls `GET /api/author/courses/:id/students`, then `.../students/:studentKey/events`. The Worker queries the events table, and the app lays the events out in order as the log.

## Stack
- **TypeScript** everywhere. Isaac's notes chose it (option A). The Worker, the app and the shared logic are all TypeScript, so the lesson schema is written once.
- **Svelte 5** with **Vite** for the app, without SvelteKit. Isaac chose it: Svelte files read like HTML templates, close to Django templates, and it makes small downloads for cheap phones. The tradeoff Isaac accepted is that agents know React better. https://svelte.dev/docs/svelte
- **Cloudflare Workers** with the **Cloudflare Vite plugin** (`@cloudflare/vite-plugin`), so `vite dev` runs the app and the Worker together, with a local D1. https://developers.cloudflare.com/workers/vite-plugin/
- **Wrangler** (the Cloudflare command-line tool) for D1 migrations, secrets and deploys. https://developers.cloudflare.com/workers/wrangler/
- **D1** for the database. https://developers.cloudflare.com/d1/
- **Zod** for the lesson schema, used to check model output in the Worker and lesson data in the app. Zod 4 can turn a schema into JSON Schema for Claude's structured outputs. https://zod.dev
- **Anthropic TypeScript SDK** (`@anthropic-ai/sdk`) in the Worker. Structured outputs (`output_config.format`) make Claude return JSON matching the schema. The Files API holds the cut pages. Streaming lets the author watch a draft arrive. https://docs.claude.com/en/api/overview
- **Model: Claude Opus 5.5** (`claude-opus-5-5`), $4 / $20 per million input / output tokens. Isaac chose it. **Sonnet 5** (`claude-sonnet-5`, $2 / $10) is the backup when a lot of material needs processing. It's a setting, `DRAFT_MODEL` in `wrangler.jsonc`, switched by hand, not automatically.
- **pdf-lib** in the browser to cut a page range out of the PDF. https://pdf-lib.js.org
- **vite-plugin-pwa** to generate the service worker. https://vite-pwa-org.netlify.app
- **KaTeX** to show formulas, bundled so it works offline. https://katex.org
- **Fontsource** packages for the fonts, bundled so they work offline. https://fontsource.org
- **Vitest** for tests of the pure logic. https://vitest.dev
- **jose** in the Worker, to verify the Cloudflare Access token if Access is used. https://github.com/panva/jose

To check early in the build (not verified in planning):
- The exact SDK calls for structured outputs, the Files API and streaming in TypeScript. The build reads the claude-api skill's TypeScript docs before writing them.
- Opus 5.5 specifics: thinking can't be turned off and effort defaults to `medium`, so the Worker sets effort explicitly (`high` for drafts, `medium` for revisions).
- Whether a Cloudflare Access policy can cover only `/author/*` and `/api/author/*` on a `workers.dev` address (see `Decisions and Open Issues`).
- Whether Files API storage costs anything at this size.

## Where It Runs and How Someone Tries It
- **Runtime:** a browser for the app; Cloudflare Workers for the API; D1 for data. Node 20 or newer on the laptop for development.
- **Keys:** `ANTHROPIC_API_KEY` in `.dev.vars` locally (gitignored) and as a Worker secret in production (`npx wrangler secret put ANTHROPIC_API_KEY`). `.dev.vars.example` lists the names with no values. If the passphrase gate is used, `AUTHOR_PASSPHRASE` works the same way.
- **Run locally:** `npm install`, then `npm run db:migrate:local`, then `npm run dev`, and open http://localhost:5173. The player is at `/c/openintro-sampling` and the author side at `/author`.
- **Deploy:** `npm run db:migrate:remote` once per migration, then `npm run deploy` (builds with Vite, then `wrangler deploy`). The app is at `https://acu-primer.<account>.workers.dev`.
- **Recording the demo:** record from the deployed link, since "the app opens at a link" is part of the Oct 9 definition of done. The offline beat is recorded by turning the laptop's wifi off (or using the browser's offline switch in DevTools) after the course has loaded.
- **Submission:** Devpost needs the video and the public GitHub repo. The deployed link is an extra that lets judges try it.
- **Budget guard:** set a $20 monthly spend limit in the Anthropic Console before the first call.

## Look and Feel
From `prd.md > Look and Feel`. The mode follows the device setting (`prefers-color-scheme`) unless the student picks Light or Dark with the switch (`ThemeSwitch.svelte`, `src/app/lib/theme.ts`). The choice is saved in `localStorage` as `acu:theme` and sets `data-theme` on `<html>` before the first render.

**Light mode, "Clean study"**
- Colors: background `#FFFFFF`, surfaces and answer buttons `#F3F4F6`, text `#111827`, secondary text `#6B7280`, accent `#2563EB`, hover border `#93B4F5`, fallback panel `#EFF4FF`.
- Type: Plus Jakarta Sans throughout (400, 600, 700).
- Shapes: 12px corners, answer buttons with a 2px border that turns blue on hover.

**Dark mode, "Night desk"**
- Colors: background `#14161A`, surfaces `#1C1F24`, borders `#33373E`, text `#E6E3DC`, accent `#F2B84B`, fallback panel `#221E14` with a 3px amber left border.
- Type: IBM Plex Sans for text, IBM Plex Mono for numbers, code, progress counts and trace tables.
- Shapes: 6px corners.

**Both modes**
- One module on screen at a time, with a thin progress bar and an "n / total" count at the top, and nothing else competing.
- Moving between modules: a short fade and slide (about 180ms). A fallback appears under the check with a short rise (about 200ms). All motion is turned off when the device asks for reduced motion.
- Fonts and KaTeX are bundled, never loaded from a CDN, so offline looks the same as online.
- Interface copy is short and plain. A wrong answer says "Not quite," never "Wrong!"
- The author side uses the same colors and fonts, with denser layouts.
- The colors live as CSS variables in `src/app/theme.css`, so every component uses the same names.

## Components

### Lesson format
The shared schema in `src/shared/lesson.ts`, written in Zod. Everything else depends on it. It's a new format, with ideas from the content graph (checks carry their wrong answers, and each wrong answer names a misconception) but none of its code.
- A **lesson** has an id, a title, a source (book and pages), its **outcomes** (one line each: what a student can do by the end; at least one) and a list of **modules**.
- A **module** has a title, short reading (text with inline math), and at most one **check**.
- A **check** has a type from the first supported list (`select`, `number`, `categorize`, `predict_simulate`, `predict_output`, `trace_table`), a prompt, the fields its type needs, and the right answer. It also has:
  - `wrongAnswers`: each one says what it matches (an option, a value range, a category mistake), names a misconception (text, plus a source: `catalogue` with a reference, or `model`), and gives a **fallback**;
  - `generalFallback`: the fallback for an unplanned wrong answer;
  - `alternatives`: other check options the tool proposed, which only the author side shows.
  - `explanation`: why the right answer is right, shown under "Right." (required on checks and alternatives, optional on simpler questions).
- A **fallback** has an optional re-explanation and an optional simpler question. The author turns either one on or off. A simpler question is a check with no fallbacks of its own. The schema enforces this, which is how "no third level" is guaranteed.

PRD ref: `prd.md > Modules and checks`, `prd.md > Fallbacks after a wrong answer`.

### Grading and flow logic
Two small, pure TypeScript files in `src/shared/`, with no Svelte and no network, so Vitest can test them directly.
- `grading.ts` takes a check and an answer and returns `right`, `known-wrong` (with which wrong answer), or `unplanned`. Numbers are compared with a tolerance.
- `flow.ts` takes where the student is (module, check, main level or fallback level) and the grading result, and returns the next step. The options are: next module; show this fallback (re-explanation, simpler question, or both, in the order the PRD gives); or "go back through the material."

PRD ref: `prd.md > Fallbacks after a wrong answer`.

### Player
Svelte components under `src/app/player/`. Implements `prd.md > Course overview and progress`, `prd.md > Modules and checks`, `prd.md > Fallbacks after a wrong answer`.
- **Name entry** (`NameEntry.svelte`): course title and a name field.
- **Lesson intro** (`LessonIntro.svelte`): the outcomes, then `LessonOutline.svelte` (every module with passed / skipped / here / locked), then Start or Continue. `ModuleView`'s **Contents** button shows the same outline in a `<dialog>`. Which modules can be opened is `isReached()` in `progress.ts`.
- **Course overview** (`CourseOverview.svelte`): modules with progress and the **Continue** button. It shows a "not yet reviewed" badge on a lesson when the owner has switched those on. With no visible lessons, it shows "Nothing is ready in this course yet."
- **Module view** (`ModuleView.svelte`): the reading, then the check, then any fallback (`Fallback.svelte`), moving forward one module at a time. **Back** returns to the previous module, where a finished check shows its right answer, locked. `Player.svelte` adds a browser history entry for each module (same address, different `history.state`), so the browser's Back button steps through the same modules.
- **Check components** under `checks/`, one per type:
  - `Select.svelte`, `NumberInput.svelte` and `Categorize.svelte` are the stats PoC.
  - `PredictSimulate.svelte` wraps the sampling simulation (`SamplingSim.svelte`). The student commits to a prediction, then the simulation unlocks. The simulation draws many samples of size n from a population with proportion p and plots the p̂ values. The lesson sets p, the sample sizes and the prediction question. The model configures the simulation and never writes code for it.
  - `PredictOutput.svelte` and `TraceTable.svelte` are for the CLRS course and come after the stats loop works.

### Progress and event queue
`src/app/lib/progress.ts` and `src/app/lib/eventQueue.ts`. Implements `prd.md > Offline`, `prd.md > Course overview and progress`.
- Progress is kept in `localStorage` per course and student name: modules passed, modules skipped, and how far they got. The rules (pass, skip, complete, where Continue opens) are pure functions in `progress.ts`, tested in `tests/progress.test.ts`.
- Every action adds an event to a queue in `localStorage`. The queue is sent to `POST /api/events` in batches when the app starts, when the browser reports it's back online, and every 30 seconds while online. Events are removed from the queue only after the Worker confirms it saved them. Each event carries an id made in the browser, so sending one twice doesn't save it twice.
- A random device id, made once and kept in `localStorage`, goes with each event. The per-student view can then tell apart two students with the same name on different devices.

### Offline support
`vite-plugin-pwa` configured in `vite.config.ts`. Implements `prd.md > Offline`.
- The service worker stores the app files, fonts and KaTeX when the app first loads.
- Course responses (`GET /api/courses/*`) are fetched fresh when online and kept for offline use, so a course that's been opened once works without a connection. The response carries every visible lesson in full, so the student doesn't need to open each lesson online first.
- The app asks the browser to keep its storage (`navigator.storage.persist()`), so the saved copy isn't cleared when the phone runs low on space. If the browser says no, it still works; the copy can just be cleared sooner.
- Nothing on the author side works offline, and it doesn't need to.

### Author gate
`src/worker/auth.ts`. Implements `prd.md > States and Boundaries > Who can do what`.
- First choice: **Cloudflare Access** on `/author/*` and `/api/author/*`, with the Worker also checking the `cf-access-jwt-assertion` token using jose (the audience and issuer from Cloudflare's docs). No login code to write.
- Fallback if Access can't cover only those paths on a `workers.dev` address: an **author passphrase**, kept as the Worker secret `AUTHOR_PASSPHRASE`. The author types it once, and the browser keeps it in `localStorage` and sends it as a header. It's enough for one owner, but weaker than Access.
- If `AUTHOR_PASSPHRASE` isn't set, the author side is open on localhost only and closed (503) everywhere else, so a deploy that forgot the secret fails closed. Once it's set, it's required locally too. (Built in slice 4 as the passphrase version; Access is still the later option.)

### Authoring session
`src/app/author/Session.svelte` with the Worker routes `sources`, `draft` and `revise`. Implements `prd.md > Authoring session`. It's deliberately simple until the baseline lessons shape it.
- **Pick the pages:** a file picker for the PDF and a page range. The browser cuts the pages with pdf-lib (`src/app/lib/pdfPages.ts`) and uploads them.
- **Draft:** one button. Progress streams in while Claude works, then the lesson appears as a list of modules.
- **Shape it:** each check shows its alternatives, so the author can pick one. Each wrong answer shows its misconception with a source label ("catalogue: [reference]" or "model's guess") and its fallback, with on/off switches for the re-explanation and the simpler question. Each part has a text box for "tell the tool what to change," which calls `revise` for that part only.
- **Preview:** open the lesson in the player as a student would get it.
- **What persists:** the lesson JSON in D1 after every accepted change. Closing the tab loses only a draft or revision that's still streaming.

### Claude calls
`src/worker/claude.ts`. Implements `prd.md > Authoring session`.
- **Draft:** a system prompt with the lesson rules (short modules, frequent checks, split prose instead of trivial checks, only the supported check types, a fallback for each wrong answer, a general fallback per check, every symbol defined where it's used and restated at each formula, and checks that ask why as well as what). Then the lesson JSON Schema as the structured output format, the misconception catalogue, and the cut pages by file id. It streams, with effort `high`.
- **Revise:** the current part of the lesson, the author's instruction, and the JSON Schema for just that part. Effort `medium`.
- The system prompt and schema come first and are marked for prompt caching, so repeated calls on the same section cost less.
- The Worker checks every response against the Zod schema before saving. On a failed check it retries once, sending the error back to Claude. After that it shows the error to the author.
- The model comes from `DRAFT_MODEL`.

### Misconception catalogues
`catalogues/sampling-distributions.json`. Implements the Sep 25 research finding in `prd.md > Authoring session`.
- A short list of known misconceptions about sampling distributions and standard error, each with a plain description and a reference to where it was published. It gets written during the build from published sources, and Isaac checks it. The tool prompt includes it, and the tool marks anything it adds as its own guess.

### Lesson review and sign-off
`src/app/author/Review.svelte` and `POST /api/author/lessons/:id/signoff`. Implements `prd.md > Review and sign-off`.
- The whole lesson in order, with every wrong answer's fallback expanded, so the author reads each branch.
- A **Sign off** button, and the mark ("reviewed by a person" or "written by the model, not yet reviewed") next to each lesson in the author's list.
- A per-course switch, **Show unreviewed lessons to students**, saved on the course in D1.

### Per-student view
`src/app/author/Students.svelte` and `StudentLog.svelte`. Implements `prd.md > Per-student view`.
- The student list: name, device (shortened), last seen, and lessons touched.
- One student's log in time order: module entered, answer given, right or wrong, misconception hit, fallback shown, time since the previous event. Offline events sort by the time the browser recorded them, not the time they arrived.
- An empty course shows "No students have opened this course yet."

### Worker API
`src/worker/index.ts` sends each path to a small handler in `src/worker/routes/`.

| Method and path | Who | Does |
|---|---|---|
| `GET /api/courses/:slug` | anyone | course and every visible lesson in full, in one response, so one visit is enough to cache the whole course |
| `POST /api/events` | anyone | save a batch of events, ignoring ids already saved |
| `POST /api/author/sources` | author | upload cut pages to the Files API, save the file id |
| `POST /api/author/lessons` | author | create a lesson for a source |
| `POST /api/author/lessons/:id/draft` | author | stream a draft, save it as `unreviewed` |
| `POST /api/author/lessons/:id/revise` | author | revise one part, save the lesson |
| `PUT /api/author/lessons/:id` | author | save the author's own edits (switches, picks) |
| `GET /api/author/courses` | author | every course with its lessons and marks (no content), for the author home |
| `GET /api/author/lessons/:id` | author | one lesson in full, any status, for the review screen |
| `POST /api/author/lessons/:id/signoff` | author | mark as reviewed |
| `PUT /api/author/courses/:id` | author | the "show unreviewed" switch |
| `GET /api/author/courses/:id/students` | author | the student list |
| `GET /api/author/courses/:id/students/:key/events` | author | one student's log |

### Baseline lesson import
`scripts/import-lesson.ts`. The hand-written lessons (4.1 and 4.3) are written as lesson JSON in `content/`, checked against the schema, and loaded into D1 with this script. The same path loads the CLRS course. The scoping notes' idea of "publishing as course JSON" becomes this import, because lessons live in D1 (see `Decisions and Open Issues`).

## Data Model
D1 tables, created by `migrations/0001_init.sql`:

- **courses**: `id`, `slug`, `title`, `show_unreviewed` (0 or 1).
- **sources**: `id`, `course_id`, `title`, `pages` (for example "OpenIntro 4th ed., pp. 170–181"), `anthropic_file_id`, `created_at`.
- **lessons**: `id`, `course_id`, `source_id` (empty for imported lessons), `position`, `title`, `status` (`unreviewed` or `reviewed`), `content` (the lesson JSON), `updated_at`, `signed_off_at`.
- **events**: `id` (made in the browser), `course_id`, `lesson_id`, `student_name`, `device_id`, `type`, `payload` (JSON), `client_time`, `received_at`. There's an index on `(course_id, student_name, device_id, client_time)`.

Event types: `lesson.started`, `module.entered`, `check.answered` (answer, result, which wrong answer, main or fallback level), `fallback.shown` (re-explanation or simpler question), `material.suggested`, `module.skipped`, `sim.run` (sample size), `lesson.completed`.

Where each piece of data lives:

| Data | Lives in | Updated when | After leaving and coming back |
|---|---|---|---|
| Lessons and courses | D1, and the service worker's copy for students | the author saves, revises or signs off | the student gets the fresh copy when online, and the saved copy offline |
| Student progress | `localStorage`, per course and name | each module done | the same name on the same device picks up where it stopped |
| Unsent events | `localStorage` queue | each action, removed once saved | still waiting, and sent at the next chance |
| Saved events | D1 | each batch arrives | permanent |
| Device id | `localStorage` | once | the same until the browser's storage is cleared |
| Author passphrase (only if used) | `localStorage` on the author's laptop | typed once | stays |
| The book PDF | the author's laptop only | never uploaded whole | stays on the laptop |
| Cut pages | Anthropic Files API, by file id in D1 | once per section | reused for every draft and revision |

## File Structure

```
acu-primer/
├── package.json             # scripts: dev, build, deploy, test, db:migrate:local, db:migrate:remote
├── vite.config.ts           # Svelte, Cloudflare and PWA plugins
├── svelte.config.js
├── tsconfig.json
├── wrangler.jsonc           # Worker name, D1 binding (DB), DRAFT_MODEL, assets (SPA, /api/* goes to the Worker)
├── .dev.vars.example        # names of local secrets, no values
├── README.md                # what it is, how to run it, how to deploy
├── index.html               # the one page Vite builds from
├── migrations/
│   └── 0001_init.sql        # courses, sources, lessons, events
├── catalogues/
│   └── sampling-distributions.json   # published misconceptions with references
├── content/                 # hand-written lesson JSON (the CLRS baseline), imported into D1
├── scripts/
│   └── import-lesson.ts     # check a lesson file against the schema and load it into D1
├── src/
│   ├── shared/              # used by both the Worker and the app
│   │   ├── lesson.ts        # the lesson schema (Zod) and its types
│   │   ├── grading.ts       # answer → right / known wrong / unplanned
│   │   ├── flow.ts          # what comes after an answer, including fallback levels
│   │   └── events.ts        # event types
│   ├── worker/
│   │   ├── index.ts         # entry point, sends /api/* paths to routes
│   │   ├── auth.ts          # the author gate
│   │   ├── claude.ts        # draft and revise calls, prompts, schema checks
│   │   ├── db.ts            # small helpers around D1 queries
│   │   └── routes/          # courses.ts, events.ts, author.ts
│   └── app/
│       ├── main.ts          # starts the Svelte app, registers the service worker
│       ├── App.svelte       # picks the screen from the address
│       ├── router.svelte.ts # a small address-to-screen router
│       ├── theme.css        # colors, fonts, motion for both modes
│       ├── lib/
│       │   ├── api.ts       # fetch helpers for /api/*
│       │   ├── progress.ts  # localStorage progress
│       │   ├── eventQueue.ts# queued events, sending, retries
│       │   ├── pdfPages.ts  # cut a page range out of a PDF (pdf-lib)
│       │   ├── theme.ts     # the saved light/dark choice
│       │   └── math.ts      # KaTeX rendering
│       ├── player/
│       │   ├── Player.svelte       # one course for one student; screens and history
│       │   ├── ThemeSwitch.svelte  # Auto / Light / Dark
│       │   ├── LessonIntro.svelte  # outcomes and the module list
│       │   ├── LessonOutline.svelte # module list, shared with Contents
│       │   ├── NameEntry.svelte
│       │   ├── CourseOverview.svelte
│       │   ├── ModuleView.svelte
│       │   ├── Fallback.svelte
│       │   └── checks/      # Select, NumberInput, Categorize, PredictSimulate + SamplingSim,
│       │                    # PredictOutput, TraceTable
│       └── author/
│           ├── AuthorHome.svelte   # courses, lessons and their marks
│           ├── Session.svelte      # the authoring session
│           ├── Review.svelte       # every branch, sign-off, the show-unreviewed switch
│           ├── Students.svelte
│           └── StudentLog.svelte
├── tests/
│   ├── grading.test.ts
│   ├── flow.test.ts
│   └── lesson.test.ts       # the schema accepts good lessons, rejects third-level fallbacks
└── devpost/                 # planning docs (learner-profile.md stays out of git)
```

The CLRS PDF is never in this tree. `.gitignore` already blocks every `*.pdf`.

## External Services and Dependencies

**Anthropic Messages API** (through `@anthropic-ai/sdk`)
- `POST /v1/messages` with `model` from `DRAFT_MODEL`, a system prompt, `output_config.format` set to the lesson JSON Schema, `output_config.effort`, and the user content: a `document` block pointing at the file id, then text. Draft calls stream; revise calls can too.
- The response is JSON text matching the schema. The Worker parses it and checks it with Zod. It checks `stop_reason` first: `refusal` or `max_tokens` means "show the author an error," not "save."
- Key: `ANTHROPIC_API_KEY`, a Worker secret. Cost: Opus 5.5 at $4 / $20 per million input / output tokens. A 10-page section is about 15,000–30,000 input tokens, and a lesson draft maybe 8,000–15,000 output tokens, so roughly $0.30–$0.60 per draft, counting thinking tokens, which are billed as output. These are estimates, to check against `usage` in the first real call.
- Docs: https://docs.claude.com/en/api/messages, structured outputs https://docs.claude.com/en/docs/build-with-claude/structured-outputs, PDF support https://docs.claude.com/en/docs/build-with-claude/pdf-support. Limits: 32 MB per request, 600 pages.

**Anthropic Files API**
- `POST /v1/files` with the cut PDF, returning a file id that later messages reference. It saves sending the same pages again on every call.
- Docs: https://docs.claude.com/en/docs/build-with-claude/files

**Cloudflare Workers, D1, static assets** (free plan)
- Limits that matter: 10 ms of CPU per request (waiting on Claude doesn't count), 100,000 requests a day (static files don't count), and D1 at 5 million rows read and 100,000 written a day. Events go in batches.
- Docs: https://developers.cloudflare.com/workers/platform/limits/, https://developers.cloudflare.com/d1/platform/limits/

**Cloudflare Access** (free for small teams)
- Set up once in the dashboard. The Worker verifies the `cf-access-jwt-assertion` header against `https://<team>.cloudflareaccess.com/cdn-cgi/access/certs`, checking audience and issuer.
- Docs: https://developers.cloudflare.com/cloudflare-one/identity/authorization-cookie/validating-json/

## Important Failure Modes
- **Claude returns something that doesn't fit the schema, or refuses** → the Worker retries once with the error. If that fails, the author sees "The draft didn't come back in a usable form," with a **Try again** button. Nothing half-valid is saved.
- **The Worker runs out of CPU time** (10 ms on the free plan), most likely when handling the uploaded pages or checking a large lesson → the author sees an error for that step. The fix is to upload pages once (already the design), keep the Worker streaming bodies through rather than copying them, and if it still happens, move to the $5 a month Workers plan. The first build steps measure this.
- **A draft takes minutes and the tab closes** → that draft is lost, and the author starts it again. The progress stream shows it's working. If drafts routinely take several minutes, Cloudflare Workflows is the fix, and it's listed as later work.
- **The student is offline on a course they never opened** → the app shows "Open this course once with a connection, then it works offline."
- **Events can't be sent** → they stay in the queue. The student sees nothing different.

## What Was Simplified and Why
- **Only the cut pages are uploaded, not the whole book, and there's no R2** instead of storing books in Cloudflare R2. It keeps the PDF on the laptop and avoids the question of whether R2 needs a card on file. The fuller version would store each book once in R2 and cut pages on the server.
- **A typed name plus a device id** instead of student accounts. That's what the PRD asks for. Accounts would need login, passwords and a way to move progress between devices.
- **One simulation, hand-built and configured by the lesson,** instead of simulation code the model writes. It's safer and can be checked. Model-written widgets would need sandboxing.
- **Model switch by hand** (`DRAFT_MODEL`) instead of automatic routing between Opus 5.5 and Sonnet 5. A setting is enough for one author.
- **Lessons are one JSON document per row** instead of a table per module or check. One lesson is always read and written whole, so splitting it into tables adds work and no benefit.
- **Tests only for the pure logic** (grading, flow, schema). The screens are checked by hand against the PRD's acceptance criteria. A browser test suite would take time the PoC doesn't have.

## Decisions and Open Issues

**Decisions Isaac made**
- **Svelte 5 with Vite, no SvelteKit.** It reads like templates, close to Django, and it's small for cheap phones. Accepted tradeoff: agents know React better.
- **Claude Opus 5.5 for drafting, with Sonnet 5 as a manual backup** for heavy processing.
- **Send the section's pages as a PDF** instead of extracted text. Formulas and figures survive, and it costs more tokens per page.
- Carried from the scoping notes: all on Cloudflare in TypeScript, deployed to a link, with Access (or a passphrase) as the only author login.

**Implementation details that follow from those choices** (my calls, open to change)
- Lessons live in D1 and are served by the Worker, not as static files (see the question below).
- Pages go to the Files API once, and drafts refer to them by id.
- The service worker comes from vite-plugin-pwa, and progress and events use `localStorage`.
- A device id goes with every event.
- Structured outputs plus a Zod check, with one retry.

**A question worth understanding: where do published lessons live?**
The Cloudflare explainer says course JSON is served as static files, "so no Worker code runs." That's true for files that exist when you deploy. But the authoring tool creates and signs off lessons while the app is running, and static files can only change with a new deploy. So in this design, lessons live in D1, and the Worker serves them at `GET /api/courses/:slug`. Offline still works, because the service worker keeps a copy of that response like any other file. The cost is that each course load runs a little Worker code (one D1 read, well within the free limits). The hand-written lessons go in through the same door, via the import script. At review, Isaac asked: **if the lessons are in D1, is offline still possible?** Yes. The browser never talks to D1. It only sees the response from `GET /api/courses/:slug`, which is plain JSON, the same as a static file would be. On the first online visit, the service worker saves that response. Offline, the app asks for the same address, the service worker sees there's no network, and it hands back the saved copy. D1 isn't involved at all. Three consequences follow, and the design handles each:
- The course has to be opened once online. That's already in `prd.md > States and Boundaries`.
- The response includes every visible lesson in full, so opening the course once caches all of it, not only the lessons the student clicked.
- A lesson signed off or edited after the student's last online visit shows up at their next online visit. Until then they see the version they have.
The build checks this directly: load the course, turn the network off, reload, and play every module (`prd.md > Offline`).

**Open issues**
- **Access on workers.dev.** Cloudflare's docs say Access can protect a `workers.dev` address, but it may protect the whole address, which would lock students out too. Check it in the first build steps. If it can't cover only the author paths, use the passphrase fallback (or a custom domain, if Isaac has one on Cloudflare).
- **Worker CPU time with PDF uploads.** Measure it in the step that builds uploading.
- **The authoring flow's steps** (from `prd.md > Open Questions`): decided after the hand-written baseline. The session design above is the minimum.
- **What counts as a "simpler question"** (from `prd.md > Open Questions`): the tool proposes, and the author edits. Revisit after the first draft.
- **How long a draft takes** (from `prd.md > Open Questions`): measured on the first real draft.
- **OpenIntro's exact section and pages:** check on download, since the scoping notes give the 4th-edition numbers from memory.
- **Devpost disclosure:** if the baseline lessons or the lesson format borrow from pre-Sep-22 work, say so in the submission (for `6-ship`).
