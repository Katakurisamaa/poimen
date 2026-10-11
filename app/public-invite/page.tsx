"use client";

import { useState, useEffect } from "react";
import { 
  Flame, Church, Loader2, CheckCircle2, XCircle,
  Calendar, MapPin, Mail, Phone, User as UserIcon,
  ChevronDown, UserPlus, Users, Check, Sparkles
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

function YesNoToggle({
  value,
  onChange,
}: {
  value: boolean | null;
  onChange: (val: boolean) => void;
}) {
  return (
    <div className="yes-no-toggle-group">
      <button
        type="button"
        onClick={() => onChange(true)}
        className={`yes-no-btn ${value === true ? "active-yes" : ""}`}
        aria-pressed={value === true}
      >
        {value === true && <Check size={13} strokeWidth={2.5} style={{ marginRight: 4 }} />}
        Oui
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        className={`yes-no-btn ${value === false ? "active-no" : ""}`}
        aria-pressed={value === false}
      >
        Non
      </button>
    </div>
  );
}

export default function PublicInvitePage() {
  const [churches, setChurches] = useState<any[]>([]);
  const [selectedChurchId, setSelectedChurchId] = useState<string>("");
  const [isUrlLocked, setIsUrlLocked] = useState(false);
  const [loadingChurches, setLoadingChurches] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pendingAction, setPendingAction] = useState<"finish" | "add_another">("finish");
  const [success, setSuccess] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [lastSavedGuestName, setLastSavedGuestName] = useState<string>("");
  const [sessionCount, setSessionCount] = useState<number>(0);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [isCountryModalOpen, setIsCountryModalOpen] = useState(false);

  // Form State
  const [formData, setFormData] = useState<{
    civility: string;
    firstName: string;
    lastName: string;
    age: string;
    phone: string;
    email: string;
    pays: string;
    address: string;
    arrivalDate: string;
    event: string;
    aps: boolean | null;
    localChurch: boolean | null;
    autreEglise: string;
    aEteInvite: boolean;
    parQui: string;
    baptemeEau: boolean | null;
    interetFormation: boolean | null;
    interetCDM: boolean | null;
    interetBapteme: boolean;
    commentaire: string;
  }>({
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
    aps: null,
    localChurch: null,
    autreEglise: "",
    aEteInvite: false,
    parQui: "",
    baptemeEau: null,
    interetFormation: null,
    interetCDM: null,
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

  const resetForNextGuest = (mode: "family" | "blank") => {
    setSuccess(false);
    setIsFinished(false);
    setError(null);
    if (mode === "family") {
      setFormData(prev => ({
        ...prev,
        civility: prev.civility === "M." ? "Mme." : "M.",
        firstName: "",
        phone: "",
        email: "",
        age: "26-30 ans",
        aps: null,
        localChurch: null,
        autreEglise: "",
        baptemeEau: null,
        interetFormation: null,
        interetCDM: null,
        interetBapteme: false,
        commentaire: "",
      }));
      setBannerMessage("Informations de culte et de famille conservées. Vous pouvez saisir le prochain invité.");
    } else {
      setFormData(prev => ({
        civility: "M.",
        firstName: "",
        lastName: "",
        age: "26-30 ans",
        phone: "",
        email: "",
        pays: "Belgique",
        address: "",
        arrivalDate: prev.arrivalDate,
        event: prev.event,
        aps: null,
        localChurch: null,
        autreEglise: "",
        aEteInvite: false,
        parQui: "",
        baptemeEau: null,
        interetFormation: null,
        interetCDM: null,
        interetBapteme: false,
        commentaire: "",
      }));
      setBannerMessage(null);
    }
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleSubmit = async (e?: React.FormEvent, mode: "finish" | "add_another" = "finish") => {
    if (e && e.preventDefault) {
      e.preventDefault();
    }
    if (!selectedChurchId) {
      setError("Veuillez sélectionner votre église locale.");
      return;
    }
    if (!formData.arrivalDate) {
      setError("La date d'arrivée est requise.");
      return;
    }
    if (!formData.event) {
      setError("L'événement est requis.");
      return;
    }
    if (!formData.civility) {
      setError("La civilité est requise.");
      return;
    }
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      setError("Le prénom et le nom sont requis.");
      return;
    }
    if (!formData.phone.trim()) {
      setError("Le numéro de téléphone est requis.");
      return;
    }
    if (!formData.pays) {
      setError("Le pays de résidence est requis.");
      return;
    }
    if (formData.aps === null) {
      setError("Veuillez répondre à : « Avez-vous déjà accepté Jésus-Christ comme Sauveur et Seigneur ? » (Oui ou Non)");
      return;
    }
    if (formData.localChurch === null) {
      setError("Veuillez répondre à : « Persévérez-vous déjà dans une autre église ? » (Oui ou Non)");
      return;
    }
    if (formData.localChurch === true && !formData.autreEglise.trim()) {
      setError("Veuillez préciser le nom de votre église d'origine.");
      return;
    }
    if (formData.baptemeEau === null) {
      setError("Veuillez répondre à : « Déjà baptisé(e) par immersion » (Oui ou Non)");
      return;
    }
    if (formData.interetFormation === null) {
      setError("Veuillez répondre à : « Intérêt pour les formations (PCNC) » (Oui ou Non)");
      return;
    }
    if (formData.interetCDM === null) {
      setError("Veuillez répondre à : « Intérêt pour les Cellules (C.D.M) » (Oui ou Non)");
      return;
    }

    setPendingAction(mode);
    setSubmitting(true);
    setError(null);

    const savedName = `${formData.firstName.trim()} ${formData.lastName.trim()}`;

    const payload = {
      civility: formData.civility,
      first_name: formData.firstName.trim(),
      last_name: formData.lastName.trim(),
      age: formData.age,
      phone: formData.phone.trim(),
      email: formData.email.trim() || null,
      address: formData.address.trim() || null,
      pays: formData.pays || "Belgique",
      arrival_date: formData.arrivalDate,
      event: formData.event,
      aps: formData.aps === true,
      local_church: formData.localChurch === true,
      autre_eglise: formData.localChurch ? (formData.autreEglise.trim() || null) : null,
      a_ete_invite: formData.aEteInvite,
      par_qui: formData.aEteInvite ? formData.parQui.trim() : null,
      bapteme_eau: formData.baptemeEau === true,
      interet_formation: formData.interetFormation === true,
      interet_cdm: formData.interetCDM === true,
      interet_bapteme: formData.interetBapteme,
      commentaire: formData.commentaire.trim() || null,
      church_id: selectedChurchId,
      bergerie_id: null, // Public invitations go directly to integration (no family assigned)
      responsible: "Non assigné",
      assigned_to: null,
      created_by: null,
    };

    const onSaveSuccess = () => {
      setLastSavedGuestName(savedName);
      setSessionCount(prev => prev + 1);
      if (mode === "add_another") {
        setFormData(prev => ({
          ...prev,
          civility: prev.civility === "M." ? "Mme." : "M.",
          firstName: "",
          // Conserve le nom de famille pour les membres de la même famille
          phone: "",
          email: "",
          age: "26-30 ans",
          aps: null,
          localChurch: null,
          autreEglise: "",
          baptemeEau: null,
          interetFormation: null,
          interetCDM: null,
          interetBapteme: false,
          commentaire: "",
        }));
        setBannerMessage(`✓ ${savedName} a été enregistré(e) avec succès ! Vous pouvez renseigner le prochain invité.`);
        if (typeof window !== "undefined") {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      } else {
        setSuccess(true);
        setIsFinished(false);
      }
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
          onSaveSuccess();
          return;
        }
        throw insErr;
      }
      onSaveSuccess();
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
          {isFinished ? (
            <motion.div 
              key="finished"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass"
              style={{ textAlign: "center", padding: "50px 30px", border: "1px solid rgba(212, 175, 55, 0.35)", borderRadius: 16 }}
            >
              <div style={{ width: 70, height: 70, borderRadius: "50%", background: "rgba(212, 175, 55, 0.12)", border: "1px solid var(--gold)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", color: "var(--gold)" }}>
                <CheckCircle2 size={36} />
              </div>
              <h2 style={{ fontSize: 24, fontWeight: 700, color: "var(--gold)", marginBottom: 14 }}>Saisie Terminée !</h2>
              <p style={{ fontSize: 14, color: "var(--cream-dim)", lineHeight: 1.6, maxWidth: 450, margin: "0 auto 28px" }}>
                Toutes les fiches d'invités ont été enregistrées avec succès et transmises au Département d'Intégration. Merci pour votre dévouement et que Dieu vous bénisse abondamment !
              </p>
              <button 
                type="button"
                className="btn btn-outline" 
                style={{ borderColor: "var(--gold)", color: "var(--gold)", margin: "0 auto", gap: 8 }}
                onClick={() => resetForNextGuest("blank")}
              >
                <UserPlus size={16} />
                <span>Remplir une nouvelle fiche</span>
              </button>
            </motion.div>
          ) : success ? (
            <motion.div 
              key="success"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass"
              style={{ textAlign: "center", padding: "40px 24px", border: "1px solid var(--green)", borderRadius: 16 }}
            >
              <div style={{ width: 66, height: 66, borderRadius: "50%", background: "rgba(16, 185, 129, 0.12)", border: "1px solid var(--green)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", color: "var(--green)" }}>
                <CheckCircle2 size={36} />
              </div>
              <h2 style={{ fontSize: 24, fontWeight: 700, color: "var(--green)", marginBottom: 12 }}>Enregistrement Réussi !</h2>
              <p style={{ fontSize: 14, color: "var(--cream-dim)", lineHeight: 1.6, maxWidth: 480, margin: "0 auto 26px" }}>
                {lastSavedGuestName ? (
                  <>La fiche de <strong style={{ color: "var(--cream)", fontWeight: 600 }}>{lastSavedGuestName}</strong> a été enregistrée avec succès et transmise à l'équipe d'intégration.</>
                ) : (
                  <>Merci d'avoir rempli cette fiche. Vos informations ont été enregistrées avec succès et transmises à l'équipe d'intégration.</>
                )}
              </p>

              {/* Question: Souhaitez-vous enregistrer un autre invité ? */}
              <div style={{ 
                background: "rgba(255, 255, 255, 0.03)", 
                border: "1px solid rgba(212, 175, 55, 0.25)", 
                borderRadius: 14, 
                padding: "22px 18px",
                margin: "0 auto 22px",
                maxWidth: 520,
                textAlign: "left"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  <Users size={18} style={{ color: "var(--gold)" }} />
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--gold)", margin: 0 }}>
                    Souhaitez-vous enregistrer un autre invité ?
                  </h3>
                </div>
                <p style={{ fontSize: 13, color: "var(--cream-dim)", margin: "0 0 16px 0", lineHeight: 1.4 }}>
                  Par exemple un conjoint, un membre de sa famille, un ami ou une autre personne présente :
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <button 
                    type="button"
                    className="btn btn-primary" 
                    style={{ 
                      width: "100%", 
                      minHeight: 50, 
                      padding: "10px 16px",
                      justifyContent: "flex-start", 
                      fontSize: 14, 
                      fontWeight: 600,
                      gap: 12
                    }}
                    onClick={() => resetForNextGuest("family")}
                  >
                    <Users size={18} style={{ flexShrink: 0 }} />
                    <div style={{ textAlign: "left" }}>
                      <div>Ajouter un membre de la même famille / groupe</div>
                      <div style={{ fontSize: 11, fontWeight: 400, opacity: 0.9 }}>
                        Conserve l'église, la date, l'adresse, le nom et qui l'a invité
                      </div>
                    </div>
                  </button>

                  <button 
                    type="button"
                    className="btn btn-outline" 
                    style={{ 
                      width: "100%", 
                      minHeight: 50, 
                      padding: "10px 16px",
                      justifyContent: "flex-start", 
                      fontSize: 14, 
                      fontWeight: 600,
                      borderColor: "rgba(212, 175, 55, 0.45)",
                      color: "var(--cream)",
                      gap: 12
                    }}
                    onClick={() => resetForNextGuest("blank")}
                  >
                    <UserPlus size={18} style={{ color: "var(--gold)", flexShrink: 0 }} />
                    <div style={{ textAlign: "left" }}>
                      <div>Nouvel invité indépendant</div>
                      <div style={{ fontSize: 11, fontWeight: 400, color: "var(--muted)" }}>
                        Formulaire vierge (garde l'église et la date du culte)
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              <button 
                type="button"
                className="btn btn-ghost" 
                style={{ 
                  color: "var(--cream-dim)", 
                  fontSize: 13, 
                  textDecoration: "underline", 
                  background: "transparent", 
                  border: "none", 
                  cursor: "pointer",
                  padding: "8px 12px"
                }}
                onClick={() => setIsFinished(true)}
              >
                Non, terminer la saisie
              </button>
            </motion.div>
          ) : (
            <motion.form 
              key="form"
              onSubmit={(e) => handleSubmit(e, "finish")}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="glass"
              style={{ padding: "40px 30px", border: "1px solid rgba(212, 175, 55, 0.25)", borderRadius: 16, display: "flex", flexDirection: "column", gap: 24 }}
            >
              {/* Banner Message */}
              {bannerMessage && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    padding: "14px 18px",
                    borderRadius: 12,
                    background: "rgba(16, 185, 129, 0.12)",
                    border: "1px solid var(--green)",
                    color: "var(--cream)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    fontSize: 14
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <CheckCircle2 size={18} style={{ color: "var(--green)", flexShrink: 0 }} />
                    <span>{bannerMessage}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setBannerMessage(null)}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "var(--cream-dim)",
                      cursor: "pointer",
                      padding: 4,
                      fontSize: 16
                    }}
                  >
                    ✕
                  </button>
                </motion.div>
              )}
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
                  <label className="form-label" style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>ÉVÉNEMENT *</label>
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
                  <label className="form-label" style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>CIVILITÉ *</label>
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
                  <label className="form-label" style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>TÉLÉPHONE *</label>
                  <div style={{ position: "relative" }}>
                    <Phone size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", opacity: 0.7 }} />
                    <input 
                      className="input" 
                      required
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
              <div className="question-card-section">
                <h3 style={{ fontSize: 12, fontWeight: 700, color: "var(--gold)", letterSpacing: 1.5, textTransform: "uppercase", margin: 0 }}>
                  Parcours spirituel & Église *
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {/* Question Jésus-Christ */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                    <label style={{ fontSize: 13, fontWeight: 500, color: "var(--cream)", flex: 1, minWidth: 240, lineHeight: 1.4 }}>
                      Avez-vous déjà accepté Jésus-Christ comme votre Sauveur et Seigneur de votre vie ? <span style={{ color: "var(--gold)" }}>*</span>
                    </label>
                    <YesNoToggle 
                      value={formData.aps} 
                      onChange={(val) => setFormData({ ...formData, aps: val })} 
                    />
                  </div>

                  {/* Question Autre Église */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                      <label style={{ fontSize: 13, fontWeight: 500, color: "var(--cream)", flex: 1, minWidth: 240, lineHeight: 1.4 }}>
                        Persévérez-vous déjà dans une autre église ? <span style={{ color: "var(--gold)" }}>*</span>
                      </label>
                      <YesNoToggle 
                        value={formData.localChurch} 
                        onChange={(val) => setFormData({ ...formData, localChurch: val })} 
                      />
                    </div>

                    {formData.localChurch === true && (
                      <div className="fade-in" style={{ paddingTop: 6 }}>
                        <label className="form-label" style={{ display: "block", marginBottom: 6, fontSize: 11, color: "var(--cream-dim)" }}>
                          NOM DE VOTRE ÉGLISE D'ORIGINE *
                        </label>
                        <input 
                          className="input" 
                          required
                          value={formData.autreEglise} 
                          onChange={e => setFormData({...formData, autreEglise: e.target.value})} 
                          placeholder="Ex: Nom de l'église, ville..." 
                          style={{ height: 40 }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Interests */}
              <div className="question-card-section">
                <h3 style={{ fontSize: 12, fontWeight: 700, color: "var(--gold)", letterSpacing: 1.5, textTransform: "uppercase", margin: 0 }}>
                  Intérêts & engagements *
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {/* Baptisé immersion */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                    <label style={{ fontSize: 13, fontWeight: 500, color: "var(--cream)", flex: 1, minWidth: 240, lineHeight: 1.4 }}>
                      Déjà baptisé(e) par immersion <span style={{ color: "var(--gold)" }}>*</span>
                    </label>
                    <YesNoToggle 
                      value={formData.baptemeEau} 
                      onChange={(val) => setFormData({ ...formData, baptemeEau: val })} 
                    />
                  </div>

                  {/* Formations PCNC */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, borderTop: "1px solid rgba(255,255,255,0.04)", paddingTop: 14 }}>
                    <label style={{ fontSize: 13, fontWeight: 500, color: "var(--cream)", flex: 1, minWidth: 240, lineHeight: 1.4 }}>
                      Intérêt pour les formations (PCNC) <span style={{ color: "var(--gold)" }}>*</span>
                    </label>
                    <YesNoToggle 
                      value={formData.interetFormation} 
                      onChange={(val) => setFormData({ ...formData, interetFormation: val })} 
                    />
                  </div>

                  {/* Cellules CDM */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, borderTop: "1px solid rgba(255,255,255,0.04)", paddingTop: 14 }}>
                    <label style={{ fontSize: 13, fontWeight: 500, color: "var(--cream)", flex: 1, minWidth: 240, lineHeight: 1.4 }}>
                      Intérêt pour les Cellules (C.D.M) <span style={{ color: "var(--gold)" }}>*</span>
                    </label>
                    <YesNoToggle 
                      value={formData.interetCDM} 
                      onChange={(val) => setFormData({ ...formData, interetCDM: val })} 
                    />
                  </div>

                  {/* Souhait de baptême */}
                  {formData.baptemeEau === false && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, borderTop: "1px dashed rgba(212,175,55,0.25)", paddingTop: 12 }} className="fade-in">
                      <input 
                        type="checkbox" 
                        id="interetBapteme" 
                        checked={formData.interetBapteme} 
                        onChange={e => setFormData({...formData, interetBapteme: e.target.checked})} 
                        style={{ width: 16, height: 16, accentColor: "var(--gold)" }} 
                      />
                      <label htmlFor="interetBapteme" style={{ fontSize: 13, cursor: "pointer", color: "var(--gold-light)" }}>
                        Je souhaite me faire baptiser
                      </label>
                    </div>
                  )}
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

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }} className="form-action-grid">
                <button 
                  type="button" 
                  onClick={(e) => handleSubmit(e, "add_another")}
                  className="btn btn-outline" 
                  style={{ 
                    height: 52, 
                    justifyContent: "center", 
                    fontSize: 14, 
                    fontWeight: 600,
                    borderColor: "rgba(212, 175, 55, 0.5)", 
                    color: "var(--gold)",
                    background: "rgba(212, 175, 55, 0.05)",
                    gap: 8 
                  }}
                  disabled={submitting}
                >
                  {submitting && pendingAction === "add_another" ? (
                    <Loader2 className="animate-spin" size={18} />
                  ) : (
                    <>
                      <UserPlus size={18} />
                      <span>Enregistrer & ajouter un autre</span>
                    </>
                  )}
                </button>

                <button 
                  type="button" 
                  onClick={(e) => handleSubmit(e, "finish")}
                  className="btn btn-primary" 
                  style={{ height: 52, justifyContent: "center", fontSize: 14, fontWeight: 700, gap: 8 }}
                  disabled={submitting}
                >
                  {submitting && pendingAction === "finish" ? (
                    <Loader2 className="animate-spin" size={18} />
                  ) : (
                    <>
                      <Check size={18} />
                      <span>Valider l'enregistrement</span>
                    </>
                  )}
                </button>
              </div>
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

        /* Question Card Sections */
        .question-card-section {
          background: rgba(255, 255, 255, 0.025);
          border: 1px solid rgba(212, 175, 55, 0.2);
          border-radius: 14px;
          padding: 20px 18px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        :global(html[data-theme="light"]) .question-card-section,
        :global(body:not(.dark)) .question-card-section {
          background: #fafafc;
          border-color: rgba(212, 175, 55, 0.22);
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.02);
        }

        :global(html[data-theme="dark"]) .question-card-section,
        :global(body.dark) .question-card-section {
          background: rgba(255, 255, 255, 0.03);
          border-color: rgba(212, 175, 55, 0.2);
        }

        /* Segmented Oui / Non Toggles */
        .yes-no-toggle-group {
          display: inline-flex;
          align-items: center;
          border-radius: 10px;
          background: #eef2f6;
          border: 1px solid rgba(0, 0, 0, 0.08);
          padding: 3px;
          gap: 3px;
          flex-shrink: 0;
          box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.04);
        }

        :global(html[data-theme="dark"]) .yes-no-toggle-group,
        :global(body.dark) .yes-no-toggle-group {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(212, 175, 55, 0.22);
          box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.3);
        }

        .yes-no-btn {
          min-width: 58px;
          height: 32px;
          padding: 0 12px;
          border-radius: 7px;
          font-size: 13px;
          font-weight: 600;
          border: 1px solid transparent;
          cursor: pointer;
          background: transparent;
          color: #64748b;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          user-select: none;
        }

        :global(html[data-theme="dark"]) .yes-no-btn,
        :global(body.dark) .yes-no-btn {
          color: var(--cream-dim, #C5BFB2);
        }

        .yes-no-btn:hover:not(.active-yes):not(.active-no) {
          color: var(--cream, #0B0718);
          background: rgba(212, 175, 55, 0.1);
        }

        .yes-no-btn.active-yes {
          background: linear-gradient(135deg, #F5DC88 0%, #D4AF37 55%, #AA771C 100%) !important;
          color: #0A0518 !important;
          font-weight: 700 !important;
          border-color: rgba(212, 175, 55, 0.45) !important;
          box-shadow: 0 2px 8px rgba(212, 175, 55, 0.4) !important;
        }

        .yes-no-btn.active-no {
          background: #ffffff !important;
          color: #1e293b !important;
          font-weight: 600 !important;
          border-color: rgba(0, 0, 0, 0.1) !important;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08) !important;
        }

        :global(html[data-theme="dark"]) .yes-no-btn.active-no,
        :global(body.dark) .yes-no-btn.active-no {
          background: rgba(255, 255, 255, 0.18) !important;
          color: #ffffff !important;
          border-color: rgba(255, 255, 255, 0.18) !important;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3) !important;
        }

        @media (max-width: 580px) {
          .form-grid-3 {
            grid-template-columns: 1fr !important;
          }
          .form-grid-2 {
            grid-template-columns: 1fr !important;
          }
          .form-action-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
