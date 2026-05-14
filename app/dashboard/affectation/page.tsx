"use client";

import { useState, useMemo, useEffect } from "react";
import { 
  Search, Plus, UserPlus, Filter, CheckCircle2, XCircle, 
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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <Loader2 className="animate-spin text-gold" size={40} />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      {/* Read-only banner for Conseiller */}
      {isConseiller && (
        <div style={{ padding: "10px 16px", borderRadius: 8, background: "rgba(91,168,224,0.1)", border: "1px solid rgba(91,168,224,0.25)", display: "flex", alignItems: "center", gap: 10, marginBottom: 15 }}>
          <span style={{ fontSize: 16 }}>👁️</span>
          <span style={{ fontSize: 12, color: "var(--sky)", fontWeight: 600 }}>Mode Conseiller — Vue en lecture seule</span>
        </div>
      )}

      <div className="page-header">
        <div>
          <h2 className="page-title">Mes Affectations</h2>
          <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
            Suivi personnalisé de vos brebis affectées
          </p>
        </div>
        {!isConseiller && (
          <button className="btn btn-primary" onClick={() => {
            setNewGuest({ ...newGuest, responsible: userName || "" });
            setIsAddModalOpen(true);
          }}>
            <Plus size={14} /> Nouvelle Brebi
          </button>
        )}
      </div>

      {/* View Switcher Tabs */}
      <div style={{ display: "flex", gap: 8, background: "rgba(255,255,255,0.05)", padding: 4, borderRadius: 10, width: "fit-content" }}>
        <button 
          onClick={() => setCurrentView('list')}
          className={`btn ${currentView === 'list' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ padding: "8px 24px", borderRadius: 8 }}
        >
          Liste ({filtered.length})
        </button>
        <button 
          onClick={() => setCurrentView('stats')}
          className={`btn ${currentView === 'stats' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ padding: "8px 24px", borderRadius: 8 }}
        >
          Statistiques
        </button>
      </div>

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
            <select className="input" style={{ width: 120, fontSize: 12 }} value={selectedMonth} onChange={e => setSelectedMonth(parseInt(e.target.value))}>
              {["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"].map((m, i) => <option key={m} value={i}>{m}</option>)}
            </select>
            <select className="input" style={{ width: 90, fontSize: 12 }} value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))}>
              {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
      )}

      {currentView === 'stats' ? (
        <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Main Key Stats */}
          <div className="bento bento-3">
            <div className="stat-card" style={{ background: "linear-gradient(135deg, var(--card), rgba(212, 160, 60, 0.05))" }}>
              <span className="stat-label">Total Affectés</span>
              <div className="stat-value" style={{ color: "var(--gold)" }}>{filtered.length}</div>
              <div className="stat-sub">{brebisCount} Brebis confirmées</div>
              <UserPlus className="stat-icon" size={40} style={{ color: "var(--gold)" }} />
            </div>
            
            <div className="stat-card" style={{ background: "linear-gradient(135deg, var(--card), rgba(91, 168, 224, 0.05))" }}>
              <span className="stat-label">Suivi Initial</span>
              <div className="stat-value" style={{ color: "var(--sky)" }}>{callsSuccess}</div>
              <div className="stat-sub">{Math.round((callsSuccess / (filtered.length || 1)) * 100)}% d'appels aboutis</div>
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
              <h3 style={{ fontSize: 18, color: "var(--gold)" }}>Progression PCNC</h3>
              <div className="badge badge-violet">{totalPCNC} Personnes engagées</div>
            </div>
            
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 20 }}>
              {[
                { label: "001 (Bienvenue dans le royaume)", val: pcnc001, color: "var(--violet)" },
                { label: "101 (Les fondements du royaume)", val: pcnc101, color: "var(--sky)" },
                { label: "201 (Les clés d'une croissance spirituelle)", val: pcnc201, color: "var(--orange)" },
                { label: "301 (Restauration et transformation)", val: pcnc301, color: "var(--green)" }
              ].map((stage) => {
                const percentage = Math.round((stage.val / (filtered.length || 1)) * 100);
                return (
                  <div key={stage.label} className="glass-compact" style={{ background: "rgba(255,255,255,0.02)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 600 }}>{stage.label}</span>
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
            <div className="glass">
              <h3 style={{ fontSize: 16, marginBottom: 15 }}>Urgence Suivi</h3>
              <div className="stat-card" style={{ padding: 15, border: "1px solid var(--red-glow)" }}>
                <span className="stat-label" style={{ color: "var(--red)" }}>Sans église locale</span>
                <div className="stat-value" style={{ fontSize: 24, color: "var(--rose)" }}>{noChurch}</div>
                <div className="stat-sub">Priorité d'intégration</div>
              </div>
            </div>
            <div className="glass">
              <h3 style={{ fontSize: 16, marginBottom: 15 }}>Engagement spirituel</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div className="glass-compact" style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: "var(--muted)" }}>INTÉRÊT PCNC</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "var(--gold)" }}>{interetPCNC}</div>
                </div>
                <div className="glass-compact" style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: "var(--muted)" }}>BAPTÊME EAU</div>
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
                  <div style={{ fontSize: 18, fontWeight: 700, color: "var(--gold)" }}>{filtered.filter(g => g.interetCDM).length}</div>
                </div>
                <div className="glass-compact" style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: "var(--muted)" }}>INTÉRÊT BAPTÊME</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "var(--sky)" }}>{filtered.filter(g => g.interetBapteme).length}</div>
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
          {/* Add Modal */}
      {isAddModalOpen && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)",
          zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center",
          padding: 20
        }}>
          <div className="glass" style={{ width: "100%", maxWidth: 600, maxHeight: "90vh", overflowY: "auto", position: "relative", padding: 30 }}>
            <button onClick={() => setIsAddModalOpen(false)} style={{ position: "absolute", top: 20, right: 20, background: "none", border: "none", color: "var(--muted)", cursor: "pointer" }}>
              <XCircle size={24} />
            </button>
            <h2 style={{ fontSize: 20, color: "var(--gold)", marginBottom: 25 }}>Nouvelle Brebi</h2>
            <form onSubmit={handleSaveGuest} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 2fr", gap: 15 }}>
                <div>
                  <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 6 }}>CIVILITÉ</label>
                  <select className="input" value={newGuest.civility} onChange={e => setNewGuest({...newGuest, civility: e.target.value})}>
                    <option value="M.">M.</option>
                    <option value="Mme.">Mme.</option>
                    <option value="Mlle.">Mlle.</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 6 }}>PRÉNOM</label>
                  <input className="input" required value={newGuest.firstName} onChange={e => setNewGuest({...newGuest, firstName: e.target.value})} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 6 }}>NOM</label>
                  <input className="input" required value={newGuest.lastName} onChange={e => setNewGuest({...newGuest, lastName: e.target.value})} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 15 }}>
                <div>
                  <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 6 }}>TÉLÉPHONE</label>
                  <input className="input" value={newGuest.phone} onChange={e => setNewGuest({...newGuest, phone: e.target.value})} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 6 }}>E-MAIL</label>
                  <input className="input" type="email" value={newGuest.email} onChange={e => setNewGuest({...newGuest, email: e.target.value})} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 15 }}>
                <div>
                  <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 6 }}>DATE D'ARRIVÉE</label>
                  <input className="input" type="date" value={newGuest.arrivalDate} onChange={e => setNewGuest({...newGuest, arrivalDate: e.target.value})} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 6 }}>ÂGE</label>
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
                  <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 6 }}>ÉVÉNEMENT</label>
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
                  <input type="checkbox" checked={newGuest.aEteInvite} onChange={e => setNewGuest({...newGuest, aEteInvite: e.target.checked})} />
                  <span style={{ fontSize: 13 }}>A été invité ?</span>
                </div>
                {newGuest.aEteInvite && (
                  <div>
                    <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 6 }}>PAR QUI ?</label>
                    <input className="input" value={newGuest.parQui} onChange={e => setNewGuest({...newGuest, parQui: e.target.value})} placeholder="Nom de l'invitant" />
                  </div>
                )}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 15, marginBottom: 15 }}>
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

              <div style={{ display: "flex", gap: 20, marginBottom: 15 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input type="checkbox" checked={newGuest.aps} onChange={e => setNewGuest({...newGuest, aps: e.target.checked})} />
                  <span style={{ fontSize: 13 }}>APS</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input type="checkbox" checked={newGuest.localChurch} onChange={e => setNewGuest({...newGuest, localChurch: e.target.checked})} />
                  <span style={{ fontSize: 13 }}>Déjà d'une église locale</span>
                </div>
              </div>

              <div style={{ marginBottom: 15 }}>
                <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 6 }}>ADRESSE</label>
                <input className="input" value={newGuest.address} onChange={e => setNewGuest({...newGuest, address: e.target.value})} />
              </div>

              <div style={{ marginBottom: 15 }}>
                <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 6 }}>COMMENTAIRE / NOTES PARTICULIÈRES</label>
                <textarea 
                  className="input" 
                  value={newGuest.commentaire} 
                  onChange={e => setNewGuest({...newGuest, commentaire: e.target.value})} 
                  placeholder="Informations complémentaires, sujet de prière..."
                  style={{ minHeight: 80, fontSize: 12 }}
                />
              </div>

              <div style={{ marginTop: 10, display: "flex", gap: 12, justifyContent: "flex-end" }}>
                <button type="button" className="btn btn-outline" onClick={() => setIsAddModalOpen(false)}>Annuler</button>
                <button type="submit" className="btn btn-primary">Enregistrer la brebi</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="glass-compact" style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 2, minWidth: 200 }}>
          <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
          <input className="input" placeholder="Rechercher une brebi..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: 36 }} />
        </div>
        
        {/* Arrival Filters */}
        <div style={{ display: "flex", gap: 10, alignItems: "center", background: "rgba(255,255,255,0.05)", padding: "4px 12px", borderRadius: 8 }}>
          <span style={{ fontSize: 11, color: "var(--gold)", fontWeight: 600 }}>ARRIVÉE :</span>
          <select className="input" value={arrivalMonth} onChange={e => setArrivalMonth(e.target.value)} style={{ width: 100, fontSize: 11, padding: "4px 8px" }}>
            <option value="all">Tous les mois</option>
            {["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"].map((m, i) => (
              <option key={i} value={i}>{m}</option>
            ))}
          </select>
          <select className="input" value={arrivalYear} onChange={e => setArrivalYear(e.target.value)} style={{ width: 80, fontSize: 11, padding: "4px 8px" }}>
            <option value="all">Toutes</option>
            {[2023, 2024, 2025, 2026].map(y => (
              <option key={y} value={y.toString()}>{y}</option>
            ))}
          </select>
        </div>

        {/* Presence Display Filters */}
        <div style={{ display: "flex", gap: 10, alignItems: "center", background: "rgba(255,255,255,0.05)", padding: "4px 12px", borderRadius: 8 }}>
          <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>PRÉSENCES :</span>
          <select 
            className="input" 
            value={selectedMonth} 
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            style={{ width: 100, fontSize: 11, padding: "4px 8px" }}
          >
            {["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"].map((m, i) => (
              <option key={i} value={i}>{m}</option>
            ))}
          </select>
          <select 
            className="input" 
            value={selectedYear} 
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            style={{ width: 80, fontSize: 11, padding: "4px 8px" }}
          >
            {[2023, 2024, 2025, 2026].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* List */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {filtered.map((guest) => {
          const rateCDM = calculateRate(guest, thursdays);
          const rateCulte = calculateRate(guest, sundays);
          const fidelised = isFidelise(guest);
          const isExpanded = expandedId === guest.id;
          const isRestricted = guest.responsible !== userName;

          return (
            <div key={guest.id} className="glass-flush" style={{ overflow: "hidden" }}>
              <div 
                onClick={() => setExpandedId(isExpanded ? null : guest.id)}
                style={{ 
                  padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between",
                  cursor: "pointer", background: isExpanded ? "rgba(255,255,255,0.03)" : "transparent"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 15, flex: 1 }}>
                  <div className={`avatar ${fidelised ? "avatar-gradient" : ""}`} style={{ width: 40, height: 40 }}>
                    {guest.firstName[0]}{guest.lastName[0]}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <h3 style={{ fontSize: 14, fontWeight: 600 }}>{guest.firstName} {guest.lastName}</h3>
                      {fidelised && <CheckCircle2 size={12} style={{ color: "var(--green)" }} />}
                      {(userRole?.toLowerCase() === "berger" || userRole?.toLowerCase().includes("second")) && !isConseiller && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); openEditModal(guest); }}
                          className="btn-icon"
                          style={{ background: "rgba(255,255,255,0.05)", padding: 6, borderRadius: 6, marginLeft: 4 }}
                          title="Modifier les informations"
                        >
                          <MoreHorizontal size={14} style={{ color: "var(--gold)" }} />
                        </button>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                      {guest.civility} · {guest.age} · Resp: {guest.responsible}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
                  <div style={{ textAlign: "right", minWidth: 60 }}>
                    <div style={{ fontSize: 9, color: "var(--muted)", textTransform: "uppercase" }}>CDM</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: rateCDM >= 45 ? "var(--green)" : "var(--rose)" }}>{rateCDM}%</div>
                  </div>
                  <div style={{ textAlign: "right", minWidth: 60 }}>
                    <div style={{ fontSize: 9, color: "var(--muted)", textTransform: "uppercase" }}>Culte</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: rateCulte >= 45 ? "var(--green)" : "var(--rose)" }}>{rateCulte}%</div>
                  </div>
                  {isExpanded ? <ChevronUp size={18} style={{ color: "var(--muted)" }} /> : <ChevronDown size={18} style={{ color: "var(--muted)" }} />}
                </div>
              </div>

              {isExpanded && (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20, padding: 20 }}>
                    {/* Info Column */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                        <Mail size={14} style={{ color: "var(--muted)" }} /> <span style={{ color: "var(--cream)" }}>{guest.email}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                        <Phone size={14} style={{ color: "var(--muted)" }} /> <span style={{ color: "var(--cream)" }}>{guest.phone}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                        <Calendar size={14} style={{ color: "var(--gold)" }} /> <span style={{ color: "var(--cream)" }}>Arrivé: {guest.arrivalDate ? guest.arrivalDate.split('-').reverse().join('/') : ''}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                        <div className="badge badge-primary" style={{ fontSize: 10 }}>{guest.event}</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                        <MapPin size={14} style={{ color: "var(--muted)" }} /> <span style={{ fontSize: 12 }}>{guest.address}</span>
                      </div>
                      <div style={{ display: "gap", gap: 10, marginTop: 5 }}>
                        <span className={`badge ${guest.aps ? "badge-green" : "badge-rose"}`}>APS: {guest.aps ? "Oui" : "Non"}</span>
                        <span className={`badge ${guest.localChurch ? "badge-green" : "badge-rose"}`}>Église: {guest.localChurch ? "Oui" : "Non"}</span>
                      </div>

                      <div style={{ marginTop: 10 }}>
                        <label style={{ fontSize: 10, color: "var(--muted)", display: "block", marginBottom: 4 }}>COMMENTAIRE ARRIVÉE</label>
                        <div style={{ fontSize: 12, color: "var(--cream)", background: "rgba(0,0,0,0.2)", padding: 8, borderRadius: 6, border: "1px solid var(--border)" }}>
                          {guest.commentaire || "Aucun commentaire"}
                        </div>
                      </div>
                      
                      {(userRole?.toLowerCase() === "berger" || userRole?.toLowerCase().includes("second")) && !isConseiller && (
                        <button 
                          className="btn btn-outline" 
                          style={{ marginTop: 15, borderColor: "#ff4d4d", color: "#ff4d4d", background: "rgba(255, 77, 77, 0.05)", fontSize: 11 }}
                          onClick={() => handleDeleteGuest(guest.id)}
                        >
                          Supprimer définitivement
                        </button>
                      )}
                    </div>

                    {/* Attendance Tracking (Dynamic) */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>
                      <div>
                        <h4 style={{ fontSize: 11, color: "var(--gold)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Présences CDM (Jeudi)</h4>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {thursdays.map((day) => (
                            <div 
                              key={day} 
                              title={day} 
                              onClick={() => !isRestricted && toggleAttendance(guest.id, day)}
                              style={{ 
                                width: 28, height: 28, borderRadius: 6, 
                                background: guest.attendance[day] ? "var(--green-glow)" : "rgba(255,255,255,0.05)",
                                border: `1px solid ${guest.attendance[day] ? "var(--green)" : "var(--border)"}`,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                color: guest.attendance[day] ? "var(--green)" : "var(--muted)",
                                cursor: isRestricted ? "default" : "pointer", transition: "all 0.2s",
                                opacity: isRestricted ? 0.4 : 1
                              }}>
                              <span style={{ fontSize: 9 }}>{parseInt(day.split('-')[2], 10)}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h4 style={{ fontSize: 11, color: "var(--gold)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Présences Culte (Dimanche)</h4>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {sundays.map((day) => (
                            <div 
                              key={day} 
                              title={day} 
                              onClick={() => !isRestricted && toggleAttendance(guest.id, day)}
                              style={{ 
                                width: 28, height: 28, borderRadius: 6, 
                                background: guest.attendance[day] ? "var(--green-glow)" : "rgba(255,255,255,0.05)",
                                border: `1px solid ${guest.attendance[day] ? "var(--green)" : "var(--border)"}`,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                color: guest.attendance[day] ? "var(--green)" : "var(--muted)",
                                cursor: isRestricted ? "default" : "pointer", transition: "all 0.2s",
                                opacity: isRestricted ? 0.4 : 1
                              }}>
                              <span style={{ fontSize: 9 }}>{parseInt(day.split('-')[2], 10)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Suivi Groups - Grid layout within details */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div className="glass-compact" style={{ background: "rgba(255,255,255,0.02)", display: "flex", flexDirection: "column", gap: 8 }}>
                        <h5 style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", marginBottom: 0 }}>Premier Contact</h5>
                          <div style={{ marginBottom: 4 }}>
                            <SuiviToggle label="Appel abouti" checked={guest.appelAbouti} onChange={() => toggleSuivi(guest.id, 'appelAbouti')} disabled={isRestricted} />
                            {!guest.appelAbouti && !isRestricted && (
                              <div 
                                className="glass-compact"
                                style={{ 
                                  marginTop: 8, 
                                  marginBottom: 8,
                                  padding: 10,
                                  background: "rgba(244, 63, 94, 0.05)",
                                  border: "1px dashed rgba(244, 63, 94, 0.3)",
                                  borderRadius: 8,
                                  animation: "fadeIn 0.3s ease-out"
                                }}
                              >
                                <label style={{ fontSize: 9, color: "var(--rose)", display: "block", marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                                  Raison de l'échec
                                </label>
                                <textarea 
                                  placeholder="Pourquoi l'appel n'a pas abouti ? (ex: Ne décroche pas, numéro invalide...)" 
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
                                    minHeight: 60,
                                    fontSize: 11, 
                                    background: "rgba(0,0,0,0.3)", 
                                    border: "1px solid rgba(255,255,255,0.1)", 
                                    borderRadius: 6, 
                                    padding: "10px", 
                                    color: "var(--cream)",
                                    resize: "vertical",
                                    lineHeight: "1.5"
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        <SuiviToggle label="Groupe WhatsApp" checked={guest.groupeWhatsapp} onChange={() => toggleSuivi(guest.id, 'groupeWhatsapp')} disabled={isRestricted} />
                        <SuiviToggle label="Prévu revenir" checked={guest.prevuRevenir} onChange={() => toggleSuivi(guest.id, 'prevuRevenir')} disabled={isRestricted} />
                        <SuiviToggle label="Revenu au culte" checked={guest.estRevenuCulte} onChange={() => toggleSuivi(guest.id, 'estRevenuCulte')} disabled={isRestricted} />
                      </div>
                      <div className="glass-compact" style={{ background: "rgba(255,255,255,0.02)", display: "flex", flexDirection: "column", gap: 8 }}>
                        <h5 style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", marginBottom: 0 }}>Engagement & C.D.M</h5>
                         <SuiviToggle label="Intérêt PCNC" checked={guest.interetFormation} onChange={() => toggleSuivi(guest.id, 'interetFormation')} disabled={isRestricted} />
                         <SuiviToggle label="Prière/Partage" checked={guest.prierePartage} onChange={() => toggleSuivi(guest.id, 'prierePartage')} disabled={isRestricted} />
                        <SuiviToggle label="Intérêt C.D.M" checked={guest.interetCDM} onChange={() => toggleSuivi(guest.id, 'interetCDM')} disabled={isRestricted} />
                        <SuiviToggle label="A intégré C.D.M" checked={guest.integreCDM} onChange={() => toggleSuivi(guest.id, 'integreCDM')} disabled={isRestricted} />
                        <SuiviToggle label="Famille Disciple" checked={guest.dansFamilleDisciple} onChange={() => toggleSuivi(guest.id, 'dansFamilleDisciple')} disabled={isRestricted} />
                        <SuiviToggle label="Intérêt Baptême" checked={guest.interetBapteme} onChange={() => toggleSuivi(guest.id, 'interetBapteme')} disabled={isRestricted} />
                        <SuiviToggle label="Cocktail" checked={guest.cocktailBienvenue} onChange={() => toggleSuivi(guest.id, 'cocktailBienvenue')} disabled={isRestricted} />
                      </div>
                    </div>

                    {/* PCNC & Service */}
                    <div className="glass-compact" style={{ background: "rgba(255,255,255,0.02)", gridColumn: "span 2" }}>
                      <h5 style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", marginBottom: 12 }}>PCNC & Intégration</h5>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
                        <SuiviToggle label="001" checked={guest.pcnc} onChange={() => toggleSuivi(guest.id, 'pcnc')} disabled={isRestricted} />
                        <SuiviToggle label="101" checked={guest.p101} onChange={() => toggleSuivi(guest.id, 'p101')} disabled={isRestricted} />
                        <SuiviToggle label="201" checked={guest.p201} onChange={() => toggleSuivi(guest.id, 'p201')} disabled={isRestricted} />
                        <SuiviToggle label="301" checked={guest.p301} onChange={() => toggleSuivi(guest.id, 'p301')} disabled={isRestricted} />
                        <SuiviToggle label="Terminé" checked={guest.terminePCNC} onChange={() => toggleSuivi(guest.id, 'terminePCNC')} disabled={isRestricted} />
                        <SuiviToggle label="Baptisé par immersion" checked={guest.baptemeEau} onChange={() => toggleSuivi(guest.id, 'baptemeEau')} disabled={isRestricted} />
                        <SuiviToggle label="Veut servir" checked={guest.veutServir} onChange={() => toggleSuivi(guest.id, 'veutServir')} disabled={isRestricted} />
                        <SuiviToggle label="Devenu STAR" checked={guest.devenuStar} onChange={() => toggleSuivi(guest.id, 'devenuStar')} disabled={isRestricted} />
                      </div>
                       <div style={{ marginTop: 15 }}>
                        <label style={{ fontSize: 10, color: "var(--muted)", display: "block", marginBottom: 4 }}>COMMENTAIRE SUIVI</label>
                        <textarea 
                          className="input" 
                          rows={3} 
                          defaultValue={guest.commentaireSuivi} 
                          disabled={isRestricted}
                          style={{ 
                            fontSize: 12, 
                            resize: "vertical", 
                            background: "rgba(0,0,0,0.3)",
                            minHeight: 60,
                            padding: 10,
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
                      <div className="glass-compact" style={{ background: "rgba(255,255,255,0.02)", gridColumn: "span 2", marginTop: 5 }}>
                        <h5 style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", marginBottom: 8 }}>Affectation (Leader Only)</h5>
                        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                          <div style={{ flex: 1 }}>
                            <select 
                              className="input" 
                              style={{ fontSize: 11, padding: "4px 8px" }}
                              value={guest.responsible} 
                              onChange={e => handleUpdateAssignment(guest.id, e.target.value)}
                            >
                              {responsibles.map(r => (
                                <option key={r} value={r}>{r}</option>
                              ))}
                            </select>
                          </div>
                          <button 
                            className="btn btn-primary" 
                            style={{ padding: "4px 12px", fontSize: 11 }}
                            onClick={() => handleSelfAssign(guest.id)}
                          >
                            M'affecter
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
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
