import { icon } from "../ui/icons.js";
import { state } from "../data/state.js";
import { storage } from "../data/storage.js";
import { showModal } from "../ui/modal.js";
import { escape } from "../features/richText.js";
import { learningNotes, recentLearning } from "../data/learning.js";
import {
  openCreateBookModal,
  openCreateCourseOrVideoModal,
  openCreateLessonModal,
} from "./createModals.js";

function greeting(now) {
  const hour = now.getHours();
  return hour < 5
    ? "A quiet moment to learn"
    : hour < 12
      ? "Good morning"
      : hour < 17
        ? "Good afternoon"
        : "Good evening";
}
function openNote(note) {
  state.navigate("editor", {
    editorType: note.type,
    parentId: note.parent?.id,
    itemId: note.item.id,
    title: note.title,
    parentTitle: note.parent?.title || note.subtitle,
  });
}
function excerpt(note) {
  return (
    (note.item.notes || "")
      .replace(/[#*`_>]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 160) ||
    "A little space for your next insight. Open this note and make it yours."
  );
}
const cup = `<svg viewBox="0 0 220 180" fill="none" aria-hidden="true"><ellipse cx="108" cy="151" rx="78" ry="12" fill="currentColor" opacity=".1"/><path d="M151 72h16c28 0 30 44 0 47h-13" stroke="currentColor" stroke-width="9"/><path d="M51 65h105v55c0 19-17 29-51 29s-54-10-54-29V65Z" fill="currentColor" opacity=".15"/><path d="M51 65h105v55c0 19-17 29-51 29s-54-10-54-29V65Z" stroke="currentColor" stroke-width="3"/><ellipse cx="104" cy="66" rx="52" ry="10" stroke="currentColor" stroke-width="3"/><path d="M85 44c-18-18 16-20 0-36M114 44c-18-18 16-20 0-36M141 44c-18-18 16-20 0-36" stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity=".55"/></svg>`;

export function renderHomeView(container) {
  const data = storage.getData();
  const allNotes = learningNotes(data);
  const recent = recentLearning(data, storage.getRecentItems());
  const featured = recent[0];
  const written = allNotes.filter(
    (note) =>
      note.item.notes?.trim() ||
      /<(img|video|iframe)\b/.test(note.item.notesHtml || ""),
  ).length;
  const wordCount = allNotes.reduce(
    (sum, note) =>
      sum + (note.item.notes || "").split(/\s+/).filter(Boolean).length,
    0,
  );
  const shelves = [
    {
      view: "books",
      icon: "book",
      title: "Books",
      number: data.books.length,
      unit: "books",
      detail: "One chapter, one new perspective.",
      accent: "ochre",
    },
    {
      view: "courses",
      icon: "graduation",
      title: "Courses & videos",
      number: data.courses.length + data.videos.length,
      unit: "resources",
      detail: "Turn the lecture into lasting knowledge.",
      accent: "sage",
    },
    {
      view: "lessons",
      icon: "lesson",
      title: "Lessons",
      number: data.lessons.length,
      unit: "lessons",
      detail: "Give every idea a place to grow.",
      accent: "clay",
    },
  ];
  container.innerHTML = `<div class="home-v6">
    <header class="home-welcome"><div><div class="home-eyebrow">A LITTLE EVERY DAY</div><h1 id="home-greeting">${greeting(new Date())}.</h1><p>Make a little room for your next big idea.</p></div><div class="home-date-pill">${icon("clock", "", 16)}<span id="home-live-date"></span><span class="home-time" id="home-live-time" aria-label="Current local time"></span></div></header>
    <section class="home-hero" aria-label="Your learning desk"><div class="home-hero-copy"><span class="home-kicker">YOUR PERSONAL LEARNING DESK</span><h2>Good notes.<br>Great discoveries.</h2><p>A book, a lecture, a thought worth keeping.<br>Bring it all together, at your own pace.</p><div class="home-hero-actions"><button class="btn btn-primary" id="btn-start-session">${icon(featured ? "eye" : "plus", "", 17)} ${featured ? "Continue learning" : "Write your first lesson"}</button><button class="btn btn-secondary" id="btn-home-create">${icon("plus", "", 16)} Create new</button></div></div><div class="home-hero-art">${cup}<span>One idea at a time.</span></div><div class="home-hero-foot"><span><i></i> Your own space to learn</span><span>Saved on this device</span></div></section>
    <div class="home-stats" aria-label="Learning overview"><div><strong>${allNotes.length}</strong><span>Notes in your workspace</span></div><div><strong>${written}</strong><span>Notes with something to keep</span></div><div><strong>${wordCount.toLocaleString()}</strong><span>Words collected</span></div></div>
    <div class="home-main-grid"><section class="home-continue"><div class="home-section-heading"><div><span class="home-eyebrow">PICK UP THE THREAD</span><h2>Back to your ideas</h2></div><button class="btn btn-ghost btn-sm" id="home-search">${icon("search", "", 15)} Find a note</button></div>
    ${
      featured
        ? `<button class="home-featured-note" id="home-featured"><span class="home-note-kind">${icon(featured.icon, "", 17)} ${featured.openedAt ? "LAST OPENED" : "RECENTLY UPDATED"}</span><h3>${escape(featured.title)}</h3><p>${escape(excerpt(featured))}</p><div><span>${escape(featured.subtitle)}</span><strong>Open note ${icon("chevron-right", "", 16)}</strong></div></button>
    <div class="home-recent-list">${recent
      .slice(1, 5)
      .map(
        (note, index) =>
          `<button class="home-recent-row" data-note-index="${index + 1}"><span class="home-row-icon">${icon(note.icon, "", 18)}</span><span class="home-row-text"><strong>${escape(note.title)}</strong><small>${escape(note.subtitle)}</small></span><span class="home-row-date">${note.openedAt ? "Opened" : "Updated"} ${formatRelativeDate(note.openedAt || note.updatedAt)}</span>${icon("chevron-right", "", 15)}</button>`,
      )
      .join("")}</div>`
        : `<div class="home-empty"><div class="home-empty-symbol">${icon("edit", "", 27)}</div><h3>Your next discovery starts here.</h3><p>Capture a thought, summarize a chapter, or collect what you learned today.</p><button class="btn btn-secondary" id="home-empty-create">Create a lesson ${icon("plus", "", 15)}</button></div>`
    }</section>
    <aside class="home-capture"><span class="home-eyebrow">START SOMETHING NEW</span><h2>What are you learning?</h2><p>Choose a home for your next idea.</p><div class="home-create-list">${[
      ["book", "Book", "Keep chapter notes", "book"],
      ["course", "Course", "Organize modules & lectures", "graduation"],
      ["video", "Video", "Keep a link and your takeaways", "video"],
      ["lesson", "Lesson", "Capture a single concept", "lesson"],
    ]
      .map(
        ([type, title, description, glyph]) =>
          `<button data-create="${type}"><span class="home-row-icon">${icon(glyph, "", 19)}</span><span><strong>${title}</strong><small>${description}</small></span>${icon("plus", "", 16)}</button>`,
      )
      .join(
        "",
      )}</div><div class="home-capture-tip">${icon("search", "", 16)}<span>Find a thought in seconds.<br><kbd>Ctrl / ⌘</kbd> + <kbd>K</kbd> to search.</span></div></aside></div>
    <section class="home-shelves"><div class="home-section-heading"><div><span class="home-eyebrow">EVERYTHING IN ITS PLACE</span><h2>Your learning shelves</h2></div><span class="home-section-caption">A growing collection of what matters to you.</span></div><div class="home-shelf-grid">${shelves.map((shelf) => `<button class="home-shelf home-shelf-${shelf.accent}" data-target="${shelf.view}"><span class="home-shelf-top"><span class="home-shelf-icon">${icon(shelf.icon, "", 23)}</span>${icon("arrow-up-right", "", 18)}</span><h3>${shelf.title}</h3><p>${shelf.detail}</p><div><strong>${shelf.number}</strong><span>${shelf.unit}</span>${icon("chevron-right", "", 16)}</div></button>`).join("")}</div></section>
    <footer class="home-footer"><span>${icon("coffee-bean", "", 15)} A calmer place for curious minds.</span><button class="btn btn-ghost btn-sm" id="home-backup">Back up your workspace ${icon("download", "", 14)}</button></footer>
  </div>`;
  const $ = (selector) => container.querySelector(selector);
  function tick() {
    const now = new Date();
    $("#home-live-date").textContent = now.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    $("#home-live-time").textContent = now.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    $("#home-greeting").textContent = `${greeting(now)}.`;
  }
  tick();
  const timer = setInterval(tick, 1000);
  container._cleanupView = () => clearInterval(timer);
  $("#btn-start-session").onclick = () =>
    featured ? openNote(featured) : openCreateLessonModal();
  $("#btn-home-create").onclick = openCreateMenu;
  $("#home-search").onclick = () => state.openSearch();
  $("#home-backup").onclick = () => state.openSettings();
  $("#home-featured")?.addEventListener("click", () => openNote(featured));
  $("#home-empty-create")?.addEventListener("click", openCreateLessonModal);
  container.querySelectorAll("[data-target]").forEach((button) => {
    button.onclick = () => state.navigate(button.dataset.target);
  });
  container.querySelectorAll("[data-note-index]").forEach((button) => {
    button.onclick = () => openNote(recent[Number(button.dataset.noteIndex)]);
  });
  container.querySelectorAll("[data-create]").forEach((button) => {
    button.onclick = () => create(button.dataset.create);
  });
}
function create(type) {
  if (!storage.canEdit()) return;
  if (type === "book") openCreateBookModal();
  else if (type === "lesson") openCreateLessonModal();
  else openCreateCourseOrVideoModal(type);
}
function openCreateMenu() {
  if (!storage.canEdit()) return;
  showModal({
    title: "Create something new",
    subtitle: "Choose where your next idea belongs.",
    contentHtml: `<div class="desk-create-options">${[
      ["book", "Book", "Chapter by chapter"],
      ["course", "Course", "Modules and lessons"],
      ["video", "Video", "Lecture notes and links"],
      ["lesson", "Lesson", "One concept, one note"],
    ]
      .map(
        ([type, title, description]) =>
          `<button class="btn btn-secondary" data-create="${type}"><strong>${title}</strong><small>${description}</small></button>`,
      )
      .join("")}</div>`,
    confirmText: "",
    onOpen: (modal) => {
      modal.querySelectorAll("[data-create]").forEach((button) => {
        button.onclick = () => create(button.dataset.create);
      });
    },
  });
}
export function formatRelativeDate(iso) {
  if (!iso || !Number.isFinite(Date.parse(iso))) return "recently";
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso)) / 1000));
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
