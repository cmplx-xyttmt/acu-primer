import { mount } from "svelte";
// Fonts and KaTeX are bundled, never loaded from a CDN, so offline looks the same as online.
import "@fontsource/plus-jakarta-sans/latin-400.css";
import "@fontsource/plus-jakarta-sans/latin-600.css";
import "@fontsource/plus-jakarta-sans/latin-700.css";
import "@fontsource/ibm-plex-sans/latin-400.css";
import "@fontsource/ibm-plex-sans/latin-600.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "katex/dist/katex.min.css";
import "./theme.css";
import App from "./App.svelte";
import { applyTheme, loadTheme } from "./lib/theme.ts";
import { registerSW } from "virtual:pwa-register";

// Apply the saved light/dark choice before the first render, so the page doesn't flash.
applyTheme(loadTheme());

// Recording mode for the demo video: ?recording=1 hides the Claude spend lines on the author
// side, on this browser, until ?recording=0.
try {
  const r = new URLSearchParams(location.search).get("recording");
  if (r === "1") localStorage.setItem("acu:recording", "1");
  if (r === "0") localStorage.removeItem("acu:recording");
  if (localStorage.getItem("acu:recording")) document.documentElement.dataset.recording = "";
} catch {}

mount(App, { target: document.getElementById("app")! });

// The service worker keeps the app and every opened chapter for offline use. Not in `npm run
// dev`, where the plugin leaves it off; try offline with a build (`npm run preview` or deployed).
registerSW({ immediate: true });

// Ask the browser not to clear the saved copy when the phone runs low on space. If it says no,
// everything still works; the copy can just be cleared sooner.
navigator.storage?.persist?.().catch(() => {});
