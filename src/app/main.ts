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

mount(App, { target: document.getElementById("app")! });
