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

class SongStorage {
    constructor(songKey, globalKey, currentKey) {
        this.storageDataSongKey = songKey;
        this.storageDataGlobalKey = globalKey;
        this.storageCurrentIndexKey = currentKey;

    }

    get currentSongIndex() {
        return window.localStorage.getItem(this.storageCurrentIndexKey);
    }

    set currentSongIndex(v) {
        return window.localStorage.setItem(this.storageCurrentIndexKey, v);
    }

    // -----------------------------------------------------------------
    // ----------------------------- storage management  ------------
    // -----------------------------------------------------------------

    recordSongInStorage(key, v, index = null) {
        const songData = this.getAllSongsStorage();
        let songIndex = index;

        if (index === null && !this.currentSongIndex) {
            this.currentSongIndex = this.getNewSongIndex();
            window.localStorage.setItem(this.storageCurrentIndexKey, this.currentSongIndex);
        }

        if (songIndex === null) songIndex = this.currentSongIndex;

        if (!songData[songIndex]) {
            songData[songIndex] = {};
        }
        songData[songIndex][key] = v;

        window.localStorage.setItem(this.storageDataSongKey, JSON.stringify(songData));

    }

    getNewSongIndex() {
        return Math.random().toString(32).slice(2);
    }

    getSongIndexFromName(name) {
        const songs = Object.entries(this.getAllSongsStorage());

        for (const [key, song] of songs) {
            if (song.songchordname === name) {
                return key;
            }
        }
        return null;
    }

    getSongInfoFromStorage(key) {
        const songData = this.getAllSongsStorage();

        if (!this.currentSongIndex || !songData[this.currentSongIndex]) {
            return undefined;
        }

        return songData[this.currentSongIndex][key];
    }


    getGlobalInfoFromStorage(key) {
        const globData = this.getAllGlobalStorage();
        return globData[key];
    }

    setGlobalInfoIntoStorage(key, value) {
        const globData = this.getAllGlobalStorage();
        globData[key] = value;

        window.localStorage.setItem(this.storageDataGlobalKey, JSON.stringify(globData));
    }


    deleteCurrentSong() {

        const songData = this.getAllSongsStorage();
        if (this.currentSongIndex) {

            if (songData[this.currentSongIndex]) {
                delete songData[this.currentSongIndex];

            }

            const keys = Object.keys(songData);

            if (keys.length > 0) {
                this.currentSongIndex = keys[0];
            }

            window.localStorage.setItem(this.storageDataSongKey, JSON.stringify(songData));

        }
    }


    getAllGlobalStorage() {

        return JSON.parse(window.localStorage.getItem(this.storageDataGlobalKey) || "{}");
    }

    /**
     *
     * @returns {Object.<string,SongObject>}
     */
    getAllSongsStorage() {
        return JSON.parse(window.localStorage.getItem(this.storageDataSongKey) || "{}");
    }

}

const songStorage = new SongStorage("songs", "global", "currentSongIndex");


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

function renderChord(line) {

    let chord = line.replaceAll(/([A-G)])([b#])/ig, (s, p1, p2) => {
        return p1 + p2.replace("b", "♭").replaceAll("#", "♯")
    });

    chord = chord.replaceAll("maj7", "Δ");
    chord = chord.replaceAll("M7", "Δ");
    chord = chord.replaceAll("sus", "/");
    chord = chord.replaceAll(/x([1-9]+)/g, "×$1");


    return chord;
}

