import assert from "node:assert/strict";
import { validateWorkspace, readBackup } from "./src/data/validate.js";
import { decodeMedia, remapMedia } from "./src/features/mediaStore.js";
import { recentLearning } from "./src/data/learning.js";

const memory = new Map();
let failWrites = false;
const listeners = new Map();
globalThis.localStorage = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => {
    if (failWrites) throw new Error("QuotaExceededError");
    memory.set(key, String(value));
  },
  removeItem: (key) => memory.delete(key),
};
globalThis.window = {
  addEventListener: (key, callback) => listeners.set(key, callback),
  scrollTo() {},
};
const { StorageManager, STORAGE_KEY } = await import("./src/data/storage.js");
const { routeHash, parseRoute } = await import("./src/data/state.js");
let passed = 0;
async function check(name, callback) {
  await callback();
  passed++;
  console.log(`PASS ${name}`);
}
const workspace = (title) => ({
  books: [],
  courses: [],
  videos: [],
  lessonModules: [],
  lessons: [{ id: "lesson", title, notes: "Preserve this text" }],
  sketches: [],
  testPreps: [],
});
const media = {
  files: new Map(),
  recovery: null,
  async get(id) {
    return this.files.get(id);
  },
  async export(ids) {
    return ids.map((id) => {
      const file = this.files.get(id);
      if (!file) throw new Error("Missing file");
      return file;
    });
  },
  async saveRecovery(snapshot) {
    this.recovery = structuredClone(snapshot);
  },
  async getRecovery() {
    return this.recovery;
  },
  async putRecords(records) {
    for (const record of records) this.files.set(record.id, record);
  },
  async remove(ids) {
    for (const id of ids) this.files.delete(id);
  },
};
function fresh(data = workspace("Original")) {
  memory.clear();
  failWrites = false;
  media.files.clear();
  media.recovery = null;
  memory.set(STORAGE_KEY, JSON.stringify(data));
  return new StorageManager({ media, lock: false });
}

