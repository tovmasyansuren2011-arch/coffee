import { storage } from "../data/storage.js";
import { state } from "../data/state.js";
import { showModal } from "../ui/modal.js";
import { showToast } from "../ui/toast.js";
import { escape } from "./richText.js";
export function deleteLesson(lesson) {
  storage.flushPendingSave();
  showModal({
    title: "Delete lesson?",
    subtitle: lesson.title,
    contentHtml:
      "<p>The lesson and its notes will be removed. You can undo immediately afterward.</p>",
    confirmText: "Delete lesson",
    isDanger: true,
    onConfirm: () => {
      const snapshot = structuredClone(lesson),
        destination = storage
          .getData()
          .lessonModules?.some((m) => m.id === lesson.moduleId)
          ? { moduleId: lesson.moduleId }
          : {};
      if (!storage.deleteEntity("lessons", lesson.id)) {
        showToast(
          "Save failed. Export your draft from Settings before closing.",
          "error",
          7000,
        );
        return false;
      }
      state.navigate("lessons", destination);
      showToast("Lesson deleted", "success", 10000, {
        label: "Undo",
        onClick: () => {
          if (!storage.saveEntity("lessons", snapshot)) {
            showToast(
              "Save failed. Export your draft from Settings before closing.",
              "error",
              7000,
            );
            return false;
          }
          state.navigate("lessons", destination);
          showToast("Lesson restored", "success");
        },
      });
    },
  });
}
