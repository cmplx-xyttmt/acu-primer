# acu-primer

A course-authoring tool and the lesson player that runs what it makes. A course author turns a
textbook section into short, interactive lessons that change course when a student gets
something wrong, and every lesson shows whether a person has checked it.

Built for Devpost's Build With AI: Basics. Planning documents are in `devpost/` (start with
`devpost/index.html`, which lists them all; the skill pack's scope, PRD and spec are
`devpost/scope.md`, `devpost/prd.md` and `devpost/spec.md`).

- Live: https://acu-primer.cmplxxyttmt.workers.dev
- Demo video: https://youtu.be/1NpsG322lKY

## How it fits together

A **subject** (usually a book) has **chapters**, a chapter has **lessons** (usually one per
section), and a lesson has **modules**: one screen each, with a short reading and at most one
check (pick an answer, type a number, or sort items into groups). Some modules have an
exploration first, where the student predicts what happens and then tries it.

Each wrong answer the lesson plans for has its own help: a re-explanation aimed at that
misconception, a simpler question, or both. After two levels of help, the student is pointed
back to the reading and can skip for now. Every answer goes to the author's log, so they can
follow one student's path through a chapter.

Students need no account, only a name. Chapters they've opened keep working offline, and their
answers queue up until the connection is back.

## How Claude is used

Claude drafts; a person decides what students see.

- **Start from a book.** The author picks a PDF. The browser reads its bookmarks (pdf-lib) and
  proposes a chapter per book chapter and a lesson per section. When the bookmarks don't list
  sections, Claude reads the table of contents from a few pages (low effort, about $0.20 to
  $0.50). The PDF stays in the browser.
- **Drafting a lesson.** The browser cuts the section's pages out of the PDF and uploads only
  those (Anthropic Files API). One call to `claude-opus-5-5` at high effort gets the pages, the
  subject's learner brief, and, for sampling distributions, a catalogue of known
  misconceptions (`catalogues/`). A draft takes 5 to 10 minutes and costs about $1 to $1.30.
- **A format Claude can fill in reliably.** The lesson schema is too big for structured outputs,
  so Claude writes a flatter wire format (`src/shared/wire.ts`), which is converted to the
  lesson schema (`src/shared/lesson.ts`) and then checked by code (`src/shared/lessonChecks.ts`:
  every wrong answer points at a real option and never at the right one, an exploration's
  formula gives a number for every setting, and so on). If anything fails, Claude sees its reply and the problems once and tries again. Nothing
  half-valid is saved.
- **Review by playing.** A draft is saved as unreviewed. The author plays each module down every
  path (the right answer, each planned wrong answer, any other answer), approves it or pins a
  suggestion to a part, and signs off. "Apply with Claude" revises one module from the open
  suggestions (medium effort), and the changed parts need approving again. Students only see
  signed-off lessons, unless the author turns on "show unreviewed" for a chapter.
- **Spend.** Every call's tokens and cost go to a `spend` table, the author screens show the
  month's total, and calls stop once it reaches `MONTHLY_BUDGET_USD` (15 by default, in
  `wrangler.jsonc`).

The code for the calls is in `src/worker/claude.ts` and `src/worker/routes/drafting.ts`.

## Run it locally

You need Node 20 or newer.

```sh
npm install
npm run db:migrate:local                             # create the local D1 tables
npm run import:local -- content/openintro-sampling   # the statistics chapter and its subject
npm run import:local -- content/erickson             # the algorithms subject (13 chapters, Tower of Hanoi)
npm run dev                                          # http://localhost:5173
```

The home page at http://localhost:5173 lists subjects; the statistics chapter plays at
http://localhost:5173/s/openintro-statistics/openintro-sampling. The author side (drafting,
review, sign-off, the student log) is at http://localhost:5173/author. Locally it's open until
you set `AUTHOR_PASSPHRASE` in `.dev.vars`; after that it asks for it.

Drafting needs a Claude API key in `.dev.vars` as `CLAUDE_API_KEY` (or `ANTHROPIC_API_KEY`; see
`.dev.vars.example`). To try the drafting screens without a key or any cost, run
`npm run dev:fake` instead of `npm run dev` (or `npm run dev:fake-failures`, where every second
draft fails). Each fake draft takes about 12 seconds and saves a copy of the sample lesson
titled "[Fake] …". Fake drafting only works on localhost.

## Moving a subject from the app into git

Lessons drafted in the app live in the database. To keep a subject in git, or load it on the
live site, export it: every chapter with its outline (the sections still to draft) and every
lesson.

```sh
npm run export:subject -- algorithms-by-jeff-erickson content/erickson   # from the local database
npm run import:remote -- content/erickson
```

Sign the lessons off first: each keeps the status it has locally. A signed-off lesson also has
a "Download the lesson file" link on its review screen.

## Try it offline

The service worker only runs in a build, not in `npm run dev`. Run `npm run preview` (or use the
deployed link), open a chapter once, then go offline (DevTools > Network > Offline, or turn the
wifi off) and reload: the chapter, fonts and formulas still work, and answers queue up until the
connection is back.

## Check it

```sh
npm test       # unit tests: lesson schema, grading, flow, review paths, book plans, events
npm run check  # TypeScript and Svelte checks (plain `tsc` misses the Worker and .svelte files)
```

## Deploy

It runs on Cloudflare Workers with a D1 database. The order matters when the database already
exists: apply the migrations and deploy straight after, because the old Worker and the new
tables don't work together.

```sh
npx wrangler login
npx wrangler d1 create acu-primer          # once; put the database_id in wrangler.jsonc
npx wrangler d1 migrations list acu-primer --remote
npm run db:migrate:remote
npm run deploy
npm run import:remote -- content/openintro-sampling
npm run import:remote -- content/erickson
npx wrangler secret put CLAUDE_API_KEY
npx wrangler secret put AUTHOR_PASSPHRASE
```

The first load after a deploy can show the previous version (the service worker updates on
that load); reload once.

## Where things are

- `src/app/`: the Svelte app. `player/` is the student side, `author/` the author side.
- `src/worker/`: the Worker. `routes/` has the API, `claude.ts` the Claude calls, `db.ts` the
  D1 queries.
- `src/shared/`: code both sides use: the lesson schema, grading, the fallback flow, the review
  rules, book plans.
- `content/`: lessons kept in git, one folder per chapter. `migrations/`: the D1 tables.
- `.claude/skills/`: `draft-lesson` and `revise-lesson`, the same drafting rules as a Claude Code
  session. `.agents/skills/`: the Devpost skill pack used to plan and build this.

## Licenses

- The code is MIT (`LICENSE`). The Devpost skill pack in `.agents/skills/` is MIT too, with its
  own notice.
- `content/openintro-sampling/` is based on *OpenIntro Statistics*, 4th ed., by Diez,
  Çetinkaya-Rundel and Barr (https://www.openintro.org/book/os/), and is licensed CC BY-SA 3.0
  like its source. It isn't an OpenIntro product.
- `content/erickson/` is based on *Algorithms* by Jeff Erickson
  (https://jeffe.cs.illinois.edu/teaching/algorithms/), and is licensed CC BY 4.0 like its
  source.
