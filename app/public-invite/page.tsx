"use client";

import { useState, useEffect } from "react";
import { 
  Flame, Church, Loader2, CheckCircle2, XCircle,
  Calendar, MapPin, Mail, Phone, User as UserIcon,
  ChevronDown
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import CustomSelect from "@/components/ui/CustomSelect";
import CustomDatePicker from "@/components/ui/CustomDatePicker";
import CountryPickerModal, { COUNTRIES } from "@/components/ui/CountryPickerModal";

const CIVILITY_OPTIONS = [
  { value: "M.", label: "M." },
  { value: "Mme.", label: "Mme." }
];

const EVENT_OPTIONS = [
  { value: "Culte", label: "Culte du dimanche" },
  { value: "Baptême", label: "Baptême" },
  { value: "Évangélisation", label: "Évangélisation" },
  { value: "Séminaire", label: "Séminaire" },
  { value: "Autre", label: "Autre" }
];

const AGE_OPTIONS = [
  { value: "Moins de 18 ans", label: "Moins de 18 ans" },
  { value: "18-25 ans", label: "18-25 ans" },
  { value: "26-30 ans", label: "26-30 ans" },
  { value: "31-35 ans", label: "31-35 ans" },
  { value: "36-40 ans", label: "36-40 ans" },
  { value: "41-45 ans", label: "41-45 ans" },
  { value: "46-50 ans", label: "46-50 ans" },
  { value: "Plus de 50 ans", label: "Plus de 50 ans" }
];

export default function PublicInvitePage() {
  const [churches, setChurches] = useState<any[]>([]);
  const [selectedChurchId, setSelectedChurchId] = useState<string>("");
  const [isUrlLocked, setIsUrlLocked] = useState(false);
  const [loadingChurches, setLoadingChurches] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isCountryModalOpen, setIsCountryModalOpen] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    civility: "M.",
    firstName: "",
    lastName: "",
    age: "26-30 ans",
    phone: "",
    email: "",
    pays: "Belgique",
    address: "",
    arrivalDate: new Date().toISOString().split('T')[0],
    event: "Culte",
    aps: false,
    localChurch: false,
    autreEglise: "",
    aEteInvite: false,
    parQui: "",
    baptemeEau: false,
    interetFormation: false,
    interetCDM: false,
    interetBapteme: false,
    commentaire: "",
  });

  useEffect(() => {
    const fetchChurches = async () => {
      try {
        const { data, error: chErr } = await supabase.from("churches").select("*").order("name");
        if (chErr) throw chErr;
        setChurches(data || []);

        // Read church_id from query parameters
        const params = new URLSearchParams(window.location.search);
        const churchParam = params.get("church_id");
        if (churchParam && data) {
          const matched = data.find(c => c.id === churchParam);
          if (matched) {
            setSelectedChurchId(matched.id);
            setIsUrlLocked(true);
          }
        }
      } catch (err: any) {
        console.error("Failed to load churches:", err.message);
      } finally {
        setLoadingChurches(false);
      }
    };

    fetchChurches();
  }, []);

  const handlePhoneKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (
      [46, 8, 9, 27, 13].includes(e.keyCode) ||
      (e.keyCode === 65 && (e.ctrlKey === true || e.metaKey === true)) || // Ctrl+A
      (e.keyCode === 67 && (e.ctrlKey === true || e.metaKey === true)) || // Ctrl+C
      (e.keyCode === 86 && (e.ctrlKey === true || e.metaKey === true)) || // Ctrl+V
      (e.keyCode === 88 && (e.ctrlKey === true || e.metaKey === true)) || // Ctrl+X
      (e.keyCode >= 35 && e.keyCode <= 39) // End, Home, Arrows
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChurchId) {
      setError("Veuillez sélectionner votre église locale.");
      return;
    }
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      setError("Le prénom et le nom sont requis.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const payload = {
      civility: formData.civility,
      first_name: formData.firstName.trim(),
      last_name: formData.lastName.trim(),
      age: formData.age,
      phone: formData.phone.trim() || null,
      email: formData.email.trim() || null,
      address: formData.address.trim() || null,
      pays: formData.pays || "Belgique",
      arrival_date: formData.arrivalDate,
      event: formData.event,
      aps: formData.aps,
      local_church: formData.localChurch,
      autre_eglise: formData.localChurch ? (formData.autreEglise.trim() || null) : null,
      a_ete_invite: formData.aEteInvite,
      par_qui: formData.aEteInvite ? formData.parQui.trim() : null,
      bapteme_eau: formData.baptemeEau,
      interet_formation: formData.interetFormation,
      interet_cdm: formData.interetCDM,
      interet_bapteme: formData.interetBapteme,
      commentaire: formData.commentaire.trim() || null,
      church_id: selectedChurchId,
      bergerie_id: null, // Public invitations go directly to integration (no family assigned)
      responsible: "Non assigné",
      assigned_to: null,
      created_by: null,
    };

    try {
      const { error: insErr } = await supabase.from("invites").insert(payload);
      if (insErr) {
        // Fallback: If autre_eglise or pays columns do not exist yet in Supabase schema cache
        const isColumnError = insErr.message && (
          insErr.message.includes("autre_eglise") || 
          insErr.message.includes("pays") || 
          insErr.code === "42703" || 
          insErr.code === "PGRST204"
        );
        if (isColumnError) {
          const fallbackPayload: any = { ...payload };
          delete fallbackPayload.autre_eglise;
          delete fallbackPayload.pays;
          const notes: string[] = [];
          if (formData.pays && formData.pays !== "Belgique") {
            notes.push(`[Pays de résidence : ${formData.pays}]`);
          }
          if (formData.localChurch && formData.autreEglise.trim()) {
            notes.push(`[Église d'origine : ${formData.autreEglise.trim()}]`);
          }
          if (notes.length > 0) {
            const extra = notes.join(" ");
            fallbackPayload.commentaire = fallbackPayload.commentaire
              ? `${extra} ${fallbackPayload.commentaire}`
              : extra;
          }
          const { error: retryErr } = await supabase.from("invites").insert(fallbackPayload);
          if (retryErr) throw retryErr;
          setSuccess(true);
          return;
        }
        throw insErr;
      }
      setSuccess(true);
    } catch (err: any) {
      console.error("Error inserting invite:", err.message);
      setError("Une erreur est survenue lors de l'enregistrement. Veuillez réessayer.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingChurches) {
    return (
      <div style={{ minHeight: "100dvh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--cream)" }}>
        <Loader2 className="animate-spin" size={36} style={{ color: "var(--gold)" }} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100dvh", background: "var(--bg)", color: "var(--cream)", padding: "60px 20px", overflowX: "hidden", position: "relative" }}>
      {/* Background Decor - Divine Angelic Lights */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden" }}>
        <motion.div 
          animate={{
            scale: [1, 1.12, 0.93, 1],
            x: [0, 40, -30, 0],
            y: [0, -50, 30, 0],
          }}
          transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
          style={{ 
            position: "absolute", top: "-15%", right: "-10%", width: "60vw", height: "60vw", borderRadius: "50%",
            background: "radial-gradient(circle, rgba(139,92,246,0.06) 0%, rgba(212,175,55,0.015) 50%, transparent 70%)",
            filter: "blur(70px)"
          }} 
        />
        <motion.div 
          animate={{
            scale: [1, 0.92, 1.15, 1],
            x: [0, -30, 40, 0],
            y: [0, 40, -40, 0],
          }}
          transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
          style={{ 
            position: "absolute", bottom: "-15%", left: "-10%", width: "55vw", height: "55vw", borderRadius: "50%",
            background: "radial-gradient(circle, rgba(212,175,55,0.05) 0%, rgba(56,189,248,0.015) 50%, transparent 70%)",
            filter: "blur(70px)"
          }} 
        />
      </div>

      <div style={{ maxWidth: 650, margin: "0 auto", position: "relative", zIndex: 1 }}>
        <header style={{ textAlign: "center", marginBottom: 40 }} className="fade-in">
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 20, gap: 8 }}>
            <Flame size={20} style={{ color: "var(--gold)" }} />
            <div style={{ width: 1, height: 30, background: "linear-gradient(180deg, transparent, var(--gold))" }} />
          </div>
          <h1 style={{ 
            fontFamily: "var(--font-display)", fontSize: "clamp(32px, 5vw, 42px)", fontWeight: 800, marginBottom: 8,
            background: "linear-gradient(135deg, #FFF6D6 0%, #D4AF37 55%, #AA771C 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text"
          }}>
            Fiche d'Arrivée
          </h1>
          <p style={{ fontSize: 12, color: "var(--gold-light)", letterSpacing: 3, textTransform: "uppercase", fontWeight: 600 }}>
            Département d'Intégration
          </p>
        </header>

        <AnimatePresence mode="wait">
          {success ? (
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass"
              style={{ textAlign: "center", padding: "50px 30px", border: "1px solid var(--green)", borderRadius: 16 }}
            >
              <div style={{ width: 70, height: 70, borderRadius: "50%", background: "rgba(16, 185, 129, 0.1)", border: "1px solid var(--green)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", color: "var(--green)" }}>
                <CheckCircle2 size={36} />
              </div>
              <h2 style={{ fontSize: 24, fontWeight: 700, color: "var(--green)", marginBottom: 14 }}>Enregistrement Réussi !</h2>
              <p style={{ fontSize: 14, color: "var(--cream-dim)", lineHeight: 1.6, maxWidth: 450, margin: "0 auto" }}>
                Merci d'avoir rempli cette fiche. Vos informations ont été enregistrées avec succès et transmises à l'équipe d'intégration. Soyez abondamment béni(e) !
              </p>
              <button 
                className="btn btn-outline" 
                style={{ marginTop: 30, borderColor: "var(--gold)", color: "var(--gold)" }}
                onClick={() => {
                  setSuccess(false);
                  setFormData({
                    civility: "M.",
                    firstName: "",
                    lastName: "",
                    age: "26-30 ans",
                    phone: "",
                    email: "",
                    pays: "Belgique",
                    address: "",
                    arrivalDate: new Date().toISOString().split('T')[0],
                    event: "Culte",
                    aps: false,
                    localChurch: false,
                    autreEglise: "",
                    aEteInvite: false,
                    parQui: "",
                    baptemeEau: false,
                    interetFormation: false,
                    interetCDM: false,
                    interetBapteme: false,
                    commentaire: "",
                  });
                }}
              >
                Enregistrer un autre invité
              </button>
            </motion.div>
          ) : (
            <motion.form 
              onSubmit={handleSubmit}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="glass"
              style={{ padding: "40px 30px", border: "1px solid rgba(212, 175, 55, 0.25)", borderRadius: 16, display: "flex", flexDirection: "column", gap: 24 }}
            >
              {/* Church Selector */}
              <div>
                <label className="form-label" style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>ÉGLISE LOCALE *</label>
                <div style={{ position: "relative" }}>
                  <Church size={18} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--gold)", opacity: 0.7 }} />
                  <CustomSelect
                    value={selectedChurchId}
                    onChange={setSelectedChurchId}
                    disabled={isUrlLocked}
                    placeholder="Sélectionnez votre église..."
                    icon={<Church size={16} />}
                    options={churches.map(c => ({
                      value: c.id,
                      label: c.name,
                      sublabel: c.city || undefined
                    }))}
                  />
                </div>
              </div>

              {/* Date & Event - Premier champ à encoder */}
              <div className="form-grid-2" style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 16 }}>
                <div>
                  <label className="form-label" style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>DATE D'ARRIVÉE *</label>
                  <CustomDatePicker
                    value={formData.arrivalDate}
                    onChange={val => setFormData({ ...formData, arrivalDate: val })}
                    placeholder="Sélectionner la date"
                  />
                </div>
                <div>
                  <label className="form-label" style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>ÉVÉNEMENT</label>
                  <CustomSelect 
                    value={formData.event} 
                    onChange={val => setFormData({...formData, event: val})}
                    options={EVENT_OPTIONS}
                    searchable={false}
                  />
                </div>
              </div>

              {/* Civility, First Name, Last Name */}
              <div className="form-grid-3" style={{ display: "grid", gridTemplateColumns: "110px 1fr 1fr", gap: 16 }}>
                <div>
                  <label className="form-label" style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>CIVILITÉ</label>
                  <CustomSelect 
                    value={formData.civility} 
                    onChange={val => setFormData({...formData, civility: val})}
                    options={CIVILITY_OPTIONS}
                    searchable={false}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>PRÉNOM *</label>
                  <input 
                    className="input" 
                    required 
                    value={formData.firstName} 
                    onChange={e => setFormData({...formData, firstName: e.target.value})} 
                    placeholder="Jean" 
                  />
                </div>
                <div>
                  <label className="form-label" style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>NOM *</label>
                  <input 
                    className="input" 
                    required 
                    value={formData.lastName} 
                    onChange={e => setFormData({...formData, lastName: e.target.value})} 
                    placeholder="Dupont" 
                  />
                </div>
              </div>

              {/* Phone & Email */}
              <div className="form-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label className="form-label" style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>TÉLÉPHONE</label>
                  <div style={{ position: "relative" }}>
                    <Phone size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", opacity: 0.7 }} />
                    <input 
                      className="input" 
                      value={formData.phone} 
                      onKeyDown={handlePhoneKeyDown}
                      onChange={e => setFormData({...formData, phone: handlePhoneChange(e.target.value)})} 
                      placeholder="+32 470 12 34 56" 
                      style={{ paddingLeft: 42 }}
                    />
                  </div>
                </div>
                <div>
                  <label className="form-label" style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>E-MAIL</label>
                  <div style={{ position: "relative" }}>
                    <Mail size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", opacity: 0.7 }} />
                    <input 
                      className="input" 
                      type="email" 
                      value={formData.email} 
                      onChange={e => setFormData({...formData, email: e.target.value})} 
                      placeholder="jean@email.com" 
                      style={{ paddingLeft: 42 }}
                    />
                  </div>
                </div>
              </div>

              {/* Tranche d'âge & Pays de résidence */}
              <div className="form-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label className="form-label" style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>TRANCHE D'ÂGE</label>
                  <CustomSelect 
                    value={formData.age} 
                    onChange={val => setFormData({...formData, age: val})}
                    options={AGE_OPTIONS}
                    searchable={false}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>PAYS DE RÉSIDENCE *</label>
                  <button
                    type="button"
                    onClick={() => setIsCountryModalOpen(true)}
                    className="input"
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "0 14px",
                      cursor: "pointer",
                      textAlign: "left",
                      height: 40,
                      background: "rgba(0,0,0,0.2)",
                      border: "1px solid rgba(212,175,55,0.3)"
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--cream)" }}>
                      <span style={{ fontSize: 18 }}>
                        {COUNTRIES.find(c => c.name.toLowerCase() === (formData.pays || "").toLowerCase())?.flag || "🌍"}
                      </span>
                      <span style={{ fontWeight: 600, color: "var(--gold-light)" }}>{formData.pays || "Belgique"}</span>
                    </span>
                    <ChevronDown size={15} style={{ color: "var(--gold)" }} />
                  </button>
                </div>
              </div>

              {/* Adresse */}
              <div>
                <label className="form-label" style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>ADRESSE / LIEU DE RÉSIDENCE</label>
                <div style={{ position: "relative" }}>
                  <MapPin size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", opacity: 0.7 }} />
                  <input 
                    className="input" 
                    value={formData.address} 
                    onChange={e => setFormData({...formData, address: e.target.value})} 
                    placeholder="Rue de l'Industrie 12, Charleroi" 
                    style={{ paddingLeft: 42 }}
                  />
                </div>
              </div>

              {/* Invitation Checkbox */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input 
                    type="checkbox" 
                    id="aEteInvite" 
                    checked={formData.aEteInvite} 
                    onChange={e => setFormData({...formData, aEteInvite: e.target.checked})}
                    style={{ width: 18, height: 18 }}
                  />
                  <label htmlFor="aEteInvite" style={{ fontSize: 14, cursor: "pointer" }}>A été invité(e) par un membre ?</label>
                </div>
                {formData.aEteInvite && (
                  <div className="fade-in">
                    <label className="form-label" style={{ display: "block", marginBottom: 8, fontSize: 11 }}>NOM DE L'INVITANT</label>
                    <input 
                      className="input" 
                      value={formData.parQui} 
                      onChange={e => setFormData({...formData, parQui: e.target.value})} 
                      placeholder="Qui vous a invité ?" 
                    />
                  </div>
                )}
              </div>

              {/* Parcours spirituel & Église */}
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)", borderRadius: 10, padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
                <h3 style={{ fontSize: 12, fontWeight: 700, color: "var(--gold)", letterSpacing: 1.5, textTransform: "uppercase", margin: 0 }}>Parcours spirituel & Église</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <input 
                      type="checkbox" 
                      id="aps" 
                      checked={formData.aps} 
                      onChange={e => setFormData({...formData, aps: e.target.checked})} 
                      style={{ width: 17, height: 17, marginTop: 2, accentColor: "var(--gold)" }} 
                    />
                    <label htmlFor="aps" style={{ fontSize: 13, cursor: "pointer", lineHeight: 1.4 }}>
                      Avez-vous déjà accepté Jésus-Christ comme votre Sauveur et Seigneur de votre vie ?
                    </label>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                      <input 
                        type="checkbox" 
                        id="localChurch" 
                        checked={formData.localChurch} 
                        onChange={e => setFormData({...formData, localChurch: e.target.checked})} 
                        style={{ width: 17, height: 17, marginTop: 2, accentColor: "var(--gold)" }} 
                      />
                      <label htmlFor="localChurch" style={{ fontSize: 13, cursor: "pointer", lineHeight: 1.4 }}>
                        Persévérez-vous déjà dans une autre église ?
                      </label>
                    </div>

                    {formData.localChurch && (
                      <div className="fade-in" style={{ paddingLeft: 27, paddingTop: 4 }}>
                        <label className="form-label" style={{ display: "block", marginBottom: 6, fontSize: 11, color: "var(--cream-dim)" }}>
                          NOM DE VOTRE ÉGLISE LOCALE
                        </label>
                        <input 
                          className="input" 
                          value={formData.autreEglise} 
                          onChange={e => setFormData({...formData, autreEglise: e.target.value})} 
                          placeholder="Ex: Nom de l'église, ville..." 
                          style={{ height: 38 }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Interests */}
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)", borderRadius: 10, padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
                <h3 style={{ fontSize: 12, fontWeight: 700, color: "var(--gold)", letterSpacing: 1.5, textTransform: "uppercase", margin: 0 }}>Intérêts & engagements</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <input type="checkbox" id="baptemeEau" checked={formData.baptemeEau} onChange={e => setFormData({...formData, baptemeEau: e.target.checked})} style={{ width: 16, height: 16 }} />
                    <label htmlFor="baptemeEau" style={{ fontSize: 13, cursor: "pointer" }}>Déjà baptisé(e) par immersion</label>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <input type="checkbox" id="interetFormation" checked={formData.interetFormation} onChange={e => setFormData({...formData, interetFormation: e.target.checked})} style={{ width: 16, height: 16 }} />
                    <label htmlFor="interetFormation" style={{ fontSize: 13, cursor: "pointer" }}>Intérêt pour les formations (PCNC)</label>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <input type="checkbox" id="interetCDM" checked={formData.interetCDM} onChange={e => setFormData({...formData, interetCDM: e.target.checked})} style={{ width: 16, height: 16 }} />
                    <label htmlFor="interetCDM" style={{ fontSize: 13, cursor: "pointer" }}>Intérêt pour les Cellules (C.D.M)</label>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <input type="checkbox" id="interetBapteme" checked={formData.interetBapteme} onChange={e => setFormData({...formData, interetBapteme: e.target.checked})} style={{ width: 16, height: 16 }} />
                    <label htmlFor="interetBapteme" style={{ fontSize: 13, cursor: "pointer" }}>Je souhaite me faire baptiser</label>
                  </div>
                </div>
              </div>

              {/* Commentaire */}
              <div>
                <label className="form-label" style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>COMMENTAIRE / SUJET DE PRIÈRE</label>
                <textarea 
                  className="input" 
                  value={formData.commentaire} 
                  onChange={e => setFormData({...formData, commentaire: e.target.value})} 
                  placeholder="Sujet de prière, besoins particuliers, remarques..."
                  style={{ minHeight: 80, fontSize: 13, padding: 12, resize: "vertical" }}
                />
              </div>

              {error && (
                <div style={{ color: "var(--red)", fontSize: 13, display: "flex", alignItems: "center", gap: 8, justifyContent: "center", fontWeight: 500 }}>
                  <XCircle size={16} />
                  <span>{error}</span>
                </div>
              )}

              <button 
                type="submit" 
                className="btn btn-primary" 
                style={{ width: "100%", height: 52, justifyContent: "center", fontSize: 15, fontWeight: 700 }}
                disabled={submitting}
              >
                {submitting ? <Loader2 className="animate-spin" /> : "Valider l'enregistrement"}
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </div>

      <CountryPickerModal
        isOpen={isCountryModalOpen}
        onClose={() => setIsCountryModalOpen(false)}
        value={formData.pays}
        onChange={(country) => setFormData(prev => ({ ...prev, pays: country }))}
      />

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
