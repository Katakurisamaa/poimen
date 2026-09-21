export interface SeatAssignment {
  seatId: string; // "C1", "C2", "C3", "C3'", "C4", "C5", "C6", "C7", "C8", "C9", "C10", "C11"
  role: string;   // e.g. "Fanion + Statistiques + Accueil", "Salon lounge et Restauration", "Accueil", "Conseiller mobile"
  member: string; // e.g. "CHRISTIAN"
  isObservation?: boolean;
  mentorName?: string; // e.g. "Christiane" -> "en obs avec Christiane"
}

export interface PositionnementPlanData {
  id?: string;
  church_id: string;
  church_name?: string;
  date_culte: string; // Format: "YYYY-MM-DD"
  coordination_generale: string;
  cleaning_notice: string;
  seats: SeatAssignment[];
  updated_at?: string;
}

export const DEFAULT_SEAT_ROLES: { seatId: string; defaultRole: string; row: "RANGEE A" | "RANGEE B" | "RANGEE C" | "FOND" }[] = [
  { seatId: "C1", defaultRole: "Fanion + Statistiques + Accueil", row: "RANGEE A" },
  { seatId: "C2", defaultRole: "Salon lounge et Restauration", row: "RANGEE A" },
  { seatId: "C3", defaultRole: "Accueil", row: "RANGEE B" },
  { seatId: "C4", defaultRole: "Salon lounge et Restauration", row: "RANGEE B" },
  { seatId: "C5", defaultRole: "Accueil", row: "RANGEE C" },
  { seatId: "C6", defaultRole: "Accueil", row: "RANGEE C" },
  { seatId: "C7", defaultRole: "Accueil", row: "RANGEE C" },
  { seatId: "C8", defaultRole: "Accueil", row: "RANGEE C" },
  { seatId: "C9", defaultRole: "Conseiller mobile", row: "FOND" },
  { seatId: "C10", defaultRole: "Conseiller mobile", row: "FOND" },
  { seatId: "C11", defaultRole: "Conseiller mobile", row: "FOND" },
];

export const COMMON_ROLES = [
  "Accueil",
  "Fanion + Statistiques + Accueil",
  "Salon lounge et Restauration",
  "Conseiller mobile",
  "Présentation",
];

export interface SeatLocationInfo {
  label: string;
  zone: "RANGEE A" | "RANGEE B" | "RANGEE C" | "FOND" | "AUTRE";
  shortDesc: string;
  side: "gauche" | "centre" | "droite" | "mobile";
}

export const SEAT_LOCATIONS: Record<string, SeatLocationInfo> = {
  "C1": { label: "Rangée A · Devant estrade (Gauche)", zone: "RANGEE A", shortDesc: "Devant gauche", side: "gauche" },
  "C2": { label: "Rangée A · Milieu (Gauche)", zone: "RANGEE A", shortDesc: "Milieu gauche", side: "gauche" },
  "C3": { label: "Rangée B · Devant estrade (Centre)", zone: "RANGEE B", shortDesc: "Devant centre", side: "centre" },
  "C4": { label: "Rangée B · Milieu (Centre)", zone: "RANGEE B", shortDesc: "Milieu centre", side: "centre" },
  "C5": { label: "Rangée C · Devant estrade (Intérieur droit)", zone: "RANGEE C", shortDesc: "Devant int. droit", side: "droite" },
  "C7": { label: "Rangée C · Devant estrade (Extérieur droit)", zone: "RANGEE C", shortDesc: "Devant ext. droit", side: "droite" },
  "C6": { label: "Rangée C · Milieu (Intérieur droit)", zone: "RANGEE C", shortDesc: "Milieu int. droit", side: "droite" },
  "C8": { label: "Rangée C · Milieu (Extérieur droit)", zone: "RANGEE C", shortDesc: "Milieu ext. droit", side: "droite" },
  "C9": { label: "Fond de salle · Côté gauche (Mobile)", zone: "FOND", shortDesc: "Fond gauche", side: "mobile" },
  "C10": { label: "Fond de salle · Centre (Mobile)", zone: "FOND", shortDesc: "Fond centre", side: "mobile" },
  "C11": { label: "Fond de salle · Côté droit (Mobile)", zone: "FOND", shortDesc: "Fond droit", side: "mobile" },
};

export function getSeatLocation(seatId: string): SeatLocationInfo {
  const baseId = seatId.replace(/'/g, "");
  const baseLoc = SEAT_LOCATIONS[baseId];
  if (seatId.endsWith("'")) {
    return {
      label: baseLoc ? `${baseLoc.label} · Binôme observation` : "Binôme d'observation",
      zone: baseLoc?.zone || "AUTRE",
      shortDesc: baseLoc ? `${baseLoc.shortDesc} (Obs)` : "Binôme obs",
      side: baseLoc?.side || "mobile",
    };
  }
  return baseLoc || {
    label: `Poste ${seatId}`,
    zone: "AUTRE",
    shortDesc: seatId,
    side: "mobile",
  };
}

