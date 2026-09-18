"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowRightLeft, ChevronDown, Church, Menu, X } from "lucide-react";
import { useWorkspace } from "@/lib/use-workspace";
import { roleLabel } from "@/lib/navigation";
import { clearActiveSpace } from "@/lib/client-session";
import styles from "@/components/experience/Experience.module.css";

export default function Header({ onMenuClick }: { bergerieName?: string; onMenuClick?: () => void }) {
  const workspace = useWorkspace();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current; if (!open || !dialog) return; dialog.showModal(); return () => dialog.close(); }, [open]);
  if (!workspace.active) return null;
  const title = workspace.isSuperAdmin ? "Administration centrale" : workspace.hasFamily ? workspace.familyName : "Intégration & suivi";
  return <>
    <header className={`${styles.topbar} ${styles.ui}`}>
      <button type="button" className={`${styles.iconButton} ${styles.mobileMenu}`} onClick={onMenuClick} aria-label="Ouvrir la navigation"><Menu size={21} /></button>
      <button type="button" className={styles.contextButton} onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open} aria-label={`Espace actif : ${title}. Changer d’espace`}>
        <span className={styles.contextIcon}><Church size={19} /></span><span><small>{workspace.churchName}</small><strong>{title}</strong></span><ChevronDown size={16} />
      </button>
      <span className={styles.roleBadge}>{roleLabel(workspace.role)}</span>
    </header>
    <dialog ref={ref} className={`${styles.dialog} ${styles.ui}`} aria-labelledby="space-title" onCancel={event => { event.preventDefault(); setOpen(false); }}>
      <div className={styles.sectionHeading}><span className={styles.kicker}>VOUS TRAVAILLEZ DANS</span><button type="button" className={styles.iconButton} onClick={() => setOpen(false)} aria-label="Fermer" autoFocus><X size={19} /></button></div>
      <h2 id="space-title">{title}</h2><p>{workspace.churchName}<br />{roleLabel(workspace.role)}</p>
      <p>Changez d’espace pour retrouver les accès associés à votre compte.</p>
      <button type="button" className={styles.primary} onClick={() => { clearActiveSpace(); localStorage.setItem("poimen_space_exited", "true"); window.location.href = "/login"; }}><ArrowRightLeft size={17} />Changer d’espace</button>
    </dialog>
  </>;
}
