"use client";

import { useState, useEffect, useRef, useMemo, useId } from "react";
import Image from "next/image";
import { toPng } from "html-to-image";
import jsPDF from "jspdf";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  BookOpen,
  Share2,
  Download,
  Copy,
  Check,
  Sparkles,
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
  Info,
} from "lucide-react";
import { useWorkspace } from "@/lib/use-workspace";
import { useFeedback } from "@/components/experience/FeedbackProvider";
import { supabase } from "@/lib/supabase";
import MeditationPoster from "@/components/meditation/MeditationPoster";
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
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [exportingImage, setExportingImage] = useState<boolean>(false);
  const [exportingPdf, setExportingPdf] = useState<boolean>(false);
  const [copiedWhatsApp, setCopiedWhatsApp] = useState<boolean>(false);

  // Family members list for auto-complete
  const [memberNames, setMemberNames] = useState<string[]>([]);
  const datalistId = useId();
  const posterRef = useRef<HTMLDivElement>(null);

  // Load family members for autocomplete
  useEffect(() => {
    async function fetchMembers() {
      try {
        const { data, error } = await supabase
          .from("members")
          .select("firstName, lastName")
          .order("firstName");
        if (!error && data) {
          const names = Array.from(
            new Set(
              data
                .map((m) => `${m.firstName || ""} ${m.lastName || ""}`.trim())
                .filter(Boolean)
            )
          );
          setMemberNames(names);
        }
      } catch (err) {
        console.warn("Could not fetch members for autocomplete:", err);
      }
    }
    fetchMembers();
  }, []);

  // Load plan when selectedWeek changes
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const loaded = await loadMeditationPlan(selectedWeek);
      if (!cancelled) {
        setPlan(loaded);
        setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [selectedWeek]);

  // Handle slot update
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
      // Auto-save to localStorage
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

  // Explicit Save to Supabase
  const handleSave = async () => {
    setSaving(true);
    const res = await saveMeditationPlan(plan);
    setSaving(false);
    if (res.success) {
      notify("Planning de méditation enregistré avec succès !");
    } else {
      notify("Enregistré localement (erreur de synchronisation réseau).");
    }
  };

  // Reset to the initial user sample (Livre de Jean, Semaine du 21 septembre)
  const handleResetToSample = () => {
    const sample = JSON.parse(JSON.stringify(DEFAULT_FAMILLE_NOE_SAMPLE));
    sample.week_key = selectedWeek;
    sample.week_label = formatWeekLabel(selectedWeek);
    setPlan(sample);
    saveMeditationPlan(sample);
    notify("Modèle de référence de la Famille de Noé chargé !");
  };

  // Clear all slots
  const handleClearSlots = () => {
    if (
      !window.confirm(
        "Voulez-vous vraiment effacer tous les noms et versets de cette semaine ?"
      )
    ) {
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
    notify("Planning vidé pour cette semaine.");
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

  // Export to HD PNG Image
  const generatePngDataUrl = async (): Promise<string | null> => {
    const element = document.getElementById("meditation-poster-container");
    if (!element) {
      notify("Erreur : l'affiche n'a pas été trouvée.");
      return null;
    }
    return await toPng(element, {
      pixelRatio: 2.5,
      backgroundColor: plan.theme_style === "parchment" ? "#FFFFFF" : "#05020C",
      cacheBust: true,
    });
  };

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
      notify("Image HD téléchargée avec succès ! Prête à être partagée.");
    } catch (err) {
      console.error("Export error:", err);
      notify("Une erreur est survenue lors de la création de l'image.");
    } finally {
      setExportingImage(false);
    }
  };

  // Share to WhatsApp directly (Web Share API with file, or fallback to direct download + text)
  const handleShareWhatsApp = async () => {
    setExportingImage(true);
    notify("Préparation du partage WhatsApp…");

    try {
      const dataUrl = await generatePngDataUrl();
      if (!dataUrl) return;

      // Convert dataUrl to blob
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File(
        [blob],
        `Meditation_Famille_de_Noe_${plan.week_key}.png`,
        { type: "image/png" }
      );

      // Check if Web Share API with files is supported
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Planning Méditation — Famille de Noé (${plan.week_label})`,
          text: formatMeditationWhatsApp(plan),
        });
        notify("Partage effectué avec succès !");
      } else {
        // Fallback: download file and copy text to clipboard
        const link = document.createElement("a");
        link.download = `Meditation_Famille_de_Noe_${plan.week_key}.png`;
        link.href = dataUrl;
        link.click();

        await navigator.clipboard.writeText(formatMeditationWhatsApp(plan));
        notify(
          "Image HD téléchargée et texte WhatsApp copié ! Vous pouvez maintenant coller l'image et la légende dans votre groupe WhatsApp."
        );
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        console.error("Share error:", err);
        notify("Impossible de partager automatiquement. Téléchargement de l'image...");
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
    <Moon key="3" size={15} style={{ color: "#A78BFA" }} />,
  ];

  return (
    <div
      style={{
        maxWidth: 1200,
        margin: "0 auto",
        padding: "24px 20px 80px",
        color: "var(--cream, #F4F1EA)",
      }}
    >
      {/* ── TOP HERO HEADER ── */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 20,
          background:
            "linear-gradient(135deg, rgba(212, 175, 55, 0.12) 0%, rgba(139, 92, 246, 0.08) 50%, rgba(5, 2, 12, 0.9) 100%)",
          border: "1.5px solid rgba(212, 175, 55, 0.28)",
          borderRadius: 24,
          padding: "20px 24px",
          boxShadow: "0 14px 40px rgba(0, 0, 0, 0.45)",
          marginBottom: 24,
        }}
      >
        {/* Left: Brand Identity & Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              position: "relative",
              width: 68,
              height: 68,
              borderRadius: "50%",
              overflow: "hidden",
              border: "2px solid var(--gold, #D4AF37)",
              boxShadow: "0 0 16px rgba(212, 175, 55, 0.35)",
              flexShrink: 0,
              background: "#050614",
            }}
          >
            <Image
              src="/brand/famille-de-noe.png"
              alt="Logo Famille de Noé"
              width={68}
              height={68}
              style={{ objectFit: "cover" }}
              priority
              unoptimized
            />
          </div>

          <div>
            <div
              style={{
                fontSize: 11,
                letterSpacing: "2.5px",
                textTransform: "uppercase",
                color: "var(--gold, #D4AF37)",
                fontWeight: 700,
              }}
            >
              Famille de Noé • Exclusif
            </div>
            <h1
              style={{
                margin: "2px 0 0",
                fontSize: "clamp(20px, 3.5vw, 28px)",
                fontWeight: 800,
                color: "var(--gold-light, #F7E5B5)",
                letterSpacing: "0.2px",
              }}
            >
              Planning de Méditation
            </h1>
            <p
              style={{
                margin: "4px 0 0",
                fontSize: 13,
                color: "var(--muted, #858095)",
              }}
            >
              Édition hebdomadaire & partage direct d’affiches pour le groupe WhatsApp
            </p>
          </div>
        </div>

        {/* Right: Quick Action Controls */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
          <button
            onClick={handleShareWhatsApp}
            disabled={exportingImage}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "#25D366",
              color: "#05020C",
              border: "none",
              borderRadius: 14,
              padding: "10px 18px",
              fontWeight: 800,
              fontSize: 13.5,
              cursor: exportingImage ? "wait" : "pointer",
              boxShadow: "0 6px 18px rgba(37, 211, 102, 0.35)",
              transition: "transform 0.15s, opacity 0.15s",
            }}
          >
            <MessageCircle size={18} />
            <span>{exportingImage ? "Génération..." : "Partager sur WhatsApp"}</span>
          </button>

          <button
            onClick={handleDownloadImage}
            disabled={exportingImage}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "rgba(212, 175, 55, 0.16)",
              color: "var(--gold-light, #F7E5B5)",
              border: "1px solid rgba(212, 175, 55, 0.35)",
              borderRadius: 14,
              padding: "10px 16px",
              fontWeight: 700,
              fontSize: 13.5,
              cursor: exportingImage ? "wait" : "pointer",
            }}
          >
            <Download size={16} />
            <span>Image HD</span>
          </button>

          <button
            onClick={handleCopyWhatsApp}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "rgba(255, 255, 255, 0.06)",
              color: "var(--cream, #F4F1EA)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              borderRadius: 14,
              padding: "10px 14px",
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            {copiedWhatsApp ? <Check size={16} style={{ color: "#10B981" }} /> : <Copy size={16} />}
            <span>{copiedWhatsApp ? "Copié !" : "Texte WhatsApp"}</span>
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "linear-gradient(135deg, #D4AF37 0%, #B8860B 100%)",
              color: "#05020C",
              border: "none",
              borderRadius: 14,
              padding: "10px 18px",
              fontWeight: 800,
              fontSize: 13.5,
              cursor: saving ? "wait" : "pointer",
              boxShadow: "0 6px 18px rgba(212, 175, 55, 0.25)",
            }}
          >
            <Save size={16} />
            <span>{saving ? "Sauvegarde..." : "Enregistrer"}</span>
          </button>
        </div>
      </div>

      {/* ── WEEK SELECTOR & TABS NAV ── */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          background: "rgba(10, 6, 22, 0.82)",
          border: "1px solid rgba(212, 175, 55, 0.18)",
          borderRadius: 18,
          padding: "12px 18px",
          marginBottom: 24,
        }}
      >
        {/* Week navigation buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={() => setSelectedWeek((prev) => shiftWeek(prev, -1))}
            title="Semaine précédente"
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              color: "var(--cream, #F4F1EA)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <ChevronLeft size={20} />
          </button>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 14px",
              borderRadius: 12,
              background: "rgba(212, 175, 55, 0.12)",
              border: "1px solid rgba(212, 175, 55, 0.3)",
              fontWeight: 700,
              fontSize: 14,
              color: "var(--gold-light, #F7E5B5)",
            }}
          >
            <Calendar size={16} style={{ color: "var(--gold, #D4AF37)" }} />
            <span>{formatWeekLabel(selectedWeek)}</span>
          </div>

          <button
            onClick={() => setSelectedWeek((prev) => shiftWeek(prev, 1))}
            title="Semaine suivante"
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              color: "var(--cream, #F4F1EA)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <ChevronRight size={20} />
          </button>

          <button
            onClick={() => setSelectedWeek(getMondayOfWeek(new Date()))}
            style={{
              background: "none",
              border: "none",
              color: "var(--muted, #858095)",
              fontSize: 12,
              fontWeight: 600,
              textDecoration: "underline",
              cursor: "pointer",
              marginLeft: 6,
            }}
          >
            Aujourd&apos;hui
          </button>
        </div>

        {/* View Mode Tabs (Édition vs Aperçu) */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            background: "rgba(255, 255, 255, 0.05)",
            borderRadius: 14,
            padding: 4,
            border: "1px solid rgba(255, 255, 255, 0.08)",
          }}
        >
          <button
            onClick={() => setActiveTab("edit")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 16px",
              borderRadius: 10,
              border: "none",
              background:
                activeTab === "edit"
                  ? "var(--gold, #D4AF37)"
                  : "transparent",
              color: activeTab === "edit" ? "#05020C" : "var(--cream, #F4F1EA)",
              fontWeight: activeTab === "edit" ? 800 : 500,
              fontSize: 13,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            <Edit3 size={15} />
            <span>Édition du Planning</span>
          </button>

          <button
            onClick={() => setActiveTab("preview")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 16px",
              borderRadius: 10,
              border: "none",
              background:
                activeTab === "preview"
                  ? "var(--gold, #D4AF37)"
                  : "transparent",
              color: activeTab === "preview" ? "#05020C" : "var(--cream, #F4F1EA)",
              fontWeight: activeTab === "preview" ? 800 : 500,
              fontSize: 13,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            <Eye size={15} />
            <span>Aperçu & Affiche HD</span>
          </button>
        </div>
      </div>

      {/* ── TAB 1: EDITING VIEW ── */}
      {activeTab === "edit" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Metadata Form: Theme, Verset Clé, Style */}
          <div
            style={{
              background: "rgba(10, 6, 22, 0.82)",
              border: "1px solid rgba(212, 175, 55, 0.18)",
              borderRadius: 20,
              padding: 24,
            }}
          >
            <div
              style={{
                fontSize: 12,
                letterSpacing: "1.5px",
                textTransform: "uppercase",
                color: "var(--gold, #D4AF37)",
                fontWeight: 700,
                marginBottom: 16,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <BookOpen size={16} />
              <span>Paramètres Thématiques de la Semaine</span>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: 16,
              }}
            >
              {/* Livre ou Thème */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    color: "var(--cream-dim, #C5BFB2)",
                    marginBottom: 6,
                    fontWeight: 600,
                  }}
                >
                  Livre / Thème de méditation
                </label>
                <input
                  type="text"
                  value={plan.livre_theme}
                  onChange={(e) =>
                    setPlan((prev) => ({ ...prev, livre_theme: e.target.value }))
                  }
                  placeholder="Ex : Livre de Jean, Les Épîtres de Paul..."
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    background: "rgba(255, 255, 255, 0.05)",
                    border: "1px solid rgba(212, 175, 55, 0.25)",
                    borderRadius: 12,
                    color: "var(--cream, #F4F1EA)",
                    fontSize: 14,
                    outline: "none",
                  }}
                />
              </div>

              {/* Verset Clé */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    color: "var(--cream-dim, #C5BFB2)",
                    marginBottom: 6,
                    fontWeight: 600,
                  }}
                >
                  Verset Clé Hebdomadaire (optionnel)
                </label>
                <input
                  type="text"
                  value={plan.verset_cle || ""}
                  onChange={(e) =>
                    setPlan((prev) => ({ ...prev, verset_cle: e.target.value }))
                  }
                  placeholder="Ex : Jean 15:5"
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    background: "rgba(255, 255, 255, 0.05)",
                    border: "1px solid rgba(212, 175, 55, 0.25)",
                    borderRadius: 12,
                    color: "var(--cream, #F4F1EA)",
                    fontSize: 14,
                    outline: "none",
                  }}
                />
              </div>

              {/* Style visuel de l'affiche */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    color: "var(--cream-dim, #C5BFB2)",
                    marginBottom: 6,
                    fontWeight: 600,
                  }}
                >
                  Style visuel de l&apos;affiche
                </label>
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    type="button"
                    onClick={() =>
                      setPlan((prev) => ({ ...prev, theme_style: "obsidian" }))
                    }
                    style={{
                      flex: 1,
                      padding: "9px 12px",
                      borderRadius: 10,
                      border:
                        plan.theme_style === "obsidian"
                          ? "2px solid var(--gold, #D4AF37)"
                          : "1px solid rgba(255, 255, 255, 0.1)",
                      background:
                        plan.theme_style === "obsidian"
                          ? "rgba(212, 175, 55, 0.2)"
                          : "rgba(255, 255, 255, 0.03)",
                      color:
                        plan.theme_style === "obsidian"
                          ? "var(--gold-light, #F7E5B5)"
                          : "var(--muted, #858095)",
                      fontSize: 12.5,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    ✨ Obsidian Or
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setPlan((prev) => ({ ...prev, theme_style: "parchment" }))
                    }
                    style={{
                      flex: 1,
                      padding: "9px 12px",
                      borderRadius: 10,
                      border:
                        plan.theme_style === "parchment"
                          ? "2px solid #CA8A04"
                          : "1px solid rgba(255, 255, 255, 0.1)",
                      background:
                        plan.theme_style === "parchment"
                          ? "rgba(254, 240, 138, 0.15)"
                          : "rgba(255, 255, 255, 0.03)",
                      color:
                        plan.theme_style === "parchment"
                          ? "#FDE047"
                          : "var(--muted, #858095)",
                      fontSize: 12.5,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    📄 Parchemin Clair
                  </button>
                </div>
              </div>
            </div>

            {/* Exhortation text */}
            <div style={{ marginTop: 16 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 12,
                  color: "var(--cream-dim, #C5BFB2)",
                  marginBottom: 6,
                  fontWeight: 600,
                }}
              >
                Pensée ou Verset d&apos;exhortation en bas de l&apos;affiche
              </label>
              <input
                type="text"
                value={plan.exhortation || ""}
                onChange={(e) =>
                  setPlan((prev) => ({ ...prev, exhortation: e.target.value }))
                }
                placeholder="Ex : « Ta parole est une lampe à mes pieds... » — Psaume 119:105"
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(212, 175, 55, 0.25)",
                  borderRadius: 12,
                  color: "var(--cream, #F4F1EA)",
                  fontSize: 13,
                  outline: "none",
                }}
              />
            </div>

            {/* Quick helper buttons */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                marginTop: 20,
                paddingTop: 16,
                borderTop: "1px solid rgba(255, 255, 255, 0.08)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  type="button"
                  onClick={handleResetToSample}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    background: "rgba(212, 175, 55, 0.1)",
                    border: "1px solid rgba(212, 175, 55, 0.25)",
                    borderRadius: 10,
                    padding: "7px 12px",
                    color: "var(--gold-light, #F7E5B5)",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  <RefreshCw size={13} />
                  <span>Charger le modèle de référence Noé</span>
                </button>

                <button
                  type="button"
                  onClick={handleClearSlots}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    background: "rgba(239, 68, 68, 0.1)",
                    border: "1px solid rgba(239, 68, 68, 0.25)",
                    borderRadius: 10,
                    padding: "7px 12px",
                    color: "#FCA5A5",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  <Trash2 size={13} />
                  <span>Vider tout le planning</span>
                </button>
              </div>

              <div
                style={{
                  fontSize: 12,
                  color: "var(--muted, #858095)",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Info size={14} style={{ color: "var(--gold, #D4AF37)" }} />
                <span>Les 4 heures de méditation restent fixes selon la règle.</span>
              </div>
            </div>
          </div>

          {/* Interactive Weekly Table Editor */}
          <div
            style={{
              background: "rgba(10, 6, 22, 0.82)",
              border: "1.5px solid rgba(212, 175, 55, 0.22)",
              borderRadius: 22,
              padding: "20px 20px 24px",
              boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
              overflowX: "auto",
            }}
          >
            {/* Header info */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 16,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Sparkles size={18} style={{ color: "var(--gold, #D4AF37)" }} />
                <h2
                  style={{
                    margin: 0,
                    fontSize: 17,
                    fontWeight: 800,
                    color: "var(--gold-light, #F7E5B5)",
                  }}
                >
                  Grille d&apos;attribution des Frères & Sœurs
                </h2>
              </div>
              <div style={{ fontSize: 12, color: "var(--muted, #858095)" }}>
                Tapez les noms ou sélectionnez parmi les membres de la bergerie
              </div>
            </div>

            {/* Datalist for member name suggestions */}
            <datalist id={datalistId}>
              {memberNames.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>

            {/* Grid Container */}
            <div
              style={{
                minWidth: 800,
                border: "1px solid rgba(212, 175, 55, 0.18)",
                borderRadius: 16,
                overflow: "hidden",
                background: "rgba(5, 2, 12, 0.4)",
              }}
            >
              {/* Grid Column Headers: Fixed Hours */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "130px repeat(4, 1fr)",
                  background:
                    "linear-gradient(135deg, rgba(212, 175, 55, 0.16) 0%, rgba(139, 92, 246, 0.12) 100%)",
                  borderBottom: "1.5px solid rgba(212, 175, 55, 0.2)",
                  padding: "12px 10px",
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    letterSpacing: "1px",
                    textTransform: "uppercase",
                    color: "var(--gold, #D4AF37)",
                    paddingLeft: 8,
                  }}
                >
                  JOURS
                </div>

                {FIXED_MEDITATION_HOURS.map((hour, idx) => (
                  <div
                    key={hour.id}
                    style={{
                      textAlign: "center",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 4,
                      borderLeft: "1px solid rgba(212, 175, 55, 0.15)",
                      padding: "0 6px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {hourIcons[idx]}
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 800,
                          color: "var(--gold-light, #F7E5B5)",
                        }}
                      >
                        {hour.label}
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: 10,
                        textTransform: "uppercase",
                        letterSpacing: "0.8px",
                        color: "var(--muted, #858095)",
                        fontWeight: 600,
                      }}
                    >
                      {hour.name}
                    </span>
                  </div>
                ))}
              </div>

              {/* Rows: Each Day of the Week */}
              {MEDITATION_DAYS.map((day, dIdx) => {
                const daySchedule = plan.schedule[day.id] || {};

                return (
                  <div
                    key={day.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "130px repeat(4, 1fr)",
                      borderBottom:
                        dIdx < MEDITATION_DAYS.length - 1
                          ? "1px solid rgba(212, 175, 55, 0.12)"
                          : "none",
                      background:
                        dIdx % 2 === 0
                          ? "rgba(255, 255, 255, 0.015)"
                          : "transparent",
                      alignItems: "stretch",
                    }}
                  >
                    {/* Day Column */}
                    <div
                      style={{
                        padding: "16px 12px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <div
                        style={{
                          background: "rgba(212, 175, 55, 0.12)",
                          border: "1px solid rgba(212, 175, 55, 0.35)",
                          color: "var(--gold-light, #F7E5B5)",
                          borderRadius: 10,
                          padding: "8px 12px",
                          fontWeight: 800,
                          fontSize: 13,
                          textTransform: "uppercase",
                          textAlign: "center",
                          width: "100%",
                        }}
                      >
                        {day.label}
                      </div>
                    </div>

                    {/* 4 Hour Slots for this day */}
                    {FIXED_MEDITATION_HOURS.map((hour) => {
                      const slot = daySchedule[hour.id] || {
                        person: "",
                        verse: "",
                      };

                      return (
                        <div
                          key={hour.id}
                          style={{
                            padding: "10px 10px",
                            borderLeft: "1px solid rgba(212, 175, 55, 0.12)",
                            display: "flex",
                            flexDirection: "column",
                            gap: 6,
                            justifyContent: "center",
                          }}
                        >
                          {/* Person input */}
                          <div>
                            <input
                              type="text"
                              list={datalistId}
                              value={slot.person}
                              onChange={(e) =>
                                updateSlot(
                                  day.id,
                                  hour.id,
                                  "person",
                                  e.target.value
                                )
                              }
                              placeholder="Nom du frère / sœur"
                              style={{
                                width: "100%",
                                padding: "7px 10px",
                                background: "rgba(255, 255, 255, 0.06)",
                                border: "1px solid rgba(255, 255, 255, 0.15)",
                                borderRadius: 8,
                                color: "var(--cream, #F4F1EA)",
                                fontSize: 13,
                                fontWeight: 600,
                                outline: "none",
                              }}
                            />
                          </div>

                          {/* Verse input */}
                          <div>
                            <input
                              type="text"
                              value={slot.verse}
                              onChange={(e) =>
                                updateSlot(
                                  day.id,
                                  hour.id,
                                  "verse",
                                  e.target.value
                                )
                              }
                              placeholder="Verset (ex : Jean 15:11)"
                              style={{
                                width: "100%",
                                padding: "5px 10px",
                                background: "rgba(56, 189, 248, 0.08)",
                                border: "1px solid rgba(56, 189, 248, 0.25)",
                                borderRadius: 6,
                                color: "#7DD3FC",
                                fontSize: 11.5,
                                fontWeight: 700,
                                outline: "none",
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: LIVE PREVIEW & EXPORT VIEW ── */}
      {activeTab === "preview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Action Bar for sharing */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              background: "rgba(10, 6, 22, 0.82)",
              border: "1px solid rgba(212, 175, 55, 0.22)",
              borderRadius: 18,
              padding: "16px 20px",
            }}
          >
            <div>
              <h3
                style={{
                  margin: 0,
                  fontSize: 16,
                  fontWeight: 800,
                  color: "var(--gold-light, #F7E5B5)",
                }}
              >
                Aperçu de l&apos;Affiche Prête pour WhatsApp
              </h3>
              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: 12.5,
                  color: "var(--muted, #858095)",
                }}
              >
                Générée en ultra haute définition (2000px+), idéale pour être lisible sur tous les téléphones.
              </p>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              <button
                onClick={handleShareWhatsApp}
                disabled={exportingImage}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  background: "#25D366",
                  color: "#05020C",
                  border: "none",
                  borderRadius: 12,
                  padding: "10px 18px",
                  fontWeight: 800,
                  fontSize: 13.5,
                  cursor: "pointer",
                  boxShadow: "0 4px 14px rgba(37, 211, 102, 0.3)",
                }}
              >
                <MessageCircle size={18} />
                <span>Partager sur WhatsApp</span>
              </button>

              <button
                onClick={handleDownloadImage}
                disabled={exportingImage}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  background: "rgba(212, 175, 55, 0.16)",
                  color: "var(--gold-light, #F7E5B5)",
                  border: "1px solid rgba(212, 175, 55, 0.35)",
                  borderRadius: 12,
                  padding: "10px 16px",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                <Download size={16} />
                <span>Télécharger Image HD</span>
              </button>

              <button
                onClick={handleDownloadPdf}
                disabled={exportingPdf}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  background: "rgba(255, 255, 255, 0.06)",
                  color: "var(--cream, #F4F1EA)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  borderRadius: 12,
                  padding: "10px 14px",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                <FileText size={16} />
                <span>Export PDF</span>
              </button>

              <button
                onClick={handleCopyWhatsApp}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  background: "rgba(255, 255, 255, 0.06)",
                  color: "var(--cream, #F4F1EA)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  borderRadius: 12,
                  padding: "10px 14px",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                {copiedWhatsApp ? <Check size={16} style={{ color: "#10B981" }} /> : <Copy size={16} />}
                <span>{copiedWhatsApp ? "Copié !" : "Copier Texte"}</span>
              </button>
            </div>
          </div>

          {/* Scaled Preview Wrapper */}
          <div
            style={{
              overflowX: "auto",
              padding: "16px 0",
              display: "flex",
              justifyContent: "center",
              background: "rgba(0, 0, 0, 0.3)",
              borderRadius: 24,
              border: "1px solid rgba(255, 255, 255, 0.05)",
            }}
          >
            <div style={{ transformOrigin: "top center" }}>
              <MeditationPoster
                plan={plan}
                id="meditation-poster-container"
                themeStyle={plan.theme_style || "obsidian"}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
