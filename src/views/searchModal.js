/**
 * Global Search Modal for Coffee
 * Searches across Books, Chapters, Courses, Modules, Lessons, Videos, and Notes content.
 * Keyboard-navigable with highlighted snippets.
 */

import { icon } from "../ui/icons.js";
import { state } from "../data/state.js";
import { storage } from "../data/storage.js";

let modalEl = null;
let selectedIndex = 0;
let currentResults = [];
let returnFocus = null;
let focusTrap = null;

export function setupSearch() {
  // Listen for Cmd+K / Ctrl+K
  window.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      if (
        !state.isSearchOpen &&
        document.querySelector(".coffee-modal-backdrop")
      )
        return;
      e.preventDefault();
      if (state.isSearchOpen) {
        state.closeSearch();
      } else {
        state.openSearch();
      }
    }
  });

  state.subscribe((s) => {
    if (s.isSearchOpen) {
      openSearchModal();
    } else {
      closeSearchModal();
    }
  });
}

function openSearchModal() {
  closeSearchModal();
  currentResults = [];
  selectedIndex = 0;
  returnFocus = document.activeElement;
  const background = document.getElementById("app");
  if (background) background.inert = true;

  modalEl = document.createElement("div");
  modalEl.className = "coffee-modal-backdrop is-open";
  modalEl.setAttribute("role", "dialog");
  modalEl.setAttribute("aria-modal", "true");
  modalEl.setAttribute("aria-label", "Search your workspace");

  modalEl.innerHTML = `
    <div class="search-modal-container">
      <div class="search-input-bar">
        <span class="search-icon">${icon("search", "", 18)}</span>
        <input type="text" class="search-input" id="global-search-input" aria-label="Search your workspace" placeholder="Search books, chapters, courses, lessons, notes..." autocomplete="off" />
        <button type="button" class="coffee-modal-close-btn" id="btn-close-search" aria-label="Close search" title="Close (Esc)">
          ${icon("close", "", 16)}
        </button>
      </div>
      <div class="search-results-list" id="search-results">
        <div class="search-empty-hint">Type to search anything in your library...</div>
      </div>
    </div>
  `;

  document.body.appendChild(modalEl);
  focusTrap = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      state.closeSearch();
    }
    if (event.key === "Tab") {
      const controls = [...modalEl.querySelectorAll("input,button")];
      const index = controls.indexOf(document.activeElement);
      event.preventDefault();
      controls[
        (index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length
      ]?.focus();
    }
  };
  window.addEventListener("keydown", focusTrap, true);

  const input = modalEl.querySelector("#global-search-input");
  const resultsContainer = modalEl.querySelector("#search-results");
  const closeBtn = modalEl.querySelector("#btn-close-search");

  setTimeout(() => input?.focus(), 40);

  closeBtn?.addEventListener("click", () => state.closeSearch());
  modalEl.addEventListener("click", (e) => {
    if (e.target === modalEl) state.closeSearch();
  });

  input?.addEventListener("input", () => {
    const query = input.value.trim();
    performSearch(query, resultsContainer);
  });

  input?.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      state.closeSearch();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (currentResults.length > 0) {
        selectedIndex = (selectedIndex + 1) % currentResults.length;
        updateSelectedHighlight(resultsContainer);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (currentResults.length > 0) {
        selectedIndex =
          (selectedIndex - 1 + currentResults.length) % currentResults.length;
        updateSelectedHighlight(resultsContainer);
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (currentResults.length > 0 && currentResults[selectedIndex]) {
        openResult(currentResults[selectedIndex]);
      }
    }
  });
}

function closeSearchModal() {
  if (modalEl && modalEl.parentNode) {
    modalEl.parentNode.removeChild(modalEl);
    modalEl = null;
    if (focusTrap) window.removeEventListener("keydown", focusTrap, true);
    focusTrap = null;
    const background = document.getElementById("app");
    if (background && !document.querySelector(".coffee-modal-backdrop"))
      background.inert = false;
    if (returnFocus?.isConnected) returnFocus.focus();
    returnFocus = null;
  }
}

