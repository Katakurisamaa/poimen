"use client";

import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { 
  Search, Plus, Grid3X3, List, UserMinus, UserPlus, 
  ChevronDown, ChevronUp, XCircle, Loader2, Pencil, Eye,
  Trash2, Trash, RotateCcw, Archive, Table, Maximize2, Minimize2,
  Filter, SlidersHorizontal
} from "lucide-react";
import { useRef } from "react";
import { supabase } from "@/lib/supabase";
import { autoAddLeaderToMembers } from "@/app/actions/auth";
import { getActiveContext, getActiveUserInfo } from "@/lib/client-session";
import { filterElapsedDateKeys } from "@/lib/date-utils";


const STATUS_OPTIONS = ["Brebi", "Responsable", "Berger", "Second"];

interface M { 
  id: string; 
  civility: string; 
  lastName: string; 
  firstName: string; 
  age: string; 
  phone: string; 
  status: string;
  email: string;
  responsible?: string;
  is_conseiller?: boolean;
  archived?: boolean;
  attendance: Record<string, Record<string, boolean>>;
  // New detailed fields
  date_entree?: string;
  date_anniversaire?: string;
  adresse?: string;
  profession?: string;
  etat_civil?: string;
  a_enfants?: boolean;
  nombre_enfants?: number;
  est_baptise?: boolean;
  formations?: string[];
  est_star?: boolean;
  departement_star?: string;
  commentaire_star?: string;
  est_cdm?: boolean;
  pilote_cdm?: string;
  commentaire_cdm?: string;
  commentaire_pcnc?: string;
  commentaire_baptise?: string;
}

interface Activity {
  id: string;
  name: string;
  day: number;
  days?: number[];
  startTime: string;
  endTime: string;
  noFixedHours?: boolean;
  startDate?: string;
  cancelledDates?: string[];
}

const INITIAL_ACTIVITIES: Activity[] = [
  { id: "culte", name: "Culte du Dimanche", day: 0, startTime: "10:00", endTime: "12:30" },
  { id: "cdm", name: "CDM (Cellule Alpha)", day: 4, startTime: "19:00", endTime: "20:30" },
];

const INITIAL_DATA: M[] = [];

const getEngagementColor = (engagement: number) => {
  if (engagement >= 75) return "var(--green)";
  if (engagement >= 45) return "var(--orange)";
  return "var(--red)";
};

