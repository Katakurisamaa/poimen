"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Calendar, Download, Save, Eye, Edit3, Trash2, 
  ArrowLeft, Clock, RotateCcw, X, Copy, Plus, ClipboardCheck, ZoomIn, ZoomOut, MapPin
} from "lucide-react";
import Link from "next/link";
import { toPng } from "html-to-image";
import jsPDF from "jspdf";
import { useFeedback } from "@/components/experience/FeedbackProvider";
import { 
  PositionnementPlanData, 
  SeatAssignment, 
  DEFAULT_SEAT_ROLES, 
  COMMON_ROLES,
  getSeatLocation 
} from "@/types/positionnement-integration";
import PositionnementDocument from "@/components/integration/PositionnementDocument";
import InteractiveSanctuaryMap from "@/components/integration/InteractiveSanctuaryMap";
import { getPositionnementIntegration, savePositionnementIntegration } from "@/app/actions/positionnement-integration";
import { getIntegrationDropdownList } from "@/app/actions/auth";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import "@/app/dashboard/experience.css";
import styles from "./Positionnement.module.css";
import IntegrationSubNav from "@/components/integration/IntegrationSubNav";

// Helper to get next Sunday date (or today if Sunday) in "YYYY-MM-DD"
function getNextSundayDate(): string {
  const d = new Date();
  const day = d.getDay(); // 0 = Sunday
  const daysUntilSunday = day === 0 ? 0 : 7 - day;
  const sunday = new Date(d);
  sunday.setDate(d.getDate() + daysUntilSunday);
  const yyyy = sunday.getFullYear();
  const mm = String(sunday.getMonth() + 1).padStart(2, "0");
  const dd = String(sunday.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// Build empty fresh data for a date
function buildDefaultPlan(churchId: string, dateCulte: string, churchName = "ICC"): PositionnementPlanData {
  return {
    church_id: churchId,
    church_name: churchName,
    date_culte: dateCulte,
    coordination_generale: "",
    cleaning_notice: "ATTENTION : TOUS LES CONSEILLERS EN SERVICE DOIVENT ASSURER LE NETTOYAGE APRÈS LE SERVICE",
    seats: DEFAULT_SEAT_ROLES.map(s => ({
      seatId: s.seatId,
      role: s.defaultRole,
      member: "",
      isObservation: false,
    })),
  };
}

// Reusable Clearable Input
function ClearableInput({
  value,
  onChange,
  onClear,
  placeholder,
  style,
}: {
  value: string;
  onChange: (val: string) => void;
  onClear: () => void;
  placeholder?: string;
  style?: React.CSSProperties;
}) {
  const hasValue = value && value.trim() !== "";
  return (
    <div className={styles.inputWrapper}>
      <input
        type="text"
        className={styles.textInput}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={style}
      />
      {hasValue && (
        <button
          type="button"
          onClick={onClear}
          className={styles.btnClearInput}
          title="Effacer ce champ"
          aria-label="Effacer"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}

export default function PositionnementEditor({ isDashboardChild = false }: { isDashboardChild?: boolean }) {
  const { notify, confirm } = useFeedback();
  const reportRef = useRef<HTMLDivElement>(null);
  const hiddenPrintRef = useRef<HTMLDivElement>(null);
  const previewViewportRef = useRef<HTMLDivElement>(null);

  const [church, setChurch] = useState<any>(null);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [copiedWhatsApp, setCopiedWhatsApp] = useState(false);
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");
  const [hasSession, setHasSession] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Responsive scaling for mobile preview
  const [previewScale, setPreviewScale] = useState(1);
  const [previewHeight, setPreviewHeight] = useState<number | undefined>(undefined);
  const [isZoomed, setIsZoomed] = useState(false);

  // Selected Sunday Date (Format: "YYYY-MM-DD")
  const defaultDate = getNextSundayDate();
  const [selectedDate, setSelectedDate] = useState<string>(defaultDate);

  // Active Plan Data
  const [planData, setPlanData] = useState<PositionnementPlanData | null>(null);
  const [activeSeatId, setActiveSeatId] = useState<string | null>(null);
  const [showMapInEdit, setShowMapInEdit] = useState(true);

  const handleQuickAssign = (seatId: string, memberName: string, role?: string) => {
    setPlanData(prev => {
      if (!prev) return prev;
      const newSeats = [...prev.seats];
      const sIdx = newSeats.findIndex(s => s.seatId === seatId);
      if (sIdx >= 0) {
        newSeats[sIdx] = {
          ...newSeats[sIdx],
          member: memberName,
          ...(role !== undefined ? { role } : {})
        };
      }
      return { ...prev, seats: newSeats };
    });
  };

  const handleSelectSeat = (seatId: string) => {
    setActiveSeatId(seatId);
    setTimeout(() => {
      const el = document.getElementById(`seat-card-${seatId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 50);
  };

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

  // Load Church and initial data
  useEffect(() => {
    async function init() {
      try {
        let ch: any = null;
        const storedChurch = localStorage.getItem("selected_church");
        if (storedChurch) {
          try {
            ch = JSON.parse(storedChurch);
            setChurch(ch);
          } catch {}
        }

        const churchId = ch?.id || "default";

        // Load Integration Team Members
        try {
          const res = await getIntegrationDropdownList(churchId);
          if (res?.success && Array.isArray(res.list)) {
            setTeamMembers(res.list);
          }
        } catch (e) {
          console.warn("Could not load integration team members:", e);
        }

        // Load plan for date
        await loadPlanForDate(churchId, defaultDate, ch?.name);
      } catch (err: any) {
        console.error("Init positionnement error:", err);
      } finally {
        setLoading(false);
      }
    }

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update preview scale on resize or tab change
  useEffect(() => {
    if (activeTab !== "preview") return;

    const updateScale = () => {
      if (!previewViewportRef.current || isZoomed) {
        setPreviewScale(1);
        setPreviewHeight(undefined);
        return;
      }

      const viewportWidth = previewViewportRef.current.clientWidth;
      const docWidth = 1120;
      if (viewportWidth < docWidth && viewportWidth > 0) {
        const nextScale = Math.max(0.25, (viewportWidth - 4) / docWidth);
        setPreviewScale(nextScale);
        if (reportRef.current) {
          setPreviewHeight(reportRef.current.offsetHeight * nextScale);
        }
      } else {
        setPreviewScale(1);
        setPreviewHeight(undefined);
      }
    };

    updateScale();
    const timer = setTimeout(updateScale, 100);
    window.addEventListener("resize", updateScale);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", updateScale);
    };
  }, [activeTab, planData, isZoomed]);

  // Load plan for specific date
  const loadPlanForDate = async (churchId: string, dateStr: string, churchName?: string) => {
    const localKey = `poimen_positionnement_integration_${churchId}_${dateStr}`;
    const localDraft = localStorage.getItem(localKey);
    let loadedData: PositionnementPlanData | null = null;

    if (localDraft) {
      try {
        loadedData = JSON.parse(localDraft);
      } catch (e) {
        console.error("Error parsing local draft:", e);
      }
    }

    if (!loadedData && churchId && churchId !== "default") {
      try {
        const res = await getPositionnementIntegration(churchId, dateStr);
        if (res.success && res.data) {
          loadedData = {
            id: res.data.id,
            church_id: churchId,
            church_name: churchName || "ICC",
            date_culte: dateStr,
            coordination_generale: res.data.coordination_generale || "",
            cleaning_notice: res.data.cleaning_notice || "ATTENTION : TOUS LES CONSEILLERS EN SERVICE DOIVENT ASSURER LE NETTOYAGE APRÈS LE SERVICE",
            seats: res.data.seats || [],
          };
        }
      } catch (e) {
        console.warn("Could not load from Supabase:", e);
      }
    }

    if (!loadedData) {
      loadedData = buildDefaultPlan(churchId, dateStr, churchName || "ICC");
    }

    setPlanData(loadedData);
  };

  // Change date
  const handleDateChange = async (newDate: string) => {
    setSelectedDate(newDate);
    setLoading(true);
    await loadPlanForDate(church?.id || "default", newDate, church?.name);
    setLoading(false);
  };

  // Reset plan
  const handleReset = async () => {
    const ok = await confirm("Réinitialiser le plan de positionnement ? Toutes les affectations seront effacées.");
    if (!ok) return;

    const churchId = church?.id || "default";
    const localKey = `poimen_positionnement_integration_${churchId}_${selectedDate}`;
    localStorage.removeItem(localKey);

    const fresh = buildDefaultPlan(churchId, selectedDate, church?.name || "ICC");
    setPlanData(fresh);
    notify("Plan de positionnement réinitialisé.");
  };

  // Save changes
  const handleSave = async () => {
    if (!planData) return;
    setSaving(true);
    try {
      const churchId = church?.id || "default";
      const dataToSave = {
        ...planData,
        church_id: churchId,
        date_culte: selectedDate,
        church_name: church?.name || planData.church_name,
      };

      const localKey = `poimen_positionnement_integration_${churchId}_${selectedDate}`;
      localStorage.setItem(localKey, JSON.stringify(dataToSave));

      if (churchId && churchId !== "default") {
        const res = await savePositionnementIntegration(dataToSave);
        if (!res.success && !res.notConfigured) {
          console.warn("Supabase save notice:", res.error);
        }
      }

      notify("Plan de positionnement enregistré avec succès !");
    } catch (err: any) {
      notify("Erreur lors de l'enregistrement : " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Update a seat
  const updateSeat = (index: number, updater: (seat: SeatAssignment) => SeatAssignment) => {
    if (!planData) return;
    const updatedSeats = [...planData.seats];
    updatedSeats[index] = updater(updatedSeats[index]);
    setPlanData({ ...planData, seats: updatedSeats });
  };

  // Add observation pair seat (e.g. C3')
  const handleAddObservationPair = (baseSeatId: string) => {
    if (!planData) return;
    const pairId = `${baseSeatId}'`;
    if (planData.seats.some(s => s.seatId === pairId)) {
      notify(`Le binôme ${pairId} existe déjà.`);
      return;
    }

    const baseSeat = planData.seats.find(s => s.seatId === baseSeatId);
    const newSeat: SeatAssignment = {
      seatId: pairId,
      role: baseSeat?.role || "Accueil",
      member: "",
      isObservation: true,
      mentorName: baseSeat?.member || "",
    };

    const idx = planData.seats.findIndex(s => s.seatId === baseSeatId);
    const updated = [...planData.seats];
    if (idx !== -1) {
      updated.splice(idx + 1, 0, newSeat);
    } else {
      updated.push(newSeat);
    }

    setPlanData({ ...planData, seats: updated });
    notify(`Binôme d'observation ${pairId} ajouté.`);
  };

  // Remove custom observation seat
  const handleRemoveSeat = (seatId: string) => {
    if (!planData) return;
    const updated = planData.seats.filter(s => s.seatId !== seatId);
    setPlanData({ ...planData, seats: updated });
    notify(`Siège ${seatId} retiré.`);
  };

  // Format date for display
  const formatFrenchDate = (dateStr: string) => {
    if (!dateStr) return "";
    try {
      const [year, month, day] = dateStr.split("-");
      return `${day}/${month}/${year}`;
    } catch {
      return dateStr;
    }
  };

  // Generate WhatsApp message for Saturday broadcast
  const generateWhatsAppMessage = () => {
    if (!planData) return "";
    const formattedDate = formatFrenchDate(planData.date_culte);
    const coord = planData.coordination_generale ? `*Coordination générale : ${planData.coordination_generale.toUpperCase()}*` : "";

    const seatLines = planData.seats
      .filter(s => s.member && s.member.trim() !== "")
      .map(s => {
        if (s.isObservation) {
          const mentor = s.mentorName ? ` (en obs avec ${s.mentorName})` : " (en observation)";
          return `${s.seatId} (${s.role}) : *${s.member}*${mentor}`;
        }
        return `${s.seatId} (${s.role}) : *${s.member}*`;
      })
      .join("\n");

    return `*PLAN DE POSITIONNEMENT — SERVICE DU DIMANCHE ${formattedDate}*
${coord}

${seatLines}

⚠️ *${planData.cleaning_notice || "ATTENTION : TOUS LES CONSEILLERS EN SERVICE DOIVENT ASSURER LE NETTOYAGE APRÈS LE SERVICE"}*

Bénédictions à tous pour le service ! ✨`;
  };

  const handleCopyWhatsApp = () => {
    const text = generateWhatsAppMessage();
    navigator.clipboard.writeText(text)
      .then(() => {
        setCopiedWhatsApp(true);
        notify("Message WhatsApp copié dans le presse-papier !");
        setTimeout(() => setCopiedWhatsApp(false), 2500);
      })
      .catch(err => {
        console.error("Clipboard copy failed:", err);
      });
  };

  // Export to PDF
  const handleDownloadPdf = async () => {
    const printElement = (activeTab === "preview" ? reportRef.current : hiddenPrintRef.current) || reportRef.current || hiddenPrintRef.current;
    if (!printElement) {
      notify("Erreur : le document est introuvable.");
      return;
    }

    setDownloadingPdf(true);
    notify("Génération du document PDF…");

    try {
      const dataUrl = await toPng(printElement, {
        pixelRatio: 2.2,
        backgroundColor: "#ffffff",
        cacheBust: true,
      });

      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      const pdfWidth = 297;
      const pdfHeight = 210;
      const margin = 5;
      const availW = pdfWidth - margin * 2;
      const availH = pdfHeight - margin * 2;

      const img = new Image();
      img.src = dataUrl;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
      });

      let printW = availW;
      let printH = (img.height * printW) / img.width;

      if (printH > availH) {
        printH = availH;
        printW = (img.width * printH) / img.height;
      }

      const leftOffset = margin + (availW - printW) / 2;
      const topOffset = margin + (availH - printH) / 2;

      pdf.addImage(dataUrl, "PNG", leftOffset, topOffset, printW, printH, undefined, "FAST");

      const safeDate = selectedDate.replace(/-/g, "_");
      pdf.save(`Plan_Positionnement_ICC_${safeDate}.pdf`);
      notify("Téléchargement du PDF terminé !");
    } catch (err: any) {
      console.error("PDF export error:", err);
      notify("Erreur lors de la création du PDF : " + err.message);
    } finally {
      setDownloadingPdf(false);
    }
  };

  // All known member names (first name uppercase)
  const allKnownNames = Array.from(new Set(
    teamMembers
      .map(m => {
        const fullName = m.display_name || m.name || "";
        return fullName.split(" ")[0].toUpperCase();
      })
      .filter(Boolean)
  ));

  if (loading || !planData) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingState}>
          <div className={styles.loadingSpinner} />
          <span>Chargement du plan de positionnement…</span>
        </div>
      </div>
    );
  }

  const mainContent = (
    <div className={styles.container}>
      <IntegrationSubNav />
      
      {/* ── TOP ACTION BAR ── */}
      <header className={styles.headerBar}>
        <div className={styles.headerLeft}>
          <Link href="/dashboard" className={styles.backLink} title="Retour au tableau de bord">
            <ArrowLeft size={14} />
            <span>Retour</span>
          </Link>
          <div className={styles.titleBlock}>
            <h1 className={styles.pageTitle}>Plan de Positionnement</h1>
            <p className={styles.pageSubtitle}>Affectation des rôles et disposition en salle pour le culte</p>
          </div>
        </div>

        {/* Toolbar */}
        <div className={styles.actionsToolbar}>
          {/* Top Row: Date Picker & Tab Switcher */}
          <div className={styles.toolbarTopRow}>
            {/* Date Picker (Sunday) */}
            <div className={styles.dateInputWrapper}>
              <Calendar size={13} className={styles.dateIcon} />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => handleDateChange(e.target.value)}
                className={styles.dateInput}
              />
            </div>

            {/* Segmented Switcher */}
            <div className={styles.tabSwitcher}>
              <button
                onClick={() => setActiveTab("edit")}
                className={`${styles.tabBtn} ${activeTab === "edit" ? styles.tabBtnActive : ""}`}
              >
                <Edit3 size={12} /> <span>Édition</span>
              </button>
              <button
                onClick={() => setActiveTab("preview")}
                className={`${styles.tabBtn} ${activeTab === "preview" ? styles.tabBtnActive : ""}`}
              >
                <Eye size={12} /> <span>Carte</span>
              </button>
            </div>
          </div>

          {/* Action buttons group */}
          <div className={styles.actionButtonGroup}>
            <button
              onClick={handleCopyWhatsApp}
              className={`${styles.btnAction} ${styles.btnSecondary}`}
              title="Copier le message formaté pour WhatsApp"
            >
              {copiedWhatsApp ? <ClipboardCheck size={13} /> : <Copy size={13} />}
              <span>{copiedWhatsApp ? "Copié" : "WhatsApp"}</span>
            </button>

            <button
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
              className={`${styles.btnAction} ${styles.btnSecondary}`}
              title="Exporter le document en PDF"
            >
              <Download size={13} /> <span>{downloadingPdf ? "…" : "PDF"}</span>
            </button>

            <button
              onClick={handleReset}
              className={`${styles.btnAction} ${styles.btnGhost}`}
              title="Effacer toutes les affectations"
            >
              <RotateCcw size={13} /> <span>Vider</span>
            </button>

            <button
              onClick={handleSave}
              disabled={saving}
              className={`${styles.btnAction} ${styles.btnPrimary}`}
            >
              <Save size={13} /> <span>{saving ? "…" : "Sauvegarder"}</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── CONTENT AREA ── */}
      {activeTab === "edit" ? (
        <div>
          
          {/* ── GENERAL SERVICE INFO (COORDINATION & CLEANING) ── */}
          <div className={styles.glassCard}>
            <div className={styles.cardSectionHeader}>
              <h3 className={styles.cardSectionTitle}>
                <Clock size={13} /> Organisation & Consignes du Culte
              </h3>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
              {/* Coordination Générale */}
              <div className={styles.formField}>
                <label className={styles.fieldLabel}>
                  <span>Coordination Générale :</span>
                </label>
                <ClearableInput
                  value={planData.coordination_generale}
                  placeholder="Ex: BENJAMIN"
                  onChange={(val) => setPlanData({ ...planData, coordination_generale: val })}
                  onClear={() => setPlanData({ ...planData, coordination_generale: "" })}
                />
                {/* Fast Assign Chips */}
                <div className={styles.quickMembersList}>
                  {allKnownNames.map((name, i) => {
                    const active = planData.coordination_generale.toUpperCase() === name.toUpperCase();
                    return (
                      <button
                        key={i}
                        type="button"
                        className={`${styles.quickMemberChip} ${active ? styles.quickMemberChipActive : ""}`}
                        onClick={() => setPlanData({
                          ...planData,
                          coordination_generale: active ? "" : name
                        })}
                      >
                        {active && <X size={9} />}
                        {name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Cleaning Notice */}
              <div className={styles.formField}>
                <label className={styles.fieldLabel} style={{ color: "#dc2626" }}>
                  <span>Consigne Nettoyage Après Service :</span>
                </label>
                <ClearableInput
                  value={planData.cleaning_notice}
                  onChange={(val) => setPlanData({ ...planData, cleaning_notice: val })}
                  onClear={() => setPlanData({ ...planData, cleaning_notice: "" })}
                />
              </div>
            </div>
          </div>

          {/* ── INTERACTIVE SANCTUARY MAP & TOGGLE ── */}
          {showMapInEdit && (
            <InteractiveSanctuaryMap
              planData={planData}
              activeSeatId={activeSeatId}
              onSelectSeat={handleSelectSeat}
              onQuickAssign={handleQuickAssign}
              availableMembers={allKnownNames}
            />
          )}

          {/* ── SEATS ASSIGNMENTS LIST ── */}
          <div className={styles.glassCard}>
            <div className={styles.cardSectionHeader} style={{ flexWrap: "wrap", gap: 10 }}>
              <div>
                <h3 className={styles.cardSectionTitle}>
                  Affectations des Sièges & Rôles
                </h3>
                <div className={styles.cardSectionHelper}>
                  Cliquez sur un prénom pour affecter ou retirer instantanément.
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowMapInEdit(v => !v)}
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--muted)",
                  background: "var(--surface-solid)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  padding: "5px 10px",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5
                }}
              >
                <MapPin size={12} color="var(--gold)" />
                <span>{showMapInEdit ? "Masquer le plan interactif" : "Afficher le plan interactif"}</span>
              </button>
            </div>

            <div className={styles.seatsList}>
              {planData.seats.map((seat, idx) => {
                const isPair = seat.seatId.endsWith("'");
                const loc = getSeatLocation(seat.seatId);
                const isCurrentActive = activeSeatId === seat.seatId;

                return (
                  <div
                    key={seat.seatId}
                    id={`seat-card-${seat.seatId}`}
                    className={styles.seatCard}
                    style={isCurrentActive ? { borderColor: "var(--gold)", boxShadow: "0 0 0 2px rgba(212, 175, 55, 0.35)", transition: "all 0.2s ease" } : undefined}
                    onClick={() => setActiveSeatId(seat.seatId)}
                  >
                    {/* Header */}
                    <div className={styles.seatCardHeader}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <span className={styles.seatBadge}>{seat.seatId}</span>
                        <span className={`${styles.locationBadge} ${isCurrentActive ? styles.locationBadgeHighlight : ""}`}>
                          <MapPin size={10} />
                          {loc.label}
                        </span>
                        {isPair && (
                          <span style={{ fontSize: 9.5, fontWeight: 500, backgroundColor: "#fef08a", color: "#854d0e", padding: "1px 5px", borderRadius: 4 }}>
                            Observation
                          </span>
                        )}
                      </div>

                      {/* Action to add binome C' or remove custom pair */}
                      {isPair ? (
                        <button
                          type="button"
                          onClick={() => handleRemoveSeat(seat.seatId)}
                          className={styles.quickClearChip}
                          title="Supprimer ce binôme"
                        >
                          <Trash2 size={11} /> Supprimer
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleAddObservationPair(seat.seatId)}
                          style={{
                            fontSize: 10,
                            fontWeight: 500,
                            color: "var(--gold)",
                            background: "transparent",
                            border: "1px solid var(--border)",
                            borderRadius: 4,
                            padding: "2px 6px",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 3,
                          }}
                          title={`Ajouter un binôme d'observation ${seat.seatId}'`}
                        >
                          <Plus size={9} /> Binôme {seat.seatId}'
                        </button>
                      )}
                    </div>

                    {/* Role field + presets */}
                    <div className={styles.formField}>
                      <label className={styles.fieldLabel}>Poste / Rôle :</label>
                      <ClearableInput
                        value={seat.role}
                        placeholder="Ex: Accueil, Fanion, Salon Lounge…"
                        onChange={(val) => updateSeat(idx, s => ({ ...s, role: val }))}
                        onClear={() => updateSeat(idx, s => ({ ...s, role: "" }))}
                        style={{ height: 32, fontSize: 11.5 }}
                      />
                      <div className={styles.rolePresets}>
                        {COMMON_ROLES.map((r, ri) => (
                          <button
                            key={ri}
                            type="button"
                            className={`${styles.rolePresetBtn} ${seat.role === r ? styles.rolePresetBtnActive : ""}`}
                            onClick={() => updateSeat(idx, s => ({ ...s, role: r }))}
                          >
                            {r}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Member field */}
                    <div className={styles.formField}>
                      <label className={styles.fieldLabel}>Conseiller affecté :</label>
                      <ClearableInput
                        value={seat.member}
                        placeholder="Nom du conseiller…"
                        onChange={(val) => updateSeat(idx, s => ({ ...s, member: val }))}
                        onClear={() => updateSeat(idx, s => ({ ...s, member: "" }))}
                        style={{ height: 33, fontWeight: 550, fontSize: 12 }}
                      />

                      {/* Member quick chips */}
                      <div className={styles.quickMembersList}>
                        {seat.member && (
                          <button
                            type="button"
                            onClick={() => updateSeat(idx, s => ({ ...s, member: "" }))}
                            className={styles.quickClearChip}
                            title="Vider ce siège"
                          >
                            <X size={10} /> Vider
                          </button>
                        )}
                        {allKnownNames.map((n, ni) => {
                          const active = seat.member.toUpperCase() === n.toUpperCase();
                          return (
                            <button
                              key={ni}
                              type="button"
                              className={`${styles.quickMemberChip} ${active ? styles.quickMemberChipActive : ""}`}
                              onClick={() => updateSeat(idx, s => ({
                                ...s,
                                member: active ? "" : n
                              }))}
                              title={active ? `Retirer ${n}` : `Affecter ${n}`}
                            >
                              {active && <X size={9} />}
                              {n}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Observation options */}
                    <div className={styles.obsRow}>
                      <label className={styles.obsCheckboxLabel}>
                        <input
                          type="checkbox"
                          checked={seat.isObservation || false}
                          onChange={(e) => updateSeat(idx, s => ({ ...s, isObservation: e.target.checked }))}
                        />
                        <span>En observation</span>
                      </label>
                      {seat.isObservation && (
                        <input
                          type="text"
                          placeholder="Avec qui ? (ex: Christiane)"
                          value={seat.mentorName || ""}
                          onChange={(e) => updateSeat(idx, s => ({ ...s, mentorName: e.target.value }))}
                          className={styles.textInput}
                          style={{ height: 26, fontSize: 10.5, width: 140, padding: "2px 6px" }}
                        />
                      )}
                    </div>

                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom Action Bar */}
          <div className={styles.bottomActions}>
            <button
              onClick={handleCopyWhatsApp}
              className={`${styles.btnAction} ${styles.btnSecondary}`}
            >
              {copiedWhatsApp ? <ClipboardCheck size={13} /> : <Copy size={13} />}
              <span>{copiedWhatsApp ? "Copié !" : "Copier WhatsApp"}</span>
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className={`${styles.btnAction} ${styles.btnPrimary}`}
            >
              <Save size={13} /> <span>{saving ? "…" : "Sauvegarder"}</span>
            </button>
          </div>

        </div>
      ) : (
        /* ══════════════════════════════════════════════════
           PREVIEW MODE: EXACT VISUAL DOCUMENT & SEATING MAP
           Auto-scaling to viewport on mobile + Zoom toggle
           ══════════════════════════════════════════════════ */
        <div className={styles.previewContainer}>
          <div className={styles.previewControls}>
            <button
              type="button"
              onClick={() => setIsZoomed(!isZoomed)}
              className={styles.btnZoomToggle}
              title={isZoomed ? "Ajuster la carte à la largeur de l'écran" : "Afficher en taille réelle"}
            >
              {isZoomed ? <ZoomOut size={12} /> : <ZoomIn size={12} />}
              <span>{isZoomed ? "Ajuster à l'écran" : "Taille 100% (zoom)"}</span>
            </button>
          </div>

          <div
            ref={previewViewportRef}
            className={styles.previewViewport}
          >
            <div
              className={styles.previewScaledWrapper}
              style={{
                width: isZoomed ? 1120 : Math.round(1120 * previewScale),
                height: isZoomed ? undefined : previewHeight,
                overflow: isZoomed ? "visible" : "hidden",
              }}
            >
              <div
                className={styles.previewStage}
                style={{
                  width: 1120,
                  transform: isZoomed ? "none" : `scale(${previewScale})`,
                  transformOrigin: "top left",
                }}
              >
                <PositionnementDocument
                  data={planData}
                  containerRef={reportRef}
                  logoUrl={church?.logo_url}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hidden print container for high-res PDF generation */}
      <div style={{ position: "absolute", left: -99999, top: -99999, pointerEvents: "none" }}>
        <PositionnementDocument
          data={planData}
          containerRef={hiddenPrintRef}
          logoUrl={church?.logo_url}
        />
      </div>

    </div>
  );

  // If inside Dashboard layout, return the content directly
  if (isDashboardChild) {
    return mainContent;
  }

  // If outside dashboard (e.g. standalone /positionnement-integration) with session:
  if (hasSession) {
    return (
      <div className="app-shell experience-shell">
        <Sidebar mobileOpen={mobileOpen} onToggleMobile={() => setMobileOpen(!mobileOpen)} />
        <div className="main-area">
          <Header onMenuClick={() => setMobileOpen(!mobileOpen)} />
          <main className="page-content" style={{ padding: "10px 12px" }}>
            {mainContent}
          </main>
        </div>
      </div>
    );
  }

  // Standalone public/guest view
  return (
    <div style={{ minHeight: "100dvh", background: "var(--bg)", color: "var(--cream)" }}>
      {mainContent}
    </div>
  );
}
