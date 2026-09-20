"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Calendar, Download, Save, Eye, Edit3, Plus, Trash2, 
  ArrowLeft, Clock, Check, RotateCcw, X, Users
} from "lucide-react";
import Link from "next/link";
import { toPng } from "html-to-image";
import jsPDF from "jspdf";
import { useFeedback } from "@/components/experience/FeedbackProvider";
import { 
  PlanningIntegrationData, 
  WeekSchedule, 
} from "@/types/planning-integration";
import PlanningDocument from "@/components/integration/PlanningDocument";
import { getPlanningIntegration, savePlanningIntegration } from "@/app/actions/planning-integration";
import { getIntegrationDropdownList } from "@/app/actions/auth";
import { getMonthWeeks, getNextWeekPeriod } from "@/lib/planning-dates";
import styles from "@/components/integration/PlanningIntegration.module.css";

// Empty default – weeks are always auto-generated (never pre-filled)
const buildDefaultData = (
  churchId: string,
  monthKey: string,
  churchName: string,
  weeks: WeekSchedule[]
): PlanningIntegrationData => ({
  church_id: churchId,
  month_key: monthKey,
  church_name: churchName,
  globalObservationMembers: [],
  weeks,
  key_dates: {
    formationDate: "",
    formationDetails: "",
    reunionMensuelleDate: "",
    reunionMensuelleDetails: "APRÈS LA PRIÈRE DE CLÔTURE (AVEC PRÉSENCE OBLIGATOIRE)",
  },
  guidelines: {
    backupNotice: "LE BACKUP DOIT IMPÉRATIVEMENT OUVRIR SON MICRO PENDANT LA PRIÈRE ET NE PAS COUVRIR LA VOIX DU LEAD / LE BACKUP ENVOIE LE CR",
    cleaningNotice: "TOUS LES CONSEILLERS EN SERVICE DOIVENT ASSURER LE NETTOYAGE APRÈS LE SERVICE",
  },
});

// Helper component for input with instantaneous 1-click clear button
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
  const hasValue = value && value.trim() !== "" && value.trim() !== "/";
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

