/* ── Roles ── */
export type UserRole = "super_admin" | "berger" | "coordonnateur" | "responsable" | "conseiller";

/* ── Church ── */
export interface Church {
  id: string;
  name: string;
  city: string;
  country: string;
  logo_url?: string;
  access_code?: string;
  archived: boolean;
  created_at: string;
}

/* ── Bergerie ── */
export interface Bergerie {
  id: string;
  church_id: string;
  name: string;
  berger_id: string;
  coordonnateur_id?: string;
  archived: boolean;
  created_at: string;
  church?: Church;
}

/* ── Profile (auth user) ── */
export interface Profile {
  id: string;
  email: string;
  display_name: string;
  role: UserRole;
  church_id?: string;
  bergerie_id?: string;
  language: string;
  avatar_url?: string;
  active: boolean;
  created_at: string;
  last_login?: string;
}

/* ── Member (brebis — no account) ── */
export interface Member {
  id: string;
  bergerie_id: string;
  first_name: string;
  last_name: string;
  civility: "M." | "Mme.";
  age_range: string;
  email?: string;
  phone?: string;
  address?: string;
  is_local_church: boolean;
  is_aps: boolean;
  photo_url?: string;
  responsable_id?: string;
  archived: boolean;
  created_at: string;
  responsable?: Profile;
}

/* ── Activity ── */
export type ActivityType =
  | "culte"
  | "priere"
  | "evangelisation"
  | "cdm"
  | "seminaire"
  | "bapteme"
  | "autre";

export type RecurrenceType = "none" | "weekly" | "monthly";

export interface Activity {
  id: string;
  bergerie_id: string;
  title: string;
  type: ActivityType;
  date: string;
  time?: string;
  location?: string;
  notes?: string;
  recurrence: RecurrenceType;
  created_by: string;
  created_at: string;
}

/* ── Attendance ── */
export type AttendanceStatus = "present" | "absent" | "excused";

export interface Attendance {
  id: string;
  activity_id: string;
  member_id: string;
  status: AttendanceStatus;
  comment?: string;
  recorded_by: string;
  recorded_at: string;
}

/* ── Challenge ── */
export type ChallengeStatus = "en_cours" | "resolu" | "abandonne";

export interface Challenge {
  id: string;
  member_id: string;
  description: string;
  status: ChallengeStatus;
  constat_date: string;
  resolved_date?: string;
  created_by: string;
  created_at: string;
}

export interface ChallengeNote {
  id: string;
  challenge_id: string;
  content: string;
  author_id: string;
  created_at: string;
}

/* ── Objective ── */
export type ObjectiveCategory = "evangelisation" | "presence" | "croissance" | "autre";
export type ObjectiveStatus = "not_started" | "in_progress" | "achieved" | "not_achieved";

export interface Objective {
  id: string;
  bergerie_id: string;
  title: string;
  category: ObjectiveCategory;
  target_value: number;
  current_value: number;
  unit: string;
  start_date: string;
  end_date: string;
  status: ObjectiveStatus;
  closing_comment?: string;
  created_by: string;
  created_at: string;
}

/* ── Suivi Conseiller (Module F) ── */
export interface MemberSuivi {
  id: string;
  member_id: string;
  entry_event?: string;
  appel_abouti: boolean;
  groupe_whatsapp: boolean;
  dans_famille_disciple: boolean;
  prevu_revenir: boolean;
  est_revenu_culte: boolean;
  rencontre_effectuee: boolean;
  visite_domicile: boolean;
  interesse_cdm: boolean;
  presence_cdm: boolean;
  priere_eglise: boolean;
  priere_partage: boolean;
  interet_evenements: boolean;
  evenement_ok: boolean;
  cocktail_bienvenue: boolean;
  interet_formation: boolean;
  participation_001: boolean;
  participation_101: boolean;
  participation_201: boolean;
  participation_301: boolean;
  termine_pcnc: boolean;
  veut_servir: boolean;
  devenu_star: boolean;
  commentaire?: string;
  updated_by: string;
  updated_at: string;
}

/* ── Fidélisation ── */
export type FidelisationLevel = "fidelise" | "en_cours" | "a_risque";

export interface FidelisationConfig {
  id: string;
  church_id: string;
  culte_points: number;
  cdm_points: number;
  priere_points: number;
  evangelisation_points: number;
  autre_points: number;
  seuil_fidelise: number;
  seuil_en_cours: number;
}

/* ── Dashboard Stats ── */
export interface BergerDashboardStats {
  total_members: number;
  active_members: number;
  avg_attendance_month: number;
  avg_attendance_quarter: number;
  challenges_en_cours: number;
  challenges_resolus: number;
  members_sans_responsable: number;
  fidelise_count: number;
  en_cours_count: number;
  a_risque_count: number;
}

/* ── Activity type config (for colors) ── */
export const ACTIVITY_COLORS: Record<ActivityType, string> = {
  culte: "var(--gold)",
  priere: "var(--blue)",
  evangelisation: "var(--green)",
  cdm: "var(--purple)",
  seminaire: "var(--orange)",
  bapteme: "var(--gold-light)",
  autre: "var(--muted)",
};

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  culte: "Culte du dimanche",
  priere: "Temps de prière",
  evangelisation: "Évangélisation",
  cdm: "Cellule de maison",
  seminaire: "Séminaire",
  bapteme: "Baptême",
  autre: "Autre",
};

export const AGE_RANGES = [
  "Moins de 18 ans", "18-25 ans", "26-30 ans", "31-35 ans", "36-40 ans", "41-45 ans", "46-50 ans", "Plus de 50 ans"
] as const;
