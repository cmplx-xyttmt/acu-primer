// Frame-exact render of a concept B piece at 1920x1080: calls window.render(t) per frame,
// screenshots the stage, pipes the frames to ffmpeg. With --stills, saves a PNG every second
// instead of a video (for checking a piece quickly).
// usage: PLAYWRIGHT_CORE=~/Projects/frontend/expii-interview-2/node_modules/playwright-core \
//   node devpost/demo-video/concept-b/render.cjs <piece>.html <out.mp4 | stills-dir> [--stills]
const { chromium } = require(process.env.PLAYWRIGHT_CORE || "playwright-core");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const [, , html, out, mode] = process.argv;
const FPS = 30;
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await page.goto("file://" + path.resolve(html) + "?capture");
  await page.waitForFunction(() => window.DUR && [...document.images].every((i) => i.complete));
  const dur = await page.evaluate(() => window.DUR);
  const stage = page.locator("#stage");
  if (mode === "--stills") {
    fs.mkdirSync(out, { recursive: true });
    for (let t = 0; t <= dur; t += 1) {
      await page.evaluate((t) => window.render(t), t);
      fs.writeFileSync(path.join(out, `t${String(t).padStart(2, "0")}.png`), await stage.screenshot({ type: "png" }));
    }
  } else {
    const ff = spawn("ffmpeg", ["-v", "error", "-y", "-f", "image2pipe", "-framerate", String(FPS), "-i", "-",
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-preset", "medium", "-movflags", "+faststart", out], { stdio: ["pipe", "inherit", "inherit"] });
    for (let i = 0; i < Math.round(dur * FPS); i++) {
      await page.evaluate((t) => window.render(t), i / FPS);
      const buf = await stage.screenshot({ type: "png" });
      if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
    }
    ff.stdin.end();
    await new Promise((r) => ff.on("close", r));
  }
  await browser.close();
  console.log("rendered", out);
})();
