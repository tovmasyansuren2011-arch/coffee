// Keep uploaded files and the last recovery snapshot in the same browser database.
const ID_PATTERN = /^[a-zA-Z0-9_-]{1,100}$/;
const TYPES = /^(image\/(png|jpeg|webp|gif)|video\/(mp4|webm|ogg))$/;
let database;

function open() {
  if (database) return database;
  database = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined")
      return reject(
        new Error(
          "This browser cannot store attachments or recovery snapshots.",
        ),
      );
    const request = indexedDB.open("coffee_note_media_v1", 2);
    request.onupgradeneeded = () => {
      for (const name of ["files", "recovery"]) {
        if (!request.result.objectStoreNames.contains(name))
          request.result.createObjectStore(name, { keyPath: "id" });
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        database = null;
      };
      resolve(db);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () =>
      reject(new Error("Close older Coffee tabs, then reload this tab."));
  }).catch((error) => {
    database = null;
    throw error;
  });
  return database;
}

async function transaction(mode, operation, name = "files") {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(name, mode);
    let result;
    try {
      const request = operation(tx.objectStore(name));
      if (request)
        request.onsuccess = () => {
          result = request.result;
        };
    } catch (error) {
      tx.abort();
      reject(error);
      return;
    }
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () =>
      reject(tx.error || new Error("Browser storage operation failed."));
  });
}

export function decodeMedia(files) {
  if (!Array.isArray(files)) throw new Error("Invalid attachment list.");
  const ids = new Set();
  return files.map((file) => {
    if (
      !file ||
      typeof file.id !== "string" ||
      !ID_PATTERN.test(file.id) ||
      ids.has(file.id) ||
      !TYPES.test(file.type)
    )
      throw new Error("Invalid or duplicate attachment ID/type.");
    ids.add(file.id);
    const prefix = `data:${file.type};base64,`;
    if (typeof file.data !== "string" || !file.data.startsWith(prefix))
      throw new Error("Invalid attachment data.");
    const raw = file.data.slice(prefix.length);
    if (
      raw.length > 70 * 1024 * 1024 ||
      raw.length % 4 !== 0 ||
      !/^[a-zA-Z0-9+/]*={0,2}$/.test(raw)
    )
      throw new Error("Invalid or oversized attachment.");
    const binary = atob(raw);
    if (binary.length > 50 * 1024 * 1024)
      throw new Error("Attachments must be 50 MB or smaller.");
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++)
      bytes[index] = binary.charCodeAt(index);
    return {
      id: file.id,
      name: String(file.name || "Attachment"),
      type: file.type,
      blob: new Blob([bytes], { type: file.type }),
    };
  });
}

export const mediaStore = {
  async put(blob, name = "Attachment") {
    if (!TYPES.test(blob.type))
      throw new Error("Choose a supported image or MP4, WebM, or Ogg video.");
    if (blob.size > 50 * 1024 * 1024)
      throw new Error("Choose a file of 50 MB or less.");
    const id = crypto.randomUUID();
    await this.putRecords([{ id, name, type: blob.type, blob }]);
    return { id, name, type: blob.type, size: blob.size };
  },
  get(id) {
    return ID_PATTERN.test(id)
      ? transaction("readonly", (store) => store.get(id))
      : Promise.resolve(undefined);
  },
  putRecords(records) {
    return transaction("readwrite", (store) => {
      for (const record of records) store.put(record);
    });
  },
  remove(ids) {
    return transaction("readwrite", (store) => {
      for (const id of ids) store.delete(id);
    });
  },
  clear() {
    return transaction("readwrite", (store) => store.clear());
  },
  saveRecovery(snapshot) {
    return transaction(
      "readwrite",
      (store) => store.put({ ...snapshot, id: "last" }),
      "recovery",
    );
  },
  getRecovery() {
    return transaction("readonly", (store) => store.get("last"), "recovery");
  },
  async stats() {
    const files = await transaction("readonly", (store) => store.getAll());
    return {
      count: files.length,
      bytes: files.reduce((sum, file) => sum + file.blob.size, 0),
    };
  },
  async cleanup(keep) {
    const ids = await transaction("readonly", (store) => store.getAllKeys());
    const retained = new Set(keep);
    await this.remove(ids.filter((id) => !retained.has(id)));
  },
  async export(ids) {
    const files = [];
    for (const id of ids) {
      const file = await this.get(id);
      if (!file)
        throw new Error(
          `An attachment is missing (${id}). Restore a complete backup first.`,
        );
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file.blob);
      });
      files.push({ id: file.id, name: file.name, type: file.type, data });
    }
    return files;
  },
  async import(files) {
    await this.putRecords(decodeMedia(files));
  },
};

export function referencedMedia(data) {
  const ids = new Set();
  function visit(value, key) {
    if (typeof value === "string" && key === "notesHtml") {
      for (const match of value.matchAll(
        /data-media-id=["']([a-zA-Z0-9_-]{1,100})["']/g,
      ))
        ids.add(match[1]);
    } else if (Array.isArray(value)) value.forEach((item) => visit(item));
    else if (value && typeof value === "object")
      Object.entries(value).forEach(([name, item]) => visit(item, name));
  }
  visit(data);
  return [...ids];
}

export function remapMedia(data, mapping) {
  function visit(value) {
    if (!value || typeof value !== "object") return;
    for (const [key, item] of Object.entries(value)) {
      if (key === "notesHtml" && typeof item === "string")
        value[key] = item.replace(
          /data-media-id=(["'])([a-zA-Z0-9_-]{1,100})\1/g,
          (match, quote, id) =>
            `data-media-id=${quote}${mapping.get(id) || id}${quote}`,
        );
      else visit(item);
    }
  }
  visit(data);
  return data;
}
