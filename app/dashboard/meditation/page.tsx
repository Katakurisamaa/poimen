"use client";

import { useState, useEffect, useId } from "react";
import { toPng } from "html-to-image";
import jsPDF from "jspdf";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  BookOpen,
  Download,
  Copy,
  Check,
  RefreshCw,
  Trash2,
  Eye,
  Edit3,
  FileText,
  Save,
  MessageCircle,
  Sunrise,
  Sun,
  Sunset,
  Moon,
  LayoutGrid,
  CalendarDays,
  UserPlus,
} from "lucide-react";
import { useWorkspace } from "@/lib/use-workspace";
import { useFeedback } from "@/components/experience/FeedbackProvider";
import { supabase } from "@/lib/supabase";
import { getActiveContext, readJsonStorage } from "@/lib/client-session";
import MeditationPoster from "@/components/meditation/MeditationPoster";
import MemberPickerModal, { FamilyMemberItem } from "@/components/meditation/MemberPickerModal";
import { FAMILLE_NOE_LOGO_BASE64 } from "@/lib/famille-noe-logo-base64";
import styles from "@/components/meditation/Meditation.module.css";
import {
  MeditationPlan,
  FIXED_MEDITATION_HOURS,
  MEDITATION_DAYS,
  DEFAULT_FAMILLE_NOE_SAMPLE,
} from "@/types/meditation";
import {
  getMondayOfWeek,
  formatWeekLabel,
  shiftWeek,
  loadMeditationPlan,
  saveMeditationPlan,
  formatMeditationWhatsApp,
} from "@/lib/meditation-service";

// Default brethren known in Famille de Noé (from the official weekly schedule)
const KNOWN_NOE_MEMBERS: FamilyMemberItem[] = [
  { id: "ref-1", name: "Cécile Eya", status: "Membre" },
  { id: "ref-2", name: "Christian", status: "Membre" },
  { id: "ref-3", name: "Ariane", status: "Membre" },
  { id: "ref-4", name: "Marlise", status: "Membre" },
  { id: "ref-5", name: "Benjamin", status: "Membre" },
  { id: "ref-6", name: "Nadège", status: "Membre" },
  { id: "ref-7", name: "Mbiayo", status: "Membre" },
  { id: "ref-8", name: "Aesone", status: "Membre" },
  { id: "ref-9", name: "Ingrid", status: "Membre" },
  { id: "ref-10", name: "Léonard", status: "Membre" },
  { id: "ref-11", name: "Dede", status: "Membre" },
  { id: "ref-12", name: "Sylvie", status: "Membre" },
  { id: "ref-13", name: "Phalone", status: "Membre" },
  { id: "ref-14", name: "Yvette", status: "Membre" },
  { id: "ref-15", name: "M. Cecile", status: "Membre" },
  { id: "ref-16", name: "Bertille", status: "Membre" },
  { id: "ref-17", name: "Sandra", status: "Membre" },
  { id: "ref-18", name: "Laurene", status: "Membre" },
];

