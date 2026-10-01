"use client";
import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import styles from "./IntegrationOverview.module.css";
export type OverviewItem = { label: string; value: number; detail: string; icon: ReactNode; onClick?: () => void };
export default function IntegrationOverview({ items }: { items: OverviewItem[] }) {
  return <section className={styles.overview} aria-label="Vue d’ensemble">{items.map(item => {
    const content = <><span className={styles.top}><span className={styles.icon}>{item.icon}</span><span>{item.label}</span>{item.onClick && <ArrowUpRight size={16} className={styles.arrow} />}</span><strong className={styles.value}>{item.value}</strong><span className={styles.detail}>{item.detail}</span></>;
    return item.onClick ? <button key={item.label} type="button" className={styles.item} onClick={item.onClick}>{content}</button> : <div key={item.label} className={styles.item}>{content}</div>;
  })}</section>;
}
