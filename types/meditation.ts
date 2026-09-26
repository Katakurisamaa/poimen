export interface MeditationSlot {
  person: string;
  verse: string;
  note?: string;
}

export type MeditationDaySchedule = Record<number, MeditationSlot>; // slotIndex (0: 06h-07h, 1: 12h-13h, 2: 17h-18h, 3: 22h-23h)

export interface MeditationWeekSchedule {
  [dayIndex: number]: MeditationDaySchedule; // 0: Lundi, 1: Mardi, 2: Mercredi, 3: Jeudi, 4: Vendredi (and optionally 5, 6)
}

export interface MeditationPlan {
  id?: string;
  church_id?: string;
  bergerie_id?: string;
  week_key: string; // e.g. "2026-09-21" (Monday of the week)
  week_label: string; // e.g. "Semaine du 21 septembre"
  livre_theme: string; // e.g. "Livre de Jean"
  verset_cle?: string; // Optional weekly key verse e.g. "Jean 15:5"
  exhortation?: string; // e.g. "Demeurez en moi, et je demeurerai en vous."
  schedule: MeditationWeekSchedule;
  theme_style?: "obsidian" | "parchment";
  updated_at?: string;
}

export const FIXED_MEDITATION_HOURS = [
  { id: 0, label: "06h - 07h", name: "Aube", icon: "sunrise" },
  { id: 1, label: "12h - 13h", name: "Midi", icon: "sun" },
  { id: 2, label: "17h - 18h", name: "Crépuscule", icon: "sunset" },
  { id: 3, label: "22h - 23h", name: "Soirée", icon: "moon" },
] as const;

export const MEDITATION_DAYS = [
  { id: 0, key: "lundi", label: "Lundi", short: "Lun" },
  { id: 1, key: "mardi", label: "Mardi", short: "Mar" },
  { id: 2, key: "mercredi", label: "Mercredi", short: "Mer" },
  { id: 3, key: "jeudi", label: "Jeudi", short: "Jeu" },
  { id: 4, key: "vendredi", label: "Vendredi", short: "Ven" },
] as const;

export const DEFAULT_FAMILLE_NOE_SAMPLE: MeditationPlan = {
  week_key: "2026-09-21",
  week_label: "Semaine du 21 septembre",
  livre_theme: "Livre de Jean",
  verset_cle: "Jean 15:5",
  exhortation: "« Ta parole est une lampe à mes pieds, et une lumière sur mon sentier. » — Psaume 119:105",
  theme_style: "obsidian",
  schedule: {
    0: {
      0: { person: "Cécile Eya", verse: "Jean 15:11" },
      1: { person: "Christian", verse: "Jean 15:12-13" },
      2: { person: "Ariane", verse: "Jean 15:14-15" },
      3: { person: "Marlise", verse: "Jean 15:16-17" },
    },
    1: {
      0: { person: "Benjamin", verse: "Jean 15:18-19" },
      1: { person: "Nadège", verse: "Jean 15:20-21" },
      2: { person: "Mbiayo", verse: "Jean 15:22-23" },
      3: { person: "Aesone", verse: "Jean 15:24-25" },
    },
    2: {
      0: { person: "Ingrid", verse: "Jean 15:26-27" },
      1: { person: "Léonard", verse: "Jean 16:1-2" },
      2: { person: "Dede", verse: "Jean 16:3-4" },
      3: { person: "Sylvie", verse: "Jean 16:5-6" },
    },
    3: {
      0: { person: "Phalone", verse: "Jean 16:7-8" },
      1: { person: "Yvette", verse: "Jean 16:9-10" },
      2: { person: "M. Cecile", verse: "Jean 16:11-12" },
      3: { person: "Bertille", verse: "Jean 16:13-14" },
    },
    4: {
      0: { person: "Nadège", verse: "Jean 16:15" },
      1: { person: "Benjamin", verse: "Jean 16:16-17" },
      2: { person: "Sandra", verse: "Jean 16:18-19" },
      3: { person: "Laurene", verse: "Jean 16:20" },
    },
  },
};
