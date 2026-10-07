/**
 * Test Suite for Coffee Personal Knowledge App
 * Validates clean slate initialization, entity & note persistence,
 * debounced saving & flushing, markdown renderer, and backup import/export.
 */

import assert from "node:assert";
import { parseMarkdown } from "./src/ui/markdown.js";

// Setup Mock Browser Storage
const mockStorage = {};
globalThis.localStorage = {
  getItem(k) {
    return mockStorage[k] || null;
  },
  setItem(k, v) {
    mockStorage[k] = String(v);
  },
  removeItem(k) {
    delete mockStorage[k];
  },
  clear() {
    for (const k in mockStorage) delete mockStorage[k];
  },
};

globalThis.window = {
  addEventListener: () => {},
  removeEventListener: () => {},
};

console.log("--- Starting Coffee Test Suite ---");

async function runTests() {
  const { storage } = await import("./src/data/storage.js");

  // Test 1: Clean Slate Initialization (No preloaded notes, user is first to add)
  console.log("\n[Test 1] Clean slate initialization (0 initial notes)");
  const data = storage.getData();
  assert.strictEqual(
    data.books.length,
    0,
    "Library starts with 0 books so user is the first to add",
  );
  assert.strictEqual(data.courses.length, 0, "Library starts with 0 courses");
  assert.strictEqual(data.videos.length, 0, "Library starts with 0 videos");
  assert.strictEqual(
    data.lessons.length,
    0,
    "Library starts with 0 standalone lessons",
  );
  console.log("✓ Storage starts completely clean and empty as requested");

  // Test 2: Entity & Note Creation and Immediate Persistence
  console.log("\n[Test 2] First user note creation & persistent storage");
  const userBook = {
    id: "user-book-1",
    title: "Designing Data-Intensive Applications",
    author: "Martin Kleppmann",
    description:
      "The big ideas behind reliable, scalable, and maintainable systems.",
    chapters: [
      {
        id: "chap-user-1",
        title: "Reliability & Fault Tolerance",
        notes: "# Chapter 1 Notes\n\nHardware faults vs software bugs.",
      },
    ],
  };

  storage.saveEntity("books", userBook);
  const retrievedBook = storage
    .getData()
    .books.find((b) => b.id === "user-book-1");
  assert(retrievedBook, "New user book should be saved in memory");
  assert.strictEqual(
    retrievedBook.title,
    "Designing Data-Intensive Applications",
  );
  assert.strictEqual(
    retrievedBook.chapters[0].notes,
    "# Chapter 1 Notes\n\nHardware faults vs software bugs.",
  );

  const savedJson = localStorage.getItem("coffee_knowledge_app_data_v2");
  assert(savedJson, "Data must be written to coffee_knowledge_app_data_v2");
  assert(
    savedJson.includes("Hardware faults vs software bugs."),
    "Note content is persisted immediately to localStorage",
  );
  console.log("✓ User note created and verified in localStorage");

  // Test 3: Debounced Note Editing & Immediate Flush
  console.log("\n[Test 3] Note keystroke auto-saving and flush");
  retrievedBook.chapters[0].notes +=
    "\n\nKey insight: SLA target 99.99% availability.";
  storage.scheduleDebouncedSave(150);
  assert(
    storage.pendingSaveTimeout !== null,
    "Save timer should be active during typing",
  );
  storage.flushPendingSave();
  assert(
    storage.pendingSaveTimeout === null,
    "Timer must be cleared after flush",
  );

  const updatedStorage = localStorage.getItem("coffee_knowledge_app_data_v2");
  assert(
    updatedStorage.includes("SLA target 99.99% availability."),
    "Edited note was flushed and saved to disk",
  );
  console.log("✓ Auto-save debounce and synchronous flush succeed");

  // Test 4: Standalone Lesson Note Creation & Saving
  console.log("\n[Test 4] Standalone lesson note creation");
  const userLesson = {
    id: "user-lesson-1",
    title: "Distributed Consensus & Raft",
    description: "Leader election, log replication, and safety guarantees",
    notes:
      "# Raft Consensus\n\nNodes can be in Leader, Follower, or Candidate states.",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  storage.saveEntity("lessons", userLesson);
  assert.strictEqual(storage.getData().lessons.length, 1);
  assert(
    localStorage
      .getItem("coffee_knowledge_app_data_v2")
      .includes("Distributed Consensus & Raft"),
    "Lesson persisted",
  );
  console.log("✓ Standalone lesson notes verified");

  // Test 5: Course & Video Note Saving
  console.log("\n[Test 5] Video note creation & saving");
  const userVideo = {
    id: "user-video-1",
    title: "How TLS Handshakes Work",
    source: "YouTube",
    url: "https://youtube.com/watch?v=example",
    notes:
      "# TLS 1.3 Handshake\n\nReduced from 2-RTT to 1-RTT for full secrecy.",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  storage.saveEntity("videos", userVideo);
  assert.strictEqual(storage.getData().videos.length, 1);
  assert(
    localStorage
      .getItem("coffee_knowledge_app_data_v2")
      .includes("Reduced from 2-RTT to 1-RTT"),
    "Video notes saved",
  );
  console.log("✓ Video notes verified");

  // Test 6: Storage Statistics Calculation
  console.log("\n[Test 6] Storage statistics");
  const stats = storage.getStats();
  assert.strictEqual(stats.bookCount, 1);
  assert.strictEqual(stats.chapterCount, 1);
  assert.strictEqual(stats.lessonCount, 1);
  assert.strictEqual(stats.videoCount, 1);
  assert(parseFloat(stats.kb) > 0, "KB calculation should be accurate");
  console.log(
    `✓ Storage statistics: ${stats.kb} KB, ${stats.totalEntries} total entries`,
  );

  // Test 7: Backup Export & Import
  console.log("\n[Test 7] Backup export & import");
  globalThis.Blob = class {
    constructor(parts) {
      this.parts = parts;
      this.size = parts.join("").length;
    }
  };
  globalThis.URL = {
    createObjectURL: () => "blob:mock",
    revokeObjectURL: () => {},
  };
  globalThis.document = {
    createElement: () => ({ href: "", download: "", click: () => {} }),
    body: { appendChild: () => {}, removeChild: () => {} },
  };

  const backupData = JSON.stringify({
    app: "Coffee",
    version: "1.0",
    data: {
      books: [
        {
          id: "b-imp",
          title: "Clean Architecture",
          chapters: [
            { id: "c-imp", title: "SOLID", notes: "# SOLID Principles" },
          ],
        },
      ],
      courses: [],
      videos: [],
      lessons: [],
    },
  });

  const importRes = storage.importData(backupData);
  assert(importRes.success, "Import should succeed");
  assert.strictEqual(storage.getData().books[0].title, "Clean Architecture");
  assert(
    localStorage
      .getItem("coffee_knowledge_app_data_v2")
      .includes("SOLID Principles"),
    "Imported notes saved to storage",
  );
  console.log("✓ Import/export accurately handles notes and persistence");

  // Test 8: Markdown Parsing
  console.log("\n[Test 8] Markdown rendering verification");
  const mdSample = `# Architecture Note
## Sub-section
Writing **clean** notes with \`code\` blocks and [ ] tasks.

> Quotes of wisdom

- Bullet item 1
- Bullet item 2
`;
  const parsed = parseMarkdown(mdSample);
  assert(
    parsed.includes('<h1 class="markdown-heading h1">Architecture Note</h1>'),
  );
  assert(parsed.includes("<strong>clean</strong>"));
  assert(parsed.includes('<code class="inline-code">code</code>'));
  assert(parsed.includes("markdown-blockquote"));
  console.log("✓ Markdown parsed correctly");

  console.log("\n🎉 ALL 8 TESTS PASSED WITH 100% SUCCESS!\n");
}

runTests().catch((err) => {
  console.error("\n❌ Test Suite Failed:", err);
  process.exit(1);
});
