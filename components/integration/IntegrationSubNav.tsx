"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Calendar, Church } from "lucide-react";
import { useWorkspace } from "@/lib/use-workspace";
import styles from "./IntegrationSubNav.module.css";

export default function IntegrationSubNav() {
  const pathname = usePathname();
  const workspace = useWorkspace();
  const isPlanning = pathname.startsWith("/dashboard/planning-integration");
  const isPositionnement = pathname.startsWith("/dashboard/positionnement-integration");
  const isReport = pathname.startsWith("/dashboard/bilan-integration");
  const canSeeReport = ["integration_responsable", "integration_second"].includes(workspace.role.toLowerCase());

  return (
    <nav className={styles.navWrapper} aria-label="Sous-navigation Département Intégration">
      <div className={styles.pillGroup}>
        <Link
          href="/dashboard/planning-integration"
          aria-current={isPlanning ? "page" : undefined}
          className={`${styles.pill} ${isPlanning ? styles.pillActive : ""}`}
        >
          <Calendar size={14} />
          <span>Services du mois</span>
        </Link>

        <Link
          href="/dashboard/positionnement-integration"
          aria-current={isPositionnement ? "page" : undefined}
          className={`${styles.pill} ${isPositionnement ? styles.pillActive : ""}`}
        >
          <Church size={14} />
          <span>Positions au culte</span>
        </Link>
        {canSeeReport && <Link
          href="/dashboard/bilan-integration"
          aria-current={isReport ? "page" : undefined}
          className={`${styles.pill} ${isReport ? styles.pillActive : ""}`}
        >
          <BarChart3 size={14} />
          <span>Bilan mensuel</span>
        </Link>}
      </div>
    </nav>
  );
}
