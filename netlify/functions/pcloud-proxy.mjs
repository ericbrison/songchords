const PCLOUD_API_US = "https://api.pcloud.com";
const PCLOUD_API_EU = "https://eapi.pcloud.com";

async function pcloudRequest(apiHost, method, params = {}) {
  const url = new URL(`/${method}`, apiHost);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString());
  const data = await res.json();
  return data;
}

async function login(username, password) {
  // Try US first, then EU
  let data = await pcloudRequest(PCLOUD_API_US, "userinfo", {
    getauth: 1,
    logout: 1,
    username,
    password,
  });
  if (data.result === 0 && data.auth) {
    return { auth: data.auth, apiHost: PCLOUD_API_US };
  }

  data = await pcloudRequest(PCLOUD_API_EU, "userinfo", {
    getauth: 1,
    logout: 1,
    username,
    password,
  });
  if (data.result === 0 && data.auth) {
    return { auth: data.auth, apiHost: PCLOUD_API_EU };
  }

  throw new Error(data.error || "Login failed");
}

async function listFolder(auth, apiHost, folderId) {
  const data = await pcloudRequest(apiHost, "listfolder", {
    auth,
    folderid: folderId,
  });
  if (data.result !== 0) throw new Error(data.error || "listfolder failed");
  return data.metadata;
}

async function createFolder(auth, apiHost, parentFolderId, name) {
  const data = await pcloudRequest(apiHost, "createfolderifnotexists", {
    auth,
    folderid: parentFolderId,
    name,
  });
  if (data.result !== 0) throw new Error(data.error || "createfolder failed");
  return data.metadata;
}

async function uploadFile(auth, apiHost, folderId, filename, content) {
  const url = new URL("/uploadfile", apiHost);
  url.searchParams.set("auth", auth);
  url.searchParams.set("folderid", folderId);
  url.searchParams.set("filename", filename);
  url.searchParams.set("nopartial", "1");

  const blob = new Blob([content], { type: "text/plain" });
  const form = new FormData();
  form.append("file", blob, filename);

  const res = await fetch(url.toString(), { method: "POST", body: form });
  const data = await res.json();
  if (data.result !== 0) throw new Error(data.error || "upload failed");
  return data.metadata[0];
}

async function updateFile(auth, apiHost, fileId, folderId, filename, content) {
  // Delete old file then re-upload
  const delData = await pcloudRequest(apiHost, "deletefile", {
    auth,
    fileid: fileId,
  });
  if (delData.result !== 0) throw new Error(delData.error || "deletefile failed");

  return await uploadFile(auth, apiHost, folderId, filename, content);
}

async function downloadFile(auth, apiHost, fileId) {
  const data = await pcloudRequest(apiHost, "getfilelink", {
    auth,
    fileid: fileId,
  });
  if (data.result !== 0) throw new Error(data.error || "getfilelink failed");

  const host = data.hosts[0];
  const path = data.path;
  const fileUrl = `https://${host}${path}`;
  const res = await fetch(fileUrl);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const text = await res.text();
  return text;
}

export default async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  const { action } = body;
  if (!action) return new Response("Missing action param", { status: 400 });

  try {
    if (action === "login") {
      const { username, password } = body;
      if (!username || !password) {
        return new Response("Missing username or password", { status: 400 });
      }
      const result = await login(username, password);
      return Response.json(result);
    }

    const { auth, apiHost } = body;
    if (!auth || !apiHost) {
      return new Response("Missing auth or apiHost", { status: 400 });
    }

    if (action === "listfolder") {
      const result = await listFolder(auth, apiHost, body.folderid || 0);
      return Response.json(result);
    }

    if (action === "createfolder") {
      const { folderid, name } = body;
      if (!name) return new Response("Missing folder name", { status: 400 });
      const result = await createFolder(auth, apiHost, folderid || 0, name);
      return Response.json(result);
    }

    if (action === "upload") {
      const { folderid, filename, content } = body;
      if (!filename || content === undefined) {
        return new Response("Missing filename or content", { status: 400 });
      }
      const result = await uploadFile(auth, apiHost, folderid, filename, content);
      return Response.json(result);
    }

    if (action === "update") {
      const { fileid, folderid, filename, content } = body;
      if (!fileid || !filename || content === undefined) {
        return new Response("Missing fileid, filename or content", { status: 400 });
      }
      const result = await updateFile(auth, apiHost, fileid, folderid, filename, content);
      return Response.json(result);
    }

    if (action === "download") {
      const { fileid } = body;
      if (!fileid) return new Response("Missing fileid", { status: 400 });
      const content = await downloadFile(auth, apiHost, fileid);
      return Response.json({ content });
    }

    return new Response("Invalid action", { status: 400 });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 502 });
  }
};

export const config = { path: "/api/pcloud" };
