"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { 
  Play, Church, Check, Copy, LogIn, LoaderCircle
} from "lucide-react";
import PoimenLogo from "@/components/brand/PoimenLogo";
import { getPublicIntegrationPresentationData, getPublicIntegrationReportPlan } from "@/app/actions/auth";
import styles from "./PresentationPublic.module.css";

const IntegrationPresentation = dynamic(
  () => import("../dashboard/bilan-integration/IntegrationPresentation"),
  { ssr: false }
);

const MONTHS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
];
const MONTH_SHORT = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sept", "Oct", "Nov", "Déc"];

type Plan = { monthlyGuestTarget: string; observation: string; challenge: string; action: string; owner: string; dueDate: string };
const EMPTY_PLAN: Plan = { monthlyGuestTarget: "", observation: "", challenge: "", action: "", owner: "", dueDate: "" };

function PresentationContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const churchParam = searchParams.get("church") || "";
  const autoOpenParam = searchParams.get("open");
  const initialOpen = autoOpenParam !== "0";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [church, setChurch] = useState<{ id: string; name: string; city: string } | null>(null);
  const [churches, setChurches] = useState<{ id: string; name: string; city: string }[]>([]);
  const [reportData, setReportData] = useState<{ families: string[]; months: any[] } | null>(null);
  const [plan, setPlan] = useState<Plan>(EMPTY_PLAN);
  const [planLoading, setPlanLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const [selectedMonths, setSelectedMonths] = useState<number[]>(() => {
    const raw = searchParams.get("months");
    if (raw) {
      const parsed = raw.split(",").map(Number).filter(m => m >= 1 && m <= 12);
      if (parsed.length > 0) return parsed.sort((a, b) => a - b);
    }
    return [new Date().getMonth() + 1];
  });

  const [selectedYear, setSelectedYear] = useState<number>(() => {
    const raw = searchParams.get("year");
    if (raw && !Number.isNaN(Number(raw))) return Number(raw);
    return new Date().getFullYear();
  });

  const [presentationOpen, setPresentationOpen] = useState(initialOpen);

  const sortedMonths = useMemo(() => selectedMonths.slice().sort((a, b) => a - b), [selectedMonths]);
  const reportPeriod = useMemo(
    () => `${selectedYear}-${sortedMonths.map(m => String(m).padStart(2, "0")).join(",")}`,
    [selectedYear, sortedMonths]
  );

  const loadData = useCallback(async (targetChurchId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getPublicIntegrationPresentationData(targetChurchId, reportPeriod);
      if (res.success && res.summary) {
        setChurch(res.church);
        setChurches(res.churches);
        setReportData({
          families: res.summary.families,
          months: res.summary.months,
        });
        if (res.plan) setPlan(res.plan);
      } else {
        setError(res.error || "Impossible de charger les données de présentation.");
      }
    } catch {
      setError("Une erreur est survenue lors de la récupération du bilan.");
    } finally {
      setLoading(false);
    }
  }, [reportPeriod]);

  useEffect(() => {
    void loadData(churchParam || undefined);
  }, [churchParam, loadData]);

  // Handle month filter updates from inside the presentation (via floating pill / key 'M')
  const handleSelectMonths = useCallback(async (newMonths: number[]) => {
    setSelectedMonths(newMonths);
    if (!church?.id) return;
    const sorted = newMonths.slice().sort((a, b) => a - b);
    const newPeriod = `${selectedYear}-${sorted.map(m => String(m).padStart(2, "0")).join(",")}`;
    setPlanLoading(true);
    try {
      const res = await getPublicIntegrationReportPlan(church.id, newPeriod);
      if (res.success && res.plan) {
        setPlan(res.plan);
      } else {
        setPlan(EMPTY_PLAN);
      }
    } catch {
      // keep current plan or fallback
    } finally {
      setPlanLoading(false);
    }
  }, [church?.id, selectedYear]);

  // Calculate totals for selected period
  const selectedSummaries = useMemo(() => {
    return (reportData?.months || []).filter(summary => {
      const [year, month] = summary.month.split("-").map(Number);
      return year === selectedYear && selectedMonths.includes(month);
    });
  }, [reportData, selectedMonths, selectedYear]);

  const totals = useMemo(() => selectedSummaries.reduce((sum, month) => ({
    guestsReceived: sum.guestsReceived + month.guestsReceived,
    guestsWithoutFamily: sum.guestsWithoutFamily + month.guestsWithoutFamily,
    guestsWithPhone: sum.guestsWithPhone + month.guestsWithPhone,
    wrongNumbers: sum.wrongNumbers + month.wrongNumbers,
    noAnswer: sum.noAnswer + (month.noAnswer ?? 0),
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
    guestsReceived: 0, guestsWithoutFamily: 0, guestsWithPhone: 0, wrongNumbers: 0, noAnswer: 0, callsReached: 0,
    withLocalChurch: 0, withoutLocalChurch: 0, salvationPrayer: 0, integratedCdm: 0,
    pcnc: 0, returnedToChurch: 0, returnedWithoutLocalChurch: 0, fidelizedWithoutLocalChurch: 0,
    uninitiatedCalls: 0, awaitingAssignment: 0, awaitingContact: 0, guestsWithoutNextStep: 0,
  }), [selectedSummaries]);

  const familyCounts = useMemo(() => {
    const normalize = (value: string) => value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr");
    const counts = new Map<string, { name: string; count: number }>();
    for (const name of reportData?.families || []) counts.set(normalize(name), { name, count: 0 });
    for (const month of selectedSummaries) {
      for (const family of month.families || []) {
        const key = normalize(family.familyName);
        const current = counts.get(key);
        counts.set(key, { name: current?.name || family.familyName, count: (current?.count || 0) + family.count });
      }
    }
    return Array.from(counts.values()).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "fr", { sensitivity: "base" }));
  }, [reportData, selectedSummaries]);

  const monthlyTrend = useMemo(() => Array.from({ length: 12 }, (_, index) => {
    const monthNumber = index + 1;
    const summary = reportData?.months.find(item => item.month === `${selectedYear}-${String(monthNumber).padStart(2, "0")}`);
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
  }), [reportData, selectedMonths, selectedYear]);

  const yearOptions = useMemo(() => Array.from(new Set([
    new Date().getFullYear(),
    ...(reportData?.months || []).map(m => Number(m.month.slice(0, 4))),
  ])).sort((a, b) => b - a), [reportData]);

  const periodLabel = useMemo(() => {
    if (selectedMonths.length === 12) return `Année ${selectedYear} complète`;
    return `${selectedMonths.slice().sort((a, b) => a - b).map(m => MONTHS[m - 1]).join(", ")} ${selectedYear}`;
  }, [selectedMonths, selectedYear]);

  const targetValue = plan.monthlyGuestTarget.trim() === "" ? null : Number(plan.monthlyGuestTarget);
  const targetTotal = targetValue !== null && Number.isInteger(targetValue) && targetValue >= 0 ? targetValue * selectedMonths.length : null;

  const toggleMonth = (m: number) => {
    setSelectedMonths(current => {
      if (current.includes(m)) {
        return current.length > 1 ? current.filter(x => x !== m) : current;
      }
      return [...current, m].sort((a, b) => a - b);
    });
  };

  const handleLaunchFullscreen = () => {
    setPresentationOpen(true);
    try {
      const docEl = document.documentElement as any;
      if (docEl.requestFullscreen) {
        void docEl.requestFullscreen().catch(() => undefined);
      }
    } catch {}
  };

  const copyDirectLink = async () => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set("open", "1");
    if (church?.id) url.searchParams.set("church", church.id);
    url.searchParams.set("year", String(selectedYear));
    url.searchParams.set("months", selectedMonths.join(","));
    try {
      await navigator.clipboard.writeText(url.toString());
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {}
  };

  if (loading && !reportData) {
    return (
      <main className={styles.page}>
        <div className={styles.loadingBox}>
          <LoaderCircle size={28} />
          <p>Chargement du bilan d’intégration...</p>
        </div>
      </main>
    );
  }

  if (error && !reportData) {
    return (
      <main className={styles.page}>
        <div className={styles.container}>
          <div className={styles.topBar}>
            <PoimenLogo size="navigation" />
            <Link href="/login" className={styles.linkBtn}>
              <LogIn size={15} /> Connexion
            </Link>
          </div>
          <div className={styles.hero}>
            <h1>Présentation indisponible</h1>
            <p>{error}</p>
            <div className={styles.ctaWrap}>
              <button type="button" className={styles.playBtn} onClick={() => void loadData(churchParam || undefined)}>
                Réessayer
              </button>
              <Link href="/login" className={styles.linkBtn}>
                Se connecter
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        {/* Navigation Bar */}
        <header className={styles.topBar}>
          <div className={styles.brandWrap}>
            <PoimenLogo size="navigation" />
            <span className={styles.brandSub}>Conseil Pastoral</span>
          </div>

          <div className={styles.topActions}>
            <div className={styles.churchBadge}>
              <Church size={15} />
              {churches.length > 1 ? (
                <select
                  className={styles.churchSelect}
                  value={church?.id || ""}
                  onChange={e => {
                    const nextId = e.target.value;
                    router.push(`/presentation?church=${nextId}`);
                    void loadData(nextId);
                  }}
                  aria-label="Sélectionner l'église locale"
                >
                  {churches.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.city})
                    </option>
                  ))}
                </select>
              ) : (
                <span>{church?.name || "ICC CHARLEROI"}</span>
              )}
            </div>

            <Link href="/login" className={styles.linkBtn} title="Espace d'administration">
              <LogIn size={15} /> Connexion
            </Link>
          </div>
        </header>

        {/* Clean Center Content */}
        <section className={styles.hero}>
          <h1>Bilan de l’Intégration</h1>
          <p>
            {church?.name || "ICC"} · {periodLabel}
          </p>

          <div className={styles.ctaWrap}>
            <button
              type="button"
              className={styles.playBtn}
              onClick={handleLaunchFullscreen}
              title="Lancer le diaporama plein écran"
            >
              <Play size={15} fill="currentColor" /> Lancer la présentation
            </button>

            <button
              type="button"
              className={styles.copyBtn}
              onClick={copyDirectLink}
              title="Copier le lien sans connexion"
            >
              {copied ? <Check size={15} /> : <Copy size={15} />}
              {copied ? "Lien copié !" : "Copier le lien sans connexion"}
            </button>
          </div>
        </section>

        {/* Period Selector Panel */}
        <section className={styles.periodPanel} aria-label="Sélection de la période">
          <div className={styles.periodHeader}>
            <div className={styles.periodTitle}>
              <span>Période active</span>
              <strong>{periodLabel}</strong>
            </div>

            <div className={styles.yearSelect}>
              <label htmlFor="select-year">Année :</label>
              <select
                id="select-year"
                value={selectedYear}
                onChange={e => setSelectedYear(Number(e.target.value))}
              >
                {yearOptions.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.monthsGrid} role="group" aria-label="Mois de la présentation">
            {MONTHS.map((m, idx) => {
              const active = selectedMonths.includes(idx + 1);
              return (
                <button
                  key={m}
                  type="button"
                  aria-pressed={active}
                  className={`${styles.monthBtn} ${active ? styles.monthBtnActive : ""}`}
                  onClick={() => toggleMonth(idx + 1)}
                >
                  {MONTH_SHORT[idx]}
                </button>
              );
            })}
          </div>
        </section>

        <footer className={styles.footer}>
          <span>Poimén Intégration</span>
          <span>&bull;</span>
          <Link href="/login">Espace Conseillers & Responsables</Link>
          <span>&bull;</span>
          <Link href="/">Accueil</Link>
        </footer>
      </div>

      {/* Fullscreen Presentation Modal */}
      {presentationOpen && (
        <IntegrationPresentation
          periodLabel={periodLabel}
          year={selectedYear}
          totals={totals}
          families={familyCounts}
          monthlyTrend={monthlyTrend}
          targetTotal={targetTotal}
          plan={plan}
          planLoading={planLoading}
          selectedMonths={selectedMonths}
          onSelectMonths={handleSelectMonths}
          initialMonths={selectedMonths}
          onClose={() => setPresentationOpen(false)}
        />
      )}
    </main>
  );
}

export default function PublicPresentationPage() {
  return (
    <Suspense
      fallback={
        <main className={styles.page}>
          <div className={styles.loadingBox}>
            <LoaderCircle size={28} />
            <p>Chargement...</p>
          </div>
        </main>
      }
    >
      <PresentationContent />
    </Suspense>
  );
}
