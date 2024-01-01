const chordArea = document.getElementById("chord-area");
const songRender = document.getElementById("chord-render");
const capoInput = document.getElementById("capo");
const textFontSizeInput = document.getElementById("textfontsize");
const chordFontSizeInput = document.getElementById("chordfontsize");
const chordColorInput = document.getElementById("chordcolor");
const textColorInput = document.getElementById("textcolor");
const columnInput = document.getElementById("columncount");
const notationInput = document.getElementById("notation");
const printButton = document.getElementById("print");
const readonlyButton = document.getElementById("readonly");
const saveButton = document.getElementById("save");
const deleteButton = document.getElementById("delete");
const chordNameInput = document.getElementById("chord-name");
const chordSelectInput = document.getElementById("chord-select");

if (!chordArea) {
    console.error("No textarea");
}
if (!songRender) {
    console.error("No songRender");
}

const storageDataSongKey = "songs";
const storageDataGlobalKey = "global";
const storageCurrentIndexKey = "currentSongIndex";
let currentSongIndex = window.localStorage.getItem(storageCurrentIndexKey);

function downloadFileText(filename, text) {
    var element = document.createElement('a');
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


    console.log(files);

    files.forEach((file, idx) => {

        if (file.type !== "text/plain") {
            alert("Only text file can be dropped here");
            chordArea.classList.remove("dragover");
            return;
        }

        // Create new song
        const songIndex = getNewSongIndex();
        recordSongInStorage("songchordname", file.name, songIndex);

        const iEvent = new InputEvent("change");
        // chordNameInput.dispatchEvent(iEvent);
        // chordArea.dispatchEvent(iEvent);

        const reader = new FileReader();
        reader.onload = function (e) {

            chordArea.classList.remove("dragover");
            const iEvent = new InputEvent("input");

            recordSongInStorage("songchord", e.target.result, songIndex);
            if (idx === files.length - 1) {
                // Display last uploaded song
                currentSongIndex = songIndex;
                resetSong();
                updateSongSelector();
            }
        };
        reader.readAsText(file, "UTF-8");
    });



};

//-----------------------------------------
// ----------- Chord song rendermanagement -----
//-----------------------------------------

function renderChord(line) {

    let chord = line.replaceAll("b", "♭").replaceAll("#", "♯");

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
    expLine = expLine.replaceAll(/(♭|♯)/g, (s) => {
        return `<sup class="notation">${s}</sup>`;
    });
    return expLine;
}

