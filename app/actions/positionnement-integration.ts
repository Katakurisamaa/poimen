"use server";

import { createClient } from "@supabase/supabase-js";
import { PositionnementPlanData } from "@/types/positionnement-integration";

if (typeof process !== "undefined" && process.env) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase configuration");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

export async function getPositionnementIntegration(churchId: string, dateCulte: string) {
  try {
    if (!churchId || !dateCulte) {
      return { success: false, error: "Identifiant église ou date manquant" };
    }
    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from("positionnement_integration")
      .select("*")
      .eq("church_id", churchId)
      .eq("date_culte", dateCulte)
      .maybeSingle();

    if (error) {
      return { success: false, error: error.message, notConfigured: error.code === "PGRST205" };
    }

    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err?.message || "Erreur serveur" };
  }
}

export async function savePositionnementIntegration(planData: PositionnementPlanData) {
  try {
    if (!planData.church_id || !planData.date_culte) {
      return { success: false, error: "Identifiant église ou date manquant" };
    }
    const supabase = getServiceSupabase();

    const payload = {
      church_id: planData.church_id,
      date_culte: planData.date_culte,
      coordination_generale: planData.coordination_generale,
      cleaning_notice: planData.cleaning_notice,
      seats: planData.seats,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from("positionnement_integration")
      .upsert(payload, { onConflict: "church_id,date_culte" })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message, notConfigured: error.code === "PGRST205" };
    }

    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err?.message || "Erreur lors de la sauvegarde" };
  }
}
