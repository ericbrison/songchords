import { songStorage, updateSongSelector, parseFrontMatter, resetSong } from "./songchords.js";
import { gdriveSyncAll, gdriveSaveFile, ensureGdriveAuth, isGdriveConnected, updateGdriveStatus, refreshAllGroups } from "./g/sync.js";
import { pcloudSyncAll, pcloudSaveFile, isPCloudConfigured, openPCloudSettings, ensurePCloudAuth } from "./pcloud/sync.js";

// ----------------------------
// ---- Toast system ----------
// ----------------------------

const syncToast = document.getElementById("sync-toast");
const syncToastIcon = document.getElementById("sync-toast-icon");
const syncToastMessage = document.getElementById("sync-toast-message");
const syncToastProgress = document.getElementById("sync-toast-progress");
const syncToastBar = document.getElementById("sync-toast-bar");
let toastTimer = null;

function showToast(message, icon, { type = "", progress = false } = {}) {
    clearTimeout(toastTimer);
    syncToast.className = "sync-toast" + (type ? " sync-toast-" + type : "");
    syncToastIcon.textContent = icon;
    syncToastIcon.classList.toggle("spin", type === "");
    syncToastMessage.textContent = message;
    syncToastProgress.hidden = !progress;
    syncToastBar.style.width = "0%";
    syncToast.hidden = false;
}

function updateToastProgress(current, total) {
    syncToastBar.style.width = Math.round((current / total) * 100) + "%";
}

function hideToast(delay = 2500) {
    toastTimer = setTimeout(() => {
        syncToast.style.animation = "sync-toast-out 0.3s ease-in forwards";
        setTimeout(() => {
            syncToast.hidden = true;
            syncToast.style.animation = "";
        }, 300);
    }, delay);
}

// ----------------------------
// ---- Provider routing ------
// ----------------------------

function getSyncProvider() {
    return songStorage.getGlobalInfoFromStorage("syncProvider") || "";
}

// ----------------------------
// ---- Sync button (⇅) ------
// ----------------------------

const connectButton = document.getElementById("gDownload");
connectButton.addEventListener("click", async function () {
    const provider = getSyncProvider();

    if (provider === "pcloud") {
        if (!isPCloudConfigured()) {
            openPCloudSettings();
            return;
        }
        showToast("Connecting to pCloud...", "⇅", { progress: true });
        let dCount = 0;
        try {
            await pcloudSyncAll((current, total) => {
                dCount = current;
                showToast(`Downloading ${current} / ${total}...`, "⇅", { progress: true });
                updateToastProgress(current, total);
            });
            refreshAllGroups();
            updateSongSelector();
            showToast(`Sync complete (${dCount} files)`, "✓", { type: "success" });
            hideToast();
        } catch (err) {
            showToast("Sync error: " + (err.message || err), "✗", { type: "error" });
            hideToast(4000);
        }
    } else if (provider === "gdrive") {
        showToast("Connecting to Google Drive...", "⇅", { progress: true });
        let dCount = 0;
        try {
            await gdriveSyncAll(
                (cFiles) => {
                    dCount++;
                    showToast(`Downloading ${dCount} / ${cFiles}...`, "⇅", { progress: true });
                    updateToastProgress(dCount, cFiles);
                },
                () => {
                    showToast("Sync complete", "✓", { type: "success" });
                    hideToast();
                }
            );
        } catch (err) {
            updateGdriveStatus();
            showToast("Sync error: " + (err.message || err), "✗", { type: "error" });
            hideToast(4000);
        }
    } else {
        showToast("Select a sync service in ⚙ Settings", "⚙", { type: "error" });
        hideToast(4000);
    }
});

// ----------------------------
// ---- Save button (💾) ------
// ----------------------------

const saveButton = document.getElementById("save");
saveButton.addEventListener("click", async function () {
    const songName = songStorage.getSongInfoFromStorage("songchordname") || "unnamed";
    const songText = songStorage.getSongInfoFromStorage("songchord");
    const provider = getSyncProvider();

    // Always save locally (already done by songchords.js on input)
    const meta = parseFrontMatter(songText);
    songStorage.recordSongInStorage("title", meta.title);
    songStorage.recordSongInStorage("group", meta.categories.length > 0 ? meta.categories[0] : "");
    songStorage.recordSongInStorage("categories", meta.categories);
    songStorage.recordSongInStorage("author", meta.author);
    updateSongSelector();

    if (provider === "pcloud") {
        const fileId = songStorage.getSongInfoFromStorage("pcloudFileId");
        showToast(`Saving "${songName}"...`, "💾");
        try {
            await pcloudSaveFile(songName, songText, fileId);
            showToast(`"${songName}" saved`, "✓", { type: "success" });
            hideToast();
        } catch (err) {
            showToast("Error: " + (err.message || err), "✗", { type: "error" });
            hideToast(4000);
        }
    } else if (provider === "gdrive") {
        const fileId = songStorage.getSongInfoFromStorage("gId");
        showToast(`Saving "${songName}"...`, "💾");
        try {
            const result = await gdriveSaveFile(songName, songText, fileId);
            if (result.action === "created") {
                songStorage.recordSongInStorage("gId", result.id);
                showToast(`"${songName}" created on Drive`, "✓", { type: "success" });
            } else {
                showToast(`"${songName}" saved`, "✓", { type: "success" });
            }
            updateGdriveStatus();
            hideToast();
        } catch (err) {
            updateGdriveStatus();
            showToast("Error: " + (err.message || err), "✗", { type: "error" });
            hideToast(4000);
        }
    } else {
        showToast("Select a sync service in ⚙ Settings", "⚙", { type: "error" });
        hideToast(4000);
    }
});

// ----------------------------
// ---- Sync provider select --
// ----------------------------

const syncProviderSelect = document.getElementById("sync-provider");
const syncProviderConfigBtn = document.getElementById("sync-provider-config");

function updateConfigButton() {
    const provider = syncProviderSelect.value;
    syncProviderConfigBtn.hidden = !provider;
}

if (syncProviderSelect) {
    syncProviderSelect.value = getSyncProvider();
    updateConfigButton();
    syncProviderSelect.addEventListener("change", () => {
        songStorage.setGlobalInfoIntoStorage("syncProvider", syncProviderSelect.value);
        updateConfigButton();
    });
}

if (syncProviderConfigBtn) {
    syncProviderConfigBtn.addEventListener("click", () => {
        const provider = getSyncProvider();
        if (provider === "pcloud") {
            openPCloudSettings();
        }
    });
}

// ----------------------------
// ---- Clear local songs -----
// ----------------------------

const clearLocalSongsBtn = document.getElementById("clear-local-songs");
if (clearLocalSongsBtn) {
    clearLocalSongsBtn.addEventListener("click", () => {
        const allSongs = songStorage.getAllSongsStorage();
        const count = Object.keys(allSongs).length;
        if (count === 0) {
            showToast("No local songs to clear", "ℹ", { type: "success" });
            hideToast();
            return;
        }
        if (!confirm(`Delete all ${count} local songs? You can re-sync from the server afterwards.`)) return;
        localStorage.removeItem("songs");
        localStorage.removeItem("currentSongIndex");
        resetSong();
        updateSongSelector();
        showToast(`${count} local songs cleared`, "✓", { type: "success" });
        hideToast();
    });
}
