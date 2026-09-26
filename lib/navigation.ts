export type WorkspaceAccess = {
  role: string;
  hasFamily: boolean;
  familyName?: string;
  isSuperAdmin?: boolean;
  isConseiller?: boolean;
};
export type NavItem = {
  label: string;
  href: string;
  icon: "home" | "people" | "followup" | "calendar" | "report" | "team" | "outreach" | "profile" | "admin" | "church" | "book";
  description: string;
  matches?: string[];
};

export function roleLabel(role: string) {
  const normalized = role.toLowerCase().trim().replaceAll("_", " ");
  const labels: Record<string, string> = {
    "super admin": "Administration centrale", admin: "Administrateur", berger: "Berger",
    second: "Second du berger", "second du berger": "Second du berger",
    "responsable de brebi": "Responsable de brebis", "responsable de brebis": "Responsable de brebis",
    responsable: "Responsable de brebis", "integration responsable": "Responsable de l’intégration",
    "integration second": "Second de l’intégration", "integration conseiller": "Conseiller",
    conseiller: "Conseiller", brebi: "Membre", membre: "Membre", "faiseur de disciple": "Faiseur de disciple",
  };
  return labels[normalized] || role || "Membre";
}

/** Presentation only: database policies and existing page guards remain authoritative. */
export function getNavigation(access: WorkspaceAccess): { primary: NavItem[]; secondary: NavItem[]; canSeeMembers: boolean; canSeeGuests: boolean } {
  const role = access.role.toLowerCase().trim().replaceAll("_", " ");
  const admin = !!access.isSuperAdmin || role === "admin";
  const integration = role.startsWith("integration ");
  const integrationLeader = ["integration responsable", "integration second"].includes(role);
  const familyLeader = access.hasFamily && ["berger", "second", "second du berger"].includes(role);
  const responsible = ["responsable", "responsable de brebi", "responsable de brebis"].includes(role);
  const counselor = !!access.isConseiller || ["conseiller", "integration conseiller"].includes(role);
  const profile: NavItem = { label: "Mon profil", href: "/dashboard/profil", icon: "profile", description: "Informations personnelles et compte" };
  const isNoe = (access.familyName || "").toUpperCase().includes("NOÉ") || (access.familyName || "").toUpperCase().includes("NOE");
  const meditationItem: NavItem = {
    label: isNoe ? "Méditation" : "Méditation Noé",
    href: "/dashboard/meditation",
    icon: "book",
    description: "Planning hebdomadaire de méditation — Famille de Noé",
  };

  if (admin) return {
    primary: [
      { label: "Écosystème", href: "/dashboard/admin?tab=ecosystem", icon: "admin", description: "Vue d’ensemble de l’organisation" },
      { label: "Églises", href: "/dashboard/admin?tab=churches", icon: "church", description: "Gérer les églises" },
      { label: "Approbations", href: "/dashboard/admin?tab=approvals", icon: "followup", description: "Examiner les demandes" },
    ],
    secondary: [
      { label: "Compte rendu de culte", href: "/cr-culte", icon: "report", description: "Préparer le compte rendu" },
      meditationItem,
      profile,
    ],
    canSeeMembers: false, canSeeGuests: false,
  };
  if (!access.hasFamily && !integration) return { primary: [], secondary: [], canSeeMembers: false, canSeeGuests: false };
  const canSeeGuests = familyLeader || integration || counselor;
  const primary: NavItem[] = [];
  const secondary: NavItem[] = [];
  if (familyLeader || integration || counselor) primary.push({ label: "Accueil", href: "/dashboard", icon: "home", description: "Vos priorités du jour" });
  if (familyLeader || canSeeGuests) primary.push({ label: familyLeader ? "Membres" : "Invités", href: familyLeader ? "/dashboard/bergerie" : "/dashboard/invites", icon: "people", description: familyLeader ? "Membres de la bergerie" : "Invités et parcours d’intégration", matches: familyLeader ? ["/dashboard/bergerie", "/dashboard/invites"] : ["/dashboard/invites"] });
  if (!access.hasFamily && (integration || counselor)) {
    primary.push({ label: "Mes âmes", href: "/dashboard/affectation", icon: "followup", description: "Les personnes qui vous sont confiées" });
  }
  if (familyLeader) {
    primary.push({ label: "Activités", href: "/dashboard/activities", icon: "calendar", description: "Calendrier et présences" });
    if (isNoe) {
      primary.push(meditationItem);
    }
    secondary.push({ label: "Rapports", href: "/dashboard/reporting", icon: "report", description: "Bilan et export des rapports" });
    if (!isNoe) {
      secondary.push(meditationItem);
    }
  }
  if (integration) {
    primary.push({
      label: "Planning",
      href: "/dashboard/planning-integration",
      icon: "calendar",
      description: "Services du mois et plan de positionnement",
      matches: ["/dashboard/planning-integration", "/dashboard/positionnement-integration"]
    });
  }
  if (integrationLeader) secondary.push({ label: "Équipe", href: "/dashboard/equipe", icon: "team", description: "Responsables et conseillers" });
  if (familyLeader || integration || responsible) secondary.push({ label: "Évangélisation", href: "/dashboard/evangelisation", icon: "outreach", description: "Rencontres et sorties" });
  if (integration) secondary.push({ label: "Compte rendu de culte", href: "/cr-culte", icon: "report", description: "Préparer le compte rendu" });
  secondary.push(profile);
  return { primary, secondary, canSeeMembers: familyLeader, canSeeGuests };
}

export function isNavigationActive(item: NavItem, pathname: string, tab: string | null) {
  const [path, query] = item.href.split("?");
  if (query) return pathname === path && (tab || "ecosystem") === new URLSearchParams(query).get("tab");
  return (item.matches || [path]).some(route => pathname === route || (route !== "/dashboard" && pathname.startsWith(`${route}/`)));
}
