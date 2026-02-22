import { songStorage, updateSongSelector, extractGroup } from "../songchords.js";


let songFolderId;

// Google Drive connection status
const gdriveStatus = document.getElementById("gdrive-status");

export function isGdriveConnected() {
    try {
        return gapi.client.getToken() !== null;
    } catch {
        return false;
    }
}

export function updateGdriveStatus() {
    const connected = isGdriveConnected();
    gdriveStatus.classList.toggle("connected", connected);
    gdriveStatus.classList.toggle("disconnected", !connected);
    gdriveStatus.title = connected ? "Google Drive: connected" : "Google Drive: disconnected";
}

export function ensureGdriveAuth() {
    return new Promise((resolve, reject) => {
        if (isGdriveConnected()) {
            resolve();
            return;
        }
        tokenClient.callback = (resp) => {
            if (resp.error !== undefined) {
                updateGdriveStatus();
                reject(new Error("Auth failed: " + resp.error));
                return;
            }
            updateGdriveStatus();
            resolve();
        };
        tokenClient.requestAccessToken({ prompt: '' });
    });
}

// Check status periodically
setInterval(updateGdriveStatus, 30000);

export function refreshAllGroups() {
    const allSongs = songStorage.getAllSongsStorage();
    for (const [key, song] of Object.entries(allSongs)) {
        const group = extractGroup(song.songchord || "");
        songStorage.recordSongInStorage("group", group, key);
    }
}

export async function gdriveSyncAll(onProgress, onDone) {
    await handleAuthClick(() => {
        updateGdriveStatus();
        refreshAllGroups();
        updateSongSelector();
        if (onDone) onDone();
    },
        (cFiles) => {
            if (onProgress) onProgress(cFiles);
        }
    );
}

export async function gdriveSaveFile(songName, songText, fileId) {
    await ensureGdriveAuth();
    if (fileId && await existsGFile(fileId)) {
        await updateGoogleFile(songName, fileId, songText);
        return { action: "updated" };
    } else {
        const newFile = await createGFile(songName, songText);
        return { action: "created", id: newFile.id };
    }
}


/**
   * Record file in localstorage a file
   * @return{obj} gFile
   * */
export async function recordFile(gFileInfo) {
    // Get credentials and build service
    // TODO (developer) - Use appropriate auth mechanism for your app


    const fileId = gFileInfo.id;

    let songIndex = songStorage.getSongIndexFromGid(fileId);
    if (songIndex) {
        let songInfo = songStorage.getSongInfoOfIndex(songIndex);
        if (songInfo.version === gFileInfo.version) {
            // Song file already loaded
            return;
        }

    };

    try {
        const file = await gapi.client.drive.files.get({
            fileId: fileId,
            alt: 'media',
        });
        addSong(gFileInfo, file);
        return file.status;

    } catch (err) {
        // TODO(developer) - Handle error
        throw err;
    }
}

async function existsGFile(fileId) {
    // Get credentials and build service
    // TODO (developer) - Use appropriate auth mechanism for your app



    try {
        const file = await gapi.client.drive.files.get({
            fileId: fileId,
            alt: 'media',
        });
        return file.status === 200;

    } catch (err) {
        return false;
    }
}

function addSong(gFileInfo, gFile) {

    const fileName = gFileInfo.name;
    const body = gFile.body;
    const gId = gFileInfo.id;
    const name = fileName.replace(".txt", "");
    // Create new song or update if already recorded
    let songIndex = songStorage.getSongIndexFromGid(gId);

    if (!songIndex) {
        songIndex = songStorage.getNewSongIndex();
    }


    songStorage.recordSongInStorage("songchordname", name, songIndex);
    songStorage.recordSongInStorage("songchord", body, songIndex);
    songStorage.recordSongInStorage("gId", gId, songIndex);
    songStorage.recordSongInStorage("version", gFileInfo.version, songIndex);
}




/**
 *  Sign in the user upon button click.
 */
async function handleAuthClick(success, wait) {
    tokenClient.callback = async (resp) => {
        if (resp.error !== undefined) {
            throw (resp);
        }
        const fileData = await listFiles("Songs");
        for (const fileDatum of fileData) {
            const fileInfo = await recordFile(fileDatum);
            wait.call(null, fileData.length);
        };


        success.apply();

    };

    if (gapi.client.getToken() === null) {
        // Prompt the user to select a Google Account and ask for consent to share their data
        // when establishing a new session.
        tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
        // Skip display of account chooser and consent dialog for an existing session.
        tokenClient.requestAccessToken({ prompt: '' });
    }
}

