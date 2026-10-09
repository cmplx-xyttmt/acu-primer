---
name: draft-lesson
description: Draft an acu-primer lesson from pages of a book or a reading, in this Claude Code session, using the same rules and checks the app will use with the API. Use when Isaac asks to draft, write or generate a lesson from a PDF, a book section or a reading (for example a Sprites ladder reading), or says "run the pipeline" on some pages.
---

# draft-lesson

The in-app **Draft** button (slice 3b) calls the Claude API and needs an API key. Until then,
this session does the same job: same rules, same checks, same import. The lesson lands as
**unreviewed**; a person signs it off before students see it as reviewed.

## What you need from Isaac

Ask only for what's missing, in one message:

- the PDF (or other source) and the pages, as the PDF viewer numbers them;
- the section number and title;
- which course it goes in (an existing folder in `content/`, or a new slug and title).

Known books: `~/Projects/curriculum-edtech/OpenIntro Statistics 4th ed.pdf` (section 5.1 is
PDF pages 170-180) and `~/Projects/curriculum-edtech/Cormen Introduction to Algorithms.pdf`.
Book PDFs never go in this repo.

## Steps

1. **Cut the pages.** `npx tsx scripts/cut-pages.ts "<pdf>" <pages>` writes a small PDF under
   `content/drafts/pages/` (gitignored). Read that file with the Read tool (use `pages` for
   more than 10 pages). For a web reading, save its text under `content/drafts/` instead.
2. **Read the rules.** `DRAFT_RULES` in `src/worker/claude.ts` is the system prompt the app sends
   to the API. Follow it exactly; it's the single source of truth. Read the schema in
   `src/shared/lesson.ts`.
3. **Read the misconception catalogue** for the topic in `catalogues/` if there is one. Label a
   misconception `{"kind": "catalogue", "reference": ...}` only when it comes from an entry there,
   copying the entry's `reference`; everything else is `{"kind": "model"}`. If there's no
   catalogue for the topic, say so in the report.
4. **Write the lesson** to `content/<course>/<section>-<short-name>.json`. Outcomes first, then the
   modules. Lesson id: `<course>-<section>-draft`. Source: the book and the section with its pages.
   Write in your own words; don't copy passages from the source. For OpenIntro (CC BY-SA), the
   source field is the attribution.
5. **Check it.** `npx tsx scripts/check-lesson.ts <file>`. Fix what it reports and check again. If
   it still fails after two rounds of fixes, stop and show Isaac the problems instead of looping.
6. **Add it to the course.** Add an entry to `content/<course>/course.json` with `"status":
   "unreviewed"` and the next `position`. Students won't see it until Isaac signs it off at
   `/author`, or switches on **Show unreviewed lessons to students** for the course there.
7. **Import it locally.** `npm run import:local -- content/<course>`. Remote only if Isaac asks
   (`npm run import:remote -- content/<course>`).
8. **Report**, briefly: the outcomes; modules and checks; how many wrong answers came from the
   catalogue and how many are your guesses; anything in the source you left out and why; and what
   Isaac should look at first when reviewing (the hardest maths, the guesses, any check you're unsure
   of). Then the links: `http://localhost:5173/author` to review and sign off, and
   `http://localhost:5173/c/<course>` for the player.

## Don'ts

- Don't mark a lesson `reviewed`. Only Isaac signs off.
- Don't loosen `DRAFT_RULES` or the checks to make a draft pass. If a rule looks wrong, say so;
  changing it is Isaac's call, and it changes what the app's API drafts will do too.
