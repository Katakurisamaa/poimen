import styles from "./PeopleStatistics.module.css";

type Metric = { label: string; value: number };
type Props = {
  total: number; totalLabel: string; brebis: number; calls: number; loyal: number;
  pcnc: number[]; pcncTotal: number; followup: Metric[]; engagement: Metric[];
  participation: Metric[]; families?: Metric[];
};
export default function PeopleStatistics({ total, totalLabel, brebis, calls, loyal, pcnc, pcncTotal, followup, engagement, participation, families }: Props) {
  const percent = (value: number) => total ? `${Math.round(value / total * 100)} %` : "—";
  const rows = (metrics: Metric[], rates = false) => <dl className={styles.rows}>{metrics.map(metric => <div key={metric.label} className={styles.row}>
    <dt>{metric.label}</dt><dd>{rates ? (total ? `${metric.value} %` : "—") : metric.value}</dd>
    {rates && <div className={styles.track} aria-hidden="true"><span style={{ width: `${total ? Math.max(0, Math.min(100, metric.value)) : 0}%` }} /></div>}
  </div>)}</dl>;
  return <section className={styles.dashboard} aria-label="Statistiques des personnes">
    <div className={styles.heading}><h2>Vue d’ensemble</h2><p>{total} personne{total !== 1 ? "s" : ""} dans la sélection actuelle</p></div>
    {total === 0 && <p className={styles.empty}>Aucune personne ne correspond aux filtres. Modifiez la période ou les critères pour afficher les statistiques.</p>}
    <div className={styles.summary}>
      {[{ label: totalLabel, value: total, detail: `${brebis} brebis confirmées` }, { label: "Appels aboutis", value: calls, detail: `${percent(calls)} de la sélection` }, { label: "Personnes fidélisées", value: loyal, detail: "Présence ≥ 45 % au culte ou en CDM" }].map(item => <article className={styles.kpi} key={item.label}><span>{item.label}</span><strong>{item.value}</strong><small>{item.detail}</small></article>)}
    </div>
    <div className={styles.grid}>
      <section className={styles.panel}><h3>Suivi et intégration</h3><p>Les repères pour accompagner chaque personne.</p>{rows(followup)}</section>
      <section className={styles.panel}><h3>Participation moyenne</h3><p>Présences sur la période sélectionnée.</p>{rows(participation, true)}</section>
      <section className={`${styles.panel} ${styles.wide}`}><div className={styles.panelHeading}><div><h3>Parcours PCNC</h3><p>Effectifs par niveau · pourcentages sur {total} personnes.</p></div><span className={styles.pill}>{pcncTotal} personnes engagées</span></div><div className={styles.stages}>{["Bienvenue dans le royaume", "Les fondements du royaume", "Les clés d’une croissance spirituelle", "Restauration et transformation"].map((label, i) => <div className={styles.stage} key={label}><span className={styles.stageNumber}>{["001", "101", "201", "301"][i]}</span><h4>{label}</h4><div className={styles.stageValue}><strong>{pcnc[i]}</strong><span>{percent(pcnc[i])}</span></div><div className={styles.track} aria-hidden="true"><span style={{ width: `${total ? Math.min(100, pcnc[i] / total * 100) : 0}%` }} /></div></div>)}</div></section>
      <section className={styles.panel}><h3>Engagement spirituel</h3><p>Souhaits exprimés et étapes accomplies.</p>{rows(engagement)}</section>
      {families && <section className={styles.panel}><h3>Affectation aux familles</h3><p>Répartition des personnes de la sélection.</p>{rows(families)}</section>}
    </div>
  </section>;
}
