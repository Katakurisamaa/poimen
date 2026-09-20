export interface PrayerSlot {
  lead: string;
  adjoint: string;
}

export interface SundayPrayerSlot {
  participants: string; // e.g. "Tous"
  conducteur: string;   // e.g. "En Attente du PD"
  sousReserve: string;  // e.g. "PHALONE (Sous réserve)"
}

export interface SundayServiceRole {
  coordination: string;          // e.g. "PHALONE (Coordination)"
  fanionStatsAccueil: string;    // e.g. "CHRISTIAN (Fanion + Statistiques + Accueil+ Présentation)"
  salonLoungeRestauration: string; // e.g. "INGRID (Coord. Salon lounge/Restauration)"
  conseillerMobile: string;      // e.g. "NADÈGE (Conseiller mobile)"
  accueil: string;               // e.g. "LAURISSA (ACCUEIL)"
  observationMembers?: string[]; // Names of members in observation (to display highlighted in yellow)
  specialEvent?: string;         // e.g. "COCKTAIL DE BIENVENUE" or empty
}

export interface WeekSchedule {
  id: string;
  periode: string; // e.g. "DU 31/08/26 AU 06/09/26"
  jeuneEtPriere: PrayerSlot;
  priereSamedi: PrayerSlot;
  priereMinisteres: SundayPrayerSlot;
  serviceDimanche: SundayServiceRole;
}

export interface KeyDates {
  formationDate: string;        // e.g. "30/09/26"
  formationDetails?: string;
  reunionMensuelleDate: string; // e.g. "03/10/26"
  reunionMensuelleDetails: string; // e.g. "APRÈS LA PRIÈRE DE CLÔTURE (AVEC PRÉSENCE OBLIGATOIRE)"
}

export interface OperationalGuidelines {
  backupNotice: string; // e.g. "LE BACKUP DOIT IMPÉRATIVEMENT OUVRIR SON MICRO PENDANT LA PRIÈRE ET NE PAS COUVRIR LA VOIX DU LEAD / LE BACKUP ENVOIE LE CR"
  cleaningNotice: string; // e.g. "TOUS LES CONSEILLERS EN SERVICE DOIVENT ASSURER LE NETTOYAGE APRÈS LE SERVICE"
  customNotes?: string;
}

export interface PlanningIntegrationData {
  id?: string;
  church_id: string;
  month_key: string; // "YYYY-MM" e.g. "2026-09"
  church_name?: string;
  globalObservationMembers?: string[]; // e.g. ["Laurissa", "Christiane", "Prosper"]
  weeks: WeekSchedule[];
  key_dates: KeyDates;
  guidelines: OperationalGuidelines;
  created_at?: string;
  updated_at?: string;
}
