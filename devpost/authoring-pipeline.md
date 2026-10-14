# Authoring pipeline: ideas for later

Not part of the proof of concept. Written Oct 9, 2026, after Isaac played the slice 1 fixture
lesson and found it easy to pass but thin. The POC plan drafts a lesson in one Claude call
(slice 3), lets the author revise parts (slice 6), and asks for one human sign-off (slice 4).
The ideas below go around that plan once the loop works.

## What prompted this

The 5.1 fixture (six modules, hand-written by Claude as test data, not by the authoring tool)
had two problems a student found in one pass:

- Every check was recall or plug-in arithmetic. Nothing asked *why*, so passing didn't mean
  understanding.
- Symbols weren't defined where they were used. At the standard error formula it wasn't clear
  why the formula has $p$ and not $\hat{p}$, or whether $n$ is the sample or the population.
  The check then gave $p = 0.88$ right after saying $p$ is unknown.

## Steps to add

1. **Outline first.** Learning goals, prerequisites and the symbols the section uses, approved
   by the author before any modules are written. Cheap, and it shows early if a draft covers
   only part of the section.
2. **Checks done by code, not by a model.**
   - Recompute every numeric answer.
   - Confirm each known wrong answer can be typed at the rounding the question asks for (the
     fixture's "forgot the square root" range can't be, see R12 in `slice1-test-checklist.html`).
   - Flag any symbol used before it is defined.
3. **Simulated students at different levels.** A novice, one student per catalogued
   misconception, and a strong student. Signals:
   - everyone passes a check → it's too easy;
   - the misconception student doesn't pick that misconception's wrong answer → the trap is
     badly written;
   - the novice gets lost in a module → the reading is unclear.
4. **A teaching reviewer.** The mix of recall, apply and explain questions, and whether the
   lesson covers what the section covers.
5. **Human sign-off with a report.** The author gets what steps 2–4 flagged, so careful reading
   goes where it's needed instead of spreading evenly over every branch.
6. **Later, from real students.** The event log (slice 5) shows which checks and fallbacks fail
   in practice. That's the evidence simulated students can't give.

## A limit to keep in mind

Models are poor at predicting which mistakes real students make (Feng et al. 2024, already in
`prd.md > Authoring session`). Simulated students are good at finding unclear text and checks
that are too easy. They shouldn't be trusted to discover new misconceptions, so each persona
starts from a catalogued one.

## Cost (estimates, to check against real `usage` in slice 3)

| Step | Model | Rough cost per lesson |
|---|---|---|
| Draft | Opus 5.5 | $0.30–0.60 (spec estimate) |
| Outline | Opus 5.5 | small, a fraction of the draft |
| Code checks | none | free |
| 3–4 simulated students, ~15k in / 3k out each | Sonnet 5 | ~$0.25 together |
| Teaching reviewer | Opus 5.5 or Sonnet 5 | ~$0.10–0.40 |

About $1–2 per lesson for the full pass, so roughly 10–20 lessons a month inside the $25
budget. Prompt caching lowers this, since every student and reviewer reads the same lesson and
pages.

## Taken into the POC now

- Slice 2 rewrites the fixture: symbols defined at each formula, module 4's check uses $\hat{p}$,
  and at least one check asks for reasoning instead of recall.
- Slice 3's draft prompt gets two more rules: define every symbol where it is used (and restate it
  at each formula), and include checks that ask why, not only what.

## Dog-food findings: OSTEP processes course (Oct 13, 2026)

Isaac had a Claude Code session draft a course from his own study material with the
`draft-lesson` skill: `content/ostep-processes/`, four lessons from OSTEP chapters 4 and 6, with
Mac terminal commands as checks. All four passed `check-lesson.ts` first time. The rough edges
below came up while building it. Each is tagged with the slice it fits, so it can be picked up
in order.

### Before 3b (the in-app Draft button sends these rules)

1. **Make `DRAFT_RULES` subject-neutral.** Two rules only make sense for statistics: "say which
   quantity is from the sample and which is from the population", and "some recall, some apply a
   formula". OSTEP has no formulas, and Isaac wanted no recall checks at all. Suggested wording:
   "Define every term and symbol where it's first used", and "Mostly checks that ask the student
   to explain why, compare, predict or apply; recall at most a third."
