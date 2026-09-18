"use client";
import Link from "next/link";
import { ArrowRight, CalendarDays, CheckCheck, FileText, Phone, UserPlus, Users } from "lucide-react";
import { getNavigation } from "@/lib/navigation";
import { useWorkspace } from "@/lib/use-workspace";
import styles from "./Experience.module.css";

export type TodayData = { status: "loading" | "ready" | "error"; pending: number; unassigned: number; contacts: { id: string; name: string }[] };
export default function TodayActions({ data, upcoming, onRetry }: { data: TodayData; upcoming?: { title: string; date: string; time: string; actId?: string; type?: string }; onRetry: () => void }) {
  const workspace = useWorkspace();
  const { primary, secondary, canSeeGuests, canSeeMembers } = getNavigation(workspace);
  const hasActivities = primary.some(item => item.href === "/dashboard/activities");
  const hasReports = secondary.some(item => item.href === "/dashboard/reporting");
  const canAssign = canSeeMembers || ["integration_responsable", "integration_second"].includes(workspace.role);
  const canCreateGuest = ["integration_responsable", "integration_second", "integration_conseiller", "conseiller"].includes(workspace.role.toLowerCase().trim());
  const peopleRoute = canSeeGuests ? "/dashboard/invites" : "/dashboard/affectation";
  const activityTarget = upcoming?.actId || upcoming?.type;
  const activityHref = activityTarget ? `/dashboard/activities?activityId=${encodeURIComponent(activityTarget)}` : "/dashboard/activities";

  return <section className={`${styles.today} ${styles.ui}`} aria-labelledby="today-title">
    <div className={styles.sectionHeading}><div><span className={styles.kicker}>VOTRE QUOTIDIEN</span><h2 id="today-title">L’essentiel, aujourd’hui.</h2><p>Retrouvez les personnes et les actions qui vous attendent.</p></div><span className={styles.todayMark}><CheckCheck size={26} /></span></div>
    {data.status === "loading" ? <p className={styles.help} role="status">Chargement de vos priorités…</p> : data.status === "error" ? <div className={styles.actions}><p role="alert">Vos priorités n’ont pas pu être chargées.</p><button type="button" className={styles.secondary} onClick={onRetry}>Réessayer</button></div> : <>
      <div className={styles.priorityGrid}>
        <Link href={`${peopleRoute}?view=contact`} className={styles.priorityCard}><span><Phone size={20} />SUIVI DES INVITÉS</span><strong>{data.pending}</strong><p>{data.pending === 0 ? "Aucun premier contact en attente" : "Contacts à établir"}</p><small>Ouvrir la liste<ArrowRight size={16} /></small></Link>
        {canAssign && <Link href={`${peopleRoute}?view=unassigned`} className={styles.priorityCard}><span><Users size={20} />ACCOMPAGNEMENT</span><strong>{data.unassigned}</strong><p>{data.unassigned === 0 ? "Chaque invité a un responsable" : "Invités à affecter"}</p><small>Voir les personnes<ArrowRight size={16} /></small></Link>}
        {hasActivities && <Link href={activityHref} className={styles.priorityCard}><span><CalendarDays size={20} />PROCHAINE ACTIVITÉ</span><h3>{upcoming?.title || "Votre calendrier"}</h3><p>{upcoming ? `${upcoming.date} · ${upcoming.time || "Horaire à préciser"}` : "Consulter ou préparer les prochaines rencontres"}</p><small>Accéder au pointage<ArrowRight size={16} /></small></Link>}
        {hasReports && <Link href="/dashboard/reporting" className={styles.priorityCard}><span><FileText size={20} />RAPPORT AU PASTEUR</span><h3>Rapport hebdomadaire</h3><p>Compléter ou exporter le rapport destiné au pasteur</p><small>Accéder au rapport<ArrowRight size={16} /></small></Link>}
      </div>
      {data.contacts.length > 0 && <div className={styles.contactQueue}><span className={styles.kicker}>COMMENCER PAR UNE PERSONNE</span>{data.contacts.map(person => <Link key={person.id} href={`${peopleRoute}?person=${encodeURIComponent(person.id)}`}><span className={styles.avatar}>{person.name.split(" ").map(part => part[0]).slice(0, 2).join("")}</span><span><strong>{person.name}</strong><small>Premier contact à établir</small></span><ArrowRight size={17} /></Link>)}</div>}
    </>}
    <div className={styles.quickActions}>{canCreateGuest && <Link href="/dashboard/invites?new=1"><UserPlus size={17} />Ajouter un invité</Link>}{hasReports && <Link href="/dashboard/reporting"><FileText size={17} />Rapport au pasteur</Link>}<Link href="/dashboard/affectation"><ArrowRight size={17} />Ouvrir mon suivi</Link></div>
  </section>;
}
