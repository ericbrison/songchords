import { songStorage, renderSong, resetSong, updateSongSelector, closeSongListPanel } from "./songchords.js";

const UG_API = "/api/cors-proxy";

// DOM elements
const chordArea = document.getElementById("chord-area");
const webSearchOverlay = document.getElementById("web-search-overlay");
const webSearchInput = document.getElementById("web-search-input");
const webSearchBtn = document.getElementById("web-search-btn");
const webSearchClose = document.getElementById("web-search-close");
const webSearchResults = document.getElementById("web-search-results");
const webSearchStatus = document.getElementById("web-search-status");
const songListWebSearch = document.getElementById("song-list-web-search");

// ----------------------------
// ---- UG API ----------------
// ----------------------------

async function ugApiFetch(action, params) {
    const qs = new URLSearchParams({ action, ...params });
    const response = await fetch(`${UG_API}?${qs}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    return data;
}

async function searchUG(query) {
    const data = await ugApiFetch("search", { query });
    const tabs = data.tabs || [];
    return tabs
        .filter(r => r.type_name === "Chords" || r.type === 300)
        .map(r => ({
            song_name: r.song_name || "",
            artist_name: r.artist_name || "",
            tab_id: r.id,
            rating: r.rating || 0,
            votes: r.votes || 0
        }));
}

async function fetchUGTab(tabId) {
    const data = await ugApiFetch("tab", { id: tabId });
    const content = data.wiki_tab?.content
        || data.tab_view?.wiki_tab?.content
        || data.content;
    if (!content) {
        console.log("UG tab response:", JSON.stringify(data).substring(0, 2000));
        throw new Error("No tab content found");
    }
    return convertUGContent(content);
}

function convertUGContent(content) {
    return content
        .replace(/\[ch\]/g, "")
        .replace(/\[\/ch\]/g, "")
        .replace(/\[tab\]/g, "")
        .replace(/\[\/tab\]/g, "")
        .replace(/\r\n/g, "\n");
}

// ----------------------------
// ---- Song import -----------
// ----------------------------

function importUGSong(name, artist, content) {
    const songIndex = songStorage.getNewSongIndex();
    const songName = artist + " - " + name;
    const songContent = name + "\n----------\n\n" + content;

    songStorage.recordSongInStorage("songchordname", songName, songIndex);
    songStorage.recordSongInStorage("songchord", songContent, songIndex);

    songStorage.currentSongIndex = songIndex;
    resetSong();
    updateSongSelector();
    renderSong(chordArea.value);
}

// ----------------------------
// ---- UI --------------------
// ----------------------------

function setWebSearchStatus(message, isError, isLoading) {
    webSearchStatus.hidden = !message;
    webSearchStatus.textContent = message || "";
    webSearchStatus.classList.toggle("web-search-error", !!isError);
    webSearchStatus.classList.toggle("web-search-loading", !!isLoading);
}

function renderWebSearchResults(results) {
    webSearchResults.innerHTML = "";
    for (const r of results) {
        const li = document.createElement("li");
        li.classList.add("web-search-result-item");

        const title = document.createElement("span");
        title.classList.add("web-search-result-title");
        title.textContent = r.song_name;

        const info = document.createElement("span");
        info.classList.add("web-search-result-info");

        const artist = document.createElement("span");
        artist.textContent = r.artist_name;

        const rating = document.createElement("span");
        rating.classList.add("web-search-rating");
        const stars = Math.round(r.rating);
        rating.textContent = "★".repeat(stars) + "☆".repeat(5 - stars);

        const votes = document.createElement("span");
        votes.textContent = r.votes + " votes";

        info.appendChild(artist);
        info.appendChild(rating);
        info.appendChild(votes);
        li.appendChild(title);
        li.appendChild(info);

        li.addEventListener("click", async () => {
            li.classList.add("web-search-importing");
            setWebSearchStatus("Importing…", false, true);
            try {
                const content = await fetchUGTab(r.tab_id);
                importUGSong(r.song_name, r.artist_name, content);
                closeWebSearch();
            } catch (err) {
                li.classList.remove("web-search-importing");
                setWebSearchStatus("Import error: " + err.message, true, false);
            }
        });

        webSearchResults.appendChild(li);
    }
}

async function searchAndDisplay() {
    const query = webSearchInput.value.trim();
    if (!query) return;

    webSearchResults.innerHTML = "";
    setWebSearchStatus("Searching…", false, true);

    try {
        const results = await searchUG(query);
        setWebSearchStatus("", false, false);
        if (results.length === 0) {
            setWebSearchStatus("No results", false, false);
        } else {
            renderWebSearchResults(results);
        }
    } catch (err) {
        setWebSearchStatus("Error: " + err.message, true, false);
    }
}

function openWebSearch() {
    closeSongListPanel();
    webSearchInput.value = "";
    webSearchResults.innerHTML = "";
    setWebSearchStatus("", false);
    webSearchOverlay.hidden = false;
    webSearchInput.focus();
}

function closeWebSearch() {
    webSearchOverlay.hidden = true;
}

// ----------------------------
// ---- Event listeners -------
// ----------------------------

songListWebSearch.addEventListener("click", openWebSearch);

webSearchBtn.addEventListener("click", searchAndDisplay);
webSearchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") searchAndDisplay();
});

webSearchClose.addEventListener("click", closeWebSearch);
webSearchOverlay.addEventListener("click", (e) => {
    if (e.target === webSearchOverlay) closeWebSearch();
});

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !webSearchOverlay.hidden) {
        closeWebSearch();
    }
});
