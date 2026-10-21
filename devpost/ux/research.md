# UI and UX audit, research and proposals

Oct 21, 2026. Research only: no app code changed. The visual report is `devpost/ux/index.html` (open it in a browser). It shows the screenshots, this audit and the mocks side by side.

## What's here

- `media/`: 68 screenshots of 17 screens, in Clean study and Night desk, at 1280px and 375px. The folder is gitignored, so it only exists on this laptop. File names follow `NN-screen-look-width.png`, for example `12-review-module-dark-phone.png`.
- `mocks/components.html`: the proposed buttons, badges, cards and icons, in both looks.
- `mocks/directions.html`: three visual directions, each as a phone-sized home screen and a wrong-answer screen, in both looks.
- `mocks/review-mode.html`: a clickable prototype of interactive review. Play it: pick answers, pin a suggestion, approve.
- `mocks/author-home.html`: the author home rebuilt with the new parts, plus the new course flow with brief presets.
- `mocks/home.html`: the `/` page for a first visit and for a returning student.

The mocks use copies of the app's own fonts (`mocks/fonts/`, SIL Open Font License) so they open without the dev setup.

How the screenshots were made: a local `wrangler dev` with a throwaway passphrase, driven by headless Chrome through its DevTools protocol (Chrome's window can't go narrower than about 500px, so the 375px shots needed device emulation). A test student, "UX Audit", played the first module of the fixture lesson. Their 24 events were deleted afterwards. No approvals or suggestions were added, Draft and Apply with Claude were never pressed, and the spend table still shows the same two rows ($1.37).

## The audit, ranked

Ranked by how much each problem gets in the way, weighted toward what you raised.

### 1. Status badges look like buttons

Where: author home (`10-author-home-light-desktop`), review header (`12-review-module-*`).

"Written by the model, not yet reviewed" is a pill with a 1px accent border and accent text. "Review" right next to it is a rounded box with a 1px accent border and accent text. The only differences are corner radius and font size. In Night desk both are amber outlines, so they look the same. A status should look like a label you read, and an action should look like something you press. The heuristic is affordance: the shape tells you what you can do.

### 2. Almost every action is underlined text

Where: everywhere. Author home ("Draft a lesson", "Students", "Open as a student"), review ("Suggest a change" appears 7 times on one step, "Previous", "Next, without approving"), player ("Overview", "Contents", "Back", "Not you?").

`.btn-quiet` is grey underlined text with no hover state. `.btn` has no hover, focus or pressed style at all, so nothing responds when you point at it, and keyboard users get only the browser's default focus ring. With every link styled the same, there's no visual hierarchy: "Draft a lesson" (spends money, starts the main job) looks exactly like "Students". This is the main reason the app reads as a page of text.

### 3. A review step is a long wall of boxes

Where: `12-review-module-light-desktop` (about 2,000px tall), `12-review-module-dark-phone` (about 6,000px at 375px).

Every branch is open at once: reading, check, explanation, each wrong answer with its misconception, re-explanation, simpler question and switches, the general fallback, alternatives. Each sits in an identical bordered box with an uppercase label and its own "Suggest a change". The approve button is at the very bottom. Nothing tells you what to look at first, and the student's experience (what they'd see, in what order) has to be pieced together in your head. That's why it's easy to glaze over.

### 4. The author home overflows on a phone

Where: `10-author-home-dark-phone`.

At 375px the lesson rows wrap badly. The "Review" button sticks out past the right edge of the course card, and "Draft a / lesson" and "Open as a / student" break into two-line columns. Status badges sit on their own line between the title and the button. It still works, but it looks broken.

### 5. The home page has no identity and default link colours

Where: `01-home-*`.

`/` is a heading, a sentence and two links. The links are the browser's default blue (#0000EE) because `theme.css` never styles `a` and only the author screens set a link colour. There's no mark, no course list and nothing that says what the product does differently. A student who lands here has one link to guess at.

### 6. Disabled buttons in Night desk look muddy, not disabled

Where: `06-wrong-fallback-dark-desktop` (Check), `11-draft-dark-desktop` (Draft).

`.btn:disabled` sets opacity to 0.45. On the amber accent over near-black that makes a brown button that looks like a different style, not an unavailable one. Nothing says why it's disabled ("Pick an answer first", "Choose a PDF").

