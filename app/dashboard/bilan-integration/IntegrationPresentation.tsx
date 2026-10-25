"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, CalendarDays, Check, Church, HeartHandshake, Maximize, Minimize, Moon, Phone, PhoneForwarded, PhoneOff, RotateCcw, SlidersHorizontal, Sun, Target, Users, X } from "lucide-react";
import styles from "./IntegrationPresentation.module.css";

type Totals = {
  guestsReceived: number; guestsWithoutFamily: number; guestsWithPhone: number;
  wrongNumbers: number; noAnswer: number; callsReached: number; withLocalChurch: number;
  withoutLocalChurch: number; salvationPrayer: number; integratedCdm: number;
  pcnc: number; returnedToChurch: number; fidelizedWithoutLocalChurch: number;
  uninitiatedCalls?: number;
  awaitingAssignment?: number;
  awaitingContact?: number;
  guestsWithoutNextStep: number;
};
type Family = { name: string; count: number };
type Month = { month: string; monthNumber: number; received: number; fidelized: number; withoutLocalChurch?: number; fidelityRate?: number | null; selected: boolean };
type Plan = { monthlyGuestTarget: string; observation: string; challenge: string; action: string; owner: string; dueDate: string };
type Props = {
  periodLabel: string; year: number; totals: Totals; families: Family[];
  monthlyTrend: Month[]; targetTotal: number | null; plan: Plan;
  planLoading: boolean; planError?: string;
  selectedMonths?: number[];
  onSelectMonths?: (months: number[]) => void;
  initialMonths?: number[];
  onClose: () => void;
};
type Slide = { id: string; label: string; chapter: string; familyPage?: number };
const MONTH_NAMES = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
];
const MONTH_SHORT = [
  "Jan", "Fév", "Mar", "Avr", "Mai", "Juin",
  "Juil", "Août", "Sept", "Oct", "Nov", "Déc"
];
const EASE = [0.22, 1, 0.36, 1] as const;
const FAMILIES_PER_SLIDE = 6;
const EMPTY_MONTHS: number[] = [];
const count = (value: number) => new Intl.NumberFormat("fr-BE").format(value);
const quantity = (value: number, singular: string, plural = `${singular}s`) => `${count(value)} ${value === 1 ? singular : plural}`;
const rate = (value: number, total: number) => total > 0
  ? new Intl.NumberFormat("fr-BE", { style: "percent", maximumFractionDigits: 1 }).format(value / total)
  : "—";
const percentage = (value: number, total: number) => total > 0 ? Math.min(100, Math.max(0, value / total * 100)) : 0;
const fullMonth = (year: number, month: number) => new Intl.DateTimeFormat("fr-BE", { month: "long" }).format(new Date(year, month - 1, 1));
function displayDate(value: string) {
  if (!value) return "À définir";
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("fr-BE", { day: "numeric", month: "long", year: "numeric" }).format(date);
}

function computeTrendScaleMax(highest: number): number {
  if (highest <= 0) return 10;
  // Réserve au moins 25% de marge libre au-dessus de la plus haute barre (remplissage max <= 75%)
  // Cela garantit de manière universelle que le chiffre du volume ne chevauche JAMAIS le badge de fidélisation au-dessus.
  const needed = highest / 0.75;
  const steps = [
    5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 80, 100,
    120, 150, 200, 250, 300, 400, 500, 750, 1000
  ];
  for (const step of steps) {
    if (step >= needed) return step;
  }
  const mag = Math.pow(10, Math.floor(Math.log10(needed)));
  return Math.ceil(needed / mag) * mag;
}

function Heading({ step, title, children }: { step: string; title: string; children: ReactNode }) {
  return <header className={styles.slideHeading}>
    <div className={styles.headingTop}><span className={styles.eyebrow}>{step}</span><span className={styles.headingLine} /></div>
    <h1>{title}</h1><p>{children}</p>
  </header>;
}

function Takeaway({ children, label = "À retenir" }: { children: ReactNode; label?: string }) {
  return <aside className={styles.takeaway}><span>{label}</span><p>{children}</p><ArrowRight size={19} aria-hidden="true" /></aside>;
}

function SourceLabel({ saved }: { saved: boolean }) {
  return <span className={`${styles.sourceLabel} ${saved ? styles.savedLabel : ""}`}>{saved ? "Renseigné par l’équipe" : "Proposition à valider"}</span>;
}

// Suggestions stay in the presentation; only the team's saved plan is authoritative.
function suggestedPriority(t: Totals) {
  if (t.guestsReceived === 0) return {
    challenge: "Vérifier la saisie des arrivées avant de conclure sur l’activité de la période.",
    action: "Confirmer les fiches d’accueil avec l’équipe, compléter les éventuelles arrivées manquantes puis préparer le prochain accueil.",
  };
  const uninitiated = t.uninitiatedCalls ?? t.guestsWithoutNextStep;
  const awaitingAssign = t.awaitingAssignment ?? 0;
  const awaitingContact = t.awaitingContact ?? 0;
  if (uninitiated > 0 && awaitingAssign === 0 && awaitingContact === 0) return {
    challenge: `Clarifier la prochaine étape de ${quantity(uninitiated, "dossier")} signalé${uninitiated === 1 ? "" : "s"} dans le suivi.`,
    action: "Revoir les dossiers avec les conseillers, confirmer le contact établi et renseigner la prochaine étape convenue avec chaque personne.",
  };
  if (uninitiated > 0) {
    let challenge = "";
    if (awaitingAssign > 0 && awaitingContact > 0) {
      challenge = `Confirmer la prise en charge de ${quantity(uninitiated, "invité")} : ${quantity(awaitingAssign, "personne")} en attente de conseiller et ${quantity(awaitingContact, "personne")} en attente de confirmation du contact.`;
    } else if (awaitingContact > 0) {
      challenge = awaitingContact === 1
        ? "Confirmer le premier contact abouti pour l’invité déjà confié à un conseiller."
        : `Confirmer le premier contact abouti pour les ${quantity(awaitingContact, "invité")} déjà confiés à un conseiller.`;
    } else {
      challenge = awaitingAssign === 1
        ? "Confier l’invité en attente à un conseiller pour démarrer les appels."
        : `Confier les ${quantity(awaitingAssign, "invité")} en attente à des conseillers pour démarrer les appels.`;
    }
    return {
      challenge,
      action: "Vérifier l’attribution des dossiers, établir ou renouveler le contact avec les invités concernés, puis renseigner le résultat de l’échange et la prochaine étape.",
    };
  }
  if (t.guestsWithoutFamily > 0) return {
    challenge: `Clarifier l’orientation de ${quantity(t.guestsWithoutFamily, "invité")} sans famille renseignée, selon la situation et le souhait d’accompagnement de chacun.`,
    action: "Faire le point sur les invités sans famille renseignée ; proposer un rattachement aux personnes qui le souhaitent et actualiser leur fiche.",
  };
  if (t.guestsWithPhone < t.guestsReceived) return {
    challenge: `Compléter les coordonnées de ${quantity(t.guestsReceived - t.guestsWithPhone, "invité")} sans numéro enregistré, avec leur accord.`,
    action: "Confirmer les coordonnées lors du prochain échange et convenir du moyen de contact souhaité par chaque invité.",
  };
  return {
    challenge: "Confirmer que les prochaines étapes enregistrées se traduisent par des rencontres et un accompagnement effectif.",
    action: "Faire un point avec les conseillers sur les retours au culte, les liens avec les familles et l’orientation vers la formation ; actualiser les suivis.",
  };
}

