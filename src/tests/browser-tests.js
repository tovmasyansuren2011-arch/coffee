// Intentionally restricted to a dedicated origin; never run destructive fixtures in a user's workspace.
if (location.hostname !== "localhost" || location.port !== "3002")
  throw new Error(
    "Use http://localhost:3002/src/tests/browser.html for isolated browser tests.",
  );
const { storage, StorageManager, STORAGE_KEY } = await import(
  "../data/storage.js"
);
const { mediaStore, referencedMedia, decodeMedia } = await import(
  "../features/mediaStore.js"
);
const { cleanHTML, readPhoto } = await import("../features/richText.js");
const { fileMediaHTML, hydrateMedia, releaseMedia } = await import(
  "../features/media.js"
);
const { showModal } = await import("../ui/modal.js");
const { renderEditorView } = await import("../views/editorView.js");
await storage.ready;
const results = document.querySelector("#results"),
  fixture = document.querySelector("#fixtures");
let passed = 0,
  failed = 0;
function assert(condition, message = "Assertion failed") {
  if (!condition) throw new Error(message);
}
async function test(name, run) {
  const row = document.createElement("li");
  results.append(row);
  try {
    await run();
    passed++;
    row.className = "passed";
    row.textContent = `PASS — ${name}`;
  } catch (error) {
    failed++;
    row.className = "failed";
    row.textContent = `FAIL — ${name}: ${error.message}`;
    console.error(error);
  }
}
const data = (title) => ({
  books: [],
  courses: [],
  videos: [],
  lessons: [
    {
      id: "browser-note",
      title,
      notes: "Retained browser text",
      notesHtml: "<p>Retained browser text</p>",
    },
  ],
  lessonModules: [],
  sketches: [],
  testPreps: [],
});
const image =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";
await mediaStore.clear();
await test("Real IndexedDB stores and exports uploaded image and video blobs", async () => {
  const photo = await mediaStore.put(
    decodeMedia([{ id: "pixel", type: "image/png", data: image }])[0].blob,
    "Pixel.png",
  );
  // File storage/backup is codec-independent; playback is checked separately in the UI.
  const video = await mediaStore.put(
    new Blob(["video-fixture"], { type: "video/webm" }),
    "Clip.webm",
  );
  const note = data("Original");
  note.lessons[0].notesHtml = `<p>Retained text</p><figure><img data-media-id="${photo.id}"></figure><figure><video data-media-id="${video.id}"></video></figure>`;
  assert(storage.importData(data("Original")).success);
  storage.data = note;
  assert(storage.persistImmediate());
  const backup = await storage.buildBackup();
  assert(backup.media.length === 2);
  assert(
    backup.media
      .find((file) => file.id === video.id)
      .data.startsWith("data:video/webm;base64,"),
  );
  window.testBackup = backup;
});
await test("Full media export → clear → import → export round trip retains bytes", async () => {
  const original = window.testBackup;
  await storage.clearAllWithMedia();
  assert(storage.data.lessons.length === 0);
  assert((await storage.importBackup(original)).success);
  const exported = await storage.buildBackup();
  assert(exported.data.lessons[0].title === "Original");
  assert(exported.media.length === 2);
  assert(
    exported.media
      .map((file) => file.data)
      .sort()
      .join() ===
      original.media
        .map((file) => file.data)
        .sort()
        .join(),
    "Attachment bytes changed",
  );
  assert(
    exported.media.every(
      (file) => !original.media.some((old) => old.id === file.id),
    ),
    "Media IDs were not staged",
  );
});
await test("Failed text commit removes staged media and preserves existing blob bytes", async () => {
  const previous = await storage.buildBackup(),
    raw = localStorage.getItem(STORAGE_KEY);
  const commit = storage.commit;
  storage.commit = () => {
    throw new Error("Simulated localStorage quota failure");
  };
  const result = await storage.importBackup(window.testBackup);
  storage.commit = commit;
  assert(!result.success);
  assert(localStorage.getItem(STORAGE_KEY) === raw);
  const after = await storage.buildBackup();
  assert(
    after.media
      .map((file) => file.data)
      .sort()
      .join() ===
      previous.media
        .map((file) => file.data)
        .sort()
        .join(),
  );
  const usage = await mediaStore.stats();
  assert(usage.count === 4, `Staged blobs were not removed (${usage.count})`);
});
await test("Real recovery snapshot restores both the note and attachment references", async () => {
  const previous = await storage.buildBackup();
  assert((await storage.importBackup({ data: data("New workspace") })).success);
  assert((await storage.restoreRecovery()).success);
  const recovered = await storage.buildBackup();
  assert(recovered.data.lessons[0].title === previous.data.lessons[0].title);
  assert(
    recovered.media
      .map((file) => file.data)
      .sort()
      .join() ===
      previous.media
        .map((file) => file.data)
        .sort()
        .join(),
  );
});
await test("Unrelated/malformed JSON cannot replace this real workspace", async () => {
  const raw = localStorage.getItem(STORAGE_KEY);
  for (const content of ['{"unrelated":true}', '{"books":[null]}'])
    assert(!(await storage.importBackup(content)).success);
  assert(localStorage.getItem(STORAGE_KEY) === raw);
});
await test("Native Web Locks keep a second workspace manager read only", async () => {
  const second = new StorageManager();
  await second.ready;
  assert(second.readOnly, "Second manager obtained writer access");
  assert(
    !second.saveEntity("lessons", { id: "blocked", title: "Blocked write" }),
  );
});
await test("Rich HTML sanitizer removes executable content and unsafe embeds", () => {
  const html = cleanHTML(
    '<script>alert(1)</script><img src="javascript:alert(1)" onerror="alert(1)"><a href="javascript:alert(1)">Unsafe</a><iframe src="https://attacker.test/"></iframe><p style="color:red;background-image:url(https://attacker.test)"><b>Kept</b></p>',
  );
  assert(!/script|onerror|javascript:|attacker|background-image/i.test(html));
  assert(html.includes("<b>Kept</b>"));
  assert(html.includes("color: red"));
});
await test("Hydrated image object URLs never enter the saved note HTML", async () => {
  fixture.innerHTML = storage.data.lessons[0].notesHtml;
  await hydrateMedia(fixture);
  assert(fixture.querySelector("img").src.startsWith("blob:"));
  const saved = cleanHTML(fixture.innerHTML);
  assert(!saved.includes("blob:"));
  assert(referencedMedia({ lessons: [{ notesHtml: saved }] }).length === 2);
  releaseMedia(fixture);
  fixture.innerHTML = "";
});
await test("Editor prepares the final keystroke before saving and exposes direct edit in focus mode", () => {
  fixture._mediaDisposed = false;
  renderEditorView(fixture, {
    editorType: "lesson",
    itemId: "browser-note",
    startEditing: true,
  });
  const editor = fixture.querySelector("#rich-notes");
  editor.innerHTML = "<p>Final editor keystroke <strong>bold</strong></p>";
  editor.dispatchEvent(new Event("input", { bubbles: true }));
  fixture.querySelector("#note-focus").click();
  assert(
    JSON.parse(localStorage.getItem(STORAGE_KEY)).lessons[0].notes.includes(
      "Final editor keystroke",
    ),
  );
  assert(!fixture.querySelector("#focus-edit").hidden);
  fixture.querySelector("#focus-edit").click();
  assert(!fixture.querySelector(".lesson-write").hidden);
  fixture._cleanupView();
  fixture.innerHTML = "";
  document.body.classList.remove("lesson-focus");
});
await test("Uploaded images are resized through the real image pipeline", async () => {
  const canvas = document.createElement("canvas");
  canvas.width = 2400;
  canvas.height = 1600;
  const context = canvas.getContext("2d");
  context.fillStyle = "#987047";
  context.fillRect(0, 0, canvas.width, canvas.height);
  const source = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  const resized = await readPhoto(source);
  const bitmap = await createImageBitmap(resized);
  assert(bitmap.width === 1800 && bitmap.height === 1200);
  bitmap.close();
  let rejected = false;
  try {
    await readPhoto(
      new Blob([new Uint8Array(16 * 1024 * 1024)], { type: "image/png" }),
    );
  } catch {
    rejected = true;
  }
  assert(rejected, "Oversized image was accepted");
});
await test("A real recorded WebM upload hydrates and plays locally", async () => {
  const canvas = document.createElement("canvas");
  canvas.width = 160;
  canvas.height = 90;
  const context = canvas.getContext("2d");
  const stream = canvas.captureStream(10);
  const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
  const chunks = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size) chunks.push(event.data);
  };
  const finished = new Promise((resolve) => {
    recorder.onstop = resolve;
  });
  recorder.start();
  for (let frame = 0; frame < 6; frame++) {
    context.fillStyle = frame % 2 ? "#92714a" : "#667b50";
    context.fillRect(0, 0, 160, 90);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  recorder.stop();
  await finished;
  stream.getTracks().forEach((track) => track.stop());
  const file = new File(chunks, "Recorded.webm", { type: "video/webm" });
  fixture._mediaDisposed = false;
  fixture.innerHTML = await fileMediaHTML(file);
  await hydrateMedia(fixture);
  const player = fixture.querySelector("video");
  player.muted = true;
  await player.play();
  assert(
    player.videoWidth === 160 && player.readyState >= 2,
    "Uploaded video did not play",
  );
  player.pause();
  releaseMedia(fixture);
  fixture.innerHTML = "";
});
await test("Dialogs are named, make the background inert, trap focus, and restore focus", async () => {
  const button = document.createElement("button");
  button.textContent = "Open test dialog";
  fixture.append(button);
  button.focus();
  const modal = showModal({
    title: "Accessible dialog",
    contentHtml: '<label for="test-field">Name</label><input id="test-field">',
  });
  await new Promise(requestAnimationFrame);
  assert(modal.element.getAttribute("aria-labelledby"));
  assert(document.querySelector("#app").inert);
  modal.element.querySelector(".modal-confirm-btn").focus();
  window.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Tab",
      bubbles: true,
      cancelable: true,
    }),
  );
  assert(
    document.activeElement ===
      modal.element.querySelector(".coffee-modal-close-btn"),
  );
  modal.close();
  assert(document.activeElement === button);
  assert(!document.querySelector("#app").inert);
  fixture.innerHTML = "";
});
await test("Long-note sanitation remains responsive (recorded timing)", () => {
  const long =
    "<p>A meaningful paragraph with <strong>formatted</strong> learning notes.</p>".repeat(
      1500,
    );
  const start = performance.now();
  const cleaned = cleanHTML(long);
  const elapsed = performance.now() - start;
  assert(cleaned.includes("formatted"));
  const row = document.createElement("li");
  row.textContent = `Measured: ${(long.length / 1024).toFixed(0)} KB rich note sanitized in ${elapsed.toFixed(1)} ms.`;
  results.append(row);
});
// Only generated test fixtures exist on this dedicated origin.
await mediaStore.clear();
await storage.media.saveRecovery({
  data: data("Test snapshot"),
  savedAt: new Date().toISOString(),
});
localStorage.removeItem(STORAGE_KEY);
document.querySelector("#summary").textContent =
  `${passed} passed · ${failed} failed`;
document.querySelector("#summary").className = failed ? "failed" : "passed";
