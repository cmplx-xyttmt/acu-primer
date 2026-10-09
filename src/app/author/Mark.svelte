<script lang="ts">
  // The review mark every lesson carries on the author side.
  import type { LessonStatus } from "../../shared/lesson.ts";
  let { status }: { status: LessonStatus } = $props();
</script>

<span class="mark" class:reviewed={status === "reviewed"}>
  {status === "reviewed" ? "Reviewed by a person" : "Written by the model, not yet reviewed"}
</span>

<style>
  .mark {
    display: inline-block;
    font-size: 0.78rem;
    font-weight: 600;
    padding: 0.1rem 0.55rem;
    border-radius: 999px;
    border: 1px solid var(--accent);
    color: var(--accent);
    white-space: nowrap;
  }
  .mark.reviewed {
    border-color: var(--right);
    color: var(--right);
  }
</style>
