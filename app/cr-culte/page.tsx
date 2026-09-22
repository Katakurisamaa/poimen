"use client";

import { useState, useEffect } from "react";
import { 
  Church, Loader2,
  Calendar, MapPin, Copy, Edit3, ClipboardCheck,
  BookOpen, Smile, Users, ArrowLeft, Trash2,
  AlertTriangle, Plus, Minus
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import { useFeedback } from "@/components/experience/FeedbackProvider";
import "@/app/dashboard/experience.css";
import styles from "./CrCulte.module.css";

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
  const { notify, confirm } = useFeedback();

  const [churches, setChurches] = useState<any[]>([]);
  const [selectedChurchId, setSelectedChurchId] = useState<string>("");
  const [loadingChurches, setLoadingChurches] = useState(true);
  const [submitting, setSubmitting] = useState(false);
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

        const savedChurch = localStorage.getItem("selected_church");
        if (savedChurch) {
          try {
            const parsed = JSON.parse(savedChurch);
            setSelectedChurchId(parsed.id);
          } catch {}
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
    const ok = await confirm("Êtes-vous sûr de vouloir supprimer ce compte rendu ? Cette action est irréversible.");
    if (!ok) return;

    try {
      const { error: delErr } = await supabase.from("cr_culte").delete().eq("id", id);
      if (delErr) throw delErr;
      notify("Compte rendu supprimé.");
      fetchHistory();
    } catch (err: any) {
      notify("Erreur lors de la suppression : " + err.message);
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
        notify("Compte rendu mis à jour avec succès !");
      } else {
        const { error: insErr } = await supabase
          .from("cr_culte")
          .insert(payload);
        if (insErr) throw insErr;
        notify("Compte rendu enregistré avec succès !");
      }
      resetForm();
      setActiveTab("history");
    } catch (err: any) {
      console.error("Error saving CR:", err.message);
      setError("Une erreur est survenue lors de la sauvegarde : " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const formatFrenchDate = (dateStr: string) => {
    if (!dateStr) return "";
    try {
      const [year, month, day] = dateStr.split("-");
      return `${day}/${month}/${year}`;
    } catch {
      return dateStr;
    }
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

📍Salle de réception: *${cr.salle_reception || "/"}*

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
        notify("Rapport WhatsApp copié dans le presse-papier !");
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
        <Loader2 className="animate-spin" size={32} style={{ color: "#b45309" }} />
      </div>
    );
  }

  // Stepper input component
  const StepperInput = ({
    label,
    value,
    onChange,
    min = 0,
  }: {
    label?: string;
    value: number;
    onChange: (val: number) => void;
    min?: number;
  }) => (
    <div className={styles.numberBox}>
      {label && <label className={styles.fieldLabel}>{label}</label>}
      <div className={styles.numberInputWrapper}>
        <button
          type="button"
          className={styles.numberBtn}
          onClick={() => onChange(Math.max(min, (value || 0) - 1))}
          aria-label="Diminuer"
        >
          <Minus size={13} />
        </button>
        <input
          type="number"
          min={min}
          value={value === 0 ? "" : value}
          placeholder="0"
          onChange={(e) => {
            const parsed = parseInt(e.target.value, 10);
            onChange(isNaN(parsed) ? 0 : parsed);
          }}
          className={styles.numberInput}
        />
        <button
          type="button"
          className={styles.numberBtn}
          onClick={() => onChange((value || 0) + 1)}
          aria-label="Augmenter"
        >
          <Plus size={13} />
        </button>
      </div>
    </div>
  );

  const pageContent = (
    <div>
      {/* Back Link if standalone */}
      {!hasSession && (
        <div style={{ marginBottom: 18 }}>
          <Link
            href="/"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--muted)", textDecoration: "none", fontWeight: 600 }}
          >
            <ArrowLeft size={15} /> Retour à l'accueil
          </Link>
        </div>
      )}

      {/* Page Header */}
      <header className={styles.pageHeader}>
        <div className={styles.kicker}>
          <Users size={12} /> Département Intégration
        </div>
        <h1 className={styles.pageTitle}>
          Compte Rendu Global Culte
        </h1>
        <p className={styles.pageSubtitle}>
          Rapport hebdomadaire des dimanches
        </p>
      </header>

      {/* Tab Switcher */}
      <div className={styles.tabSwitcher}>
        <button
          onClick={() => setActiveTab("form")}
          className={`${styles.tabBtn} ${activeTab === "form" ? styles.tabBtnActive : ""}`}
        >
          <Edit3 size={13} /> {isEditing ? "Modifier le CR" : "Saisir un CR"}
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`${styles.tabBtn} ${activeTab === "history" ? styles.tabBtnActive : ""}`}
        >
          <BookOpen size={13} /> Historique & Rapports
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === "form" ? (
          <motion.div
            key="form-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.18 }}
          >
            <form onSubmit={handleSubmit} className={styles.formCard}>
              {isEditing && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: 8, background: "rgba(180, 83, 9, 0.1)", border: "1px solid rgba(180, 83, 9, 0.25)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#b45309", fontSize: 13, fontWeight: 700 }}>
                    <Edit3 size={15} />
                    <span>Mode Modification — CR du {formatFrenchDate(formData.date_culte)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={resetForm}
                    style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 12, fontWeight: 600 }}
                  >
                    Annuler
                  </button>
                </div>
              )}

              {/* ── 1. Informations Générales ── */}
              <div>
                <h3 className={styles.formSectionTitle}>
                  1. Informations Générales
                </h3>
                <div className={styles.grid2}>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Église Locale *</label>
                    <div className={styles.inputIconWrapper}>
                      <Church size={16} className={styles.inputIcon} />
                      <select
                        className={styles.selectInput}
                        value={selectedChurchId}
                        onChange={e => setSelectedChurchId(e.target.value)}
                        required
                      >
                        <option value="" disabled>Sélectionnez l'église…</option>
                        {churches.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Date du Culte *</label>
                    <div className={styles.inputIconWrapper}>
                      <Calendar size={16} className={styles.inputIcon} />
                      <input
                        type="date"
                        className={styles.textInput}
                        value={formData.date_culte}
                        onChange={e => setFormData({ ...formData, date_culte: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className={styles.fieldGroup} style={{ marginTop: 12 }}>
                  <label className={styles.fieldLabel}>Salle de Réception</label>
                  <div className={styles.inputIconWrapper}>
                    <MapPin size={16} className={styles.inputIcon} />
                    <input
                      type="text"
                      className={styles.textInput}
                      value={formData.salle_reception}
                      onChange={e => setFormData({ ...formData, salle_reception: e.target.value })}
                      placeholder="Ex: Sanctuaire Principal, Salle Poly 2…"
                    />
                  </div>
                </div>
              </div>

              {/* ── 2. Réception & Profils des Invités ── */}
              <div>
                <h3 className={styles.formSectionTitle}>
                  2. Réception & Profils des Invités
                </h3>

                <div className={styles.grid2} style={{ marginBottom: 12 }}>
                  <StepperInput
                    label="Effectif global des invités"
                    value={formData.effectif_global}
                    onChange={val => setFormData(prev => ({ ...prev, effectif_global: val }))}
                  />
                  <StepperInput
                    label="Invités avec coordonnées"
                    value={formData.avec_coordonnees}
                    onChange={val => setFormData(prev => ({ ...prev, avec_coordonnees: val }))}
                  />
                </div>

                {/* Sub-box: Détails Âges & Rôles */}
                <div className={styles.subSectionBox}>
                  <h4 className={styles.subSectionHeader}>
                    Détail des Âges & Rôles
                  </h4>
                  <div className={styles.gridSpinners}>
                    <StepperInput
                      label="Hommes"
                      value={formData.adultes_hommes}
                      onChange={val => setFormData(prev => ({ ...prev, adultes_hommes: val }))}
                    />
                    <StepperInput
                      label="Femmes"
                      value={formData.adultes_femmes}
                      onChange={val => setFormData(prev => ({ ...prev, adultes_femmes: val }))}
                    />
                    <StepperInput
                      label="Ados"
                      value={formData.ados}
                      onChange={val => setFormData(prev => ({ ...prev, ados: val }))}
                    />
                    <StepperInput
                      label="Enfants"
                      value={formData.enfants}
                      onChange={val => setFormData(prev => ({ ...prev, enfants: val }))}
                    />
                    <StepperInput
                      label="Aps"
                      value={formData.aps}
                      onChange={val => setFormData(prev => ({ ...prev, aps: val }))}
                    />
                  </div>

                  {isSumMismatch && (
                    <div className={styles.sumWarning}>
                      <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                      <span>
                        Attention : la somme (Hommes {formData.adultes_hommes} + Femmes {formData.adultes_femmes} + Ados {formData.ados} + Enfants {formData.enfants} = {calculatedSum}) diffère de l'effectif global ({formData.effectif_global}).
                      </span>
                    </div>
                  )}

                  <div className={styles.fieldGroup} style={{ marginTop: 4 }}>
                    <label className={styles.fieldLabel}>Inscrit pour les 12 Piliers</label>
                    <input
                      type="text"
                      className={styles.textInput}
                      style={{ paddingLeft: 12 }}
                      value={formData.piliers_12}
                      onChange={e => setFormData({ ...formData, piliers_12: e.target.value })}
                      placeholder="Ex: ?, 0, 3…"
                    />
                  </div>
                </div>

                {/* Sub-box: Appartenance & Cadeaux */}
                <div className={styles.subSectionBox}>
                  <h4 className={styles.subSectionHeader}>
                    Appartenance Ecclésiale & Cadeaux
                  </h4>
                  <div className={styles.gridSpinners}>
                    <StepperInput
                      label="Sans église locale"
                      value={formData.sans_eglise_locale}
                      onChange={val => setFormData(prev => ({ ...prev, sans_eglise_locale: val }))}
                    />
                    <StepperInput
                      label="Avec église locale"
                      value={formData.avec_eglise_locale}
                      onChange={val => setFormData(prev => ({ ...prev, avec_eglise_locale: val }))}
                    />
                    <StepperInput
                      label="Cadeaux offerts"
                      value={formData.cadeaux_offerts}
                      onChange={val => setFormData(prev => ({ ...prev, cadeaux_offerts: val }))}
                    />
                  </div>

                  <div className={styles.fieldGroup} style={{ marginTop: 4 }}>
                    <label className={styles.fieldLabel}>Autre église ICC</label>
                    <input
                      type="text"
                      className={styles.textInput}
                      style={{ paddingLeft: 12 }}
                      value={formData.autre_eglise_icc}
                      onChange={e => setFormData({ ...formData, autre_eglise_icc: e.target.value })}
                      placeholder="Ex: 0, 2, ou nom de l'église…"
                    />
                  </div>
                </div>
              </div>

              {/* ── 3. Salon Lounge & Décisions ── */}
              <div>
                <h3 className={styles.formSectionTitle}>
                  3. Salon Lounge & Décisions
                </h3>

                <div className={styles.gridSpinners}>
                  <StepperInput
                    label="Effectif Salon Lounge"
                    value={formData.salon_lounge_effectif}
                    onChange={val => setFormData(prev => ({ ...prev, salon_lounge_effectif: val }))}
                  />
                  <StepperInput
                    label="Bibles distribuées"
                    value={formData.bibles_distribuees}
                    onChange={val => setFormData(prev => ({ ...prev, bibles_distribuees: val }))}
                  />
                  <StepperInput
                    label="Cadeaux invités reçus"
                    value={formData.cadeaux_recus}
                    onChange={val => setFormData(prev => ({ ...prev, cadeaux_recus: val }))}
                  />
                </div>

                <div className={styles.subSectionBox}>
                  <h4 className={styles.subSectionHeader}>
                    Souhaits & Décisions Exprimés
                  </h4>
                  <div className={styles.gridSpinners}>
                    <StepperInput
                      label="Inscription PCNC"
                      value={formData.souhait_pcnc}
                      onChange={val => setFormData(prev => ({ ...prev, souhait_pcnc: val }))}
                    />
                    <StepperInput
                      label="Souhait de Suivi"
                      value={formData.souhait_suivi}
                      onChange={val => setFormData(prev => ({ ...prev, souhait_suivi: val }))}
                    />
                    <StepperInput
                      label="Désir de Servir"
                      value={formData.desir_servir}
                      onChange={val => setFormData(prev => ({ ...prev, desir_servir: val }))}
                    />
                    <StepperInput
                      label="RDV Pastoral"
                      value={formData.rdv_pastoral}
                      onChange={val => setFormData(prev => ({ ...prev, rdv_pastoral: val }))}
                    />
                    <StepperInput
                      label="CDM (Souhait)"
                      value={formData.cdm_souhait}
                      onChange={val => setFormData(prev => ({ ...prev, cdm_souhait: val }))}
                    />
                  </div>
                </div>
              </div>

              {error && (
                <div style={{ color: "#dc2626", fontSize: 13, display: "flex", alignItems: "center", gap: 6, justifyContent: "center", fontWeight: 600 }}>
                  <AlertTriangle size={15} />
                  <span>{error}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className={styles.btnRow}>
                {isEditing && (
                  <button
                    type="button"
                    className={styles.btnCancel}
                    onClick={resetForm}
                  >
                    Annuler
                  </button>
                )}
                <button
                  type="submit"
                  className={styles.btnSubmit}
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Enregistrement…</span>
                    </>
                  ) : (
                    isEditing ? "Mettre à jour le compte rendu" : "Enregistrer le compte rendu"
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        ) : (
          /* ── HISTORIQUE TAB ── */
          <motion.div
            key="history-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.18 }}
          >
            {/* Filter bar */}
            <div className={styles.historyFilterBar}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, color: "var(--cream)" }}>
                <Church size={16} style={{ color: "#b45309" }} />
                <span>Rapports enregistrés</span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <div style={{ position: "relative" }}>
                  <Calendar size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
                  <input
                    type="date"
                    className={styles.textInput}
                    style={{ height: 34, fontSize: 12, paddingLeft: 30, width: 150 }}
                    value={filterDate}
                    onChange={e => setFilterDate(e.target.value)}
                  />
                </div>
                {filterDate && (
                  <button
                    type="button"
                    onClick={() => setFilterDate("")}
                    className={styles.btnHistoryAction}
                  >
                    Réinitialiser
                  </button>
                )}
              </div>
            </div>

            {loadingHistory ? (
              <div style={{ padding: "60px 0", display: "flex", justifyContent: "center" }}>
                <Loader2 className="animate-spin" size={26} style={{ color: "#b45309" }} />
              </div>
            ) : historyList.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 20px", background: "var(--surface-solid)", border: "1px solid var(--border)", borderRadius: 12 }}>
                <Users size={32} style={{ color: "var(--muted)", margin: "0 auto 10px", opacity: 0.6 }} />
                <h4 style={{ fontSize: 15, color: "var(--cream)", margin: 0, fontWeight: 700 }}>Aucun compte rendu trouvé</h4>
                <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                  Aucun rapport n'a encore été enregistré pour cette église aux dates sélectionnées.
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {historyList.map(cr => {
                  const totalAdults = (cr.adultes_hommes || 0) + (cr.adultes_femmes || 0);
                  return (
                    <div key={cr.id} className={styles.historyCard}>
                      {/* Header */}
                      <div className={styles.historyCardHeader}>
                        <div>
                          <span style={{ fontSize: 10.5, color: "#b45309", letterSpacing: 1, textTransform: "uppercase", fontWeight: 800 }}>
                            Culte du Dimanche
                          </span>
                          <h3 className={styles.historyDateTitle}>
                            Dimanche {formatFrenchDate(cr.date_culte)}
                          </h3>
                        </div>

                        <div className={styles.historyActions}>
                          <button
                            onClick={() => copyToClipboard(cr)}
                            className={styles.btnHistoryAction}
                            title="Copier le texte formaté pour WhatsApp"
                          >
                            {copiedId === cr.id ? <ClipboardCheck size={13} style={{ color: "#15803d" }} /> : <Copy size={13} />}
                            <span>{copiedId === cr.id ? "Copié !" : "Copier WhatsApp"}</span>
                          </button>
                          <button
                            onClick={() => handleEdit(cr)}
                            className={styles.btnHistoryAction}
                            title="Modifier ce compte rendu"
                          >
                            <Edit3 size={13} />
                            <span>Modifier</span>
                          </button>
                          <button
                            onClick={() => handleDelete(cr.id)}
                            className={`${styles.btnHistoryAction} ${styles.btnHistoryDelete}`}
                            title="Supprimer ce compte rendu"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Metrics 3-Columns Grid */}
                      <div className={styles.historyMetricsGrid}>
                        {/* 1. Réception */}
                        <div className={styles.metricColumn}>
                          <div className={styles.metricColTitle}>
                            <Users size={12} /> Réception
                          </div>
                          <div className={styles.metricRow}>
                            <span className={styles.metricLabel}>Salle :</span>
                            <span className={styles.metricVal}>{cr.salle_reception || "/"}</span>
                          </div>
                          <div className={styles.metricRow}>
                            <span className={styles.metricLabel}>Effectif global :</span>
                            <span className={styles.metricVal}>{cr.effectif_global || 0}</span>
                          </div>
                          <div className={styles.metricRow}>
                            <span className={styles.metricLabel}>Avec coordonnées :</span>
                            <span className={styles.metricVal}>{cr.avec_coordonnees || 0}</span>
                          </div>
                          <div className={styles.metricRow}>
                            <span className={styles.metricLabel}>Sans église locale :</span>
                            <span className={styles.metricVal}>{cr.sans_eglise_locale || 0}</span>
                          </div>
                          <div className={styles.metricRow}>
                            <span className={styles.metricLabel}>Avec église locale :</span>
                            <span className={styles.metricVal}>{cr.avec_eglise_locale || 0}</span>
                          </div>
                        </div>

                        {/* 2. Profils */}
                        <div className={styles.metricColumn}>
                          <div className={styles.metricColTitle}>
                            <Smile size={12} /> Profils
                          </div>
                          <div className={styles.metricRow}>
                            <span className={styles.metricLabel}>Adultes :</span>
                            <span className={styles.metricVal}>{totalAdults} (H: {cr.adultes_hommes || "/"}, F: {cr.adultes_femmes || "/"})</span>
                          </div>
                          <div className={styles.metricRow}>
                            <span className={styles.metricLabel}>Ados / Enfants :</span>
                            <span className={styles.metricVal}>{cr.ados || "/"} / {cr.enfants || "/"}</span>
                          </div>
                          <div className={styles.metricRow}>
                            <span className={styles.metricLabel}>Aps / 12 Piliers :</span>
                            <span className={styles.metricVal}>{cr.aps || "/"} / {cr.piliers_12 || "?"}</span>
                          </div>
                          <div className={styles.metricRow}>
                            <span className={styles.metricLabel}>Cadeaux offerts :</span>
                            <span className={styles.metricVal}>{cr.cadeaux_offerts || 0}</span>
                          </div>
                          <div className={styles.metricRow}>
                            <span className={styles.metricLabel}>Autre église ICC :</span>
                            <span className={styles.metricVal}>{cr.autre_eglise_icc || "/"}</span>
                          </div>
                        </div>

                        {/* 3. Salon Lounge & Décisions */}
                        <div className={styles.metricColumn}>
                          <div className={styles.metricColTitle}>
                            <BookOpen size={12} /> Salon Lounge & Décisions
                          </div>
                          <div className={styles.metricRow}>
                            <span className={styles.metricLabel}>Reçus Lounge :</span>
                            <span className={styles.metricVal}>{cr.salon_lounge_effectif || 0}</span>
                          </div>
                          <div className={styles.metricRow}>
                            <span className={styles.metricLabel}>Bibles / Cadeaux :</span>
                            <span className={styles.metricVal}>{cr.bibles_distribuees || 0} / {cr.cadeaux_recus || 0}</span>
                          </div>
                          <div className={styles.metricRow}>
                            <span className={styles.metricLabel}>PCNC / Suivi :</span>
                            <span className={styles.metricVal}>{cr.souhait_pcnc || 0} / {cr.souhait_suivi || 0}</span>
                          </div>
                          <div className={styles.metricRow}>
                            <span className={styles.metricLabel}>Servir / RDV Pastoral :</span>
                            <span className={styles.metricVal}>{cr.desir_servir || 0} / {cr.rdv_pastoral || 0}</span>
                          </div>
                          <div className={styles.metricRow}>
                            <span className={styles.metricLabel}>CDM (Souhait) :</span>
                            <span className={styles.metricVal}>{cr.cdm_souhait || 0}</span>
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
    </div>
  );

  // If inside active dashboard session, render within the app-shell
  if (hasSession) {
    return (
      <div className="app-shell experience-shell">
        <Sidebar mobileOpen={mobileOpen} onToggleMobile={() => setMobileOpen(!mobileOpen)} />
        <div className="main-area">
          <Header onMenuClick={() => setMobileOpen(!mobileOpen)} />
          <main className="page-content" style={{ padding: "20px 24px" }}>
            <div style={{ maxWidth: 880, margin: "0 auto" }}>
              {pageContent}
            </div>
          </main>
        </div>
      </div>
    );
  }

  // Standalone public/guest view
  return (
    <div className={styles.standaloneContainer}>
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        {pageContent}
      </div>
    </div>
  );
}
