"use client";

import { Suspense, useRef, useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { 
  Search, Plus, UserPlus, UserMinus, Filter, CheckCircle2, XCircle, X, Link,
  Calendar, MapPin, Mail, Phone, User as UserIcon,
  ChevronDown, ChevronUp, MoreHorizontal, Loader2,
  Trash2, Trash, RotateCcw, Pencil, Archive, AlertTriangle,
  ListChecks, BarChart3, Home, LayoutGrid, Table as TableIcon, Eye, Check
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { autoAddLeaderToMembers, listIntegrationTeam, getIntegrationInvites, assignCounselorToGuest } from "@/app/actions/auth";
import { getActiveContext, getActiveUserInfo } from "@/lib/client-session";
import { filterElapsedDateKeys } from "@/lib/date-utils";
import PersonPanel, { PersonButton } from "@/components/experience/PersonPanel";
import { usePeopleView } from "@/lib/use-people-view";
import { useFeedback } from "@/components/experience/FeedbackProvider";
import PeopleNavigation from "@/components/experience/PeopleNavigation";
import styles from "../affectation/Affectation.module.css";
import CustomDatePicker from "@/components/ui/CustomDatePicker";
import CustomSelect from "@/components/ui/CustomSelect";


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
    assigned_to: g.assigned_to,
    church_id: g.church_id,
    bergerie_id: g.bergerie_id,
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
  const [arrivalMonth, setArrivalMonth] = useState<string>("all");
  const [arrivalYear, setArrivalYear] = useState<string>("all");
  const [localChurchFilter, setLocalChurchFilter] = useState<string>("all");
  const [familyFilter, setFamilyFilter] = useState<string>("all");
  const [displayMode, setDisplayMode] = useState<"cards" | "table">("cards");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("poimen_invites_display_mode");
      if (saved === "cards" || saved === "table") {
        setDisplayMode(saved);
      }
    } catch {}
  }, []);
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
        if (!cId) {
          try {
            const savedChurch = localStorage.getItem("selected_church");
            if (savedChurch) {
              cId = JSON.parse(savedChurch).id;
            }
          } catch {}
        }
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
        console.error("Error fetching guests:", error);
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
    address: "",
    arrivalDate: new Date().toISOString().split('T')[0],
    event: "Culte",
    aps: false,
    localChurch: false,
    responsible: "Non assigné",
    aEteInvite: false,
    parQui: "",
    baptemeEau: false,
    interetFormation: false,
    interetCDM: false,
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
    setGuests(prev => prev.map(g => g.id === guestId ? { ...g, [field]: newValue } : g));

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
    await supabase.from("invites").update({ [dbField]: newValue }).eq("id", guestId);
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
      if (!userRoleClean.startsWith("integration_")) {
        payload.commentaire_suivi = "";
      }
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
      age: "26-30 ans",
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
      address: guest.address,
      arrivalDate: guest.arrivalDate,
      event: guest.event || "Culte",
      aps: guest.aps,
      localChurch: guest.localChurch,
      responsible: guest.responsible || "Non assigné",
      assigned_to: guest.assigned_to || null,
      created_by: guest.created_by || null,
      aEteInvite: guest.aEteInvite,
      parQui: guest.parQui,
      baptemeEau: guest.baptemeEau,
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
      if (personView.filter === "contact" && (g.appelAbouti || g.souhaiteEtreContacte === false)) return false;
      if (personView.filter === "unassigned" && (userRole?.startsWith("integration_") ? !!g.assigned_to : !!g.responsible && g.responsible !== "Non assigné")) return false;
      const fullName = `${g.firstName} ${g.lastName}`.toLowerCase();
      const matchSearch = fullName.includes(search.toLowerCase());
      const matchArchived = (g.archived || false) === showCorbeille;
      const matchesLocalChurch = localChurchFilter === "all" || 
        (localChurchFilter === "yes" && g.localChurch) || 
        (localChurchFilter === "no" && !g.localChurch);
      const matchesFamily = familyFilter === "all" || 
        (familyFilter === "AUCUNE" ? (!g.famille_disciple || g.famille_disciple === "AUCUNE") : g.famille_disciple === familyFilter);
      
      const guestDate = g.arrivalDate ? new Date(g.arrivalDate) : null;
      const guestMonth = guestDate ? guestDate.getMonth().toString() : "";
      const guestYear = guestDate ? guestDate.getFullYear().toString() : "";
      const matchesArrivalMonth = arrivalMonth === "all" || guestMonth === arrivalMonth;
      const matchesArrivalYear = arrivalYear === "all" || guestYear === arrivalYear;

      return matchSearch && matchArchived && matchesLocalChurch && matchesFamily && matchesArrivalMonth && matchesArrivalYear;
    });
  }, [guests, search, showCorbeille, localChurchFilter, familyFilter, arrivalMonth, arrivalYear, personView.filter, userRole]);

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

  const statsBase = guests.filter(g => {
    if (g.archived) return false; // Ne pas inclure les archivés dans les stats générales
    const guestDate = new Date(g.arrivalDate);
    const guestMonth = guestDate.getMonth().toString();
    const guestYear = guestDate.getFullYear().toString();
    const matchesMonth = arrivalMonth === "all" || guestMonth === arrivalMonth;
    const matchesYear = arrivalYear === "all" || guestYear === arrivalYear;
    
    const userRoleLower = (userRole || "").toLowerCase();
    const isOnlyResponsable = userRoleLower === "responsable de brebi" || userRoleLower === "responsable";
    if (isOnlyResponsable && userName && g.responsible !== userName) return false;
    
    const matchesLocalChurch = localChurchFilter === "all" || 
      (localChurchFilter === "yes" && g.localChurch) || 
      (localChurchFilter === "no" && !g.localChurch);
      
    return matchesMonth && matchesYear && matchesLocalChurch;
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
    arrivalMonth !== "all" || 
    arrivalYear !== "all" || 
    localChurchFilter !== "all" || 
    familyFilter !== "all" || 
    showCorbeille;

  const resetAllFilters = () => {
    setSearch("");
    setArrivalMonth("all");
    setArrivalYear("all");
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
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
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
      <div className="page-header">
        <div>
          <h2 className="page-title">{isConseiller && !canDispatchAll ? "Ajouter un Invité" : "Invités"}</h2>
          <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
            Gestion et suivi des nouveaux arrivants
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {churchId && (
            <button 
              className="btn btn-outline" 
              style={{ borderColor: "var(--gold)", color: "var(--gold)" }}
              onClick={() => {
                const link = `${window.location.origin}/public-invite?church_id=${churchId}`;
                navigator.clipboard.writeText(link);
                setLinkCopied(true);
                setTimeout(() => setLinkCopied(false), 2000);
              }}
            >
              <Link size={14} /> {linkCopied ? "Lien copié !" : "Partager le lien"}
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
          {canAddOrEditInvites && (
            <button className="btn btn-primary" onClick={() => {
              setNewGuest({
                civility: "M.", firstName: "", lastName: "", age: "26-30 ans",
                phone: "", email: "", address: "", arrivalDate: new Date().toISOString().split('T')[0],
                event: "Culte", aps: false, localChurch: false,
                responsible: "Non assigné", aEteInvite: false, parQui: "",
                baptemeEau: false, interetFormation: false, interetCDM: false, commentaire: "",
                etatCivil: "Célibataire", souhaiteEtreContacte: true
              });
              setIsAddModalOpen(true);
            }}>
              <Plus size={14} /> Ajouter
            </button>
          )}
        </div>
      </div>

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
            className={`invite-view-option ${currentView === 'list' ? 'active' : ''}`}
          >
            <span className="invite-view-icon"><ListChecks size={18} /></span>
            <span className="invite-view-copy">
              <span className="invite-view-title">Liste</span>
              <span className="invite-view-subtitle">{filtered.length} invité{filtered.length > 1 ? "s" : ""} à suivre</span>
            </span>
          </button>
          {isIntegrationOrCounselor && (
            <button 
              onClick={() => setCurrentView('families')}
              className={`invite-view-option ${currentView === 'families' ? 'active' : ''}`}
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
            className={`invite-view-option ${currentView === 'stats' ? 'active' : ''}`}
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
        <div className="glass" style={{ padding: "12px 20px", display: "flex", gap: 15, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>ARRIVÉE</span>
            <CustomSelect
              size="sm"
              style={{ width: 135 }}
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
              style={{ width: 115 }}
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
            <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>PRÉSENCES</span>
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

      {currentView === 'stats' ? (
        <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Main Key Stats */}
          <div className="bento bento-3">
            <div className="stat-card" style={{ background: "linear-gradient(135deg, var(--card), rgba(212, 160, 60, 0.05))" }}>
              <span className="stat-label">Total Nouveaux</span>
              <div className="stat-value" style={{ color: "var(--gold)" }}>{statsBase.length}</div>
              <div className="stat-sub">Arrivées enregistrées ({brebisCount} Brebis)</div>
              <UserPlus className="stat-icon" size={40} style={{ color: "var(--gold)" }} />
            </div>
            
            <div className="stat-card" style={{ background: "linear-gradient(135deg, var(--card), rgba(91, 168, 224, 0.05))" }}>
              <span className="stat-label">Appels Aboutis</span>
              <div className="stat-value" style={{ color: "var(--sky)" }}>{callsSuccess}</div>
              <div className="stat-sub">{Math.round((callsSuccess / (statsBase.length || 1)) * 100)}% de taux de contact</div>
              <Phone className="stat-icon" size={40} style={{ color: "var(--sky)" }} />
            </div>

            <div className="stat-card" style={{ background: "linear-gradient(135deg, var(--card), rgba(61, 191, 140, 0.05))" }}>
              <span className="stat-label">Fidélisation</span>
              <div className="stat-value" style={{ color: "var(--green)" }}>{fidelisees}</div>
              <div className="stat-sub">Présences régulières (&gt;45%)</div>
              <CheckCircle2 className="stat-icon" size={40} style={{ color: "var(--green)" }} />
            </div>
          </div>

          {/* PCNC Pipeline */}
          <div className="glass" style={{ padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ fontSize: 18, color: "var(--gold)" }}>Pipeline PCNC</h3>
              <div className="badge badge-violet">{totalPCNC} Personnes engagées</div>
            </div>
            
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 20 }}>
              {[
                { label: "001 (Bienvenue dans le royaume)", val: pcnc001, color: "var(--violet)" },
                { label: "101 (Les fondements du royaume)", val: pcnc101, color: "var(--sky)" },
                { label: "201 (Les clés d'une croissance spirituelle)", val: pcnc201, color: "var(--orange)" },
                { label: "301 (Restauration et transformation)", val: pcnc301, color: "var(--green)" }
              ].map((stage, i) => {
                const percentage = Math.round((stage.val / (statsBase.length || 1)) * 100);
                return (
                  <div key={stage.label} className="glass-compact" style={{ background: "rgba(255,255,255,0.02)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 600 }}>{stage.label}</span>
                      <span style={{ fontSize: 12, color: stage.color, fontWeight: 700 }}>{stage.val}</span>
                    </div>
                    <div className="progress" style={{ height: 6 }}>
                      <div className="progress-fill" style={{ width: `${percentage}%`, background: stage.color }} />
                    </div>
                    <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 6 }}>{percentage}% de la base</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Répartition par Famille de Disciples */}
          {isIntegrationOrCounselor && (
            <div className="glass" style={{ padding: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <h3 style={{ fontSize: 18, color: "var(--gold)" }}>Répartition par Famille de Disciples</h3>
                <div className="badge badge-primary">
                  {statsBase.filter(g => g.famille_disciple && g.famille_disciple !== "AUCUNE").length} Affectés
                </div>
              </div>
              
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 20 }}>
                {[
                  { label: "FAMILLE DE NOÉ", val: familyNoeCount, color: "var(--gold)" },
                  { label: "FAMILLE DE DAVID", val: familyDavidCount, color: "var(--sky)" },
                  { label: "FAMILLE CHARIS", val: familyCharisCount, color: "var(--green)" },
                  { label: "FAMILLE IT'S TIME", val: familyItsTimeCount, color: "var(--orange)" },
                  { label: "FAMILLE GÉNÉRATION JOSUÉ", val: familyJosueCount, color: "var(--violet)" },
                  { label: "FAMILLE DE MOÏSE", val: familyMoiseCount, color: "var(--rose)" },
                  { label: "AUCUNE / NON SPÉCIFIÉ", val: familyAucuneCount, color: "var(--muted)" }
                ].map((fam, i) => {
                  const percentage = Math.round((fam.val / (statsBase.length || 1)) * 100);
                  return (
                    <div key={fam.label} className="glass-compact" style={{ background: "rgba(255,255,255,0.02)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>{fam.label}</span>
                        <span style={{ fontSize: 12, color: fam.color, fontWeight: 700 }}>{fam.val}</span>
                      </div>
                      <div className="progress" style={{ height: 6 }}>
                        <div className="progress-fill" style={{ width: `${percentage}%`, background: fam.color }} />
                      </div>
                      <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 6 }}>{percentage}% de la base</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* New Stats Row */}
          <div className="bento bento-3">
            <div className="glass" style={{ display: "flex", flexDirection: "column", gap: 15 }}>
              <h3 style={{ fontSize: "clamp(13px, 2vw, 16px)", marginBottom: 5 }}>Suivi & Intégration</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(110px, 100%), 1fr))", gap: 10, flex: 1 }}>
                <div className="glass-compact" style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", border: "1px solid rgba(239, 68, 68, 0.25)", background: "rgba(239, 68, 68, 0.02)", padding: "12px 6px" }}>
                  <div style={{ fontSize: 9, color: "var(--rose)", fontWeight: 700, textTransform: "uppercase" }}>SANS ÉGLISE</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "var(--rose)", marginTop: 4 }}>{noChurch}</div>
                </div>
                <div className="glass-compact" style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", border: "1px solid rgba(91, 168, 224, 0.25)", background: "rgba(91, 168, 224, 0.02)", padding: "12px 6px" }}>
                  <div style={{ fontSize: 9, color: "var(--sky)", fontWeight: 700, textTransform: "uppercase" }}>AVEC TÉLÉPHONE</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "var(--sky)", marginTop: 4 }}>{phoneCount}</div>
                </div>
                <div className="glass-compact" style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", border: "1px solid rgba(168, 85, 247, 0.25)", background: "rgba(168, 85, 247, 0.02)", padding: "12px 6px" }}>
                  <div style={{ fontSize: 9, color: "var(--violet)", fontWeight: 700, textTransform: "uppercase" }}>FICHES APS</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "var(--violet)", marginTop: 4 }}>{apsCount}</div>
                </div>
                <div className="glass-compact" style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", border: "1px solid rgba(34, 197, 94, 0.25)", background: "rgba(34, 197, 94, 0.02)", padding: "12px 6px" }}>
                  <div style={{ fontSize: 9, color: "var(--green)", fontWeight: 700, textTransform: "uppercase" }}>REVENUS AU CULTE</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "var(--green)", marginTop: 4 }}>{returnedCount}</div>
                </div>
              </div>
            </div>
            <div className="glass">
              <h3 style={{ fontSize: "clamp(13px, 2vw, 16px)", marginBottom: 15 }}>Engagement spirituel</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(110px, 100%), 1fr))", gap: 10 }}>
                <div className="glass-compact" style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: "var(--muted)" }}>INTÉRÊT PCNC</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "var(--gold)" }}>{interetPCNC}</div>
                </div>
                <div className="glass-compact" style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: "var(--muted)" }}>BAPTISÉ IMMERSION</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "var(--sky)" }}>{baptemeEauCount}</div>
                </div>
                <div className="glass-compact" style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: "var(--muted)" }}>FAMILLE DISC.</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "var(--violet)" }}>{dansFamilleDiscipleCount}</div>
                </div>
                <div className="glass-compact" style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: "var(--muted)" }}>INTÉGRÉ CDM</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "var(--green)" }}>{integreCDMCount}</div>
                </div>
                <div className="glass-compact" style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: "var(--muted)" }}>VEUT SERVIR</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "var(--orange)" }}>{veutServirCount}</div>
                </div>
                <div className="glass-compact" style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: "var(--muted)" }}>DEVENU S.T.A.R</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "var(--rose)" }}>{devenuStarCount}</div>
                </div>
                <div className="glass-compact" style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: "var(--muted)" }}>INTÉRÊT CDM</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "var(--gold)" }}>{statsBase.filter(g => g.interetCDM).length}</div>
                </div>
                <div className="glass-compact" style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: "var(--muted)" }}>INTÉRÊT BAPTÊME</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "var(--sky)" }}>{statsBase.filter(g => g.interetBapteme).length}</div>
                </div>
              </div>
            </div>
            <div className="glass">
              <h3 style={{ fontSize: 16, marginBottom: 15 }}>Participation Moyenne</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: "var(--muted)" }}>Culte (Dimanche)</span>
                    <span style={{ fontSize: 11, color: "var(--green)", fontWeight: 600 }}>{avgParticipationCulte}%</span>
                  </div>
                  <div className="progress" style={{ height: 6 }}>
                    <div className="progress-fill" style={{ width: `${avgParticipationCulte}%`, background: "var(--green)" }} />
                  </div>
                </div>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: "var(--muted)" }}>C.D.M (Jeudi)</span>
                    <span style={{ fontSize: 11, color: "var(--sky)", fontWeight: 600 }}>{avgParticipationCDM}%</span>
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
<div className="form-grid-3-equal">
                <div>
                  <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 6 }}>DATE D'ARRIVÉE</label>
                  <CustomDatePicker 
                    value={newGuest.arrivalDate || ""} 
                    onChange={val => setNewGuest({...newGuest, arrivalDate: val})} 
                    placeholder="Sélectionner la date"
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 6 }}>ÂGE</label>
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

              <div className="form-grid-2">
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input type="checkbox" checked={newGuest.aps} onChange={e => setNewGuest({...newGuest, aps: e.target.checked})} />
                  <span style={{ fontSize: 13 }}>APS</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input type="checkbox" checked={newGuest.localChurch} onChange={e => setNewGuest({...newGuest, localChurch: e.target.checked})} />
                  <span style={{ fontSize: 13 }}>Déjà d'une église locale</span>
                </div>
                
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
            {currentView === 'list' && (
              <div className={styles.viewModePillGroup}>
                <button 
                  type="button"
                  className={`${styles.viewModePill} ${displayMode === 'cards' ? styles.viewModePillActive : ''}`}
                  onClick={() => {
                    setDisplayMode('cards');
                    try { localStorage.setItem("poimen_invites_display_mode", "cards"); } catch {}
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
                    try { localStorage.setItem("poimen_invites_display_mode", "table"); } catch {}
                  }}
                  title="Affichage en tableau synthétique avec colonnes figées"
                >
                  <TableIcon size={14} />
                  <span>Tableau</span>
                </button>
              </div>
            )}

            <div className={styles.countBadge}>
              {filtered.length} invité{filtered.length > 1 ? "s" : ""}
            </div>
          </div>
        </div>

        {/* Horizontal Scrolling Filter Bar (Pill Capsules) */}
        <div className={styles.filtersScroll}>
          {/* Arrivée Filter */}
          <div className={styles.filterChip}>
            <span className={styles.filterLabel}><Calendar size={12} /> Arrivée</span>
            <CustomSelect
              size="sm"
              style={{ width: 110 }}
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
              style={{ width: 100 }}
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
          <div className={styles.filterChip}>
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
          <div className={styles.filterChip}>
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
          <div className={styles.filterChip}>
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
                                          <PersonButton person={guest} onClick={() => personView.openPerson(guest.id)} />
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
                                    <select 
                                      className="input" 
                                      value={guest.famille_disciple || "AUCUNE"} 
                                      disabled={!canEdit}
                                      onChange={async (e) => {
                                        const newFamily = e.target.value;
                                        setGuests(prev => prev.map(g => g.id === guest.id ? {...g, famille_disciple: newFamily} : g));
                                        await supabase.from("invites").update({ famille_disciple: newFamily }).eq("id", guest.id);
                                      }} 
                                      style={{ 
                                        fontSize: 11, 
                                        padding: "4px 8px", 
                                        background: "var(--bg-deep)", 
                                        border: "1px solid var(--border)", 
                                        borderRadius: 6, 
                                        color: "var(--cream)", 
                                        width: "100%", 
                                        maxWidth: 150,
                                        cursor: canEdit ? "pointer" : "not-allowed",
                                        opacity: canEdit ? 1 : 0.6
                                      }}
                                    >
                                      <option value="AUCUNE">AUCUNE</option>
                                      <option value="FAMILLE DE NOÉ">FAMILLE DE NOÉ</option>
                                      <option value="FAMILLE DE DAVID">FAMILLE DE DAVID</option>
                                      <option value="FAMILLE CHARIS">FAMILLE CHARIS</option>
                                      <option value="FAMILLE IT'S TIME">FAMILLE IT'S TIME</option>
                                      <option value="FAMILLE GÉNÉRATION JOSUÉ">FAMILLE GÉNÉRATION JOSUÉ</option>
                                      <option value="FAMILLE DE MOÏSE">FAMILLE DE MOÏSE</option>
                                    </select>
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
      ) : displayMode === 'table' ? (
        /* Tableau View with Frozen Columns */
        <div className={`fade-in d1 ${styles.tableContainer}`}>
          <div className={styles.tableMobileHint}>
            <span>↔️ <strong>Astuce tactile :</strong> Faites défiler vers la droite pour voir toutes les colonnes. <em>Date d’arrivée</em>, <em>Nom</em> et <em>Prénom</em> restent figés à gauche.</span>
            <span style={{ fontSize: 10, color: "var(--muted)", whiteSpace: "nowrap" }}>{filtered.length} ligne{filtered.length > 1 ? "s" : ""}</span>
          </div>

          {filtered.length === 0 ? (
            <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--muted)" }}>
              <p style={{ fontSize: 14, marginBottom: 12 }}>Aucun invité ne correspond aux critères sélectionnés.</p>
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
                  const isIntegrationLeader = userRoleClean === "integration_responsable" || userRoleClean === "integration_second" || userRoleClean === "admin" || userRoleClean === "super_admin";
                  const isCreator = guest.created_by === userId;
                  const isAssignedCounselor = guest.assigned_to === userId && (userRoleClean === "integration_conseiller" || userRoleClean === "conseiller");
                  // Conseillers avec délégation : ne peuvent modifier que ceux qu'ils ont eux-mêmes encodé
                  const canEdit = isIntegrationLeader || canModifyInvites || isCreator || (!canDispatchAll && isAssignedCounselor);

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
                          disabled={!canEdit}
                          onChange={(e) => handleUpdateFamily(guest.id, e.target.value)}
                          style={{
                            borderColor: (guest.famille_disciple && guest.famille_disciple !== "AUCUNE") ? "rgba(16, 185, 129, 0.4)" : "var(--border)",
                            color: (guest.famille_disciple && guest.famille_disciple !== "AUCUNE") ? "var(--green)" : "var(--muted)",
                            cursor: canEdit ? "pointer" : "not-allowed",
                            opacity: canEdit ? 1 : 0.7
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

                      {/* Appel abouti (quick interactive toggle) */}
                      <td className={styles.td}>
                        <button
                          type="button"
                          className={`${styles.toggleBtn} ${guest.appelAbouti ? styles.toggleBtnActive : styles.toggleBtnInactive}`}
                          disabled={!canEdit}
                          onClick={() => toggleSuivi(guest.id, 'appelAbouti')}
                          title={canEdit ? (guest.appelAbouti ? "Marquer non abouti" : "Marquer appel abouti") : "Non autorisé"}
                        >
                          {guest.appelAbouti ? <Check size={10} /> : <X size={10} />}
                          <span>{guest.appelAbouti ? "Oui" : "Non"}</span>
                        </button>
                      </td>

                      {/* PCNC Progression */}
                      <td className={styles.td}>
                        {pcncStage ? (
                          <span 
                            style={{ 
                              fontSize: 10, 
                              fontWeight: 700, 
                              padding: "2px 7px", 
                              borderRadius: 6,
                              background: pcncStage.bg, 
                              color: pcncStage.color,
                              display: "inline-block"
                            }}
                          >
                            {pcncStage.label}
                          </span>
                        ) : (
                          <span style={{ color: "var(--muted)", fontSize: 10 }}>Non inscrit</span>
                        )}
                      </td>

                      {/* C.D.M */}
                      <td className={styles.td}>
                        {guest.integreCDM ? (
                          <span className="badge badge-emerald" style={{ fontSize: 9 }}>Intégré</span>
                        ) : guest.interetCDM ? (
                          <span className="badge badge-amber" style={{ fontSize: 9 }}>Intéressé</span>
                        ) : (
                          <span style={{ color: "var(--muted)", fontSize: 10 }}>—</span>
                        )}
                      </td>

                      {/* Fidélisé */}
                      <td className={styles.td}>
                        {fidelised ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "var(--green)", fontWeight: 700, fontSize: 11 }}>
                            <CheckCircle2 size={12} />
                            <span>Oui</span>
                          </span>
                        ) : (
                          <span style={{ color: "var(--muted)", fontSize: 10 }}>Non</span>
                        )}
                      </td>

                      {/* Présence Culte */}
                      <td className={styles.td}>
                        <span style={{ 
                          fontSize: 11, 
                          fontWeight: 700,
                          color: rateCulte >= 50 ? "var(--green)" : rateCulte >= 25 ? "var(--gold)" : "var(--muted)"
                        }}>
                          {rateCulte}%
                        </span>
                      </td>

                      {/* Présence C.D.M */}
                      <td className={styles.td}>
                        <span style={{ 
                          fontSize: 11, 
                          fontWeight: 700,
                          color: rateCDM >= 50 ? "var(--green)" : rateCDM >= 25 ? "var(--gold)" : "var(--muted)"
                        }}>
                          {rateCDM}%
                        </span>
                      </td>

                      {/* Conseiller / Affectation */}
                      <td className={styles.td}>
                        {(() => {
                          const canAssignAny = isIntegrationLeader || canModifyInvites || canDispatchAll;
                          const isCounselor = userRoleClean === "integration_conseiller" || userRoleClean === "conseiller";
                          const isAssignedToMe = guest.assigned_to === userId || (!guest.assigned_to && guest.responsible === userName);
                          const assignedCounselorName = counselors.find(c => c.id === guest.assigned_to)?.display_name || (guest.responsible && guest.responsible !== "Non assigné" ? guest.responsible : null);

                          if (userRoleClean.startsWith("integration_") || counselors.length > 0) {
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
                          if (canEdit && responsibles.length > 0) {
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
                          {canAddOrEditInvites && canEdit && (
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
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filtered.map((guest) => {
            const rateCDM = calculateRate(guest, thursdays);
            const rateCulte = calculateRate(guest, sundays);
            const fidelised = isFidelise(guest);
            const isExpanded = expandedId === guest.id;
            const isIntegrationLeader = userRoleClean === "integration_responsable" || userRoleClean === "integration_second" || userRoleClean === "admin" || userRoleClean === "super_admin";
            const isCreator = guest.created_by === userId;
            const canEditCard = isIntegrationLeader || canModifyInvites || isCreator || (!canDispatchAll && guest.assigned_to === userId);
            const canAssignAny = isIntegrationLeader || canModifyInvites || canDispatchAll;
            const isRestricted = !isIntegrationLeader && !canDispatchAll;
            const isActionBlocked = !isIntegrationLeader && !canDispatchAll && guest.assigned_to !== userId && !isCreator;
            const isUnassigned = !guest.assigned_to;
            // Follow-up information can only be edited by creator, or assigned counselor without delegation
            const isEditBlocked = !canEditCard;
            const isAttendanceBlocked = !canEditCard;

            return (
              <div key={guest.id} id={`guest-card-${guest.id}`} className="glass-flush" style={{ overflow: "hidden" }}>
                <div
                  className="invite-card-header"
                  onClick={() => setExpandedId(isExpanded ? null : guest.id)}
                  style={{ 
                    padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between",
                    cursor: "pointer", background: isExpanded ? "rgba(255,255,255,0.03)" : "transparent"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 15, flex: 1, minWidth: 0 }}>
                    <div className={`avatar ${fidelised ? "avatar-gradient" : ""}`} style={{ width: 40, height: 40 }}>
                      {guest.firstName[0]}{guest.lastName[0]}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <h3 style={{ fontSize: 14, fontWeight: 600 }}><PersonButton person={guest} onClick={() => personView.openPerson(guest.id)} /></h3>
                        {fidelised && <CheckCircle2 size={12} style={{ color: "var(--green)" }} />}
                        {((canAddOrEditInvites && !isActionBlocked) || (canDeleteInvites && !isActionBlocked)) && (
                          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                            {canAddOrEditInvites && !isActionBlocked && (
                              <button 
                                onClick={(e) => { e.stopPropagation(); openEditModal(guest); }}
                                className="btn-icon"
                                style={{ background: "rgba(255,255,255,0.05)", padding: 6, borderRadius: 6 }}
                                title="Modifier les informations"
                              >
                                <MoreHorizontal size={14} style={{ color: "var(--gold)" }} />
                              </button>
                            )}
                            {canDeleteInvites && !isActionBlocked && (
                              <button 
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  setDeletingGuest(guest);
                                  setDeleteError(null);
                                }}
                                className="btn-icon"
                                style={{ 
                                  background: "rgba(239, 68, 68, 0.05)", 
                                  border: "1px solid rgba(239, 68, 68, 0.15)",
                                  padding: 6, 
                                  borderRadius: 6,
                                  transition: "all 0.2s ease"
                                }}
                                title="Supprimer cet invité"
                              >
                                <Trash2 size={13} style={{ color: "var(--red)" }} />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                        {guest.civility} · {guest.age} · {userRoleClean.startsWith("integration_") ? (
                          `Conseiller: ${guest.assigned_to === userId ? (userName || "Moi") : (counselors.find(c => c.id === guest.assigned_to)?.display_name || "Non assigné")}`
                        ) : (
                          `Resp: ${guest.responsible}`
                        )}
                      </div>
                    </div>
                  </div>

                  {!isConseiller && (
                    <div style={{ display: "flex", gap: 24, alignItems: "center" }} className="hide-mobile">
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase" }}>Participation CDM</div>
                        <div style={{ fontWeight: 600, color: rateCDM >= 45 ? "var(--green)" : "var(--orange)" }}>{rateCDM}%</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase" }}>Participation Culte</div>
                        <div style={{ fontWeight: 600, color: rateCulte >= 45 ? "var(--green)" : "var(--orange)" }}>{rateCulte}%</div>
                      </div>
                    </div>
                  )}

                  <div className="invite-card-chevron" style={{ marginLeft: 20, color: "var(--muted)" }}>
                    {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="invite-expanded" style={{ padding: "0 20px 20px", borderTop: "1px solid var(--border)", background: "rgba(0,0,0,0.1)" }}>
                    <div className="invite-expanded-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(280px, 100%), 1fr))", gap: 20, paddingTop: 20 }}>
                      {/* Column 1: Info */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        <h4 style={{ fontSize: 11, color: "var(--gold)", textTransform: "uppercase", marginBottom: 4 }}>Informations</h4>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}><Phone size={14} style={{ color: "var(--muted)" }} /> <span style={{ wordBreak: "break-all" }}>{guest.phone}</span></div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}><Mail size={14} style={{ color: "var(--muted)" }} /> <span style={{ wordBreak: "break-all" }}>{guest.email}</span></div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                          <Calendar size={14} style={{ color: "var(--gold)" }} /> 
                          <span style={{ color: "var(--gold)", fontWeight: 500 }}>Arrivé le : {guest.arrivalDate ? guest.arrivalDate.split('-').reverse().join('/') : ''}</span>
                        </div>
                        <div className="badge badge-primary" style={{ width: "fit-content", fontSize: 10 }}>{guest.event}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}><MapPin size={14} style={{ color: "var(--muted)" }} /> <span style={{ fontSize: 12, wordBreak: "break-word" }}>{guest.address}</span></div>
                        
                        <div style={{ marginTop: 10 }}>
                          <label style={{ fontSize: 10, color: "var(--muted)", display: "block", marginBottom: 4 }}>COMMENTAIRE ARRIVÉE</label>
                          <div style={{ fontSize: 12, color: "var(--cream)", background: "rgba(0,0,0,0.2)", padding: 8, borderRadius: 6, border: "1px solid var(--border)" }}>
                            {guest.commentaire || "Aucun commentaire"}
                          </div>
                        </div>
                      </div>

                      {!isConseiller && (
                        <>
                          {/* Column 2: Attendance */}
                          <div className="invite-attendance-block" style={{ display: "flex", flexDirection: "column", gap: 15, padding: "20px" }}>
                            <div>
                              <h4 style={{ fontSize: 11, color: "var(--gold)", textTransform: "uppercase", marginBottom: 8 }}>CDM (Jeudi)</h4>
                              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                {thursdays.filter(day => !guest.arrivalDate || day >= guest.arrivalDate).map(day => {
                                  const isBeforeArrival = guest.arrivalDate && day < guest.arrivalDate;
                                  return (
                                    <div
                                      key={day}
                                      className={`attendance-day ${isBeforeArrival ? "attendance-day--not-applicable" : ""} ${isAttendanceBlocked ? "attendance-day--readonly" : ""}`}
                                      title={isBeforeArrival ? "Non applicable (avant l'arrivée)" : day}
                                      onClick={() => !isAttendanceBlocked && !isBeforeArrival && toggleAttendance(guest.id, day)} 
                                      style={{ 
                                        width: 28, height: 28, borderRadius: 6, 
                                        background: guest.attendance[day] ? "var(--green-glow)" : "rgba(255,255,255,0.05)", 
                                        border: `1px solid ${guest.attendance[day] ? "var(--green)" : "var(--border)"}`, 
                                        display: "flex", alignItems: "center", justifyContent: "center", 
                                        color: guest.attendance[day] ? "var(--green)" : "var(--muted)", 
                                        cursor: isBeforeArrival ? "not-allowed" : (isAttendanceBlocked ? "default" : "pointer")
                                      }}>
                                      <span style={{ fontSize: 9 }}>{parseInt(day.split('-')[2], 10)}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                            <div>
                              <h4 style={{ fontSize: 11, color: "var(--gold)", textTransform: "uppercase", marginBottom: 8 }}>Culte (Dimanche)</h4>
                              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                {sundays.filter(day => !guest.arrivalDate || day >= guest.arrivalDate).map(day => {
                                  const isBeforeArrival = guest.arrivalDate && day < guest.arrivalDate;
                                  return (
                                    <div
                                      key={day}
                                      className={`attendance-day ${isBeforeArrival ? "attendance-day--not-applicable" : ""} ${isAttendanceBlocked ? "attendance-day--readonly" : ""}`}
                                      title={isBeforeArrival ? "Non applicable (avant l'arrivée)" : day}
                                      onClick={() => !isAttendanceBlocked && !isBeforeArrival && toggleAttendance(guest.id, day)} 
                                      style={{ 
                                        width: 28, height: 28, borderRadius: 6, 
                                        background: guest.attendance[day] ? "var(--green-glow)" : "rgba(255,255,255,0.05)", 
                                        border: `1px solid ${guest.attendance[day] ? "var(--green)" : "var(--border)"}`, 
                                        display: "flex", alignItems: "center", justifyContent: "center", 
                                        color: guest.attendance[day] ? "var(--green)" : "var(--muted)", 
                                        cursor: isBeforeArrival ? "not-allowed" : (isAttendanceBlocked ? "default" : "pointer")
                                      }}>
                                      <span style={{ fontSize: 9 }}>{parseInt(day.split('-')[2], 10)}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>

                          {/* Column 3: Actions & Status */}
                          <div className="invite-actions-block" style={{ display: "flex", flexDirection: "column", gap: 15, padding: "20px" }}>
                            {userRoleClean.startsWith("integration_") && (
                              guest.bergerie_id ? (
                                <div style={{ padding: "10px", borderRadius: 8, background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                                  <span style={{ color: "var(--green)", fontSize: 12, fontWeight: 600 }}>Déjà affecté à une bergerie</span>
                                </div>
                              ) : (
                                <div style={{ padding: "10px", borderRadius: 8, background: "rgba(212,160,60,0.1)", border: "1px solid rgba(212,160,60,0.2)", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                                  <span style={{ color: "var(--gold-light)", fontSize: 12, fontWeight: 600 }}>En cours d'intégration</span>
                                </div>
                              )
                            )}

                            {canDeleteInvites && (
                              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                {showCorbeille && (
                                  <button 
                                    className="btn btn-outline" 
                                    style={{ borderColor: "var(--green)", color: "var(--green)", background: "rgba(16, 185, 129, 0.05)" }} 
                                    onClick={() => handleRestoreGuest(guest.id)}
                                  >
                                    <RotateCcw size={14} /> Restaurer cet invité
                                  </button>
                                )}
                                
                                <div style={{ marginTop: 10, padding: 12, background: "rgba(239, 68, 68, 0.1)", borderRadius: 8, border: "1px solid rgba(239, 68, 68, 0.2)" }}>
                                  <p style={{ fontSize: 11, color: "#ef4444", marginBottom: 8, textAlign: "center", fontWeight: 600 }}>{showCorbeille ? "SUPPRESSION DÉFINITIVE" : "ZONE DANGEREUSE"}</p>
                                  <button 
                                    className="btn btn-danger-outline" 
                                    style={{ width: "100%", fontWeight: "bold", padding: "10px", fontSize: 11 }} 
                                    onClick={() => { setDeletingGuest(guest); setDeleteError(null); }}
                                  >
                                    {showCorbeille ? (
                                      <>
                                        <Trash2 size={14} /> Supprimer définitivement
                                      </>
                                    ) : (
                                      <>
                                        <Archive size={14} /> Envoyer à la corbeille
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Ajout/Retrait de la Bergerie pour les Familles de Disciples */}
                            {!userRoleClean.startsWith("integration_") && (
                              (() => {
                                const role = userRoleClean;
                                const isLeader = role.includes("berger") || role.includes("second") || role.includes("responsable");
                                const isAssignedToMe = guest.responsible === userName;
                                if (!isLeader && !isAssignedToMe) return null;
                                
                                return !guest.isInBergerie ? (
                                  <button className="btn btn-primary" onClick={() => promoteToMember(guest)} style={{ width: "100%" }}>
                                    <UserPlus size={14} /> Ajouter à la Bergerie
                                  </button>
                                ) : (
                                  <button className="btn btn-outline" style={{ width: "100%", borderColor: "var(--rose)", color: "var(--rose)", background: "rgba(255, 77, 148, 0.05)" }} onClick={() => removeFromMember(guest)}>
                                    <UserMinus size={14} /> Retirer de la Bergerie
                                  </button>
                                );
                              })()
                            )}
                            
                            {(canModifyInvites || canAssignAny) && (
                              <div className="glass-compact" style={{ background: "rgba(255,255,255,0.02)" }}>
                                <h5 style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", marginBottom: 8 }}>
                                  {userRoleClean.startsWith("integration_") ? "Assigner à un conseiller" : "Affectation"}
                                </h5>
                                <div style={{ display: "flex", gap: 8 }}>
                                  {userRoleClean.startsWith("integration_") ? (
                                    <select 
                                      className="input" 
                                      value={guest.assigned_to || ""} 
                                      onChange={(e) => handleAssignCounselor(guest.id, e.target.value || null)} 
                                      style={{ flex: 1, fontSize: 12 }}
                                    >
                                      <option value="">Non assigné</option>
                                      {counselors.map(c => (
                                        <option key={c.id} value={c.id}>{c.display_name}{c.id === userId ? " (Moi)" : ""}</option>
                                      ))}
                                    </select>
                                  ) : (
                                    <select className="input" value={guest.responsible || "Non assigné"} onChange={async (e) => {
                                      const newResp = e.target.value;
                                      setGuests(prev => prev.map(g => g.id === guest.id ? {...g, responsible: newResp} : g));
                                      await supabase.from("invites").update({ responsible: newResp }).eq("id", guest.id);
                                    }} style={{ flex: 1, fontSize: 12 }}>
                                      {responsibles.map(r => <option key={r} value={r}>{r}</option>)}
                                      {guest.responsible && guest.responsible !== "Non assigné" && !responsibles.includes(guest.responsible) && (
                                        <option key={guest.responsible} value={guest.responsible}>{guest.responsible}</option>
                                      )}
                                    </select>
                                  )}
                                  {/* Self-assign button */}
                                  {(() => {
                                    const isAlreadyMine = userRoleClean.startsWith("integration_")
                                      ? guest.assigned_to === userId
                                      : guest.responsible === userName;
                                    if (isAlreadyMine) return null;
                                    return (
                                      <button
                                        className="btn btn-primary btn-sm"
                                        style={{ whiteSpace: "nowrap", fontSize: 11, padding: "6px 14px" }}
                                        onClick={() => handleSelfAssign(guest.id)}
                                        title="M'affecter cet invité"
                                      >
                                        M'affecter
                                      </button>
                                    );
                                  })()}
                                </div>
                              </div>
                            )}

                            {!isIntegrationOrCounselor && (
                              <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                                <button 
                                  className="btn btn-primary btn-sm" 
                                  disabled
                                  style={{ width: "100%", background: "linear-gradient(135deg, var(--gold) 0%, #b8973b 100%)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: 0.5, cursor: "not-allowed" }}
                                  title="Fonctionnalité désactivée temporairement"
                                >
                                  {guest.bergerie_id ? "Changer de famille" : "Confier à une famille"}
                                </button>
                                
                                <div className="glass-compact" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(212,175,55,0.15)" }}>
                                  <label style={{ fontSize: 10, color: "var(--gold)", letterSpacing: "1px", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Est affecté(e) à la famille</label>
                                  <select 
                                    className="input" 
                                    value={guest.famille_disciple || "AUCUNE"} 
                                    onChange={async (e) => {
                                      const newFamily = e.target.value;
                                      setGuests(prev => prev.map(g => g.id === guest.id ? {...g, famille_disciple: newFamily} : g));
                                      await supabase.from("invites").update({ famille_disciple: newFamily }).eq("id", guest.id);
                                    }} 
                                    style={{ width: "100%", fontSize: 12 }}
                                  >
                                    <option value="AUCUNE">AUCUNE</option>
                                    <option value="FAMILLE DE NOÉ">FAMILLE DE NOÉ</option>
                                    <option value="FAMILLE DE DAVID">FAMILLE DE DAVID</option>
                                    <option value="FAMILLE CHARIS">FAMILLE CHARIS</option>
                                    <option value="FAMILLE IT'S TIME">FAMILLE IT'S TIME</option>
                                    <option value="FAMILLE GÉNÉRATION JOSUÉ">FAMILLE GÉNÉRATION JOSUÉ</option>
                                    <option value="FAMILLE DE MOÏSE">FAMILLE DE MOÏSE</option>
                                  </select>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Column 4: Detailed Follow-up */}
                          <div className="invite-followup-block col-span-2" style={{ display: "flex", flexDirection: "column", gap: 15, padding: "20px" }}>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))", gap: 15 }}>
                              <div className="glass-compact" style={{ background: "rgba(255,255,255,0.02)", display: "flex", flexDirection: "column", gap: 8 }}>
                                <h5 style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", marginBottom: 0 }}>Premier Contact</h5>
                                <SuiviToggle label="Appel abouti" checked={guest.appelAbouti} onChange={() => toggleSuivi(guest.id, 'appelAbouti')} disabled={isEditBlocked} />
                                {!guest.appelAbouti && !isEditBlocked && (
                                  <div className="glass-compact" style={{ marginTop: 8, marginBottom: 8, padding: 10, background: "rgba(244, 63, 94, 0.05)", border: "1px dashed rgba(244, 63, 94, 0.3)", borderRadius: 8, animation: "fadeIn 0.3s ease-out" }}>
                                    <label style={{ fontSize: 9, color: "var(--rose)", display: "block", marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>Raison de l'échec</label>
                                    <textarea 
                                      placeholder="Pourquoi l'appel n'a pas abouti ? (ex: Ne décroche pas, numéro invalide...)" 
                                      value={guest.commentaireSuivi || ""} 
                                      disabled={isEditBlocked}
                                      onChange={(e) => setGuests(prev => prev.map(g => g.id === guest.id ? { ...g, commentaireSuivi: e.target.value } : g))}
                                      onBlur={(e) => supabase.from("invites").update({ commentaire_suivi: e.target.value }).eq("id", guest.id).then()}
                                      style={{ width: "100%", minHeight: 60, fontSize: 11, background: "var(--bg-deep)", border: "1px solid var(--border)", borderRadius: 6, padding: "10px", color: "var(--cream)", resize: "vertical", lineHeight: "1.5" }}
                                    />
                                  </div>
                                )}
                                <SuiviToggle label="Groupe WhatsApp" checked={guest.groupeWhatsapp} onChange={() => toggleSuivi(guest.id, 'groupeWhatsapp')} disabled={isEditBlocked} />
                                <SuiviToggle label="Prévu revenir" checked={guest.prevuRevenir} onChange={() => toggleSuivi(guest.id, 'prevuRevenir')} disabled={isEditBlocked} />
                                <SuiviToggle label="Revenu au culte" checked={guest.estRevenuCulte} onChange={() => toggleSuivi(guest.id, 'estRevenuCulte')} disabled={isEditBlocked} />
                              </div>
                              <div className="glass-compact" style={{ background: "rgba(255,255,255,0.02)", display: "flex", flexDirection: "column", gap: 8 }}>
                                <h5 style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", marginBottom: 0 }}>Engagement & CDM</h5>
                                <SuiviToggle label="Intérêt PCNC" checked={guest.interetFormation} onChange={() => toggleSuivi(guest.id, 'interetFormation')} disabled={isEditBlocked} />
                                <SuiviToggle label="Prière/Partage" checked={guest.prierePartage} onChange={() => toggleSuivi(guest.id, 'prierePartage')} disabled={isEditBlocked} />
                                <SuiviToggle label="Intérêt C.D.M" checked={guest.interetCDM} onChange={() => toggleSuivi(guest.id, 'interetCDM')} disabled={isEditBlocked} />
                                <SuiviToggle label="A intégré C.D.M" checked={guest.integreCDM} onChange={() => toggleSuivi(guest.id, 'integreCDM')} disabled={isEditBlocked} />
                                <SuiviToggle label="Famille Disciple" checked={guest.dansFamilleDisciple} onChange={() => toggleSuivi(guest.id, 'dansFamilleDisciple')} disabled={isEditBlocked} />
                                <SuiviToggle label="Intérêt Baptême" checked={guest.interetBapteme} onChange={() => toggleSuivi(guest.id, 'interetBapteme')} disabled={isEditBlocked} />
                                <SuiviToggle label="Cocktail" checked={guest.cocktailBienvenue} onChange={() => toggleSuivi(guest.id, 'cocktailBienvenue')} disabled={isEditBlocked} />
                              </div>
                            </div>

                            <div className="glass-compact" style={{ background: "rgba(255,255,255,0.02)" }}>
                              <h5 style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", marginBottom: 12 }}>PCNC & Intégration</h5>
                              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
                                <SuiviToggle label="001" checked={guest.pcnc} onChange={() => toggleSuivi(guest.id, 'pcnc')} disabled={isEditBlocked} />
                                <SuiviToggle label="101" checked={guest.p101} onChange={() => toggleSuivi(guest.id, 'p101')} disabled={isEditBlocked} />
                                <SuiviToggle label="201" checked={guest.p201} onChange={() => toggleSuivi(guest.id, 'p201')} disabled={isEditBlocked} />
                                <SuiviToggle label="301" checked={guest.p301} onChange={() => toggleSuivi(guest.id, 'p301')} disabled={isEditBlocked} />
                                <SuiviToggle label="Terminé" checked={guest.terminePCNC} onChange={() => toggleSuivi(guest.id, 'terminePCNC')} disabled={isEditBlocked} />
                                <SuiviToggle label="Baptisé par immersion" checked={guest.baptemeEau} onChange={() => toggleSuivi(guest.id, 'baptemeEau')} disabled={isEditBlocked} />
                                <SuiviToggle label="Veut servir" checked={guest.veutServir} onChange={() => toggleSuivi(guest.id, 'veutServir')} disabled={isEditBlocked} />
                                <SuiviToggle label="Devenu STAR" checked={guest.devenuStar} onChange={() => toggleSuivi(guest.id, 'devenuStar')} disabled={isEditBlocked} />
                              </div>
                              <div style={{ marginTop: 15 }}>
                                <label style={{ fontSize: 10, color: "var(--muted)", display: "block", marginBottom: 4 }}>COMMENTAIRE SUIVI</label>
                                <textarea className="input" rows={2} defaultValue={guest.commentaireSuivi} disabled={isEditBlocked} style={{ fontSize: 12, resize: "vertical", background: "var(--bg-deep)", opacity: isEditBlocked ? 0.5 : 1 }} onBlur={(e) => supabase.from("invites").update({ commentaire_suivi: e.target.value }).eq("id", guest.id)} />
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
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
