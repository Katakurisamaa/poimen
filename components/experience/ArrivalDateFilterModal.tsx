"use client";

import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { 
  X, Calendar, CalendarDays, Check, Search, RotateCcw, 
  CalendarRange, CheckSquare, Square, ChevronLeft, ChevronRight 
} from "lucide-react";
import styles from "./ArrivalDateFilterModal.module.css";

const MONTH_NAMES_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
];

const WEEKDAY_NAMES_FR = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function formatFrenchDate(isoDate: string): { full: string; short: string; dayName: string } {
  if (!isoDate) return { full: "Non renseignée", short: "", dayName: "" };
  try {
    const [year, month, day] = isoDate.split("T")[0].split("-").map(Number);
    const dateObj = new Date(year, month - 1, day);
    const full = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(dateObj);
    const short = `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
    const dayName = new Intl.DateTimeFormat("fr-FR", { weekday: "long" }).format(dateObj);
    return {
      full: full.charAt(0).toUpperCase() + full.slice(1),
      short,
      dayName: dayName.charAt(0).toUpperCase() + dayName.slice(1)
    };
  } catch {
    return { full: isoDate, short: isoDate, dayName: "" };
  }
}

export interface ArrivalDateFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDates: string[];
  guests: { arrivalDate?: string }[];
  onApply: (dates: string[]) => void;
}

export default function ArrivalDateFilterModal({
  isOpen,
  onClose,
  selectedDates: initialDates,
  guests,
  onApply
}: ArrivalDateFilterModalProps) {
  const [activeTab, setActiveTab] = useState<"known" | "calendar" | "range">("known");
  const [localSelected, setLocalSelected] = useState<string[]>(initialDates || []);
  const [search, setSearch] = useState("");

  // Direct Calendar states
  const today = useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = useState<number>(() => today.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(() => today.getMonth());

  // Range states
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");

  // Sync on open
  useEffect(() => {
    if (isOpen) {
      setLocalSelected(initialDates || []);
      setSearch("");
      if (initialDates && initialDates.length > 0) {
        const first = initialDates[0];
        const parts = first.split("-").map(Number);
        if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1])) {
          setViewYear(parts[0]);
          setViewMonth(parts[1] - 1);
        }
      }
    }
  }, [isOpen, initialDates]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Aggregate distinct known arrival dates from guests
  const { knownDates, dateCounts } = useMemo(() => {
    const counts: Record<string, number> = {};
    guests.forEach(g => {
      if (g.arrivalDate) {
        counts[g.arrivalDate] = (counts[g.arrivalDate] || 0) + 1;
      }
    });
    const sorted = Object.keys(counts).sort().reverse();
    return {
      knownDates: sorted.map(d => ({
        date: d,
        count: counts[d],
        ...formatFrenchDate(d)
      })),
      dateCounts: counts
    };
  }, [guests]);

  // Filter known dates by search
  const filteredKnownDates = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return knownDates;
    return knownDates.filter(d =>
      d.full.toLowerCase().includes(q) ||
      d.short.includes(q) ||
      d.date.includes(q)
    );
  }, [knownDates, search]);

  // Calculate total matching guests for current local selection
  const matchingSoulsCount = useMemo(() => {
    if (localSelected.length === 0) return guests.length;
    return guests.filter(g => g.arrivalDate && localSelected.includes(g.arrivalDate)).length;
  }, [guests, localSelected]);

  // Toggle a single date
  const toggleDate = (dateStr: string) => {
    setLocalSelected(prev =>
      prev.includes(dateStr) ? prev.filter(d => d !== dateStr) : [...prev, dateStr].sort()
    );
  };

  // Select all / Deselect all
  const selectAllKnown = () => {
    setLocalSelected(knownDates.map(d => d.date));
  };

  const clearSelection = () => {
    setLocalSelected([]);
  };

  // Quick Presets
  const selectLatestCult = () => {
    if (knownDates.length > 0) {
      setLocalSelected([knownDates[0].date]);
    }
  };

  const selectLast2Cults = () => {
    if (knownDates.length > 0) {
      setLocalSelected(knownDates.slice(0, 2).map(d => d.date));
    }
  };

  const selectThisMonth = () => {
    const now = new Date();
    const ymPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const thisMonth = knownDates.filter(d => d.date.startsWith(ymPrefix)).map(d => d.date);
    if (thisMonth.length > 0) {
      setLocalSelected(thisMonth);
    }
  };

  const selectLast30Days = () => {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const recent = knownDates.filter(d => d.date >= cutoff).map(d => d.date);
    if (recent.length > 0) {
      setLocalSelected(recent);
    }
  };

  // Direct Calendar days
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(viewYear, viewMonth, 1);
    const lastDayOfMonth = new Date(viewYear, viewMonth + 1, 0);
    const numDays = lastDayOfMonth.getDate();

    let startingDayIndex = firstDayOfMonth.getDay() - 1;
    if (startingDayIndex === -1) startingDayIndex = 6;

    const days: ({ day: number; dateStr: string; isSunday: boolean; isToday: boolean; isSelected: boolean; guestCount: number } | null)[] = [];

    for (let i = 0; i < startingDayIndex; i++) {
      days.push(null);
    }

    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    for (let d = 1; d <= numDays; d++) {
      const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const dObj = new Date(viewYear, viewMonth, d);
      const isSunday = dObj.getDay() === 0;
      const isToday = dateStr === todayStr;
      const isSelected = localSelected.includes(dateStr);
      const guestCount = dateCounts[dateStr] || 0;

      days.push({ day: d, dateStr, isSunday, isToday, isSelected, guestCount });
    }

    return days;
  }, [viewYear, viewMonth, today, localSelected, dateCounts]);

  const selectAllSundaysInViewMonth = () => {
    const lastDay = new Date(viewYear, viewMonth + 1, 0).getDate();
    const monthSundays: string[] = [];
    for (let d = 1; d <= lastDay; d++) {
      const dObj = new Date(viewYear, viewMonth, d);
      if (dObj.getDay() === 0) {
        monthSundays.push(`${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
      }
    }
    const allAlready = monthSundays.every(s => localSelected.includes(s));
    setLocalSelected(prev =>
      allAlready ? prev.filter(d => !monthSundays.includes(d)) : Array.from(new Set([...prev, ...monthSundays])).sort()
    );
  };

  // Apply range
  const applyRange = () => {
    if (!rangeStart || !rangeEnd || rangeStart > rangeEnd) return;
    const matching = knownDates
      .filter(d => d.date >= rangeStart && d.date <= rangeEnd)
      .map(d => d.date);
    if (matching.length > 0) {
      setLocalSelected(matching);
    } else {
      // If none known, just set start & end
      setLocalSelected([rangeStart, rangeEnd]);
    }
  };

  const handleApply = () => {
    onApply(localSelected);
    onClose();
  };

  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-label="Filtrer par dates d'arrivée">
        {/* Header */}
        <header className={styles.header}>
          <div className={styles.headerTitle}>
            <div className={styles.headerIcon}>
              <Calendar size={20} />
            </div>
            <div className={styles.headerText}>
              <h3>Filtre des dates d’arrivée</h3>
              <p>Sélectionnez les dates pour affiner la liste et les statistiques</p>
            </div>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Fermer">
            <X size={18} />
          </button>
        </header>

        {/* Navigation Tabs */}
        <div className={styles.tabs} role="tablist">
          <button
            type="button"
            className={styles.tabBtn}
            role="tab"
            aria-selected={activeTab === "known"}
            onClick={() => setActiveTab("known")}
          >
            <CalendarDays size={14} /> Dates enregistrées ({knownDates.length})
          </button>
          <button
            type="button"
            className={styles.tabBtn}
            role="tab"
            aria-selected={activeTab === "calendar"}
            onClick={() => setActiveTab("calendar")}
          >
            <Calendar size={14} /> Calendrier direct
          </button>
          <button
            type="button"
            className={styles.tabBtn}
            role="tab"
            aria-selected={activeTab === "range"}
            onClick={() => setActiveTab("range")}
          >
            <CalendarRange size={14} /> Période
          </button>
        </div>

        {/* Content Body */}
        <div className={styles.content}>
          {/* TAB 1: Known dates from database */}
          {activeTab === "known" && (
            <>
              {/* Presets */}
              <div className={styles.presetsRow}>
                <button type="button" onClick={selectAllKnown} className={styles.presetBtn}>
                  <CheckSquare size={12} /> Tout cocher
                </button>
                <button type="button" onClick={clearSelection} className={styles.presetBtn}>
                  <Square size={12} /> Tout décocher
                </button>
                <button type="button" onClick={selectLatestCult} className={styles.presetBtn}>
                  Dernier culte
                </button>
                <button type="button" onClick={selectLast2Cults} className={styles.presetBtn}>
                  2 derniers cultes
                </button>
                <button type="button" onClick={selectThisMonth} className={styles.presetBtn}>
                  Ce mois
                </button>
                <button type="button" onClick={selectLast30Days} className={styles.presetBtn}>
                  30 derniers jours
                </button>
              </div>

              {/* Search input if multiple dates */}
              {knownDates.length > 4 && (
                <div className={styles.searchBar}>
                  <Search size={14} style={{ color: "var(--muted)" }} />
                  <input
                    type="text"
                    className={styles.searchInput}
                    placeholder="Rechercher une date (ex: 28 septembre, 2026)..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                  {search && (
                    <button type="button" onClick={() => setSearch("")} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer" }}>
                      <X size={13} />
                    </button>
                  )}
                </div>
              )}

              {/* Dates list */}
              {filteredKnownDates.length === 0 ? (
                <div style={{ textAlign: "center", padding: "30px 10px", color: "var(--muted)", fontSize: 13 }}>
                  Aucune date d’arrivée correspondante trouvée.
                </div>
              ) : (
                <div className={styles.datesList}>
                  {filteredKnownDates.map(item => {
                    const isSelected = localSelected.includes(item.date);
                    return (
                      <div
                        key={item.date}
                        className={styles.dateCard}
                        data-selected={isSelected}
                        onClick={() => toggleDate(item.date)}
                        role="checkbox"
                        aria-checked={isSelected}
                        tabIndex={0}
                        onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleDate(item.date); } }}
                      >
                        <div className={styles.dateCardInfo}>
                          <div className={styles.dateCheckbox}>
                            {isSelected && <Check size={12} strokeWidth={3} />}
                          </div>
                          <div>
                            <div className={styles.datePrimary}>{item.full}</div>
                            <div className={styles.dateSecondary}>{item.short}</div>
                          </div>
                        </div>
                        <div className={styles.dateBadge}>
                          {item.count} arrivée{item.count > 1 ? "s" : ""}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* TAB 2: Direct Calendar Selection (Month, Year, Days) */}
          {activeTab === "calendar" && (
            <div className={styles.calendarBox}>
              {/* Direct Jump Selector: Month & Year */}
              <div className={styles.directJumpRow}>
                <button
                  type="button"
                  onClick={() => {
                    if (viewMonth === 0) {
                      setViewMonth(11);
                      setViewYear(y => y - 1);
                    } else {
                      setViewMonth(m => m - 1);
                    }
                  }}
                  className={styles.presetBtn}
                  style={{ padding: "6px 8px" }}
                  aria-label="Mois précédent"
                >
                  <ChevronLeft size={16} />
                </button>

                <select
                  value={viewMonth}
                  onChange={e => setViewMonth(Number(e.target.value))}
                  className={styles.jumpSelect}
                  aria-label="Sélectionner le mois"
                >
                  {MONTH_NAMES_FR.map((name, i) => (
                    <option key={name} value={i}>{name}</option>
                  ))}
                </select>

                <select
                  value={viewYear}
                  onChange={e => setViewYear(Number(e.target.value))}
                  className={styles.jumpSelect}
                  aria-label="Sélectionner l'année"
                >
                  {Array.from({ length: 10 }, (_, i) => today.getFullYear() - 5 + i).map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => {
                    if (viewMonth === 11) {
                      setViewMonth(0);
                      setViewYear(y => y + 1);
                    } else {
                      setViewMonth(m => m + 1);
                    }
                  }}
                  className={styles.presetBtn}
                  style={{ padding: "6px 8px" }}
                  aria-label="Mois suivant"
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              {/* Shortcuts */}
              <div className={styles.presetsRow}>
                <button type="button" onClick={selectAllSundaysInViewMonth} className={styles.presetBtn}>
                  Dimanches de ce mois
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
                    toggleDate(todayStr);
                  }}
                  className={styles.presetBtn}
                >
                  Aujourd’hui
                </button>
                {localSelected.length > 0 && (
                  <button type="button" onClick={clearSelection} className={styles.presetBtn}>
                    Effacer la sélection
                  </button>
                )}
              </div>

              {/* Calendar Grid */}
              <div style={{ width: "100%", maxWidth: 340 }}>
                {/* Weekday names */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, textAlign: "center", marginBottom: 6 }}>
                  {WEEKDAY_NAMES_FR.map((wd, i) => (
                    <div key={wd} style={{ fontSize: 11, fontWeight: 700, color: i === 6 ? "var(--gold)" : "var(--muted)" }}>
                      {wd}
                    </div>
                  ))}
                </div>

                {/* Days */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
                  {calendarDays.map((item, idx) => {
                    if (!item) {
                      return <div key={`empty-${idx}`} style={{ aspectRatio: 1 }} />;
                    }
                    return (
                      <button
                        key={item.dateStr}
                        type="button"
                        onClick={() => toggleDate(item.dateStr)}
                        style={{
                          aspectRatio: 1,
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          borderRadius: 8,
                          border: item.isSelected ? "1px solid var(--gold)" : item.isToday ? "1px dashed var(--gold)" : "1px solid transparent",
                          background: item.isSelected ? "var(--gold)" : item.guestCount > 0 ? "rgba(212, 175, 55, 0.12)" : "rgba(255, 255, 255, 0.03)",
                          color: item.isSelected ? "#000" : item.isSunday ? "var(--gold-light)" : "var(--cream)",
                          fontWeight: item.isSelected ? 750 : 600,
                          fontSize: 12,
                          cursor: "pointer",
                          position: "relative",
                          transition: "all 0.12s ease"
                        }}
                        title={item.guestCount > 0 ? `${item.guestCount} arrivée(s) ce jour` : item.dateStr}
                      >
                        <span>{item.day}</span>
                        {item.guestCount > 0 && (
                          <span
                            style={{
                              width: 4,
                              height: 4,
                              borderRadius: "50%",
                              background: item.isSelected ? "#000" : "var(--gold)",
                              position: "absolute",
                              bottom: 2
                            }}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Range / Interval */}
          {activeTab === "range" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "10px 0" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--gold-light)", marginBottom: 6 }}>
                    DATE DE DÉBUT
                  </label>
                  <input
                    type="date"
                    className="input"
                    value={rangeStart}
                    onChange={e => setRangeStart(e.target.value)}
                    style={{ width: "100%", height: 40, padding: "0 10px" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--gold-light)", marginBottom: 6 }}>
                    DATE DE FIN
                  </label>
                  <input
                    type="date"
                    className="input"
                    value={rangeEnd}
                    onChange={e => setRangeEnd(e.target.value)}
                    style={{ width: "100%", height: 40, padding: "0 10px" }}
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={applyRange}
                disabled={!rangeStart || !rangeEnd || rangeStart > rangeEnd}
                className="btn btn-primary"
                style={{ width: "100%", justifyContent: "center" }}
              >
                Sélectionner les arrivées de cette période
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className={styles.footer}>
          <div className={styles.footerSummary}>
            {localSelected.length === 0 ? (
              <span>Toutes les dates d'arrivée (<strong>{guests.length}</strong> âmes)</span>
            ) : (
              <span>
                <strong>{localSelected.length}</strong> date{localSelected.length > 1 ? "s" : ""} sélectionnée{localSelected.length > 1 ? "s" : ""} · <strong>{matchingSoulsCount}</strong> âme{matchingSoulsCount > 1 ? "s" : ""}
              </span>
            )}
          </div>

          <div className={styles.footerActions}>
            {localSelected.length > 0 && (
              <button type="button" onClick={clearSelection} className={styles.btnClear}>
                <RotateCcw size={12} style={{ marginRight: 4 }} /> Tout effacer
              </button>
            )}
            <button type="button" onClick={handleApply} className={styles.btnApply}>
              <Check size={14} /> Appliquer
            </button>
          </div>
        </footer>
      </div>
    </div>,
    document.body
  );
}
