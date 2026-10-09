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
