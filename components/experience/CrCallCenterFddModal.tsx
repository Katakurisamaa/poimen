"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { 
  X, CalendarDays, Copy, Check, FileText, Download, 
  RotateCcw, Calculator, Edit3, ArrowRight, ChevronLeft, ChevronRight 
} from "lucide-react";
import { toPng } from "html-to-image";
import jsPDF from "jspdf";
import { useFeedback } from "@/components/experience/FeedbackProvider";
import styles from "./CrCallCenterFddModal.module.css";

export interface FddCallCenterState {
  period: string;
  dateIso: string;
  comment: string;
  // Group 1 totals & rows
  totalRecues: number;
  manualTotalRecues: boolean;
  recues_coordonnees: number;
  recues_avec_eglise: number;
  recues_sans_eglise: number;
  // Group 2 totals & rows
  totalContactees: number;
  manualTotalContactees: boolean;
  contactees_faux_numeros: number;
  contactees_ne_decroche_pas: number;
  contactees_non_entame: number;
  // Group 3 totals & rows
  totalAboutis: number;
  manualTotalAboutis: boolean;
  aboutis_prevu_revenir: number;
  aboutis_revenu_culte: number;
  aboutis_groupe_whatsapp: number;
  aboutis_rdv_pastoral: number;
  aboutis_souhait_visites: number;
  aboutis_souhait_pcnc: number;
  aboutis_inscrit_pcnc: number;
  aboutis_souhaite_cdm: number;
  aboutis_integre_cdm: number;
  aboutis_souhait_suivi: number;
  aboutis_aps: number;
  aboutis_12_piliers: number;
}

