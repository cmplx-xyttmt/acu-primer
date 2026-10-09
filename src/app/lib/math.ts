// Turns lesson text into HTML: paragraphs split by blank lines, $...$ inline math,
// $$...$$ display math (KaTeX), **bold** and *italic*. Everything outside math is escaped.

import katex from "katex";

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const emphasis = (s: string) =>
  escape(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>");

const math = (tex: string, displayMode: boolean) =>
  katex.renderToString(tex, { displayMode, throwOnError: false });

// "\$" is a literal dollar sign, not math. It's swapped for a placeholder before splitting
// on $ and swapped back when the text is escaped.
const DOLLAR = "\u0000";
const hideDollars = (s: string) => s.replace(/\\\$/g, DOLLAR);
const showDollars = (s: string) => s.replaceAll(DOLLAR, "$");

/** One line of text with inline math, for prompts and answer options. */
export function renderInline(text: string): string {
  return hideDollars(text)
    .split(/(\$[^$]+?\$)/g)
    .map((part) =>
      part.startsWith("$") && part.length > 1 ? math(part.slice(1, -1), false) : showDollars(emphasis(part)),
    )
    .join("");
}

/** A module's reading: paragraphs and display math blocks. */
export function renderReading(text: string): string {
  return hideDollars(text)
    .split(/\n\s*\n/)
    .map((para) =>
      para
        .split(/(\$\$[\s\S]+?\$\$)/g)
        .map((part) =>
          part.startsWith("$$")
            ? `<div class="display-math">${math(part.slice(2, -2), true)}</div>`
            : part.trim()
              ? `<p>${renderInline(part.trim())}</p>`
              : "",
        )
        .join(""),
    )
    .join("");
}