2. **Add a course brief.** The reader is hard-coded ("first-year university students working
   alone, often on a phone"). Isaac's real brief (who he is, the five things he wants to be able
   to say, "I learn by doing, give me commands to run on my Mac") had nowhere to go. Proposal: a
   `brief` field in `course.json` (and the courses table), passed into the prompt next to the
   pages. The outcomes the author already knows could live there too, instead of the drafter
   inventing them.
3. **Say what happens without a catalogue.** There's no catalogue outside sampling
   distributions, so the whole OSTEP course is the model's guesses (40 of 40 wrong answers on
   main checks). `DraftRequest.catalogue` is required; make it optional and tell the prompt
   "no catalogue for this topic" explicitly.
4. **Vary the right answer's position.** The player shows options in file order, and nothing in
   the rules says to move the right answer around. The first OSTEP pass had option "a" right every
   time; it was fixed by hand before import. Better fix: shuffle options in the player (slice 4b
   or 6), so no draft can teach "always pick a".

### Lesson format (slice 8 is where new check and text types land)

5. **A "run this command" check.** Only `select` and `number` exist. The workaround: the reading
   says "run `echo $$` in two windows", and a `select` asks what it showed. That can't tell a
   misconception from "didn't run it", and it can't see the student's output.
6. **Inline code and the `$` clash.** `$` always starts math unless written `\$`, so `echo $$`
   has to be written `echo \$\$` (`\\$\\$` in JSON). There's no inline-code style either, so
   commands render in bold sans-serif. A backtick span that turns off math and uses the mono
   font would fix both.
7. **Source field for chapter-per-PDF books.** The convention "Section 5.1, pp. 170-180" assumes
   one big book PDF. OSTEP ships one PDF per chapter with its own page numbers, so the source
   became "Chapter 4 opening and sections 4.1-4.3, pp. 1-5". Consider `{book, chapter, sections,
   pages, url}`.

### Checks done by code (`lessonChecks.ts`)

8. **Rules that exist only on paper.** Nothing checks: reading at most about 150 words, 3 to 5
   outcomes, 3 or 4 options on a check, 1 or 2 alternatives, the share of explain / predict
   checks, or the right answer's position. A draft can break all of them and pass. The first
   three are one line each.

### The draft-lesson skill and its scripts

9. **URL sources.** `cut-pages.ts` wants a local book PDF, and the skill only knows "a book PDF"
   or "a reading's text". For OSTEP the session downloaded the chapter PDFs to its scratchpad by
   hand. A `--url` option on `cut-pages.ts` (download to `content/drafts/pages/`) would cover it.
10. **One lesson per section doesn't fit every book.** OSTEP 4.2 is half a page and 6.3 is five.
    The course was split into four lessons of about five pages each (4.1-4.3, 4.4-4.6, 6.1-6.2,
    6.3-6.5). The skill should say lessons follow coherent chunks of roughly N pages, not
    sections.
11. **Unreviewed lessons are invisible to the person who drafted them.** To play your own draft
    you have to sign off unread content or flip the switch. `course.json` supports
    `"showUnreviewed": true`; the skill should mention it for self-study courses.
12. **Small things.** The id convention `<course>-<section>-draft` doesn't say that dots become
    dashes. The importer silently ignores the `note` field in `course.json`. The skill allows two
    rounds of fixes, but the API path allows one retry, so session drafts and API drafts aren't
    held to quite the same standard.

### Content to review in the OSTEP course

- The Mac mappings aren't in the book: ps STAT letters to states (R covers running *and* ready),
  user/system time from `time`, voluntary/involuntary switches from `/usr/bin/time -l`, and `$?`.
  They're correct on macOS (checked on Isaac's Mac, Oct 13), but they break "stay with what the
  pages teach". Decide whether that rule should allow hands-on additions.
- Lesson 4 m3, the context switch and its two register saves: the densest part of chapter 6.
- Lesson 2 c2, the number check: the timing (I/O done after step 5, process 1 done in step 5) is
  invented, not the book's figure.
- Lesson 1 m4, "two runs don't share variables": inferred from "each process has its own address
  space". The book doesn't say it outright until the memory chapters.
