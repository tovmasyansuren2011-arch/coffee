import { state } from "../data/state.js";
import { storage } from "../data/storage.js";
import { showToast } from "../ui/toast.js";
import { showModal, closeModal } from "../ui/modal.js";
import { icon } from "../ui/icons.js";
import {
  escape,
  noteHTML,
  cleanHTML,
  notesText,
} from "../features/richText.js";
import {
  fileMediaHTML,
  linkedVideoHTML,
  hydrateMedia,
  releaseMedia,
} from "../features/media.js";
import { safeWebUrl } from "../features/videoLinks.js";
import { deleteLesson } from "../features/deleteLesson.js";

export function renderEditorView(container, params) {
  const data = storage.getData();
  let item, parent;
  if (params.editorType === "chapter") {
    parent = data.books.find((b) => b.id === params.parentId);
    item = parent?.chapters?.find((c) => c.id === params.itemId);
  }
  if (params.editorType === "course-lesson") {
    parent = data.courses.find((c) => c.id === params.parentId);
    item = parent?.modules
      ?.flatMap((m) => m.lessons || [])
      .find((l) => l.id === params.itemId);
  }
  if (params.editorType === "lesson")
    item = data.lessons.find((l) => l.id === params.itemId);
  if (params.editorType === "video")
    item = data.videos.find((v) => v.id === params.itemId);
  if (!item) {
    container.innerHTML =
      '<div class="view-container">This note is no longer available.</div>';
    return;
  }
  if (params.editorType === "lesson") {
    const module = data.lessonModules?.find((m) => m.id === item.moduleId);
    params = {
      ...params,
      moduleId: module?.id,
      parentTitle: module?.title || "Unfiled lesson",
    };
  }
  if (parent) params = { ...params, parentTitle: parent.title };
  let editing = !!params.startEditing && storage.canEdit(),
    selection,
    draftChanged = false;
  const formatButtons = [
    ["bold", "<b>B</b>", "Bold"],
    ["italic", "<i>I</i>", "Italic"],
    ["underline", "<u>U</u>", "Underline"],
    ["strikeThrough", "<s>S</s>", "Strikethrough"],
  ];
  container.innerHTML = `<article class="lesson-workspace polished-editor"><div class="lesson-controls"><button type="button" class="btn btn-secondary btn-sm" id="lesson-back">← Back</button><span class="lesson-context">${escape(params.parentTitle || "Lesson")}</span>${params.editorType === "lesson" ? '<button type="button" class="btn btn-ghost btn-sm lesson-delete-control" id="editor-delete-lesson">Delete lesson</button>' : ""}<button type="button" class="btn btn-primary btn-sm" id="lesson-edit">Edit notes</button></div>
 <section class="lesson-write" hidden><label class="form-label" for="lesson-heading">Lesson heading</label><input class="lesson-heading-input" id="lesson-heading" placeholder="Give this lesson a heading" value="${escape(item.title || params.title || "")}">
 <div class="note-editor-card"><div class="rich-toolbar" role="toolbar" aria-label="Note formatting"><div class="formatting-row"><div class="formatting-group">${formatButtons.map(([cmd, label, title]) => `<button type="button" class="toolbar-btn" data-command="${cmd}" title="${title}" aria-label="${title}">${label}</button>`).join("")}</div><span class="toolbar-divider"></span><select id="rich-block" aria-label="Text style"><option value="p">Paragraph</option><option value="h2">Heading</option><option value="h3">Subheading</option><option value="pre">Code</option><option value="blockquote">Quote</option></select><select id="rich-font" aria-label="Font"><option value="Arial">Sans serif</option><option value="Georgia">Serif</option><option value="monospace">Monospace</option><option value="Comic Sans MS, Comic Sans, Comic Neue, Noto Sans Armenian, cursive">Comic Sans</option><option value="Comfortaa, Noto Sans Armenian, sans-serif">Comfortaa</option><option value="Roboto, Noto Sans Armenian, sans-serif">Roboto</option><option value="Noto Sans Armenian, Roboto, sans-serif">Armenian · Հայերեն</option></select><label class="color-control">Text <input type="color" id="rich-color" value="#70482d" aria-label="Text color"></label><label class="color-control">Highlight <input type="color" id="rich-highlight" value="#fff0ac" aria-label="Highlight color"></label></div>
 <div class="formatting-row formatting-row-secondary"><div class="formatting-group">${[
   ["insertUnorderedList", "• List", "Bullet list"],
   ["insertOrderedList", "1. List", "Numbered list"],
   ["undo", "↶", "Undo"],
   ["redo", "↷", "Redo"],
   ["removeFormat", "Clear style", "Remove formatting"],
 ]
   .map(
     ([cmd, label, title]) =>
       `<button type="button" class="toolbar-btn" data-command="${cmd}" title="${title}" aria-label="${title}">${label}</button>`,
   )
   .join(
     "",
   )}</div><div class="formatting-group media-insert-buttons"><button type="button" class="toolbar-btn" id="rich-photo">${icon("image", "", 15)} Image / sketch</button><button type="button" class="toolbar-btn" id="rich-video">${icon("video", "", 15)} Video</button></div></div></div>
 <div id="rich-notes" class="rich-notes" contenteditable="true" role="textbox" aria-label="Lesson notes" aria-multiline="true" data-placeholder="Write or paste your notes. Drop images, sketches, or videos wherever you need them."></div>
 <div class="note-inline-hint">Paste or drop media at the cursor. Select text to format it.</div><input type="file" id="note-photo" accept="image/png,image/jpeg,image/webp,image/gif" multiple hidden><input type="file" id="note-video" accept="video/mp4,video/webm,video/ogg" hidden></div>
 <div class="note-footer"><span id="note-status" class="note-status" aria-live="polite">Saved</span><span id="note-stats"></span><button type="button" class="btn btn-primary" id="note-focus">Save & focus</button></div></section>
 ${safeWebUrl(item.videoUrl || item.url) ? `<details class="lecture-panel"><summary>${icon("video", "", 18)} Watch lecture <span>Video opens when expanded</span></summary><div id="lecture-player"></div><a class="btn btn-ghost btn-sm" href="${escape(safeWebUrl(item.videoUrl || item.url))}" target="_blank" rel="noopener noreferrer">Open original video ↗</a></details>` : ""}
 <section class="lesson-read"><h1 id="read-heading"></h1><div id="read-notes" class="rich-notes reading-notes"></div></section><button type="button" class="focus-edit btn btn-secondary btn-sm" id="focus-edit">Edit notes</button><button type="button" class="focus-exit" id="focus-exit" aria-label="Exit focus mode" title="Exit focus mode (Esc)">×</button></article>`;
  const $ = (s) => container.querySelector(s),
    editor = $("#rich-notes"),
    preview = $("#read-notes");
  editor.innerHTML = noteHTML(item);
  function stats() {
    const words = (item.notes || "").split(/\s+/).filter(Boolean).length;
    $("#note-stats").textContent =
      `${words} words · ${Math.max(1, Math.ceil(words / 200))} min read`;
  }
  function prepareDraft() {
    if (!draftChanged) return;
    item.title = $("#lesson-heading").value.trim() || "Untitled lesson";
    item.notesHtml = cleanHTML(editor.innerHTML);
    item.notes = notesText(item.notesHtml);
    item.updatedAt = new Date().toISOString();
    if (parent) parent.updatedAt = item.updatedAt;
    draftChanged = false;
    stats();
  }
  storage.draftFlusher = prepareDraft;
  function sync() {
    if (!storage.canEdit()) return;
    draftChanged = true;
    storage.scheduleDebouncedSave(400);
  }
  const unsub = storage.onSaveStatus((status, detail) => {
    $("#note-status").textContent =
      status === "error"
        ? "Save failed — export a backup"
        : status === "saving"
          ? "Saving…"
          : "Saved";
    $("#note-status").dataset.status = status;
    if (status === "error") showToast(detail || "Storage full", "error");
  });
  const hydrateEditor = () =>
    hydrateMedia(editor, { editable: true, onRemove: sync });
  hydrateEditor();
  function showRead(focus = true) {
    editing = false;
    $(".lesson-write").hidden = true;
    $(".lesson-read").hidden = false;
    $("#read-heading").textContent = item.title || "Untitled lesson";
    preview.innerHTML =
      noteHTML(item) ||
      '<p class="empty-note">Your notes will appear here. Choose Edit notes to start writing.</p>';
    hydrateMedia(preview);
    $("#lesson-edit").textContent = "Edit notes";
    document.body.classList.toggle("lesson-focus", focus);
    $("#focus-exit").hidden = !focus;
    $("#focus-edit").hidden = !focus || !storage.canEdit();
  }
  function showEdit() {
    if (!storage.canEdit()) return;
    editing = true;
    document.body.classList.remove("lesson-focus");
    $(".lesson-write").hidden = false;
    $(".lesson-read").hidden = true;
    $("#focus-exit").hidden = true;
    $("#focus-edit").hidden = true;
    $("#lesson-edit").textContent = "Focus mode";
  }
  $("#lesson-edit").onclick = () => {
    if (editing) {
      sync();
      storage.flushPendingSave();
      showRead();
    } else showEdit();
  };
  $("#note-focus").onclick = () => {
    sync();
    storage.flushPendingSave();
    showRead();
  };
  $("#focus-exit").onclick = () => showRead(false);
  $("#focus-edit").onclick = showEdit;
  $("#lesson-back").onclick = () => {
    if (editing) sync();
    storage.flushPendingSave();
    state.goBack("lessons");
  };
  $("#editor-delete-lesson")?.addEventListener("click", () =>
    deleteLesson(item),
  );
  function remember() {
    const s = window.getSelection();
    if (s?.rangeCount && editor.contains(s.anchorNode))
      selection = s.getRangeAt(0).cloneRange();
  }
  document.addEventListener("selectionchange", remember);
  function restore(range = selection) {
    editor.focus();
    const s = window.getSelection();
    if (range && editor.contains(range.startContainer)) {
      s.removeAllRanges();
      s.addRange(range);
    } else {
      const end = document.createRange();
      end.selectNodeContents(editor);
      end.collapse(false);
      s.removeAllRanges();
      s.addRange(end);
    }
  }
  function command(cmd, value = null, range) {
    if (!storage.canEdit()) return;
    restore(range);
    document.execCommand(cmd, false, value);
    remember();
    sync();
  }
  function insertHTML(html, range) {
    if (!container.contains(editor) || !storage.canEdit()) return;
    command("insertHTML", `${cleanHTML(html)}<p><br></p>`, range);
    hydrateEditor();
  }
  $(".rich-toolbar").onmousedown = (e) => {
    remember();
    if (e.target.closest("button")) e.preventDefault();
  };
  container
    .querySelectorAll("[data-command]")
    .forEach((b) => (b.onclick = () => command(b.dataset.command)));
  $("#rich-block").onchange = (e) => command("formatBlock", e.target.value);
  $("#rich-font").onchange = (e) => command("fontName", e.target.value);
  $("#rich-color").oninput = (e) => command("foreColor", e.target.value);
  $("#rich-highlight").oninput = (e) => command("hiliteColor", e.target.value);
  editor.oninput = sync;
  $("#lesson-heading").oninput = sync;
  let pendingRange;
  $("#rich-photo").onclick = () => {
    remember();
    pendingRange = selection?.cloneRange();
    $("#note-photo").click();
  };
  async function addFiles(files, range) {
    if (!storage.canEdit()) return;
    const status = $("#note-status");
    status.textContent = "Adding media…";
    try {
      const html = [];
      for (const file of files) html.push(await fileMediaHTML(file));
      if (html.length) insertHTML(html.join(""), range);
    } catch (error) {
      showToast(error.message, "error");
      status.textContent = "Media could not be added";
    }
  }
  $("#note-photo").onchange = async (e) => {
    const files = [...e.target.files];
    await addFiles(files, pendingRange);
    e.target.value = "";
  };
  $("#note-video").onchange = async (e) => {
    await addFiles([...e.target.files], pendingRange);
    e.target.value = "";
  };
  $("#rich-video").onclick = () => {
    remember();
    pendingRange = selection?.cloneRange();
    showModal({
      title: "Insert a video",
      subtitle: "Place a video at your cursor in these notes.",
      contentHtml:
        '<div class="form-group"><label class="form-label" for="video-insert-url">Video link</label><input class="form-input" id="video-insert-url" type="url" placeholder="YouTube, Vimeo, or a direct video URL"><p class="video-insert-help">Supports YouTube, Vimeo, and direct MP4, WebM, or Ogg links.</p></div><div class="media-upload-divider">or</div><button type="button" class="btn btn-secondary" id="video-upload-button">Choose a video file</button><p class="video-insert-help">MP4, WebM, or Ogg · up to 50 MB</p>',
      confirmText: "Insert video",
      onOpen: (modal) => {
        modal.querySelector("#video-upload-button").onclick = () => {
          modal.querySelector(".modal-cancel-btn").click();
          $("#note-video").click();
        };
      },
      onConfirm: (modal) => {
        const input = modal.querySelector("#video-insert-url");
        input.setCustomValidity("");
        const html = linkedVideoHTML(input.value.trim());
        if (!html) {
          input.setCustomValidity(
            "Paste a YouTube, Vimeo, or direct MP4/WebM/Ogg video URL.",
          );
          input.reportValidity();
          return false;
        }
        // Release the modal's inert background before restoring the editor selection.
        closeModal();
        insertHTML(html, pendingRange);
        return true;
      },
    });
  };
  function pastedHTML(html) {
    const holder = document.createElement("div");
    holder.innerHTML = cleanHTML(html);
    for (const media of holder.querySelectorAll("img,video,iframe"))
      if (!media.closest("figure")) {
        const figure = document.createElement("figure");
        figure.className = "note-media";
        figure.contentEditable = "false";
        media.replaceWith(figure);
        figure.append(media);
      }
    return cleanHTML(holder.innerHTML);
  }
  async function pasteData(transfer, range) {
    const files = [...transfer.files].filter((f) =>
      /^(image|video)\//.test(f.type),
    );
    if (files.length) {
      await addFiles(files, range);
      return;
    }
    const html = transfer.getData("text/html"),
      plain = transfer.getData("text/plain");
    const video = linkedVideoHTML(plain.trim());
    insertHTML(
      video || (html ? pastedHTML(html) : escape(plain).replace(/\n/g, "<br>")),
      range,
    );
  }
  editor.onpaste = (e) => {
    e.preventDefault();
    remember();
    pasteData(e.clipboardData, selection?.cloneRange()).catch((error) =>
      showToast(error.message, "error"),
    );
  };
  editor.ondragover = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    editor.classList.add("is-dropping");
  };
  editor.ondragleave = () => editor.classList.remove("is-dropping");
  editor.ondrop = (e) => {
    e.preventDefault();
    editor.classList.remove("is-dropping");
    let range = document.caretRangeFromPoint?.(e.clientX, e.clientY);
    if (range && editor.contains(range.startContainer)) {
      const figure = range.startContainer.parentElement?.closest("figure");
      if (figure) {
        range.setStartAfter(figure);
        range.collapse(true);
      }
    } else range = selection?.cloneRange();
    pasteData(e.dataTransfer, range).catch((error) =>
      showToast(error.message, "error"),
    );
  };
  const keys = (e) => {
    if (
      !container.contains(editor) ||
      document.querySelector(".coffee-modal-backdrop.is-open")
    )
      return;
    if (
      e.key === "Escape" &&
      document.body.classList.contains("lesson-focus")
    ) {
      e.preventDefault();
      showRead(false);
      $("#lesson-edit").focus();
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      if (editing) sync();
      storage.flushPendingSave();
    }
  };
  document.addEventListener("keydown", keys);
  const lecture = $(".lecture-panel");
  if (lecture)
    lecture.ontoggle = () => {
      if (lecture.open && !$("#lecture-player").innerHTML)
        $("#lecture-player").innerHTML =
          cleanHTML(linkedVideoHTML(item.videoUrl || item.url)) ||
          "<p>Open the original video to watch this lecture.</p>";
    };
  container._cleanupView = () => {
    if (storage.draftFlusher === prepareDraft) storage.draftFlusher = null;
    unsub();
    document.removeEventListener("keydown", keys);
    document.removeEventListener("selectionchange", remember);
    releaseMedia(editor);
    releaseMedia(preview);
    document.body.classList.remove("lesson-focus");
  };
  stats();
  if (editing) showEdit();
  else showRead();
}
