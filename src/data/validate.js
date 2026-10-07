import { migrateData } from "./migrate.js";

const COLLECTIONS = [
  "books",
  "courses",
  "videos",
  "lessons",
  "lessonModules",
  "sketches",
  "testPreps",
  "notebooks",
  "libraryChapters",
];
const TEXT_FIELDS = [
  "title",
  "description",
  "author",
  "instructor",
  "source",
  "url",
  "videoUrl",
  "notes",
  "notesHtml",
  "heading",
  "body",
  "createdAt",
  "updatedAt",
];
const isObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export function validateWorkspace(raw) {
  if (!isObject(raw) || !COLLECTIONS.some((key) => Object.hasOwn(raw, key))) {
    throw new Error(
      "This is not a Coffee workspace. Choose a Coffee JSON backup.",
    );
  }
  for (const key of COLLECTIONS) {
    if (Object.hasOwn(raw, key) && !Array.isArray(raw[key]))
      throw new Error(`${key} must be a list.`);
  }
  function entities(items, label, titleField = "title") {
    const ids = new Set();
    for (const item of items || []) {
      if (
        !isObject(item) ||
        typeof item.id !== "string" ||
        !item.id.trim() ||
        item.id.length > 200
      )
        throw new Error(`${label}: every item needs a valid ID.`);
      if (ids.has(item.id))
        throw new Error(`${label}: duplicate ID ${item.id}.`);
      ids.add(item.id);
      if (
        label === "library resources" &&
        typeof item.refId === "string" &&
        item.refId.trim()
      )
        continue;
      if (typeof item[titleField] !== "string" || !item[titleField].trim())
        throw new Error(`${label}: every item needs a title.`);
      for (const field of TEXT_FIELDS) {
        if (label === "notebooks" && field === "notes") continue;
        if (item[field] != null && typeof item[field] !== "string")
          throw new Error(`${label}: ${field} must be text.`);
      }
      for (const field of ["createdAt", "updatedAt"]) {
        if (item[field] && !Number.isFinite(Date.parse(item[field])))
          throw new Error(`${label}: invalid ${field}.`);
      }
      for (const field of ["chapters", "modules", "lessons", "resources"]) {
        if (item[field] != null && !Array.isArray(item[field]))
          throw new Error(`${label}: ${field} must be a list.`);
      }
    }
    return ids;
  }
  for (const key of COLLECTIONS.filter((key) => key !== "notebooks"))
    entities(raw[key], key);
  entities(raw.notebooks, "notebooks");
  for (const notebook of raw.notebooks || []) {
    if (notebook.notes != null && !Array.isArray(notebook.notes))
      throw new Error("Notebook notes must be a list.");
    entities(notebook.notes, "notebook notes", "heading");
  }
  for (const chapter of raw.libraryChapters || [])
    entities(chapter.resources, "library resources");
  const data = migrateData(raw);
  for (const key of ["books", "courses", "videos", "lessons", "lessonModules"])
    entities(data[key], key);
  for (const book of data.books)
    entities(book.chapters, `Chapters in ${book.title}`);
  for (const course of data.courses) {
    entities(course.modules, `Modules in ${course.title}`);
    const lessons = [];
    for (const module of course.modules || []) {
      entities(module.lessons, `Lessons in ${module.title}`);
      lessons.push(...(module.lessons || []));
    }
    entities(lessons, `Lessons in ${course.title}`);
  }
  const modules = new Set(data.lessonModules.map((item) => item.id));
  for (const lesson of data.lessons) {
    if (
      lesson.moduleId != null &&
      (typeof lesson.moduleId !== "string" ||
        (lesson.moduleId && !modules.has(lesson.moduleId)))
    ) {
      throw new Error(
        `The lesson “${lesson.title}” refers to a missing module.`,
      );
    }
  }
  return data;
}

export function readBackup(content) {
  const parsed = typeof content === "string" ? JSON.parse(content) : content;
  if (!isObject(parsed)) throw new Error("Invalid backup file.");
  if (parsed.app != null && parsed.app !== "Coffee")
    throw new Error("This backup belongs to another application.");
  if (
    parsed.version != null &&
    !/^[1-6](?:\.\d+)*$/.test(String(parsed.version))
  )
    throw new Error("Unsupported backup version.");
  const data = validateWorkspace(
    Object.hasOwn(parsed, "data") ? parsed.data : parsed,
  );
  const media = parsed.media ?? [];
  if (!Array.isArray(media)) throw new Error("Attachments must be a list.");
  return { data, media };
}
