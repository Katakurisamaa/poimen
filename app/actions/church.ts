"use server";

import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase-server";

// Standard validation helper for UUIDs
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function createChurchInvitation() {
  const serverSupabase = await createServerClient();
  const { data: { user }, error: authErr } = await serverSupabase.auth.getUser();

  if (authErr || !user) {
    return { success: false, error: "Non authentifié." };
  }

  // Verify that the caller is indeed a super_admin
  const { data: profile } = await serverSupabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const isSuperAdmin = profile?.role === "super_admin" || user.email?.toLowerCase().trim() === "iccintegration2025@gmail.com";
  if (!isSuperAdmin) {
    return { success: false, error: "Non autorisé. Accès réservé au Super Administrateur." };
  }

  // Create invitation using the service role client
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!supabaseUrl || !supabaseServiceKey) {
    return { success: false, error: "Configuration manquante sur le serveur." };
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  const { data, error } = await supabase
    .from("church_invitations")
    .insert({})
    .select("token")
    .single();

  if (error) {
    console.error("Error creating church invitation in DB:", error);
    return { success: false, error: error.message };
  }

  return { success: true, token: data.token };
}

export async function setupChurch(token: string, churchData: {
  name: string;
  city: string;
  country: string;
  access_code?: string;
}) {
  if (!token || !UUID_REGEX.test(token)) {
    return { success: false, error: "Jeton d'invitation invalide." };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!supabaseUrl || !supabaseServiceKey) {
    return { success: false, error: "Configuration manquante sur le serveur." };
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  // 1. Verify invitation token
  const { data: invitation, error: invErr } = await supabase
    .from("church_invitations")
    .select("*")
    .eq("token", token)
    .eq("used", false)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (invErr || !invInvitationValid(invitation)) {
    return { success: false, error: "L'invitation est invalide, a expiré, ou a déjà été utilisée." };
  }

  // Helper function to narrow type of invitation
  function invInvitationValid(inv: any): boolean {
    return !!inv && inv.used === false;
  }

  // 2. Determine final access code
  const finalCode = churchData.access_code || generateAccessCode(churchData.city);

  // 3. Create the church
  const { data: church, error: chErr } = await supabase
    .from("churches")
    .insert({
      name: churchData.name.trim(),
      city: churchData.city.trim(),
      country: churchData.country.trim() || "Belgique",
      access_code: finalCode
    })
    .select()
    .single();

  if (chErr) {
    console.error("Error inserting church server-side:", chErr);
    return { success: false, error: chErr.message };
  }

  // 4. Mark invitation as used
  await supabase
    .from("church_invitations")
    .update({
      used: true,
      used_by_church_id: church.id
    })
    .eq("id", invitation.id);

  return { success: true, church };
}

function generateAccessCode(city: string) {
  const prefix = (city || "XXX").slice(0, 3).toUpperCase();
  const year = new Date().getFullYear();
  const random = Math.random().toString(36).substring(2, 4).toUpperCase();
  return `${prefix}${year}${random}`;
}