await check(
  "Unrelated, primitive and malformed JSON leave the workspace unchanged",
  async () => {
    const store = fresh(),
      original = memory.get(STORAGE_KEY);
    for (const value of [
      '{"unrelated":true}',
      "{}",
      "null",
      "[]",
      "not json",
      '{"books":[null]}',
      '{"books":[{"id":"b"}]}',
      '{"lessons":"oops"}',
    ]) {
      assert.equal((await store.importBackup(value)).success, false, value);
      assert.equal(memory.get(STORAGE_KEY), original);
    }
  },
);
await check(
  "Duplicate IDs, invalid nested lists and missing modules are rejected",
  () => {
    assert.throws(
      () =>
        validateWorkspace({
          lessons: [
            { id: "a", title: "A" },
            { id: "a", title: "B" },
          ],
        }),
      /duplicate/,
    );
    assert.throws(
      () =>
        validateWorkspace({
          books: [{ id: "a", title: "A", chapters: "bad" }],
        }),
      /list/,
    );
    assert.throws(
      () =>
        validateWorkspace({
          courses: [
            {
              id: "a",
              title: "A",
              modules: [{ id: "m", title: "M", lessons: [null] }],
            },
          ],
        }),
      /valid ID/,
    );
    assert.throws(
      () =>
        validateWorkspace({
          lessons: [{ id: "a", title: "A", moduleId: "absent" }],
        }),
      /missing module/,
    );
    assert.throws(
      () => readBackup({ app: "Other", data: workspace("x") }),
      /another application/,
    );
    assert.throws(
      () =>
        readBackup({ app: "Coffee", version: "100.0", data: workspace("x") }),
      /version/,
    );
  },
);
await check("Corrupted stored JSON is preserved and saving is blocked", () => {
  fresh();
  memory.set(STORAGE_KEY, "{damaged");
  const store = new StorageManager({ media, lock: false });
  assert(store.recoveryError);
  assert.equal(store.persistImmediate(), false);
  assert.equal(memory.get(STORAGE_KEY), "{damaged");
});
await check("Version-one data migrates without deleting its original", () => {
  memory.clear();
  const legacy = JSON.stringify(workspace("Legacy"));
  memory.set("coffee_knowledge_app_data_v1", legacy);
  const store = new StorageManager({ media, lock: false });
  assert.equal(store.getData().lessons[0].title, "Legacy");
  assert.equal(memory.get("coffee_knowledge_app_data_v1"), legacy);
  assert.equal(JSON.parse(memory.get(STORAGE_KEY)).lessons[0].title, "Legacy");
});
await check(
  "Media IDs are staged separately and failed text writes roll back staged uploads",
  async () => {
    const store = fresh(),
      before = memory.get(STORAGE_KEY);
    media.files.set("asset", {
      id: "asset",
      name: "Original file",
      type: "image/png",
      blob: new Blob(["original"], { type: "image/png" }),
    });
    const incoming = workspace("Replacement");
    incoming.lessons[0].notesHtml = '<p><img data-media-id="asset"></p>';
    failWrites = true;
    const result = await store.importBackup({
      app: "Coffee",
      version: "6.0",
      data: incoming,
      media: [
        { id: "asset", type: "image/png", data: "data:image/png;base64,YQ==" },
      ],
    });
    failWrites = false;
    assert.equal(result.success, false);
    assert.equal(memory.get(STORAGE_KEY), before);
    assert.equal(store.data.lessons[0].title, "Original");
    assert.equal(media.files.size, 1);
    assert.equal(media.files.get("asset").name, "Original file");
  },
);
await check(
  "Complete restore creates a recovery snapshot and never overwrites original media",
  async () => {
    const original = workspace("Original");
    original.lessons[0].notesHtml = '<img data-media-id="asset">';
    const store = fresh(original);
    media.files.set("asset", { id: "asset", name: "Original file" });
    const incoming = workspace("Replacement");
    incoming.lessons[0].notesHtml = '<img data-media-id="asset">';
    assert.equal(
      (
        await store.importBackup({
          data: incoming,
          media: [
            {
              id: "asset",
              type: "image/png",
              data: "data:image/png;base64,YQ==",
            },
          ],
        })
      ).success,
      true,
    );
    assert.notEqual(
      store.data.lessons[0].notesHtml,
      '<img data-media-id="asset">',
    );
    assert.equal(media.files.get("asset").name, "Original file");
    assert.equal((await store.restoreRecovery()).success, true);
    assert.equal(store.data.lessons[0].title, "Original");
    assert.equal(
      store.data.lessons[0].notesHtml,
      '<img data-media-id="asset">',
    );
    assert.equal(media.recovery.data.lessons[0].title, "Replacement");
  },
);
await check(
  "Missing attachments and invalid media do not change saved notes",
  async () => {
    const store = fresh(),
      before = memory.get(STORAGE_KEY);
    const data = workspace("Replacement");
    data.lessons[0].notesHtml = '<img data-media-id="missing">';
    assert.equal((await store.importBackup({ data })).success, false);
    assert.equal(memory.get(STORAGE_KEY), before);
    assert.throws(() =>
      decodeMedia([
        { id: "x", type: "text/html", data: "data:text/html;base64,YQ==" },
      ]),
    );
    assert.throws(() =>
      decodeMedia([
        { id: "x", type: "image/png", data: "data:image/png;base64,!" },
      ]),
    );
  },
);
await check(
  "Recovery storage failure aborts import before changing text or attachments",
  async () => {
    const store = fresh(),
      original = memory.get(STORAGE_KEY),
      save = media.saveRecovery;
    media.saveRecovery = async () => {
      throw new Error("IndexedDB unavailable");
    };
    assert.equal(
      (await store.importBackup({ data: workspace("New") })).success,
      false,
    );
    assert.equal(memory.get(STORAGE_KEY), original);
    media.saveRecovery = save;
  },
);
await check("Clear workspace retains a restorable snapshot", async () => {
  const store = fresh();
  await store.clearAllWithMedia();
  assert.equal(store.data.lessons.length, 0);
  assert.equal((await store.restoreRecovery()).success, true);
  assert.equal(store.data.lessons[0].title, "Original");
});
await check(
  "Another tab cannot overwrite stale saved data; draft objects stay intact",
  () => {
    const store = fresh(),
      draft = store.data.lessons[0];
    draft.notes = "Unsaved draft";
    store.scheduleDebouncedSave(99999);
    const external = JSON.stringify(workspace("Other tab"));
    memory.set(STORAGE_KEY, external);
    listeners.get("storage")({ key: STORAGE_KEY, newValue: external });
    assert.equal(store.data.lessons[0], draft);
    assert.equal(store.conflict, true);
    assert.equal(store.persistImmediate(), false);
    assert.equal(memory.get(STORAGE_KEY), external);
    assert.equal(store.data.lessons[0].notes, "Unsaved draft");
  },
);
await check(
  "A rejected concurrent restore does not release the first operation",
  async () => {
    const store = fresh();
    const save = media.saveRecovery;
    let release, reached;
    const entered = new Promise((resolve) => {
      reached = resolve;
    });
    media.saveRecovery = async (snapshot) => {
      reached();
      await new Promise((resolve) => {
        release = resolve;
      });
      return save.call(media, snapshot);
    };
    const first = store.importBackup({ data: workspace("First restore") });
    await entered;
    assert(store.busy);
    assert.equal(
      (await store.importBackup({ data: workspace("Second restore") })).success,
      false,
    );
    assert(store.busy);
    release();
    assert.equal((await first).success, true);
    assert.equal(store.busy, false);
    media.saveRecovery = save;
  },
);
await check(
  "Failed recovery commit preserves the current workspace and recovery snapshot",
  async () => {
    const store = fresh();
    assert.equal(
      (await store.importBackup({ data: workspace("Replacement") })).success,
      true,
    );
    const raw = memory.get(STORAGE_KEY);
    failWrites = true;
    assert.equal((await store.restoreRecovery()).success, false);
    failWrites = false;
    assert.equal(memory.get(STORAGE_KEY), raw);
    assert.equal(media.recovery.data.lessons[0].title, "Original");
  },
);
await check("Read-only tabs reject note writes and imports", async () => {
  const store = fresh(),
    original = memory.get(STORAGE_KEY);
  store.readOnly = true;
  assert.equal(
    store.saveEntity("lessons", { id: "new", title: "Blocked" }),
    false,
  );
  assert.equal(
    (await store.importBackup({ data: workspace("Blocked") })).success,
    false,
  );
  assert.equal(memory.get(STORAGE_KEY), original);
});
await check("Draft is prepared before navigation/export saving", async () => {
  const store = fresh();
  store.draftFlusher = () => {
    store.data.lessons[0].notes = "Last keystroke";
  };
  store.scheduleDebouncedSave(99999);
  const backup = await store.buildBackup();
  assert.equal(backup.data.lessons[0].notes, "Last keystroke");
  assert.equal(
    JSON.parse(memory.get(STORAGE_KEY)).lessons[0].notes,
    "Last keystroke",
  );
});
await check(
  "Continue learning follows last opened note, not last edited note",
  () => {
    const data = workspace("First");
    data.lessons.push({
      id: "newer",
      title: "Newer",
      updatedAt: "2026-10-04T10:00:00Z",
    });
    const recent = recentLearning(data, [
      { id: "lesson", type: "lesson", timestamp: "2026-10-04T12:00:00Z" },
      { id: "deleted", type: "lesson" },
    ]);
    assert.equal(recent[0].item.id, "lesson");
    assert.equal(recent.length, 2);
  },
);
await check(
  "Bookmark routes retain entity IDs and safely reject invalid routes",
  () => {
    const hash = routeHash("editor", {
      editorType: "chapter",
      parentId: "a / b",
      itemId: "c",
      title: "Private note",
    });
    assert.deepEqual(parseRoute(hash), {
      view: "editor",
      params: { editorType: "chapter", parentId: "a / b", itemId: "c" },
    });
    assert(!hash.includes("Private"));
    assert.equal(parseRoute("#/unknown").view, "home");
  },
);
await check("Media remapping only changes attachment references", () => {
  const value = {
    lessons: [
      { notesHtml: '<img data-media-id="a">', notes: 'data-media-id="a"' },
    ],
  };
  remapMedia(value, new Map([["a", "b"]]));
  assert.equal(value.lessons[0].notesHtml, '<img data-media-id="b">');
  assert.equal(value.lessons[0].notes, 'data-media-id="a"');
});
await check(
  "Cleanup keeps active, recovery and legacy media references",
  async () => {
    const store = fresh();
    store.data.lessons[0].notesHtml = '<img data-media-id="active">';
    media.recovery = {
      data: { lessons: [{ notesHtml: '<img data-media-id="recovery">' }] },
    };
    memory.set(
      "coffee_knowledge_app_data_v1",
      JSON.stringify({
        lessons: [{ notesHtml: '<img data-media-id="legacy">' }],
      }),
    );
    let kept;
    media.cleanup = async (ids) => {
      kept = new Set(ids);
    };
    await store.cleanupMedia();
    assert.deepEqual([...kept].sort(), ["active", "legacy", "recovery"]);
  },
);
await check(
  "Cleanup refuses to discard attachments belonging to damaged recovery data",
  async () => {
    const store = fresh();
    media.recovery = { data: workspace("Saved"), raw: "{broken" };
    let called = false;
    media.cleanup = async () => {
      called = true;
    };
    await assert.rejects(() => store.cleanupMedia(), /damaged/);
    assert(!called);
    assert.equal(store.busy, false);
  },
);
await check(
  "Large base64 uploads decode without a repeated-group regex failure",
  () => {
    const raw = "YWJj".repeat(350000);
    const records = decodeMedia([
      {
        id: "large",
        type: "video/webm",
        data: "data:video/webm;base64," + raw,
      },
    ]);
    assert.equal(records[0].blob.size, 1050000);
  },
);
console.log(`\n${passed} reliability checks passed.`);
