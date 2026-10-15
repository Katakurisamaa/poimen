import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { randomBytes } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

class RoomError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

function isRoomName(value: unknown): value is string {
  return typeof value === "string" && /^poimen-prive-[a-f0-9]{36}$/.test(value);
}

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new RoomError("Configuration des salles privées manquante sur le serveur.", 503);
  return createSupabaseClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function databaseError(error: { code?: string }) {
  if (["PGRST205", "42P01"].includes(error.code || "")) {
    throw new RoomError("La gestion des salles privées n’est pas encore activée. Appliquez la migration Supabase des salles personnalisées.", 503);
  }
  throw new RoomError("Enregistrement indisponible. Réessayez.", 503);
}

async function authenticatedUser(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new RoomError("Configuration d’authentification manquante sur le serveur.", 503);
  const session = createServerClient(url, anon, {
    cookies: { getAll: () => request.cookies.getAll(), setAll: () => {} },
  });
  const { data: { user }, error } = await session.auth.getUser();
  if (error || !user) throw new RoomError("Connectez-vous pour gérer cette salle.", 401);
  return user;
}

function failure(error: unknown) {
  return NextResponse.json(
    { error: error instanceof RoomError ? error.message : "Le service des salles privées est indisponible." },
    { status: error instanceof RoomError ? error.status : 503, headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET(request: NextRequest) {
  try {
    const roomName = request.nextUrl.searchParams.get("room");
    if (!isRoomName(roomName)) throw new RoomError("Lien de salle privée invalide.");
    const { data, error } = await serviceClient().from("visio_custom_rooms")
      .select("is_active,title").eq("room_name", roomName).maybeSingle();
    if (error) databaseError(error);
    // Support links created before the server registry was introduced. Their owner
    // registers them when opening the management page for the first time.
    return NextResponse.json({ active: data ? Boolean(data.is_active) : true, title: data?.title || null }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}

export async function POST(request: NextRequest) {
  try {
    if (request.headers.get("origin") !== request.nextUrl.origin) throw new RoomError("Origine de la requête refusée.", 403);
    const user = await authenticatedUser(request);
    const body = await request.json().catch(() => null) as { action?: unknown; roomName?: unknown; title?: unknown } | null;
    if (!body || (body.action !== "create" && body.action !== "register")) throw new RoomError("Demande de salle invalide.");
    const db = serviceClient();

    if (body.action === "create") {
      const title = typeof body.title === "string" ? body.title.trim() : "";
      if (!title || title.length > 80) throw new RoomError("Le nom de la salle doit contenir entre 1 et 80 caractères.");
      const roomName = `poimen-prive-${randomBytes(18).toString("hex")}`;
      const { error } = await db.from("visio_custom_rooms").insert({ room_name: roomName, owner_id: user.id, title });
      if (error) databaseError(error);
      return NextResponse.json({ roomName, title }, { status: 201, headers: { "Cache-Control": "no-store" } });
    }

    if (!isRoomName(body.roomName)) throw new RoomError("Identifiant de salle invalide.");
    const roomName = body.roomName;
    const { data: existing, error: lookupError } = await db.from("visio_custom_rooms")
      .select("owner_id,is_active").eq("room_name", roomName).maybeSingle();
    if (lookupError) databaseError(lookupError);
    if (existing) {
      if (existing.owner_id !== user.id) throw new RoomError("Cette salle est déjà rattachée à un autre compte.", 403);
      if (!existing.is_active) throw new RoomError("Cette salle a été supprimée.", 410);
      return NextResponse.json({ roomName, active: true }, { headers: { "Cache-Control": "no-store" } });
    }

    const title = typeof body.title === "string" ? body.title.trim().slice(0, 80) : "Salle personnalisée";
    const { error: insertError } = await db.from("visio_custom_rooms").insert({ room_name: roomName, owner_id: user.id, title: title || "Salle personnalisée" });
    if (insertError?.code === "23505") throw new RoomError("Cette salle est déjà enregistrée. Actualisez la page.", 409);
    if (insertError) databaseError(insertError);
    return NextResponse.json({ roomName, active: true }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}

export async function DELETE(request: NextRequest) {
  try {
    if (request.headers.get("origin") !== request.nextUrl.origin) throw new RoomError("Origine de la requête refusée.", 403);
    const user = await authenticatedUser(request);
    const roomName = request.nextUrl.searchParams.get("room");
    if (!isRoomName(roomName)) throw new RoomError("Identifiant de salle invalide.");
    const { data, error } = await serviceClient().from("visio_custom_rooms")
      .update({ is_active: false, deleted_at: new Date().toISOString() })
      .eq("room_name", roomName).eq("owner_id", user.id).eq("is_active", true)
      .select("room_name").maybeSingle();
    if (error) databaseError(error);
    if (!data) throw new RoomError("Salle introuvable ou déjà supprimée.", 404);
    return NextResponse.json({ deleted: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}
