// Small helpers shared by the concept B pieces. Everything is a pure function of time.
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const easeIO = (x) => { x = clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const easeOut = (x) => 1 - Math.pow(1 - clamp(x), 3);
// 0 before a, 1 after b, eased in between.
const seg = (t, a, b, e = easeIO) => e((t - a) / (b - a));
const lerp = (a, b, k) => a + (b - a) * k;
function style(el, s) { for (const k in s) el.style[k] = s[k]; }
// In a browser the piece loops (click to pause); ?capture leaves the clock to render.cjs.
function play(render, dur) {
  window.render = render; window.DUR = dur;
  const stage = document.getElementById("stage");
  const fit = () => { const k = Math.min(innerWidth / 1920, innerHeight / 1080); stage.style.transform = `scale(${k})`; };
  if (location.search.includes("capture")) { render(0); return; }
  fit(); addEventListener("resize", fit);
  let start = performance.now(), paused = false, at = 0;
  addEventListener("click", () => { paused = !paused; if (!paused) start = performance.now() - at * 1000; });
  (function tick(now) { if (!paused) { at = ((now - start) / 1000) % (dur + 1); render(Math.min(at, dur)); } requestAnimationFrame(tick); })(start);
}
const LOGO = `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="5" y="5" width="54" height="54" rx="16" fill="#fff" stroke="#2563eb" stroke-width="3.5"/><path d="M13 42h38" stroke="#2563eb" stroke-width="5" stroke-linecap="round"/><path d="M21 42c2-15 19-15 21 0" fill="none" stroke="#e4a72e" stroke-width="4" stroke-linecap="round" stroke-dasharray="1 6.5"/><circle cx="51" cy="42" r="5" fill="#facc15" stroke="#2563eb" stroke-width="2.5"/></svg>`;
