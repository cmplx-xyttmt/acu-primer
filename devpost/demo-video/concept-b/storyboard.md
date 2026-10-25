# Concept B, final assets: a chapter becomes lessons, a book becomes a subject

**Update, Oct 23 evening: the video now uses Jeff Erickson's *Algorithms* (CC BY 4.0) as its example** (Isaac chose it over CLRS, which is copyrighted). The rough cut is `../media/concept-b/rough-cut.mp4` (2:54, no sound), built by `rough-cut.sh`; the shot list with points to cover and boxes for Isaac's words is `narration.html`. New pieces: `section-to-lesson.html` (the opener, from the real Erickson pages and the lesson drafted from them), and clips c08 (Start from a book and a real draft of section 1.3, Tower of Hanoi: 354 s, $1.08, two attempts), c09 (review by playing and sign-off), c10 (a student: a wrong sort and its hint, a wrong prediction in the stepper), c11 (the sampling exploration) and c12 (the log). The draft is in Isaac's local database as "Tower of Hanoi: Thinking Recursively", unreviewed; the sign-off on camera happened in a copy. Claude chose a sort check for the rules and a stepper exploration for the 3-disk algorithm; all 7 moves were checked against a simulated run. The sections below describe the Oct 22 version.

**Decided Oct 24 (Isaac): mark the switch to statistics.** In the rough cut, the sampling shot (2:19) follows the Tower of Hanoi student with no break, so it looks like part of the Algorithms course. Before it goes a short card in the opener's label style, "OpenIntro Statistics · CC BY-SA", and the shot starts on the statistics subject page for a second so the change of subject shows; the narration can say a second subject is shown.

