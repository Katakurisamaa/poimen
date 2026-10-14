import { createHmac, randomUUID } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CREDENTIAL_LIFETIME_SECONDS = 60 * 60;

export async function GET() {
  const sharedSecret = process.env.VISIO_TURN_SHARED_SECRET;
  const urls = (process.env.VISIO_TURN_URLS || "")
    .split(",")
    .map(url => url.trim())
    .filter(url => /^turns?:/i.test(url));

  if (!sharedSecret || urls.length === 0) {
    return Response.json({ error: "Le relais TURN n'est pas configuré." }, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const username = `${Math.floor(Date.now() / 1000) + CREDENTIAL_LIFETIME_SECONDS}:${randomUUID()}`;
  const credential = createHmac("sha1", sharedSecret).update(username).digest("base64");

  return Response.json({
    iceServers: [{ urls, username, credential }],
    expiresIn: CREDENTIAL_LIFETIME_SECONDS,
  }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
