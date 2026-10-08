import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { exportPollsCsv, PollError, snapshot, transition } from "@/lib/poll-engine";
import { sanitizeRoomName } from "@/lib/visio";
import type { PollCommand, PollState } from "@/types/visio-poll";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const cookieName = "poimen_poll_voter";
type Room = { owner_id: string; state: PollState; version: number };
function dbError(error: { code?: string; message?: string }): never {
  if (["PGRST205", "42P01"].includes(error.code || "")) throw new PollError("Les sondages partagés ne sont pas encore activés. L’administrateur doit installer la migration des sondages.", 503);
  throw new PollError("Enregistrement indisponible. Réessayez sans recharger la page.", 503);
}

async function context(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || !anon) throw new PollError("Configuration des sondages manquante sur le serveur.", 503);
  const roomName = request.nextUrl.searchParams.get("room") || "";
  if (!/^[a-z0-9-]{3,180}$/.test(roomName)) throw new PollError("Salle invalide.");
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const session = createServerClient(url, anon, { cookies: { getAll: () => request.cookies.getAll(), setAll: () => {} } });
  const { data: { user } } = await session.auth.getUser();
  const sign = (id: string) => createHmac("sha256", key).update(`poll-voter:${id}`).digest("hex");
  const saved = request.cookies.get(cookieName)?.value || "";
  const [candidate, signature] = saved.split(".");
  const valid = /^[a-f0-9-]{36}$/.test(candidate || "") && /^[a-f0-9]{64}$/.test(signature || "") && timingSafeEqual(Buffer.from(sign(candidate)), Buffer.from(signature));
  const guestId = valid ? candidate : randomUUID();
  const voterId = createHmac("sha256", key).update(user ? `user:${user.id}` : `guest:${guestId}`).digest("hex");
  let eligible = false;
  // Membership is read on the server; client isHost and localStorage never grant authority.
  if (user && request.nextUrl.searchParams.get("manage") === "1") {
    const { data: memberships, error } = await db.from("user_contexts").select("church_id,role,context_type").eq("user_id", user.id).eq("active", true);
    if (error) throw new PollError("Vérification des droits indisponible.", 503);
    const churchIds = [...new Set((memberships || []).filter(m =>
      (m.context_type === "integration" && ["integration_responsable", "integration_second", "integration_conseiller"].includes(m.role)) ||
      (m.context_type === "family" && ["berger", "second du berger", "second_du_berger", "responsable de brebi", "responsable"].includes(m.role))
    ).map(m => m.church_id).filter(Boolean))];
    if (churchIds.length) {
      const { data: churches, error: churchError } = await db.from("churches").select("id,name").in("id", churchIds);
      if (churchError) throw new PollError("Vérification de l’église indisponible.", 503);
      eligible = (churches || []).some(church => roomName.startsWith(`poimen-${sanitizeRoomName(church.name)}-`));
    }
  }
  const reply = (body: unknown, status = 200) => {
    const response = NextResponse.json(body, { status, headers: { "Cache-Control": "no-store, private", "Vary": "Cookie" } });
    if (!valid) response.cookies.set(cookieName, `${guestId}.${sign(guestId)}`, { httpOnly: true, secure: request.nextUrl.protocol === "https:", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
    return response;
  };
  return { db, roomName, user, voterId, eligible, reply, validCookie: valid };
}

function failure(error: unknown) {
  return NextResponse.json({ error: error instanceof PollError ? error.message : "Le service des sondages est temporairement indisponible." }, { status: error instanceof PollError ? error.status : 503, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await context(request);
    const { data, error } = await ctx.db.from("visio_poll_rooms").select("owner_id,state,version").eq("room_name", ctx.roomName).maybeSingle();
    if (error) dbError(error);
    const room = data as Room | null;
    const canManage = ctx.eligible && (!room || room.owner_id === ctx.user?.id);
    const view = snapshot(room?.state || { polls: [] }, canManage, ctx.voterId, Date.now());
    if (request.nextUrl.searchParams.get("format") === "csv") {
      if (!canManage) throw new PollError("Seul l’animateur peut exporter les réponses.", 403);
      return new NextResponse(exportPollsCsv(view), { headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="sondages-${ctx.roomName}.csv"`,
        "Cache-Control": "no-store, private", "Vary": "Cookie",
      } });
    }
    return ctx.reply(view);
  } catch (error) { return failure(error); }
}

export async function POST(request: NextRequest) {
  try {
    if (request.headers.get("origin") !== request.nextUrl.origin) throw new PollError("Origine de la requête refusée.", 403);
    if (!request.headers.get("content-type")?.startsWith("application/json")) throw new PollError("Format de requête invalide.");
    const raw = await request.text();
    if (raw.length > 20000) throw new PollError("Question trop volumineuse.", 413);
    let command: PollCommand;
    try { command = JSON.parse(raw); } catch { throw new PollError("Requête invalide."); }
    const ctx = await context(request);
    // The guest identifier is set by GET before voting, so a failed response is retryable.
    if (!ctx.user && !ctx.validCookie) throw new PollError("Votre session de vote est en cours d’initialisation. Réessayez.", 409);
    for (let attempt = 0; attempt < 8; attempt++) {
      const { data, error } = await ctx.db.from("visio_poll_rooms").select("owner_id,state,version").eq("room_name", ctx.roomName).maybeSingle();
      if (error) dbError(error);
      const room = data as Room | null;
      const canManage = ctx.eligible && (!room || room.owner_id === ctx.user?.id);
      if (!room) {
        if (!canManage || !ctx.user || command.action !== "save") throw new PollError("L’animateur n’a pas encore préparé de question.", 403);
        const state = transition({ polls: [] }, command, { voterId: ctx.voterId, canManage }, Date.now(), randomUUID());
        const { error: insertError } = await ctx.db.from("visio_poll_rooms").insert({ room_name: ctx.roomName, owner_id: ctx.user.id, state });
        if (insertError?.code === "23505") continue;
        if (insertError) dbError(insertError);
        return ctx.reply(snapshot(state, canManage, ctx.voterId, Date.now()));
      }
      const state = transition(room.state, command, { voterId: ctx.voterId, canManage }, Date.now(), randomUUID());
      const { data: committed, error: writeError } = await ctx.db.from("visio_poll_rooms")
        .update({ state, version: room.version + 1, updated_at: new Date().toISOString() })
        .eq("room_name", ctx.roomName).eq("version", room.version).select("version");
      if (writeError) dbError(writeError);
      if (committed?.length) return ctx.reply(snapshot(state, canManage, ctx.voterId, Date.now()));
    }
    throw new PollError("Plusieurs réponses arrivent en même temps. Réessayez : votre vote ne sera jamais compté deux fois.", 409);
  } catch (error) { return failure(error); }
}
