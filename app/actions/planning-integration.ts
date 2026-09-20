"use server";

import { createClient } from "@supabase/supabase-js";
import { PlanningIntegrationData } from "@/types/planning-integration";

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

export async function getPlanningIntegration(churchId: string, monthKey: string) {
  try {
    if (!churchId || !monthKey) {
      return { success: false, error: "Identifiant église ou mois manquant" };
    }
    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from("planning_integration")
      .select("*")
      .eq("church_id", churchId)
      .eq("month_key", monthKey)
      .maybeSingle();

    if (error) {
      // Table might not exist yet in schema cache
      return { success: false, error: error.message, notConfigured: error.code === "PGRST205" };
    }

    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err?.message || "Erreur serveur" };
  }
}

export async function savePlanningIntegration(planningData: PlanningIntegrationData) {
  try {
    if (!planningData.church_id || !planningData.month_key) {
      return { success: false, error: "Identifiant église ou mois manquant" };
    }
    const supabase = getServiceSupabase();

    const payload = {
      church_id: planningData.church_id,
      month_key: planningData.month_key,
      weeks: planningData.weeks,
      key_dates: planningData.key_dates,
      guidelines: planningData.guidelines,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from("planning_integration")
      .upsert(payload, { onConflict: "church_id,month_key" })
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
