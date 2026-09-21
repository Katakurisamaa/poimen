"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, Church } from "lucide-react";
import styles from "./IntegrationSubNav.module.css";

export default function IntegrationSubNav() {
  const pathname = usePathname();
  const isPlanning = pathname.startsWith("/dashboard/planning-integration");
  const isPositionnement = pathname.startsWith("/dashboard/positionnement-integration");

  return (
    <nav className={styles.navWrapper} aria-label="Sous-navigation Département Intégration">
      <div className={styles.pillGroup}>
        <Link
          href="/dashboard/planning-integration"
          className={`${styles.pill} ${isPlanning ? styles.pillActive : ""}`}
        >
          <Calendar size={14} />
          <span>Services du mois</span>
        </Link>

        <Link
          href="/dashboard/positionnement-integration"
          className={`${styles.pill} ${isPositionnement ? styles.pillActive : ""}`}
        >
          <Church size={14} />
          <span>Positions au culte</span>
        </Link>
      </div>
    </nav>
  );
}
