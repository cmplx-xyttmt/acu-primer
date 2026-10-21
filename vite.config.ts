import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { cloudflare } from "@cloudflare/vite-plugin";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    svelte(),
    cloudflare(),
    // The service worker (spec.md > Components > Offline support). It stores the app, fonts
    // and KaTeX when the app first loads, and a copy of every course response, so a course
    // opened once keeps working without a connection. Nothing on the author side is cached.
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: null, // registered in src/app/main.ts
      manifest: false,
      workbox: {
        // woff2 is enough: every browser that runs service workers reads it.
        globPatterns: ["**/*.{js,css,html,woff2,svg,png,ico}"],
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // Fresh when online, the saved copy when not (or when the network is too slow).
            // Chapters, and the subject lists that lead to them.
            urlPattern: ({ url }) => url.pathname.startsWith("/api/chapters/") || url.pathname.startsWith("/api/subjects"),
            handler: "NetworkFirst",
            options: { cacheName: "courses", networkTimeoutSeconds: 5 },
          },
        ],
      },
    }),
  ],
});
