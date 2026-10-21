<script lang="ts">
  // The author side's slim top bar: the logo (to the author home), a link back to the student
  // side, and the light/dark switch. Every author screen has it, so "where am I" is never a
  // question. An optional back link sits under it.
  import ArrowLeft from "@lucide/svelte/icons/arrow-left";
  import Logo from "../Logo.svelte";
  import ThemeSwitch from "../player/ThemeSwitch.svelte";
  import { navigate } from "../router.svelte.ts";

  let { back = null }: { back?: { href: string; label: string } | null } = $props();
  const go = (e: MouseEvent, to: string) => {
    e.preventDefault();
    navigate(to);
  };
</script>

<header class="bar">
  <div class="inner">
    <a class="home" href="/author" onclick={(e) => go(e, "/author")} aria-label="Author home">
      <Logo size={26} />
      <span class="badge badge-review">Author</span>
    </a>
    <span class="right">
      <a class="btn-quiet btn-sm" href="/">Student view</a>
      <ThemeSwitch />
    </span>
  </div>
</header>
{#if back}
  <div class="back">
    <a class="btn-quiet btn-sm" href={back.href} onclick={(e) => go(e, back!.href)}><ArrowLeft size={15} aria-hidden="true" />{back.label}</a>
  </div>
{/if}

<style>
  .bar {
    border-bottom: 1px solid var(--border);
    background: var(--card);
  }
  .inner {
    max-width: 52rem;
    margin: 0 auto;
    padding: 0.55rem 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
  }
  .home {
    display: inline-flex;
    align-items: center;
    gap: 0.55rem;
    text-decoration: none;
  }
  .right {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  /* On a phone: the mark without its name, so the bar fits on one line. */
  @media (max-width: 480px) {
    .home :global(.word) {
      display: none;
    }
    .inner {
      gap: 0.5rem;
    }
  }
  .back {
    max-width: 52rem;
    margin: 0.6rem auto 0;
    padding: 0 10px;
  }
</style>
