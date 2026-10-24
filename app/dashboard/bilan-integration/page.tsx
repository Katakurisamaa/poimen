"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Activity, BarChart3, Check, Copy, FileChartColumnIncreasing, HeartHandshake, LoaderCircle, Phone, Play, RotateCw, Save, Target, Users } from "lucide-react";
import { getIntegrationMonthlyReportPlan, getIntegrationMonthlySummary, saveIntegrationMonthlyReportPlan } from "@/app/actions/auth";
import IntegrationSubNav from "@/components/integration/IntegrationSubNav";
import { getActiveContext, getActiveUserInfo } from "@/lib/client-session";
import { useWorkspace } from "@/lib/use-workspace";
import styles from "./IntegrationMonthlyReport.module.css";

const IntegrationPresentation = dynamic(() => import("./IntegrationPresentation"), { ssr: false });

const MONTHS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const MONTH_SHORT = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sept", "Oct", "Nov", "Déc"];
const MONTH_LETTER = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
type ReportResult = Extract<Awaited<ReturnType<typeof getIntegrationMonthlySummary>>, { success: true }>;
type PlanForm = { monthlyGuestTarget: string; observation: string; challenge: string; action: string; owner: string; dueDate: string };
const EMPTY_PLAN: PlanForm = { monthlyGuestTarget: "", observation: "", challenge: "", action: "", owner: "", dueDate: "" };

function MetricCard({ label, value, detail, icon: Icon, emphasis = false }: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Users;
  emphasis?: boolean;
}) {
  return <article className={`${styles.metric} ${emphasis ? styles.metricEmphasis : ""}`}>
    <span className={styles.metricIcon}><Icon size={17} /></span>
    <span className={styles.metricLabel}>{label}</span>
    <strong className={styles.metricValue}>{value}</strong>
    <span className={styles.metricDetail}>{detail}</span>
  </article>;
}

function formatCount(value: number) {
  return new Intl.NumberFormat("fr-BE", { maximumFractionDigits: 0 }).format(value);
}

