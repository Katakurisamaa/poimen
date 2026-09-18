"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { CalendarDays, Church, FileText, Globe, House, ListChecks, LogOut, MoreHorizontal, ShieldCheck, UserRound, Users, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { clearActiveSpace } from "@/lib/client-session";
import { getNavigation, isNavigationActive, roleLabel, type NavItem } from "@/lib/navigation";
import { useWorkspace } from "@/lib/use-workspace";
import { useFeedback } from "@/components/experience/FeedbackProvider";
import styles from "@/components/experience/Experience.module.css";
import PoimenLogo from "@/components/brand/PoimenLogo";

const ICONS = { home: House, people: Users, followup: ListChecks, calendar: CalendarDays, report: FileText, team: Users, outreach: Globe, profile: UserRound, admin: ShieldCheck, church: Church };
type Props = { mobileOpen?: boolean; onToggleMobile?: () => void };
export default function Sidebar(props: Props) {
  return <Suspense fallback={null}><Navigation {...props} /></Suspense>;
}
function Navigation({ mobileOpen, onToggleMobile }: Props) {
  const workspace = useWorkspace();
  const pathname = usePathname();
  const params = useSearchParams();
  const { notify } = useFeedback();
  const { primary, secondary } = getNavigation(workspace);
  const [moreOpen, setMoreOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const open = moreOpen || !!mobileOpen;
  const close = () => { setMoreOpen(false); onToggleMobile?.(); };
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    return () => { dialog.close(); document.body.style.overflow = previousOverflow; };
  }, [open]);
  if (!workspace.active) return null;
  const active = (item: NavItem) => isNavigationActive(item, pathname, params.get("tab"));
  const links = (items: NavItem[], detailed = false) => items.map(item => {
    const Icon = ICONS[item.icon];
    return <Link key={item.href} href={item.href} className={`${styles.navLink} ${active(item) ? styles.selected : ""}`} aria-current={active(item) ? "page" : undefined} onClick={close}>
      <Icon size={20} /><span>{item.label}{detailed && <small>{item.description}</small>}</span>
    </Link>;
  });
  const signOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      localStorage.setItem("poimen_logging_out", "true");
      clearActiveSpace();
      window.location.href = "/";
    } catch { notify("La déconnexion a échoué. Réessayez."); setSigningOut(false); }
  };
  return <>
    <aside className={`${styles.rail} ${styles.ui}`} aria-label="Navigation principale">
      <Link className={styles.brandLink} href={primary[0]?.href || "/dashboard/affectation"} aria-label="Poimén — accueil de votre espace"><PoimenLogo decorative /></Link>
      <div className={styles.railContext}><Church size={17} /><span>{workspace.churchName}</span></div>
      <nav><span className={styles.navCaption}>AU QUOTIDIEN</span>{links(primary)}<span className={styles.navCaption}>VOTRE ESPACE</span>{links(secondary)}</nav>
      <div className={styles.railAccount}><span className={styles.avatar}>{workspace.name.split(" ").map(part => part[0]).slice(0, 2).join("") || "P"}</span><div><strong>{workspace.name || "Mon compte"}</strong><small>{roleLabel(workspace.role)}</small></div><button type="button" className={styles.iconButton} aria-label="Se déconnecter" disabled={signingOut} onClick={() => void signOut()}><LogOut size={18} /></button></div>
    </aside>
    <nav className={`${styles.bottomNav} ${styles.ui}`} aria-label="Navigation principale mobile">
      {primary.map(item => { const Icon = ICONS[item.icon]; return <Link key={item.href} href={item.href} className={active(item) && !open ? styles.selected : ""} aria-current={active(item) ? "page" : undefined}><Icon size={21} /><span>{item.label}</span></Link>; })}
      <button type="button" className={open || secondary.some(active) ? styles.selected : ""} aria-label="Plus de rubriques" aria-haspopup="dialog" aria-expanded={open} onClick={() => setMoreOpen(true)}><MoreHorizontal size={22} /><span>Plus</span></button>
    </nav>
    <dialog ref={dialogRef} className={`${styles.menuDialog} ${styles.ui}`} aria-labelledby="more-title" onCancel={event => { event.preventDefault(); close(); }}>
      <PoimenLogo />
      <div className={styles.sectionHeading} style={{ marginTop: 24 }}><div><span className={styles.kicker}>VOTRE ESPACE</span><h2 id="more-title">Toutes les rubriques</h2></div><button type="button" className={styles.iconButton} aria-label="Fermer le menu" onClick={close} autoFocus><X size={20} /></button></div>
      <nav aria-label="Toutes les rubriques">{links(primary, true)}<hr />{links(secondary, true)}</nav>
      <button type="button" className={styles.secondary} disabled={signingOut} onClick={() => void signOut()}><LogOut size={17} />{signingOut ? "Déconnexion…" : "Se déconnecter"}</button>
    </dialog>
  </>;
}
