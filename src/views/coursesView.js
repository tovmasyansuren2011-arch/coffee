import { storage } from "../data/storage.js";
import { state } from "../data/state.js";
import { openCreateCourseOrVideoModal } from "./createModals.js";
import { renderCollection } from "./collectionView.js";
export function renderCoursesView(container) {
  const data = storage.getData();
  const courses = data.courses.map((c) => ({
    id: c.id,
    kind: "course",
    icon: "graduation",
    label: "Course",
    className: "cv-card",
    title: c.title,
    subtitle: c.instructor,
    description: c.description,
    meta: `${c.modules?.length || 0} modules · ${c.modules?.reduce((n, m) => n + (m.lessons?.length || 0), 0) || 0} lessons`,
    updatedAt: c.updatedAt,
    open: () => state.navigate("course-detail", { courseId: c.id }),
  }));
  const videos = data.videos.map((v) => ({
    id: v.id,
    kind: "video",
    label: "Video",
    className: "cv-card",
    title: v.title,
    subtitle: v.source,
    description: v.description,
    meta: "Video & notes",
    updatedAt: v.updatedAt,
    open: () => state.navigate("video-detail", { videoId: v.id }),
  }));
  renderCollection(container, {
    title: "Courses & Videos",
    subtitle: "A place for courses, videos, and the ideas you want to keep.",
    icon: "graduation",
    create: () => openCreateCourseOrVideoModal(),
    createId: "btn-new-cv",
    createLabel: "New course / video",
    filters: [
      { id: "all", label: "All" },
      { id: "course", label: "Courses" },
      { id: "video", label: "Videos" },
    ],
    emptyTitle: "Build your learning collection",
    emptyDescription:
      "Add a course with modules or a video with its own notes.",
    items: [...courses, ...videos],
  });
}
