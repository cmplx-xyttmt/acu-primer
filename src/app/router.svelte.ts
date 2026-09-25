// A small address-to-screen router. The address is kept in a rune so App.svelte re-renders
// when it changes, and moving around never reloads the page.

let path = $state(location.pathname);

addEventListener("popstate", () => {
  path = location.pathname;
});

export const route = {
  get path() {
    return path;
  },
};

export function navigate(to: string) {
  if (to === path) return;
  history.pushState({}, "", to);
  path = to;
}
