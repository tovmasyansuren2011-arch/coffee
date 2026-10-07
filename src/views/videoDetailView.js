import { showToast } from "../ui/toast.js";
import {
  linkedVideoHTML,
  hydrateMedia,
  releaseMedia,
} from "../features/media.js";
import { state } from "../data/state.js";
import { storage } from "../data/storage.js";
import { showModal } from "../ui/modal.js";
import { escape, safeUrl, noteHTML, cleanHTML } from "../features/richText.js";
export function renderVideoDetailView(container, videoId) {
  const video = storage.getData().videos.find((x) => x.id === videoId);
  if (!video) {
    container.innerHTML =
      '<div class="view-container">Video no longer available.</div>';
    return;
  }
  const $ = (s) => container.querySelector(s);
  container.innerHTML = `<div class="view-container"><div class="lesson-controls"><button class="btn btn-secondary" id="video-back">← Courses & Videos</button><button class="btn btn-secondary" id="video-info">Edit info</button><button class="btn btn-secondary" id="video-delete">Delete</button></div><h1 class="detail-title">${escape(video.title)}</h1><p class="detail-desc">${escape(video.description || video.source || "")}</p><div class="library-actions" style="margin:24px 0"><button class="btn btn-primary" id="video-focus">Focus on notes</button><button class="btn btn-secondary" id="video-write">Write notes</button>${safeUrl(video.url) ? `<a class="btn btn-secondary" href="${escape(safeUrl(video.url))}" target="_blank" rel="noopener noreferrer">Open video ↗</a>` : ""}</div>${safeUrl(video.url) ? '<details class="lecture-panel"><summary>Watch video <span>Player opens when expanded</span></summary><div id="video-player"></div></details>' : ""}<div class="rich-notes reading-notes">${noteHTML(video) || "<p>No notes yet. Choose Write notes to begin.</p>"}</div></div>`;
  const player = container.querySelector(".lecture-panel");
  if (player)
    player.ontoggle = () => {
      if (player.open && !$("#video-player").innerHTML)
        $("#video-player").innerHTML =
          cleanHTML(linkedVideoHTML(video.url)) ||
          "<p>Use Open video to watch this link.</p>";
    };
  $("#video-back").onclick = () => state.navigate("courses");
  const open = (startEditing) =>
    state.navigate("editor", {
      editorType: "video",
      itemId: video.id,
      title: video.title,
      parentTitle: "Courses & Videos",
      startEditing,
    });
  $("#video-focus").onclick = () => open(false);
  $("#video-write").onclick = () => open(true);
  $("#video-info").onclick = () =>
    showModal({
      title: "Edit video",
      contentHtml: `<div class="form-group"><label class="form-label" for="video-title">Title</label><input id="video-title" class="form-input" value="${escape(video.title)}"></div><div class="form-group"><label class="form-label" for="video-url">Video link</label><input id="video-url" class="form-input" value="${escape(video.url || "")}"></div><div class="form-group"><label class="form-label" for="video-source">Source</label><input id="video-source" class="form-input" value="${escape(video.source || "")}"></div><div class="form-group"><label class="form-label" for="video-description">Description</label><textarea id="video-description" class="form-textarea">${escape(video.description || "")}</textarea></div>`,
      onConfirm: (m) => {
        const title = m.querySelector("#video-title").value.trim(),
          url = m.querySelector("#video-url").value.trim();
        if (!title) return false;
        m.querySelector("#video-url").setCustomValidity("");
        if (url && !safeUrl(url)) {
          m.querySelector("#video-url").setCustomValidity(
            "Enter a full http:// or https:// URL",
          );
          m.querySelector("#video-url").reportValidity();
          return false;
        }
        video.title = title;
        video.url = url;
        video.source = m.querySelector("#video-source").value.trim();
        video.description = m.querySelector("#video-description").value.trim();
        if (!storage.saveEntity("videos", video)) {
          showToast(
            "Save failed. Export your draft from Settings before closing.",
            "error",
            7000,
          );
          return false;
        }
        renderVideoDetailView(container, videoId);
      },
    });
  $("#video-delete").onclick = () =>
    showModal({
      title: "Delete video?",
      contentHtml: "<p>This deletes the video and its notes.</p>",
      confirmText: "Delete",
      isDanger: true,
      onConfirm: () => {
        if (!storage.deleteEntity("videos", videoId)) {
          showToast(
            "Save failed. Export your draft from Settings before closing.",
            "error",
            7000,
          );
          return false;
        }
        state.navigate("courses");
      },
    });
  const preview = container.querySelector(".reading-notes");
  hydrateMedia(preview);
  container._cleanupView = () => releaseMedia(preview);
}
