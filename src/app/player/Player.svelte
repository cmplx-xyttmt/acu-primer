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
    passModule,
    skipModule,
    resumeIndex,
    rememberName,
    type CourseProgress,
    type LessonProgress,
  } from "../lib/progress.ts";
  import NameEntry from "./NameEntry.svelte";
  import CourseOverview from "./CourseOverview.svelte";
  import ModuleView from "./ModuleView.svelte";
  import LessonIntro from "./LessonIntro.svelte";

  let { slug }: { slug: string } = $props();

  type View =
    | { kind: "overview" }
    | { kind: "intro"; lessonId: string }
    | { kind: "module"; lessonId: string; index: number };

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
    return v.kind !== "overview" ? (data?.lessons.find((l) => l.id === v.lessonId) ?? null) : null;
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
    const lesson = data?.lessons.find((l) => l.id === lessonId);
    if (!lesson) return;
    const at = resumeIndex(lessonProgress(progress, lessonId), lesson.content.modules.map((m) => m.id));
    for (let index = 0; index <= at; index++) show({ kind: "module", lessonId, index });
  }

  function update(lessonId: string, change: (p: LessonProgress) => LessonProgress) {
    progress = { ...progress, [lessonId]: change(lessonProgress(progress, lessonId)) };
    saveProgress(slug, name, $state.snapshot(progress));
  }

  // After passing or skipping a module: normally the next module, and the overview after the
  // last one. A student who already reached the end is here to clear skipped modules, so they
  // go to the next skipped one, or to the overview when none are left.
  function advance(lessonId: string, index: number, moduleIds: string[]) {
    const p = lessonProgress(progress, lessonId);
    const reachedEnd = p.current >= moduleIds.length;
    if (index + 1 >= moduleIds.length) return show({ kind: "overview" });
    if (!reachedEnd) return show({ kind: "module", lessonId, index: index + 1 });
    const skipped = moduleIds.findIndex((id, i) => i > index && p.skipped.includes(id) && !p.done.includes(id));
    if (skipped >= 0) show({ kind: "module", lessonId, index: skipped });
    else show({ kind: "overview" });
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
    progress={lessonProgress(progress, lessonId)}
    onNext={() => {
      update(lessonId, (p) => passModule(p, openLesson.content.modules[index].id, index));
      advance(lessonId, index, openLesson.content.modules.map((m) => m.id));
    }}
    onSkip={() => {
      update(lessonId, (p) => skipModule(p, openLesson.content.modules[index].id, index));
      advance(lessonId, index, openLesson.content.modules.map((m) => m.id));
    }}
    onBack={() => history.back()}
    onExit={() => show({ kind: "overview" })}
    onJump={(i) => show({ kind: "module", lessonId, index: i })}
  />
{:else if view.kind === "intro" && openLesson}
  {@const lessonId = openLesson.id}
  <LessonIntro
    lesson={openLesson.content}
    progress={lessonProgress(progress, lessonId)}
    onStart={() => open(lessonId)}
    onPick={(i) => show({ kind: "module", lessonId, index: i })}
    onExit={() => show({ kind: "overview" })}
  />
{:else}
  <CourseOverview
    {data}
    {name}
    {progress}
    onOpen={open}
    onIntro={(id) => show({ kind: "intro", lessonId: id })}
    onChangeName={() => (name = "")}
  />
{/if}
