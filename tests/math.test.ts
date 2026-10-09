import { describe, expect, it } from "vitest";
import { renderInline, renderReading } from "../src/app/lib/math.ts";

describe("math rendering", () => {
  it("renders $...$ as math", () => {
    expect(renderInline("the share $p$ is unknown")).toContain("katex");
  });

  it("keeps an escaped dollar sign as text", () => {
    const html = renderInline("a ticket costs \\$5 or \\$10");
    expect(html).toBe("a ticket costs $5 or $10");
  });

  it("mixes escaped dollars and math in a reading", () => {
    const html = renderReading("It costs \\$5.\n\nThe share is $\\hat{p}$.");
    expect(html).toContain("<p>It costs $5.</p>");
    expect(html).toContain("katex");
  });
});
