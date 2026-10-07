import { icon } from "../ui/icons.js";
import { escape } from "../features/richText.js";
import { formatRelativeDate } from "./homeView.js";

// All three learning shelves share this layout and interaction model.
export function renderCollection(container, options) {
  const {
    title,
    subtitle,
    items,
    create,
    filters = [{ id: "all", label: "All" }],
    actions = [],
  } = options;
  let query = "",
    filter = "all",
    sort = "recent";
  container.innerHTML = `<section class="view-container collection-view"><header class="view-header"><div class="view-title-group"><div class="collection-eyebrow">YOUR LEARNING SPACE</div><h1 class="view-title">${escape(title)}</h1><p class="view-subtitle">${escape(subtitle)}</p></div><div class="view-actions">${actions.map((a, i) => `<button type="button" class="btn btn-secondary btn-sm" data-header-action="${i}">${escape(a.label)}</button>`).join("")}<button type="button" class="btn btn-primary collection-create" id="${options.createId || "collection-new"}">${icon("plus", "", 16)} ${escape(options.createLabel || "New")}</button></div></header><div class="collection-toolbar"><div class="filter-tabs" role="group" aria-label="Collection filter">${filters.map((f) => `<button type="button" class="filter-tab-btn ${f.id === "all" ? "is-active" : ""}" data-filter="${escape(f.id)}" aria-pressed="${f.id === "all"}">${escape(f.label)}</button>`).join("")}</div><div class="collection-tools"><label class="collection-search">${icon("search", "", 16)}<input type="search" placeholder="Search this collection" aria-label="Search this collection"></label><select class="collection-sort" aria-label="Sort collection"><option value="recent">Recently updated</option><option value="title">Title A–Z</option><option value="oldest">Oldest first</option></select></div></div><div class="collection-summary" aria-live="polite"></div><div class="collection-results"></div></section>`;
  container.querySelector(".collection-create").onclick = create;
  container
    .querySelectorAll("[data-header-action]")
    .forEach(
      (b) => (b.onclick = () => actions[Number(b.dataset.headerAction)].run()),
    );
  function draw() {
    const shown = items
      .filter(
        (x) =>
          (filter === "all" ? query || !x.hiddenInAll : x.kind === filter) &&
          `${x.title} ${x.subtitle || ""} ${x.description || ""} ${x.searchText || ""}`
            .toLocaleLowerCase()
            .includes(query.toLocaleLowerCase()),
      )
      .sort((a, b) =>
        sort === "title"
          ? a.title.localeCompare(b.title)
          : sort === "oldest"
            ? new Date(a.updatedAt || 0) - new Date(b.updatedAt || 0)
            : new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0),
      );
    container.querySelector(".collection-summary").textContent =
      `${shown.length} ${shown.length === 1 ? "item" : "items"}${query ? " matching your search" : ""}`;
    const results = container.querySelector(".collection-results");
    results.innerHTML = shown.length
      ? `<div class="cards-grid">${shown.map((x, i) => `<article class="content-card collection-card ${escape(x.className || "")}" data-id="${escape(x.id)}"><button type="button" class="collection-open" data-index="${i}" ${x.openAttribute ? `${x.openAttribute}="${escape(x.id)}"` : ""}><span class="collection-card-icon">${icon(x.icon || x.kind, "", 22)}</span><span class="card-type-tag">${escape(x.label || x.kind)}</span><h2 class="card-title">${escape(x.title)}</h2><p class="card-subtitle">${escape(x.subtitle || "\u00a0")}</p><p class="card-desc">${escape(x.description || "Open to continue learning.")}</p></button><div class="collection-card-meta"><span>${escape(x.meta || "")}</span><span>Updated ${formatRelativeDate(x.updatedAt)}</span></div><div class="collection-card-actions"><button type="button" class="btn btn-ghost btn-sm" data-open-index="${i}">Open ${icon("chevron-right", "", 13)}</button><div>${(x.actions || []).map((a, j) => `<button type="button" class="btn btn-ghost btn-sm ${a.danger ? "lesson-delete-control" : ""}" data-item-index="${i}" data-action-index="${j}" ${a.attribute ? `${a.attribute}="${escape(x.id)}"` : ""} aria-label="${escape(a.label + " " + x.title)}">${escape(a.label)}</button>`).join("")}</div></div></article>`).join("")}</div>`
      : `<div class="empty-state-card"><div class="empty-state-icon">${icon(options.icon || "book", "", 32)}</div><h2 class="empty-state-title">${query ? "No matching items" : escape(options.emptyTitle || "Start your next idea")}</h2><p class="empty-state-desc">${query ? "Try a different search or filter." : escape(options.emptyDescription || "Create an item to begin collecting your notes.")}</p><button type="button" class="btn btn-primary" data-empty-create>${query ? "Clear search" : escape(options.createLabel || "Create")}</button></div>`;
    results
      .querySelectorAll("[data-index],[data-open-index]")
      .forEach(
        (b) =>
          (b.onclick = () =>
            shown[Number(b.dataset.index ?? b.dataset.openIndex)].open()),
      );
    results
      .querySelectorAll("[data-item-index]")
      .forEach(
        (b) =>
          (b.onclick = () =>
            shown[Number(b.dataset.itemIndex)].actions[
              Number(b.dataset.actionIndex)
            ].run()),
      );
    results
      .querySelector("[data-empty-create]")
      ?.addEventListener("click", () => {
        if (query) {
          query = "";
          container.querySelector("input[type=search]").value = "";
          draw();
        } else create();
      });
  }
  container.querySelector("input[type=search]").oninput = (e) => {
    query = e.target.value.trim();
    draw();
  };
  container.querySelector(".collection-sort").onchange = (e) => {
    sort = e.target.value;
    draw();
  };
  container.querySelectorAll("[data-filter]").forEach(
    (b) =>
      (b.onclick = () => {
        filter = b.dataset.filter;
        container.querySelectorAll("[data-filter]").forEach((t) => {
          t.classList.toggle("is-active", t === b);
          t.setAttribute("aria-pressed", String(t === b));
        });
        draw();
      }),
  );
  draw();
}