function Meter({ value, total, teal = false }: { value: number; total: number; teal?: boolean }) {
  const reduceMotion = useReducedMotion();
  return <div className={`${styles.meter} ${teal ? styles.tealMeter : ""}`} aria-hidden="true">
    <motion.span initial={{ scaleX: reduceMotion ? 1 : 0 }} animate={{ scaleX: 1 }}
      transition={{ duration: reduceMotion ? 0 : .75, delay: .12, ease: EASE }} style={{ width: `${percentage(value, total)}%` }} />
  </div>;
}

function Ring({ value, total }: { value: number; total: number }) {
  const reduceMotion = useReducedMotion();
  return <div className={styles.ring}>
    <svg viewBox="0 0 240 240" aria-hidden="true">
      <circle className={styles.ringTrack} cx="120" cy="120" r="106" />
      <motion.circle className={styles.ringValue} cx="120" cy="120" r="106" pathLength="1"
        strokeOpacity={value > 0 && total > 0 ? 1 : 0}
        strokeDasharray="1" initial={{ strokeDashoffset: reduceMotion ? 1 - percentage(value, total) / 100 : 1 }}
        animate={{ strokeDashoffset: 1 - percentage(value, total) / 100 }}
        transition={{ duration: reduceMotion ? 0 : 1, ease: EASE, delay: .15 }} />
    </svg>
    <div><strong>{rate(value, total)}</strong><span>de fidélisation</span></div>
  </div>;
}

function isFullscreenActive(): boolean {
  if (typeof document === "undefined") return false;
  const doc = document as any;
  return Boolean(
    doc.fullscreenElement ||
    doc.webkitFullscreenElement ||
    doc.mozFullScreenElement ||
    doc.msFullscreenElement
  );
}

async function requestNativeFullscreen(): Promise<boolean> {
  if (typeof document === "undefined") return false;
  const docEl = document.documentElement as any;
  try {
    if (docEl.requestFullscreen) {
      await docEl.requestFullscreen();
      return true;
    } else if (docEl.webkitRequestFullscreen) {
      docEl.webkitRequestFullscreen();
      return true;
    } else if (docEl.mozRequestFullScreen) {
      docEl.mozRequestFullScreen();
      return true;
    } else if (docEl.msRequestFullscreen) {
      docEl.msRequestFullscreen();
      return true;
    }
  } catch {
    // Native fullscreen API restricted by browser/iframe; windowed fullscreen remains active
  }
  return false;
}

async function exitFullscreen(): Promise<void> {
  if (typeof document === "undefined") return;
  const doc = document as any;
  try {
    if (doc.exitFullscreen) {
      await doc.exitFullscreen();
    } else if (doc.webkitExitFullscreen) {
      doc.webkitExitFullscreen();
    } else if (doc.mozCancelFullScreen) {
      doc.mozCancelFullScreen();
    } else if (doc.msExitFullscreen) {
      doc.msExitFullscreen();
    }
  } catch {
    // ignore
  }
}

