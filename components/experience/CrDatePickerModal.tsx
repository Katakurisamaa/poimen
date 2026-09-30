"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X, CalendarDays, Search, Check, Sparkles, AlertCircle, Layers } from "lucide-react";
import { type CrGuest } from "@/lib/cr-call-center";
import styles from "./CrDatePickerModal.module.css";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  mode: "single" | "range" | "all";
  selectedDate: string;
  startDate: string;
  endDate: string;
  guests: CrGuest[];
  onApply: (mode: "single" | "range" | "all", selectedDate: string, startDate: string, endDate: string) => void;
}

function formatFrenchDate(isoDate: string): { full: string; short: string; dayName: string } {
  if (!isoDate) return { full: "Non renseignée", short: "", dayName: "" };
  try {
    const [year, month, day] = isoDate.split("T")[0].split("-").map(Number);
    const dateObj = new Date(year, month - 1, day);
    const full = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(dateObj);
    const dayName = new Intl.DateTimeFormat("fr-FR", { weekday: "long" }).format(dateObj);
    const short = `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
    return {
      full: full.charAt(0).toUpperCase() + full.slice(1),
      short,
      dayName: dayName.charAt(0).toUpperCase() + dayName.slice(1),
    };
  } catch {
    return { full: isoDate, short: isoDate, dayName: "" };
  }
}

export default function CrDatePickerModal({
  isOpen,
  onClose,
  mode: initialMode,
  selectedDate: initialSelectedDate,
  startDate: initialStartDate,
  endDate: initialEndDate,
  guests,
  onApply,
}: Props) {
  const [localMode, setLocalMode] = useState<"single" | "range" | "all">(initialMode);
  const [localSelectedDate, setLocalSelectedDate] = useState(initialSelectedDate);
  const [localStart, setLocalStart] = useState(initialStartDate);
  const [localEnd, setLocalEnd] = useState(initialEndDate);
  const [search, setSearch] = useState("");

  // Sync state whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setLocalMode(initialMode);
      setLocalSelectedDate(initialSelectedDate);
      setLocalStart(initialStartDate);
      setLocalEnd(initialEndDate);
      setSearch("");
    }
  }, [isOpen, initialMode, initialSelectedDate, initialStartDate, initialEndDate]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Aggregate distinct dates and guest count per date
  const { dateEntries, allDates } = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const g of guests) {
      if (g.arrivalDate) {
        counts[g.arrivalDate] = (counts[g.arrivalDate] || 0) + 1;
      }
    }
    const sorted = Object.keys(counts).sort().reverse();
    return {
      dateEntries: sorted.map(d => ({ date: d, count: counts[d], ...formatFrenchDate(d) })),
      allDates: sorted,
    };
  }, [guests]);

  // Default fallback if selected is empty
  useEffect(() => {
    if (!localSelectedDate && allDates.length > 0) {
      setLocalSelectedDate(allDates[0]);
    }
    if (!localStart && allDates.length > 0) {
      setLocalStart(allDates[allDates.length - 1]);
    }
    if (!localEnd && allDates.length > 0) {
      setLocalEnd(allDates[0]);
    }
  }, [localSelectedDate, localStart, localEnd, allDates]);

  // Filtered date list for search
  const filteredDates = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return dateEntries;
    return dateEntries.filter(d =>
      d.full.toLowerCase().includes(q) ||
      d.short.includes(q) ||
      d.date.includes(q)
    );
  }, [dateEntries, search]);

  // Count preview based on current local selection
  const isRangeInvalid = localMode === "range" && (!localStart || !localEnd || localStart > localEnd);
  const matchingCount = useMemo(() => {
    if (localMode === "all") return guests.length;
    if (localMode === "single") return guests.filter(g => g.arrivalDate === localSelectedDate).length;
    if (localMode === "range") {
      if (isRangeInvalid) return 0;
      return guests.filter(g => Boolean(g.arrivalDate && g.arrivalDate >= localStart && g.arrivalDate <= localEnd)).length;
    }
    return 0;
  }, [localMode, localSelectedDate, localStart, localEnd, isRangeInvalid, guests]);

  // Presets handlers for range
  function applyPreset(type: "latest" | "last2" | "month" | "30days") {
    if (allDates.length === 0) return;
    const latest = allDates[0];
    if (type === "latest") {
      setLocalStart(latest);
      setLocalEnd(latest);
    } else if (type === "last2") {
      const secondLatest = allDates.length > 1 ? allDates[1] : allDates[0];
      setLocalStart(secondLatest);
      setLocalEnd(latest);
    } else if (type === "month") {
      const now = new Date();
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      const today = now.toISOString().split("T")[0];
      setLocalStart(firstOfMonth);
      setLocalEnd(today);
    } else if (type === "30days") {
      const now = new Date();
      const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const today = now.toISOString().split("T")[0];
      setLocalStart(past30);
      setLocalEnd(today);
    }
  }

  function handleSave() {
    if (isRangeInvalid) return;
    onApply(localMode, localSelectedDate, localStart, localEnd);
    onClose();
  }

  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.modal} role="dialog" aria-modal="true">
        <header className={styles.header}>
          <div className={styles.headerTitle}>
            <div className={styles.headerIcon}>
              <CalendarDays size={22} />
            </div>
            <div className={styles.headerText}>
              <h3>Période d’accueil du Call Center</h3>
              <p>Sélectionnez les invités à inclure dans le compte rendu</p>
            </div>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Fermer la sélection">
            <X size={18} />
          </button>
        </header>

        {/* Tab switcher */}
        <div className={styles.tabs} role="tablist">
          <button
            type="button"
            className={styles.tabBtn}
            role="tab"
            aria-selected={localMode === "single"}
            onClick={() => setLocalMode("single")}
          >
            <CalendarDays size={14} /> Un dimanche / Une date
          </button>
          <button
            type="button"
            className={styles.tabBtn}
            role="tab"
            aria-selected={localMode === "range"}
            onClick={() => setLocalMode("range")}
          >
            <Sparkles size={14} /> Période
          </button>
          <button
            type="button"
            className={styles.tabBtn}
            role="tab"
            aria-selected={localMode === "all"}
            onClick={() => setLocalMode("all")}
          >
            <Layers size={14} /> Tout l’historique
          </button>
        </div>

        <div className={styles.content}>
          {/* Mode 1: Single Date */}
          {localMode === "single" && (
            <div>
              {dateEntries.length > 5 && (
                <div className={styles.searchBar}>
                  <input
                    type="text"
                    className={styles.searchInput}
                    placeholder="Rechercher une date (ex: 28 juin, 2026)..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
              )}
              {filteredDates.length === 0 ? (
                <div style={{ textAlign: "center", padding: "30px 10px", color: "#a0aec0", fontSize: 13 }}>
                  Aucune date d’accueil trouvée.
                </div>
              ) : (
                <div className={styles.dateList}>
                  {filteredDates.map(item => {
                    const isSelected = localSelectedDate === item.date;
                    return (
                      <button
                        type="button"
                        key={item.date}
                        className={styles.dateCard}
                        data-selected={isSelected}
                        onClick={() => setLocalSelectedDate(item.date)}
                      >
                        <div className={styles.dateCardInfo}>
                          <div className={styles.dateRadio}>
                            {isSelected && <div className={styles.dateRadioInner} />}
                          </div>
                          <div>
                            <div className={styles.datePrimary}>{item.full}</div>
                            <div className={styles.dateSecondary}>{item.short}</div>
                          </div>
                        </div>
                        <div className={styles.dateBadge}>
                          {item.count} invité{item.count > 1 ? "s" : ""}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Mode 2: Range */}
          {localMode === "range" && (
            <div className={styles.rangeSection}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#a0aec0", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: 8 }}>
                  Raccourcis rapides
                </span>
                <div className={styles.presetsGrid}>
                  <button type="button" className={styles.presetBtn} onClick={() => applyPreset("latest")}>
                    Dernier dimanche
                  </button>
                  <button type="button" className={styles.presetBtn} onClick={() => applyPreset("last2")}>
                    2 derniers dimanches
                  </button>
                  <button type="button" className={styles.presetBtn} onClick={() => applyPreset("month")}>
                    Ce mois-ci
                  </button>
                  <button type="button" className={styles.presetBtn} onClick={() => applyPreset("30days")}>
                    30 derniers jours
                  </button>
                </div>
              </div>

              <div className={styles.rangeInputs}>
                <div className={styles.inputGroup}>
                  <label htmlFor="cr-date-start">Date de début</label>
                  <input
                    id="cr-date-start"
                    type="date"
                    value={localStart}
                    onChange={e => setLocalStart(e.target.value)}
                  />
                </div>
                <div className={styles.inputGroup}>
                  <label htmlFor="cr-date-end">Date de fin</label>
                  <input
                    id="cr-date-end"
                    type="date"
                    value={localEnd}
                    onChange={e => setLocalEnd(e.target.value)}
                  />
                </div>
              </div>

              {isRangeInvalid ? (
                <div className={`${styles.rangeStatus} ${styles.rangeError}`}>
                  <AlertCircle size={16} />
                  <span>La date de fin doit être postérieure ou égale à la date de début.</span>
                </div>
              ) : (
                <div className={styles.rangeStatus}>
                  <Check size={16} style={{ color: "#e3c580" }} />
                  <span>
                    <strong>{matchingCount}</strong> invité{matchingCount > 1 ? "s" : ""} correspondent à cette plage sélectionnée.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Mode 3: All history */}
          {localMode === "all" && (
            <div className={styles.allCard}>
              <Layers size={36} style={{ color: "#e3c580", margin: "0 auto" }} />
              <h4>Inclure tous les dimanches & dates</h4>
              <p>
                Le compte rendu agrégera l’ensemble des <strong>{guests.length} invités</strong> enregistrés dans la base (y compris les fiches sans date d’arrivée renseignée).
              </p>
            </div>
          )}
        </div>

        <footer className={styles.footer}>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>
            Annuler
          </button>
          <button
            type="button"
            className={styles.applyBtn}
            onClick={handleSave}
            disabled={isRangeInvalid}
          >
            Valider la sélection ({matchingCount} invité{matchingCount > 1 ? "s" : ""})
          </button>
        </footer>
      </div>
    </div>,
    document.body
  );
}
