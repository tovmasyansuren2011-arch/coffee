/**
 * Sidebar Component for Coffee
 * Fixed 240-260px left sidebar with Coffee bean logo,
 * EXACTLY 3 main library navigation sections (Books, Courses & Videos, Lessons),
 * and tools (Search, Settings).
 */

import { icon } from "../ui/icons.js";
import { state } from "../data/state.js";
import { storage } from "../data/storage.js";

export function renderSidebar(containerEl) {
  const data = storage.getData();
  const currentView = state.view;
  const type = state.viewParams?.editorType;
  const activeSection =
    currentView === "editor"
      ? type === "chapter"
        ? "books"
        : ["course-lesson", "video"].includes(type)
          ? "courses"
          : "lessons"
      : currentView;

  const bookCount = data.books?.length || 0;
  const courseAndVideoCount =
    (data.courses?.length || 0) + (data.videos?.length || 0);
  const lessonCount = data.lessons?.length || 0;

  const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
  const shortcutSymbol = isMac ? "⌘K" : "Ctrl+K";

  containerEl.innerHTML = `
    <div class="sidebar-header">
      <button type="button" class="app-brand" id="nav-brand" title="Coffee — Personal Knowledge Vault">
        <span class="app-brand-icon">
          ${icon("coffee-bean", "", 22)}
        </span>
        <span>Coffee</span>
      </button>
    </div>

    <div class="sidebar-nav-container">
      <div class="nav-section">
        <div class="nav-section-title">Learn</div>
        <ul class="nav-list"><li><button type="button" class="nav-item-btn ${currentView === "home" ? "is-active" : ""}" id="nav-home"><span class="nav-icon">${icon("home", "", 18)}</span><span>Home</span></button></li>
          <li>
            <button type="button" class="nav-item-btn ${["books", "book-detail"].includes(activeSection) ? "is-active" : ""}" id="nav-books">
              <span class="nav-icon">${icon("book", "", 18)}</span>
              <span>Books</span>
              ${bookCount > 0 ? `<span class="nav-badge">${bookCount}</span>` : ""}
            </button>
          </li>
          <li>
            <button type="button" class="nav-item-btn ${["courses", "course-detail", "video-detail"].includes(activeSection) ? "is-active" : ""}" id="nav-courses">
              <span class="nav-icon">${icon("graduation", "", 18)}</span>
              <span>Courses & Videos</span>
              ${courseAndVideoCount > 0 ? `<span class="nav-badge">${courseAndVideoCount}</span>` : ""}
            </button>
          </li>
          <li>
            <button type="button" class="nav-item-btn ${["lessons", "lesson-detail"].includes(activeSection) ? "is-active" : ""}" id="nav-lessons">
              <span class="nav-icon">${icon("lesson", "", 18)}</span>
              <span>Lessons</span>
              ${lessonCount > 0 ? `<span class="nav-badge">${lessonCount}</span>` : ""}
            </button>
          </li>
        </ul>
      </div>

      <div class="nav-section">
        <div class="nav-section-title">Tools</div>
        <ul class="nav-list">
          <li>
            <button type="button" class="nav-item-btn" id="nav-search">
              <span class="nav-icon">${icon("search", "", 18)}</span>
              <span>Search</span>
              <span class="sidebar-shortcut-hint">${shortcutSymbol}</span>
            </button>
          </li>
        </ul>
      </div>
    </div>

    <div class="sidebar-footer">
      <button type="button" class="nav-item-btn" id="nav-settings">
        <span class="nav-icon">${icon("settings", "", 18)}</span>
        <span>Settings</span>
      </button>
    </div>
  `;

  containerEl
    .querySelectorAll(".nav-item-btn.is-active")
    .forEach((button) => button.setAttribute("aria-current", "page"));

  // Attach event handlers
  containerEl.querySelector("#nav-home").onclick = () => state.navigate("home");
  containerEl.querySelector("#nav-brand").addEventListener("click", () => {
    state.navigate("home");
  });

  containerEl.querySelector("#nav-books").addEventListener("click", () => {
    state.navigate("books");
  });

  containerEl.querySelector("#nav-courses").addEventListener("click", () => {
    state.navigate("courses");
  });

  containerEl.querySelector("#nav-lessons").addEventListener("click", () => {
    state.navigate("lessons");
  });

  containerEl.querySelector("#nav-search").addEventListener("click", () => {
    state.openSearch();
  });

  containerEl.querySelector("#nav-settings").addEventListener("click", () => {
    state.openSettings();
  });
}
