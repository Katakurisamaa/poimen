"use client";
import { useId, useRef, useState, type ReactNode } from "react";
import { Search, SlidersHorizontal, LayoutGrid, Table2, X, RotateCcw } from "lucide-react";
import styles from "./PeopleListToolbar.module.css";

type Props = {
  search: string; onSearch: (value: string) => void; countLabel: string;
  mode?: "cards" | "table"; onModeChange?: (mode: "cards" | "table") => void;
  showModes?: boolean; activeCount: number; onReset: () => void;
  period: string; children: ReactNode;
};
export default function PeopleListToolbar({ search, onSearch, countLabel, mode = "cards", onModeChange, showModes = false, activeCount, onReset, period, children }: Props) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  return <section className={styles.toolbar} aria-label="Recherche et filtres">
    <div className={styles.searchRow}>
      <label className={styles.search}><Search size={18} aria-hidden="true" /><input aria-label="Rechercher par nom ou prénom" placeholder="Nom ou prénom…" value={search} onChange={e => onSearch(e.target.value)} />{search && <button type="button" onClick={() => onSearch("")} aria-label="Effacer la recherche"><X size={16} /></button>}</label>
      <button type="button" ref={filterButtonRef} className={styles.filterButton} aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded(value => !value)}><SlidersHorizontal size={16} /> Filtres{activeCount > 0 && <span>{activeCount}</span>}</button>
    </div>
    <div className={styles.filters} id={id} data-expanded={expanded}>
      <div className={styles.filterHeading}><strong>Affiner la liste</strong>{(activeCount > 0 || search) && <button type="button" onClick={onReset}><RotateCcw size={14} /> Réinitialiser</button>}</div>
      <div className={styles.filterGrid}>{children}</div>
      <button type="button" className={styles.done} onClick={() => { setExpanded(false); filterButtonRef.current?.focus(); }}>Afficher les résultats</button>
    </div>
    <div className={styles.results}>
      <div className={styles.resultInfo}><strong aria-live="polite">{countLabel}</strong><span>{period}</span></div>
      {showModes && onModeChange && <div className={styles.modes} aria-label="Présentation de la liste">{([['cards', 'Cartes', LayoutGrid], ['table', 'Tableau', Table2]] as const).map(([value, label, Icon]) => <button key={value} type="button" aria-label={label} aria-pressed={mode === value} onClick={() => onModeChange(value)}><Icon size={15} /><span>{label}</span></button>)}</div>}
    </div>
  </section>;
}

