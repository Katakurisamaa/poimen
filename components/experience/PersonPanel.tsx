"use client";
import { useEffect, useRef, useState } from "react";
import { CalendarDays, Check, Circle, Mail, MapPin, Phone, UserRound, X, ArrowRight } from "lucide-react";
import { summarizePerson } from "@/lib/person-summary";
import styles from "./Experience.module.css";

function dateLabel(value: string) {
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? "Date non renseignée" : date.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

export function PersonButton({ person, onClick }: { person: { firstName: string; lastName: string }; onClick: () => void }) {
  return <button type="button" className={styles.personName} aria-label={`Ouvrir la fiche de ${person.firstName} ${person.lastName}`} onClick={event => { event.stopPropagation(); onClick(); }}>{person.firstName} {person.lastName}</button>;
}

export default function PersonPanel({ person, kind, onClose, onContinue, continueLabel = "Ouvrir le suivi détaillé" }: {
  person: object; kind: "member" | "guest"; onClose: () => void; onContinue?: () => void; continueLabel?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState("overview");
  const summary = summarizePerson(person, kind);
  useEffect(() => {
    const dialog = ref.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog?.showModal();
    dialog?.querySelector<HTMLElement>("h2")?.focus();
    return () => { dialog?.close(); document.body.style.overflow = overflow; };
  }, []);
  return <dialog ref={ref} className={`${styles.personPanel} ${styles.ui}`} aria-labelledby="person-title" onCancel={event => { event.preventDefault(); onClose(); }}>
    <header className={styles.panelHeader}><span className={styles.kicker}>FICHE PERSONNE · {kind === "guest" ? "INVITÉ" : "MEMBRE"}</span><button className={styles.iconButton} type="button" aria-label="Fermer la fiche" onClick={onClose}><X size={20} /></button></header>
    <div className={styles.personIdentity}><span className={styles.personAvatar}>{summary.firstName[0]}{summary.lastName[0]}</span><h2 id="person-title" tabIndex={-1}>{summary.name}</h2><span className={styles.roleBadge}>{summary.role}</span><p><UserRound size={14} />Responsable : {summary.responsible}</p></div>
    <div className={styles.personTabs} role="tablist" aria-label="Rubriques de la fiche" onKeyDown={event => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const tabs = ["overview", "journey", "attendance"];
      const next = event.key === "Home" ? 0 : event.key === "End" ? 2 : (tabs.indexOf(tab) + (event.key === "ArrowRight" ? 1 : 2)) % 3;
      setTab(tabs[next]);
      ref.current?.querySelector<HTMLButtonElement>(`#person-tab-${tabs[next]}`)?.focus();
    }}>{[{ id: "overview", label: "Vue d’ensemble" }, { id: "journey", label: "Parcours" }, { id: "attendance", label: "Présences" }].map(item => <button key={item.id} type="button" role="tab" id={`person-tab-${item.id}`} aria-controls="person-content" aria-selected={tab === item.id} tabIndex={tab === item.id ? 0 : -1} onClick={() => setTab(item.id)}>{item.label}</button>)}</div>
    <section className={styles.panelContent} id="person-content" role="tabpanel" aria-labelledby={`person-tab-${tab}`}>
      {tab === "overview" && <>
        <div className={styles.nextAction}><span className={styles.kicker}>PROCHAINE ÉTAPE SUGGÉRÉE</span><p>{summary.nextAction}</p></div>
        <h3>Coordonnées</h3>
        <div className={styles.contactList}>
          {summary.phone && summary.contactAllowed ? <a href={`tel:${summary.phone.replace(/[^+\d]/g, "")}`}><Phone size={17} /><span>{summary.phone}<small>Appeler</small></span><ArrowRight size={16} /></a> : <p><Phone size={17} />{summary.phone || "Téléphone non renseigné"}</p>}
          {summary.email && summary.contactAllowed ? <a href={`mailto:${summary.email}`}><Mail size={17} /><span>{summary.email}<small>Écrire un e-mail</small></span><ArrowRight size={16} /></a> : <p><Mail size={17} />{summary.email || "E-mail non renseigné"}</p>}
          {summary.address && <p><MapPin size={17} />{summary.address}</p>}
          {summary.arrivalDate && <p><CalendarDays size={17} />Arrivée le {dateLabel(summary.arrivalDate)}</p>}
        </div>
        {!summary.contactAllowed && <p className={styles.help}>Souhait de contact : non. Les raccourcis de contact sont désactivés.</p>}
        <h3>Notes de suivi</h3>{summary.notes.length ? summary.notes.map((note, index) => <p className={styles.note} key={index}>{note}</p>) : <p className={styles.help}>Aucune note renseignée pour le moment.</p>}
      </>}
      {tab === "journey" && <><h3>Les étapes du parcours</h3><p className={styles.help}>D’après les informations enregistrées dans la fiche.</p><div className={styles.journey}>{summary.steps.map(step => <div key={step.label}>{step.done ? <Check size={18} /> : <Circle size={18} />}<span>{step.label}<small>{step.done ? "Renseigné comme effectué" : "Non renseigné comme effectué"}</small></span></div>)}</div>{summary.formations.length > 0 && <p className={styles.note}>Formations : {summary.formations.join(", ")}</p>}</>}
      {tab === "attendance" && <><h3>Dernières présences</h3><p className={styles.help}>{summary.eventCount ? `${summary.eventCount} pointages enregistrés${summary.eventCount > 30 ? " · les 30 plus récents" : ""}.` : "Aucun pointage enregistré pour cette personne."}</p><div className={styles.timeline}>{summary.events.map(event => <div key={`${event.activity}-${event.date}`}><span className={styles.timelineDot} /><div><time dateTime={event.date}>{dateLabel(event.date)}</time><strong>{event.activity} · {event.status}</strong>{event.reason && <p>{event.reason}</p>}</div></div>)}</div></>}
    </section>
    {onContinue && <footer className={styles.panelFooter}><button className={styles.primary} type="button" onClick={() => { onClose(); onContinue(); }}>{continueLabel}<ArrowRight size={17} /></button></footer>}
  </dialog>;
}
