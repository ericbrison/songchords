import SongStorage from "./songchordsAPI.js";

/** @type HTMLTextAreaElement */
const chordArea = document.getElementById("chord-area");
const songRender = document.getElementById("chord-render");
/** @type HTMLInputElement */
const capoInput = document.getElementById("capo");
const textFontSizeInput = document.getElementById("textfontsize");
/** @type HTMLInputElement */
const chordFontSizeInput = document.getElementById("chordfontsize");
/** @type HTMLInputElement */
const chordColorInput = document.getElementById("chordcolor");
/** @type HTMLInputElement */
const textColorInput = document.getElementById("textcolor");
/** @type HTMLInputElement */
const columnInput = document.getElementById("columncount");
/** @type HTMLSelectElement */
const notationInput = document.getElementById("notation");
/** @type HTMLButtonElement */
const printButton = document.getElementById("print");
/** @type HTMLButtonElement */
const readonlyButton = document.getElementById("readonly");
/** @type HTMLButtonElement */
const saveButton = document.getElementById("save");
/** @type HTMLButtonElement */
const deleteButton = document.getElementById("delete");
/** @type HTMLInputElement */
const chordNameInput = document.getElementById("chord-name");
/** @type HTMLSelectElement */
const chordSelectInput = document.getElementById("chord-select");
/** @type HTMLButtonElement */
const transposePlusButton = document.getElementById("transposePlus");
/** @type HTMLButtonElement */
const transposeMinusButton = document.getElementById("transposeMinus");

// Song list panel elements
const songListToggle = document.getElementById("song-list-toggle");
const songListOverlay = document.getElementById("song-list-overlay");
const songListSearch = document.getElementById("song-list-search");
const songListItems = document.getElementById("song-list-items");
const songListClose = document.getElementById("song-list-close");
const songListNew = document.getElementById("song-list-new");
const songListFooter = document.getElementById("song-list-footer");
const songListGroupFilter = document.getElementById("song-list-group-filter");

let cachedSongEntries = [];

if (!chordArea) {
    console.error("No textarea");
}
if (!songRender) {
    console.error("No songRender");
}

class SongObject {
    songchordname;
    songchord;
    notation;
    capo;
}

export const songStorage = new SongStorage("songs", "global", "currentSongIndex");


function downloadFileText(filename, text) {
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', filename);

    element.style.display = 'none';
    document.body.appendChild(element);

    element.click();

    document.body.removeChild(element);
}


function saveSong() {

    const songName = window.document.getElementById('chord-name').value || "unnamed";
    downloadFileText(songName, chordArea.value);
}


chordArea.ondragover = () => {
    chordArea.classList.add("dragover");
}

chordArea.ondragleave = () => {
    chordArea.classList.remove("dragover");
}

chordArea.ondrop = function (e) {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);

    files.forEach((file, idx) => {

        if (file.type !== "text/plain") {
            alert("Only text file can be dropped here");
            chordArea.classList.remove("dragover");
            return;
        }

        // Create new song or update if already recorded
        let songIndex = songStorage.getSongIndexFromName(file.name);

        if (!songIndex) {
            songIndex = songStorage.getNewSongIndex();
            songStorage.recordSongInStorage("songchordname", file.name, songIndex);
        }

        const reader = new FileReader();
        reader.onload = function (e) {
            chordArea.classList.remove("dragover");
            songStorage.recordSongInStorage("songchord", e.target.result, songIndex);
            if (idx === files.length - 1) {
                // Display last uploaded song
                songStorage.currentSongIndex = songIndex;
                resetSong();
                updateSongSelector();
                renderSong(e.target.result);
            }
        };
        reader.readAsText(file, "UTF-8");
    });
};

//------------------------------------------------
// ----------- Chord song render management -----
//------------------------------------------------

function transposeSong(delta) {
    const song = chordArea.value;


    const lines = song.split('\n');
    const tSong = [];

    lines.forEach((line) => {
        if (line.trim().length > 0) {
            if (isChordLine(line)) {
                line = line.replace("♪", " ");
                line = lineTranspose(line, -delta);
            }
        }
        tSong.push(line);
    });

    chordArea.value = tSong.join('\n');
    songStorage.recordSongInStorage("songchord", chordArea.value);
    renderSong(chordArea.value);
}