### 7. Right and wrong rely on colour, and the verdict is small

Where: `06-wrong-fallback-*`, `07-right-explanation-*`.

A wrong pick turns the option red; a right pick turns it green. There's no icon, so someone with red-green colour blindness sees two near-identical outlined boxes. The verdict "Right." is one bold green word. Duolingo and Khan Academy both pair colour with an icon and give the verdict more room. This is also where a small, quick animation would make the moment feel like something happened.

### 8. No way to create a course, and the brief is hidden

Where: `10-author-home-*`, `10b-author-home-briefs-open-*`.

There's no "New course" anywhere. With no courses, the page says to run `npm run import:local`. The course brief sits in a collapsed `<details>` labelled "Course brief (none yet)" in grey, so it's easy to miss that it shapes every draft. There are no presets to start from.

### 9. Sign-off is a bullet list of links

Where: `13-signoff-*`.

"Not ready to sign off yet: 11 steps not approved yet." followed by eleven underlined titles. The step pills above already carry the same information. A grid of steps with ticks and dots, plus one clear Sign off button that unlocks, would say it in one look.

### 10. Lessons with the same name can't be told apart

Where: `10-author-home-light-desktop`.

The Sampling course lists "Point estimates and sampling variability" twice and "5.1 Point estimates and sampling variability" once. Nothing shows pages, module count, date or how far review got. A short grey line under each title fixes that.

### 11. The draft screen uses an unstyled file picker

Where: `11-draft-*`.

The native "Choose File" button clashes with both looks (grey system button in Night desk). The cost note is a grey box of prose that's easy to skip, though it's the most important thing on the screen.

### 12. Small inconsistencies

- IBM Plex Mono spreads money and counts apart: "$1 . 37", "0 / 7" (`10-author-home-dark-phone`, `03-overview-dark-desktop`). Tighter letter spacing or Plex Sans tabular figures for money would read better.
- The theme switch ("☀ Light") is also a bordered pill, so it joins the badge/button confusion.
- The student log mixes an absolute date in the first row with "+1s" offsets after it, and has no summary line (`15-student-log-*`).
- The lesson intro repeats "Locked" six times in grey text where a lock icon would do (`04-lesson-intro-*`).

What already works: the player is calm and readable, the reading width is right, the fallback panel is clearly set apart (especially the amber edge in Night desk), and the module-to-module motion is there and respects reduced motion. The proposals below keep all of that.

## Research: what other products do

I looked at learning products, review tools and course builders for patterns that fit acu-primer's size. Links were checked to load or appear in search results.

### Learning products