export default function BergeriePage() {
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

  const [data, setData] = useState<M[]>(INITIAL_DATA);
  const [activities, setActivities] = useState<Activity[]>(INITIAL_ACTIVITIES);
  const [mounted, setMounted] = useState(false);
  
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"list" | "grid" | "table">(() =>
    typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches ? "grid" : "list"
  );
  const [isTableFullscreen, setIsTableFullscreen] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);

  const toggleTableFullscreen = async () => {
    if (!tableRef.current) return;
    const elem = tableRef.current as any;
    try {
      if (!document.fullscreenElement && !(document as any).webkitFullscreenElement && !(document as any).msFullscreenElement) {
        if (elem.requestFullscreen) {
          await elem.requestFullscreen();
        } else if (elem.webkitRequestFullscreen) {
          await elem.webkitRequestFullscreen();
        } else if (elem.msRequestFullscreen) {
          await elem.msRequestFullscreen();
        }
      } else {
        const doc = document as any;
        if (doc.exitFullscreen) {
          await doc.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen();
        } else if (doc.msExitFullscreen) {
          await doc.msExitFullscreen();
        }
      }
    } catch (err) {
      console.error("Error toggling table fullscreen:", err);
      setIsTableFullscreen(!isTableFullscreen);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).msFullscreenElement
      ) && (
        document.fullscreenElement === tableRef.current ||
        (document as any).webkitFullscreenElement === tableRef.current ||
        (document as any).msFullscreenElement === tableRef.current
      );
      setIsTableFullscreen(isCurrentlyFullscreen);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("msfullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      document.removeEventListener("msfullscreenchange", handleFullscreenChange);
    };
  }, []);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isConseillerModalOpen, setIsConseillerModalOpen] = useState(false);
  const [conseillerSource, setConseillerSource] = useState<"existing" | "new">("existing");
  const [selectedConseillerId, setSelectedConseillerId] = useState<string>("");
  const [filterBaptise, setFilterBaptise] = useState<string>("all");
  const [filterPCNC, setFilterPCNC] = useState<string>("all");
  const [filterEntreeMois, setFilterEntreeMois] = useState<string>("all");
  const [filterAnnivMois, setFilterAnnivMois] = useState<string>("all");
  const [filterStar, setFilterStar] = useState<string>("all");
  const [filterCDM, setFilterCDM] = useState<string>("all");
  const [filterProfession, setFilterProfession] = useState<string>("all");
  const [filterPilote, setFilterPilote] = useState<string>("all");
  const [filterDeptStar, setFilterDeptStar] = useState<string>("all");
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isConseillerChecked, setIsConseillerChecked] = useState(false);
  const [showCorbeille, setShowCorbeille] = useState(false);
  const [conseillerExterne, setConseillerExterne] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      const activeContext = getActiveContext();
      const activeUserInfo = getActiveUserInfo();
      const userInfoStr = activeUserInfo ? JSON.stringify(activeUserInfo) : localStorage.getItem("poimen_user_info");
      if (userInfoStr) {
        const parsed = JSON.parse(userInfoStr);
        setUserRole(parsed.role);
        setUserName(`${parsed.firstName} ${parsed.lastName}`);
        setUserEmail(parsed.email?.toLowerCase());
      }
      const fam = activeContext?.context_type === "integration" ? null : localStorage.getItem("selected_family");
      if (fam) {
        const parsedFam = JSON.parse(fam);
        setFamilyId(parsedFam.id);
      } else if (activeContext?.context_type === "family" && activeContext.bergerie_id) {
        setFamilyId(activeContext.bergerie_id);
      }
    }
  }, []);

  useEffect(() => {
    const shouldLock = isAddModalOpen || isConseillerModalOpen;
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
  }, [isAddModalOpen, isConseillerModalOpen]);

  const userRoleVal = (userRole || "brebi").toLowerCase().trim().replace(/ /g, '_');
  const isLeader = [
    "berger", "second", "coordonnateur", "responsable", "super_admin", 
    "responsable_de_brebi", "second_du_berger", "conseiller"
  ].includes(userRoleVal);

  const canManageMembers = ["berger", "second", "super_admin", "second_du_berger", "conseiller"].includes(userRoleVal);

  useEffect(() => {
    if (familyId) {
      fetchMembers();
    }
  }, [familyId]);

  const fetchMembers = async () => {
    setLoading(true);

    try {
      const { data: bergerieData } = await supabase
        .from("bergeries")
        .select("activities")
        .eq("id", familyId)
        .single();
      if (bergerieData?.activities) {
        setActivities(bergerieData.activities as Activity[]);
      }
    } catch (e) {
      console.error("Error loading activities in Bergerie:", e);
    }

    const { data: dbMembers, error } = await supabase
      .from("members")
      .select("*")
      .eq("bergerie_id", familyId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching members:", error);
    } else {
      // Map DB fields to component interface
      const mapped: M[] = (dbMembers || []).map(m => ({
        id: m.id,
        civility: m.civility,
        firstName: m.first_name,
        lastName: m.last_name,
        age: m.age,
        phone: m.phone,
        status: m.status,
        email: m.email || "",
        responsible: m.responsible,
        is_conseiller: m.is_conseiller || false,
        archived: m.archived || false,
        attendance: m.attendance || {},
        // New detailed fields
        date_entree: m.date_entree || "",
        date_anniversaire: m.date_anniversaire || "",
        adresse: m.adresse || "",
        profession: m.profession || "",
        etat_civil: m.etat_civil || "Célibataire",
        a_enfants: m.a_enfants || false,
        nombre_enfants: m.nombre_enfants || 0,
        est_baptise: m.est_baptise || false,
        formations: m.formations || [],
        est_star: m.est_star || false,
        departement_star: m.departement_star || "",
        commentaire_star: m.commentaire_star || "",
        est_cdm: m.est_cdm || false,
        pilote_cdm: m.pilote_cdm || "",
        commentaire_cdm: m.commentaire_cdm || "",
        commentaire_pcnc: m.commentaire_pcnc || "",
        commentaire_baptise: m.commentaire_baptise || ""
      }));
      
      // AUTO-ADD LEADER SAFETY NET
      console.log("Membres récupérés:", mapped.length);
      
      if (isLeader && userEmail && familyId) {
        const me = mapped.find(m => m.email?.toLowerCase() === userEmail);
        console.log("Vérification auto-add pour:", userEmail, "Trouvé ?", !!me);
        
        if (!me) {
          console.log("Tentative d'ajout automatique du leader via Server Action...");
          const res = await autoAddLeaderToMembers({
            bergerie_id: familyId,
            civility: "M.",
            first_name: userName?.split(' ')[0] || "Leader",
            last_name: userName?.split(' ')[1] || "Nom",
            email: userEmail,
            status: userRoleVal.includes('second') ? 'Second' : (userRoleVal.includes('berger') ? 'Berger' : 'Responsable')
          });
          
          if (!res.success) {
            console.error("ÉCHEC de l'ajout automatique:", res.error);
          } else {
            console.log("SUCCÈS de l'ajout automatique !");
            const { data: retryData } = await supabase.from("members").select("*").eq("bergerie_id", familyId);
            if (retryData) {
               setData(retryData.map(m => ({
                 id: m.id, civility: m.civility, firstName: m.first_name, lastName: m.last_name,
                 age: m.age, phone: m.phone, status: m.status, email: m.email || "",
                 responsible: m.responsible, attendance: m.attendance || {},
                 is_conseiller: m.is_conseiller || false, archived: m.archived || false
               })));
               setLoading(false);
               return;
            }
          }
        }
      }

      setData(mapped);
    }
    setLoading(false);
  };

  const [newMember, setNewMember] = useState<Partial<M>>({
    civility: "M.",
    firstName: "",
    lastName: "",
    age: "26-30 ans",
    phone: "",
    status: "Brebi",
    email: "",
    attendance: {},
    date_entree: new Date().toISOString().split('T')[0],
    date_anniversaire: "",
    adresse: "",
    profession: "",
    etat_civil: "Célibataire",
    a_enfants: false,
    nombre_enfants: 0,
    est_baptise: false,
    formations: [],
    est_star: false,
    departement_star: "",
    est_cdm: false,
    pilote_cdm: ""
  });

  // Helpers for calculation
  const getDaysOfPeriodForActivity = (year: number, month: number, act: Activity) => {
    const days = act.days && act.days.length > 0 ? act.days : [act.day ?? 0];
    const allDates: string[] = [];
    
    days.forEach(dayOfWeek => {
      const dates = [];
      let d = new Date(year, month, 1);
      while (d.getMonth() === month) {
        if (d.getDay() === Number(dayOfWeek)) {
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const dd = String(d.getDate()).padStart(2, '0');
          dates.push(`${yyyy}-${mm}-${dd}`);
        }
        d.setDate(d.getDate() + 1);
      }
      allDates.push(...dates);
    });
    
    const limitDate = act.startDate || "2026-03-29";
    return allDates.filter(d => d >= limitDate).sort();
  };

  const calculateEngagement = (member: M) => {
    let totalPossible = 0;
    let totalPresent = 0;
    const now = new Date();
    
    activities.forEach(act => {
      const dates = filterElapsedDateKeys(getDaysOfPeriodForActivity(now.getFullYear(), now.getMonth(), act));
      const validDates = dates.filter(d => !member.date_entree || d >= member.date_entree);
      const nonCancelledDates = validDates.filter(d => !act.cancelledDates?.includes(d));
      totalPossible += nonCancelledDates.length;
      totalPresent += nonCancelledDates.filter(d => member.attendance[act.id]?.[d]).length;
    });
    
    return totalPossible === 0 ? 0 : Math.round((totalPresent / totalPossible) * 100);
  };
  // Separate active members, archived (corbeille), and external conseillers
  const activeMembers = data.filter(m => !m.archived && m.status !== "Externe");
  const archivedMembers = data.filter(m => m.archived);
  const externalConseiller = data.find(m => m.status === "Externe" && m.is_conseiller && !m.archived);

  const uniqueProfessions = useMemo<string[]>(() => {
    const profs = activeMembers
      .map(m => m.profession?.trim())
      .filter((p): p is string => !!p);
    return Array.from(new Set(profs)).sort();
  }, [activeMembers]);

  const uniquePilotes = useMemo<string[]>(() => {
    const pilotes = activeMembers
      .map(m => m.pilote_cdm?.trim())
      .filter((p): p is string => !!p && p !== "Aucun");
    return Array.from(new Set(pilotes)).sort();
  }, [activeMembers]);

  const uniqueDeptStars = useMemo<string[]>(() => {
    const depts = activeMembers
      .map(m => m.departement_star?.trim())
      .filter((d): d is string => !!d && d !== "Aucun");
    return Array.from(new Set(depts)).sort();
  }, [activeMembers]);

  const hasActiveFilters = 
    filterBaptise !== "all" ||
    filterPCNC !== "all" ||
    filterEntreeMois !== "all" ||
    filterAnnivMois !== "all" ||
    filterStar !== "all" ||
    filterCDM !== "all" ||
    filterProfession !== "all" ||
    filterPilote !== "all" ||
    filterDeptStar !== "all";

  const activeFiltersCount = [
    filterBaptise !== "all",
    filterPCNC !== "all",
    filterEntreeMois !== "all",
    filterAnnivMois !== "all",
    filterStar !== "all",
    filterCDM !== "all",
    filterProfession !== "all",
    filterPilote !== "all",
    filterDeptStar !== "all"
  ].filter(Boolean).length;




  const filtered = (showCorbeille ? archivedMembers : activeMembers).filter((m) => {
    // Recherche textuelle multi-champs (Nom, Prénom, Nom & Prénom, Téléphone)
    if (search) {
      const q = search.toLowerCase().trim();
      const qNoSpace = q.replace(/\s+/g, "");
      const fn = (m.firstName || "").toLowerCase();
      const ln = (m.lastName || "").toLowerCase();
      const full1 = `${fn} ${ln}`;
      const full2 = `${ln} ${fn}`;
      const phone = (m.phone || "").toLowerCase().replace(/\s+/g, "");

      const matchName = fn.includes(q) || ln.includes(q) || full1.includes(q) || full2.includes(q);
      const matchPhone = phone.includes(qNoSpace);

      if (!matchName && !matchPhone) return false;
    }

    if (showCorbeille) return true; // Show all archived

    // 1. Si c'est un simple membre (Brebi), il ne voit QUE lui-même
    if (!isLeader) {
      return m.email?.toLowerCase() === userEmail;
    }

    // 2. Filtrage spécifique pour les responsables de brebis
    if (userRoleVal === "responsable_de_brebi" || userRoleVal === "responsable") {
      const userNameStr = userName || "";
      // On voit soit ses propres brebis, soit soi-même
      if (m.status === "Brebi") {
        return m.responsible === userNameStr;
      } else {
        // Voir le Berger, le Second et soi-même (pour édition ou visibilité)
        return m.status === "Berger" || m.status === "Second" || (m.firstName + " " + m.lastName) === userNameStr;
      }
    }

    // 3. Baptisé
    if (filterBaptise === "yes" && !m.est_baptise) return false;
    if (filterBaptise === "no" && m.est_baptise) return false;

    // 4. P.C.N.C (formations)
    if (filterPCNC !== "all") {
      const formations = m.formations || [];
      if (filterPCNC === "none") {
        if (formations.length > 0) return false;
      } else {
        if (!formations.includes(filterPCNC)) return false;
      }
    }

    // 5. Date d'entrée (juste le mois)
    if (filterEntreeMois !== "all") {
      if (!m.date_entree) return false;
      const month = m.date_entree.split("-")[1]; // format YYYY-MM-DD
      if (month !== filterEntreeMois) return false;
    }

    // 6. Anniversaire (juste le mois)
    if (filterAnnivMois !== "all") {
      if (!m.date_anniversaire) return false;
      const month = m.date_anniversaire.split("/")[1]; // format DD/MM
      if (month !== filterAnnivMois) return false;
    }

    // 7. S.T.A.R
    if (filterStar === "yes" && !m.est_star) return false;
    if (filterStar === "no" && m.est_star) return false;

    // 8. C.D.M
    if (filterCDM === "yes" && !m.est_cdm) return false;
    if (filterCDM === "no" && m.est_cdm) return false;

    // 9. Profession
    if (filterProfession !== "all" && m.profession?.trim() !== filterProfession) return false;

    // 10. Pilote CDM
    if (filterPilote !== "all" && (m.pilote_cdm || "Aucun") !== filterPilote) return false;

    // 11. Département STAR
    if (filterDeptStar !== "all" && (m.departement_star || "Aucun") !== filterDeptStar) return false;

    return true;
  }).sort((a, b) => {
    const isAPriority = a.status === "Berger" || a.status === "Second";
    const isBPriority = b.status === "Berger" || b.status === "Second";

    if (isAPriority && isBPriority) {
      const roles = { "Berger": 1, "Second": 2 };
      return (roles[a.status as keyof typeof roles] || 9) - (roles[b.status as keyof typeof roles] || 9);
    }
    if (isAPriority) return -1;
    if (isBPriority) return 1;

    // Ordre alphabétique suivant les prénoms (A à Z)
    return (a.firstName || "").localeCompare(b.firstName || "", "fr", { sensitivity: "base" });
  });

  const updateStatus = async (id: string, newStatus: string) => {
    if (userRole === "Brebi" || userRole === "brebi") return;
    
    setData(prev => prev.map(m => m.id === id ? { ...m, status: newStatus } : m));
    
    await supabase.from("members").update({ status: newStatus }).eq("id", id);
  };

  const updateMemberField = async (memberId: string, updates: Partial<M>) => {
    if (!canManageMembers) return;

    // 1. Optimistic update in local state so ALL views sync immediately
    setData(prev => prev.map(m => m.id === memberId ? { ...m, ...updates } : m));

    // 2. Build payload for Supabase database update
    const dbPayload: Record<string, any> = {};
    if (updates.firstName !== undefined) dbPayload.first_name = updates.firstName;
    if (updates.lastName !== undefined) dbPayload.last_name = updates.lastName;
    if (updates.phone !== undefined) dbPayload.phone = updates.phone;
    if (updates.date_entree !== undefined) dbPayload.date_entree = updates.date_entree;
    if (updates.est_cdm !== undefined) dbPayload.est_cdm = updates.est_cdm;
    if (updates.pilote_cdm !== undefined) dbPayload.pilote_cdm = updates.pilote_cdm;
    if (updates.commentaire_cdm !== undefined) dbPayload.commentaire_cdm = updates.commentaire_cdm;
    if (updates.formations !== undefined) dbPayload.formations = updates.formations;
    if (updates.commentaire_pcnc !== undefined) dbPayload.commentaire_pcnc = updates.commentaire_pcnc;
    if (updates.est_star !== undefined) dbPayload.est_star = updates.est_star;
    if (updates.departement_star !== undefined) dbPayload.departement_star = updates.departement_star;
    if (updates.commentaire_star !== undefined) dbPayload.commentaire_star = updates.commentaire_star;
    if (updates.est_baptise !== undefined) dbPayload.est_baptise = updates.est_baptise;
    if (updates.commentaire_baptise !== undefined) dbPayload.commentaire_baptise = updates.commentaire_baptise;

    if (Object.keys(dbPayload).length === 0) return;

    try {
      const { error } = await supabase
        .from("members")
        .update(dbPayload)
        .eq("id", memberId);

      if (error) {
        console.error("Error updating member field in database:", error);
      }
    } catch (err) {
      console.error("Failed to update member field:", err);
    }
  };

  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!familyId) return;

    // Uniqueness checks
    if (newMember.status === "Berger") {
      const exists = data.find(m => m.status === "Berger" && m.id !== newMember.id);
      if (exists) {
        alert("Attention : Une famille ne peut avoir qu'un seul Berger.");
        return;
      }
    }
    if (newMember.status === "Second") {
      const exists = data.find(m => m.status === "Second" && m.id !== newMember.id);
      if (exists) {
        alert("Attention : Une famille ne peut avoir qu'un seul Second.");
        return;
      }
    }
    // Conseiller uniqueness check
    if (isConseillerChecked) {
      const existingConseiller = data.find(m => m.is_conseiller && m.id !== newMember.id);
      if (existingConseiller) {
        alert(`Attention : ${existingConseiller.firstName} ${existingConseiller.lastName} est déjà le Conseiller de cette bergerie. Retirez-lui ce rôle d'abord.`);
        return;
      }
    }

    const isEditing = !!newMember.id;

    let result;
    if (isEditing) {
      result = await supabase
        .from("members")
        .update({
          civility: newMember.civility,
          first_name: newMember.firstName,
          last_name: newMember.lastName,
          age: newMember.age,
          phone: newMember.phone,
          status: newMember.status,
          email: newMember.email,
          responsible: newMember.responsible,
          is_conseiller: isConseillerChecked,
          // New detailed fields
          date_entree: newMember.date_entree || new Date().toISOString().split('T')[0],
          date_anniversaire: newMember.date_anniversaire,
          adresse: newMember.adresse,
          profession: newMember.profession,
          etat_civil: newMember.etat_civil,
          a_enfants: newMember.a_enfants,
          nombre_enfants: newMember.a_enfants ? Number(newMember.nombre_enfants) : 0,
          est_baptise: newMember.est_baptise,
          formations: newMember.formations || [],
          est_star: newMember.est_star,
          departement_star: newMember.est_star ? newMember.departement_star : "Aucun",
          commentaire_star: !newMember.est_star ? newMember.commentaire_star : "",
          est_cdm: newMember.est_cdm,
          pilote_cdm: newMember.est_cdm ? newMember.pilote_cdm : "",
          commentaire_cdm: !newMember.est_cdm ? newMember.commentaire_cdm : "",
          commentaire_pcnc: newMember.commentaire_pcnc || ""
        })
        .eq("id", newMember.id)
        .select()
        .single();
    } else {
      result = await supabase
        .from("members")
        .insert({
          bergerie_id: familyId,
          civility: newMember.civility,
          first_name: newMember.firstName,
          last_name: newMember.lastName,
          age: newMember.age,
          phone: newMember.phone,
          status: newMember.status,
          email: newMember.email,
          responsible: newMember.responsible,
          is_conseiller: isConseillerChecked,
          attendance: {},
          // New detailed fields
          date_entree: newMember.date_entree || new Date().toISOString().split('T')[0],
          date_anniversaire: newMember.date_anniversaire,
          adresse: newMember.adresse,
          profession: newMember.profession,
          etat_civil: newMember.etat_civil || "Célibataire",
          a_enfants: newMember.a_enfants || false,
          nombre_enfants: newMember.a_enfants ? Number(newMember.nombre_enfants) : 0,
          est_baptise: newMember.est_baptise || false,
          formations: newMember.formations || [],
          est_star: newMember.est_star || false,
          departement_star: newMember.est_star ? newMember.departement_star : "Aucun",
          commentaire_star: !newMember.est_star ? newMember.commentaire_star : "",
          est_cdm: newMember.est_cdm || false,
          pilote_cdm: newMember.est_cdm ? newMember.pilote_cdm : "",
          commentaire_cdm: !newMember.est_cdm ? newMember.commentaire_cdm : "",
          commentaire_pcnc: newMember.commentaire_pcnc || ""
        })
        .select()
        .single();
    }

    const { data: inserted, error } = result;

    if (error) {
      alert("Erreur : " + error.message);
    } else if (inserted) {
      const m: M = {
        id: inserted.id,
        civility: inserted.civility,
        firstName: inserted.first_name,
        lastName: inserted.last_name,
        age: inserted.age,
        phone: inserted.phone,
        status: inserted.status,
        email: inserted.email || "",
        responsible: inserted.responsible,
        is_conseiller: inserted.is_conseiller || false,
        archived: inserted.archived || false,
        attendance: inserted.attendance || {},
        // New detailed fields
        date_entree: inserted.date_entree || "",
        date_anniversaire: inserted.date_anniversaire || "",
        adresse: inserted.adresse || "",
        profession: inserted.profession || "",
        etat_civil: inserted.etat_civil || "Célibataire",
        a_enfants: inserted.a_enfants || false,
        nombre_enfants: inserted.nombre_enfants || 0,
        est_baptise: inserted.est_baptise || false,
        formations: inserted.formations || [],
        est_star: inserted.est_star || false,
        departement_star: inserted.departement_star || "",
        commentaire_star: inserted.commentaire_star || "",
        est_cdm: inserted.est_cdm || false,
        pilote_cdm: inserted.pilote_cdm || "",
        commentaire_cdm: inserted.commentaire_cdm || "",
        commentaire_pcnc: inserted.commentaire_pcnc || ""
      };
      
      if (isEditing) {
        setData(prev => prev.map(item => item.id === m.id ? m : item));
      } else {
        setData([m, ...data]);
      }
      
      setIsAddModalOpen(false);
      setIsConseillerChecked(false);
      setNewMember({
        civility: "M.",
        firstName: "",
        lastName: "",
        age: "26-30 ans",
        phone: "",
        status: "Brebi",
        email: "",
        attendance: {},
        date_entree: new Date().toISOString().split('T')[0],
        date_anniversaire: "",
        adresse: "",
        profession: "",
        etat_civil: "Célibataire",
        a_enfants: false,
        nombre_enfants: 0,
        est_baptise: false,
        formations: [],
        est_star: false,
        departement_star: "",
        est_cdm: false,
        pilote_cdm: ""
      });
    }
  };

  const toggleAttendance = async (memberId: string, actId: string, date: string) => {
    if (userRole === "Brebi" || userRole === "brebi") return;
    
    const member = data.find(m => m.id === memberId);
    if (!member) return;

    const newAttendance = { ...member.attendance };
    if (!newAttendance[actId]) newAttendance[actId] = {};
    newAttendance[actId][date] = !newAttendance[actId][date];

    // Update locally
    setData(prev => prev.map(m => m.id === memberId ? { ...m, attendance: newAttendance } : m));

    // Update in DB
    const { error } = await supabase
      .from("members")
      .update({ attendance: newAttendance })
      .eq("id", memberId);

    if (error) {
      console.error("Error updating attendance:", error);
    }
  };

  const handleDeleteMember = async (id: string) => {
    if (!confirm("Voulez-vous déplacer ce membre dans la corbeille ?")) return;

    const { error } = await supabase
      .from("members")
      .update({ archived: true })
      .eq("id", id);

    if (error) {
      alert("Erreur lors de l'archivage : " + error.message);
    } else {
      setData(prev => prev.map(m => m.id === id ? { ...m, archived: true } : m));
    }
  };

  const handleRestoreMember = async (id: string) => {
    const { error } = await supabase
      .from("members")
      .update({ archived: false })
      .eq("id", id);

    if (error) {
      alert("Erreur lors de la restauration : " + error.message);
    } else {
      setData(prev => prev.map(m => m.id === id ? { ...m, archived: false } : m));
    }
  };

  const handlePermanentDelete = async (id: string) => {
    if (!confirm("⚠️ Suppression DÉFINITIVE. Cette action est irréversible. Continuer ?")) return;

    try {
      // 1. Fetch the member's details before deletion
      const { data: memberToDelete } = await supabase
        .from("members")
        .select("email, bergerie_id")
        .eq("id", id)
        .maybeSingle();

      if (memberToDelete?.email) {
        const memberEmail = memberToDelete.email.toLowerCase().trim();
        
        // 2. Fetch the corresponding profile in profiles to get their UUID
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, role, church_id")
          .eq("email", memberEmail)
          .maybeSingle();

        if (profile) {
          const profileId = profile.id;
          const role = (profile.role || "").toLowerCase().trim();
          const churchId = profile.church_id;
          let superiorId = null;

          // 3. Identify the superior ID
          if (role.startsWith("integration_")) {
            // Integration role: superior is 'integration_responsable' in the same church
            const { data: head } = await supabase
              .from("profiles")
              .select("id")
              .eq("church_id", churchId)
              .eq("role", "integration_responsable")
              .limit(1)
              .maybeSingle();
              
            if (head) {
              superiorId = head.id;
            } else {
              // Fallback to any admin
              const { data: admin } = await supabase
                .from("profiles")
                .select("id")
                .eq("church_id", churchId)
                .in("role", ["super_admin", "admin"])
                .limit(1)
                .maybeSingle();
              if (admin) superiorId = admin.id;
            }
          } else {
            // Family role: superior is the Berger of the family
            const { data: family } = await supabase
              .from("bergeries")
              .select("berger_id, church_id")
              .eq("id", memberToDelete.bergerie_id)
              .maybeSingle();

            if (family?.berger_id) {
              superiorId = family.berger_id;
            } else {
              // Fallback to any profile with 'berger' role in this family
              const { data: bProfile } = await supabase
                .from("profiles")
                .select("id")
                .eq("bergerie_id", memberToDelete.bergerie_id)
                .ilike("role", "%berger%")
                .limit(1)
                .maybeSingle();

              if (bProfile) {
                superiorId = bProfile.id;
              } else if (family?.church_id) {
                // Fallback to integration head of the church
                const { data: head } = await supabase
                  .from("profiles")
                  .select("id")
                  .eq("church_id", family.church_id)
                  .eq("role", "integration_responsable")
                  .limit(1)
                  .maybeSingle();
                if (head) superiorId = head.id;
              }
            }
          }

          // 4. Perform the reassignments if a superior was found
          if (superiorId && superiorId !== profileId) {
            // A. Update invites assignments
            await supabase
              .from("invites")
              .update({ assigned_to: superiorId })
              .eq("assigned_to", profileId);

            // B. Update evangelisations created_by
            await supabase
              .from("evangelisations")
              .update({ created_by: superiorId })
              .eq("created_by", profileId);
          }
        }
      }
    } catch (err) {
      console.error("Error reassigning assets on permanent delete:", err);
    }

    const { error } = await supabase
      .from("members")
      .delete()
      .eq("id", id);

    if (error) {
      alert("Erreur lors de la suppression : " + error.message);
    } else {
      setData(prev => prev.filter(m => m.id !== id));
    }
  };

  if (!mounted || loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", padding: 50 }}>
        <Loader2 className="animate-spin" size={32} style={{ color: "var(--gold)" }} />
      </div>
    );
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
      <div className="page-header">
        <div>
          <h2 className="page-title">{showCorbeille ? "Corbeille" : "Bergerie"}</h2>
          <p style={{ fontSize:12, color:"var(--muted)", marginTop:4 }}>
            {showCorbeille 
              ? `${archivedMembers.length} membre(s) archivé(s)`
              : hasActiveFilters || search
                ? `${filtered.length} membre(s) trouvé(s) sur ${activeMembers.length} fidèles`
                : `${activeMembers.length} membres actifs dans la bergerie`
            }
          </p>
        </div>
        {canManageMembers && (
          <div className="mobile-scroll-x" style={{ gap: 8 }}>
            {!showCorbeille && (
              <>
                <button className="btn btn-primary" onClick={() => setIsAddModalOpen(true)}>
                  <Plus size={14} /> Nouveau Membre
                </button>
              </>
            )}
            <button 
              className={`btn btn-trash-toggle ${showCorbeille ? 'active' : ''}`}
              onClick={() => setShowCorbeille(!showCorbeille)}
            >
              <Trash2 size={14} /> {showCorbeille ? "Quitter la Corbeille" : "Corbeille"}
              {!showCorbeille && archivedMembers.length > 0 && (
                <span style={{ background: "var(--red)", color: "#fff", borderRadius: 10, padding: "1px 7px", fontSize: 10, fontWeight: 700, marginLeft: 4 }}>
                  {archivedMembers.length}
                </span>
              )}
            </button>
          </div>
        )}
      </div>

      {/* External Conseiller Card */}
      {!showCorbeille && externalConseiller && (
        <div className="glass" style={{ padding: 14, display: "flex", alignItems: "center", justifyContent: "space-between", borderLeft: "3px solid var(--sky)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className="avatar" style={{ width: 34, height: 34, background: "rgba(91,168,224,0.15)", border: "1px solid var(--sky)", color: "var(--sky)" }}>
              {externalConseiller.firstName[0]}{externalConseiller.lastName[0]}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{externalConseiller.firstName} {externalConseiller.lastName}</div>
              <div style={{ fontSize: 10, color: "var(--sky)" }}>Conseiller externe</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontSize: 9, padding: "3px 8px", borderRadius: 4, background: "rgba(91,168,224,0.15)", color: "var(--sky)", fontWeight: 700 }}>EXTERNE</div>
            {canManageMembers && (
              <button className="btn-icon" style={{ color: "var(--red)", opacity: 0.6 }} onClick={() => handleDeleteMember(externalConseiller.id)}>
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>
      )}

      <div className="glass-compact affectations-filters" style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:10 }}>
        <div className="search-bar-container" style={{ display:"flex", gap:10, alignItems:"center", flex: 1 }}>
          <div style={{ position:"relative", flex: 1 }}>
            <Search size={18} style={{ position:"absolute", left: 14, top:"50%", transform:"translateY(-50%)", color:"rgba(255,255,255,0.35)" }} />
            <input className="input search-bar-premium" placeholder="Rechercher par nom/prénom..." value={search} onChange={(e)=>setSearch(e.target.value)} />
          </div>
          <button 
            type="button"
            onClick={() => setShowFiltersPanel(!showFiltersPanel)} 
            className="btn btn-outline"
            style={{ 
              height: 42, 
              padding: "0 16px", 
              fontSize: 12, 
              display: "flex", 
              alignItems: "center", 
              gap: 8,
              borderColor: showFiltersPanel || hasActiveFilters ? "var(--gold)" : "rgba(212,175,55,0.25)",
              background: showFiltersPanel ? "var(--gold-glow)" : "transparent",
              color: showFiltersPanel || hasActiveFilters ? "var(--gold)" : "var(--muted)",
            }}
          >
            <SlidersHorizontal size={14} />
            <span>Filtres</span>
            {hasActiveFilters && (
              <span style={{ 
                background: "var(--gold)", 
                color: "var(--bg)", 
                borderRadius: "50%", 
                width: 18, 
                height: 18, 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center", 
                fontSize: 10, 
                fontWeight: 700 
              }}>
                {activeFiltersCount}
              </span>
            )}
          </button>
        </div>
        
        <div style={{ display: "flex", gap: 6, alignItems: "center", background: "var(--surface-solid)", padding: "4px 6px", borderRadius: 10, border: "1px solid var(--border)" }}>
          <button 
            type="button"
            onClick={() => setView("list")} 
            style={{ 
              display: "flex", alignItems: "center", gap: 6,
              padding: "6px 12px", borderRadius: 8, border: "none", 
              background: view === "list" ? "var(--gold-glow)" : "transparent", 
              color: view === "list" ? "var(--gold)" : "var(--muted)", 
              fontSize: 12, fontWeight: view === "list" ? 700 : 500,
              cursor: "pointer", transition: "all 0.2s ease"
            }} 
            title="Vue Liste"
          >
            <List size={15} />
            <span>Liste</span>
          </button>

          <button 
            type="button"
            onClick={() => setView("grid")} 
            style={{ 
              display: "flex", alignItems: "center", gap: 6,
              padding: "6px 12px", borderRadius: 8, border: "none", 
              background: view === "grid" ? "var(--gold-glow)" : "transparent", 
              color: view === "grid" ? "var(--gold)" : "var(--muted)", 
              fontSize: 12, fontWeight: view === "grid" ? 700 : 500,
              cursor: "pointer", transition: "all 0.2s ease"
            }} 
            title="Vue Grille"
          >
            <Grid3X3 size={15} />
            <span>Grille</span>
          </button>

          <button 
            type="button"
            onClick={() => setView("table")} 
            style={{ 
              display: "flex", alignItems: "center", gap: 6,
              padding: "6px 12px", borderRadius: 8, border: "none", 
              background: view === "table" ? "var(--gold-glow)" : "transparent", 
              color: view === "table" ? "var(--gold)" : "var(--muted)", 
              fontSize: 12, fontWeight: view === "table" ? 700 : 500,
              cursor: "pointer", transition: "all 0.2s ease"
            }} 
            title="Vue Tableau"
          >
            <Table size={15} />
            <span>Tableau</span>
          </button>
        </div>
      </div>

      {showFiltersPanel && (
        <div className="glass-compact fade-in" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16, border: "1px solid rgba(212,175,55,0.15)", marginTop: -8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h4 style={{ fontSize: 11, color: "var(--gold)", textTransform: "uppercase", letterSpacing: 1, fontWeight: 700, margin: 0 }}>
              Filtres démographiques & engagement
            </h4>
            {hasActiveFilters && (
              <button 
                type="button" 
                onClick={() => {
                  setFilterBaptise("all");
                  setFilterPCNC("all");
                  setFilterEntreeMois("all");
                  setFilterAnnivMois("all");
                  setFilterStar("all");
                  setFilterCDM("all");
                  setFilterProfession("all");
                }}
                className="btn btn-ghost btn-sm"
                style={{ fontSize: 11, padding: "2px 8px", color: "var(--red)", border: "1px solid rgba(239,68,68,0.2)" }}
              >
                Réinitialiser les filtres
              </button>
            )}
          </div>
          
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(160px, 100%), 1fr))", gap: 12 }}>
            {/* 1. Baptisé */}
            <div>
              <label className="label" style={{ marginBottom: 4, fontSize: 10 }}>Baptisé(e)</label>
              <select className="input" value={filterBaptise} onChange={e => setFilterBaptise(e.target.value)} style={{ fontSize: 11, height: 36, padding: "0 8px" }}>
                <option value="all">Tous</option>
                <option value="yes">Oui</option>
                <option value="no">Non</option>
              </select>
            </div>

            {/* 2. P.C.N.C (formations) */}
            <div>
              <label className="label" style={{ marginBottom: 4, fontSize: 10 }}>P.C.N.C</label>
              <select className="input" value={filterPCNC} onChange={e => setFilterPCNC(e.target.value)} style={{ fontSize: 11, height: 36, padding: "0 8px" }}>
                <option value="all">Toutes</option>
                <option value="001">Classe 001</option>
                <option value="101">Classe 101</option>
                <option value="201">Classe 201</option>
                <option value="301">Classe 301</option>
                <option value="none">Aucune</option>
              </select>
            </div>

            {/* 3. Date d'entrée (juste le mois) */}
            <div>
              <label className="label" style={{ marginBottom: 4, fontSize: 10 }}>Mois d'entrée</label>
              <select className="input" value={filterEntreeMois} onChange={e => setFilterEntreeMois(e.target.value)} style={{ fontSize: 11, height: 36, padding: "0 8px" }}>
                <option value="all">Tous</option>
                {["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"].map((m, i) => (
                  <option key={i} value={String(i + 1).padStart(2, '0')}>{m}</option>
                ))}
              </select>
            </div>

            {/* 4. Anniversaire (juste le mois) */}
            <div>
              <label className="label" style={{ marginBottom: 4, fontSize: 10 }}>Mois d'anniv.</label>
              <select className="input" value={filterAnnivMois} onChange={e => setFilterAnnivMois(e.target.value)} style={{ fontSize: 11, height: 36, padding: "0 8px" }}>
                <option value="all">Tous</option>
                {["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"].map((m, i) => (
                  <option key={i} value={String(i + 1).padStart(2, '0')}>{m}</option>
                ))}
              </select>
            </div>

            {/* 5. S.T.A.R */}
            <div>
              <label className="label" style={{ marginBottom: 4, fontSize: 10 }}>S.T.A.R</label>
              <select className="input" value={filterStar} onChange={e => setFilterStar(e.target.value)} style={{ fontSize: 11, height: 36, padding: "0 8px" }}>
                <option value="all">Tous</option>
                <option value="yes">Oui</option>
                <option value="no">Non</option>
              </select>
            </div>

            {/* 6. C.D.M */}
            <div>
              <label className="label" style={{ marginBottom: 4, fontSize: 10 }}>Est dans une C.D.M</label>
              <select className="input" value={filterCDM} onChange={e => setFilterCDM(e.target.value)} style={{ fontSize: 11, height: 36, padding: "0 8px" }}>
                <option value="all">Tous</option>
                <option value="yes">Oui</option>
                <option value="no">Non</option>
              </select>
            </div>

            {/* 7. Profession */}
            <div>
              <label className="label" style={{ marginBottom: 4, fontSize: 10 }}>Profession</label>
              <select className="input" value={filterProfession} onChange={e => setFilterProfession(e.target.value)} style={{ fontSize: 11, height: 36, padding: "0 8px" }}>
                <option value="all">Toutes</option>
                {uniqueProfessions.map((p: string) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {view === "list" ? (
        <div className="glass-flush">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Civ.</th>
                  <th>Nom & Prénom</th>
                  <th>Statut</th>
                  <th className="hide-mobile">Âge</th>
                  <th className="hide-mobile">Téléphone</th>
                  <th>Engagement</th>
                  <th style={{ textAlign:"right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => {
                  const engagement = calculateEngagement(m);
                  const color = getEngagementColor(engagement);
                  const isMainLeader = m.status === "Berger" || m.status === "Second";
                  
                  return (
                    <tr key={m.id} className={isMainLeader ? "leader-row" : ""}>
                      <td style={{ color:"var(--muted)", fontSize:12 }}>{m.civility}</td>
                      <td>
                        <div style={{ fontWeight:600 }}>{m.firstName} {m.lastName}</div>
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <div className={`badge badge-${m.status.toLowerCase().replace(' ', '-')}`} style={{ fontSize: 9, minWidth: 80, justifyContent: "center" }}>
                            {m.status.toUpperCase()}
                          </div>
                          {m.is_conseiller && (
                            <div style={{ fontSize: 8, padding: "2px 6px", borderRadius: 4, background: "rgba(91,168,224,0.15)", color: "var(--sky)", fontWeight: 700, letterSpacing: 0.5 }}>CONSEILLER</div>
                          )}
                          <select 
                            value={m.status} 
                            onChange={(e) => updateStatus(m.id, e.target.value)}
                            disabled={!isLeader}
                            className="input"
                            style={{ 
                              width: "auto",
                              fontSize: 10, 
                              padding: "2px 4px", 
                              height: 24,
                              opacity: isLeader ? 1 : 0.6,
                              cursor: isLeader ? "pointer" : "default"
                            }}
                          >
                            {STATUS_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                        </div>
                      </td>
                      <td className="hide-mobile" style={{ color:"var(--muted)" }}>{m.age}</td>
                      <td className="hide-mobile" style={{ color:"var(--muted)", fontSize:12 }}>{m.phone}</td>
                      <td>
                        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                          <div className="progress" style={{ width:44 }}><div className="progress-fill" style={{ width:`${engagement}%`, background:color }} /></div>
                          <span style={{ color: color, fontWeight: 700, fontSize: 11, minWidth: 35, textAlign: "right" }}>{engagement}</span>
                          <span style={{ fontSize: 10, color: "var(--muted)" }}>%</span>
                        </div>
                      </td>
                      <td style={{ textAlign:"right" }}>
                        {canManageMembers && (
                          <div className="action-group" style={{ justifyContent: "flex-end" }}>
                            {showCorbeille ? (
                              <>
                                <button 
                                  className="btn-icon btn-icon-green" 
                                  onClick={() => handleRestoreMember(m.id)} 
                                  title="Restaurer"
                                >
                                  <RotateCcw size={14} />
                                </button>
                                <button 
                                  className="btn-icon btn-icon-red" 
                                  onClick={() => handlePermanentDelete(m.id)} 
                                  title="Supprimer définitivement"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </>
                            ) : (
                              <>
                                <button 
                                  className="btn-icon btn-icon-gold" 
                                  onClick={() => {
                                    setNewMember(m);
                                    setIsConseillerChecked(m.is_conseiller || false);
                                    setIsAddModalOpen(true);
                                  }}
                                  title="Modifier"
                                >
                                  <Pencil size={14} />
                                </button>
                                <button 
                                  className="btn-icon btn-icon-red" 
                                  onClick={() => handleDeleteMember(m.id)}
                                  title="Mettre à la corbeille"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : view === "grid" ? (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(min(220px, 100%), 1fr))", gap:10 }}>
          {filtered.map((m) => {
            const engagement = calculateEngagement(m);
            const color = getEngagementColor(engagement);
            const isMainLeader = m.status === "Berger" || m.status === "Second";

            return (
              <div key={m.id} className={`glass ${isMainLeader ? "leader-card" : ""}`} style={{ position:"relative" }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:14 }}>
                  <div className="avatar" style={{ background:color.replace(')', '-glow)'), border:`1px solid ${color}`, color:color, width:36, height:36 }}>{m.firstName[0]}{m.lastName[0]}</div>
                <div className="action-group">
                  {isLeader && (
                    <>
                      {showCorbeille ? (
                        <>
                          <button 
                            className="btn-icon btn-icon-green" 
                            onClick={() => handleRestoreMember(m.id)} 
                            title="Restaurer"
                          >
                            <RotateCcw size={14} />
                          </button>
                          <button 
                            className="btn-icon btn-icon-red" 
                            onClick={() => handlePermanentDelete(m.id)} 
                            title="Supprimer définitivement"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button 
                            className="btn-icon btn-icon-gold" 
                            onClick={() => {
                              setNewMember(m);
                              setIsConseillerChecked(m.is_conseiller || false);
                              setIsAddModalOpen(true);
                            }}
                            title="Modifier"
                          >
                            <Pencil size={14} />
                          </button>
                          <button 
                            className="btn-icon btn-icon-red" 
                            onClick={() => handleDeleteMember(m.id)}
                            title="Mettre à la corbeille"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </>
                  )}
                </div>
                </div>
                <div style={{ marginBottom:12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ fontWeight:700, fontSize:15 }}>{m.firstName} {m.lastName}</div>
                    <span className="badge badge-sky" style={{ fontSize: 9 }}>{m.status.toUpperCase()}</span>
                  </div>
                  <div style={{ fontSize:10, color:"var(--muted)", marginTop:2 }}>{m.civility} · {m.age} · {m.phone}</div>
                </div>
                <div className="progress progress-thick" style={{ marginBottom:6 }}>
                  <div className="progress-fill" style={{ width:`${engagement}%`, background:color }} />
                </div>
                <div style={{ display:"flex", justifyContent:"center", alignItems:"center" }}>
                  <span style={{ fontSize:10, color:color, fontWeight:600 }}>Engagement (Ce mois) : {engagement}%</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW WITH FULLSCREEN MODE, STICKY HEADERS & REAL-TIME EDITING */
        <div 
          ref={tableRef}
          className={`annual-table-desktop-only ${isTableFullscreen ? "presentation-mode" : ""}`}
          style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%" }}
        >
          {/* Header Bar */}
          <div className="glass" style={{ padding: "12px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid var(--border)", flexWrap: "wrap", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Table size={18} className="text-[var(--gold)]" />
                <span style={{ fontWeight: 700, fontSize: 15, color: "var(--cream)", whiteSpace: "nowrap" }}>
                  Tableau synthétique ({filtered.length})
                </span>
              </div>

              {/* Inline Search Bar for Table View */}
              <div style={{ position: "relative", minWidth: 220, maxWidth: 360, flex: 1 }}>
                <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
                <input 
                  className="input" 
                  placeholder="Rechercher nom, prénom, tél..." 
                  value={search} 
                  onChange={(e) => setSearch(e.target.value)} 
                  style={{ fontSize: 12, height: 36, paddingLeft: 34, paddingRight: search ? 30 : 10, background: "var(--surface-solid)", color: "var(--cream)", borderColor: "var(--border)", width: "100%" }}
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--muted)", cursor: "pointer" }}
                  >
                    <XCircle size={14} />
                  </button>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={toggleTableFullscreen}
              className="btn btn-outline btn-sm"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                height: 36,
                borderColor: isTableFullscreen ? "var(--red)" : "rgba(212, 175, 55, 0.3)",
                background: isTableFullscreen ? "rgba(239, 68, 68, 0.1)" : "rgba(212, 175, 55, 0.05)",
                color: isTableFullscreen ? "var(--red)" : "var(--gold)",
                fontSize: 12,
                fontWeight: 700
              }}
            >
              {isTableFullscreen ? (
                <>
                  <Minimize2 size={14} /> Quitter Plein Écran
                </>
              ) : (
                <>
                  <Maximize2 size={14} /> Mode Plein Écran
                </>
              )}
            </button>
          </div>

          {/* Table Container with Sticky Frozen Headers & First Column */}
          <div className="bergerie-table-container">
            <table className="bergerie-table">
              <thead>
                <tr>
                  <th style={{ minWidth: 220 }}>NOM & Prénom</th>
                  <th style={{ minWidth: 140 }}>Téléphone</th>

                  {/* Date d'entrée avec filtre mois */}
                  <th style={{ minWidth: 140 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                      <span>Date d'entrée</span>
                      <select
                        value={filterEntreeMois}
                        onChange={(e) => setFilterEntreeMois(e.target.value)}
                        style={{
                          fontSize: 10,
                          padding: "2px 4px",
                          borderRadius: 4,
                          background: filterEntreeMois !== "all" ? "var(--gold)" : "var(--card)",
                          color: filterEntreeMois !== "all" ? "var(--bg)" : "var(--gold)",
                          border: `1px solid ${filterEntreeMois !== "all" ? "var(--gold)" : "var(--border)"}`,
                          fontWeight: 700,
                          cursor: "pointer"
                        }}
                        title="Filtrer par mois d'entrée"
                      >
                        <option value="all" style={{ background: "var(--surface-solid)", color: "var(--cream)" }}>Mois (Tous)</option>
                        <option value="01" style={{ background: "var(--surface-solid)", color: "var(--cream)" }}>Janvier</option>
                        <option value="02" style={{ background: "var(--surface-solid)", color: "var(--cream)" }}>Février</option>
                        <option value="03" style={{ background: "var(--surface-solid)", color: "var(--cream)" }}>Mars</option>
                        <option value="04" style={{ background: "var(--surface-solid)", color: "var(--cream)" }}>Avril</option>
                        <option value="05" style={{ background: "var(--surface-solid)", color: "var(--cream)" }}>Mai</option>
                        <option value="06" style={{ background: "var(--surface-solid)", color: "var(--cream)" }}>Juin</option>
                        <option value="07" style={{ background: "var(--surface-solid)", color: "var(--cream)" }}>Juillet</option>
                        <option value="08" style={{ background: "var(--surface-solid)", color: "var(--cream)" }}>Août</option>
                        <option value="09" style={{ background: "var(--surface-solid)", color: "var(--cream)" }}>Septembre</option>
                        <option value="10" style={{ background: "var(--surface-solid)", color: "var(--cream)" }}>Octobre</option>
                        <option value="11" style={{ background: "var(--surface-solid)", color: "var(--cream)" }}>Novembre</option>
                        <option value="12" style={{ background: "var(--surface-solid)", color: "var(--cream)" }}>Décembre</option>
                      </select>
                    </div>
                  </th>

                  {/* Est Baptisé avec filtre Oui/Non */}
                  <th style={{ minWidth: 120 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                      <span>Est Baptisé</span>
                      <select
                        value={filterBaptise}
                        onChange={(e) => setFilterBaptise(e.target.value)}
                        style={{
                          fontSize: 10,
                          padding: "2px 4px",
                          borderRadius: 4,
                          background: filterBaptise !== "all" ? "var(--gold)" : "var(--card)",
                          color: filterBaptise !== "all" ? "var(--bg)" : "var(--gold)",
                          border: `1px solid ${filterBaptise !== "all" ? "var(--gold)" : "var(--border)"}`,
                          fontWeight: 700,
                          cursor: "pointer"
                        }}
                        title="Filtrer par Baptême"
                      >
                        <option value="all" style={{ background: "var(--surface-solid)", color: "var(--cream)" }}>Tous</option>
                        <option value="yes" style={{ background: "var(--surface-solid)", color: "var(--green)" }}>Oui</option>
                        <option value="no" style={{ background: "var(--surface-solid)", color: "var(--red)" }}>Non</option>
                      </select>
                    </div>
                  </th>

                  {/* Commentaire Baptême (Raison) */}
                  <th style={{ minWidth: 200 }}>Commentaire Baptême (Raison)</th>

                  {/* C.D.M avec filtre Oui/Non */}
                  <th style={{ minWidth: 110 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                      <span>C.D.M</span>
                      <select
                        value={filterCDM}
                        onChange={(e) => setFilterCDM(e.target.value)}
                        style={{
                          fontSize: 10,
                          padding: "2px 4px",
                          borderRadius: 4,
                          background: filterCDM !== "all" ? "var(--gold)" : "var(--card)",
                          color: filterCDM !== "all" ? "var(--bg)" : "var(--gold)",
                          border: `1px solid ${filterCDM !== "all" ? "var(--gold)" : "var(--border)"}`,
                          fontWeight: 700,
                          cursor: "pointer"
                        }}
                        title="Filtrer par C.D.M"
                      >
                        <option value="all" style={{ background: "var(--surface-solid)", color: "var(--cream)" }}>Tous</option>
                        <option value="yes" style={{ background: "var(--surface-solid)", color: "var(--green)" }}>Oui</option>
                        <option value="no" style={{ background: "var(--surface-solid)", color: "var(--red)" }}>Non</option>
                      </select>
                    </div>
                  </th>

                  {/* Pilote CDM avec filtre liste des pilotes */}
                  <th style={{ minWidth: 160 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                      <span>Pilote CDM</span>
                      <select
                        value={filterPilote}
                        onChange={(e) => setFilterPilote(e.target.value)}
                        style={{
                          fontSize: 10,
                          padding: "2px 4px",
                          borderRadius: 4,
                          background: filterPilote !== "all" ? "var(--gold)" : "var(--card)",
                          color: filterPilote !== "all" ? "var(--bg)" : "var(--gold)",
                          border: `1px solid ${filterPilote !== "all" ? "var(--gold)" : "var(--border)"}`,
                          fontWeight: 700,
                          cursor: "pointer"
                        }}
                        title="Filtrer par Pilote CDM"
                      >
                        <option value="all" style={{ background: "var(--surface-solid)", color: "var(--cream)" }}>Tous</option>
                        {uniquePilotes.map(p => (
                          <option key={p} value={p} style={{ background: "var(--surface-solid)", color: "var(--cream)" }}>{p}</option>
                        ))}
                      </select>
                    </div>
                  </th>

                  {/* Commentaire CDM (Raison) */}
                  <th style={{ minWidth: 200 }}>Commentaire CDM (Raison)</th>

                  {/* P.C.N.C avec filtre formations */}
                  <th style={{ minWidth: 180 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                      <span>P.C.N.C</span>
                      <select
                        value={filterPCNC}
                        onChange={(e) => setFilterPCNC(e.target.value)}
                        style={{
                          fontSize: 10,
                          padding: "2px 4px",
                          borderRadius: 4,
                          background: filterPCNC !== "all" ? "var(--gold)" : "var(--card)",
                          color: filterPCNC !== "all" ? "var(--bg)" : "var(--gold)",
                          border: `1px solid ${filterPCNC !== "all" ? "var(--gold)" : "var(--border)"}`,
                          fontWeight: 700,
                          cursor: "pointer"
                        }}
                        title="Filtrer par Formation PCNC"
                      >
                        <option value="all" style={{ background: "var(--surface-solid)", color: "var(--cream)" }}>Tous</option>
                        <option value="none" style={{ background: "var(--surface-solid)", color: "var(--orange)" }}>Aucune</option>
                        <option value="001" style={{ background: "var(--surface-solid)", color: "var(--cream)" }}>001</option>
                        <option value="101" style={{ background: "var(--surface-solid)", color: "var(--cream)" }}>101</option>
                        <option value="201" style={{ background: "var(--surface-solid)", color: "var(--cream)" }}>201</option>
                        <option value="301" style={{ background: "var(--surface-solid)", color: "var(--cream)" }}>301</option>
                      </select>
                    </div>
                  </th>

                  {/* Commentaire PCNC (Raison) */}
                  <th style={{ minWidth: 200 }}>Commentaire PCNC (Raison)</th>

                  {/* Est S.T.A.R avec filtre Oui/Non */}
                  <th style={{ minWidth: 120 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                      <span>Est S.T.A.R</span>
                      <select
                        value={filterStar}
                        onChange={(e) => setFilterStar(e.target.value)}
                        style={{
                          fontSize: 10,
                          padding: "2px 4px",
                          borderRadius: 4,
                          background: filterStar !== "all" ? "var(--gold)" : "var(--card)",
                          color: filterStar !== "all" ? "var(--bg)" : "var(--gold)",
                          border: `1px solid ${filterStar !== "all" ? "var(--gold)" : "var(--border)"}`,
                          fontWeight: 700,
                          cursor: "pointer"
                        }}
                        title="Filtrer par STAR"
                      >
                        <option value="all" style={{ background: "var(--surface-solid)", color: "var(--cream)" }}>Tous</option>
                        <option value="yes" style={{ background: "var(--surface-solid)", color: "var(--sky)" }}>Oui</option>
                        <option value="no" style={{ background: "var(--surface-solid)", color: "var(--red)" }}>Non</option>
                      </select>
                    </div>
                  </th>

                  {/* Département S.T.A.R avec filtre liste départements */}
                  <th style={{ minWidth: 160 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                      <span>Département S.T.A.R</span>
                      <select
                        value={filterDeptStar}
                        onChange={(e) => setFilterDeptStar(e.target.value)}
                        style={{
                          fontSize: 10,
                          padding: "2px 4px",
                          borderRadius: 4,
                          background: filterDeptStar !== "all" ? "var(--gold)" : "var(--card)",
                          color: filterDeptStar !== "all" ? "var(--bg)" : "var(--gold)",
                          border: `1px solid ${filterDeptStar !== "all" ? "var(--gold)" : "var(--border)"}`,
                          fontWeight: 700,
                          cursor: "pointer"
                        }}
                        title="Filtrer par Département STAR"
                      >
                        <option value="all" style={{ background: "var(--surface-solid)", color: "var(--cream)" }}>Tous</option>
                        {uniqueDeptStars.map(d => (
                          <option key={d} value={d} style={{ background: "var(--surface-solid)", color: "var(--cream)" }}>{d}</option>
                        ))}
                      </select>
                    </div>
                  </th>

                  {/* Commentaire S.T.A.R (Raison) */}
                  <th style={{ minWidth: 200 }}>Commentaire S.T.A.R (Raison)</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={13} style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>
                      Aucun membre trouvé dans cette famille.
                    </td>
                  </tr>
                ) : (
                  filtered.map((m) => {
                    const isReadOnly = !canManageMembers;
                    const hasNoFormations = !(m.formations && m.formations.length > 0);
                    const piloteDisplay = !m.est_cdm ? "Aucun" : (m.pilote_cdm || "Aucun");

                    return (
                      <tr key={m.id} className="table-row-hover">
                        {/* NOM & Prénom (Sticky First Column) */}
                        <td style={{ fontWeight: 700 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div className="avatar" style={{ width: 30, height: 30, fontSize: 11, background: "var(--card)", border: "1px solid var(--border)", color: "var(--cream)" }}>
                              {m.firstName[0]}{m.lastName[0]}
                            </div>
                            <div>
                              <span style={{ color: "var(--gold-light)" }}>{m.lastName.toUpperCase()}</span> {m.firstName}
                            </div>
                          </div>
                        </td>

                        {/* Numéro de téléphone */}
                        <td>
                          <input 
                            type="text" 
                            className="input" 
                            defaultValue={m.phone || ""}
                            disabled={isReadOnly}
                            onBlur={(e) => {
                              const val = handlePhoneChange(e.target.value);
                              if (val !== (m.phone || "")) {
                                updateMemberField(m.id, { phone: val });
                              }
                            }}
                            onKeyDown={handlePhoneKeyDown}
                            placeholder="Téléphone..."
                            style={{ fontSize: 12, height: 32, padding: "0 8px", background: "var(--surface-solid)", color: "var(--cream)", borderColor: "var(--border)" }}
                          />
                        </td>

                        {/* Date d'entrée */}
                        <td>
                          <input 
                            type="date" 
                            className="input" 
                            value={m.date_entree || ""}
                            disabled={isReadOnly}
                            onChange={(e) => updateMemberField(m.id, { date_entree: e.target.value })}
                            style={{ fontSize: 11, height: 32, padding: "0 6px", background: "var(--surface-solid)", color: "var(--cream)", borderColor: "var(--border)" }}
                          />
                        </td>

                        {/* Est Baptisé (oui/non) */}
                        <td style={{ textAlign: "center" }}>
                          <select
                            className="input"
                            value={m.est_baptise ? "yes" : "no"}
                            disabled={isReadOnly}
                            onChange={(e) => {
                              const isBaptise = e.target.value === "yes";
                              updateMemberField(m.id, { 
                                est_baptise: isBaptise,
                                commentaire_baptise: isBaptise ? "" : (m.commentaire_baptise || "")
                              });
                            }}
                            style={{ 
                              fontSize: 11, height: 32, padding: "0 6px", 
                              background: m.est_baptise ? "var(--green-glow)" : "var(--red-glow)", 
                              color: m.est_baptise ? "var(--green)" : "var(--red)",
                              borderColor: m.est_baptise ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)",
                              fontWeight: 700
                            }}
                          >
                            <option value="yes" style={{ background: "var(--surface-solid)", color: "var(--green)" }}>Oui</option>
                            <option value="no" style={{ background: "var(--surface-solid)", color: "var(--red)" }}>Non</option>
                          </select>
                        </td>

                        {/* Commentaire Baptême (Raison si pas baptisé) */}
                        <td>
                          <input 
                            type="text" 
                            className="input" 
                            defaultValue={m.est_baptise ? "- Baptisé(e) -" : (m.commentaire_baptise || "")}
                            key={`${m.id}-commentbaptise-${m.est_baptise}-${m.commentaire_baptise}`}
                            disabled={isReadOnly || m.est_baptise}
                            placeholder={!m.est_baptise ? "Raison non baptisé..." : "- Baptisé(e) -"}
                            onBlur={(e) => {
                              if (!m.est_baptise && e.target.value !== (m.commentaire_baptise || "")) {
                                updateMemberField(m.id, { commentaire_baptise: e.target.value });
                              }
                            }}
                            style={{ 
                              fontSize: 11, height: 32, padding: "0 8px", 
                              background: "var(--surface-solid)", 
                              color: "var(--cream)",
                              opacity: m.est_baptise ? 0.5 : 1,
                              borderColor: "var(--border)"
                            }}
                          />
                        </td>

                        {/* Cellule de maison (oui/non) */}
                        <td style={{ textAlign: "center" }}>
                          <select
                            className="input"
                            value={m.est_cdm ? "yes" : "no"}
                            disabled={isReadOnly}
                            onChange={(e) => {
                              const isCdm = e.target.value === "yes";
                              updateMemberField(m.id, { 
                                est_cdm: isCdm,
                                pilote_cdm: isCdm ? (m.pilote_cdm || "") : "",
                                commentaire_cdm: !isCdm ? (m.commentaire_cdm || "") : ""
                              });
                            }}
                            style={{ 
                              fontSize: 11, height: 32, padding: "0 6px", 
                              background: m.est_cdm ? "var(--green-glow)" : "var(--red-glow)", 
                              color: m.est_cdm ? "var(--green)" : "var(--red)",
                              borderColor: m.est_cdm ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)",
                              fontWeight: 700
                            }}
                          >
                            <option value="yes" style={{ background: "var(--surface-solid)", color: "var(--green)" }}>Oui</option>
                            <option value="no" style={{ background: "var(--surface-solid)", color: "var(--red)" }}>Non</option>
                          </select>
                        </td>

                        {/* Nom du pilote CDM */}
                        <td>
                          <input 
                            type="text" 
                            className="input" 
                            defaultValue={piloteDisplay}
                            key={`${m.id}-pilote-${m.est_cdm}-${m.pilote_cdm}`}
                            disabled={isReadOnly || !m.est_cdm}
                            placeholder={m.est_cdm ? "Nom du pilote..." : "Aucun"}
                            onBlur={(e) => {
                              if (m.est_cdm && e.target.value !== (m.pilote_cdm || "")) {
                                updateMemberField(m.id, { pilote_cdm: e.target.value === "Aucun" ? "" : e.target.value });
                              }
                            }}
                            style={{ 
                              fontSize: 12, height: 32, padding: "0 8px", 
                              background: "var(--surface-solid)", 
                              color: "var(--cream)",
                              opacity: !m.est_cdm ? 0.5 : 1,
                              borderColor: "var(--border)"
                            }}
                          />
                        </td>

                        {/* Commentaire CDM (Raison si pas en cellule) */}
                        <td>
                          <input 
                            type="text" 
                            className="input" 
                            defaultValue={m.est_cdm ? "- En cellule -" : (m.commentaire_cdm || "")}
                            key={`${m.id}-commentcdm-${m.est_cdm}-${m.commentaire_cdm}`}
                            disabled={isReadOnly || m.est_cdm}
                            placeholder={!m.est_cdm ? "Raison de non-appartenance..." : "- En cellule -"}
                            onBlur={(e) => {
                              if (!m.est_cdm && e.target.value !== (m.commentaire_cdm || "")) {
                                updateMemberField(m.id, { commentaire_cdm: e.target.value });
                              }
                            }}
                            style={{ 
                              fontSize: 11, height: 32, padding: "0 8px", 
                              background: "var(--surface-solid)", 
                              color: "var(--cream)",
                              opacity: m.est_cdm ? 0.5 : 1,
                              borderColor: "var(--border)"
                            }}
                          />
                        </td>

                        {/* P.C.N.C (001, 101, 201, 301) */}
                        <td style={{ textAlign: "center" }}>
                          <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                            {["001", "101", "201", "301"].map(cls => {
                              const isChecked = (m.formations || []).includes(cls);
                              return (
                                <button
                                  key={cls}
                                  type="button"
                                  disabled={isReadOnly}
                                  onClick={() => {
                                    const currentFormations = m.formations || [];
                                    const newFormations = isChecked
                                      ? currentFormations.filter(f => f !== cls)
                                      : [...currentFormations, cls];
                                    updateMemberField(m.id, { formations: newFormations });
                                  }}
                                  style={{
                                    padding: "3px 6px",
                                    borderRadius: 4,
                                    fontSize: 10,
                                    fontWeight: 700,
                                    cursor: isReadOnly ? "default" : "pointer",
                                    background: isChecked ? "var(--gold-glow)" : "var(--card)",
                                    border: `1px solid ${isChecked ? "var(--gold)" : "var(--border)"}`,
                                    color: isChecked ? "var(--gold-light)" : "var(--muted)",
                                    transition: "all 0.15s ease"
                                  }}
                                >
                                  {cls}
                                </button>
                              );
                            })}
                          </div>
                        </td>

                        {/* Commentaire PCNC (Raison si ne suit pas) */}
                        <td>
                          <input 
                            type="text" 
                            className="input" 
                            defaultValue={m.commentaire_pcnc || ""}
                            disabled={isReadOnly}
                            placeholder={hasNoFormations ? "Raison pas de PCNC..." : "Commentaire PCNC..."}
                            onBlur={(e) => {
                              if (e.target.value !== (m.commentaire_pcnc || "")) {
                                updateMemberField(m.id, { commentaire_pcnc: e.target.value });
                              }
                            }}
                            style={{ 
                              fontSize: 11, height: 32, padding: "0 8px", 
                              background: "var(--surface-solid)",
                              color: "var(--cream)",
                              borderColor: hasNoFormations && !m.commentaire_pcnc ? "var(--orange)" : "var(--border)"
                            }}
                          />
                        </td>

                        {/* Est S.T.A.R (oui/non) */}
                        <td style={{ textAlign: "center" }}>
                          <select
                            className="input"
                            value={m.est_star ? "yes" : "no"}
                            disabled={isReadOnly}
                            onChange={(e) => {
                              const isStar = e.target.value === "yes";
                              updateMemberField(m.id, { 
                                est_star: isStar,
                                departement_star: isStar ? (m.departement_star === "Aucun" ? "" : (m.departement_star || "")) : "Aucun",
                                commentaire_star: !isStar ? (m.commentaire_star || "") : ""
                              });
                            }}
                            style={{ 
                              fontSize: 11, height: 32, padding: "0 6px", 
                              background: m.est_star ? "var(--sky-glow)" : "var(--red-glow)", 
                              color: m.est_star ? "var(--sky)" : "var(--red)",
                              borderColor: m.est_star ? "rgba(56, 189, 248, 0.3)" : "rgba(239, 68, 68, 0.3)",
                              fontWeight: 700
                            }}
                          >
                            <option value="yes" style={{ background: "var(--surface-solid)", color: "var(--sky)" }}>Oui</option>
                            <option value="no" style={{ background: "var(--surface-solid)", color: "var(--red)" }}>Non</option>
                          </select>
                        </td>

                        {/* Département S.T.A.R */}
                        <td>
                          <input 
                            type="text" 
                            className="input" 
                            defaultValue={!m.est_star ? "Aucun" : (m.departement_star || "")}
                            key={`${m.id}-deptstar-${m.est_star}-${m.departement_star}`}
                            disabled={isReadOnly || !m.est_star}
                            placeholder={m.est_star ? "Nom du département..." : "Aucun"}
                            onBlur={(e) => {
                              if (m.est_star && e.target.value !== (m.departement_star || "")) {
                                updateMemberField(m.id, { departement_star: e.target.value });
                              }
                            }}
                            style={{ 
                              fontSize: 11, height: 32, padding: "0 8px", 
                              background: "var(--surface-solid)", 
                              color: "var(--cream)",
                              opacity: !m.est_star ? 0.5 : 1,
                              borderColor: "var(--border)"
                            }}
                          />
                        </td>

                        {/* Commentaire S.T.A.R (Raison si pas STAR) */}
                        <td>
                          <input 
                            type="text" 
                            className="input" 
                            defaultValue={m.est_star ? "- Membre STAR -" : (m.commentaire_star || "")}
                            key={`${m.id}-commentstar-${m.est_star}-${m.commentaire_star}`}
                            disabled={isReadOnly || m.est_star}
                            placeholder={!m.est_star ? "Raison non STAR..." : "- Membre STAR -"}
                            onBlur={(e) => {
                              if (!m.est_star && e.target.value !== (m.commentaire_star || "")) {
                                updateMemberField(m.id, { commentaire_star: e.target.value });
                              }
                            }}
                            style={{ 
                              fontSize: 11, height: 32, padding: "0 8px", 
                              background: "var(--surface-solid)", 
                              color: "var(--cream)",
                              opacity: m.est_star ? 0.5 : 1,
                              borderColor: "var(--border)"
                            }}
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {typeof window !== "undefined" && isAddModalOpen && createPortal(
        <div className="modal-overlay">
          <div className="custom-modal fade-in">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 25 }}>
              <h2 style={{ fontSize: 20, color: "var(--gold)" }}>{newMember.id ? "Modifier le Membre" : "Nouveau Membre"}</h2>
              <button onClick={() => setIsAddModalOpen(false)} className="btn-icon"><XCircle size={20} /></button>
            </div>
            
            <form onSubmit={handleSaveMember} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ borderBottom: "1px dashed rgba(212,175,55,0.15)", paddingBottom: 12, marginBottom: 4 }}>
                <h4 style={{ fontSize: 12, color: "var(--gold)", textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>1. Informations Personnelles</h4>
              </div>

              <div className="form-grid-3">
                <div>
                  <label className="label">Civilité</label>
                  <select className="input" value={newMember.civility} onChange={e => setNewMember({...newMember, civility: e.target.value})}>
                    <option value="M.">M.</option>
                    <option value="Mme.">Mme.</option>
                    <option value="Mlle.">Mlle.</option>
                  </select>
                </div>
                <div>
                  <label className="label">Prénom</label>
                  <input className="input" required value={newMember.firstName} onChange={e => setNewMember({...newMember, firstName: e.target.value})} placeholder="Prénom" />
                </div>
                <div>
                  <label className="label">Nom</label>
                  <input className="input" required value={newMember.lastName} onChange={e => setNewMember({...newMember, lastName: e.target.value})} placeholder="Nom" />
                </div>
              </div>

              <div className="form-grid-2">
                <div>
                  <label className="label">Téléphone</label>
                  <input 
                    className="input" 
                    value={newMember.phone} 
                    onKeyDown={handlePhoneKeyDown}
                    onChange={e => setNewMember({...newMember, phone: handlePhoneChange(e.target.value)})} 
                    placeholder="+32 470 12 34 56" 
                  />
                </div>
                <div>
                  <label className="label">Âge</label>
                  <select className="input" value={newMember.age} onChange={e => setNewMember({...newMember, age: e.target.value})}>
                    <option value="Moins de 18 ans">Moins de 18 ans</option>
                    <option value="18-25 ans">18-25 ans</option>
                    <option value="26-30 ans">26-30 ans</option>
                    <option value="31-35 ans">31-35 ans</option>
                    <option value="36-40 ans">36-40 ans</option>
                    <option value="41-45 ans">41-45 ans</option>
                    <option value="46-50 ans">46-50 ans</option>
                    <option value="Plus de 50 ans">Plus de 50 ans</option>
                  </select>
                </div>
              </div>

              <div className="form-grid-2">
                <div>
                  <label className="label">Profession</label>
                  <input className="input" value={newMember.profession || ""} onChange={e => setNewMember({...newMember, profession: e.target.value})} placeholder="Ex: Enseignant, Ingénieur..." />
                </div>
                <div>
                  <label className="label">Adresse de résidence</label>
                  <input className="input" value={newMember.adresse || ""} onChange={e => setNewMember({...newMember, adresse: e.target.value})} placeholder="12 rue de l'industrie 6040 jumet" />
                </div>
              </div>

              <div>
                <label className="label">Adresse E-mail (pour la connexion)</label>
                <input className="input" type="email" value={newMember.email} onChange={e => setNewMember({...newMember, email: e.target.value})} placeholder="membre@email.com" />
              </div>

              <div style={{ borderBottom: "1px dashed rgba(212,175,55,0.15)", paddingBottom: 12, marginTop: 10, marginBottom: 4 }}>
                <h4 style={{ fontSize: 12, color: "var(--gold)", textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>2. Vie de Famille & Profil Social</h4>
              </div>

              <div className="form-grid-2">
                <div>
                  <label className="label">État Civil</label>
                  <select className="input" value={newMember.etat_civil || "Célibataire"} onChange={e => setNewMember({...newMember, etat_civil: e.target.value})}>
                    <option value="Célibataire">Célibataire</option>
                    <option value="Marié(e)">Marié(e)</option>
                    <option value="En couple">En couple</option>
                    <option value="Séparé(e)">Séparé(e)</option>
                    <option value="Veuf(ve)">Veuf(ve)</option>
                    <option value="Divorcé(e)">Divorcé(e)</option>
                  </select>
                </div>
                <div>
                  <label className="label">Anniversaire (JJ/MM)</label>
                  <input 
                    className="input" 
                    value={newMember.date_anniversaire || ""} 
                    onChange={e => {
                      let val = e.target.value.replace(/[^0-9/]/g, "");
                      if (val.length === 2 && !val.includes("/")) {
                        val = val + "/";
                      }
                      if (val.length > 5) val = val.substring(0, 5);
                      setNewMember({...newMember, date_anniversaire: val});
                    }} 
                    placeholder="25/12" 
                  />
                </div>
              </div>

              <div className="form-grid-2" style={{ alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, height: 42 }}>
                  <input 
                    type="checkbox" 
                    id="aEnfants" 
                    checked={!!newMember.a_enfants} 
                    onChange={e => setNewMember({...newMember, a_enfants: e.target.checked})} 
                    style={{ width: 18, height: 18, accentColor: "var(--gold)", cursor: "pointer" }}
                  />
                  <label htmlFor="aEnfants" style={{ fontSize: 12, color: "var(--cream-dim)", cursor: "pointer", userSelect: "none" }}>
                    A des enfants
                  </label>
                </div>
                {newMember.a_enfants && (
                  <div>
                    <label className="label">Nombre d'enfants</label>
                    <input 
                      className="input" 
                      type="number" 
                      min="0" 
                      value={newMember.nombre_enfants || 0} 
                      onChange={e => setNewMember({...newMember, nombre_enfants: parseInt(e.target.value) || 0})} 
                    />
                  </div>
                )}
              </div>

              <div style={{ borderBottom: "1px dashed rgba(212,175,55,0.15)", paddingBottom: 12, marginTop: 10, marginBottom: 4 }}>
                <h4 style={{ fontSize: 12, color: "var(--gold)", textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>3. Église & Engagement</h4>
              </div>

              <div className="form-grid-2">
                <div>
                  <label className="label">Date d'entrée</label>
                  <input 
                    className="input" 
                    type="date" 
                    value={newMember.date_entree || new Date().toISOString().split('T')[0]} 
                    onChange={e => setNewMember({...newMember, date_entree: e.target.value})} 
                  />
                </div>
                <div>
                  <label className="label">Statut</label>
                  <select className="input" value={newMember.status} onChange={e => setNewMember({...newMember, status: e.target.value})}>
                    {STATUS_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
              </div>


              <div className="form-grid-2" style={{ alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, height: 42 }}>
                  <input 
                    type="checkbox" 
                    id="estBaptise" 
                    checked={!!newMember.est_baptise} 
                    onChange={e => setNewMember({...newMember, est_baptise: e.target.checked})} 
                    style={{ width: 18, height: 18, accentColor: "var(--gold)", cursor: "pointer" }}
                  />
                  <label htmlFor="estBaptise" style={{ fontSize: 12, color: "var(--cream-dim)", cursor: "pointer", userSelect: "none" }}>
                    Est baptisé(e) d'eau
                  </label>
                </div>
              </div>

              <div>
                <label className="label">P.C.N.C</label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                  {["001", "101", "201", "301"].map(f => {
                    const currentFormations = newMember.formations || [];
                    const isSelected = currentFormations.includes(f);
                    return (
                      <button
                        key={f}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setNewMember({...newMember, formations: currentFormations.filter(x => x !== f)});
                          } else {
                            setNewMember({...newMember, formations: [...currentFormations, f]});
                          }
                        }}
                        style={{
                          height: 32,
                          padding: "0 14px",
                          borderRadius: 8,
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: "pointer",
                          transition: "all 0.2s",
                          background: isSelected ? "var(--gold)" : "rgba(255,255,255,0.05)",
                          color: isSelected ? "var(--bg)" : "var(--muted)",
                          border: `1px solid ${isSelected ? "transparent" : "rgba(212,175,55,0.15)"}`
                        }}
                      >
                        Classe {f}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ background: "var(--surface)", padding: 12, borderRadius: 10, border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 12 }}>
                <div className="form-grid-2" style={{ alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, height: 42 }}>
                    <input 
                      type="checkbox" 
                      id="estStar" 
                      checked={!!newMember.est_star} 
                      onChange={e => setNewMember({...newMember, est_star: e.target.checked})} 
                      style={{ width: 18, height: 18, accentColor: "var(--gold)", cursor: "pointer" }}
                    />
                    <label htmlFor="estStar" style={{ fontSize: 12, color: "var(--cream-dim)", cursor: "pointer", userSelect: "none" }}>
                      Est S.T.A.R
                    </label>
                  </div>
                  {newMember.est_star && (
                    <div>
                      <label className="label">Département STAR</label>
                      <input 
                        className="input" 
                        required
                        value={newMember.departement_star || ""} 
                        onChange={e => setNewMember({...newMember, departement_star: e.target.value})} 
                        placeholder="Ex: Accueil, Multimédia..." 
                      />
                    </div>
                  )}
                </div>
              </div>

              <div style={{ background: "var(--surface)", padding: 12, borderRadius: 10, border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 12 }}>
                <div className="form-grid-2" style={{ alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, height: 42 }}>
                    <input 
                      type="checkbox" 
                      id="estCdm" 
                      checked={!!newMember.est_cdm} 
                      onChange={e => setNewMember({...newMember, est_cdm: e.target.checked})} 
                      style={{ width: 18, height: 18, accentColor: "var(--gold)", cursor: "pointer" }}
                    />
                    <label htmlFor="estCdm" style={{ fontSize: 12, color: "var(--cream-dim)", cursor: "pointer", userSelect: "none" }}>
                      Est dans une C.D.M
                    </label>
                  </div>
                  {newMember.est_cdm && (
                    <div>
                      <label className="label">Nom du pilote C.D.M</label>
                      <input 
                        className="input" 
                        required
                        value={newMember.pilote_cdm || ""} 
                        onChange={e => setNewMember({...newMember, pilote_cdm: e.target.value})} 
                        placeholder="Nom du pilote" 
                      />
                    </div>
                  )}
                </div>
              </div>

              <div style={{ marginTop: 8, display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
                <button type="button" className="btn btn-outline" onClick={() => setIsAddModalOpen(false)}>Annuler</button>
                <button type="submit" className="btn btn-primary">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Conseiller Assignment Modal */}
      {typeof window !== "undefined" && isConseillerModalOpen && createPortal(
        <div className="modal-overlay">
          <div className="custom-modal fade-in">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 25 }}>
              <h2 style={{ fontSize: 20, color: "var(--sky)" }}>Assigner un Conseiller</h2>
              <button onClick={() => setIsConseillerModalOpen(false)} className="btn-icon"><XCircle size={20} /></button>
            </div>

            {(() => {
              const currentConseiller = data.find(m => m.is_conseiller && !m.archived);
              if (currentConseiller) {
                return (
                  <div style={{ padding: 20, borderRadius: 10, background: "rgba(91,168,224,0.08)", border: "1px solid rgba(91,168,224,0.2)", marginBottom: 20 }}>
                    <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>Conseiller actuel :</p>
                    <p style={{ fontSize: 16, fontWeight: 700, color: "var(--sky)" }}>{currentConseiller.firstName} {currentConseiller.lastName}</p>
                    <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                      {currentConseiller.status === "Externe" ? "Conseiller externe (hors bergerie)" : `Membre de la bergerie — ${currentConseiller.status}`}
                    </p>
                    <button className="btn btn-outline" style={{ marginTop: 14, borderColor: "var(--red)", color: "var(--red)", fontSize: 11 }}
                      onClick={async () => {
                        if (!confirm("Retirer ce conseiller ?")) return;
                        const { error } = await supabase.from("members").update({ is_conseiller: false }).eq("id", currentConseiller.id);
                        if (error) { alert("Erreur : " + error.message); return; }
                        setData(prev => prev.map(m => m.id === currentConseiller.id ? { ...m, is_conseiller: false } : m).filter(m => m.status !== "Externe"));
                      }}
                    >Désassigner le conseiller</button>
                  </div>
                );
              }

              const potentialConseillers = data.filter(m => m.status === "Responsable" || m.status === "Second");

              return (
                <>
                  <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
                    <button className={`btn btn-sm ${conseillerSource === "existing" ? "btn-primary" : "btn-ghost"}`} style={{ flex: 1, height: 32, fontSize: 11 }} onClick={() => setConseillerSource("existing")}>Membre de la Bergerie</button>
                    <button className={`btn btn-sm ${conseillerSource === "new" ? "btn-primary" : "btn-ghost"}`} style={{ flex: 1, height: 32, fontSize: 11 }} onClick={() => setConseillerSource("new")}>Conseiller Externe</button>
                  </div>

                  {conseillerSource === "existing" ? (
                    <div>
                      {potentialConseillers.length === 0 ? (
                        <p style={{ fontSize: 13, color: "var(--muted)", textAlign: "center", padding: "20px 0" }}>Aucun Responsable ou Second disponible dans la bergerie.</p>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
                          <label className="label">SÉLECTIONNER UN MEMBRE ACTIF</label>
                          <select className="input" value={selectedConseillerId} onChange={e => setSelectedConseillerId(e.target.value)}>
                            <option value="">-- Choisir --</option>
                            {potentialConseillers.map(c => (
                              <option key={c.id} value={c.id}>{c.firstName} {c.lastName} ({c.status})</option>
                            ))}
                          </select>
                        </div>
                      )}
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                        <button className="btn btn-outline" onClick={() => setIsConseillerModalOpen(false)}>Annuler</button>
                        <button className="btn btn-primary" style={{ background: "var(--sky)" }} disabled={!selectedConseillerId}
                          onClick={async () => {
                            if (!selectedConseillerId) return;
                            const { error } = await supabase.from("members").update({ is_conseiller: true }).eq("id", selectedConseillerId);
                            if (error) { alert("Erreur : " + error.message); return; }
                            setData(prev => prev.map(m => m.id === selectedConseillerId ? { ...m, is_conseiller: true } : m));
                            setIsConseillerModalOpen(false);
                            setSelectedConseillerId("");
                          }}
                        >Assigner</button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p style={{ fontSize: 11, color: "var(--sky)", marginBottom: 14, fontWeight: 600 }}>
                        Le conseiller externe ne fait pas partie de la bergerie et ne sera pas compté dans les membres.
                      </p>
                      <div className="form-grid-3" style={{ marginBottom: 12 }}>
                        <div>
                          <label className="label">CIV.</label>
                          <select className="input" value={newMember.civility} onChange={e => setNewMember({...newMember, civility: e.target.value})}>
                            <option value="M.">M.</option>
                            <option value="Mme.">Mme.</option>
                          </select>
                        </div>
                        <div>
                          <label className="label">PRÉNOM</label>
                          <input className="input" value={newMember.firstName} onChange={e => setNewMember({...newMember, firstName: e.target.value})} placeholder="Prénom" />
                        </div>
                        <div>
                          <label className="label">NOM</label>
                          <input className="input" value={newMember.lastName} onChange={e => setNewMember({...newMember, lastName: e.target.value})} placeholder="Nom" />
                        </div>
                      </div>
                      <div className="form-grid-2" style={{ marginBottom: 12 }}>
                        <div>
                           <label className="label">TÉLÉPHONE</label>
                           <input 
                             className="input" 
                             value={newMember.phone} 
                             onKeyDown={handlePhoneKeyDown}
                             onChange={e => setNewMember({...newMember, phone: handlePhoneChange(e.target.value)})} 
                             placeholder="+32 470 12 34 56" 
                           />
                        </div>
                        <div>
                          <label className="label">E-MAIL</label>
                          <input className="input" type="email" value={newMember.email} onChange={e => setNewMember({...newMember, email: e.target.value})} placeholder="email@..." />
                        </div>
                      </div>
                      <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end", gap: 10 }}>
                        <button className="btn btn-outline" onClick={() => setIsConseillerModalOpen(false)}>Annuler</button>
                        <button className="btn btn-primary" style={{ background: "var(--sky)" }}
                          onClick={async () => {
                            if (!newMember.firstName || !newMember.lastName) { alert("Veuillez remplir le nom et prénom."); return; }
                            if (!familyId) return;
                            const { data: inserted, error } = await supabase.from("members").insert({
                              bergerie_id: familyId,
                              civility: newMember.civility,
                              first_name: newMember.firstName,
                              last_name: newMember.lastName,
                              age: "26-30 ans",
                              phone: newMember.phone,
                              email: newMember.email,
                              status: "Externe",
                              is_conseiller: true,
                              attendance: {}
                            }).select().single();
                            if (error) { alert("Erreur : " + error.message); return; }
                            if (inserted) {
                              setData(prev => [...prev, {
                                id: inserted.id, civility: inserted.civility,
                                firstName: inserted.first_name, lastName: inserted.last_name,
                                age: inserted.age, phone: inserted.phone, status: inserted.status,
                                email: inserted.email || "", is_conseiller: true, archived: false,
                                attendance: {}
                              }]);
                            }
                            setIsConseillerModalOpen(false);
                            setNewMember({ civility: "M.", firstName: "", lastName: "", age: "26-30 ans", phone: "", status: "Brebi", email: "", attendance: {} });
                          }}
                        >Ajouter le conseiller externe</button>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>,
        document.body
      )}

      <style jsx>{`
        .modal-overlay {
          position: fixed; top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.8); backdrop-filter: blur(8px);
          z-index: 1000; display: flex; align-items: center; justify-content: center;
          padding: 20px;
        }
        .custom-modal {
          background: rgba(18, 12, 38, 0.85) !important;
          backdrop-filter: blur(16px) !important;
          -webkit-backdrop-filter: blur(16px) !important;
          border: 1px solid var(--gold) !important;
          border-radius: 16px !important;
          padding: 30px !important;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6) !important;
          width: 100% !important;
          max-width: 500px !important;
          max-height: 85vh !important;
          overflow-y: auto !important;
          position: relative !important;
          z-index: 1001 !important;
        }
        .label {
          font-size: 11px; color: var(--muted); display: block; margin-bottom: 6px;
          text-transform: uppercase; letter-spacing: 0.5px;
        }
        .leader-row {
          background: rgba(212, 160, 60, 0.05) !important;
        }
        .leader-row td {
          border-bottom: 1px solid rgba(212, 160, 60, 0.2) !important;
        }
        .leader-card {
          border: 1px solid var(--gold) !important;
          background: linear-gradient(145deg, rgba(212, 160, 60, 0.1), rgba(0, 0, 0, 0.4)) !important;
          box-shadow: 0 8px 32px rgba(212, 160, 60, 0.1) !important;
        }

        .bergerie-table-container {
          width: 100%;
          max-height: clamp(450px, 70vh, 750px);
          overflow: auto;
          border-radius: 12px;
          border: 1px solid var(--border);
          background: var(--surface-solid);
          position: relative;
        }
        .bergerie-table-container::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .bergerie-table-container::-webkit-scrollbar-track {
          background: rgba(212, 175, 55, 0.02);
          border-radius: 4px;
        }
        .bergerie-table-container::-webkit-scrollbar-thumb {
          background: rgba(212, 175, 55, 0.15);
          border-radius: 4px;
        }
        .bergerie-table-container::-webkit-scrollbar-thumb:hover {
          background: rgba(212, 175, 55, 0.3);
        }
        .bergerie-table {
          border-collapse: separate;
          border-spacing: 0;
          width: max-content;
          min-width: 100%;
        }
        .bergerie-table th {
          position: sticky;
          top: 0;
          z-index: 80;
          background: var(--surface-solid) !important;
          color: var(--gold);
          font-weight: 700;
          text-align: left;
          padding: 12px 14px;
          border-bottom: 2px solid rgba(212, 175, 55, 0.25);
          border-right: 1px solid rgba(212, 175, 55, 0.08);
          font-size: 11px;
        }
        .bergerie-table tbody td:first-child,
        .bergerie-table thead tr th:first-child {
          position: sticky;
          left: 0;
          z-index: 90;
          background: var(--surface-solid) !important;
          border-right: 2.5px solid rgba(212, 175, 55, 0.25);
          width: 220px;
          min-width: 220px;
          max-width: 220px;
        }
        .bergerie-table thead tr th:first-child {
          z-index: 100;
          top: 0;
          left: 0;
          background: var(--surface-solid) !important;
        }
        .bergerie-table td {
          padding: 10px 12px;
          border-bottom: 1px solid rgba(212, 175, 55, 0.08);
          border-right: 1px solid rgba(212, 175, 55, 0.08);
          background: var(--bg-deep);
          color: var(--cream);
          transition: background-color 0.2s;
        }
        .bergerie-table tr:hover td {
          background-color: rgba(212, 175, 55, 0.04) !important;
        }
        .bergerie-table tr:hover td:first-child {
          background-color: var(--surface-solid) !important;
        }

        .presentation-mode {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          width: 100vw !important;
          height: 100vh !important;
          z-index: 9999 !important;
          background: var(--bg) !important;
          padding: 30px !important;
          margin: 0 !important;
          box-sizing: border-box !important;
          display: flex !important;
          flex-direction: column !important;
          gap: 20px !important;
        }
        .presentation-mode .bergerie-table-container {
          flex: 1 !important;
          max-height: none !important;
          min-height: 0 !important;
        }
      `}</style>
    </div>
  );
}
