"use client";

import { useState, useEffect } from "react";
import { 
  Flame, Church, Loader2, CheckCircle2, XCircle,
  Calendar, MapPin, Copy, Edit3, ClipboardCheck,
  Award, BookOpen, Heart, Smile, Users, Plus, ArrowLeft, Trash2
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";

interface CRCulteData {
  id?: string;
  church_id: string;
  date_culte: string;
  salle_reception: string;
  effectif_global: number;
  avec_coordonnees: number;
  adultes_hommes: number;
  adultes_femmes: number;
  ados: number;
  enfants: number;
  aps: number;
  piliers_12: string;
  sans_eglise_locale: number;
  avec_eglise_locale: number;
  autre_eglise_icc: string;
  cadeaux_offerts: number;
  salon_lounge_effectif: number;
  bibles_distribuees: number;
  cadeaux_recus: number;
  souhait_pcnc: number;
  souhait_suivi: number;
  desir_servir: number;
  rdv_pastoral: number;
  cdm_souhait: number;
  created_at?: string;
}

export default function CrCultePage() {
  const [churches, setChurches] = useState<any[]>([]);
  const [selectedChurchId, setSelectedChurchId] = useState<string>("");
  const [loadingChurches, setLoadingChurches] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Navigation tab: 'form' | 'history'
  const [activeTab, setActiveTab] = useState<"form" | "history">("form");
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [hasSession, setHasSession] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  
  // History data state
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [filterDate, setFilterDate] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState<Omit<CRCulteData, "id" | "church_id">>({
    date_culte: new Date().toISOString().split('T')[0],
    salle_reception: "",
    effectif_global: 0,
    avec_coordonnees: 0,
    adultes_hommes: 0,
    adultes_femmes: 0,
    ados: 0,
    enfants: 0,
    aps: 0,
    piliers_12: "0",
    sans_eglise_locale: 0,
    avec_eglise_locale: 0,
    autre_eglise_icc: "0",
    cadeaux_offerts: 0,
    salon_lounge_effectif: 0,
    bibles_distribuees: 0,
    cadeaux_recus: 0,
    souhait_pcnc: 0,
    souhait_suivi: 0,
    desir_servir: 0,
    rdv_pastoral: 0,
    cdm_souhait: 0,
  });

  // Check active church session on mount
  useEffect(() => {
    const checkSession = () => {
      const selectedChurch = localStorage.getItem("selected_church");
      const connectedEmail = localStorage.getItem("church_connected_email");
      const userInfo = localStorage.getItem("poimen_user_info");
      if (selectedChurch && (connectedEmail || userInfo)) {
        setHasSession(true);
      } else {
        setHasSession(false);
      }
    };
    checkSession();
  }, []);

  // Fetch initial data
  useEffect(() => {
    const fetchChurches = async () => {
      try {
        const { data, error: chErr } = await supabase.from("churches").select("*").order("name");
        if (chErr) throw chErr;
        setChurches(data || []);

        // Pre-select church from localStorage if exists
        const savedChurch = localStorage.getItem("selected_church");
        if (savedChurch) {
          const parsed = JSON.parse(savedChurch);
          setSelectedChurchId(parsed.id);
        } else if (data && data.length > 0) {
          setSelectedChurchId(data[0].id);
        }
      } catch (err: any) {
        console.error("Failed to load churches:", err.message);
      } finally {
        setLoadingChurches(false);
      }
    };

    fetchChurches();
  }, []);

  // Fetch history list when tab switches or filter/church changes
  useEffect(() => {
    if (activeTab === "history" && selectedChurchId) {
      fetchHistory();
    }
  }, [activeTab, selectedChurchId, filterDate]);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      let query = supabase
        .from("cr_culte")
        .select(`
          *,
          churches ( name, city )
        `)
        .eq("church_id", selectedChurchId)
        .order("date_culte", { ascending: false });

      if (filterDate) {
        query = query.eq("date_culte", filterDate);
      }

      const { data, error: fetchErr } = await query;
      if (fetchErr) throw fetchErr;
      setHistoryList(data || []);
    } catch (err: any) {
      console.error("Error loading history:", err.message);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleNumericChange = (key: keyof typeof formData, value: string) => {
    const num = parseInt(value, 10);
    setFormData(prev => ({
      ...prev,
      [key]: isNaN(num) ? 0 : num
    }));
  };

  const resetForm = () => {
    setIsEditing(false);
    setEditId(null);
    setFormData({
      date_culte: new Date().toISOString().split('T')[0],
      salle_reception: "",
      effectif_global: 0,
      avec_coordonnees: 0,
      adultes_hommes: 0,
      adultes_femmes: 0,
      ados: 0,
      enfants: 0,
      aps: 0,
      piliers_12: "0",
      sans_eglise_locale: 0,
      avec_eglise_locale: 0,
      autre_eglise_icc: "0",
      cadeaux_offerts: 0,
      salon_lounge_effectif: 0,
      bibles_distribuees: 0,
      cadeaux_recus: 0,
      souhait_pcnc: 0,
      souhait_suivi: 0,
      desir_servir: 0,
      rdv_pastoral: 0,
      cdm_souhait: 0,
    });
  };

  const handleEdit = (cr: any) => {
    setEditId(cr.id);
    setIsEditing(true);
    setFormData({
      date_culte: cr.date_culte,
      salle_reception: cr.salle_reception || "",
      effectif_global: cr.effectif_global || 0,
      avec_coordonnees: cr.avec_coordonnees || 0,
      adultes_hommes: cr.adultes_hommes || 0,
      adultes_femmes: cr.adultes_femmes || 0,
      ados: cr.ados || 0,
      enfants: cr.enfants || 0,
      aps: cr.aps || 0,
      piliers_12: cr.piliers_12 || "0",
      sans_eglise_locale: cr.sans_eglise_locale || 0,
      avec_eglise_locale: cr.avec_eglise_locale || 0,
      autre_eglise_icc: cr.autre_eglise_icc || "0",
      cadeaux_offerts: cr.cadeaux_offerts || 0,
      salon_lounge_effectif: cr.salon_lounge_effectif || 0,
      bibles_distribuees: cr.bibles_distribuees || 0,
      cadeaux_recus: cr.cadeaux_recus || 0,
      souhait_pcnc: cr.souhait_pcnc || 0,
      souhait_suivi: cr.souhait_suivi || 0,
      desir_servir: cr.desir_servir || 0,
      rdv_pastoral: cr.rdv_pastoral || 0,
      cdm_souhait: cr.cdm_souhait || 0,
    });
    setActiveTab("form");
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce compte rendu ? Cette action est irréversible.")) {
      return;
    }
    try {
      const { error: delErr } = await supabase.from("cr_culte").delete().eq("id", id);
      if (delErr) throw delErr;
      fetchHistory();
    } catch (err: any) {
      alert("Erreur lors de la suppression : " + err.message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChurchId) {
      setError("Veuillez sélectionner votre église locale.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const payload = {
      ...formData,
      church_id: selectedChurchId,
    };

    try {
      if (isEditing && editId) {
        const { error: updErr } = await supabase
          .from("cr_culte")
          .update(payload)
          .eq("id", editId);
        if (updErr) throw updErr;
      } else {
        const { error: insErr } = await supabase
          .from("cr_culte")
          .insert(payload);
        if (insErr) throw insErr;
      }
      setSuccess(true);
      resetForm();
    } catch (err: any) {
      console.error("Error saving CR:", err.message);
      setError("Une erreur est survenue lors de la sauvegarde. Veuillez réessayer.");
    } finally {
      setSubmitting(false);
    }
  };

  const formatFrenchDate = (dateStr: string) => {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split("-");
    return `${day}/${month}/${year}`;
  };

  const generateWhatsAppText = (cr: any) => {
    const formattedDate = formatFrenchDate(cr.date_culte);
    const totalAdults = (cr.adultes_hommes || 0) + (cr.adultes_femmes || 0);
    const hStr = cr.adultes_hommes > 0 ? cr.adultes_hommes : "/";
    const fStr = cr.adultes_femmes > 0 ? cr.adultes_femmes : "/";
    const adosStr = cr.ados > 0 ? cr.ados : "/";
    const enfantsStr = cr.enfants > 0 ? cr.enfants : "/";
    const apsStr = cr.aps > 0 ? cr.aps : "/";
    const autreIccVal = parseInt(cr.autre_eglise_icc, 10);
    const autreIccStr = isNaN(autreIccVal) || autreIccVal === 0 ? "/" : autreIccVal.toString();

    return `*CR GLOBAL CULTE du Dimanche ${formattedDate}*

📍Sale de réception: *${cr.salle_reception || "/"}*

🔹Effectif global des invités: ${cr.effectif_global || 0}

✔️ invités ayant laissé leurs coordonnées : *${cr.avec_coordonnees || 0}*

❶ Adultes: *${totalAdults}*
- Hommes : *${hStr}*
- Femmes : *${fStr}*
    •Ados : *${adosStr}*
    . Enfants : *${enfantsStr}*
    •Aps : *${apsStr}*
    •inscrit pour les 12 piliers : *${cr.piliers_12 || "?"}*
	
➡ Invités sans église locale: *${cr.sans_eglise_locale || 0}*

➡ Invités avec église locale: *${cr.avec_eglise_locale || 0}*

➡️ Autre église ICC: ${autreIccStr}

▶️Cadeaux offerts aux invités accueillis  : ${cr.cadeaux_offerts || 0}

📍 Salon Lounge 

➡️ Effectif invité reçu: *${cr.salon_lounge_effectif || 0}*

▶️Bibles distribuées : *${cr.bibles_distribuees || 0}*
	
▶️ Cadeaux invités reçus : *${cr.cadeaux_recus || 0}* 

- Souhait inscription au PCNC: *${cr.souhait_pcnc || 0}*

- Souhait suivi: *${cr.souhait_suivi || 0}*
- Désir servir: *${cr.desir_servir || 0}*
- Rdv Pastoral: *${cr.rdv_pastoral || 0}*
- CDM: *${cr.cdm_souhait || 0}* ( *Souhait*)

Bénédictions ✨❤️`;
  };

  const copyToClipboard = (cr: any) => {
    const text = generateWhatsAppText(cr);
    navigator.clipboard.writeText(text)
      .then(() => {
        setCopiedId(cr.id || "form");
        setTimeout(() => setCopiedId(null), 2500);
      })
      .catch(err => {
        console.error("Clipboard copy failed:", err);
      });
  };

  // Pre-calculate sums for warnings/helpers
  const calculatedSum = formData.adultes_hommes + formData.adultes_femmes + formData.ados + formData.enfants;
  const isSumMismatch = calculatedSum !== formData.effectif_global && formData.effectif_global > 0;

  if (loadingChurches) {
    return (
      <div style={{ minHeight: "100dvh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--cream)" }}>
        <Loader2 className="animate-spin" size={36} style={{ color: "var(--gold)" }} />
      </div>
    );
  }

  const pageContent = (
    <>
      {/* Back Link */}
      {!hasSession && (
        <div style={{ marginBottom: 24 }} className="fade-in">
          <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--gold-light)", fontWeight: 500, textDecoration: "none", opacity: 0.8 }} className="hover:opacity-100 transition-opacity">
            <ArrowLeft size={16} />
            <span>Retour à l'accueil</span>
          </Link>
        </div>
      )}

      <header style={{ textAlign: "center", marginBottom: 36 }} className="fade-in">
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 16, gap: 8 }}>
            <Flame size={22} style={{ color: "var(--gold)" }} />
            <div style={{ width: 1, height: 24, background: "linear-gradient(180deg, transparent, var(--gold))" }} />
          </div>
          <h1 style={{ 
            fontFamily: "var(--font-display)", fontSize: "clamp(30px, 4.5vw, 38px)", fontWeight: 800, marginBottom: 8,
            background: "linear-gradient(135deg, #FFF6D6 0%, #D4AF37 55%, #AA771C 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text"
          }}>
            Compte Rendu Global Culte
          </h1>
          <p style={{ fontSize: 11, color: "var(--gold-light)", letterSpacing: 2, textTransform: "uppercase", fontWeight: 600, opacity: 0.9 }}>
            Rapport hebdomadaire des dimanches
          </p>
        </header>

        {/* Tab Navigation */}
        <div className="glass-compact" style={{ display: "flex", padding: 4, borderRadius: 50, maxWidth: 420, margin: "0 auto 30px", border: "1px solid rgba(212, 175, 55, 0.16)", background: "var(--surface-solid)" }}>
          <button 
            onClick={() => { setActiveTab("form"); }}
            style={{ 
              flex: 1, padding: "10px 16px", borderRadius: 50, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
              background: activeTab === "form" ? "linear-gradient(135deg, rgba(212,175,55,0.2) 0%, rgba(212,175,55,0.08) 100%)" : "transparent",
              color: activeTab === "form" ? "var(--gold-light)" : "var(--muted)",
              boxShadow: activeTab === "form" ? "0 4px 12px rgba(0,0,0,0.2)" : "none",
              transition: "all 0.3s ease"
            }}
          >
            {isEditing ? "Modifier le CR" : "Saisir un CR"}
          </button>
          <button 
            onClick={() => { setActiveTab("history"); }}
            style={{ 
              flex: 1, padding: "10px 16px", borderRadius: 50, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
              background: activeTab === "history" ? "linear-gradient(135deg, rgba(212,175,55,0.2) 0%, rgba(212,175,55,0.08) 100%)" : "transparent",
              color: activeTab === "history" ? "var(--gold-light)" : "var(--muted)",
              boxShadow: activeTab === "history" ? "0 4px 12px rgba(0,0,0,0.2)" : "none",
              transition: "all 0.3s ease"
            }}
          >
            Historique & Rapports
          </button>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === "form" ? (
            <motion.div
              key="form-tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
            >
              {success && (
                <div className="glass fade-in" style={{ textAlign: "center", padding: "24px 20px", border: "1px solid var(--green)", borderRadius: 16, marginBottom: 24 }}>
                  <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(16, 185, 129, 0.1)", border: "1px solid var(--green)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", color: "var(--green)" }}>
                    <CheckCircle2 size={24} />
                  </div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--green)", marginBottom: 6 }}>CR Sauvegardé !</h3>
                  <p style={{ fontSize: 13, color: "var(--cream-dim)", marginBottom: 16 }}>
                    Le rapport hebdomadaire a été enregistré avec succès dans la base de données.
                  </p>
                  <div style={{ display: "flex", justifyContent: "center", gap: 12 }}>
                    <button 
                      className="btn btn-outline" 
                      style={{ height: 38, fontSize: 12, borderColor: "var(--gold)", color: "var(--gold)" }}
                      onClick={() => {
                        setSuccess(false);
                      }}
                    >
                      Saisir un autre CR
                    </button>
                    <button 
                      className="btn btn-primary" 
                      style={{ height: 38, fontSize: 12 }}
                      onClick={() => {
                        setSuccess(false);
                        setActiveTab("history");
                      }}
                    >
                      Voir l'historique
                    </button>
                  </div>
                </div>
              )}

              <form 
                onSubmit={handleSubmit}
                className="glass"
                style={{ padding: "30px 24px", border: "1px solid rgba(212, 175, 55, 0.22)", borderRadius: 16, display: "flex", flexDirection: "column", gap: 24 }}
              >
                {isEditing && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderRadius: 8, background: "rgba(212, 175, 55, 0.1)", border: "1px solid rgba(212, 175, 55, 0.2)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--gold-light)", fontSize: 13, fontWeight: 600 }}>
                      <Edit3 size={16} />
                      <span>Mode Modification — CR du {formatFrenchDate(formData.date_culte)}</span>
                    </div>
                    <button 
                      type="button" 
                      onClick={resetForm}
                      style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 11, fontWeight: 600 }}
                    >
                      Annuler
                    </button>
                  </div>
                )}

                {/* Section 1: Informations Générales */}
                <div>
                  <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--gold)", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 16, borderBottom: "1px solid rgba(212, 175, 55, 0.15)", paddingBottom: 6 }}>
                    1. Informations Générales
                  </h3>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }} className="form-grid-2">
                    <div>
                      <label className="form-label" style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>ÉGLISE LOCALE *</label>
                      <div style={{ position: "relative" }}>
                        <Church size={18} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--gold)", opacity: 0.7 }} />
                        <select 
                          className="input" 
                          value={selectedChurchId} 
                          onChange={e => setSelectedChurchId(e.target.value)}
                          style={{ paddingLeft: 38 }}
                          required
                        >
                          <option value="" disabled>Sélectionnez l'église...</option>
                          {churches.map(c => (
                            <option key={c.id} value={c.id}>{c.name} ({c.city})</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="form-label" style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>DATE DU CULTE</label>
                      <div style={{ position: "relative" }}>
                        <Calendar size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", opacity: 0.7 }} />
                        <input 
                          className="input" 
                          type="date" 
                          value={formData.date_culte} 
                          onChange={e => setFormData({...formData, date_culte: e.target.value})} 
                          style={{ paddingLeft: 38 }}
                          required
                        />
                      </div>
                    </div>
                  </div>
                  <div style={{ marginTop: 16 }}>
                    <label className="form-label" style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>SALLE DE RÉCEPTION</label>
                    <div style={{ position: "relative" }}>
                      <MapPin size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", opacity: 0.7 }} />
                      <input 
                        className="input" 
                        value={formData.salle_reception} 
                        onChange={e => setFormData({...formData, salle_reception: e.target.value})} 
                        placeholder="Ex: Salle Poly 2, Sanctuaire Principal" 
                        style={{ paddingLeft: 38 }}
                      />
                    </div>
                  </div>
                </div>

                {/* Section 2: Réception & Profils des Invités */}
                <div>
                  <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--gold)", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 16, borderBottom: "1px solid rgba(212, 175, 55, 0.15)", paddingBottom: 6 }}>
                    2. Réception & Profils des Invités
                  </h3>
                  
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }} className="form-grid-2">
                    <NumberSpinner 
                      label="EFFECTIF GLOBAL DES INVITÉS"
                      value={formData.effectif_global} 
                      onChange={val => setFormData(prev => ({ ...prev, effectif_global: val }))}
                    />
                    <NumberSpinner 
                      label="INVITÉS AVEC COORDONNÉES"
                      value={formData.avec_coordonnees} 
                      onChange={val => setFormData(prev => ({ ...prev, avec_coordonnees: val }))}
                    />
                  </div>

                  <div style={{ background: "rgba(255,255,255,0.01)", border: "1px solid rgba(212, 175, 55, 0.1)", borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
                    <h4 style={{ fontSize: 11, fontWeight: 700, color: "var(--gold-light)", letterSpacing: 1, textTransform: "uppercase", margin: 0 }}>Détail des Âges & Rôles</h4>
                    
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12 }}>
                      <NumberSpinner 
                        label="Adultes - Hommes"
                        value={formData.adultes_hommes} 
                        onChange={val => setFormData(prev => ({ ...prev, adultes_hommes: val }))}
                        height={38}
                      />
                      <NumberSpinner 
                        label="Adultes - Femmes"
                        value={formData.adultes_femmes} 
                        onChange={val => setFormData(prev => ({ ...prev, adultes_femmes: val }))}
                        height={38}
                      />
                      <NumberSpinner 
                        label="Ados"
                        value={formData.ados} 
                        onChange={val => setFormData(prev => ({ ...prev, ados: val }))}
                        height={38}
                      />
                      <NumberSpinner 
                        label="Enfants"
                        value={formData.enfants} 
                        onChange={val => setFormData(prev => ({ ...prev, enfants: val }))}
                        height={38}
                      />
                      <NumberSpinner 
                        label="Aps"
                        value={formData.aps} 
                        onChange={val => setFormData(prev => ({ ...prev, aps: val }))}
                        height={38}
                      />
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12, marginTop: 4 }}>
                      <div>
                        <label style={{ fontSize: 11, color: "var(--cream-dim)", display: "block", marginBottom: 4 }}>Inscrit pour les 12 piliers</label>
                        <input type="text" className="input" style={{ height: 38 }} value={formData.piliers_12} onChange={e => setFormData({...formData, piliers_12: e.target.value})} placeholder="Ex: ?, 0, 3..." />
                      </div>
                    </div>

                    {isSumMismatch && (
                      <div style={{ color: "var(--orange)", fontSize: 11, display: "flex", alignItems: "center", gap: 6, background: "rgba(245, 158, 11, 0.08)", padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(245, 158, 11, 0.15)" }}>
                        <AlertTriangleIcon size={14} />
                        <span>Attention : La somme des détails (Adultes + Ados + Enfants = {calculatedSum}) ne correspond pas à l'effectif global saisi ({formData.effectif_global}).</span>
                      </div>
                    )}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginTop: 16 }} className="form-grid-3">
                    <NumberSpinner 
                      label="SANS ÉGLISE LOCALE"
                      value={formData.sans_eglise_locale} 
                      onChange={val => setFormData(prev => ({ ...prev, sans_eglise_locale: val }))}
                    />
                    <NumberSpinner 
                      label="AVEC ÉGLISE LOCALE"
                      value={formData.avec_eglise_locale} 
                      onChange={val => setFormData(prev => ({ ...prev, avec_eglise_locale: val }))}
                    />
                    <NumberSpinner 
                      label="AUTRE ÉGLISE ICC"
                      value={parseInt(formData.autre_eglise_icc, 10) || 0} 
                      onChange={val => setFormData(prev => ({ ...prev, autre_eglise_icc: val.toString() }))}
                    />
                  </div>

                  <div style={{ marginTop: 16 }}>
                    <NumberSpinner 
                      label="CADEAUX OFFERTS AUX INVITÉS ACCUEILLIS"
                      value={formData.cadeaux_offerts} 
                      onChange={val => setFormData(prev => ({ ...prev, cadeaux_offerts: val }))}
                    />
                  </div>
                </div>

                {/* Section 3: Salon Lounge */}
                <div>
                  <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--gold)", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 16, borderBottom: "1px solid rgba(212, 175, 55, 0.15)", paddingBottom: 6 }}>
                    3. Salon Lounge
                  </h3>
                  
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
                    <NumberSpinner 
                      label="EFFECTIF INVITÉ REÇU"
                      value={formData.salon_lounge_effectif} 
                      onChange={val => setFormData(prev => ({ ...prev, salon_lounge_effectif: val }))}
                    />
                    <NumberSpinner 
                      label="BIBLES DISTRIBUÉES"
                      value={formData.bibles_distribuees} 
                      onChange={val => setFormData(prev => ({ ...prev, bibles_distribuees: val }))}
                    />
                    <NumberSpinner 
                      label="CADEAUX INVITÉS REÇUS"
                      value={formData.cadeaux_recus} 
                      onChange={val => setFormData(prev => ({ ...prev, cadeaux_recus: val }))}
                    />
                  </div>

                  <div style={{ background: "rgba(255,255,255,0.01)", border: "1px solid rgba(212, 175, 55, 0.1)", borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 16, marginTop: 16 }}>
                    <h4 style={{ fontSize: 11, fontWeight: 700, color: "var(--gold-light)", letterSpacing: 1, textTransform: "uppercase", margin: 0 }}>Souhaits & Décisions</h4>
                    
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12 }}>
                      <NumberSpinner 
                        label="Souhait Inscription PCNC"
                        value={formData.souhait_pcnc} 
                        onChange={val => setFormData(prev => ({ ...prev, souhait_pcnc: val }))}
                        height={38}
                      />
                      <NumberSpinner 
                        label="Souhait Suivi"
                        value={formData.souhait_suivi} 
                        onChange={val => setFormData(prev => ({ ...prev, souhait_suivi: val }))}
                        height={38}
                      />
                      <NumberSpinner 
                        label="Désir Servir"
                        value={formData.desir_servir} 
                        onChange={val => setFormData(prev => ({ ...prev, desir_servir: val }))}
                        height={38}
                      />
                      <NumberSpinner 
                        label="Rdv Pastoral"
                        value={formData.rdv_pastoral} 
                        onChange={val => setFormData(prev => ({ ...prev, rdv_pastoral: val }))}
                        height={38}
                      />
                      <NumberSpinner 
                        label="CDM (Souhait)"
                        value={formData.cdm_souhait} 
                        onChange={val => setFormData(prev => ({ ...prev, cdm_souhait: val }))}
                        height={38}
                      />
                    </div>
                  </div>
                </div>

                {error && (
                  <div style={{ color: "var(--red)", fontSize: 13, display: "flex", alignItems: "center", gap: 8, justifyContent: "center", fontWeight: 500 }}>
                    <XCircle size={16} />
                    <span>{error}</span>
                  </div>
                )}

                <div style={{ display: "flex", gap: 16 }}>
                  {isEditing && (
                    <button 
                      type="button" 
                      className="btn btn-outline" 
                      onClick={resetForm}
                      style={{ flex: 1, height: 50, justifyContent: "center" }}
                    >
                      Annuler
                    </button>
                  )}
                  <button 
                    type="submit" 
                    className="btn btn-primary" 
                    style={{ flex: 2, height: 50, justifyContent: "center", fontSize: 14, fontWeight: 700 }}
                    disabled={submitting}
                  >
                    {submitting ? <Loader2 className="animate-spin" /> : (isEditing ? "Mettre à jour le CR" : "Enregistrer le CR")}
                  </button>
                </div>
              </form>
            </motion.div>
          ) : (
            <motion.div
              key="history-tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
              style={{ display: "flex", flexDirection: "column", gap: 20 }}
            >
              {/* Filter panel */}
              <div className="glass-compact" style={{ padding: 18, borderRadius: 12, border: "1px solid rgba(212, 175, 55, 0.16)", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Church size={16} style={{ color: "var(--gold)" }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--cream-dim)" }}>Filtres de recherche</span>
                </div>
                
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ position: "relative" }}>
                    <Calendar size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", opacity: 0.7 }} />
                    <input 
                      type="date" 
                      className="input" 
                      style={{ height: 36, fontSize: 12, paddingLeft: 30, minWidth: 160 }}
                      value={filterDate} 
                      onChange={e => setFilterDate(e.target.value)} 
                    />
                  </div>
                  {filterDate && (
                    <button 
                      type="button"
                      style={{ 
                        padding: "0 14px", 
                        height: 36, 
                        border: "1px solid rgba(212, 175, 55, 0.3)", 
                        borderRadius: "50px", 
                        background: "var(--surface-solid)", 
                        color: "var(--gold-light)", 
                        cursor: "pointer", 
                        fontSize: 12,
                        fontWeight: 600,
                        transition: "all 0.2s ease",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center"
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.borderColor = "var(--gold)";
                        e.currentTarget.style.background = "rgba(212, 175, 55, 0.08)";
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.borderColor = "rgba(212, 175, 55, 0.3)";
                        e.currentTarget.style.background = "var(--surface-solid)";
                      }}
                      onClick={() => setFilterDate("")}
                    >
                      Réinitialiser
                    </button>
                  )}
                </div>
              </div>

              {/* Loader */}
              {loadingHistory ? (
                <div style={{ padding: "60px 0", display: "flex", justifyContent: "center" }}>
                  <Loader2 className="animate-spin" size={24} style={{ color: "var(--gold)" }} />
                </div>
              ) : historyList.length === 0 ? (
                <div className="glass" style={{ textAlign: "center", padding: "40px 20px", borderRadius: 12, border: "1px solid rgba(212, 175, 55, 0.12)" }}>
                  <Users size={32} style={{ color: "var(--muted)", margin: "0 auto 12px", opacity: 0.5 }} />
                  <h4 style={{ fontSize: 15, color: "var(--cream-dim)", margin: 0, fontWeight: 600 }}>Aucun compte rendu trouvé</h4>
                  <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 6, maxWidth: 300, margin: "6px auto 0" }}>
                    Il n'y a pas encore de rapports hebdomadaires saisis pour cette église aux dates sélectionnées.
                  </p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {historyList.map(cr => {
                    const totalAdults = (cr.adultes_hommes || 0) + (cr.adultes_femmes || 0);
                    return (
                      <div 
                        key={cr.id} 
                        className="glass" 
                        style={{ padding: 20, borderRadius: 12, border: "1px solid rgba(212, 175, 55, 0.2)", display: "flex", flexDirection: "column", gap: 16, position: "relative" }}
                      >
                        {/* CR Header */}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, borderBottom: "1px solid rgba(212,175,55,0.1)", paddingBottom: 12 }}>
                          <div>
                            <span style={{ fontSize: 11, color: "var(--gold-light)", letterSpacing: 1, textTransform: "uppercase", fontWeight: 700 }}>
                              CR Culte du
                            </span>
                            <h3 style={{ fontSize: 18, fontWeight: 800, margin: "2px 0 0", color: "var(--cream)" }}>
                              Dimanche {formatFrenchDate(cr.date_culte)}
                            </h3>
                          </div>
                          
                          {/* Actions block */}
                          <div style={{ display: "flex", gap: 8 }}>
                            <button 
                              onClick={() => copyToClipboard(cr)}
                              className="btn btn-outline" 
                              style={{ height: 32, padding: "0 10px", fontSize: 11, borderColor: copiedId === cr.id ? "var(--green)" : "rgba(212,175,55,0.3)", color: copiedId === cr.id ? "var(--green)" : "var(--gold-light)", display: "flex", gap: 6, alignItems: "center" }}
                            >
                              {copiedId === cr.id ? (
                                <>
                                  <ClipboardCheck size={13} />
                                  <span>Copié !</span>
                                </>
                              ) : (
                                <>
                                  <Copy size={13} />
                                  <span>Copier WhatsApp</span>
                                </>
                              )}
                            </button>
                            <button 
                              onClick={() => handleEdit(cr)}
                              className="btn btn-outline" 
                              style={{ height: 32, padding: "0 10px", fontSize: 11, borderColor: "rgba(255,255,255,0.15)", color: "var(--cream-dim)", display: "flex", gap: 6, alignItems: "center" }}
                            >
                              <Edit3 size={13} />
                              <span>Modifier</span>
                            </button>
                            <button 
                              onClick={() => handleDelete(cr.id)}
                              className="btn-icon" 
                              style={{ height: 32, width: 32, border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: 6, color: "var(--red)", background: "rgba(239, 68, 68, 0.05)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                              title="Supprimer"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>

                        {/* CR Stats Summary Grid */}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
                          
                          {/* Reception metrics */}
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--gold)", textTransform: "uppercase", fontWeight: 700 }}>
                              <Users size={12} />
                              <span>Réception</span>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
                              <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <span style={{ color: "var(--muted)" }}>Salle :</span>
                                <span style={{ color: "var(--cream-dim)", fontWeight: 600 }}>{cr.salle_reception || "/"}</span>
                              </div>
                              <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <span style={{ color: "var(--muted)" }}>Effectif Global :</span>
                                <span style={{ color: "var(--cream)", fontWeight: 700 }}>{cr.effectif_global || 0}</span>
                              </div>
                              <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <span style={{ color: "var(--muted)" }}>Avec Coordonnées :</span>
                                <span style={{ color: "var(--cream-dim)", fontWeight: 600 }}>{cr.avec_coordonnees || 0}</span>
                              </div>
                              <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <span style={{ color: "var(--muted)" }}>Sans église locale :</span>
                                <span style={{ color: "var(--cream-dim)", fontWeight: 600 }}>{cr.sans_eglise_locale || 0}</span>
                              </div>
                              <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <span style={{ color: "var(--muted)" }}>Avec église locale :</span>
                                <span style={{ color: "var(--cream-dim)", fontWeight: 600 }}>{cr.avec_eglise_locale || 0}</span>
                              </div>
                            </div>
                          </div>

                          {/* Profile details */}
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--gold)", textTransform: "uppercase", fontWeight: 700 }}>
                              <Smile size={12} />
                              <span>Profils</span>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
                              <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <span style={{ color: "var(--muted)" }}>Adultes :</span>
                                <span style={{ color: "var(--cream-dim)", fontWeight: 600 }}>{totalAdults} (H:{cr.adultes_hommes || "/"}, F:{cr.adultes_femmes || "/"})</span>
                              </div>
                              <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <span style={{ color: "var(--muted)" }}>Ados / Enfants :</span>
                                <span style={{ color: "var(--cream-dim)", fontWeight: 600 }}>{cr.ados || "/"} / {cr.enfants || "/"}</span>
                              </div>
                              <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <span style={{ color: "var(--muted)" }}>Aps / 12 Piliers :</span>
                                <span style={{ color: "var(--cream-dim)", fontWeight: 600 }}>{cr.aps || "/"} / {cr.piliers_12 || "?"}</span>
                              </div>
                              <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <span style={{ color: "var(--muted)" }}>Cadeaux Offerts :</span>
                                <span style={{ color: "var(--cream-dim)", fontWeight: 600 }}>{cr.cadeaux_offerts || 0}</span>
                              </div>
                            </div>
                          </div>

                          {/* Salon lounge */}
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--gold)", textTransform: "uppercase", fontWeight: 700 }}>
                              <BookOpen size={12} />
                              <span>Salon Lounge & Souhaits</span>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
                              <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <span style={{ color: "var(--muted)" }}>Reçus Lounge :</span>
                                <span style={{ color: "var(--cream-dim)", fontWeight: 600 }}>{cr.salon_lounge_effectif || 0}</span>
                              </div>
                              <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <span style={{ color: "var(--muted)" }}>Bibles / Cadeaux :</span>
                                <span style={{ color: "var(--cream-dim)", fontWeight: 600 }}>{cr.bibles_distribuees || 0} / {cr.cadeaux_recus || 0}</span>
                              </div>
                              <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <span style={{ color: "var(--muted)" }}>Souhait PCNC / Suivi :</span>
                                <span style={{ color: "var(--cream-dim)", fontWeight: 600 }}>{cr.souhait_pcnc || 0} / {cr.souhait_suivi || 0}</span>
                              </div>
                              <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <span style={{ color: "var(--muted)" }}>Servir / Rdv Pastoraux :</span>
                                <span style={{ color: "var(--cream-dim)", fontWeight: 600 }}>{cr.desir_servir || 0} / {cr.rdv_pastoral || 0}</span>
                              </div>
                              <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <span style={{ color: "var(--muted)" }}>Souhait CDM :</span>
                                <span style={{ color: "var(--cream-dim)", fontWeight: 600 }}>{cr.cdm_souhait || 0}</span>
                              </div>
                            </div>
                          </div>

                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

      <style jsx global>{`
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        @media (max-width: 580px) {
          .form-grid-3 {
            grid-template-columns: 1fr !important;
          }
          .form-grid-2 {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </>
  );

  if (hasSession) {
    return (
      <div className="app-shell">
        <div className={`mobile-overlay ${mobileOpen ? "show" : ""}`} onClick={() => setMobileOpen(false)} />
        <Sidebar mobileOpen={mobileOpen} onToggleMobile={() => setMobileOpen(false)} />
        <div className="main-area">
          <Header onMenuClick={() => setMobileOpen(!mobileOpen)} />
          <main className="page-content" style={{ padding: "24px 20px" }}>
            <div style={{ maxWidth: 850, margin: "0 auto", position: "relative", zIndex: 1 }}>
              {pageContent}
            </div>
          </main>
        </div>
        <style jsx global>{`
          @media (max-width: 768px) {
            #mobile-menu-btn { display: flex !important; }
            #sidebar-close-btn { display: flex !important; }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100dvh", background: "var(--bg)", color: "var(--cream)", padding: "40px 20px", overflowX: "hidden", position: "relative" }}>
      {/* Background Decor - Divine Angelic Lights */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden" }}>
        <div style={{ 
          position: "absolute", top: "-10%", right: "-5%", width: "50vw", height: "50vw", borderRadius: "50%",
          background: "radial-gradient(circle, rgba(139,92,246,0.05) 0%, rgba(212,175,55,0.01) 55%, transparent 70%)",
          filter: "blur(80px)"
        }} />
        <div style={{ 
          position: "absolute", bottom: "-10%", left: "-5%", width: "50vw", height: "50vw", borderRadius: "50%",
          background: "radial-gradient(circle, rgba(212,175,55,0.04) 0%, rgba(56,189,248,0.01) 55%, transparent 70%)",
          filter: "blur(80px)"
        }} />
      </div>

      <div style={{ maxWidth: 850, margin: "0 auto", position: "relative", zIndex: 1 }}>
        {pageContent}
      </div>

      <style jsx global>{`
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        @media (max-width: 580px) {
          .form-grid-3 {
            grid-template-columns: 1fr !important;
          }
          .form-grid-2 {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

// Inline fallback for AlertTriangle to avoid import issues
function AlertTriangleIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

// Custom touch-friendly number input spinner for both mobile and desktop
function NumberSpinner({ 
  value, 
  onChange, 
  min = 0, 
  label,
  height = 48
}: { 
  value: number; 
  onChange: (val: number) => void; 
  min?: number;
  label?: string;
  height?: number;
}) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Allow: Backspace, Tab, Enter, Escape, Delete
    if ([46, 8, 9, 27, 13].includes(e.keyCode) ||
        // Allow: Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
        ([65, 67, 86, 88].includes(e.keyCode) && (e.ctrlKey === true || e.metaKey === true)) ||
        // Allow: home, end, left, right, up, down
        (e.keyCode >= 35 && e.keyCode <= 40)) {
      return;
    }
    // Block non-numeric characters (numpad numbers are 96-105)
    if ((e.shiftKey || (e.keyCode < 48 || e.keyCode > 57)) && (e.keyCode < 96 || e.keyCode > 105)) {
      e.preventDefault();
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%" }}>
      {label && <label className="form-label" style={{ fontWeight: 600, fontSize: 12, display: "block" }}>{label}</label>}
      <input 
        type="number" 
        min={min}
        placeholder="0"
        value={value === 0 ? "" : value} 
        onKeyDown={handleKeyDown}
        onChange={e => {
          const val = parseInt(e.target.value, 10);
          onChange(isNaN(val) ? 0 : val);
        }}
        className="input"
        style={{ 
          height: height,
          width: "100%",
          fontSize: 14, 
          fontWeight: 600,
          textAlign: "left",
          paddingLeft: 12
        }} 
      />
    </div>
  );
}
