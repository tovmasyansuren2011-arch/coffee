import { INITIAL_DATA } from "./sampleData.js";
import { validateWorkspace, readBackup } from "./validate.js";
import {
  mediaStore,
  referencedMedia,
  decodeMedia,
  remapMedia,
} from "../features/mediaStore.js";

export const STORAGE_KEY = "coffee_knowledge_app_data_v2";
const RECENT_KEY = "coffee_knowledge_app_recent_v2";
const empty = () => structuredClone(INITIAL_DATA);

export class StorageManager {
  constructor({ media = mediaStore, lock = true } = {}) {
    this.media = media;
    this.data = empty();
    this.recentItems = [];
    this.subscribers = new Set();
    this.saveStatusSubscribers = new Set();
    this.pendingSaveTimeout = null;
    this.lastSavedTimestamp = null;
    this.dirty = false;
    this.status = "saved";
    this.readOnly = false;
    this.conflict = false;
    this.recoveryError = null;
    this.busy = false;
    this.init();
    this.setupWindowFlushHandlers();
    this.ready = this.acquireWriter(lock);
  }

  init() {
    try {
      this.lastRaw = localStorage.getItem(STORAGE_KEY);
      const legacy =
        this.lastRaw == null
          ? localStorage.getItem("coffee_knowledge_app_data_v1")
          : null;
      const raw = this.lastRaw ?? legacy;
      if (raw != null) this.data = validateWorkspace(JSON.parse(raw));
      // Preserve the legacy key as a recovery copy. Persist migration only after obtaining the writer lock.
      this.needsMigration = legacy != null;
      const recent =
        localStorage.getItem(RECENT_KEY) ??
        localStorage.getItem("coffee_knowledge_app_recent_v1");
      try {
        const parsed = recent ? JSON.parse(recent) : [];
        this.recentItems = Array.isArray(parsed)
          ? parsed.filter(
              (item) =>
                item &&
                typeof item.id === "string" &&
                typeof item.type === "string",
            )
          : [];
      } catch {
        this.recentItems = [];
      }
    } catch (error) {
      this.recoveryError = error.message;
      this.status = "error";
      // Never overwrite unreadable saved data. Import/recovery are available from the recovery screen.
    }
  }

  async acquireWriter(enabled) {
    if (
      enabled &&
      typeof navigator !== "undefined" &&
      navigator.locks?.request
    ) {
      this.readOnly = true;
      return new Promise((resolve) => {
        navigator.locks
          .request(
            "coffee-workspace-writer-v6",
            { ifAvailable: true },
            async (lock) => {
              this.readOnly = !lock;
              this.notifySubscribers({ action: "writer" });
              resolve();
              if (lock) {
                if (this.needsMigration && !this.recoveryError)
                  this.persistImmediate();
                await new Promise((release) => {
                  this.releaseWriter = release;
                });
              }
            },
          )
          .catch((error) => {
            this.readOnly = true;
            this.notifySaveStatus("error", error.message);
            resolve();
          });
      });
    }
    if (this.needsMigration && !this.recoveryError) this.persistImmediate();
  }

