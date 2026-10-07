import { mediaStore } from "./mediaStore.js";
import { escape, readPhoto } from "./richText.js";
import { videoLink, normalizeVideoUrl } from "./videoLinks.js";
export async function fileMediaHTML(file) {
  let blob = file;
  if (file.type.startsWith("image/")) blob = await readPhoto(file);
  const record = await mediaStore.put(blob, file.name || "Pasted media");
  const content = record.type.startsWith("image/")
    ? `<img data-media-id="${record.id}" alt="${escape(record.name)}">`
    : `<video data-media-id="${record.id}" controls playsinline preload="metadata"></video>`;
  return `<figure class="note-media" contenteditable="false">${content}<figcaption>${escape(record.name)}</figcaption></figure>`;
}
export function linkedVideoHTML(url) {
  const link = videoLink(url);
  if (!link) return "";
  const player =
    link.kind === "embed"
      ? `<iframe src="${escape(link.src)}" title="${link.label}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`
      : `<video src="${escape(link.src)}" controls playsinline preload="metadata"></video>`;
  return `<figure class="note-media" contenteditable="false">${player}<figcaption><a href="${escape(normalizeVideoUrl(url))}" target="_blank" rel="noopener noreferrer">${link.label} ↗</a></figcaption></figure>`;
}
export async function hydrateMedia(
  root,
  { editable = false, onRemove = () => {} } = {},
) {
  root._mediaUrls ||= new Map();
  const cache = root._mediaUrls;
  for (const el of root.querySelectorAll("[data-media-id]")) {
    const id = el.dataset.mediaId;
    if (el.dataset.loadedMedia === id) continue;
    el.dataset.loadedMedia = id;
    let entry = cache.get(id);
    if (!entry) {
      entry = mediaStore
        .get(id)
        .then((file) => (file ? URL.createObjectURL(file.blob) : ""));
      cache.set(id, entry);
    }
    try {
      const url = await entry;
      if (root._mediaDisposed) return;
      if (url) el.src = url;
      else missing(el);
    } catch {
      missing(el);
    }
  }
  if (editable)
    for (const figure of root.querySelectorAll("figure.note-media")) {
      if (figure.querySelector("[data-editor-control]")) continue;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "media-remove";
      button.setAttribute("data-editor-control", "");
      button.setAttribute("aria-label", "Remove media from notes");
      button.title = "Remove this media";
      button.textContent = "×";
      button.onclick = () => {
        figure.remove();
        onRemove();
      };
      figure.append(button);
    }
}
function missing(el) {
  const caption = el.closest("figure")?.querySelector("figcaption");
  if (caption && !caption.dataset.missing) {
    caption.dataset.missing = "true";
    caption.append(" — attachment missing; restore your backup");
  }
}
export function releaseMedia(root) {
  root._mediaDisposed = true;
  for (const entry of root._mediaUrls?.values() || [])
    Promise.resolve(entry).then((url) => {
      if (url) URL.revokeObjectURL(url);
    });
  root._mediaUrls?.clear();
}