function SlideContent({ slide, data }: { slide: Slide; data: Props }) {
  const { totals: t, families, periodLabel, year, monthlyTrend, plan, planLoading, planError, targetTotal } = data;
  const familyTotal = families.reduce((sum, family) => sum + family.count, 0);
  const familyPages = Math.max(1, Math.ceil(families.length / FAMILIES_PER_SLIDE));
  const planUnavailable = planLoading || Boolean(planError);
  const status = planLoading ? "Chargement du plan d’action…" : "Le plan d’action est indisponible. Fermez la présentation pour réessayer depuis le bilan.";
  const priority = suggestedPriority(t);
  const noGuests = t.guestsReceived === 0;
  const missingPhone = Math.max(0, t.guestsReceived - t.guestsWithPhone);
  const observation = noGuests
    ? "Aucune arrivée n’est enregistrée pour la période sélectionnée. Cela ne permet pas, à lui seul, de conclure à une absence d’accueil."
    : `${quantity(t.guestsReceived, "invité accueilli", "invités accueillis")}, ${quantity(t.callsReached, "appel abouti", "appels aboutis")} et ${quantity(t.returnedToChurch, "retour au culte", "retours au culte")}. Une famille est renseignée pour ${quantity(familyTotal, "invité")}.`;

  switch (slide.id) {
    case "cover": return <div className={styles.cover}>
      <div className={styles.coverText}>
        <span className={styles.eyebrow}>Conseil pastoral · Département de l’Intégration</span>
        <div className={styles.coverRule} />
        <h1>Bilan de<br />l’intégration<span>.</span></h1>
        <p className={styles.coverSubtitle}>De la première rencontre<br />à une place dans l’église.</p>
        <div className={styles.period}><CalendarDays size={18} /><span>{periodLabel}</span></div>
        <div className={styles.mission}><span>Accueillir</span><i /><span>Orienter</span><i /><span>Accompagner</span></div>
      </div>
      <div className={styles.coverSnapshot}>
        <span className={styles.eyebrow}>La période en un regard</span>
        <div className={styles.coverMainMetric}><strong>{count(t.guestsReceived)}</strong><span>invité{t.guestsReceived === 1 ? "" : "s"}<br />accueilli{t.guestsReceived === 1 ? "" : "s"}</span></div>
        <div className={styles.coverSupporting}>
          <div><strong>{count(t.callsReached)}</strong><span>appels aboutis</span></div>
          <div><strong>{count(familyTotal)}</strong><span>rattachés à une famille</span></div>
        </div>
        <p>Comprendre l’accueil.<br />Éclairer les prochaines étapes.</p>
        <span className={styles.coverEdition}>CONSEIL PASTORAL <span>{year}</span></span>
      </div>
    </div>;

    case "welcome": return <>
      <Heading step="01 / Accueil & contact" title="Accueil et prise de contact.">{noGuests ? "Aucune arrivée enregistrée sur la période sélectionnée." : <><strong>{quantity(t.callsReached, "appel abouti", "appels aboutis")}</strong> pour {quantity(t.guestsReceived, "invité accueilli", "invités accueillis")}. Le premier lien se construit ici.</>}</Heading>
      <div className={styles.welcomeGrid}>
        <article className={styles.heroMetric}><Users size={26} /><span>Invités reçus</span><strong>{count(t.guestsReceived)}</strong><p>{periodLabel}<br />Selon la date d’arrivée</p></article>
        <div className={styles.contactPanel}>
          <article className={styles.contactRow}><span className={styles.stepNumber}>01</span><div><h2>Numéro recueilli</h2><p>{rate(t.guestsWithPhone, t.guestsReceived)} des invités ont un numéro enregistré.</p><Meter value={t.guestsWithPhone} total={t.guestsReceived} /></div><strong>{count(t.guestsWithPhone)}</strong></article>
          <article className={styles.contactRow}><span className={styles.stepNumber}>02</span><div><h2>Appel abouti</h2><p>{rate(t.callsReached, t.guestsWithPhone)} parmi les invités avec un numéro.</p><Meter value={t.callsReached} total={t.guestsWithPhone} teal /></div><strong>{count(t.callsReached)}</strong></article>
          <div className={styles.contactUnreachedGroup}>
            <div className={styles.contactNote}><PhoneOff size={16} /><span>Numéros erronés ou non attribués</span><strong>{count(t.wrongNumbers)}</strong></div>
            <div className={styles.contactNote}><PhoneForwarded size={16} /><span>Ne décroche pas suite à plusieurs relances</span><strong>{count(t.noAnswer)}</strong></div>
          </div>
        </div>
      </div>
      <Takeaway>{noGuests ? "Confirmer la saisie des arrivées avant d’interpréter les indicateurs de contact." : missingPhone > 0 ? <><strong>{quantity(missingPhone, "invité")} sans numéro enregistré.</strong> Compléter les coordonnées avec leur accord facilite le premier échange.</> : <>Un numéro est renseigné pour chaque invité. <strong>La qualité du premier échange et la suite proposée restent à suivre.</strong></>}</Takeaway>
      <p className={styles.footnote}>Le taux d’appels aboutis est rapporté aux fiches avec numéro, et non au nombre de tentatives.</p>
    </>;

    case "orientation": return <>
      <Heading step="02 / Situation spirituelle" title="Profil & situation spirituelle.">{noGuests ? "Aucun profil à analyser pour cette période." : <><strong>{quantity(t.withoutLocalChurch, "invité")} sans église locale déclarée.</strong> Adapter l’accompagnement à la situation de chacun.</>}</Heading>
      <div className={styles.orientationGrid}>
        <div className={styles.churchPanel}>
          <Church size={25} className={styles.accentIcon} />
          <div className={styles.churchFigures}>
            <article><strong>{count(t.withLocalChurch)}</strong><h2>Avec une église locale</h2><p>{rate(t.withLocalChurch, t.guestsReceived)} des invités reçus</p></article>
            <article><strong>{count(t.withoutLocalChurch)}</strong><h2>Sans église locale</h2><p>{rate(t.withoutLocalChurch, t.guestsReceived)} des invités reçus</p></article>
          </div>
          <div className={styles.churchSplit} aria-hidden="true"><span style={{ flex: t.withLocalChurch || 0 }} /><span style={{ flex: t.withoutLocalChurch || 0 }} /></div>
          <p className={styles.footnote}>« Sans église locale » inclut les fiches sans réponse positive à cette question.</p>
        </div>
        <article className={styles.salvationPanel}><HeartHandshake size={27} /><span>Engagement de foi</span><strong>{count(t.salvationPrayer)}</strong><h2>Prière du salut faite</h2><p>Invités ayant déclaré avoir fait la prière du salut lors du culte.</p></article>
      </div>
      <Takeaway>Confirmer la situation lors du premier échange et proposer un accompagnement respectueux du parcours de chaque invité.</Takeaway>
    </>;

    case "integration": return <>
      <Heading step="03 / Parcours d’intégration" title="Étapes d’enracinement dans l’église.">Trois signes d’engagement à suivre : revenir, vivre la communion fraternelle et se former.</Heading>
      <div className={styles.journeyGrid}>
        {[
          { title: t.returnedToChurch <= 1 ? "Revenu au culte" : "Revenus au culte", value: t.returnedToChurch, detail: "Retour déclaré ou présence au culte", icon: RotateCcw },
          { title: t.integratedCdm <= 1 ? "Intégré en C.D.M." : "Intégrés en C.D.M.", value: t.integratedCdm, detail: "Participation active à une cellule de maison", icon: Users },
          { title: t.pcnc <= 1 ? "Inscrit au P.C.N.C." : "Inscrits au P.C.N.C.", value: t.pcnc, detail: "Inscrits ou intéressés par la formation des nouveaux disciples", icon: HeartHandshake },
        ].map((item, index) => <article key={index} className={styles.journeyCard}>
          <div className={styles.journeyCardTop}><item.icon size={24} /><span>0{index + 1}</span></div>
          <strong>{count(item.value)}</strong><h2>{item.title}</h2><p>{item.detail}</p><span className={styles.metricShare}>{rate(item.value, t.guestsReceived)} des invités reçus</span>
        </article>)}
      </div>
      <div className={styles.familyBridge}><span><Users size={20} /> Rattachés à une famille de disciples</span><strong>{count(familyTotal)} <small>{familyTotal === 1 ? "invité rattaché" : "invités rattachés"}</small></strong></div>
      <p className={styles.footnote}>Ces indicateurs se recoupent : ils ne s’additionnent pas. Le P.C.N.C. inclut l’intérêt pour une formation, sans inscription nécessairement confirmée.</p>
    </>;

    case "loyalty": {
      const uninitiated = t.uninitiatedCalls ?? t.guestsWithoutNextStep;
      const awaitingAssign = t.awaitingAssignment ?? 0;
      const awaitingContact = t.awaitingContact ?? 0;
      const isClear = uninitiated === 0;

      let explanationSentence = "";
      if (noGuests) {
        explanationSentence = "Aucun invité n’a été enregistré sur la période sélectionnée.";
      } else if (isClear) {
        explanationSentence = "Aucun dossier n’est signalé dans cet indicateur de prise en charge. Les dossiers conservés, sans suite ou au suivi terminé sont exclus du décompte.";
      } else if (awaitingAssign > 0 && awaitingContact > 0) {
        explanationSentence = `${quantity(awaitingAssign, "invité")} en attente de conseiller ; ${quantity(awaitingContact, "invité")} déjà attribué${awaitingContact === 1 ? "" : "s"}, avec un contact abouti restant à confirmer.`;
      } else if (awaitingContact > 0) {
        explanationSentence = awaitingContact === 1
          ? "Cet invité est confié à un conseiller. Le suivi ne confirme pas encore un contact téléphonique abouti ; des tentatives peuvent déjà avoir eu lieu."
          : `Ces ${quantity(awaitingContact, "invité")} ont un conseiller. Un contact abouti reste à confirmer dans leur suivi ; des tentatives peuvent déjà avoir eu lieu.`;
      } else if (awaitingAssign === 0) {
        explanationSentence = "La prochaine étape de ces dossiers reste à clarifier avec l’équipe ; le détail de leur attribution n’est pas disponible ici.";
      } else {
        explanationSentence = awaitingAssign === 1
          ? "Cet invité n’a pas encore été confié à un conseiller pour démarrer la prise de contact."
          : `Ces ${quantity(awaitingAssign, "invité")} n’ont pas encore de conseiller renseigné pour la prise de contact.`;
      }

      const adviceSentence = noGuests
        ? "Les indicateurs s’actualiseront dès l'enregistrement des prochaines fiches d'accueil."
        : isClear
          ? "Poursuivre l’accompagnement et confirmer la réalisation des prochaines étapes enregistrées."
          : "Faire le point avec les conseillers sur les tentatives, le résultat du contact et la suite à proposer.";

      return <>
        <Heading step="05 / Fidélisation & suivi" title="Fidélisation & accompagnement continu.">{t.withoutLocalChurch > 0 ? <>Le critère de fidélisation est rempli pour <strong>{count(t.fidelizedWithoutLocalChurch)} des {quantity(t.withoutLocalChurch, "invité")}</strong> sans église locale.</> : "Aucun invité sans église locale : le taux de fidélisation ne peut pas être calculé."}</Heading>
        <div className={styles.loyaltyGrid}>
          <article className={styles.loyaltyPanel}><Ring value={t.fidelizedWithoutLocalChurch} total={t.withoutLocalChurch} /><div><span className={styles.eyebrow}>Invités sans église locale</span><h2><strong>{count(t.fidelizedWithoutLocalChurch)}</strong> sur {count(t.withoutLocalChurch)}</h2><p>Retour au culte enregistré<br />ou suivi marqué « terminé ».</p><span className={styles.metricShare}>Base de calcul : {count(t.withoutLocalChurch)} personne(s)</span></div></article>
          <article className={`${styles.followUpPanel} ${isClear ? styles.followUpClear : ""}`}>
            <span className={styles.eyebrow}>Points de vigilance</span>
            <strong>{count(uninitiated)}</strong>
            <h2>Appels non entamés</h2>
            <p>{rate(uninitiated, t.guestsReceived)} de l’ensemble des invités reçus.</p>
            <p className={styles.followUpText}>{explanationSentence}</p>
            <div className={styles.followUpNote}>{adviceSentence}</div>
          </article>
        </div>
        <p className={styles.footnote}>Fidélisation : invités sans église locale déclarée. Vigilance : attribution ou contact abouti à confirmer ; cet indicateur ne mesure pas le nombre de tentatives d’appel.</p>
      </>;
    }

    case "trend": {
      const rawMax = Math.max(...monthlyTrend.map(month => month.received), 0);
      const max = computeTrendScaleMax(rawMax);
      const annualReceived = monthlyTrend.reduce((sum, month) => sum + month.received, 0);
      const today = new Date();
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth() + 1;
      return <>
        <Heading step={`06 / Évolution · ${year}`} title="Dynamique annuelle de l’accueil."><strong>{count(annualReceived)} accueils enregistrés en {year}</strong>, dont {count(t.guestsReceived)} sur la période sélectionnée.</Heading>
        <div className={styles.chartPanel}>
          <div className={styles.chartHeader}>
            <div className={styles.chartLegend}>
              <span><i /> Invités reçus (volume)</span>
              <span className={styles.chartLegendTeal}><i /> Taux de fidélisation (%)</span>
            </div>
            <span className={styles.chartSelection}>Fond doré · période sélectionnée</span>
          </div>
          <div className={styles.chartScroll} tabIndex={0} role="region" aria-label={`Évolution mensuelle en ${year}`}>
            <div className={styles.chartScale} aria-hidden="true"><span>{count(max)}</span><span>{count(Math.round(max / 2))}</span><span>0</span></div>
            <div className={styles.chart} role="list">
              {monthlyTrend.map(month => {
                const future = (year > currentYear || (year === currentYear && month.monthNumber > currentMonth)) && month.received === 0 && month.fidelized === 0;
                const ongoing = year === currentYear && month.monthNumber === currentMonth;
                const fidelityRate = typeof month.fidelityRate === "number" && Number.isFinite(month.fidelityRate)
                  ? month.fidelityRate
                  : month.withoutLocalChurch && month.withoutLocalChurch > 0 ? month.fidelized / month.withoutLocalChurch * 100 : null;
                const rateText = future || fidelityRate === null ? "—" : rate(fidelityRate, 100);
                return <div key={month.monthNumber} className={`${styles.chartMonth} ${month.selected ? styles.selectedMonth : ""} ${future ? styles.futureMonth : ""}`} role="listitem" aria-label={`${fullMonth(year, month.monthNumber)} : ${future ? "à venir" : `${count(month.received)} invités reçus, taux de fidélisation : ${rateText}`}${ongoing ? ", mois en cours" : ""}${month.selected ? ", mois sélectionné" : ""}`}>
                  <div className={`${styles.fidelityRateBadge} ${future || fidelityRate === null ? styles.fidelityRateEmpty : ""}`} title={future ? "Mois à venir" : fidelityRate !== null ? `Taux de fidélisation : ${rateText}` : "Taux non calculable : base absente ou nulle"}>
                    {rateText}
                  </div>
                  <div className={styles.chartBars} aria-hidden="true">
                    <div className={styles.barColumn}><div className={styles.barSpace}><span style={{ height: `${month.received / max * 100}%` }}><strong>{future ? "—" : count(month.received)}</strong></span></div></div>
                  </div>
                  <span className={styles.monthName}>{MONTH_SHORT[month.monthNumber - 1]}</span><span className={styles.monthStatus}>{future ? "À venir" : ongoing ? "En cours" : ""}</span>
                </div>;
              })}
            </div>
          </div>
        </div>
        <p className={styles.footnote}>Le pourcentage indique la proportion d’invités sans église locale fidélisés. Les résultats sont rattachés au mois d’arrivée et continuent d’évoluer au fil des accompagnements.</p>
      </>;
    }

    case "insights": return <>
      <Heading step="07 / Lecture du bilan" title="Constats clés & défis majeurs.">Passer des chiffres à une priorité d’accompagnement pour l’équipe.</Heading>
      {planUnavailable ? <div className={styles.status} role="status">{status}</div> : <div className={styles.insightsGrid}>
        <article className={styles.insightCard}><div className={styles.insightTop}><span className={styles.noteNumber}>01</span><span className={styles.sourceLabel}>{plan.observation.trim() ? "Renseigné par l’équipe" : "Lecture des indicateurs"}</span></div><h2>Constat principal</h2><p>{plan.observation.trim() || observation}</p><div className={styles.evidenceStrip}><div><strong>{rate(t.guestsWithPhone, t.guestsReceived)}</strong><span>avec un numéro</span></div><div><strong>{rate(familyTotal, t.guestsReceived)}</strong><span>avec une famille</span></div></div></article>
        <article className={`${styles.insightCard} ${styles.challengeCard}`}><div className={styles.insightTop}><span className={styles.noteNumber}>02</span><SourceLabel saved={Boolean(plan.challenge.trim())} /></div><h2>Défi prioritaire</h2><p>{plan.challenge.trim() || priority.challenge}</p><div className={styles.insightPrompt}>À discuter au conseil : quelle prochaine étape concrète pouvons-nous faciliter ?</div></article>
      </div>}
      {!planUnavailable && <p className={styles.footnote}>Les propositions s’appuient sur les indicateurs de la période. Elles sont à discuter avec l’équipe et ne modifient pas le plan enregistré.</p>}
    </>;

    case "action": return <>
      <Heading step="08 / Plan d’action" title="Plan d’action opérationnel.">Une action précise, un responsable et une échéance pour faire avancer l’accompagnement.</Heading>
      {planUnavailable ? <div className={styles.status} role="status">{status}</div> : <div className={styles.actionGrid}>
        <article className={styles.objectivePanel}><Target size={27} /><span>Objectif d’accueil</span><strong className={targetTotal === null ? styles.undefinedTarget : undefined}>{targetTotal === null ? "À définir" : count(targetTotal)}</strong><p>{targetTotal === null ? "Fixer ensemble un objectif réaliste pour la période." : `${plan.monthlyGuestTarget} invité(s) par mois × ${data.selectedMonths?.length || monthlyTrend.filter(month => month.selected).length} mois sélectionné(s).`}</p>{targetTotal !== null && <><Meter value={t.guestsReceived} total={targetTotal} /><small>{count(t.guestsReceived)} reçu(s) · {targetTotal > 0 ? `${rate(t.guestsReceived, targetTotal)} de l’objectif` : "objectif fixé à zéro"}</small></>}</article>
        <article className={styles.actionPanel}><div className={styles.actionHeader}><span className={styles.eyebrow}>Action prioritaire</span><SourceLabel saved={Boolean(plan.action.trim())} /></div><p className={styles.actionText}>{plan.action.trim() || priority.action}</p><dl><div><dt>Responsable</dt><dd>{plan.owner.trim() || "À définir au conseil"}</dd></div><div><dt>Échéance</dt><dd>{displayDate(plan.dueDate)}</dd></div></dl></article>
      </div>}
      {!planUnavailable && <Takeaway label="À décider">{!plan.action.trim() ? "Valider ou adapter cette proposition, puis désigner un responsable et fixer une date de suivi." : !plan.owner.trim() || !plan.dueDate || targetTotal === null ? "Compléter les engagements encore à définir avant de partager le plan avec l’équipe." : "Confirmer les engagements avec l’équipe et convenir du prochain point d’avancement."}</Takeaway>}
    </>;

    case "closing": return <div className={styles.closing}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/equipe-integration.jpg"
        alt="L’équipe des conseillers du département de l’Intégration"
        className={styles.closingBackground}
        loading="eager"
      />
      <div className={styles.closingText}>
        <span className={styles.eyebrow}>Conseil pastoral · Département de l’Intégration</span>
        <div className={styles.coverRule} />
        <h1>Le département<br />de l’Intégration<br />vous remercie<span>.</span></h1>
        <p className={styles.closingSubtitle}>
          Pour votre confiance, vos prières et votre soutien.<br />Ensemble, donnons à chaque personne accueillie une place et un accompagnement.
        </p>
        <div className={styles.period}><CalendarDays size={18} /><span>{periodLabel}</span></div>
        <div className={styles.mission}><span>Accueillir</span><i /><span>Orienter</span><i /><span>Accompagner</span></div>
      </div>
      <div className={styles.closingPhotoCaption}>
        <HeartHandshake size={15} />
        <span>L’équipe des conseillers & serviteurs de l’Intégration</span>
      </div>
    </div>;

    default: {
      const page = slide.familyPage ?? 0;
      const visibleFamilies = families.slice(page * FAMILIES_PER_SLIDE, (page + 1) * FAMILIES_PER_SLIDE);
      return <>
        <Heading step={`04 / Familles de disciples${familyPages > 1 ? ` · ${page + 1}/${familyPages}` : ""}`} title="Répartition par famille de disciples.">{noGuests ? "Aucun rattachement à analyser pour cette période." : <><strong>{quantity(familyTotal, "invité")} avec une famille renseignée</strong> ; {count(t.guestsWithoutFamily)} sans famille renseignée.</>}</Heading>
        <div className={styles.familiesGrid}>
          <aside className={styles.familySummary}><Users size={26} /><strong>{count(familyTotal)}</strong><h2>Invités rattachés<br />à une famille</h2><div><b>{count(t.guestsWithoutFamily)}</b><span>sans famille affectée</span></div></aside>
          <div className={styles.familyList}>
            <div className={styles.familyListHeader}><span>Famille de disciples</span><span>Invités</span></div>
            {visibleFamilies.length ? visibleFamilies.map((family, index) => <div className={styles.familyRow} key={family.name}><span className={styles.familyRank}>{String(page * FAMILIES_PER_SLIDE + index + 1).padStart(2, "0")}</span><div className={styles.familyRowContent}><div><span>{family.name}</span><strong>{count(family.count)}</strong></div><Meter value={family.count} total={Math.max(1, ...families.map(item => item.count))} /></div></div>) : <p className={styles.footnote}>Aucune famille enregistrée pour cette église.</p>}
          </div>
        </div>
        <p className={styles.footnote}>Famille actuellement indiquée sur la fiche : le rattachement ne confirme pas à lui seul une participation. Les familles à zéro sont conservées.{familyPages > 1 ? ` · Familles ${page * FAMILIES_PER_SLIDE + 1} à ${Math.min((page + 1) * FAMILIES_PER_SLIDE, families.length)} sur ${families.length}.` : ""}</p>
      </>;
    }
  }
}

