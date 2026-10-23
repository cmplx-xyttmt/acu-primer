// Starting from a book (Oct 23): the PDF's bookmarks (its outline) become a plan, the chapters
// and their sections with page ranges. Nothing is drafted up front: each section becomes a
// lesson only when the author clicks Draft on it, because a draft costs about $1.30.
// Pure, so it's tested directly; the browser reads the outline in src/app/lib/pdfOutline.ts.

import { z } from "zod";

/** One bookmark: its title, the PDF page it points to (1 = the file's first page), and the
 *  bookmarks under it. */
export interface OutlineItem {
  title: string;
  page: number | null; // null when the bookmark doesn't point to a page we can resolve
  children: OutlineItem[];
}

const pages = z.string().regex(/^\d+(-\d+)?$/); // "170-180", as the draft screen takes them

export const Section = z.strictObject({ title: z.string().min(1).max(300), pages });
export const ChapterPlan = z.strictObject({ pages, sections: z.array(Section).max(60) });
export const BookInfo = z.strictObject({
  title: z.string().min(1).max(300),
  fileName: z.string().max(300),
  size: z.number().int().min(0),
  pageCount: z.number().int().min(1),
});

/** What POST /api/author/books takes: a subject made from a book, with its chapters. */
export const NewBook = z.strictObject({
  subject: z.strictObject({ title: z.string().min(1).max(200), overview: z.string().max(2000), brief: z.string().max(4000) }),
  book: BookInfo,
  chapters: z
    .array(z.strictObject({ title: z.string().min(1).max(300), overview: z.string().max(2000), plan: ChapterPlan }))
    .min(1)
    .max(80),
});

export type Section = z.infer<typeof Section>;
export type ChapterPlan = z.infer<typeof ChapterPlan>;
export type BookInfo = z.infer<typeof BookInfo>;
export type NewBook = z.infer<typeof NewBook>;

export interface PlannedChapter {
  title: string;
  pages: string;
  sections: Section[];
  likelyChapter: boolean; // false for front and back matter (Preface, Index...), unticked at first
}

// Sections that aren't something to teach from: left out of the plan.
const NOT_A_LESSON = /^([\d.]+\s+)?(exercises|review questions|programming problems|chapter goals|chapter summary|summary|further reading|key terms|problems|review exercises|chapter review)$/i;
// An appendix labelled with a letter ("A Exercise solutions") after numbered chapters.
const LETTERED = /^[A-Z][.:]?\s/;

const range = (from: number, to: number) => (to > from ? `${from}-${to}` : `${from}`);

// Front and back matter: kept in the list, but unticked, so the author can still add one.
const NOT_A_CHAPTER = /^(contents|table of contents|preface|foreword|acknowledg|about the author|index|bibliography|references|glossary|copyright|dedication|title page|cover|notation|appendix|answers|solutions|exercises|credits|for (teachers|instructors|students)|list of|front matter|back matter)/i;

/**
 * Bookmarks → chapters with sections. A chapter's pages run from its bookmark to the page before
 * the next top-level bookmark (or the end of the book); a section's run to the page before the
 * next section, within its chapter. Bookmarks without a page are skipped. When the top level is
 * a single item (the whole book, or "Part I"), its children are used as the chapters instead.
 */
export function planFromOutline(outline: OutlineItem[], pageCount: number): PlannedChapter[] {
  let top = outline.filter((o) => o.page !== null);
  while (top.length === 1 && top[0].children.some((c) => c.page !== null)) top = top[0].children.filter((c) => c.page !== null);
  // Parts ("Part I", "Part II") whose children are the chapters: flatten one level.
  if (top.length > 0 && top.every((t) => /^part\b/i.test(t.title) && t.children.length > 0))
    top = top.flatMap((t) => t.children.filter((c) => c.page !== null));

  const starts = top.map((t) => t.page!);
  return top.map((t, i) => {
    const start = t.page!;
    const end = Math.max(start, (starts.slice(i + 1).find((p) => p > start) ?? pageCount + 1) - 1);
    const kids = t.children.filter((c) => c.page !== null && c.page >= start && c.page <= end);
    const sections = kids
      .map((c, j) => {
        const next = kids.slice(j + 1).find((k) => k.page! > c.page!)?.page ?? end + 1;
        return { title: clean(c.title), pages: range(c.page!, Math.max(c.page!, next - 1)) };
      })
      .filter((x) => !NOT_A_LESSON.test(x.title));
    const title = clean(t.title);
    const afterNumbered = top.slice(0, i).some((x) => /^\d/.test(x.title.trim()));
    const likelyChapter = !NOT_A_CHAPTER.test(title) && !(afterNumbered && LETTERED.test(title));
    return { title, pages: range(start, end), sections, likelyChapter };
  });
}

const clean = (s: string) => s.replace(/\s+/g, " ").trim().slice(0, 300) || "Untitled";

/** A plain overview for a chapter made from a book, until the author writes a better one. */
export const sectionsOverview = (sections: Section[]) =>
  sections.length === 0 ? "" : `Covers ${sections.map((s) => s.title.replace(/^[\d.]+\s+/, "")).join("; ")}.`;

// --- When the bookmarks don't list sections: the contents pages, read by Claude ----------

export const Contents = z.strictObject({
  chapters: z.array(
    z.strictObject({
      title: z.string(), // with its number, as printed ("5 Foundations for inference")
      printedPage: z.number().nullable(), // the page number printed in the contents, or null
      sections: z.array(z.strictObject({ title: z.string(), printedPage: z.number().nullable() })),
    }),
  ),
});
export type Contents = z.infer<typeof Contents>;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * The gap between printed page numbers and the PDF's own (page "170" is often the PDF's 182).
 * Found by matching chapter titles in the contents to bookmarks; the most common gap wins.
 * null when nothing matches, and the author is asked instead.
 */
export function pageOffset(contents: Contents, outline: OutlineItem[]): number | null {
  const flat: OutlineItem[] = [];
  const walk = (items: OutlineItem[]) => items.forEach((i) => (flat.push(i), walk(i.children)));
  walk(outline);
  const votes = new Map<number, number>();
  for (const c of contents.chapters) {
    const hit = flat.find((o) => o.page !== null && norm(o.title) === norm(c.title));
    if (hit && c.printedPage !== null) votes.set(hit.page! - c.printedPage, (votes.get(hit.page! - c.printedPage) ?? 0) + 1);
  }
  let best: number | null = null;
  for (const [gap, n] of votes) if (best === null || n > votes.get(best)!) best = gap;
  return best;
}

/** Contents (printed pages) + the gap → chapters with sections in PDF pages, as from bookmarks. */
export function planFromContents(contents: Contents, offset: number, pageCount: number): PlannedChapter[] {
  const fit = (p: number | null) => (p === null ? null : Math.min(pageCount, Math.max(1, p + offset)));
  const outline: OutlineItem[] = contents.chapters.map((c) => ({
    title: c.title,
    page: fit(c.printedPage) ?? fit(c.sections.find((s) => s.printedPage !== null)?.printedPage ?? null),
    children: c.sections.map((s) => ({ title: s.title, page: fit(s.printedPage), children: [] })),
  }));
  return planFromOutline(outline, pageCount);
}
