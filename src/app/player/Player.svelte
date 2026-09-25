<script lang="ts">
  // Holds one course for one student: loads it, then moves between name entry, the
  // overview and a lesson's modules without leaving the page.
  import type { CourseResponse } from "../../shared/lesson.ts";
  import { fetchCourse } from "../lib/api.ts";
  import {
    loadProgress,
    saveProgress,
    lessonProgress,
    rememberName,
    type CourseProgress,
  } from "../lib/progress.ts";
  import NameEntry from "./NameEntry.svelte";
  import CourseOverview from "./CourseOverview.svelte";
  import ModuleView from "./ModuleView.svelte";

  let { slug }: { slug: string } = $props();

  let data = $state<CourseResponse | null>(null);
  let loadError = $state("");
  let name = $state("");
  let progress = $state<CourseProgress>({});
  let openLessonId = $state<string | null>(null);

  // svelte-ignore state_referenced_locally (App.svelte re-creates Player when the slug changes)
  fetchCourse(slug).then(
    (course) => (data = course),
    (err) => (loadError = err.message),
  );

  const openLesson = $derived(data?.lessons.find((l) => l.id === openLessonId) ?? null);

  function start(typed: string) {
    name = typed.trim();
    rememberName(name);
    progress = loadProgress(slug, name);
  }

  function update(lessonId: string, change: (p: ReturnType<typeof lessonProgress>) => void) {
    const next = structuredClone($state.snapshot(lessonProgress(progress, lessonId)));
    change(next);
    progress = { ...progress, [lessonId]: next };
    saveProgress(slug, name, progress);
  }

  function moduleDone(lessonId: string, moduleId: string, nextIndex: number) {
    update(lessonId, (p) => {
      if (!p.done.includes(moduleId)) p.done.push(moduleId);
      p.current = nextIndex;
    });
  }

  function lessonDone(lessonId: string) {
    update(lessonId, (p) => {
      p.completed = true;
      p.current = 0;
    });
    openLessonId = null;
  }
</script>

{#if loadError}
  <main class="page">
    <h1>Can't open this course</h1>
    <p class="muted">{loadError}</p>
  </main>
{:else if !data}
  <main class="page"><p class="muted">Loading…</p></main>
{:else if !name}
  <NameEntry title={data.course.title} onStart={start} />
{:else if openLesson}
  {#key openLesson.id}
    <ModuleView
      lesson={openLesson.content}
      startIndex={lessonProgress(progress, openLesson.id).current}
      onModuleDone={(moduleId, nextIndex) => moduleDone(openLesson.id, moduleId, nextIndex)}
      onLessonDone={() => lessonDone(openLesson.id)}
      onExit={() => (openLessonId = null)}
    />
  {/key}
{:else}
  <CourseOverview
    {data}
    {name}
    {progress}
    onOpen={(id) => (openLessonId = id)}
    onChangeName={() => (name = "")}
  />
{/if}
