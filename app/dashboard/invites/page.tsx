"use client";

import { Suspense, useRef, useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { 
  Search, Plus, UserPlus, UserMinus, Filter, CheckCircle2, XCircle, X, Link,
  Calendar, CalendarDays, MapPin, Mail, Phone, User as UserIcon,
  ChevronDown, ChevronUp, MoreHorizontal, Loader2,
  Trash2, Trash, RotateCcw, Pencil, Archive, AlertTriangle,
  ListChecks, BarChart3, Home, LayoutGrid, Table as TableIcon, Eye, Check, FileText,
  QrCode, UserCheck
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { autoAddLeaderToMembers, listIntegrationTeam, getIntegrationInvites, assignCounselorToGuest } from "@/app/actions/auth";
import { getActiveContext, getActiveUserInfo } from "@/lib/client-session";
import { filterElapsedDateKeys } from "@/lib/date-utils";
import PersonPanel, { PersonButton } from "@/components/experience/PersonPanel";
import { usePeopleView } from "@/lib/use-people-view";
import { useFeedback } from "@/components/experience/FeedbackProvider";
import PeopleNavigation from "@/components/experience/PeopleNavigation";
import PeopleStatistics from "@/components/experience/PeopleStatistics";
import FamilyAssignment from "@/components/experience/FamilyAssignment";
import IntegrationOverview from "@/components/experience/IntegrationOverview";
import PeopleListToolbar from "@/components/experience/PeopleListToolbar";
import styles from "../affectation/Affectation.module.css";
import CustomDatePicker from "@/components/ui/CustomDatePicker";
import CustomSelect from "@/components/ui/CustomSelect";
import CountryPickerModal, { COUNTRIES } from "@/components/ui/CountryPickerModal";
import CrCallCenterModal from "@/components/experience/CrCallCenterModal";
import ShareInviteModal from "@/components/invites/ShareInviteModal";
import TriageListView from "@/components/experience/TriageListView";
import GuestArrivalDetailsModal from "@/components/experience/GuestArrivalDetailsModal";
import ArrivalDateFilterModal from "@/components/experience/ArrivalDateFilterModal";


interface Guest {
  id: string;
  civility: string;
  lastName: string;
  firstName: string;
  age: string;
  phone: string;
  email: string;
  address: string;
  arrivalDate: string; 
  event: string; 
  aps: boolean;
  localChurch: boolean;
  autreEglise?: string;
  responsible: string;
  isInBergerie: boolean;
  status?: string; 
  attendance: Record<string, boolean>; 
  appelAbouti: boolean;
  groupeWhatsapp: boolean;
  prevuRevenir: boolean;
  estRevenuCulte: boolean;
  rencontreEffectuee: boolean;
  visiteDomicile: boolean;
  cocktailBienvenue: boolean;
  pcnc: boolean;
  p101: boolean;
  p201: boolean;
  p301: boolean;
  terminePCNC: boolean;
  baptemeEau: boolean;
  baptemeEsprit: boolean;
  veutServir: boolean;
  devenuStar: boolean;
  smsBienvenue: boolean;
  priere: boolean;
  interetEvenement: boolean;
  interetFormation: boolean;
  aEteInvite: boolean;
  parQui: string;
  interetCDM: boolean;
  integreCDM: boolean;
  prierePartage: boolean;
  dansFamilleDisciple: boolean;
  interetBapteme: boolean;
  commentaire: string;
  commentaireSuivi: string;
  archived: boolean;
  assigned_to?: string | null;
  church_id?: string | null;
  bergerie_id?: string | null;
  created_by?: string | null;
  famille_disciple?: string;
  etatCivil?: string;
  souhaiteEtreContacte?: boolean;
  piliers1?: boolean;
  piliers2?: boolean;
  piliers3?: boolean;
  piliers4?: boolean;
  termine12Piliers?: boolean;
  pays?: string;
  souhaitSuivi?: boolean;
  rdvPastoral?: boolean;
  neDecrochePas?: boolean;
  fauxNumero?: boolean;
  raisonEchec?: string;
}

const MOCK_GUESTS: Guest[] = [];

const MOCK_RESPONSIBLES = ["Non assigné"];

const STATUS_OPTIONS = ["Brebi", "Faiseur de Disciple", "Responsable", "Second", "Berger"];

const FAMILY_KEYS = [
  "FAMILLE DE NOÉ",
  "FAMILLE DE DAVID",
  "FAMILLE CHARIS",
  "FAMILLE IT'S TIME",
  "FAMILLE GÉNÉRATION JOSUÉ",
  "FAMILLE DE MOÏSE",
  "AUCUNE"
];

const FAMILY_COLORS: Record<string, { main: string; glow: string; border: string }> = {
  "FAMILLE DE NOÉ": { main: "var(--gold)", glow: "rgba(212, 175, 55, 0.04)", border: "rgba(212, 175, 55, 0.18)" },
  "FAMILLE DE DAVID": { main: "var(--sky)", glow: "rgba(56, 189, 248, 0.04)", border: "rgba(56, 189, 248, 0.18)" },
  "FAMILLE CHARIS": { main: "var(--green)", glow: "rgba(34, 197, 94, 0.04)", border: "rgba(34, 197, 94, 0.18)" },
  "FAMILLE IT'S TIME": { main: "var(--orange)", glow: "rgba(249, 115, 22, 0.04)", border: "rgba(249, 115, 22, 0.18)" },
  "FAMILLE GÉNÉRATION JOSUÉ": { main: "var(--violet)", glow: "rgba(139, 92, 246, 0.04)", border: "rgba(139, 92, 246, 0.18)" },
  "FAMILLE DE MOÏSE": { main: "var(--rose)", glow: "rgba(244, 63, 94, 0.04)", border: "rgba(244, 63, 94, 0.18)" },
  "AUCUNE": { main: "var(--muted)", glow: "rgba(148, 163, 184, 0.02)", border: "rgba(148, 163, 184, 0.12)" },
};

function mapDbGuestToGuest(g: any): Guest {
  const isAssigned = Boolean(g.assigned_to || (g.responsible && g.responsible !== "Non assigné" && g.responsible.trim() !== ""));
  const rawStatut = (g.statut_affectation as any) || g.commentaire_suivi?.match(/\[STATUT:\s*([^\]]+)\]/i)?.[1]?.trim();
  const hadPastFollowup = rawStatut === 'sans_suite' || rawStatut === 'conserve' || Boolean(g.appel_abouti) || Boolean(g.statut_affectation && g.statut_affectation !== 'a_affecter');
  const isFreshUnassigned = !isAssigned && !hadPastFollowup;

  return {
    id: g.id,
    civility: g.civility,
    firstName: g.first_name,
    lastName: g.last_name,
    age: g.age,
    phone: g.phone,
    email: g.email,
    address: g.address,
    arrivalDate: g.arrival_date,
    event: g.event,
    aps: g.aps,
    localChurch: g.local_church,
    autreEglise: g.autre_eglise || (g.commentaire?.match(/\[(?:Autre église|Église d'origine)\s*:\s*([^\]]+)\]/i)?.[1]?.trim() || ""),
    responsible: g.responsible,
    assigned_to: g.assigned_to,
    church_id: g.church_id,
    bergerie_id: g.bergerie_id,
    isInBergerie: g.is_in_bergerie,
    status: g.status,
    attendance: isFreshUnassigned ? {} : (g.attendance || {}),
    appelAbouti: isFreshUnassigned ? false : Boolean(g.appel_abouti),
    groupeWhatsapp: isFreshUnassigned ? false : Boolean(g.groupe_whatsapp),
    prevuRevenir: isFreshUnassigned ? false : Boolean(g.prevu_revenir),
    estRevenuCulte: isFreshUnassigned ? false : Boolean(g.est_revenu_culte),
    rencontreEffectuee: isFreshUnassigned ? false : Boolean(g.rencontre_effectuee),
    visiteDomicile: isFreshUnassigned ? false : Boolean(g.visite_domicile),
    cocktailBienvenue: isFreshUnassigned ? false : Boolean(g.cocktail_bienvenue),
    pcnc: isFreshUnassigned ? false : Boolean(g.pcnc),
    p101: isFreshUnassigned ? false : Boolean(g.p101),
    p201: isFreshUnassigned ? false : Boolean(g.p201),
    p301: isFreshUnassigned ? false : Boolean(g.p301),
    terminePCNC: isFreshUnassigned ? false : Boolean(g.termine_pcnc),
    baptemeEau: isFreshUnassigned ? false : Boolean(g.bapteme_eau),
    baptemeEsprit: isFreshUnassigned ? false : Boolean(g.bapteme_esprit),
    veutServir: isFreshUnassigned ? false : Boolean(g.veut_servir),
    devenuStar: isFreshUnassigned ? false : Boolean(g.devenu_star),
    smsBienvenue: g.sms_bienvenue || false,
    priere: g.priere || false,
    interetEvenement: g.interet_evenement || false,
    interetFormation: g.interet_formation || false,
    aEteInvite: g.a_ete_invite || false,
    parQui: g.par_qui || "",
    interetCDM: isFreshUnassigned ? false : Boolean(g.interet_cdm),
    integreCDM: isFreshUnassigned ? false : Boolean(g.integre_cdm),
    prierePartage: isFreshUnassigned ? false : Boolean(g.priere_partage),
    dansFamilleDisciple: isFreshUnassigned ? false : Boolean(g.dans_famille_disciple),
    interetBapteme: g.interet_bapteme || false,
    commentaire: g.commentaire || "",
    commentaireSuivi: isFreshUnassigned ? "" : (g.commentaire_suivi || "").replace(/\[[A-Za-z0-9_]+:[^\]]*\]\s*/gi, "").replace(/\[(?:FAUX_NUMERO|NE_DECROCHE_PAS)\]\s*/gi, "").trim(),
    raisonEchec: isFreshUnassigned ? "" : (g.raison_echec || (g.commentaire_suivi?.match(/\[RAISON_ECHEC:\s*([^\]]+)\]/i)?.[1]?.trim() || "")),
    piliers1: isFreshUnassigned ? false : (g.piliers_1 ?? false),
    piliers2: isFreshUnassigned ? false : (g.piliers_2 ?? false),
    piliers3: isFreshUnassigned ? false : (g.piliers_3 ?? false),
    piliers4: isFreshUnassigned ? false : (g.piliers_4 ?? false),
    termine12Piliers: isFreshUnassigned ? false : (g.termine_12_piliers ?? false),
    pays: g.pays || (g.commentaire?.match(/\[(?:Pays de résidence|Pays)\s*:\s*([^\]]+)\]/i)?.[1]?.trim() || "Belgique"),
    souhaitSuivi: isFreshUnassigned ? false : (g.souhait_suivi ?? false),
    rdvPastoral: isFreshUnassigned ? false : (g.rdv_pastoral ?? false),
    neDecrochePas: isFreshUnassigned ? false : Boolean(g.ne_decroche_pas || /\[NE_DECROCHE_PAS\]/i.test(g.commentaire_suivi || "")),
    fauxNumero: isFreshUnassigned ? false : Boolean(g.faux_numero || /\[FAUX_NUMERO\]/i.test(g.commentaire_suivi || "")),
    archived: g.archived || false,
    created_by: g.created_by,
    famille_disciple: g.famille_disciple || "AUCUNE",
    etatCivil: g.etat_civil || "Célibataire",
    souhaiteEtreContacte: g.souhaite_etre_contacte !== false
  };
}

function InvitesPage() {
  const { notify, confirm } = useFeedback();
  const saveLock = useRef(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const handlePhoneKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (
      [46, 8, 9, 27, 13].includes(e.keyCode) ||
      (e.keyCode === 65 && (e.ctrlKey === true || e.metaKey === true)) || // Ctrl+A
      (e.keyCode === 67 && (e.ctrlKey === true || e.metaKey === true)) || // Ctrl+C
      (e.keyCode === 86 && (e.ctrlKey === true || e.metaKey === true)) || // Ctrl+V
      (e.keyCode === 88 && (e.ctrlKey === true || e.metaKey === true)) || // Ctrl+X
      (e.keyCode >= 35 && e.keyCode <= 39) // Fin, Début, Flèches
    ) {
      return;
    }
    const allowedChars = /[0-9+\-\s()]/;
    if (!allowedChars.test(e.key)) {
      e.preventDefault();
    }
  };

  const handlePhoneChange = (val: string) => {
    return val.replace(/[^0-9+\-\s()]/g, "");
  };

  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  useEffect(() => { if (isAddModalOpen) setFormError(""); }, [isAddModalOpen]);
  const [isCountryModalOpen, setIsCountryModalOpen] = useState(false);
  const [isCrModalOpen, setIsCrModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [churchName, setChurchName] = useState("CHARLEROI");
  const [editingGuestId, setEditingGuestId] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [currentView, setCurrentView] = useState<'list' | 'stats' | 'families'>('list');
  const [expandedFamilies, setExpandedFamilies] = useState<Record<string, boolean>>({
    "FAMILLE DE NOÉ": true,
    "FAMILLE DE DAVID": true,
    "FAMILLE CHARIS": true,
    "FAMILLE IT'S TIME": true,
    "FAMILLE GÉNÉRATION JOSUÉ": true,
    "FAMILLE DE MOÏSE": true,
    "AUCUNE": true,
  });
  const [arrivalDatesFilter, setArrivalDatesFilter] = useState<string[]>([]);
  const [isArrivalDateModalOpen, setIsArrivalDateModalOpen] = useState(false);
  const [arrivalMonth, setArrivalMonth] = useState<string>("all");
  const [arrivalYear, setArrivalYear] = useState<string>("all");
  const [presenceDatesFilter, setPresenceDatesFilter] = useState<string[]>([]);
  const [localChurchFilter, setLocalChurchFilter] = useState<string>("all");
  const [familyFilter, setFamilyFilter] = useState<string>("all");
  // Table mode removed per user request
  const [userRole, setUserRole] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const info = getActiveUserInfo();
    if (info?.role) return info.role;
    try {
      const s = localStorage.getItem("poimen_user_info");
      return s ? JSON.parse(s)?.role || null : null;
    } catch { return null; }
  });
  const router = useRouter();
  const userRoleClean = useMemo(() => (userRole || "").toLowerCase().trim(), [userRole]);

  useEffect(() => {
    // Restrict access: only leader (responsable or second) and admin/family leader can access Invités
    if (userRoleClean) {
      const isLeader = 
        userRoleClean === "integration_responsable" || 
        userRoleClean === "integration_second" || 
        userRoleClean === "super_admin" || 
        userRoleClean === "admin" ||
        userRoleClean === "berger" ||
        userRoleClean === "second";
      if (!isLeader) {
        router.replace("/dashboard/affectation");
      }
    }
  }, [userRoleClean, router]);
  const canAddOrEditInvites = 
    userRoleClean === "integration_responsable" || 
    userRoleClean === "integration_second" ||
    userRoleClean === "integration_conseiller" ||
    userRoleClean === "conseiller";
  const [userName, setUserName] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const info = getActiveUserInfo();
    if (info?.firstName || info?.lastName) {
      return [info.firstName, info.lastName].filter(Boolean).join(" ");
    }
    try {
      const s = localStorage.getItem("poimen_user_info");
      if (s) {
        const parsed = JSON.parse(s);
        return [parsed.firstName, parsed.lastName].filter(Boolean).join(" ") || null;
      }
      return null;
    } catch { return null; }
  });
  const [userId, setUserId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const info = getActiveUserInfo();
    if (info?.id) return info.id;
    try {
      const s = localStorage.getItem("poimen_user_info");
      return s ? JSON.parse(s)?.id || null : null;
    } catch { return null; }
  });
  const [familyId, setFamilyId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const ctx = getActiveContext();
    if (ctx?.context_type === "integration") return null;
    try {
      const s = localStorage.getItem("selected_family");
      return s ? JSON.parse(s)?.id || null : null;
    } catch { return null; }
  });
  const [churchId, setChurchId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const info = getActiveUserInfo();
    if (info?.church_id) return info.church_id;
    const ctx = getActiveContext();
    if (ctx?.church_id) return ctx.church_id;
    try {
      const s = localStorage.getItem("selected_church");
      return s ? JSON.parse(s)?.id || null : null;
    } catch { return null; }
  });
  const [loading, setLoading] = useState(true);
  const [guests, setGuests] = useState<Guest[]>([]);
  const personView = usePeopleView(guests);
  const { createRequested, acknowledgeCreate } = personView;
  useEffect(() => {
    if (!createRequested || loading) return;
    if (canAddOrEditInvites) setIsAddModalOpen(true);
    acknowledgeCreate();
  }, [createRequested, loading, canAddOrEditInvites, acknowledgeCreate]);
  const [responsibles, setResponsibles] = useState<string[]>(["Non assigné"]);
  const [counselors, setCounselors] = useState<{ id: string; display_name: string; email: string }[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [selectedDetailGuest, setSelectedDetailGuest] = useState<Guest | null>(null);
  const [deletingGuest, setDeletingGuest] = useState<Guest | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [isConseiller, setIsConseiller] = useState(() => {
    if (typeof window === "undefined") return false;
    const info = getActiveUserInfo();
    const rLower = (info?.role || "").toLowerCase().trim();
    return info?.isConseiller === true || rLower === "integration_conseiller" || rLower === "conseiller";
  });
  const [canDispatchAll, setCanDispatchAll] = useState(() => {
    if (typeof window === "undefined") return false;
    const info = getActiveUserInfo();
    return Boolean(info?.canDispatchAll || (info as any)?.metadata?.can_dispatch_all);
  });
  const [showCorbeille, setShowCorbeille] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const isIntegrationOrCounselor = useMemo(() => {
    return userRoleClean.startsWith("integration_") || userRoleClean === "conseiller" || isConseiller;
  }, [userRoleClean, isConseiller]);

  const isIntegrationLeader = useMemo(() => {
    return userRoleClean === "integration_responsable" || userRoleClean === "integration_second" || userRoleClean === "admin" || userRoleClean === "super_admin";
  }, [userRoleClean]);

  const canViewCr = useMemo(() => {
    return isIntegrationLeader || canDispatchAll;
  }, [isIntegrationLeader, canDispatchAll]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const shouldLock = isAddModalOpen || editingGuestId !== null || confirmDeleteId !== null;
    if (shouldLock) {
      document.documentElement.classList.add("no-scroll");
      document.body.classList.add("no-scroll");
    } else {
      document.documentElement.classList.remove("no-scroll");
      document.body.classList.remove("no-scroll");
    }
    return () => {
      document.documentElement.classList.remove("no-scroll");
      document.body.classList.remove("no-scroll");
    };
  }, [isAddModalOpen, editingGuestId, confirmDeleteId]);

  useEffect(() => {
    const activeContext = getActiveContext();
    const activeUserInfo = getActiveUserInfo();
    const userInfoStr = activeUserInfo ? JSON.stringify(activeUserInfo) : localStorage.getItem("poimen_user_info");
    if (userInfoStr) {
      try {
        const parsed = JSON.parse(userInfoStr);
        setUserRole(parsed.role);
        setUserId(parsed.id);
        const rLower = (parsed.role || "").toLowerCase().trim();
        setIsConseiller(parsed.isConseiller === true || rLower === "integration_conseiller" || rLower === "conseiller");
        setCanDispatchAll(Boolean(parsed.canDispatchAll || parsed.metadata?.can_dispatch_all));
        
        let cId = parsed.church_id;
        try {
          const savedChurch = localStorage.getItem("selected_church");
          if (savedChurch) {
            const sc = JSON.parse(savedChurch);
            if (!cId) cId = sc.id;
            if (sc.name) setChurchName(sc.name);
          }
        } catch {}
        setChurchId(cId);
        
        // Robust name generation
        const firstName = (parsed.firstName || "").trim();
        const lastName = (parsed.lastName || "").trim();
        const name = [firstName, lastName].filter(Boolean).join(" ");
        
        if (name) {
          setUserName(name);
        }
      } catch (e) {
        console.error("Error parsing user info", e);
      }
    }
    const fam = activeContext?.context_type === "integration" ? null : localStorage.getItem("selected_family");
    if (fam) {
      const parsedFam = JSON.parse(fam);
      setFamilyId(parsedFam.id);
    }
  }, []);

  useEffect(() => {
    if (familyId || (isIntegrationOrCounselor && churchId)) {
      fetchGuests();
      fetchResponsibles();
      syncUserRole();

      // Realtime subscription for instant sync
      const channel = supabase
        .channel('invites_changes')
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'invites' 
        }, (payload) => {
          console.log("Change detected in Realtime:", payload);
          fetchGuests(); // Refresh list on any change
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [familyId, isIntegrationOrCounselor, churchId]);

  const syncUserRole = async () => {
    const activeContext = getActiveContext();
    const userInfo = getActiveUserInfo() || JSON.parse(localStorage.getItem("poimen_user_info") || "{}");
    const userEmail = userInfo.email?.toLowerCase();
    if (!userEmail) return;

    if (activeContext) {
      if (userRole !== userInfo.role) {
        setUserRole(userInfo.role);
      }
      return;
    }

    // 1. Essayer de récupérer le rôle depuis la table profiles (officiel pour les connexions)
    const { data: profData, error: profErr } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userInfo.id || "")
      .single();

    if (!profErr && profData) {
      if (userRole !== profData.role) {
        console.log("Synchronized role from profiles:", profData.role);
        setUserRole(profData.role);
      }
      const updatedInfo = { ...userInfo, role: profData.role };
      localStorage.setItem("poimen_user_info", JSON.stringify(updatedInfo));
      return;
    }

    // 2. Repli vers la table members si profiles échoue
    const { data: memData, error: memErr } = await supabase
      .from("members")
      .select("status")
      .eq("email", userEmail)
      .single();

    if (!memErr && memData) {
      console.log("Synchronized role from members:", memData.status);
      setUserRole(memData.status);
      const updatedInfo = { ...userInfo, role: memData.status };
      localStorage.setItem("poimen_user_info", JSON.stringify(updatedInfo));
    }
  };

  const fetchResponsibles = async () => {
    if (isIntegrationOrCounselor) {
      if (!churchId) return;
      const res = await listIntegrationTeam(churchId);
      if (res.success && res.team) {
        setCounselors(res.team.map((t: any) => ({
          id: t.id,
          display_name: t.name,
          email: t.email
        })));
        const myEntry = res.team.find((t: any) => t.id === userId);
        if (myEntry && myEntry.canDispatchAll !== undefined) {
          setCanDispatchAll(Boolean(myEntry.canDispatchAll));
        }
      }
      return;
    }

    if (!familyId) return;
    const { data, error } = await supabase
      .from("members")
      .select("first_name, last_name, status, email")
      .eq("bergerie_id", familyId);
    
    if (!error && data) {
      // Auto-add safety net: check if current user is in members
      const userInfo = getActiveUserInfo() || JSON.parse(localStorage.getItem("poimen_user_info") || "{}");
      const userEmail = userInfo.email?.toLowerCase();
      const userRoleVal = (userInfo.role || "").toLowerCase();
      const isLeader = userRoleVal.includes("berger") || userRoleVal.includes("second") || userRoleVal.includes("responsable");
      
      const me = data.find(m => m.email?.toLowerCase() === userEmail);
      if (!me && isLeader && userEmail) {
        // Add me to members table via Server Action
        const res = await autoAddLeaderToMembers({
          bergerie_id: familyId,
          first_name: userInfo.firstName || "Leader",
          last_name: userInfo.lastName || "User",
          email: userEmail,
          status: userInfo.role,
          civility: "M."
        });
        
        if (!res.success) {
          console.error("Error adding me to members via Server Action:", res.error);
        } else {
          fetchResponsibles(); // Refresh to include me
        }
      }

      const leaders = data.filter(m => {
        const s = (m.status || "").toLowerCase();
        return s.includes("berger") || s.includes("second") || s.includes("responsable");
      });
      const names = leaders.map(m => [m.first_name, m.last_name].map(s => s?.trim()).filter(Boolean).join(" "));
      const uniqueNames = ["Non assigné", ...new Set(names)];
      setResponsibles(uniqueNames);

      // If userName is still empty, try to find current user in the list to sync the name
      if (!userName) {
          const userInfo = getActiveUserInfo() || JSON.parse(localStorage.getItem("poimen_user_info") || "{}");
        const userEmail = userInfo.email?.toLowerCase();
        const me = data.find(m => m.email?.toLowerCase() === userEmail);
        if (me) {
          const myName = [me.first_name, me.last_name].map(s => s?.trim()).filter(Boolean).join(" ");
          if (myName) {
            setUserName(myName);
          }
        }
      }
    }
  };

  const isFetchingRef = useRef(false);
  const fetchGuests = async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setLoading(true);
    try {
      let query = supabase.from("invites").select("*");
      
      if (isIntegrationOrCounselor) {
        if (churchId) {
          const res = await getIntegrationInvites(churchId);
          if (res.success && res.invites) {
            setGuests(res.invites.map(mapDbGuestToGuest));
            if (res.canDispatchAll !== undefined) {
              setCanDispatchAll(Boolean(res.canDispatchAll));
            }
            return;
          }
          query = query.eq("church_id", churchId);
          if ((userRoleClean === "integration_conseiller" || userRoleClean === "conseiller") && userId && !canDispatchAll) {
            query = query.or(`created_by.eq.${userId},assigned_to.eq.${userId}`);
          }
        } else {
          return;
        }
      } else {
        if (familyId) {
          query = query.eq("bergerie_id", familyId);
          if (userRoleClean === "conseiller" && userId) {
            query = query.or(`created_by.eq.${userId},assigned_to.eq.${userId}`);
          }
        } else {
          return;
        }
      }

      const { data: dbGuests, error } = await query.order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching guests:", error?.message || error?.details || error);
      } else {
        setGuests((dbGuests || []).map(mapDbGuestToGuest));
      }
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
    }
  };

  const [newGuest, setNewGuest] = useState<Partial<Guest>>({
    civility: "M.",
    firstName: "",
    lastName: "",
    age: "26-30 ans",
    phone: "",
    email: "",
    pays: "Belgique",
    address: "",
    arrivalDate: new Date().toISOString().split('T')[0],
    event: "Culte",
    aps: false,
    localChurch: false,
    autreEglise: "",
    responsible: "Non assigné",
    aEteInvite: false,
    parQui: "",
    baptemeEau: false,
    piliers1: false,
    piliers2: false,
    piliers3: false,
    piliers4: false,
    termine12Piliers: false,
    souhaitSuivi: false,
    rdvPastoral: false,
    neDecrochePas: false,
    fauxNumero: false,
    interetFormation: false,
    interetCDM: false,
    interetBapteme: false,
    commentaire: "",
    commentaireSuivi: "",
    raisonEchec: "",
    famille_disciple: "AUCUNE",
    etatCivil: "Célibataire",
    souhaiteEtreContacte: true,
  });

  const toggleAttendance = async (guestId: string, day: string) => {
    const guest = guests.find(g => g.id === guestId);
    if (!guest) return;

    const isIntegrationLeader = userRoleClean === "integration_responsable" || userRoleClean === "integration_second";
    const isAssignedCounselor = guest.assigned_to === userId && (userRoleClean === "integration_conseiller" || userRoleClean === "conseiller");
    const isCreator = guest.created_by === userId && (userRoleClean === "integration_conseiller" || userRoleClean === "conseiller");
    
    const canEdit = canModifyInvites || isIntegrationLeader || isAssignedCounselor || isCreator;
    if (!canEdit) return;

    const newAttendance = { ...guest.attendance, [day]: !guest.attendance[day] };
    setGuests(prev => prev.map(g => g.id === guestId ? { ...g, attendance: newAttendance } : g));
    await supabase.from("invites").update({ attendance: newAttendance }).eq("id", guestId);
  };

  const toggleSuivi = async (guestId: string, field: keyof Guest) => {
    const guest = guests.find(g => g.id === guestId);
    if (!guest) return;

    const isIntegrationLeader = userRoleClean === "integration_responsable" || userRoleClean === "integration_second";
    const isAssignedCounselor = guest.assigned_to === userId && (userRoleClean === "integration_conseiller" || userRoleClean === "conseiller");
    const isCreator = guest.created_by === userId && (userRoleClean === "integration_conseiller" || userRoleClean === "conseiller");
    
    const canEdit = canModifyInvites || isIntegrationLeader || isAssignedCounselor || isCreator;
    if (!canEdit) return;

    const newValue = !guest[field];
    const extraUpdates: Partial<Guest> = {};
    const dbExtraUpdates: Record<string, any> = {};

    if (field === "fauxNumero") {
      extraUpdates.appelAbouti = false;
      dbExtraUpdates.appel_abouti = false;
      const tag = "[FAUX_NUMERO]";
      const cur = guest.commentaireSuivi || "";
      const updatedComment = newValue
        ? (cur.includes(tag) ? cur : `${tag} ${cur}`.trim())
        : cur.replace(new RegExp(`\\s*\\${tag}\\s*`, "g"), " ").trim();
      extraUpdates.commentaireSuivi = updatedComment;
      dbExtraUpdates.commentaire_suivi = updatedComment;
    }
    if (field === "neDecrochePas") {
      const tag = "[NE_DECROCHE_PAS]";
      const cur = guest.commentaireSuivi || "";
      const updatedComment = newValue
        ? (cur.includes(tag) ? cur : `${tag} ${cur}`.trim())
        : cur.replace(new RegExp(`\\s*\\${tag}\\s*`, "g"), " ").trim();
      extraUpdates.commentaireSuivi = updatedComment;
      dbExtraUpdates.commentaire_suivi = updatedComment;
    }
    if (field === "appelAbouti" && newValue) {
      extraUpdates.fauxNumero = false;
      dbExtraUpdates.faux_numero = false;
      const cur = guest.commentaireSuivi || "";
      const cleaned = cur.replace(/\[FAUX_NUMERO\]/g, "").trim();
      extraUpdates.commentaireSuivi = cleaned;
      dbExtraUpdates.commentaire_suivi = cleaned;
    }

    setGuests(prev => prev.map(g => g.id === guestId ? { ...g, [field]: newValue, ...extraUpdates } : g));

    const dbFieldMap: Record<string, string> = {
      appelAbouti: "appel_abouti",
      groupeWhatsapp: "groupe_whatsapp",
      prevuRevenir: "prevu_revenir",
      estRevenuCulte: "est_revenu_culte",
      rencontreEffectuee: "rencontre_effectuee",
      visiteDomicile: "visite_domicile",
      cocktailBienvenue: "cocktail_bienvenue",
      pcnc: "pcnc",
      p101: "p101",
      p201: "p201",
      p301: "p301",
      terminePCNC: "termine_pcnc",
      piliers1: "piliers_1",
      piliers2: "piliers_2",
      piliers3: "piliers_3",
      piliers4: "piliers_4",
      termine12Piliers: "termine_12_piliers",
      souhaitSuivi: "souhait_suivi",
      rdvPastoral: "rdv_pastoral",
      neDecrochePas: "ne_decroche_pas",
      fauxNumero: "faux_numero",
      interetCDM: "interet_cdm",
      integreCDM: "integre_cdm",
      prierePartage: "priere_partage",
      dansFamilleDisciple: "dans_famille_disciple",
      interetBapteme: "interet_bapteme",
      baptemeEau: "bapteme_eau",
      baptemeEsprit: "bapteme_esprit",
      veutServir: "veut_servir",
      devenuStar: "devenu_star",
      smsBienvenue: "sms_bienvenue",
      priere: "priere",
      interetEvenement: "interet_evenement",
      interetFormation: "interet_formation",
      aEteInvite: "a_ete_invite"
    };

    const dbField = dbFieldMap[field as string] || field;
    const updateObj: Record<string, any> = { [dbField]: newValue, ...dbExtraUpdates };
    try {
      const { error } = await supabase.from("invites").update(updateObj).eq("id", guestId);
      if (error) {
        console.warn("Champs Supabase non encore disponible ou erreur:", error.message);
        if (dbExtraUpdates.commentaire_suivi) {
          const fallbackObj: Record<string, any> = { commentaire_suivi: dbExtraUpdates.commentaire_suivi };
          if (dbExtraUpdates.appel_abouti !== undefined) fallbackObj.appel_abouti = dbExtraUpdates.appel_abouti;
          await supabase.from("invites").update(fallbackObj).eq("id", guestId);
        }
      }
    } catch (err) {
      console.warn("Erreur mise à jour suivi:", err);
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("poimen:soul-updated", { detail: { guestId } }));
      window.dispatchEvent(new CustomEvent("poimen-session-change"));
    }
  };

  const handleSaveGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saveLock.current) return;
    saveLock.current = true;
    setIsSaving(true);
    setFormError("");
    try {
    if (!familyId && !churchId) return;

    const payload: any = {
      civility: newGuest.civility,
      first_name: newGuest.firstName,
      last_name: newGuest.lastName,
      age: newGuest.age,
      phone: newGuest.phone,
      email: newGuest.email,
      pays: newGuest.pays || "Belgique",
      address: newGuest.address,
      arrival_date: newGuest.arrivalDate,
      event: newGuest.event,
      aps: newGuest.aps,
      local_church: newGuest.localChurch,
      autre_eglise: newGuest.localChurch ? (newGuest.autreEglise?.trim() || null) : null,
      responsible: newGuest.responsible,
      a_ete_invite: newGuest.aEteInvite,
      par_qui: newGuest.parQui,
      bapteme_eau: newGuest.baptemeEau,
      piliers_1: newGuest.piliers1 || false,
      piliers_2: newGuest.piliers2 || false,
      piliers_3: newGuest.piliers3 || false,
      piliers_4: newGuest.piliers4 || false,
      termine_12_piliers: newGuest.termine12Piliers || false,
      souhait_suivi: newGuest.souhaitSuivi || false,
      rdv_pastoral: newGuest.rdvPastoral || false,
      ne_decroche_pas: newGuest.neDecrochePas || false,
      faux_numero: newGuest.fauxNumero || false,
      interet_formation: newGuest.interetFormation,
      interet_cdm: newGuest.interetCDM,
      integre_cdm: newGuest.integreCDM,
      priere_partage: newGuest.prierePartage,
      dans_famille_disciple: editingGuestId ? (newGuest.dansFamilleDisciple || false) : false,
      interet_bapteme: newGuest.interetBapteme,
      commentaire: newGuest.commentaire,
      commentaire_suivi: newGuest.commentaireSuivi || "",
      famille_disciple: editingGuestId ? (newGuest.famille_disciple || "AUCUNE") : "AUCUNE",
      etat_civil: newGuest.etatCivil || "Célibataire",
      souhaite_etre_contacte: newGuest.souhaiteEtreContacte !== false
    };

    if (userRoleClean.startsWith("integration_")) {
      payload.church_id = churchId;
      payload.bergerie_id = null;
    } else {
      payload.bergerie_id = familyId;
    }

    if (editingGuestId) {
      if (userRoleClean.startsWith("integration_")) {
        payload.assigned_to = newGuest.assigned_to || null;
      } else {
        payload.responsible = newGuest.responsible || "Non assigné";
      }
    } else {
      payload.assigned_to = null;
      payload.responsible = "Non assigné";
      payload.created_by = userId;
    }

    if (editingGuestId) {
      let { error } = await supabase
        .from("invites")
        .update(payload)
        .eq("id", editingGuestId);

      // Fallback if column autre_eglise, pays, or piliers does not exist yet in database
      if (error && (error.message.includes("autre_eglise") || error.message.includes("pays") || error.message.includes("piliers") || error.message.includes("souhait_suivi") || error.message.includes("rdv_pastoral") || error.message.includes("ne_decroche_pas") || error.message.includes("faux_numero") || error.code === "42703" || error.code === "PGRST204")) {
        const fallbackPayload = { ...payload };
        delete fallbackPayload.autre_eglise;
        delete fallbackPayload.pays;
        delete fallbackPayload.piliers_1;
        delete fallbackPayload.piliers_2;
        delete fallbackPayload.piliers_3;
        delete fallbackPayload.piliers_4;
        delete fallbackPayload.termine_12_piliers;
        delete fallbackPayload.souhait_suivi;
        delete fallbackPayload.rdv_pastoral;
        delete fallbackPayload.ne_decroche_pas;
        delete fallbackPayload.faux_numero;
        const res = await supabase.from("invites").update(fallbackPayload).eq("id", editingGuestId);
        error = res.error;
      }

      if (error) {
        setFormError("Erreur lors de la modification : " + error.message);
        return;
      } else {
        fetchGuests();
        notify("La fiche a bien été enregistrée.");
        setIsAddModalOpen(false);
        setEditingGuestId(null);
      }
    } else {
      if (!userRoleClean.startsWith("integration_")) {
        payload.commentaire_suivi = "";
      }
      let { data: inserted, error } = await supabase
        .from("invites")
        .insert(payload)
        .select()
        .single();

      // Fallback if column autre_eglise, pays, or piliers does not exist yet in database
      if (error && (error.message.includes("autre_eglise") || error.message.includes("pays") || error.message.includes("piliers") || error.message.includes("souhait_suivi") || error.message.includes("rdv_pastoral") || error.message.includes("ne_decroche_pas") || error.message.includes("faux_numero") || error.code === "42703" || error.code === "PGRST204")) {
        const fallbackPayload = { ...payload };
        delete fallbackPayload.autre_eglise;
        delete fallbackPayload.pays;
        delete fallbackPayload.piliers_1;
        delete fallbackPayload.piliers_2;
        delete fallbackPayload.piliers_3;
        delete fallbackPayload.piliers_4;
        delete fallbackPayload.termine_12_piliers;
        delete fallbackPayload.souhait_suivi;
        delete fallbackPayload.rdv_pastoral;
        delete fallbackPayload.ne_decroche_pas;
        delete fallbackPayload.faux_numero;
        const res = await supabase.from("invites").insert(fallbackPayload).select().single();
        inserted = res.data;
        error = res.error;
      }

      if (error) {
        setFormError("Erreur lors de l'ajout : " + error.message);
        return;
      } else if (inserted) {
        fetchGuests();
        notify("La fiche a bien été enregistrée.");
        setIsAddModalOpen(false);
      }
    }

    setNewGuest({
      civility: "M.",
      firstName: "",
      lastName: "",
      age: "26-30 ans",
      phone: "",
      email: "",
      pays: "Belgique",
      address: "",
      arrivalDate: new Date().toISOString().split('T')[0],
      event: "Culte",
      aps: false,
      localChurch: false,
      autreEglise: "",
      responsible: "Non assigné",
      aEteInvite: false,
      parQui: "",
      baptemeEau: false,
      piliers1: false,
      piliers2: false,
      piliers3: false,
      piliers4: false,
      termine12Piliers: false,
      souhaitSuivi: false,
      rdvPastoral: false,
      neDecrochePas: false,
      fauxNumero: false,
      interetFormation: false,
      interetCDM: false,
      commentaire: "",
      commentaireSuivi: "",
      famille_disciple: "AUCUNE",
      etatCivil: "Célibataire",
      souhaiteEtreContacte: true,
    });
    } catch {
      setFormError("L’enregistrement a échoué. Votre saisie est conservée ; vérifiez votre connexion et réessayez.");
    } finally {
      saveLock.current = false;
      setIsSaving(false);
    }
  };

  const handleDeleteGuest = async (id: string) => {
    setDeleteError(null);
    setIsDeleting(true);
    try {
      const guest = guests.find(g => g.id === id);
      const isFamilyRole = !userRoleClean.startsWith("integration_") && userRoleClean !== "super_admin";
      
      if (isFamilyRole && guest && guest.church_id) {
        const { error } = await supabase
          .from("invites")
          .update({
            bergerie_id: null,
            dans_famille_disciple: false,
            responsible: "Non assigné"
          })
          .eq("id", id);
        if (error) throw error;
        setGuests(prev => prev.filter(g => g.id !== id));
        setDeletingGuest(null);
      } else {
        // Try archiving first (requires 'archived' column in DB)
        const { error } = await supabase
          .from("invites")
          .update({ archived: true })
          .eq("id", id);
        if (error) {
          // If the 'archived' column doesn't exist yet (PGRST204), fall back to direct deletion
          if (error.code === 'PGRST204' || error.message?.includes('archived')) {
            await handlePermanentDeleteGuest(id);
            return;
          }
          throw error;
        }
        setGuests(prev => prev.map(g => g.id === id ? { ...g, archived: true } : g));
        setDeletingGuest(null);
      }
    } catch (err: any) {
      console.error("Error archiving/deleting guest:", err);
      setDeleteError(err.message || String(err));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRestoreGuest = async (id: string) => {
    try {
      const { error } = await supabase
        .from("invites")
        .update({ archived: false })
        .eq("id", id);
      if (error) {
        if (error.code === 'PGRST204' || error.message?.includes('archived')) {
          notify("La colonne 'archived' n'existe pas encore en base de données. Veuillez appliquer le patch SQL v2.5.");
          return;
        }
        throw error;
      }
      setGuests(guests.map(g => g.id === id ? { ...g, archived: false } : g));
    } catch (err: any) {
      console.error("Error restoring guest:", err);
      notify("Erreur lors de la restauration de l'invité : " + (err.message || err));
    }
  };

  const handlePermanentDeleteGuest = async (id: string) => {
    setDeleteError(null);
    setIsDeleting(true);
    try {
      const guest = guests.find(g => g.id === id);
      const isFamilyRole = !userRoleClean.startsWith("integration_") && userRoleClean !== "super_admin";
      
      if (isFamilyRole && guest && guest.church_id) {
        const { error } = await supabase
          .from("invites")
          .update({
            bergerie_id: null,
            dans_famille_disciple: false,
            responsible: "Non assigné"
          })
          .eq("id", id);
        if (error) throw error;
        setGuests(prev => prev.filter(g => g.id !== id));
        setDeletingGuest(null);
      } else {
        const { error } = await supabase
          .from("invites")
          .delete()
          .eq("id", id);
        if (error) throw error;
        setGuests(prev => prev.filter(g => g.id !== id));
        setDeletingGuest(null);
      }
    } catch (err: any) {
      console.error("Error permanent deleting guest:", err);
      setDeleteError(err.message || String(err));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSelfAssign = async (guestId: string) => {
    if (userRoleClean.startsWith("integration_") || counselors.length > 0) {
      if (userId) {
        const counselorObj = counselors.find(c => c.id === userId);
        const myName = counselorObj?.display_name || userName || "";
        const updatePayload: any = { assigned_to: userId };
        if (myName) updatePayload.responsible = myName;

        const { error } = await supabase
          .from("invites")
          .update(updatePayload)
          .eq("id", guestId);
        if (error) {
          notify("Erreur lors de l'affectation : " + error.message);
        } else {
          setGuests(prev => prev.map(g => g.id === guestId ? { ...g, assigned_to: userId, ...(myName ? { responsible: myName } : {}) } : g));
          notify("Âme affectée à vous-même avec succès !");
          window.dispatchEvent(new CustomEvent("poimen:soul-updated", { detail: { guestId } }));
        }
      }
    } else {
      if (userName) {
        const { error } = await supabase
          .from("invites")
          .update({ responsible: userName })
          .eq("id", guestId);
        if (error) {
          notify("Erreur lors de l'affectation : " + error.message);
        } else {
          setGuests(prev => prev.map(g => g.id === guestId ? { ...g, responsible: userName } : g));
          notify("Âme affectée à vous-même avec succès !");
          window.dispatchEvent(new CustomEvent("poimen:soul-updated", { detail: { guestId } }));
        }
      }
    }
  };

  const handleAssignCounselor = async (guestId: string, counselorId: string | null) => {
    const counselorObj = counselors.find(c => c.id === counselorId);
    const respName = counselorObj ? counselorObj.display_name : (counselorId ? "" : "Non assigné");

    setGuests(prev => prev.map(g => g.id === guestId ? {
      ...g,
      assigned_to: counselorId,
      ...(respName ? { responsible: respName } : {})
    } : g));

    if (churchId) {
      const serverRes = await assignCounselorToGuest({
        churchId,
        guestId,
        counselorId
      });
      if (serverRes.success) {
        notify(counselorObj ? `Âme affectée à ${counselorObj.display_name}` : "Affectation réinitialisée");
        window.dispatchEvent(new CustomEvent("poimen:soul-updated", { detail: { guestId } }));
        return;
      }
    }

    const updatePayload: Record<string, any> = { assigned_to: counselorId };
    if (respName) {
      updatePayload.responsible = respName;
    }

    const { error } = await supabase.from("invites").update(updatePayload).eq("id", guestId);
    if (error) {
      notify("Erreur lors de l'affectation : " + error.message);
    } else {
      notify(counselorObj ? `Âme affectée à ${counselorObj.display_name}` : "Affectation réinitialisée");
      window.dispatchEvent(new CustomEvent("poimen:soul-updated", { detail: { guestId } }));
    }
  };


  const promoteToMember = async (guest: Guest) => {
    if (!familyId) return;
    
    if (!await confirm(`Voulez-vous vraiment transformer ${guest.firstName} ${guest.lastName} en membre de la Bergerie ?`)) return;

    setLoading(true);
    try {
      // 1. Insert into members
      const { error: insertError } = await supabase.from("members").insert({
        bergerie_id: familyId,
        civility: guest.civility,
        first_name: guest.firstName,
        last_name: guest.lastName,
        age: guest.age,
        phone: guest.phone,
        email: guest.email,
        status: "Brebi",
        attendance: {},
        responsible: guest.responsible === "Non assigné" ? null : guest.responsible
      });

      if (insertError) throw insertError;

      // 2. Mark as in bergerie in invites (DO NOT DELETE as per user request)
      const { error: updateError } = await supabase.from("invites").update({ is_in_bergerie: true, status: "Brebi", dans_famille_disciple: true }).eq("id", guest.id);
      if (updateError) throw updateError;

      // 3. Refresh list
      await fetchGuests();
      notify(`${guest.firstName} a été ajouté à la Bergerie avec succès !`);
    } catch (err: any) {
      console.error("Promotion error:", err);
      notify("Erreur lors de l'ajout à la bergerie : " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const removeFromMember = async (guest: Guest) => {
    if (!familyId) return;
    
    if (!await confirm(`Voulez-vous vraiment retirer ${guest.firstName} ${guest.lastName} de la Bergerie ?`)) return;

    setLoading(true);
    try {
      // 1. Delete from members
      // We match by personal info since we don't have a linked ID
      const { error: deleteError } = await supabase.from("members")
        .delete()
        .eq("bergerie_id", familyId)
        .eq("first_name", guest.firstName)
        .eq("last_name", guest.lastName)
        .or(`phone.eq."${guest.phone}",email.eq."${guest.email}"`);

      if (deleteError) throw deleteError;

      // 2. Mark as NOT in bergerie in invites
      const { error: updateError } = await supabase.from("invites").update({ is_in_bergerie: false, dans_famille_disciple: false }).eq("id", guest.id);
      if (updateError) throw updateError;

      // 3. Refresh list
      await fetchGuests();
      notify(`${guest.firstName} a été retiré de la Bergerie.`);
    } catch (err: any) {
      console.error("Removal error:", err);
      notify("Erreur lors du retrait : " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (guest: Guest) => {
    setEditingGuestId(guest.id);
    setNewGuest({
      civility: guest.civility,
      firstName: guest.firstName,
      lastName: guest.lastName,
      age: guest.age,
      phone: guest.phone,
      email: guest.email,
      pays: guest.pays || "Belgique",
      address: guest.address,
      arrivalDate: guest.arrivalDate,
      event: guest.event || "Culte",
      aps: guest.aps,
      localChurch: guest.localChurch,
      autreEglise: guest.autreEglise || "",
      responsible: guest.responsible || "Non assigné",
      assigned_to: guest.assigned_to || null,
      created_by: guest.created_by || null,
      aEteInvite: guest.aEteInvite,
      parQui: guest.parQui,
      baptemeEau: guest.baptemeEau,
      piliers1: guest.piliers1 ?? false,
      piliers2: guest.piliers2 ?? false,
      piliers3: guest.piliers3 ?? false,
      piliers4: guest.piliers4 ?? false,
      termine12Piliers: guest.termine12Piliers ?? false,
      souhaitSuivi: guest.souhaitSuivi ?? false,
      rdvPastoral: guest.rdvPastoral ?? false,
      neDecrochePas: guest.neDecrochePas ?? false,
      fauxNumero: guest.fauxNumero ?? false,
      interetFormation: guest.interetFormation,
      interetCDM: guest.interetCDM,
      integreCDM: guest.integreCDM,
      prierePartage: guest.prierePartage,
      dansFamilleDisciple: guest.dansFamilleDisciple,
      interetBapteme: guest.interetBapteme || false,
      commentaire: guest.commentaire || "",
      commentaireSuivi: guest.commentaireSuivi || "",
      famille_disciple: guest.famille_disciple || "AUCUNE",
      etatCivil: guest.etatCivil || "Célibataire",
      souhaiteEtreContacte: guest.souhaiteEtreContacte !== false
    });
    setIsAddModalOpen(true);
  };

  const getDaysOfMonth = (year: number, month: number, dayOfWeek: number) => {
    const dates = [];
    if (month === -1) {
      for (let m = 0; m < 12; m++) {
        let d = new Date(year, m, 1);
        while (d.getMonth() === m) {
          if (d.getDay() === dayOfWeek) {
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            dates.push(`${yyyy}-${mm}-${dd}`);
          }
          d.setDate(d.getDate() + 1);
        }
      }
    } else {
      let d = new Date(year, month, 1);
      while (d.getMonth() === month) {
        if (d.getDay() === dayOfWeek) {
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const dd = String(d.getDate()).padStart(2, '0');
          dates.push(`${yyyy}-${mm}-${dd}`);
        }
        d.setDate(d.getDate() + 1);
      }
    }
    return dates;
  };

  const thursdays = useMemo(() => getDaysOfMonth(selectedYear, selectedMonth, 4), [selectedMonth, selectedYear]);
  const sundays = useMemo(() => getDaysOfMonth(selectedYear, selectedMonth, 0), [selectedMonth, selectedYear]);

  const filtered = useMemo(() => {
    return guests.filter(g => {
      if (personView.filter === "contact" && (g.appelAbouti || g.fauxNumero || g.neDecrochePas || g.souhaiteEtreContacte === false)) return false;
      if (personView.filter === "unassigned" && (userRole?.startsWith("integration_") ? !!g.assigned_to : !!g.responsible && g.responsible !== "Non assigné")) return false;
      const fullName = `${g.firstName} ${g.lastName}`.toLowerCase();
      const matchSearch = fullName.includes(search.toLowerCase());
      const matchArchived = (g.archived || false) === showCorbeille;
      const matchesLocalChurch = localChurchFilter === "all" || 
        (localChurchFilter === "yes" && g.localChurch) || 
        (localChurchFilter === "no" && !g.localChurch);
      const matchesFamily = familyFilter === "all" || 
        (familyFilter === "AUCUNE" ? (!g.famille_disciple || g.famille_disciple === "AUCUNE") : g.famille_disciple === familyFilter);
      
      const matchesArrival = arrivalDatesFilter.length === 0 || 
        arrivalDatesFilter.some(d => g.arrivalDate && g.arrivalDate.startsWith(d));
      const matchesPresence = presenceDatesFilter.length === 0 || 
        presenceDatesFilter.some(d => Boolean(g.attendance && g.attendance[d] === true));

      return matchSearch && matchArchived && matchesLocalChurch && matchesFamily && matchesArrival && matchesPresence;
    });
  }, [guests, search, showCorbeille, localChurchFilter, familyFilter, arrivalDatesFilter, arrivalMonth, arrivalYear, presenceDatesFilter, personView.filter, userRole]);

  const canModifyInvites = useMemo(() => {
    if (!userRole) return false;
    const role = userRole.toLowerCase();
    return (
      role.includes("berger") ||
      role.includes("second") ||
      role.includes("responsable") ||
      role.includes("coordonnateur")
    );
  }, [userRole]);

  const guestsByFamily = useMemo(() => {
    const groups: Record<string, Guest[]> = {
      "FAMILLE DE NOÉ": [],
      "FAMILLE DE DAVID": [],
      "FAMILLE CHARIS": [],
      "FAMILLE IT'S TIME": [],
      "FAMILLE GÉNÉRATION JOSUÉ": [],
      "FAMILLE DE MOÏSE": [],
      "AUCUNE": [],
    };
    filtered.forEach(guest => {
      const fam = guest.famille_disciple || "AUCUNE";
      if (groups[fam]) {
        groups[fam].push(guest);
      } else {
        groups["AUCUNE"].push(guest);
      }
    });
    return groups;
  }, [filtered]);

  const availableYears = useMemo(() => {
    const years = guests
      .map(g => g.arrivalDate ? g.arrivalDate.split('-')[0] : null)
      .filter((y): y is string => !!y);
    const unique = Array.from(new Set(years)).sort().reverse();
    return unique.length > 0 ? unique : [new Date().getFullYear().toString()];
  }, [guests]);

  useEffect(() => {
    if (availableYears.length > 0) {
      const yearStrings = availableYears.map(y => y.toString());
      if (!yearStrings.includes(selectedYear.toString())) {
        setSelectedYear(parseInt(availableYears[0], 10));
      }
    }
  }, [availableYears, selectedYear]);

  const calculateRate = (guest: Guest, dates: string[]) => {
    const eligibleDates = guest.arrivalDate 
      ? filterElapsedDateKeys(dates).filter(d => d >= guest.arrivalDate)
      : filterElapsedDateKeys(dates);
    if (eligibleDates.length === 0) return 0;
    const presents = eligibleDates.filter(d => guest.attendance[d]).length;
    return Math.round((presents / eligibleDates.length) * 100);
  };

  const isFidelise = (guest: Guest) => {
    const rateCDM = calculateRate(guest, thursdays);
    const rateCulte = calculateRate(guest, sundays);
    return rateCDM >= 45 || rateCulte >= 45;
  };

  const statsBase = guests.filter(g => {
    if (g.archived) return false; // Ne pas inclure les archivés dans les stats générales
    const matchesArrival = arrivalDatesFilter.length === 0 || 
      arrivalDatesFilter.some(d => g.arrivalDate && g.arrivalDate.startsWith(d));
    const matchesPresence = presenceDatesFilter.length === 0 || 
      presenceDatesFilter.some(d => Boolean(g.attendance && g.attendance[d] === true));
    
    const userRoleLower = (userRole || "").toLowerCase();
    const isOnlyResponsable = userRoleLower === "responsable de brebi" || userRoleLower === "responsable";
    if (isOnlyResponsable && userName && g.responsible !== userName) return false;
    
    const matchesLocalChurch = localChurchFilter === "all" || 
      (localChurchFilter === "yes" && g.localChurch) || 
      (localChurchFilter === "no" && !g.localChurch);
      
    return matchesArrival && matchesPresence && matchesLocalChurch;
  });

  const brebisCount = statsBase.filter(g => g.status === "Brebi").length;
  const callsSuccess = statsBase.filter(g => g.appelAbouti).length;
  const noChurch = statsBase.filter(g => !g.localChurch).length;
  const apsCount = statsBase.filter(g => g.aps).length;
  const phoneCount = statsBase.filter(g => g.phone && g.phone.trim() !== "").length;
  const returnedCount = statsBase.filter(g => {
    if (g.estRevenuCulte) return true;
    const attendanceDates = Object.keys(g.attendance || {});
    return attendanceDates.some(d => {
      if (g.attendance[d] !== true || d <= g.arrivalDate) return false;
      const [year, month, day] = d.split('-').map(Number);
      const dateObj = new Date(year, month - 1, day);
      return dateObj.getDay() === 0;
    });
  }).length;
  const interetPCNC = statsBase.filter(g => g.interetFormation).length;
  const pcnc001 = statsBase.filter(g => g.pcnc).length;
  const pcnc101 = statsBase.filter(g => g.p101).length;
  const pcnc201 = statsBase.filter(g => g.p201).length;
  const pcnc301 = statsBase.filter(g => g.p301).length;
  const totalPCNC = statsBase.filter(g => g.pcnc || g.p101 || g.p201 || g.p301).length;
  const fidelisees = statsBase.filter(isFidelise).length;
  const dansFamilleDiscipleCount = statsBase.filter(g => g.dansFamilleDisciple).length;
  const integreCDMCount = statsBase.filter(g => g.integreCDM).length;
  const veutServirCount = statsBase.filter(g => g.veutServir).length;
  const devenuStarCount = statsBase.filter(g => g.devenuStar).length;
  const baptemeEauCount = statsBase.filter(g => g.baptemeEau).length;
  
  const familyNoeCount = statsBase.filter(g => g.famille_disciple === "FAMILLE DE NOÉ").length;
  const familyDavidCount = statsBase.filter(g => g.famille_disciple === "FAMILLE DE DAVID").length;
  const familyCharisCount = statsBase.filter(g => g.famille_disciple === "FAMILLE CHARIS").length;
  const familyItsTimeCount = statsBase.filter(g => g.famille_disciple === "FAMILLE IT'S TIME").length;
  const familyJosueCount = statsBase.filter(g => g.famille_disciple === "FAMILLE GÉNÉRATION JOSUÉ").length;
  const familyMoiseCount = statsBase.filter(g => g.famille_disciple === "FAMILLE DE MOÏSE").length;
  const familyAucuneCount = statsBase.filter(g => !g.famille_disciple || g.famille_disciple === "AUCUNE").length;
  
  const avgParticipationCDM = Math.round(statsBase.reduce((acc, g) => acc + calculateRate(g, thursdays), 0) / (statsBase.length || 1));
  const avgParticipationCulte = Math.round(statsBase.reduce((acc, g) => acc + calculateRate(g, sundays), 0) / (statsBase.length || 1));
  
  const archivedGuests = guests.filter(g => g.archived);

  const availableFamilies = useMemo(() => {
    return FAMILY_KEYS.filter(f => f !== "AUCUNE");
  }, []);

  const isAnyFilterActive = search !== "" || 
    arrivalDatesFilter.length > 0 || 
    presenceDatesFilter.length > 0 || 
    localChurchFilter !== "all" || 
    familyFilter !== "all" || 
    showCorbeille;

  const resetAllFilters = () => {
    setSearch("");
    setArrivalDatesFilter([]);
    setPresenceDatesFilter([]);
    setLocalChurchFilter("all");
    setFamilyFilter("all");
    setShowCorbeille(false);
  };

  const formatDisplayDate = (dStr: string) => {
    if (!dStr) return "—";
    try {
      const parts = dStr.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0].slice(-2)}`;
      }
      return dStr;
    } catch {
      return dStr;
    }
  };

  const getPcncStage = (g: Guest) => {
    if (g.terminePCNC) return { label: "Terminé", color: "var(--green)", bg: "rgba(16, 185, 129, 0.15)" };
    if (g.p301) return { label: "P.301", color: "var(--gold)", bg: "rgba(212, 175, 55, 0.15)" };
    if (g.p201) return { label: "P.201", color: "var(--sky)", bg: "rgba(56, 189, 248, 0.15)" };
    if (g.p101) return { label: "P.101", color: "var(--violet)", bg: "rgba(139, 92, 246, 0.15)" };
    if (g.pcnc) return { label: "Inscrit", color: "var(--muted)", bg: "rgba(255, 255, 255, 0.08)" };
    return null;
  };

  const handleUpdateFamily = async (guestId: string, newFamily: string) => {
    setGuests(prev => prev.map(g => g.id === guestId ? { ...g, famille_disciple: newFamily } : g));
    try {
      const { error } = await supabase.from("invites").update({ famille_disciple: newFamily }).eq("id", guestId);
      if (error) {
        console.error("Error updating family assignment:", error);
      }
    } catch (e) {
      console.error("Exception updating family:", e);
    }
  };

  if (!mounted || loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", padding: 50 }}>
        <Loader2 className="animate-spin" size={32} style={{ color: "var(--gold)" }} />
      </div>
    );
  }

  // Permissions logic for integration roles:
  // - Leaders (responsable, second) can add, edit, and delete.
  // - Counselors (conseiller) can add, but not delete.


  const canDeleteInvites = 
    userRoleClean === "integration_responsable" || 
    userRoleClean === "integration_second";

  return (
    <div className="people-screen integration-people-screen" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <PeopleNavigation current="guests" />
      {personView.requestedId && !personView.selected && !loading && <div className="ux-list-context"><span>Cette fiche n’est pas disponible dans la liste actuelle.</span><button type="button" onClick={personView.closePerson}>Fermer</button></div>}
      {personView.selected && <PersonPanel person={personView.selected} kind="guest" onClose={personView.closePerson} onContinue={() => { setExpandedId(personView.selected!.id); setSearch(personView.selected!.firstName + " " + personView.selected!.lastName); setCurrentView("list"); }} />}
      {personView.filter && <div className="ux-list-context"><span>{personView.filter === "contact" ? "Premiers contacts à établir" : "Invités sans responsable"}</span><button type="button" onClick={personView.clearFilter}>Afficher tout</button></div>}
      {/* Delegation active banner */}
      {canDispatchAll && (userRoleClean === "integration_conseiller" || userRoleClean === "conseiller") && (
        <div style={{ padding: "10px 16px", borderRadius: 8, background: "rgba(212,175,55,0.12)", border: "1px solid rgba(212,175,55,0.35)", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 16 }}>✨</span>
          <span style={{ fontSize: 12, color: "var(--gold-light)", fontWeight: 600 }}>
            Délégation active — Vous avez l'autorisation accordée par le responsable de voir tous les invités et de les affecter aux conseillers. Les modifications de fiches restent strictement limitées à vos propres encodages.
          </span>
        </div>
      )}
      {/* Global Read-only banner */}
      {!canDeleteInvites && !isConseiller && !canDispatchAll && (
        <div style={{ padding: "10px 16px", borderRadius: 8, background: "rgba(212,160,60,0.08)", border: "1px solid rgba(212,160,60,0.25)", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 16 }}>👁️</span>
          <span style={{ fontSize: 12, color: "var(--gold-light)", fontWeight: 600 }}>
            {canAddOrEditInvites 
              ? 'Mode Conseiller — Le suivi et les modifications s\'effectuent exclusivement dans "Mes Affectations".' 
              : 'Mode Lecture Uniquement — L\'ajout, le suivi et la promotion s\'effectuent exclusivement dans "Mes Affectations".'}
          </span>
        </div>
      )}
      <div className="page-header people-page-header">
        <div>
          <h2 className="page-title">{isConseiller && !canDispatchAll ? "Ajouter un Invité" : "Invités"}</h2>
          <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
            Retrouvez chaque nouvel arrivant, son conseiller et sa famille de disciples.
          </p>
        </div>
        <div className="people-page-actions">
          {(churchId || canDeleteInvites || canViewCr) && <details className="people-tools" onKeyDown={event => { if (event.key === "Escape") { event.currentTarget.removeAttribute("open"); event.currentTarget.querySelector("summary")?.focus(); } }}><summary>Plus d’actions <ChevronDown size={14} /></summary><div className="people-tools-menu" onClick={event => { const menu = event.currentTarget.closest("details"); menu?.removeAttribute("open"); menu?.querySelector("summary")?.focus(); }}>
          {churchId && (
            <button 
              className="btn btn-outline" 
              style={{ borderColor: "var(--gold)", color: "var(--gold)" }}
              onClick={() => setIsShareModalOpen(true)}
              title="Partager le lien ou afficher le QR Code à scanner"
            >
              <QrCode size={14} /> Partager / QR Code
            </button>
          )}
          {canDeleteInvites && (
            <button 
              className={`btn btn-trash-toggle ${showCorbeille ? 'active' : ''}`}
              onClick={() => setShowCorbeille(!showCorbeille)}
            >
              <Trash2 size={14} /> {showCorbeille ? "Quitter la Corbeille" : "Corbeille"}
              {!showCorbeille && archivedGuests.length > 0 && (
                <span style={{ background: "var(--red)", color: "#fff", borderRadius: 10, padding: "1px 7px", fontSize: 10, fontWeight: 700, marginLeft: 4 }}>
                  {archivedGuests.length}
                </span>
              )}
            </button>
          )}
          {canViewCr && (
            <button 
              className="btn btn-outline"
              onClick={() => setIsCrModalOpen(true)}
              style={{ display: "flex", alignItems: "center", gap: 6 }}
              title="Générer le Compte-Rendu Call Center pour le Pasteur"
            >
              <FileText size={14} /> CR Call Center
            </button>
          )}
          </div></details>}
          {canAddOrEditInvites && (
            <button className="btn btn-primary" onClick={() => {
              setNewGuest({
                civility: "M.", firstName: "", lastName: "", age: "26-30 ans",
                phone: "", email: "", address: "", arrivalDate: new Date().toISOString().split('T')[0],
                event: "Culte", aps: false, localChurch: false, autreEglise: "",
                responsible: "Non assigné", aEteInvite: false, parQui: "",
                baptemeEau: false, interetFormation: false, interetCDM: false, commentaire: "",
                etatCivil: "Célibataire", souhaiteEtreContacte: true
              });
              setIsAddModalOpen(true);
            }}>
              <Plus size={16} /> Nouvel invité
            </button>
          )}
        </div>
      </div>

      {!isConseiller && <IntegrationOverview items={[
        { label: "Invités enregistrés", value: guests.filter(g => !g.archived).length, detail: "L’ensemble des nouveaux arrivants", icon: <UserIcon size={16} /> },
        { label: "Sans conseiller", value: guests.filter(g => !g.archived && !g.assigned_to && (!g.responsible || g.responsible === "Non assigné")).length, detail: "Une affectation à prévoir", icon: <UserPlus size={16} /> },
        { label: "En famille", value: guests.filter(g => !g.archived && g.famille_disciple && g.famille_disciple !== "AUCUNE").length, detail: "Rattachés à une famille de disciples", icon: <Home size={16} /> }
      ]} />}
      {/* View Switcher Tabs */}
      {!isConseiller && (
        <div className="invite-view-switcher" style={{ gridTemplateColumns: isIntegrationOrCounselor ? "repeat(3, minmax(0, 1fr))" : "repeat(2, minmax(0, 1fr))", width: "min(100%, 750px)" }}>
          <button 
            onClick={() => {
              setCurrentView('list');
              if (selectedMonth === -1) {
                setSelectedMonth(new Date().getMonth());
              }
            }}
            aria-pressed={currentView === 'list'} className={`invite-view-option ${currentView === 'list' ? 'active' : ''}`}
          >
            <span className="invite-view-icon"><ListChecks size={18} /></span>
            <span className="invite-view-copy">
              <span className="invite-view-title">Tous les invités</span>
              <span className="invite-view-subtitle">{filtered.length} invité{filtered.length > 1 ? "s" : ""} à suivre</span>
            </span>
          </button>
          {isIntegrationOrCounselor && (
            <button 
              onClick={() => setCurrentView('families')}
              aria-pressed={currentView === 'families'} className={`invite-view-option ${currentView === 'families' ? 'active' : ''}`}
            >
              <span className="invite-view-icon"><Home size={18} /></span>
              <span className="invite-view-copy">
                <span className="invite-view-title">Familles</span>
                <span className="invite-view-subtitle">Répartition par famille</span>
              </span>
            </button>
          )}
          <button 
            onClick={() => setCurrentView('stats')}
            aria-pressed={currentView === 'stats'} className={`invite-view-option ${currentView === 'stats' ? 'active' : ''}`}
          >
            <span className="invite-view-icon"><BarChart3 size={18} /></span>
            <span className="invite-view-copy">
              <span className="invite-view-title">Statistiques</span>
              <span className="invite-view-subtitle">Suivi, présences et progression</span>
            </span>
          </button>
        </div>
      )}

      {/* Filters in Stats View */}
      {currentView === 'stats' && (
        <div className="people-stat-filters" aria-label="Filtres des statistiques">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>ARRIVÉE</span>
            <CustomDatePicker
              size="sm"
              multiple={true}
              clearable={true}
              values={arrivalDatesFilter}
              onChangeMultiple={setArrivalDatesFilter}
              placeholder="Toutes dates d'arrivée"
              style={{ minWidth: 150 }}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>PRÉSENCES</span>
            <CustomDatePicker
              size="sm"
              multiple={true}
              clearable={true}
              values={presenceDatesFilter}
              onChangeMultiple={(dates) => {
                setPresenceDatesFilter(dates);
                if (dates.length > 0) {
                  const latest = [...dates].sort().reverse()[0];
                  const parts = latest.split("-").map(Number);
                  if (parts.length === 3) {
                    setSelectedYear(parts[0]);
                    setSelectedMonth(parts[1] - 1);
                  }
                }
              }}
              placeholder="Toutes présences"
              style={{ minWidth: 150 }}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>ÉGLISE LOCALE</span>
            <CustomSelect
              size="sm"
              style={{ width: 160 }}
              value={localChurchFilter}
              onChange={setLocalChurchFilter}
              searchable={false}
              options={[
                { value: "all", label: "Tous (avec/sans)" },
                { value: "yes", label: "Avec église" },
                { value: "no", label: "Sans église" }
              ]}
            />
          </div>
        </div>
      )}

      {currentView === 'stats' ? (<PeopleStatistics total={statsBase.length} totalLabel="Invités enregistrés" brebis={brebisCount} calls={callsSuccess} loyal={fidelisees} pcnc={[pcnc001,pcnc101,pcnc201,pcnc301]} pcncTotal={totalPCNC} followup={[{label:"Sans église",value:noChurch},{label:"Avec téléphone",value:phoneCount},{label:"Fiches APS",value:apsCount},{label:"Revenus au culte",value:returnedCount}]} engagement={[{label:"Intérêt PCNC",value:interetPCNC},{label:"Baptême par immersion",value:baptemeEauCount},{label:"Dans une famille de disciples",value:dansFamilleDiscipleCount},{label:"Intégrés en CDM",value:integreCDMCount},{label:"Souhaitent servir",value:veutServirCount},{label:"Devenus S.T.A.R",value:devenuStarCount},{label:"Intérêt CDM",value:statsBase.filter(g => g.interetCDM).length},{label:"Intérêt baptême",value:statsBase.filter(g => g.interetBapteme).length}]} participation={[{label:"Culte du dimanche",value:avgParticipationCulte},{label:"CDM du jeudi",value:avgParticipationCDM}]} families={[...new Set([...availableFamilies, ...statsBase.map(g => g.famille_disciple).filter((f): f is string => !!f && f !== "AUCUNE")])].map(f => ({label:f,value:statsBase.filter(g => g.famille_disciple === f).length})).concat([{label:"Sans famille affectée",value:statsBase.filter(g => !g.famille_disciple || g.famille_disciple === "AUCUNE").length}])} />) : (
        <>

      {/* Add Guest Modal */}
      {typeof window !== "undefined" && isAddModalOpen && createPortal(
        <div className="modal-overlay">
          <div className="custom-modal fade-in">
            <button 
              onClick={() => { setIsAddModalOpen(false); setEditingGuestId(null); }}
              style={{ position: "absolute", top: 20, right: 20, background: "none", border: "none", color: "var(--muted)", cursor: "pointer" }}
            >
              <XCircle size={24} />
            </button>
            
            <h2 style={{ fontSize: "clamp(16px, 2.5vw, 20px)", color: "var(--gold)", marginBottom: 20 }}>
              {editingGuestId ? "Modifier l'invité" : "Nouvel Invité"}
            </h2>
            
            <form onSubmit={handleSaveGuest} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {formError && <p className="ux-form-error" role="alert">{formError}</p>}
              <p className="ux-form-help">Commencez par l’essentiel. Les autres informations peuvent être complétées plus tard.</p>
              <fieldset disabled={isSaving} style={{ display: "contents", border: 0 }}>

              {/* 1. Date d'arrivée & Événement en premier */}
              <div className="form-grid-2">
                <div>
                  <label style={{ fontSize: 11, color: "var(--gold)", fontWeight: 600, display: "block", marginBottom: 6 }}>DATE D'ARRIVÉE *</label>
                  <CustomDatePicker 
                    value={newGuest.arrivalDate || ""} 
                    onChange={val => setNewGuest({...newGuest, arrivalDate: val})} 
                    placeholder="Sélectionner la date"
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 6 }}>ÉVÉNEMENT</label>
                  <CustomSelect
                    value={newGuest.event || "Culte"}
                    onChange={val => setNewGuest({...newGuest, event: val})}
                    searchable={false}
                    options={[
                      { value: "Culte", label: "Culte" },
                      { value: "Baptême", label: "Baptême" },
                      { value: "Évangélisation", label: "Évangélisation" },
                      { value: "Séminaire", label: "Séminaire" },
                      { value: "Autre", label: "Autre" }
                    ]}
                  />
                </div>
              </div>

              {/* 2. Civilité, Nom, Prénom */}
              <div className="form-grid-3">
                <div>
                  <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 6 }}>CIVILITÉ</label>
                  <CustomSelect
                    value={newGuest.civility || "M."}
                    onChange={val => setNewGuest({...newGuest, civility: val})}
                    searchable={false}
                    options={[
                      { value: "M.", label: "M." },
                      { value: "Mme.", label: "Mme." }
                    ]}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 6 }}>NOM</label>
                  <input className="input" required value={newGuest.lastName || ""} onChange={e => setNewGuest({...newGuest, lastName: e.target.value})} placeholder="Dupont" />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 6 }}>PRÉNOM</label>
                  <input className="input" required value={newGuest.firstName || ""} onChange={e => setNewGuest({...newGuest, firstName: e.target.value})} placeholder="Jean" />
                </div>
              </div>

              {/* 3. Téléphone, E-mail, État civil */}
              <div className="form-grid-3">
                <div>
                  <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 6 }}>TÉLÉPHONE</label>
                  <input 
                    className="input" 
                    value={newGuest.phone || ""} 
                    onKeyDown={handlePhoneKeyDown}
                    onChange={e => setNewGuest({...newGuest, phone: handlePhoneChange(e.target.value)})} 
                    placeholder="+32 470 12 34 56" 
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 6 }}>E-MAIL</label>
                  <input className="input" type="email" value={newGuest.email || ""} onChange={e => setNewGuest({...newGuest, email: e.target.value})} placeholder="jean@email.com" />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 6 }}>ÉTAT CIVIL</label>
                  <CustomSelect
                    value={newGuest.etatCivil || "Célibataire"}
                    onChange={val => setNewGuest({...newGuest, etatCivil: val})}
                    searchable={false}
                    options={[
                      { value: "Marié(e)", label: "Marié(e)" },
                      { value: "Séparé(e)", label: "Séparé(e)" },
                      { value: "Divorcé(e)", label: "Divorcé(e)" },
                      { value: "Veuf(ve)", label: "Veuf(ve)" },
                      { value: "En couple", label: "En couple" },
                      { value: "Célibataire", label: "Célibataire" }
                    ]}
                  />
                </div>
              </div>

              <details className="ux-extra-fields" open={!!editingGuestId}><summary>Compléter le profil et le parcours</summary><div className="ux-extra-content">
                {/* Pays de résidence & Tranche d'âge */}
                <div className="form-grid-2">
                  <div>
                    <label style={{ fontSize: 11, color: "var(--gold)", fontWeight: 600, display: "block", marginBottom: 6 }}>PAYS DE RÉSIDENCE *</label>
                    <button
                      type="button"
                      onClick={() => setIsCountryModalOpen(true)}
                      className="input"
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "0 14px",
                        cursor: "pointer",
                        textAlign: "left",
                        height: 40,
                        background: "rgba(0,0,0,0.2)",
                        border: "1px solid rgba(212,175,55,0.3)"
                      }}
                    >
                      <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--cream)" }}>
                        <span style={{ fontSize: 18 }}>
                          {COUNTRIES.find(c => c.name.toLowerCase() === (newGuest.pays || "").toLowerCase())?.flag || "🌍"}
                        </span>
                        <span style={{ fontWeight: 600, color: "var(--gold-light)" }}>{newGuest.pays || "Belgique"}</span>
                      </span>
                      <ChevronDown size={15} style={{ color: "var(--gold)" }} />
                    </button>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 6 }}>TRANCHE D'ÂGE</label>
                    <CustomSelect
                      value={newGuest.age || "26-30 ans"}
                      onChange={val => setNewGuest({...newGuest, age: val})}
                      searchable={false}
                      options={[
                        { value: "Moins de 18 ans", label: "Moins de 18 ans" },
                        { value: "18-25 ans", label: "18-25 ans" },
                        { value: "26-30 ans", label: "26-30 ans" },
                        { value: "31-35 ans", label: "31-35 ans" },
                        { value: "36-40 ans", label: "36-40 ans" },
                        { value: "41-45 ans", label: "41-45 ans" },
                        { value: "46-50 ans", label: "46-50 ans" },
                        { value: "Plus de 50 ans", label: "Plus de 50 ans" }
                      ]}
                    />
                  </div>
                </div>

              <div>
                <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 6 }}>ADRESSE / LIEU DE RÉSIDENCE</label>
                <input className="input" value={newGuest.address || ""} onChange={e => setNewGuest({...newGuest, address: e.target.value})} placeholder="Rue de l'Industrie 12, 6040 Jumet" />
              </div>

              {!userRoleClean.startsWith("integration_") && (
                <div>
                  <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 6 }}>RESPONSABLE ASSIGNÉ</label>
                  <CustomSelect
                    value={newGuest.responsible || "Non assigné"}
                    onChange={val => setNewGuest({...newGuest, responsible: val})}
                    disabled={isConseiller}
                    searchable={responsibles.length >= 8}
                    options={[
                      { value: "Non assigné", label: "Non assigné" },
                      ...responsibles.filter(r => r !== "Non assigné").map(r => ({ value: r, label: r })),
                      ...(newGuest.responsible && newGuest.responsible !== "Non assigné" && !responsibles.includes(newGuest.responsible) ? [{ value: newGuest.responsible, label: newGuest.responsible }] : [])
                    ]}
                  />
                </div>
              )}

              <div className="form-grid-2" style={{ marginBottom: 15 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input type="checkbox" checked={newGuest.aEteInvite || false} onChange={e => setNewGuest({...newGuest, aEteInvite: e.target.checked})} />
                  <span style={{ fontSize: 13 }}>A été invité ?</span>
                </div>
                {newGuest.aEteInvite && (
                  <div>
                    <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 6 }}>PAR QUI ?</label>
                    <input className="input" value={newGuest.parQui || ""} onChange={e => setNewGuest({...newGuest, parQui: e.target.value})} placeholder="Nom de l'invitant" />
                  </div>
                )}
              </div>

              <div className="form-grid-2">
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input type="checkbox" checked={newGuest.baptemeEau} onChange={e => setNewGuest({...newGuest, baptemeEau: e.target.checked})} />
                  <span style={{ fontSize: 13 }}>Baptisé par immersion ?</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input type="checkbox" checked={newGuest.interetFormation} onChange={e => setNewGuest({...newGuest, interetFormation: e.target.checked})} />
                  <span style={{ fontSize: 13 }}>Intérêt PCNC</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input type="checkbox" checked={newGuest.interetCDM} onChange={e => setNewGuest({...newGuest, interetCDM: e.target.checked})} />
                  <span style={{ fontSize: 13 }}>Intérêt C.D.M</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input type="checkbox" checked={newGuest.interetBapteme} onChange={e => setNewGuest({...newGuest, interetBapteme: e.target.checked})} />
                  <span style={{ fontSize: 13 }}>Intérêt Baptême</span>
                </div>
              </div>

              {/* Questions spirituelles */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input type="checkbox" id="modal-aps" checked={newGuest.aps} onChange={e => setNewGuest({...newGuest, aps: e.target.checked})} style={{ accentColor: "var(--gold)" }} />
                  <label htmlFor="modal-aps" style={{ fontSize: 13, color: "var(--cream)", cursor: "pointer", fontWeight: 500 }}>
                    Avez-vous déjà accepté Jésus-Christ comme votre Sauveur et Seigneur de votre vie ?
                  </label>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <input type="checkbox" id="modal-localChurch" checked={newGuest.localChurch} onChange={e => setNewGuest({...newGuest, localChurch: e.target.checked})} style={{ accentColor: "var(--gold)" }} />
                    <label htmlFor="modal-localChurch" style={{ fontSize: 13, color: "var(--cream)", cursor: "pointer", fontWeight: 500 }}>
                      Persévérez-vous déjà dans une autre église ?
                    </label>
                  </div>
                  {newGuest.localChurch && (
                    <div style={{ paddingLeft: 26 }}>
                      <label style={{ fontSize: 10, color: "var(--muted)", display: "block", marginBottom: 4 }}>NOM DE VOTRE ÉGLISE LOCALE</label>
                      <input 
                        type="text" 
                        className="input" 
                        placeholder="Ex: ICC Paris, Portes Ouvertes..." 
                        value={newGuest.autreEglise || ""} 
                        onChange={e => setNewGuest({...newGuest, autreEglise: e.target.value})}
                        style={{ height: 36, fontSize: 12 }}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 6 }}>COMMENTAIRE ARRIVÉE / NOTES PARTICULIÈRES</label>
                <textarea 
                  className="input" 
                  value={newGuest.commentaire || ""} 
                  onChange={e => setNewGuest({...newGuest, commentaire: e.target.value})} 
                  placeholder="Informations complémentaires, sujet de prière..."
                  style={{ minHeight: 80, fontSize: 12 }}
                />
              </div>

              
</div></details>
<div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input type="checkbox" checked={newGuest.souhaiteEtreContacte !== false} onChange={e => setNewGuest({...newGuest, souhaiteEtreContacte: e.target.checked})} />
                  <span style={{ fontSize: 13, color: "var(--gold)", fontWeight: "bold" }}>Souhaite être contacté(e)</span>
                </div>
<div style={{ marginTop: 10, display: "flex", gap: 12, justifyContent: "flex-end" }}>
                <button type="button" className="btn btn-outline" onClick={() => { setIsAddModalOpen(false); setEditingGuestId(null); }}>Annuler</button>
                <button type="submit" className="btn btn-primary" disabled={isSaving}>{isSaving ? "Enregistrement…" : "Enregistrer"}</button>
              </div>
            
              </fieldset>
</form>
          </div>
        </div>,
        document.body
      )}

      <CountryPickerModal
        isOpen={isCountryModalOpen}
        onClose={() => setIsCountryModalOpen(false)}
        value={newGuest.pays || "Belgique"}
        onChange={val => setNewGuest({...newGuest, pays: val})}
      />

      {/* Modern Filters & Controls */}
      <PeopleListToolbar
            search={search} onSearch={setSearch}
            countLabel={`${filtered.length} invité${filtered.length > 1 ? "s" : ""}`}
            showModes={false}
            activeCount={Number(arrivalDatesFilter.length > 0 || arrivalMonth !== "all" || arrivalYear !== "all") + Number(presenceDatesFilter.length > 0) + Number(localChurchFilter !== "all") + Number(familyFilter !== "all")} onReset={resetAllFilters}
            period={presenceDatesFilter.length ? `Présences : ${presenceDatesFilter.length} date(s)` : "Présences : toutes les dates"}>

          {/* Arrivée Filter */}
          <div className={styles.filterChip} role="group" aria-label="Date d’arrivée">
            <span className={styles.filterLabel}><Calendar size={12} /> Arrivée</span>
            <CustomDatePicker
              size="sm"
              multiple={true}
              clearable={true}
              values={arrivalDatesFilter}
              onChangeMultiple={setArrivalDatesFilter}
              placeholder="Toutes dates"
              style={{ minWidth: 140 }}
            />
          </div>

          {/* Présences Calculation Period Filter */}
          <div className={styles.filterChip} role="group" aria-label="Période des présences">
            <span className={styles.filterLabel}>👁 Présences</span>
            <CustomDatePicker
              size="sm"
              multiple={true}
              clearable={true}
              values={presenceDatesFilter}
              onChangeMultiple={(dates) => {
                setPresenceDatesFilter(dates);
                if (dates.length > 0) {
                  const latest = [...dates].sort().reverse()[0];
                  const parts = latest.split("-").map(Number);
                  if (parts.length === 3) {
                    setSelectedYear(parts[0]);
                    setSelectedMonth(parts[1] - 1);
                  }
                }
              }}
              placeholder="Toutes présences"
              style={{ minWidth: 140 }}
            />
          </div>

          {/* Église Locale Filter */}
          <div className={styles.filterChip} role="group" aria-label="Église locale">
            <span className={styles.filterLabel}>⛪ Église</span>
            <CustomSelect
              size="sm"
              style={{ width: 135 }}
              value={localChurchFilter}
              onChange={setLocalChurchFilter}
              searchable={false}
              options={[
                { value: "all", label: "Tous (avec/sans)" },
                { value: "no", label: "Sans église" },
                { value: "yes", label: "Avec église" }
              ]}
            />
          </div>

          {/* Famille Filter */}
          <div className={styles.filterChip} role="group" aria-label="Famille de disciples">
            <span className={styles.filterLabel}>👥 Famille</span>
            <CustomSelect
              size="sm"
              style={{ width: 145 }}
              value={familyFilter}
              onChange={setFamilyFilter}
              searchable={availableFamilies.length >= 8}
              options={[
                { value: "all", label: "Toutes familles" },
                { value: "AUCUNE", label: "AUCUNE (Non affectée)" },
                ...availableFamilies.map(fam => ({ value: fam, label: fam }))
              ]}
            />
          </div>

          
          </PeopleListToolbar>

          {/* List or Families View */}
      {currentView === 'families' && isIntegrationOrCounselor ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }} className="fade-in">
          <style dangerouslySetInnerHTML={{__html: `
            .family-table-row {
              transition: background-color 0.15s ease;
            }
            .family-table-row:hover {
              background-color: rgba(255, 255, 255, 0.025) !important;
            }
          `}} />
          {FAMILY_KEYS.map((famName) => {
            const famGuests = guestsByFamily[famName] || [];
            const isFamExpanded = expandedFamilies[famName] !== false;
            const colors = FAMILY_COLORS[famName] || FAMILY_COLORS["AUCUNE"];
            
            return (
              <div 
                key={famName} 
                className="glass" 
                style={{ 
                  border: `1px solid ${colors.border}`, 
                  background: `linear-gradient(180deg, ${colors.glow}, rgba(0,0,0,0.2))`,
                  borderRadius: 16,
                  overflow: "hidden"
                }}
              >
                {/* Header bar */}
                <div 
                  onClick={() => setExpandedFamilies(prev => ({ ...prev, [famName]: !isFamExpanded }))}
                  style={{ 
                    padding: "16px 24px", 
                    display: "flex", 
                    alignItems: "center", 
                    justifyContent: "space-between", 
                    cursor: "pointer",
                    borderBottom: isFamExpanded && famGuests.length > 0 ? `1px solid ${colors.border}` : "none",
                    background: "rgba(255,255,255,0.01)"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 8, color: colors.main }}>●</span>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--cream)", letterSpacing: "0.5px" }}>{famName}</h3>
                    <span 
                      className="badge" 
                      style={{ 
                        background: colors.border, 
                        color: colors.main, 
                        fontSize: 11, 
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: 20
                      }}
                    >
                      {famGuests.length} invité{famGuests.length > 1 ? "s" : ""}
                    </span>
                  </div>
                  <div style={{ color: "var(--muted)" }}>
                    {isFamExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </div>

                {/* Content panel */}
                {isFamExpanded && (
                  <div style={{ padding: famGuests.length > 0 ? "8px 0" : "24px", textAlign: famGuests.length > 0 ? "left" : "center" }}>
                    {famGuests.length === 0 ? (
                      <span style={{ fontSize: 13, color: "var(--muted)" }}>Aucun invité affecté à cette famille</span>
                    ) : (
                      <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 800 }}>
                          <thead>
                            <tr style={{ borderBottom: `1px solid rgba(255,255,255,0.05)`, color: "var(--muted)", fontSize: 11, fontWeight: 600 }}>
                              <th style={{ padding: "12px 24px", textAlign: "left" }}>INVITÉ</th>
                              <th style={{ padding: "12px 16px", textAlign: "left" }}>DATE D'ARRIVÉE</th>
                              <th style={{ padding: "12px 16px", textAlign: "left" }}>ACCOMPAGNEMENT</th>
                              <th style={{ padding: "12px 16px", textAlign: "left" }}>RÉAFFECTER</th>
                              <th style={{ padding: "12px 24px", textAlign: "right" }}>ACTIONS</th>
                            </tr>
                          </thead>
                          <tbody>
                            {famGuests.map((guest) => {
                              const rateCDM = calculateRate(guest, thursdays);
                              const rateCulte = calculateRate(guest, sundays);
                              const isIntegrationLeader = userRoleClean === "integration_responsable" || userRoleClean === "integration_second";
                              const isAssignedCounselor = guest.assigned_to === userId && (userRoleClean === "integration_conseiller" || userRoleClean === "conseiller");
                              const isCreator = guest.created_by === userId && (userRoleClean === "integration_conseiller" || userRoleClean === "conseiller");
                              const canEdit = canModifyInvites || isIntegrationLeader || isAssignedCounselor || isCreator;
                              
                              return (
                                <tr 
                                  key={guest.id} 
                                  style={{ 
                                    borderBottom: "1px solid rgba(255,255,255,0.02)", 
                                    fontSize: 13, 
                                    color: "var(--cream-dim)" 
                                  }}
                                  className="family-table-row"
                                >
                                  {/* Invité Info */}
                                  <td style={{ padding: "12px 24px" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                      <div className="avatar" style={{ width: 28, height: 28, fontSize: 10 }}>
                                        {guest.firstName[0]}{guest.lastName[0]}
                                      </div>
                                      <div>
                                        <div style={{ fontWeight: 600, color: "var(--cream)" }}>
                                          <span>{guest.firstName} {guest.lastName}</span>
                                        </div>
                                        <div style={{ fontSize: 10, color: "var(--muted)" }}>{guest.age}</div>
                                      </div>
                                    </div>
                                  </td>

                                  {/* Date d'arrivée */}
                                  <td style={{ padding: "12px 16px" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                      <Calendar size={13} style={{ color: colors.main }} />
                                      <span>{guest.arrivalDate ? guest.arrivalDate.split('-').reverse().join('/') : '-'}</span>
                                    </div>
                                  </td>

                                  {/* Accompagnement */}
                                  <td style={{ padding: "12px 16px" }}>
                                    {userRoleClean.startsWith("integration_") ? (
                                      <span style={{ fontSize: 12 }}>
                                        {guest.assigned_to === userId ? (
                                          <strong style={{ color: "var(--gold-light)" }}>Moi</strong>
                                        ) : (
                                          counselors.find(c => c.id === guest.assigned_to)?.display_name || "Non assigné"
                                        )}
                                      </span>
                                    ) : (
                                      <span style={{ fontSize: 12 }}>{guest.responsible || "Non assigné"}</span>
                                    )}
                                  </td>

                                  {/* Réaffecter Famille */}
                                  <td style={{ padding: "12px 16px" }}>
                                    <CustomSelect 
                                      value={guest.famille_disciple || "AUCUNE"} 
                                      disabled={!canEdit}
                                      size="sm"
                                      onChange={async (newFamily) => {
                                        setGuests(prev => prev.map(g => g.id === guest.id ? {...g, famille_disciple: newFamily} : g));
                                        await supabase.from("invites").update({ famille_disciple: newFamily }).eq("id", guest.id);
                                      }}
                                      placeholder="AUCUNE"
                                      ariaLabel="Réaffecter la famille"
                                      searchable={availableFamilies.length >= 6}
                                      options={[
                                        { value: "AUCUNE", label: "AUCUNE" },
                                        ...availableFamilies.filter(f => f !== "AUCUNE").map(f => ({ value: f, label: f }))
                                      ]}
                                      style={{ minWidth: 150 }}
                                    />
                                  </td>

                                  {/* Actions */}
                                  <td style={{ padding: "12px 24px", textAlign: "right" }}>
                                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", alignItems: "center" }}>
                                      {guest.phone && (
                                        <a 
                                          href={`tel:${guest.phone}`} 
                                          className="btn-icon" 
                                          style={{ 
                                            background: "rgba(34, 197, 94, 0.08)", 
                                            color: "var(--green)", 
                                            padding: 6, 
                                            borderRadius: 6,
                                            display: "inline-flex",
                                            alignItems: "center"
                                          }} 
                                          title="Appeler"
                                        >
                                          <Phone size={12} />
                                        </a>
                                      )}
                                      <button 
                                        className="btn btn-subtle btn-sm" 
                                        style={{ padding: "4px 10px", fontSize: 11, height: "auto" }}
                                        onClick={() => {
                                          setCurrentView('list');
                                          setExpandedId(guest.id);
                                          setTimeout(() => {
                                            const el = document.getElementById(`guest-card-${guest.id}`);
                                            if (el) {
                                              el.scrollIntoView({ behavior: "smooth", block: "center" });
                                            }
                                          }, 150);
                                        }}
                                      >
                                        Voir la fiche
                                      </button>
                                      {(userRoleClean === "integration_responsable" || userRoleClean === "integration_second" || userRoleClean === "super_admin") && (
                                        <button 
                                          className="btn btn-subtle btn-sm" 
                                          style={{ padding: "4px 10px", fontSize: 11, height: "auto" }}
                                          onClick={() => openEditModal(guest)}
                                          title="Modifier les informations du formulaire"
                                        >
                                          Modifier
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* Modern Card View identical to Mes affectations */
        <TriageListView
          mode="all_guests"
          guests={filtered}
          counselors={counselors}
          onAssign={handleAssignCounselor}
          onOpenVoirPlus={(g) => setSelectedDetailGuest(g)}
          onEditGuest={(g) => openEditModal(g as Guest)}
          onDeleteGuest={canDeleteInvites ? async (guestId) => {
            const guest = guests.find(g => g.id === guestId);
            if (!guest) return;
            if (!await confirm(`Voulez-vous vraiment supprimer définitivement ${guest.firstName} ${guest.lastName} de la base de données ? Cette action est irréversible.`)) {
              return;
            }
            await handlePermanentDeleteGuest(guestId);
            notify(`${guest.firstName} ${guest.lastName} a été supprimé(e) définitivement.`);
          } : undefined}
          isLeader={userRoleClean === "integration_responsable" || userRoleClean === "integration_second" || userRoleClean === "super_admin"}
        />
      )}

      {typeof window !== "undefined" && deletingGuest && createPortal(
        <div className="modal-overlay">
          <div className="custom-modal fade-in" style={{ border: "1px solid rgba(239, 68, 68, 0.5)", boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.85), 0 0 50px rgba(239, 68, 68, 0.15)" }}>
            <button 
              type="button" 
              onClick={() => { setDeletingGuest(null); setDeleteError(null); }}
              style={{
                position: "absolute",
                top: 16,
                right: 16,
                background: "none",
                border: "none",
                color: "var(--cream-dim)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 6,
                borderRadius: "50%",
                transition: "all 0.2s ease"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "white";
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--cream-dim)";
                e.currentTarget.style.background = "none";
              }}
              title="Fermer"
            >
              <X size={18} />
            </button>

            <div style={{
              display: "flex",
              justifyContent: "center",
              marginBottom: 20
            }}>
              <div style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 0 20px rgba(239, 68, 68, 0.2)"
              }}>
                <AlertTriangle size={28} style={{ color: "var(--red)" }} />
              </div>
            </div>

            <h2 style={{
              color: "#f3f4f6",
              textAlign: "center",
              fontSize: 20,
              fontWeight: 600,
              letterSpacing: "-0.025em",
              marginBottom: 8
            }}>
              {showCorbeille ? "Suppression définitive" : "Mise à la corbeille"}
            </h2>

            <p style={{
              fontSize: 14,
              color: "var(--cream-dim)",
              textAlign: "center",
              lineHeight: 1.6,
              marginBottom: 24
            }}>
              {showCorbeille ? (
                <>
                  Voulez-vous vraiment <strong style={{ color: "var(--red)" }}>supprimer définitivement</strong> l'invité{" "}
                  <span style={{
                    display: "inline-block",
                    background: "rgba(239, 68, 68, 0.1)",
                    border: "1px solid rgba(239, 68, 68, 0.2)",
                    padding: "2px 8px",
                    borderRadius: 6,
                    color: "var(--cream)",
                    fontWeight: 600
                  }}>
                    {deletingGuest.firstName} {deletingGuest.lastName}
                  </span> de l'application ? Cette action est définitive et irréversible.
                </>
              ) : (
                <>
                  Voulez-vous envoyer l'invité{" "}
                  <span style={{
                    display: "inline-block",
                    background: "rgba(255, 193, 7, 0.1)",
                    border: "1px solid rgba(255, 193, 7, 0.2)",
                    padding: "2px 8px",
                    borderRadius: 6,
                    color: "var(--cream)",
                    fontWeight: 600
                  }}>
                    {deletingGuest.firstName} {deletingGuest.lastName}
                  </span> à la corbeille ? Vous pourrez le restaurer plus tard si besoin.
                </>
              )}
            </p>

            {deleteError && (
              <div style={{ 
                marginBottom: 16, padding: "10px 14px", borderRadius: 8,
                background: "rgba(239, 68, 68, 0.12)", border: "1px solid rgba(239, 68, 68, 0.3)",
                fontSize: 12, color: "var(--red)", fontFamily: "monospace", wordBreak: "break-all", lineHeight: 1.4
              }}>
                ⚠️ <strong>Erreur :</strong> {deleteError}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {!showCorbeille ? (
                <>
                  <button 
                    type="button" 
                    className="btn btn-danger-solid" 
                    style={{
                      width: "100%",
                      borderRadius: 8,
                      padding: "12px 16px",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      boxShadow: "0 4px 12px rgba(239, 68, 68, 0.2)"
                    }}
                    disabled={isDeleting} 
                    onClick={() => handleDeleteGuest(deletingGuest.id)}
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 className="spinner" size={16} />
                        Archivage en cours...
                      </>
                    ) : (
                      <>
                        <Archive size={16} />
                        Envoyer à la corbeille
                      </>
                    )}
                  </button>

                  <div style={{ display: "flex", gap: 12 }}>
                    <button 
                      type="button" 
                      className="btn" 
                      onClick={() => { setDeletingGuest(null); setDeleteError(null); }}
                      style={{
                        flex: 1,
                        background: "rgba(255, 255, 255, 0.05)",
                        color: "#e2e8f0",
                        border: "1px solid rgba(255, 255, 255, 0.1)",
                        borderRadius: 8,
                        padding: "10px 16px",
                        fontWeight: 500,
                        cursor: "pointer",
                        transition: "all 0.2s ease"
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
                        e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.2)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
                        e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
                      }}
                    >
                      Annuler
                    </button>

                    <button 
                      type="button" 
                      className="btn btn-danger-solid" 
                      style={{
                        flex: 1.5,
                        borderRadius: 8,
                        padding: "10px 16px",
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        boxShadow: "0 4px 12px rgba(239, 68, 68, 0.2)"
                      }}
                      disabled={isDeleting} 
                      onClick={() => handlePermanentDeleteGuest(deletingGuest.id)}
                    >
                      {isDeleting ? (
                        <>
                          <Loader2 className="spinner" size={14} />
                          Suppression...
                        </>
                      ) : (
                        <>
                          <Trash2 size={14} />
                          Détruire définitivement
                        </>
                      )}
                    </button>
                  </div>
                </>
              ) : (
                <div style={{ display: "flex", gap: 12 }}>
                  <button 
                    type="button" 
                    className="btn" 
                    onClick={() => { setDeletingGuest(null); setDeleteError(null); }}
                    style={{
                      flex: 1,
                      background: "rgba(255, 255, 255, 0.05)",
                      color: "#e2e8f0",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      borderRadius: 8,
                      padding: "10px 16px",
                      fontWeight: 500,
                      cursor: "pointer",
                      transition: "all 0.2s ease"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
                      e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.2)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
                      e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
                    }}
                  >
                    Annuler
                  </button>

                  <button 
                    type="button" 
                    className="btn btn-danger-solid" 
                    style={{
                      flex: 1.5,
                      borderRadius: 8,
                      padding: "10px 16px",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      boxShadow: "0 4px 12px rgba(239, 68, 68, 0.2)"
                    }}
                    disabled={isDeleting} 
                    onClick={() => handlePermanentDeleteGuest(deletingGuest.id)}
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 className="spinner" size={14} />
                        Suppression...
                      </>
                    ) : (
                      <>
                        <Trash2 size={14} />
                        Supprimer définitivement
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )}

  <GuestArrivalDetailsModal
    isOpen={Boolean(selectedDetailGuest)}
    onClose={() => setSelectedDetailGuest(null)}
    guest={selectedDetailGuest}
    counselors={counselors}
    onAssign={async (guestId, counselorId) => {
      await handleAssignCounselor(guestId, counselorId);
      setSelectedDetailGuest(prev => prev && prev.id === guestId ? { ...prev, assigned_to: counselorId } : prev);
    }}
    onEdit={(g) => openEditModal(g as unknown as Guest)}
    isLeader={userRoleClean === "integration_responsable" || userRoleClean === "integration_second" || userRoleClean === "super_admin"}
  />

  <CrCallCenterModal
    isOpen={isCrModalOpen}
    onClose={() => setIsCrModalOpen(false)}
    guests={guests}
    churchName={churchName || "CHARLEROI"}
  />

  {churchId && (
    <ShareInviteModal
      isOpen={isShareModalOpen}
      onClose={() => setIsShareModalOpen(false)}
      churchId={churchId}
      churchName={churchName || "CHARLEROI"}
    />
  )}
</div>
);
}

function SuiviToggle({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange?: () => void; disabled?: boolean }) {
  return (
    <div 
      onClick={!disabled ? onChange : undefined}
      className="suivi-toggle-row"
      style={{ 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "space-between", 
        padding: "6px 10px",
        background: "rgba(255,255,255,0.03)",
        borderRadius: "8px",
        cursor: (onChange && !disabled) ? "pointer" : "default",
        opacity: disabled ? 0.5 : 1,
        transition: "all 0.2s ease",
        border: "1px solid rgba(255,255,255,0.02)"
      }}
    >
      <span style={{ fontSize: 10, fontWeight: 600, color: checked ? "var(--cream)" : "var(--muted)", transition: "color 0.2s" }}>{label}</span>
      <button className={`toggle ${checked ? "on" : ""}`} style={{ transform: "scale(0.65)", transformOrigin: "right", pointerEvents: "none" }} />
    </div>
  );
}

export default function Page() {
  return <Suspense fallback={<p role="status">Chargement…</p>}><InvitesPage /></Suspense>;
}
