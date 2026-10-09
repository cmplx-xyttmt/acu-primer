// Cut a page range out of a book PDF, for a Claude Code session to read:
//
//   npx tsx scripts/cut-pages.ts <book.pdf> <pages> [out.pdf]
//
// Pages are as the PDF viewer numbers them. The output defaults to content/drafts/pages/,
// which is gitignored, so book pages never end up in the repo.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { basename, dirname } from "node:path";
import { cutPages } from "../src/app/lib/pdfPages.ts";

const [pdfPath, pages, outArg] = process.argv.slice(2);
if (!pdfPath || !pages) {
  console.error("Usage: npx tsx scripts/cut-pages.ts <book.pdf> <pages> [out.pdf]");
  process.exit(1);
}
const out = outArg ?? `content/drafts/pages/${basename(pdfPath, ".pdf").replace(/\W+/g, "-")}-${pages.replace(/\W+/g, "_")}.pdf`;
mkdirSync(dirname(out), { recursive: true });
const cut = await cutPages(readFileSync(pdfPath), pages);
writeFileSync(out, cut);
console.log(`${out} (${(cut.length / 1024).toFixed(0)} KB)`);
