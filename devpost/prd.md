---
doc: prd
status: approved
---


> **Naming since slice 9 (Oct 21):** the structure is **subject → chapter → lesson → module**. A subject is usually a book; a chapter is one of its chapters, or a single article; a lesson is about a section; a module is one screen (a short reading and at most one check). What this document calls a **course** is now a **chapter**, everywhere in the app and code. The learner brief lives on the subject.

# acu-primer — Product Requirements

A course-authoring tool and the lesson player that runs what it makes. A course author (a lecturer, for Oct 9 Isaac) turns a textbook section into short, interactive lessons. The lessons adapt to the wrong answer a student gives, keep working offline, and show whether a person has checked them.
Source: `scope.md > The Unique Kernel`, `scope.md > Who It's For`.

## The Core Journey
One OpenIntro Statistics section (5.1, "Point estimates and sampling variability") going all the way around the loop (`scope.md > What "Working" Looks Like`):

1. **The author starts a lesson.** They open the author side (behind a simple gate), upload the book section, and start an authoring session for it.
2. **The author and the tool build it together.** The tool splits the section into small modules. For each concept it proposes its top check options, and for each wrong answer a fallback. The author picks, edits, or tells the tool what to change.
3. **The author signs it off.** The lesson's mark changes from "written by the model, not yet reviewed" to "reviewed by a person." Now students can see it.
4. **A student arrives.** They open the course link and type their name. They see the module overview with progress, and a **Continue** button.
5. **The student works through modules.** Each module is a little reading, then a check.
6. **The student gets a check wrong.** The fallback depends on which wrong answer they gave: a re-explanation aimed at that misconception, a simpler question, or both, as the author chose.
7. **The student fails the fallback too.** There are no more fallbacks. The lesson suggests going back through the material, and the student carries on.
8. **The author sees what happened.** The per-student view shows that student's path through the lesson as a log: each module, each answer, each fallback, the time taken.

Success is all eight steps working on one stats section, in a demo under three minutes.

## Screens and Layout

