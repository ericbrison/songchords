import SongStorage from "../songchordsAPI.js";

import { songStorage, updateSongSelector } from "../songchords.js";


let songFolderId;

const connectButton = document.getElementById("gDownload");
connectButton.addEventListener("click", async function () {
    this.style.backgroundColor = 'orange';
    let dCount = 0;
    await handleAuthClick(() => {

        updateSongSelector();
        this.style.backgroundColor = '#8dde8d';
        this.textContent = '⇅';
    },
        (cFiles) => {
            dCount++;

            this.style.backgroundColor = (dCount % 2 === 0) ? 'yellow' : 'orange';
            this.textContent = cFiles - dCount;
        }
    );

});


const saveButton = document.getElementById("save");
saveButton.addEventListener("click", async function () {

    const songName = songStorage.getSongInfoFromStorage("songchordname");
    const fileId = songStorage.getSongInfoFromStorage("gId");
    const songText = songStorage.getSongInfoFromStorage("songchord");
    if (fileId) {
        updateGoogleFile(songName, fileId, songText);
    } else {
        const newFileId = await createGFile(songName, songText);

        songStorage.recordSongInStorage("gId", newFileId.id);
    }
});

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
        addSong(fileName, file.body, fileId);
        return file.status;

    } catch (err) {
        // TODO(developer) - Handle error
        throw err;
    }
}



function addSong(fileName, body, gId) {

    const name = fileName.replace(".txt", "");
    // Create new song or update if already recorded
    let songIndex = songStorage.getSongIndexFromName(name);

    if (!songIndex) {
        songIndex = songStorage.getNewSongIndex();
        songStorage.recordSongInStorage("songchordname", name, songIndex);
    }

    songStorage.recordSongInStorage("songchord", body, songIndex);
    songStorage.recordSongInStorage("gId", gId, songIndex);
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
            const fileInfo = await recordFile(fileDatum.name, fileDatum.id);
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
                'fields': 'files(id, name, mimeType)',

                'q': `'${songFolderId}' in parents and mimeType = 'text/plain'`
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
            'params': { 'uploadType': 'media', 'fields': fileFields },
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
        'mimeType': 'Content-Type: text/plain',
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

async function uploadBasic() {

    const requestBody = {
        name: 'Test123.txt',
        parents: [songFolderId]
    };

    const myBlob = new Blob(["Test de corps"], { type: "text/plain" });
    const myFile = new File([myBlob], "Test123.txt");
    const media = {
        mimeType: 'text/plain',
        body: myFile
    };
    try {
        const file = await gapi.client.drive.files.create({
            resource: requestBody,
            media: media,
            fields: 'id',
        });
        return file.data.id;
    } catch (err) {
        // TODO(developer) - Handle error
        throw err;
    }
}

window.recordFile = recordFile