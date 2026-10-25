// A small address-to-screen router. The address is kept in a rune so App.svelte re-renders
// when it changes, and moving around never reloads the page.

import { appUpdate } from "./lib/appUpdate.svelte.ts";

let path = $state(location.pathname);
let search = $state(location.search);

addEventListener("popstate", () => {
  path = location.pathname;
  search = location.search;
});

export const route = {
  get path() {
    return path;
  },
  get search() {
    return search;
  },
};

export function navigate(to: string) {
  const url = new URL(to, location.origin);
  if (url.pathname === path && url.search === search) return;
  history.pushState({}, "", to);
  // A new deploy is waiting: moving to another page is a good moment to switch to it.
  if (appUpdate.ready) return appUpdate.now();
  path = url.pathname;
  search = url.search;
  scrollTo(0, 0); // a new screen starts at its top, as a page load would
}
