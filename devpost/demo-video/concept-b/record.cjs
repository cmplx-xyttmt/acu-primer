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
// The one clip allowed to spend: Start from a book, then a real draft (about $1.30). Run it only
// against the database the lesson should stay in, and only when asked to.
const PAID_CLIP = "c08-book-and-draft";
// The same flow with the app's fake drafting (Oct 25): run it only against a Worker started with
// FAKE_DRAFTS=all-done on localhost. No Claude call is made; the draft takes about 12 s and saves
// a "[Fake]" copy of a sample lesson, which the clip doesn't open.
const FAKE_CLIP = "c08-fake-draft";
const BOOK = { path: "/test-book.pdf", name: "Algorithms-JeffE.pdf", title: "Algorithms, by Jeff Erickson", chapter: "Recursion", section: "Tower of Hanoi" };

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

// Every clip records in dark mode (Isaac, Oct 25); pass "light" to record one in the light look.
async function clip(browser, name, storage, run, theme = "dark") {
  if (only.length && !only.includes(name)) return;
  const dir = path.join(outDir, "raw-" + name);
  fs.rmSync(dir, { recursive: true, force: true });
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5, colorScheme: theme,
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
  // The paid routes stay blocked, except in the one clip that records a real draft.
  // Reading a book's contents pages is a Claude call too (Erickson's bookmarks make it unneeded).
  if (name === FAKE_CLIP) await ctx.route(/\/api\/author\/(books\/contents|lessons\/[^/]+\/steps\/[^/]+\/revise)/, (r) => r.abort());
  else if (name !== PAID_CLIP) await ctx.route(/\/api\/author\/(drafts|books\/contents|lessons\/[^/]+\/steps\/[^/]+\/revise)/, (r) => r.abort());
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
  const author = { "acu:authorPassphrase": PASS, "acu:recording": "1" };
  const student = { "acu:lastName": STUDENT };

  // Shot: a student finds the subject and the chapter, and gives their name once.
  await clip(browser, "c01-home-to-chapter", {}, async (page) => {
    await page.goto(BASE + "/"); await wait(2200);
    await click(page, page.getByRole("link", { name: /Intro to Statistics/ }), 2000);
    await click(page, page.locator("a.card").first(), 1500);
    await type(page, page.getByLabel("Your name"), STUDENT);
    await click(page, btn(page, "Start"), 2500);
    await scroll(page, 400); await wait(1500);
  });

  // Shot: the author opens the drafted lesson and reviews it by playing, then signs it off.
  // (Modules 3-10 were approved beforehand in the copy, to keep the clip short.)
  await clip(browser, "c02-review-play", { "acu:recording": "1" }, async (page) => {
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

  // Shot: the next module. The student misses the simpler question too, and is sent
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
  });

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
    await click(page, page.getByRole("link", { name: /Draft (a lesson|lessons)/ }).first(), 2500);
    await scroll(page, 300); await wait(2000);
  });

  // --- The Erickson clips (Oct 23), run against a copy of the database after the real draft ---
  const HANOI = "recursion-tower-of-hanoi-c16db1";
  const HANOI_CHAPTER = "/s/algorithms-by-jeff-erickson/recursion";
  // The lesson as students get it, to find right answers without hard-coding them.
  const hanoiContent = (page) =>
    page.evaluate(async (id) => {
      const r = await fetch("/api/chapters/recursion").then((x) => x.json());
      return r.lessons.find((l) => l.id === id).content;
    }, HANOI);
  // Sort the tray: tap each item (the next one is picked up by itself), then its category.
  async function sortAll(page, placements) {
    const heads = page.locator(".cat-head");
    const labels = await heads.allTextContents();
    for (const cat of placements) await click(page, heads.nth(labels.findIndex((l) => l.trim() === cat)), 250);
  }
  async function firstChip(page) {
    await click(page, page.locator(".tray .chip").first(), 300);
  }

  // Shot: review the drafted lesson by playing it, then sign it off. (Modules 2, 4, 5 and 6 were
  // approved beforehand in the copy, to keep the clip short.)
  await clip(browser, "c09-hanoi-review", author, async (page) => {
    await page.goto(BASE + "/author/lessons/" + HANOI); await wait(2500);
    await click(page, btn(page, "Approve and go on"), 1800);
    // Module 1, the sort: a known mistake ("lift two disks at once" as allowed), then right.
    await firstChip(page);
    await sortAll(page, ["Allowed", "Allowed", "Not allowed", "Allowed", "Allowed", "Allowed"]);
    await click(page, btn(page, "Check"), 1500);
    await scroll(page, 450); await wait(3000);
    await click(page, btn(page, "Answer again"), 600);
    await scroll(page, -500);
    await firstChip(page);
    await sortAll(page, ["Allowed", "Allowed", "Not allowed", "Not allowed", "Allowed", "Allowed"]);
    await click(page, btn(page, "Check"), 2500);
    await click(page, btn(page, "Approve module"), 1500);
    await click(page, btn(page, "Approve anyway"), 1500);
    // Module 3, the stepper exploration, predicting wrong on purpose, then the check.
    await click(page, page.locator("nav.steps button").filter({ hasText: /^3/ }), 1500);
    await scroll(page, 500);
    await click(page, page.locator(".explore .option").first(), 400);
    await click(page, page.getByRole("button", { name: /Lock in/ }), 800);
    for (let i = 0; i < 7; i++) await click(page, page.getByRole("button", { name: /Next step/ }), 700);
    await scroll(page, 400); await wait(3500);
    const n = page.locator("input.num");
    await click(page, n, 200); await n.pressSequentially("3", { delay: 120 });
    await click(page, btn(page, "Check"), 2200);
    await click(page, btn(page, "Approve module"), 1200);
    await click(page, btn(page, "Approve anyway"), 1500);
    await click(page, page.locator("nav.steps button").filter({ hasText: "Sign off" }), 1500);
    await click(page, page.locator("section.signoff").getByRole("button", { name: "Sign off" }), 1200);
    await click(page, btn(page, "Yes, sign off"), 2500);
  });

  // Shot: a student finds the new subject and plays the lesson: a wrong sort and the hint for
  // that mistake, then right; the stepper with a wrong prediction; the check after it.
  await clip(browser, "c10-hanoi-student", {}, async (page) => {
    await page.goto(BASE + "/"); await wait(2200);
    await click(page, page.getByRole("link", { name: /Algorithms, by Jeff Erickson/ }), 2000);
    await click(page, page.locator("a.card").first(), 1500);
    await type(page, page.getByLabel("Your name"), STUDENT);
    await click(page, btn(page, "Start"), 2000);
    const c = await hanoiContent(page);
    await click(page, page.getByRole("button", { name: /Start|Continue/ }).last(), 1500);
    await scroll(page, 450);
    await firstChip(page);
    await sortAll(page, ["Allowed", "Allowed", "Not allowed", "Allowed", "Allowed", "Allowed"]);
    await click(page, btn(page, "Check"), 1500);
    await scroll(page, 450); await wait(3000);
    // The hint's simpler question, if there is one, answered right; else "Try the question again".
    const w = c.modules[0].check.wrongAnswers.find((x) => x.match.itemId === "i4");
    const sq = w?.fallback.simplerQuestion?.enabled ? w.fallback.simplerQuestion.check : null;
    if (sq && sq.type === "select") {
      await click(page, page.locator(".fallback .option").filter({ hasText: sq.options.find((o) => o.id === sq.answer).text }), 400);
      await click(page, page.locator(".fallback").getByRole("button", { name: "Check" }), 1500);
    } else {
      await click(page, page.getByRole("button", { name: /Try the question again/ }), 1200);
    }
    await scroll(page, -400);
    await firstChip(page);
    await sortAll(page, ["Allowed", "Allowed", "Not allowed", "Not allowed", "Allowed", "Allowed"]);
    await click(page, btn(page, "Check"), 2500);
    await click(page, page.getByRole("button", { name: /Continue/ }), 1500);
    // Module 2, right.
    const m2 = c.modules[1].check;
    await scroll(page, 450);
    await click(page, page.locator(".option").filter({ hasText: m2.options.find((o) => o.id === m2.answer).text }), 400);
    await click(page, btn(page, "Check"), 2000);
    await click(page, page.getByRole("button", { name: /Continue/ }), 1500);
    // Module 3: the stepper, predicting wrong.
    await scroll(page, 500);
    await click(page, page.locator(".explore .option").first(), 400);
    await click(page, page.getByRole("button", { name: /Lock in/ }), 800);
    for (let i = 0; i < 7; i++) await click(page, page.getByRole("button", { name: /Next step/ }), 650);
    await scroll(page, 400); await wait(4000);
  });

  // Shot: statistics too. The sampling exploration in OpenIntro 5.1 (the session draft, shown to
  // students in the copy). It opens on the statistics subject page for a moment, so the change of
  // subject shows (Isaac, Oct 24).
  await clip(browser, "c11-sampling", { "acu:lastName": "Tendo" }, async (page) => {
    await page.goto(BASE + "/s/openintro-statistics"); await wait(1600);
    await click(page, page.locator("a.card").first(), 1800);
    const draft = page.locator("button.row").filter({ hasText: "5.1 Point" });
    await click(page, draft, 1200);
    await click(page, page.getByRole("button", { name: /Start|Continue/ }).last(), 1200);
    const c = await page.evaluate(async () => (await fetch("/api/chapters/openintro-sampling").then((x) => x.json())).lessons.find((l) => (l.title ?? l.content.title).startsWith("5.1")).content);
    const m1 = c.modules[0].check;
    await click(page, page.locator(".option").nth(m1.options.findIndex((o) => o.id === m1.answer)), 200);
    await click(page, btn(page, "Check"), 600);
    await click(page, page.getByRole("button", { name: /Continue/ }), 900);
    await firstChip(page);
    const m2 = c.modules[1].check;
    await sortAll(page, m2.items.map((i) => m2.categories.find((x) => x.id === i.category).label));
    await click(page, btn(page, "Check"), 700);
    await click(page, page.getByRole("button", { name: /Continue/ }), 1200);
    await scroll(page, 450);
    await click(page, page.locator(".explore .option").first(), 400);
    await click(page, page.getByRole("button", { name: /Lock in/ }), 800);
    await click(page, page.getByRole("button", { name: /Draw/ }), 1500);
    await click(page, page.locator(".explore .value").filter({ hasText: /^1000$/ }), 400);
    await click(page, page.getByRole("button", { name: /Draw/ }), 2500);
    await scroll(page, 450); await wait(4500);
  });

  // Shot: the author sees Amina's path through the Erickson lesson.
  await clip(browser, "c12-hanoi-log", author, async (page) => {
    await page.goto(BASE + "/author/chapters/recursion/students"); await wait(2000);
    await click(page, page.locator("li, tr").filter({ hasText: STUDENT }).getByRole("link").first(), 2500);
    await scroll(page, 450); await wait(1800); await scroll(page, 450); await wait(2200);
  });

  // Shot: start from a book, then the draft screen with one section ticked. The PDF is handed to
  // the file input from the page (the native picker can't be driven); it's served from
  // dist/client for the recording only. "c08-book-to-draft" stops with the cursor on Draft and
  // spends nothing; PAID_CLIP presses Draft for real and runs only when named; FAKE_CLIP presses
  // Draft on a fake-drafting Worker and stops when the queue item is done.
  async function bookToDraft(page, mode) {
    await page.goto(BASE + "/author"); await wait(2000);
    await click(page, page.getByRole("link", { name: /Start from a book/ }), 1800);
    await page.evaluate(async (b) => {
      const blob = await fetch(b.path).then((r) => r.blob());
      const input = document.querySelector("input[type=file]");
      const dt = new DataTransfer();
      dt.items.add(new File([blob], b.name, { type: "application/pdf" }));
      input.files = dt.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, BOOK);
    await page.locator(".chapters").waitFor({ timeout: 60000 }); await wait(1500);
    const title = page.locator(".field input").first();
    await click(page, title, 200);
    await title.fill(""); await title.pressSequentially(BOOK.title, { delay: 60 }); await wait(600);
    await scroll(page, 500); await wait(1200);
    await click(page, page.locator(".chapters > li").filter({ hasText: BOOK.chapter }).first().locator("summary"), 2500);
    await scroll(page, 700); await wait(1000);
    await click(page, page.locator(".preset").first(), 1200);
    await click(page, page.getByRole("button", { name: /Create the subject/ }), 2500);
    // The new subject is last on the author home, closed like the others; open it.
    const chapterId = await page.evaluate(async (b) => {
      const r = await fetch("/api/author/subjects", { headers: { "x-author-passphrase": localStorage.getItem("acu:authorPassphrase") } }).then((x) => x.json());
      const subject = r.subjects.filter((x) => x.title === b.title).at(-1);
      return subject.chapters.find((c) => c.title === b.chapter).id;
    }, BOOK);
    await click(page, page.locator("button.toggle").filter({ hasText: BOOK.title }).last(), 1500);
    await click(page, page.locator(`a[href="/author/chapters/${chapterId}/draft"]`), 2500);
    const row = page.locator(".sections li").filter({ hasText: BOOK.section });
    await click(page, row.getByRole("checkbox"), 1500);
    const draft = page.getByRole("button", { name: "Draft", exact: true });
    if (mode === "hover") {
      await draft.scrollIntoViewIfNeeded(); await wait(400);
      const b = await draft.boundingBox();
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 18 });
      await wait(3000);
      return;
    }
    if (mode === "fake") {
      const fake = await page.evaluate(() => fetch("/api/author/budget", { headers: { "x-author-passphrase": localStorage.getItem("acu:authorPassphrase") } }).then((r) => r.json()).then((b) => b.fake === true));
      if (!fake) throw new Error("fake drafting is off on this Worker; not pressing Draft");
      await click(page, draft, 1000);
      await page.locator(".queue li.done").waitFor({ timeout: 60000 });
      await wait(4000);
      return;
    }
    await click(page, draft, 1000);
    await page.locator(".queue li.done").getByRole("link", { name: "Review" }).waitFor({ timeout: 20 * 60 * 1000 });
    await wait(3000);
    await click(page, page.locator(".queue li.done").getByRole("link", { name: "Review" }), 3000);
  }
  // Last, since it adds a second copy of the Erickson subject to the database.
  await clip(browser, "c08-book-to-draft", author, (page) => bookToDraft(page, "hover"));
  if (only.includes(FAKE_CLIP)) await clip(browser, FAKE_CLIP, author, (page) => bookToDraft(page, "fake"));
  if (only.includes(PAID_CLIP)) await clip(browser, PAID_CLIP, author, (page) => bookToDraft(page, "paid"));

  await browser.close();
})();
