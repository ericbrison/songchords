import { songStorage, renderSong, resetSong, updateSongSelector, closeSongListPanel } from "./songchords.js";

const CORS_PROXY = "https://api.allorigins.win/get?url=";
const UG_SEARCH_URL = "https://www.ultimate-guitar.com/search.php?search_type=title&value=";

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
// ---- CORS Proxy fetch ------
// ----------------------------

async function fetchViaProxy(url) {
    const response = await fetch(CORS_PROXY + encodeURIComponent(url));
    if (!response.ok) throw new Error("Network error: " + response.status);
    const data = await response.json();
    return data.contents;
}

// ----------------------------
// ---- UG parsing ------------
// ----------------------------

function extractUGData(html) {
    const match = html.match(/class="js-store"\s+data-content="([^"]+)"/);
    if (!match) return null;
    const decoded = match[1]
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#039;/g, "'");
    return JSON.parse(decoded);
}

async function searchUG(query) {
    const html = await fetchViaProxy(UG_SEARCH_URL + encodeURIComponent(query));
    const data = extractUGData(html);
    if (!data) throw new Error("Could not parse search results");

    const results = data.store?.page?.data?.results || [];
    return results
        .filter(r => r.type === "Chords")
        .map(r => ({
            song_name: r.song_name,
            artist_name: r.artist_name,
            tab_url: r.tab_url,
            rating: r.rating || 0,
            votes: r.votes || 0
        }));
}

async function fetchUGTab(url) {
    const html = await fetchViaProxy(url);
    const data = extractUGData(html);
    if (!data) throw new Error("Could not parse tab page");

    const content = data.store?.page?.data?.tab_view?.wiki_tab?.content;
    if (!content) throw new Error("No tab content found");
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
                const content = await fetchUGTab(r.tab_url);
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
    setWebSearchStatus("Recherche en cours…", false, true);

    try {
        const results = await searchUG(query);
        setWebSearchStatus("", false, false);
        if (results.length === 0) {
            setWebSearchStatus("Aucun résultat trouvé", false, false);
        } else {
            renderWebSearchResults(results);
        }
    } catch (err) {
        setWebSearchStatus("Erreur: " + err.message, true, false);
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
