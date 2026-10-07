# Coffee 6.0 changes

- Redesigned the home page with a compact clock, learning overview, recent-note card, quick creation and responsive shelves.
- Added backup validation and a replacement preview.
- Added a previous-workspace recovery snapshot, including original attachment references.
- Staged restored media under new IDs and removed staged files on failed note commits.
- Preserved corrupt saved data and migrated version-one storage without deleting it.
- Added one-writer tab protection and stale-data checks; preserved drafts during conflicts.
- Added bookmarkable routes, reload persistence and browser Back/Forward navigation.
- Kept the editor mounted when opening dialogs and search.
- Added direct editing from focus mode and expandable lecture/video players.
- Added dialog naming, focus traps, background isolation, focus restoration and keyboard-operable breadcrumbs/branding.
- Removed external font requests, bound the server to loopback, limited served files and added security headers.
- Added unused-media cleanup that retains current and recovery attachments.
- Reduced editor parsing work, removed obsolete home/sketch/test-prep styles and formatted source files for maintenance.
- Added reliability, server and real browser/media regression checks.

Notes continue to use local browser storage. Encryption and cloud sync are not included. Native rich-text formatting remains browser-dependent. Recovery retains one workspace snapshot, not a full version history.

## 6.0.1

- Shortened course breadcrumbs to **Courses** and made the current collection breadcrumb a working button, matching Lessons.
- Restored the live seconds display in the home clock while keeping the compact date and time pill.

## 6.0.2

- Unified Books, Courses and Lessons collection breadcrumbs as matching borderless buttons, with consistent weight, color and keyboard focus styling.
- Fixed inserting videos while the dialog kept the editor inert; restored selection after closing the dialog.
- Applied safe player attributes immediately during insertion and used YouTube-compatible origin referrer headers to prevent Error 153.
- Accepted normal YouTube, short, Shorts, live and mobile links, including copied links without https://.
- Expanded note fonts to seven choices: Sans serif, Serif, Monospace, Comic Sans, Comfortaa, Roboto and Noto Sans Armenian.
- Bundled Comfortaa, Roboto, Noto Sans Armenian and Comic Neue with their licenses for offline use. Comic Sans uses the installed font when available and Comic Neue otherwise.