function expSus(line) {
    let expLine = line.replaceAll(/((sus|\/|add)[0-9]+)/g, (s) => {
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

function lineTranspose(line) {
    const capoValue = parseInt(capoInput.value) || 0;
    let rawLine = line.replaceAll("♭", "b").replaceAll("♯", "#");
    let Elowercase = false;
    if (isTabLine(line)) {
        if (rawLine.match(/^e/)) {
            rawLine = rawLine.replace(/^e/, "E");
            Elowercase = true;
        }
        rawLine = rawLine.replaceAll(/([\-s])([0-9]+)/gu, function (s, p1, p2) {
            return p1 + (parseInt(p2) - capoValue).toString();
        });
    }

    rawLine = rawLine.replaceAll(/([A-G][b#]?)/g, function (s) {
        return noteTranspose(s, capoValue);
    });
    if (Elowercase) {
        rawLine = rawLine.replace(/^[A-G]/, (s) => {
            return s.toLowerCase();
        });
    }
    rawLine = rawLine.replaceAll(/(~ ?)/gu, function () {
        return "";
    });

    return rawLine.replaceAll(/([^ ]+%[^ ]*)/gu, function (s) {
        return s.replace("%", "") + " ";
    });
}

function noteTranspose(note, capoValue) {
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
        tNote += "%";
    }
    if (note.length === 1 && tNote.length === 2) {
        tNote += "~";
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
    if (isTabLine(line)) p.classList.add("solo-tab");
    p.innerHTML = expSus(escapeXml(renderChord(line)));
    songRender.appendChild(p);
}

function writeLineText(line, isSong) {
    let p = document.createElement('p');
    let isLineSong = false;


    if (line.trim() === "") {
        p = document.createElement('br');
    } else if (line.trim().match(/^---+$/)) {
        p = document.createElement('hr');
    } else {
        if (line.trim().match(/^===+$/)) {
            p = document.createElement('hr');
            p.classList.add("page-break");
        } else {
            if (line.trim().match(/^>/)) {
                p.classList.add("page-footer");
            } else {
                isLineSong = true;
            }
            p.textContent = line;

        }
    }
    if (isSong && isLineSong) {
        p.classList.add("follow-song");
    } else {
        p.classList.add("solo-text");
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
            songLine += '<span>';
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

    p.innerHTML = songLine;


    songRender.appendChild(p);
}

/**
 * Main function to render raw text to printed text
 */
function renderSong(song) {
    const lines = song.split('\n');
    let previousLineChord = '';
    let previousLineSong = false;
    songRender.textContent = '';
    let capoIsWrote = false;

    updateStyle(textFontSizeInput.value);

    window.document.title = chordNameInput.value.replace(".txt", "");


    lines.forEach((line) => {
        if (line.trim().length > 0) {
            if (isChordLine(line)) {
                if (!capoIsWrote && capoInput.value > 0) {
                    writeCapo(capoInput.value);
                    capoIsWrote = true;
                }

                if (previousLineChord) {
                    writeLineChord(previousLineChord);
                }
                if (capoInput.value > 0 || notationInput.value !== "") {
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

function isChordLine(line) {
    line = line.replaceAll("maj7", "Δ");
    line = line.replaceAll("M7", "Δ");
    line = line.replaceAll(/([A-G]).?m/g, "$1");
    line = line.replaceAll(/([A-G])b/g, "$1");
    line = line.replaceAll(/sus[1-9]/g, "");
    line = line.replaceAll(/add[1-9]/g, "");
    line = line.replaceAll(/x[1-9]/g, "");

    if (line.match(/^[A-Ge]\|-/)) {
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

function updateSongSelector() {

    const readOnlyMode = songStorage.getGlobalInfoFromStorage("readMode");

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

}

function resetSong() {
    chordArea.value = songStorage.getSongInfoFromStorage("songchord") || favoriteSong;
    capoInput.value = songStorage.getSongInfoFromStorage("capo") || null;
    notationInput.value = songStorage.getSongInfoFromStorage("notation") || '';
    chordNameInput.value = songStorage.getSongInfoFromStorage("songchordname") || "MySong";

    textFontSizeInput.value = songStorage.getGlobalInfoFromStorage("textfontsize") || 12;
    chordFontSizeInput.value = songStorage.getGlobalInfoFromStorage("chordfontsize") || 0;
    chordColorInput.value = songStorage.getGlobalInfoFromStorage("chordcolor") || '#188B18';
    textColorInput.value = songStorage.getGlobalInfoFromStorage("textcolor") || '#23239F';
    columnInput.value = songStorage.getGlobalInfoFromStorage("column") || 1;
}

function viewMode(readMode) {
    if (readMode) {
        readonlyButton.classList.add("active");
        document.body.classList.add("read-only");

    } else {
        readonlyButton.classList.remove("active");
        document.body.classList.remove("read-only");
    }
}

updateSongSelector();
resetSong();
viewMode(songStorage.getGlobalInfoFromStorage("readMode") || false);


// -------------------
// Event Listeners
// -------------------

printButton.addEventListener("click", function () {
    window.print();

});
saveButton.addEventListener("click", function () {
    saveSong();
});


readonlyButton.addEventListener("click", function () {
    if (songStorage.getGlobalInfoFromStorage("readMode")) {
        songStorage.setGlobalInfoIntoStorage("readMode", false);
        viewMode(false);
    } else {
        songStorage.setGlobalInfoIntoStorage("readMode", true);
        viewMode(true);
    }
    updateSongSelector();

});

chordNameInput.addEventListener("change", function () {
    const v = this.value.trim();
    songStorage.recordSongInStorage("songchordname", v);

});
chordArea.addEventListener("input", function () {
    const v = this.value.replaceAll("\t", "        ");
    songStorage.recordSongInStorage("songchord", v);
    renderSong(v);

});

capoInput.addEventListener("change", function () {

    songStorage.recordSongInStorage("capo", this.value);

    if (this.value > 0) {
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


document.addEventListener('keydown', e => {
    if (e.ctrlKey && e.key === 's') {
        // Prevent the Save dialog to open
        e.preventDefault();
        saveSong();
    }
});

deleteButton.addEventListener('click', () => {
    if (window.confirm(`Confirm delete ${chordNameInput.value} ?`)) {
        songStorage.deleteCurrentSong();

        updateSongSelector();
        resetSong();
    }
});


// ============================
//=========== MAIN ============
renderSong(chordArea.value);