// Frame-exact render of a prototype page: calls window.render(t) per frame, screenshots, pipes to ffmpeg.
// usage: node devpost/demo-video/render.cjs <concept>/index.html media/renders/<concept>.mp4 [fps]
// Needs playwright-core 1.45.x (matches the Chromium 1124 already in ~/Library/Caches/ms-playwright).
// Point PLAYWRIGHT_CORE at a copy, e.g. ~/Projects/frontend/expii-interview-2/node_modules/playwright-core
const { chromium } = require(process.env.PLAYWRIGHT_CORE || "playwright-core");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const [, , html, out, fpsArg, stills] = process.argv;
const FPS = Number(fpsArg || 30);
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  await page.goto("file://" + path.resolve(html) + "?capture");
  await page.evaluate(() => document.fonts.ready);
  const dur = await page.evaluate(() => window.DUR);
  const n = Math.round(dur * FPS);
  const ff = spawn("ffmpeg", ["-v", "error", "-y", "-f", "image2pipe", "-framerate", String(FPS), "-i", "-",
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-preset", "slow", "-movflags", "+faststart", out], { stdio: ["pipe", "inherit", "inherit"] });
  const stage = page.locator("#stage");
  for (let i = 0; i < n; i++) {
    const t = i / FPS;
    await page.evaluate((t) => window.render(t), t);
    const buf = await stage.screenshot({ type: "png" });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
    if (stills && i % (FPS * 2) === 0) fs.writeFileSync(path.join(stills, `f${String(t).padStart(2, "0")}.png`), buf);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on("close", r));
  await browser.close();
  console.log("rendered", out, n, "frames");
})();
