const PCLOUD_API_US = "https://api.pcloud.com";
const PCLOUD_API_EU = "https://eapi.pcloud.com";
const VALID_HOSTS = new Set([PCLOUD_API_US, PCLOUD_API_EU]);

// The proxy is now a thin forwarder. The client computes the pCloud digest
// auth params (username, digest, passworddigest) using Web Crypto and caches
// the digest in browser memory, so the proxy never sees the password.
//
// For "login" the client tries both regions itself and sends apiHost back.

async function pcloudGet(apiHost, method, params = {}) {
  const url = new URL(`/${method}`, apiHost);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString());
  return await res.json();
}

async function pcloudUpload(apiHost, params, content, filename) {
  const url = new URL("/uploadfile", apiHost);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  const blob = new Blob([content], { type: "text/plain" });
  const form = new FormData();
  form.append("file", blob, filename);
  const res = await fetch(url.toString(), { method: "POST", body: form });
  return await res.json();
}

export default async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  const { action, apiHost } = body;
  if (!action) return new Response("Missing action param", { status: 400 });
  if (!apiHost || !VALID_HOSTS.has(apiHost)) {
    return new Response("Missing or invalid apiHost", { status: 400 });
  }

  // Auth params come from the client. We never inspect or rewrite them; we just
  // forward them to pCloud as query parameters.
  const auth = {
    username: body.username,
    digest: body.digest,
    passworddigest: body.passworddigest,
  };
  if (!auth.username || !auth.digest || !auth.passworddigest) {
    return new Response("Missing auth params", { status: 400 });
  }

  try {
    if (action === "userinfo") {
      // Used by the client to probe whether a region accepts these credentials.
      const data = await pcloudGet(apiHost, "userinfo", auth);
      return Response.json(data);
    }

    if (action === "listfolder") {
      const data = await pcloudGet(apiHost, "listfolder", { ...auth, folderid: body.folderid || 0 });
      if (data.result !== 0) throw new Error(data.error || "listfolder failed");
      return Response.json(data.metadata);
    }

    if (action === "upload") {
      const { folderid, filename, content } = body;
      if (!filename || content === undefined) {
        return new Response("Missing filename or content", { status: 400 });
      }
      const data = await pcloudUpload(apiHost, { ...auth, folderid, filename, nopartial: "1" }, content, filename);
      if (data.result !== 0) throw new Error(data.error || "upload failed");
      return Response.json(data.metadata[0]);
    }

    if (action === "update") {
      const { fileid, folderid, filename, content } = body;
      if (!fileid || !filename || content === undefined) {
        return new Response("Missing fileid, filename or content", { status: 400 });
      }
      const del = await pcloudGet(apiHost, "deletefile", { ...auth, fileid });
      if (del.result !== 0) throw new Error(del.error || "deletefile failed");
      const up = await pcloudUpload(apiHost, { ...auth, folderid, filename, nopartial: "1" }, content, filename);
      if (up.result !== 0) throw new Error(up.error || "upload failed");
      return Response.json(up.metadata[0]);
    }

    if (action === "download") {
      const { fileid } = body;
      if (!fileid) return new Response("Missing fileid", { status: 400 });
      const link = await pcloudGet(apiHost, "getfilelink", { ...auth, fileid });
      if (link.result !== 0) throw new Error(link.error || "getfilelink failed");
      const fileUrl = `https://${link.hosts[0]}${link.path}`;
      const res = await fetch(fileUrl);
      if (!res.ok) throw new Error(`Download failed: ${res.status}`);
      return Response.json({ content: await res.text() });
    }

    return new Response("Invalid action", { status: 400 });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 502 });
  }
};

export const config = { path: "/api/pcloud" };