export default function MeditationPage() {
  const workspace = useWorkspace();
  const { notify } = useFeedback();

  // Active week key (Monday YYYY-MM-DD)
  const [selectedWeek, setSelectedWeek] = useState<string>(() =>
    getMondayOfWeek(new Date())
  );

  // Meditation Plan state
  const [plan, setPlan] = useState<MeditationPlan>(() => ({
    week_key: getMondayOfWeek(new Date()),
    week_label: formatWeekLabel(getMondayOfWeek(new Date())),
    livre_theme: "Livre de Jean",
    verset_cle: "Jean 15:5",
    exhortation:
      "« Ta parole est une lampe à mes pieds, et une lumière sur mon sentier. » — Psaume 119:105",
    theme_style: "obsidian",
    schedule: {
      0: { 0: { person: "", verse: "" }, 1: { person: "", verse: "" }, 2: { person: "", verse: "" }, 3: { person: "", verse: "" } },
      1: { 0: { person: "", verse: "" }, 1: { person: "", verse: "" }, 2: { person: "", verse: "" }, 3: { person: "", verse: "" } },
      2: { 0: { person: "", verse: "" }, 1: { person: "", verse: "" }, 2: { person: "", verse: "" }, 3: { person: "", verse: "" } },
      3: { 0: { person: "", verse: "" }, 1: { person: "", verse: "" }, 2: { person: "", verse: "" }, 3: { person: "", verse: "" } },
      4: { 0: { person: "", verse: "" }, 1: { person: "", verse: "" }, 2: { person: "", verse: "" }, 3: { person: "", verse: "" } },
    },
  }));

  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");
  const [editorViewMode, setEditorViewMode] = useState<"day" | "table">("day");
  const [activeDayIndex, setActiveDayIndex] = useState<number>(0); // 0: Lundi ... 4: Vendredi
  const [saving, setSaving] = useState<boolean>(false);
  const [exportingImage, setExportingImage] = useState<boolean>(false);
  const [exportingPdf, setExportingPdf] = useState<boolean>(false);
  const [copiedWhatsApp, setCopiedWhatsApp] = useState<boolean>(false);

  // Family members list for custom selection modal & autocomplete
  const [familyMembers, setFamilyMembers] = useState<FamilyMemberItem[]>(KNOWN_NOE_MEMBERS);

  // Modal State for slot member picker
  const [pickerModal, setPickerModal] = useState<{
    isOpen: boolean;
    dayId: number;
    hourId: number;
    dayLabel: string;
    hourLabel: string;
    currentName: string;
  } | null>(null);

  const datalistId = useId();

  // Load family members from database (filtered by current bergerie if available)
  useEffect(() => {
    async function fetchMembers() {
      try {
        const context = getActiveContext();
        const family = readJsonStorage<{ id?: string; name?: string }>("selected_family");
        const familyId = context?.bergerie_id || family?.id;

        let query = supabase
          .from("members")
          .select("id, firstName, lastName, civility, status, bergerie_id")
          .order("firstName");

        if (familyId) {
          query = query.eq("bergerie_id", familyId);
        }

        const { data, error } = await query;
        if (!error && data && data.length > 0) {
          const dbMembers: FamilyMemberItem[] = data.map((m) => {
            const fullName = `${m.firstName || ""} ${m.lastName || ""}`.trim() || "Membre";
            return {
              id: m.id,
              name: fullName,
              status: m.status || "Membre",
              civility: m.civility,
            };
          });

          // Merge dbMembers with KNOWN_NOE_MEMBERS (avoiding duplicates)
          const seen = new Set<string>();
          const merged: FamilyMemberItem[] = [];

          for (const m of dbMembers) {
            const key = m.name.toLowerCase();
            if (!seen.has(key)) {
              seen.add(key);
              merged.push(m);
            }
          }
          for (const m of KNOWN_NOE_MEMBERS) {
            const key = m.name.toLowerCase();
            if (!seen.has(key)) {
              seen.add(key);
              merged.push(m);
            }
          }

          setFamilyMembers(merged);
        }
      } catch (err) {
        console.warn("Could not fetch members from DB, keeping default known list:", err);
      }
    }
    fetchMembers();
  }, []);

  // Load plan when selectedWeek changes
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const loaded = await loadMeditationPlan(selectedWeek);
      if (!cancelled) {
        setPlan(loaded);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [selectedWeek]);

  // Update a single slot
  const updateSlot = (
    dayId: number,
    hourId: number,
    field: "person" | "verse",
    value: string
  ) => {
    setPlan((prev) => {
      const daySchedule = { ...(prev.schedule[dayId] || {}) };
      const currentSlot = daySchedule[hourId] || { person: "", verse: "" };
      daySchedule[hourId] = {
        ...currentSlot,
        [field]: value,
      };
      const updated: MeditationPlan = {
        ...prev,
        schedule: {
          ...prev.schedule,
          [dayId]: daySchedule,
        },
      };
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(
            `poimen_meditation_noe_${prev.week_key}`,
            JSON.stringify(updated)
          );
        } catch {}
      }
      return updated;
    });
  };

  // Open the custom member picker modal for a given slot
  const openMemberPicker = (dayId: number, hourId: number) => {
    const day = MEDITATION_DAYS.find((d) => d.id === dayId) || MEDITATION_DAYS[0];
    const hour = FIXED_MEDITATION_HOURS.find((h) => h.id === hourId) || FIXED_MEDITATION_HOURS[0];
    const slot = plan.schedule[dayId]?.[hourId] || { person: "", verse: "" };

    setPickerModal({
      isOpen: true,
      dayId,
      hourId,
      dayLabel: day.label,
      hourLabel: hour.label,
      currentName: slot.person || "",
    });
  };

  // Close the modal
  const closeMemberPicker = () => {
    setPickerModal(null);
  };

  // Save to Supabase
  const handleSave = async () => {
    setSaving(true);
    const res = await saveMeditationPlan(plan);
    setSaving(false);
    if (res.success) {
      notify("Planning de méditation enregistré avec succès !");
    } else {
      notify("Enregistré localement.");
    }
  };

  // Reset to reference sample
  const handleResetToSample = () => {
    const sample = JSON.parse(JSON.stringify(DEFAULT_FAMILLE_NOE_SAMPLE));
    sample.week_key = selectedWeek;
    sample.week_label = formatWeekLabel(selectedWeek);
    sample.theme_style = plan.theme_style || "obsidian";
    setPlan(sample);
    saveMeditationPlan(sample);
    notify("Modèle de référence de la Famille de Noé restauré !");
  };

  // Clear slots
  const handleClearSlots = () => {
    if (!window.confirm("Voulez-vous effacer toutes les attributions de cette semaine ?")) {
      return;
    }
    const emptySchedule: any = {};
    for (const d of MEDITATION_DAYS) {
      emptySchedule[d.id] = {
        0: { person: "", verse: "" },
        1: { person: "", verse: "" },
        2: { person: "", verse: "" },
        3: { person: "", verse: "" },
      };
    }
    setPlan((prev) => ({
      ...prev,
      schedule: emptySchedule,
    }));
    notify("Planning réinitialisé.");
  };

  // Copy WhatsApp Formatted Text
  const handleCopyWhatsApp = async () => {
    const text = formatMeditationWhatsApp(plan);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedWhatsApp(true);
      notify("Texte WhatsApp copié dans le presse-papier !");
      setTimeout(() => setCopiedWhatsApp(false), 3000);
    } catch {
      notify("Erreur lors de la copie du texte.");
    }
  };

  // Generate PNG
  const generatePngDataUrl = async (): Promise<string | null> => {
    const element = document.getElementById("meditation-poster-container");
    if (!element) {
      notify("Erreur : l'affiche n'a pas été trouvée.");
      return null;
    }
    return await toPng(element, {
      pixelRatio: 2.5,
      backgroundColor: plan.theme_style === "parchment" ? "#FFFFFF" : "#0C081D",
      cacheBust: true,
    });
  };

  // Download HD Image
  const handleDownloadImage = async () => {
    setExportingImage(true);
    notify("Génération de l'image haute définition pour WhatsApp…");

    try {
      const dataUrl = await generatePngDataUrl();
      if (!dataUrl) return;

      const cleanWeek = plan.week_key.replace(/-/g, "_");
      const link = document.createElement("a");
      link.download = `Meditation_Famille_de_Noe_${cleanWeek}.png`;
      link.href = dataUrl;
      link.click();
      notify("Image HD prête à être partagée !");
    } catch (err) {
      console.error("Export error:", err);
      notify("Une erreur est survenue lors de la création de l'image.");
    } finally {
      setExportingImage(false);
    }
  };

  // Share to WhatsApp directly
  const handleShareWhatsApp = async () => {
    setExportingImage(true);
    notify("Préparation du partage WhatsApp…");

    try {
      const dataUrl = await generatePngDataUrl();
      if (!dataUrl) return;

      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File(
        [blob],
        `Meditation_Famille_de_Noe_${plan.week_key}.png`,
        { type: "image/png" }
      );

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Planning Méditation — Famille de Noé (${plan.week_label})`,
          text: formatMeditationWhatsApp(plan),
        });
        notify("Partagé avec succès !");
      } else {
        const link = document.createElement("a");
        link.download = `Meditation_Famille_de_Noe_${plan.week_key}.png`;
        link.href = dataUrl;
        link.click();

        await navigator.clipboard.writeText(formatMeditationWhatsApp(plan));
        notify("Image HD téléchargée et texte copié pour WhatsApp !");
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        console.error("Share error:", err);
        handleDownloadImage();
      }
    } finally {
      setExportingImage(false);
    }
  };

  // Download PDF
  const handleDownloadPdf = async () => {
    setExportingPdf(true);
    notify("Génération du document PDF…");

    try {
      const dataUrl = await generatePngDataUrl();
      if (!dataUrl) return;

      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      const pdfWidth = 297;
      const pdfHeight = 210;
      const margin = 8;
      const availW = pdfWidth - margin * 2;
      const availH = pdfHeight - margin * 2;

      const img = new (window as any).Image();
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
      pdf.save(`Planning_Meditation_Famille_de_Noe_${plan.week_key}.pdf`);
      notify("Document PDF généré !");
    } catch (err) {
      console.error("PDF error:", err);
      notify("Erreur lors de la génération du PDF.");
    } finally {
      setExportingPdf(false);
    }
  };

  const hourIcons = [
    <Sunrise key="0" size={15} style={{ color: "#FBBF24" }} />,
    <Sun key="1" size={15} style={{ color: "#FDE047" }} />,
    <Sunset key="2" size={15} style={{ color: "#FB923C" }} />,
    <Moon key="3" size={15} style={{ color: "#C084FC" }} />,
  ];

  const activeDay = MEDITATION_DAYS[activeDayIndex] || MEDITATION_DAYS[0];

  return (
    <div className={styles.container}>
      {/* ── TOP HERO HEADER ── */}
      <div className={styles.headerCard}>
        {/* Brand identity & Base64 Logo (Always visible) */}
        <div className={styles.brandLeft}>
          <div className={styles.logoWrapper}>
            <img
              src={FAMILLE_NOE_LOGO_BASE64}
              alt="Logo Famille de Noé"
              className={styles.logoImg}
            />
          </div>

          <div className={styles.titleArea}>
            <span className={styles.kicker}>Famille de Noé</span>
            <h1 className={styles.title}>Planning de Méditation</h1>
            <p className={styles.subtitle}>
              Édition du plan hebdomadaire & partage pour WhatsApp
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className={styles.actionsBar}>
          <button
            onClick={handleShareWhatsApp}
            disabled={exportingImage}
            className={styles.btnWhatsApp}
          >
            <MessageCircle size={17} />
            <span>{exportingImage ? "Génération..." : "Partager WhatsApp"}</span>
          </button>

          <button
            onClick={handleDownloadImage}
            disabled={exportingImage}
            className={styles.btnSecondary}
            title="Télécharger l'image en haute résolution"
          >
            <Download size={15} />
            <span>Image HD</span>
          </button>

          <button
            onClick={handleCopyWhatsApp}
            className={styles.btnSecondary}
            title="Copier le texte formaté pour la légende WhatsApp"
          >
            {copiedWhatsApp ? <Check size={15} style={{ color: "#10B981" }} /> : <Copy size={15} />}
            <span>{copiedWhatsApp ? "Copié !" : "Texte"}</span>
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className={styles.btnPrimary}
          >
            <Save size={15} />
            <span>{saving ? "..." : "Enregistrer"}</span>
          </button>
        </div>
      </div>

      {/* ── WEEK NAV & VIEW TABS ── */}
      <div className={styles.controlRow}>
        {/* Week navigation */}
        <div className={styles.weekNav}>
          <button
            onClick={() => setSelectedWeek((prev) => shiftWeek(prev, -1))}
            className={styles.navArrowBtn}
            title="Semaine précédente"
          >
            <ChevronLeft size={18} />
          </button>

          <div className={styles.weekBadge}>
            <Calendar size={15} />
            <span>{formatWeekLabel(selectedWeek)}</span>
          </div>

          <button
            onClick={() => setSelectedWeek((prev) => shiftWeek(prev, 1))}
            className={styles.navArrowBtn}
            title="Semaine suivante"
          >
            <ChevronRight size={18} />
          </button>

          <button
            onClick={() => setSelectedWeek(getMondayOfWeek(new Date()))}
            style={{
              background: "none",
              border: "none",
              color: "var(--muted)",
              fontSize: 12,
              fontWeight: 600,
              textDecoration: "underline",
              cursor: "pointer",
              marginLeft: 4,
            }}
          >
            Aujourd&apos;hui
          </button>
        </div>

        {/* Mode Tabs */}
        <div className={styles.tabGroup}>
          <button
            onClick={() => setActiveTab("edit")}
            className={`${styles.tabBtn} ${activeTab === "edit" ? styles.tabBtnActive : ""}`}
          >
            <Edit3 size={14} />
            <span>Éditer</span>
          </button>

          <button
            onClick={() => setActiveTab("preview")}
            className={`${styles.tabBtn} ${activeTab === "preview" ? styles.tabBtnActive : ""}`}
          >
            <Eye size={14} />
            <span>Aperçu Affiche</span>
          </button>
        </div>
      </div>

      {/* ── TAB 1: EDITING VIEW ── */}
      {activeTab === "edit" && (
        <div>
          {/* Metadata Parameters Card */}
          <div className={styles.panelCard}>
            <div className={styles.panelTitle}>
              <BookOpen size={16} />
              <span>Paramètres du Planning</span>
            </div>

            <div className={styles.fieldGrid}>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Livre ou Thème</label>
                <input
                  type="text"
                  className={styles.input}
                  value={plan.livre_theme}
                  onChange={(e) =>
                    setPlan((prev) => ({ ...prev, livre_theme: e.target.value }))
                  }
                  placeholder="Ex : Livre de Jean"
                />
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Verset clé (optionnel)</label>
                <input
                  type="text"
                  className={styles.input}
                  value={plan.verset_cle || ""}
                  onChange={(e) =>
                    setPlan((prev) => ({ ...prev, verset_cle: e.target.value }))
                  }
                  placeholder="Ex : Jean 15:5"
                />
              </div>
            </div>

            <div className={styles.fieldGroup} style={{ marginTop: 14 }}>
              <label className={styles.fieldLabel}>
                Exhortation / Verset en bas de l&apos;affiche
              </label>
              <input
                type="text"
                className={styles.input}
                value={plan.exhortation || ""}
                onChange={(e) =>
                  setPlan((prev) => ({ ...prev, exhortation: e.target.value }))
                }
                placeholder="Ex : « Ta parole est une lampe à mes pieds... » — Psaume 119:105"
              />
            </div>

            {/* Quick Actions */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 10,
                marginTop: 16,
                paddingTop: 14,
                borderTop: "1px solid var(--border)",
              }}
            >
              <button
                type="button"
                onClick={handleResetToSample}
                className={styles.btnSecondary}
                style={{ fontSize: 12 }}
              >
                <RefreshCw size={13} />
                <span>Restaurer le modèle de référence Noé</span>
              </button>

              <button
                type="button"
                onClick={handleClearSlots}
                className={styles.btnSecondary}
                style={{ fontSize: 12, color: "#EF4444" }}
              >
                <Trash2 size={13} />
                <span>Vider la semaine</span>
              </button>
            </div>
          </div>

          {/* Datalist for disciple name suggestions */}
          <datalist id={datalistId}>
            {familyMembers.map((m) => (
              <option key={m.id} value={m.name} />
            ))}
          </datalist>

          {/* Schedule Editor Card */}
          <div className={styles.panelCard}>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                marginBottom: 16,
              }}
            >
              <div className={styles.panelTitle} style={{ margin: 0 }}>
                <CalendarDays size={16} />
                <span>Attributions des Frères & Sœurs</span>
              </div>

              {/* View Switcher: Day View (Mobile-optimized) vs Full Table (Desktop) */}
              <div className={styles.tabGroup}>
                <button
                  type="button"
                  onClick={() => setEditorViewMode("day")}
                  className={`${styles.tabBtn} ${editorViewMode === "day" ? styles.tabBtnActive : ""}`}
                >
                  <CalendarDays size={13} />
                  <span>Vue par Jour</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditorViewMode("table")}
                  className={`${styles.tabBtn} ${editorViewMode === "table" ? styles.tabBtnActive : ""}`}
                >
                  <LayoutGrid size={13} />
                  <span>Tableau Complet</span>
                </button>
              </div>
            </div>

            {/* ── MOBILE / DAY-BY-DAY VIEW ── */}
            {editorViewMode === "day" && (
              <div>
                {/* Day Selector Chips */}
                <div className={styles.mobileDayTabs}>
                  {MEDITATION_DAYS.map((day, idx) => (
                    <button
                      key={day.id}
                      type="button"
                      onClick={() => setActiveDayIndex(idx)}
                      className={`${styles.dayChip} ${activeDayIndex === idx ? styles.dayChipActive : ""}`}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>

                {/* 4 Fixed Hour Slots for the active day */}
                <div>
                  {FIXED_MEDITATION_HOURS.map((hour) => {
                    const daySchedule = plan.schedule[activeDay.id] || {};
                    const slot = daySchedule[hour.id] || { person: "", verse: "" };

                    return (
                      <div key={hour.id} className={styles.slotCard}>
                        <div className={styles.slotHeader}>
                          <div className={styles.slotTimeBadge}>
                            {hourIcons[hour.id]}
                            <span>{hour.label}</span>
                          </div>
                          <span className={styles.slotNameTag}>{hour.name}</span>
                        </div>

                        <div className={styles.fieldGrid}>
                          <div className={styles.fieldGroup}>
                            <label className={styles.fieldLabel}>
                              Frère / Sœur programmé(e)
                            </label>
                            <div className={styles.personInputWrapper}>
                              <input
                                type="text"
                                list={datalistId}
                                className={styles.input}
                                value={slot.person}
                                onChange={(e) =>
                                  updateSlot(
                                    activeDay.id,
                                    hour.id,
                                    "person",
                                    e.target.value
                                  )
                                }
                                placeholder="Nom du disciple"
                              />
                              <button
                                type="button"
                                className={styles.btnChooseMember}
                                onClick={() => openMemberPicker(activeDay.id, hour.id)}
                                title="Choisir parmi les membres de la famille"
                              >
                                <UserPlus size={14} />
                                <span>Choisir</span>
                              </button>
                            </div>
                          </div>

                          <div className={styles.fieldGroup}>
                            <label className={styles.fieldLabel}>Verset(s)</label>
                            <input
                              type="text"
                              className={styles.input}
                              value={slot.verse}
                              onChange={(e) =>
                                updateSlot(
                                  activeDay.id,
                                  hour.id,
                                  "verse",
                                  e.target.value
                                )
                              }
                              placeholder="Ex : Jean 15:11"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── FULL TABLE VIEW (Desktop / Tablet) ── */}
            {editorViewMode === "table" && (
              <div className={styles.desktopTableWrapper}>
                <table className={styles.gridTable}>
                  <thead>
                    <tr>
                      <th>JOURS</th>
                      {FIXED_MEDITATION_HOURS.map((hour, idx) => (
                        <th key={hour.id}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 6,
                            }}
                          >
                            {hourIcons[idx]}
                            <span>{hour.label}</span>
                          </div>
                          <div style={{ fontSize: 11, fontWeight: 500, opacity: 0.8 }}>
                            {hour.name}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {MEDITATION_DAYS.map((day) => {
                      const daySchedule = plan.schedule[day.id] || {};

                      return (
                        <tr key={day.id}>
                          <td>
                            <span className={styles.dayCellLabel}>{day.label}</span>
                          </td>
                          {FIXED_MEDITATION_HOURS.map((hour) => {
                            const slot = daySchedule[hour.id] || {
                              person: "",
                              verse: "",
                            };

                            return (
                              <td key={hour.id}>
                                <div className={styles.personInputWrapper}>
                                  <input
                                    type="text"
                                    list={datalistId}
                                    className={styles.tableInputPerson}
                                    value={slot.person}
                                    onChange={(e) =>
                                      updateSlot(
                                        day.id,
                                        hour.id,
                                        "person",
                                        e.target.value
                                      )
                                    }
                                    placeholder="Nom..."
                                  />
                                  <button
                                    type="button"
                                    className={styles.btnChooseMember}
                                    onClick={() => openMemberPicker(day.id, hour.id)}
                                    title="Choisir un membre"
                                    style={{ padding: "6px 8px", marginBottom: 4 }}
                                  >
                                    <UserPlus size={13} />
                                  </button>
                                </div>
                                <input
                                  type="text"
                                  className={styles.tableInputVerse}
                                  value={slot.verse}
                                  onChange={(e) =>
                                    updateSlot(
                                      day.id,
                                      hour.id,
                                      "verse",
                                      e.target.value
                                    )
                                  }
                                  placeholder="Verset..."
                                />
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 2: LIVE PREVIEW & EXPORT VIEW ── */}
      {activeTab === "preview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Action Bar with Style Selector Moved Here */}
          <div className={styles.panelCard} style={{ marginBottom: 0 }}>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
              }}
            >
              {/* Left: Style Switcher (Moved here as requested) */}
              <div>
                <span
                  style={{
                    display: "block",
                    fontSize: 11,
                    textTransform: "uppercase",
                    letterSpacing: "1px",
                    fontWeight: 700,
                    color: "var(--muted)",
                    marginBottom: 6,
                  }}
                >
                  Style de l&apos;Affiche à exporter
                </span>
                <div className={styles.tabGroup}>
                  <button
                    type="button"
                    onClick={() =>
                      setPlan((prev) => ({ ...prev, theme_style: "obsidian" }))
                    }
                    className={`${styles.tabBtn} ${plan.theme_style === "obsidian" ? styles.tabBtnActive : ""}`}
                  >
                    🌙 Version Sombre
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setPlan((prev) => ({ ...prev, theme_style: "parchment" }))
                    }
                    className={`${styles.tabBtn} ${plan.theme_style === "parchment" ? styles.tabBtnActive : ""}`}
                  >
                    ☀️ Version Claire
                  </button>
                </div>
              </div>

              {/* Right: Export & Sharing buttons */}
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                <button
                  onClick={handleShareWhatsApp}
                  disabled={exportingImage}
                  className={styles.btnWhatsApp}
                >
                  <MessageCircle size={16} />
                  <span>Partager sur WhatsApp</span>
                </button>

                <button
                  onClick={handleDownloadImage}
                  disabled={exportingImage}
                  className={styles.btnSecondary}
                >
                  <Download size={15} />
                  <span>Image PNG</span>
                </button>

                <button
                  onClick={handleDownloadPdf}
                  disabled={exportingPdf}
                  className={styles.btnSecondary}
                >
                  <FileText size={15} />
                  <span>PDF</span>
                </button>

                <button
                  onClick={handleCopyWhatsApp}
                  className={styles.btnSecondary}
                >
                  {copiedWhatsApp ? <Check size={15} style={{ color: "#10B981" }} /> : <Copy size={15} />}
                  <span>{copiedWhatsApp ? "Copié !" : "Copier Texte"}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Poster Wrapper with horizontal scroll on mobile */}
          <div className={styles.posterPreviewContainer}>
            <MeditationPoster
              plan={plan}
              id="meditation-poster-container"
              themeStyle={plan.theme_style || "obsidian"}
            />
          </div>
        </div>
      )}

      {/* ── CUSTOM MODAL FOR CHOOSING A MEMBER ── */}
      {pickerModal && pickerModal.isOpen && (
        <MemberPickerModal
          isOpen={pickerModal.isOpen}
          onClose={closeMemberPicker}
          onSelect={(name) => {
            updateSlot(pickerModal.dayId, pickerModal.hourId, "person", name);
          }}
          currentName={pickerModal.currentName}
          dayLabel={pickerModal.dayLabel}
          hourLabel={pickerModal.hourLabel}
          members={familyMembers}
        />
      )}
    </div>
  );
}
