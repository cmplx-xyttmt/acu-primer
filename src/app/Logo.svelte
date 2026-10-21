<script lang="ts">
  // The acu-primer mark (option 5, "Detour"): a path takes a wrong turn and is brought back to
  // where it was going, the lesson's fallback in one shape. Colours follow the theme: the path
  // in the accent (blue, or amber at night), the detour in amber, the goal in sun yellow.
  let { size = 28, wordmark = true }: { size?: number; wordmark?: boolean } = $props();
</script>

<span class="logo">
  <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
    <rect x="5" y="5" width="54" height="54" rx="16" fill="var(--card)" stroke="var(--accent)" stroke-width="3.5" />
    <path d="M13 42h38" stroke="var(--accent)" stroke-width="5" stroke-linecap="round" />
    <path d="M21 42c2-15 19-15 21 0" fill="none" stroke="var(--fallback-edge)" stroke-width="4" stroke-linecap="round" stroke-dasharray="1 6.5" />
    <circle cx="51" cy="42" r="5" fill="var(--sun)" stroke="var(--accent)" stroke-width="2.5" />
  </svg>
  {#if wordmark}<span class="word">acu<em>primer</em></span>{/if}
</span>

<style>
  .logo {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    color: var(--text);
  }
  svg {
    flex: none;
  }
  .word {
    font-weight: 700;
    font-size: 1.05rem;
    letter-spacing: -0.01em;
  }
  em {
    font-style: normal;
    color: var(--accent);
  }
</style>
