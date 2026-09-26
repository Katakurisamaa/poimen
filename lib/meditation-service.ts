import { supabase } from "@/lib/supabase";
import {
  MeditationPlan,
  DEFAULT_FAMILLE_NOE_SAMPLE,
  FIXED_MEDITATION_HOURS,
  MEDITATION_DAYS,
} from "@/types/meditation";

/**
 * Returns the Monday (YYYY-MM-DD) for a given date or today
 */
export function getMondayOfWeek(d: Date = new Date()): string {
  const date = new Date(d);
  const day = date.getDay();
  // In JS: 0 is Sunday, 1 is Monday, ..., 6 is Saturday
  // Diff to Monday:
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(date.setDate(diff));
  const yyyy = monday.getFullYear();
  const mm = String(monday.getMonth() + 1).padStart(2, "0");
  const dd = String(monday.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Returns formatted French week label from Monday date (e.g. "Semaine du 21 septembre")
 */
export function formatWeekLabel(mondayStr: string): string {
  try {
    const [y, m, d] = mondayStr.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    const months = [
      "janvier", "février", "mars", "avril", "mai", "juin",
      "juillet", "août", "septembre", "octobre", "novembre", "décembre"
    ];
    return `Semaine du ${date.getDate()} ${months[date.getMonth()]}`;
  } catch {
    return `Semaine du ${mondayStr}`;
  }
}

/**
 * Shift week by +/- offset in weeks
 */
export function shiftWeek(mondayStr: string, offsetWeeks: number): string {
  const [y, m, d] = mondayStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + offsetWeeks * 7);
  return getMondayOfWeek(date);
}

const STORAGE_PREFIX = "poimen_meditation_noe_";

/**
 * Load plan from Supabase or localStorage fallback
 */
export async function loadMeditationPlan(
  weekKey: string,
  churchId?: string
): Promise<MeditationPlan> {
  const localKey = `${STORAGE_PREFIX}${weekKey}`;

  // 1. Try Supabase
  try {
    let query = supabase.from("meditations_noe").select("*").eq("week_key", weekKey);
    if (churchId) {
      query = query.eq("church_id", churchId);
    }
    const { data, error } = await query.maybeSingle();

    if (!error && data) {
      const plan: MeditationPlan = {
        id: data.id,
        church_id: data.church_id,
        bergerie_id: data.bergerie_id,
        week_key: data.week_key,
        week_label: data.week_label || formatWeekLabel(weekKey),
        livre_theme: data.livre_theme || "Livre de Jean",
        verset_cle: data.verset_cle || "",
        exhortation: data.exhortation || "",
        theme_style: data.theme_style || "obsidian",
        schedule: data.schedule || {},
        updated_at: data.updated_at,
      };
      // Keep localStorage in sync
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(localKey, JSON.stringify(plan));
        } catch {}
      }
      return plan;
    }
  } catch (err) {
    console.warn("Supabase fetch meditation plan error, using local fallback:", err);
  }

  // 2. Try localStorage
  if (typeof window !== "undefined") {
    try {
      const cached = localStorage.getItem(localKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {}
  }

  // 3. Fallback to default template (if current week is 2026-09-21, use exact default sample)
  if (weekKey === "2026-09-21") {
    return JSON.parse(JSON.stringify(DEFAULT_FAMILLE_NOE_SAMPLE));
  }

  // Blank template for other weeks
  return {
    week_key: weekKey,
    week_label: formatWeekLabel(weekKey),
    livre_theme: "Livre de Jean",
    verset_cle: "",
    exhortation: "« Ta parole est une lampe à mes pieds, et une lumière sur mon sentier. » — Psaume 119:105",
    theme_style: "obsidian",
    schedule: {
      0: { 0: { person: "", verse: "" }, 1: { person: "", verse: "" }, 2: { person: "", verse: "" }, 3: { person: "", verse: "" } },
      1: { 0: { person: "", verse: "" }, 1: { person: "", verse: "" }, 2: { person: "", verse: "" }, 3: { person: "", verse: "" } },
      2: { 0: { person: "", verse: "" }, 1: { person: "", verse: "" }, 2: { person: "", verse: "" }, 3: { person: "", verse: "" } },
      3: { 0: { person: "", verse: "" }, 1: { person: "", verse: "" }, 2: { person: "", verse: "" }, 3: { person: "", verse: "" } },
      4: { 0: { person: "", verse: "" }, 1: { person: "", verse: "" }, 2: { person: "", verse: "" }, 3: { person: "", verse: "" } },
    },
  };
}

/**
 * Save plan to Supabase and localStorage
 */
export async function saveMeditationPlan(plan: MeditationPlan): Promise<{ success: boolean; error?: string }> {
  const localKey = `${STORAGE_PREFIX}${plan.week_key}`;

  // Always save to localStorage immediately
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(localKey, JSON.stringify(plan));
    } catch {}
  }

  // Upsert to Supabase
  try {
    const payload: any = {
      week_key: plan.week_key,
      week_label: plan.week_label,
      livre_theme: plan.livre_theme,
      verset_cle: plan.verset_cle || "",
      exhortation: plan.exhortation || "",
      theme_style: plan.theme_style || "obsidian",
      schedule: plan.schedule,
      updated_at: new Date().toISOString(),
    };

    if (plan.church_id) payload.church_id = plan.church_id;
    if (plan.bergerie_id) payload.bergerie_id = plan.bergerie_id;

    const { error } = await supabase
      .from("meditations_noe")
      .upsert(payload, { onConflict: "church_id,week_key" });

    if (error) {
      console.warn("Supabase upsert failed, stored in localStorage:", error.message);
      // Not throwing fatal error so user still saves locally
      return { success: true, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    console.warn("Supabase save error, persisted locally:", err);
    return { success: true, error: err?.message };
  }
}

/**
 * Formats a ready-to-share WhatsApp message with markdown & emojis
 */
export function formatMeditationWhatsApp(plan: MeditationPlan): string {
  const lines: string[] = [];

  lines.push("🕊️ *PLANNING HEBDOMADAIRE DE MÉDITATION*");
  lines.push("🏛️ *FAMILLE DE NOÉ* — _Bâtir • Sauver • Peupler_");
  lines.push(`📅 *${plan.week_label || formatWeekLabel(plan.week_key)}*`);
  lines.push(`📖 *Thème / Livre :* ${plan.livre_theme || "Méditation biblique"}`);
  if (plan.verset_cle) {
    lines.push(`🗝️ *Verset clé :* ${plan.verset_cle}`);
  }
  lines.push("");
  lines.push("⏰ *Créneaux fixes :* 06h-07h | 12h-13h | 17h-18h | 22h-23h");
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━");

  for (const day of MEDITATION_DAYS) {
    lines.push(`*${day.label.toUpperCase()}*`);
    const daySchedule = plan.schedule[day.id] || {};

    for (const hour of FIXED_MEDITATION_HOURS) {
      const slot = daySchedule[hour.id];
      const person = slot?.person?.trim() || "—";
      const verse = slot?.verse?.trim() || "";
      const verseText = verse ? ` (${verse})` : "";
      lines.push(`• *${hour.label}* : ${person}${verseText}`);
    }
    lines.push("");
  }

  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━");
  if (plan.exhortation) {
    lines.push(`✨ _${plan.exhortation}_`);
  } else {
    lines.push("✨ _« Ta parole est une lampe à mes pieds, et une lumière sur mon sentier. » (Psaume 119:105)_");
  }
  lines.push("🙏 _Que le Seigneur bénisse nos temps de méditation personnelle et communautaire !_");

  return lines.join("\n");
}
