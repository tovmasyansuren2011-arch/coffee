export function learningNotes(data) {
  const list = [];
  for (const book of data.books)
    for (const chapter of book.chapters || [])
      list.push({
        item: chapter,
        parent: book,
        title: chapter.title,
        subtitle: book.title,
        type: "chapter",
        icon: "book",
        updatedAt: chapter.updatedAt || book.updatedAt,
      });
  for (const course of data.courses)
    for (const module of course.modules || [])
      for (const lesson of module.lessons || [])
        list.push({
          item: lesson,
          parent: course,
          title: lesson.title,
          subtitle: `${course.title} · ${module.title}`,
          type: "course-lesson",
          icon: "graduation",
          updatedAt: lesson.updatedAt || course.updatedAt,
        });
  for (const video of data.videos)
    list.push({
      item: video,
      title: video.title,
      subtitle: video.source || "Video",
      type: "video",
      icon: "video",
      updatedAt: video.updatedAt,
    });
  for (const lesson of data.lessons)
    list.push({
      item: lesson,
      title: lesson.title,
      subtitle:
        data.lessonModules.find((module) => module.id === lesson.moduleId)
          ?.title || "Unfiled lesson",
      type: "lesson",
      icon: "lesson",
      updatedAt: lesson.updatedAt,
    });
  return list.sort(
    (a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0),
  );
}
export function recentLearning(data, recents) {
  const notes = learningNotes(data),
    opened = [],
    seen = new Set();
  for (const recent of recents) {
    const note = notes.find(
      (note) =>
        note.type === recent.type &&
        note.item.id === recent.id &&
        (!recent.parentId || note.parent?.id === recent.parentId),
    );
    if (note && !seen.has(note)) {
      opened.push({ ...note, openedAt: recent.timestamp });
      seen.add(note);
    }
  }
  return [...opened, ...notes.filter((note) => !seen.has(note))];
}
