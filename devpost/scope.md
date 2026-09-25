---
doc: scope
status: approved
---

# acu-primer

A course-authoring tool and the lesson player that runs what it makes. A course author turns a textbook into short, interactive lessons that adapt when a student gets something wrong, and every lesson shows whether a person has checked it.

## The Unique Kernel
One lesson goes all the way around a loop:

1. The author and the tool turn a book section into a lesson together. The lesson includes fallbacks for wrong answers.
2. The author reviews the lesson and signs it off. Marks show what a person checked and what the model wrote.
3. A student plays it, gets a check wrong, and the lesson changes course.
4. The author sees that happen in the per-student view.

Asking a chatbot for a quiz gets you step 1 at best. acu-primer is the whole loop, with a person verifying the content before students see it.

## Who It's For
**The course author:** a university lecturer (or whoever builds the course) who has a textbook and wants interactive lessons that they trust. They never see the internal format. For Oct 9 this is Isaac, dogfooding. A lecturer friend sees it once it's substantial, and the CS department HOD is the connection for the CLRS course. What authors use today hasn't come up yet; `3-prd` can ask if it matters.

**The student:** opens a course link and types their name. They work through small modules with activities, and get help when they're stuck instead of a red X.

## The Core Loop
**Author:** upload a book, then work through it section by section. The tool says what it can do, shows drafts, and offers options. The author picks which fallbacks each check gets and signs off lessons. Then they come back to see how students did.

**Student:** open the next small module, read a little, do a check. If the answer is right, move on. If it's wrong, get a fallback the author enabled:
- a re-explanation of the concept, told a different way;
- a simpler practice quiz.

The author chooses one or both per check. If the student also fails the fallback, there's no further fallback. The lesson recommends going back through the material more carefully. That stops the fallbacks from going on forever.

## Inspiration & Identity
- Udacity's modules: short units, activities mixed in.
- repovive's roadmaps, for example https://repovive.com/roadmaps/math-fundamentals. Each lesson goes concept, rules with examples, quizzes scattered through, problems with hints, then takeaways. It shows progress per module ("0/41").
- *The Diamond Age*'s Primer, the interactive book that teaches its reader (the source of the name).
- Adaptation should start simple and get smarter. Research how adaptive learning is done and where acu-primer can do something new (PRD or later, not scope).

## Why This Matters to the Learner
Isaac's goal for the hackathon: "building software quickly, while understanding it." The project comes out of the curriculum and edtech work: a CS course for the department, a stats module, and later free offline lessons for sports academy schools, where athletes struggle to balance sport and study.

## What "Working" Looks Like
The app opens at a link. In a demo under three minutes, on one OpenIntro Statistics section (Creative Commons, so it can be shown publicly):

1. The author uploads the section and works through it with the tool. It drafts a lesson with checks and fallbacks, and the author accepts, changes, or drops them.
2. The author signs off the lesson. The review marks are obvious.
3. A student opens the link, types a name, gets a check wrong, and gets the re-explanation or the simpler quiz. They fail the fallback, and the lesson points them back to the material.
4. The author opens the per-student view and sees what that student did.

The "oh, that's cool" beat isn't picked yet. Candidates: the lesson changing course after a wrong answer, a page of the book becoming a lesson in front of you, or the back-and-forth between the tool and the author. The loop demo shows all three, so the video can choose later.

## The POC Boundary
The loop above, working end to end on one stats section:
- the player, with small modules, checks, up to two fallbacks per check, and the "go back through the material" stop;
- event logging and a basic per-student view;
- the authoring session for one section, with author-chosen fallbacks;
- one sign-off per lesson, with review marks the student side respects (unreviewed lessons are hidden by default, and the owner can change that);
- a student is a name typed in at the course link, and the author side sits behind a simple gate.

## Also in the Oct 9 build (not needed to prove the kernel)
From the scoping notes, in priority order, cut from the bottom if time runs out:
- The CLRS chapter 4 course: six lessons, 4.1 and 4.3 written by hand as the baseline, and the tool writes 4.2, 4.4, 4.5 and 4.6. The CLRS PDF never goes in the repo.
- Lecturer-facing recommendations (which students to check in on, what to change) and automatic adaptation, demoed on simulated students.

## Later
- Review per node instead of per lesson, where the reviewer sees every branch a student can take.
- Smarter adaptation, informed by research on adaptive learning.
- The OpenIntro hypothesis-testing module (5.3), following on from sampling distributions.
- Free offline lessons for sports academy schools.
- A story layer over lessons, so a mission with a story becomes a level.
- Letting student feedback carry part of the review load.

## Explicitly Cut
- **Real accounts:** one course owner for Oct 9. A typed name is enough for students.
- **Fallbacks on fallbacks:** two levels at most, then send the student back to the material. More would keep a stuck student going around in circles.
