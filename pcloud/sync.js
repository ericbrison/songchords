import { songStorage, updateSongSelector, parseFrontMatter } from "../songchords.js";

const PCLOUD_API = "/api/pcloud";

// ----------------------------
// ---- Credentials -----------
// ----------------------------

function getPCloudCredentials() {
    const username = localStorage.getItem("pcloud_username");
    const password = localStorage.getItem("pcloud_password");
    if (username && password) return { username, password };
    return null;
}

function savePCloudCredentials(username, password) {
    localStorage.setItem("pcloud_username", username);
    localStorage.setItem("pcloud_password", password);
}

function clearPCloudCredentials() {
    localStorage.removeItem("pcloud_username");
    localStorage.removeItem("pcloud_password");
    localStorage.removeItem("pcloud_auth");
    localStorage.removeItem("pcloud_apihost");
    localStorage.removeItem("pcloud_folderid");
    localStorage.removeItem("pcloud_foldername");
}

function getApiHost() {
    return localStorage.getItem("pcloud_apihost");
}

function saveApiHost(apiHost) {
    localStorage.setItem("pcloud_apihost", apiHost);
    // Stale token from the previous auth scheme, no longer used.
    localStorage.removeItem("pcloud_auth");
}

function getSyncFolder() {
    const folderId = localStorage.getItem("pcloud_folderid");
    const folderName = localStorage.getItem("pcloud_foldername") || "SongChords";
    if (folderId) return { folderId, folderName };
    return null;
}

function saveSyncFolder(folderId, folderName) {
    localStorage.setItem("pcloud_folderid", folderId);
    localStorage.setItem("pcloud_foldername", folderName);
}

// ----------------------------
// ---- pCloud API ------------
// ----------------------------

// pCloud digest auth: we hash the password with a per-request server nonce
// (digest) and send {username, digest, passworddigest} instead of the password
// itself. The digest is valid for ~30s and reusable, so we cache it in memory
// across calls — the password never leaves the browser after this.
const PCLOUD_API_US = "https://api.pcloud.com";
const PCLOUD_API_EU = "https://eapi.pcloud.com";
const DIGEST_TTL_MS = 20_000;
let digestCache = null; // { apiHost, username, pwdMarker, digest, passworddigest, expiresAt }

async function sha1Hex(str) {
    const buf = new TextEncoder().encode(str);
    const hash = await crypto.subtle.digest("SHA-1", buf);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function fetchDigest(apiHost) {
    const r = await fetch(apiHost + "/getdigest");
    const d = await r.json();
    if (d.result !== 0 || !d.digest) throw new Error(d.error || "getdigest failed");
    return d.digest;
}

async function getAuthParams(apiHost, username, password) {
    const pwdMarker = await sha1Hex(password);
    if (
        digestCache &&
        digestCache.apiHost === apiHost &&
        digestCache.username === username &&
        digestCache.pwdMarker === pwdMarker &&
        digestCache.expiresAt > Date.now()
    ) {
        return { username, digest: digestCache.digest, passworddigest: digestCache.passworddigest };
    }
    const digest = await fetchDigest(apiHost);
    const usernameSha = await sha1Hex(username.toLowerCase());
    const passworddigest = await sha1Hex(password + usernameSha + digest);
    digestCache = { apiHost, username, pwdMarker, digest, passworddigest, expiresAt: Date.now() + DIGEST_TTL_MS };
    return { username, digest, passworddigest };
}

function invalidateDigestCache() {
    digestCache = null;
}

async function pcloudFetch(action, params = {}) {
    const creds = getPCloudCredentials();
    if (!creds) throw new Error("No pCloud credentials");
    const apiHost = params.apiHost || getApiHost();
    if (!apiHost) throw new Error("No pCloud apiHost");

    const auth = await getAuthParams(apiHost, creds.username, creds.password);
    const body = { action, apiHost, ...auth, ...params };
    const response = await fetch(PCLOUD_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) {
        // Stale cached digest, or a transient pCloud-side rejection — drop the
        // cache so the next call recomputes.
        invalidateDigestCache();
        throw new Error(data.error || `HTTP ${response.status}`);
    }
    return data;
}

async function pcloudLogin(username, password) {
    // Try US then EU. The region that accepts the digest auth is the user's.
    for (const apiHost of [PCLOUD_API_US, PCLOUD_API_EU]) {
        try {
            invalidateDigestCache();
            const auth = await getAuthParams(apiHost, username, password);
            const r = await fetch(PCLOUD_API, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "userinfo", apiHost, ...auth }),
            });
            if (!r.ok) continue;
            const data = await r.json();
            if (data.result === 0) {
                saveApiHost(apiHost);
                return { apiHost };
            }
        } catch {
            // try next region
        }
    }
    invalidateDigestCache();
    throw new Error("Login failed");
}

export async function ensurePCloudAuth() {
    const creds = getPCloudCredentials();
    if (!creds) throw new Error("No pCloud credentials");
    if (!getApiHost()) {
        await pcloudLogin(creds.username, creds.password);
    }
}

async function ensureSyncFolder() {
    const existing = getSyncFolder();
    const folderName = localStorage.getItem("pcloud_foldername") || "SongChords";
    if (existing && existing.folderName === folderName) return existing;

    // Navigate path like "Musiques/Songs" by listing each level
    const parts = folderName.split("/").filter(p => p.length > 0);
    let parentId = 0;
    for (const part of parts) {
        const listing = await pcloudFetch("listfolder", { folderid: parentId });
        const contents = listing.contents || [];
        const sub = contents.find(f => f.isfolder && f.name === part);
        if (!sub) throw new Error(`Folder "${part}" not found in ${parentId === 0 ? "root" : "parent folder"}`);
        parentId = sub.folderid;
    }
    const folderId = String(parentId);
    saveSyncFolder(folderId, folderName);
    return { folderId, folderName };
}

