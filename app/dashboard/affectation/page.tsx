"use client";

import { Suspense, useRef, useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { 
  Search, Plus, UserPlus, Filter, CheckCircle2, XCircle, X, 
  Calendar, CalendarDays, MapPin, Mail, Phone, User as UserIcon,
  ChevronDown, ChevronUp, MoreHorizontal, Loader2, ListChecks, BarChart3,
  LayoutGrid, Table as TableIcon, RotateCcw, Eye, FileText,
  Clock, ShieldCheck, UserCheck, UserMinus, Users
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { 
  autoAddLeaderToMembers, listIntegrationTeam, getIntegrationInvites, 
  assignCounselorToGuest, conserveGuestAction, retireGuestAction, 
  type ConserveGuestPayload 
} from "@/app/actions/auth";
import { getActiveContext, getActiveUserInfo } from "@/lib/client-session";
import { filterElapsedDateKeys } from "@/lib/date-utils";
import PersonPanel, { PersonButton } from "@/components/experience/PersonPanel";
import { usePeopleView } from "@/lib/use-people-view";
import { useFeedback } from "@/components/experience/FeedbackProvider";
import PeopleStatistics from "@/components/experience/PeopleStatistics";
import FamilyAssignment from "@/components/experience/FamilyAssignment";
import IntegrationOverview from "@/components/experience/IntegrationOverview";
import PeopleListToolbar from "@/components/experience/PeopleListToolbar";
import styles from "./Affectation.module.css";
import CustomDatePicker from "@/components/ui/CustomDatePicker";
import CustomSelect from "@/components/ui/CustomSelect";
import CountryPickerModal, { COUNTRIES } from "@/components/ui/CountryPickerModal";
import CrCallCenterModal from "@/components/experience/CrCallCenterModal";
import ArrivalDateFilterModal from "@/components/experience/ArrivalDateFilterModal";
import GuestArrivalDetailsModal from "@/components/experience/GuestArrivalDetailsModal";
import QualifyGuestModal from "@/components/experience/QualifyGuestModal";
import RetireGuestModal, { type RetirePayload } from "@/components/experience/RetireGuestModal";
import TriageListView from "@/components/experience/TriageListView";

const formatDisplayDate = (d?: string) => {
  if (!d) return "—";
  try {
    const parts = d.split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0].slice(-2)}`;
    }
    return d;
  } catch {
    return d;
  }
};

const getPcncStage = (g: Guest) => {
  if (g.terminePCNC) return { label: "Terminé", color: "var(--green)" };
  if (g.p301) return { label: "301", color: "var(--green)" };
  if (g.p201) return { label: "201", color: "var(--orange)" };
  if (g.p101) return { label: "101", color: "var(--sky)" };
  if (g.pcnc) return { label: "001", color: "var(--violet)" };
  if (g.interetFormation) return { label: "Intérêt", color: "var(--gold)" };
  return { label: "Non débuté", color: "var(--muted)" };
};



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
  // Suivi Fields
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
  archived?: boolean;
  assigned_to?: string | null;
  church_id?: string | null;
  bergerie_id?: string | null;
  famille_disciple?: string;
  etatCivil?: string;
  souhaiteEtreContacte?: boolean;
  created_by?: string | null;
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
  statutAffectation?: 'a_affecter' | 'en_attente_contact' | 'conserve' | 'sans_suite';
  motifRetrait?: string;
  retirePar?: string;
  retireAt?: string;
}

const MOCK_RESPONSIBLES = ["Non assigné"];
const STATUS_OPTIONS = ["Brebi", "Faiseur de Disciple", "Responsable", "Second", "Berger"];
const DEFAULT_FAMILIES = [
  "FAMILLE DE NOÉ",
  "FAMILLE DE DAVID",
  "FAMILLE CHARIS",
  "FAMILLE IT'S TIME",
  "FAMILLE GÉNÉRATION JOSUÉ",
  "FAMILLE DE MOÏSE"
];

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
    commentaireSuivi: isFreshUnassigned ? "" : (g.commentaire_suivi || "")
      .replace(/\[[A-Za-z0-9_]+:[^\]]*\]\s*/gi, "")
      .replace(/\[(?:FAUX_NUMERO|NE_DECROCHE_PAS)\]\s*/gi, "")
      .replace(/Retir[ée] directement depuis l'onglet Mes [âa]mes\s*/gi, "")
      .trim(),
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
    assigned_to: g.assigned_to,
    church_id: g.church_id,
    bergerie_id: g.bergerie_id,
    famille_disciple: g.famille_disciple || "AUCUNE",
    etatCivil: g.etat_civil || "Célibataire",
    souhaiteEtreContacte: g.souhaite_etre_contacte !== false,
    archived: g.archived || false,
    created_by: g.created_by,
    statutAffectation: (() => {
      if (rawStatut === 'sans_suite') return 'sans_suite';
      if (rawStatut === 'conserve') return 'conserve';
      if (isAssigned) {
        return (rawStatut === 'en_attente_contact' || !g.appel_abouti) ? 'en_attente_contact' : 'conserve';
      }
      return 'a_affecter';
    })() as 'a_affecter' | 'en_attente_contact' | 'conserve' | 'sans_suite',
    motifRetrait: g.motif_retrait || (g.commentaire_suivi?.match(/\[MOTIF_RETRAIT:\s*([^\]]+)\]/i)?.[1]?.trim() || g.raison_echec || ""),
    retirePar: g.retire_par || (g.commentaire_suivi?.match(/\[RETIRE_PAR:\s*([^\]]+)\]/i)?.[1]?.trim() || ""),
    retireAt: g.retire_at || (g.commentaire_suivi?.match(/\[RETIRE_AT:\s*([^\]]+)\]/i)?.[1]?.trim() || "")
  };
}

export type ViewTab = 'unassigned' | 'my_assignments' | 'my_souls' | 'all_souls' | 'retired' | 'stats';

function AffectationPage() {
  const { notify, confirm } = useFeedback();
  const saveLock = useRef(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  useEffect(() => { if (isAddModalOpen) setFormError(""); }, [isAddModalOpen]);
  const [isCountryModalOpen, setIsCountryModalOpen] = useState(false);
  const [isCrModalOpen, setIsCrModalOpen] = useState(false);
  const [editingGuestId, setEditingGuestId] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [currentView, setCurrentView] = useState<ViewTab>('my_souls');
  const [selectedArrivalGuest, setSelectedArrivalGuest] = useState<Guest | null>(null);
  const [qualifyingGuest, setQualifyingGuest] = useState<Guest | null>(null);
  const [retiringGuest, setRetiringGuest] = useState<Guest | null>(null);
  // Table mode removed per user request
  const [showTableDetails, setShowTableDetails] = useState(false);
  const [arrivalDatesFilter, setArrivalDatesFilter] = useState<string[]>([]);
  const [isArrivalDateModalOpen, setIsArrivalDateModalOpen] = useState(false);
  const [arrivalMonth, setArrivalMonth] = useState<string>("all");
  const [arrivalYear, setArrivalYear] = useState<string>("all");
  const [localChurchFilter, setLocalChurchFilter] = useState<string>("all");
  const [familyFilter, setFamilyFilter] = useState<string>("all");
  const [selectedCounselorFilter, setSelectedCounselorFilter] = useState<string>("all");
  const [userRole, setUserRole] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const info = getActiveUserInfo();
    if (info?.role) return info.role;
    try {
      const s = localStorage.getItem("poimen_user_info");
      return s ? JSON.parse(s)?.role || null : null;
    } catch { return null; }
  });
  const userRoleClean = useMemo(() => (userRole || "").toLowerCase().trim(), [userRole]);
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
  const [familyId, setFamilyId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const ctx = getActiveContext();
    if (ctx?.context_type === "integration") return null;
    try {
      const s = localStorage.getItem("selected_family");
      return s ? JSON.parse(s)?.id || null : null;
    } catch { return null; }
  });
  const [loading, setLoading] = useState(true);
  const [guests, setGuests] = useState<Guest[]>([]);
  const personView = usePeopleView(guests);
  const [responsibles, setResponsibles] = useState<string[]>(["Non assigné"]);
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
  const [counselors, setCounselors] = useState<{ id: string; display_name: string; email: string }[]>([]);
const selectedCounselorObj = useMemo(() => {
    if (selectedCounselorFilter === "all") return null;
    return counselors.find(c => c.id === selectedCounselorFilter) || null;
  }, [counselors, selectedCounselorFilter]);
  const [activeBergeries, setActiveBergeries] = useState<{ id: string; name: string }[]>([]);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferringGuest, setTransferringGuest] = useState<Guest | null>(null);
  const [selectedBergerieId, setSelectedBergerieId] = useState<string>("");
  const [isTransferring, setIsTransferring] = useState(false);

  const availableFamilies = useMemo(() => {
    const list = [...DEFAULT_FAMILIES];
    activeBergeries.forEach(b => {
      const trimmed = (b.name || "").trim();
      if (trimmed && !list.some(f => f.toLowerCase() === trimmed.toLowerCase())) {
        list.push(trimmed);
      }
    });
    return list;
  }, [activeBergeries]);

  const isAuthorizedLeader = useMemo(() => {
    const role = userRoleClean;
    return (
      role === "berger" ||
      role.includes("second") ||
      role.includes("responsable") ||
      role.includes("coordonnateur") ||
      role === "admin" ||
      role === "super_admin"
    );
  }, [userRoleClean]);

  const isIntegrationLeader = useMemo(() => {
    const role = userRoleClean;
    return (
      role === "integration_responsable" ||
      role === "integration_second" ||
      role === "admin" ||
      role === "super_admin"
    );
  }, [userRoleClean]);

  const canViewCr = useMemo(() => {
    return isIntegrationLeader || canDispatchAll;
  }, [isIntegrationLeader, canDispatchAll]);

  const canCreateOrDeleteInvites = useMemo(() => {
    return isIntegrationLeader;
  }, [isIntegrationLeader]);

  const isIntegrationOrCounselor = useMemo(() => {
    return userRoleClean.startsWith("integration_") || userRoleClean === "conseiller" || isConseiller;
  }, [userRoleClean, isConseiller]);

  useEffect(() => {
    const activeContext = getActiveContext();
    const activeUserInfo = getActiveUserInfo();
    const userInfo = activeUserInfo ? JSON.stringify(activeUserInfo) : localStorage.getItem("poimen_user_info");
    if (userInfo) {
      try {
        const parsed = JSON.parse(userInfo);
        setUserRole(parsed.role);
        setUserId(parsed.id);
        
        let cId = parsed.church_id;
        if (!cId) {
          try {
            const savedChurch = localStorage.getItem("selected_church");
            if (savedChurch) {
              cId = JSON.parse(savedChurch).id;
            }
          } catch {}
        }
        setChurchId(cId);

        const rLower = (parsed.role || "").toLowerCase().trim();
        setIsConseiller(parsed.isConseiller === true || rLower === "integration_conseiller" || rLower === "conseiller");
        setCanDispatchAll(Boolean(parsed.canDispatchAll || parsed.metadata?.can_dispatch_all));
        
        const firstName = (parsed.firstName || "").trim();
        const lastName = (parsed.lastName || "").trim();
        const name = [firstName, lastName].filter(Boolean).join(" ");
        if (name) {
          setUserName(name);
        }
      } catch (e) {
        console.error("Error parsing user info in affectation page", e);
      }
    }
    const fam = activeContext?.context_type === "integration" ? null : localStorage.getItem("selected_family");
    if (fam) {
      try {
        const parsedFam = JSON.parse(fam);
        setFamilyId(parsedFam.id);
      } catch (e) {
        console.error("Error parsing family info", e);
      }
    }
  }, []);

  useEffect(() => {
    if (familyId || (isIntegrationOrCounselor && churchId)) {
      fetchGuests();
      fetchResponsibles();
    }
  }, [familyId, isIntegrationOrCounselor, churchId, userName, userId]);

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
      
      const { data: bData, error: bError } = await supabase
        .from("bergeries")
        .select("id, name")
        .eq("church_id", churchId)
        .eq("archived", false)
        .order("name", { ascending: true });
        
      if (!bError && bData) {
        setActiveBergeries(bData);
      }
      return;
    }

    if (!familyId) return;
    const { data, error } = await supabase
      .from("members")
      .select("first_name, last_name, status, email, archived")
      .eq("bergerie_id", familyId);
    
    if (!error && data) {
      const userInfo = getActiveUserInfo() || JSON.parse(localStorage.getItem("poimen_user_info") || "{}");
      const userEmail = userInfo.email?.toLowerCase();
      const userRoleVal = (userInfo.role || "").toLowerCase();
      const isLeader = userRoleVal.includes("berger") || userRoleVal.includes("second") || userRoleVal.includes("responsable");
      
      const me = data.find(m => !m.archived && m.email?.toLowerCase() === userEmail);
      if (!me && isLeader && userEmail) {
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
        }
        fetchResponsibles();
        return;
      }

      const leaders = data.filter(m => {
        if (m.archived || m.status === "Externe") return false;
        const s = (m.status || "").toLowerCase();
        return s.includes("berger") || s.includes("second") || s.includes("responsable");
      });
      const names = leaders.map(m => `${m.first_name} ${m.last_name}`);
      setResponsibles(["Non assigné", ...names]);
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
          if (userId && !canDispatchAll && !isIntegrationLeader) {
            query = query.eq("assigned_to", userId);
          }
        } else {
          setGuests([]);
          return;
        }
      } else {
        if (familyId && userName) {
          query = query.eq("bergerie_id", familyId).eq("responsible", userName);
        } else {
          setGuests([]);
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

  const handleUpdateAssignment = async (guestId: string, newResponsible: string) => {
    const { error } = await supabase
      .from("invites")
      .update({ responsible: newResponsible })
      .eq("id", guestId);
    
    if (error) {
      notify("Erreur lors de l'affectation : " + error.message);
    } else {
      fetchGuests();
    }
  };

  const handleUpdateFamily = async (guestId: string, newFamily: string) => {
    const isNone = !newFamily || newFamily === "AUCUNE";
    const matchedBergerie = !isNone ? activeBergeries.find(b => b.name.trim().toLowerCase() === newFamily.trim().toLowerCase()) : null;
    
    const updatePayload: Record<string, any> = {
      famille_disciple: newFamily,
      dans_famille_disciple: !isNone,
    };
    if (matchedBergerie) {
      updatePayload.bergerie_id = matchedBergerie.id;
    } else if (isNone) {
      updatePayload.bergerie_id = null;
    }

    setGuests(prev => prev.map(g => g.id === guestId ? {
      ...g,
      famille_disciple: newFamily,
      dansFamilleDisciple: !isNone,
      ...(matchedBergerie ? { bergerie_id: matchedBergerie.id } : (isNone ? { bergerie_id: null } : {}))
    } : g));

    const { error } = await supabase.from("invites").update(updatePayload).eq("id", guestId);
    if (error) {
      notify("Erreur lors de l'affectation à la famille : " + error.message);
    } else {
      notify(isNone ? "L'âme n'est plus affectée à aucune famille." : `L'âme a été affectée à ${newFamily}`);
    }
  };

  const handleSelfAssign = async (guestId: string) => {
    if (isIntegrationOrCounselor || counselors.length > 0) {
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
      statutAffectation: counselorId ? 'en_attente_contact' : 'a_affecter',
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

  const [newGuest, setNewGuest] = useState<Partial<Guest>>({
    civility: "M.",
    firstName: "",
    lastName: "",
    age: "26-30",
    phone: "",
    email: "",
    pays: "Belgique",
    address: "",
    arrivalDate: new Date().toISOString().split('T')[0],
    event: "Culte",
    aps: false,
    localChurch: false,
    autreEglise: "",
    responsible: "",
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
    integreCDM: false,
    prierePartage: false,
    dansFamilleDisciple: false,
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

    const newAttendance = { ...guest.attendance, [day]: !guest.attendance[day] };
    setGuests(prev => prev.map(g => g.id === guestId ? { ...g, attendance: newAttendance } : g));
    await supabase.from("invites").update({ attendance: newAttendance }).eq("id", guestId);
  };

  const toggleSuivi = async (guestId: string, field: keyof Guest) => {
    const guest = guests.find(g => g.id === guestId);
    if (!guest) return;

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

    setGuests(prev => prev.map(g => g.id === guestId ? {
      ...g,
      [field]: newValue,
      ...extraUpdates,
      ...(field === "dansFamilleDisciple" && !newValue ? { famille_disciple: "AUCUNE", bergerie_id: null } : {})
    } : g));
    
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
    if (field === "dansFamilleDisciple" && !newValue) {
      updateObj.famille_disciple = "AUCUNE";
      updateObj.bergerie_id = null;
    }
    try {
      const { error } = await supabase.from("invites").update(updateObj).eq("id", guestId);
      if (error) {
        console.warn("Champs Supabase non encore disponible ou erreur:", error.message);
        // Fallback résilient : si la colonne dédiée n'existe pas encore dans la table SQL,
        // enregistrer dans commentaire_suivi pour garantir la persistance immédiate
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

    const existingGuest = editingGuestId ? guests.find(g => g.id === editingGuestId) : null;

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
      dans_famille_disciple: !editingGuestId ? false : (existingGuest ? existingGuest.dansFamilleDisciple : false),
      interet_bapteme: newGuest.interetBapteme,
      commentaire: newGuest.commentaire,
      commentaire_suivi: newGuest.commentaireSuivi || "",
      famille_disciple: !editingGuestId ? "AUCUNE" : (existingGuest ? (existingGuest.famille_disciple || "AUCUNE") : "AUCUNE"),
      etat_civil: newGuest.etatCivil || "Célibataire",
      souhaite_etre_contacte: newGuest.souhaiteEtreContacte !== false
    };

    if (isIntegrationOrCounselor) {
      payload.church_id = churchId;
      if (!editingGuestId) {
        payload.bergerie_id = null;
        payload.assigned_to = userId; // Auto-assign to current counselor on creation
      } else {
        payload.bergerie_id = existingGuest?.bergerie_id || null;
      }
    } else {
      payload.bergerie_id = existingGuest?.bergerie_id || familyId;
    }

    if (editingGuestId) {
      let { error } = await supabase
        .from("invites")
        .update(payload)
        .eq("id", editingGuestId);

      if (error && (error.message.includes("autre_eglise") || error.message.includes("pays") || error.message.includes("piliers") || error.code === "42703" || error.code === "PGRST204")) {
        const fallbackPayload = { ...payload };
        delete fallbackPayload.autre_eglise;
        delete fallbackPayload.pays;
        delete fallbackPayload.piliers_1;
        delete fallbackPayload.piliers_2;
        delete fallbackPayload.piliers_3;
        delete fallbackPayload.piliers_4;
        delete fallbackPayload.termine_12_piliers;
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
      payload.commentaire_suivi = "";
      let { data: inserted, error } = await supabase
        .from("invites")
        .insert(payload)
        .select()
        .single();

      if (error && (error.message.includes("autre_eglise") || error.message.includes("pays") || error.message.includes("piliers") || error.code === "42703" || error.code === "PGRST204")) {
        const fallbackPayload = { ...payload };
        delete fallbackPayload.autre_eglise;
        delete fallbackPayload.pays;
        delete fallbackPayload.piliers_1;
        delete fallbackPayload.piliers_2;
        delete fallbackPayload.piliers_3;
        delete fallbackPayload.piliers_4;
        delete fallbackPayload.termine_12_piliers;
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
      age: "26-30",
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
      baptemeEsprit: false,
      interetFormation: false,
      interetCDM: false,
      interetEvenement: false,
      commentaire: "",
      famille_disciple: "AUCUNE",
    });
    } catch {
      setFormError("L’enregistrement a échoué. Votre saisie est conservée ; vérifiez votre connexion et réessayez.");
    } finally {
      saveLock.current = false;
      setIsSaving(false);
    }
  };

  const handleQuickRetire = async (guestId: string) => {
    const guest = guests.find(g => g.id === guestId);
    if (!guest || !churchId) return;

    if (!await confirm(`Voulez-vous retirer ${guest.firstName} ${guest.lastName} de votre suivi ? Cette âme sera directement déplacée dans l'onglet "Sans suite".`)) {
      return;
    }

    const res = await retireGuestAction({
      churchId,
      guestId,
      motif: "retire_depuis_mes_ames",
      commentaire: ""
    });

    if (res.success) {
      notify(`${guest.firstName} a été retiré(e) de votre suivi et placé(e) dans l'onglet "Sans suite".`);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("poimen:soul-updated", { detail: { guestId } }));
      }
      setGuests(prev => prev.map(g => {
        if (g.id !== guestId) return g;
        return {
          ...g,
          statutAffectation: 'sans_suite',
          motifRetrait: 'retire_depuis_mes_ames',
          retirePar: userId || undefined,
          retireAt: new Date().toISOString(),
          commentaireSuivi: (g.commentaireSuivi || "")
            .replace(/\[[A-Za-z0-9_]+:[^\]]*\]\s*/gi, "")
            .replace(/\[(?:FAUX_NUMERO|NE_DECROCHE_PAS)\]\s*/gi, "")
            .replace(/Retir[ée] directement depuis l'onglet Mes [âa]mes\s*/gi, "")
            .trim()
        };
      }));
    } else {
      notify("Erreur lors du retrait : " + res.error);
    }
  };

  const handleDeleteGuest = async (guestId: string) => {
    const guest = guests.find(g => g.id === guestId);
    if (guest && (guest.statutAffectation === 'conserve' || currentView === 'my_souls')) {
      notify("Une personne suivie dans 'Mes âmes' ne peut pas être supprimée définitivement. Utilisez l'option 'Retirer' pour la déplacer dans 'Sans suite'.");
      return;
    }
    const isFamilyRole = !isIntegrationOrCounselor && userRoleClean !== "super_admin";
    
    if (isFamilyRole && guest && guest.church_id) {
      if (!await confirm("Voulez-vous vraiment retirer cet invité de votre Famille ? Il restera disponible pour l'Intégration.")) return;
      
      const { error } = await supabase
        .from("invites")
        .update({
          bergerie_id: null,
          dans_famille_disciple: false,
          responsible: "Non assigné"
        })
        .eq("id", guestId);
        
      if (error) {
        notify("Erreur lors du retrait : " + error.message);
      } else {
        fetchGuests();
      }
    } else {
      if (!await confirm("Voulez-vous vraiment supprimer définitivement cet invité ? Cette action est irréversible.")) return;
      
      const { error } = await supabase
        .from("invites")
        .delete()
        .eq("id", guestId);
        
      if (error) {
        notify("Erreur lors de la suppression : " + error.message);
      } else {
        fetchGuests();
      }
    }
  };

  const handleTransferGuest = async () => {
    if (!transferringGuest || !selectedBergerieId) return;
    setIsTransferring(true);
    try {
      const { error } = await supabase
        .from("invites")
        .update({ 
          bergerie_id: selectedBergerieId,
          responsible: "Non assigné"
        })
        .eq("id", transferringGuest.id);

      if (error) throw error;

      notify(`L'invité ${transferringGuest.firstName} ${transferringGuest.lastName} a été confié avec succès !`);
      setIsTransferModalOpen(false);
      setTransferringGuest(null);
      setSelectedBergerieId("");
      fetchGuests();
    } catch (err: any) {
      console.error("Error transferring guest:", err);
      notify("Erreur lors de l'opération : " + err.message);
    } finally {
      setIsTransferring(false);
    }
  };

  const promoteToMember = async (guest: Guest) => {
    if (!guest.bergerie_id) return;
    
    if (!await confirm(`Voulez-vous vraiment transformer ${guest.firstName} ${guest.lastName} en membre de la Bergerie ?`)) return;

    setLoading(true);
    try {
      // 1. Insert into members
      const { error: insertError } = await supabase.from("members").insert({
        bergerie_id: guest.bergerie_id,
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
    if (!guest.bergerie_id) return;
    
    if (!await confirm(`Voulez-vous vraiment retirer ${guest.firstName} ${guest.lastName} de la Bergerie ?`)) return;

    setLoading(true);
    try {
      // 1. Delete from members
      const { error: deleteError } = await supabase.from("members")
        .delete()
        .eq("bergerie_id", guest.bergerie_id)
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
      responsible: guest.responsible || responsibles[0],
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
      if (arrivalYear !== "all" && !availableYears.includes(arrivalYear)) {
        setArrivalYear("all");
      }
    }
  }, [availableYears, selectedYear, arrivalYear]);

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

  // 1. Unassigned guests (À affecter) - sorted most recent first
  const unassignedGuests = useMemo(() => {
    return guests
      .filter(g => {
        if (g.statutAffectation === 'sans_suite') return false;
        if (g.statutAffectation === 'conserve') return false;
        const isAssigned = Boolean(g.assigned_to || (g.responsible && g.responsible !== "Non assigné" && g.responsible.trim() !== ""));
        return !isAssigned;
      })
      .sort((a, b) => (b.arrivalDate || "").localeCompare(a.arrivalDate || ""));
  }, [guests]);

  // 2. My pending assignments (Mes affectations) - sorted most recent first
  const myPendingGuests = useMemo(() => {
    return guests
      .filter(g => {
        const isAssignedToMe = g.assigned_to === userId || (!g.assigned_to && userName && g.responsible === userName);
        if (!isAssignedToMe) return false;
        if (g.statutAffectation === 'sans_suite') return false;
        if (g.statutAffectation === 'conserve') return false;
        return g.statutAffectation === 'en_attente_contact' || !g.appelAbouti;
      })
      .sort((a, b) => (b.arrivalDate || "").localeCompare(a.arrivalDate || ""));
  }, [guests, userId, userName]);

  // 3. Retired guests (Sans suite)
  const retiredGuests = useMemo(() => {
    return guests
      .filter(g => {
        if (g.statutAffectation !== 'sans_suite') return false;
        if (isIntegrationLeader || canDispatchAll) return true;
        return g.retirePar === userId || g.assigned_to === userId;
      })
      .sort((a, b) => (b.retireAt || b.arrivalDate || "").localeCompare(a.retireAt || a.arrivalDate || ""));
  }, [guests, isIntegrationLeader, canDispatchAll, userId]);

  // Actions for Triage Workflow
  const handleConfirmConserve = async (payload: ConserveGuestPayload) => {
    if (!qualifyingGuest || !churchId) return;
    const guestId = qualifyingGuest.id;
    const res = await conserveGuestAction({
      churchId,
      guestId,
      payload
    });
    if (res.success) {
          notify(`${qualifyingGuest.firstName} a été ajouté(e) avec succès à votre suivi "Mes âmes" !`);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("poimen:soul-updated", { detail: { guestId } }));
      }
      setGuests(prev => prev.map(g => {
        if (g.id !== guestId) return g;
        return {
          ...g,
          statutAffectation: 'conserve',
          appelAbouti: true,
          prevuRevenir: Boolean(payload.prevuRevenir),
          estRevenuCulte: Boolean(payload.estRevenuCulte),
          groupeWhatsapp: Boolean(payload.groupeWhatsapp),
          interetFormation: Boolean(payload.interetFormation),
          interetCDM: Boolean(payload.interetCDM),
          piliers1: Boolean(payload.piliers1),
          souhaitSuivi: Boolean(payload.souhaitSuivi),
          rdvPastoral: Boolean(payload.rdvPastoral),
          visiteDomicile: Boolean(payload.visiteDomicile),
          aps: Boolean(payload.aps),
          commentaireSuivi: payload.commentaireSuivi || g.commentaireSuivi
        };
      }));
    } else {
      notify("Erreur lors de la qualification : " + res.error);
    }
  };

  const handleConfirmRetire = async (payload: RetirePayload) => {
    if (!retiringGuest || !churchId) return;
    const guestId = retiringGuest.id;
    const res = await retireGuestAction({
      churchId,
      guestId,
      motif: payload.motif,
      autreEglise: payload.autreEglise,
      commentaire: payload.commentaire
    });
    if (res.success) {
      notify(`${retiringGuest.firstName} a été retiré(e) et placé(e) dans l'onglet "Sans suite".`);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("poimen:soul-updated", { detail: { guestId } }));
      }
      setGuests(prev => prev.map(g => {
        if (g.id !== guestId) return g;
        return {
          ...g,
          statutAffectation: 'sans_suite',
          motifRetrait: payload.motif,
          retirePar: userId || undefined,
          retireAt: new Date().toISOString(),
          commentaireSuivi: payload.commentaire,
          fauxNumero: payload.motif === 'faux_numero' ? true : g.fauxNumero,
          neDecrochePas: payload.motif === 'ne_decroche_pas' ? true : g.neDecrochePas,
          autreEglise: payload.autreEglise || g.autreEglise
        };
      }));
    } else {
      notify("Erreur lors du retrait : " + res.error);
    }
  };

  const mySoulsCount = useMemo(() => {
    return guests.filter(g => {
      if (g.statutAffectation === 'sans_suite') return false;
      const isAssignedToMe = g.assigned_to === userId || (!g.assigned_to && userName && g.responsible === userName);
      if (!isAssignedToMe) return false;
      return g.statutAffectation === 'conserve' || g.appelAbouti;
    }).length;
  }, [guests, userId, userName]);

  const allSoulsCount = useMemo(() => {
    return guests.filter(g => {
      if (g.statutAffectation === 'sans_suite') return false;
      if (g.statutAffectation === 'a_affecter' && !g.assigned_to) return false;
      return true;
    }).length;
  }, [guests]);

  const filtered = useMemo(() => {
    return guests.filter(g => {
      // Exclude retired guests from active souls
      if (g.statutAffectation === 'sans_suite') return false;

      // In "Mes âmes" view (strictly the user's personally conserved / followed souls):
      if (currentView === 'my_souls') {
        const isAssignedToMe = g.assigned_to === userId || (!g.assigned_to && userName && g.responsible === userName);
        if (!isAssignedToMe) return false;
        // Must be conserved or already marked successful
        if (g.statutAffectation !== 'conserve' && !g.appelAbouti) return false;
      } else if (currentView === 'all_souls') {
        // For leader in "Toutes les âmes": exclude unassigned unless filtered, only show active/conserved or assigned
        if (g.statutAffectation === 'a_affecter' && !g.assigned_to) return false;
      } else {
        // Fallback: if in standard counselor mode
        if (!isIntegrationLeader && !canDispatchAll) {
          const isAssignedToMe = g.assigned_to === userId || (!g.assigned_to && userName && g.responsible === userName);
          if (!isAssignedToMe) return false;
          if (g.statutAffectation !== 'conserve' && !g.appelAbouti) return false;
        }
      }

      if (personView.filter === "contact" && (g.appelAbouti || g.fauxNumero || g.neDecrochePas || g.souhaiteEtreContacte === false)) return false;
      if (personView.filter === "unassigned" && (userRole?.startsWith("integration_") ? !!g.assigned_to : !!g.responsible && g.responsible !== "Non assigné")) return false;

      const matchesSearch = `${g.firstName} ${g.lastName}`.toLowerCase().includes(search.toLowerCase());
      const matchesArrivalDates = arrivalDatesFilter.length === 0 || (Boolean(g.arrivalDate) && arrivalDatesFilter.includes(g.arrivalDate));
      const guestDate = new Date(g.arrivalDate);
      const guestMonth = guestDate.getMonth().toString();
      const guestYear = guestDate.getFullYear().toString();
      const matchesMonth = arrivalMonth === "all" || guestMonth === arrivalMonth;
      const matchesYear = arrivalYear === "all" || guestYear === arrivalYear;
      
      const matchesLocalChurch = localChurchFilter === "all" || 
        (localChurchFilter === "yes" && g.localChurch) || 
        (localChurchFilter === "no" && !g.localChurch);

      const guestFamily = (g.famille_disciple || "AUCUNE").trim();
      const matchesFamily = familyFilter === "all" ||
        (familyFilter === "AUCUNE" ? (guestFamily === "AUCUNE" || !g.famille_disciple) : (guestFamily.toLowerCase() === familyFilter.toLowerCase()));

      const matchesCounselor = selectedCounselorFilter === "all" ||
        g.assigned_to === selectedCounselorFilter ||
        Boolean(selectedCounselorObj && g.responsible && g.responsible.toLowerCase() === selectedCounselorObj.display_name.toLowerCase());

      return matchesSearch && matchesArrivalDates && matchesMonth && matchesYear && matchesLocalChurch && matchesFamily && matchesCounselor;
    });
  }, [guests, currentView, isIntegrationLeader, canDispatchAll, userId, userName, personView.filter, userRole, search, arrivalDatesFilter, arrivalMonth, arrivalYear, localChurchFilter, familyFilter, selectedCounselorFilter, selectedCounselorObj]);

  const isAnyFilterActive = useMemo(() => {
    return search.trim() !== "" || arrivalDatesFilter.length > 0 || arrivalMonth !== "all" || arrivalYear !== "all" || localChurchFilter !== "all" || familyFilter !== "all" || selectedCounselorFilter !== "all";
  }, [search, arrivalDatesFilter, arrivalMonth, arrivalYear, localChurchFilter, familyFilter, selectedCounselorFilter]);

  const resetAllFilters = () => {
    setSearch("");
    setArrivalDatesFilter([]);
    setArrivalMonth("all");
    setArrivalYear("all");
    setLocalChurchFilter("all");
    setFamilyFilter("all");
    setSelectedCounselorFilter("all");
  };

  const brebisCount = filtered.filter(g => g.status === "Brebi").length;
  const callsSuccess = filtered.filter(g => g.appelAbouti).length;
  const noChurch = filtered.filter(g => !g.localChurch).length;
  const apsCount = filtered.filter(g => g.aps).length;
  const phoneCount = filtered.filter(g => g.phone && g.phone.trim() !== "").length;
  const returnedCount = filtered.filter(g => {
    if (g.estRevenuCulte) return true;
    const attendanceDates = Object.keys(g.attendance || {});
    return attendanceDates.some(d => {
      if (g.attendance[d] !== true || d <= g.arrivalDate) return false;
      const [year, month, day] = d.split('-').map(Number);
      const dateObj = new Date(year, month - 1, day);
      return dateObj.getDay() === 0;
    });
  }).length;
  const interetPCNC = filtered.filter(g => g.interetFormation).length;
  const pcnc001 = filtered.filter(g => g.pcnc).length;
  const pcnc101 = filtered.filter(g => g.p101).length;
  const pcnc201 = filtered.filter(g => g.p201).length;
  const pcnc301 = filtered.filter(g => g.p301).length;
  const totalPCNC = filtered.filter(g => g.pcnc || g.p101 || g.p201 || g.p301).length;
  const fidelisees = filtered.filter(isFidelise).length;
  const dansFamilleDiscipleCount = filtered.filter(g => g.dansFamilleDisciple).length;
  const integreCDMCount = filtered.filter(g => g.integreCDM).length;
  const veutServirCount = filtered.filter(g => g.veutServir).length;
  const devenuStarCount = filtered.filter(g => g.devenuStar).length;
  const baptemeEauCount = filtered.filter(g => g.baptemeEau).length;
  
  const avgParticipationCDM = Math.round(filtered.reduce((acc, g) => acc + calculateRate(g, thursdays), 0) / (filtered.length || 1));
  const avgParticipationCulte = Math.round(filtered.reduce((acc, g) => acc + calculateRate(g, sundays), 0) / (filtered.length || 1));

  if (loading && guests.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: 16 }}>
        <div className="spinner" style={{ width: 40, height: 40 }} />
        <div style={{ color: "var(--gold-light)", fontFamily: "var(--font-display)", fontSize: 16, letterSpacing: "0.05em" }}>
          Chargement de vos affectations...
        </div>
      </div>
    );
  }

  return (
    <div className="people-screen integration-people-screen" style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      
      {personView.requestedId && !personView.selected && !loading && <div className="ux-list-context"><span>Cette fiche n’est pas disponible dans la liste actuelle.</span><button type="button" onClick={personView.closePerson}>Fermer</button></div>}
      {personView.selected && <PersonPanel person={personView.selected} kind="guest" onClose={personView.closePerson} onContinue={() => { setExpandedId(personView.selected!.id); setSearch(personView.selected!.firstName + " " + personView.selected!.lastName);  }} />}
      {personView.filter && <div className="ux-list-context"><span>{personView.filter === "contact" ? "Premiers contacts à établir" : "Invités sans responsable"}</span><button type="button" onClick={personView.clearFilter}>Afficher tout</button></div>}
      {/* Header */}
      {/* Read-only banner for Conseiller */}
      {isConseiller && (
        <div className="glass glass-compact fade-in" style={{ background: "rgba(16, 185, 129, 0.04)", borderColor: "rgba(16, 185, 129, 0.25)", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--green)", boxShadow: "0 0 10px var(--green)" }} />
          <span style={{ fontSize: 11, color: "var(--green)", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase" }}>Mode Conseiller — Saisie des suivis autorisée</span>
        </div>
      )}

      <div className="page-header fade-in people-page-header">
        <div>
          <h2 className="page-title">Mes âmes</h2>
          <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
            Vos premiers contacts, les âmes que vous accompagnez et les prochaines étapes de leur parcours.
          </p>
        </div>
        <div className="people-page-actions">
          {canViewCr && <details className="people-tools" onKeyDown={event => { if (event.key === "Escape") { event.currentTarget.removeAttribute("open"); event.currentTarget.querySelector("summary")?.focus(); } }}><summary>Plus d’actions <ChevronDown size={14} /></summary><div className="people-tools-menu" onClick={event => { const menu = event.currentTarget.closest("details"); menu?.removeAttribute("open"); menu?.querySelector("summary")?.focus(); }}>
          {canViewCr && (
            <button 
              type="button"
              className="btn btn-outline btn-sm" 
              style={{ borderColor: "rgba(212,175,55,0.4)", color: "var(--gold-light)", display: "flex", alignItems: "center", gap: 6 }}
              onClick={() => setIsCrModalOpen(true)}
              title="Compte-Rendu Call Center pour le Pasteur (Responsable, Second, Affectations)"
            >
              <FileText size={14} /> CR Call Center
            </button>
          )}
          </div></details>}
          {isIntegrationOrCounselor && (
            <button className="btn btn-primary btn-sm" onClick={() => {
              setNewGuest({ ...newGuest, responsible: userName || "" });
              setIsAddModalOpen(true);
            }}>
              <Plus size={16} /> Nouvelle âme
            </button>
          )}
        </div>
      </div>

          {typeof window !== "undefined" && isAddModalOpen && createPortal(
            <div className="modal-overlay">
              <div className="custom-modal fade-in" style={{ maxWidth: 620 }}>
                <button onClick={() => { setIsAddModalOpen(false); setEditingGuestId(null); }} style={{ position: "absolute", top: 24, right: 24, background: "none", border: "none", color: "var(--muted)", cursor: "pointer", display: "flex", alignItems: "center" }}>
                  <X size={20} />
                </button>
                <h2 style={{ fontSize: "clamp(16px, 2.5vw, 22px)", color: "var(--gold-light)", marginBottom: 20, fontFamily: "var(--font-display)" }}>
                  {editingGuestId ? "Modifier l'âme" : "Enregistrer une nouvelle âme"}
                </h2>
                <form onSubmit={handleSaveGuest} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {formError && <p className="ux-form-error" role="alert">{formError}</p>}
              <p className="ux-form-help">Commencez par l’essentiel. Les autres informations peuvent être complétées plus tard.</p>
              <fieldset disabled={isSaving} style={{ display: "contents", border: 0 }}>

                  {/* 1. Date d'arrivée & Événement en premier */}
                  <div className="form-grid-2">
                    <div>
                      <label className="form-label" style={{ color: "var(--gold)" }}>DATE D'ARRIVÉE *</label>
                      <CustomDatePicker 
                        value={newGuest.arrivalDate || ""} 
                        onChange={val => setNewGuest({...newGuest, arrivalDate: val})} 
                        placeholder="Sélectionner la date"
                      />
                    </div>
                    <div>
                      <label className="form-label">ÉVÉNEMENT</label>
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
                      <label className="form-label">CIVILITÉ</label>
                      <CustomSelect
                        value={newGuest.civility || "M."}
                        onChange={val => setNewGuest({...newGuest, civility: val})}
                        searchable={false}
                        options={[
                          { value: "M.", label: "M." },
                          { value: "Mme.", label: "Mme." },
                          { value: "Mlle.", label: "Mlle." }
                        ]}
                      />
                    </div>
                    <div>
                      <label className="form-label">NOM</label>
                      <input className="input" required value={newGuest.lastName || ""} onChange={e => setNewGuest({...newGuest, lastName: e.target.value})} />
                    </div>
                    <div>
                      <label className="form-label">PRÉNOM</label>
                      <input className="input" required value={newGuest.firstName || ""} onChange={e => setNewGuest({...newGuest, firstName: e.target.value})} />
                    </div>
                  </div>

                  {/* 3. Téléphone, E-mail, État civil */}
                  <div className="form-grid-3">
                    <div>
                      <label className="form-label">TÉLÉPHONE</label>
                      <input className="input" value={newGuest.phone || ""} onChange={e => setNewGuest({...newGuest, phone: e.target.value})} />
                    </div>
                    <div>
                      <label className="form-label">E-MAIL</label>
                      <input className="input" type="email" value={newGuest.email || ""} onChange={e => setNewGuest({...newGuest, email: e.target.value})} />
                    </div>
                    <div>
                      <label className="form-label">ÉTAT CIVIL</label>
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
                        <label className="form-label" style={{ color: "var(--gold)" }}>PAYS DE RÉSIDENCE *</label>
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
                        <label className="form-label">TRANCHE D'ÂGE</label>
                        <CustomSelect
                          value={newGuest.age || "26-30"}
                          onChange={val => setNewGuest({...newGuest, age: val})}
                          searchable={false}
                          options={[
                            { value: "< 18", label: "Moins de 18 ans" },
                            { value: "18-25", label: "18-25 ans" },
                            { value: "26-30", label: "26-30 ans" },
                            { value: "31-40", label: "31-40 ans" },
                            { value: "41-50", label: "41-50 ans" },
                            { value: "> 50", label: "Plus de 50 ans" }
                          ]}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="form-label">ADRESSE DOMICILE / LIEU DE RÉSIDENCE</label>
                      <input className="input" value={newGuest.address || ""} onChange={e => setNewGuest({...newGuest, address: e.target.value})} placeholder="Rue de l'Industrie 12, 6040 Jumet" />
                    </div>

                    <div className="form-grid-2">
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <input type="checkbox" checked={newGuest.aEteInvite || false} onChange={e => setNewGuest({...newGuest, aEteInvite: e.target.checked})} style={{ accentColor: "var(--gold)" }} />
                        <span style={{ fontSize: 13, color: "var(--cream-dim)" }}>A été invité ?</span>
                      </div>
                      {newGuest.aEteInvite && (
                        <div>
                          <label className="form-label">PAR QUI ?</label>
                          <input className="input" value={newGuest.parQui || ""} onChange={e => setNewGuest({...newGuest, parQui: e.target.value})} placeholder="Nom de l'invitant" />
                        </div>
                      )}
                    </div>

                    <div className="form-grid-2">
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <input type="checkbox" checked={newGuest.baptemeEau || false} onChange={e => setNewGuest({...newGuest, baptemeEau: e.target.checked})} style={{ accentColor: "var(--gold)" }} />
                        <span style={{ fontSize: 13, color: "var(--cream-dim)" }}>Baptisé par immersion ?</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <input type="checkbox" checked={newGuest.interetFormation || false} onChange={e => setNewGuest({...newGuest, interetFormation: e.target.checked})} style={{ accentColor: "var(--gold)" }} />
                        <span style={{ fontSize: 13, color: "var(--cream-dim)" }}>Intérêt PCNC</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <input type="checkbox" checked={newGuest.interetCDM || false} onChange={e => setNewGuest({...newGuest, interetCDM: e.target.checked})} style={{ accentColor: "var(--gold)" }} />
                        <span style={{ fontSize: 13, color: "var(--cream-dim)" }}>Intérêt C.D.M</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <input type="checkbox" checked={newGuest.interetBapteme || false} onChange={e => setNewGuest({...newGuest, interetBapteme: e.target.checked})} style={{ accentColor: "var(--gold)" }} />
                        <span style={{ fontSize: 13, color: "var(--cream-dim)" }}>Intérêt Baptême</span>
                      </div>
                    </div>

                    {/* Questions spirituelles */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 4 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <input type="checkbox" id="aff-aps" checked={newGuest.aps || false} onChange={e => setNewGuest({...newGuest, aps: e.target.checked})} style={{ accentColor: "var(--gold)" }} />
                        <label htmlFor="aff-aps" style={{ fontSize: 13, color: "var(--cream)", cursor: "pointer", fontWeight: 500 }}>
                          Avez-vous déjà accepté Jésus-Christ comme votre Sauveur et Seigneur de votre vie ?
                        </label>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <input type="checkbox" id="aff-localChurch" checked={newGuest.localChurch || false} onChange={e => setNewGuest({...newGuest, localChurch: e.target.checked})} style={{ accentColor: "var(--gold)" }} />
                          <label htmlFor="aff-localChurch" style={{ fontSize: 13, color: "var(--cream)", cursor: "pointer", fontWeight: 500 }}>
                            Persévérez-vous déjà dans une autre église ?
                          </label>
                        </div>
                        {newGuest.localChurch && (
                          <div style={{ paddingLeft: 26 }}>
                            <label className="form-label" style={{ fontSize: 10, marginBottom: 4 }}>NOM DE VOTRE ÉGLISE LOCALE</label>
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
                      <label className="form-label">COMMENTAIRE / NOTES PARTICULIÈRES</label>
                      <textarea 
                        className="input" 
                        value={newGuest.commentaire || ""} 
                        onChange={e => setNewGuest({...newGuest, commentaire: e.target.value})} 
                        placeholder="Sujets de prières, contexte spirituel ou familial..."
                        style={{ minHeight: 80, fontSize: 12, resize: "vertical" }}
                      />
                    </div>
</div></details>
<div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <input type="checkbox" checked={newGuest.souhaiteEtreContacte !== false} onChange={e => setNewGuest({...newGuest, souhaiteEtreContacte: e.target.checked})} style={{ accentColor: "var(--gold)" }} />
                      <span style={{ fontSize: 13, color: "var(--gold)", fontWeight: "bold" }}>Souhaite être contacté(e)</span>
                    </div>
<div style={{ marginTop: 10, display: "flex", gap: 12, justifyContent: "flex-end" }}>
                    <button type="button" className="btn btn-subtle" onClick={() => { setIsAddModalOpen(false); setEditingGuestId(null); }}>Annuler</button>
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

          <CrCallCenterModal
            isOpen={isCrModalOpen}
            onClose={() => setIsCrModalOpen(false)}
            guests={guests}
            churchName="CHARLEROI"
          />

          <ArrivalDateFilterModal
            isOpen={isArrivalDateModalOpen}
            onClose={() => setIsArrivalDateModalOpen(false)}
            selectedDates={arrivalDatesFilter}
            guests={guests}
            onApply={setArrivalDatesFilter}
          />


      <IntegrationOverview items={[
        { label: "À contacter", value: myPendingGuests.length, detail: "Mes nouveaux premiers contacts", icon: <Phone size={16} />, onClick: () => setCurrentView("my_assignments") },
        { label: "Mes âmes", value: mySoulsCount, detail: "Mon accompagnement en cours", icon: <UserCheck size={16} />, onClick: () => setCurrentView("my_souls") },
        (isIntegrationLeader || canDispatchAll)
          ? { label: "À affecter", value: unassignedGuests.length, detail: "Invités à confier à un conseiller", icon: <UserPlus size={16} />, onClick: () => setCurrentView("unassigned") }
          : { label: "Sans suite", value: retiredGuests.length, detail: "Historique des dossiers clôturés", icon: <Clock size={16} />, onClick: () => setCurrentView("retired") }
      ]} />
      {/* View Switcher Tabs */}
      <div className="invite-view-switcher integration-workflow-nav" role="group" aria-label="Étapes du suivi des âmes">
        {/* Tab 1: À affecter (Leader & dispatch only) */}
        {(isIntegrationLeader || canDispatchAll) && (
          <button 
            type="button"
            onClick={() => setCurrentView('unassigned')}
            aria-pressed={currentView === 'unassigned'} 
            className={`invite-view-option ${currentView === 'unassigned' ? 'active' : ''}`}
          >
            <span className="invite-view-icon"><UserPlus size={18} /></span>
            <span className="invite-view-copy">
              <span className="invite-view-title">
                À affecter {unassignedGuests.length > 0 && <span className="invite-view-count-badge warning">{unassignedGuests.length}</span>}
              </span>
              <span className="invite-view-subtitle">Non encore attribués</span>
            </span>
          </button>
        )}

        {/* Tab 2: Mes affectations (Conseillers & Leaders) */}
        <button 
          type="button"
          onClick={() => setCurrentView('my_assignments')}
          aria-pressed={currentView === 'my_assignments'} 
          className={`invite-view-option ${currentView === 'my_assignments' ? 'active' : ''}`}
        >
          <span className="invite-view-icon"><UserCheck size={18} /></span>
          <span className="invite-view-copy">
            <span className="invite-view-title">
              À contacter {myPendingGuests.length > 0 && <span className="invite-view-count-badge danger">{myPendingGuests.length}</span>}
            </span>
            <span className="invite-view-subtitle">En attente de 1er contact</span>
          </span>
        </button>

        {/* Tab 3: Mes âmes (Toujours présent pour chaque utilisateur) */}
        <button 
          type="button"
          onClick={() => {
            setCurrentView('my_souls');
            if (selectedMonth === -1) {
              setSelectedMonth(new Date().getMonth());
            }
          }}
          aria-pressed={currentView === 'my_souls'} 
          className={`invite-view-option ${currentView === 'my_souls' ? 'active' : ''}`}
        >
          <span className="invite-view-icon"><ListChecks size={18} /></span>
          <span className="invite-view-copy">
            <span className="invite-view-title">
              Mes âmes {mySoulsCount > 0 && <span className="invite-view-count-badge gold">{mySoulsCount}</span>}
            </span>
            <span className="invite-view-subtitle">Mon suivi spirituel actif</span>
          </span>
        </button>

        {/* Tab 4: Toutes les âmes (Leader & dispatch only) */}
        {(isIntegrationLeader || canDispatchAll) && (
          <button 
            type="button"
            onClick={() => {
              setCurrentView('all_souls');
              if (selectedMonth === -1) {
                setSelectedMonth(new Date().getMonth());
              }
            }}
            aria-pressed={currentView === 'all_souls'} 
            className={`invite-view-option ${currentView === 'all_souls' ? 'active' : ''}`}
          >
            <span className="invite-view-icon"><Users size={18} /></span>
            <span className="invite-view-copy">
              <span className="invite-view-title">
                Suivi de l’équipe {allSoulsCount > 0 && <span className="invite-view-count-badge gold">{allSoulsCount}</span>}
              </span>
              <span className="invite-view-subtitle">Vue globale de l&apos;équipe</span>
            </span>
          </button>
        )}

        {/* Tab 4: Sans suite (Dossiers clôturés) */}
        <button 
          type="button"
          onClick={() => setCurrentView('retired')}
          aria-pressed={currentView === 'retired'} 
          className={`invite-view-option ${currentView === 'retired' ? 'active' : ''}`}
        >
          <span className="invite-view-icon"><Clock size={18} /></span>
          <span className="invite-view-copy">
            <span className="invite-view-title">
              Sans suite {retiredGuests.length > 0 && <span className="invite-view-count-badge neutral">{retiredGuests.length}</span>}
            </span>
            <span className="invite-view-subtitle">Dossiers clôturés</span>
          </span>
        </button>

        {/* Tab 5: Statistiques */}
        <button 
          type="button"
          onClick={() => setCurrentView('stats')}
          aria-pressed={currentView === 'stats'} 
          className={`invite-view-option ${currentView === 'stats' ? 'active' : ''}`}
        >
          <span className="invite-view-icon"><BarChart3 size={18} /></span>
          <span className="invite-view-copy">
            <span className="invite-view-title">Statistiques</span>
            <span className="invite-view-subtitle">Suivi et progression</span>
          </span>
        </button>
      </div>

      {/* Filters in Stats View */}
      {currentView === 'stats' && (
        <div className="people-stat-filters" aria-label="Filtres des statistiques">
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: "var(--gold-light)", fontWeight: 700, letterSpacing: "0.5px" }}>ARRIVÉE</span>
            <button
              type="button"
              onClick={() => setIsArrivalDateModalOpen(true)}
              className={`${styles.arrivalFilterBtn} ${arrivalDatesFilter.length > 0 ? styles.arrivalFilterBtnActive : ""}`}
              title="Sélectionner les dates d'arrivée via modale personnalisée"
            >
              <Calendar size={13} style={{ color: "var(--gold)" }} />
              <span>
                {arrivalDatesFilter.length === 0
                  ? "Toutes dates"
                  : arrivalDatesFilter.length === 1
                  ? formatDisplayDate(arrivalDatesFilter[0])
                  : `${arrivalDatesFilter.length} dates`}
              </span>
              {arrivalDatesFilter.length > 0 && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    setArrivalDatesFilter([]);
                  }}
                  style={{ display: "inline-flex", alignItems: "center", padding: "1px 3px", borderRadius: 4, cursor: "pointer" }}
                  title="Effacer"
                >
                  <X size={12} />
                </span>
              )}
            </button>
            <CustomSelect
              size="sm"
              style={{ width: 130 }}
              value={arrivalMonth}
              onChange={setArrivalMonth}
              searchable={false}
              options={[
                { value: "all", label: "Tous les mois" },
                ...["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"].map((m, i) => ({
                  value: i.toString(),
                  label: m
                }))
              ]}
            />
            <CustomSelect
              size="sm"
              style={{ width: 110 }}
              value={arrivalYear}
              onChange={setArrivalYear}
              searchable={false}
              options={[
                { value: "all", label: "Toutes années" },
                ...availableYears.map(y => ({ value: y, label: y }))
              ]}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, color: "var(--gold-light)", fontWeight: 700, letterSpacing: "0.5px" }}>PRÉSENCES</span>
            <CustomSelect
              size="sm"
              style={{ width: 135 }}
              value={selectedMonth.toString()}
              onChange={val => setSelectedMonth(parseInt(val, 10))}
              searchable={false}
              options={[
                { value: "-1", label: "Tous les mois" },
                ...["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"].map((m, i) => ({
                  value: i.toString(),
                  label: m
                }))
              ]}
            />
            <CustomSelect
              size="sm"
              style={{ width: 100 }}
              value={selectedYear.toString()}
              onChange={val => setSelectedYear(parseInt(val, 10))}
              searchable={false}
              options={availableYears.map(y => ({ value: y, label: y }))}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, color: "var(--gold-light)", fontWeight: 700, letterSpacing: "0.5px" }}>ÉGLISE LOCALE</span>
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
          {(isIntegrationLeader || canDispatchAll) && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11, color: "var(--gold-light)", fontWeight: 700, letterSpacing: "0.5px" }}>CONSEILLER</span>
              <CustomSelect
                size="sm"
                style={{ width: 190 }}
                value={selectedCounselorFilter}
                onChange={setSelectedCounselorFilter}
                searchable={counselors.length >= 6}
                options={[
                  { value: "all", label: "Tous les conseillers" },
                  ...counselors.map(c => ({ value: c.id, label: c.display_name }))
                ]}
              />
            </div>
          )}
        </div>
      )}

      {currentView === 'stats' ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <PeopleStatistics
            total={filtered.length}
            totalLabel={selectedCounselorObj ? `Âmes suivies par ${selectedCounselorObj.display_name}` : "Âmes confiées"}
            brebis={brebisCount}
            calls={callsSuccess}
            loyal={fidelisees}
            pcnc={[pcnc001,pcnc101,pcnc201,pcnc301]}
            pcncTotal={totalPCNC}
            followup={[{label:"Sans église",value:noChurch},{label:"Avec téléphone",value:phoneCount},{label:"Fiches APS",value:apsCount},{label:"Revenus au culte",value:returnedCount}]}
            engagement={[{label:"Intérêt PCNC",value:interetPCNC},{label:"Baptême par immersion",value:baptemeEauCount},{label:"Dans une famille de disciples",value:dansFamilleDiscipleCount},{label:"Intégrés en CDM",value:integreCDMCount},{label:"Souhaitent servir",value:veutServirCount},{label:"Devenus S.T.A.R",value:devenuStarCount}]}
            participation={[{label:"Culte du dimanche",value:avgParticipationCulte},{label:"CDM du jeudi",value:avgParticipationCDM}]}
            families={[...new Set([...availableFamilies, ...filtered.map(g => g.famille_disciple).filter((f): f is string => !!f && f !== "AUCUNE")])].map(f => ({label:f,value:filtered.filter(g => g.famille_disciple === f).length})).concat([{label:"Sans famille affectée",value:filtered.filter(g => !g.famille_disciple || g.famille_disciple === "AUCUNE").length}])}
          />

          {selectedCounselorFilter !== "all" && (
            <div style={{ marginTop: 12 }}>
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 20px",
                borderRadius: "12px",
                background: "rgba(212, 175, 55, 0.08)",
                border: "1px solid rgba(212, 175, 55, 0.25)",
                marginBottom: 16
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Users size={18} style={{ color: "var(--gold)" }} />
                  <span style={{ fontWeight: 700, fontSize: 15, color: "var(--cream)" }}>
                    Âmes suivies par {selectedCounselorObj?.display_name || "le conseiller"} ({filtered.length})
                  </span>
                </div>
                <span style={{ fontSize: 12, color: "var(--cream-dim)" }}>
                  Informations de suivi détaillées &bull; Cliquez sur &laquo;&nbsp;Voir plus&nbsp;&raquo; pour inspecter
                </span>
              </div>

              {filtered.length === 0 ? (
                <div className="people-empty" style={{ padding: "32px 16px" }}>
                  <Users size={28} />
                  <p>Aucune âme activement suivie par ce conseiller avec les filtres sélectionnés.</p>
                </div>
              ) : (
                <TriageListView
                  mode="all_guests"
                  guests={filtered}
                  counselors={counselors}
                  onAssign={handleAssignCounselor}
                  onOpenVoirPlus={setSelectedArrivalGuest}
                  isLeader={true}
                />
              )}
            </div>
          )}
        </div>
      ) : currentView === 'unassigned' ? (
        <TriageListView
          key="unassigned"
          mode="unassigned"
          guests={unassignedGuests}
          counselors={counselors}
          onAssign={handleAssignCounselor}
          onOpenVoirPlus={setSelectedArrivalGuest}
          isLeader={true}
        />
      ) : currentView === 'my_assignments' ? (
        <TriageListView
          key="my_assignments"
          mode="my_assignments"
          guests={myPendingGuests}
          counselors={counselors}
          onOpenConserver={setQualifyingGuest}
          onOpenRetirer={setRetiringGuest}
          onOpenVoirPlus={setSelectedArrivalGuest}
        />
      ) : currentView === 'retired' ? (
        <TriageListView
          key="retired"
          mode="retired"
          guests={retiredGuests}
          counselors={counselors}
          onAssign={handleAssignCounselor}
          onOpenVoirPlus={setSelectedArrivalGuest}
          isLeader={isIntegrationLeader || canDispatchAll}
        />
      ) : (
        <>
          {/* Modern Filters & Controls */}
          <PeopleListToolbar
            search={search} onSearch={setSearch}
            countLabel={`${filtered.length} âme${filtered.length > 1 ? "s" : ""}`}
            showModes={false}
            
            activeCount={Number(arrivalDatesFilter.length > 0 || arrivalMonth !== "all" || arrivalYear !== "all") + Number(localChurchFilter !== "all") + Number(familyFilter !== "all")} onReset={resetAllFilters}
            period={`Présences : ${selectedMonth === -1 ? "toute l’année" : new Date(selectedYear, selectedMonth).toLocaleDateString("fr-BE", { month: "long" })} ${selectedYear}`}>

              {/* Arrivée Filter */}
              <div className={styles.filterChip} role="group" aria-label="Date d’arrivée">
                <span className={styles.filterLabel}><Calendar size={12} /> Arrivée</span>
                <button
                  type="button"
                  onClick={() => setIsArrivalDateModalOpen(true)}
                  className={`${styles.arrivalFilterBtn} ${arrivalDatesFilter.length > 0 ? styles.arrivalFilterBtnActive : ""}`}
                  title="Choisir parmi les dates en base ou via calendrier direct"
                >
                  <CalendarDays size={13} style={{ color: "var(--gold)" }} />
                  <span>
                    {arrivalDatesFilter.length === 0
                      ? "Toutes dates"
                      : arrivalDatesFilter.length === 1
                      ? formatDisplayDate(arrivalDatesFilter[0])
                      : `${arrivalDatesFilter.length} dates`}
                  </span>
                  {arrivalDatesFilter.length > 0 && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        setArrivalDatesFilter([]);
                      }}
                      style={{ display: "inline-flex", alignItems: "center", padding: "1px 2px", marginLeft: 2, cursor: "pointer" }}
                      title="Effacer"
                    >
                      <X size={12} />
                    </span>
                  )}
                </button>
                <CustomSelect
                  size="sm"
                  style={{ width: 105 }}
                  value={arrivalMonth}
                  onChange={setArrivalMonth}
                  searchable={false}
                  options={[
                    { value: "all", label: "Tous mois" },
                    ...["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"].map((m, i) => ({
                      value: i.toString(),
                      label: m
                    }))
                  ]}
                />
                <CustomSelect
                  size="sm"
                  style={{ width: 95 }}
                  value={arrivalYear}
                  onChange={setArrivalYear}
                  searchable={false}
                  options={[
                    { value: "all", label: "Toutes années" },
                    ...availableYears.map(y => ({ value: y, label: y }))
                  ]}
                />
              </div>

              {/* Présences Calculation Period Filter */}
              <div className={styles.filterChip} role="group" aria-label="Période des présences">
                <span className={styles.filterLabel}>👁 Présences</span>
                <CustomSelect
                  size="sm"
                  style={{ width: 110 }}
                  value={selectedMonth.toString()}
                  onChange={val => setSelectedMonth(parseInt(val, 10))}
                  searchable={false}
                  options={[
                    { value: "-1", label: "Tous mois" },
                    ...["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"].map((m, i) => ({
                      value: i.toString(),
                      label: m
                    }))
                  ]}
                />
                <CustomSelect
                  size="sm"
                  style={{ width: 90 }}
                  value={selectedYear.toString()}
                  onChange={val => setSelectedYear(parseInt(val, 10))}
                  searchable={false}
                  options={availableYears.map(y => ({ value: y, label: y }))}
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

              {/* Conseiller Filter (for Leader & dispatch) */}
              {(isIntegrationLeader || canDispatchAll) && currentView === 'all_souls' && (
                <div className={styles.filterChip} role="group" aria-label="Conseiller">
                  <span className={styles.filterLabel}>👤 Conseiller</span>
                  <CustomSelect
                    size="sm"
                    style={{ width: 160 }}
                    value={selectedCounselorFilter}
                    onChange={setSelectedCounselorFilter}
                    searchable={counselors.length >= 6}
                    options={[
                      { value: "all", label: "Tous conseillers" },
                      ...counselors.map(c => ({ value: c.id, label: c.display_name }))
                    ]}
                  />
                </div>
              )}

              
          </PeopleListToolbar>

          {/* Cards View */}
          <div className="people-cards">
          {filtered.length === 0 && <div className="people-empty"><Search size={26} /><h3>Aucune personne trouvée</h3><p>Essayez un autre nom ou ajustez les filtres.</p>{isAnyFilterActive && <button type="button" className="btn btn-outline" onClick={resetAllFilters}>Réinitialiser les filtres</button>}</div>}
            {filtered.map((guest) => {
              const rateCDM = calculateRate(guest, thursdays);
              const rateCulte = calculateRate(guest, sundays);
              const fidelised = isFidelise(guest);
              const isExpanded = expandedId === guest.id;
              const isRestricted = isIntegrationOrCounselor
                ? guest.assigned_to !== userId
                : guest.responsible !== userName;

              return (
                <div key={guest.id} className="glass glass-flush soul-card" data-expanded={isExpanded} style={{ borderLeft: fidelised ? "4px solid var(--gold)" : "1px solid var(--border)", transition: "all 0.3s ease" }}>
                  <div
                    className="affectation-card-header soul-card-header"
                    onClick={() => setExpandedId(isExpanded ? null : guest.id)}
                  >
                    <div className="affectation-card-person">
                      <div className={`avatar ${fidelised ? "avatar-gradient avatar-effect-aura" : "avatar-gradient"}`}>
                        {guest.firstName[0]}{guest.lastName[0]}
                      </div>
                      <div className="affectation-card-identity">
                        <div className="affectation-card-name-row">
                          <h3 className="affectation-card-title">
                            <span>{guest.firstName} {guest.lastName}</span>
                          </h3>
                          {fidelised && <span className="badge badge-gold" style={{ fontSize: 8 }}>Fidélisé</span>}
                          {(isIntegrationOrCounselor || isAuthorizedLeader) && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); openEditModal(guest); }}
                              className="btn-icon btn-icon-gold affectation-btn-more"
                              title="Modifier les informations"
                            >
                              <MoreHorizontal size={14} />
                            </button>
                          )}
                        </div>
                        <div className="affectation-card-meta">
                          {guest.civility} · {guest.age ? (guest.age.includes("ans") ? guest.age : `${guest.age} ans`) : ""} · {isIntegrationOrCounselor ? (
                            <>Conseiller: <span className="meta-highlight">{guest.assigned_to === userId ? (userName || "Moi") : (counselors.find(c => c.id === guest.assigned_to)?.display_name || "Non assigné")}</span></>
                          ) : (
                            <>Responsable: <span className="meta-highlight">{guest.responsible}</span></>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="affectation-card-right">
                      <div className="affectation-card-stats">
                        <div className="affectation-stat-pill">
                          <span className="stat-label">CDM</span>
                          <span className={`stat-val ${rateCDM >= 45 ? "stat-good" : "stat-low"}`}>{rateCDM}%</span>
                        </div>
                        <div className="affectation-stat-pill">
                          <span className="stat-label">Culte</span>
                          <span className={`stat-val ${rateCulte >= 45 ? "stat-good" : "stat-low"}`}>{rateCulte}%</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="affectation-expand-btn"
                        aria-expanded={isExpanded}
                        aria-label={`${isExpanded ? "Réduire" : "Déplier"} le suivi de ${guest.firstName} ${guest.lastName}`}
                        onClick={e => { e.stopPropagation(); setExpandedId(isExpanded ? null : guest.id); }}
                      >
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </div>
                  </div>

                {isExpanded && (
                    <div className="soul-card-body" style={{ borderTop: "1px solid var(--border)", background: "var(--surface-solid)" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(280px, 100%), 1fr))", gap: 24, padding: 24 }}>
                        {/* Info Column */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                          <h4 style={{ fontSize: 11, color: "var(--gold)", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 4, fontFamily: "var(--font-body)", fontWeight: 700 }}>Informations Générales</h4>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                            <Mail size={14} style={{ color: "var(--muted)" }} /> <span style={{ color: "var(--cream-dim)", wordBreak: "break-all" }}>{guest.email || "Non renseigné"}</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                            <Phone size={14} style={{ color: "var(--muted)" }} /> <span style={{ color: "var(--cream-dim)", wordBreak: "break-all" }}>{guest.phone || "Non renseigné"}</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                            <Calendar size={14} style={{ color: "var(--gold)" }} /> <span style={{ color: "var(--cream-dim)" }}>Arrivé le: {guest.arrivalDate ? guest.arrivalDate.split('-').reverse().join('/') : ''}</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                            <MapPin size={14} style={{ color: "var(--muted)" }} /> <span style={{ fontSize: 12, color: "var(--cream-dim)", wordBreak: "break-word" }}>{guest.address ? `${guest.address}${guest.pays ? ` (${guest.pays})` : ''}` : (guest.pays ? `Pays: ${guest.pays}` : "Adresse non renseignée")}</span>
                          </div>
                          <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
                            <span className="badge badge-gold" style={{ fontSize: 9 }}>{guest.event}</span>
                            <span className={`badge ${guest.aps ? "badge-green" : "badge-red"}`} style={{ fontSize: 9 }}>APS: {guest.aps ? "Oui" : "Non"}</span>
                            <span className={`badge ${guest.localChurch ? "badge-green" : "badge-red"}`} style={{ fontSize: 9 }}>Église locale: {guest.localChurch ? "Oui" : "Non"}</span>
                          </div>

                          <div style={{ marginTop: 10 }}>
                            <label className="form-label" style={{ fontSize: 9 }}>Commentaire d'arrivée</label>
                            <div className="soul-card-note" style={{ fontSize: 12, color: "var(--cream-dim)", background: "var(--bg)", padding: 12, borderRadius: 10, border: "1px solid var(--border)", lineHeight: 1.5 }}>
                              {guest.commentaire || <span style={{ fontStyle: "italic", color: "var(--muted)" }}>Aucun commentaire d'arrivée rédigé.</span>}
                            </div>
                          </div>
                          
                          <FamilyAssignment value={guest.famille_disciple} families={availableFamilies} person={guest.firstName + " " + guest.lastName} disabled={isRestricted} onChange={value => handleUpdateFamily(guest.id,value)} />

                          {guest.bergerie_id && (
                            <button 
                              className={`btn ${guest.isInBergerie ? "btn-subtle" : "btn-primary"} btn-sm`} 
                              style={{ 
                                marginTop: 12, 
                                width: "100%", 
                                display: "flex", 
                                alignItems: "center", 
                                justifyContent: "center", 
                                gap: 6,
                                ...(guest.isInBergerie ? { color: "var(--red)", borderColor: "rgba(239, 68, 68, 0.2)" } : { background: "linear-gradient(135deg, var(--green) 0%, #16a34a 100%)", border: "none" })
                              }}
                              onClick={() => guest.isInBergerie ? removeFromMember(guest) : promoteToMember(guest)}
                            >
                              {guest.isInBergerie ? "Retirer de la Bergerie (Membre)" : "Ajouter à la Bergerie (Membre)"}
                            </button>
                          )}

                          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16, alignItems: "center" }}>
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              style={{ 
                                display: "inline-flex", 
                                alignItems: "center", 
                                gap: 6,
                                padding: "6px 12px",
                                fontSize: 12
                              }}
                              onClick={() => setSelectedArrivalGuest(guest)}
                              title="Voir toutes les informations d'arrivée et les coordonnées complètes"
                            >
                              <Eye size={14} /> Fiche d'arrivée complète
                            </button>

                            {currentView === 'my_souls' ? (
                              <button 
                                type="button"
                                className="btn btn-subtle btn-sm" 
                                style={{ 
                                  color: "var(--red)", 
                                  borderColor: "rgba(239, 68, 68, 0.25)", 
                                  background: "rgba(239, 68, 68, 0.05)",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 6,
                                  padding: "6px 12px",
                                  fontSize: 12
                                }}
                                onClick={() => handleQuickRetire(guest.id)}
                                title="Retirer cette âme de votre suivi et la placer directement dans 'Sans suite'"
                              >
                                <UserMinus size={14} /> Retirer de mon suivi
                              </button>
                            ) : (
                              (isIntegrationOrCounselor || isAuthorizedLeader) && !isConseiller && (
                                <button 
                                  className="btn btn-subtle btn-sm" 
                                  style={{ color: "var(--red)", borderColor: "rgba(239, 68, 68, 0.2)" }}
                                  onClick={() => handleDeleteGuest(guest.id)}
                                >
                                  Supprimer définitivement
                                </button>
                              )
                            )}
                          </div>
                        </div>

                        {/* Attendance Tracking (Dynamic) */}
                        <details className="people-card-section"><summary><span><strong>Présences</strong><small>CDM et culte</small></span><ChevronDown size={17} /></summary><div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                          <div>
                            <h4 style={{ fontSize: 11, color: "var(--gold)", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10, fontFamily: "var(--font-body)", fontWeight: 700 }}>Présences CDM (Jeudi)</h4>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              {thursdays.filter(day => !guest.arrivalDate || day >= guest.arrivalDate).map((day) => {
                                const isBeforeArrival = guest.arrivalDate && day < guest.arrivalDate;
                                const isPresent = Boolean(guest.attendance && guest.attendance[day]);
                                return (
                                  <button
                                    type="button"
                                    key={day}
                                    data-present={isPresent ? "true" : "false"}
                                    className={`attendance-day ${isPresent ? "attendance-day--present" : ""} ${isBeforeArrival ? "attendance-day--not-applicable" : ""} ${isRestricted ? "attendance-day--readonly" : ""}`}
                                    title={isBeforeArrival ? "Non applicable (avant l'arrivée)" : `${day} : ${isPresent ? "Présent(e) (cliquer pour retirer)" : "Absent(e) (cliquer pour marquer présent)"}`} 
                                    onClick={() => !isRestricted && !isBeforeArrival && toggleAttendance(guest.id, day)}
                                  >
                                    <span className="attendance-day-num">{parseInt(day.split('-')[2], 10)}</span>
                                    {isPresent && <span className="attendance-check-icon">✓</span>}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div>
                            <h4 style={{ fontSize: 11, color: "var(--gold)", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10, fontFamily: "var(--font-body)", fontWeight: 700 }}>Présences Culte (Dimanche)</h4>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              {sundays.filter(day => !guest.arrivalDate || day >= guest.arrivalDate).map((day) => {
                                const isBeforeArrival = guest.arrivalDate && day < guest.arrivalDate;
                                const isPresent = Boolean(guest.attendance && guest.attendance[day]);
                                return (
                                  <button
                                    type="button"
                                    key={day}
                                    data-present={isPresent ? "true" : "false"}
                                    className={`attendance-day ${isPresent ? "attendance-day--present" : ""} ${isBeforeArrival ? "attendance-day--not-applicable" : ""} ${isRestricted ? "attendance-day--readonly" : ""}`}
                                    title={isBeforeArrival ? "Non applicable (avant l'arrivée)" : `${day} : ${isPresent ? "Présent(e) (cliquer pour retirer)" : "Absent(e) (cliquer pour marquer présent)"}`} 
                                    onClick={() => !isRestricted && !isBeforeArrival && toggleAttendance(guest.id, day)}
                                  >
                                    <span className="attendance-day-num">{parseInt(day.split('-')[2], 10)}</span>
                                    {isPresent && <span className="attendance-check-icon">✓</span>}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div></details>

                        {/* Suivi Groups */}
                        <details className="people-card-section"><summary><span><strong>Suivi et accompagnement</strong><small>Premier contact et intégration</small></span><ChevronDown size={17} /></summary><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))", gap: 16 }}>
                          <div className="glass glass-compact" style={{ background: "var(--surface-solid)", display: "flex", flexDirection: "column", gap: 10, border: "1px solid var(--border)" }}>
                            <h4 style={{ fontSize: 10, color: "var(--gold-light)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4, fontFamily: "var(--font-body)", fontWeight: 700 }}>Premier Contact</h4>
                            <div>
                              <SuiviToggle label="Appel abouti" checked={guest.appelAbouti} onChange={() => toggleSuivi(guest.id, 'appelAbouti')} disabled={isRestricted} />
                              <SuiviToggle label="Ne décroche pas / Relance" checked={Boolean(guest.neDecrochePas)} onChange={() => toggleSuivi(guest.id, 'neDecrochePas')} disabled={isRestricted} />
                              <SuiviToggle label="Faux numéro / Erroné" checked={Boolean(guest.fauxNumero)} onChange={() => toggleSuivi(guest.id, 'fauxNumero')} disabled={isRestricted} />
                              <SuiviToggle label="Souhait suivi" checked={Boolean(guest.souhaitSuivi)} onChange={() => toggleSuivi(guest.id, 'souhaitSuivi')} disabled={isRestricted} />
                              {!guest.appelAbouti && !isRestricted && (
                                <div 
                                  className="glass"
                                  style={{ 
                                    marginTop: 10, 
                                    padding: 12,
                                    background: "rgba(239, 68, 68, 0.04)",
                                    border: "1px dashed rgba(239, 68, 68, 0.3)",
                                    borderRadius: 10,
                                  }}
                                >
                                  <label className="form-label" style={{ color: "var(--red)", fontSize: 9 }}>Raison de l'échec</label>
                                  <textarea 
                                    placeholder="Pourquoi l'appel n'a pas abouti ? (ex: répondeur, faux numéro...)" 
                                    value={guest.raisonEchec || ""} 
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setGuests(prev => prev.map(g => g.id === guest.id ? { ...g, raisonEchec: val } : g));
                                    }}
                                    onBlur={async (e) => {
                                      const val = e.target.value.trim();
                                      setGuests(prev => prev.map(g => g.id === guest.id ? { ...g, raisonEchec: val } : g));
                                      const baseComment = (guest.commentaireSuivi || "").replace(/\[RAISON_ECHEC:[^\]]+\]\s*/gi, "").trim();
                                      const tag = val ? `[RAISON_ECHEC: ${val}]` : "";
                                      const fullComment = [tag, baseComment].filter(Boolean).join("\n").trim();
                                      try {
                                        const { error } = await supabase.from("invites").update({ raison_echec: val, commentaire_suivi: fullComment }).eq("id", guest.id);
                                        if (error) {
                                          await supabase.from("invites").update({ commentaire_suivi: fullComment }).eq("id", guest.id);
                                        }
                                      } catch {}
                                    }}
                                    style={{ 
                                      width: "100%", 
                                      minHeight: 50,
                                      fontSize: 11, 
                                      background: "var(--bg-deep)", 
                                      border: "1px solid var(--border)", 
                                      borderRadius: 6, 
                                      padding: "8px", 
                                      color: "var(--cream)",
                                      resize: "vertical",
                                      lineHeight: "1.4"
                                    }}
                                  />
                                </div>
                              )}
                            </div>
                            <SuiviToggle label="Groupe WhatsApp" checked={guest.groupeWhatsapp} onChange={() => toggleSuivi(guest.id, 'groupeWhatsapp')} disabled={isRestricted} />
                            <SuiviToggle label="Prévu de revenir" checked={guest.prevuRevenir} onChange={() => toggleSuivi(guest.id, 'prevuRevenir')} disabled={isRestricted} />
                            <SuiviToggle label="Revenu au culte" checked={guest.estRevenuCulte} onChange={() => toggleSuivi(guest.id, 'estRevenuCulte')} disabled={isRestricted} />
                          </div>
                          
                          <div className="glass glass-compact" style={{ background: "var(--surface-solid)", display: "flex", flexDirection: "column", gap: 10, border: "1px solid var(--border)" }}>
                            <h4 style={{ fontSize: 10, color: "var(--gold-light)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4, fontFamily: "var(--font-body)", fontWeight: 700 }}>Intégration & CDM</h4>
                            <SuiviToggle label="Intérêt PCNC" checked={guest.interetFormation} onChange={() => toggleSuivi(guest.id, 'interetFormation')} disabled={isRestricted} />
                            <SuiviToggle label="Sujet Prière/Partage" checked={guest.prierePartage} onChange={() => toggleSuivi(guest.id, 'prierePartage')} disabled={isRestricted} />
                            <SuiviToggle label="Intérêt C.D.M" checked={guest.interetCDM} onChange={() => toggleSuivi(guest.id, 'interetCDM')} disabled={isRestricted} />
                            <SuiviToggle label="A intégré C.D.M" checked={guest.integreCDM} onChange={() => toggleSuivi(guest.id, 'integreCDM')} disabled={isRestricted} />
                            <SuiviToggle label="Famille Disciple" checked={guest.dansFamilleDisciple} onChange={() => toggleSuivi(guest.id, 'dansFamilleDisciple')} disabled={isRestricted} />
                            {guest.famille_disciple && guest.famille_disciple !== "AUCUNE" && (
                              <div style={{ fontSize: 10, color: "var(--gold-light)", fontWeight: 600, paddingLeft: 22, marginTop: -4 }}>
                                ↳ {guest.famille_disciple}
                              </div>
                            )}
                            <SuiviToggle label="Intérêt Baptême" checked={guest.interetBapteme} onChange={() => toggleSuivi(guest.id, 'interetBapteme')} disabled={isRestricted} />
                            <SuiviToggle label="RDV pastoral" checked={Boolean(guest.rdvPastoral)} onChange={() => toggleSuivi(guest.id, 'rdvPastoral')} disabled={isRestricted} />
                            <SuiviToggle label="Visite à domicile" checked={Boolean(guest.visiteDomicile)} onChange={() => toggleSuivi(guest.id, 'visiteDomicile')} disabled={isRestricted} />
                            <SuiviToggle label="Cocktail Bienvenue" checked={guest.cocktailBienvenue} onChange={() => toggleSuivi(guest.id, 'cocktailBienvenue')} disabled={isRestricted} />
                          </div>
                        </div></details>

                        {/* PCNC & Service */}
                        <details className="people-card-section"><summary><span><strong>Parcours et commentaires</strong><small>Formations, service et notes de suivi</small></span><ChevronDown size={17} /></summary><div className="glass glass-compact col-span-2" style={{ background: "var(--surface-solid)", border: "1px solid var(--border)" }}>
                          <h4 style={{ fontSize: 10, color: "var(--gold)", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 12, fontFamily: "var(--font-body)", fontWeight: 700 }}>PCNC & Engagement spirituel</h4>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
                            <SuiviToggle label="PCNC 001" checked={guest.pcnc} onChange={() => toggleSuivi(guest.id, 'pcnc')} disabled={isRestricted} />
                            <SuiviToggle label="PCNC 101" checked={guest.p101} onChange={() => toggleSuivi(guest.id, 'p101')} disabled={isRestricted} />
                            <SuiviToggle label="PCNC 201" checked={guest.p201} onChange={() => toggleSuivi(guest.id, 'p201')} disabled={isRestricted} />
                            <SuiviToggle label="PCNC 301" checked={guest.p301} onChange={() => toggleSuivi(guest.id, 'p301')} disabled={isRestricted} />
                            <SuiviToggle label="PCNC Terminé" checked={guest.terminePCNC} onChange={() => toggleSuivi(guest.id, 'terminePCNC')} disabled={isRestricted} />
                            <SuiviToggle label="Baptême par immersion" checked={guest.baptemeEau} onChange={() => toggleSuivi(guest.id, 'baptemeEau')} disabled={isRestricted} />
                            <SuiviToggle label="Veut servir" checked={guest.veutServir} onChange={() => toggleSuivi(guest.id, 'veutServir')} disabled={isRestricted} />
                            <SuiviToggle label="Devenu S.T.A.R" checked={guest.devenuStar} onChange={() => toggleSuivi(guest.id, 'devenuStar')} disabled={isRestricted} />
                          </div>

                          {/* 12 Piliers (Formation en 4 séances) */}
                          <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px dashed rgba(212,175,55,0.18)" }}>
                            <h5 style={{ fontSize: 10, color: "var(--gold)", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 12, fontFamily: "var(--font-body)", fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                              <span>🏛️</span> 12 Piliers (Formation - 4 séances)
                            </h5>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
                              <SuiviToggle label="Séance 1" checked={Boolean(guest.piliers1)} onChange={() => toggleSuivi(guest.id, 'piliers1')} disabled={isRestricted} />
                              <SuiviToggle label="Séance 2" checked={Boolean(guest.piliers2)} onChange={() => toggleSuivi(guest.id, 'piliers2')} disabled={isRestricted} />
                              <SuiviToggle label="Séance 3" checked={Boolean(guest.piliers3)} onChange={() => toggleSuivi(guest.id, 'piliers3')} disabled={isRestricted} />
                              <SuiviToggle label="Séance 4" checked={Boolean(guest.piliers4)} onChange={() => toggleSuivi(guest.id, 'piliers4')} disabled={isRestricted} />
                              <SuiviToggle label="12 Piliers Terminé" checked={Boolean(guest.termine12Piliers)} onChange={() => toggleSuivi(guest.id, 'termine12Piliers')} disabled={isRestricted} />
                            </div>
                          </div>
                          
                          <div style={{ marginTop: 16 }}>
                            <label className="form-label" style={{ fontSize: 9 }}>Commentaires de suivi / Notes d'accompagnement</label>
                            <textarea 
                              className="input" 
                              rows={3} 
                              value={guest.commentaireSuivi || ""} 
                              disabled={isRestricted}
                              placeholder="Notes détaillées sur son parcours spirituel, ses défis, ses besoins de prière..."
                              style={{ 
                                fontSize: 12, 
                                resize: "vertical", 
                                background: "var(--bg-deep)",
                                minHeight: 70,
                                padding: 12,
                                opacity: isRestricted ? 0.5 : 1,
                                cursor: isRestricted ? "not-allowed" : "text"
                              }}
                              onChange={(e) => {
                                const val = e.target.value;
                                setGuests(prev => prev.map(g => g.id === guest.id ? {...g, commentaireSuivi: val} : g));
                              }}
                              onBlur={async (e) => {
                                const val = e.target.value.trim();
                                setGuests(prev => prev.map(g => g.id === guest.id ? {...g, commentaireSuivi: val} : g));
                                const tag = guest.raisonEchec ? `[RAISON_ECHEC: ${guest.raisonEchec}]` : "";
                                const fullComment = [tag, val].filter(Boolean).join("\n").trim();
                                await supabase.from("invites").update({ commentaire_suivi: fullComment }).eq("id", guest.id);
                              }}
                            />
                          </div>
                        </div></details>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Transfer Modal */}
          {typeof window !== "undefined" && isTransferModalOpen && transferringGuest && createPortal(
            <div className="modal-overlay">
              <div className="custom-modal fade-in" style={{ maxWidth: 450 }}>
                <button 
                  onClick={() => { setIsTransferModalOpen(false); setTransferringGuest(null); }} 
                  style={{ position: "absolute", top: 20, right: 20, background: "none", border: "none", color: "var(--muted)", cursor: "pointer", display: "flex", alignItems: "center" }}
                >
                  <X size={20} />
                </button>
                
                <h3 style={{ fontSize: 18, color: "var(--gold-light)", marginBottom: 20, fontFamily: "var(--font-display)" }}>
                  Confier l'invité
                </h3>
                
                <p style={{ fontSize: 13, color: "var(--cream-dim)", marginBottom: 20, lineHeight: 1.5 }}>
                  Sélectionnez la famille de disciples (Bergerie) à laquelle vous souhaitez confier <strong>{transferringGuest.firstName} {transferringGuest.lastName}</strong>.
                </p>
                
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div>
                    <label className="form-label" style={{ fontSize: 10, marginBottom: 6, display: "block" }}>CHOISIR UNE FAMILLE</label>
                    <CustomSelect 
                      value={selectedBergerieId} 
                      onChange={val => setSelectedBergerieId(val)}
                      placeholder="-- Choisir une famille --"
                      ariaLabel="Choisir une famille"
                      searchable={activeBergeries.length >= 6}
                      options={[
                        { value: "", label: "-- Choisir une famille --" },
                        ...activeBergeries.map(b => ({
                          value: b.id,
                          label: b.name
                        }))
                      ]}
                    />
                  </div>
                  
                  <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 10 }}>
                    <button 
                      type="button" 
                      className="btn btn-subtle" 
                      onClick={() => { setIsTransferModalOpen(false); setTransferringGuest(null); }}
                    >
                      Annuler
                    </button>
                    <button 
                      type="button" 
                      className="btn btn-primary" 
                      disabled={isTransferring || !selectedBergerieId}
                      onClick={handleTransferGuest}
                    >
                      {isTransferring ? "En cours..." : "Confier"}
                    </button>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )}
        </>
      )}

      {/* Modales pour le workflow de triage et qualification */}
      <GuestArrivalDetailsModal
        isOpen={Boolean(selectedArrivalGuest)}
        onClose={() => setSelectedArrivalGuest(null)}
        guest={selectedArrivalGuest}
        counselors={counselors}
        onAssign={async (guestId, counselorId) => {
          await handleAssignCounselor(guestId, counselorId);
          setSelectedArrivalGuest(prev => prev && prev.id === guestId ? { ...prev, assigned_to: counselorId } : prev);
        }}
        isLeader={isIntegrationLeader || canDispatchAll}
      />

      <QualifyGuestModal
        isOpen={Boolean(qualifyingGuest)}
        onClose={() => setQualifyingGuest(null)}
        guest={qualifyingGuest}
        onConfirm={handleConfirmConserve}
      />

      <RetireGuestModal
        isOpen={Boolean(retiringGuest)}
        onClose={() => setRetiringGuest(null)}
        guest={retiringGuest}
        onConfirm={handleConfirmRetire}
      />
    </div>
  );
}

function SuiviToggle({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange?: () => void; disabled?: boolean }) {
  return (
    <div 
      onClick={!disabled ? onChange : undefined}
      className={`suivi-toggle-row ${disabled ? "suivi-toggle-row--readonly" : ""}`}
      style={{ 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "space-between", 
        padding: "8px 12px",
        background: "var(--bg-deep)",
        borderRadius: "8px",
        cursor: (onChange && !disabled) ? "pointer" : "default",
        transition: "all 0.2s ease",
        border: "1px solid var(--border)"
      }}
    >
      <span style={{ fontSize: 11, fontWeight: 700, color: checked ? "var(--cream)" : "var(--muted)", transition: "color 0.2s" }}>{label}</span>
      <button className={`toggle ${checked ? "on" : ""}`} style={{ transform: "scale(0.65)", transformOrigin: "right", pointerEvents: "none" }} />
    </div>
  );
}


export default function Page() {
  return <Suspense fallback={<p role="status">Chargement…</p>}><AffectationPage /></Suspense>;
}