/**
 *  Sign out the user upon button click.
 */
function handleSignoutClick() {
    const token = gapi.client.getToken();
    if (token !== null) {
        google.accounts.oauth2.revoke(token.access_token);
        gapi.client.setToken('');
        document.getElementById('content').innerText = '';
        document.getElementById('authorize_button').innerText = 'Authorize';
        document.getElementById('signout_button').style.visibility = 'hidden';
    }
}

/**
 * Get first 50  txt files.
 */
async function listFiles(directory) {
    let response;
    try {
        response = await gapi.client.drive.files.list({
            'pageSize': 2,
            'fields': 'files(id, name)',

            'q': `mimeType = 'application/vnd.google-apps.folder' and name = '${directory}'`
        });
    } catch (err) {
        alert(err.message);
        return;
    }
    const folders = response.result.files;
    if (!folders || folders.length === 0) {
        alert('No files found.');
        return;
    }

    if (folders.length === 1) {
        songFolderId = folders[0].id;
        try {
            response = await gapi.client.drive.files.list({
                'pageSize': 50,
                'fields': 'files(id, name, mimeType, modifiedTime, version)',

                'q': `'${songFolderId}' in parents and name contains '.txt'`
            });
        } catch (err) {
            document.getElementById('content').innerText = err.message;
            return;
        }


    }

    const files = response.result.files;



    return files;
}




async function updateGoogleFile(name, fileId, body) {

    const fileName = `${name}.txt`;

    await updateGFile(fileId, fileName, body);
}


const fileFields = 'id,version,name,appProperties';
const driveUploadPath = 'https://www.googleapis.com/upload/drive/v3/files';

/**
     * Replaces the file content with newData. Can reject
     *
     * @method updateFile
     * @param {String} driveId Google Drive file identifier
     * @param {String} newData Data to put into the file
     * @return {Promise|Object} A promise of the result that returns
     * a story description: {driveId, driveVersion, name, ifid}
     */
function updateGFile(driveId, fileName, newData) {


    return new Promise((resolve, reject) => {
        gapi.client.request({
            'path': driveUploadPath + '/' + driveId,
            'method': 'PATCH',
            'params': { 'uploadType': 'media', 'fields': fileFields, 'mimeType': 'text/plain' },
            'body': newData
        }).then(
            async (response) => {
                const gFileName = response.result.name;
                if (gFileName !== fileName) {
                    await renameGFile(driveId, fileName);
                }

                resolve(response.result)
            },
            reject
        );
    });
}


/**
 * Changes the name of the file on Google Drive. Can reject
 *
 * @method renameFile
 * @param {String} driveId Google Drive file identifier
 * @param {String} newName New name that will be displayed in drive
 * @return {Promise|Object} A promise of the result that returns
 * a file description: {driveId, driveVersion, name, ifid}
 */
async function renameGFile(driveId, newName) {
    return new Promise((resolve, reject) => {
        gapi.client.drive.files.update({
            'fileId': driveId,
            'name': newName,
            'fields': fileFields
        }).then(
            (response) => resolve(response.result),
            reject
        );
    });
}


/**
 * Creates file with name and uploads data. Never rejects
 *
 * @method createFile
 * @param {String} name Name of the new file on Google Drive
 * @param {String} data Data to put into the file
 * @return {Promise|Object} A promise of the result that returns
 * a file description: {driveId, driveVersion, name, ifid}
 */
async function createGFile(name, data) {
    // Current version of gapi.client.drive is not capable of
    // uploading the file so we'll do it with more generic
    // interface. This will create file with given name and
    // properties in one request with multipart request.

    // Some random string that is unlikely to be in transmitted data:
    const boundary = '-youpla-31415926579323846boundatydnfj111';
    const delimiter = "\r\n--" + boundary + "\r\n";
    const close_delim = "\r\n--" + boundary + "--";

    const metadata = {
        'mimeType': 'text/plain',
        'name': `${name}.txt`,
        'parents': [songFolderId]
    }

    const multipartRequestBody =
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: text/plain\r\n\r\n' +
        data +
        close_delim;

    return new Promise((resolve, reject) => {
        gapi.client.request({
            'path': driveUploadPath,
            'method': 'POST',
            'params': {
                'uploadType': 'multipart',
                'fields': fileFields
            },
            'headers': {
                'Content-Type': 'multipart/related; boundary="' + boundary + '"'
            },
            'body': multipartRequestBody,
        }).then(
            (response) => resolve(response.result),
            (error) => reject(error())
        );
    });
}

window.recordFile = recordFile
