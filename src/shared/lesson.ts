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

// The fields each check type needs to show and grade itself. New types (categorize,
// predict_simulate) join these unions in slice 8.
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

// A full check minus alternatives. Alternatives are checks of this shape, so an author can
// swap one in without the tool writing its fallbacks again.
export const AlternativeCheck = z.discriminatedUnion("type", [
  z.strictObject({ id, ...selectFields, ...explanation, ...selectHelp }),
  z.strictObject({ id, ...numberFields, ...explanation, ...numberHelp }),
]);

export const Check = z.discriminatedUnion("type", [
  z.strictObject({ id, ...selectFields, ...explanation, ...selectHelp, alternatives: z.array(AlternativeCheck) }),
  z.strictObject({ id, ...numberFields, ...explanation, ...numberHelp, alternatives: z.array(AlternativeCheck) }),
]);

export const Module = z.strictObject({
  id,
  title: text,
  // Short paragraphs separated by blank lines. $...$ is inline math, $$...$$ is display
  // math, **bold** and *italic* work. Rendered by src/app/lib/math.ts.
  reading: text,
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
}

export interface AuthorSubject {
  id: string; // "" for the group of chapters that have no subject yet
  slug: string;
  title: string;
  overview: string | null;
  brief: string | null; // who the learner is; every draft in the subject follows it
  chapters: AuthorChapter[];
}
