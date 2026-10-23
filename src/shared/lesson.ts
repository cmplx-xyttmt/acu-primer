// The lesson format. The player reads it, the tool writes it (slice 3), and this one
// file checks it on both sides. Authors never see it.
//
// Shape: a lesson has modules; a module has short reading and at most one check; a check
// carries its known wrong answers (each naming a misconception and its fallback), a general
// fallback for unplanned answers, and alternative checks only the author side shows.
//
// "No third level" is enforced here: a simpler question is a strict object with no
// wrongAnswers or generalFallback, so a fallback can't carry fallbacks of its own.

import { z } from "zod";
import type { BookInfo, ChapterPlan } from "./bookPlan.ts";

const id = z.string().min(1);
const text = z.string().min(1);

export const MisconceptionSource = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("catalogue"), reference: text }),
  z.strictObject({ kind: z.literal("model") }),
]);

export const Misconception = z.strictObject({
  text,
  source: MisconceptionSource,
});

// The fields each check type needs to show and grade itself. Slice 8 added "sort" (put each
// item in its category); simpler questions stay select or number.
const selectFields = {
  type: z.literal("select"),
  prompt: text,
  options: z.array(z.strictObject({ id, text })).min(2),
  answer: id, // the id of the right option
};

const numberFields = {
  type: z.literal("number"),
  prompt: text,
  answer: z.number(),
  tolerance: z.number().min(0), // right if |given - answer| <= tolerance
  unit: z.string().optional(),
};

const sortFields = {
  type: z.literal("sort"),
  prompt: text,
  categories: z.array(z.strictObject({ id, label: text })).min(2),
  // Each item with the category it belongs in. Shown to students in this order.
  items: z.array(z.strictObject({ id, text, category: id })).min(2),
};

// Why the right answer is right, shown under "Right." so a student who guessed (or wasn't
// sure) gets the reasoning. Required on checks; optional on simpler questions.
const explanation = { explanation: text };

// A simpler question: a check with no fallbacks of its own.
export const SimpleCheck = z.discriminatedUnion("type", [
  z.strictObject({ ...selectFields, explanation: text.optional() }),
  z.strictObject({ ...numberFields, explanation: text.optional() }),
]);

export const Fallback = z.strictObject({
  reExplanation: z.strictObject({ enabled: z.boolean(), text }).optional(),
  simplerQuestion: z.strictObject({ enabled: z.boolean(), check: SimpleCheck }).optional(),
});

const wrongAnswer = <M extends z.ZodType>(match: M) =>
  z.strictObject({ match, misconception: Misconception, fallback: Fallback });

const selectHelp = {
  wrongAnswers: z.array(wrongAnswer(z.strictObject({ optionId: id }))),
  generalFallback: Fallback,
};

const numberHelp = {
  // A common wrong value, given as a range so rounding still matches.
  wrongAnswers: z.array(wrongAnswer(z.strictObject({ min: z.number(), max: z.number() }))),
  generalFallback: Fallback,
};

const sortHelp = {
  // A common misplacement: this item put in this (wrong) category.
  wrongAnswers: z.array(wrongAnswer(z.strictObject({ itemId: id, categoryId: id }))),
  generalFallback: Fallback,
};

// A full check minus alternatives. Alternatives are checks of this shape, so an author can
// swap one in without the tool writing its fallbacks again.
export const AlternativeCheck = z.discriminatedUnion("type", [
  z.strictObject({ id, ...selectFields, ...explanation, ...selectHelp }),
  z.strictObject({ id, ...numberFields, ...explanation, ...numberHelp }),
  z.strictObject({ id, ...sortFields, ...explanation, ...sortHelp }),
]);

export const Check = z.discriminatedUnion("type", [
  z.strictObject({ id, ...selectFields, ...explanation, ...selectHelp, alternatives: z.array(AlternativeCheck) }),
  z.strictObject({ id, ...numberFields, ...explanation, ...numberHelp, alternatives: z.array(AlternativeCheck) }),
  z.strictObject({ id, ...sortFields, ...explanation, ...sortHelp, alternatives: z.array(AlternativeCheck) }),
]);

