// Learner profiles an author can start a subject's brief from. Picking one fills the brief box
// with its text, which the author then edits. (From the Oct 21 UX research; Isaac kept all 8.)

export interface BriefPreset {
  id: string;
  label: string;
  brief: string;
}

export const BRIEF_PRESETS: BriefPreset[] = [
  {
    id: "first-year",
    label: "First-year university student",
    brief: "First-year university students taking this as part of a course, often studying alone on a phone between classes. Comfortable with high-school maths; new to the subject's vocabulary. Short readings, plenty of checks, and help that explains a wrong answer without talking down.",
  },
  {
    id: "high-school",
    label: "High-school student",
    brief: "High-school students (about 15 to 18) meeting the topic for the first time. Plain words, concrete everyday examples before any formula, one idea at a time, and encouraging help after a wrong answer.",
  },
  {
    id: "self-learner",
    label: "Adult self-learner",
    brief: "An adult learning on their own, out of interest, in short sessions. No deadline and no teacher to ask, so every term is defined and every step is shown. Prefers understanding why over memorising.",
  },
  {
    id: "for-work",
    label: "Learning for work",
    brief: "A working professional who needs this for their job. Busy, practical, wants to apply it soon: lead with what it's for, use examples from real work, keep readings short, and favour checks that ask them to apply an idea.",
  },
  {
    id: "exam",
    label: "Exam crammer",
    brief: "A student revising for an exam soon. Wants the key ideas, the formulas and the common traps, with lots of practice in the style of exam questions and quick explanations of mistakes.",
  },
  {
    id: "hands-on",
    label: "Hands-on technical learner",
    brief: "A technical learner (for example a software engineer) who learns by doing. Give things to try, run or compute wherever possible, connect ideas to real systems, and skip motivational filler.",
  },
  {
    id: "returning",
    label: "Returning learner",
    brief: "Someone coming back to the subject after years away. Assume they once knew the basics but have forgotten details: refresh foundations quickly, then build up, and say plainly when something is new.",
  },
  {
    id: "teacher",
    label: "Future teacher or tutor",
    brief: "Someone preparing to teach this. Besides understanding it, they want to know where students usually go wrong and why, so name the misconceptions and how to address them.",
  },
];
