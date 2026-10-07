/**
 * Course Detail View for Coffee
 * Displays course hierarchy: Course -> Modules -> Lessons -> Notes.
 * Allows adding, renaming, and deleting modules & lessons.
 */

import { safeWebUrl } from "../features/videoLinks.js";
import { icon } from "../ui/icons.js";
import { state } from "../data/state.js";
import { storage } from "../data/storage.js";
import { showModal, confirmModal } from "../ui/modal.js";
import { showToast } from "../ui/toast.js";

export function renderCourseDetailView(containerEl, courseId) {
  const data = storage.getData();
  const course = data.courses?.find((c) => c.id === courseId);

  if (!course) {
    containerEl.innerHTML = `
      <div class="view-container">
        <div class="detail-nav-back" id="back-to-courses">
          ${icon("arrow-left", "", 16)} Back to Courses & Videos
        </div>
        <div class="empty-state-card">
          <h2 class="empty-state-title">Course Not Found</h2>
          <p class="empty-state-desc">This course may have been removed.</p>
        </div>
      </div>
    `;
    containerEl
      .querySelector("#back-to-courses")
      .addEventListener("click", () => state.navigate("courses"));
    return;
  }

  const modules = course.modules || [];

  containerEl.innerHTML = `
    <div class="view-container">
      <div class="detail-header">
        <div class="detail-nav-back" id="btn-back-courses">
          ${icon("arrow-left", "", 15)} Courses & Videos
        </div>

        <div class="detail-title-row">
          <div>
            <h1 class="detail-title">${escape(course.title)}</h1>
            ${course.instructor ? `<div class="detail-author">${escape(course.instructor)}</div>` : ""}
          </div>
          <div style="display: flex; gap: 8px;">
            <button type="button" class="btn btn-secondary btn-sm" id="btn-edit-course">
              ${icon("edit", "", 14)} Edit
            </button>
            <button type="button" class="btn btn-danger-outline btn-sm" id="btn-delete-course">
              ${icon("trash", "", 14)} Delete
            </button>
          </div>
        </div>

        ${course.description ? `<p class="detail-desc">${escape(course.description)}</p>` : ""}
      </div>

      <div>
        <div class="section-headline">
          <span class="section-label">Modules (${modules.length})</span>
          <button type="button" class="btn btn-secondary btn-sm" id="btn-add-module">
            ${icon("plus", "", 14)} Add Module
          </button>
        </div>

        ${
          modules.length === 0
            ? `
          <div class="empty-state-card" style="padding: 36px 16px;">
            <p class="empty-state-title" style="font-size: 14px;">No modules created yet</p>
            <p class="empty-state-desc">Organize this course into modules (e.g. "01 Foundations", "02 Advanced Systems").</p>
            <button type="button" class="btn btn-primary btn-sm" id="btn-empty-add-mod" style="margin-top: 6px;">
              ${icon("plus", "", 14)} Add First Module
            </button>
          </div>
        `
            : `
          <div class="modules-container">
            ${modules
              .map((mod, modIdx) => {
                const modNum = String(modIdx + 1).padStart(2, "0");
                const lessons = mod.lessons || [];

                return `
                <div class="course-module-card" data-mod-id="${mod.id}">
                  <div class="module-header">
                    <div class="module-title-wrap">
                      <span class="module-number">${modNum}</span>
                      <span class="module-title">${escape(mod.title)}</span>
                      <span class="row-meta" style="margin-left: 6px;">(${lessons.length} ${lessons.length === 1 ? "lesson" : "lessons"})</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 6px;">
                      <button type="button" class="btn btn-secondary btn-sm btn-add-mod-lesson" data-mod-id="${mod.id}">
                        ${icon("plus", "", 13)} Add Lesson
                      </button>
                      <button type="button" class="btn-icon-only btn-rename-mod" data-mod-id="${mod.id}" title="Rename module">
                        ${icon("edit", "", 14)}
                      </button>
                      <button type="button" class="btn-icon-only btn-delete-mod" data-mod-id="${mod.id}" title="Delete module">
                        ${icon("trash", "", 14)}
                      </button>
                    </div>
                  </div>

                  <div class="module-lessons-list">
                    ${
                      lessons.length === 0
                        ? `
                      <div style="padding: 10px 0; color: var(--text-muted); font-size: 12.5px;">
                        No lessons yet in this module. Click "Add Lesson" above.
                      </div>
                    `
                        : lessons
                            .map((les, lesIdx) => {
                              const lesNum = String(lesIdx + 1).padStart(
                                2,
                                "0",
                              );
                              const hasNotes = Boolean(
                                les.notes && les.notes.trim().length > 0,
                              );
                              const snippet = hasNotes
                                ? les.notes
                                    .replace(/[#*`_>\n]/g, " ")
                                    .substring(0, 70)
                                    .trim() + "..."
                                : "No notes written yet";

                              return `
                        <div class="lesson-row" data-les-id="${les.id}" data-mod-id="${mod.id}">
                          <div class="row-item-left">
                            <span class="row-index" style="color: var(--text-muted); font-size: 11px;">${lesNum}</span>
                            <div>
                              <div class="row-title" style="font-size: 13.5px;">${escape(les.title)}</div>
                              <div class="row-meta" style="font-size: 11.5px;">${escape(snippet)}</div>
                            </div>
                          </div>
                          <div class="row-actions" onclick="event.stopPropagation();">
                            <button type="button" class="btn-icon-only btn-rename-les" data-mod-id="${mod.id}" data-les-id="${les.id}" title="Rename lesson">
                              ${icon("edit", "", 14)}
                            </button>
                            <button type="button" class="btn-icon-only btn-delete-les" data-mod-id="${mod.id}" data-les-id="${les.id}" title="Delete lesson">
                              ${icon("trash", "", 14)}
                            </button>
                          </div>
                        </div>
                      `;
                            })
                            .join("")
                    }
                  </div>
                </div>
              `;
              })
              .join("")}
          </div>
        `
        }
      </div>
    </div>
  `;

  // Back to courses
  containerEl
    .querySelector("#btn-back-courses")
    ?.addEventListener("click", () => {
      state.navigate("courses");
    });

  // Edit Course
  containerEl
    .querySelector("#btn-edit-course")
    ?.addEventListener("click", () => {
      showModal({
        title: "Edit Course",
        contentHtml: `
        <form id="form-edit-course">
          <div class="form-group">
            <label class="form-label" for="edit-course-title">Course Title *</label>
            <input type="text" id="edit-course-title" class="form-input" value="${escape(course.title)}" required />
          </div>
          <div class="form-group">
            <label class="form-label" for="edit-course-inst">Instructor</label>
            <input type="text" id="edit-course-inst" class="form-input" value="${escape(course.instructor || "")}" />
          </div>
          <div class="form-group">
            <label class="form-label" for="edit-course-desc">Description</label>
            <textarea id="edit-course-desc" class="form-textarea">${escape(course.description || "")}</textarea>
          </div>
        </form>
      `,
        confirmText: "Save",
        onConfirm: (modalEl) => {
          const titleInput = modalEl.querySelector("#edit-course-title");
          const instInput = modalEl.querySelector("#edit-course-inst");
          const descInput = modalEl.querySelector("#edit-course-desc");

          const title = titleInput.value.trim();
          if (!title) return false;

          course.title = title;
          course.instructor = instInput.value.trim();
          course.description = descInput.value.trim();
          course.updatedAt = new Date().toISOString();

          if (!storage.saveEntity("courses", course)) {
            showToast(
              "Save failed. Export your draft from Settings before closing.",
              "error",
              7000,
            );
            return false;
          }
          showToast("Course updated", "success");
          renderCourseDetailView(containerEl, course.id);
          return true;
        },
      });
    });

  // Delete Course
  containerEl
    .querySelector("#btn-delete-course")
    ?.addEventListener("click", () => {
      confirmModal({
        title: "Delete Course?",
        message: `Delete "${course.title}" and all its modules and lesson notes permanently?`,
        confirmText: "Delete Course",
        isDanger: true,
        onConfirm: () => {
          if (!storage.deleteEntity("courses", course.id)) {
            showToast(
              "Save failed. Export your draft from Settings before closing.",
              "error",
              7000,
            );
            return false;
          }
          showToast(`Deleted "${course.title}"`, "info");
          state.navigate("courses");
        },
      });
    });

  // Add Module
  const handleAddModule = () => {
    showModal({
      title: "Add Module",
      subtitle: `Course: ${course.title}`,
      contentHtml: `
        <div class="form-group">
          <label class="form-label" for="new-mod-title">Module Title *</label>
          <input type="text" id="new-mod-title" class="form-input" placeholder="e.g. Computer & AI Literacy" required />
        </div>
      `,
      confirmText: "Add Module",
      onConfirm: (modalEl) => {
        const input = modalEl.querySelector("#new-mod-title");
        const title = input.value.trim();
        if (!title) return false;

        if (!course.modules) course.modules = [];
        const newMod = {
          id: `mod-${course.id}-${Date.now()}`,
          title,
          lessons: [],
        };
        course.modules.push(newMod);
        course.updatedAt = new Date().toISOString();
        if (!storage.saveEntity("courses", course)) {
          showToast(
            "Save failed. Export your draft from Settings before closing.",
            "error",
            7000,
          );
          return false;
        }
        showToast(`Added module "${title}"`, "success");
        renderCourseDetailView(containerEl, course.id);
        return true;
      },
    });
  };

  containerEl
    .querySelector("#btn-add-module")
    ?.addEventListener("click", handleAddModule);
  containerEl
    .querySelector("#btn-empty-add-mod")
    ?.addEventListener("click", handleAddModule);

  // Rename Module
  containerEl.querySelectorAll(".btn-rename-mod").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const modId = btn.getAttribute("data-mod-id");
      const mod = course.modules.find((m) => m.id === modId);
      if (!mod) return;

      showModal({
        title: "Rename Module",
        contentHtml: `
          <div class="form-group">
            <label class="form-label" for="rename-mod-title">Module Title</label>
            <input type="text" id="rename-mod-title" class="form-input" value="${escape(mod.title)}" required />
          </div>
        `,
        confirmText: "Save",
        onConfirm: (modalEl) => {
          const input = modalEl.querySelector("#rename-mod-title");
          const val = input.value.trim();
          if (!val) return false;

          mod.title = val;
          course.updatedAt = new Date().toISOString();
          if (!storage.saveEntity("courses", course)) {
            showToast(
              "Save failed. Export your draft from Settings before closing.",
              "error",
              7000,
            );
            return false;
          }
          showToast("Module renamed", "success");
          renderCourseDetailView(containerEl, course.id);
          return true;
        },
      });
    });
  });

  // Delete Module
  containerEl.querySelectorAll(".btn-delete-mod").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const modId = btn.getAttribute("data-mod-id");
      const mod = course.modules.find((m) => m.id === modId);
      if (!mod) return;

      confirmModal({
        title: "Delete Module?",
        message: `Delete module "${mod.title}" and its ${mod.lessons?.length || 0} lessons permanently?`,
        confirmText: "Delete Module",
        isDanger: true,
        onConfirm: () => {
          course.modules = course.modules.filter((m) => m.id !== modId);
          course.updatedAt = new Date().toISOString();
          if (!storage.saveEntity("courses", course)) {
            showToast(
              "Save failed. Export your draft from Settings before closing.",
              "error",
              7000,
            );
            return false;
          }
          showToast("Module deleted", "info");
          renderCourseDetailView(containerEl, course.id);
        },
      });
    });
  });

  // Add Lesson to Module
  containerEl.querySelectorAll(".btn-add-mod-lesson").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const modId = btn.getAttribute("data-mod-id");
      const mod = course.modules.find((m) => m.id === modId);
      if (!mod) return;

      showModal({
        title: "Add Lesson",
        subtitle: `Module: ${mod.title}`,
        contentHtml: `
          <form id="form-add-les">
            <div class="form-group">
              <label class="form-label" for="new-les-title">Lesson Title *</label>
              <input type="text" id="new-les-title" class="form-input" placeholder="e.g. Operating Systems & Process Scheduling" required />
            </div>
            <div class="form-group">
              <label class="form-label" for="new-les-url">Video or Reference URL (optional)</label>
              <input type="url" id="new-les-url" class="form-input" placeholder="https://..." />
            </div>
          </form>
        `,
        confirmText: "Add & Open",
        onConfirm: (modalEl) => {
          const titleInput = modalEl.querySelector("#new-les-title");
          const urlInput = modalEl.querySelector("#new-les-url");
          const title = titleInput.value.trim();
          if (!title) return false;

          urlInput.setCustomValidity("");
          if (urlInput.value.trim() && !safeWebUrl(urlInput.value.trim())) {
            urlInput.setCustomValidity("Enter a full http:// or https:// URL.");
            urlInput.reportValidity();
            return false;
          }
          if (!mod.lessons) mod.lessons = [];
          const nextIdx = mod.lessons.length + 1;
          const newLesson = {
            id: `les-${mod.id}-${Date.now()}`,
            title,
            videoUrl: urlInput ? urlInput.value.trim() : "",
            notes: "",
          };

          mod.lessons.push(newLesson);
          course.updatedAt = new Date().toISOString();
          if (!storage.saveEntity("courses", course)) {
            showToast(
              "Save failed. Export your draft from Settings before closing.",
              "error",
              7000,
            );
            return false;
          }
          showToast(`Added lesson "${title}"`, "success");

          // Immediately open notes editor
          state.navigate("editor", {
            startEditing: true,
            editorType: "course-lesson",
            parentId: course.id,
            parentTitle: course.title,
            subParentId: mod.id,
            subParentTitle: mod.title,
            itemId: newLesson.id,
            title: newLesson.title,
            itemNumber: nextIdx,
            videoUrl: newLesson.videoUrl,
            notes: newLesson.notes,
          });
          return true;
        },
      });
    });
  });

  // Click Lesson to open notes
  containerEl.querySelectorAll(".lesson-row").forEach((row) => {
    row.addEventListener("click", () => {
      const modId = row.getAttribute("data-mod-id");
      const lesId = row.getAttribute("data-les-id");
      const mod = course.modules.find((m) => m.id === modId);
      const les = mod?.lessons.find((l) => l.id === lesId);
      if (mod && les) {
        state.navigate("editor", {
          editorType: "course-lesson",
          parentId: course.id,
          parentTitle: course.title,
          subParentId: mod.id,
          subParentTitle: mod.title,
          itemId: les.id,
          title: les.title,
          videoUrl: les.videoUrl,
          notes: les.notes || "",
        });
      }
    });
  });

  // Rename Lesson
  containerEl.querySelectorAll(".btn-rename-les").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const modId = btn.getAttribute("data-mod-id");
      const lesId = btn.getAttribute("data-les-id");
      const mod = course.modules.find((m) => m.id === modId);
      const les = mod?.lessons.find((l) => l.id === lesId);
      if (!mod || !les) return;

      showModal({
        title: "Rename Lesson",
        contentHtml: `
          <div class="form-group">
            <label class="form-label" for="rename-les-title">Lesson Title</label>
            <input type="text" id="rename-les-title" class="form-input" value="${escape(les.title)}" required />
          </div>
          <div class="form-group">
            <label class="form-label" for="rename-les-url">Video or Reference URL</label>
            <input type="url" id="rename-les-url" class="form-input" value="${escape(les.videoUrl || "")}" />
          </div>
        `,
        confirmText: "Save",
        onConfirm: (modalEl) => {
          const input = modalEl.querySelector("#rename-les-title");
          const urlInput = modalEl.querySelector("#rename-les-url");
          const val = input.value.trim();
          if (!val) return false;

          urlInput.setCustomValidity("");
          if (urlInput.value.trim() && !safeWebUrl(urlInput.value.trim())) {
            urlInput.setCustomValidity("Enter a full http:// or https:// URL.");
            urlInput.reportValidity();
            return false;
          }
          les.title = val;
          les.videoUrl = urlInput.value.trim();
          course.updatedAt = new Date().toISOString();
          if (!storage.saveEntity("courses", course)) {
            showToast(
              "Save failed. Export your draft from Settings before closing.",
              "error",
              7000,
            );
            return false;
          }
          showToast("Lesson updated", "success");
          renderCourseDetailView(containerEl, course.id);
          return true;
        },
      });
    });
  });

  // Delete Lesson
  containerEl.querySelectorAll(".btn-delete-les").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const modId = btn.getAttribute("data-mod-id");
      const lesId = btn.getAttribute("data-les-id");
      const mod = course.modules.find((m) => m.id === modId);
      const les = mod?.lessons.find((l) => l.id === lesId);
      if (!mod || !les) return;

      confirmModal({
        title: "Delete Lesson?",
        message: `Delete lesson "${les.title}" and its notes permanently?`,
        confirmText: "Delete Lesson",
        isDanger: true,
        onConfirm: () => {
          mod.lessons = mod.lessons.filter((l) => l.id !== lesId);
          storage.removeRecent(lesId);
          course.updatedAt = new Date().toISOString();
          if (!storage.saveEntity("courses", course)) {
            showToast(
              "Save failed. Export your draft from Settings before closing.",
              "error",
              7000,
            );
            return false;
          }
          showToast("Lesson deleted", "info");
          renderCourseDetailView(containerEl, course.id);
        },
      });
    });
  });
}

function escape(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
