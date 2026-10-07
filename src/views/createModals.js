/**
 * Creation Dialogs for Coffee
 * Fast, intuitive modal creation for Books, Courses, Videos, and Lessons.
 * Immediately opens the newly created item.
 */

import { showModal } from "../ui/modal.js";
import { storage } from "../data/storage.js";
import { state } from "../data/state.js";
import { showToast } from "../ui/toast.js";
import { escape } from "../features/richText.js";
import { normalizeVideoUrl } from "../features/videoLinks.js";

function generateId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
}

/**
 * Create Book Modal
 */
export function openCreateBookModal() {
  showModal({
    title: "New Book",
    subtitle: "Add a book to your study library",
    contentHtml: `
      <form id="form-create-book">
        <div class="form-group">
          <label class="form-label" for="book-title">Title *</label>
          <input type="text" id="book-title" class="form-input" placeholder="e.g. Designing Data-Intensive Applications" required />
        </div>
        <div class="form-group">
          <label class="form-label" for="book-author">Author</label>
          <input type="text" id="book-author" class="form-input" placeholder="e.g. Martin Kleppmann" />
        </div>
        <div class="form-group">
          <label class="form-label" for="book-desc">Description</label>
          <textarea id="book-desc" class="form-textarea" placeholder="Brief notes on what this book covers..."></textarea>
        </div>
      </form>
    `,
    confirmText: "Create Book",
    cancelText: "Cancel",
    onConfirm: (modalEl) => {
      const titleInput = modalEl.querySelector("#book-title");
      const authorInput = modalEl.querySelector("#book-author");
      const descInput = modalEl.querySelector("#book-desc");

      const title = titleInput.value.trim();
      if (!title) {
        titleInput.focus();
        return false;
      }

      const newBook = {
        id: generateId("book"),
        title,
        author: authorInput.value.trim(),
        description: descInput.value.trim(),
        chapters: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (!storage.saveEntity("books", newBook)) {
        showToast(
          "Save failed. Export your draft from Settings before closing.",
          "error",
          7000,
        );
        return false;
      }
      showToast(`Created "${newBook.title}"`, "success");

      // Automatically open the book page
      state.navigate("book-detail", { bookId: newBook.id });
      return true;
    },
  });
}

/**
 * Create Course or Video Modal
 */
export function openCreateCourseOrVideoModal(preferredType = "course") {
  let activeTab = preferredType;

  const renderForm = (modalEl) => {
    const isCourse = activeTab === "course";
    const formContainer = modalEl.querySelector("#course-video-form-fields");
    if (!formContainer) return;

    if (isCourse) {
      formContainer.innerHTML = `
        <div class="form-group">
          <label class="form-label" for="cv-title">Course Title *</label>
          <input type="text" id="cv-title" class="form-input" placeholder="e.g. Distributed Systems Engineering" required />
        </div>
        <div class="form-group">
          <label class="form-label" for="cv-instructor">Instructor / Institution</label>
          <input type="text" id="cv-instructor" class="form-input" placeholder="e.g. MIT OpenCourseWare" />
        </div>
        <div class="form-group">
          <label class="form-label" for="cv-desc">Description</label>
          <textarea id="cv-desc" class="form-textarea" placeholder="Topics, syllabus, and learning objectives..."></textarea>
        </div>
      `;
    } else {
      formContainer.innerHTML = `
        <div class="form-group">
          <label class="form-label" for="cv-title">Video Title *</label>
          <input type="text" id="cv-title" class="form-input" placeholder="e.g. How Memory Allocators Work" required />
        </div>
        <div class="form-group">
          <label class="form-label" for="cv-source">Source / Platform</label>
          <input type="text" id="cv-source" class="form-input" placeholder="e.g. YouTube, Conference Talk, Vimeo" />
        </div>
        <div class="form-group">
          <label class="form-label" for="cv-url">Video URL</label>
          <input type="url" id="cv-url" class="form-input" placeholder="https://www.youtube.com/watch?v=..." />
        </div>
        <div class="form-group">
          <label class="form-label" for="cv-desc">Description</label>
          <textarea id="cv-desc" class="form-textarea" placeholder="Key takeaways and speaker summary..."></textarea>
        </div>
      `;
    }

    const titleInput = formContainer.querySelector("#cv-title");
    if (titleInput) titleInput.focus();
  };

  showModal({
    title: "New Course or Video",
    subtitle:
      "Courses contain modules; videos contain standalone notes & links.",
    contentHtml: `
      <div style="display: flex; gap: 8px; margin-bottom: 16px;">
        <button type="button" class="btn ${preferredType === "course" ? "btn-primary" : "btn-secondary"}" id="tab-opt-course" style="flex: 1;">
          Course
        </button>
        <button type="button" class="btn ${preferredType === "video" ? "btn-primary" : "btn-secondary"}" id="tab-opt-video" style="flex: 1;">
          Video
        </button>
      </div>
      <div id="course-video-form-fields"></div>
    `,
    confirmText: preferredType === "course" ? "Create Course" : "Create Video",
    cancelText: "Cancel",
    onOpen: (modalEl) => {
      const tabCourse = modalEl.querySelector("#tab-opt-course");
      const tabVideo = modalEl.querySelector("#tab-opt-video");
      const confirmBtn = modalEl.querySelector(".modal-confirm-btn");

      tabCourse.addEventListener("click", () => {
        activeTab = "course";
        tabCourse.className = "btn btn-primary";
        tabVideo.className = "btn btn-secondary";
        confirmBtn.textContent = "Create Course";
        renderForm(modalEl);
      });

      tabVideo.addEventListener("click", () => {
        activeTab = "video";
        tabVideo.className = "btn btn-primary";
        tabCourse.className = "btn btn-secondary";
        confirmBtn.textContent = "Create Video";
        renderForm(modalEl);
      });

      renderForm(modalEl);
    },
    onConfirm: (modalEl) => {
      const titleInput = modalEl.querySelector("#cv-title");
      const descInput = modalEl.querySelector("#cv-desc");
      const title = titleInput ? titleInput.value.trim() : "";

      if (!title) {
        if (titleInput) titleInput.focus();
        return false;
      }

      if (activeTab === "course") {
        const instructorInput = modalEl.querySelector("#cv-instructor");
        const newCourse = {
          id: generateId("course"),
          title,
          instructor: instructorInput ? instructorInput.value.trim() : "",
          description: descInput ? descInput.value.trim() : "",
          modules: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        if (!storage.saveEntity("courses", newCourse)) {
          showToast(
            "Save failed. Export your draft from Settings before closing.",
            "error",
            7000,
          );
          return false;
        }
        showToast(`Created course "${newCourse.title}"`, "success");
        state.navigate("course-detail", { courseId: newCourse.id });
      } else {
        const sourceInput = modalEl.querySelector("#cv-source");
        const urlInput = modalEl.querySelector("#cv-url");
        const enteredUrl = urlInput ? urlInput.value.trim() : "";
        const url = normalizeVideoUrl(enteredUrl);
        if (urlInput) urlInput.setCustomValidity("");
        if (enteredUrl && !url) {
          urlInput.setCustomValidity("Enter a full http:// or https:// URL");
          urlInput.reportValidity();
          return false;
        }
        const newVideo = {
          id: generateId("video"),
          title,
          source: sourceInput ? sourceInput.value.trim() : "YouTube",
          url,
          description: descInput ? descInput.value.trim() : "",
          notes: `# ${title}\n\n`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        if (!storage.saveEntity("videos", newVideo)) {
          showToast(
            "Save failed. Export your draft from Settings before closing.",
            "error",
            7000,
          );
          return false;
        }
        showToast(`Created video "${newVideo.title}"`, "success");
        state.navigate("video-detail", { videoId: newVideo.id });
      }
      return true;
    },
  });
}

/**
 * Create Standalone Lesson Modal
 */
export function openCreateLessonModal(moduleId = null) {
  if (typeof moduleId !== "string") moduleId = null;
  const modules = storage.getData().lessonModules || [];
  showModal({
    title: "New Lesson",
    subtitle: "Add notes to a module or keep this lesson unfiled",
    contentHtml: `
      <form id="form-create-lesson">
        <div class="form-group"><label class="form-label" for="lesson-module">Module</label><select class="form-input" id="lesson-module"><option value="">Unfiled lessons</option>${modules.map((m) => `<option value="${escape(m.id)}" ${m.id === moduleId ? "selected" : ""}>${escape(m.title)}</option>`).join("")}</select></div>
        <div class="form-group">
          <label class="form-label" for="lesson-title">Lesson Title *</label>
          <input type="text" id="lesson-title" class="form-input" placeholder="e.g. What is SSH? or Big-O Notation" required />
        </div>
        <div class="form-group">
          <label class="form-label" for="lesson-desc">Short Description</label>
          <textarea id="lesson-desc" class="form-textarea" placeholder="One sentence summary of this concept..."></textarea>
        </div>
      </form>
    `,
    confirmText: "Create Lesson",
    cancelText: "Cancel",
    onConfirm: (modalEl) => {
      const titleInput = modalEl.querySelector("#lesson-title");
      const descInput = modalEl.querySelector("#lesson-desc");
      const title = titleInput.value.trim();

      if (!title) {
        titleInput.focus();
        return false;
      }

      const desc = descInput.value.trim();
      const initialNotes = "";

      const newLesson = {
        id: generateId("lesson"),
        moduleId: modalEl.querySelector("#lesson-module").value || null,
        title,
        description: desc,
        notes: initialNotes,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (!storage.saveEntity("lessons", newLesson)) {
        showToast(
          "Save failed. Export your draft from Settings before closing.",
          "error",
          7000,
        );
        return false;
      }
      showToast(`Created "${newLesson.title}"`, "success");

      // Immediately open note editor for this lesson
      state.navigate("editor", {
        startEditing: true,
        editorType: "lesson",
        itemId: newLesson.id,
        title: newLesson.title,
        moduleId: newLesson.moduleId,
        parentTitle:
          modules.find((m) => m.id === newLesson.moduleId)?.title ||
          "Unfiled lesson",
        notes: newLesson.notes,
      });
      return true;
    },
  });
}
