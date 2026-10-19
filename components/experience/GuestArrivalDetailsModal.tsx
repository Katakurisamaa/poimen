"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import styles from "./GuestArrivalDetailsModal.module.css";

export interface GuestFullProfile {
  id: string;
  civility: string;
  firstName: string;
  lastName: string;
  age: string;
  phone?: string;
  email?: string;
  address?: string;
  pays?: string;
  etatCivil?: string;
  arrivalDate: string;
  event: string;
  aps?: boolean | null;
  localChurch?: boolean | null;
  autreEglise?: string;
  aEteInvite?: boolean | null;
  parQui?: string;
  souhaiteEtreContacte?: boolean | null;
  baptemeEau?: boolean | null;
  interetFormation?: boolean | null;
  interetCDM?: boolean | null;
  interetBapteme?: boolean | null;
  commentaire?: string;
}

type FieldValue = string | boolean | null | undefined;
function FormFields({ rows }: { rows: [string, FieldValue][] }) {
  const recorded = rows.filter(([, value]) => typeof value === "boolean" || (typeof value === "string" && value.trim()));
  return <dl className={styles.specList}>
    {recorded.map(([label, value]) => <div key={label} className={styles.specRow}>
      <dt className={styles.specKey}>{label}</dt>
      <dd className={styles.specVal}>{typeof value === "boolean" ? value ? "Oui" : "Non" : value}</dd>
    </div>)}
  </dl>;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  guest: GuestFullProfile | null;
}

export default function GuestArrivalDetailsModal({ isOpen, onClose, guest }: Props) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    drawerRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab") return;
      const buttons = drawerRef.current?.querySelectorAll<HTMLButtonElement>("button");
      if (!buttons?.length) return;
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen || !guest || typeof document === "undefined") return null;
  const date = guest.arrivalDate?.replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$3/$2/$1");
  const age = guest.age?.trim();
  // Older forms stored these two answers in the comment when columns were unavailable.
  const comment = guest.commentaire?.replace(/\[(?:Pays de résidence|Pays|Autre église|Église d'origine)\s*:[^\]]*\]\s*/gi, "").trim();

  return createPortal(
    <div className={styles.backdrop} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={drawerRef} className={styles.drawer} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className={styles.drawerHeader}>
          <span className={styles.kicker}>FORMULAIRE INVITÉ · LECTURE SEULE</span>
          <button type="button" onClick={onClose} className={styles.closeBtn} aria-label="Fermer la fiche"><X size={18} /></button>
        </div>
        <div className={styles.drawerContent}>
          <div className={styles.identityBlock}>
            <div className={styles.avatar} aria-hidden="true">{guest.firstName?.[0]}{guest.lastName?.[0]}</div>
            <div className={styles.identityInfo}>
              {guest.civility && <span className={styles.civilityBadge}>{guest.civility}</span>}
              <h2 id={titleId} className={styles.personName}>{guest.firstName} {guest.lastName}</h2>
              <p className={styles.arrivalSubtitle}>Informations renseignées dans le formulaire d’accueil.</p>
            </div>
          </div>
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Visite</h3>
            <FormFields rows={[["Date de visite", date], ["Événement", guest.event]]} />
          </section>
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Informations personnelles</h3>
            <FormFields rows={[
              ["Tranche d’âge", age ? /ans$/i.test(age) ? age : `${age} ans` : undefined],
              ["État civil", guest.etatCivil], ["Téléphone", guest.phone], ["E-mail", guest.email],
              ["Pays de résidence", guest.pays], ["Adresse", guest.address],
              ["Invité(e) par un membre", guest.aEteInvite], ["Par qui", guest.aEteInvite ? guest.parQui : undefined],
            ]} />
          </section>
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Parcours et souhaits exprimés</h3>
            <FormFields rows={[
              ["Prière du salut lors du culte", guest.aps],
              ["Fréquente déjà une autre église", guest.localChurch],
              ["Nom de l’église", guest.localChurch ? guest.autreEglise : undefined],
              ["Déjà baptisé(e) par immersion", guest.baptemeEau],
              ["Souhaite être baptisé(e)", guest.baptemeEau === false ? guest.interetBapteme : undefined],
              ["Intérêt pour les formations PCNC", guest.interetFormation],
              ["Intérêt pour les cellules de maison (CDM)", guest.interetCDM],
              ["Souhaite être contacté(e)", guest.souhaiteEtreContacte],
            ]} />
          </section>
          {comment && <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Commentaire ou requête de prière</h3>
            <p className={styles.quoteCard}>{comment}</p>
          </section>}
        </div>
        <div className={styles.drawerFooter}><button type="button" onClick={onClose} className={styles.footerCloseBtn}>Fermer</button></div>
      </div>
    </div>, document.body
  );
}
