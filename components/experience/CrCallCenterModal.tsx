"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, CalendarDays, Copy, Check, FileText, Download, Edit3, ArrowRight } from "lucide-react";
import { toPng } from "html-to-image";
import jsPDF from "jspdf";
import { useFeedback } from "@/components/experience/FeedbackProvider";
import { buildCrReport, crReportText, formatCrDate, type CrGuest } from "@/lib/cr-call-center";
import CrDatePickerModal from "./CrDatePickerModal";
import styles from "./CrCallCenterModal.module.css";

export type { CrGuest } from "@/lib/cr-call-center";
interface Props { isOpen: boolean; onClose: () => void; guests: CrGuest[]; churchName?: string }

export default function CrCallCenterModal({ isOpen, onClose, guests, churchName = "CHARLEROI" }: Props) {
  const { notify } = useFeedback();
  const [mode, setMode] = useState<"single" | "range" | "all">("single");
  const [date, setDate] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [comment, setComment] = useState("");
  const [copied, setCopied] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dates = useMemo(() => Array.from(new Set(guests.map(g => g.arrivalDate).filter((d): d is string => Boolean(d)))).sort().reverse(), [guests]);
  const selectedDate = date || dates[0] || "";
  const startDate = start || dates[dates.length - 1] || "";
  const endDate = end || dates[0] || "";
  const invalid = mode === "range" && (!startDate || !endDate || startDate > endDate);
  const filtered = useMemo(() => guests.filter(g => mode === "all" || (!invalid && (mode === "single" ? g.arrivalDate === selectedDate : Boolean(g.arrivalDate && g.arrivalDate >= startDate && g.arrivalDate <= endDate))))
    .sort((a, b) => (a.arrivalDate || "").localeCompare(b.arrivalDate || "") || (a.lastName || "").localeCompare(b.lastName || "", "fr")), [guests, mode, invalid, selectedDate, startDate, endDate]);
  const report = useMemo(() => buildCrReport(filtered), [filtered]);
  const missingDates = guests.filter(g => !g.arrivalDate).length;
  const church = churchName.replace(/^ICC\s+/i, "").trim() || "CHARLEROI";
  const period = mode === "all" ? "Toutes les dates d’accueil" : mode === "single" ? `Du ${formatCrDate(selectedDate)}` : `Du ${formatCrDate(startDate)} au ${formatCrDate(endDate)}`;
  const exportDisabled = invalid || !filtered.length;

  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    modalRef.current?.focus();
    return () => { document.body.style.overflow = overflow; previousFocus?.focus(); };
  }, [isOpen]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  async function copyReport() {
    try {
      await navigator.clipboard.writeText(crReportText(filtered, church, period, comment));
      setCopied(true);
      notify("Rapport copié avec succès.");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2500);
    } catch { notify("Impossible de copier le rapport. Vérifiez l’autorisation du presse-papiers de votre navigateur."); }
  }

  async function handleDownloadPdf() {
    if (!sheetRef.current) return;
    setIsDownloading(true);
    notify("Génération du document PDF en cours…");

    try {
      const element = sheetRef.current;
      const dataUrl = await toPng(element, {
        pixelRatio: 2.4,
        backgroundColor: "#ffffff",
        cacheBust: true,
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
      const margin = 10;
      const availWidth = pdfWidth - margin * 2;
      const availHeight = pdfHeight - margin * 2;

      const imgWidth = availWidth;
      const imgHeight = (img.height * imgWidth) / img.width;

      if (imgHeight <= availHeight) {
        pdf.addImage(dataUrl, "PNG", margin, margin, imgWidth, imgHeight, undefined, "FAST");
      } else {
        let heightLeft = imgHeight;
        let position = margin;

        pdf.addImage(dataUrl, "PNG", margin, position, imgWidth, imgHeight, undefined, "FAST");
        heightLeft -= availHeight;

        while (heightLeft > 0) {
          position = margin - (imgHeight - heightLeft);
          pdf.addPage();
          pdf.addImage(dataUrl, "PNG", margin, position, imgWidth, imgHeight, undefined, "FAST");
          heightLeft -= availHeight;
        }
      }

      const safePeriod = period.replace(/[^a-zA-Z0-9]/g, "_");
      pdf.save(`CR_Call_Center_ICC_${church}_${safePeriod}.pdf`);
      notify("Téléchargement du PDF terminé avec succès !");
    } catch (err: any) {
      console.error("PDF generation failed:", err);
      notify("Erreur lors de la génération du PDF. Vous pouvez aussi copier le rapport.");
    } finally {
      setIsDownloading(false);
    }
  }

  if (!isOpen || typeof document === "undefined") return null;
  return createPortal(
    <>
      <div className={styles.overlay} data-cr-root="true" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
        <div ref={modalRef} className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="cr-title" tabIndex={-1}
          onKeyDown={e => {
            if (e.key === "Escape") { e.stopPropagation(); onClose(); }
            if (e.key !== "Tab") return;
            const elements = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select, textarea, [tabindex="0"]'));
            const first = elements[0], last = elements[elements.length - 1];
            if (e.shiftKey && (document.activeElement === first || document.activeElement === modalRef.current)) { e.preventDefault(); last?.focus(); }
            else if (!e.shiftKey && (document.activeElement === last || document.activeElement === modalRef.current)) { e.preventDefault(); first?.focus(); }
          }}>
          <header className={styles.toolbar}>
            <div className={styles.heading}><span className={styles.icon}><FileText size={22} /></span><div><span className={styles.eyebrow}>INTÉGRATION / RAPPORTS</span><h2 id="cr-title">Compte rendu call center</h2></div></div>
            <div className={styles.actions}>
              <button type="button" className={styles.secondary} onClick={copyReport} disabled={exportDisabled}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? "Copié" : "Copier le rapport"}</button>
              <button type="button" className={styles.primary} onClick={handleDownloadPdf} disabled={exportDisabled || isDownloading}><Download size={16} />{isDownloading ? "Téléchargement…" : "Télécharger le PDF"}</button>
              <button type="button" className={styles.close} onClick={onClose} aria-label="Fermer le compte rendu"><X size={21} /></button>
            </div>
          </header>
          <div className={styles.workspace}>
            <aside className={styles.settings} aria-label="Paramètres du rapport">
              <span className={styles.eyebrow}>PRÉPARER LE RAPPORT</span>
              <h3><CalendarDays size={18} /> Période d’accueil</h3>
              <p>Sélectionnez les invités à inclure dans le compte rendu.</p>

              {/* Custom Date Trigger Card */}
              <div
                className={styles.dateTriggerCard}
                onClick={() => setIsDatePickerOpen(true)}
                role="button"
                tabIndex={0}
                onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setIsDatePickerOpen(true); } }}
                aria-label="Modifier la période d’accueil via la modale"
              >
                <div className={styles.dateTriggerTop}>
                  <span className={styles.dateTriggerBadge}>
                    {mode === "single" ? "Un dimanche" : mode === "range" ? "Période" : "Tout l’historique"}
                  </span>
                  <span className={styles.dateTriggerAction}>
                    <Edit3 size={13} /> Modifier
                  </span>
                </div>
                <div className={styles.dateTriggerValue}>
                  {period}
                </div>
                <div className={styles.dateTriggerFooter}>
                  <span>{filtered.length} invité{filtered.length > 1 ? "s" : ""} sélectionné{filtered.length > 1 ? "s" : ""}</span>
                  <ArrowRight size={13} />
                </div>
              </div>

              {invalid && <p className={styles.error} role="alert" style={{ marginTop: 8 }}>Sélectionnez une période valide : la fin doit suivre le début.</p>}
              {missingDates > 0 && mode !== "all" && <p className={styles.hint} style={{ marginTop: 8 }}>{missingDates} invité(s) sans date d’arrivée exclus de cette sélection.</p>}

              <hr />
              <h3>Commentaire du call center</h3>
              <label className={styles.field}><span className="sr-only">Commentaire</span><textarea aria-label="Commentaire" rows={6} value={comment} onChange={e => setComment(e.target.value)} placeholder="Ajoutez vos observations ou commentaires sur le call center…" /></label>
              <p className={styles.hint}>Brouillon conservé tant que cette page reste ouverte.</p>
              <div className={styles.privacy}>Document confidentiel<br /><span>À partager avec les responsables concernés.</span></div>
            </aside>
            <main className={styles.preview} aria-label="Aperçu du compte rendu" tabIndex={0}>
              <div className={styles.previewBar}><span>Aperçu du rapport · format A4</span><span>Modèle prêt pour téléchargement PDF</span></div>
              {exportDisabled ? <div className={styles.empty}><CalendarDays size={36} /><h3>{invalid ? "Vérifiez la période" : "Aucun invité sur cette sélection"}</h3><p>{invalid ? "La date de fin doit être égale ou postérieure à la date de début." : "Choisissez une autre date ou affichez toutes les dates d’accueil."}</p></div> :
                <article ref={sheetRef} className={styles.sheet}>
                  <header className={styles.reportHeader}><div><span className={styles.reportKicker}>ICC {church} · DÉPARTEMENT INTÉGRATION</span><h1>Compte rendu<br /><em>Call center invités</em></h1><p>{period}</p></div><span className={styles.reportStamp}>RAPPORT<br /><strong>DE SUIVI</strong></span></header>
                  <div className={styles.reportTable}>
                    {report.map((group, index) => <section className={styles.reportGroup} key={group.title}>
                      <h2><span className={styles.groupNumber}>{String(index + 1).padStart(2, "0")}</span><span>{group.title}</span><strong>{group.value}</strong></h2>
                      <dl>{group.rows.map(row => <div key={row.label}><dt>{row.label}</dt><dd className={row.value === null ? styles.unavailable : undefined}>{row.value ?? "Non renseigné"}</dd></div>)}</dl>
                    </section>)}
                  </div>
                  <section className={styles.observations}><h2>Commentaire</h2><p>{comment.trim() || "Aucun commentaire."}</p></section>
                  <footer className={styles.reportFooter}><span>ICC {church} · Intégration</span><span>Confidentiel · {filtered.length} invité(s)</span></footer>
                </article>}
            </main>
          </div>
        </div>
      </div>

      <CrDatePickerModal
        isOpen={isDatePickerOpen}
        onClose={() => setIsDatePickerOpen(false)}
        mode={mode}
        selectedDate={selectedDate}
        startDate={startDate}
        endDate={endDate}
        guests={guests}
        onApply={(newMode, newSelectedDate, newStart, newEnd) => {
          setMode(newMode);
          if (newSelectedDate) setDate(newSelectedDate);
          if (newStart) setStart(newStart);
          if (newEnd) setEnd(newEnd);
        }}
      />
    </>,
    document.body,
  );
}



