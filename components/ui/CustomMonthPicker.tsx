"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import styles from "./CustomMonthPicker.module.css";

const MONTH_NAMES_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
];

export interface CustomMonthPickerProps {
  value: string; // Format: "YYYY-MM"
  onChange: (monthStr: string) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
}

export default function CustomMonthPicker({
  value,
  onChange,
  placeholder = "Sélectionner un mois",
  className,
  style,
  disabled = false,
}: CustomMonthPickerProps) {
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Parse current selected value
  const parsed = useMemo(() => {
    if (!value) return null;
    const parts = value.split("-").map(Number);
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      return { year: parts[0], month: parts[1] - 1 };
    }
    return null;
  }, [value]);

  const today = useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = useState<number>(() => parsed?.year || today.getFullYear());

  useEffect(() => {
    if (parsed) {
      setViewYear(parsed.year);
    }
  }, [parsed]);

  // Mobile viewport detection
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 640);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Outside click & escape listeners
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  const handleSelectMonth = (monthIndex: number) => {
    const mm = String(monthIndex + 1).padStart(2, "0");
    onChange(`${viewYear}-${mm}`);
    setOpen(false);
  };

  const handleSelectCurrent = () => {
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    setViewYear(yyyy);
    onChange(`${yyyy}-${mm}`);
    setOpen(false);
  };

  // Formatted trigger label
  const formattedDisplay = useMemo(() => {
    if (!parsed) return placeholder;
    return `${MONTH_NAMES_FR[parsed.month]} ${parsed.year}`;
  }, [parsed, placeholder]);

  return (
    <div className={`${styles.wrapper} ${className || ""}`} style={style} ref={wrapperRef}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className={`${styles.trigger} ${open ? styles.triggerActive : ""}`}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <CalendarIcon size={15} className={styles.calendarIcon} />
        <span className={!parsed ? styles.placeholder : ""}>{formattedDisplay}</span>
      </button>

      {/* Popover / Mobile Sheet */}
      {open && (
        <>
          {isMobile && <div className={styles.backdrop} onClick={() => setOpen(false)} />}

          <div
            className={`${styles.popover} ${isMobile ? styles.popoverMobile : ""}`}
            role="dialog"
            aria-label="Choisir un mois"
          >
            {isMobile && <div className={styles.dragHandle} />}

            {/* Year Selector */}
            <div className={styles.yearHeader}>
              <button
                type="button"
                onClick={() => setViewYear((y) => y - 1)}
                className={styles.navButton}
                aria-label="Année précédente"
              >
                <ChevronLeft size={16} />
              </button>
              <span className={styles.yearTitle}>{viewYear}</span>
              <button
                type="button"
                onClick={() => setViewYear((y) => y + 1)}
                className={styles.navButton}
                aria-label="Année suivante"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Months Grid */}
            <div className={styles.monthsGrid}>
              {MONTH_NAMES_FR.map((name, idx) => {
                const isSelected = parsed?.year === viewYear && parsed?.month === idx;
                const isCurrent = today.getFullYear() === viewYear && today.getMonth() === idx;

                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => handleSelectMonth(idx)}
                    className={`${styles.monthCell} ${isSelected ? styles.monthSelected : ""} ${
                      isCurrent ? styles.monthCurrent : ""
                    }`}
                  >
                    {name.slice(0, 4)}.
                  </button>
                );
              })}
            </div>

            {/* Current Month shortcut */}
            <div className={styles.footer}>
              <button type="button" onClick={handleSelectCurrent} className={styles.currentBtn}>
                Mois en cours ({MONTH_NAMES_FR[today.getMonth()]})
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
