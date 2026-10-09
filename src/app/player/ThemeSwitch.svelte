<script lang="ts">
  // One button that cycles Auto (follow the device) → Light → Dark.
  import { applyTheme, loadTheme, nextTheme, type ThemeChoice } from "../lib/theme.ts";

  let choice = $state<ThemeChoice>(loadTheme());
  const label: Record<ThemeChoice, string> = { device: "Auto", light: "Light", dark: "Dark" };
  const icon: Record<ThemeChoice, string> = { device: "◐", light: "☀", dark: "☾" };
</script>

<button
  class="theme"
  title="Light or dark: {label[choice]}. Click to change."
  aria-label="Light or dark, now {label[choice]}"
  onclick={() => {
    choice = nextTheme[choice];
    applyTheme(choice);
  }}
>
  <span aria-hidden="true">{icon[choice]}</span>
  {label[choice]}
</button>

<style>
  .theme {
    background: none;
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 0.1rem 0.65rem;
    font-size: 0.8rem;
    color: var(--text-2);
    white-space: nowrap;
  }
  .theme:hover {
    border-color: var(--hover-border);
    color: var(--text);
  }
</style>
