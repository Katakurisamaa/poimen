"use client";

import { useState } from "react";
import { Save, ChevronDown, ChevronUp, History, Sparkles, Check } from "lucide-react";
import styles from "./Suivi.module.css";

function QuestionToggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className={styles.question}>
      <span className={styles.questionLabel}>{label}</span>
      <div className={styles.toggleGroup} role="group" aria-label={label}>
        <button
          type="button"
          aria-pressed={value}
          className={`${styles.toggleBtn} ${value ? styles.toggleBtnActive : ""}`}
          onClick={() => onChange(true)}
        >
          {value && <Check size={14} aria-hidden="true" />}
          Oui
        </button>
        <button
          type="button"
          aria-pressed={!value}
          className={`${styles.toggleBtn} ${!value ? styles.toggleBtnActive : ""}`}
          onClick={() => onChange(false)}
        >
          {!value && <Check size={14} aria-hidden="true" />}
          Non
        </button>
      </div>
    </div>
  );
}

function Section({ step, title, children, open: init = true }: { step: string; title: string; children: React.ReactNode; open?: boolean }) {
  const [open, setOpen] = useState(init);
  return (
    <section className={styles.section}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`${styles.sectionHeader} ${open ? styles.sectionHeaderOpen : ""}`}
        aria-expanded={open}
      >
        <div className={styles.sectionTitleGroup}>
          <span className={styles.stepBadge}>{step}</span>
          <span className={styles.sectionTitle}>{title}</span>
        </div>
        {open ? <ChevronUp size={18} style={{ color: "var(--muted)" }} /> : <ChevronDown size={18} style={{ color: "var(--muted)" }} />}
      </button>
      {open && <div className={styles.sectionContent}>{children}</div>}
    </section>
  );
}

