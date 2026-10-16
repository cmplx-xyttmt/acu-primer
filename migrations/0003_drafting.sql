-- In-app drafting (slices 3b and 6): a brief per course for the drafting prompt, and a log of
-- every Claude call with its cost, so the Worker can stop at the monthly budget.

ALTER TABLE courses ADD COLUMN brief TEXT;

CREATE TABLE spend (
  id TEXT PRIMARY KEY,
  at TEXT NOT NULL,
  kind TEXT NOT NULL,          -- "draft" or "revise"
  model TEXT NOT NULL,
  lesson_id TEXT,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  cache_write_tokens INTEGER NOT NULL,
  cache_read_tokens INTEGER NOT NULL,
  cost_usd REAL NOT NULL
);

CREATE INDEX spend_by_time ON spend (at);