export default function PlanningIntegrationPage() {
  const { notify } = useFeedback();
  const reportRef = useRef<HTMLDivElement>(null);

  const [church, setChurch] = useState<any>(null);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");

  // Selected Month (Format: "YYYY-MM")
  const today = new Date();
  const defaultMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const [selectedMonth, setSelectedMonth] = useState<string>(defaultMonth);
  
  // Custom new observation member input
  const [newObsName, setNewObsName] = useState<string>("");

  // Active Planning Data
  const [planningData, setPlanningData] = useState<PlanningIntegrationData | null>(null);

  // Initialize Church and load data
  useEffect(() => {
    async function init() {
      try {
        let ch: any = null;
        const storedChurch = localStorage.getItem("selected_church");
        if (storedChurch) {
          ch = JSON.parse(storedChurch);
          setChurch(ch);
        }

        const churchId = ch?.id || "default";

        // Load Integration Team Members for dropdown pickers
        try {
          const res = await getIntegrationDropdownList(churchId);
          if (res?.success && Array.isArray(res.list)) {
            setTeamMembers(res.list);
          }
        } catch (e) {
          console.warn("Could not load integration team members:", e);
        }

        // Load Planning Data for current month
        await loadPlanningForMonth(churchId, defaultMonth, ch?.name);
      } catch (err: any) {
        console.error("Init planning error:", err);
      } finally {
        setLoading(false);
      }
    }

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Build automatic fresh weeks for a month if no plan exists yet
  const generateFreshWeeksForMonth = (monthKey: string): WeekSchedule[] => {
    const periods = getMonthWeeks(monthKey);
    return periods.map((periode, idx) => ({
      id: `week-${idx + 1}`,
      periode,
      jeuneEtPriere: { lead: "", adjoint: "/" },
      priereSamedi: { lead: "", adjoint: "/" },
      priereMinisteres: { participants: "Tous", conducteur: "En Attente du PD", sousReserve: "" },
      serviceDimanche: {
        coordination: "",
        fanionStatsAccueil: "",
        salonLoungeRestauration: "",
        conseillerMobile: "",
        accueil: "",
      },
    }));
  };

  // Handler to load or switch month
  const loadPlanningForMonth = async (churchId: string, monthKey: string, churchName?: string) => {
    const localKey = `poimen_planning_integration_${churchId}_${monthKey}`;
    const localDraft = localStorage.getItem(localKey);
    let loadedData: PlanningIntegrationData | null = null;

    if (localDraft) {
      try {
        loadedData = JSON.parse(localDraft);
      } catch (e) {
        console.error("Error parsing local planning:", e);
      }
    }

    if (!loadedData && churchId && churchId !== "default") {
      try {
        const res = await getPlanningIntegration(churchId, monthKey);
        if (res.success && res.data) {
          loadedData = {
            id: res.data.id,
            church_id: churchId,
            month_key: monthKey,
            church_name: churchName || "ICC",
            globalObservationMembers: res.data.globalObservationMembers || [],
            weeks: res.data.weeks || [],
            key_dates: res.data.key_dates || { formationDate: "", formationDetails: "", reunionMensuelleDate: "", reunionMensuelleDetails: "APRÈS LA PRIÈRE DE CLÔTURE (AVEC PRÉSENCE OBLIGATOIRE)" },
            guidelines: res.data.guidelines || { backupNotice: "", cleaningNotice: "" },
          };
        }
      } catch (e) {
        console.warn("Could not load from Supabase:", e);
      }
    }

    if (!loadedData) {
      loadedData = buildDefaultData(
        churchId,
        monthKey,
        churchName || "ICC",
        generateFreshWeeksForMonth(monthKey)
      );
    }

    setPlanningData(loadedData);
  };

  // Switch month event
  const handleMonthChange = async (newMonth: string) => {
    setSelectedMonth(newMonth);
    setLoading(true);
    await loadPlanningForMonth(church?.id || "default", newMonth, church?.name);
    setLoading(false);
  };

  // Reset current month to empty weeks (clears localStorage)
  const handleReset = () => {
    if (!window.confirm(`Réinitialiser le planning de ce mois ? Toutes les affectations seront effacées.`)) return;
    const churchId = church?.id || "default";
    const localKey = `poimen_planning_integration_${churchId}_${selectedMonth}`;
    localStorage.removeItem(localKey);
    const freshData = buildDefaultData(
      churchId,
      selectedMonth,
      church?.name || planningData?.church_name || "ICC",
      generateFreshWeeksForMonth(selectedMonth)
    );
    setPlanningData(freshData);
    notify("Planning réinitialisé — affectations effacées.");
  };

  // Save changes
  const handleSave = async () => {
    if (!planningData) return;
    setSaving(true);
    try {
      const churchId = church?.id || "default";
      const dataToSave = {
        ...planningData,
        church_id: churchId,
        month_key: selectedMonth,
        church_name: church?.name || planningData.church_name,
      };

      const localKey = `poimen_planning_integration_${churchId}_${selectedMonth}`;
      localStorage.setItem(localKey, JSON.stringify(dataToSave));

      if (churchId && churchId !== "default") {
        const res = await savePlanningIntegration(dataToSave);
        if (!res.success && !res.notConfigured) {
          console.warn("Supabase save notice:", res.error);
        }
      }

      notify("Planning du mois enregistré !");
    } catch (err: any) {
      notify("Erreur lors de l'enregistrement : " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Add a new week with automated next Monday-to-Sunday calculation
  const handleAddWeek = () => {
    if (!planningData) return;
    const nextIdx = planningData.weeks.length + 1;
    const lastWeek = planningData.weeks[planningData.weeks.length - 1];
    const nextPeriod = lastWeek ? getNextWeekPeriod(lastWeek.periode) : "DU ... AU ...";

    const newWeek: WeekSchedule = {
      id: `week-${Date.now()}`,
      periode: nextPeriod,
      jeuneEtPriere: { lead: "", adjoint: "/" },
      priereSamedi: { lead: "", adjoint: "/" },
      priereMinisteres: { participants: "Tous", conducteur: "En Attente du PD", sousReserve: "" },
      serviceDimanche: {
        coordination: "",
        fanionStatsAccueil: "",
        salonLoungeRestauration: "",
        conseillerMobile: "",
        accueil: "",
      },
    };

    setPlanningData({
      ...planningData,
      weeks: [...planningData.weeks, newWeek],
    });
    notify(`Semaine ${nextIdx} ajoutée.`);
  };

  // Remove a week
  const handleRemoveWeek = (weekId: string, idx: number) => {
    if (!planningData) return;
    if (planningData.weeks.length <= 1) {
      notify("Le planning doit contenir au moins une semaine.");
      return;
    }
    const updated = planningData.weeks.filter(w => w.id !== weekId);
    setPlanningData({ ...planningData, weeks: updated });
    notify(`Semaine ${idx + 1} supprimée.`);
  };

  // Update week field
  const updateWeek = (idx: number, updater: (w: WeekSchedule) => WeekSchedule) => {
    if (!planningData) return;
    const updatedWeeks = [...planningData.weeks];
    updatedWeeks[idx] = updater(updatedWeeks[idx]);
    setPlanningData({ ...planningData, weeks: updatedWeeks });
  };

  // Toggle member observation status globally
  const toggleGlobalObservation = (name: string) => {
    if (!planningData) return;
    const current = planningData.globalObservationMembers || [];
    const upper = name.trim().toUpperCase();
    const exists = current.some(m => m.toUpperCase() === upper);
    const updated = exists
      ? current.filter(m => m.toUpperCase() !== upper)
      : [...current, upper];

    setPlanningData({
      ...planningData,
      globalObservationMembers: updated,
    });
  };

  // Add custom observation name
  const handleAddCustomObsName = () => {
    if (!planningData || !newObsName.trim()) return;
    const upper = newObsName.trim().toUpperCase();
    const current = planningData.globalObservationMembers || [];
    if (!current.some(m => m.toUpperCase() === upper)) {
      setPlanningData({
        ...planningData,
        globalObservationMembers: [...current, upper],
      });
      notify(`${upper} marqué en observation (culte du dimanche).`);
    }
    setNewObsName("");
  };

  // Helper: check if a member is currently in a field value
  const isMemberInField = (currentVal: string, name: string) => {
    if (!currentVal) return false;
    return currentVal.toUpperCase().includes(name.toUpperCase());
  };

  // Toggle single member: if already set, clearing to empty. If different, assign.
  const toggleSingleMember = (currentVal: string, name: string, formatter?: (n: string) => string) => {
    if (isMemberInField(currentVal, name)) {
      return "";
    }
    return formatter ? formatter(name) : name;
  };

  // Helper to append a name to a text input
  const appendMemberToField = (currentVal: string, name: string, prefix = "") => {
    const cleanCurrent = (currentVal || "").trim();
    if (!cleanCurrent || cleanCurrent === "/") {
      return prefix ? `${name} (${prefix})` : name;
    }
    if (cleanCurrent.toUpperCase().includes(name.toUpperCase())) {
      return cleanCurrent;
    }
    return `${cleanCurrent} + ${name}`;
  };

  // Remove a member from a multi-member composite field (e.g. "BERTILLE + CHRISTIAN" -> remove "BERTILLE" -> "CHRISTIAN")
  const removeMemberFromField = (currentVal: string, name: string) => {
    if (!currentVal) return "";
    const upperName = name.trim().toUpperCase();
    const parts = currentVal.split(/\s*\+\s*/);
    const remaining = parts.filter(p => !p.toUpperCase().includes(upperName));
    return remaining.join(" + ").trim();
  };

  // Toggle multi member: if present, removes them. If absent, appends them.
  const toggleMultiMember = (currentVal: string, name: string, prefix = "") => {
    if (isMemberInField(currentVal, name)) {
      return removeMemberFromField(currentVal, name);
    }
    return appendMemberToField(currentVal, name, prefix);
  };

  // Export to PDF
  const handleDownloadPdf = async () => {
    const printElement = document.getElementById("planning-integration-print-container") || reportRef.current;
    if (!printElement) {
      notify("Erreur : le modèle de planning est introuvable.");
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

      const safeMonth = selectedMonth.replace("-", "_");
      pdf.save(`Planning_Integration_ICC_${safeMonth}.pdf`);
      notify("Téléchargement du PDF terminé !");
    } catch (err: any) {
      console.error("PDF export error:", err);
      notify("Erreur lors de la création du PDF : " + err.message);
    } finally {
      setDownloadingPdf(false);
    }
  };

  // All known names (from team members, deduped)
  const allKnownNames = Array.from(new Set(
    teamMembers
      .map(m => {
        const fullName = m.display_name || m.name || "";
        return fullName.split(" ")[0].toUpperCase();
      })
      .filter(Boolean)
  ));

  if (loading || !planningData) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingState}>
          <div className={styles.loadingSpinner} />
          <span>Chargement du planning…</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      
      {/* ── TOP ACTION BAR ── */}
      <header className={styles.headerBar}>
        <div className={styles.headerLeft}>
          <Link
            href="/dashboard"
            className={styles.backLink}
          >
            <ArrowLeft size={15} /> Retour
          </Link>
          <div>
            <div className={styles.kicker}>
              <Users size={12} /> Département Intégration
            </div>
            <h1 className={styles.pageTitle}>Planning Mensuel des Services</h1>
          </div>
        </div>

        {/* Toolbar */}
        <div className={styles.actionsToolbar}>
          {/* Month Picker */}
          <div className={styles.monthInputWrapper}>
            <Calendar size={15} className={styles.monthIcon} />
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => handleMonthChange(e.target.value)}
              className={styles.monthInput}
            />
          </div>

          {/* Segmented Switcher */}
          <div className={styles.tabSwitcher}>
            <button
              onClick={() => setActiveTab("edit")}
              className={`${styles.tabBtn} ${activeTab === "edit" ? styles.tabBtnActive : ""}`}
            >
              <Edit3 size={13} /> Édition
            </button>
            <button
              onClick={() => setActiveTab("preview")}
              className={`${styles.tabBtn} ${activeTab === "preview" ? styles.tabBtnActive : ""}`}
            >
              <Eye size={13} /> Aperçu A4
            </button>
          </div>

          {/* Action Buttons */}
          <button
            onClick={handleReset}
            className={`${styles.btnAction} ${styles.btnReset}`}
            title="Effacer toutes les affectations de ce mois"
          >
            <RotateCcw size={13} /> Vider
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className={`${styles.btnAction} ${styles.btnSave}`}
          >
            <Save size={14} /> {saving ? "Sauvegarde…" : "Sauvegarder"}
          </button>

          <button
            onClick={handleDownloadPdf}
            disabled={downloadingPdf}
            className={`${styles.btnAction} ${styles.btnExport}`}
          >
            <Download size={14} /> {downloadingPdf ? "Export…" : "Export PDF"}
          </button>
        </div>
      </header>

      {/* ── CONTENT AREA ── */}
      {activeTab === "edit" ? (
        <div>
          
          {/* ── OBSERVATION MEMBERS (SERVICE DU DIMANCHE SEULEMENT) ── */}
          <section className={styles.obsSection}>
            <div className={styles.obsSectionHeader}>
              <h2 className={styles.obsSectionTitle}>
                Conseillers en observation
              </h2>
              <span className={styles.obsTag}>Service du Dimanche uniquement</span>
            </div>
            <p className={styles.obsDescription}>
              Cliquez sur un conseiller pour activer ou désactiver son surlignage en jaune sur le document du culte du dimanche.
            </p>

            <div className={styles.obsChipsList}>
              {allKnownNames.map((name, i) => {
                const isObs = (planningData.globalObservationMembers || []).some(m => m.toUpperCase() === name.toUpperCase());
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleGlobalObservation(name)}
                    className={`${styles.obsChip} ${isObs ? styles.obsChipActive : ""}`}
                  >
                    {isObs ? <Check size={12} /> : null}
                    {name}
                  </button>
                );
              })}

              {/* Add custom observation member */}
              <div className={styles.obsCustomInput}>
                <input
                  type="text"
                  placeholder="Autre prénom…"
                  value={newObsName}
                  onChange={(e) => setNewObsName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddCustomObsName())}
                  className={styles.textInput}
                  style={{ height: 32, width: 130, fontSize: 11.5 }}
                />
                <button
                  type="button"
                  onClick={handleAddCustomObsName}
                  className={styles.btnAddObs}
                >
                  Ajouter
                </button>
              </div>
            </div>
          </section>

          {/* ── DATES CLÉS & CONSIGNES OPÉRATIONNELLES ── */}
          <div className={styles.glassCard}>
            <h3 className={styles.cardSectionTitle}>
              <Clock size={14} /> Dates Clés & Consignes Opérationnelles
            </h3>
            
            <div className={styles.datesGrid}>
              {/* Formation */}
              <div className={styles.formField}>
                <label className={styles.fieldLabel}>Date de la Formation</label>
                <ClearableInput
                  placeholder="Ex: 30/09/26"
                  value={planningData.key_dates.formationDate}
                  onChange={(val) =>
                    setPlanningData({
                      ...planningData,
                      key_dates: { ...planningData.key_dates, formationDate: val },
                    })
                  }
                  onClear={() =>
                    setPlanningData({
                      ...planningData,
                      key_dates: { ...planningData.key_dates, formationDate: "" },
                    })
                  }
                />
              </div>

              {/* Réunion Mensuelle Date */}
              <div className={styles.formField}>
                <label className={styles.fieldLabel}>Date Réunion Mensuelle</label>
                <ClearableInput
                  placeholder="Ex: 03/10/26"
                  value={planningData.key_dates.reunionMensuelleDate}
                  onChange={(val) =>
                    setPlanningData({
                      ...planningData,
                      key_dates: { ...planningData.key_dates, reunionMensuelleDate: val },
                    })
                  }
                  onClear={() =>
                    setPlanningData({
                      ...planningData,
                      key_dates: { ...planningData.key_dates, reunionMensuelleDate: "" },
                    })
                  }
                />
              </div>

              {/* Réunion Mensuelle Détails */}
              <div className={styles.formField} style={{ gridColumn: "1 / -1" }}>
                <label className={styles.fieldLabel}>Précisions Réunion Mensuelle</label>
                <ClearableInput
                  placeholder="Ex: APRÈS LA PRIÈRE DE CLÔTURE (AVEC PRÉSENCE OBLIGATOIRE)"
                  value={planningData.key_dates.reunionMensuelleDetails}
                  onChange={(val) =>
                    setPlanningData({
                      ...planningData,
                      key_dates: { ...planningData.key_dates, reunionMensuelleDetails: val },
                    })
                  }
                  onClear={() =>
                    setPlanningData({
                      ...planningData,
                      key_dates: { ...planningData.key_dates, reunionMensuelleDetails: "" },
                    })
                  }
                />
              </div>

              {/* Backup Notice */}
              <div className={styles.formField} style={{ gridColumn: "1 / -1" }}>
                <label className={styles.fieldLabel} style={{ color: "#b45309" }}>
                  Consigne Micro Backup & CR
                </label>
                <textarea
                  className={styles.textArea}
                  rows={2}
                  value={planningData.guidelines.backupNotice}
                  onChange={(e) =>
                    setPlanningData({
                      ...planningData,
                      guidelines: { ...planningData.guidelines, backupNotice: e.target.value },
                    })
                  }
                />
              </div>

              {/* Cleaning Notice */}
              <div className={styles.formField} style={{ gridColumn: "1 / -1" }}>
                <label className={styles.fieldLabel} style={{ color: "#dc2626" }}>
                  Consigne Nettoyage Après Culte
                </label>
                <ClearableInput
                  value={planningData.guidelines.cleaningNotice}
                  onChange={(val) =>
                    setPlanningData({
                      ...planningData,
                      guidelines: { ...planningData.guidelines, cleaningNotice: val },
                    })
                  }
                  onClear={() =>
                    setPlanningData({
                      ...planningData,
                      guidelines: { ...planningData.guidelines, cleaningNotice: "" },
                    })
                  }
                />
              </div>
            </div>
          </div>

          {/* ── SECTION HEADER FOR WEEKS ── */}
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>
              Planning des semaines
              <span className={styles.countBadge}>{planningData.weeks.length} semaines</span>
            </h3>
            <button
              onClick={handleAddWeek}
              className={styles.btnAddWeek}
            >
              <Plus size={14} /> Ajouter une semaine
            </button>
          </div>

          {/* ── WEEKS SCHEDULE LIST ── */}
          <div className={styles.weeksList}>
            {planningData.weeks.map((week, idx) => (
              <div key={week.id || idx} className={styles.weekCard}>
                {/* Week Header */}
                <div className={styles.weekHeader}>
                  <div className={styles.weekHeaderLeft}>
                    <span className={styles.weekBadge}>
                      Semaine {idx + 1}
                    </span>

                    <div className={styles.periodeField}>
                      <label className={styles.periodeLabel}>Période :</label>
                      <ClearableInput
                        value={week.periode}
                        placeholder="Ex: DU 07/09/26 AU 13/09/26"
                        onChange={(val) => updateWeek(idx, w => ({ ...w, periode: val }))}
                        onClear={() => updateWeek(idx, w => ({ ...w, periode: "" }))}
                        style={{ height: 34, fontWeight: 700 }}
                      />
                    </div>
                  </div>

                  <button
                    onClick={() => handleRemoveWeek(week.id, idx)}
                    className={styles.btnRemoveWeek}
                    title="Supprimer cette semaine"
                  >
                    <Trash2 size={13} /> Supprimer
                  </button>
                </div>

                {/* 4-Columns Subgrid for Week Slots */}
                <div className={styles.weekGrid}>
                  
                  {/* 1. Jeûne et Prière (Lundi) */}
                  <div className={styles.slotBox}>
                    <div className={styles.slotBoxHeader}>
                      <div className={styles.slotBoxTitle}>Jeûne & Prière</div>
                      <div className={styles.slotBoxSubtitle}>Lundi 05h–06h / 18h30–19h</div>
                    </div>

                    {/* LEAD */}
                    <div className={styles.formField}>
                      <label className={styles.fieldLabel}>LEAD :</label>
                      <ClearableInput
                        value={week.jeuneEtPriere.lead}
                        placeholder="Prénom…"
                        onChange={(val) => updateWeek(idx, w => ({ ...w, jeuneEtPriere: { ...w.jeuneEtPriere, lead: val } }))}
                        onClear={() => updateWeek(idx, w => ({ ...w, jeuneEtPriere: { ...w.jeuneEtPriere, lead: "" } }))}
                      />
                      {/* Name Chips with 1-click assign / unassign */}
                      <div className={styles.quickMembersList}>
                        {week.jeuneEtPriere.lead && (
                          <button
                            type="button"
                            onClick={() => updateWeek(idx, w => ({ ...w, jeuneEtPriere: { ...w.jeuneEtPriere, lead: "" } }))}
                            className={styles.quickClearChip}
                            title="Vider ce champ"
                          >
                            <X size={10} /> Vider
                          </button>
                        )}
                        {allKnownNames.map((n, i) => {
                          const active = isMemberInField(week.jeuneEtPriere.lead, n);
                          return (
                            <button
                              key={i}
                              type="button"
                              className={`${styles.quickMemberChip} ${active ? styles.quickMemberChipActive : ""}`}
                              onClick={() => updateWeek(idx, w => ({
                                ...w,
                                jeuneEtPriere: {
                                  ...w.jeuneEtPriere,
                                  lead: toggleSingleMember(w.jeuneEtPriere.lead, n)
                                }
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

                    {/* Adjoint */}
                    <div className={styles.formField}>
                      <label className={styles.fieldLabel}>Adjoint :</label>
                      <ClearableInput
                        value={week.jeuneEtPriere.adjoint}
                        placeholder="Prénom ou /"
                        onChange={(val) => updateWeek(idx, w => ({ ...w, jeuneEtPriere: { ...w.jeuneEtPriere, adjoint: val } }))}
                        onClear={() => updateWeek(idx, w => ({ ...w, jeuneEtPriere: { ...w.jeuneEtPriere, adjoint: "/" } }))}
                      />
                      <div className={styles.quickMembersList}>
                        {week.jeuneEtPriere.adjoint && week.jeuneEtPriere.adjoint !== "/" && (
                          <button
                            type="button"
                            onClick={() => updateWeek(idx, w => ({ ...w, jeuneEtPriere: { ...w.jeuneEtPriere, adjoint: "/" } }))}
                            className={styles.quickClearChip}
                            title="Vider ce champ"
                          >
                            <X size={10} /> Vider
                          </button>
                        )}
                        {allKnownNames.map((n, i) => {
                          const active = isMemberInField(week.jeuneEtPriere.adjoint, n);
                          return (
                            <button
                              key={i}
                              type="button"
                              className={`${styles.quickMemberChip} ${active ? styles.quickMemberChipActive : ""}`}
                              onClick={() => updateWeek(idx, w => ({
                                ...w,
                                jeuneEtPriere: {
                                  ...w.jeuneEtPriere,
                                  adjoint: toggleSingleMember(w.jeuneEtPriere.adjoint, n) || "/"
                                }
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
                  </div>

                  {/* 2. Prière (Samedi matin) */}
                  <div className={styles.slotBox}>
                    <div className={styles.slotBoxHeader}>
                      <div className={styles.slotBoxTitle}>Prière Samedi</div>
                      <div className={styles.slotBoxSubtitle}>05h–06h</div>
                    </div>

                    {/* LEAD */}
                    <div className={styles.formField}>
                      <label className={styles.fieldLabel}>LEAD :</label>
                      <ClearableInput
                        value={week.priereSamedi.lead}
                        placeholder="Prénom…"
                        onChange={(val) => updateWeek(idx, w => ({ ...w, priereSamedi: { ...w.priereSamedi, lead: val } }))}
                        onClear={() => updateWeek(idx, w => ({ ...w, priereSamedi: { ...w.priereSamedi, lead: "" } }))}
                      />
                      <div className={styles.quickMembersList}>
                        {week.priereSamedi.lead && (
                          <button
                            type="button"
                            onClick={() => updateWeek(idx, w => ({ ...w, priereSamedi: { ...w.priereSamedi, lead: "" } }))}
                            className={styles.quickClearChip}
                            title="Vider ce champ"
                          >
                            <X size={10} /> Vider
                          </button>
                        )}
                        {allKnownNames.map((n, i) => {
                          const active = isMemberInField(week.priereSamedi.lead, n);
                          return (
                            <button
                              key={i}
                              type="button"
                              className={`${styles.quickMemberChip} ${active ? styles.quickMemberChipActive : ""}`}
                              onClick={() => updateWeek(idx, w => ({
                                ...w,
                                priereSamedi: {
                                  ...w.priereSamedi,
                                  lead: toggleSingleMember(w.priereSamedi.lead, n)
                                }
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

                    {/* Adjoint */}
                    <div className={styles.formField}>
                      <label className={styles.fieldLabel}>Adjoint :</label>
                      <ClearableInput
                        value={week.priereSamedi.adjoint}
                        placeholder="Prénom ou /"
                        onChange={(val) => updateWeek(idx, w => ({ ...w, priereSamedi: { ...w.priereSamedi, adjoint: val } }))}
                        onClear={() => updateWeek(idx, w => ({ ...w, priereSamedi: { ...w.priereSamedi, adjoint: "/" } }))}
                      />
                      <div className={styles.quickMembersList}>
                        {week.priereSamedi.adjoint && week.priereSamedi.adjoint !== "/" && (
                          <button
                            type="button"
                            onClick={() => updateWeek(idx, w => ({ ...w, priereSamedi: { ...w.priereSamedi, adjoint: "/" } }))}
                            className={styles.quickClearChip}
                            title="Vider ce champ"
                          >
                            <X size={10} /> Vider
                          </button>
                        )}
                        {allKnownNames.map((n, i) => {
                          const active = isMemberInField(week.priereSamedi.adjoint, n);
                          return (
                            <button
                              key={i}
                              type="button"
                              className={`${styles.quickMemberChip} ${active ? styles.quickMemberChipActive : ""}`}
                              onClick={() => updateWeek(idx, w => ({
                                ...w,
                                priereSamedi: {
                                  ...w.priereSamedi,
                                  adjoint: toggleSingleMember(w.priereSamedi.adjoint, n) || "/"
                                }
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
                  </div>

                  {/* 3. Prière des Ministères (Dimanche matin) */}
                  <div className={styles.slotBox}>
                    <div className={styles.slotBoxHeader}>
                      <div className={styles.slotBoxTitle}>Prière Ministères</div>
                      <div className={styles.slotBoxSubtitle}>Dimanche 04h–05h</div>
                    </div>

                    {/* Conducteur */}
                    <div className={styles.formField}>
                      <label className={styles.fieldLabel}>Conducteur :</label>
                      <ClearableInput
                        value={week.priereMinisteres.conducteur}
                        placeholder="Ex: En Attente du PD"
                        onChange={(val) => updateWeek(idx, w => ({ ...w, priereMinisteres: { ...w.priereMinisteres, conducteur: val } }))}
                        onClear={() => updateWeek(idx, w => ({ ...w, priereMinisteres: { ...w.priereMinisteres, conducteur: "" } }))}
                      />
                      <div className={styles.quickMembersList}>
                        {week.priereMinisteres.conducteur && (
                          <button
                            type="button"
                            onClick={() => updateWeek(idx, w => ({ ...w, priereMinisteres: { ...w.priereMinisteres, conducteur: "" } }))}
                            className={styles.quickClearChip}
                            title="Vider ce champ"
                          >
                            <X size={10} /> Vider
                          </button>
                        )}
                        {allKnownNames.map((n, i) => {
                          const active = isMemberInField(week.priereMinisteres.conducteur, n);
                          return (
                            <button
                              key={i}
                              type="button"
                              className={`${styles.quickMemberChip} ${active ? styles.quickMemberChipActive : ""}`}
                              onClick={() => updateWeek(idx, w => ({
                                ...w,
                                priereMinisteres: {
                                  ...w.priereMinisteres,
                                  conducteur: toggleSingleMember(w.priereMinisteres.conducteur, n)
                                }
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

                    {/* Sous réserve */}
                    <div className={styles.formField}>
                      <label className={styles.fieldLabel}>Sous réserve :</label>
                      <ClearableInput
                        value={week.priereMinisteres.sousReserve}
                        placeholder="Ex: BENJAMIN (Sous réserve)"
                        onChange={(val) => updateWeek(idx, w => ({ ...w, priereMinisteres: { ...w.priereMinisteres, sousReserve: val } }))}
                        onClear={() => updateWeek(idx, w => ({ ...w, priereMinisteres: { ...w.priereMinisteres, sousReserve: "" } }))}
                      />
                      <div className={styles.quickMembersList}>
                        {week.priereMinisteres.sousReserve && (
                          <button
                            type="button"
                            onClick={() => updateWeek(idx, w => ({ ...w, priereMinisteres: { ...w.priereMinisteres, sousReserve: "" } }))}
                            className={styles.quickClearChip}
                            title="Vider ce champ"
                          >
                            <X size={10} /> Vider
                          </button>
                        )}
                        {allKnownNames.map((n, i) => {
                          const active = isMemberInField(week.priereMinisteres.sousReserve, n);
                          return (
                            <button
                              key={i}
                              type="button"
                              className={`${styles.quickMemberChip} ${active ? styles.quickMemberChipActive : ""}`}
                              onClick={() => updateWeek(idx, w => ({
                                ...w,
                                priereMinisteres: {
                                  ...w.priereMinisteres,
                                  sousReserve: toggleSingleMember(w.priereMinisteres.sousReserve, n, (name) => `${name} (Sous réserve)`)
                                }
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
                  </div>

                  {/* 4. Service du Dimanche */}
                  <div className={`${styles.slotBox} ${styles.slotBoxSunday}`}>
                    <div className={styles.slotBoxHeader}>
                      <div className={styles.slotBoxTitle}>Service du Dimanche</div>
                      <div className={styles.slotBoxSubtitle}>Culte & Intégration</div>
                    </div>

                    {/* Événement spécial */}
                    <div className={styles.formField}>
                      <label className={styles.fieldLabel}>Événement Spécial (optionnel) :</label>
                      <ClearableInput
                        value={week.serviceDimanche.specialEvent || ""}
                        placeholder="Ex: COCKTAIL DE BIENVENUE"
                        onChange={(val) => updateWeek(idx, w => ({ ...w, serviceDimanche: { ...w.serviceDimanche, specialEvent: val } }))}
                        onClear={() => updateWeek(idx, w => ({ ...w, serviceDimanche: { ...w.serviceDimanche, specialEvent: "" } }))}
                      />
                    </div>

                    {/* Coordination */}
                    <div className={styles.formField}>
                      <label className={styles.fieldLabel}>Coordination (+ Présentation) :</label>
                      <ClearableInput
                        value={week.serviceDimanche.coordination}
                        placeholder="Ex: BERTILLE (Coordination + Présentation)"
                        onChange={(val) => updateWeek(idx, w => ({ ...w, serviceDimanche: { ...w.serviceDimanche, coordination: val } }))}
                        onClear={() => updateWeek(idx, w => ({ ...w, serviceDimanche: { ...w.serviceDimanche, coordination: "" } }))}
                      />
                      <div className={styles.quickMembersList}>
                        {week.serviceDimanche.coordination && (
                          <button
                            type="button"
                            onClick={() => updateWeek(idx, w => ({ ...w, serviceDimanche: { ...w.serviceDimanche, coordination: "" } }))}
                            className={styles.quickClearChip}
                            title="Vider ce champ"
                          >
                            <X size={10} /> Vider
                          </button>
                        )}
                        {allKnownNames.map((n, i) => {
                          const active = isMemberInField(week.serviceDimanche.coordination, n);
                          return (
                            <button
                              key={i}
                              type="button"
                              className={`${styles.quickMemberChip} ${active ? styles.quickMemberChipActive : ""}`}
                              onClick={() => updateWeek(idx, w => ({
                                ...w,
                                serviceDimanche: {
                                  ...w.serviceDimanche,
                                  coordination: toggleSingleMember(w.serviceDimanche.coordination, n, (name) => `${name} (Coordination + Présentation)`)
                                }
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

                    {/* Fanion + Stats */}
                    <div className={styles.formField}>
                      <label className={styles.fieldLabel}>Fanion + Stats + Accueil :</label>
                      <ClearableInput
                        value={week.serviceDimanche.fanionStatsAccueil}
                        placeholder="Ex: CHRISTIAN (Fanion + Statistiques + Accueil)"
                        onChange={(val) => updateWeek(idx, w => ({ ...w, serviceDimanche: { ...w.serviceDimanche, fanionStatsAccueil: val } }))}
                        onClear={() => updateWeek(idx, w => ({ ...w, serviceDimanche: { ...w.serviceDimanche, fanionStatsAccueil: "" } }))}
                      />
                      <div className={styles.quickMembersList}>
                        {week.serviceDimanche.fanionStatsAccueil && (
                          <button
                            type="button"
                            onClick={() => updateWeek(idx, w => ({ ...w, serviceDimanche: { ...w.serviceDimanche, fanionStatsAccueil: "" } }))}
                            className={styles.quickClearChip}
                            title="Vider ce champ"
                          >
                            <X size={10} /> Vider
                          </button>
                        )}
                        {allKnownNames.map((n, i) => {
                          const active = isMemberInField(week.serviceDimanche.fanionStatsAccueil, n);
                          return (
                            <button
                              key={i}
                              type="button"
                              className={`${styles.quickMemberChip} ${active ? styles.quickMemberChipActive : ""}`}
                              onClick={() => updateWeek(idx, w => ({
                                ...w,
                                serviceDimanche: {
                                  ...w.serviceDimanche,
                                  fanionStatsAccueil: toggleSingleMember(w.serviceDimanche.fanionStatsAccueil, n, (name) => `${name} (Fanion + Statistiques + Accueil)`)
                                }
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

                    {/* Salon Lounge */}
                    <div className={styles.formField}>
                      <label className={styles.fieldLabel}>Salon Lounge / Restauration :</label>
                      <ClearableInput
                        value={week.serviceDimanche.salonLoungeRestauration}
                        placeholder="Ex: INGRID + JEDIDA"
                        onChange={(val) => updateWeek(idx, w => ({ ...w, serviceDimanche: { ...w.serviceDimanche, salonLoungeRestauration: val } }))}
                        onClear={() => updateWeek(idx, w => ({ ...w, serviceDimanche: { ...w.serviceDimanche, salonLoungeRestauration: "" } }))}
                      />
                      {/* Multi-member toggle chips: click to add, click again to remove! */}
                      <div className={styles.quickMembersList}>
                        {week.serviceDimanche.salonLoungeRestauration && (
                          <button
                            type="button"
                            onClick={() => updateWeek(idx, w => ({ ...w, serviceDimanche: { ...w.serviceDimanche, salonLoungeRestauration: "" } }))}
                            className={styles.quickClearChip}
                            title="Vider tous les noms"
                          >
                            <X size={10} /> Vider
                          </button>
                        )}
                        {allKnownNames.map((n, i) => {
                          const active = isMemberInField(week.serviceDimanche.salonLoungeRestauration, n);
                          return (
                            <button
                              key={i}
                              type="button"
                              className={`${styles.quickMemberChip} ${active ? styles.quickMemberChipActive : ""}`}
                              onClick={() => updateWeek(idx, w => ({
                                ...w,
                                serviceDimanche: {
                                  ...w.serviceDimanche,
                                  salonLoungeRestauration: toggleMultiMember(w.serviceDimanche.salonLoungeRestauration, n)
                                }
                              }))}
                              title={active ? `Retirer ${n}` : `Ajouter ${n}`}
                            >
                              {active ? <X size={9} /> : "+"}
                              {n}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Conseiller Mobile */}
                    <div className={styles.formField}>
                      <label className={styles.fieldLabel}>Conseiller Mobile :</label>
                      <ClearableInput
                        value={week.serviceDimanche.conseillerMobile}
                        placeholder="Ex: BENJAMIN (Conseiller mobile)"
                        onChange={(val) => updateWeek(idx, w => ({ ...w, serviceDimanche: { ...w.serviceDimanche, conseillerMobile: val } }))}
                        onClear={() => updateWeek(idx, w => ({ ...w, serviceDimanche: { ...w.serviceDimanche, conseillerMobile: "" } }))}
                      />
                      <div className={styles.quickMembersList}>
                        {week.serviceDimanche.conseillerMobile && (
                          <button
                            type="button"
                            onClick={() => updateWeek(idx, w => ({ ...w, serviceDimanche: { ...w.serviceDimanche, conseillerMobile: "" } }))}
                            className={styles.quickClearChip}
                            title="Vider ce champ"
                          >
                            <X size={10} /> Vider
                          </button>
                        )}
                        {allKnownNames.map((n, i) => {
                          const active = isMemberInField(week.serviceDimanche.conseillerMobile, n);
                          return (
                            <button
                              key={i}
                              type="button"
                              className={`${styles.quickMemberChip} ${active ? styles.quickMemberChipActive : ""}`}
                              onClick={() => updateWeek(idx, w => ({
                                ...w,
                                serviceDimanche: {
                                  ...w.serviceDimanche,
                                  conseillerMobile: toggleSingleMember(w.serviceDimanche.conseillerMobile, n, (name) => `${name} (Conseiller mobile)`)
                                }
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

                    {/* Accueil */}
                    <div className={styles.formField}>
                      <label className={styles.fieldLabel}>Accueil :</label>
                      <ClearableInput
                        value={week.serviceDimanche.accueil}
                        placeholder="Ex: CHRISTIANE + PROSPER + LAURISSA (ACCUEIL)"
                        onChange={(val) => updateWeek(idx, w => ({ ...w, serviceDimanche: { ...w.serviceDimanche, accueil: val } }))}
                        onClear={() => updateWeek(idx, w => ({ ...w, serviceDimanche: { ...w.serviceDimanche, accueil: "" } }))}
                      />
                      {/* Multi-member toggle chips: click to add, click again to remove! */}
                      <div className={styles.quickMembersList}>
                        {week.serviceDimanche.accueil && (
                          <button
                            type="button"
                            onClick={() => updateWeek(idx, w => ({ ...w, serviceDimanche: { ...w.serviceDimanche, accueil: "" } }))}
                            className={styles.quickClearChip}
                            title="Vider tous les noms d'accueil"
                          >
                            <X size={10} /> Vider
                          </button>
                        )}
                        {allKnownNames.map((n, i) => {
                          const active = isMemberInField(week.serviceDimanche.accueil, n);
                          return (
                            <button
                              key={i}
                              type="button"
                              className={`${styles.quickMemberChip} ${active ? styles.quickMemberChipActive : ""}`}
                              onClick={() => updateWeek(idx, w => ({
                                ...w,
                                serviceDimanche: {
                                  ...w.serviceDimanche,
                                  accueil: toggleMultiMember(w.serviceDimanche.accueil, n, "ACCUEIL")
                                }
                              }))}
                              title={active ? `Retirer ${n}` : `Ajouter ${n}`}
                            >
                              {active ? <X size={9} /> : "+"}
                              {n}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                  </div>

                </div>
              </div>
            ))}
          </div>

          {/* Bottom Action bar */}
          <div className={styles.bottomActions}>
            <button
              onClick={handleAddWeek}
              className={`${styles.btnAction} ${styles.btnAddWeekBottom}`}
            >
              <Plus size={14} /> Ajouter une semaine
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className={`${styles.btnAction} ${styles.btnSave}`}
            >
              <Save size={14} /> {saving ? "Enregistrement…" : "Sauvegarder les modifications"}
            </button>
          </div>
        </div>
      ) : (
        /* ══════════════════════════════════════════════════
           PREVIEW MODE: EXACT VISUAL DOCUMENT
           ══════════════════════════════════════════════════ */
        <div className={styles.previewContainer}>
          <div className={styles.previewScrollNotice}>
            Faites défiler horizontalement pour visualiser le document A4 complet.
          </div>

          <div className={styles.previewOuter}>
            <PlanningDocument
              data={planningData}
              containerRef={reportRef}
              logoUrl={church?.logo_url}
            />
          </div>
        </div>
      )}

      {/* Hidden print container for high-res PDF generation */}
      <div style={{ position: "absolute", left: -99999, top: -99999, pointerEvents: "none" }}>
        <PlanningDocument
          data={planningData}
          containerRef={reportRef}
          logoUrl={church?.logo_url}
        />
      </div>
    </div>
  );
}
