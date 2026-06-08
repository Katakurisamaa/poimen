"use client";

import { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { 
  Search, Plus, UserPlus, Filter, CheckCircle2, XCircle, X, 
  Calendar, MapPin, Mail, Phone, User as UserIcon,
  ChevronDown, ChevronUp, MoreHorizontal, Loader2, ListChecks, BarChart3
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { autoAddLeaderToMembers, listIntegrationTeam } from "@/app/actions/auth";
import { getActiveContext, getActiveUserInfo } from "@/lib/client-session";


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
}

const MOCK_RESPONSIBLES = ["Non assigné"];
const STATUS_OPTIONS = ["Brebi", "Responsable", "Berger", "Second"];

export default function AffectationPage() {
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingGuestId, setEditingGuestId] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [currentView, setCurrentView] = useState<'list' | 'stats'>('list');
  const [arrivalMonth, setArrivalMonth] = useState<string>("all");
  const [arrivalYear, setArrivalYear] = useState<string>("all");
  const [localChurchFilter, setLocalChurchFilter] = useState<string>("all");
  const [userRole, setUserRole] = useState<string | null>(null);
  const userRoleClean = useMemo(() => (userRole || "").toLowerCase().trim(), [userRole]);
  const [userName, setUserName] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [churchId, setChurchId] = useState<string | null>(null);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [responsibles, setResponsibles] = useState<string[]>(["Non assigné"]);
  const [isConseiller, setIsConseiller] = useState(false);
  const [counselors, setCounselors] = useState<{ id: string; display_name: string; email: string }[]>([]);
  const [activeBergeries, setActiveBergeries] = useState<{ id: string; name: string }[]>([]);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferringGuest, setTransferringGuest] = useState<Guest | null>(null);
  const [selectedBergerieId, setSelectedBergerieId] = useState<string>("");
  const [isTransferring, setIsTransferring] = useState(false);

  const isAuthorizedLeader = useMemo(() => {
    const role = userRoleClean;
    return (
      role === "berger" ||
      role.includes("second") ||
      role.includes("responsable") ||
      role.includes("coordonnateur")
    );
  }, [userRoleClean]);

  const canCreateOrDeleteInvites = useMemo(() => {
    const role = userRoleClean;
    const isIntegrationLeader = role === "integration_responsable" || role === "integration_second";
    return isIntegrationLeader;
  }, [userRoleClean]);

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
      .select("first_name, last_name, status, email")
      .eq("bergerie_id", familyId);
    
    if (!error && data) {
      const userInfo = getActiveUserInfo() || JSON.parse(localStorage.getItem("poimen_user_info") || "{}");
      const userEmail = userInfo.email?.toLowerCase();
      const userRoleVal = (userInfo.role || "").toLowerCase();
      const isLeader = userRoleVal.includes("berger") || userRoleVal.includes("second") || userRoleVal.includes("responsable");
      
      const me = data.find(m => m.email?.toLowerCase() === userEmail);
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
        const s = (m.status || "").toLowerCase();
        return s.includes("berger") || s.includes("second") || s.includes("responsable");
      });
      const names = leaders.map(m => `${m.first_name} ${m.last_name}`);
      setResponsibles(["Non assigné", ...names]);
    }
  };

  const fetchGuests = async () => {
    setLoading(true);
    let query = supabase.from("invites").select("*");
    
    if (isIntegrationOrCounselor) {
      if (churchId && userId) {
        query = query.eq("church_id", churchId).eq("assigned_to", userId);
      } else {
        setGuests([]);
        setLoading(false);
        return;
      }
    } else {
      if (familyId && userName) {
        query = query.eq("bergerie_id", familyId).eq("responsible", userName);
      } else {
        setGuests([]);
        setLoading(false);
        return;
      }
    }

    const { data: dbGuests, error } = await query.order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching guests:", error);
    } else {
      const mapped: Guest[] = (dbGuests || []).map(g => ({
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
        archived: g.archived || false,
        famille_disciple: g.famille_disciple || "AUCUNE",
        etatCivil: g.etat_civil || "Célibataire",
        souhaiteEtreContacte: g.souhaite_etre_contacte !== false
      }));
      setGuests(mapped);
    }
    setLoading(false);
  };

  const handleUpdateAssignment = async (guestId: string, newResponsible: string) => {
    const { error } = await supabase
      .from("invites")
      .update({ responsible: newResponsible })
      .eq("id", guestId);
    
    if (error) {
      alert("Erreur lors de l'affectation : " + error.message);
    } else {
      fetchGuests();
    }
  };

  const handleSelfAssign = async (guestId: string) => {
    if (isIntegrationOrCounselor) {
      if (userId) {
        const { error } = await supabase
          .from("invites")
          .update({ assigned_to: userId })
          .eq("id", guestId);
        if (error) {
          alert("Erreur lors de l'affectation : " + error.message);
        } else {
          setGuests(prev => prev.map(g => g.id === guestId ? { ...g, assigned_to: userId } : g));
        }
      }
    } else {
      if (userName) {
        const { error } = await supabase
          .from("invites")
          .update({ responsible: userName })
          .eq("id", guestId);
        if (error) {
          alert("Erreur lors de l'affectation : " + error.message);
        } else {
          setGuests(prev => prev.map(g => g.id === guestId ? { ...g, responsible: userName } : g));
        }
      }
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
  };

  const handleSaveGuest = async (e: React.FormEvent) => {
    e.preventDefault();
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
      dans_famille_disciple: newGuest.dansFamilleDisciple,
      interet_bapteme: newGuest.interetBapteme,
      commentaire: newGuest.commentaire,
      commentaire_suivi: newGuest.commentaireSuivi || "",
      famille_disciple: newGuest.famille_disciple || "AUCUNE",
      etat_civil: newGuest.etatCivil || "Célibataire",
      souhaite_etre_contacte: newGuest.souhaiteEtreContacte !== false
    };

    if (isIntegrationOrCounselor) {
      payload.church_id = churchId;
      payload.bergerie_id = null;
      if (!editingGuestId) {
        payload.assigned_to = userId; // Auto-assign to current counselor on creation
      }
    } else {
      payload.bergerie_id = familyId;
    }

    if (editingGuestId) {
      const { error } = await supabase
        .from("invites")
        .update(payload)
        .eq("id", editingGuestId);

      if (error) {
        alert("Erreur lors de la modification : " + error.message);
      } else {
        fetchGuests();
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
        alert("Erreur lors de l'ajout : " + error.message);
      } else if (inserted) {
        fetchGuests();
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
  };

  const handleDeleteGuest = async (guestId: string) => {
    const guest = guests.find(g => g.id === guestId);
    const isFamilyRole = !isIntegrationOrCounselor && userRoleClean !== "super_admin";
    
    if (isFamilyRole && guest && guest.church_id) {
      if (!window.confirm("Voulez-vous vraiment retirer cet invité de votre Famille ? Il restera disponible pour l'Intégration.")) return;
      
      const { error } = await supabase
        .from("invites")
        .update({
          bergerie_id: null,
          dans_famille_disciple: false,
          responsible: "Non assigné"
        })
        .eq("id", guestId);
        
      if (error) {
        alert("Erreur lors du retrait : " + error.message);
      } else {
        fetchGuests();
      }
    } else {
      if (!window.confirm("Voulez-vous vraiment supprimer définitivement cet invité ? Cette action est irréversible.")) return;
      
      const { error } = await supabase
        .from("invites")
        .delete()
        .eq("id", guestId);
        
      if (error) {
        alert("Erreur lors de la suppression : " + error.message);
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

      alert(`L'invité ${transferringGuest.firstName} ${transferringGuest.lastName} a été confié avec succès !`);
      setIsTransferModalOpen(false);
      setTransferringGuest(null);
      setSelectedBergerieId("");
      fetchGuests();
    } catch (err: any) {
      console.error("Error transferring guest:", err);
      alert("Erreur lors de l'opération : " + err.message);
    } finally {
      setIsTransferring(false);
    }
  };

  const promoteToMember = async (guest: Guest) => {
    if (!guest.bergerie_id) return;
    
    if (!window.confirm(`Voulez-vous vraiment transformer ${guest.firstName} ${guest.lastName} en membre de la Bergerie ?`)) return;

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
      alert(`${guest.firstName} a été ajouté à la Bergerie avec succès !`);
    } catch (err: any) {
      console.error("Promotion error:", err);
      alert("Erreur lors de l'ajout à la bergerie : " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const removeFromMember = async (guest: Guest) => {
    if (!guest.bergerie_id) return;
    
    if (!window.confirm(`Voulez-vous vraiment retirer ${guest.firstName} ${guest.lastName} de la Bergerie ?`)) return;

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
      alert(`${guest.firstName} a été retiré de la Bergerie.`);
    } catch (err: any) {
      console.error("Removal error:", err);
      alert("Erreur lors du retrait : " + err.message);
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

  const calculateRate = (guest: Guest, dates: string[]) => {
    const eligibleDates = guest.arrivalDate 
      ? dates.filter(d => d > guest.arrivalDate) 
      : dates;
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

    return matchesSearch && matchesMonth && matchesYear && matchesLocalChurch;
  });

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
          <h2 className="page-title">Mes Affectations</h2>
          <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
            Suivi personnalisé et accompagnement spirituel de vos brebis affectées
          </p>
        </div>
        {isIntegrationOrCounselor && (
          <button className="btn btn-primary btn-sm" onClick={() => {
            setNewGuest({ ...newGuest, responsible: userName || "" });
            setIsAddModalOpen(true);
          }}>
            <Plus size={14} /> Nouvelle Brebi
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
            <span className="invite-view-subtitle">{filtered.length} brebis affectée{filtered.length > 1 ? "s" : ""}</span>
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
              {[2024, 2025, 2026].map(y => <option key={y} value={y.toString()}>{y}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 11, color: "var(--gold-light)", fontWeight: 700, letterSpacing: "0.5px" }}>PRÉSENCES</span>
            <select className="input" style={{ width: 130, fontSize: 12, padding: "8px 12px" }} value={selectedMonth} onChange={e => setSelectedMonth(parseInt(e.target.value))}>
              <option value="-1">Tous les mois</option>
              {["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"].map((m, i) => <option key={m} value={i}>{m}</option>)}
            </select>
            <select className="input" style={{ width: 100, fontSize: 12, padding: "8px 12px" }} value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))}>
              {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
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
              <span className="stat-label">Total Affectés</span>
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
                  {editingGuestId ? "Modifier la Brebi" : "Enregistrer une Brebi"}
                </h2>
                <form onSubmit={handleSaveGuest} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
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
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <input type="checkbox" checked={newGuest.souhaiteEtreContacte !== false} onChange={e => setNewGuest({...newGuest, souhaiteEtreContacte: e.target.checked})} style={{ accentColor: "var(--gold)" }} />
                      <span style={{ fontSize: 13, color: "var(--gold)", fontWeight: "bold" }}>Souhaite être contacté(e)</span>
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

                  <div style={{ marginTop: 10, display: "flex", gap: 12, justifyContent: "flex-end" }}>
                    <button type="button" className="btn btn-subtle" onClick={() => { setIsAddModalOpen(false); setEditingGuestId(null); }}>Annuler</button>
                    <button type="submit" className="btn btn-primary">Enregistrer la brebi</button>
                  </div>
                </form>
              </div>
            </div>,
            document.body
          )}

          {/* Filters */}
          <div className="glass fade-in affectations-filters" style={{ padding: "16px 20px", display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: 2, minWidth: 240 }}>
              <Search size={18} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.35)" }} />
              <input className="input search-bar-premium" placeholder="Rechercher une brebi par nom ou prénom..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: 42 }} />
            </div>
            
            {/* Arrival Filters */}
            <div style={{ display: "flex", gap: 10, alignItems: "center", background: "var(--surface)", border: "1px solid var(--border)", padding: "4px 12px", borderRadius: 10 }}>
              <span style={{ fontSize: 10, color: "var(--gold)", fontWeight: 700, letterSpacing: "0.5px" }}>ARRIVÉE</span>
              <select className="input" value={arrivalMonth} onChange={e => setArrivalMonth(e.target.value)} style={{ width: 110, fontSize: 11, padding: "4px 8px", background: "transparent", border: "none" }}>
                <option value="all">Tous les mois</option>
                {["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"].map((m, i) => (
                  <option key={i} value={i}>{m}</option>
                ))}
              </select>
              <select className="input" value={arrivalYear} onChange={e => setArrivalYear(e.target.value)} style={{ width: 80, fontSize: 11, padding: "4px 8px", background: "transparent", border: "none" }}>
                <option value="all">Toutes</option>
                {[2024, 2025, 2026].map(y => (
                  <option key={y} value={y.toString()}>{y}</option>
                ))}
              </select>
            </div>

            {/* Presence Display Filters */}
            <div style={{ display: "flex", gap: 10, alignItems: "center", background: "var(--surface)", border: "1px solid var(--border)", padding: "4px 12px", borderRadius: 10 }}>
              <span style={{ fontSize: 10, color: "var(--gold)", fontWeight: 700, letterSpacing: "0.5px" }}>PRÉSENCES</span>
              <select 
                className="input" 
                value={selectedMonth} 
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                style={{ width: 110, fontSize: 11, padding: "4px 8px", background: "transparent", border: "none" }}
              >
                {["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"].map((m, i) => (
                  <option key={i} value={i}>{m}</option>
                ))}
              </select>
              <select 
                className="input" 
                value={selectedYear} 
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                style={{ width: 80, fontSize: 11, padding: "4px 8px", background: "transparent", border: "none" }}
              >
                {[2024, 2025, 2026].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            {/* Local Church Filter */}
            <div style={{ display: "flex", gap: 10, alignItems: "center", background: "var(--surface)", border: "1px solid var(--border)", padding: "4px 12px", borderRadius: 10 }}>
              <span style={{ fontSize: 10, color: "var(--gold)", fontWeight: 700, letterSpacing: "0.5px" }}>ÉGLISE LOCALE</span>
              <select 
                className="input" 
                value={localChurchFilter} 
                onChange={e => setLocalChurchFilter(e.target.value)}
                style={{ width: 120, fontSize: 11, padding: "4px 8px", background: "transparent", border: "none" }}
              >
                <option value="all">Tous</option>
                <option value="yes">Avec église</option>
                <option value="no">Sans église</option>
              </select>
            </div>
          </div>

          {/* List */}
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
                          <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--cream)" }}>{guest.firstName} {guest.lastName}</h3>
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
                                <label className="form-label" style={{ fontSize: 10, color: "var(--gold)", letterSpacing: "1px", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Est affecté(e) à la famille</label>
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
                              {thursdays.map((day) => {
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
                              {sundays.map((day) => {
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

