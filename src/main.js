/**
 * Coffee Application Entry Point
 * Initializes state, persistence, routing, and UI views.
 */

import { storage } from "./data/storage.js";
import { state } from "./data/state.js";
import { icon } from "./ui/icons.js";
import { renderSidebar } from "./views/sidebar.js";
import { renderHomeView } from "./views/homeView.js";
import { renderBooksView } from "./views/booksView.js";
import { renderBookDetailView } from "./views/bookDetailView.js";
import { renderCoursesView } from "./views/coursesView.js";
import { renderCourseDetailView } from "./views/courseDetailView.js";
import { renderVideoDetailView } from "./views/videoDetailView.js";
import { renderLessonsView } from "./views/lessonsView.js";
import { renderEditorView } from "./views/editorView.js";
import { setupSearch } from "./views/searchModal.js";
import { setupSettings } from "./views/settingsModal.js";

async function initApp() {
  await storage.ready;
  const sidebarEl = document.getElementById("sidebar");
  const viewportEl = document.getElementById("viewport");
  const breadcrumbsEl = document.getElementById("breadcrumbs");
  const mobileToggleBtn = document.getElementById("mobile-toggle-btn");
  const mobileOverlay = document.getElementById("mobile-overlay");
  const globalSavePill = document.getElementById("global-autosave-pill");

  // Initialize search & settings listeners
  setupSearch();
  setupSettings();

  // Setup mobile sidebar interactions
  mobileToggleBtn?.addEventListener("click", () => {
    state.toggleMobileSidebar();
  });

  mobileOverlay?.addEventListener("click", () => {
    state.closeMobileSidebar();
  });

  // Track global save status indicator
  storage.onSaveStatus((status) => {
    if (!globalSavePill) return;
    const label = globalSavePill.querySelector(".autosave-label");
    if (status === "saving") {
      globalSavePill.className = "autosave-status is-saving";
      if (label) label.textContent = "Saving...";
    } else if (status === "saved") {
      globalSavePill.className = "autosave-status is-saved";
      if (label) label.textContent = "Saved";
    } else if (status === "error") {
      globalSavePill.className = "autosave-status is-error";
      if (label) label.textContent = "Storage error";
    }
  });

  const banner = document.createElement("div");
  banner.className = "workspace-safety-banner";
  banner.setAttribute("role", "status");
  banner.hidden = true;
  viewportEl.before(banner);
  function updateSafety() {
    const blocked = storage.readOnly || storage.conflict || storage.busy;
    banner.hidden = !blocked;
    banner.innerHTML = blocked
      ? `<span>${storage.busy ? "Restoring your workspace…" : storage.conflict ? "Another tab changed the workspace. Export this tab’s draft before reloading." : "This tab is read only while another Coffee tab is editing."}</span><button class="btn btn-secondary btn-sm" id="safety-export">Export draft</button><button class="btn btn-secondary btn-sm" id="safety-reload">Reload</button>`
      : "";
    banner
      .querySelector("#safety-export")
      ?.addEventListener("click", () =>
        storage.exportData().catch((error) => alert(error.message)),
      );
    banner
      .querySelector("#safety-reload")
      ?.addEventListener("click", () => location.reload());
    viewportEl.inert = blocked;
    // Read-only tabs can still read/search collections; disable only mutating controls.
    if (storage.readOnly && !storage.conflict && !storage.busy) {
      viewportEl.inert = false;
      viewportEl
        .querySelectorAll("input,textarea,select,[contenteditable],button")
        .forEach((el) => {
          if (el.matches("[contenteditable]")) el.contentEditable = "false";
          if (el.matches("input,textarea,select")) el.disabled = true;
          if (
            el.matches("button") &&
            /new|create|write|edit|delete|move|save|format|image|video|add|rename/i.test(
              el.textContent,
            ) &&
            !/courses|focus on|open/i.test(el.textContent)
          )
            el.disabled = true;
        });
      viewportEl
        .querySelectorAll(
          '[data-create],[data-command],[data-item-index],button[class*="btn-chap-"],button[class*="btn-rename"],button[class*="btn-delete"]',
        )
        .forEach((el) => {
          el.disabled = true;
        });
    }
    globalSavePill.querySelector(".autosave-label").textContent =
      storage.recoveryError
        ? "Recovery needed"
        : storage.conflict
          ? "Draft protected"
          : storage.readOnly
            ? "Read only"
            : storage.status === "error"
              ? "Save failed"
              : storage.status === "saving"
                ? "Saving…"
                : "Saved";
    globalSavePill.className = `autosave-status is-${storage.recoveryError || storage.conflict || storage.status === "error" ? "error" : storage.status}`;
  }
  let renderedRoute;
  // Render only when the route changes; opening a dialog must not destroy an editor draft.
  function renderCurrentView() {
    const route = JSON.stringify([
      state.view,
      state.viewParams,
      state.uiVersion,
    ]);
    if (renderedRoute === route) {
      sidebarEl.classList.toggle("is-open", state.isMobileSidebarOpen);
      mobileOverlay?.classList.toggle("is-open", state.isMobileSidebarOpen);
      updateSafety();
      return;
    }
    renderedRoute = route;
    viewportEl._cleanupView?.();
    viewportEl._cleanupView = null;
    document.body.classList.remove("lesson-focus");
    // 1. Render/refresh sidebar
    renderSidebar(sidebarEl);

    // 2. Mobile drawer classes
    if (state.isMobileSidebarOpen) {
      sidebarEl.classList.add("is-open");
      mobileOverlay?.classList.add("is-open");
    } else {
      sidebarEl.classList.remove("is-open");
      mobileOverlay?.classList.remove("is-open");
    }

    // 3. Update topbar breadcrumbs
    updateBreadcrumbs(breadcrumbsEl);

    // 4. Render main view
    const view = state.view;
    const params = state.viewParams || {};

    if (storage.recoveryError) {
      viewportEl.innerHTML = `<section class="recovery-screen view-container"><div class="collection-eyebrow">YOUR DATA IS PRESERVED</div><h1>Let’s recover your workspace.</h1><p>Coffee could not read the saved notes. The original data has been kept, and editing is paused to protect it.</p><p>${escape(storage.recoveryError)}</p><button class="btn btn-primary" id="recovery-settings">Open backups & recovery</button><button class="btn btn-secondary" id="recovery-download">Download preserved data</button></section>`;
      viewportEl.querySelector("#recovery-settings").onclick = () =>
        state.openSettings();
      viewportEl.querySelector("#recovery-download").onclick = () =>
        storage.exportDamagedData();
      updateSafety();
      return;
    }
    switch (view) {
      case "home":
        renderHomeView(viewportEl);
        break;
      case "books":
        renderBooksView(viewportEl);
        break;
      case "book-detail":
        renderBookDetailView(viewportEl, params.bookId);
        break;
      case "courses":
        renderCoursesView(viewportEl);
        break;
      case "course-detail":
        renderCourseDetailView(viewportEl, params.courseId);
        break;
      case "video-detail":
        renderVideoDetailView(viewportEl, params.videoId);
        break;
      case "lessons":
        renderLessonsView(viewportEl);
        break;
      case "editor":
        renderEditorView(viewportEl, params);
        break;
      default:
        renderHomeView(viewportEl);
        break;
    }
    updateSafety();
  }

  function updateBreadcrumbs(container) {
    if (!container) return;
    const view = state.view;
    const params = state.viewParams || {};
    const data = storage.getData();

    let crumbsHtml = `
      <button type="button" class="breadcrumb-link" id="crumb-home">
        ${icon("home", "", 14)} Home
      </button>
    `;

    if (view === "books") {
      crumbsHtml += `
        <span class="breadcrumb-separator">/</span>
        <button type="button" class="breadcrumb-link breadcrumb-current" id="crumb-books" aria-current="page">Books</button>
      `;
    } else if (view === "book-detail") {
      const book = data.books?.find((b) => b.id === params.bookId);
      crumbsHtml += `
        <span class="breadcrumb-separator">/</span>
        <button type="button" class="breadcrumb-link" id="crumb-books">Books</button>
        <span class="breadcrumb-separator">/</span>
        <span class="breadcrumb-current">${escape(book?.title || "Book")}</span>
      `;
    } else if (view === "courses") {
      crumbsHtml += `
        <span class="breadcrumb-separator">/</span>
        <button type="button" class="breadcrumb-link breadcrumb-current" id="crumb-courses" aria-current="page">Courses</button>
      `;
    } else if (view === "course-detail") {
      const course = data.courses?.find((c) => c.id === params.courseId);
      crumbsHtml += `
        <span class="breadcrumb-separator">/</span>
        <button type="button" class="breadcrumb-link" id="crumb-courses">Courses</button>
        <span class="breadcrumb-separator">/</span>
        <span class="breadcrumb-current">${escape(course?.title || "Course")}</span>
      `;
    } else if (view === "video-detail") {
      const video = data.videos?.find((v) => v.id === params.videoId);
      crumbsHtml += `
        <span class="breadcrumb-separator">/</span>
        <button type="button" class="breadcrumb-link" id="crumb-courses">Courses</button>
        <span class="breadcrumb-separator">/</span>
        <span class="breadcrumb-current">${escape(video?.title || "Video")}</span>
      `;
    } else if (view === "lessons") {
      const module = data.lessonModules?.find((m) => m.id === params.moduleId);
      crumbsHtml += `
        <span class="breadcrumb-separator">/</span>
        <button type="button" class="breadcrumb-link${module ? "" : " breadcrumb-current"}" id="crumb-lessons"${module ? "" : ' aria-current="page"'}>Lessons</button>${module ? `<span class="breadcrumb-separator">/</span><span class="breadcrumb-current">${escape(module.title)}</span>` : ""}
      `;
    } else if (view === "editor") {
      const lesson =
        params.editorType === "lesson"
          ? data.lessons.find((l) => l.id === params.itemId)
          : null;
      const lessonModule = data.lessonModules?.find(
        (m) => m.id === lesson?.moduleId,
      );
      const parentLabel = lesson
        ? lessonModule?.title || "Unfiled lessons"
        : params.parentTitle || "Notes";
      crumbsHtml += `
        <span class="breadcrumb-separator">/</span>
        <button type="button" class="breadcrumb-link" id="crumb-editor-parent">${escape(parentLabel)}</button>
        <span class="breadcrumb-separator">/</span>
        <span class="breadcrumb-current">${escape(
          (params.editorType === "lesson"
            ? data.lessons.find((x) => x.id === params.itemId)?.title
            : params.editorType === "chapter"
              ? data.books
                  .find((x) => x.id === params.parentId)
                  ?.chapters?.find((x) => x.id === params.itemId)?.title
              : params.editorType === "course-lesson"
                ? data.courses
                    .find((x) => x.id === params.parentId)
                    ?.modules?.flatMap((x) => x.lessons || [])
                    .find((x) => x.id === params.itemId)?.title
                : data.videos.find((x) => x.id === params.itemId)?.title) ||
            params.title ||
            "Notes",
        )}</span>
      `;
    }

    container.innerHTML = crumbsHtml;

    // Attach crumb click listeners
    container
      .querySelector("#crumb-home")
      ?.addEventListener("click", () => state.navigate("home"));
    container
      .querySelector("#crumb-books")
      ?.addEventListener("click", () => state.navigate("books"));
    container
      .querySelector("#crumb-lessons")
      ?.addEventListener("click", () => state.navigate("lessons"));
    container
      .querySelector("#crumb-courses")
      ?.addEventListener("click", () => state.navigate("courses"));
    container
      .querySelector("#crumb-editor-parent")
      ?.addEventListener("click", () => {
        if (params.editorType === "chapter" && params.parentId) {
          state.navigate("book-detail", { bookId: params.parentId });
        } else if (params.editorType === "course-lesson" && params.parentId) {
          state.navigate("course-detail", { courseId: params.parentId });
        } else if (params.editorType === "lesson") {
          const lesson = data.lessons.find((l) => l.id === params.itemId);
          state.navigate(
            "lessons",
            lesson?.moduleId ? { moduleId: lesson.moduleId } : {},
          );
        } else {
          state.goBack("home");
        }
      });
  }

  // Subscribe to state and storage changes
  state.subscribe(() => renderCurrentView());
  storage.subscribe((data, event) => {
    // If storage changes, re-render counts and views
    renderSidebar(sidebarEl);
    if (event?.action === "import" || event?.action === "clear")
      state.refresh();
    updateSafety();
  });

  // Initial render
  renderCurrentView();
}

function escape(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

document.addEventListener("DOMContentLoaded", initApp);
