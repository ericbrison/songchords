
class SongObject {
    songchordname;
    songchord;
    notation;
    capo;
}

export default class SongStorage {
    constructor(songKey, globalKey, currentKey) {
        this.storageDataSongKey = songKey;
        this.storageDataGlobalKey = globalKey;
        this.storageCurrentIndexKey = currentKey;

    }

    get currentSongIndex() {
        const value = window.localStorage.getItem(this.storageCurrentIndexKey);
        return (value === "null" ? null : value)
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

        if (index === null && this.currentSongIndex === null) {
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


    getSongIndexFromGid(gID) {
        const songs = Object.entries(this.getAllSongsStorage());

        for (const [key, song] of songs) {
            if (song.gId === gID) {
                return key;
            }
        }
        return null;
    }



    getSongInfoOfIndex(index) {
        const songData = this.getAllSongsStorage();

        if (!index || !songData[index]) {
            return undefined;
        }

        return songData[index];
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

        } else {
            if (songData["null"]) {
                delete songData["null"];
                window.localStorage.setItem(this.storageDataSongKey, JSON.stringify(songData));
            }
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

    replaceNoteInBrackets(line, inHtml) {
        return line.replaceAll(/\[([A-G][b#]?)([1-9a-zA-Z/]{0,4})\]/g, (s, note, end) => {
            const tNote = this.noteTranspose(note).replaceAll(/(ø?)/gu, "");
            if (inHtml) {
                return `<span class="inline-chord">${tNote + end}</span>`;
            } else {
                return tNote + end;
            }
        });
    }

    noteTranspose(note) {
        const gammeB = ['A', 'Bb', 'B', 'C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab'];
        const gammeD = ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#'];
        const capoValue = parseInt(capoInput.value) || 0;
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
}