- **Brilliant** asks before it explains. You try the problem, then the explanation answers your attempt. That's close to acu-primer's check-then-explanation, and worth leaning into. [How Brilliant teaches](https://brilliant.org/resources/choosing-brilliant/how-brilliant-teaches-math/)
- **Duolingo** puts the verdict in a full-width coloured banner at the bottom, with the Continue button inside it: pale green with green text for right, red for wrong, short encouraging copy. Big celebrations are saved for the end of a lesson and streaks. [UX Planet analysis](https://uxplanet.org/analyzing-duolingo-from-product-design-perspective-after-400-days-of-non-stop-practice-c4d4809bdb37), [Duolingo product highlights](https://blog.duolingo.com/product-highlights/)
- **Khan Academy** has a Check button and a separate Hint button. Teachers report kids pressing Hint by accident when they meant Check, so a secondary action should look quieter and sit away from the primary one. [Khan Academy community thread](https://support.khanacademy.org/hc/fr/community/posts/205301458/comments/206454878)
- **Udacity** splits lessons into 2 to 3 minute pieces with a quiz after each, and shows lesson cards with progress. acu-primer already follows this. [New Udacity classroom](https://www.udacity.com/blog/new-udacity-classroom/)
- **Codecademy** splits the screen into labelled panes (narrative, editor, output), each an ARIA region with a hidden heading. Useful if review ever goes side by side. [Codecademy accessibility guide](https://help.codecademy.com/hc/en-us/articles/360056641953-Accessibility-Guide)
- **repovive roadmaps** show a breadcrumb, tabs, then sections each with a "0/41" counter, and node titles that say their type ("Quiz:", "Problem -", "- Hint", "Section Recap"). The per-section count is already in acu-primer's overview. Labelling module types ("Quiz", "Recap") is a cheap way to add texture. [Math Fundamentals](https://repovive.com/roadmaps/math-fundamentals)

### Review and authoring tools

- **GitHub pull request review** has a "Viewed" checkbox on each file. Ticking it folds the file away and moves a counter in the header, and the tick clears if the file changes later (acu-primer's content hash does the same). Comments stay pending until you submit one review. Mapped over: module = file, approve = Viewed, sign-off = submit review. [GitHub docs](https://docs.github.com/pull-requests/collaborating-with-pull-requests/reviewing-changes-in-pull-requests/reviewing-proposed-changes-in-a-pull-request)
- **Linear triage** gives each decision a single key (1 accept, 2 decline) with an optional comment. Keyboard approve and suggest would make review fast for a repeat reviewer. [Linear triage](https://linear.app/docs/triage)
- **Figma comments** are pins on the canvas, and pins drift when the layer moves. acu-primer pins suggestions to part ids, not positions, which avoids that problem. [Figma help](https://help.figma.com/hc/en-us/articles/1500004290941)
- **Notion** comments come from selecting text, resolve with a tick, and a filter brings resolved ones back. [Notion help](https://www.notion.com/help/comments-mentions-and-reminders)

### Preview as learner

- **Canvas Student View** puts a coloured border around the whole screen and a banner with "Leave Student View" and "Reset Student". You always know you're in a special mode, and you can start the student over. This is the model for acu-primer's review frame. [Illinois Tech guide](https://www.iit.edu/cli/canvas/managing-your-course/student-view)
- **Articulate Rise 360 and Review 360** let reviewers comment while viewing the learner version, grouped by lesson. The most common complaint is that comments are hard to match to the spot they're about, which is a point for pinning to parts. [Rise comments guide](https://community.articulate.com/kb/user-guides/rise-360-manage-integrated-comments/1152825), [Review 360 discussion](https://community.articulate.com/discussions/review-360/making-review-more-user-friendly)
- **Moodle** has "Switch role to Student" and "Return to my normal role", and warns the view isn't exact. **Teachable** has "Preview as Student" from the lesson editor. [Moodle guide](https://telsupport.brookes.ac.uk/articles/how-do-i-switch-my-role-in-moodle/), [Teachable help](https://intercom.help/teachableknowledgebase/en/articles/11682499-preview-your-school-and-products)
- **H5P** separates Check, Retry and Show solution as settings. [Lumi H5P settings](https://help.lumi.education/articles/9473043-behavioural-settings-in-h5p)

### Buttons and badges in design systems

- **GitHub Primer**: Label is for status and metadata and is small by default; Button starts actions. [Primer Label](https://primer.style/product/components/label/)
- **Atlassian Lozenge**: a status marker that isn't clickable. [Lozenge](https://atlassian.design/components/lozenge/lozenge)
- **Shopify Polaris Badge**: shows status; use something else for anything interactive, and give colour-only badges hidden text for screen readers. [Polaris Badge](https://polaris-react.shopify.com/components/feedback-indicators/badge)
- **Material 3** ranks buttons as filled, tonal, outlined and text, and draws hover, focus and pressed as a layer over the button. [Material states](https://m2.material.io/go/design-states)

All four agree: a badge is small, tinted, and never looks pressable.

### Icons

**Lucide**: ISC license (free, keep the notice), 24px grid, 2px stroke, `currentColor`, about 1,500 icons. For Svelte 5 the package is `@lucide/svelte` (`lucide-svelte` is the Svelte 4 one). It tree-shakes, so only the icons you import ship, and they get bundled like the fonts, so offline is unaffected. Copying 16 SVG files into `src/app/icons/` works too and adds no dependency. [Lucide stroke width](https://lucide.dev/guide/basics/stroke-width), [@lucide/svelte README](https://cdn.jsdelivr.net/npm/@lucide/svelte@1.7.0/README.md)

### Motion

- Wrap every animation in `prefers-reduced-motion`. When motion carries meaning (a shake means wrong), keep a still stand-in: the colour, an icon, the word. [web.dev](https://web.dev/articles/prefers-reduced-motion?hl=es)
- Durations: around 100ms for simple feedback, 200 to 300ms for bigger moves, slower than 400ms starts to feel sluggish. These numbers come from write-ups that cite Nielsen Norman Group; I couldn't confirm them on NN/g's own pages. [Val Head](https://valhead.com/?p=2978)
- A tick that draws itself: animate `stroke-dashoffset` from the path length to 0. [egghead lesson](https://egghead.io/lessons/css-use-css-animation-to-draw-svg)

### Learner presets in other tools

- **Coassemble** offers Beginner, Intermediate and Advanced, suggests audiences from your prompt, or takes your own. The closest thing to a preset picker I found. [Coassemble help](https://coassemble.com/help/en/articles/9229296-generate-a-course-with-ai)
- **Teachfloor** asks for background, role, prior experience and level. [Teachfloor help](https://support.teachfloor.com/en/articles/11374707-teachai-course-generator-build-a-full-course-in-minutes)
- **Khanmigo** adjusts reading level per student. [Khan Academy blog](https://blog.khanacademy.org/khanmigo-features/)
- Coursebox, Mini Course Generator and Synthesia have no documented presets: you type the audience into the prompt.

The fields that keep coming up: level, background or role, prior experience, reading level, goal and time per sitting. A preset in acu-primer can be a short paragraph that covers those, which the author then edits.

## Proposals

Each one is sized to build in a few hours. They're in the order I'd build them, because the first one makes the rest cheaper.

### 1. A component vocabulary (mock: `mocks/components.html`)

One rule: **buttons are verbs, badges are adjectives.**

Buttons come in three levels, all with hover, focus-visible and pressed states:

- **Primary**: filled accent. One per screen, the next step (Continue, Approve module, Review).
- **Secondary**: card background with a 1px border that turns accent on hover (Draft a lesson, Suggest a change, Add a brief).
- **Quiet**: no border or underline, but a light background on hover so it still reads as pressable (Contents, Students, View, Back).
- **Disabled** for all three: grey surface and grey text, never the accent at low opacity. A short reason sits next to it.
- Pressed moves the button down 1px. Focus is a 2px accent ring with a 2px gap.

Status badges: 0.75rem, weight 600, 5px corners (not a full pill), a tinted background, no border, a small leading dot, `cursor: default`. Four tones: Draft (amber in Clean study, clay in Night desk), Reviewed (green), Suggestions (accent), Review mode (violet). The long sentence "Written by the model, not yet reviewed" moves to a `title` tooltip and the review header; the badge just says "Draft".

Cards: border plus a soft shadow in Clean study, a lighter surface in Night desk. A clickable card lifts 1px and its border turns accent on hover.

Answer options get an icon with the colour: a circle-check for right, a circle-x for wrong.

Icons: Lucide, about 16 of them: arrow-right, list, pen-line, eye, users, message-square-plus, circle-check, circle-x, lightbulb, lock, book-open, file-up, plus, flag, sun, moon.

Build: `.btn` becomes `.btn .btn-primary/.btn-secondary/.btn-quiet` in `theme.css`, `Mark.svelte` becomes a `Badge.svelte`, add `@lucide/svelte` (or 16 SVG files), and give `a` a colour in `theme.css`. Then swap the class names screen by screen.

### 2. Three visual directions (mock: `mocks/directions.html`)

All three keep one thing on screen at a time, the same fonts and the same component vocabulary.

- **A. Clean study, finished.** The current colours. Adds the mark and wordmark, real buttons, cards with shadows, icons, a tinted panel behind the course title, and icons on verdicts. The safest change; most of the blandness goes because things look clickable and grouped.
- **B. Primer paper.** Leans on the name: the Primer in The Diamond Age is a book, so this looks like a well-made workbook. Warm paper ground (#FBF8F1), a deep teal accent in light mode (#0F766E), small Plex Mono uppercase labels ("MODULE 3 OF 7"), key terms marked with a highlighter stroke, hints styled as a dashed margin note. Night desk keeps its amber and gets a warmer near-black. Leaves room for small line drawings later. Optionally a serif for headings (Source Serif 4 or Fraunces, both OFL and on Fontsource), which would add a fourth font.
- **C. Bright steps.** The most playful, closest to Duolingo and Brilliant. Chunky buttons with a thick bottom edge that press down, a coloured course banner with a progress ring, a row of module pills instead of a thin bar, and the verdict as a full-width banner at the bottom of the screen with Continue inside it. A wrong pick gives one short shake.

The mark for all three: a rounded square with a path that goes up and right, and a dotted detour that leaves it and rejoins. It describes what a lesson does after a wrong answer. Wordmark: "acu·primer" in Plus Jakarta Sans 800 (Plex Sans 600 in Night desk), with the middle dot in the accent colour. Illustration: none for now in A and C; B could take small line drawings per course later. Motion: the existing 180ms module move, plus a 260ms shake on wrong, a 300ms tick draw on right and on approve, and nothing bigger than that until the end of a lesson.

My recommendation is B if you want identity, A if you want the least risk. C is the furthest from "simple and minimal".

### 3. Interactive review mode (mock: `mocks/review-mode.html`, clickable)

The author plays each module as a student, inside a frame that can't be mistaken for the student app.

- **The frame.** A 3px violet border around the whole window and a sticky violet bar at the top: a "Review mode" badge, "You're playing this lesson as a student. Students never see this bar.", and Exit review. Violet is free: blue/amber is the accent, green and red mean right and wrong.
- **Where you are.** The step pills stay at the top (Outcomes, 1 to 10, Sign off): green with a tick when approved, a violet ring on the current one, a small dot when it has a suggestion. "2 of 11 approved" on the right.
- **The module plays like the player.** Same reading, same options, same Check button, same fallback panel.
- **A coach line** sits just above the question in a dashed violet box and changes as you go: "Choose the right answer to see the explanation students get." Then "Now choose a wrong answer to see its hint. 3 paths to go." Then "Last one. A student could give an answer nobody planned for." with a button that shows the general fallback. Then "That's every path. Approve the module, or pin a suggestion." After each answer, "Answer again" resets the check.
- **A path checklist** on the right (desktop) lists every route a student can take: the right answer, each anticipated wrong answer by name, any other answer. Each one ticks with a short draw animation and a "Paths seen 2 / 4" bar fills. Options you've already tried get a small "tried" mark.
- **Author-only details** appear inside the fallback, marked with an "Author's view" badge: the misconception text and whether it's from the catalogue or the model's guess. The "shown to students" switches can live here too.
- **Suggestions.** Each part (reading, question, explanation, each hint) has a small message-plus button in the margin, faint until you hover the part (always visible on a phone). It opens a two-line note box in place. A saved note shows as a tinted chip under that part, and the step pill gets a dot.
- **The dock** at the bottom holds the decision: a one-line status ("2 of 4 paths seen. Approve when it reads right."), Suggest a change (secondary), and Approve module (primary). With open suggestions, Approve is disabled and the secondary button becomes "Apply with Claude". Approving before every path is seen asks once: "You haven't tried 2 paths yet. Approve anyway?" On approve, the button turns green with a tick, the pill pops (260ms scale) and the next module loads.
- **Motion.** Coach text fades in (220ms), a wrong pick shakes (260ms), hints rise (220ms), ticks draw (300ms), the approved pill pops (260ms). All off under `prefers-reduced-motion`; colour, icons and words still carry the meaning. No confetti in review.
- **Phones.** The checklist folds into the dock's status line, and the two dock buttons sit side by side.

The current all-branches view doesn't need to go away: a "Show every branch" toggle can keep it for a fast second pass. Build: a `ReviewPlayer.svelte` that reuses `ModuleView`'s check and fallback components with a `review` flag, plus the dock and coach. The approval and suggestion routes don't change.

### 4. New course flow and brief presets (mock: `mocks/author-home.html`)

A "New course" primary button at the top of the author home opens three short steps:

1. **Name it**: course title, book or source, and the link students will use (filled from the title).
2. **Who it's for**: eight preset cards plus "Write my own". Picking one fills an editable brief below. The brief can be changed later from the course card, where it now shows as a visible line with Edit (or "No brief yet" with an Add a brief button), not a collapsed `<details>`.
3. **First lesson**: "Create and draft the first lesson" goes straight to the draft screen.

This needs one new route (`POST /api/author/courses`) and a form. A whole course outline ("draft the chapter list from the table of contents") is a bigger, later step, and the brief and course record are where it would start.

The eight presets (each a short paragraph the author edits):

| Preset | Brief |
|---|---|
| First-year university student | Taking this for credit. Comfortable with school algebra, new to this subject's notation. Wants worked examples, every symbol defined the first time, and checks that look like exam questions. |
| High-school student | Aged 15 to 18. Short readings with everyday examples (sport, phones, school life), no calculus. Define every new word. Short sentences, encouraging tone. |
| Adult self-learner | Learning in spare time, 15 to 20 minute sittings, rusty on maths. The idea and a real example before any formula, and a one-line recap at the start of each lesson. |
| Learning for work | Needs this for their job soon. Skip proofs and history. Workplace examples (reports, dashboards, decisions), and end each lesson with one way to use it at work. |
| Exam crammer | Exam in one or two weeks, has seen the material once. Exam-style checks and common traps. Short readings; restate key formulas often. |
| Hands-on technical learner | A software engineer learning alone. Learns by doing: commands to run, code to read, numbers to compute. Precise language welcome; skip motivational framing. |
| Returning learner | Back to study after years away. Refresh each prerequisite briefly before using it. Small steps, slow pace, a check after almost every idea. |
| Future teacher or tutor | Will teach this. Name the common misconceptions and where they come from, point to the catalogue entry when there is one, suggest how to explain each idea. |

### 5. The home page (mock: `mocks/home.html`)

- **A first-time visitor** sees the mark and wordmark, one plain line about what's different ("Short lessons that notice when you're stuck"), three small cards (Short, Adapts, Checked), and the list of courses as clickable cards. "Author sign-in" is a quiet button in the footer.
- **A returning student** (a saved name on this device) sees one large "Welcome back" card with the lesson, a progress bar and Continue, then the other courses.
- **An author** reaches the author side from the footer. Later, if the passphrase is saved on the device, the footer could say "3 lessons to review".

This needs a public `GET /api/courses` that lists courses with at least one visible lesson.

## Recommendations, in order

1. Build the component vocabulary: three button levels with real states, a non-clickable badge, Lucide icons, a link colour.
2. Rebuild the author home with it: badge plus a primary Review button per lesson, a meta line under each title, a visible brief, a real switch, and a phone layout that doesn't overflow.
3. Replace the review step with interactive review mode.
4. Add New course with the brief presets.
5. Give `/` an identity: the mark, a one-line promise, course cards, and Continue for a returning student.
6. Add icons and a stronger verdict to right and wrong answers, with a short shake and tick.
7. Fix disabled buttons (grey, with a reason) and the native file picker on the draft screen.
8. Pick one visual direction and apply its colours last, once the parts above are in place.

## Decisions for Isaac

Questions for the interview, one at a time:

1. Which direction feels most like acu-primer: A (Clean study, finished), B (Primer paper) or C (Bright steps)? Or a mix, such as A's colours with B's labels and highlighter?
2. Do you like the mark (a path with a dotted detour that rejoins)? Or would you rather have a book, a letter, or just the wordmark?
3. Should light mode keep its blue accent, or move to something warmer (B's teal, or another colour you like)?
4. Is a fourth font (a serif for headings) worth it for warmth, or should we stay with the three we bundle?
5. How much motion is right: none beyond what's there, the small set (shake on wrong, tick on right, pill pop on approve), or more celebration at the end of a lesson?
6. In review mode, should Approve wait until every path has been tried, ask once if you skip some (the mock), or never ask?
7. Should review mode replace the current all-branches review, or sit beside it with a "Show every branch" toggle?
8. Is violet right for "review mode", or would you rather have another colour or no border at all?
9. Where should suggestion buttons sit: in the margin of each part (the mock), or only in the dock with a "which part?" picker?
10. Do the eight presets cover the learners you expect? Which would you drop, rename or add?
11. For New course, is "create, then draft the first lesson" enough for now, or do you want to draft a course outline from a table of contents soon?
12. On `/`, should the course list be public to anyone, or should students only get courses by link?
13. Should the author side get its own top bar (wordmark, "Author", your courses), or stay a plain page?
