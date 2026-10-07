import { storage } from "../data/storage.js";
import { icon } from "./icons.js";
import { escape } from "../features/richText.js";

let activeModal = null;
let sequence = 0;
const focusable = (root) =>
  [
    ...root.querySelectorAll(
      'button, input, textarea, select, a[href], [tabindex="0"]',
    ),
  ].filter((el) => !el.disabled && !el.hidden && el.getClientRects().length);

export function showModal({
  title,
  subtitle = "",
  contentHtml = "",
  confirmText = "Save",
  cancelText = "Cancel",
  isDanger = false,
  allowReadOnly = false,
  onConfirm = () => {},
  onOpen = () => {},
  onClose = () => {},
}) {
  const originalFocus = activeModal?.returnFocus || document.activeElement;
  closeModal();
  const id = `coffee-dialog-${++sequence}`;
  const backdrop = document.createElement("div");
  backdrop.className = "coffee-modal-backdrop";
  backdrop.setAttribute("role", "dialog");
  backdrop.setAttribute("aria-modal", "true");
  backdrop.setAttribute("aria-labelledby", id);
  if (subtitle) backdrop.setAttribute("aria-describedby", `${id}-description`);
  backdrop.innerHTML = `<div class="coffee-modal-container" tabindex="-1">
    <div class="coffee-modal-header"><div><h2 id="${id}" class="coffee-modal-title">${escape(title)}</h2>${subtitle ? `<p id="${id}-description" class="coffee-modal-subtitle">${escape(subtitle)}</p>` : ""}</div><button class="coffee-modal-close-btn" type="button" aria-label="Close modal">${icon("close", "", 18)}</button></div>
    <div class="coffee-modal-body">${contentHtml}</div>
    <p class="modal-error" role="alert" hidden></p>
    <div class="coffee-modal-footer"><button type="button" class="btn btn-secondary modal-cancel-btn">${escape(cancelText)}</button><button type="button" class="btn ${isDanger ? "btn-danger" : "btn-primary"} modal-confirm-btn" ${confirmText ? "" : "hidden"}>${escape(confirmText)}</button></div></div>`;
  const background = document.getElementById("app");
  if (background) background.inert = true;
  document.body.append(backdrop);
  const confirmBtn = backdrop.querySelector(".modal-confirm-btn");
  let closed = false,
    pending = false;
  const handle = {
    element: backdrop,
    close: handleClose,
    returnFocus: originalFocus,
  };
  activeModal = handle;

  function handleClose() {
    if (closed || pending) return;
    closed = true;
    window.removeEventListener("keydown", keyHandler, true);
    backdrop.remove();
    if (activeModal === handle) {
      activeModal = null;
      if (background) background.inert = false;
      if (originalFocus?.isConnected) originalFocus.focus();
    }
    onClose();
  }
  function finish(result) {
    pending = false;
    confirmBtn.disabled = false;
    if (result !== false) handleClose();
  }
  function handleError(error) {
    pending = false;
    confirmBtn.disabled = false;
    const label = backdrop.querySelector(".modal-error");
    label.hidden = false;
    label.textContent = error.message || "This action could not be completed.";
  }
  function handleConfirm() {
    if (pending || closed) return;
    try {
      if (!allowReadOnly && !storage.canEdit())
        throw new Error(
          "This tab is read only. Close the other Coffee tab and reload before making changes.",
        );
      const result = onConfirm(backdrop);
      if (result?.then) {
        pending = true;
        confirmBtn.disabled = true;
        result.then(finish, handleError);
      } else finish(result);
    } catch (error) {
      handleError(error);
    }
  }
  function keyHandler(event) {
    if (closed) return;
    if (event.key === "Tab") {
      const controls = focusable(backdrop),
        first = controls[0],
        last = controls.at(-1);
      if (!controls.length) {
        event.preventDefault();
        return;
      }
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          !backdrop.contains(document.activeElement))
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          !backdrop.contains(document.activeElement))
      ) {
        event.preventDefault();
        first.focus();
      }
    }
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      handleClose();
    }
    if (
      event.key === "Enter" &&
      event.target.tagName !== "TEXTAREA" &&
      (event.ctrlKey || event.metaKey || event.target.tagName === "INPUT") &&
      !confirmBtn.hidden
    ) {
      event.preventDefault();
      handleConfirm();
    }
  }
  window.addEventListener("keydown", keyHandler, true);
  backdrop.querySelector(".coffee-modal-close-btn").onclick = handleClose;
  backdrop.querySelector(".modal-cancel-btn").onclick = handleClose;
  confirmBtn.onclick = handleConfirm;
  backdrop.onclick = (event) => {
    if (event.target === backdrop) handleClose();
  };
  requestAnimationFrame(() => {
    if (closed) return;
    backdrop.classList.add("is-open");
    onOpen(backdrop);
    if (!allowReadOnly && !storage.canEdit()) {
      confirmBtn.disabled = true;
      backdrop.querySelectorAll("input,textarea,select").forEach((el) => {
        el.disabled = true;
      });
    }
    const input =
      backdrop.querySelector(
        'input:not([type="file"]):not(:disabled),textarea:not(:disabled)',
      ) || backdrop.querySelector("select:not(:disabled)");
    (input || focusable(backdrop)[0] || backdrop.firstElementChild).focus();
  });
  return handle;
}
export function closeModal() {
  activeModal?.close();
}
export function confirmModal({
  title,
  message,
  confirmText = "Confirm",
  isDanger = false,
  onConfirm,
}) {
  return showModal({
    title,
    contentHtml: `<p class="confirm-message">${escape(message)}</p>`,
    confirmText,
    cancelText: "Cancel",
    isDanger,
    onConfirm,
  });
}