function renderChord(line) {

    let chord = line.replaceAll(/([A-G)])([b#])/ig, (s, p1, p2) => {
        return p1 + p2.replace("b", "♭").replaceAll("#", "♯")
    });

    chord = chord.replaceAll("maj7", "Δ");
    chord = chord.replaceAll("M7", "Δ");
    // chord = chord.replaceAll("sus", "/");
    chord = chord.replaceAll(/x([1-9]+)/g, "×$1");


    return chord;
}

function expSus(line) {
    let expLine = line.replaceAll(/((sus|\/|add)[0-9]+)/g, (s) => {
        return `<sup>${s}</sup>`;
    });


    expLine = expLine.replaceAll(/(1?[1-9][b#])/ig, (s, p1) => {
        s = s.replace("b", "♭").replace("#", "♯");
        return `<sup>${s}</sup>`;
    });
    expLine = expLine.replaceAll(/^([A-G♭♯]+)\|-/ig, (s, p1) => {
        return `<span class="tab-string">${p1}</span>|-`;
    });

    expLine = expLine.replaceAll(/([♭♯])/g, (s) => {
        return `<sup class="notation">${s}</sup>`;
    });
    return expLine;
}

function lineTranspose(line, transpose = 0) {
    let rawLine = line.replaceAll("♭", "b").replaceAll("♯", "#");
    let Elowercase = false;
    let spaceDelta = 0;
    if (isTabLine(line)) {
        // No transpose tabLine
        return rawLine;
    }

    rawLine = rawLine.replaceAll(/([A-G][b#]?)([0-9/madsuM+]*)( *)/g, function (s, s1, s2, s3) {
        const noteT = noteTranspose(s1, transpose);

        // Must respect exact white spaces number between chords
        if (s3 !== "") {
            if (spaceDelta < 0) {
                s3 = s3.substring(0, s3.length + spaceDelta);
            } else if (spaceDelta > 0) {
                s3 += ' ';
            }
            if (noteT.length > s1.length) {
                s3 = s3.substring(0, s3.length - 1);
            } else if (noteT.length < s1.length) {
                s2 += ' ';
            }
            s2 += s3;
            spaceDelta = 0;
        } else {
            spaceDelta = s1.length - noteT.length;


        }

        return noteT + s2;
    });


    if (Elowercase) {
        rawLine = rawLine.replace(/^[A-G]/, (s) => {
            return s.toLowerCase();
        });
    }
    rawLine = rawLine.replaceAll(/\/ ([A-G][b#]?) /gu, function (s, s1) {
        return "/" + s1 + " ";
    });

    return rawLine.replaceAll(/([^ ]+%[^ ]*)/gu, function (s) {
        return s.replaceAll("%", "") + " ";
    });
}

function replaceNoteInBrackets(line, inHtml) {
    return line.replaceAll(/\[([A-G][b#]?)([1-9a-zA-Z/]{0,4})\]/g, (s, note, end) => {
        const tNote = noteTranspose(note).replaceAll(/(ø?)/gu, "");
        if (inHtml) {
            return `<span class="inline-chord">${tNote + end}</span>`;
        } else {
            return tNote + end;
        }
    });
}


function noteTranspose(note, transpose = 0) {

    const capoValue = transpose || parseInt(capoInput.value) || 0;
    const gammeB = ['A', 'Bb', 'B', 'C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab'];
    const gammeD = ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#'];
    let index = gammeB.findIndex((v) => v === note);
    if (index === -1) {
        index = gammeD.findIndex((v) => v === note);
    }

    let gamme = gammeB;
    if (notationInput.value === '#') {
        gamme = gammeD;
    }
    const gLength = gamme.length;
    let tNote = gamme[(index - capoValue + gLength) % gLength];

    if (note.length === 2 && tNote.length === 1) {
        // tNote += "%";
    }
    if (note.length === 1 && tNote.length === 2) {
        // tNote += "ø";
    }

    return tNote;

}

function writeCapo(capoValue) {
    const p = document.createElement('p');
    p.classList.add("capo");

    const sp = document.createElement('span');
    sp.textContent = `capo : ${capoValue}`;
    p.appendChild(sp);
    songRender.appendChild(p);
}

function writeLineChord(line) {
    const p = document.createElement('p');
    p.classList.add("solo-chord");
    if (isTabLine(line)) {
        p.classList.add("solo-tab");

        p.innerHTML = escapeXml(renderChord(line));
    } else {

        p.innerHTML = expSus(escapeXml(renderChord(line)));
    }
    songRender.appendChild(p);
}

function writeLineText(line, isSong) {
    let p = document.createElement('p');
    let isLineSong = false;



    if (line.trim() === "") {
        p = document.createElement('br');
    } else if (line.trim().match(/^---+$/)) {
        p = document.createElement('hr');
    } else if (line.trim().match(/^---(.*)---$/)) {
        const match = line.trim().match(/^[-]+([^-]+)[-]+$/);
        const text = match[1];
        p = document.createElement('p');
        p.textContent = match[1];
        p.classList.add("separator");
    } else {
        if (line.trim().match(/^===+$/)) {
            p = document.createElement('hr');
            p.classList.add("page-break");
        } else {
            if (line.trim().match(/^>/)) {
                p.classList.add("page-footer");
                line = line.trim().substring(1);
            } else {
                isLineSong = true;
            }
            line = line.replaceAll(/ ( +)/g, (reg) => {
                let spaces = '';
                for (let i = 0; i < reg.length; i++) spaces += ' ';
                return spaces;
            });

            let htmlLine = escapeXml(line);

            htmlLine = replaceNoteInBrackets(htmlLine, true);
            p.innerHTML = htmlLine;

        }
    }
    if (isSong && isLineSong) {
        p.classList.add("follow-song");
    } else {
        p.classList.add("solo-text");
    }
    if (isTextLine(line)) {
        p.classList.add("notation-text");
    }
    songRender.appendChild(p);
    return isLineSong && isSong;
}


function escapeXml(unsafe) {
    if (!unsafe) return '<ins>&nbsp;</ins>';
    return unsafe.replaceAll(/[<>&'"]/g, function (c) {
        switch (c) {
            case '<':
                return '&lt;';
            case '>':
                return '&gt;';
            case '&':
                return '&amp;';
            case '\'':
                return '&apos;';
            case '"':
                return '&quot;';
        }
    });
}

function writeMergeChordLine(chordLine, songText) {
    const p = document.createElement('p');
    p.classList.add("song-text");
    p.textContent = chordLine + songText;

    const lineLenght = Math.max(chordLine.length, songText.length);
    let idxChord = 0;
    let songLine = '';
    for (let i = 0; i < lineLenght; i++) {
        if (chordLine[i] && chordLine[i] !== ' ' && idxChord <= i) {
            idxChord = i;
            songLine += '<span class="chord">';
            let chordPart = '';
            while (chordLine[idxChord] && chordLine[idxChord] !== ' ') {
                chordPart += escapeXml(chordLine[idxChord]);
                idxChord++;
            }
            songLine += expSus(renderChord(chordPart));
            songLine += '</span>';
        }
        songLine += escapeXml(songText[i]);

    }

    // Add semi-quadratin spaces to simulate appropriate length of spaces
    songLine = songLine.replaceAll(/ ( +)/g, (reg) => {
        let spaces = '';
        for (let i = 0; i < reg.length; i++) spaces += '&ensp;';
        return spaces;
    });


    songLine = replaceNoteInBrackets(songLine, true);

    p.innerHTML = songLine;


    songRender.appendChild(p);
}



/**
 * Main function to render raw text to printed text
 */
export function renderSong(song) {
    const lines = song.split('\n');

    const capoValue = parseInt(capoInput.value) || 0;
    let previousLineChord = '';
    let previousLineSong = false;
    songRender.textContent = '';
    let capoIsWrote = false;

    updateStyle(textFontSizeInput.value);

    window.document.title = chordNameInput.value.replace(".txt", "");


    lines.forEach((line) => {
        if (isCategoryLine(line)) return;
        if (line.trim().length > 0) {
            if (isTextLine(line)) {
                previousLineChord = "";
            }
            if (isChordLine(line)) {
                line = line.replace("♪", " ");
                if (!capoIsWrote && capoValue) {
                    writeCapo(capoValue);
                    capoIsWrote = true;
                }

                if (previousLineChord) {
                    writeLineChord(previousLineChord);
                }
                if (capoValue || notationInput.value !== "") {
                    line = lineTranspose(line);
                }
                previousLineChord = line;
            } else {
                if (previousLineChord) {
                    writeMergeChordLine(previousLineChord, line);
                    previousLineChord = '';
                    previousLineSong = true;
                } else {

                    previousLineSong = writeLineText(line, previousLineSong);
                }
            }
        } else {
            if (previousLineChord) {
                writeLineChord(previousLineChord);
                previousLineChord = '';
            }
            writeLineText('', previousLineSong);
            previousLineSong = false;
        }
    });
}

function isTabLine(line) {
    if (line.match(/^[A-Ga-g][♭♯b#]?\|-/)) {
        return true;
    }
    return false;
}


function isTextLine(line) {
    if (line.trim().match(/\(.*\)$/)) {
        return true;
    }
    return false;
}

function isChordLine(line) {
    line = line.replaceAll("maj", "Δ");
    line = line.replaceAll("M7", "Δ");
    line = line.replaceAll(/([A-G]).?m/g, "$1");
    line = line.replaceAll(/([A-G])[b#]/g, "$1");
    line = line.replaceAll(/([1-9])[b#]/g, "$1");
    line = line.replaceAll(/sus[1-9]/g, "");
    line = line.replaceAll(/add[1-9]/g, "");
    line = line.replaceAll(/dim/g, "");
    line = line.replaceAll(/aug/g, "");
    line = line.replaceAll(/x[1-9]/g, "");

    if (line.match(/^[A-Ge]\|-/)) {
        return true;
    }
    if (line.match(/♪/)) {
        return true;
    }

    if (line.match(/[a-z]/)) {
        return false;
    }
    if (line.match(/[H-Z]/)) {
        return false;
    }
    if (line.match(/[A-G]/)) {
        return true;
    }
    return false;
}

function isCategoryLine(line) {
    return /^#category\s*:/i.test(line.trim());
}

export function extractGroup(song) {
    const match = song.match(/^#category\s*:\s*(.+)/im);
    return match ? match[1].trim() : "";
}


// ----------------------------
// --------- Update Css -------
// ----------------------------


function updateStyle() {
    const r = document.querySelector(':root');

    const textSize = textFontSizeInput.value;
    const chordSize = parseInt(textSize) + parseInt(chordFontSizeInput.value);
    const chordColor = chordColorInput.value;
    const textColor = textColorInput.value;
    const columnCount = columnInput.value;

    r.style.setProperty('--text-font-size', `${textSize}px`);
    r.style.setProperty('--chord-font-size', `${chordSize}px`);
    r.style.setProperty('--chord-color', `${chordColor}`);
    r.style.setProperty('--text-color', `${textColor}`);
    r.style.setProperty('--column-count', `${columnCount}`);

    if (columnCount > 1) {
        document.getElementById("chord-render").classList.add("column");
    } else {
        document.getElementById("chord-render").classList.remove("column");
    }

}


// --------------------------------------
// --------- First song example -------
// --------------------------------------

const favoriteSong = `Famous song by Me
---------------

[Intro]
C Am C Am
 

[Chorus]
     F        Am             
It's a famous song
 F7       Db 
It's incredible...
   
Here a page/column break
===

[Verse]
     F        Am         Dsus4/G      F#
All my life, I wanted to be an artist 
F7       Db 
It's incredible...

> Page footer for my song
`;


// ---------------------------------
// Init parameters from localStorage
// ---------------------------------

export function updateSongSelector() {

    const readOnlyMode = songStorage.getGlobalInfoFromStorage("readMode") === 1;
    const selectedGroups = getSelectedGroups();

    // Sort by song title
    const recorderSongs = Object.entries(songStorage.getAllSongsStorage()).sort(
        ([, a], [, b]) => a.songchordname?.localeCompare(b.songchordname)
    );

    while (chordSelectInput.options.length > 0) {
        chordSelectInput.remove(0);
    }
    let emptyOption = new Option("-", "");
    emptyOption.classList.add("option-edit");
    emptyOption.classList.add("option-fake");
    chordSelectInput.add(emptyOption)
    for (const [key, value] of recorderSongs) {
        // Apply category filter (but always keep the current song)
        if (selectedGroups !== null && key !== songStorage.currentSongIndex) {
            const songGroup = value.group || "";
            if (!songGroup || !selectedGroups.includes(songGroup)) {
                continue;
            }
        }

        if (key !== songStorage.currentSongIndex) {
            const newOption = new Option(value.songchordname, key);
            chordSelectInput.add(newOption)
        } else {
            const newOption = new Option(value.songchordname, "-");

            if (!readOnlyMode) {
                newOption.disabled = true;
            } else {
                newOption.selected = true;
            }
            chordSelectInput.add(newOption);

        }
    }


    let sepOption = new Option("", "--");
    sepOption.classList.add("option-separator");
    sepOption.classList.add("option-edit");
    sepOption.disabled = true;
    chordSelectInput.add(sepOption)
    let addOption = new Option("New song", "+");
    addOption.classList.add("option-plus");
    addOption.classList.add("option-edit");
    chordSelectInput.add(addOption)

    updateSongListPanel();
}

function updateSongListPanel() {
    const readOnlyMode = songStorage.getGlobalInfoFromStorage("readMode") === 1;

    cachedSongEntries = Object.entries(songStorage.getAllSongsStorage()).sort(
        ([, a], [, b]) => {
            const ga = a.group || "";
            const gb = b.group || "";
            if (ga && !gb) return -1;
            if (!ga && gb) return 1;
            const cmp = ga.localeCompare(gb);
            if (cmp !== 0) return cmp;
            return (a.songchordname || "").localeCompare(b.songchordname || "");
        }
    );

    // Update toggle text
    if (readOnlyMode) {
        const currentName = songStorage.getSongInfoFromStorage("songchordname") || "☰";
        songListToggle.textContent = currentName;
    } else {
        songListToggle.textContent = "☰";
    }

    updateGroupFilterOptions();
    renderSongList(songListSearch.value);
}

function updateGroupFilterOptions() {
    const groups = new Set();
    for (const [, value] of cachedSongEntries) {
        if (value.group) groups.add(value.group);
    }

    const sortedGroups = [...groups].sort((a, b) => a.localeCompare(b));

    songListGroupFilter.innerHTML = "";
    if (sortedGroups.length === 0) return;

    const savedGroups = songStorage.getGlobalInfoFromStorage("selectedGroups");

    const allChip = document.createElement("button");
    allChip.type = "button";
    allChip.classList.add("song-list-group-chip");
    allChip.dataset.value = "";
    allChip.textContent = "All";
    if (!savedGroups) allChip.classList.add("active");
    songListGroupFilter.appendChild(allChip);

    for (const g of sortedGroups) {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.classList.add("song-list-group-chip");
        chip.dataset.value = g;
        chip.textContent = g;
        if (savedGroups && savedGroups.includes(g)) chip.classList.add("active");
        songListGroupFilter.appendChild(chip);
    }
}

function getSelectedGroups() {
    const active = songListGroupFilter.querySelectorAll(".song-list-group-chip.active");
    const values = Array.from(active).map(c => c.dataset.value);
    if (values.includes("") || values.length === 0) return null;
    return values;
}

function renderSongList(filter) {
    songListItems.innerHTML = "";
    const lowerFilter = (filter || "").toLowerCase();
    const currentId = songStorage.currentSongIndex;
    const selectedGroups = getSelectedGroups();

    // Find groups that match the filter (to show all their songs)
    const matchingGroups = new Set();
    if (lowerFilter) {
        for (const [, value] of cachedSongEntries) {
            const group = value.group || "";
            if (group && group.toLowerCase().includes(lowerFilter)) {
                matchingGroups.add(group);
            }
        }
    }

    let lastGroup = null;

    for (const [key, value] of cachedSongEntries) {
        const name = value.songchordname || "";
        const group = value.group || "";

        // Apply category filter
        if (selectedGroups !== null) {
            if (!group || !selectedGroups.includes(group)) {
                continue;
            }
        }

        const nameMatches = !lowerFilter || name.toLowerCase().includes(lowerFilter);
        const groupMatches = matchingGroups.has(group);

        if (lowerFilter && !nameMatches && !groupMatches) {
            continue;
        }

        // Insert group header if group changed
        if (group && group !== lastGroup) {
            const header = document.createElement("li");
            header.classList.add("song-group-header");
            header.textContent = "\uD83D\uDCC1 " + group;
            songListItems.appendChild(header);
        }
        lastGroup = group;

        const li = document.createElement("li");
        li.dataset.songId = key;

        if (group) {
            li.classList.add("song-grouped");
        }

        if (key === currentId) {
            li.classList.add("song-list-current");
        }

        if (lowerFilter) {
            li.innerHTML = highlightMatch(name, lowerFilter);
        } else {
            li.textContent = name;
        }

        songListItems.appendChild(li);
    }
}

function highlightMatch(text, filter) {
    const lowerText = text.toLowerCase();
    const idx = lowerText.indexOf(filter);
    if (idx === -1) return escapeXml(text);

    const before = text.substring(0, idx);
    const match = text.substring(idx, idx + filter.length);
    const after = text.substring(idx + filter.length);
    return escapeXml(before) + '<span class="song-list-match">' + escapeXml(match) + '</span>' + escapeXml(after);
}

function openSongListPanel() {
    songListSearch.value = "";
    renderSongList("");
    songListOverlay.hidden = false;
    songListSearch.focus();
}

export function closeSongListPanel() {
    songListOverlay.hidden = true;
}

export function resetSong() {
    chordArea.value = songStorage.getSongInfoFromStorage("songchord") || favoriteSong;
    capoInput.value = songStorage.getSongInfoFromStorage("capo") || 0;
    notationInput.value = songStorage.getSongInfoFromStorage("notation") || '';
    chordNameInput.value = songStorage.getSongInfoFromStorage("songchordname") || "MySong";

    // Extract group from song text
    const group = extractGroup(chordArea.value);
    songStorage.recordSongInStorage("group", group);

    textFontSizeInput.value = songStorage.getGlobalInfoFromStorage("textfontsize") || 12;
    chordFontSizeInput.value = songStorage.getGlobalInfoFromStorage("chordfontsize") || 0;
    chordColorInput.value = songStorage.getGlobalInfoFromStorage("chordcolor") || '#188B18';
    textColorInput.value = songStorage.getGlobalInfoFromStorage("textcolor") || '#23239F';
    columnInput.value = songStorage.getGlobalInfoFromStorage("column") || 1;
}


/**
 * 0 : Write & Read
 * 1 : Read Only
 * 2 : Write Only
 * @param {0,1,2} readMode 
 */
function viewMode(readMode) {

    switch (readMode) {
        case 1:
            readonlyButton.classList.remove("active-write");
            readonlyButton.classList.add("active-read");
            document.body.classList.remove("read-write");
            document.body.classList.remove("write-only");
            document.body.classList.add("read-only");
            break;
        case 2: // write only
            readonlyButton.classList.remove("active-read");
            readonlyButton.classList.add("active-write");
            document.body.classList.remove("read-write");
            document.body.classList.remove("read-only");
            document.body.classList.add("write-only");
            break;
        default: // read write
            readonlyButton.classList.remove("active-read");
            readonlyButton.classList.remove("active-write");
            document.body.classList.add("read-write");
            document.body.classList.remove("read-only");
            document.body.classList.remove("write-only");
    }

}

updateSongSelector();
resetSong();
viewMode(songStorage.getGlobalInfoFromStorage("readMode") || 0);


// -------------------
// Event Listeners
// -------------------

printButton.addEventListener("click", function () {
    window.print();

});
saveButton.addEventListener("click", function () {
    // saveSong();
});


readonlyButton.addEventListener("click", function () {
    const readMode = songStorage.getGlobalInfoFromStorage("readMode") || 0;
    const newReadMode = (readMode + 1) % 3;
    songStorage.setGlobalInfoIntoStorage("readMode", newReadMode);
    viewMode(newReadMode);

    updateSongSelector();

});

chordNameInput.addEventListener("change", function () {
    const v = this.value.trim();
    songStorage.recordSongInStorage("songchordname", v);

});
chordArea.addEventListener("input", function () {
    const v = this.value.replaceAll("\t", "        ");
    songStorage.recordSongInStorage("songchord", v);
    const group = extractGroup(v);
    songStorage.recordSongInStorage("group", group);
    renderSong(v);
    updateSongSelector();
});

capoInput.addEventListener("change", function () {

    let numberValue;
    if (this.value) {
        numberValue = parseInt(this.value);
    } else {
        numberValue = 0;
    }
    songStorage.recordSongInStorage("capo", numberValue);

    if (numberValue !== 0) {
        if (notationInput.value === "") {
            notationInput.value = "b";
        }
        notationInput.options[0].disabled = true;
    } else {
        notationInput.options[0].disabled = false;
    }

    renderSong(chordArea.value);


});
textFontSizeInput.addEventListener("change", function () {
    songStorage.setGlobalInfoIntoStorage("textfontsize", this.value);
    renderSong(chordArea.value);
});
chordFontSizeInput.addEventListener("change", function () {
    songStorage.setGlobalInfoIntoStorage("chordfontsize", this.value);
    renderSong(chordArea.value);
});
chordColorInput.addEventListener("input", function () {
    songStorage.setGlobalInfoIntoStorage("chordcolor", this.value);
    updateStyle();
});
textColorInput.addEventListener("input", function () {
    songStorage.setGlobalInfoIntoStorage("textcolor", this.value);
    updateStyle();
});
columnInput.addEventListener("change", function () {
    songStorage.setGlobalInfoIntoStorage("column", this.value);
    updateStyle();
});
notationInput.addEventListener("change", function () {
    songStorage.recordSongInStorage("notation", this.value);
    renderSong(chordArea.value);
});


chordSelectInput.addEventListener("change", function () {
    if (this.value === "+") {
        songStorage.currentSongIndex = null;
        chordNameInput.value = ""
        chordArea.value = "";


        songStorage.recordSongInStorage("songchordname", chordNameInput.value);
        songStorage.recordSongInStorage("songchord", chordArea.value);
        chordNameInput.focus();
        updateSongSelector();
    } else {
        songStorage.currentSongIndex = this.value;

        resetSong();
        updateSongSelector();
    }
    renderSong(chordArea.value);
});

// Song list panel events
songListToggle.addEventListener("click", openSongListPanel);

songListClose.addEventListener("click", closeSongListPanel);

songListOverlay.addEventListener("click", function (e) {
    if (e.target === songListOverlay) {
        closeSongListPanel();
    }
});

songListSearch.addEventListener("input", function () {
    renderSongList(this.value);
});

songListGroupFilter.addEventListener("click", function (e) {
    const chip = e.target.closest(".song-list-group-chip");
    if (!chip) return;

    if (chip.dataset.value === "") {
        // "Tout" chip: deselect others, activate this one
        songListGroupFilter.querySelectorAll(".song-list-group-chip").forEach(c => c.classList.remove("active"));
        chip.classList.add("active");
    } else {
        // Category chip: toggle it, deselect "Tout"
        const allChip = songListGroupFilter.querySelector('[data-value=""]');
        if (allChip) allChip.classList.remove("active");
        chip.classList.toggle("active");
        // If nothing selected, re-activate "Tout"
        if (!songListGroupFilter.querySelector(".song-list-group-chip.active")) {
            if (allChip) allChip.classList.add("active");
        }
    }

    songStorage.setGlobalInfoIntoStorage("selectedGroups", getSelectedGroups());
    updateSongSelector();
});

songListItems.addEventListener("click", function (e) {
    const li = e.target.closest("li");
    if (!li || !li.dataset.songId) return;

    songStorage.currentSongIndex = li.dataset.songId;
    resetSong();
    updateSongSelector();
    renderSong(chordArea.value);
    closeSongListPanel();
});

songListNew.addEventListener("click", function () {
    songStorage.currentSongIndex = null;
    chordNameInput.value = "";
    chordArea.value = "";

    songStorage.recordSongInStorage("songchordname", chordNameInput.value);
    songStorage.recordSongInStorage("songchord", chordArea.value);
    chordNameInput.focus();
    updateSongSelector();
    renderSong(chordArea.value);
    closeSongListPanel();
});

const scrollContainer = document.querySelector(".song-render");
scrollContainer.addEventListener("wheel", (evt) => {
    if (songStorage.getGlobalInfoFromStorage("readMode") === 1 && songStorage.getGlobalInfoFromStorage("column") > 1) {
        evt.preventDefault();
        scrollContainer.scrollLeft += evt.deltaY;
    }
});

// Pinch-to-zoom font size on touch devices
let pinchStartDist = 0;
let pinchStartFontSize = 0;

function getTouchDistance(t1, t2) {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.hypot(dx, dy);
}

scrollContainer.addEventListener("touchstart", (e) => {
    if (e.touches.length === 2) {
        e.preventDefault();
        pinchStartDist = getTouchDistance(e.touches[0], e.touches[1]);
        pinchStartFontSize = parseInt(textFontSizeInput.value) || 12;
    }
}, { passive: false });

scrollContainer.addEventListener("touchmove", (e) => {
    if (e.touches.length === 2) {
        e.preventDefault();
        const currentDist = getTouchDistance(e.touches[0], e.touches[1]);
        const ratio = currentDist / pinchStartDist;
        const newSize = Math.round(Math.min(60, Math.max(6, pinchStartFontSize * ratio)));
        textFontSizeInput.value = newSize;
        updateStyle();
    }
}, { passive: false });

scrollContainer.addEventListener("touchend", (e) => {
    if (e.touches.length < 2 && pinchStartDist > 0) {
        pinchStartDist = 0;
        songStorage.setGlobalInfoIntoStorage("textfontsize", textFontSizeInput.value);
        renderSong(chordArea.value);
    }
});


document.addEventListener('keydown', e => {
    if (e.ctrlKey && e.key === 's') {
        // Prevent the Save dialog to open
        e.preventDefault();
        saveSong();
    }
    if (e.key === 'Escape' && !songListOverlay.hidden) {
        closeSongListPanel();
    }
});

deleteButton.addEventListener('click', () => {
    if (window.confirm(`Confirm delete ${chordNameInput.value} ?`)) {
        songStorage.deleteCurrentSong();

        updateSongSelector();
        resetSong();
    }
});

transposePlusButton.addEventListener('click', () => {
    transposeSong(1);
});
transposeMinusButton.addEventListener('click', () => {
    transposeSong(-1);
});
// Settings dropdown
const settingsToggle = document.getElementById("settings-toggle");
const settingsDropdown = document.getElementById("settings-dropdown");

settingsToggle.addEventListener("click", () => {
    settingsDropdown.hidden = !settingsDropdown.hidden;
});

document.addEventListener("click", (e) => {
    if (!settingsDropdown.hidden && !e.target.closest(".toolbar-settings")) {
        settingsDropdown.hidden = true;
    }
});

// ============================
//=========== MAIN ============
renderSong(chordArea.value);