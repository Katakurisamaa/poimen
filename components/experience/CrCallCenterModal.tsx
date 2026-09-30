"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, CalendarDays, Copy, Check, Printer, FileText } from "lucide-react";
import { useFeedback } from "@/components/experience/FeedbackProvider";
import { buildCrReport, crReportText, formatCrDate, type CrGuest } from "@/lib/cr-call-center";
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
  const modalRef = useRef<HTMLDivElement>(null);
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

  function handlePrint() {
    const originalTitle = typeof document !== "undefined" ? document.title : "";
    if (typeof document !== "undefined") {
      document.title = `CR_Call_Center_${church}_${period.replace(/[^a-zA-Z0-9]/g, "_")}`;
    }
    window.print();
    setTimeout(() => {
      if (typeof document !== "undefined") {
        document.title = originalTitle;
      }
    }, 1500);
  }

  if (!isOpen || typeof document === "undefined") return null;
  return createPortal(
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
            <button type="button" className={styles.primary} onClick={handlePrint} disabled={exportDisabled}><Printer size={16} />Imprimer / PDF</button>
            <button type="button" className={styles.close} onClick={onClose} aria-label="Fermer le compte rendu"><X size={21} /></button>
          </div>
        </header>
        <div className={styles.workspace}>
          <aside className={styles.settings} aria-label="Paramètres du rapport">
            <span className={styles.eyebrow}>PRÉPARER LE RAPPORT</span>
            <h3><CalendarDays size={18} /> Période d’accueil</h3>
            <p>Choisissez les invités à inclure selon leur date d’arrivée.</p>
            <div className={styles.segment} aria-label="Type de période">
              {([["single", "Une date"], ["range", "Période"], ["all", "Tout"]] as const).map(([value, label]) => <button type="button" key={value} aria-pressed={mode === value} onClick={() => setMode(value)}>{label}</button>)}
            </div>
            {mode === "single" && <label className={styles.field}>Date d’accueil<select value={selectedDate} onChange={e => setDate(e.target.value)}>{!dates.length && <option value="">Aucune date disponible</option>}{dates.map(d => <option key={d} value={d}>{formatCrDate(d)}</option>)}</select></label>}
            {mode === "range" && <div className={styles.dateRange}><label className={styles.field}>Du<input type="date" value={startDate} onChange={e => setStart(e.target.value)} aria-invalid={invalid} /></label><label className={styles.field}>Au<input type="date" value={endDate} onChange={e => setEnd(e.target.value)} aria-invalid={invalid} /></label></div>}
            {invalid && <p className={styles.error} role="alert">Sélectionnez une période valide : la fin doit suivre le début.</p>}
            {missingDates > 0 && mode !== "all" && <p className={styles.hint}>{missingDates} invité(s) sans date exclus. Sélectionnez « Tout » pour les inclure.</p>}
            <div className={styles.selection} aria-live="polite"><strong>{filtered.length}</strong><span>invité{filtered.length > 1 ? "s" : ""} dans le rapport</span></div>
            <hr />
            <h3>Commentaire du call center</h3>
            <label className={styles.field}><span className="sr-only">Commentaire</span><textarea aria-label="Commentaire" rows={6} value={comment} onChange={e => setComment(e.target.value)} placeholder="Ajoutez vos observations ou commentaires sur le call center…" /></label>
            <p className={styles.hint}>Brouillon conservé tant que cette page reste ouverte.</p>
            <div className={styles.privacy}>Document confidentiel<br /><span>À partager avec les responsables concernés.</span></div>
          </aside>
          <main className={styles.preview} aria-label="Aperçu du compte rendu" tabIndex={0}>
            <div className={styles.previewBar}><span>Aperçu du rapport · format A4</span><span>Votre modèle de compte rendu</span></div>
            {exportDisabled ? <div className={styles.empty}><CalendarDays size={36} /><h3>{invalid ? "Vérifiez la période" : "Aucun invité sur cette sélection"}</h3><p>{invalid ? "La date de fin doit être égale ou postérieure à la date de début." : "Choisissez une autre date ou affichez toutes les dates d’accueil."}</p></div> :
              <article className={styles.sheet}>
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
    </div>, document.body,
  );
}


