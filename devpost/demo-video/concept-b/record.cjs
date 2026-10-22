// Records the real app for concept B, at 1920x1080, with a visible cursor. Run it against a
// Worker on a COPY of the local database (the review clip signs a lesson off), with a throwaway
// passphrase. The paid routes (drafting, Apply with Claude) are blocked in the browser.
// usage: PLAYWRIGHT_CORE=... BASE=http://localhost:8789 PASS=<test passphrase> \
//   node devpost/demo-video/concept-b/record.cjs <out-dir> [clip ...]
const { chromium } = require(process.env.PLAYWRIGHT_CORE || "playwright-core");
const fs = require("fs");
const path = require("path");

const BASE = process.env.BASE || "http://localhost:8789";
const PASS = process.env.PASS;
const [, , outDir, ...only] = process.argv;
const CHAPTER = "/s/openintro-statistics/openintro-sampling";
const DRAFT = "5.1 Point estimates and sampling variability";
const STUDENT = "Amina";

// A cursor dot that follows the mouse, since Playwright's video doesn't show one.
const CURSOR = () => {
  addEventListener("DOMContentLoaded", () => {
    const c = document.createElement("div");
    c.style.cssText = "position:fixed;z-index:99999;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;background:rgb(37 99 235 / .35);border:2px solid rgb(37 99 235 / .9);pointer-events:none;left:-40px;top:-40px;transition:transform .12s";
    document.body.appendChild(c);
    addEventListener("mousemove", (e) => { c.style.left = e.clientX + "px"; c.style.top = e.clientY + "px"; }, true);
    addEventListener("mousedown", () => (c.style.transform = "scale(.7)"), true);
    addEventListener("mouseup", () => (c.style.transform = ""), true);
  });
};

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let mouse = { x: 960, y: 540 };
async function click(page, loc, pause = 500) {
  await loc.waitFor();
  // Into the middle of the screen, clear of the sticky bars at the top and bottom.
  const off = await loc.evaluate((el) => { const r = el.getBoundingClientRect(); return r.top + r.height / 2 - innerHeight / 2; });
  if (Math.abs(off) > 720 * 0.3) await scroll(page, off);
  const b = await loc.boundingBox();
  const x = b.x + b.width / 2, y = b.y + b.height / 2;
  await page.mouse.move(x, y, { steps: 18 });
  mouse = { x, y };
  await wait(250);
  await page.mouse.down(); await wait(70); await page.mouse.up();
  await wait(pause);
}
async function type(page, loc, text) {
  await click(page, loc, 200);
  await loc.pressSequentially(text, { delay: 90 });
  await wait(300);
}
const btn = (page, name) => page.getByRole("button", { name, exact: true });
async function scroll(page, dy) {
  for (let i = 0; i < 8; i++) { await page.mouse.wheel(0, dy / 8); await wait(40); }
  await wait(400);
}

