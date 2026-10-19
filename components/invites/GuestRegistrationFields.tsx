"use client";

import { useId, type ReactNode } from "react";
import { CalendarDays, ChevronDown, HeartHandshake, MapPin, UserRound } from "lucide-react";
import CustomDatePicker from "@/components/ui/CustomDatePicker";
import CustomSelect from "@/components/ui/CustomSelect";
import YesNoField from "@/components/ui/YesNoField";
import styles from "./GuestRegistrationFields.module.css";

export interface GuestRegistrationValues {
  arrivalDate?: string; event?: string; civility?: string; firstName?: string; lastName?: string;
  phone?: string; email?: string; age?: string; etatCivil?: string; pays?: string; address?: string;
  aEteInvite?: boolean; parQui?: string; aps?: boolean; localChurch?: boolean; autreEglise?: string;
  baptemeEau?: boolean; interetFormation?: boolean; interetCDM?: boolean; interetBapteme?: boolean;
  souhaiteEtreContacte?: boolean; commentaire?: string;
}

export function emptyGuestRegistration(): GuestRegistrationValues {
  const date = new Date();
  return {
    arrivalDate: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
    event: "Culte", civility: "M.", firstName: "", lastName: "", phone: "", email: "",
    pays: "Belgique", age: "26-30 ans", etatCivil: "Célibataire", address: "", commentaire: "",
  };
}

const options = (values: string[]) => values.map(value => ({ value, label: value }));
const ages = ["Moins de 18 ans", "18-25 ans", "26-30 ans", "31-35 ans", "36-40 ans", "41-45 ans", "46-50 ans", "Plus de 50 ans"];

function Section({ number, title, hint, icon, children }: { number: string; title: string; hint: string; icon: ReactNode; children: ReactNode }) {
  return <section className={styles.section}>
    <header className={styles.sectionHeader}><span className={styles.sectionIcon} aria-hidden="true">{icon}</span><div><h3><small>{number}</small>{title}</h3><p>{hint}</p></div></header>
    {children}
  </section>;
}

