-- Step-by-step review (slice 4b): one approval per review step (the outcomes, then each
-- module), and suggestions pinned to a part of a step.

CREATE TABLE step_approvals (
  lesson_id TEXT NOT NULL,
  step_id TEXT NOT NULL,          -- "_outcomes" or a module id
  content_hash TEXT NOT NULL,     -- SHA-256 of the step's content when it was approved
  approved_at TEXT NOT NULL,
  PRIMARY KEY (lesson_id, step_id)
);

CREATE TABLE suggestions (
  id TEXT PRIMARY KEY,
  lesson_id TEXT NOT NULL,
  step_id TEXT NOT NULL,
  part TEXT NOT NULL,             -- e.g. "reading", "check", "check.wrongAnswers.1"
  part_label TEXT NOT NULL,       -- what the author saw, e.g. "Hint for: Picks ..."
  text TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'resolved', 'withdrawn')),
  note TEXT,                      -- what the revision did about it
  created_at TEXT NOT NULL,
  resolved_at TEXT
);

CREATE INDEX suggestions_by_lesson ON suggestions (lesson_id, status);