function performSearch(query, containerEl) {
  if (!query || query.length < 2) {
    currentResults = [];
    selectedIndex = 0;
    containerEl.innerHTML = `<div class="search-empty-hint">Type to search anything in your library...</div>`;
    return;
  }

  const q = query.toLowerCase();
  const data = storage.getData();
  const results = [];

  // 1. Search Books & Book Chapters
  data.books?.forEach((book) => {
    if (
      book.title.toLowerCase().includes(q) ||
      (book.author && book.author.toLowerCase().includes(q))
    ) {
      results.push({
        type: "book",
        id: book.id,
        title: book.title,
        subtitle: `Book by ${book.author || "Unknown"}`,
        badge: "Book",
        snippet: book.description || "",
      });
    }

    book.chapters?.forEach((chap, idx) => {
      const matchTitle = chap.title.toLowerCase().includes(q);
      const matchNotes = (chap.notes || "").toLowerCase().includes(q);

      if (matchTitle || matchNotes) {
        results.push({
          type: "chapter",
          id: chap.id,
          parentId: book.id,
          parentTitle: book.title,
          title: chap.title,
          subtitle: `${book.title} — Chapter ${idx + 1}`,
          badge: "Chapter",
          snippet: extractSnippet(chap.notes || "", q) || chap.title,
          notes: chap.notes,
        });
      }
    });
  });

  // 2. Search Courses, Modules & Course Lessons
  data.courses?.forEach((course) => {
    if (
      course.title.toLowerCase().includes(q) ||
      (course.instructor && course.instructor.toLowerCase().includes(q))
    ) {
      results.push({
        type: "course",
        id: course.id,
        title: course.title,
        subtitle: `Course by ${course.instructor || "Unknown"}`,
        badge: "Course",
        snippet: course.description || "",
      });
    }

    course.modules?.forEach((mod, mIdx) => {
      if (mod.title.toLowerCase().includes(q)) {
        results.push({
          type: "course",
          id: course.id,
          title: mod.title,
          subtitle: `${course.title} — Module ${mIdx + 1}`,
          badge: "Module",
          snippet: `${mod.lessons?.length || 0} lessons`,
        });
      }

      mod.lessons?.forEach((les) => {
        const matchTitle = les.title.toLowerCase().includes(q);
        const matchNotes = (les.notes || "").toLowerCase().includes(q);

        if (matchTitle || matchNotes) {
          results.push({
            type: "course-lesson",
            id: les.id,
            parentId: course.id,
            parentTitle: course.title,
            subParentId: mod.id,
            subParentTitle: mod.title,
            title: les.title,
            subtitle: `${course.title} • ${mod.title}`,
            badge: "Lesson",
            snippet: extractSnippet(les.notes || "", q) || les.title,
            notes: les.notes,
            videoUrl: les.videoUrl,
          });
        }
      });
    });
  });

  // 3. Search Videos
  data.videos?.forEach((video) => {
    const matchTitle = video.title.toLowerCase().includes(q);
    const matchSource = (video.source || "").toLowerCase().includes(q);
    const matchNotes = (video.notes || "").toLowerCase().includes(q);

    if (matchTitle || matchSource || matchNotes) {
      results.push({
        type: "video",
        id: video.id,
        title: video.title,
        subtitle: video.source ? `Video — ${video.source}` : "Video",
        badge: "Video",
        snippet:
          extractSnippet(video.notes || video.description || "", q) ||
          video.description ||
          "",
      });
    }
  });

  // 4. Search lesson modules and their lessons
  data.lessonModules?.forEach((module) => {
    if (`${module.title} ${module.description || ""}`.toLowerCase().includes(q))
      results.push({
        type: "lesson-module",
        id: module.id,
        title: module.title,
        subtitle: "Lessons module",
        badge: "Module",
        snippet: module.description || "",
      });
  });
  data.lessons?.forEach((lesson) => {
    const matchTitle = lesson.title.toLowerCase().includes(q);
    const matchDesc = (lesson.description || "").toLowerCase().includes(q);
    const matchNotes = (lesson.notes || "").toLowerCase().includes(q);

    if (matchTitle || matchDesc || matchNotes) {
      results.push({
        type: "lesson",
        id: lesson.id,
        title: lesson.title,
        subtitle:
          data.lessonModules?.find((m) => m.id === lesson.moduleId)?.title ||
          lesson.description ||
          "Unfiled lesson",
        badge: "Lesson",
        snippet:
          extractSnippet(lesson.notes || lesson.description || "", q) ||
          lesson.description ||
          "",
        notes: lesson.notes,
      });
    }
  });

  currentResults = results;
  selectedIndex = 0;

  if (results.length === 0) {
    containerEl.innerHTML = `<div class="search-empty-hint">No matches found for "${escapeHtml(query)}"</div>`;
    return;
  }

  containerEl.innerHTML = results
    .map(
      (res, idx) => `
    <button type="button" class="search-result-item ${idx === 0 ? "is-selected" : ""}" data-index="${idx}">
      <div class="search-item-top">
        <span class="search-item-title">${highlightMatch(res.title, query)}</span>
        <span class="search-item-badge">${res.badge}</span>
      </div>
      <div class="row-meta" style="font-size: 11.5px;">${escapeHtml(res.subtitle)}</div>
      ${res.snippet ? `<div class="search-item-snippet">${highlightMatch(res.snippet, query)}</div>` : ""}
    </button>
  `,
    )
    .join("");

  containerEl.querySelectorAll(".search-result-item").forEach((el) => {
    el.addEventListener("click", () => {
      const idx = parseInt(el.getAttribute("data-index"), 10);
      openResult(currentResults[idx]);
    });
  });
}

