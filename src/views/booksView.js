import { storage } from "../data/storage.js";
import { state } from "../data/state.js";
import { openCreateBookModal } from "./createModals.js";
import { renderCollection } from "./collectionView.js";
export function renderBooksView(container) {
  renderCollection(container, {
    title: "Books",
    subtitle: "A place for books, chapters, and the ideas you want to keep.",
    icon: "book",
    create: openCreateBookModal,
    createId: "btn-new-book",
    createLabel: "New book",
    filters: [{ id: "all", label: "All books" }],
    emptyTitle: "Your next chapter starts here",
    emptyDescription: "Add a book and organize your notes chapter by chapter.",
    items: storage.getData().books.map((b) => ({
      id: b.id,
      kind: "book",
      label: "Book",
      className: "book-card",
      title: b.title,
      subtitle: b.author,
      description: b.description,
      meta: `${b.chapters?.length || 0} chapters`,
      updatedAt: b.updatedAt,
      open: () => state.navigate("book-detail", { bookId: b.id }),
    })),
  });
}