  setupWindowFlushHandlers() {
    if (typeof window === "undefined") return;
    window.addEventListener("beforeunload", (event) => {
      this.flushPendingSave();
      if (this.dirty) {
        event.preventDefault?.();
        event.returnValue = "";
      }
    });
    window.addEventListener("blur", () => this.flushPendingSave());
    if (typeof document !== "undefined")
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") this.flushPendingSave();
      });
    window.addEventListener("storage", (event) => {
      if (event.key === STORAGE_KEY && event.newValue !== this.lastRaw) {
        // Keep this tab's objects and draft intact; do not replace references beneath the editor.
        this.conflict = true;
        this.notifySaveStatus(
          "error",
          "Another tab changed this workspace. Export this tab’s draft before reloading.",
        );
        this.notifySubscribers({ action: "conflict" });
      }
    });
  }

  getData() {
    return this.data;
  }
  sanitizeData(raw) {
    return validateWorkspace(raw);
  }
  canEdit() {
    return (
      !this.readOnly && !this.conflict && !this.recoveryError && !this.busy
    );
  }
  assertWritable({ recover = false } = {}) {
    if (this.readOnly)
      throw new Error(
        "Another Coffee tab is editing. Close it and reload this tab.",
      );
    if (this.conflict)
      throw new Error(
        "Workspace changed in another tab. Export this draft, then reload.",
      );
    if (this.recoveryError && !recover)
      throw new Error("Recover the saved workspace before editing.");
    const current = localStorage.getItem(STORAGE_KEY);
    if (current !== this.lastRaw) {
      this.conflict = true;
      this.notifySubscribers({ action: "conflict" });
      throw new Error(
        "Workspace changed in another tab. Export this draft, then reload.",
      );
    }
  }

  commit(data, { recover = false } = {}) {
    this.assertWritable({ recover });
    const serialized = JSON.stringify(data);
    localStorage.setItem(STORAGE_KEY, serialized);
    this.lastRaw = serialized;
    this.lastSavedTimestamp = new Date();
    this.dirty = false;
    this.notifySaveStatus("saved");
  }

  persistImmediate() {
    clearTimeout(this.pendingSaveTimeout);
    this.pendingSaveTimeout = null;
    this.draftFlusher?.();
    this.notifySaveStatus("saving");
    try {
      this.commit(this.data);
      return true;
    } catch (error) {
      this.dirty = true;
      this.notifySaveStatus(
        "error",
        error.message ||
          "Browser storage is full or unavailable. Export your draft.",
      );
      return false;
    }
  }

  scheduleDebouncedSave(delay = 500) {
    this.dirty = true;
    this.notifySaveStatus("saving");
    clearTimeout(this.pendingSaveTimeout);
    this.pendingSaveTimeout = setTimeout(() => this.persistImmediate(), delay);
  }

  flushPendingSave() {
    this.draftFlusher?.();
    if (this.pendingSaveTimeout || (this.dirty && this.canEdit()))
      return this.persistImmediate();
    return !this.dirty;
  }

  saveEntity(collectionName, entity) {
    if (!this.canEdit()) {
      this.notifySaveStatus("error", "This workspace is currently read only.");
      return false;
    }
    entity.updatedAt = new Date().toISOString();
    entity.createdAt ||= entity.updatedAt;
    const index = this.data[collectionName].findIndex(
      (item) => item.id === entity.id,
    );
    if (index >= 0) this.data[collectionName][index] = entity;
    else this.data[collectionName].unshift(entity);
    const saved = this.persistImmediate();
    this.notifySubscribers({
      action: "save",
      collection: collectionName,
      entity,
    });
    return saved;
  }

  deleteEntity(collectionName, entityId) {
    if (!this.canEdit()) return false;
    this.data[collectionName] = this.data[collectionName].filter(
      (item) => item.id !== entityId,
    );
    this.removeRecent(entityId);
    const saved = this.persistImmediate();
    this.notifySubscribers({
      action: "delete",
      collection: collectionName,
      entityId,
    });
    return saved;
  }

  trackRecent(itemMeta) {
    if (!itemMeta?.id || this.readOnly || this.conflict) return;
    this.recentItems = this.recentItems.filter(
      (item) =>
        item.id !== itemMeta.id ||
        item.type !== itemMeta.type ||
        item.parentId !== itemMeta.parentId,
    );
    this.recentItems.unshift({
      ...itemMeta,
      timestamp: new Date().toISOString(),
    });
    this.recentItems = this.recentItems.slice(0, 20);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(this.recentItems));
    } catch {
      /* Recents are optional. */
    }
  }
  removeRecent(id) {
    this.recentItems = this.recentItems.filter(
      (item) => item.id !== id && item.parentId !== id,
    );
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(this.recentItems));
    } catch {
      /* Notes stay intact. */
    }
  }
  getRecentItems() {
    return this.recentItems;
  }

  async buildBackup() {
    this.flushPendingSave();
    const snapshot = structuredClone(this.data);
    return {
      app: "Coffee",
      version: "6.0",
      exportedAt: new Date().toISOString(),
      data: snapshot,
      media: await this.media.export(referencedMedia(snapshot)),
    };
  }
  download(value, filename, type = "application/json") {
    const url = URL.createObjectURL(
      new Blob(
        [typeof value === "string" ? value : JSON.stringify(value, null, 2)],
        { type },
      ),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return filename;
  }
  async exportData() {
    return this.download(
      await this.buildBackup(),
      `coffee-backup-${new Date().toISOString().slice(0, 10)}.json`,
    );
  }
  exportDamagedData() {
    return this.download(
      this.lastRaw ??
        localStorage.getItem("coffee_knowledge_app_data_v1") ??
        "",
      "coffee-preserved-data.txt",
      "text/plain",
    );
  }
  inspectBackup(content) {
    const { data, media } = readBackup(content);
    decodeMedia(media); // Validate the complete attachment list before offering replacement.
    return {
      data,
      media,
      entries:
        data.books.length +
        data.courses.length +
        data.videos.length +
        data.lessons.length,
      attachments: referencedMedia(data).length,
    };
  }

  // Text-only compatibility API; the user-facing importer always creates a recovery snapshot.
  importData(content) {
    try {
      const { data, media } = readBackup(content);
      if (media.length || referencedMedia(data).length)
        throw new Error(
          "Use complete backup restore for notes with attachments.",
        );
      this.commit(data, { recover: true });
      this.data = data;
      this.recoveryError = null;
      this.notifySubscribers({ action: "import" });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async importBackup(content) {
    let stagedIds = [],
      ownsOperation = false;
    try {
      if (this.busy) throw new Error("A restore is already in progress.");
      this.assertWritable({ recover: true });
      this.flushPendingSave();
      const { data, media } = readBackup(content);
      const records = decodeMedia(media);
      this.busy = true;
      ownsOperation = true;
      this.notifySubscribers({ action: "busy" });
      const provided = new Set(records.map((file) => file.id));
      for (const id of referencedMedia(data)) {
        if (!provided.has(id) && !(await this.media.get(id)))
          throw new Error(
            "This backup is missing an attachment. Choose a complete backup.",
          );
      }
      // Snapshot points to original media, which staging never overwrites.
      await this.media.saveRecovery({
        data: structuredClone(this.data),
        recentItems: structuredClone(this.recentItems),
        raw: this.recoveryError ? this.lastRaw : null,
        savedAt: new Date().toISOString(),
      });
      const mapping = new Map(
        records.map((file) => [file.id, crypto.randomUUID()]),
      );
      for (const record of records) record.id = mapping.get(record.id);
      stagedIds = records.map((file) => file.id);
      if (records.length) await this.media.putRecords(records);
      remapMedia(data, mapping);
      this.commit(data, { recover: true });
      this.data = data;
      this.recoveryError = null;
      this.recentItems = [];
      try {
        localStorage.removeItem(RECENT_KEY);
      } catch {
        /* Optional metadata. */
      }
      this.notifySubscribers({ action: "import" });
      return { success: true };
    } catch (error) {
      if (stagedIds.length) await this.media.remove(stagedIds).catch(() => {});
      return { success: false, error: error.message };
    } finally {
      if (ownsOperation) {
        this.busy = false;
        this.notifySubscribers({ action: "busy" });
      }
    }
  }

  async restoreRecovery() {
    let ownsOperation = false,
      rollbackSnapshot = null;
    try {
      if (this.busy)
        throw new Error("A storage operation is already in progress.");
      this.assertWritable({ recover: true });
      this.flushPendingSave();
      this.busy = true;
      ownsOperation = true;
      this.notifySubscribers({ action: "busy" });
      const snapshot = await this.media.getRecovery();
      if (!snapshot) throw new Error("No recovery snapshot is available.");
      if (snapshot.raw)
        throw new Error(
          "The previous workspace was damaged. Download preserved data from Settings.",
        );
      const data = validateWorkspace(snapshot.data);
      for (const id of referencedMedia(data))
        if (!(await this.media.get(id)))
          throw new Error("An attachment in the recovery snapshot is missing.");
      const previous = {
        data: structuredClone(this.data),
        recentItems: structuredClone(this.recentItems),
        raw: this.recoveryError ? this.lastRaw : null,
        savedAt: new Date().toISOString(),
      };
      await this.media.saveRecovery(previous);
      rollbackSnapshot = snapshot;
      this.commit(data, { recover: true });
      rollbackSnapshot = null;
      this.data = data;
      this.recoveryError = null;
      this.recentItems = snapshot.recentItems || [];
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(this.recentItems));
      } catch {
        /* Optional metadata. */
      }
      this.notifySubscribers({ action: "import" });
      return { success: true };
    } catch (error) {
      if (rollbackSnapshot)
        await this.media.saveRecovery(rollbackSnapshot).catch(() => {});
      return { success: false, error: error.message };
    } finally {
      if (ownsOperation) {
        this.busy = false;
        this.notifySubscribers({ action: "busy" });
      }
    }
  }

  async clearAllWithMedia() {
    // Retain original media for recovery. Unused files can be cleaned explicitly in Settings.
    const result = await this.importBackup({
      app: "Coffee",
      version: "6.0",
      data: empty(),
      media: [],
    });
    if (!result.success) throw new Error(result.error);
  }
  clearAll() {
    this.commit(empty());
    this.data = empty();
    this.recentItems = [];
    try {
      localStorage.removeItem(RECENT_KEY);
    } catch {
      /* Optional. */
    }
    this.notifySubscribers({ action: "clear" });
  }
  restoreSampleData() {
    this.clearAll();
  }
  async cleanupMedia() {
    if (this.busy)
      throw new Error("A storage operation is already in progress.");
    this.assertWritable();
    this.flushPendingSave();
    this.busy = true;
    this.notifySubscribers({ action: "busy" });
    try {
      const recovery = await this.media.getRecovery();
      if (recovery?.raw)
        throw new Error(
          "Preserved damaged data may still need its attachments. Replace that recovery snapshot before cleaning files.",
        );
      let legacy = [];
      const legacyRaw = localStorage.getItem("coffee_knowledge_app_data_v1");
      if (legacyRaw) {
        try {
          legacy = referencedMedia(JSON.parse(legacyRaw));
        } catch {
          throw new Error(
            "Legacy recovery data is unreadable. Its attachments have been kept.",
          );
        }
      }
      await this.media.cleanup([
        ...legacy,
        ...referencedMedia(this.data),
        ...referencedMedia(recovery?.data),
      ]);
    } finally {
      this.busy = false;
      this.notifySubscribers({ action: "busy" });
    }
  }

  getStats() {
    const bytes = new Blob([this.lastRaw || ""]).size;
    const bookCount = this.data.books.length;
    const chapterCount = this.data.books.reduce(
      (sum, book) => sum + (book.chapters?.length || 0),
      0,
    );
    const courseCount = this.data.courses.length;
    const moduleCount = this.data.courses.reduce(
      (sum, course) => sum + (course.modules?.length || 0),
      0,
    );
    const courseLessonCount = this.data.courses.reduce(
      (sum, course) =>
        sum +
        (course.modules || []).reduce(
          (count, module) => count + (module.lessons?.length || 0),
          0,
        ),
      0,
    );
    return {
      bytes,
      kb: (bytes / 1024).toFixed(1),
      bookCount,
      chapterCount,
      courseCount,
      moduleCount,
      courseLessonCount,
      videoCount: this.data.videos.length,
      lessonCount: this.data.lessons.length,
      totalEntries:
        bookCount +
        courseCount +
        this.data.videos.length +
        this.data.lessons.length,
    };
  }
  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }
  notifySubscribers(event) {
    for (const callback of this.subscribers) {
      try {
        callback(this.data, event);
      } catch (error) {
        console.error(error);
      }
    }
  }
  onSaveStatus(callback) {
    this.saveStatusSubscribers.add(callback);
    return () => this.saveStatusSubscribers.delete(callback);
  }
  notifySaveStatus(status, detail = "") {
    this.status = status;
    this.statusDetail = detail;
    for (const callback of this.saveStatusSubscribers) {
      try {
        callback(status, detail);
      } catch (error) {
        console.error(error);
      }
    }
  }
}

export const storage = new StorageManager();
