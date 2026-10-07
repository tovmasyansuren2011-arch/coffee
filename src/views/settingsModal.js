import { state } from "../data/state.js";
import { storage } from "../data/storage.js";
import { mediaStore, referencedMedia } from "../features/mediaStore.js";
import { showModal, confirmModal } from "../ui/modal.js";
import { showToast } from "../ui/toast.js";
import { escape } from "../features/richText.js";

export function setupSettings() {
  let wasOpen = false;
  state.subscribe((current) => {
    if (current.isSettingsOpen && !wasOpen) {
      wasOpen = true;
      openSettingsModal();
    }
    if (!current.isSettingsOpen) wasOpen = false;
  });
}

export function previewImport(content) {
  let preview;
  try {
    preview = storage.inspectBackup(content);
  } catch (error) {
    showToast(error.message, "error", 7000);
    return;
  }
  const counts = preview.data;
  showModal({
    title: "Restore this backup?",
    allowReadOnly: true,
    subtitle: "Review the replacement before changing your workspace.",
    contentHtml: `<div class="restore-summary"><strong>${preview.entries} items · ${preview.attachments} attachments</strong><p>${counts.books.length} books · ${counts.courses.length} courses · ${counts.videos.length} videos · ${counts.lessons.length} lessons · ${counts.lessonModules.length} lesson modules</p></div><p>Your current workspace will be replaced. Coffee will keep a recovery snapshot with its attachments. You can restore it from Settings.</p>`,
    confirmText: "Restore backup",
    cancelText: "Keep current workspace",
    onConfirm: async () => {
      const result = await storage.importBackup(content);
      if (!result.success) throw new Error(result.error);
      showToast(
        "Backup restored. Previous workspace available in Settings.",
        "success",
        6000,
      );
      state.closeSettings();
      state.navigate("home");
      state.refresh();
      return true;
    },
  });
}

