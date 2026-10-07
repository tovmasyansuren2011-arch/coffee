import { deleteLesson } from "../features/deleteLesson.js";
import {
  openModuleModal,
  moveLesson,
  deleteModule,
} from "../features/lessonModules.js";
import { notesText } from "../features/richText.js";
import { state } from "../data/state.js";
import { storage } from "../data/storage.js";
import { openCreateLessonModal } from "./createModals.js";
import { showModal } from "../ui/modal.js";
import { renderCollection } from "./collectionView.js";

export function renderLessonsView(container) {
  const data = storage.getData(),
    module = data.lessonModules.find((m) => m.id === state.viewParams.moduleId);
  function lessonCard(l) {
    const parent = data.lessonModules.find((m) => m.id === l.moduleId);
    const hasNotes = Boolean(
      l.notes?.trim() ||
        notesText(l.notesHtml || "").trim() ||
        /<(img|video|iframe)\b/.test(l.notesHtml || ""),
    );
    return {
      id: l.id,
      kind: "lesson",
      label: "Lesson",
      className: "lesson-card",
      title: l.title,
      subtitle: parent?.title || "Unfiled lesson",
      description: l.description,
      meta: hasNotes ? "Notes recorded" : "Ready for notes",
      updatedAt: l.updatedAt,
      searchText: l.notes,
      hiddenInAll: !!parent,
      openAttribute: "data-open-lesson",
      open: () =>
        state.navigate("editor", {
          editorType: "lesson",
          itemId: l.id,
          title: l.title,
          moduleId: parent?.id,
          parentTitle: parent?.title || "Unfiled lesson",
        }),
      actions: [
        { label: "Move", run: () => moveLesson(l) },
        {
          label: "Delete",
          danger: true,
          attribute: "data-delete-lesson",
          run: () => deleteLesson(l),
        },
      ],
    };
  }
  if (module) {
    const lessons = data.lessons
      .filter((l) => l.moduleId === module.id)
      .map((l) => ({ ...lessonCard(l), hiddenInAll: false }));
    renderCollection(container, {
      title: module.title,
      subtitle:
        module.description || "Related lessons, organized in one place.",
      icon: "lesson",
      create: () => openCreateLessonModal(module.id),
      createId: "btn-new-lesson",
      createLabel: "New lesson",
      filters: [{ id: "all", label: "All lessons" }],
      actions: [
        { label: "← All modules", run: () => state.navigate("lessons") },
        { label: "Edit module", run: () => openModuleModal(module) },
        { label: "Delete module", run: () => deleteModule(module) },
      ],
      emptyTitle: "Add the first lesson",
      emptyDescription: "Each lesson has its own heading, notes, and media.",
      items: lessons,
    });
    return;
  }
  const modules = data.lessonModules.map((m) => ({
    id: m.id,
    kind: "module",
    icon: "graduation",
    label: "Module",
    className: "module-card",
    title: m.title,
    subtitle: "Learning module",
    description: m.description,
    meta: `${data.lessons.filter((l) => l.moduleId === m.id).length} lessons`,
    updatedAt: [
      m.updatedAt,
      ...data.lessons
        .filter((l) => l.moduleId === m.id)
        .map((l) => l.updatedAt),
    ]
      .filter(Boolean)
      .sort()
      .at(-1),
    openAttribute: "data-open-module",
    open: () => state.navigate("lessons", { moduleId: m.id }),
    actions: [
      { label: "Edit", run: () => openModuleModal(m) },
      { label: "Delete", danger: true, run: () => deleteModule(m) },
    ],
  }));
  const create = () =>
    showModal({
      title: "Add to Lessons",
      subtitle: "Create a module, then add lessons inside it.",
      contentHtml:
        '<div class="desk-create-options"><button type="button" class="btn btn-secondary" id="create-lesson-module">Module<small>Group related lessons</small></button><button type="button" class="btn btn-secondary" id="create-single-lesson">Lesson<small>Choose a module or leave unfiled</small></button></div>',
      confirmText: "Close",
      onOpen: (modal) => {
        modal.querySelector("#create-lesson-module").onclick = () => {
          modal.querySelector(".modal-cancel-btn").click();
          openModuleModal();
        };
        modal.querySelector("#create-single-lesson").onclick = () => {
          modal.querySelector(".modal-cancel-btn").click();
          openCreateLessonModal();
        };
      },
    });
  renderCollection(container, {
    title: "Lessons",
    subtitle: "A place for modules, lessons, and the ideas you want to keep.",
    icon: "lesson",
    create,
    createId: "btn-new-lesson",
    createLabel: "New module / lesson",
    filters: [
      { id: "all", label: "All" },
      { id: "module", label: "Modules" },
      { id: "lesson", label: "Lessons" },
    ],
    emptyTitle: "Build your first learning module",
    emptyDescription:
      "Create a module such as Linux, then add its lessons. Existing notes stay accessible.",
    items: [...modules, ...data.lessons.map(lessonCard)],
  });
}
