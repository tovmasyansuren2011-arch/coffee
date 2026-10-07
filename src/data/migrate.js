// Preserve old notes while retiring the separate Library and notebook sections.
export function migrateData(raw = {}) {
  const arrays = [
    "books",
    "courses",
    "videos",
    "lessons",
    "lessonModules",
    "sketches",
    "testPreps",
  ];
  const data = Object.fromEntries(
    arrays.map((key) => [
      key,
      structuredClone(Array.isArray(raw?.[key]) ? raw[key] : []),
    ]),
  );
  for (const notebook of Array.isArray(raw.notebooks) ? raw.notebooks : []) {
    const source = `notebook:${notebook.id}`;
    if (data.books.some((b) => b.migratedFrom === source)) continue;
    data.books.push({
      id: `migrated-${notebook.id}`,
      migratedFrom: source,
      title: notebook.title,
      description: notebook.description || "",
      createdAt: notebook.createdAt,
      updatedAt: notebook.updatedAt,
      chapters: (notebook.notes || []).map((n) => ({
        ...n,
        title: n.heading,
        notes: n.body || "",
        notesHtml: n.notesHtml,
      })),
    });
  }
  for (const chapter of Array.isArray(raw.libraryChapters)
    ? raw.libraryChapters
    : [])
    for (const resource of chapter.resources || []) {
      if (resource.refId) continue;
      const source = `resource:${chapter.id}:${resource.id}`,
        id = `migrated-${resource.id}`;
      if (
        ["books", "courses", "videos", "lessons"].some((key) =>
          data[key].some((item) => item.migratedFrom === source),
        )
      )
        continue;
      const common = {
        ...resource,
        id,
        migratedFrom: source,
        description: resource.description || chapter.title,
        createdAt: resource.createdAt || chapter.createdAt,
        updatedAt: resource.updatedAt || chapter.updatedAt,
      };
      if (resource.type === "book")
        data.books.push({
          ...common,
          chapters: [
            {
              id: `${id}-notes`,
              title: "Notes",
              notes: resource.notes || "",
              notesHtml: resource.notesHtml,
            },
          ],
        });
      else if (resource.type === "course")
        data.courses.push({
          ...common,
          modules: [
            {
              id: `${id}-module`,
              title: "Notes",
              lessons: [
                {
                  id: `${id}-notes`,
                  title: resource.title,
                  videoUrl: resource.url || "",
                  notes: resource.notes || "",
                  notesHtml: resource.notesHtml,
                },
              ],
            },
          ],
        });
      else if (resource.type === "video") data.videos.push(common);
      else data.lessons.push(common);
    }
  return data;
}