// ----------------------------
// ---- Sync logic ------------
// ----------------------------

export function isPCloudConfigured() {
    return getPCloudCredentials() !== null;
}

export async function pcloudSyncAll(onProgress) {
    await ensurePCloudAuth();
    const folder = await ensureSyncFolder();

    const folderData = await pcloudFetch("listfolder", { folderid: folder.folderId });
    console.log("pCloud listfolder response:", JSON.stringify(folderData).substring(0, 500));
    const contents = folderData.contents || [];
    const txtFiles = contents.filter(f => !f.isfolder && f.name.endsWith(".txt"));
    console.log(`pCloud: ${contents.length} items in folder, ${txtFiles.length} .txt files`);

    let count = 0;
    for (const file of txtFiles) {
        count++;
        if (onProgress) onProgress(count, txtFiles.length);

        const fileId = String(file.fileid);
        const hash = String(file.hash);

        // Check if already stored with same hash
        const songIndex = songStorage.getSongIndexFromPcloudId(fileId);
        if (songIndex) {
            const songInfo = songStorage.getSongInfoOfIndex(songIndex);
            if (songInfo.pcloudHash === hash) continue;
        }

        // Download and store
        const data = await pcloudFetch("download", { fileid: fileId });
        const content = data.content;
        const name = file.name.replace(/\.txt$/, "");

        const idx = songIndex || songStorage.getNewSongIndex();
        songStorage.recordSongInStorage("songchordname", name, idx);
        songStorage.recordSongInStorage("songchord", content, idx);
        songStorage.recordSongInStorage("pcloudFileId", fileId, idx);
        songStorage.recordSongInStorage("pcloudHash", hash, idx);
        songStorage.recordSongInStorage("dirty", false, idx);
        const meta = parseFrontMatter(content);
        songStorage.recordSongInStorage("title", meta.title, idx);
        songStorage.recordSongInStorage("group", meta.categories.length > 0 ? meta.categories[0] : "", idx);
        songStorage.recordSongInStorage("categories", meta.categories, idx);
        songStorage.recordSongInStorage("author", meta.author, idx);
    }

    updateSongSelector();
}

export async function pcloudSaveFile(songName, songText, existingFileId) {
    await ensurePCloudAuth();
    const folder = await ensureSyncFolder();
    const filename = `${songName}.txt`;

    let result;
    if (existingFileId) {
        result = await pcloudFetch("update", {
            fileid: existingFileId,
            folderid: folder.folderId,
            filename,
            content: songText,
        });
    } else {
        result = await pcloudFetch("upload", {
            folderid: folder.folderId,
            filename,
            content: songText,
        });
    }

    // Store the new file ID and hash
    const fileId = String(result.fileid);
    const hash = String(result.hash);
    songStorage.recordSongInStorage("pcloudFileId", fileId);
    songStorage.recordSongInStorage("pcloudHash", hash);

    return { fileId, hash };
}

// ----------------------------
// ---- Settings overlay ------
// ----------------------------

const overlay = document.getElementById("pcloud-settings-overlay");
const closeBtn = document.getElementById("pcloud-settings-close");
const usernameInput = document.getElementById("pcloud-username");
const passwordInput = document.getElementById("pcloud-password");
const foldernameInput = document.getElementById("pcloud-foldername");
const statusEl = document.getElementById("pcloud-settings-status");
const loginBtn = document.getElementById("pcloud-credentials-save");
const logoutBtn = document.getElementById("pcloud-logout");

function setStatus(message, isError) {
    statusEl.hidden = !message;
    statusEl.textContent = message || "";
    statusEl.classList.toggle("web-search-error", !!isError);
    statusEl.classList.toggle("web-search-loading", !isError && !!message);
}

export function openPCloudSettings() {
    const creds = getPCloudCredentials();
    if (creds) {
        usernameInput.value = creds.username;
        passwordInput.value = creds.password;
    } else {
        usernameInput.value = "";
        passwordInput.value = "";
    }
    foldernameInput.value = localStorage.getItem("pcloud_foldername") || "SongChords";
    logoutBtn.hidden = !creds;
    setStatus("", false);
    overlay.hidden = false;
    if (!creds) usernameInput.focus();
}

function closePCloudSettings() {
    overlay.hidden = true;
}

async function handlePCloudLogin() {
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    const folderName = foldernameInput.value.trim() || "SongChords";
    if (!username || !password) return;

    setStatus("Connecting...", false);

    try {
        await pcloudLogin(username, password);
        savePCloudCredentials(username, password);
        localStorage.setItem("pcloud_foldername", folderName);
        // Reset folder ID so ensureSyncFolder creates/finds with new name
        localStorage.removeItem("pcloud_folderid");
        await ensureSyncFolder();
        setStatus("", false);
        logoutBtn.hidden = false;
        closePCloudSettings();
        // Auto-trigger sync after successful login
        document.getElementById("gDownload").click();
    } catch (err) {
        setStatus("Error: " + (err.message || err), true);
    }
}

function handlePCloudLogout() {
    clearPCloudCredentials();
    usernameInput.value = "";
    passwordInput.value = "";
    logoutBtn.hidden = true;
    setStatus("", false);
}

// Event listeners
closeBtn.addEventListener("click", closePCloudSettings);
overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closePCloudSettings();
});
loginBtn.addEventListener("click", handlePCloudLogin);
passwordInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handlePCloudLogin();
});
logoutBtn.addEventListener("click", handlePCloudLogout);
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !overlay.hidden) closePCloudSettings();
});
