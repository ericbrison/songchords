import { createHash } from "node:crypto";

const UG_API = "https://api.ultimate-guitar.com/api/v1";
const DEVICE_ID = "netlify00proxy0000a";

function generateApiKey() {
  const now = new Date();
  const date = now.toISOString().split("T")[0];
  const hour = now.getUTCHours();
  return createHash("md5")
    .update(`${DEVICE_ID}${date}:${hour}createLog()`)
    .digest("hex");
}

function ugHeaders(token) {
  const h = {
    "Accept-Charset": "utf-8",
    "Accept": "application/json",
    "User-Agent": "UGT_ANDROID/5.8.1 (Pixel; 8.1.0)",
    "X-UG-CLIENT-ID": DEVICE_ID,
    "X-UG-API-KEY": generateApiKey(),
  };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

async function login() {
  const { UG_USERNAME, UG_PASSWORD } = process.env;
  if (!UG_USERNAME || !UG_PASSWORD) {
    throw new Error("Missing UG_USERNAME or UG_PASSWORD env vars");
  }
  const url = `${UG_API}/auth/login?username=${encodeURIComponent(UG_USERNAME)}&password=${encodeURIComponent(UG_PASSWORD)}`;
  const res = await fetch(url, { method: "PUT", headers: ugHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(`Login failed (${res.status}): ${data.error?.message || JSON.stringify(data)}`);
  if (!data.token) throw new Error("No token in login response: " + JSON.stringify(data));
  return data.token;
}

async function ugFetch(path, token) {
  const res = await fetch(`${UG_API}${path}`, { headers: ugHeaders(token) });
  const data = await res.json();
  if (!res.ok) throw new Error(`UG API error (${res.status}): ${data.error?.message || JSON.stringify(data)}`);
  return data;
}

export default async (req) => {
  const params = new URL(req.url).searchParams;
  const action = params.get("action");

  if (!action) return new Response("Missing action param", { status: 400 });

  try {
    const token = await login();

    if (action === "search") {
      const query = params.get("query");
      if (!query) return new Response("Missing query param", { status: 400 });
      const data = await ugFetch(
        `/tab/search?title=${encodeURIComponent(query)}&type[]=300&page=1`,
        token
      );
      return Response.json(data);
    }

    if (action === "tab") {
      const id = params.get("id");
      if (!id) return new Response("Missing id param", { status: 400 });
      const data = await ugFetch(
        `/tab/info?tab_id=${encodeURIComponent(id)}&tab_access_type=private`,
        token
      );
      return Response.json(data);
    }

    return new Response("Invalid action", { status: 400 });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 502 });
  }
};

export const config = { path: "/api/cors-proxy" };
