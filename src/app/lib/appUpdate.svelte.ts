// A new deploy, waiting to take over. The service worker keeps the app for offline use, so
// after a deploy the open page still runs the old version. Rather than reloading by itself
// (which could land in the middle of a module), the app shows a banner, and applies the update
// on the next move to another page (navigate() in the router) or when Reload is pressed.

import { registerSW } from "virtual:pwa-register";

let ready = $state(false);
let apply: ((reload?: boolean) => Promise<void>) | null = null;

export const appUpdate = {
  get ready() {
    return ready;
  },
  /** Switch to the new version: the page reloads, at whatever address it's on by then. */
  now() {
    void apply?.(true);
  },
};

// A plain link loads a whole page, which the old version would still serve while the new one
// waits. So a link click switches to the new version, landing on the link's address.
function onLinkClick(e: MouseEvent) {
  if (!ready || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
  if (!a || a.target || a.hasAttribute("download") || a.origin !== location.origin) return;
  e.preventDefault();
  history.pushState({}, "", a.href);
  appUpdate.now();
}

export function startUpdates() {
  document.addEventListener("click", onLinkClick);
  apply = registerSW({
    immediate: true,
    onNeedRefresh: () => (ready = true),
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      // Look for a new deploy when the tab comes back into view, and every 30 minutes.
      const check = () => void registration.update().catch(() => {});
      document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && check());
      setInterval(check, 30 * 60 * 1000);
    },
  });
}