function updateSelectedHighlight(containerEl) {
  const items = containerEl.querySelectorAll(".search-result-item");
  items.forEach((item, idx) => {
    if (idx === selectedIndex) {
      item.classList.add("is-selected");
      item.scrollIntoView({ block: "nearest" });
    } else {
      item.classList.remove("is-selected");
    }
  });
}

function openResult(res) {
  if (!res) return;
  state.closeSearch();

  if (res.type === "book") {
    state.navigate("book-detail", { bookId: res.id });
  } else if (res.type === "chapter") {
    state.navigate("editor", {
      editorType: "chapter",
      parentId: res.parentId,
      parentTitle: res.parentTitle,
      itemId: res.id,
      title: res.title,
      notes: res.notes,
    });
  } else if (res.type === "course") {
    state.navigate("course-detail", { courseId: res.id });
  } else if (res.type === "course-lesson") {
    state.navigate("editor", {
      editorType: "course-lesson",
      parentId: res.parentId,
      parentTitle: res.parentTitle,
      subParentId: res.subParentId,
      subParentTitle: res.subParentTitle,
      itemId: res.id,
      title: res.title,
      notes: res.notes,
      videoUrl: res.videoUrl,
    });
  } else if (res.type === "video") {
    state.navigate("video-detail", { videoId: res.id });
  } else if (res.type === "lesson-module") {
    state.navigate("lessons", { moduleId: res.id });
  } else if (res.type === "lesson") {
    state.navigate("editor", {
      editorType: "lesson",
      itemId: res.id,
      title: res.title,
      parentTitle: res.subtitle,
      notes: res.notes,
    });
  }
}

function extractSnippet(text, query) {
  if (!text) return "";
  const clean = text.replace(/[#*`_>\[\]]/g, " ").replace(/\s+/g, " ");
  const idx = clean.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return clean.substring(0, 100);

  const start = Math.max(0, idx - 40);
  const end = Math.min(clean.length, idx + query.length + 60);
  return (
    (start > 0 ? "..." : "") +
    clean.substring(start, end).trim() +
    (end < clean.length ? "..." : "")
  );
}

function highlightMatch(text, query) {
  if (!text || !query) return escapeHtml(text || "");
  const escapedText = escapeHtml(text);
  const escapedQ = escapeHtml(query);
  const regex = new RegExp(
    `(${escapedQ.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
    "gi",
  );
  return escapedText.replace(regex, '<mark class="search-highlight">$1</mark>');
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
