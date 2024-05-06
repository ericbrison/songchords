import SongStorage from "../songchordsAPI.js";

/**
   * Downloads a file
   * @param{string} realFileId file ID
   * @return{obj} file status
   * */
export async function recordFile(fileName, realFileId) {
    // Get credentials and build service
    // TODO (developer) - Use appropriate auth mechanism for your app



    const fileId = realFileId;
    try {
        const file = await gapi.client.drive.files.get({
            fileId: fileId,
            alt: 'media',
        });
        console.log(file.status);
        addSong(fileName, file.body);
        return file.status;

    } catch (err) {
        // TODO(developer) - Handle error
        throw err;
    }
}

const songStorage = new SongStorage("songs", "global", "currentSongIndex");


function addSong(fileName, body) {

    const name = fileName.replace(".txt", "");
    // Create new song or update if already recorded
    let songIndex = songStorage.getSongIndexFromName(name);

    if (!songIndex) {
        songIndex = songStorage.getNewSongIndex();
        songStorage.recordSongInStorage("songchordname", name, songIndex);
    }

    songStorage.recordSongInStorage("songchord", body, songIndex);
}

window.recordFile = recordFile;