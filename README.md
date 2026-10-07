# Coffee 6 — Your personal learning desk

A small, local app for books, courses, videos and lesson notes. No account or application dependencies are required.

## Start

1. Extract the ZIP.
2. On Windows, double-click **Start-Coffee.bat**. On macOS/Linux, run `node server.js` in the Coffee-App folder.
3. Open **http://localhost:3000** in your browser. Keep the server window open.

Use Node.js 20 or later and a modern browser. The server binds to this computer only. Use the local server rather than opening index.html directly.

## Upgrade from Coffee 5

Use the same browser profile and **http://localhost:3000**. Your notes and uploaded files belong to that browser origin, not the extracted folder. Existing version-two storage and the existing media database are retained. Version-one content is migrated without deleting the original key. Export a complete JSON backup before switching browsers or clearing browser data.

Stop the previous server before starting this release. Extract into a new folder so you can keep your previous app copy.

## A redesigned home

The learning desk combines a warm coffee palette, illustrated welcome card, compact date and live HH:MM:SS clock, real note and word counts, a prominent recent note, quick creation shortcuts and three learning shelves. Course breadcrumbs read “Courses” and return to the collection, matching the Lessons navigation. “Continue learning” follows your most recently opened available note; new workspaces fall back to recently updated notes. Deleted items are excluded.

The layout adapts to phone, tablet and desktop widths. Statistics use your actual content. New installations start empty.

## Fonts and YouTube videos

The note font menu now offers seven choices: Sans serif, Serif, Monospace, Comic Sans, Comfortaa, Roboto and Armenian (Noto Sans Armenian). Select text and choose its font, or select a font before typing. The bundled fonts work offline. Comic Sans uses a locally installed Comic Sans font, with bundled Comic Neue as its fallback. Armenian glyphs have a bundled fallback in the added font choices. Font licenses are included in src/fonts.

Use **Video** in the note toolbar, paste a YouTube link and choose **Insert video**. Standard watch links, youtu.be links, Shorts, live and mobile links are supported. Recognized provider links also work without https://. You can also add a standalone video from the home page. Insertion closes the dialog before editing the note and sets the player referrer policy immediately. The player includes a link to the original video for videos whose owners restrict embedding. Playback requires internet access.

Books, Courses and Lessons use the same breadcrumb button styling.

## Notes and learning resources

- **Books → chapter notes**.
- **Courses → modules → lesson notes**.
- **Videos → linked lecture and notes**.
- **Lessons → learning modules → lesson notes**, with unfiled lessons available.

Create a note to enter writing mode. Apply formatting from the toolbar. Existing Markdown content remains readable. Notes save automatically after a short pause and flush before navigation, export, or page exit. The editor prepares rich HTML once per save instead of repeatedly parsing the whole note on every keystroke.

**Save & focus** enters reading mode. **Edit notes** is available directly in focus mode; **Esc** or × shows navigation. **Ctrl/Cmd+S** saves. Search uses **Ctrl/Cmd+K**. Opening Search or Settings preserves the editor rather than recreating it.

URLs identify collections and individual notes. Reload keeps the current location; browser Back/Forward works, and note URLs can be bookmarked. A bookmark opens the note only in a browser profile containing its data.

Course lesson and standalone video URLs have an expandable player next to the notes. YouTube, Vimeo and direct MP4/WebM/Ogg links are supported. Expand **Watch lecture/video** to load an external player; opening a note alone does not load that player. Other reference links open in a new tab. Providers can disable embedding.

## Images and videos

Insert media at the cursor, paste images, or drop files into the editor. Text can continue above, between and below attachments. Remove an attachment with its × while editing.

- Images: PNG, JPEG, WebP and GIF, up to 15 MB before resizing. Maximum dimension 1800 pixels. GIF uploads become still images.
- Uploaded videos: MP4, WebM or Ogg, up to 50 MB. Actual playback depends on the browser's supported codecs.
- Linked videos: YouTube, Vimeo, and direct video links.

Uploads use IndexedDB. Notes use localStorage. Unused uploads can be removed with **Settings → Clean unused files**. Files used by the current workspace or its recovery snapshot are retained.

## Backups and recovery

**Export JSON** includes notes and every referenced upload. It also includes the editor draft if browser saving has failed. A missing attachment causes a clear export error instead of producing an incomplete backup.

**Choose JSON** validates the complete backup and shows its counts before you choose **Restore backup**. Unrelated JSON, malformed entities, duplicate IDs and broken module relationships are rejected. Text-only backups from earlier versions remain supported. The file chooser limits incoming files to 512 MB; large collections can still require substantial browser memory.

Before a confirmed import or clear, Coffee saves one **Previous workspace** snapshot. Restores stage uploaded files under new IDs; they never overwrite files belonging to the previous workspace. If committing notes fails, staged files are removed. **Restore previous** returns to the snapshot, including attachment references, and keeps the replaced workspace as the next snapshot. Only one snapshot is kept.

If saved data is unreadable, Coffee shows a recovery screen and preserves the raw saved value. You can download it or restore a valid backup. It does not silently reset your workspace. A preserved damaged snapshot can also be downloaded from Settings.

**Clear workspace** retains a recovery snapshot rather than deleting its attachment files immediately. A later import or clear replaces that snapshot.

## Multiple tabs and save failures

Browsers with Web Locks allow one editing tab per browser origin. Other tabs can read and export; close the editing tab and reload a read-only tab to take over. Browsers without Web Locks use stale-data checks; use one tab for editing in those browsers.

Changes from another tab never replace a note object beneath an open editor. A conflict protects the current draft and blocks writes. Export that tab's draft before reloading. A failed save is shown as an error, and leaving the page with an unsaved draft triggers the browser's standard warning.

## Privacy and limitations

Notes stay in this browser. No analytics or external font requests are included. The app has no account, cloud synchronization, or application-level encryption. External images, video URLs and players can contact their providers. Browser storage is finite and clearing site data removes both active data and recovery snapshots. Keep an exported backup outside the browser.

The rich editor uses browser-native formatting commands, so behavior can vary across browsers. The server is intended for local use, not public deployment.

## Verification

Run **`npm test`** for existing persistence/migration checks, backup schema validation, failed-save rollback, recovery, stale-tab protection, recency, bookmark routing and server path restrictions.

For real browser storage/media checks, run a separate server on port **3002**:

- macOS/Linux: `PORT=3002 node server.js`
- Windows Command Prompt: `set PORT=3002` then `node server.js`

Open **http://localhost:3002/src/tests/browser.html**. This suite uses only generated data on that dedicated origin. It verifies IndexedDB export/import round trips, attachment rollback and recovery, Web Locks, sanitization, image resizing, locally recorded WebM playback, editor saving, dialog focus and a long-note timing check. Do not use port 3002 for personal notes; the suite replaces its generated test workspace.
