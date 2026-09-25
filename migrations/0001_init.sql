-- courses, sources, lessons, events (spec.md > Data Model)

CREATE TABLE courses (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  show_unreviewed INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE sources (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id),
  title TEXT NOT NULL,
  pages TEXT NOT NULL,
  anthropic_file_id TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE lessons (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id),
  source_id TEXT REFERENCES sources(id),
  position INTEGER NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('unreviewed', 'reviewed')),
  content TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  signed_off_at TEXT
);

CREATE INDEX lessons_by_course ON lessons (course_id, position);

CREATE TABLE events (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL,
  lesson_id TEXT,
  student_name TEXT NOT NULL,
  device_id TEXT NOT NULL,
  type TEXT NOT NULL,
  payload TEXT NOT NULL,
  client_time TEXT NOT NULL,
  received_at TEXT NOT NULL
);

CREATE INDEX events_by_student ON events (course_id, student_name, device_id, client_time);
