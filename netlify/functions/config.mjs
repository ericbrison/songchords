export default async () => {
  const { GOOGLE_CLIENT_ID, GOOGLE_API_KEY } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_API_KEY) {
    return Response.json({ error: "Missing Google env vars" }, { status: 500 });
  }
  return Response.json({
    googleClientId: GOOGLE_CLIENT_ID,
    googleApiKey: GOOGLE_API_KEY,
  });
};

export const config = { path: "/api/config" };
