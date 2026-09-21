"use client";

import { Suspense, useRef, useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { 
  Search, Plus, UserPlus, Filter, CheckCircle2, XCircle, X, 
  Calendar, MapPin, Mail, Phone, User as UserIcon,
  ChevronDown, ChevronUp, MoreHorizontal, Loader2, ListChecks, BarChart3,
  LayoutGrid, Table as TableIcon, Sparkles, RotateCcw, Eye
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { autoAddLeaderToMembers, listIntegrationTeam, getIntegrationInvites, assignCounselorToGuest } from "@/app/actions/auth";
import { getActiveContext, getActiveUserInfo } from "@/lib/client-session";
import { filterElapsedDateKeys } from "@/lib/date-utils";
import PersonPanel, { PersonButton } from "@/components/experience/PersonPanel";
import { usePeopleView } from "@/lib/use-people-view";
import { useFeedback } from "@/components/experience/FeedbackProvider";
import styles from "./Affectation.module.css";

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
    responsible: g.responsible,
    isInBergerie: g.is_in_bergerie,
    status: g.status,
    attendance: g.attendance || {},
    appelAbouti: g.appel_abouti,
    groupeWhatsapp: g.groupe_whatsapp,
    prevuRevenir: g.prevu_revenir,
    estRevenuCulte: g.est_revenu_culte,
    rencontreEffectuee: g.rencontre_effectuee,
    visiteDomicile: g.visite_domicile,
    cocktailBienvenue: g.cocktail_bienvenue,
    pcnc: g.pcnc,
    p101: g.p101,
    p201: g.p201,
    p301: g.p301,
    terminePCNC: g.termine_pcnc,
    baptemeEau: g.bapteme_eau,
    baptemeEsprit: g.bapteme_esprit,
    veutServir: g.veut_servir,
    devenuStar: g.devenu_star,
    smsBienvenue: g.sms_bienvenue || false,
    priere: g.priere || false,
    interetEvenement: g.interet_evenement || false,
    interetFormation: g.interet_formation || false,
    aEteInvite: g.a_ete_invite || false,
    parQui: g.par_qui || "",
    interetCDM: g.interet_cdm || false,
    integreCDM: g.integre_cdm || false,
    prierePartage: g.priere_partage || false,
    dansFamilleDisciple: g.dans_famille_disciple || false,
    interetBapteme: g.interet_bapteme || false,
    commentaire: g.commentaire || "",
    commentaireSuivi: g.commentaire_suivi || "",
    assigned_to: g.assigned_to,
    church_id: g.church_id,
    bergerie_id: g.bergerie_id,
    famille_disciple: g.famille_disciple || "AUCUNE",
    etatCivil: g.etat_civil || "Célibataire",
    souhaiteEtreContacte: g.souhaite_etre_contacte !== false,
    archived: g.archived || false,
    created_by: g.created_by
  };
}

