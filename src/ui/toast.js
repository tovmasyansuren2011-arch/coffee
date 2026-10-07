/**
 * Toast notifications for Coffee
 * Discrete, minimal, warm feedback
 */

let toastContainer = null;

function ensureContainer() {
  if (!toastContainer || !document.body.contains(toastContainer)) {
    toastContainer = document.createElement("div");
    toastContainer.className = "coffee-toast-container";
    document.body.appendChild(toastContainer);
  }
}

export function showToast(
  message,
  type = "info",
  duration = 3000,
  action = null,
) {
  ensureContainer();

  const toast = document.createElement("div");
  toast.className = `coffee-toast toast-${type}`;
  const label = document.createElement("span");
  label.textContent = message;
  toast.append(label);
  toast.setAttribute("role", "status");
  if (action) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "toast-action";
    button.textContent = action.label;
    button.onclick = () => {
      action.onClick();
      toast.remove();
    };
    toast.append(button);
  }

  toastContainer.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => {
    toast.classList.add("is-visible");
  });

  setTimeout(() => {
    toast.classList.remove("is-visible");
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 200);
  }, duration);
}
