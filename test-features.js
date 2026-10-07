import assert from "node:assert/strict";
import { videoLink, safeEmbed } from "./src/features/videoLinks.js";
import { referencedMedia } from "./src/features/mediaStore.js";
import { migrateData } from "./src/data/migrate.js";
const memory = new Map();
globalThis.localStorage = {
  getItem: (k) => memory.get(k) || null,
  setItem: (k, v) => memory.set(k, String(v)),
  removeItem: (k) => memory.delete(k),
};
globalThis.window = { addEventListener() {} };
const { storage } = await import("./src/data/storage.js");
const old = {
  books: [],
  courses: [],
  videos: [],
  lessons: [{ id: "old", title: "Kept lesson", notes: "Existing content" }],
  notebooks: [
    {
      id: "nb",
      title: "Linux notes",
      notes: [
        {
          id: "n",
          heading: "Arrays",
          body: "Kept intact",
          notesHtml: "<p><b>Kept intact</b></p>",
        },
      ],
    },
  ],
  libraryChapters: [
    {
      id: "topic",
      title: "Linux",
      resources: [
        {
          id: "book",
          type: "book",
          title: "Linux book",
          notes: "Book content",
          notesHtml: "<p>Book content</p>",
        },
        {
          id: "course",
          type: "course",
          title: "Linux course",
          notes: "Course content",
        },
        {
          id: "video",
          type: "video",
          title: "Linux video",
          url: "https://example.com",
          notes: "Video content",
        },
        {
          id: "lesson",
          type: "lesson",
          title: "Processes",
          notes: "Running programs",
        },
        { id: "ref", type: "lesson", refId: "old" },
      ],
    },
  ],
  sketches: [
    {
      id: "sketch",
      title: "Drawing",
      actions: [
        {
          type: "stroke",
          tool: "pen",
          color: "#123456",
          width: 4,
          points: [
            [0, 0],
            [25, 40],
          ],
        },
      ],
    },
  ],
};
assert(storage.importData(old).success);
const data = storage.getData();
assert.equal(data.books.length, 2);
assert.equal(data.courses.length, 1);
assert.equal(data.videos.length, 1);
assert.equal(data.lessons.length, 2);
assert.equal(data.books[0].chapters[0].notes, "Kept intact");
assert.equal(data.books[0].chapters[0].notesHtml, "<p><b>Kept intact</b></p>");
assert.equal(data.courses[0].modules[0].lessons[0].notes, "Course content");
assert.equal(data.videos[0].url, "https://example.com");
assert(!("notebooks" in data));
assert(!("libraryChapters" in data));
assert.deepEqual(migrateData(data), data);
const duplicate = migrateData({
  ...data,
  notebooks: old.notebooks,
  libraryChapters: old.libraryChapters,
});
assert.equal(duplicate.books.length, 2);
assert.equal(duplicate.lessons.length, 2);
const backup = JSON.stringify({ data });
storage.clearAll();
assert.equal(storage.getData().sketches.length, 0);
storage.importData(backup);
assert.deepEqual(storage.getData(), JSON.parse(JSON.stringify(data)));
assert.equal(
  JSON.parse(localStorage.getItem("coffee_knowledge_app_data_v2")).sketches[0]
    .actions[0].points[1][1],
  40,
);
assert.deepEqual(videoLink("https://youtu.be/dQw4w9WgXcQ"), {
  kind: "embed",
  src: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
  label: "YouTube video",
});
assert.equal(
  videoLink("https://vimeo.com/123456").src,
  "https://player.vimeo.com/video/123456",
);
assert.equal(
  videoLink("https://example.com/video.webm?token=ok").kind,
  "video",
);
assert.equal(videoLink("javascript:alert(1)"), null);
assert.equal(
  videoLink("https://youtube.com.attacker.test/watch?v=dQw4w9WgXcQ"),
  null,
);
assert.equal(safeEmbed("https://attacker.test/embed/123"), "");
assert.equal(videoLink("https://user:password@example.com/a.mp4"), null);
assert.deepEqual(
  referencedMedia({
    lessons: [
      {
        notesHtml: '<video data-media-id="asset-123"></video>',
        notes: 'data-media-id="fake"',
      },
    ],
  }),
  ["asset-123"],
);
console.log(
  "PASS: Legacy notes and backups stay intact; supported video URLs become safe players; unsafe URLs are rejected; media references are collected without mistaking text examples for attachments.",
);

const modular = {
  ...data,
  lessonModules: [
    { id: "linux", title: "Linux", description: "Operating systems" },
  ],
  lessons: [
    ...data.lessons,
    {
      id: "module-note",
      moduleId: "linux",
      title: "Processes",
      notes: "Kept text",
      notesHtml: '<p>Kept text<img data-media-id="picture-123"></p>',
    },
  ],
};
storage.media = { get: async () => ({}), saveRecovery: async () => {} };
assert((await storage.importBackup(modular)).success);
assert.equal(storage.getData().lessonModules[0].title, "Linux");
assert.equal(
  storage.getData().lessons.find((l) => l.id === "module-note").moduleId,
  "linux",
);
assert.deepEqual(migrateData(storage.getData()), storage.getData());
const modularBackup = JSON.stringify({ data: storage.getData() });
storage.clearAll();
assert.deepEqual(storage.getData().lessonModules, []);
assert((await storage.importBackup(modularBackup)).success);
assert.equal(
  storage.getData().lessons.find((l) => l.id === "module-note").notesHtml,
  modular.lessons.at(-1).notesHtml,
);
console.log(
  "PASS: Lesson modules, membership, and rich notes survive migration, clear, and backup restoration.",
);