// Explorations (slice 8): the student locks in a prediction, then changes something in a
// widget and sees what happens. The widgets are built by hand and the lesson only configures
// them; nothing the model writes runs as code (a formula goes through src/shared/formula.ts,
// which only knows arithmetic). Four general widgets, so any subject can use them:
//   formula    inputs (each a short list of values) feed a formula; the result shows as a
//              number, and optionally as a line plot over one input
//   sampling   draws many random samples of size n from a population with proportion p, and
//              plots the sample proportions (statistics)
//   stepper    a sequence of states the lesson writes (a row of labelled cells and a caption),
//              stepped through one at a time: an algorithm on an array, a process's states
//   scenarios  pick an option for each input and see the outcome the lesson wrote for it
const varName = z.string().regex(/^[a-z][a-z0-9_]*$/, "lowercase letters, digits and _");
const FormulaWidget = z.strictObject({
  kind: z.literal("formula"),
  inputs: z
    .array(z.strictObject({ id: varName, label: text, values: z.array(z.number()).min(2).max(12), start: z.number() }))
    .min(1)
    .max(3),
  expression: text, // e.g. "sqrt(p * (1 - p) / n)"
  result: z.strictObject({ label: text, unit: z.string().optional(), decimals: z.number().int().min(0).max(6) }),
  plotOver: varName.optional(), // an input id: plot the result across that input's values
});
const SamplingWidget = z.strictObject({
  kind: z.literal("sampling"),
  p: z.number().gt(0).lt(1),
  sizes: z.array(z.number().int().min(1).max(5000)).min(2).max(6),
  start: z.number().int(), // one of sizes
  draws: z.number().int().min(100).max(5000), // samples per run
});
const StepperWidget = z.strictObject({
  kind: z.literal("stepper"),
  frames: z
    .array(
      z.strictObject({
        caption: text,
        cells: z.array(z.strictObject({ label: z.string().optional(), value: z.string(), mark: z.boolean().optional() })).min(1).max(12),
      }),
    )
    .min(2)
    .max(16),
});
const ScenariosWidget = z.strictObject({
  kind: z.literal("scenarios"),
  inputs: z.array(z.strictObject({ id: varName, label: text, options: z.array(z.strictObject({ id, label: text })).min(2).max(5) })).min(1).max(3),
  // One outcome per combination of options: "when" maps every input id to an option id.
  outcomes: z.array(z.strictObject({ when: z.record(z.string(), id), text })).min(2),
});
export const Widget = z.discriminatedUnion("kind", [FormulaWidget, SamplingWidget, StepperWidget, ScenariosWidget]);

export const Explore = z.strictObject({
  enabled: z.boolean(), // the author's switch, like a hint's
  // For the author: what the student changes, and the misconception it targets. Required, so
  // an exploration has to justify itself.
  why: text,
  prompt: text, // what to do, shown above the widget
  prediction: z.strictObject({ prompt: text, options: z.array(z.strictObject({ id, text })).min(2).max(5), answer: id }),
  thinkAbout: text, // shown when the prediction didn't match what happened; never marked wrong
  notice: text, // what to notice, shown once the student has changed something
  widget: Widget,
});

export const Module = z.strictObject({
  id,
  title: text,
  // Short paragraphs separated by blank lines. $...$ is inline math, $$...$$ is display
  // math, **bold** and *italic* work. Rendered by src/app/lib/math.ts.
  reading: text,
  explore: Explore.optional(), // comes before the check, if both
  check: Check.optional(),
});

export const Lesson = z.strictObject({
  id,
  title: text,
  source: z.strictObject({ book: text, pages: text }),
  // What a student can do by the end, one line each, shown on the lesson intro. Written
  // first, so the modules can be checked against them.
  outcomes: z.array(text).min(1),
  modules: z.array(Module).min(1),
});

export type MisconceptionSource = z.infer<typeof MisconceptionSource>;
export type Misconception = z.infer<typeof Misconception>;
export type SimpleCheck = z.infer<typeof SimpleCheck>;
export type Fallback = z.infer<typeof Fallback>;
export type AlternativeCheck = z.infer<typeof AlternativeCheck>;
export type Check = z.infer<typeof Check>;
export type Module = z.infer<typeof Module>;
export type Lesson = z.infer<typeof Lesson>;
export type Explore = z.infer<typeof Explore>;
export type Widget = z.infer<typeof Widget>;

// What GET /api/chapters/:slug returns: the chapter and every visible lesson in full.
export type LessonStatus = "unreviewed" | "reviewed";

export interface ChapterLesson {
  id: string;
  position: number;
  status: LessonStatus;
  content: Lesson;
}

export interface ChapterResponse {
  chapter: { slug: string; title: string; overview: string | null; showUnreviewed: boolean };
  subject: { slug: string; title: string } | null;
  lessons: ChapterLesson[];
}

// The student side's view of subjects (the home page and a subject's page). A chapter card
// carries each visible lesson's module ids, so the browser can show progress from its own
// saved progress without loading every lesson.
export interface ChapterCard {
  slug: string;
  title: string;
  overview: string | null;
  lessons: { id: string; title: string; moduleIds: string[] }[];
}

export interface SubjectCard {
  slug: string;
  title: string;
  overview: string | null;
  chapters: ChapterCard[];
}

// What the author routes return.
export interface AuthorLessonSummary {
  id: string;
  chapterId: string;
  position: number;
  title: string;
  status: LessonStatus;
  updatedAt: string;
  signedOffAt: string | null;
}

export interface AuthorLesson extends AuthorLessonSummary {
  content: Lesson;
  review: {
    approvedSteps: string[]; // steps whose approval still matches their content
    suggestions: import("./review.ts").Suggestion[];
  };
}

export interface AuthorChapter {
  id: string;
  slug: string;
  title: string;
  overview: string | null;
  subjectId: string | null;
  showUnreviewed: boolean;
  lessons: AuthorLessonSummary[];
  plan: ChapterPlan | null; // for a chapter made from a book: its pages and sections
}

export interface AuthorSubject {
  id: string; // "" for the group of chapters that have no subject yet
  slug: string;
  title: string;
  overview: string | null;
  brief: string | null; // who the learner is; every draft in the subject follows it
  book: BookInfo | null; // for a subject made from a book
  chapters: AuthorChapter[];
}
