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

if (!chordArea) {
    console.error("No textarea");
}
if (!songRender) {
    console.error("No songRender");
}

function renderChord(line) {

    const chord = line.replace("b", "♭").replace("#", "♯");



    return chord;
}

function lineTranspose(line) {
    const capoValue = parseInt(capoInput.value);
    const rawLine = line.replaceAll("♭", "b").replace("♯", "#");
    console.log("RAW", rawLine);
    const tChords = rawLine.replaceAll(/([A-G][b#]?)/g, function (s) {
        return noteTranspose(s, capoValue);
    });
    const tChordsBB = tChords.replaceAll(/([A-G]bb)/gu, function (s) {
        console.log("XX", s, noteTranspose(s[0], 2));
        return noteTranspose(s[0], -2);
    });
    console.log("lineT", rawLine, tChords, tChordsBB);
    return tChordsBB;
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
    const tNote = gamme[(index - capoValue + gLength) % gLength];
    console.log("transpose", note, tNote)

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
function writeLineText(line) {
    let p = document.createElement('p');

    if (line.trim().match(/^---+$/)) {
        p = document.createElement('hr');
    } else {
        if (line.trim().match(/^===+$/)) {
            p = document.createElement('hr');
            p.classList.add("page-break");
        } else {
            if (line.trim().match(/^>/)) {
                p.classList.add("page-footer");
            }
            p.textContent = line;

        }


    }
    p.classList.add("solo-text");
    songRender.appendChild(p);
}



function escapeXml(unsafe) {
    if (!unsafe) return '<ins>&nbsp;</ins>';
    return unsafe.replace(/[<>&'"]/g, function (c) {
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
        //console.log("song", i, chordLine[i], songText[i]);
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
    songRender.textContent = '';
    let capoIsWrote = false;

    updateStyle(textFontSizeInput.value);


    lines.forEach((line, idx) => {
        if (line.trim().length > 0) {
            //console.log("line", idx, isChordLine(line), line);
            if (isChordLine(line)) {
                if (!capoIsWrote && capoInput.value > 0) {
                    writeCapo(capoInput.value);
                    capoIsWrote = true;
                }

                if (previousLineChord) {
                    writeLineChord(previousLineChord);
                }
                if (capoInput.value > 0 || notationInput.value !== "") {
                    console.log("You Transpose", capoInput.value, notationInput.value);
                    line = lineTranspose(line);
                }
                previousLineChord = line;
            } else {
                if (previousLineChord) {
                    writeMergeChordLine(previousLineChord, line);
                    previousLineChord = '';
                } else {

                    writeLineText(line);
                }
            }
        } else {
            if (previousLineChord) {
                writeLineChord(previousLineChord);
                previousLineChord = '';
            }
            writeLineText('');
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

function recordStorage(key, v) {
    window.localStorage.setItem(key, v);
}


function getStorage(key) {
    return window.localStorage.getItem(key);
}

function updateStyle() {
    const r = document.querySelector(':root');

    const textSize = textFontSizeInput.value;
    const chordSize = chordFontSizeInput.value;
    const chordColor = chordColorInput.value;
    const textColor = textColorInput.value;
    const columnCount = columnInput.value;

    r.style.setProperty('--text-font-size', `${textSize}px`);
    r.style.setProperty('--chord-font-size', `${chordSize}px`);
    r.style.setProperty('--chord-color', `${chordColor}`);
    r.style.setProperty('--text-color', `${textColor}`);
    r.style.setProperty('--column-count', `${columnCount}`);

}




// ---------------------------------
// Init parameters from localStorage
// ---------------------------------

chordArea.value = getStorage("songchord");
capoInput.value = getStorage("capo");
textFontSizeInput.value = getStorage("textfontsize") || 12;
chordFontSizeInput.value = getStorage("chordfontsize") || 12;
chordColorInput.value = getStorage("chordcolor") || '#188B18';
textColorInput.value = getStorage("textcolor") || '#23239F';
columnInput.value = getStorage("column") || 1;
notationInput.value = getStorage("notation") || '';

// -------------------
// Event Listeners
// -------------------

printButton.addEventListener("click", function (ev) {
    console.log("PRNT");
    window.print();

});

chordArea.addEventListener("input", function (ev) {
    const v = this.value;
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

renderSong(chordArea.value);