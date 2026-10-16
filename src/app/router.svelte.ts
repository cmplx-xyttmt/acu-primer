// A small address-to-screen router. The address is kept in a rune so App.svelte re-renders
// when it changes, and moving around never reloads the page.

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
  path = url.pathname;
  search = url.search;
}