function openSettingsModal() {
  const stats = storage.getStats(),
    blocked = storage.readOnly || storage.conflict;
  showModal({
    title: "Settings & backups",
    allowReadOnly: true,
    subtitle:
      "Your learning stays in this browser. Keep a backup somewhere safe.",
    contentHtml: `<div class="settings-section"><h3 class="settings-section-title">Workspace storage</h3><p>${stats.kb} KB of saved notes · ${stats.totalEntries} collection items</p><p id="media-usage">Checking attachment storage…</p><p class="settings-row-desc">Notes are stored on this device without app-level encryption. Moving the app folder does not move your notes. External video players connect to their providers when opened.</p></div>
    <div class="settings-section"><h3 class="settings-section-title">Back up & restore</h3>
      <div class="settings-row"><div class="settings-row-info"><strong>Complete backup</strong><p class="settings-row-desc">Includes notes and all referenced uploads, including an unsaved draft.</p></div><button class="btn btn-secondary btn-sm" id="btn-export-json">Export JSON</button></div>
      <div class="settings-row"><div class="settings-row-info"><strong>Restore from a file</strong><p class="settings-row-desc">Validate and preview a backup before replacing anything.</p></div><button class="btn btn-secondary btn-sm" id="btn-import-json" ${blocked ? "disabled" : ""}>Choose JSON</button><input type="file" id="input-import-json" accept=".json,application/json" hidden></div>
      <div class="settings-row"><div class="settings-row-info"><strong>Previous workspace</strong><p id="recovery-description" class="settings-row-desc">Checking recovery snapshot…</p></div><button class="btn btn-secondary btn-sm" id="btn-recover" disabled>Restore previous</button></div>
      <button class="btn btn-secondary" id="btn-damaged-export" hidden>Download preserved data</button>
    </div>
    <div class="settings-section"><h3 class="settings-section-title">Attachment cleanup</h3><p class="settings-row-desc">Remove unused uploads. Attachments used by your notes or the recovery snapshot are kept.</p><button class="btn btn-secondary btn-sm" id="btn-cleanup" ${blocked || storage.recoveryError ? "disabled" : ""}>Clean unused files</button></div>
    <div class="settings-section"><h3 class="settings-section-title">Clear workspace</h3><p class="settings-row-desc">Start fresh. Your current notes and uploads will remain available in the recovery snapshot until the next import or clear.</p><button class="btn btn-danger-outline btn-sm" id="btn-clear-all-data" ${blocked || storage.recoveryError ? "disabled" : ""}>Clear workspace</button></div>`,
    confirmText: "Done",
    cancelText: "Close",
    onClose: () => state.closeSettings(),
    onOpen: (modal) => {
      mediaStore
        .stats()
        .then((usage) => {
          if (modal.isConnected)
            modal.querySelector("#media-usage").textContent =
              `${(usage.bytes / 1024 / 1024).toFixed(1)} MB in ${usage.count} stored attachments (includes recovery and unused files).`;
        })
        .catch((error) => {
          if (modal.isConnected)
            modal.querySelector("#media-usage").textContent = error.message;
        });
      mediaStore
        .getRecovery()
        .then((snapshot) => {
          if (!modal.isConnected) return;
          modal.querySelector("#recovery-description").textContent = snapshot
            ? `Saved ${new Date(snapshot.savedAt).toLocaleString()}`
            : "No replacement has been made yet.";
          modal.querySelector("#btn-recover").disabled =
            !snapshot || blocked || !!snapshot.raw;
          const preserved = modal.querySelector("#btn-damaged-export");
          preserved.hidden = !storage.recoveryError && !snapshot?.raw;
          if (snapshot?.raw && !storage.recoveryError)
            preserved.onclick = () =>
              storage.download(
                snapshot.raw,
                "coffee-preserved-data.txt",
                "text/plain",
              );
        })
        .catch(() => {
          if (modal.isConnected)
            modal.querySelector("#recovery-description").textContent =
              "Recovery storage is unavailable.";
        });
      modal.querySelector("#btn-export-json").onclick = async (event) => {
        const button = event.currentTarget;
        button.disabled = true;
        button.textContent = "Exporting…";
        try {
          await storage.exportData();
          showToast("Complete backup downloaded.", "success");
        } catch (error) {
          showToast(error.message, "error", 7000);
        } finally {
          button.disabled = false;
          button.textContent = "Export JSON";
        }
      };
      modal.querySelector("#btn-damaged-export").hidden =
        !storage.recoveryError;
      if (storage.recoveryError)
        modal.querySelector("#btn-damaged-export").onclick = () =>
          storage.exportDamagedData();
      const input = modal.querySelector("#input-import-json");
      modal.querySelector("#btn-import-json").onclick = () => input.click();
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;
        try {
          if (file.size > 512 * 1024 * 1024)
            throw new Error(
              "This backup is too large to restore safely in the browser (maximum 512 MB).",
            );
          previewImport(await file.text());
        } catch (error) {
          showToast(error.message, "error", 7000);
        }
        input.value = "";
      };
      modal.querySelector("#btn-recover").onclick = () =>
        confirmModal({
          title: "Restore your previous workspace?",
          message:
            "Replace the current workspace with the saved recovery snapshot. Your current workspace becomes the next recovery snapshot.",
          confirmText: "Restore previous",
          onConfirm: async () => {
            const result = await storage.restoreRecovery();
            if (!result.success) throw new Error(result.error);
            state.navigate("home");
            state.refresh();
            showToast("Previous workspace restored.", "success");
          },
        });
      modal.querySelector("#btn-cleanup").onclick = async (event) => {
        const button = event.currentTarget;
        button.disabled = true;
        try {
          await storage.cleanupMedia();
          showToast(
            "Unused uploads removed. Notes and recovery kept.",
            "success",
          );
        } catch (error) {
          showToast(error.message, "error");
        } finally {
          button.disabled = false;
        }
      };
      modal.querySelector("#btn-clear-all-data").onclick = () =>
        confirmModal({
          title: "Clear your workspace?",
          message:
            "All collections and notes will be removed from the active workspace. Coffee keeps one recovery snapshot, replacing any older snapshot.",
          confirmText: "Clear workspace",
          isDanger: true,
          onConfirm: async () => {
            await storage.clearAllWithMedia();
            state.navigate("home");
            state.refresh();
            showToast(
              "Workspace cleared. Restore it from Settings if needed.",
              "info",
              6000,
            );
          },
        });
    },
  });
}
