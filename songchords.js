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

function lineTranspose(line) {
    let rawLine = line.replaceAll("♭", "b").replaceAll("♯", "#");
    let Elowercase = false;
    if (isTabLine(line)) {
        // No transpose tabLine
        return rawLine;
    }

    rawLine = rawLine.replaceAll(/([A-G][b#]?)/g, function (s) {
        return noteTranspose(s);
    });
    if (Elowercase) {
        rawLine = rawLine.replace(/^[A-G]/, (s) => {
            return s.toLowerCase();
        });
    }
    rawLine = rawLine.replaceAll(/(ø ?)/gu, function () {
        return "";
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


function noteTranspose(note) {

    const capoValue = parseInt(capoInput.value) || 0;
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
        tNote += "ø";
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
            if (isTextLine(line)) {
                previousLineChord = "";
            }
            if (isChordLine(line)) {
                line = line.replace("♪", " ");
                if (!capoIsWrote && capoInput.value !== 0) {
                    writeCapo(capoInput.value);
                    capoIsWrote = true;
                }

                if (previousLineChord) {
                    writeLineChord(previousLineChord);
                }
                if (capoInput.value !== 0 || notationInput.value !== "") {
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
    capoInput.value = songStorage.getSongInfoFromStorage("capo") || 0;
    notationInput.value = songStorage.getSongInfoFromStorage("notation") || '';
    chordNameInput.value = songStorage.getSongInfoFromStorage("songchordname") || "MySong";

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
            document.body.classList.remove("write-only");
            document.body.classList.add("read-only");


            break;
        case 2:
            readonlyButton.classList.remove("active-read");
            readonlyButton.classList.add("active-write");
            document.body.classList.remove("read-only");
            document.body.classList.add("write-only");
            break;
        default:
            readonlyButton.classList.remove("active-read");
            readonlyButton.classList.remove("active-write");
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
    renderSong(v);

});

capoInput.addEventListener("change", function () {

    songStorage.recordSongInStorage("capo", this.value);

    if (this.value !== 0) {
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

const scrollContainer = document.querySelector(".song-render");
scrollContainer.addEventListener("wheel", (evt) => {
    if (songStorage.getGlobalInfoFromStorage("readMode") === 1 && songStorage.getGlobalInfoFromStorage("column") > 1) {
        evt.preventDefault();
        scrollContainer.scrollLeft += evt.deltaY;
    }
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