export default function IntegrationPresentation(props: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [navigation, setNavigation] = useState({ index: 0, direction: 1 });
  const [theme, setTheme] = useState(() => typeof document !== "undefined" && document.documentElement.dataset.theme === "light" ? "light" : "dark");
  const [fullscreen, setFullscreen] = useState(isFullscreenActive);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterMode, setFilterMode] = useState<"single" | "multi">((props.selectedMonths?.length ?? 0) > 1 ? "multi" : "single");

  const reduceMotion = useReducedMotion();
  const familyPages = Math.max(1, Math.ceil(props.families.length / FAMILIES_PER_SLIDE));
  const slides: Slide[] = [
    { id: "cover", label: "Bilan de l’intégration", chapter: "Introduction" },
    { id: "welcome", label: "Accueil & prise de contact", chapter: "Accueil" },
    { id: "orientation", label: "Situation & profil spirituel", chapter: "Orientation" },
    { id: "integration", label: "Parcours d’intégration", chapter: "Intégration" },
    ...Array.from({ length: familyPages }, (_, index) => ({ id: `families-${index}`, label: `Familles de disciples${familyPages > 1 ? ` · ${index + 1}/${familyPages}` : ""}`, chapter: "Familles", familyPage: index })),
    { id: "loyalty", label: "Fidélisation & suivi", chapter: "Fidélisation" },
    { id: "trend", label: "Évolution annuelle", chapter: "Tendances" },
    { id: "insights", label: "Constats & défis", chapter: "Analyse" },
    { id: "action", label: "Plan d’action", chapter: "Décisions" },
    { id: "closing", label: "Remerciements", chapter: "Clôture" },
  ];
  const slideCount = slides.length;
  const index = Math.min(navigation.index, slideCount - 1);
  const current = slides[index];

  const currentMonths = props.selectedMonths ?? EMPTY_MONTHS;
  const initialMonths = props.initialMonths ?? EMPTY_MONTHS;
  const sortedMonths = [...currentMonths].sort((a, b) => a - b);
  const selectedPeriod = sortedMonths.length === 12 ? "Toute l’année"
    : sortedMonths.length === 0 ? "Aucun mois sélectionné"
    : new Intl.ListFormat("fr", { style: "long", type: "conjunction" }).format(sortedMonths.map(month => MONTH_NAMES[month - 1]));
  const selectedGuests = props.monthlyTrend.reduce((total, month) => total + (currentMonths.includes(month.monthNumber) ? month.received : 0), 0);
  const canReset = initialMonths.length > 0 && (
    initialMonths.length !== currentMonths.length ||
    !initialMonths.every(m => currentMonths.includes(m))
  );

  const handleMonthClick = useCallback((monthNum: number) => {
    if (!props.onSelectMonths) return;
    if (filterMode === "single") {
      props.onSelectMonths([monthNum]);
    } else {
      if (currentMonths.includes(monthNum)) {
        if (currentMonths.length > 1) {
          props.onSelectMonths(currentMonths.filter(m => m !== monthNum));
        }
      } else {
        props.onSelectMonths([...currentMonths, monthNum].sort((a, b) => a - b));
      }
    }
  }, [currentMonths, filterMode, props]);

  const handleResetInitial = useCallback(() => {
    if (props.onSelectMonths && initialMonths.length > 0) {
      props.onSelectMonths(initialMonths);
      setFilterMode(initialMonths.length > 1 ? "multi" : "single");
    }
  }, [initialMonths, props]);

  const handleSelectAllYear = useCallback(() => {
    if (props.onSelectMonths) {
      setFilterMode("multi");
      props.onSelectMonths([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    }
  }, [props]);

  const navigate = useCallback((target: number | "next" | "previous") => {
    setNavigation(previous => {
      const next = Math.max(0, Math.min(slideCount - 1, typeof target === "number" ? target : previous.index + (target === "next" ? 1 : -1)));
      return next === previous.index ? previous : { index: next, direction: next > previous.index ? 1 : -1 };
    });
  }, [slideCount]);

  const toggleFullscreen = useCallback(async () => {
    if (isFullscreenActive()) {
      await exitFullscreen();
      setFullscreen(false);
    } else {
      const ok = await requestNativeFullscreen();
      if (!ok) {
        // Fallback doux : la vue est déjà à 100vw × 100dvh
        setFullscreen(prev => !prev);
      }
    }
  }, []);

  const handleClose = useCallback(() => {
    if (isFullscreenActive()) {
      void exitFullscreen().catch(() => undefined);
    }
    props.onClose();
  }, [props]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";

    const syncFullscreen = () => setFullscreen(isFullscreenActive());
    document.addEventListener("fullscreenchange", syncFullscreen);
    document.addEventListener("webkitfullscreenchange", syncFullscreen);
    document.addEventListener("mozfullscreenchange", syncFullscreen);
    document.addEventListener("msfullscreenchange", syncFullscreen);

    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreen);
      document.removeEventListener("webkitfullscreenchange", syncFullscreen);
      document.removeEventListener("mozfullscreenchange", syncFullscreen);
      document.removeEventListener("msfullscreenchange", syncFullscreen);
      if (isFullscreenActive()) {
        void exitFullscreen().catch(() => undefined);
      }
      dialog.close();
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (event.altKey || event.ctrlKey || event.metaKey || target.matches("input, textarea, select") || target.isContentEditable) return;
      if (event.key === "m" || event.key === "M" || event.key === "p" || event.key === "P") {
        event.preventDefault();
        setIsFilterOpen(prev => !prev);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        if (isFilterOpen) {
          setIsFilterOpen(false);
          return;
        }
        if (isFullscreenActive()) {
          void exitFullscreen().catch(() => undefined);
        } else {
          handleClose();
        }
        return;
      }
      if (isFilterOpen) return;
      if (event.key === "ArrowRight" || event.key === "PageDown" || (event.key === " " && !target.closest("button"))) {
        event.preventDefault(); navigate("next");
      } else if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault(); navigate("previous");
      } else if (event.key === "Home" || event.key === "End") {
        event.preventDefault(); navigate(event.key === "Home" ? 0 : slideCount - 1);
      } else if (event.key === "f" || event.key === "F") {
        event.preventDefault();
        void toggleFullscreen();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleClose, isFilterOpen, navigate, slideCount, toggleFullscreen]);

  return createPortal(<dialog ref={dialogRef} className={styles.presentation} data-presentation-theme={theme}
    aria-label="Présentation du bilan de l’intégration" onCancel={event => {
      event.preventDefault();
      if (isFullscreenActive()) {
        void exitFullscreen().catch(() => undefined);
      } else {
        handleClose();
      }
    }}>
    <header className={styles.toolbar}>
      <div className={styles.brand}><span className={styles.brandMark}><Church size={19} /></span><div><strong>INTÉGRATION</strong><span>Conseil pastoral</span></div></div>
      <button
        type="button"
        className={`${styles.toolbarPeriodBtn} ${isFilterOpen ? styles.toolbarPeriodBtnActive : ""}`}
        onClick={() => setIsFilterOpen(open => !open)}
        title="Changer de mois · Raccourci M"
        aria-label={`Période actuelle : ${props.periodLabel}. Cliquer pour filtrer.`}
        aria-expanded={isFilterOpen}
      >
        <CalendarDays size={14} className={styles.periodIcon} />
        <span>{props.periodLabel}</span>
        <SlidersHorizontal size={13} className={styles.periodChevron} />
      </button>
      <div className={styles.tools}>
        <button
          type="button"
          className={isFilterOpen ? styles.toolBtnActive : ""}
          onClick={() => setIsFilterOpen(open => !open)}
          aria-label="Filtrer la période (Touche M)"
          title="Filtrer la période · M"
          aria-expanded={isFilterOpen}
        >
          <SlidersHorizontal size={18} />
        </button>
        <button type="button" onClick={() => setTheme(value => value === "dark" ? "light" : "dark")} aria-label={theme === "dark" ? "Passer la présentation en clair" : "Passer la présentation en sombre"} title={theme === "dark" ? "Mode clair" : "Mode sombre"}>{theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}</button>
        <button type="button" onClick={() => void toggleFullscreen()} aria-label={fullscreen ? "Quitter le plein écran (Échap ou F)" : "Afficher en plein écran (F)"} title={fullscreen ? "Quitter le plein écran (Échap ou F)" : "Plein écran (F)"}>{fullscreen ? <Minimize size={18} /> : <Maximize size={18} />}</button>
        <button type="button" onClick={handleClose} aria-label="Fermer la présentation (Échap)" title="Fermer · Échap" autoFocus><X size={20} /></button>
      </div>
    </header>

    <AnimatePresence>
      {isFilterOpen && (
        <motion.div
          className={styles.floatingFilterBackdrop}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          onClick={() => setIsFilterOpen(false)}
        >
          <motion.div
            className={styles.floatingFilterCard}
            initial={{ opacity: 0, scale: 0.95, y: -16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -16 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-labelledby="period-filter-title"
            aria-describedby="period-filter-description"
          >
            <div className={styles.filterCardHeader}>
              <div className={styles.filterCardTitleGroup}>
                <div className={styles.filterCardIconBadge}><SlidersHorizontal size={15} /></div>
                <div>
                  <h3 id="period-filter-title" className={styles.filterCardTitle}>Période analysée · {props.year}</h3>
                  <p id="period-filter-description" className={styles.filterCardSubtitle}>Choisissez les mois à inclure dans votre bilan.</p>
                </div>
              </div>
              <div className={styles.filterHeaderActions}>
                <button
                  type="button"
                  className={styles.filterCloseBtn}
                  onClick={() => setIsFilterOpen(false)}
                  aria-label="Fermer le filtre"
                  title="Fermer · Échap"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className={styles.filterModeBar}>
              <div className={styles.filterModeButtons} role="group" aria-label="Type de sélection">
                <button
                  type="button"
                  className={filterMode === "single" ? styles.filterModeActive : ""}
                  aria-pressed={filterMode === "single"}
                  onClick={() => setFilterMode("single")}
                >
                  Un mois
                </button>
                <button
                  type="button"
                  className={filterMode === "multi" ? styles.filterModeActive : ""}
                  aria-pressed={filterMode === "multi"}
                  onClick={() => setFilterMode("multi")}
                >
                  Plusieurs mois
                </button>
              </div>
              <p className={styles.filterModeDescription}>{filterMode === "single" ? "Sélectionnez un mois pour un bilan détaillé." : "Sélectionnez plusieurs mois pour un bilan cumulé."}</p>
            </div>

            <div className={styles.filterCalendarHeader}>
              <span>Mois de l’année</span>
              <button type="button" className={styles.filterAllBtn} onClick={handleSelectAllYear} aria-pressed={currentMonths.length === 12}>Toute l’année</button>
            </div>
            <div className={styles.filterMonthGrid}>
              {MONTH_NAMES.map((name, idx) => {
                const monthNum = idx + 1;
                const isSelected = currentMonths.includes(monthNum);
                const trend = props.monthlyTrend.find(m => m.monthNumber === monthNum);
                const receivedCount = trend?.received ?? 0;
                return (
                  <button
                    key={monthNum}
                    type="button"
                    className={`${styles.filterMonthBtn} ${isSelected ? styles.filterMonthSelected : ""}`}
                    onClick={() => handleMonthClick(monthNum)}
                    aria-pressed={isSelected}
                    title={`${name} ${props.year} · ${trend ? quantity(receivedCount, "invité") : "Aucune donnée"}`}
                  >
                    {isSelected && <Check size={12} className={styles.filterMonthCheck} aria-hidden="true" />}
                    <span className={styles.filterMonthName}>{name}</span>
                    <span className={styles.filterMonthMeta}>
                      {trend ? quantity(receivedCount, "invité") : "—"}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className={styles.filterSelection} aria-live="polite" aria-atomic="true">
              <CalendarDays size={18} aria-hidden="true" />
              <div><span>Votre sélection</span><strong>{selectedPeriod}</strong></div>
              <span className={styles.filterSelectionCount}>{quantity(selectedGuests, "invité")}</span>
            </div>
            <div className={styles.filterCardFooter}>
                <button
                  type="button"
                  className={styles.filterResetBtn}
                  onClick={handleResetInitial}
                  disabled={!canReset}
                  title="Revenir à la sélection initiale du conseil"
                >
                  <RotateCcw size={13} />
                  <span>Réinitialiser</span>
                </button>
              <button
                type="button"
                className={styles.filterDoneBtn}
                onClick={() => setIsFilterOpen(false)}
              >
                Voir le bilan <ArrowRight size={16} aria-hidden="true" />
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    <div className={styles.stage} ref={stageRef} tabIndex={-1}>
      <AnimatePresence initial={false} mode="wait" custom={navigation.direction} onExitComplete={() => stageRef.current?.scrollTo(0, 0)}>
        <motion.section key={current.id} className={styles.slide} custom={navigation.direction}
          variants={{ enter: (direction: number) => ({ opacity: 0, x: reduceMotion ? 0 : direction * 32 }), visible: { opacity: 1, x: 0 }, exit: (direction: number) => ({ opacity: 0, x: reduceMotion ? 0 : direction * -20 }) }}
          initial="enter" animate="visible" exit="exit"
          transition={{ duration: reduceMotion ? 0 : .38, ease: EASE }} aria-label={current.label}>
          <SlideContent slide={current} data={props} />
        </motion.section>
      </AnimatePresence>
    </div>
    <footer className={styles.controls}>
      <div className={styles.progress} aria-hidden="true"><motion.span animate={{ width: `${(index + 1) / slideCount * 100}%` }} transition={{ duration: reduceMotion ? 0 : .5, ease: EASE }} /></div>
      <div className={styles.slideInfo}><span className={styles.counter} aria-live="polite" aria-atomic="true">{String(index + 1).padStart(2, "0")} <small>/ {String(slideCount).padStart(2, "0")}</small><span className={styles.srOnly}> · {current.label}</span></span><div><span>{current.chapter}</span><strong>{current.label}</strong></div></div>
      <nav className={styles.slideNav} aria-label="Sommaire de la présentation">
        {slides.map((slide, slideIndex) => <button key={slide.id} type="button" aria-label={`${slideIndex + 1}. ${slide.label}`} title={slide.label} aria-current={index === slideIndex ? "step" : undefined} onClick={() => navigate(slideIndex)}><span /></button>)}
      </nav>
      <div className={styles.navigation}><button type="button" className={styles.previous} onClick={() => navigate("previous")} disabled={index === 0} aria-label="Diapositive précédente" title="Précédente · ←"><ArrowLeft size={19} /></button><button type="button" className={styles.next} onClick={() => navigate(index === slideCount - 1 ? 0 : "next")} aria-label={index === slideCount - 1 ? "Recommencer la présentation" : "Diapositive suivante"}><span>{index === slideCount - 1 ? "Revoir" : "Suivant"}</span>{index === slideCount - 1 ? <RotateCcw size={17} /> : <ArrowRight size={18} />}</button></div>
    </footer>
  </dialog>, document.body);
}