function AffectationPage() {
  const { notify, confirm } = useFeedback();
  const saveLock = useRef(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  useEffect(() => { if (isAddModalOpen) setFormError(""); }, [isAddModalOpen]);
  const [editingGuestId, setEditingGuestId] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [currentView, setCurrentView] = useState<'list' | 'stats'>('list');
  const [displayMode, setDisplayMode] = useState<'cards' | 'table'>('table');
  const [arrivalMonth, setArrivalMonth] = useState<string>("all");
  const [arrivalYear, setArrivalYear] = useState<string>("all");
  const [localChurchFilter, setLocalChurchFilter] = useState<string>("all");
  const [familyFilter, setFamilyFilter] = useState<string>("all");
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
    try {
      const savedMode = localStorage.getItem("poimen_souls_display_mode") as "cards" | "table" | null;
      if (savedMode === "cards" || savedMode === "table") {
        setDisplayMode(savedMode);
      }
    } catch {}
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
          if (userId && !canDispatchAll) {
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
        console.error("Error fetching guests:", error);
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
    address: "",
    arrivalDate: new Date().toISOString().split('T')[0],
    event: "Culte",
    aps: false,
    localChurch: false,
    responsible: "",
    aEteInvite: false,
    parQui: "",
    baptemeEau: false,
    interetFormation: false,
    interetCDM: false,
    integreCDM: false,
    prierePartage: false,
    dansFamilleDisciple: false,
    interetBapteme: false,
    commentaire: "",
    commentaireSuivi: "",
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
    setGuests(prev => prev.map(g => g.id === guestId ? {
      ...g,
      [field]: newValue,
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
    const updateObj: Record<string, any> = { [dbField]: newValue };
    if (field === "dansFamilleDisciple" && !newValue) {
      updateObj.famille_disciple = "AUCUNE";
      updateObj.bergerie_id = null;
    }
    await supabase.from("invites").update(updateObj).eq("id", guestId);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("poimen:soul-updated", { detail: { guestId } }));
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
      address: newGuest.address,
      arrival_date: newGuest.arrivalDate,
      event: newGuest.event,
      aps: newGuest.aps,
      local_church: newGuest.localChurch,
      responsible: newGuest.responsible,
      a_ete_invite: newGuest.aEteInvite,
      par_qui: newGuest.parQui,
      bapteme_eau: newGuest.baptemeEau,
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
      const { error } = await supabase
        .from("invites")
        .update(payload)
        .eq("id", editingGuestId);

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
      const { data: inserted, error } = await supabase
        .from("invites")
        .insert(payload)
        .select()
        .single();

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
      address: "",
      arrivalDate: new Date().toISOString().split('T')[0],
      event: "Culte",
      aps: false,
      localChurch: false,
      responsible: "Non assigné",
      aEteInvite: false,
      parQui: "",
      baptemeEau: false,
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

  const handleDeleteGuest = async (guestId: string) => {
    const guest = guests.find(g => g.id === guestId);
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
      address: guest.address,
      arrivalDate: guest.arrivalDate,
      event: guest.event || "Culte",
      aps: guest.aps,
      localChurch: guest.localChurch,
      responsible: guest.responsible || responsibles[0],
      aEteInvite: guest.aEteInvite,
      parQui: guest.parQui,
      baptemeEau: guest.baptemeEau,
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

  const filtered = guests.filter(g => {
      if (personView.filter === "contact" && (g.appelAbouti || g.souhaiteEtreContacte === false)) return false;
      if (personView.filter === "unassigned" && (userRole?.startsWith("integration_") ? !!g.assigned_to : !!g.responsible && g.responsible !== "Non assigné")) return false;
    // Strict isolation: only show guests personally assigned to the current user
    if (isIntegrationOrCounselor) {
      if (g.assigned_to !== userId) return false;
    } else {
      if (!userName || g.responsible !== userName) return false;
    }

    const matchesSearch = `${g.firstName} ${g.lastName}`.toLowerCase().includes(search.toLowerCase());
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

    return matchesSearch && matchesMonth && matchesYear && matchesLocalChurch && matchesFamily;
  });

  const isAnyFilterActive = useMemo(() => {
    return search.trim() !== "" || arrivalMonth !== "all" || arrivalYear !== "all" || localChurchFilter !== "all" || familyFilter !== "all";
  }, [search, arrivalMonth, arrivalYear, localChurchFilter, familyFilter]);

  const resetAllFilters = () => {
    setSearch("");
    setArrivalMonth("all");
    setArrivalYear("all");
    setLocalChurchFilter("all");
    setFamilyFilter("all");
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
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      
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

      <div className="page-header fade-in">
        <div>
          <h2 className="page-title">Mes âmes</h2>
          <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
            Suivi personnalisé et accompagnement spirituel de vos âmes confiées
          </p>
        </div>
        {isIntegrationOrCounselor && (
          <button className="btn btn-primary btn-sm" onClick={() => {
            setNewGuest({ ...newGuest, responsible: userName || "" });
            setIsAddModalOpen(true);
          }}>
            <Plus size={14} /> Nouvelle Âme
          </button>
        )}
      </div>

      {/* View Switcher Tabs */}
      <div className="invite-view-switcher">
        <button 
          onClick={() => {
            setCurrentView('list');
            if (selectedMonth === -1) {
              setSelectedMonth(new Date().getMonth());
            }
          }}
          className={`invite-view-option ${currentView === 'list' ? 'active' : ''}`}
        >
          <span className="invite-view-icon"><ListChecks size={18} /></span>
          <span className="invite-view-copy">
            <span className="invite-view-title">Liste</span>
            <span className="invite-view-subtitle">{filtered.length} âme{filtered.length > 1 ? "s" : ""} confiée{filtered.length > 1 ? "s" : ""}</span>
          </span>
        </button>
        <button 
          onClick={() => setCurrentView('stats')}
          className={`invite-view-option ${currentView === 'stats' ? 'active' : ''}`}
        >
          <span className="invite-view-icon"><BarChart3 size={18} /></span>
          <span className="invite-view-copy">
            <span className="invite-view-title">Statistiques</span>
            <span className="invite-view-subtitle">Suivi, présences et progression</span>
          </span>
        </button>
      </div>

      {/* Filters in Stats View */}
      {currentView === 'stats' && (
        <div className="glass fade-in" style={{ padding: "16px 24px", display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 11, color: "var(--gold-light)", fontWeight: 700, letterSpacing: "0.5px" }}>ARRIVÉE</span>
            <select className="input" style={{ width: 130, fontSize: 12, padding: "8px 12px" }} value={arrivalMonth} onChange={e => setArrivalMonth(e.target.value)}>
              <option value="all">Tous les mois</option>
              {["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"].map((m, i) => <option key={m} value={i.toString()}>{m}</option>)}
            </select>
            <select className="input" style={{ width: 100, fontSize: 12, padding: "8px 12px" }} value={arrivalYear} onChange={e => setArrivalYear(e.target.value)}>
              <option value="all">Toutes années</option>
              {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 11, color: "var(--gold-light)", fontWeight: 700, letterSpacing: "0.5px" }}>PRÉSENCES</span>
            <select className="input" style={{ width: 130, fontSize: 12, padding: "8px 12px" }} value={selectedMonth} onChange={e => setSelectedMonth(parseInt(e.target.value))}>
              <option value="-1">Tous les mois</option>
              {["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"].map((m, i) => <option key={m} value={i}>{m}</option>)}
            </select>
            <select className="input" style={{ width: 100, fontSize: 12, padding: "8px 12px" }} value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))}>
              {availableYears.map(y => <option key={y} value={parseInt(y, 10)}>{y}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 11, color: "var(--gold-light)", fontWeight: 700, letterSpacing: "0.5px" }}>ÉGLISE LOCALE</span>
            <select className="input" style={{ width: 155, fontSize: 12, padding: "8px 12px" }} value={localChurchFilter} onChange={e => setLocalChurchFilter(e.target.value)}>
              <option value="all">Tous (avec/sans)</option>
              <option value="yes">Avec église</option>
              <option value="no">Sans église</option>
            </select>
          </div>
        </div>
      )}

      {currentView === 'stats' ? (
        <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          {/* Main Key Stats */}
          <div className="bento bento-3">
            <div className="stat-card">
              <span className="stat-label">Total Âmes confiées</span>
              <div className="stat-value">{filtered.length}</div>
              <div className="stat-sub">{brebisCount} Brebis confirmées</div>
              <UserPlus className="stat-icon" size={24} style={{ color: "var(--gold)" }} />
            </div>
            
            <div className="stat-card">
              <span className="stat-label">Suivi Initial</span>
              <div className="stat-value" style={{ background: "linear-gradient(135deg, #FFF, var(--sky) 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{callsSuccess}</div>
              <div className="stat-sub">{Math.round((callsSuccess / (filtered.length || 1)) * 100)}% d'appels aboutis</div>
              <Phone className="stat-icon" size={24} style={{ color: "var(--sky)" }} />
            </div>

            <div className="stat-card">
              <span className="stat-label">Fidélisation</span>
              <div className="stat-value" style={{ background: "linear-gradient(135deg, #FFF, var(--green) 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{fidelisees}</div>
              <div className="stat-sub">Présences régulières (&gt;45%)</div>
              <CheckCircle2 className="stat-icon" size={24} style={{ color: "var(--green)" }} />
            </div>
          </div>

          {/* PCNC Pipeline */}
          <div className="glass">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "clamp(12px, 2vw, 24px)", flexWrap: "wrap", gap: 8 }}>
              <h3 style={{ fontSize: "clamp(14px, 2vw, 18px)", color: "var(--gold-light)", fontFamily: "var(--font-display)", margin: 0 }}>Progression PCNC</h3>
              <span className="badge badge-violet" style={{ fontSize: 10 }}>{totalPCNC} Personnes engagées</span>
            </div>
            
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(160px, 100%), 1fr))", gap: "clamp(10px, 2vw, 20px)" }}>
              {[
                { label: "001 (Bienvenue)", val: pcnc001, color: "var(--violet)" },
                { label: "101 (Fondements)", val: pcnc101, color: "var(--sky)" },
                { label: "201 (Croissance)", val: pcnc201, color: "var(--orange)" },
                { label: "301 (Transformation)", val: pcnc301, color: "var(--green)" }
              ].map((stage) => {
                const percentage = Math.round((stage.val / (filtered.length || 1)) * 100);
                return (
                  <div key={stage.label} className="glass glass-compact" style={{ background: "rgba(255,255,255,0.01)", border: "1px solid rgba(212,175,55,0.08)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--cream-dim)" }}>{stage.label}</span>
                      <span style={{ fontSize: 12, color: stage.color, fontWeight: 700 }}>{stage.val}</span>
                    </div>
                    <div className="progress" style={{ height: 6 }}>
                      <div className="progress-fill" style={{ width: `${percentage}%`, background: stage.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bento bento-3">
            <div className="glass" style={{ display: "flex", flexDirection: "column", gap: 15 }}>
              <h3 style={{ fontSize: "clamp(13px, 2vw, 16px)", marginBottom: 5, fontFamily: "var(--font-display)", color: "var(--gold-light)" }}>Suivi & Intégration</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(110px, 100%), 1fr))", gap: 10, flex: 1 }}>
                <div className="glass glass-compact" style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", border: "1px solid rgba(239, 68, 68, 0.25)", background: "rgba(239, 68, 68, 0.02)", padding: "12px 6px" }}>
                  <div style={{ fontSize: 9, color: "var(--rose)", fontWeight: 700, textTransform: "uppercase" }}>SANS ÉGLISE</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "var(--rose)", marginTop: 4 }}>{noChurch}</div>
                </div>
                <div className="glass glass-compact" style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", border: "1px solid rgba(91, 168, 224, 0.25)", background: "rgba(91, 168, 224, 0.02)", padding: "12px 6px" }}>
                  <div style={{ fontSize: 9, color: "var(--sky)", fontWeight: 700, textTransform: "uppercase" }}>AVEC TÉLÉPHONE</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "var(--sky)", marginTop: 4 }}>{phoneCount}</div>
                </div>
                <div className="glass glass-compact" style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", border: "1px solid rgba(168, 85, 247, 0.25)", background: "rgba(168, 85, 247, 0.02)", padding: "12px 6px" }}>
                  <div style={{ fontSize: 9, color: "var(--violet)", fontWeight: 700, textTransform: "uppercase" }}>FICHES APS</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "var(--violet)", marginTop: 4 }}>{apsCount}</div>
                </div>
                <div className="glass glass-compact" style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", border: "1px solid rgba(34, 197, 94, 0.25)", background: "rgba(34, 197, 94, 0.02)", padding: "12px 6px" }}>
                  <div style={{ fontSize: 9, color: "var(--green)", fontWeight: 700, textTransform: "uppercase" }}>REVENUS AU CULTE</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "var(--green)", marginTop: 4 }}>{returnedCount}</div>
                </div>
              </div>
            </div>
            <div className="glass">
              <h3 style={{ fontSize: "clamp(13px, 2vw, 16px)", marginBottom: 14, fontFamily: "var(--font-display)", color: "var(--gold-light)" }}>Engagement spirituel</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(110px, 100%), 1fr))", gap: 10 }}>
                <div className="glass glass-compact" style={{ padding: 10, textAlign: "center", background: "rgba(0,0,0,0.15)", border: "1px solid rgba(212,175,55,0.06)" }}>
                  <div style={{ fontSize: 9, color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>INTÉRÊT PCNC</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "var(--gold)", marginTop: 4 }}>{interetPCNC}</div>
                </div>
                <div className="glass glass-compact" style={{ padding: 10, textAlign: "center", background: "rgba(0,0,0,0.15)", border: "1px solid rgba(212,175,55,0.06)" }}>
                  <div style={{ fontSize: 9, color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>BAPTÊME EAU</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "var(--sky)", marginTop: 4 }}>{baptemeEauCount}</div>
                </div>
                <div className="glass glass-compact" style={{ padding: 10, textAlign: "center", background: "rgba(0,0,0,0.15)", border: "1px solid rgba(212,175,55,0.06)" }}>
                  <div style={{ fontSize: 9, color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>FAMILLE DISC.</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "var(--violet)", marginTop: 4 }}>{dansFamilleDiscipleCount}</div>
                </div>
                <div className="glass glass-compact" style={{ padding: 10, textAlign: "center", background: "rgba(0,0,0,0.15)", border: "1px solid rgba(212,175,55,0.06)" }}>
                  <div style={{ fontSize: 9, color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>INTÉGRÉ CDM</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "var(--green)", marginTop: 4 }}>{integreCDMCount}</div>
                </div>
                <div className="glass glass-compact" style={{ padding: 10, textAlign: "center", background: "rgba(0,0,0,0.15)", border: "1px solid rgba(212,175,55,0.06)" }}>
                  <div style={{ fontSize: 9, color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>VEUT SERVIR</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "var(--orange)", marginTop: 4 }}>{veutServirCount}</div>
                </div>
                <div className="glass glass-compact" style={{ padding: 10, textAlign: "center", background: "rgba(0,0,0,0.15)", border: "1px solid rgba(212,175,55,0.06)" }}>
                  <div style={{ fontSize: 9, color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>DEVENU STAR</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "var(--gold-light)", marginTop: 4 }}>{devenuStarCount}</div>
                </div>
              </div>
            </div>
            <div className="glass" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <h3 style={{ fontSize: "clamp(13px, 2vw, 16px)", marginBottom: 14, fontFamily: "var(--font-display)", color: "var(--gold-light)" }}>Participation Moyenne</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>Culte (Dimanche)</span>
                    <span style={{ fontSize: 11, color: "var(--green)", fontWeight: 700 }}>{avgParticipationCulte}%</span>
                  </div>
                  <div className="progress" style={{ height: 6 }}>
                    <div className="progress-fill" style={{ width: `${avgParticipationCulte}%`, background: "var(--green)" }} />
                  </div>
                </div>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>C.D.M (Jeudi)</span>
                    <span style={{ fontSize: 11, color: "var(--sky)", fontWeight: 700 }}>{avgParticipationCDM}%</span>
                  </div>
                  <div className="progress" style={{ height: 6 }}>
                    <div className="progress-fill" style={{ width: `${avgParticipationCDM}%`, background: "var(--sky)" }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
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

                  <div className="form-grid-3">
                    <div>
                      <label className="form-label">CIVILITÉ</label>
                      <select className="input" value={newGuest.civility || "M."} onChange={e => setNewGuest({...newGuest, civility: e.target.value})}>
                        <option value="M.">M.</option>
                        <option value="Mme.">Mme.</option>
                        <option value="Mlle.">Mlle.</option>
                      </select>
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
                      <select className="input" value={newGuest.etatCivil || "Célibataire"} onChange={e => setNewGuest({...newGuest, etatCivil: e.target.value})}>
                        <option value="Marié(e)">Marié(e)</option>
                        <option value="Séparé(e)">Séparé(e)</option>
                        <option value="Divorcé(e)">Divorcé(e)</option>
                        <option value="Veuf(ve)">Veuf(ve)</option>
                        <option value="En couple">En couple</option>
                        <option value="Célibataire">Célibataire</option>
                      </select>
                    </div>
                  </div>
                  <details className="ux-extra-fields" open={!!editingGuestId}><summary>Compléter le profil et le parcours</summary><div className="ux-extra-content">
<div className="form-grid-3-equal">
                    <div>
                      <label className="form-label">DATE D'ARRIVÉE</label>
                      <input className="input" type="date" value={newGuest.arrivalDate || ""} onChange={e => setNewGuest({...newGuest, arrivalDate: e.target.value})} />
                    </div>
                    <div>
                      <label className="form-label">ÂGE</label>
                      <select className="input" value={newGuest.age || "26-30"} onChange={e => setNewGuest({...newGuest, age: e.target.value})}>
                        <option value="< 18">Moins de 18 ans</option>
                        <option value="18-25">18-25 ans</option>
                        <option value="26-30">26-30 ans</option>
                        <option value="31-40">31-40 ans</option>
                        <option value="41-50">41-50 ans</option>
                        <option value="> 50">Plus de 50 ans</option>
                      </select>
                    </div>
                    <div>
                      <label className="form-label">ÉVÉNEMENT</label>
                      <select className="input" value={newGuest.event || "Culte"} onChange={e => setNewGuest({...newGuest, event: e.target.value})}>
                        <option value="Culte">Culte</option>
                        <option value="Baptême">Baptême</option>
                        <option value="Évangélisation">Évangélisation</option>
                        <option value="Séminaire">Séminaire</option>
                        <option value="Autre">Autre</option>
                      </select>
                    </div>
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

                  <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <input type="checkbox" checked={newGuest.aps || false} onChange={e => setNewGuest({...newGuest, aps: e.target.checked})} style={{ accentColor: "var(--gold)" }} />
                      <span style={{ fontSize: 13, color: "var(--cream-dim)" }}>Fiche APS Remplie</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <input type="checkbox" checked={newGuest.localChurch || false} onChange={e => setNewGuest({...newGuest, localChurch: e.target.checked})} style={{ accentColor: "var(--gold)" }} />
                      <span style={{ fontSize: 13, color: "var(--cream-dim)" }}>Déjà d'une église locale</span>
                    </div>
                  </div>

                  <div>
                    <label className="form-label">ADRESSE DOMICILE</label>
                    <input className="input" value={newGuest.address || ""} onChange={e => setNewGuest({...newGuest, address: e.target.value})} />
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

          {/* Modern Filters & Controls */}
          <div className={`glass fade-in ${styles.filtersContainer}`}>
            <div className={styles.filtersTop}>
              <div className={styles.searchWrapper}>
                <Search size={16} className={styles.searchIcon} />
                <input 
                  className={styles.searchInput} 
                  placeholder="Rechercher par nom ou prénom..." 
                  value={search} 
                  onChange={(e) => setSearch(e.target.value)} 
                />
              </div>

              <div className={styles.topControls}>
                {/* View Switcher: Cartes vs Tableau */}
                <div className={styles.viewModePillGroup}>
                  <button 
                    type="button"
                    className={`${styles.viewModePill} ${displayMode === 'cards' ? styles.viewModePillActive : ''}`}
                    onClick={() => {
                      setDisplayMode('cards');
                      try { localStorage.setItem("poimen_souls_display_mode", "cards"); } catch {}
                    }}
                    title="Affichage en cartes détaillées"
                  >
                    <LayoutGrid size={14} />
                    <span>Cartes</span>
                  </button>
                  <button 
                    type="button"
                    className={`${styles.viewModePill} ${displayMode === 'table' ? styles.viewModePillActive : ''}`}
                    onClick={() => {
                      setDisplayMode('table');
                      try { localStorage.setItem("poimen_souls_display_mode", "table"); } catch {}
                    }}
                    title="Affichage en tableau synthétique avec colonnes figées"
                  >
                    <TableIcon size={14} />
                    <span>Tableau</span>
                  </button>
                </div>

                <div className={styles.countBadge}>
                  {filtered.length} âme{filtered.length > 1 ? "s" : ""}
                </div>
              </div>
            </div>

            {/* Horizontal Scrolling Filter Bar (Pill Capsules) */}
            <div className={styles.filtersScroll}>
              {/* Arrivée Filter */}
              <div className={styles.filterChip}>
                <span className={styles.filterLabel}><Calendar size={12} /> Arrivée</span>
                <select 
                  className={styles.filterSelect} 
                  value={arrivalMonth} 
                  onChange={e => setArrivalMonth(e.target.value)}
                >
                  <option value="all">Tous mois</option>
                  {["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"].map((m, i) => (
                    <option key={i} value={i.toString()}>{m}</option>
                  ))}
                </select>
                <select 
                  className={styles.filterSelect} 
                  value={arrivalYear} 
                  onChange={e => setArrivalYear(e.target.value)}
                >
                  <option value="all">Toutes années</option>
                  {availableYears.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              {/* Présences Calculation Period Filter */}
              <div className={styles.filterChip}>
                <span className={styles.filterLabel}>👁 Présences</span>
                <select 
                  className={styles.filterSelect} 
                  value={selectedMonth} 
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                >
                  {["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"].map((m, i) => (
                    <option key={i} value={i}>{m}</option>
                  ))}
                </select>
                <select 
                  className={styles.filterSelect} 
                  value={selectedYear} 
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                >
                  {availableYears.map(y => (
                    <option key={y} value={parseInt(y, 10)}>{y}</option>
                  ))}
                </select>
              </div>

              {/* Église Locale Filter */}
              <div className={styles.filterChip}>
                <span className={styles.filterLabel}>⛪ Église</span>
                <select 
                  className={styles.filterSelect} 
                  value={localChurchFilter} 
                  onChange={e => setLocalChurchFilter(e.target.value)}
                >
                  <option value="all">Tous (avec/sans)</option>
                  <option value="no">Sans église locale</option>
                  <option value="yes">Avec église locale</option>
                </select>
              </div>

              {/* Famille Filter */}
              <div className={styles.filterChip}>
                <span className={styles.filterLabel}>👥 Famille</span>
                <select 
                  className={styles.filterSelect} 
                  value={familyFilter} 
                  onChange={e => setFamilyFilter(e.target.value)}
                >
                  <option value="all">Toutes familles</option>
                  <option value="AUCUNE">AUCUNE (Non affectée)</option>
                  {availableFamilies.map(fam => (
                    <option key={fam} value={fam}>{fam}</option>
                  ))}
                </select>
              </div>

              {/* Reset button if filters active */}
              {isAnyFilterActive && (
                <button 
                  type="button" 
                  className={styles.filterReset}
                  onClick={resetAllFilters}
                  title="Réinitialiser tous les filtres"
                >
                  <RotateCcw size={11} />
                  <span>Réinitialiser</span>
                </button>
              )}
            </div>
          </div>

          {/* List or Table View */}
          {displayMode === 'table' ? (
            <div className={`fade-in d1 ${styles.tableContainer}`}>
              <div className={styles.tableMobileHint}>
                <span>↔️ <strong>Astuce tactile :</strong> Faites défiler vers la droite pour voir toutes les colonnes. <em>Date d’arrivée</em>, <em>Nom</em> et <em>Prénom</em> restent figés à gauche.</span>
                <span style={{ fontSize: 10, color: "var(--muted)", whiteSpace: "nowrap" }}>{filtered.length} ligne{filtered.length > 1 ? "s" : ""}</span>
              </div>

              {filtered.length === 0 ? (
                <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--muted)" }}>
                  <p style={{ fontSize: 14, marginBottom: 12 }}>Aucune âme ne correspond aux critères sélectionnés.</p>
                  {isAnyFilterActive && (
                    <button type="button" className="btn btn-outline btn-sm" onClick={resetAllFilters}>
                      <RotateCcw size={12} /> Réinitialiser les filtres
                    </button>
                  )}
                </div>
              ) : (
                <table className={styles.soulsTable}>
                  <thead>
                    <tr>
                      <th className={`${styles.th} ${styles.stickyColDate}`}>Date d'arr.</th>
                      <th className={`${styles.th} ${styles.stickyColNom}`}>Nom</th>
                      <th className={`${styles.th} ${styles.stickyColPrenom}`}>Prénom</th>
                      <th className={styles.th}>Téléphone</th>
                      <th className={styles.th}>E-mail</th>
                      <th className={styles.th}>Famille de disciples</th>
                      <th className={styles.th}>Église locale</th>
                      <th className={styles.th}>Événement</th>
                      <th className={styles.th}>Appel abouti</th>
                      <th className={styles.th}>PCNC</th>
                      <th className={styles.th}>C.D.M</th>
                      <th className={styles.th}>Fidélisé</th>
                      <th className={styles.th}>Prés. Culte</th>
                      <th className={styles.th}>Prés. C.D.M</th>
                      <th className={styles.th}>Conseiller</th>
                      <th className={styles.th} style={{ textAlign: "center" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((guest) => {
                      const rateCDM = calculateRate(guest, thursdays);
                      const rateCulte = calculateRate(guest, sundays);
                      const fidelised = isFidelise(guest);
                      const pcncStage = getPcncStage(guest);
                      const isCreator = guest.created_by === userId;
                      const canEditGuest = isIntegrationLeader || isAuthorizedLeader || isCreator || (!canDispatchAll && guest.assigned_to === userId);
                      const isRestricted = isIntegrationOrCounselor
                        ? guest.assigned_to !== userId
                        : guest.responsible !== userName;

                      return (
                        <tr key={guest.id} className={styles.tr}>
                          {/* Sticky 1: Date */}
                          <td className={`${styles.td} ${styles.stickyColDate}`} style={{ color: "var(--cream-dim)", fontSize: 11 }}>
                            {formatDisplayDate(guest.arrivalDate)}
                          </td>

                          {/* Sticky 2: Nom */}
                          <td className={`${styles.td} ${styles.stickyColNom}`} title={guest.lastName}>
                            <button 
                              type="button" 
                              onClick={() => personView.openPerson(guest.id)}
                              style={{ background: "none", border: "none", color: "inherit", font: "inherit", fontWeight: 700, textAlign: "left", cursor: "pointer", padding: 0 }}
                            >
                              {guest.lastName}
                            </button>
                          </td>

                          {/* Sticky 3: Prénom */}
                          <td className={`${styles.td} ${styles.stickyColPrenom}`} title={guest.firstName}>
                            <button 
                              type="button" 
                              onClick={() => personView.openPerson(guest.id)}
                              style={{ background: "none", border: "none", color: "inherit", font: "inherit", fontWeight: 600, textAlign: "left", cursor: "pointer", padding: 0 }}
                            >
                              {guest.firstName}
                            </button>
                          </td>

                          {/* Téléphone */}
                          <td className={styles.td}>
                            {guest.phone ? (
                              <a href={`tel:${guest.phone}`} className={styles.phoneLink}>
                                <Phone size={11} style={{ color: "var(--gold)" }} />
                                <span>{guest.phone}</span>
                              </a>
                            ) : (
                              <span style={{ color: "var(--muted)" }}>—</span>
                            )}
                          </td>

                          {/* E-mail */}
                          <td className={styles.td}>
                            {guest.email ? (
                              <a href={`mailto:${guest.email}`} className={styles.emailLink} title={guest.email}>
                                <Mail size={11} style={{ color: "var(--sky)" }} />
                                <span style={{ maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis" }}>{guest.email}</span>
                              </a>
                            ) : (
                              <span style={{ color: "var(--muted)" }}>—</span>
                            )}
                          </td>

                          {/* Famille de disciples (interactive dropdown) */}
                          <td className={styles.td}>
                            <select 
                              className={styles.familySelect}
                              value={guest.famille_disciple || "AUCUNE"}
                              disabled={isRestricted}
                              onChange={(e) => handleUpdateFamily(guest.id, e.target.value)}
                              style={{
                                borderColor: (guest.famille_disciple && guest.famille_disciple !== "AUCUNE") ? "rgba(16, 185, 129, 0.4)" : "var(--border)",
                                color: (guest.famille_disciple && guest.famille_disciple !== "AUCUNE") ? "var(--green)" : "var(--muted)"
                              }}
                            >
                              <option value="AUCUNE">AUCUNE</option>
                              {availableFamilies.map(fam => (
                                <option key={fam} value={fam}>{fam}</option>
                              ))}
                            </select>
                          </td>

                          {/* Église locale */}
                          <td className={styles.td}>
                            {guest.localChurch ? (
                              <span className="badge badge-sky" style={{ fontSize: 9 }}>Avec église</span>
                            ) : (
                              <span className="badge badge-rose" style={{ fontSize: 9 }}>Sans église</span>
                            )}
                          </td>

                          {/* Événement */}
                          <td className={styles.td}>
                            <span className="badge badge-violet" style={{ fontSize: 9 }}>
                              {guest.event || "Culte"}
                            </span>
                          </td>

                          {/* Appel abouti */}
                          <td className={styles.td}>
                            <button 
                              type="button"
                              className={`${styles.toggleBtn} ${guest.appelAbouti ? styles.toggleBtnActive : styles.toggleBtnInactive}`}
                              disabled={isRestricted}
                              onClick={() => toggleSuivi(guest.id, 'appelAbouti')}
                              title={guest.appelAbouti ? "Appel abouti (cliquez pour basculer)" : "Appel non abouti (cliquez pour basculer)"}
                            >
                              {guest.appelAbouti ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                              <span>{guest.appelAbouti ? "Oui" : "Non"}</span>
                            </button>
                          </td>

                          {/* Progression PCNC */}
                          <td className={styles.td}>
                            <span className="badge" style={{ fontSize: 9, color: pcncStage.color, borderColor: pcncStage.color, background: "rgba(255,255,255,0.02)" }}>
                              {pcncStage.label}
                            </span>
                          </td>

                          {/* C.D.M */}
                          <td className={styles.td}>
                            {guest.integreCDM ? (
                              <span className="badge badge-green" style={{ fontSize: 9 }}>Intégré</span>
                            ) : guest.interetCDM ? (
                              <span className="badge badge-gold" style={{ fontSize: 9 }}>Intérêt</span>
                            ) : (
                              <span style={{ color: "var(--muted)", fontSize: 10 }}>Non</span>
                            )}
                          </td>

                          {/* Fidélisé */}
                          <td className={styles.td}>
                            {fidelised ? (
                              <span className="badge badge-gold" style={{ fontSize: 9, display: "inline-flex", alignItems: "center", gap: 3 }}>
                                <Sparkles size={9} /> Fidélisé
                              </span>
                            ) : (
                              <span style={{ color: "var(--muted)", fontSize: 10 }}>En cours</span>
                            )}
                          </td>

                          {/* Présences Culte */}
                          <td className={styles.td}>
                            <span style={{ fontWeight: 600, color: rateCulte >= 50 ? "var(--green)" : "var(--cream-dim)" }}>
                              {rateCulte}%
                            </span>
                          </td>

                          {/* Présences CDM */}
                          <td className={styles.td}>
                            <span style={{ fontWeight: 600, color: rateCDM >= 50 ? "var(--sky)" : "var(--cream-dim)" }}>
                              {rateCDM}%
                            </span>
                          </td>

                          {/* Conseiller / Affectation */}
                          <td className={styles.td}>
                            {(() => {
                              const canAssignAny = isIntegrationLeader || canCreateOrDeleteInvites || canDispatchAll;
                              const isCounselor = isConseiller || userRoleClean === "integration_conseiller" || userRoleClean === "conseiller";
                              const isAssignedToMe = guest.assigned_to === userId || (!guest.assigned_to && guest.responsible === userName);
                              const assignedCounselorName = counselors.find(c => c.id === guest.assigned_to)?.display_name || (guest.responsible && guest.responsible !== "Non assigné" ? guest.responsible : null);

                              if (isIntegrationOrCounselor || counselors.length > 0) {
                                if (canAssignAny) {
                                  return (
                                    <select
                                      className={styles.familySelect}
                                      value={guest.assigned_to || ""}
                                      onChange={(e) => handleAssignCounselor(guest.id, e.target.value || null)}
                                      title="Affecter à un conseiller"
                                      style={{
                                        borderColor: guest.assigned_to ? "rgba(212, 175, 55, 0.4)" : "var(--border)",
                                        color: guest.assigned_to ? (guest.assigned_to === userId ? "var(--gold-light)" : "var(--cream)") : "var(--muted)",
                                        cursor: "pointer",
                                        maxWidth: 150,
                                        fontSize: 11
                                      }}
                                    >
                                      <option value="">Non assigné</option>
                                      {counselors.map(c => (
                                        <option key={c.id} value={c.id}>
                                          {c.display_name}{c.id === userId ? " (Moi)" : ""}
                                        </option>
                                      ))}
                                      {guest.assigned_to && !counselors.some(c => c.id === guest.assigned_to) && (
                                        <option value={guest.assigned_to}>
                                          {assignedCounselorName || "Conseiller assigné"}
                                        </option>
                                      )}
                                    </select>
                                  );
                                }

                                if (isCounselor) {
                                  if (!guest.assigned_to && (!guest.responsible || guest.responsible === "Non assigné")) {
                                    return (
                                      <button
                                        type="button"
                                        className="btn btn-primary btn-xs"
                                        onClick={() => handleSelfAssign(guest.id)}
                                        style={{
                                          fontSize: 10,
                                          padding: "3px 8px",
                                          borderRadius: 6,
                                          whiteSpace: "nowrap"
                                        }}
                                        title="M'affecter cette âme"
                                      >
                                        + M'affecter
                                      </button>
                                    );
                                  }

                                  if (isAssignedToMe) {
                                    return (
                                      <span style={{ 
                                        color: "var(--gold-light)", 
                                        fontWeight: 600, 
                                        fontSize: 11,
                                        background: "rgba(212, 175, 55, 0.12)",
                                        padding: "3px 8px",
                                        borderRadius: 6,
                                        border: "1px solid rgba(212, 175, 55, 0.25)",
                                        display: "inline-block"
                                      }}>
                                        Moi
                                      </span>
                                    );
                                  }

                                  return (
                                    <span style={{ fontSize: 11, color: "var(--cream-dim)" }}>
                                      {assignedCounselorName || "Non assigné"}
                                    </span>
                                  );
                                }

                                return (
                                  <span style={{ fontSize: 11, color: "var(--cream-dim)" }}>
                                    {assignedCounselorName || "Non assigné"}
                                  </span>
                                );
                              }

                              // Mode bergerie / famille où responsible est utilisé
                              if (isAuthorizedLeader && responsibles.length > 0) {
                                return (
                                  <select
                                    className={styles.familySelect}
                                    value={guest.responsible || "Non assigné"}
                                    onChange={async (e) => {
                                      const newResp = e.target.value;
                                      setGuests(prev => prev.map(g => g.id === guest.id ? { ...g, responsible: newResp } : g));
                                      await supabase.from("invites").update({ responsible: newResp }).eq("id", guest.id);
                                      window.dispatchEvent(new CustomEvent("poimen:soul-updated", { detail: { guestId: guest.id } }));
                                    }}
                                    style={{
                                      borderColor: (guest.responsible && guest.responsible !== "Non assigné") ? "rgba(212, 175, 55, 0.4)" : "var(--border)",
                                      color: (guest.responsible && guest.responsible !== "Non assigné") ? "var(--cream)" : "var(--muted)",
                                      cursor: "pointer",
                                      maxWidth: 150,
                                      fontSize: 11
                                    }}
                                  >
                                    <option value="Non assigné">Non assigné</option>
                                    {responsibles.map(r => <option key={r} value={r}>{r}</option>)}
                                    {guest.responsible && guest.responsible !== "Non assigné" && !responsibles.includes(guest.responsible) && (
                                      <option key={guest.responsible} value={guest.responsible}>{guest.responsible}</option>
                                    )}
                                  </select>
                                );
                              }

                              return (
                                <span style={{ fontSize: 11, color: "var(--cream-dim)" }}>
                                  {guest.responsible || "Non assigné"}
                                </span>
                              );
                            })()}
                          </td>

                          {/* Actions */}
                          <td className={styles.td} style={{ textAlign: "center" }}>
                            <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                              <button 
                                type="button"
                                className="btn-icon btn-icon-gold"
                                onClick={() => personView.openPerson(guest.id)}
                                title="Voir la fiche complète"
                                style={{ width: 28, height: 28 }}
                              >
                                <Eye size={13} />
                              </button>
                              {canEditGuest && (
                                <button 
                                  type="button"
                                  className="btn-icon btn-icon-gold"
                                  onClick={() => openEditModal(guest)}
                                  title="Modifier les informations"
                                  style={{ width: 28, height: 28 }}
                                >
                                  <MoreHorizontal size={13} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          ) : (
            /* Cards View */
            <div className="fade-in d1" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {filtered.map((guest) => {
              const rateCDM = calculateRate(guest, thursdays);
              const rateCulte = calculateRate(guest, sundays);
              const fidelised = isFidelise(guest);
              const isExpanded = expandedId === guest.id;
              const isRestricted = isIntegrationOrCounselor
                ? guest.assigned_to !== userId
                : guest.responsible !== userName;

              return (
                <div key={guest.id} className="glass glass-flush" style={{ borderLeft: fidelised ? "4px solid var(--gold)" : "1px solid var(--border)", transition: "all 0.3s ease" }}>
                  <div
                    className="affectation-card-header"
                    onClick={() => setExpandedId(isExpanded ? null : guest.id)}
                    style={{ 
                      padding: "18px 24px", display: "flex", alignItems: "center", justifyContent: "space-between",
                      cursor: "pointer", background: isExpanded ? "rgba(212, 175, 55, 0.03)" : "transparent"
                    }}
                  >
                    <div className="affectation-card-person" style={{ display: "flex", alignItems: "center", gap: 16, flex: 1 }}>
                      <div className={`avatar ${fidelised ? "avatar-gradient avatar-effect-aura" : "avatar-gradient"}`} style={{ width: 42, height: 42, fontSize: 12 }}>
                        {guest.firstName[0]}{guest.lastName[0]}
                      </div>
                      <div className="affectation-card-identity" style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--cream)" }}><PersonButton person={guest} onClick={() => personView.openPerson(guest.id)} /></h3>
                          {fidelised && <span className="badge badge-gold" style={{ fontSize: 8 }}>Fidélisé</span>}
                          {(isIntegrationOrCounselor || isAuthorizedLeader) && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); openEditModal(guest); }}
                              className="btn-icon btn-icon-gold"
                              style={{ marginLeft: 4 }}
                              title="Modifier les informations"
                            >
                              <MoreHorizontal size={14} />
                            </button>
                          )}
                        </div>
                        <div className="affectation-card-meta" style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                          {guest.civility} · {guest.age} ans · {isIntegrationOrCounselor ? (
                            <>Conseiller: <span style={{ color: "var(--gold-light)" }}>{guest.assigned_to === userId ? (userName || "Moi") : (counselors.find(c => c.id === guest.assigned_to)?.display_name || "Non assigné")}</span></>
                          ) : (
                            <>Responsable: <span style={{ color: "var(--gold-light)" }}>{guest.responsible}</span></>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="affectation-card-stats" style={{ display: "flex", alignItems: "center", gap: 20 }}>
                      <div className="affectation-card-stat" style={{ textAlign: "right", minWidth: 60 }}>
                        <div style={{ fontSize: 9, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>CDM (Jeudi)</div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: rateCDM >= 45 ? "var(--green)" : "var(--red)", marginTop: 2 }}>{rateCDM}%</div>
                      </div>
                      <div className="affectation-card-stat" style={{ textAlign: "right", minWidth: 60 }}>
                        <div style={{ fontSize: 9, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Culte (Dim)</div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: rateCulte >= 45 ? "var(--green)" : "var(--red)", marginTop: 2 }}>{rateCulte}%</div>
                      </div>
                      {isExpanded ? <ChevronUp size={18} style={{ color: "var(--gold)" }} /> : <ChevronDown size={18} style={{ color: "var(--muted)" }} />}
                    </div>
                  </div>

                  {isExpanded && (
                    <div style={{ borderTop: "1px solid var(--border)", background: "rgba(0, 0, 0, 0.25)" }}>
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
                            <MapPin size={14} style={{ color: "var(--muted)" }} /> <span style={{ fontSize: 12, color: "var(--cream-dim)", wordBreak: "break-word" }}>{guest.address || "Adresse non renseignée"}</span>
                          </div>
                          <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
                            <span className="badge badge-gold" style={{ fontSize: 9 }}>{guest.event}</span>
                            <span className={`badge ${guest.aps ? "badge-green" : "badge-red"}`} style={{ fontSize: 9 }}>APS: {guest.aps ? "Oui" : "Non"}</span>
                            <span className={`badge ${guest.localChurch ? "badge-green" : "badge-red"}`} style={{ fontSize: 9 }}>Église locale: {guest.localChurch ? "Oui" : "Non"}</span>
                          </div>

                          <div style={{ marginTop: 10 }}>
                            <label className="form-label" style={{ fontSize: 9 }}>Commentaire d'arrivée</label>
                            <div style={{ fontSize: 12, color: "var(--cream-dim)", background: "var(--surface)", padding: 12, borderRadius: 10, border: "1px solid var(--border)", lineHeight: 1.5 }}>
                              {guest.commentaire || <span style={{ fontStyle: "italic", color: "var(--muted)" }}>Aucun commentaire d'arrivée rédigé.</span>}
                            </div>
                          </div>
                          
                          <div className="glass-compact" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(212,175,55,0.15)", borderRadius: 10, padding: "12px 14px", marginTop: 14 }}>
                            <label className="form-label" style={{ fontSize: 10, color: "var(--gold)", letterSpacing: "1px", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
                              Affectation Famille de Disciples
                            </label>
                            <select 
                              className="input" 
                              value={guest.famille_disciple || "AUCUNE"} 
                              disabled={isRestricted}
                              onChange={(e) => handleUpdateFamily(guest.id, e.target.value)} 
                              style={{ width: "100%", fontSize: 12, cursor: isRestricted ? "not-allowed" : "pointer" }}
                            >
                              <option value="AUCUNE">AUCUNE (Non affecté)</option>
                              {availableFamilies.map(fam => (
                                <option key={fam} value={fam}>{fam}</option>
                              ))}
                            </select>
                          </div>

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

                          {(isIntegrationOrCounselor || isAuthorizedLeader) && !isConseiller && (
                            <button 
                              className="btn btn-subtle btn-sm" 
                              style={{ marginTop: 16, color: "var(--red)", borderColor: "rgba(239, 68, 68, 0.2)", width: "fit-content" }}
                              onClick={() => handleDeleteGuest(guest.id)}
                            >
                              Supprimer définitivement
                            </button>
                          )}
                        </div>

                        {/* Attendance Tracking (Dynamic) */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                          <div>
                            <h4 style={{ fontSize: 11, color: "var(--gold)", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10, fontFamily: "var(--font-body)", fontWeight: 700 }}>Présences CDM (Jeudi)</h4>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              {thursdays.filter(day => !guest.arrivalDate || day >= guest.arrivalDate).map((day) => {
                                const isBeforeArrival = guest.arrivalDate && day < guest.arrivalDate;
                                return (
                                  <div
                                    key={day}
                                    className={`attendance-day ${isBeforeArrival ? "attendance-day--not-applicable" : ""} ${isRestricted ? "attendance-day--readonly" : ""}`}
                                    title={isBeforeArrival ? "Non applicable (avant l'arrivée)" : day} 
                                    onClick={() => !isRestricted && !isBeforeArrival && toggleAttendance(guest.id, day)}
                                    style={{ 
                                      width: 32, height: 32, borderRadius: 8, 
                                      background: guest.attendance[day] ? "var(--green-glow)" : "rgba(255,255,255,0.02)",
                                      border: `1px solid ${guest.attendance[day] ? "var(--green)" : "var(--border)"}`,
                                      display: "flex", alignItems: "center", justifyContent: "center",
                                      color: guest.attendance[day] ? "var(--green)" : "var(--muted)",
                                      cursor: isBeforeArrival ? "not-allowed" : (isRestricted ? "default" : "pointer"),
                                      transition: "all 0.2s"
                                    }}>
                                    <span style={{ fontSize: 10, fontWeight: 700 }}>{parseInt(day.split('-')[2], 10)}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          <div>
                            <h4 style={{ fontSize: 11, color: "var(--gold)", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10, fontFamily: "var(--font-body)", fontWeight: 700 }}>Présences Culte (Dimanche)</h4>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              {sundays.filter(day => !guest.arrivalDate || day >= guest.arrivalDate).map((day) => {
                                const isBeforeArrival = guest.arrivalDate && day < guest.arrivalDate;
                                return (
                                  <div
                                    key={day}
                                    className={`attendance-day ${isBeforeArrival ? "attendance-day--not-applicable" : ""} ${isRestricted ? "attendance-day--readonly" : ""}`}
                                    title={isBeforeArrival ? "Non applicable (avant l'arrivée)" : day} 
                                    onClick={() => !isRestricted && !isBeforeArrival && toggleAttendance(guest.id, day)}
                                    style={{ 
                                      width: 32, height: 32, borderRadius: 8, 
                                      background: guest.attendance[day] ? "var(--green-glow)" : "rgba(255,255,255,0.02)",
                                      border: `1px solid ${guest.attendance[day] ? "var(--green)" : "var(--border)"}`,
                                      display: "flex", alignItems: "center", justifyContent: "center",
                                      color: guest.attendance[day] ? "var(--green)" : "var(--muted)",
                                      cursor: isBeforeArrival ? "not-allowed" : (isRestricted ? "default" : "pointer"),
                                      transition: "all 0.2s"
                                    }}>
                                    <span style={{ fontSize: 10, fontWeight: 700 }}>{parseInt(day.split('-')[2], 10)}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        {/* Suivi Groups */}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))", gap: 16 }}>
                          <div className="glass glass-compact" style={{ background: "rgba(255,255,255,0.01)", display: "flex", flexDirection: "column", gap: 10, border: "1px solid rgba(212,175,55,0.08)" }}>
                            <h4 style={{ fontSize: 10, color: "var(--gold-light)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4, fontFamily: "var(--font-body)", fontWeight: 700 }}>Premier Contact</h4>
                            <div>
                              <SuiviToggle label="Appel abouti" checked={guest.appelAbouti} onChange={() => toggleSuivi(guest.id, 'appelAbouti')} disabled={isRestricted} />
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
                                    value={guest.commentaireSuivi || ""} 
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setGuests(prev => prev.map(g => g.id === guest.id ? { ...g, commentaireSuivi: val } : g));
                                    }}
                                    onBlur={(e) => {
                                      supabase.from("invites").update({ commentaire_suivi: e.target.value }).eq("id", guest.id).then();
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
                          
                          <div className="glass glass-compact" style={{ background: "rgba(255,255,255,0.01)", display: "flex", flexDirection: "column", gap: 10, border: "1px solid rgba(212,175,55,0.08)" }}>
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
                            <SuiviToggle label="Cocktail Bienvenue" checked={guest.cocktailBienvenue} onChange={() => toggleSuivi(guest.id, 'cocktailBienvenue')} disabled={isRestricted} />
                          </div>
                        </div>

                        {/* PCNC & Service */}
                        <div className="glass glass-compact col-span-2" style={{ background: "rgba(255,255,255,0.01)", border: "1px solid rgba(212,175,55,0.08)" }}>
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
                          
                          <div style={{ marginTop: 16 }}>
                            <label className="form-label" style={{ fontSize: 9 }}>Commentaires de suivi / Notes d'accompagnement</label>
                            <textarea 
                              className="input" 
                              rows={3} 
                              defaultValue={guest.commentaireSuivi} 
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
                              onBlur={async (e) => {
                                const newVal = e.target.value;
                                setGuests(prev => prev.map(g => g.id === guest.id ? {...g, commentaireSuivi: newVal} : g));
                                await supabase.from("invites").update({ commentaire_suivi: newVal }).eq("id", guest.id);
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

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
                    <select 
                      className="input" 
                      value={selectedBergerieId} 
                      onChange={e => setSelectedBergerieId(e.target.value)}
                      style={{ fontSize: 13 }}
                    >
                      <option value="">-- Choisir une famille --</option>
                      {activeBergeries.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
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
