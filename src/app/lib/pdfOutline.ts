// Read a PDF's bookmarks (its outline) and page count, in the browser, with pdf-lib (already
// used to cut pages, so nothing new to download). A bookmark points to a page directly, or
// through a named destination, or through a GoTo action; all three are followed. Shared with
// scripts, so it works on bytes.

import { PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFRef, PDFString, type PDFObject } from "pdf-lib";
import type { OutlineItem } from "../../shared/bookPlan.ts";
import { ENCRYPTED_PDF } from "./pdfPages.ts";

export interface PdfBook {
  title: string | null; // from the PDF's own metadata, often missing or unhelpful
  pageCount: number;
  outline: OutlineItem[];
}

const MAX_ITEMS = 2000;

export async function readBook(bytes: Uint8Array | ArrayBuffer): Promise<PdfBook> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  if (doc.isEncrypted) throw new Error(ENCRYPTED_PDF); // its bookmarks would read as garbage
  const ctx = doc.context;
  const lookup = (o: PDFObject | undefined): PDFObject | undefined => (o instanceof PDFRef ? ctx.lookup(o) : o);
  const text = (o: PDFObject | undefined): string | null => {
    const v = lookup(o);
    return v instanceof PDFString || v instanceof PDFHexString ? v.decodeText() : v instanceof PDFName ? v.decodeText() : null;
  };
  const pageOf = new Map(doc.getPages().map((p, i) => [p.ref.toString(), i + 1]));

  // Named destinations: an old-style /Dests dictionary, or the /Names /Dests name tree.
  const named = new Map<string, PDFObject>();
  const dests = lookup(doc.catalog.get(PDFName.of("Dests")));
  if (dests instanceof PDFDict) for (const [k, v] of dests.entries()) named.set(k.decodeText(), v);
  const names = lookup(doc.catalog.get(PDFName.of("Names")));
  const walkTree = (node: PDFObject | undefined, depth: number) => {
    const n = lookup(node);
    if (!(n instanceof PDFDict) || depth > 20) return;
    const pairs = lookup(n.get(PDFName.of("Names")));
    if (pairs instanceof PDFArray)
      for (let i = 0; i + 1 < pairs.size(); i += 2) {
        const key = text(pairs.get(i));
        if (key !== null) named.set(key, pairs.get(i + 1));
      }
    const kids = lookup(n.get(PDFName.of("Kids")));
    if (kids instanceof PDFArray) for (let i = 0; i < kids.size(); i++) walkTree(kids.get(i), depth + 1);
  };
  if (names instanceof PDFDict) walkTree(names.get(PDFName.of("Dests")), 0);

  const pageFromDest = (d: PDFObject | undefined, hops = 0): number | null => {
    const v = lookup(d);
    if (hops > 3 || v === undefined) return null;
    if (v instanceof PDFArray) {
      const first = v.get(0);
      return first instanceof PDFRef ? (pageOf.get(first.toString()) ?? null) : null;
    }
    if (v instanceof PDFDict) return pageFromDest(v.get(PDFName.of("D")), hops + 1); // {D: [...]}
    const name = text(v);
    return name !== null && named.has(name) ? pageFromDest(named.get(name), hops + 1) : null;
  };

  let count = 0;
  const seen = new Set<string>();
  const items = (first: PDFObject | undefined, depth: number): OutlineItem[] => {
    const out: OutlineItem[] = [];
    let ref = first;
    while (ref && count < MAX_ITEMS) {
      const key = ref instanceof PDFRef ? ref.toString() : "";
      if (key && seen.has(key)) break; // a loop in a broken PDF
      if (key) seen.add(key);
      const item = lookup(ref);
      if (!(item instanceof PDFDict)) break;
      count++;
      const action = lookup(item.get(PDFName.of("A")));
      const dest = item.get(PDFName.of("Dest")) ?? (action instanceof PDFDict ? action.get(PDFName.of("D")) : undefined);
      out.push({
        title: text(item.get(PDFName.of("Title"))) ?? "Untitled",
        page: pageFromDest(dest),
        children: depth < 3 ? items(item.get(PDFName.of("First")), depth + 1) : [],
      });
      ref = item.get(PDFName.of("Next"));
    }
    return out;
  };
  const outlines = lookup(doc.catalog.get(PDFName.of("Outlines")));
  const outline = outlines instanceof PDFDict ? items(outlines.get(PDFName.of("First")), 0) : [];

  return { title: doc.getTitle()?.trim() || null, pageCount: doc.getPageCount(), outline };
}
