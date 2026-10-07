import { storage } from "../data/storage.js";
import { state } from "../data/state.js";
import { showModal } from "../ui/modal.js";
import { showToast } from "../ui/toast.js";
import { escape } from "./richText.js";

export function openModuleModal(module) {
  showModal({
    title: module ? "Edit module" : "New module",
    subtitle: "Group related lessons into one clear learning path.",
    contentHtml: `<div class="form-group"><label class="form-label" for="module-title">Module title *</label><input class="form-input" id="module-title" required placeholder="e.g. Linux fundamentals" value="${escape(module?.title || "")}"></div><div class="form-group"><label class="form-label" for="module-description">Description</label><textarea class="form-textarea" id="module-description" placeholder="What will you study in this module?">${escape(module?.description || "")}</textarea></div>`,
    confirmText: module ? "Save module" : "Create module",
    onConfirm: (modal) => {
      const title = modal.querySelector("#module-title");
      if (!title.value.trim()) {
        title.reportValidity();
        title.focus();
        return false;
      }
      const item = {
        ...module,
        id: module?.id || crypto.randomUUID(),
        title: title.value.trim(),
        description: modal.querySelector("#module-description").value.trim(),
      };
      if (!storage.saveEntity("lessonModules", item)) {
        showToast(
          "Save failed. Export your draft from Settings before closing.",
          "error",
          7000,
        );
        return false;
      }
      state.navigate("lessons", { moduleId: item.id });
      showToast(module ? "Module updated" : "Module created", "success");
      return true;
    },
  });
}
export function moveLesson(lesson) {
  const modules = storage.getData().lessonModules;
  showModal({
    title: "Move lesson",
    subtitle: lesson.title,
    contentHtml: `<div class="form-group"><label class="form-label" for="lesson-module-destination">Module</label><select class="form-input" id="lesson-module-destination"><option value="">Unfiled lessons</option>${modules.map((m) => `<option value="${escape(m.id)}" ${lesson.moduleId === m.id ? "selected" : ""}>${escape(m.title)}</option>`).join("")}</select></div><p class="video-insert-help">Your notes and attachments stay with the lesson.</p>`,
    confirmText: "Move lesson",
    onConfirm: (modal) => {
      lesson.moduleId = modal.querySelector("select").value || null;
      if (!storage.saveEntity("lessons", lesson)) {
        showToast(
          "Save failed. Export your draft from Settings before closing.",
          "error",
          7000,
        );
        return false;
      }
      state.navigate("lessons", state.viewParams);
      showToast("Lesson moved", "success");
      return true;
    },
  });
}
export function deleteModule(module) {
  showModal({
    title: "Delete module?",
    subtitle: module.title,
    contentHtml:
      "<p>The module will be removed. Its lessons and notes will be kept in Unfiled lessons.</p>",
    confirmText: "Delete module",
    isDanger: true,
    onConfirm: () => {
      const snapshot = structuredClone(module),
        members = storage
          .getData()
          .lessons.filter((l) => l.moduleId === module.id)
          .map((l) => l.id);
      for (const lesson of storage.getData().lessons)
        if (lesson.moduleId === module.id) lesson.moduleId = null;
      if (!storage.deleteEntity("lessonModules", module.id)) {
        showToast(
          "Save failed. Export your draft from Settings before closing.",
          "error",
          7000,
        );
        return false;
      }
      state.navigate("lessons");
      showToast("Module removed; lessons kept", "success", 10000, {
        label: "Undo",
        onClick: () => {
          for (const lesson of storage.getData().lessons)
            if (members.includes(lesson.id) && !lesson.moduleId)
              lesson.moduleId = module.id;
          if (!storage.saveEntity("lessonModules", snapshot)) {
            showToast(
              "Save failed. Export your draft from Settings before closing.",
              "error",
              7000,
            );
            return false;
          }
          state.navigate("lessons", { moduleId: module.id });
          showToast("Module restored", "success");
        },
      });
      return true;
    },
  });
}