export default function IntegrationMonthlyReportPage() {
  const workspace = useWorkspace();
  const [reportState, setReportState] = useState<{ key: string; report: ReportResult } | null>(null);
  const [requestState, setRequestState] = useState<{ key: string; loading: boolean; error?: string }>({ key: "", loading: true });
  const [selectedMonths, setSelectedMonths] = useState<number[]>([new Date().getMonth() + 1]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [copied, setCopied] = useState(false);
  const [retryVersion, setRetryVersion] = useState(0);
  const [planRequest, setPlanRequest] = useState<{ key: string; loading: boolean; error?: string; setupRequired?: boolean }>({ key: "", loading: true });
  const [planForm, setPlanForm] = useState<PlanForm>(EMPTY_PLAN);
  const [planSaving, setPlanSaving] = useState(false);
  const [planSavedKey, setPlanSavedKey] = useState("");
  const [planRetryVersion, setPlanRetryVersion] = useState(0);
  const [presentationOpen, setPresentationOpen] = useState(false);
  const [presentationInitialMonths, setPresentationInitialMonths] = useState<number[]>([]);
  const role = workspace.role.toLowerCase().trim();
  const canView = role === "integration_responsable" || role === "integration_second";
  const context = typeof window === "undefined" ? null : getActiveContext();
  const activeUser = typeof window === "undefined" ? null : getActiveUserInfo();
  const churchId = context?.context_type === "integration" ? context.church_id || "" : activeUser?.church_id || "";
  const requestKey = `${churchId}:${retryVersion}`;
  const sortedMonths = selectedMonths.slice().sort((a, b) => a - b);
  const reportPeriod = `${selectedYear}-${sortedMonths.map(month => String(month).padStart(2, "0")).join(",")}`;
  const planKey = `${churchId}:${reportPeriod}`;
  const planRequestKey = `${planKey}:${planRetryVersion}`;
  const report = reportState?.key === requestKey ? reportState.report : null;
  const planLoading = planRequest.key !== planRequestKey || planRequest.loading;
  const planError = planRequest.key === planRequestKey ? planRequest.error : "";
  const planSetupRequired = planRequest.key === planRequestKey && Boolean(planRequest.setupRequired);
  const loading = !workspace.ready || (canView && Boolean(churchId) && (requestState.key !== requestKey || requestState.loading));
  const error = workspace.ready && canView && !churchId
    ? "Aucune église n’est liée à cette session d’intégration."
    : requestState.key === requestKey ? requestState.error || "" : "";

  useEffect(() => {
    if (!workspace.ready || !canView || !churchId) return;

    let active = true;
    getIntegrationMonthlySummary(churchId).then(result => {
      if (!active) return;
      if (result.success) {
        setReportState({ key: requestKey, report: result });
        setRequestState({ key: requestKey, loading: false });
      } else {
        setRequestState({ key: requestKey, loading: false, error: result.error });
      }
    }).catch(() => {
      if (active) setRequestState({ key: requestKey, loading: false, error: "Le bilan n’a pas pu être chargé. Réessaie dans un instant." });
    });
    return () => { active = false; };
  }, [canView, churchId, requestKey, workspace.ready]);

  useEffect(() => {
    if (!workspace.ready || !canView || !churchId) return;
    let active = true;
    getIntegrationMonthlyReportPlan(churchId, reportPeriod).then(result => {
      if (!active) return;
      if (result.success) {
        const plan = result.plan;
        setPlanForm(plan ? {
          monthlyGuestTarget: plan.monthly_guest_target == null ? "" : String(plan.monthly_guest_target),
          observation: plan.observation || "",
          challenge: plan.challenge || "",
          action: plan.action || "",
          owner: plan.owner || "",
          dueDate: plan.due_date || "",
        } : EMPTY_PLAN);
        setPlanRequest({ key: planRequestKey, loading: false });
      } else {
        setPlanForm(EMPTY_PLAN);
        setPlanSavedKey("");
        setPlanRequest({ key: planRequestKey, loading: false, error: result.error, setupRequired: "setupRequired" in result && result.setupRequired });
      }
    }).catch(() => {
      if (active) {
        setPlanForm(EMPTY_PLAN);
        setPlanSavedKey("");
        setPlanRequest({ key: planRequestKey, loading: false, error: "Le plan d’action n’a pas pu être chargé." });
      }
    });
    return () => { active = false; };
  }, [canView, churchId, planRequestKey, reportPeriod, workspace.ready]);

  const selectedSummaries = useMemo(() => (report?.months || []).filter(summary => {
    const [year, month] = summary.month.split("-").map(Number);
    return year === selectedYear && selectedMonths.includes(month);
  }), [report, selectedMonths, selectedYear]);

  const totals = useMemo(() => selectedSummaries.reduce((sum, month) => ({
    guestsReceived: sum.guestsReceived + month.guestsReceived,
    guestsWithoutFamily: sum.guestsWithoutFamily + month.guestsWithoutFamily,
    guestsWithPhone: sum.guestsWithPhone + month.guestsWithPhone,
    wrongNumbers: sum.wrongNumbers + month.wrongNumbers,
    callsReached: sum.callsReached + month.callsReached,
    withLocalChurch: sum.withLocalChurch + month.withLocalChurch,
    withoutLocalChurch: sum.withoutLocalChurch + month.withoutLocalChurch,
    salvationPrayer: sum.salvationPrayer + month.salvationPrayer,
    integratedCdm: sum.integratedCdm + month.integratedCdm,
    pcnc: sum.pcnc + month.pcnc,
    returnedToChurch: sum.returnedToChurch + month.returnedToChurch,
    returnedWithoutLocalChurch: sum.returnedWithoutLocalChurch + month.returnedWithoutLocalChurch,
    fidelizedWithoutLocalChurch: sum.fidelizedWithoutLocalChurch + month.fidelizedWithoutLocalChurch,
    uninitiatedCalls: sum.uninitiatedCalls + (month.uninitiatedCalls ?? month.guestsWithoutNextStep ?? 0),
    awaitingAssignment: sum.awaitingAssignment + (month.awaitingAssignment ?? 0),
    awaitingContact: sum.awaitingContact + (month.awaitingContact ?? 0),
    guestsWithoutNextStep: sum.guestsWithoutNextStep + (month.uninitiatedCalls ?? month.guestsWithoutNextStep ?? 0),
  }), {
    guestsReceived: 0, guestsWithoutFamily: 0, guestsWithPhone: 0, wrongNumbers: 0, callsReached: 0,
    withLocalChurch: 0, withoutLocalChurch: 0, salvationPrayer: 0, integratedCdm: 0,
    pcnc: 0, returnedToChurch: 0, returnedWithoutLocalChurch: 0, fidelizedWithoutLocalChurch: 0,
    uninitiatedCalls: 0, awaitingAssignment: 0, awaitingContact: 0, guestsWithoutNextStep: 0,
  }), [selectedSummaries]);

  const familyCounts = useMemo(() => {
    const normalize = (value: string) => value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr");
    const counts = new Map<string, { name: string; count: number }>();
    for (const name of report?.families || []) counts.set(normalize(name), { name, count: 0 });
    for (const month of selectedSummaries) {
      for (const family of month.families) {
        const key = normalize(family.familyName);
        const current = counts.get(key);
        counts.set(key, { name: current?.name || family.familyName, count: (current?.count || 0) + family.count });
      }
    }
    return Array.from(counts.values()).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "fr", { sensitivity: "base" }));
  }, [report, selectedSummaries]);

  const guestsWithFamily = familyCounts.reduce((sum, family) => sum + family.count, 0);
  const formatRate = (numerator: number, denominator: number) => denominator > 0
    ? new Intl.NumberFormat("fr-BE", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(numerator / denominator)
    : "—";
  const loyaltyRate = formatRate(totals.fidelizedWithoutLocalChurch, totals.withoutLocalChurch);
  const contactRate = formatRate(totals.guestsWithPhone, totals.guestsReceived);
  const callRate = formatRate(totals.callsReached, totals.guestsWithPhone);
  const allMonthsSelected = selectedMonths.length === 12;
  const yearOptions = Array.from(new Set([
    new Date().getFullYear(),
    ...(report?.months || []).map(month => Number(month.month.slice(0, 4))),
  ])).sort((a, b) => b - a);
  const periodLabel = `${selectedMonths.slice().sort((a, b) => a - b).map(month => MONTHS[month - 1]).join(", ")} ${selectedYear}`;
  const monthlyTrend = Array.from({ length: 12 }, (_, index) => {
    const monthNumber = index + 1;
    const summary = report?.months.find(item => item.month === `${selectedYear}-${String(monthNumber).padStart(2, "0")}`);
    const received = summary?.guestsReceived || 0;
    const fidelized = summary?.fidelizedWithoutLocalChurch || 0;
    const withoutLocalChurch = summary?.withoutLocalChurch || 0;
    const fidelityRate = withoutLocalChurch > 0 ? Math.round((fidelized / withoutLocalChurch) * 100) : null;
    return {
      month: MONTH_SHORT[index],
      monthNumber,
      received,
      fidelized,
      withoutLocalChurch,
      fidelityRate,
      selected: selectedMonths.includes(monthNumber),
    };
  });
  const trendMax = Math.max(1, ...monthlyTrend.map(month => month.received));
  const targetValue = planForm.monthlyGuestTarget.trim() === "" ? null : Number(planForm.monthlyGuestTarget);
  const targetTotal = targetValue !== null && Number.isInteger(targetValue) && targetValue >= 0 ? targetValue * selectedMonths.length : null;
  const safeTargetTotal = targetTotal ?? 0;
  const targetProgress = targetTotal && targetTotal > 0 ? Math.min(100, Math.round(totals.guestsReceived / targetTotal * 100)) : null;

  const toggleMonth = (month: number) => setSelectedMonths(current => current.includes(month)
    ? current.length > 1 ? current.filter(value => value !== month) : current
    : [...current, month].sort((a, b) => a - b));

  const copySummary = async () => {
    const lines = [
      `Bilan mensuel — ${periodLabel}`,
      `Invités reçus : ${formatCount(totals.guestsReceived)}`,
      `Invités avec téléphone : ${formatCount(totals.guestsWithPhone)}`,
      `Taux de contact (avec téléphone / invités reçus) : ${contactRate}`,
      `Appels aboutis : ${formatCount(totals.callsReached)}`,
      `Appels aboutis parmi les numéros enregistrés : ${callRate}`,
      `Numéros erronés : ${formatCount(totals.wrongNumbers)}`,
      `Avec église locale : ${formatCount(totals.withLocalChurch)}`,
      `Sans église locale : ${formatCount(totals.withoutLocalChurch)}`,
      `Prière du salut : ${formatCount(totals.salvationPrayer)}`,
      `Invités rattachés à une famille : ${formatCount(guestsWithFamily)}`,
      `Intégrés en C.D.M. : ${formatCount(totals.integratedCdm)}`,
      `Inscrits ou intéressés au P.C.N.C. : ${formatCount(totals.pcnc)}`,
      `Revenus au culte : ${formatCount(totals.returnedToChurch)}`,
      `Invités fidélisés sans église : ${formatCount(totals.fidelizedWithoutLocalChurch)} / ${formatCount(totals.withoutLocalChurch)}`,
      `Fidélisation sans église : ${loyaltyRate}`,
      `Appels non entamés : ${formatCount(totals.uninitiatedCalls)} / ${formatCount(totals.guestsReceived)} (${formatCount(totals.awaitingAssignment)} en attente de conseiller, ${formatCount(totals.awaitingContact)} en attente de premier appel)`,
      ...(targetTotal === null ? [] : [`Objectif d’accueil : ${formatCount(targetValue ?? 0)} par mois, soit ${formatCount(targetTotal)} sur la période`]),
      `Évolution ${selectedYear} (invités reçus ; fidélisés sans église locale) :`,
      ...monthlyTrend.filter(month => month.selected).map(month => `• ${MONTHS[month.monthNumber - 1]} : ${formatCount(month.received)} reçus ; ${formatCount(month.fidelized)} fidélisé(s)`),
      "Répartition par famille :",
      ...familyCounts.map(family => `• ${family.name} : ${formatCount(family.count)}`),
      `Sans famille affectée : ${formatCount(totals.guestsWithoutFamily)}`,
      ...(planForm.observation.trim() ? [`Constat : ${planForm.observation.trim()}`] : []),
      ...(planForm.challenge.trim() ? [`Défi : ${planForm.challenge.trim()}`] : []),
      ...(planForm.action.trim() ? [`Action : ${planForm.action.trim()}`] : []),
      ...(planForm.owner.trim() ? [`Responsable : ${planForm.owner.trim()}`] : []),
      ...(planForm.dueDate ? [`Échéance : ${planForm.dueDate}`] : []),
    ].join("\n");
    try {
      await navigator.clipboard.writeText(lines);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const savePlan = async () => {
    if (!churchId || planLoading || planError || planSetupRequired) return;
    setPlanSaving(true);
    setPlanSavedKey("");
    try {
      const result = await saveIntegrationMonthlyReportPlan({
        churchId,
        period: reportPeriod,
        monthlyGuestTarget: targetValue,
        observation: planForm.observation,
        challenge: planForm.challenge,
        action: planForm.action,
        owner: planForm.owner,
        dueDate: planForm.dueDate,
      });
      if (result.success) {
        setPlanSavedKey(planKey);
        setPlanRequest({ key: planRequestKey, loading: false });
      } else {
        setPlanRequest({ key: planRequestKey, loading: false, error: result.error, setupRequired: "setupRequired" in result && result.setupRequired });
      }
    } catch {
      setPlanRequest({ key: planRequestKey, loading: false, error: "L’enregistrement a échoué. Réessaie dans un instant." });
    } finally {
      setPlanSaving(false);
    }
  };

  const closePresentation = useCallback(() => {
    setPresentationOpen(false);
    try {
      const doc = document as any;
      const isFs = !!(
        doc.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement
      );
      if (isFs) {
        if (doc.exitFullscreen) void doc.exitFullscreen().catch(() => undefined);
        else if (doc.webkitExitFullscreen) doc.webkitExitFullscreen();
        else if (doc.mozCancelFullScreen) doc.mozCancelFullScreen();
        else if (doc.msExitFullscreen) doc.msExitFullscreen();
      }
    } catch {}
  }, []);

  const openPresentation = () => {
    setPresentationInitialMonths(selectedMonths.slice());
    setPresentationOpen(true);
    try {
      const doc = document as any;
      const isFs = !!(
        doc.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement
      );
      if (!isFs) {
        const docEl = document.documentElement as any;
        if (docEl.requestFullscreen) {
          void docEl.requestFullscreen().catch(() => undefined);
        } else if (docEl.webkitRequestFullscreen) {
          docEl.webkitRequestFullscreen();
        } else if (docEl.mozRequestFullScreen) {
          docEl.mozRequestFullScreen();
        } else if (docEl.msRequestFullscreen) {
          docEl.msRequestFullscreen();
        }
      }
    } catch {}
  };

  if (!workspace.ready) return <div className={styles.loading}><LoaderCircle size={24} /> Chargement du bilan…</div>;

  if (!canView) return <main className={styles.page}><IntegrationSubNav /><section className={styles.accessCard}>
    <FileChartColumnIncreasing size={25} /><h1>Bilan mensuel</h1>
    <p>Cette vue est réservée aux responsables et seconds de l’Intégration.</p>
  </section></main>;

  return <>
  <main className={styles.page}>
    <IntegrationSubNav />
    <header className={styles.header}>
      <div className={styles.heading}>
        <span className={styles.eyebrow}><BarChart3 size={14} /> DÉPARTEMENT INTÉGRATION · CONSEIL PASTORAL</span>
        <h1>Bilan mensuel</h1>
        <p>Les indicateurs de la période sélectionnée, prêts à reprendre dans ta présentation.</p>
      </div>
      <div className={styles.headerActions}>
        <div className={styles.periodBadge}><span>PÉRIODE</span><strong>{periodLabel}</strong></div>
        <button type="button" className={styles.copyButton} onClick={() => void copySummary()} disabled={loading || !report}>
          {copied ? <Check size={16} /> : <Copy size={16} />}{copied ? "Bilan copié" : "Copier les chiffres"}
        </button>
        <button type="button" className={styles.presentationButton} onClick={openPresentation} disabled={loading || !report}>
          <Play size={15} fill="currentColor" /> Présenter
        </button>
      </div>
    </header>

    <section className={styles.filterPanel} aria-label="Sélection de la période">
      <div className={styles.filterTop}>
        <div><span className={styles.sectionKicker}>PÉRIODE DU BILAN</span><p>Choisis un ou plusieurs mois.</p></div>
        <label className={styles.yearSelect}>Année
          <select value={selectedYear} onChange={event => setSelectedYear(Number(event.target.value))}>
            {yearOptions.map(year => <option key={year} value={year}>{year}</option>)}
          </select>
        </label>
      </div>
      <div className={styles.monthControls}>
        <div className={styles.months} role="group" aria-label="Mois inclus dans le bilan">
          {MONTHS.map((month, index) => <button key={month} type="button" aria-pressed={selectedMonths.includes(index + 1)} className={styles.monthButton} onClick={() => toggleMonth(index + 1)}>{MONTH_SHORT[index]}</button>)}
        </div>
        <button
          type="button"
          className={`${styles.allMonths} ${allMonthsSelected ? styles.allMonthsActive : ""}`}
          aria-pressed={allMonthsSelected}
          onClick={() => setSelectedMonths(allMonthsSelected ? [new Date().getMonth() + 1] : MONTHS.map((_, index) => index + 1))}
        >
          Toute l’année
        </button>
      </div>
    </section>

    {error && <div className={styles.errorCard} role="alert"><span>{error}</span><button type="button" onClick={() => setRetryVersion(version => version + 1)}>Réessayer</button></div>}

    {loading ? <div className={styles.loading}><LoaderCircle size={22} /> Chargement des indicateurs…</div> : report && <>
      {totals.guestsReceived === 0 && <div className={styles.emptyPeriod}>Aucun invité n’a été reçu sur cette période.</div>}

      <section className={styles.heroMetrics} aria-label="Synthèse de la période">
        <MetricCard label="Invités reçus" value={formatCount(totals.guestsReceived)} detail={totals.guestsReceived <= 1 ? "Selon sa date d’arrivée" : "Selon leur date d’arrivée"} icon={Users} emphasis />
        <MetricCard label="Contact laissé" value={formatCount(totals.guestsWithPhone)} detail={`${contactRate} des invités reçus ont un numéro`} icon={Phone} />
        <MetricCard label="Appels aboutis" value={formatCount(totals.callsReached)} detail={`${callRate} parmi les invités avec numéro enregistré`} icon={RotateCw} />
        <MetricCard label="Fidélisation" value={loyaltyRate} detail={`${formatCount(totals.fidelizedWithoutLocalChurch)} fidélisé${totals.fidelizedWithoutLocalChurch > 1 ? "s" : ""} sur ${formatCount(totals.withoutLocalChurch)} sans église`} icon={HeartHandshake} emphasis />
      </section>

      <section className={styles.contentSection} aria-labelledby="trend-title">
        <div className={styles.sectionHeader}>
          <div><span className={styles.sectionKicker}>ÉVOLUTION MENSUELLE · {selectedYear}</span><h2 id="trend-title">Invités reçus & taux de fidélisation</h2><p>Chaque barre indique le volume d’invités reçus. Le pourcentage indique le taux de fidélisation parmi les personnes sans église locale.</p></div>
          <div className={styles.chartLegend}>
            <span><i /> Invités reçus (volume)</span>
            <span className={styles.chartLegendTeal}><i /> Taux fidélisation (%)</span>
          </div>
        </div>
        <div className={styles.trendChartWrapper}>
          <div className={styles.trendChart} role="list" aria-label={`Invités reçus et fidélisation par mois en ${selectedYear}`}>
            {monthlyTrend.map(month => <div className={`${styles.trendMonth} ${month.selected ? styles.trendMonthSelected : ""}`} key={month.monthNumber} role="listitem" aria-label={`${MONTHS[month.monthNumber - 1]} : ${formatCount(month.received)} invités reçus, fidélisation : ${month.fidelityRate !== null ? `${month.fidelityRate}%` : "aucun invité sans église"}`}>
              <span className={styles.trendCount}>{formatCount(month.received)}</span>
              <div className={styles.trendBarTrack}><span style={{ height: `${month.received ? Math.max(5, month.received / trendMax * 100) : 0}%` }} /></div>
              <span className={styles.trendMonthLabel}>
                <span className={styles.monthLabelFull}>{month.month}</span>
                <span className={styles.monthLabelShort}>{MONTH_LETTER[month.monthNumber - 1]}</span>
              </span>
              <span className={`${styles.trendFidelized} ${month.fidelityRate !== null ? styles.trendFidelizedRate : ""}`}>
                {month.fidelityRate !== null ? `${month.fidelityRate} %` : "—"}
              </span>
            </div>)}
          </div>
        </div>
      </section>

      <section className={styles.contentSection} aria-labelledby="families-title">
        <div className={styles.sectionHeader}>
          <div><span className={styles.sectionKicker}>RÉPARTITION PAR FAMILLE</span><h2 id="families-title">Nombre d’invités par famille de disciples</h2><p>Parmi les invités reçus sur la période, selon la famille indiquée sur leur fiche.</p></div>
          <div className={styles.familyTotal}><strong>{formatCount(guestsWithFamily)}</strong><span>invité{guestsWithFamily > 1 ? "s" : ""}</span></div>
        </div>
        <div className={styles.familyList}>
          {familyCounts.length ? familyCounts.map(family => <div className={styles.familyRow} key={family.name}>
            <div className={styles.familyName}>{family.name}</div>
            <div className={styles.familyTrack} aria-hidden="true"><span style={{ width: `${guestsWithFamily ? family.count / guestsWithFamily * 100 : 0}%` }} /></div>
            <strong className={styles.familyCount}>{formatCount(family.count)}</strong>
          </div>) : <p className={styles.noFamilies}>Aucune famille n’est enregistrée pour cette église.</p>}
        </div>
        {!!totals.guestsWithoutFamily && <p className={styles.historyNote}>{formatCount(totals.guestsWithoutFamily)} invité{totals.guestsWithoutFamily > 1 ? "s" : ""} de la période ne {totals.guestsWithoutFamily > 1 ? "sont" : "est"} pas rattaché{totals.guestsWithoutFamily > 1 ? "s" : ""} à une famille.</p>}
      </section>

      <div className={styles.lowerGrid}>
        <section className={styles.contentSection} aria-labelledby="welcome-title">
          <div className={styles.sectionHeader}>
            <div>
              <span className={styles.sectionKicker}>ACCUEIL & PROFIL</span>
              <h2 id="welcome-title">Informations des invités</h2>
              <p>Profil et réceptivité des personnes accueillies sur la période.</p>
            </div>
          </div>
          <div className={styles.detailMetrics}>
            <MetricCard label="Numéros erronés" value={formatCount(totals.wrongNumbers)} detail="Signalés comme faux dans le suivi" icon={Phone} />
            <MetricCard label="Avec une église locale" value={formatCount(totals.withLocalChurch)} detail="Déclarée sur la fiche d’arrivée" icon={Users} />
            <MetricCard label="Sans église locale" value={formatCount(totals.withoutLocalChurch)} detail="Base de calcul de la fidélisation" icon={Users} />
            <MetricCard label="Prière du salut" value={formatCount(totals.salvationPrayer)} detail="Fiches avec une réponse positive" icon={HeartHandshake} />
            <div className={styles.spanFull}>
              <MetricCard
                label="Appels non entamés (vigilance)"
                value={formatCount(totals.uninitiatedCalls)}
                detail={totals.uninitiatedCalls === 0
                  ? "Tous les invités de la période ont été pris en charge et contactés."
                  : `${formatCount(totals.awaitingAssignment)} invité${totals.awaitingAssignment > 1 ? "s" : ""} en attente de conseiller · ${formatCount(totals.awaitingContact)} en attente d’un premier échange`}
                icon={Activity}
                emphasis={totals.uninitiatedCalls > 0}
              />
            </div>
          </div>
        </section>

        <section className={styles.contentSection} aria-labelledby="journey-title">
          <div className={styles.sectionHeader}>
            <div>
              <span className={styles.sectionKicker}>PARCOURS & ENGAGEMENT</span>
              <h2 id="journey-title">Prochaines étapes & fidélisation</h2>
              <p>Progression des personnes accueillies vers l’ancrage dans l’église.</p>
            </div>
          </div>
          <div className={styles.detailMetrics}>
            <MetricCard label="Intégrés en C.D.M." value={formatCount(totals.integratedCdm)} detail="Participation à une cellule de maison" icon={Users} />
            <MetricCard label="P.C.N.C." value={formatCount(totals.pcnc)} detail="Inscrits ou intéressés par la formation" icon={FileChartColumnIncreasing} />
            <MetricCard label="Rattachés en famille" value={formatCount(guestsWithFamily)} detail={`${formatRate(guestsWithFamily, totals.guestsReceived)} des invités rattachés à une famille`} icon={Users} />
            <MetricCard label="Fidélisés sans église" value={formatCount(totals.fidelizedWithoutLocalChurch)} detail={`${loyaltyRate} des personnes sans église locale`} icon={HeartHandshake} emphasis />
            <div className={styles.spanFull}>
              <MetricCard
                label="Revenus au culte (retour confirmé)"
                value={formatCount(totals.returnedToChurch)}
                detail={totals.returnedToChurch === 0
                  ? "Aucun retour au culte enregistré sur cette sélection."
                  : `${formatCount(totals.returnedToChurch)} invité${totals.returnedToChurch > 1 ? "s" : ""} de la période ${totals.returnedToChurch > 1 ? "ont" : "a"} déjà assisté à un nouveau culte.`}
                icon={RotateCw}
                emphasis
              />
            </div>
          </div>
        </section>
      </div>

      <section className={styles.contentSection} aria-labelledby="plan-title">
        <div className={styles.sectionHeader}>
          <div><span className={styles.sectionKicker}>PRÉPARATION DU CONSEIL PASTORAL</span><h2 id="plan-title">Objectif et plan d’action</h2><p>Les notes sont partagées avec les responsables de l’Intégration de cette église pour la période choisie.</p></div>
          <span className={styles.planPeriod}>{periodLabel}</span>
        </div>
        {planLoading && <div className={styles.planStatus}>Chargement du plan…</div>}
        {planError && <div className={styles.planError} role="alert">
          <strong>{planError}</strong>
          {planSetupRequired ? <span>Pour activer l’enregistrement partagé, exécute le script <code>supabase/patch_v7.6_bilan_integration.sql</code> dans le SQL Editor Supabase, puis recharge la page.</span> : <button type="button" className={styles.retryPlan} onClick={() => setPlanRetryVersion(version => version + 1)}>Réessayer</button>}
        </div>}
        <div className={styles.planGrid}>
          <div className={styles.objectiveCard}>
            <span className={styles.metricIcon}><Target size={17} /></span>
            <label htmlFor="monthly-target">Objectif d’invités reçus par mois</label>
            <div className={styles.targetInputWrap}><input id="monthly-target" inputMode="numeric" type="number" min="0" max="1000000" step="1" value={planForm.monthlyGuestTarget} onChange={event => { setPlanForm(current => ({ ...current, monthlyGuestTarget: event.target.value })); setPlanSavedKey(""); }} disabled={planLoading || Boolean(planError) || planSetupRequired} placeholder="À définir" /><span>invités / mois</span></div>
            <p>{targetTotal === null ? "Aucun objectif n’est défini." : `Objectif de la période : ${formatCount(safeTargetTotal)} (${formatCount(targetValue ?? 0)} × ${selectedMonths.length} mois)`}</p>
            {targetProgress !== null && <div className={styles.progressBlock}><div className={styles.progressTrack}><span style={{ width: `${targetProgress}%` }} /></div><span>{targetProgress}% de l’objectif · {formatCount(totals.guestsReceived)} reçus sur {formatCount(safeTargetTotal)}</span></div>}
          </div>
          <div className={styles.actionPlan}>
            <div className={styles.planFields}>
              <label className={styles.fullField}>Constat<textarea maxLength={2000} rows={2} value={planForm.observation} onChange={event => { setPlanForm(current => ({ ...current, observation: event.target.value })); setPlanSavedKey(""); }} disabled={planLoading || Boolean(planError) || planSetupRequired} placeholder="Que montrent les chiffres de la période ?" /></label>
              <label>Défi identifié<textarea maxLength={2000} rows={2} value={planForm.challenge} onChange={event => { setPlanForm(current => ({ ...current, challenge: event.target.value })); setPlanSavedKey(""); }} disabled={planLoading || Boolean(planError) || planSetupRequired} placeholder="Quel point demande une attention ?" /></label>
              <label>Action décidée<textarea maxLength={2000} rows={2} value={planForm.action} onChange={event => { setPlanForm(current => ({ ...current, action: event.target.value })); setPlanSavedKey(""); }} disabled={planLoading || Boolean(planError) || planSetupRequired} placeholder="Quelle action concrète sera menée ?" /></label>
              <label>Responsable<input maxLength={200} value={planForm.owner} onChange={event => { setPlanForm(current => ({ ...current, owner: event.target.value })); setPlanSavedKey(""); }} disabled={planLoading || Boolean(planError) || planSetupRequired} placeholder="Nom du responsable" /></label>
              <label>Échéance<input type="date" value={planForm.dueDate} onChange={event => { setPlanForm(current => ({ ...current, dueDate: event.target.value })); setPlanSavedKey(""); }} disabled={planLoading || Boolean(planError) || planSetupRequired} /></label>
            </div>
            <div className={styles.planFooter}>
              <span className={styles.saveMessage} aria-live="polite">{planSavedKey === planKey ? <><Check size={14} /> Plan enregistré et partagé</> : ""}</span>
              <button type="button" className={styles.copyButton} onClick={() => void savePlan()} disabled={planSaving || planLoading || Boolean(planError) || planSetupRequired}>
                {planSaving ? <LoaderCircle size={15} /> : <Save size={15} />}{planSaving ? "Enregistrement…" : "Enregistrer le plan"}
              </button>
            </div>
          </div>
        </div>
      </section>

      <footer className={styles.methodNote}>
        <div className={styles.methodNoteHeader}>
          <BarChart3 size={15} />
          <strong>Comment lire et interpréter les indicateurs</strong>
        </div>
        <ul className={styles.methodList}>
          <li>
            <strong>Invités reçus & accueil :</strong>
            <span>Comptabilise l’ensemble des nouveaux arrivants dont la date d’arrivée se situe dans les mois sélectionnés.</span>
          </li>
          <li>
            <strong>Taux de contact :</strong>
            <span>Pourcentage d’invités ayant renseigné un numéro de téléphone exploitable sur leur fiche.</span>
          </li>
          <li>
            <strong>Appels aboutis :</strong>
            <span>Proportion calculée parmi les invités avec un numéro enregistré (les tentatives infructueuses ne sont pas enregistrées).</span>
          </li>
          <li>
            <strong>Fidélisation & retour au culte :</strong>
            <span>Calculée exclusivement sur les personnes sans église locale d’origine. Est comptabilisé comme fidélisé tout invité revenu au culte ou marqué comme fidélisé dans son parcours.</span>
          </li>
          <li>
            <strong>Appels non entamés (vigilance) :</strong>
            <span>Totalise les personnes n’ayant pas encore été confiées à un conseiller ainsi que celles confiées dont le premier échange téléphonique reste à réaliser.</span>
          </li>
          <li>
            <strong>Répartition par famille :</strong>
            <span>Rattachement actuel aux Familles de Disciples mentionné sur la fiche de chaque invité accueilli durant la période.</span>
          </li>
          <li>
            <strong>Objectif pastoral :</strong>
            <span>Cible mensuelle fixée par l’équipe et cumulée sur le nombre de mois sélectionnés.</span>
          </li>
        </ul>
      </footer>
    </>}
  </main>
  {presentationOpen && <IntegrationPresentation
    periodLabel={periodLabel}
    year={selectedYear}
    totals={totals}
    families={familyCounts}
    monthlyTrend={monthlyTrend}
    targetTotal={targetTotal}
    plan={planForm}
    planLoading={planLoading}
    planError={planError || (planSetupRequired ? "Le plan d’action nécessite une mise à jour." : undefined)}
    selectedMonths={selectedMonths}
    onSelectMonths={setSelectedMonths}
    initialMonths={presentationInitialMonths}
    onClose={closePresentation}
  />}
  </>;
}