export default function SuiviPage() {
  const [f, setF] = useState({
    appel_abouti: false, groupe_whatsapp: true, dans_fdd: true,
    prevu_revenir: true, revenu_culte: true, rencontre: true,
    visite: false, interesse_cdm: true, presence_cdm: true,
    priere_eglise: true, priere_partage: false, interet_events: true,
    event_ok: false, cocktail: true, interet_formation: true,
    p001: true, p101: true, p201: false, p301: false,
    pcnc: false, veut_servir: true, star: false,
  });
  const [eventInput, setEventInput] = useState("Culte");
  const [comment, setComment] = useState("Membre engagé, signes réguliers de croissance et bonne réceptivité.");
  const setVal = (k: keyof typeof f, v: boolean) => setF(p => ({ ...p, [k]: v }));

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <div className={styles.eyebrow}>
            <Sparkles size={14} />
            <span>Équipe Intégration · Suivi spirituel</span>
          </div>
          <h1 className={styles.title}>Fiche de suivi individuel</h1>
          <p className={styles.subtitle}>
            Accompagnement continu de <strong>Grâce Mukendi</strong> · Conseiller référent : Sarah K.
          </p>
        </div>
        <div className={styles.actions}>
          <button type="button" className="btn btn-outline">
            <History size={15} /> Historique
          </button>
          <button type="button" className="btn btn-primary">
            <Save size={15} /> Enregistrer
          </button>
        </div>
      </header>

      {/* Profile Summary Card */}
      <div className={styles.profileCard}>
        <div className={styles.profileGrid}>
          {[
            ["Nom & Prénom", "Grâce Mukendi"],
            ["Civilité", "Mme."],
            ["Tranche d'âge", "26-30 ans"],
            ["E-mail", "grace@email.com"],
            ["Téléphone", "+32 470 123 456"],
            ["Adresse", "Rue de la Station 15, Charleroi"],
            ["Conseiller", "Sarah K."],
            ["Église locale", "Oui (ICC Charleroi)"]
          ].map(([label, value]) => (
            <div key={label} className={styles.profileItem}>
              <span className={styles.profileLabel}>{label}</span>
              <span className={styles.profileValue}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 01 Contact initial */}
      <Section step="01" title="Contact initial & Accueil">
        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="event-select">Événement d&apos;entrée</label>
          <select
            id="event-select"
            className={styles.fieldInput}
            value={eventInput}
            onChange={e => setEventInput(e.target.value)}
          >
            <option>Culte</option>
            <option>Évangélisation</option>
            <option>Baptême</option>
            <option>Séminaire</option>
          </select>
        </div>
        <QuestionToggle label="Premier contact téléphonique abouti" value={f.appel_abouti} onChange={v => setVal("appel_abouti", v)} />
        <QuestionToggle label="Intégration au groupe WhatsApp d'accueil" value={f.groupe_whatsapp} onChange={v => setVal("groupe_whatsapp", v)} />
        <QuestionToggle label="Affecté(e) dans une Famille de Disciples" value={f.dans_fdd} onChange={v => setVal("dans_fdd", v)} />
      </Section>

      {/* 02 Engagement & Présence */}
      <Section step="02" title="Engagement & Présence">
        <QuestionToggle label="A prévu de revenir le dimanche prochain" value={f.prevu_revenir} onChange={v => setVal("prevu_revenir", v)} />
        <QuestionToggle label="Est effectivement revenu(e) au culte" value={f.revenu_culte} onChange={v => setVal("revenu_culte", v)} />
        <QuestionToggle label="Rencontre physique / entretien effectué" value={f.rencontre} onChange={v => setVal("rencontre", v)} />
        <QuestionToggle label="Visite à domicile effectuée" value={f.visite} onChange={v => setVal("visite", v)} />
        <QuestionToggle label="Intérêt exprimé pour la C.D.M (jeudi)" value={f.interesse_cdm} onChange={v => setVal("interesse_cdm", v)} />
        <QuestionToggle label="Présence confirmée en C.D.M" value={f.presence_cdm} onChange={v => setVal("presence_cdm", v)} />
      </Section>

      {/* 03 Vie spirituelle */}
      <Section step="03" title="Vie spirituelle & Communion">
        <QuestionToggle label="Prière d'engagement / salut à l'église" value={f.priere_eglise} onChange={v => setVal("priere_eglise", v)} />
        <QuestionToggle label="Temps de prière et partage régulier" value={f.priere_partage} onChange={v => setVal("priere_partage", v)} />
        <QuestionToggle label="Intérêt pour les événements de l'église" value={f.interet_events} onChange={v => setVal("interet_events", v)} />
        <QuestionToggle label="A participé à un événement spécial" value={f.event_ok} onChange={v => setVal("event_ok", v)} />
        <QuestionToggle label="Participation au cocktail de bienvenue" value={f.cocktail} onChange={v => setVal("cocktail", v)} />
      </Section>

      {/* 04 PCNC & Parcours */}
      <Section step="04" title="Parcours PCNC & Affermissement">
        <QuestionToggle label="Intérêt pour le parcours de formation PCNC" value={f.interet_formation} onChange={v => setVal("interet_formation", v)} />
        <QuestionToggle label="Participation au module 001 (Bienvenue dans le royaume)" value={f.p001} onChange={v => setVal("p001", v)} />
        <QuestionToggle label="Participation au module 101 (Fondements du royaume)" value={f.p101} onChange={v => setVal("p101", v)} />
        <QuestionToggle label="Participation au module 201 (Croissance spirituelle)" value={f.p201} onChange={v => setVal("p201", v)} />
        <QuestionToggle label="Participation au module 301 (Restauration)" value={f.p301} onChange={v => setVal("p301", v)} />
        <QuestionToggle label="Cycle complet PCNC achevé" value={f.pcnc} onChange={v => setVal("pcnc", v)} />
        <QuestionToggle label="Souhaite servir dans un département" value={f.veut_servir} onChange={v => setVal("veut_servir", v)} />
        <QuestionToggle label="Statut S.T.A.R confirmé" value={f.star} onChange={v => setVal("star", v)} />
      </Section>

      {/* 05 Commentaires */}
      <Section step="05" title="Commentaires & Notes pastorales">
        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="suivi-comment">Notes de suivi & sujets de prière</label>
          <textarea
            id="suivi-comment"
            className={styles.fieldTextarea}
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Observations, étapes franchies, requêtes de prière..."
          />
        </div>
      </Section>
    </div>
  );
}
