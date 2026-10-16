---
name: revise-lesson
description: Apply the author's open review suggestions to an acu-primer lesson, in this Claude Code session, following the same rules and checks as drafting. Use when Isaac says to revise a lesson, apply his suggestions or review comments, or runs /revise-lesson after reviewing at /author.
---

# revise-lesson

The author reviews a lesson step by step at `/author` and pins suggestions to parts of it (the
reading, the check, its explanation, one wrong answer's hint, the general fallback, the
alternatives, or the outcomes). This skill applies them. Until there's an API key (slice 3b),
this session is the tool; later the review screen will call Claude for the same job.

## Steps

1. **Which database?** Suggestions made on the live site are in the remote database, local ones
   in the local one. If Isaac didn't say, check both:
   `npx tsx scripts/suggestions.ts list --remote` and `npx tsx scripts/suggestions.ts list --local`.
   Add a lesson id to narrow it down.
2. **Read what each suggestion is about.** The list gives the lesson file, the step (a module id,
   or `_outcomes`) and the part, as a path into that module: `reading`, `check`,
   `check.explanation`, `check.wrongAnswers.<n>` (zero-based), `check.generalFallback`,
   `check.alternatives`, or `outcomes`.
3. **Edit only those parts** of the lesson file in `content/<course>/`. Follow `DRAFT_RULES` in
   `src/worker/claude.ts`, just as when drafting. Keep everything else byte-for-byte the same: an
   approval is tied to its module's exact content, so touching an unrelated module throws away
   the author's approval of it. If a suggestion needs a change elsewhere (a symbol renamed in two
   modules), make it, and say so in the note.
4. **If a suggestion is unclear, or asks for something the rules forbid**, don't guess. Leave it
   open and tell Isaac what you need.
5. **Check:** `npx tsx scripts/check-lesson.ts <file>`. Fix what it reports.
6. **Import** to the same database the suggestions came from:
   `npm run import:local -- content/<course>` or `npm run import:remote -- content/<course>`.
   Changed content sets the lesson back to unreviewed, and only the changed modules lose their
   approval.
7. **Resolve each one you applied** with a short note on what changed, which the author sees under
   the suggestion: `npx tsx scripts/suggestions.ts resolve [--local|--remote] <id> "<what changed>"`.
8. **Report** in a few lines: what changed for each suggestion, any left open and why, and the link
   to look again (`/author/lessons/<id>`, the remote or local address).

## Don'ts

- Don't mark a lesson reviewed or approve steps. That's the author's.
- Don't resolve a suggestion you didn't apply. Leave it open with a reason.
