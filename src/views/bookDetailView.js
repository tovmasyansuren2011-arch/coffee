/**
 * Book Detail View for Coffee
 * Displays book metadata, list of chapters with numbers (01, 02...),
 * chapter management (add, rename, delete, reorder), and jump to notes.
 */

import { icon } from "../ui/icons.js";
import { state } from "../data/state.js";
import { storage } from "../data/storage.js";
import { showModal, confirmModal } from "../ui/modal.js";
import { showToast } from "../ui/toast.js";

export function renderBookDetailView(containerEl, bookId) {
  const data = storage.getData();
  const book = data.books?.find((b) => b.id === bookId);

  if (!book) {
    containerEl.innerHTML = `
      <div class="view-container">
        <div class="detail-nav-back" id="back-to-books">
          ${icon("arrow-left", "", 16)} Back to Books
        </div>
        <div class="empty-state-card">
          <h2 class="empty-state-title">Book Not Found</h2>
          <p class="empty-state-desc">This book may have been deleted.</p>
        </div>
      </div>
    `;
    containerEl
      .querySelector("#back-to-books")
      .addEventListener("click", () => state.navigate("books"));
    return;
  }

  const chapters = book.chapters || [];

  containerEl.innerHTML = `
    <div class="view-container">
      <div class="detail-header">
        <div class="detail-nav-back" id="btn-back-books">
          ${icon("arrow-left", "", 15)} Books
        </div>

        <div class="detail-title-row">
          <div>
            <h1 class="detail-title">${escape(book.title)}</h1>
            ${book.author ? `<div class="detail-author">${escape(book.author)}</div>` : ""}
          </div>
          <div style="display: flex; gap: 8px;">
            <button type="button" class="btn btn-secondary btn-sm" id="btn-edit-book" title="Edit book details">
              ${icon("edit", "", 14)} Edit
            </button>
            <button type="button" class="btn btn-danger-outline btn-sm" id="btn-delete-book" title="Delete book">
              ${icon("trash", "", 14)} Delete
            </button>
          </div>
        </div>

        ${book.description ? `<p class="detail-desc">${escape(book.description)}</p>` : ""}
      </div>

      <div>
        <div class="section-headline">
          <span class="section-label">Chapters (${chapters.length})</span>
          <button type="button" class="btn btn-secondary btn-sm" id="btn-add-chapter">
            ${icon("plus", "", 14)} Add Chapter
          </button>
        </div>

        ${
          chapters.length === 0
            ? `
          <div class="empty-state-card" style="padding: 36px 16px;">
            <p class="empty-state-title" style="font-size: 14px;">No chapters yet</p>
            <p class="empty-state-desc">Add chapter 1 to start drafting your reading notes.</p>
            <button type="button" class="btn btn-primary btn-sm" id="btn-empty-add-chapter" style="margin-top: 6px;">
              ${icon("plus", "", 14)} Add First Chapter
            </button>
          </div>
        `
            : `
          <div class="items-list" id="chapters-list">
            ${chapters
              .map((chap, idx) => {
                const numStr = String(idx + 1).padStart(2, "0");
                const hasNotes = Boolean(
                  chap.notes && chap.notes.trim().length > 0,
                );
                const previewText = hasNotes
                  ? chap.notes
                      .replace(/[#*`_>\n]/g, " ")
                      .substring(0, 80)
                      .trim() + "..."
                  : "No notes yet";

                return `
                <div class="list-row-item chapter-row" data-id="${chap.id}" data-idx="${idx}">
                  <div class="row-item-left">
                    <span class="row-index">${numStr}</span>
                    <div>
                      <div class="row-title">${escape(chap.title)}</div>
                      <div class="row-meta">${escape(previewText)}</div>
                    </div>
                  </div>
                  <div class="row-actions" onclick="event.stopPropagation();">
                    ${
                      idx > 0
                        ? `
                      <button type="button" class="btn-icon-only btn-chap-up" data-idx="${idx}" title="Move up">
                        <span style="font-size: 13px;">↑</span>
                      </button>
                    `
                        : ""
                    }
                    ${
                      idx < chapters.length - 1
                        ? `
                      <button type="button" class="btn-icon-only btn-chap-down" data-idx="${idx}" title="Move down">
                        <span style="font-size: 13px;">↓</span>
                      </button>
                    `
                        : ""
                    }
                    <button type="button" class="btn-icon-only btn-rename-chap" data-id="${chap.id}" title="Rename chapter">
                      ${icon("edit", "", 14)}
                    </button>
                    <button type="button" class="btn-icon-only btn-delete-chap" data-id="${chap.id}" title="Delete chapter">
                      ${icon("trash", "", 14)}
                    </button>
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

  // Attach navigation
  containerEl
    .querySelector("#btn-back-books")
    ?.addEventListener("click", () => {
      state.navigate("books");
    });

  // Edit Book
  containerEl.querySelector("#btn-edit-book")?.addEventListener("click", () => {
    showModal({
      title: "Edit Book",
      contentHtml: `
        <form id="form-edit-book">
          <div class="form-group">
            <label class="form-label" for="edit-book-title">Title *</label>
            <input type="text" id="edit-book-title" class="form-input" value="${escape(book.title)}" required />
          </div>
          <div class="form-group">
            <label class="form-label" for="edit-book-author">Author</label>
            <input type="text" id="edit-book-author" class="form-input" value="${escape(book.author || "")}" />
          </div>
          <div class="form-group">
            <label class="form-label" for="edit-book-desc">Description</label>
            <textarea id="edit-book-desc" class="form-textarea">${escape(book.description || "")}</textarea>
          </div>
        </form>
      `,
      confirmText: "Save Changes",
      onConfirm: (modalEl) => {
        const titleInput = modalEl.querySelector("#edit-book-title");
        const authorInput = modalEl.querySelector("#edit-book-author");
        const descInput = modalEl.querySelector("#edit-book-desc");

        const title = titleInput.value.trim();
        if (!title) return false;

        book.title = title;
        book.author = authorInput.value.trim();
        book.description = descInput.value.trim();
        book.updatedAt = new Date().toISOString();

        if (!storage.saveEntity("books", book)) {
          showToast(
            "Save failed. Export your draft from Settings before closing.",
            "error",
            7000,
          );
          return false;
        }
        showToast("Book updated", "success");
        renderBookDetailView(containerEl, book.id);
        return true;
      },
    });
  });

  // Delete Book
  containerEl
    .querySelector("#btn-delete-book")
    ?.addEventListener("click", () => {
      confirmModal({
        title: "Delete Book?",
        message: `Are you sure you want to delete "${book.title}" and all its chapter notes? This action cannot be undone.`,
        confirmText: "Delete Book",
        isDanger: true,
        onConfirm: () => {
          if (!storage.deleteEntity("books", book.id)) {
            showToast(
              "Save failed. Export your draft from Settings before closing.",
              "error",
              7000,
            );
            return false;
          }
          showToast(`Deleted "${book.title}"`, "info");
          state.navigate("books");
        },
      });
    });

  // Add Chapter
  const handleAddChapter = () => {
    showModal({
      title: "Add Chapter",
      subtitle: `Book: ${book.title}`,
      contentHtml: `
        <form id="form-add-chap">
          <div class="form-group">
            <label class="form-label" for="new-chap-title">Chapter Title *</label>
            <input type="text" id="new-chap-title" class="form-input" placeholder="e.g. Memory Management & Pointers" required />
          </div>
        </form>
      `,
      confirmText: "Add Chapter",
      onConfirm: (modalEl) => {
        const titleInput = modalEl.querySelector("#new-chap-title");
        const chapTitle = titleInput.value.trim();
        if (!chapTitle) return false;

        if (!book.chapters) book.chapters = [];
        const nextNum = book.chapters.length + 1;
        const newChapter = {
          id: `chap-${book.id}-${Date.now()}`,
          title: chapTitle,
          notes: "",
        };

        book.chapters.push(newChapter);
        book.updatedAt = new Date().toISOString();
        if (!storage.saveEntity("books", book)) {
          showToast(
            "Save failed. Export your draft from Settings before closing.",
            "error",
            7000,
          );
          return false;
        }
        showToast(`Added Chapter ${nextNum}`, "success");

        // Automatically open the chapter note editor!
        state.navigate("editor", {
          startEditing: true,
          editorType: "chapter",
          parentId: book.id,
          parentTitle: book.title,
          itemId: newChapter.id,
          title: newChapter.title,
          itemNumber: nextNum,
          notes: newChapter.notes,
        });
        return true;
      },
    });
  };

  containerEl
    .querySelector("#btn-add-chapter")
    ?.addEventListener("click", handleAddChapter);
  containerEl
    .querySelector("#btn-empty-add-chapter")
    ?.addEventListener("click", handleAddChapter);

  // Click on chapter row to open editor
  containerEl.querySelectorAll(".chapter-row").forEach((row) => {
    row.addEventListener("click", () => {
      const chapId = row.getAttribute("data-id");
      const idx = parseInt(row.getAttribute("data-idx"), 10);
      const chap = book.chapters.find((c) => c.id === chapId);
      if (chap) {
        state.navigate("editor", {
          editorType: "chapter",
          parentId: book.id,
          parentTitle: book.title,
          itemId: chap.id,
          title: chap.title,
          itemNumber: idx + 1,
          notes: chap.notes || "",
        });
      }
    });
  });

  // Rename Chapter
  containerEl.querySelectorAll(".btn-rename-chap").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const chapId = btn.getAttribute("data-id");
      const chap = book.chapters.find((c) => c.id === chapId);
      if (!chap) return;

      showModal({
        title: "Rename Chapter",
        contentHtml: `
          <div class="form-group">
            <label class="form-label" for="rename-chap-title">Chapter Title</label>
            <input type="text" id="rename-chap-title" class="form-input" value="${escape(chap.title)}" required />
          </div>
        `,
        confirmText: "Save",
        onConfirm: (modalEl) => {
          const input = modalEl.querySelector("#rename-chap-title");
          const val = input.value.trim();
          if (!val) return false;

          chap.title = val;
          book.updatedAt = new Date().toISOString();
          if (!storage.saveEntity("books", book)) {
            showToast(
              "Save failed. Export your draft from Settings before closing.",
              "error",
              7000,
            );
            return false;
          }
          showToast("Chapter renamed", "success");
          renderBookDetailView(containerEl, book.id);
          return true;
        },
      });
    });
  });

  // Delete Chapter
  containerEl.querySelectorAll(".btn-delete-chap").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const chapId = btn.getAttribute("data-id");
      const chap = book.chapters.find((c) => c.id === chapId);
      if (!chap) return;

      confirmModal({
        title: "Delete Chapter?",
        message: `Delete "${chap.title}" and its notes permanently?`,
        confirmText: "Delete Chapter",
        isDanger: true,
        onConfirm: () => {
          book.chapters = book.chapters.filter((c) => c.id !== chapId);
          storage.removeRecent(chapId);
          book.updatedAt = new Date().toISOString();
          if (!storage.saveEntity("books", book)) {
            showToast(
              "Save failed. Export your draft from Settings before closing.",
              "error",
              7000,
            );
            return false;
          }
          showToast("Chapter deleted", "info");
          renderBookDetailView(containerEl, book.id);
        },
      });
    });
  });

  // Reorder Chapters Up/Down
  containerEl.querySelectorAll(".btn-chap-up").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.getAttribute("data-idx"), 10);
      if (idx > 0) {
        const temp = book.chapters[idx];
        book.chapters[idx] = book.chapters[idx - 1];
        book.chapters[idx - 1] = temp;
        book.updatedAt = new Date().toISOString();
        if (!storage.saveEntity("books", book)) {
          showToast(
            "Save failed. Export your draft from Settings before closing.",
            "error",
            7000,
          );
          return false;
        }
        renderBookDetailView(containerEl, book.id);
      }
    });
  });

  containerEl.querySelectorAll(".btn-chap-down").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.getAttribute("data-idx"), 10);
      if (idx < book.chapters.length - 1) {
        const temp = book.chapters[idx];
        book.chapters[idx] = book.chapters[idx + 1];
        book.chapters[idx + 1] = temp;
        book.updatedAt = new Date().toISOString();
        if (!storage.saveEntity("books", book)) {
          showToast(
            "Save failed. Export your draft from Settings before closing.",
            "error",
            7000,
          );
          return false;
        }
        renderBookDetailView(containerEl, book.id);
      }
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
