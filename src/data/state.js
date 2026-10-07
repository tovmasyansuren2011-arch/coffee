import { storage } from "./storage.js";

const VIEWS = new Set([
  "home",
  "books",
  "book-detail",
  "courses",
  "course-detail",
  "video-detail",
  "lessons",
  "editor",
]);
const PARAMS = [
  "bookId",
  "courseId",
  "videoId",
  "moduleId",
  "editorType",
  "parentId",
  "itemId",
];
export function routeHash(view, params = {}) {
  const query = new URLSearchParams();
  for (const key of PARAMS)
    if (typeof params[key] === "string" && params[key])
      query.set(key, params[key]);
  return `#/${view}${query.size ? "?" + query : ""}`;
}
export function parseRoute(hash = "") {
  const [path, query = ""] = hash.replace(/^#\/?/, "").split("?");
  const view = VIEWS.has(path) ? path : "home";
  const params = {};
  for (const [key, value] of new URLSearchParams(query))
    if (PARAMS.includes(key) && value.length <= 200) params[key] = value;
  return { view, params };
}

class AppState {
  constructor() {
    const route = parseRoute(
      typeof location !== "undefined" ? location.hash : "",
    );
    this.view = route.view;
    this.viewParams = route.params;
    this.historyStack = [];
    this.subscribers = new Set();
    this.isSearchOpen = false;
    this.isSettingsOpen = false;
    this.isMobileSidebarOpen = false;
    this.editorMode = "edit";
    this.uiVersion = 0;
    if (typeof window !== "undefined")
      window.addEventListener("popstate", () => {
        storage.flushPendingSave();
        const route = parseRoute(location.hash);
        this.view = route.view;
        this.viewParams = route.params;
        this.isSearchOpen = false;
        this.isSettingsOpen = false;
        this.isMobileSidebarOpen = false;
        this.trackCurrent();
        this.notify();
      });
  }
  setEditorMode(mode) {
    this.editorMode = mode;
  }
  getEditorMode() {
    return this.editorMode;
  }
  navigate(viewName, params = {}, addToHistory = true) {
    storage.flushPendingSave();
    if (!VIEWS.has(viewName)) viewName = "home";
    const changed =
      routeHash(this.view, this.viewParams) !== routeHash(viewName, params);
    if (changed && addToHistory) {
      this.historyStack.push({
        view: this.view,
        params: { ...this.viewParams },
      });
      if (this.historyStack.length > 50) this.historyStack.shift();
    }
    this.view = viewName;
    this.viewParams = params;
    this.isMobileSidebarOpen = false;
    if (typeof history !== "undefined") {
      const method = changed && addToHistory ? "pushState" : "replaceState";
      history[method]({ coffee: true }, "", routeHash(viewName, params));
    }
    this.trackCurrent();
    this.notify();
    window.scrollTo?.({ top: 0, behavior: "instant" });
  }
  trackCurrent() {
    const data = storage.getData(),
      params = this.viewParams;
    let item, parentId, type;
    if (this.view === "book-detail") {
      item = data.books.find((x) => x.id === params.bookId);
      type = "book";
    }
    if (this.view === "course-detail") {
      item = data.courses.find((x) => x.id === params.courseId);
      type = "course";
    }
    if (this.view === "video-detail") {
      item = data.videos.find((x) => x.id === params.videoId);
      type = "video";
    }
    if (this.view === "editor") {
      type = params.editorType;
      parentId = params.parentId;
      if (type === "lesson")
        item = data.lessons.find((x) => x.id === params.itemId);
      if (type === "video")
        item = data.videos.find((x) => x.id === params.itemId);
      if (type === "chapter")
        item = data.books
          .find((x) => x.id === parentId)
          ?.chapters?.find((x) => x.id === params.itemId);
      if (type === "course-lesson")
        item = data.courses
          .find((x) => x.id === parentId)
          ?.modules?.flatMap((x) => x.lessons || [])
          .find((x) => x.id === params.itemId);
    }
    if (item)
      storage.trackRecent({ id: item.id, type, parentId, title: item.title });
  }
  goBack(fallbackView = "home") {
    storage.flushPendingSave();
    if (this.historyStack.length) {
      this.historyStack.pop();
      window.history.back();
    } else this.navigate(fallbackView, {}, false);
  }
  openSearch() {
    this.isSearchOpen = true;
    this.notify();
  }
  closeSearch() {
    this.isSearchOpen = false;
    this.notify();
  }
  openSettings() {
    this.isSettingsOpen = true;
    this.notify();
  }
  closeSettings() {
    this.isSettingsOpen = false;
    this.notify();
  }
  toggleMobileSidebar() {
    this.isMobileSidebarOpen = !this.isMobileSidebarOpen;
    this.notify();
  }
  closeMobileSidebar() {
    this.isMobileSidebarOpen = false;
    this.notify();
  }
  refresh() {
    this.uiVersion++;
    this.notify();
  }
  subscribe(fn) {
    this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  }
  notify() {
    for (const fn of this.subscribers) {
      try {
        fn(this);
      } catch (error) {
        console.error(error);
      }
    }
  }
}
export const state = new AppState();