async function clip(browser, name, storage, run, theme = "light") {
  if (only.length && !only.includes(name)) return;
  const dir = path.join(outDir, "raw-" + name);
  fs.rmSync(dir, { recursive: true, force: true });
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5,
    recordVideo: { dir, size: { width: 1920, height: 1080 } },
    serviceWorkers: name === "c06-offline" ? "allow" : "block",
  });
  await ctx.addInitScript(CURSOR);
  await ctx.addInitScript(([s, theme]) => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
    localStorage.setItem("acu:theme", theme);
  }, [storage, theme]);
  await ctx.route(/\/api\/author\/(drafts|lessons\/[^/]+\/steps\/[^/]+\/revise)/, (r) => r.abort());
  const page = await ctx.newPage();
  try {
    await run(page, ctx);
  } catch (err) {
    await page.screenshot({ path: path.join(outDir, name + "-failed.png") });
    throw err;
  }
  await wait(1200);
  const video = page.video();
  await ctx.close();
  fs.renameSync(await video.path(), path.join(outDir, name + ".webm"));
  fs.rmSync(dir, { recursive: true, force: true });
  console.log("recorded", name);
}

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const author = { "acu:authorPassphrase": PASS };
  const student = { "acu:lastName": STUDENT };

  // Shot: a student finds the subject and the chapter, and gives their name once.
  await clip(browser, "c01-home-to-chapter", {}, async (page) => {
    await page.goto(BASE + "/"); await wait(2200);
    await click(page, page.getByRole("link", { name: /OpenIntro Statistics/ }), 2000);
    await click(page, page.locator("a.card").first(), 1500);
    await type(page, page.getByLabel("Your name"), STUDENT);
    await click(page, btn(page, "Start"), 2500);
    await scroll(page, 400); await wait(1500);
  });

  // Shot: the author opens the drafted lesson and reviews it by playing, then signs it off.
  // (Modules 3-10 were approved beforehand in the copy, to keep the clip short.)
  await clip(browser, "c02-review-play", {}, async (page) => {
    await page.goto(BASE + "/author"); await wait(1200);
    await type(page, page.locator("input[type=password]"), PASS);
    await click(page, btn(page, "Open"), 2200);
    const row = page.locator("li, .lesson, tr").filter({ hasText: DRAFT }).filter({ has: page.getByRole("link", { name: /Review/ }).or(page.getByRole("button", { name: /Review/ })) }).first();
    await click(page, row.getByRole("link", { name: /Review/ }).or(row.getByRole("button", { name: /Review/ })).first(), 2500);
    await click(page, btn(page, "Approve and go on"), 1800);
    // Module 1: a wrong answer, the right one, then any other answer.
    await click(page, page.locator(".option").nth(0), 300);
    await click(page, btn(page, "Check"), 1200);
    await scroll(page, 500); await wait(2800);
    await click(page, btn(page, "Answer again"), 600);
    await scroll(page, -300);
    await click(page, page.locator(".option").nth(1), 300);
    await click(page, btn(page, "Check"), 2500);
    await click(page, btn(page, "Answer again"), 500);
    await click(page, page.locator(".option").nth(2), 300);
    await click(page, btn(page, "Check"), 2200);
    await click(page, btn(page, "Show what that student gets"), 2500);
    await click(page, btn(page, "Approve module"), 1800);
    // Module 2: only the right answer, then approving early asks once.
    await scroll(page, 400);
    await click(page, page.locator(".option").filter({ hasText: "Bias" }), 300);
    await click(page, btn(page, "Check"), 2000);
    await click(page, btn(page, "Approve module"), 2200);
    await click(page, btn(page, "Approve anyway"), 1500);
    await click(page, page.locator("nav.steps button").filter({ hasText: "Sign off" }), 1500);
    await click(page, page.locator("section.signoff").getByRole("button", { name: "Sign off" }), 1200);
    await click(page, btn(page, "Yes, sign off"), 2500);
  });

  // Shot: the student plays that lesson. A wrong pick, the hint for that mistake, the simpler
  // question, then the original question again, right.
  await clip(browser, "c03-student-wrong-right", student, async (page) => {
    await page.goto(BASE + CHAPTER); await wait(1800);
    await click(page, page.locator("button.row").filter({ hasText: DRAFT }), 1800);
    await click(page, page.getByRole("button", { name: /Start|Continue/ }).last(), 1500);
    await scroll(page, 500);
    await click(page, page.locator(".option").nth(0), 400);
    await click(page, btn(page, "Check"), 1500);
    await scroll(page, 500); await wait(2500);
    await click(page, page.locator(".fallback .option").filter({ hasText: "1,000 adults" }), 400);
    await click(page, page.locator(".fallback").getByRole("button", { name: "Check" }), 1800);
    await scroll(page, -400);
    await click(page, page.locator(".option").nth(1), 400);
    await click(page, btn(page, "Check"), 3000);
    await click(page, page.getByRole("button", { name: /Continue/ }), 1500);
  });

  // Shot (dark mode): the next module. The student misses the simpler question too, and is sent
  // back to the material, with Try again or Skip for now.
  await clip(browser, "c04-student-fails", student, async (page) => {
    await page.goto(BASE + CHAPTER); await wait(1500);
    await click(page, page.locator("button.row").filter({ hasText: DRAFT }), 1500);
    await click(page, page.getByRole("button", { name: /Start|Continue/ }).last(), 1500);
    // Module 1 again (each clip is a fresh browser), right this time.
    await scroll(page, 500);
    await click(page, page.locator(".option").nth(1), 300);
    await click(page, btn(page, "Check"), 900);
    await click(page, page.getByRole("button", { name: /Continue/ }), 1500);
    await scroll(page, 500);
    await click(page, page.locator(".option").filter({ hasText: "Sampling error" }), 400);
    await click(page, btn(page, "Check"), 1500);
    await scroll(page, 500); await wait(2200);
    await click(page, page.locator(".fallback .option").filter({ hasText: "Yes" }), 400);
    await click(page, page.locator(".fallback").getByRole("button", { name: "Check" }), 2500);
    await scroll(page, 400); await wait(1500);
    await click(page, btn(page, "Skip for now"), 1500);
  }, "dark");

  // Shot: the author sees that student's path.
  await clip(browser, "c05-student-log", author, async (page) => {
    await page.goto(BASE + "/author"); await wait(1500);
    await click(page, page.getByRole("link", { name: /Students/ }).first(), 1800);
    await click(page, page.locator("li, tr").filter({ hasText: STUDENT }).getByRole("link").first(), 2500);
    await scroll(page, 500); await wait(1500); await scroll(page, 500); await wait(2000);
  });

  // Shot: offline. The chapter opened once; then the network goes off and it still works.
  await clip(browser, "c06-offline", student, async (page, ctx) => {
    await page.goto(BASE + CHAPTER); await wait(1500);
    await page.reload(); await wait(2500);
    await ctx.setOffline(true); await wait(500);
    await page.reload(); await wait(2000);
    await click(page, page.locator("button.row").filter({ hasText: DRAFT }), 1500);
    await click(page, page.getByRole("button", { name: /Start|Continue/ }).last(), 1500);
    await scroll(page, 500);
    await click(page, page.locator(".option").nth(0), 400);
    await click(page, btn(page, "Check"), 2500);
    await ctx.setOffline(false);
  });

  // Shot set-up: the draft screen, filled in, before Draft is pressed (Isaac records the paid
  // draft himself, or approves it).
  await clip(browser, "c07-draft-screen", author, async (page) => {
    await page.goto(BASE + "/author"); await wait(1500);
    await click(page, page.getByRole("link", { name: /Draft a lesson/ }).first(), 2500);
    await scroll(page, 300); await wait(2000);
  });

  await browser.close();
})();
