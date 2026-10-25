// Cut a page range out of a PDF, so only the section's pages ever leave the author's laptop.
// Works on bytes in and bytes out, so the browser and scripts/try-draft.ts share it.

import { PDFDocument } from "pdf-lib";

/** "170-181" or "170-175, 178" → zero-based page indexes. Pages are as the PDF viewer
 *  numbers them (1 = the file's first page), which may differ from the printed numbers. */
export function parsePageRange(range: string, pageCount: number): number[] {
  const pages: number[] = [];
  for (const part of range.split(",").map((p) => p.trim()).filter(Boolean)) {
    const m = part.match(/^(\d+)\s*(?:[-–]\s*(\d+))?$/);
    if (!m) throw new Error(`"${part}" isn't a page or a range like 170-181.`);
    const from = Number(m[1]);
    const to = m[2] ? Number(m[2]) : from;
    if (from < 1 || to < from || to > pageCount)
      throw new Error(`Pages ${part} don't fit in this PDF, which has ${pageCount} pages.`);
    for (let p = from; p <= to; p++) pages.push(p - 1);
  }
  if (pages.length === 0) throw new Error("Type the pages to use, like 170-181.");
  return pages;
}

// pdf-lib opens an encrypted PDF (one locked against changes, which still opens in any viewer)
// but can't decrypt it: copied pages come out blank, so Claude would be paid to read nothing.
export const ENCRYPTED_PDF =
  "This PDF is encrypted (locked against changes), so its pages can't be cut out: they would reach Claude blank. Save an unlocked copy and choose that instead, for example with qpdf --decrypt book.pdf book-unlocked.pdf.";

export async function cutPages(pdf: Uint8Array | ArrayBuffer, range: string): Promise<Uint8Array> {
  const source = await PDFDocument.load(pdf, { ignoreEncryption: true });
  if (source.isEncrypted) throw new Error(ENCRYPTED_PDF);
  const indexes = parsePageRange(range, source.getPageCount());
  const out = await PDFDocument.create();
  for (const page of await out.copyPages(source, indexes)) out.addPage(page);
  return out.save();
}
