<script lang="ts">
  // The review mark every lesson carries on the author side: a badge (tinted, not pressable),
  // never styled like the Review button next to it.
  import BadgeCheck from "@lucide/svelte/icons/badge-check";
  import CircleDashed from "@lucide/svelte/icons/circle-dashed";
  import type { LessonStatus } from "../../shared/lesson.ts";
  let { status, short = false }: { status: LessonStatus; short?: boolean } = $props();
</script>

{#if status === "reviewed"}
  <span class="badge badge-done"><BadgeCheck size={14} aria-hidden="true" />{short ? "Reviewed" : "Reviewed by a person"}</span>
{:else}
  <span class="badge badge-draft"><CircleDashed size={14} aria-hidden="true" />{short ? "Draft" : "Written by the model, not yet reviewed"}</span>
{/if}
