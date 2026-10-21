<script lang="ts">
  // One button that cycles Auto (follow the device) → Light → Dark.
  import SunMoon from "@lucide/svelte/icons/sun-moon";
  import Sun from "@lucide/svelte/icons/sun";
  import Moon from "@lucide/svelte/icons/moon";
  import { applyTheme, loadTheme, nextTheme, type ThemeChoice } from "../lib/theme.ts";

  let choice = $state<ThemeChoice>(loadTheme());
  const label: Record<ThemeChoice, string> = { device: "Auto", light: "Light", dark: "Dark" };
  const Icon = $derived(choice === "light" ? Sun : choice === "dark" ? Moon : SunMoon);
</script>

<button
  class="btn-quiet btn-sm theme"
  title="Light or dark: {label[choice]}. Click to change."
  aria-label="Light or dark, now {label[choice]}"
  onclick={() => {
    choice = nextTheme[choice];
    applyTheme(choice);
  }}
>
  <Icon size={15} aria-hidden="true" />
  <span class="text">{label[choice]}</span>
</button>

<style>
  .theme {
    border: 1px solid var(--border);
    border-radius: 999px;
    font-size: 0.8rem;
  }
  /* On narrow screens, just the icon: top bars have little room. */
  @media (max-width: 480px) {
    .text {
      display: none;
    }
  }
</style>
