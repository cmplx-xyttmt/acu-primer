-- Starting from a book (Oct 23). A subject made from a book remembers which book (title, file
-- name, size, page count), so the draft screen can find it again in the browser. A chapter
-- made from a book keeps its plan: its pages and its sections, each a lesson waiting to be
-- drafted. Both stay NULL for subjects and chapters made by hand.
ALTER TABLE subjects ADD COLUMN book TEXT;
ALTER TABLE chapters ADD COLUMN plan TEXT;
