"use client";
import Link from "next/link";
import { Video } from "lucide-react";
import { getNavigation } from "@/lib/navigation";
import { useWorkspace } from "@/lib/use-workspace";
import styles from "./Experience.module.css";

export default function PeopleNavigation({ current }: { current: "members" | "guests" }) {
  const workspace = useWorkspace();
  const navigation = getNavigation(workspace);
  const isFamilyTab = current === "members";

  return <nav className={`${styles.peopleNavigation} ${styles.ui}`} aria-label="Catégories de personnes">
    {navigation.canSeeMembers && <Link href="/dashboard/bergerie" aria-current={current === "members" ? "page" : undefined}>Membres</Link>}
    {navigation.canSeeGuests && <Link href="/dashboard/invites" aria-current={current === "guests" ? "page" : undefined}>Invités</Link>}
    <Link 
      href={`/dashboard/visio?type=${isFamilyTab ? "family" : "integration"}`}
      style={{ display: "inline-flex", alignItems: "center", gap: 7 }}
      title={isFamilyTab ? "Démarrer la visio de cellule" : "Démarrer la visio d'équipe d'intégration"}
    >
      <Video size={15} color="#d4af37" />
      <span>{isFamilyTab ? "Visio Cellule" : "Visio Équipe"}</span>
    </Link>
    <span>Une fiche pour retrouver l’essentiel.</span>
  </nav>;
}