const getInitialSundayDate = () => {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 0 : day;
  const sunday = new Date(d);
  sunday.setDate(d.getDate() - diff);
  const yyyy = sunday.getFullYear();
  const mm = String(sunday.getMonth() + 1).padStart(2, "0");
  const dd = String(sunday.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const formatFrenchDate = (isoDate: string) => {
  if (!isoDate) return "Non renseignée";
  try {
    const [year, month, day] = isoDate.split("-").map(Number);
    const dateObj = new Date(year, month - 1, day);
    return new Intl.DateTimeFormat("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(dateObj);
  } catch {
    return isoDate;
  }
};

const getDefaultState = (dateStr: string): FddCallCenterState => ({
  period: `Du ${formatFrenchDate(dateStr)}`,
  dateIso: dateStr,
  comment: "",
  totalRecues: 0,
  manualTotalRecues: false,
  recues_coordonnees: 0,
  recues_avec_eglise: 0,
  recues_sans_eglise: 0,
  totalContactees: 0,
  manualTotalContactees: false,
  contactees_faux_numeros: 0,
  contactees_ne_decroche_pas: 0,
  contactees_non_entame: 0,
  totalAboutis: 0,
  manualTotalAboutis: false,
  aboutis_prevu_revenir: 0,
  aboutis_revenu_culte: 0,
  aboutis_groupe_whatsapp: 0,
  aboutis_rdv_pastoral: 0,
  aboutis_souhait_visites: 0,
  aboutis_souhait_pcnc: 0,
  aboutis_inscrit_pcnc: 0,
  aboutis_souhaite_cdm: 0,
  aboutis_integre_cdm: 0,
  aboutis_souhait_suivi: 0,
  aboutis_aps: 0,
  aboutis_12_piliers: 0,
});

interface Props {
  isOpen: boolean;
  onClose: () => void;
  churchName?: string;
  familyName?: string;
  familyId?: string;
}

export default function CrCallCenterFddModal({
  isOpen,
  onClose,
  churchName = "CHARLEROI",
  familyName = "Famille de disciples",
  familyId = "",
}: Props) {
  const { notify, confirm } = useFeedback();
  const [selectedDate, setSelectedDate] = useState(getInitialSundayDate());
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [reportState, setReportState] = useState<FddCallCenterState>(() => getDefaultState(getInitialSundayDate()));
  const [copied, setCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLElement>(null);
  const exportSheetRef = useRef<HTMLElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Normalize church and family names
  const church = (churchName || "CHARLEROI").replace(/^ICC\s+/i, "").trim() || "CHARLEROI";
  const family = familyName || "Famille de disciples";

  // Storage key
  const storageKey = useMemo(() => {
    const fid = familyId || "default";
    return `poimen_fdd_cr_callcenter_${fid}_${selectedDate}`;
  }, [familyId, selectedDate]);

  // Load from localStorage when modal opens or date changes
  useEffect(() => {
    if (!isOpen) return;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        setReportState(parsed);
      } else {
        setReportState(getDefaultState(selectedDate));
      }
    } catch {
      setReportState(getDefaultState(selectedDate));
    }
  }, [isOpen, storageKey, selectedDate]);

  // Handle focus & body overflow
  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    modalRef.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      previousFocus?.focus();
    };
  }, [isOpen]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  // Recalculate automatic group totals
  const autoTotalRecues = reportState.recues_avec_eglise + reportState.recues_sans_eglise;
  const effectiveTotalRecues = reportState.manualTotalRecues ? reportState.totalRecues : (reportState.totalRecues || autoTotalRecues);

  const autoTotalContactees = reportState.contactees_faux_numeros + reportState.contactees_ne_decroche_pas + reportState.contactees_non_entame;
  const effectiveTotalContactees = reportState.manualTotalContactees ? reportState.totalContactees : (reportState.totalContactees || autoTotalContactees);

  const autoTotalAboutis = 
    reportState.aboutis_prevu_revenir +
    reportState.aboutis_revenu_culte +
    reportState.aboutis_groupe_whatsapp +
    reportState.aboutis_rdv_pastoral +
    reportState.aboutis_souhait_visites +
    reportState.aboutis_souhait_pcnc +
    reportState.aboutis_inscrit_pcnc +
    reportState.aboutis_souhaite_cdm +
    reportState.aboutis_integre_cdm +
    reportState.aboutis_souhait_suivi +
    reportState.aboutis_aps +
    reportState.aboutis_12_piliers;
  const effectiveTotalAboutis = reportState.manualTotalAboutis ? reportState.totalAboutis : (reportState.totalAboutis || autoTotalAboutis);

  // Quick field updater with automatic draft save
  const updateField = (key: keyof FddCallCenterState, value: any) => {
    setReportState(prev => {
      const next = { ...prev, [key]: value };
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const updateNumber = (key: keyof FddCallCenterState, rawValue: string) => {
    const val = parseInt(rawValue, 10);
    updateField(key, isNaN(val) ? 0 : Math.max(0, val));
  };

  // Recalculate all totals from items
  const handleRecalculateTotals = () => {
    setReportState(prev => {
      const next: FddCallCenterState = {
        ...prev,
        totalRecues: autoTotalRecues,
        manualTotalRecues: false,
        totalContactees: autoTotalContactees,
        manualTotalContactees: false,
        totalAboutis: autoTotalAboutis,
        manualTotalAboutis: false,
      };
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {}
      return next;
    });
    notify("Totaux recalculés.");
  };

  // Reset to zero
  const handleReset = async () => {
    const ok = await confirm(
      "Voulez-vous remettre toutes les valeurs de ce compte rendu à zéro ?",
      {
        title: "Réinitialiser les chiffres ?",
        confirmLabel: "Réinitialiser",
        tone: "danger",
      }
    );
    if (!ok) return;
    const fresh = getDefaultState(selectedDate);
    setReportState(fresh);
    try {
      localStorage.setItem(storageKey, JSON.stringify(fresh));
    } catch {}
    notify("Compte rendu réinitialisé.");
  };

  // Build report structure for rendering & export
  const reportGroups = useMemo(() => [
    {
      key: "recues",
      title: "Nombre de personnes reçues",
      value: effectiveTotalRecues,
      manual: reportState.manualTotalRecues,
      rows: [
        { key: "recues_coordonnees", label: "Nombre de personnes ayant laissé leurs coordonnées", value: reportState.recues_coordonnees },
        { key: "recues_avec_eglise", label: "Avec église", value: reportState.recues_avec_eglise },
        { key: "recues_sans_eglise", label: "Sans église", value: reportState.recues_sans_eglise },
      ],
    },
    {
      key: "contactees",
      title: "Nombre de personnes contactées",
      value: effectiveTotalContactees,
      manual: reportState.manualTotalContactees,
      rows: [
        { key: "contactees_faux_numeros", label: "Faux numéros ou erronés / sans numéro", value: reportState.contactees_faux_numeros },
        { key: "contactees_ne_decroche_pas", label: "Ne décroche pas suite à plusieurs relances", value: reportState.contactees_ne_decroche_pas },
        { key: "contactees_non_entame", label: "Call center non entamé", value: reportState.contactees_non_entame },
      ],
    },
    {
      key: "aboutis",
      title: "Nombre d’appels aboutis",
      value: effectiveTotalAboutis,
      manual: reportState.manualTotalAboutis,
      rows: [
        { key: "aboutis_prevu_revenir", label: "Revient à l’église", value: reportState.aboutis_prevu_revenir },
        { key: "aboutis_revenu_culte", label: "Sont revenues à l’église", value: reportState.aboutis_revenu_culte },
        { key: "aboutis_groupe_whatsapp", label: "Groupe WhatsApp", value: reportState.aboutis_groupe_whatsapp },
        { key: "aboutis_rdv_pastoral", label: "RDV pastoral", value: reportState.aboutis_rdv_pastoral },
        { key: "aboutis_souhait_visites", label: "Souhait visites", value: reportState.aboutis_souhait_visites },
        { key: "aboutis_souhait_pcnc", label: "Souhait inscription PCNC", value: reportState.aboutis_souhait_pcnc },
        { key: "aboutis_inscrit_pcnc", label: "Inscrit au PCNC", value: reportState.aboutis_inscrit_pcnc },
        { key: "aboutis_souhaite_cdm", label: "Souhaite intégrer une cellule de maison", value: reportState.aboutis_souhaite_cdm },
        { key: "aboutis_integre_cdm", label: "Cellule de maison ok", value: reportState.aboutis_integre_cdm },
        { key: "aboutis_souhait_suivi", label: "Souhait suivi", value: reportState.aboutis_souhait_suivi },
        { key: "aboutis_aps", label: "APS", value: reportState.aboutis_aps },
        { key: "aboutis_12_piliers", label: "Inscrit au groupe des 12 piliers", value: reportState.aboutis_12_piliers },
      ],
    },
  ], [reportState, effectiveTotalRecues, effectiveTotalContactees, effectiveTotalAboutis]);

  // Copy WhatsApp text
  async function copyReport() {
    try {
      const text = [
        `*CR CALL CENTER INVITÉS ${reportState.period.toUpperCase()} - FAMILLE ${family.toUpperCase()} (ICC ${church.toUpperCase()})*`,
        ...reportGroups.map(group => 
          `*${group.title} : ${group.value}*\n` +
          group.rows.map(row => `• ${row.label} : ${row.value}`).join("\n")
        ),
        `*Commentaire*\n${reportState.comment.trim() || "Aucun commentaire."}`,
      ].join("\n\n");

      await navigator.clipboard.writeText(text);
      setCopied(true);
      notify("Rapport copié avec succès.");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2500);
    } catch {
      notify("Impossible de copier le rapport.");
    }
  }

  // Generate & download PDF
  async function handleDownloadPdf() {
    const element = exportSheetRef.current || sheetRef.current;
    if (!element) return;
    setIsDownloading(true);
    notify("Génération du document PDF en cours…");

    try {
      const isDark = typeof document !== "undefined" && document.documentElement.getAttribute("data-theme") === "dark";
      const bgColor = isDark ? "#1c2737" : "#ffffff";

      if (typeof document !== "undefined" && (document as any).fonts?.ready) {
        await (document as any).fonts.ready;
      }

      const dataUrl = await toPng(element, {
        pixelRatio: 3.2,
        backgroundColor: bgColor,
        cacheBust: true,
        skipFonts: true,
        fontEmbedCSS: "",
      });

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const img = new Image();
      img.src = dataUrl;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
      });

      const pdfWidth = 210;
      const pdfHeight = 297;
      const margin = 8;
      const contentWidth = pdfWidth - (margin * 2);
      const imgHeight = (img.height * contentWidth) / img.width;

      pdf.addImage(img, "PNG", margin, margin, contentWidth, Math.min(imgHeight, pdfHeight - (margin * 2)));
      pdf.save(`CR_Call_Center_${family.replace(/\s+/g, "_")}_${selectedDate}.pdf`);
      notify("Document PDF généré avec succès.");
    } catch (err) {
      console.error("PDF generation error:", err);
      notify("Erreur lors de la génération du PDF.");
    } finally {
      setIsDownloading(false);
    }
  }

  // Shift Sunday (-7 / +7 days)
  const shiftSunday = (days: number) => {
    try {
      const [y, m, d] = selectedDate.split("-").map(Number);
      const dateObj = new Date(y, m - 1, d + days);
      const ny = dateObj.getFullYear();
      const nm = String(dateObj.getMonth() + 1).padStart(2, "0");
      const nd = String(dateObj.getDate()).padStart(2, "0");
      const nextDate = `${ny}-${nm}-${nd}`;
      setSelectedDate(nextDate);
      updateField("period", `Du ${formatFrenchDate(nextDate)}`);
    } catch {}
  };

  if (!isOpen) return null;

  return createPortal(
    <div className={styles.overlay} role="presentation">
      <div 
        ref={modalRef} 
        className={styles.modal} 
        role="dialog" 
        aria-modal="true" 
        aria-labelledby="cr-title"
        tabIndex={-1}
      >
        {/* ── TOOLBAR (Identical to CrCallCenterModal) ── */}
        <header className={styles.toolbar}>
          <div className={styles.heading}>
            <span className={styles.icon}><FileText size={22} /></span>
            <div>
              <span className={styles.eyebrow}>FAMILLE DE DISCIPLES / RAPPORTS</span>
              <h2 id="cr-title">Compte rendu call center</h2>
            </div>
          </div>
          <div className={styles.actions}>
            <button type="button" className={styles.secondary} onClick={copyReport}>
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? "Copié" : "Copier le rapport"}
            </button>
            <button type="button" className={styles.primary} onClick={handleDownloadPdf} disabled={isDownloading}>
              <Download size={16} />
              {isDownloading ? "Téléchargement…" : "Télécharger le PDF"}
            </button>
            <button type="button" className={styles.close} onClick={onClose} aria-label="Fermer le compte rendu">
              <X size={21} />
            </button>
          </div>
        </header>

        {/* ── WORKSPACE (Identical layout) ── */}
        <div className={styles.workspace}>
          {/* ── SETTINGS SIDEBAR ── */}
          <aside className={styles.settings} aria-label="Paramètres du rapport">
            <span className={styles.eyebrow}>PRÉPARER LE RAPPORT</span>
            <h3><CalendarDays size={18} /> Période d’accueil</h3>
            <p>Sélectionnez les invités à inclure dans le compte rendu.</p>

            {/* Custom Date Trigger Card (Identical to CrCallCenterModal) */}
            <div
              className={styles.dateTriggerCard}
              onClick={() => setIsEditingDate(!isEditingDate)}
              role="button"
              tabIndex={0}
              onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setIsEditingDate(!isEditingDate); } }}
              aria-label="Modifier la date du rapport"
            >
              <div className={styles.dateTriggerTop}>
                <span className={styles.dateTriggerBadge}>
                  Un dimanche
                </span>
                <span className={styles.dateTriggerAction}>
                  <Edit3 size={13} /> Modifier
                </span>
              </div>
              <div className={styles.dateTriggerValue}>
                {reportState.period}
              </div>
              <div className={styles.dateTriggerFooter}>
                <span>{effectiveTotalRecues} invité{effectiveTotalRecues > 1 ? "s" : ""}</span>
                <ArrowRight size={13} />
              </div>
            </div>

            {/* Date selector pop-down when clicking the card */}
            {isEditingDate && (
              <div style={{ marginTop: 10, padding: 12, borderRadius: 10, background: "var(--cr-input)", border: "1px solid var(--cr-line)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <button 
                    type="button" 
                    className={styles.quickBtn} 
                    onClick={() => shiftSunday(-7)} 
                    title="Dimanche précédent (-7j)"
                    style={{ flex: "0 0 32px", padding: 0 }}
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <input 
                    type="date" 
                    value={selectedDate} 
                    onChange={e => {
                      setSelectedDate(e.target.value);
                      updateField("period", `Du ${formatFrenchDate(e.target.value)}`);
                    }}
                    style={{ flex: 1, minHeight: 36, padding: "4px 8px", fontSize: 13, borderRadius: 6, border: "1px solid var(--cr-line)" }}
                  />
                  <button 
                    type="button" 
                    className={styles.quickBtn} 
                    onClick={() => shiftSunday(7)} 
                    title="Dimanche suivant (+7j)"
                    style={{ flex: "0 0 32px", padding: 0 }}
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
                <label className={styles.field} style={{ marginTop: 6 }}>
                  <span style={{ fontSize: 11, color: "var(--cr-muted)" }}>Libellé personnalisé :</span>
                  <input 
                    type="text" 
                    value={reportState.period} 
                    onChange={e => updateField("period", e.target.value)} 
                    placeholder="Ex : Du Dimanche 19/10/2026"
                  />
                </label>
              </div>
            )}

            <hr />
            <h3>Commentaire du call center</h3>
            <label className={styles.field}>
              <span className="sr-only">Commentaire</span>
              <textarea 
                aria-label="Commentaire" 
                rows={6} 
                value={reportState.comment} 
                onChange={e => updateField("comment", e.target.value)} 
                placeholder="Ajoutez vos observations ou commentaires sur le call center…" 
              />
            </label>
            <p className={styles.hint}>Modifiez les chiffres directement dans le document ci-contre.</p>

            <div className={styles.quickActions}>
              <button type="button" className={styles.quickBtn} onClick={handleRecalculateTotals} title="Recalculer les totaux automatiquement">
                <Calculator size={13} /> Sommes auto
              </button>
              <button type="button" className={styles.quickBtn} onClick={handleReset} title="Remettre tous les chiffres à zéro">
                <RotateCcw size={13} /> Remettre à 0
              </button>
            </div>

            <div className={styles.privacy}>
              Document confidentiel<br />
              <span>À partager avec les responsables concernés.</span>
            </div>
          </aside>

          {/* ── PREVIEW CANVAS (Identical to CrCallCenterModal) ── */}
          <main className={styles.preview} aria-label="Aperçu du compte rendu" tabIndex={0}>
            <div className={styles.previewBar}>
              <span>Aperçu du rapport · format A4</span>
              <span>Modèle prêt pour téléchargement PDF</span>
            </div>

            <article ref={sheetRef} className={styles.sheet}>
              <header className={styles.reportHeader}>
                <div>
                  <span className={styles.reportKicker}>
                    ICC {church} · FAMILLE DE DISCIPLES {family.toUpperCase()}
                  </span>
                  <h1>Compte rendu<br /><em>Call center invités</em></h1>
                  <p>{reportState.period}</p>
                </div>
                <span className={styles.reportStamp}>
                  RAPPORT<br /><strong>DE SUIVI</strong>
                </span>
              </header>

              <div className={styles.reportTable}>
                {reportGroups.map((group, index) => (
                  <section className={styles.reportGroup} key={group.key}>
                    <h2>
                      <span className={styles.groupNumber}>{String(index + 1).padStart(2, "0")}</span>
                      <span>{group.title}</span>
                      <input 
                        type="number"
                        min={0}
                        value={group.value}
                        onChange={e => {
                          const val = parseInt(e.target.value, 10);
                          const num = isNaN(val) ? 0 : Math.max(0, val);
                          if (group.key === "recues") {
                            updateField("totalRecues", num);
                            updateField("manualTotalRecues", true);
                          } else if (group.key === "contactees") {
                            updateField("totalContactees", num);
                            updateField("manualTotalContactees", true);
                          } else if (group.key === "aboutis") {
                            updateField("totalAboutis", num);
                            updateField("manualTotalAboutis", true);
                          }
                        }}
                        className={styles.groupTotalInput}
                        title={`Total ${group.title} (cliquez pour modifier)`}
                        aria-label={`Total ${group.title}`}
                      />
                    </h2>
                    <dl>
                      {group.rows.map(row => (
                        <div key={row.key}>
                          <dt>{row.label}</dt>
                          <dd>
                            <input 
                              type="number"
                              min={0}
                              value={row.value}
                              onChange={e => updateNumber(row.key as keyof FddCallCenterState, e.target.value)}
                              className={styles.cellInput}
                              title={`Modifier : ${row.label}`}
                              aria-label={row.label}
                            />
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                ))}
              </div>

              <section className={styles.observations}>
                <h2>Commentaire</h2>
                <textarea 
                  rows={4}
                  value={reportState.comment}
                  onChange={e => updateField("comment", e.target.value)}
                  placeholder="Ajoutez vos observations ou commentaires sur le call center…"
                />
              </section>

              <footer className={styles.reportFooter}>
                <span>ICC {church} · {family}</span>
                <span>Confidentiel · {effectiveTotalRecues} invité(s)</span>
              </footer>
            </article>
          </main>
        </div>

        {/* ── CANONICAL OFFSCREEN A4 EXPORT (Pure HTML without inputs, exactly matching CrCallCenterModal) ── */}
        <div
          style={{
            position: "fixed",
            left: 0,
            top: 0,
            width: 800,
            zIndex: -9999,
            opacity: 0,
            pointerEvents: "none",
            overflow: "visible",
          }}
          aria-hidden="true"
        >
          <article ref={exportSheetRef} className={`${styles.sheet} ${styles.exportSheet}`}>
            <header className={styles.reportHeader}>
              <div>
                <span className={styles.reportKicker}>
                  ICC {church} · FAMILLE DE DISCIPLES {family.toUpperCase()}
                </span>
                <h1>Compte rendu<br /><em>Call center invités</em></h1>
                <p>{reportState.period}</p>
              </div>
              <span className={styles.reportStamp}>
                RAPPORT<br /><strong>DE SUIVI</strong>
              </span>
            </header>

            <div className={styles.reportTable}>
              {reportGroups.map((group, index) => (
                <section className={styles.reportGroup} key={group.key}>
                  <h2>
                    <span className={styles.groupNumber}>{String(index + 1).padStart(2, "0")}</span>
                    <span>{group.title}</span>
                    <strong>{group.value}</strong>
                  </h2>
                  <dl>
                    {group.rows.map(row => (
                      <div key={row.key}>
                        <dt>{row.label}</dt>
                        <dd>{row.value}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ))}
            </div>

            <section className={styles.observations}>
              <h2>Commentaire</h2>
              <p>{reportState.comment.trim() || "Aucun commentaire."}</p>
            </section>

            <footer className={styles.reportFooter}>
              <span>ICC {church} · {family}</span>
              <span>Confidentiel · {effectiveTotalRecues} invité(s)</span>
            </footer>
          </article>
        </div>
      </div>
    </div>,
    document.body
  );
}
