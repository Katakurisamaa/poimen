"use client";
import Link from "next/link";
import { getNavigation } from "@/lib/navigation";
import { useWorkspace } from "@/lib/use-workspace";
import styles from "./Experience.module.css";
export default function PeopleNavigation({ current }: { current: "members" | "guests" }) {
  const workspace = useWorkspace();
  const navigation = getNavigation(workspace);
  return <nav className={`${styles.peopleNavigation} ${styles.ui}`} aria-label="Catégories de personnes">
    {navigation.canSeeMembers && <Link href="/dashboard/bergerie" aria-current={current === "members" ? "page" : undefined}>Membres</Link>}
    {navigation.canSeeGuests && <Link href="/dashboard/invites" aria-current={current === "guests" ? "page" : undefined}>Invités</Link>}
    <span>Une fiche pour retrouver l’essentiel.</span>
  </nav>;
}
