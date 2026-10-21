<script lang="ts">
  // Everyone who has opened a chapter, by the name they typed and their device.
  import type { StudentSummary } from "../../shared/events.ts";
  import { authorApi, ApiError } from "../lib/api.ts";
  import { navigate } from "../router.svelte.ts";
  import ThemeSwitch from "../player/ThemeSwitch.svelte";

  let { chapterId, onLocked }: { chapterId: string; onLocked: () => void } = $props();

  let students = $state<StudentSummary[] | null>(null);
  let error = $state("");

  // svelte-ignore state_referenced_locally (App.svelte re-creates this per chapter)
  authorApi.students(chapterId).then(
    (s) => (students = s),
    (err) => (err instanceof ApiError && err.status === 401 ? onLocked() : (error = err.message)),
  );

  const go = (e: MouseEvent, to: string) => {
    e.preventDefault();
    navigate(to);
  };
  const logHref = (s: StudentSummary) =>
    `/author/chapters/${chapterId}/log?name=${encodeURIComponent(s.name)}&device=${encodeURIComponent(s.deviceId)}`;
  const when = (iso: string) => new Date(iso).toLocaleString();
</script>

<div class="top">
  <a href="/author" onclick={(e) => go(e, "/author")}>All lessons</a>
  <ThemeSwitch />
</div>
<main class="page wide">
  <h1>Students</h1>
  <p class="muted">Everyone who has opened this chapter, by the name they typed. The same name on two devices shows twice.</p>
  {#if error}<p class="error">{error}</p>{/if}
  {#if !students}
    {#if !error}<p class="muted">Loading…</p>{/if}
  {:else if students.length === 0}
    <p>No students have opened this chapter yet.</p>
  {:else}
    <table>
      <thead><tr><th>Name</th><th>Device</th><th>Last seen</th><th>Lessons</th><th></th></tr></thead>
      <tbody>
        {#each students as s (s.name + s.deviceId)}
          <tr>
            <td>{s.name}</td>
            <td class="num muted">{s.deviceId.slice(0, 8)}</td>
            <td>{when(s.lastSeen)}</td>
            <td class="num">{s.lessons}</td>
            <td><a href={logHref(s)} onclick={(e) => go(e, logHref(s))}>See their path</a></td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</main>

<style>
  .top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    max-width: 52rem;
    margin: 0 auto;
    padding: 0.9rem 16px 0;
  }
  .wide {
    max-width: 52rem;
  }
  a {
    color: var(--accent);
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.95rem;
  }
  th,
  td {
    text-align: left;
    padding: 0.5rem 0.4rem;
    border-bottom: 1px solid var(--border);
  }
  th {
    font-size: 0.8rem;
    color: var(--text-2);
    font-weight: 600;
  }
  .error {
    color: var(--wrong);
  }
  @media (max-width: 560px) {
    th:nth-child(2),
    td:nth-child(2) {
      display: none;
    }
  }
</style>
