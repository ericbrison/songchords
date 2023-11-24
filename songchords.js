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
const saveButton = document.getElementById("save");
const chordNameInput = document.getElementById("chord-name");
const chordSelectInput = document.getElementById("chord-select");

if (!chordArea) {
    console.error("No textarea");
}
if (!songRender) {
    console.error("No songRender");
}

const storageDataKey = "songs";
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
    const file = e.dataTransfer.files[0];

    console.log("DROP", file);

    if (file.type !== "text/plain") {
        alert("Only text file can be dropped here");
        chordArea.classList.remove("dragover");
        return;
    }

    // Create new song
    currentSongIndex = null;
    chordNameInput.value = file.name;

    const iEvent = new InputEvent("change");
    chordNameInput.dispatchEvent(iEvent);

    chordArea.dispatchEvent(iEvent);

    const reader = new FileReader();
    reader.onload = function (e) {

        console.log("LAOD", e.target.result);
        chordArea.value = e.target.result;

        chordArea.classList.remove("dragover");
        const iEvent = new InputEvent("input");

        chordArea.dispatchEvent(iEvent);

        updateSongSelector();
    };
    reader.readAsText(file, "UTF-8");
};

//-----------------------------------------
// ----------- Chord song rendermanagement -----
//-----------------------------------------

function renderChord(line) {

    const chord = line.replaceAll("b", "♭").replaceAll("#", "♯");



    return chord;
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
    p.textContent = `capo : ${capoValue}`;
    songRender.appendChild(p);
}
function writeLineChord(line) {
    const p = document.createElement('p');
    p.classList.add("solo-chord");
    p.textContent = renderChord(line);
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
            while (chordLine[idxChord] && chordLine[idxChord] !== ' ') {
                songLine += escapeXml(renderChord(chordLine[idxChord]));
                idxChord++;
            }

            songLine += '</span>';
        }
        songLine += escapeXml(songText[i]);

    }

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
    if (line.match(/[ac-ln-rtv-wy-z]/)) {
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

function recordStorage(key, v) {
    const songData = this.getAllStorage();


    console.log("store", currentSongIndex, key, v);
    if (!currentSongIndex) {
        currentSongIndex = Math.random().toString(32).slice(2);
        window.localStorage.setItem(storageCurrentIndexKey, currentSongIndex);
    }

    if (!songData[currentSongIndex]) {
        songData[currentSongIndex] = {};
    }
    songData[currentSongIndex][key] = v;

    window.localStorage.setItem(storageDataKey, JSON.stringify(songData));

}

function getStorage(key) {

    const songData = this.getAllStorage();



    if (!currentSongIndex || !songData[currentSongIndex]) {
        return undefined;
    }


    return songData[currentSongIndex][key];
}

function getAllStorage() {

    const songData = JSON.parse(window.localStorage.getItem(storageDataKey) || "{}");
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




    while (chordSelectInput.options.length > 0) {
        chordSelectInput.remove(0);
    }
    let emptyOption = new Option("-", "");
    chordSelectInput.add(emptyOption)
    for (const [key, value] of Object.entries(getAllStorage())) {
        if (key !== currentSongIndex) {
            const newOption = new Option(value.songchordname, key);
            chordSelectInput.add(newOption)
        } else {
            const newOption = new Option(value.songchordname, "-");

            newOption.disabled = true;
            chordSelectInput.add(newOption);

        }
    }


    let sepOption = new Option("", "--");
    sepOption.classList.add("option-separator");
    sepOption.disabled = true;
    chordSelectInput.add(sepOption)
    let addOption = new Option("New song", "+");
    addOption.classList.add("option-plus");
    chordSelectInput.add(addOption)
}
function resetSong() {
    chordArea.value = getStorage("songchord") || favoriteSong;
    capoInput.value = getStorage("capo") || null;
    textFontSizeInput.value = getStorage("textfontsize") || 12;
    chordFontSizeInput.value = getStorage("chordfontsize") || 0;
    chordColorInput.value = getStorage("chordcolor") || '#188B18';
    textColorInput.value = getStorage("textcolor") || '#23239F';
    columnInput.value = getStorage("column") || 1;
    notationInput.value = getStorage("notation") || '';
    chordNameInput.value = getStorage("songchordname") || "MySong";
}

updateSongSelector();
resetSong();


// -------------------
// Event Listeners
// -------------------

printButton.addEventListener("click", function (ev) {
    window.print();

});
saveButton.addEventListener("click", function (ev) {
    saveSong();
});



chordNameInput.addEventListener("change", function (ev) {
    const v = this.value.trim();
    recordStorage("songchordname", v);

});
chordArea.addEventListener("input", function (ev) {
    const v = this.value.replaceAll("\t", "        ");
    recordStorage("songchord", v);
    renderSong(v);

});

capoInput.addEventListener("change", function (ev) {

    recordStorage("capo", this.value);

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
    recordStorage("textfontsize", this.value);
    renderSong(chordArea.value);
});
chordFontSizeInput.addEventListener("change", function (ev) {
    recordStorage("chordfontsize", this.value);
    renderSong(chordArea.value);
});
chordColorInput.addEventListener("input", function (ev) {
    recordStorage("chordcolor", this.value);
    updateStyle();
});
textColorInput.addEventListener("input", function (ev) {
    recordStorage("textcolor", this.value);
    updateStyle();
});
columnInput.addEventListener("change", function (ev) {
    recordStorage("column", this.value);
    updateStyle();
});
notationInput.addEventListener("change", function (ev) {
    recordStorage("notation", this.value);
    renderSong(chordArea.value);
});


chordSelectInput.addEventListener("change", function (ev) {
    if (this.value === "+") {
        currentSongIndex = null;
        chordNameInput.value = `New Song ${this.options.length}`
        chordArea.value = "New Song";


        recordStorage("songchordname", chordNameInput.value);
        recordStorage("songchord", chordArea.value);
        updateSongSelector();
    } else {
        currentSongIndex = this.value;
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


// ============================
//=========== MAIN ============
renderSong(chordArea.value);