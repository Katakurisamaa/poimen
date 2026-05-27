"use client";

import { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { 
  Search, Plus, UserPlus, UserMinus, Filter, CheckCircle2, XCircle, X,
  Calendar, MapPin, Mail, Phone, User as UserIcon,
  ChevronDown, ChevronUp, MoreHorizontal, Loader2,
  Trash2, Trash, RotateCcw, Pencil, Archive, AlertTriangle,
  ListChecks, BarChart3
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { autoAddLeaderToMembers } from "@/app/actions/auth";


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
}

const MOCK_GUESTS: Guest[] = [];

const MOCK_RESPONSIBLES = ["Non assigné"];

const STATUS_OPTIONS = ["Brebi", "Responsable", "Berger", "Second"];

export default function InvitesPage() {
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
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [churchId, setChurchId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [guests, setGuests] = useState<Guest[]>(MOCK_GUESTS);
  const [responsibles, setResponsibles] = useState<string[]>(["Non assigné"]);
  const [counselors, setCounselors] = useState<{ id: string; display_name: string; email: string }[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingGuest, setDeletingGuest] = useState<Guest | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [isConseiller, setIsConseiller] = useState(false);
  const [showCorbeille, setShowCorbeille] = useState(false);

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
    const userInfoStr = localStorage.getItem("poimen_user_info");
    if (userInfoStr) {
      try {
        const parsed = JSON.parse(userInfoStr);
        setUserRole(parsed.role);
        setUserId(parsed.id);
        const rLower = (parsed.role || "").toLowerCase().trim();
        setIsConseiller(parsed.isConseiller === true || rLower === "integration_conseiller" || rLower === "conseiller");
        setChurchId(parsed.church_id);
        
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
    const fam = localStorage.getItem("selected_family");
    if (fam) {
      const parsedFam = JSON.parse(fam);
      setFamilyId(parsedFam.id);
    }
  }, []);

  useEffect(() => {
    if (familyId || (userRoleClean.startsWith("integration_") && churchId)) {
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
  }, [familyId, userRole, churchId]);

  const syncUserRole = async () => {
    const userInfo = JSON.parse(localStorage.getItem("poimen_user_info") || "{}");
    const userEmail = userInfo.email?.toLowerCase();
    if (!userEmail) return;

    // 1. Essayer de récupérer le rôle depuis la table profiles (officiel pour les connexions)
    const { data: profData, error: profErr } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userInfo.id || "")
      .single();

    if (!profErr && profData) {
      console.log("Synchronized role from profiles:", profData.role);
      setUserRole(profData.role);
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
    if (userRoleClean.startsWith("integration_")) {
      if (!churchId) return;
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, email")
        .eq("church_id", churchId)
        .in("role", ["integration_responsable", "integration_second", "integration_conseiller"]);
      
      if (!error && data) {
        setCounselors(data);
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
      const userInfo = JSON.parse(localStorage.getItem("poimen_user_info") || "{}");
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
        const userInfo = JSON.parse(localStorage.getItem("poimen_user_info") || "{}");
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

  const fetchGuests = async () => {
    setLoading(true);
    let query = supabase.from("invites").select("*");
    
    if (userRoleClean.startsWith("integration_")) {
      if (churchId) {
        query = query.eq("church_id", churchId);
        if (userRoleClean === "integration_conseiller" && userId) {
          query = query.eq("created_by", userId);
        }
      } else {
        setLoading(false);
        return;
      }
    } else {
      if (familyId) {
        query = query.eq("bergerie_id", familyId);
        if (userRoleClean === "conseiller" && userId) {
          query = query.eq("created_by", userId);
        }
      } else {
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
        created_by: g.created_by
      }));
      setGuests(mapped);
    }
    setLoading(false);
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
  });

  const toggleAttendance = async (guestId: string, day: string) => {
    if (canModifyInvites === false) return;
    const guest = guests.find(g => g.id === guestId);
    if (!guest) return;

    const newAttendance = { ...guest.attendance, [day]: !guest.attendance[day] };
    setGuests(prev => prev.map(g => g.id === guestId ? { ...g, attendance: newAttendance } : g));
    await supabase.from("invites").update({ attendance: newAttendance }).eq("id", guestId);
  };

  const toggleSuivi = async (guestId: string, field: keyof Guest) => {
    if (canModifyInvites === false) return;
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
      commentaire_suivi: newGuest.commentaireSuivi || ""
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
        alert("Erreur lors de la modification : " + error.message);
      } else {
        fetchGuests();
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
      age: "26-30 ans",
      phone: "",
      email: "",
      address: "",
      arrivalDate: new Date().toISOString().split('T')[0],
      event: "Culte",
      aps: false,
      localChurch: false,
      responsible: "Non assigné",
      assigned_to: null,
      created_by: null,
      aEteInvite: false,
      parQui: "",
      interetCDM: false,
      interetBapteme: false,
      commentaire: "",
      commentaireSuivi: ""
    });
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
          alert("La colonne 'archived' n'existe pas encore en base de données. Veuillez appliquer le patch SQL v2.5.");
          return;
        }
        throw error;
      }
      setGuests(guests.map(g => g.id === id ? { ...g, archived: false } : g));
    } catch (err: any) {
      console.error("Error restoring guest:", err);
      alert("Erreur lors de la restauration de l'invité : " + (err.message || err));
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
    if (userRoleClean.startsWith("integration_")) {
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


  const promoteToMember = async (guest: Guest) => {
    if (!familyId) return;
    
    if (!window.confirm(`Voulez-vous vraiment transformer ${guest.firstName} ${guest.lastName} en membre de la Bergerie ?`)) return;

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
      alert(`${guest.firstName} a été ajouté à la Bergerie avec succès !`);
    } catch (err: any) {
      console.error("Promotion error:", err);
      alert("Erreur lors de l'ajout à la bergerie : " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const removeFromMember = async (guest: Guest) => {
    if (!familyId) return;
    
    if (!window.confirm(`Voulez-vous vraiment retirer ${guest.firstName} ${guest.lastName} de la Bergerie ?`)) return;

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
      commentaireSuivi: guest.commentaireSuivi || ""
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
      const fullName = `${g.firstName} ${g.lastName}`.toLowerCase();
      const matchSearch = fullName.includes(search.toLowerCase());
      const matchArchived = (g.archived || false) === showCorbeille;
      const matchesLocalChurch = localChurchFilter === "all" || 
        (localChurchFilter === "yes" && g.localChurch) || 
        (localChurchFilter === "no" && !g.localChurch);
      return matchSearch && matchArchived && matchesLocalChurch;
    });
  }, [guests, search, showCorbeille, localChurchFilter]);

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
  
  const avgParticipationCDM = Math.round(statsBase.reduce((acc, g) => acc + calculateRate(g, thursdays), 0) / (statsBase.length || 1));
  const avgParticipationCulte = Math.round(statsBase.reduce((acc, g) => acc + calculateRate(g, sundays), 0) / (statsBase.length || 1));
  
  const archivedGuests = guests.filter(g => g.archived);

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
  const canAddOrEditInvites = 
    userRoleClean === "integration_responsable" || 
    userRoleClean === "integration_second" ||
    userRoleClean === "integration_conseiller" ||
    userRoleClean === "conseiller";

  const canDeleteInvites = 
    userRoleClean === "integration_responsable" || 
    userRoleClean === "integration_second";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Global Read-only banner */}
      {!canDeleteInvites && !isConseiller && (
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
          <h2 className="page-title">{isConseiller ? "Ajouter un Invité" : "Invités"}</h2>
          <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
            Gestion et suivi des nouveaux arrivants
          </p>
        </div>
        {(canDeleteInvites || canAddOrEditInvites) && (
          <div style={{ display: "flex", gap: 10 }}>
            {canDeleteInvites && (
              <button 
                className="btn btn-outline" 
                style={showCorbeille ? { background: "var(--red)", borderColor: "var(--red)", color: "white" } : { borderColor: "rgba(239,68,68,0.4)", color: "var(--red)" }}
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
                  baptemeEau: false, interetFormation: false, interetCDM: false, commentaire: ""
                });
                setIsAddModalOpen(true);
              }}>
                <Plus size={14} /> Ajouter
              </button>
            )}
          </div>
        )}
      </div>

      {/* View Switcher Tabs */}
      {!isConseiller && (
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
              <span className="invite-view-subtitle">{filtered.length} invite{filtered.length > 1 ? "s" : ""} a suivre</span>
            </span>
          </button>
          <button 
            onClick={() => setCurrentView('stats')}
            className={`invite-view-option ${currentView === 'stats' ? 'active' : ''}`}
          >
            <span className="invite-view-icon"><BarChart3 size={18} /></span>
            <span className="invite-view-copy">
              <span className="invite-view-title">Statistiques</span>
              <span className="invite-view-subtitle">Suivi, presences et progression</span>
            </span>
          </button>
        </div>
      )}

      {/* Filters in Stats View */}
      {currentView === 'stats' && (
        <div className="glass" style={{ padding: "12px 20px", display: "flex", gap: 15, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>ARRIVÉE</span>
            <select className="input" style={{ width: 120, fontSize: 12 }} value={arrivalMonth} onChange={e => setArrivalMonth(e.target.value)}>
              <option value="all">Tous les mois</option>
              {["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"].map((m, i) => <option key={m} value={i.toString()}>{m}</option>)}
            </select>
            <select className="input" style={{ width: 90, fontSize: 12 }} value={arrivalYear} onChange={e => setArrivalYear(e.target.value)}>
              <option value="all">Toutes années</option>
              {[2024, 2025, 2026].map(y => <option key={y} value={y.toString()}>{y}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>PRÉSENCES</span>
            <select className="input" style={{ width: 130, fontSize: 12 }} value={selectedMonth} onChange={e => setSelectedMonth(parseInt(e.target.value))}>
              <option value="-1">Tous les mois</option>
              {["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"].map((m, i) => <option key={m} value={i}>{m}</option>)}
            </select>
            <select className="input" style={{ width: 90, fontSize: 12 }} value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))}>
              {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>ÉGLISE LOCALE</span>
            <select className="input" style={{ width: 145, fontSize: 12 }} value={localChurchFilter} onChange={e => setLocalChurchFilter(e.target.value)}>
              <option value="all">Tous (avec/sans)</option>
              <option value="yes">Avec église</option>
              <option value="no">Sans église</option>
            </select>
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
              onClick={() => setIsAddModalOpen(false)}
              style={{ position: "absolute", top: 20, right: 20, background: "none", border: "none", color: "var(--muted)", cursor: "pointer" }}
            >
              <XCircle size={24} />
            </button>
            
            <h2 style={{ fontSize: "clamp(16px, 2.5vw, 20px)", color: "var(--gold)", marginBottom: 20 }}>
              {editingGuestId ? "Modifier l'invité" : "Nouvel Invité"}
            </h2>
            
            <form onSubmit={handleSaveGuest} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div className="form-grid-3">
                <div>
                  <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 6 }}>CIVILITÉ</label>
                  <select className="input" value={newGuest.civility || "M."} onChange={e => setNewGuest({...newGuest, civility: e.target.value})}>
                    <option value="M.">M.</option>
                    <option value="Mme.">Mme.</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 6 }}>PRÉNOM</label>
                  <input className="input" required value={newGuest.firstName || ""} onChange={e => setNewGuest({...newGuest, firstName: e.target.value})} placeholder="Jean" />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 6 }}>NOM</label>
                  <input className="input" required value={newGuest.lastName || ""} onChange={e => setNewGuest({...newGuest, lastName: e.target.value})} placeholder="Dupont" />
                </div>
              </div>

              <div className="form-grid-2">
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
              </div>

              <div className="form-grid-3-equal">
                <div>
                  <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 6 }}>DATE D'ARRIVÉE</label>
                  <input className="input" type="date" value={newGuest.arrivalDate || ""} onChange={e => setNewGuest({...newGuest, arrivalDate: e.target.value})} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 6 }}>ÂGE</label>
                  <select className="input" value={newGuest.age || "26-30 ans"} onChange={e => setNewGuest({...newGuest, age: e.target.value})}>
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
                <div>
                  <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 6 }}>ÉVÉNEMENT</label>
                  <select className="input" value={newGuest.event || "Culte"} onChange={e => setNewGuest({...newGuest, event: e.target.value})}>
                    <option value="Culte">Culte</option>
                    <option value="Baptême">Baptême</option>
                    <option value="Évangélisation">Évangélisation</option>
                    <option value="Séminaire">Séminaire</option>
                    <option value="Autre">Autre</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 6 }}>ADRESSE / LIEU DE RÉSIDENCE</label>
                <input className="input" value={newGuest.address || ""} onChange={e => setNewGuest({...newGuest, address: e.target.value})} placeholder="Rue de l'Industrie 12, 6040 Jumet" />
              </div>

              {userRoleClean.startsWith("integration_") ? (
                userRoleClean !== "integration_conseiller" && (
                  <div>
                    <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 6 }}>CONSEILLER ASSIGNÉ</label>
                    <select 
                       className="input" 
                       value={newGuest.assigned_to || ""} 
                       onChange={e => setNewGuest({...newGuest, assigned_to: e.target.value})}
                    >
                      <option value="">Non assigné</option>
                      {counselors.map(c => (
                        <option key={c.id} value={c.id}>{c.display_name}</option>
                      ))}
                    </select>
                  </div>
                )
              ) : (
                <div>
                  <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 6 }}>RESPONSABLE ASSIGNÉ</label>
                  <select 
                    className="input" 
                    value={newGuest.responsible || "Non assigné"} 
                    onChange={e => setNewGuest({...newGuest, responsible: e.target.value})}
                    disabled={isConseiller}
                  >
                    <option value="Non assigné">Non assigné</option>
                    {responsibles.filter(r => r !== "Non assigné").map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                    {newGuest.responsible && newGuest.responsible !== "Non assigné" && !responsibles.includes(newGuest.responsible) && (
                      <option key={newGuest.responsible} value={newGuest.responsible}>{newGuest.responsible}</option>
                    )}
                  </select>
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

              <div style={{ display: "flex", gap: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input type="checkbox" checked={newGuest.aps} onChange={e => setNewGuest({...newGuest, aps: e.target.checked})} />
                  <span style={{ fontSize: 13 }}>APS</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input type="checkbox" checked={newGuest.localChurch} onChange={e => setNewGuest({...newGuest, localChurch: e.target.checked})} />
                  <span style={{ fontSize: 13 }}>Déjà d'une église locale</span>
                </div>
              </div>

              <div style={{ marginTop: 10, display: "flex", gap: 12, justifyContent: "flex-end" }}>
                <button type="button" className="btn btn-outline" onClick={() => setIsAddModalOpen(false)}>Annuler</button>
                <button type="submit" className="btn btn-primary">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Search & Filters */}
      <div className="glass-compact" style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 2, minWidth: 200 }}>
          <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
          <input className="input" placeholder="Rechercher par nom..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: 36 }} />
        </div>

        {!isConseiller && (
          <>
            <div style={{ display: "flex", gap: 10, alignItems: "center", background: "rgba(255,255,255,0.05)", padding: "4px 12px", borderRadius: 8 }}>
              <span style={{ fontSize: 11, color: "var(--gold)", fontWeight: 600 }}>ARRIVÉE :</span>
              <select className="input" value={arrivalMonth} onChange={e => setArrivalMonth(e.target.value)} style={{ width: 100, fontSize: 11, padding: "4px 8px" }}>
                <option value="all">Tous les mois</option>
                {["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"].map((m, i) => (
                  <option key={i} value={i.toString()}>{m}</option>
                ))}
              </select>
              <select className="input" value={arrivalYear} onChange={e => setArrivalYear(e.target.value)} style={{ width: 80, fontSize: 11, padding: "4px 8px" }}>
                <option value="all">Toutes</option>
                {[2023, 2024, 2025, 2026].map(y => (
                  <option key={y} value={y.toString()}>{y}</option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center", background: "rgba(255,255,255,0.05)", padding: "4px 12px", borderRadius: 8 }}>
              <span style={{ fontSize: 11, color: "var(--primary)", fontWeight: 600 }}>PRÉSENCES :</span>
              <select className="input" value={selectedMonth} onChange={(e) => setSelectedMonth(parseInt(e.target.value))} style={{ width: 100, fontSize: 11, padding: "4px 8px" }}>
                {["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"].map((m, i) => (
                  <option key={i} value={i}>{m}</option>
                ))}
              </select>
              <select className="input" value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))} style={{ width: 80, fontSize: 11, padding: "4px 8px" }}>
                {[2023, 2024, 2025, 2026].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center", background: "rgba(255,255,255,0.05)", padding: "4px 12px", borderRadius: 8 }}>
              <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>ÉGLISE LOCALE :</span>
              <select className="input" value={localChurchFilter} onChange={e => setLocalChurchFilter(e.target.value)} style={{ width: 130, fontSize: 11, padding: "4px 8px" }}>
                <option value="all">Tous</option>
                <option value="yes">Avec église</option>
                <option value="no">Sans église</option>
              </select>
            </div>
          </>
        )}
      </div>

      {/* List */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {filtered.map((guest) => {
          const rateCDM = calculateRate(guest, thursdays);
          const rateCulte = calculateRate(guest, sundays);
          const fidelised = isFidelise(guest);
          const isExpanded = expandedId === guest.id;
          const isIntegrationLeader = userRoleClean === "integration_responsable" || userRoleClean === "integration_second";
          const isRestricted = !isIntegrationLeader;
          const isActionBlocked = !isIntegrationLeader && guest.assigned_to !== userId && guest.created_by !== userId;
          const isUnassigned = !guest.assigned_to;
          // Follow-up information can only be edited by the assigned counselor
          const isEditBlocked = isUnassigned || guest.assigned_to !== userId;
          const isAttendanceBlocked = isUnassigned || guest.assigned_to !== userId;

          return (
            <div key={guest.id} className="glass-flush" style={{ overflow: "hidden" }}>
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
                      <h3 style={{ fontSize: 14, fontWeight: 600 }}>{guest.firstName} {guest.lastName}</h3>
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
                  <div className="invite-expanded-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20, paddingTop: 20 }}>
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
                        <div className="invite-attendance-block" style={{ display: "flex", flexDirection: "column", gap: 15 }}>
                          <div>
                            <h4 style={{ fontSize: 11, color: "var(--gold)", textTransform: "uppercase", marginBottom: 8 }}>CDM (Jeudi)</h4>
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                              {thursdays.map(day => {
                                const isBeforeArrival = guest.arrivalDate && day < guest.arrivalDate;
                                return (
                                  <div 
                                    key={day} 
                                    title={isBeforeArrival ? "Non applicable (avant l'arrivée)" : day}
                                    onClick={() => !isAttendanceBlocked && !isBeforeArrival && toggleAttendance(guest.id, day)} 
                                    style={{ 
                                      width: 28, height: 28, borderRadius: 6, 
                                      background: guest.attendance[day] ? "var(--green-glow)" : "rgba(255,255,255,0.05)", 
                                      border: `1px solid ${guest.attendance[day] ? "var(--green)" : "var(--border)"}`, 
                                      display: "flex", alignItems: "center", justifyContent: "center", 
                                      color: guest.attendance[day] ? "var(--green)" : "var(--muted)", 
                                      cursor: isBeforeArrival ? "not-allowed" : (isAttendanceBlocked ? "default" : "pointer"), 
                                      opacity: isBeforeArrival ? 0.12 : (isAttendanceBlocked ? 0.4 : 1) 
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
                              {sundays.map(day => {
                                const isBeforeArrival = guest.arrivalDate && day < guest.arrivalDate;
                                return (
                                  <div 
                                    key={day} 
                                    title={isBeforeArrival ? "Non applicable (avant l'arrivée)" : day}
                                    onClick={() => !isAttendanceBlocked && !isBeforeArrival && toggleAttendance(guest.id, day)} 
                                    style={{ 
                                      width: 28, height: 28, borderRadius: 6, 
                                      background: guest.attendance[day] ? "var(--green-glow)" : "rgba(255,255,255,0.05)", 
                                      border: `1px solid ${guest.attendance[day] ? "var(--green)" : "var(--border)"}`, 
                                      display: "flex", alignItems: "center", justifyContent: "center", 
                                      color: guest.attendance[day] ? "var(--green)" : "var(--muted)", 
                                      cursor: isBeforeArrival ? "not-allowed" : (isAttendanceBlocked ? "default" : "pointer"), 
                                      opacity: isBeforeArrival ? 0.12 : (isAttendanceBlocked ? 0.4 : 1) 
                                    }}>
                                    <span style={{ fontSize: 9 }}>{parseInt(day.split('-')[2], 10)}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        {/* Column 3: Actions & Status */}
                        <div className="invite-actions-block" style={{ display: "flex", flexDirection: "column", gap: 15 }}>
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
                                  className="btn" 
                                  style={{ width: "100%", backgroundColor: "transparent", color: "#ef4444", border: "1px solid #ef4444", fontWeight: "bold", padding: "10px", fontSize: 11 }} 
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
                          
                          {canModifyInvites && (
                            <div className="glass-compact" style={{ background: "rgba(255,255,255,0.02)" }}>
                              <h5 style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", marginBottom: 8 }}>
                                {userRoleClean.startsWith("integration_") ? "Assigner à un conseiller" : "Affectation"}
                              </h5>
                              <div style={{ display: "flex", gap: 8 }}>
                                {userRoleClean.startsWith("integration_") ? (
                                  <select 
                                    className="input" 
                                    value={guest.assigned_to || ""} 
                                    onChange={async (e) => {
                                      const newAssignee = e.target.value || null;
                                      setGuests(prev => prev.map(g => g.id === guest.id ? {...g, assigned_to: newAssignee} : g));
                                      await supabase.from("invites").update({ assigned_to: newAssignee }).eq("id", guest.id);
                                    }} 
                                    style={{ flex: 1, fontSize: 12 }}
                                  >
                                    <option value="">Non assigné</option>
                                    {counselors.map(c => (
                                      <option key={c.id} value={c.id}>{c.display_name}</option>
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
                        </div>

                        {/* Column 4: Detailed Follow-up */}
                        <div className="invite-followup-block" style={{ display: "flex", flexDirection: "column", gap: 15, gridColumn: "span 2" }}>
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
                                    style={{ width: "100%", minHeight: 60, fontSize: 11, background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "10px", color: "var(--cream)", resize: "vertical", lineHeight: "1.5" }}
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
                              <textarea className="input" rows={2} defaultValue={guest.commentaireSuivi} disabled={isEditBlocked} style={{ fontSize: 12, resize: "vertical", background: "rgba(0,0,0,0.2)", opacity: isEditBlocked ? 0.5 : 1 }} onBlur={(e) => supabase.from("invites").update({ commentaire_suivi: e.target.value }).eq("id", guest.id)} />
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
                    color: "white",
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
                    color: "white",
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
                    className="btn" 
                    style={{
                      width: "100%",
                      background: "var(--red)",
                      color: "white",
                      border: "none",
                      borderRadius: 8,
                      padding: "12px 16px",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      transition: "all 0.2s ease",
                      boxShadow: "0 4px 12px rgba(239, 68, 68, 0.2)"
                    }}
                    disabled={isDeleting} 
                    onClick={() => handleDeleteGuest(deletingGuest.id)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#e03e3e";
                      e.currentTarget.style.boxShadow = "0 6px 16px rgba(239, 68, 68, 0.35)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "var(--red)";
                      e.currentTarget.style.boxShadow = "0 4px 12px rgba(239, 68, 68, 0.2)";
                    }}
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
                      className="btn" 
                      style={{
                        flex: 1.2,
                        background: "rgba(239, 68, 68, 0.06)",
                        color: "#fc8181",
                        border: "1px solid rgba(239, 68, 68, 0.2)",
                        borderRadius: 8,
                        padding: "10px 16px",
                        fontWeight: 500,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        transition: "all 0.2s ease"
                      }}
                      disabled={isDeleting} 
                      onClick={() => handlePermanentDeleteGuest(deletingGuest.id)}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "rgba(239, 68, 68, 0.15)";
                        e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.4)";
                        e.currentTarget.style.color = "#fff";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "rgba(239, 68, 68, 0.06)";
                        e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.2)";
                        e.currentTarget.style.color = "#fc8181";
                      }}
                    >
                      <Trash2 size={14} />
                      Détruire définitivement
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
                    className="btn" 
                    style={{
                      flex: 1.5,
                      background: "var(--red)",
                      color: "white",
                      border: "none",
                      borderRadius: 8,
                      padding: "10px 16px",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      transition: "all 0.2s ease",
                      boxShadow: "0 4px 12px rgba(239, 68, 68, 0.2)"
                    }}
                    disabled={isDeleting} 
                    onClick={() => handlePermanentDeleteGuest(deletingGuest.id)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#e03e3e";
                      e.currentTarget.style.boxShadow = "0 6px 16px rgba(239, 68, 68, 0.35)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "var(--red)";
                      e.currentTarget.style.boxShadow = "0 4px 12px rgba(239, 68, 68, 0.2)";
                    }}
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
