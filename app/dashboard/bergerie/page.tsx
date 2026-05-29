"use client";

import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { 
  Search, Plus, Grid3X3, List, UserMinus, UserPlus, 
  ChevronDown, ChevronUp, XCircle, Loader2, Pencil, Eye,
  Trash2, Trash, RotateCcw, Archive
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { autoAddLeaderToMembers } from "@/app/actions/auth";


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
  est_cdm?: boolean;
  pilote_cdm?: string;
}

interface Activity {
  id: string;
  name: string;
  day: number;
  startTime: string;
  endTime: string;
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
  const [activities] = useState<Activity[]>(INITIAL_ACTIVITIES);
  const [mounted, setMounted] = useState(false);
  
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"list"|"grid">(() =>
    typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches ? "grid" : "list"
  );
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
      const userInfoStr = localStorage.getItem("poimen_user_info");
      if (userInfoStr) {
        const parsed = JSON.parse(userInfoStr);
        setUserRole(parsed.role);
        setUserName(`${parsed.firstName} ${parsed.lastName}`);
        setUserEmail(parsed.email?.toLowerCase());
      }
      const fam = localStorage.getItem("selected_family");
      if (fam) {
        const parsedFam = JSON.parse(fam);
        setFamilyId(parsedFam.id);
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
        est_cdm: m.est_cdm || false,
        pilote_cdm: m.pilote_cdm || ""
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
  const getDaysOfPeriod = (year: number, month: number | null, dayOfWeek: number) => {
    const dates = [];
    let start = new Date(year, month !== null ? month : 0, 1);
    let end = new Date(year, month !== null ? month + 1 : 12, 0);
    
    let d = new Date(start);
    while (d <= end) {
      if (d.getDay() === dayOfWeek) {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        dates.push(`${yyyy}-${mm}-${dd}`);
      }
      d.setDate(d.getDate() + 1);
    }
    return dates;
  };

  const calculateEngagement = (member: M) => {
    let totalPossible = 0;
    let totalPresent = 0;
    const now = new Date();
    
    activities.forEach(act => {
      const dates = getDaysOfPeriod(now.getFullYear(), now.getMonth(), act.day);
      totalPossible += dates.length;
      totalPresent += dates.filter(d => member.attendance[act.id]?.[d]).length;
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

  const hasActiveFilters = 
    filterBaptise !== "all" ||
    filterPCNC !== "all" ||
    filterEntreeMois !== "all" ||
    filterAnnivMois !== "all" ||
    filterStar !== "all" ||
    filterCDM !== "all" ||
    filterProfession !== "all";

  const activeFiltersCount = [
    filterBaptise !== "all",
    filterPCNC !== "all",
    filterEntreeMois !== "all",
    filterAnnivMois !== "all",
    filterStar !== "all",
    filterCDM !== "all",
    filterProfession !== "all"
  ].filter(Boolean).length;




  const filtered = (showCorbeille ? archivedMembers : activeMembers).filter((m) => {
    // Recherche textuelle d'abord
    const full = `${m.firstName} ${m.lastName}`.toLowerCase();
    if (search && !full.includes(search.toLowerCase())) return false;

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

    return true;
  }).sort((a, b) => {
    const roles = { "Berger": 1, "Second": 2, "Responsable": 3, "Brebi": 4 };
    return (roles[a.status as keyof typeof roles] || 9) - (roles[b.status as keyof typeof roles] || 9);
  });

  const updateStatus = async (id: string, newStatus: string) => {
    if (userRole === "Brebi" || userRole === "brebi") return;
    
    setData(prev => prev.map(m => m.id === id ? { ...m, status: newStatus } : m));
    
    await supabase.from("members").update({ status: newStatus }).eq("id", id);
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
          departement_star: newMember.est_star ? newMember.departement_star : "",
          est_cdm: newMember.est_cdm,
          pilote_cdm: newMember.est_cdm ? newMember.pilote_cdm : ""
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
          departement_star: newMember.est_star ? newMember.departement_star : "",
          est_cdm: newMember.est_cdm || false,
          pilote_cdm: newMember.est_cdm ? newMember.pilote_cdm : ""
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
        est_cdm: inserted.est_cdm || false,
        pilote_cdm: inserted.pilote_cdm || ""
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
              className="btn btn-outline" 
              style={showCorbeille ? { background: "var(--red)", borderColor: "var(--red)", color: "white" } : { borderColor: "rgba(239,68,68,0.4)", color: "var(--red)" }}
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
        <div style={{ display:"flex", gap:10, alignItems:"center", flex: 1, minWidth: 0 }}>
          <div style={{ position:"relative", flex: 1, minWidth: 0 }}>
            <Search size={18} style={{ position:"absolute", left: 14, top:"50%", transform:"translateY(-50%)", color:"rgba(255,255,255,0.35)" }} />
            <input className="input search-bar-premium" placeholder="Rechercher par nom/prénom..." value={search} onChange={(e)=>setSearch(e.target.value)} style={{ paddingLeft: 42 }} />
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
            <Search size={13} />
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
        
        <div style={{ display:"flex", border:"1px solid var(--border)", borderRadius:6, overflow:"hidden" }}>
          <button onClick={()=>setView("list")} className="btn-icon" style={{ padding:"6px 10px", background:view==="list"?"var(--gold-glow)":"transparent", border:"none", color:view==="list"?"var(--gold)":"var(--muted)", cursor:"pointer" }}><List size={14} /></button>
          <button onClick={()=>setView("grid")} className="btn-icon" style={{ padding:"6px 10px", background:view==="grid"?"var(--gold-glow)":"transparent", border:"none", color:view==="grid"?"var(--gold)":"var(--muted)", cursor:"pointer" }}><Grid3X3 size={14} /></button>
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
                        <div style={{ fontWeight:600 }}>{m.lastName} {m.firstName}</div>
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
      ) : (
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
                    <div style={{ fontWeight:700, fontSize:15 }}>{m.lastName} {m.firstName}</div>
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

              <div style={{ background: "rgba(255,255,255,0.02)", padding: 12, borderRadius: 10, border: "1px solid rgba(212,175,55,0.1)", display: "flex", flexDirection: "column", gap: 12 }}>
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

              <div style={{ background: "rgba(255,255,255,0.02)", padding: 12, borderRadius: 10, border: "1px solid rgba(212,175,55,0.1)", display: "flex", flexDirection: "column", gap: 12 }}>
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
      `}</style>
    </div>
  );
}

