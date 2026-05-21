"use client";

import { useState, useMemo, useEffect } from "react";
import { 
  Search, Plus, UserPlus, Filter, CheckCircle2, XCircle, X, 
  Calendar, MapPin, Mail, Phone, User as UserIcon,
  ChevronDown, ChevronUp, MoreHorizontal, Loader2
} from "lucide-react";
import { supabase } from "@/lib/supabase";

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
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [responsibles, setResponsibles] = useState<string[]>(["Non assigné"]);
  const [isConseiller, setIsConseiller] = useState(false);

  useEffect(() => {
    const userInfo = localStorage.getItem("poimen_user_info");
    if (userInfo) {
      const parsed = JSON.parse(userInfo);
      setUserRole(parsed.role);
      setIsConseiller(parsed.isConseiller === true);
      setUserName(`${parsed.firstName} ${parsed.lastName}`);
    }
    const fam = localStorage.getItem("selected_family");
    if (fam) {
      const parsedFam = JSON.parse(fam);
      setFamilyId(parsedFam.id);
    }
  }, []);

  useEffect(() => {
    if (familyId) {
      fetchGuests();
      fetchResponsibles();
    }
  }, [familyId]);

  const fetchResponsibles = async () => {
    if (!familyId) return;
    const { data, error } = await supabase
      .from("members")
      .select("first_name, last_name, status, email")
      .eq("bergerie_id", familyId);
    
    if (!error && data) {
      const userInfo = JSON.parse(localStorage.getItem("poimen_user_info") || "{}");
      const userEmail = userInfo.email?.toLowerCase();
      const userRoleVal = (userInfo.role || "").toLowerCase();
      const isLeader = userRoleVal.includes("berger") || userRoleVal.includes("second") || userRoleVal.includes("responsable");
      
      const me = data.find(m => m.email?.toLowerCase() === userEmail);
      if (!me && isLeader && userEmail) {
        await supabase.from("members").insert({
          bergerie_id: familyId,
          first_name: userInfo.firstName || "Leader",
          last_name: userInfo.lastName || "User",
          email: userEmail,
          status: userInfo.role,
          civility: "M."
        });
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
    const { data: dbGuests, error } = await supabase
      .from("invites")
      .select("*")
      .eq("bergerie_id", familyId)
      .order("created_at", { ascending: false });

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
        commentaireSuivi: g.commentaire_suivi || ""
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

  const handleSelfAssign = (guestId: string) => {
    if (userName) {
      handleUpdateAssignment(guestId, userName);
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
    if (!familyId) return;

    if (editingGuestId) {
      const { error } = await supabase
        .from("invites")
        .update({
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
        })
        .eq("id", editingGuestId);

      if (error) {
        alert("Erreur lors de la modification : " + error.message);
      } else {
        fetchGuests();
        setIsAddModalOpen(false);
        setEditingGuestId(null);
      }
    } else {
      const { data: inserted, error } = await supabase
        .from("invites")
        .insert({
          bergerie_id: familyId,
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
          commentaire_suivi: ""
        })
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
    });
  };

  const handleDeleteGuest = async (guestId: string) => {
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
      interetBapteme: guest.interetBapteme || false,
      commentaire: guest.commentaire || "",
      commentaireSuivi: guest.commentaireSuivi || ""
    });
    setIsAddModalOpen(true);
  };

  const getDaysOfMonth = (year: number, month: number, dayOfWeek: number) => {
    const dates = [];
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
    return dates;
  };

  const thursdays = useMemo(() => getDaysOfMonth(selectedYear, selectedMonth, 4), [selectedMonth, selectedYear]);
  const sundays = useMemo(() => getDaysOfMonth(selectedYear, selectedMonth, 0), [selectedMonth, selectedYear]);

  const calculateRate = (guest: Guest, dates: string[]) => {
    if (dates.length === 0) return 0;
    const presents = dates.filter(d => guest.attendance[d]).length;
    return Math.round((presents / dates.length) * 100);
  };

  const isFidelise = (guest: Guest) => {
    const rateCDM = calculateRate(guest, thursdays);
    const rateCulte = calculateRate(guest, sundays);
    return rateCDM >= 45 || rateCulte >= 45;
  };

  const filtered = guests.filter(g => {
    // Strict isolation for Responsables: only see assigned people
    if (userName && g.responsible !== userName) return false;

    const matchesSearch = `${g.firstName} ${g.lastName}`.toLowerCase().includes(search.toLowerCase());
    const guestDate = new Date(g.arrivalDate);
    const guestMonth = guestDate.getMonth().toString();
    const guestYear = guestDate.getFullYear().toString();
    const matchesMonth = arrivalMonth === "all" || guestMonth === arrivalMonth;
    const matchesYear = arrivalYear === "all" || guestYear === arrivalYear;
    
    return matchesSearch && matchesMonth && matchesYear;
  });

  const brebisCount = filtered.filter(g => g.status === "Brebi").length;
  const callsSuccess = filtered.filter(g => g.appelAbouti).length;
  const noChurch = filtered.filter(g => !g.localChurch).length;
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
          Chargement de vos affectations sacrées...
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      {/* Header */}
      {/* Read-only banner for Conseiller */}
      {isConseiller && (
        <div className="glass glass-compact fade-in" style={{ background: "rgba(56, 189, 248, 0.04)", borderColor: "rgba(56, 189, 248, 0.25)", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--sky)", boxShadow: "0 0 10px var(--sky)" }} />
          <span style={{ fontSize: 11, color: "var(--sky)", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase" }}>Mode Conseiller — Vue en lecture seule</span>
        </div>
      )}

      <div className="page-header fade-in">
        <div>
          <h2 className="page-title">Mes Affectations</h2>
          <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
            Suivi personnalisé et accompagnement spirituel de vos brebis affectées
          </p>
        </div>
        {!isConseiller && (
          <button className="btn btn-primary btn-sm" onClick={() => {
            setNewGuest({ ...newGuest, responsible: userName || "" });
            setIsAddModalOpen(true);
          }}>
            <Plus size={14} /> Nouvelle Brebi
          </button>
        )}
      </div>

      {/* View Switcher Tabs */}
      <div className="fade-in" style={{ display: "flex", gap: 10, background: "rgba(10, 6, 22, 0.5)", border: "1px solid var(--border)", padding: 5, borderRadius: "14px", width: "fit-content" }}>
        <button 
          onClick={() => setCurrentView('list')}
          className={`pill ${currentView === 'list' ? 'pill-active' : 'pill-inactive'}`}
          style={{ border: "none" }}
        >
          Liste ({filtered.length})
        </button>
        <button 
          onClick={() => setCurrentView('stats')}
          className={`pill ${currentView === 'stats' ? 'pill-active' : 'pill-inactive'}`}
          style={{ border: "none" }}
        >
          Statistiques
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
              {["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"].map((m, i) => <option key={m} value={i}>{m}</option>)}
            </select>
            <select className="input" style={{ width: 100, fontSize: 12, padding: "8px 12px" }} value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))}>
              {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h3 style={{ fontSize: 18, color: "var(--gold-light)", fontFamily: "var(--font-display)", margin: 0 }}>Progression PCNC</h3>
              <span className="badge badge-violet" style={{ fontSize: 10 }}>{totalPCNC} Personnes engagées</span>
            </div>
            
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 20 }}>
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
            <div className="glass" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <h3 style={{ fontSize: 16, marginBottom: 16, fontFamily: "var(--font-display)", color: "var(--gold-light)" }}>Urgence Suivi</h3>
              <div className="stat-card" style={{ padding: "20px 16px", border: "1px solid rgba(239, 68, 68, 0.3)", background: "rgba(239, 68, 68, 0.02)" }}>
                <span className="stat-label" style={{ color: "var(--red)" }}>Sans église locale</span>
                <div className="stat-value" style={{ fontSize: 28, background: "linear-gradient(135deg, #FFF, var(--red) 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{noChurch}</div>
                <div className="stat-sub">Priorité absolue d'intégration</div>
              </div>
            </div>
            <div className="glass">
              <h3 style={{ fontSize: 16, marginBottom: 16, fontFamily: "var(--font-display)", color: "var(--gold-light)" }}>Engagement spirituel</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
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
              <h3 style={{ fontSize: 16, marginBottom: 16, fontFamily: "var(--font-display)", color: "var(--gold-light)" }}>Participation Moyenne</h3>
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
          {/* Add / Edit Modal */}
          {isAddModalOpen && (
            <div style={{
              position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
              background: "rgba(2, 1, 4, 0.8)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
              zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center",
              padding: 20
            }}>
              <div className="glass fade-in" style={{ width: "100%", maxWidth: 620, maxHeight: "90vh", overflowY: "auto", position: "relative", padding: 32, border: "1px solid var(--gold)", boxShadow: "0 20px 50px rgba(0,0,0,0.8)" }}>
                <button onClick={() => { setIsAddModalOpen(false); setEditingGuestId(null); }} style={{ position: "absolute", top: 24, right: 24, background: "none", border: "none", color: "var(--muted)", cursor: "pointer", display: "flex", alignItems: "center" }}>
                  <X size={20} />
                </button>
                <h2 style={{ fontSize: 22, color: "var(--gold-light)", marginBottom: 24, fontFamily: "var(--font-display)" }}>
                  {editingGuestId ? "Modifier la Brebi" : "Enregistrer une Brebi"}
                </h2>
                <form onSubmit={handleSaveGuest} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 2fr", gap: 15 }}>
                    <div>
                      <label className="form-label">CIVILITÉ</label>
                      <select className="input" value={newGuest.civility} onChange={e => setNewGuest({...newGuest, civility: e.target.value})}>
                        <option value="M.">M.</option>
                        <option value="Mme.">Mme.</option>
                        <option value="Mlle.">Mlle.</option>
                      </select>
                    </div>
                    <div>
                      <label className="form-label">PRÉNOM</label>
                      <input className="input" required value={newGuest.firstName} onChange={e => setNewGuest({...newGuest, firstName: e.target.value})} />
                    </div>
                    <div>
                      <label className="form-label">NOM</label>
                      <input className="input" required value={newGuest.lastName} onChange={e => setNewGuest({...newGuest, lastName: e.target.value})} />
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 15 }}>
                    <div>
                      <label className="form-label">TÉLÉPHONE</label>
                      <input className="input" value={newGuest.phone} onChange={e => setNewGuest({...newGuest, phone: e.target.value})} />
                    </div>
                    <div>
                      <label className="form-label">E-MAIL</label>
                      <input className="input" type="email" value={newGuest.email} onChange={e => setNewGuest({...newGuest, email: e.target.value})} />
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 15 }}>
                    <div>
                      <label className="form-label">DATE D'ARRIVÉE</label>
                      <input className="input" type="date" value={newGuest.arrivalDate} onChange={e => setNewGuest({...newGuest, arrivalDate: e.target.value})} />
                    </div>
                    <div>
                      <label className="form-label">ÂGE</label>
                      <select className="input" value={newGuest.age} onChange={e => setNewGuest({...newGuest, age: e.target.value})}>
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
                      <select className="input" value={newGuest.event} onChange={e => setNewGuest({...newGuest, event: e.target.value})}>
                        <option value="Culte">Culte</option>
                        <option value="Baptême">Baptême</option>
                        <option value="Évangélisation">Évangélisation</option>
                        <option value="Séminaire">Séminaire</option>
                        <option value="Autre">Autre</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 15 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <input type="checkbox" checked={newGuest.aEteInvite} onChange={e => setNewGuest({...newGuest, aEteInvite: e.target.checked})} style={{ accentColor: "var(--gold)" }} />
                      <span style={{ fontSize: 13, color: "var(--cream-dim)" }}>A été invité ?</span>
                    </div>
                    {newGuest.aEteInvite && (
                      <div>
                        <label className="form-label">PAR QUI ?</label>
                        <input className="input" value={newGuest.parQui} onChange={e => setNewGuest({...newGuest, parQui: e.target.value})} placeholder="Nom de l'invitant" />
                      </div>
                    )}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 15 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <input type="checkbox" checked={newGuest.baptemeEau} onChange={e => setNewGuest({...newGuest, baptemeEau: e.target.checked})} style={{ accentColor: "var(--gold)" }} />
                      <span style={{ fontSize: 13, color: "var(--cream-dim)" }}>Baptisé par immersion ?</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <input type="checkbox" checked={newGuest.interetFormation} onChange={e => setNewGuest({...newGuest, interetFormation: e.target.checked})} style={{ accentColor: "var(--gold)" }} />
                      <span style={{ fontSize: 13, color: "var(--cream-dim)" }}>Intérêt PCNC</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <input type="checkbox" checked={newGuest.interetCDM} onChange={e => setNewGuest({...newGuest, interetCDM: e.target.checked})} style={{ accentColor: "var(--gold)" }} />
                      <span style={{ fontSize: 13, color: "var(--cream-dim)" }}>Intérêt C.D.M</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <input type="checkbox" checked={newGuest.interetBapteme} onChange={e => setNewGuest({...newGuest, interetBapteme: e.target.checked})} style={{ accentColor: "var(--gold)" }} />
                      <span style={{ fontSize: 13, color: "var(--cream-dim)" }}>Intérêt Baptême</span>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 20 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <input type="checkbox" checked={newGuest.aps} onChange={e => setNewGuest({...newGuest, aps: e.target.checked})} style={{ accentColor: "var(--gold)" }} />
                      <span style={{ fontSize: 13, color: "var(--cream-dim)" }}>Fiche APS Remplie</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <input type="checkbox" checked={newGuest.localChurch} onChange={e => setNewGuest({...newGuest, localChurch: e.target.checked})} style={{ accentColor: "var(--gold)" }} />
                      <span style={{ fontSize: 13, color: "var(--cream-dim)" }}>Déjà d'une église locale</span>
                    </div>
                  </div>

                  <div>
                    <label className="form-label">ADRESSE DOMICILE</label>
                    <input className="input" value={newGuest.address} onChange={e => setNewGuest({...newGuest, address: e.target.value})} />
                  </div>

                  <div>
                    <label className="form-label">COMMENTAIRE / NOTES PARTICULIÈRES</label>
                    <textarea 
                      className="input" 
                      value={newGuest.commentaire} 
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
            </div>
          )}

          {/* Filters */}
          <div className="glass fade-in" style={{ padding: "16px 20px", display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: 2, minWidth: 240 }}>
              <Search size={14} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
              <input className="input" placeholder="Rechercher une brebi par nom ou prénom..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: 38 }} />
            </div>
            
            {/* Arrival Filters */}
            <div style={{ display: "flex", gap: 10, alignItems: "center", background: "rgba(10, 6, 22, 0.4)", border: "1px solid var(--border)", padding: "4px 12px", borderRadius: 10 }}>
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
            <div style={{ display: "flex", gap: 10, alignItems: "center", background: "rgba(10, 6, 22, 0.4)", border: "1px solid var(--border)", padding: "4px 12px", borderRadius: 10 }}>
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
          </div>

          {/* List */}
          <div className="fade-in d1" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {filtered.map((guest) => {
              const rateCDM = calculateRate(guest, thursdays);
              const rateCulte = calculateRate(guest, sundays);
              const fidelised = isFidelise(guest);
              const isExpanded = expandedId === guest.id;
              const isRestricted = guest.responsible !== userName;

              return (
                <div key={guest.id} className="glass glass-flush" style={{ borderLeft: fidelised ? "4px solid var(--gold)" : "1px solid var(--border)", transition: "all 0.3s ease" }}>
                  <div 
                    onClick={() => setExpandedId(isExpanded ? null : guest.id)}
                    style={{ 
                      padding: "18px 24px", display: "flex", alignItems: "center", justifyContent: "space-between",
                      cursor: "pointer", background: isExpanded ? "rgba(212, 175, 55, 0.03)" : "transparent"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 16, flex: 1 }}>
                      <div className={`avatar ${fidelised ? "avatar-gradient avatar-effect-aura" : "avatar-gradient"}`} style={{ width: 42, height: 42, fontSize: 12 }}>
                        {guest.firstName[0]}{guest.lastName[0]}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--cream)" }}>{guest.firstName} {guest.lastName}</h3>
                          {fidelised && <span className="badge badge-gold" style={{ fontSize: 8 }}>Fidélisé</span>}
                          {(userRole?.toLowerCase() === "berger" || userRole?.toLowerCase().includes("second")) && !isConseiller && (
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
                        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                          {guest.civility} · {guest.age} ans · Responsable: <span style={{ color: "var(--gold-light)" }}>{guest.responsible}</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                      <div style={{ textAlign: "right", minWidth: 60 }}>
                        <div style={{ fontSize: 9, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>CDM (Jeudi)</div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: rateCDM >= 45 ? "var(--green)" : "var(--red)", marginTop: 2 }}>{rateCDM}%</div>
                      </div>
                      <div style={{ textAlign: "right", minWidth: 60 }}>
                        <div style={{ fontSize: 9, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Culte (Dim)</div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: rateCulte >= 45 ? "var(--green)" : "var(--red)", marginTop: 2 }}>{rateCulte}%</div>
                      </div>
                      {isExpanded ? <ChevronUp size={18} style={{ color: "var(--gold)" }} /> : <ChevronDown size={18} style={{ color: "var(--muted)" }} />}
                    </div>
                  </div>

                  {isExpanded && (
                    <div style={{ borderTop: "1px solid var(--border)", background: "rgba(0, 0, 0, 0.25)" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24, padding: 24 }}>
                        {/* Info Column */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                          <h4 style={{ fontSize: 11, color: "var(--gold)", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 4, fontFamily: "var(--font-body)", fontWeight: 700 }}>Informations Générales</h4>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                            <Mail size={14} style={{ color: "var(--muted)" }} /> <span style={{ color: "var(--cream-dim)" }}>{guest.email || "Non renseigné"}</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                            <Phone size={14} style={{ color: "var(--muted)" }} /> <span style={{ color: "var(--cream-dim)" }}>{guest.phone || "Non renseigné"}</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                            <Calendar size={14} style={{ color: "var(--gold)" }} /> <span style={{ color: "var(--cream-dim)" }}>Arrivé le: {guest.arrivalDate ? guest.arrivalDate.split('-').reverse().join('/') : ''}</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                            <MapPin size={14} style={{ color: "var(--muted)" }} /> <span style={{ fontSize: 12, color: "var(--cream-dim)" }}>{guest.address || "Adresse non renseignée"}</span>
                          </div>
                          <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
                            <span className="badge badge-gold" style={{ fontSize: 9 }}>{guest.event}</span>
                            <span className={`badge ${guest.aps ? "badge-green" : "badge-red"}`} style={{ fontSize: 9 }}>APS: {guest.aps ? "Oui" : "Non"}</span>
                            <span className={`badge ${guest.localChurch ? "badge-green" : "badge-red"}`} style={{ fontSize: 9 }}>Église locale: {guest.localChurch ? "Oui" : "Non"}</span>
                          </div>

                          <div style={{ marginTop: 10 }}>
                            <label className="form-label" style={{ fontSize: 9 }}>Commentaire d'arrivée</label>
                            <div style={{ fontSize: 12, color: "var(--cream-dim)", background: "rgba(10, 6, 22, 0.4)", padding: 12, borderRadius: 10, border: "1px solid var(--border)", lineHeight: 1.5 }}>
                              {guest.commentaire || <span style={{ fontStyle: "italic", color: "var(--muted)" }}>Aucun commentaire d'arrivée rédigé.</span>}
                            </div>
                          </div>
                          
                          {(userRole?.toLowerCase() === "berger" || userRole?.toLowerCase().includes("second")) && !isConseiller && (
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
                              {thursdays.map((day) => (
                                <div 
                                  key={day} 
                                  title={day} 
                                  onClick={() => !isRestricted && toggleAttendance(guest.id, day)}
                                  style={{ 
                                    width: 32, height: 32, borderRadius: 8, 
                                    background: guest.attendance[day] ? "var(--green-glow)" : "rgba(255,255,255,0.02)",
                                    border: `1px solid ${guest.attendance[day] ? "var(--green)" : "var(--border)"}`,
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    color: guest.attendance[day] ? "var(--green)" : "var(--muted)",
                                    cursor: isRestricted ? "default" : "pointer", transition: "all 0.2s",
                                    opacity: isRestricted ? 0.4 : 1
                                  }}>
                                  <span style={{ fontSize: 10, fontWeight: 700 }}>{parseInt(day.split('-')[2], 10)}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div>
                            <h4 style={{ fontSize: 11, color: "var(--gold)", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10, fontFamily: "var(--font-body)", fontWeight: 700 }}>Présences Culte (Dimanche)</h4>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              {sundays.map((day) => (
                                <div 
                                  key={day} 
                                  title={day} 
                                  onClick={() => !isRestricted && toggleAttendance(guest.id, day)}
                                  style={{ 
                                    width: 32, height: 32, borderRadius: 8, 
                                    background: guest.attendance[day] ? "var(--green-glow)" : "rgba(255,255,255,0.02)",
                                    border: `1px solid ${guest.attendance[day] ? "var(--green)" : "var(--border)"}`,
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    color: guest.attendance[day] ? "var(--green)" : "var(--muted)",
                                    cursor: isRestricted ? "default" : "pointer", transition: "all 0.2s",
                                    opacity: isRestricted ? 0.4 : 1
                                  }}>
                                  <span style={{ fontSize: 10, fontWeight: 700 }}>{parseInt(day.split('-')[2], 10)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Suivi Groups */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
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
                                      background: "rgba(0,0,0,0.3)", 
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
                        <div className="glass glass-compact" style={{ background: "rgba(255,255,255,0.01)", gridColumn: "span 2", border: "1px solid rgba(212,175,55,0.08)" }}>
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
                                background: "rgba(0,0,0,0.3)",
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

                        {/* Dynamic Assignment Control for Leaders */}
                        {(userRole?.toLowerCase() === "berger" || userRole?.toLowerCase().includes("second")) && !isConseiller && (
                          <div className="glass glass-compact" style={{ background: "rgba(255,255,255,0.01)", gridColumn: "span 2", border: "1px solid rgba(212,175,55,0.15)" }}>
                            <h4 style={{ fontSize: 10, color: "var(--gold)", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10, fontFamily: "var(--font-body)", fontWeight: 700 }}>Affectation Administrative</h4>
                            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                              <div style={{ flex: 1 }}>
                                <select 
                                  className="input" 
                                  style={{ fontSize: 12 }}
                                  value={guest.responsible} 
                                  onChange={e => handleUpdateAssignment(guest.id, e.target.value)}
                                >
                                  {responsibles.map(r => (
                                    <option key={r} value={r}>{r}</option>
                                  ))}
                                </select>
                              </div>
                              <button 
                                className="btn btn-primary btn-sm" 
                                onClick={() => handleSelfAssign(guest.id)}
                              >
                                M'affecter
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
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
        padding: "8px 12px",
        background: "rgba(10, 6, 22, 0.4)",
        borderRadius: "8px",
        cursor: (onChange && !disabled) ? "pointer" : "default",
        opacity: disabled ? 0.5 : 1,
        transition: "all 0.2s ease",
        border: "1px solid rgba(255, 255, 255, 0.02)"
      }}
    >
      <span style={{ fontSize: 11, fontWeight: 700, color: checked ? "var(--cream)" : "var(--muted)", transition: "color 0.2s" }}>{label}</span>
      <button className={`toggle ${checked ? "on" : ""}`} style={{ transform: "scale(0.65)", transformOrigin: "right", pointerEvents: "none" }} />
    </div>
  );
}