**Student side (the player)**
- **Name entry.** The course title and one field for a name.
- **Course overview.** The list of modules, each with its progress, and one **Continue** button that goes to where the student stopped. Lessons that aren't signed off don't appear (see `States and Boundaries > Unreviewed lessons`).
- **Lesson intro.** Opened by clicking a lesson on the overview: what the student will be able to do by the end (the lesson's outcomes), every module title with ticks for passed and a mark for skipped, and **Start** or **Continue**. The overview's own **Continue** still goes straight to the module, so getting back in stays one click (added at slice 2b).
- **Module.** One module at a time: short reading, then a check. It moves forward one module at a time, with no long scrolling page. A **Back** button goes to the previous module to re-read it, with the answer already given shown and locked. The browser's Back button (or a swipe back on a phone) does the same. A **Contents** button opens the module list over the page; modules already reached can be opened from it, and later ones are locked so the checks can't be jumped over.

**Author side (behind the gate)**
- **Authoring session.** Where a book section becomes a lesson. The step-by-step design is left thin on purpose (see `Features and Behavior > Authoring session`).
- **Lesson review.** The whole lesson as a student would get it, including every fallback, with the review mark and a **Sign off** action.
- **Per-student view.** A list of students for a course, and one student's log.

## Look and Feel
Established by Isaac:
- **A simple interface without much visual clutter.** One thing on screen at a time in the player.
- **Navigation that feels smooth.** Moving between modules and into a fallback should feel quick and continuous, not like a page reload.
- Structure references: Udacity's short modules, and repovive's lesson pattern and per-module progress count (`scope.md > Inspiration & Identity`).

Chosen from the three directions shown in `prd.html` (Isaac isn't a designer and asked to see options):
- **Light mode: "Clean study."** White background, one friendly sans-serif throughout (Plus Jakarta Sans in the preview), rounded answer buttons, a blue accent. Closest to Udacity.
- **Dark mode: "Night desk."** Near-black background, a plain sans-serif with a monospace for numbers and code (IBM Plex Sans and IBM Plex Mono in the preview), an amber accent.
- The mode follows the device's light or dark setting by default. A small switch on every player screen cycles Auto, Light and Dark, and the choice is remembered on that device (added at the slice 1 review).
- Fonts have to ship with the app, so the offline player doesn't fall back to system fonts.

`4-spec` turns this into specific colors and type.

## Features and Behavior

### Course overview and progress
- As a student, I want to see where I am in the course and pick up where I left off, so I don't have to hunt for my place.
  - [ ] After typing a name, the student sees every signed-off module with its progress.
  - [ ] **Continue** opens the module where the student stopped. On a first visit, it opens the first module.
  - [ ] Typing the same name on the same device later shows the progress saved before.

### Modules and checks
Source: `scope.md > The Core Loop`.
- Modules are short. Checks come often. When a stretch of prose has no sensible check, or a check would be too trivial, the prose is split into more modules instead, so the student never faces a wall of text.
- Check types come from the list the player supports. The tool proposes only from that list, and the list grows over time as Isaac builds courses and sees what's needed.
- **The first supported list:**
  - pick an answer;
  - type a number;
  - sort into categories;
  - predict, then run the simulation (stats: the student commits to a prediction before the simulation unlocks);
  - predict the output (algorithms and code, for the CLRS course);
  - fill in a trace table (algorithms and code, for the CLRS course).
- The full list of types to choose from later is under `Deferred From the POC > Check types beyond the first list`.
- As a student, I want to answer something every few paragraphs, so the lesson keeps me doing, not just reading.
  - [ ] Every module in the demo lesson is short enough to read without scrolling far, and the lesson has a check at least every other module.
  - [ ] A right answer says so, explains why it's right in a sentence or two, and moves on to the next module.
  - [ ] A picked option turns green when right and red when wrong; a wrong pick never reveals the right option (slice 3c).

### Fallbacks after a wrong answer
Source: `scope.md > The Core Loop`, `scope.md > Explicitly Cut`.
- **Known wrong answer.** Each wrong answer the tool anticipated (each wrong option, or a common wrong value for a typed answer) names the misconception behind it. It gets its own fallback: a re-explanation aimed at that misconception, a simpler question, or both. The author chooses which.
- **Unplanned wrong answer** (a typed value or an order nobody anticipated). The check has a general fallback that isn't tied to one misconception. The student is told the answer isn't quite right. Then:
  - if a simpler question is available, they're asked to try that first before going on;
  - otherwise they're told to re-read the material or think it through and try again, and pointed to the simpler explanation if one exists.
- **After the fallback, one more try at the original.** A re-explanation ends with "Try the question again". A simpler question answered right leads back to the original question too (decided at slice 2).
- **The fallback fails too** (the simpler question is wrong, or the original is wrong again on that try). No further fallback. The lesson suggests going back through the material more carefully. The student can **Try again** (as often as they like, with no more hints) or **Skip for now**. A skipped module doesn't count as passed: the overview shows it as skipped, the lesson isn't complete, and once the student reaches the end, **Continue** takes them back to it (decided at slice 2).
- As a student, I want help that fits the mistake I made, so I don't just see a red X.
  - [ ] Picking a specific wrong option shows the fallback written for that option's misconception, not a generic one.
  - [ ] Typing an unanticipated wrong answer shows the general fallback with the wording above.
  - [ ] Failing a fallback question shows the "go back through the material" suggestion, and no third level appears.

### Offline
Source: the scoping notes' plan for deployment, and Isaac's pitch for students with poor connections.
- Once a course has been opened, the student sees and does the same things with or without a connection.
- Without a connection, events wait in the browser and are sent when the connection returns. The student doesn't need to do anything.
- As a student with a poor connection, I want the lesson to keep working when the network drops, so I can keep learning.
  - [ ] With the network turned off after the course has loaded, every module, check and fallback still works.
  - [ ] Events recorded while offline show up in the per-student view after the network comes back.

### Authoring session
Source: `scope.md > The Core Loop`. Deliberately thin: the hand-written baseline lessons (4.1, 4.3) exist to shape these steps, so the detailed flow is decided after the baseline (see `Open Questions`).
- The author uploads a book section. The tool works through it in small modules and explains what it's doing and what will happen next.
- For each concept, the tool proposes its top check options. The author picks the best one, or tells the tool what to change.
- For each wrong answer, the tool proposes a fallback. The author chooses re-explanation, simpler question, or both, and can edit them.
- **Misconceptions come from published catalogues where they exist.** Models are poor at guessing which mistakes real students make (Feng et al. 2024), so the tool starts from catalogued misconceptions for the topic and adds its own guesses as a supplement. It shows the author where each misconception came from: a catalogue, or the model.
- **All help is written at authoring time and approved by a person.** Fallbacks and hints are never generated on the fly for a student. Hints written by a model for statistics still had 13% errors after filtering (Pardos and Bhandari 2024), which is why every fallback goes through sign-off.
- The author never sees the internal lesson format.
- **Each course has a brief** (who the learner is, how they learn), which every draft follows (slice 3b, from the OSTEP dog-food).
- **Shaping happens on the review screen** (slice 6): "Apply with Claude" revises one step from its open suggestions; "Use this check instead" swaps in an alternative (the old check becomes an alternative); each hint has a "shown to students" switch. Any change voids a sign-off and needs that step approved again.
- As a course author, I want to shape the lesson with the tool rather than accept a finished draft, so the result is something I'd put my name to.
  - [ ] From one uploaded OpenIntro section, the session produces a playable lesson with modules, checks and fallbacks.
  - [ ] The author can replace a proposed check with a different option, and change it by telling the tool what to change.
  - [ ] The author can turn each fallback type on or off per wrong answer.
  - [ ] Each misconception shows its source: a published catalogue, or the model.

### Review and sign-off
Source: `scope.md > The POC Boundary`.
- A lesson carries one of two marks: "written by the model, not yet reviewed" or "reviewed by a person." One sign-off per lesson.
- **Review goes step by step** (slice 4b, Oct 16): the outcomes, then one module at a time with every branch open. The author approves each step with one tick, or pins a suggestion to a part of it (the reading, the check, its explanation, one wrong answer's hint, the general fallback, the alternatives). Suggestions are applied by a revision (for now `/revise-lesson` in Claude Code), and a revised step has to be approved again. Sign-off unlocks only when every step is approved and no suggestion is open.
- The review screen shows every fallback, so the author can read every branch a student might see.
- As a course author, I want students to get only what I've checked, so "verified before it ships" holds.
  - [ ] Before sign-off, the lesson doesn't appear for students.
  - [ ] After sign-off, it appears in the course overview, and the mark is visible on the author side.
  - [ ] The course owner can switch on showing unreviewed lessons to students, and those lessons carry an obvious "not yet reviewed" mark in the player.

### Per-student view
- A list of the students who've opened the course, each by the name they typed.
- For one student, their path through the lesson as a log, in order: modules entered, each answer, right or wrong, which misconception it hit, which fallback they got, and time taken.
- As a course author, I want to see how one student went through the lesson, so I can tell where they struggled.
  - [ ] After a demo student gets a check wrong and fails the fallback, their log shows the wrong answer, the misconception, the fallback, and the second wrong answer, in order.

## States and Boundaries
- **First visit, student.** Name entry, then the overview with nothing done. **Continue** opens module 1.
- **Returning student, same device.** Their progress is there.
- **Offline after loading.** Everything works, events wait (see `Features and Behavior > Offline`).
- **Never loaded, no connection.** The course can't open. It has to be opened once online first.
- **Unreviewed lessons.** Hidden from students by default. If the owner switches on showing them, they appear with an obvious "not yet reviewed" mark.
- **Empty course.** A course with no signed-off lessons shows students a short note that nothing is ready yet.
- **Empty per-student view.** Before anyone has opened the course, the author sees a note saying so.
- **Who can do what.** Anyone with the course link can play signed-off lessons. Only the course owner gets past the gate to author, review, sign off, and see students.

## Product Decisions
- **The overview comes first, with a Continue button** — the student sees where they are and gets back in with one click.
- **Split long prose instead of forcing checks** — the goal is never overwhelming a student with long text; a trivial check is worse than a short module.
- **The tool proposes only from check types the player supports** — the AI can write any kind of check, but the player has to show and grade each one, and that's where build time goes.
- **Fallbacks depend on the wrong answer** — a wrong answer tells you which misconception to address. Isaac accepted that it multiplies review load.
- **Unplanned wrong answers get a general fallback** with the "try a simpler question first" or "re-read and try again" wording.
- **Offline looks the same as online** — the only difference is that events wait in the browser.
- **The per-student view is a log of the student's path** — what a teacher needs beyond that needs research, since Isaac isn't a teacher.
- **Simple, uncluttered, smooth, with "Clean study" for light mode and "Night desk" for dark** — picked from three options at review.
- **A light/dark switch, defaulting to the device setting** — Isaac found no way to switch while testing slice 1; students may want it too.
- **Back goes to the previous module for re-reading, not re-answering** — the student's earlier answer stays locked, and the browser's Back button does the same thing (slice 1 review).
- **First check types: pick an answer, type a number, sort into categories, predict then simulate, predict the output, fill in a trace table** — enough for the stats demo and the CLRS course. The rest wait until a course needs them.
- **Misconceptions from published catalogues first, with the model as a supplement** — from the Sep 25 research: models don't anticipate real student errors well.
- **Every fallback is written ahead of time and approved** — from the same research: model-written stats hints still had errors after filtering.
- **The authoring flow stays thin until the baseline** — the hand-written lessons exist to shape it.

- **A name identifies a student on one device** (confirmed at review). Two students typing the same name on the same device would share progress, and progress doesn't move between devices. Both are acceptable for Oct 9 because there are no real accounts.
- **Unreviewed lessons are hidden completely by default, not shown locked** (confirmed at review).
- **"Skip for now" instead of carrying on as if passed** (slice 2 review) — a student who fails the fallback can still move forward, so nobody is stuck, but the module stays not passed until they come back and get it. No extra fallback levels are added, so `scope.md > Explicitly Cut` still holds. The author can switch on showing them.

## What We're Building
- Name entry, course overview with progress, and **Continue**.
- Short modules with checks, from the first list of supported check types.
- Fallbacks per wrong answer, the general fallback for unplanned answers, and the two-level stop.
- Offline play after first load, with events sent later.
- The authoring session for one book section, with author choice over checks and fallbacks.
- Lesson review showing every fallback, one sign-off per lesson, and the owner's switch for showing unreviewed lessons.
- The per-student view as a log.
- All of it working on OpenIntro 5.1 in a demo under three minutes.

## Deferred From the POC
- **An AI read-out in the per-student view** (what we can tell about this student). It costs model calls per student and needs research into what teachers want to see. It belongs with the lecturer-facing recommendations (`scope.md > Also in the Oct 9 build`).
- **Research into what a teacher needs from the per-student view.** Isaac isn't a teacher, so this needs outside input before it grows past a log.
- **An online AI tutor inside the player**, and a paid version with it alongside a free offline version.
- **Check types beyond the first list.** They get added as the player learns to show them, when a course needs them. The full list, from the Sep 25 research (details and evidence in `~/Projects/curriculum-edtech/content-graph.md`):
  - *Any content:* match, put in order, fill in the blanks, click the right spot, build something (for example a graph), free text, and a "why?" and "how sure are you?" layer on any check.
  - *Algorithms and code:* Parsons problems (arrange code blocks, including a faded version), find the bug, step through a simulation, recursion tree, give the running time, write code.
  - *Maths derivations:* type an expression (graded by meaning, not exact wording), derive line by line, arrange proof blocks, fill in a missing step, find the error in a derivation, classify the master-theorem case.
  - *Stats and simulation:* sketch a distribution, estimate on a number line, practice questions generated with fresh numbers.
  - *Conceptual:* answer plus "because" plus confidence, a question before the reading, reflect, spaced review, scenarios.
- **Progress across devices.** It would need accounts.

## Possible Later Enhancements
- **A fuller authoring pipeline:** an outline step, checks done by code, simulated students at different levels, a teaching reviewer, and a review report for the author. Ideas and cost estimates in `authoring-pipeline.md`.
- **Recap button.** A recap of what the student has learned so far, with an optional quick quiz to check they remember.
- **Recall and spaced repetition** (Isaac, Oct 9). Today recall happens only inside modules, and a lesson ends with a Takeaways page. Later: a short review quiz at the end of each lesson drawn from its outcomes, then questions from earlier lessons coming back after a day, a few days and a week (spaced repetition), scheduled from each student's answer history in the event log. "Spaced review" is already on the deferred check-type list; this makes it a feature of its own.
- Review per node, where the reviewer walks every branch (`scope.md > Later`).
- Smarter adaptation, informed by research on adaptive learning.
- Student feedback carrying part of the review load.

## Non-Goals
- **Real accounts** — one course owner and a typed name are enough for Oct 9 (`scope.md > Explicitly Cut`).
- **Fallbacks on fallbacks** — two levels at most, so a stuck student doesn't go around in circles.
- **Opening a course for the first time offline** — the course has to load once with a connection.
- **Showing the internal lesson format to authors** — authors work with lessons, not the format.

## Open Questions
- **The authoring session's step-by-step flow.** Decided after the hand-written baseline lesson. Can wait until the build.
- **What exactly counts as a "simpler question"** (same concept with smaller numbers, one step instead of three, or something else)? The tool proposes and the author edits. Can wait until the build.
- **How long a lesson draft takes to produce.** If it's minutes, the authoring session needs to show progress. Can wait until the build.