function lineTranspose(line) {
    const capoValue = parseInt(capoInput.value) || 0;
    const rawLine = line.replaceAll("♭", "b").replaceAll("♯", "#");
    const tChords = rawLine.replaceAll(/([A-G][b#]?)/g, function (s) {
        return noteTranspose(s, capoValue);
    });
    const tChordsBB = tChords.replaceAll(/(~ ?)/gu, function (s) {
        return "";
    });
    const tChordsCC = tChordsBB.replaceAll(/([^ ]+%[^ ]*)/gu, function (s) {
        return s.replace("%", "") + " ";
    })
    return tChordsCC;
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
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
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
    songLine = songLine.replaceAll(/ ([ ]+)/g, (reg) => {
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


    lines.forEach((line, idx) => {
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

function isChordLine(line) {
    line = line.replaceAll("maj7", "Δ");
    line = line.replaceAll("M7", "Δ");
    line = line.replaceAll(/([A-G]).?m/g, "$1");
    line = line.replaceAll(/([A-G])b/g, "$1");
    line = line.replaceAll(/sus[1-9]/g, "");
    line = line.replaceAll(/add[1-9]/g, "");
    line = line.replaceAll(/x[1-9]/g, "");

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

// -----------------------------------------------------------------
// ----------------------------- storage management  ------------
// -----------------------------------------------------------------

function recordSongInStorage(key, v, index = null) {
    const songData = getAllSongsStorage();
    let songIndex = index;

    if (index === null && !currentSongIndex) {
        currentSongIndex = getNewSongIndex();
        window.localStorage.setItem(storageCurrentIndexKey, currentSongIndex);
    }

    if (songIndex === null) songIndex = currentSongIndex;

    if (!songData[songIndex]) {
        songData[songIndex] = {};
    }
    songData[songIndex][key] = v;

    window.localStorage.setItem(storageDataSongKey, JSON.stringify(songData));

}

function getNewSongIndex() {
    return Math.random().toString(32).slice(2);
}

function getSongInfoFromStorage(key) {
    const songData = getAllSongsStorage();

    if (!currentSongIndex || !songData[currentSongIndex]) {
        return undefined;
    }

    return songData[currentSongIndex][key];
}



function getGlobalInfoFromStorage(key) {
    const globData = getAllGlobalStorage();
    return globData[key];
}
function setGlobalInfoIntoStorage(key, value) {
    const globData = getAllGlobalStorage();
    globData[key] = value;

    window.localStorage.setItem(storageDataGlobalKey, JSON.stringify(globData));
}


function deleteCurrentSong() {

    const songData = getAllSongsStorage();
    if (currentSongIndex) {

        if (songData[currentSongIndex]) {
            delete songData[currentSongIndex];

        }

        const keys = Object.keys(songData);

        if (keys.length > 0) {
            currentSongIndex = keys[0];
        }

        window.localStorage.setItem(storageDataSongKey, JSON.stringify(songData));

    }
}



function getAllGlobalStorage() {

    const globalData = JSON.parse(window.localStorage.getItem(storageDataGlobalKey) || "{}");
    return globalData;
}

function getAllSongsStorage() {

    const songData = JSON.parse(window.localStorage.getItem(storageDataSongKey) || "{}");
    return songData;
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

    const readOnlyMode = getGlobalInfoFromStorage("readMode");

    // Sort by song title
    const recorderSongs = Object.entries(getAllSongsStorage()).sort(
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
        if (key !== currentSongIndex) {
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
    chordArea.value = getSongInfoFromStorage("songchord") || favoriteSong;
    capoInput.value = getSongInfoFromStorage("capo") || null;
    notationInput.value = getSongInfoFromStorage("notation") || '';
    chordNameInput.value = getSongInfoFromStorage("songchordname") || "MySong";

    textFontSizeInput.value = getGlobalInfoFromStorage("textfontsize") || 12;
    chordFontSizeInput.value = getGlobalInfoFromStorage("chordfontsize") || 0;
    chordColorInput.value = getGlobalInfoFromStorage("chordcolor") || '#188B18';
    textColorInput.value = getGlobalInfoFromStorage("textcolor") || '#23239F';
    columnInput.value = getGlobalInfoFromStorage("column") || 1;
}

function viewMode(readMode) {
    const main = document.querySelector("main");
    if (readMode) {
        readonlyButton.classList.add("active");
        main.classList.add("read-only");

    } else {
        readonlyButton.classList.remove("active");
        main.classList.remove("read-only");
    }
}

updateSongSelector();
resetSong();
viewMode(getGlobalInfoFromStorage("readMode") || false);


// -------------------
// Event Listeners
// -------------------

printButton.addEventListener("click", function (ev) {
    window.print();

});
saveButton.addEventListener("click", function (ev) {
    saveSong();
});


readonlyButton.addEventListener("click", function (ev) {
    if (getGlobalInfoFromStorage("readMode")) {
        setGlobalInfoIntoStorage("readMode", false);
        viewMode(false);
    } else {
        setGlobalInfoIntoStorage("readMode", true);
        viewMode(true);


    }
    updateSongSelector();

});

chordNameInput.addEventListener("change", function (ev) {
    const v = this.value.trim();
    recordSongInStorage("songchordname", v);

});
chordArea.addEventListener("input", function (ev) {
    const v = this.value.replaceAll("\t", "        ");
    recordSongInStorage("songchord", v);
    renderSong(v);

});

capoInput.addEventListener("change", function (ev) {

    recordSongInStorage("capo", this.value);

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
textFontSizeInput.addEventListener("change", function (ev) {
    setGlobalInfoIntoStorage("textfontsize", this.value);
    renderSong(chordArea.value);
});
chordFontSizeInput.addEventListener("change", function (ev) {
    setGlobalInfoIntoStorage("chordfontsize", this.value);
    renderSong(chordArea.value);
});
chordColorInput.addEventListener("input", function (ev) {
    setGlobalInfoIntoStorage("chordcolor", this.value);
    updateStyle();
});
textColorInput.addEventListener("input", function (ev) {
    setGlobalInfoIntoStorage("textcolor", this.value);
    updateStyle();
});
columnInput.addEventListener("change", function (ev) {
    setGlobalInfoIntoStorage("column", this.value);
    updateStyle();
});
notationInput.addEventListener("change", function (ev) {
    recordSongInStorage("notation", this.value);
    renderSong(chordArea.value);
});


chordSelectInput.addEventListener("change", function (ev) {
    if (this.value === "+") {
        currentSongIndex = null;
        chordNameInput.value = ""
        chordArea.value = "";


        recordSongInStorage("songchordname", chordNameInput.value);
        recordSongInStorage("songchord", chordArea.value);
        chordNameInput.focus();
        updateSongSelector();
    } else {
        currentSongIndex = this.value;

        window.localStorage.setItem(storageCurrentIndexKey, currentSongIndex);
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

deleteButton.addEventListener('click', e => {
    if (window.confirm(`Confirm delete ${chordNameInput.value} ?`)) {
        deleteCurrentSong();

        updateSongSelector();
        resetSong();
    }
});


// ============================
//=========== MAIN ============
renderSong(chordArea.value);