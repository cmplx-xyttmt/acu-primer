// The student's light/dark choice, kept on this device. "device" follows the operating
// system's setting (the default); "light" and "dark" override it via data-theme on <html>,
// which theme.css reads.

export type ThemeChoice = "device" | "light" | "dark";

const KEY = "acu:theme";

export function loadTheme(): ThemeChoice {
  try {
    const saved = localStorage.getItem(KEY);
    return saved === "light" || saved === "dark" ? saved : "device";
  } catch {
    return "device";
  }
}

export function applyTheme(choice: ThemeChoice) {
  const root = document.documentElement;
  if (choice === "device") delete root.dataset.theme;
  else root.dataset.theme = choice;
  try {
    if (choice === "device") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, choice);
  } catch {
    // Storage unavailable: the choice lasts only for this visit.
  }
}

export const nextTheme: Record<ThemeChoice, ThemeChoice> = { device: "light", light: "dark", dark: "device" };
