import { parseMarkdown } from "../ui/markdown.js";
import { safeWebUrl, safeEmbed } from "./videoLinks.js";
export const escape = (value = "") =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const safeUrl = safeWebUrl;
const INLINE_IMAGE = /^data:image\/(png|jpeg|webp|gif);base64,[a-z0-9+/=]+$/i;
const MEDIA_ID = /^[a-zA-Z0-9_-]{1,100}$/;
export function cleanHTML(html) {
  const doc = new DOMParser().parseFromString(String(html), "text/html");
  const allowed = new Set(
    "P DIV SPAN BR B STRONG I EM U S STRIKE DEL H1 H2 H3 H4 H5 H6 UL OL LI BLOCKQUOTE PRE CODE A IMG VIDEO SOURCE IFRAME FIGURE FIGCAPTION TABLE THEAD TBODY TR TD TH HR FONT SUB SUP".split(
      " ",
    ),
  );
  for (const el of [...doc.body.querySelectorAll("*")]) {
    if (!el.isConnected) continue;
    if (
      el.hasAttribute("data-editor-control") ||
      [
        "SCRIPT",
        "STYLE",
        "OBJECT",
        "SVG",
        "MATH",
        "FORM",
        "INPUT",
        "BUTTON",
        "LINK",
        "META",
      ].includes(el.tagName)
    ) {
      el.remove();
      continue;
    }
    if (!allowed.has(el.tagName)) {
      el.replaceWith(...el.childNodes);
      continue;
    }
    const style = el.getAttribute("style"),
      href = el.getAttribute("href"),
      src = el.getAttribute("src"),
      color = el.getAttribute("color"),
      face = el.getAttribute("face"),
      media = el.getAttribute("data-media-id"),
      alt = el.getAttribute("alt") || "Note illustration";
    for (const attr of [...el.attributes]) el.removeAttribute(attr.name);
    if (style) {
      const holder = document.createElement("span");
      holder.setAttribute("style", style);
      for (const property of [
        "color",
        "background-color",
        "font-family",
        "font-size",
        "font-weight",
        "font-style",
        "text-decoration",
        "text-align",
        "white-space",
      ]) {
        const v = holder.style.getPropertyValue(property);
        if (v && !/url\s*\(|expression|var\s*\(/i.test(v))
          el.style.setProperty(property, v);
      }
    }
    if (el.tagName === "FONT") {
      if (color && /^#[0-9a-f]{3,8}$/i.test(color))
        el.setAttribute("color", color);
      if (face) el.style.fontFamily = face;
    }
    if (el.tagName === "A" && safeUrl(href)) {
      el.href = safeUrl(href);
      el.target = "_blank";
      el.rel = "noopener noreferrer";
    }
    if (el.tagName === "FIGURE") {
      el.className = "note-media";
      el.setAttribute("contenteditable", "false");
    }
    if (el.tagName === "IMG") {
      el.alt = alt;
      if (media && MEDIA_ID.test(media))
        el.setAttribute("data-media-id", media);
      else if (INLINE_IMAGE.test(src || "") || safeUrl(src))
        el.src = INLINE_IMAGE.test(src || "") ? src : safeUrl(src);
      else el.remove();
    }
    if (el.tagName === "VIDEO") {
      el.setAttribute("controls", "");
      el.setAttribute("preload", "metadata");
      el.setAttribute("playsinline", "");
      if (media && MEDIA_ID.test(media))
        el.setAttribute("data-media-id", media);
      else if (safeUrl(src)) el.src = safeUrl(src);
      else if (!el.querySelector("source")) el.remove();
    }
    if (el.tagName === "SOURCE") {
      if (el.parentElement?.tagName === "VIDEO" && safeUrl(src))
        el.src = safeUrl(src);
      else el.remove();
    }
    if (el.tagName === "IFRAME") {
      const safe = safeEmbed(src);
      if (!safe) {
        el.remove();
        continue;
      }
      el.src = safe;
      el.title = "Embedded video";
      el.setAttribute("loading", "lazy");
      el.setAttribute("allowfullscreen", "");
      el.setAttribute("allow", "fullscreen; picture-in-picture");
      el.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
      el.setAttribute(
        "sandbox",
        "allow-scripts allow-same-origin allow-presentation",
      );
    }
  }
  return doc.body.innerHTML;
}
export function noteHTML(item, field = "notes") {
  return cleanHTML(item?.notesHtml ?? parseMarkdown(item?.[field] || ""));
}
export function notesText(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  for (const br of doc.querySelectorAll("br")) br.replaceWith("\n");
  for (const block of doc.querySelectorAll(
    "p,div,li,h1,h2,h3,pre,blockquote,figcaption",
  ))
    block.append("\n");
  return doc.body.textContent.trim();
}
export async function readPhoto(file) {
  if (!file || !/^image\/(png|jpeg|webp|gif)$/.test(file.type))
    throw new Error("Choose a PNG, JPEG, WebP, or GIF image.");
  if (file.size > 15 * 1024 * 1024)
    throw new Error("Choose an image smaller than 15 MB.");
  const bitmap = await createImageBitmap(file);
  const ratio = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
  canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error("This image could not be read.")),
      "image/png",
    ),
  );
}
