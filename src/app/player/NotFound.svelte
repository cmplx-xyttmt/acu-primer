<script lang="ts">
  // Any address the app doesn't know, including links from before subjects existed.
  import Logo from "../Logo.svelte";
  import ThemeSwitch from "./ThemeSwitch.svelte";
  import ArrowLeft from "@lucide/svelte/icons/arrow-left";
</script>

<div class="topbar">
  <a class="home" href="/" aria-label="All subjects"><Logo size={24} /></a>
  <ThemeSwitch />
</div>
<main class="page">
  <h1>No page here</h1>
  <p class="muted">Nothing lives at this address. The link may be from an older version of the site.</p>
  <p><a class="up" href="/"><ArrowLeft size={14} aria-hidden="true" />All subjects</a></p>
</main>

<style>
  .topbar {
    max-width: 52rem;
    margin: 0 auto;
    padding: 0.8rem 16px 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .home {
    text-decoration: none;
  }
  .up {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-weight: 600;
    text-decoration: none;
  }
</style>
