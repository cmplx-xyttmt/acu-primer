-- Subjects above chapters (slice 9). The structure becomes subject → chapter → lesson → module,
-- and what used to be called a course is now a chapter, everywhere. A subject is usually a book;
-- a chapter is a chapter of it, or an article. The learner brief moves up to the subject.

CREATE TABLE subjects (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  overview TEXT,          -- a sentence or two students see on the subject page
  brief TEXT,             -- who the learner is and how they learn; read by drafting
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

ALTER TABLE courses RENAME TO chapters;
ALTER TABLE chapters ADD COLUMN subject_id TEXT REFERENCES subjects(id);
ALTER TABLE chapters ADD COLUMN overview TEXT;
ALTER TABLE chapters ADD COLUMN position INTEGER NOT NULL DEFAULT 0;

ALTER TABLE lessons RENAME COLUMN course_id TO chapter_id;
ALTER TABLE sources RENAME COLUMN course_id TO chapter_id;
ALTER TABLE events RENAME COLUMN course_id TO chapter_id;

DROP INDEX IF EXISTS lessons_by_course;
CREATE INDEX lessons_by_chapter ON lessons (chapter_id, position);
DROP INDEX IF EXISTS events_by_student;
CREATE INDEX events_by_student ON events (chapter_id, student_name, device_id, client_time);
CREATE INDEX chapters_by_subject ON chapters (subject_id, position);

-- The two chapters that exist so far, under their books. (Absent on a fresh database: then
-- the UPDATEs touch nothing and the subjects simply wait for chapters.)
INSERT INTO subjects (id, slug, title, overview, position, created_at) VALUES
  ('openintro-statistics', 'openintro-statistics', 'OpenIntro Statistics',
   'An introduction to statistics: data, probability, and the foundations of inference.', 1, datetime('now')),
  ('ostep', 'ostep', 'Operating Systems: Three Easy Pieces',
   'How an operating system virtualizes the CPU and memory, handles concurrency, and keeps data safe.', 2, datetime('now'));

UPDATE chapters SET subject_id = 'openintro-statistics', position = 1 WHERE id = 'openintro-sampling';
UPDATE chapters SET subject_id = 'ostep', position = 1 WHERE id = 'ostep-processes';

-- The brief belonged to a chapter until now; it moves to the chapter's subject.
UPDATE subjects SET brief = (
  SELECT brief FROM chapters WHERE chapters.subject_id = subjects.id AND chapters.brief IS NOT NULL LIMIT 1
);
ALTER TABLE chapters DROP COLUMN brief;