**Update, Oct 25: the app clips are re-recorded in dark mode, and the rough cut is 3:09.** `record.cjs` now records every clip in dark mode (it sets `acu:theme` to dark and Playwright's color scheme). The clips in the rough cut were re-recorded against a copy of the local database: c08 (now `c08-book-to-draft`), c09, c10, c11 and c12. They show the current app: "Intro to Statistics", the rewritten "Draft lessons" screen with section checkboxes, the module counter with its spaces, and the "New here?" card on a first visit. In the copy, Tower of Hanoi was set back to unreviewed (outcomes, modules 1 and 3 and the sign-off cleared) so c09 could review and sign it off; the session draft of 5.1 was put back and shown to students, as on Oct 23; and the OSTEP and Web Performance subjects were removed, since neither book has an open license. The Oct 24 decision is in: a card, `subject-card.mp4` (from `subject-card.html`), reading "OpenIntro Statistics · CC BY-SA", then c11 opens on the statistics subject page for about two seconds. `narration.html` has the new shot times.

**The draft itself is still light footage, marked as a placeholder.** The new c08 stops with the cursor on Draft; no draft was run. In the rough cut, 0:50 to 1:17 is the Oct 23 draft (the light `c08-book-and-draft.mp4`), with a red "PLACEHOLDER" label drawn over it. When Isaac records one real draft on the live site in dark mode, put that file in `../media/concept-b/clips/` and replace the two `c08-book-and-draft.mp4` lines in `rough-cut.sh`. The motion pieces (the opener, `book-to-subject`, the end card) are still in the light look: they use the Oct 22 tokens in `base.css` and have no dark version, so they were left as they were. The light Oct 23 clips and rough cut are kept in `../media/concept-b/clips/light-oct23/` and `rough-cut-light-oct23.mp4`.

Made Oct 22, 2026, after slices 9 to 11. It follows the concept B storyboard in `../page-to-lesson/storyboard.md`, with Isaac's two changes. A chapter's pages turn into a lesson of modules, and at the end the whole book turns into a subject of chapters.

Everything here is a draft for Isaac to cut. Captions are bracketed placeholders and the narration is points to cover, because the `6-ship` rules say the words must be his.

## The files

The pages (`.html`) are in git. The videos are in `../media/concept-b/`, which is gitignored, and `index.html` plays them side by side.

| File | What it is | Length |
|---|---|---|
| `chapter-to-lessons.mp4` | The real OpenIntro 5.1 pages turn into the drafted lesson's ten modules. Module 2 opens into its paths (the right answer, each wrong answer with its hint, any other answer). Then the review ticks run down and "Draft" becomes "Reviewed by a person". | 20 s |
| `book-to-subject.mp4` | The cover, then the real contents page. The seven chapter titles lift out and become chapter cards under the OpenIntro Statistics subject. Chapter 5 shows "5.1 reviewed"; the rest are dashed "to draft" cards. | 13 s |
| `end-card.mp4` | The logo, the name, "Book → Lessons → Review → Students → Log", and a `[repo link]` slot. | 6 s |
| `clips/c01-home-to-chapter.mp4` | Home, the subject card, the subject page, the chapter, the name screen (Amina), the chapter overview. | 16 s |
| `clips/c02-review-play.mp4` | The author gate, then review by playing the drafted 5.1. Outcomes approved; module 1 played down every path (a wrong pick and its hint, the right answer, the other wrong answer, "any other answer"); module 2 with only the right answer, so approving asks once; then Sign off. Modules 3 to 10 were approved beforehand to keep it short. | 63 s |
| `clips/c03-student-wrong-right.mp4` | Amina plays that lesson: a wrong pick, the hint for that mistake, the simpler question, the original question again, green. | 30 s |
| `clips/c04-student-fails.mp4` | Dark mode. Module 1 right, then module 2: a wrong pick, the simpler question missed too, "go back through the material", Skip for now. | 32 s |
| `clips/c05-student-log.mp4` | The author's Students page, then Amina's path with every answer and hint. | 14 s |
| `clips/c06-offline.mp4` | The chapter opens once, the network goes off, it reloads and still plays and grades. | 18 s |
| `clips/c07-draft-screen.mp4` | The draft screen filled in, before Draft is pressed. The opening of shot 3. | 9 s |

How they were made: `render.cjs` renders the motion pages frame by frame; `record.cjs` drives the real app with Playwright at 1280x720 scaled 1.5x (so 1920x1080, with larger text), with a visible cursor. The recordings ran against a Worker on a copy of the local database, so the sign-off in c02 didn't touch Isaac's data, and the paid routes were blocked.

## Storyboard (about 2:45 before trimming)

| # | Time | Picture | Source | Caption (placeholder) |
|---|---|---|---|---|
| 1 | 0:00-0:20 | A chapter's pages become a lesson; one module opens into its paths; a person reviews it | `chapter-to-lessons.mp4` | [what a lecturer starts with, and what they get] |
| 2 | 0:20-0:30 | Isaac, or his voice over the end of shot 1: who it's for | camera | |
| 3 | 0:30-0:55 | The draft screen, then a real draft running: Claude thinking, the character count growing, Drafted with time and cost | `c07` + a new recording of one paid draft | [drafted with Claude from the PDF pages] |
| 4 | 0:55-1:25 | Review by playing: a wrong pick, its hint, the paths ticking, the ask, Sign off | `c02`, trimmed to about 30 s | [nothing reaches students until a person signs it off] |
| 5 | 1:25-1:35 | A student finds the subject and the chapter | `c01`, trimmed | |
| 6 | 1:35-1:55 | Wrong pick, the hint for that mistake, simpler question, right | `c03` | [help aimed at the mistake] |
| 7 | 1:55-2:05 | The hint doesn't land either: back to the material, Skip for now | `c04`, the module 2 part | |
| 8 | 2:05-2:15 | The author sees the student's path | `c05` | [and the author sees what happened] |
| 9 | 2:15-2:23 | Offline (optional, cut first) | `c06` | |
| 10 | 2:23-2:36 | The whole book becomes a subject | `book-to-subject.mp4` | [where it goes next] |
| 11 | 2:36-2:42 | End card | `end-card.mp4` | |

## Narration outline (points to cover, in Isaac's words)

1. Shot 1: what a lecturer has (a textbook) and what they want (short lessons they trust, that respond to mistakes).
2. Shot 2: who Isaac is and who it's for.
3. Shot 3: what goes to Claude (the PDF pages and the subject's learner brief), what comes back, and the checks it has to pass.
4. Shot 4: playing the lesson as a student to review it, and sign-off as the line between a draft and a lesson.
5. Shots 6 and 7: the student's side, and why it stops after two levels.
6. Shot 8: what the log tells the author.
7. Shot 10 and the end: the next step is a whole book.

## Still to do

- **Shot 3 needs one paid draft** (about $1.30 and 10 minutes, from the Oct 16 draft). Record it yourself with Cmd+Shift+5 on the draft screen, or tell me to record it with `record.cjs` (I'd add a clip for it). A short reading (3 to 5 pages) would be faster and cheaper. Set a learner brief on the subject first: the copy used for c07 has none, so the screen says "drafts assume first-year university students".
- **The spend line is hidden for recording** (Isaac, Oct 23). Open any page with `?recording=1` once and the "Claude this month" lines stay hidden on that browser; `?recording=0` brings them back. `record.cjs` sets it. The clips made on Oct 22 still show it.
- **On hold (Isaac, Oct 23):** the final recordings wait until slice 8 and the visuals work are in, since the lessons and screens will change.
- **Three lessons in the sampling chapter have nearly the same title** (the hand-written one, the session draft "5.1 …", and the in-app draft). It reads oddly on the overview and the author home. Renaming or hiding two before the final recording would help.
- **Trim the clip ends.** c03 ends with a stray click on module 2's first option after Continue.
- **Your edit:** cut to your narration in iMovie or DaVinci Resolve; all files are 1920x1080 H.264.
