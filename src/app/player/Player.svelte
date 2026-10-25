<script lang="ts">
  // Holds one chapter for one student: loads it, then moves between name entry, the
  // overview and a lesson's modules without leaving the page.
  //
  // Every move between the overview and a module adds a browser history entry (same
  // address, different history.state), so the browser's Back button and a phone's swipe
  // back step through modules the same way the in-app Back button does.
  import type { ChapterResponse } from "../../shared/lesson.ts";
  import { fetchChapter, ApiError, OFFLINE } from "../lib/api.ts";
  import {
    loadProgress,
    saveProgress,
    lessonProgress,
    passModule,
    skipModule,
    isComplete,
    resumeIndex,
    rememberName,
    lastName,
    type ChapterProgress,
    type LessonProgress,
  } from "../lib/progress.ts";
  import { record, setStudent, startSending } from "../lib/eventQueue.ts";
  import { rememberPlayed } from "../lib/lastPlayed.ts";
  import NameEntry from "./NameEntry.svelte";
  import ChapterOverview from "./ChapterOverview.svelte";
  import ModuleView from "./ModuleView.svelte";
  import LessonIntro from "./LessonIntro.svelte";

  let { subjectSlug, slug }: { subjectSlug: string; slug: string } = $props();

  type View =
    | { kind: "overview" }
    | { kind: "intro"; lessonId: string }
    | { kind: "module"; lessonId: string; index: number };

  let data = $state<ChapterResponse | null>(null);
  let loadError = $state("");
  let name = $state("");
  let progress = $state<ChapterProgress>({});
  let view = $state<View>({ kind: "overview" });

  // svelte-ignore state_referenced_locally (App.svelte re-creates Player when the slug changes)
  fetchChapter(slug).then(
    (chapter) => {
      data = chapter;
      // A name typed on this device before: go straight in. The name screen is only for a
      // first visit, or after "Not you?" on the overview.
      const saved = lastName();
      if (saved) start(saved);
    },
    (err) =>
      (loadError =
        err instanceof ApiError && err.status === OFFLINE
          ? "Open this chapter once with a connection, then it works offline."
          : err.message),
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
    if (data) rememberPlayed({ subjectSlug, chapterSlug: slug, chapterTitle: data.chapter.title });
    name = typed.trim();
    rememberName(name);
    progress = loadProgress(slug, name);
    setStudent(slug, name);
    startSending();
    show({ kind: "overview" }, "replace");
  }

  // module.entered whenever a module comes on screen, however it got there (Continue, Back,
  // Contents, the browser's buttons). lesson.started when a lesson's first module is entered
  // in this visit.
  let lastEntered = "";
  const startedThisVisit = new Set<string>();
  $effect(() => {
    if (view.kind !== "module" || !openLesson) return;
    const mod = openLesson.content.modules[Math.min(view.index, openLesson.content.modules.length - 1)];
    const key = `${openLesson.id}/${mod.id}`;
    if (key === lastEntered) return;
    lastEntered = key;
    if (!startedThisVisit.has(openLesson.id)) {
      startedThisVisit.add(openLesson.id);
      record("lesson.started", openLesson.id, { title: openLesson.content.title });
    }
    record("module.entered", openLesson.id, { moduleId: mod.id, moduleTitle: mod.title, index: view.index });
  });

  // Going to a module from anywhere but the module before it (Continue from the overview, a
  // pick in the intro or Contents) adds an entry for each earlier module first. So Back, which
  // is history.back(), always lands on the module before, and the browser's Back does the same.
  function goTo(lessonId: string, index: number) {
    for (let i = 0; i <= index; i++) show({ kind: "module", lessonId, index: i });
  }

  function open(lessonId: string) {
    const lesson = data?.lessons.find((l) => l.id === lessonId);
    if (!lesson) return;
    goTo(lessonId, resumeIndex(lessonProgress(progress, lessonId), lesson.content.modules.map((m) => m.id)));
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
    if (skipped >= 0) goTo(lessonId, skipped);
    else show({ kind: "overview" });
  }
</script>

{#if loadError}
  <main class="page">
    <h1>Can't open this chapter</h1>
    <p class="muted">{loadError}</p>
    <p><a href="/">Back to all subjects</a></p>
  </main>
{:else if !data}
  <main class="page"><p class="muted">Loading…</p></main>
{:else if !name}
  <NameEntry title={data.chapter.title} onStart={start} />
{:else if view.kind === "module" && openLesson}
  {@const lessonId = openLesson.id}
  {@const total = openLesson.content.modules.length}
  {@const index = Math.min(view.index, total - 1)}
  <ModuleView
    lesson={openLesson.content}
    {index}
    progress={lessonProgress(progress, lessonId)}
    onNext={() => {
      const ids = openLesson.content.modules.map((m) => m.id);
      const wasComplete = isComplete(lessonProgress(progress, lessonId), ids);
      update(lessonId, (p) => passModule(p, ids[index], index));
      if (!wasComplete && isComplete(lessonProgress(progress, lessonId), ids))
        record("lesson.completed", lessonId, { title: openLesson.content.title });
      advance(lessonId, index, ids);
    }}
    onSkip={() => {
      const mod = openLesson.content.modules[index];
      update(lessonId, (p) => skipModule(p, mod.id, index));
      record("module.skipped", lessonId, { moduleId: mod.id, moduleTitle: mod.title, index });
      advance(lessonId, index, openLesson.content.modules.map((m) => m.id));
    }}
    onBack={() => history.back()}
    onExit={() => show({ kind: "overview" })}
    onJump={(i) => goTo(lessonId, i)}
  />
{:else if view.kind === "intro" && openLesson}
  {@const lessonId = openLesson.id}
  <LessonIntro
    lesson={openLesson.content}
    progress={lessonProgress(progress, lessonId)}
    onStart={() => open(lessonId)}
    onPick={(i) => goTo(lessonId, i)}
    onExit={() => show({ kind: "overview" })}
  />
{:else}
  <ChapterOverview
    {data}
    {name}
    {progress}
    onOpen={open}
    onIntro={(id) => show({ kind: "intro", lessonId: id })}
    onChangeName={() => (name = "")}
  />
{/if}
