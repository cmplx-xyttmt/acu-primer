<script lang="ts">
  // Holds one course for one student: loads it, then moves between name entry, the
  // overview and a lesson's modules without leaving the page.
  //
  // Every move between the overview and a module adds a browser history entry (same
  // address, different history.state), so the browser's Back button and a phone's swipe
  // back step through modules the same way the in-app Back button does.
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

  type View = { kind: "overview" } | { kind: "module"; lessonId: string; index: number };

  let data = $state<CourseResponse | null>(null);
  let loadError = $state("");
  let name = $state("");
  let progress = $state<CourseProgress>({});
  let view = $state<View>({ kind: "overview" });

  // svelte-ignore state_referenced_locally (App.svelte re-creates Player when the slug changes)
  fetchCourse(slug).then(
    (course) => (data = course),
    (err) => (loadError = err.message),
  );

  const openLesson = $derived.by(() => {
    const v = view;
    return v.kind === "module" ? (data?.lessons.find((l) => l.id === v.lessonId) ?? null) : null;
  });

  function show(next: View, mode: "push" | "replace" = "push") {
    const state = { ...history.state, acuView: next };
    if (mode === "push") history.pushState(state, "");
    else history.replaceState(state, "");
    view = next;
    scrollTo({ top: 0 });
  }

  // The browser's Back and Forward buttons land here.
  $effect(() => {
    const onPop = (e: PopStateEvent) => {
      const next = e.state?.acuView as View | undefined;
      if (next && name) {
        view = next;
        scrollTo({ top: 0 });
      }
    };
    addEventListener("popstate", onPop);
    return () => removeEventListener("popstate", onPop);
  });

  function start(typed: string) {
    name = typed.trim();
    rememberName(name);
    progress = loadProgress(slug, name);
    show({ kind: "overview" }, "replace");
  }

  // Opening a lesson part-way through adds an entry for each earlier module, so Back from
  // the module you continued at goes to the module before it, then on to the overview.
  function open(lessonId: string) {
    const at = lessonProgress(progress, lessonId).current;
    for (let index = 0; index <= at; index++) show({ kind: "module", lessonId, index });
  }

  function update(lessonId: string, change: (p: ReturnType<typeof lessonProgress>) => void) {
    const next = structuredClone($state.snapshot(lessonProgress(progress, lessonId)));
    change(next);
    progress = { ...progress, [lessonId]: next };
    saveProgress(slug, name, progress);
  }

  function moduleDone(lessonId: string, moduleId: string, index: number) {
    update(lessonId, (p) => {
      if (!p.done.includes(moduleId)) p.done.push(moduleId);
      // Re-reading an earlier module never moves "where you stopped" backwards.
      p.current = Math.max(p.current, index + 1);
    });
  }

  function lessonDone(lessonId: string) {
    update(lessonId, (p) => {
      p.completed = true;
      p.current = 0;
    });
    show({ kind: "overview" });
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
{:else if view.kind === "module" && openLesson}
  {@const lessonId = openLesson.id}
  {@const total = openLesson.content.modules.length}
  {@const index = Math.min(view.index, total - 1)}
  <ModuleView
    lesson={openLesson.content}
    {index}
    done={lessonProgress(progress, lessonId).done}
    onNext={() => {
      moduleDone(lessonId, openLesson.content.modules[index].id, index);
      if (index + 1 >= total) lessonDone(lessonId);
      else show({ kind: "module", lessonId, index: index + 1 });
    }}
    onBack={() => history.back()}
    onExit={() => show({ kind: "overview" })}
  />
{:else}
  <CourseOverview
    {data}
    {name}
    {progress}
    onOpen={open}
    onChangeName={() => (name = "")}
  />
{/if}