export default function GuestRegistrationFields({ value, onChange, onChooseCountry, assignment }: {
  value: GuestRegistrationValues; onChange: (patch: GuestRegistrationValues) => void; onChooseCountry: () => void; assignment?: ReactNode;
}) {
  const prefix = useId();
  const field = (name: string) => `${prefix}-${name}`;
  const question = (name: keyof Pick<GuestRegistrationValues, "aEteInvite" | "aps" | "localChurch" | "baptemeEau" | "interetFormation" | "interetCDM" | "interetBapteme" | "souhaiteEtreContacte">, label: string) =>
    <YesNoField name={name} label={label} value={value[name]} required onChange={answer => onChange({ [name]: answer, ...(name === "baptemeEau" ? { interetBapteme: undefined } : {}) })} />;

  return <div className={styles.fields}>
    <Section number="01" title="La visite" hint="Le contexte de l’accueil de votre invité." icon={<CalendarDays size={19} />}>
      <div className={styles.grid}>
        <div className={styles.field}><label>Date d’arrivée <span>*</span></label><CustomDatePicker value={value.arrivalDate || ""} onChange={arrivalDate => onChange({ arrivalDate })} placeholder="Choisir une date" ariaLabel="Date d’arrivée" /></div>
        <div className={styles.field}><label>Événement</label><CustomSelect ariaLabel="Événement" value={value.event || "Culte"} onChange={event => onChange({ event })} searchable={false} options={options(["Culte", "Baptême", "Évangélisation", "Séminaire", "Autre"])} /></div>
      </div>
      {assignment && <div className={styles.assignment}>{assignment}</div>}
    </Section>
    <Section number="02" title="Faisons connaissance" hint="Les informations personnelles et les coordonnées." icon={<UserRound size={19} />}>
      <div className={styles.identityGrid}>
        <div className={styles.field}><label>Civilité</label><CustomSelect ariaLabel="Civilité" value={value.civility || "M."} onChange={civility => onChange({ civility })} searchable={false} options={options(["M.", "Mme.", "Mlle."])} /></div>
        <div className={styles.field}><label htmlFor={field("firstName")}>Prénom <span>*</span></label><input id={field("firstName")} required autoComplete="given-name" value={value.firstName || ""} onChange={e => onChange({ firstName: e.target.value })} placeholder="Prénom" /></div>
        <div className={styles.field}><label htmlFor={field("lastName")}>Nom <span>*</span></label><input id={field("lastName")} required autoComplete="family-name" value={value.lastName || ""} onChange={e => onChange({ lastName: e.target.value })} placeholder="Nom de famille" /></div>
      </div>
      <div className={styles.grid}>
        <div className={styles.field}><label htmlFor={field("phone")}>Téléphone</label><input id={field("phone")} type="tel" autoComplete="tel" value={value.phone || ""} onChange={e => onChange({ phone: e.target.value.replace(/[^0-9+\-\s()]/g, "") })} placeholder="+32 470 12 34 56" /></div>
        <div className={styles.field}><label htmlFor={field("email")}>E-mail <small>Facultatif</small></label><input id={field("email")} type="email" autoComplete="email" value={value.email || ""} onChange={e => onChange({ email: e.target.value })} placeholder="prenom@exemple.com" /></div>
        <div className={styles.field}><label>Tranche d’âge</label><CustomSelect ariaLabel="Tranche d’âge" value={value.age || "26-30 ans"} onChange={age => onChange({ age })} searchable={false} options={options(value.age && !ages.includes(value.age) ? [value.age, ...ages] : ages)} /></div>
        <div className={styles.field}><label>État civil</label><CustomSelect ariaLabel="État civil" value={value.etatCivil || "Célibataire"} onChange={etatCivil => onChange({ etatCivil })} searchable={false} options={options(["Célibataire", "Marié(e)", "En couple", "Séparé(e)", "Divorcé(e)", "Veuf(ve)"])} /></div>
        <div className={styles.field}><label>Pays de résidence</label><button type="button" className={styles.country} onClick={onChooseCountry} aria-label="Pays de résidence"><span><MapPin size={16} />{value.pays || "Belgique"}</span><ChevronDown size={16} /></button></div>
        <div className={styles.field}><label htmlFor={field("address")}>Adresse <small>Facultatif</small></label><input id={field("address")} autoComplete="street-address" value={value.address || ""} onChange={e => onChange({ address: e.target.value })} placeholder="Rue, numéro et ville" /></div>
      </div>
      <div className={styles.questions}>
        {question("aEteInvite", "Un membre a-t-il invité cette personne ?")}
        {value.aEteInvite && <div className={`${styles.field} ${styles.followup}`}><label htmlFor={field("parQui")}>Qui l’a invité(e) ?</label><input id={field("parQui")} value={value.parQui || ""} onChange={e => onChange({ parQui: e.target.value })} placeholder="Prénom et nom du membre" /></div>}
      </div>
    </Section>
    <Section number="03" title="Parcours et souhaits" hint="Posez chaque question et sélectionnez Oui ou Non." icon={<HeartHandshake size={19} />}>
      <div className={styles.questions}>
        {question("aps", "A fait la prière du salut lors du culte ?")}
        {question("localChurch", "Fréquente déjà une autre église ?")}
        {value.localChurch && <div className={`${styles.field} ${styles.followup}`}><label htmlFor={field("autreEglise")}>Nom de l’église <span>*</span></label><input id={field("autreEglise")} required value={value.autreEglise || ""} onChange={e => onChange({ autreEglise: e.target.value })} placeholder="Nom de l’église et ville" /></div>}
        {question("baptemeEau", "Déjà baptisé(e) par immersion ?")}
        {value.baptemeEau === false && question("interetBapteme", "Souhaite être baptisé(e) ?")}
        {question("interetFormation", "Souhaite suivre les formations PCNC ?")}
        {question("interetCDM", "Souhaite découvrir les cellules de maison (CDM) ?")}
        {question("souhaiteEtreContacte", "Souhaite être contacté(e) ?")}
      </div>
      <div className={`${styles.field} ${styles.comment}`}><label htmlFor={field("commentaire")}>Commentaire ou requête de prière <small>Facultatif</small></label><textarea id={field("commentaire")} rows={4} value={value.commentaire || ""} onChange={e => onChange({ commentaire: e.target.value })} placeholder="Un besoin, un sujet de prière ou une précision pour l’accueil…" /></div>
    </Section>
  </div>;
}
