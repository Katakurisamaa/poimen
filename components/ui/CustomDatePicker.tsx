"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X, Check } from "lucide-react";
import styles from "./CustomDatePicker.module.css";

const MONTH_NAMES_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
];

const WEEKDAY_NAMES_FR = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

export interface CustomDatePickerProps {
  value?: string | string[]; // Format: "YYYY-MM-DD" or comma-separated or array
  onChange?: (dateStr: string) => void;
  values?: string[];
  onChangeMultiple?: (dates: string[]) => void;
  multiple?: boolean;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
  clearable?: boolean;
  size?: "sm" | "md";
}

export default function CustomDatePicker({
  value,
  onChange,
  values,
  onChangeMultiple,
  multiple = false,
  placeholder = "Sélectionner une date",
  className,
  style,
  disabled = false,
  clearable = false,
  size = "md",
}: CustomDatePickerProps) {
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const wrapperRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Normalize selected dates list
  const selectedDates: string[] = useMemo(() => {
    if (Array.isArray(values)) return values.filter(Boolean);
    if (Array.isArray(value)) return value.filter(Boolean);
    if (typeof value === "string" && value) {
      if (value.includes(",")) return value.split(",").map(s => s.trim()).filter(Boolean);
      return [value];
    }
    return [];
  }, [value, values]);

  // Parse first selected date for initial view calendar positioning
  const parsedDate = useMemo(() => {
    const first = selectedDates[0];
    if (!first) return null;
    const parts = first.split("-").map(Number);
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      return new Date(parts[0], parts[1] - 1, parts[2]);
    }
    return null;
  }, [selectedDates]);

  // Calendar view year and month
  const today = useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = useState<number>(() => parsedDate?.getFullYear() || today.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(() => parsedDate ? parsedDate.getMonth() : today.getMonth());

  // Keep view aligned when value changes externally
  useEffect(() => {
    if (parsedDate) {
      setViewYear(parsedDate.getFullYear());
      setViewMonth(parsedDate.getMonth());
    }
  }, [parsedDate]);

  // Mobile viewport detection
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Calculate popover positioning
  const updatePosition = () => {
    if (wrapperRef.current && !isMobile) {
      const rect = wrapperRef.current.getBoundingClientRect();
      const popoverWidth = 290;
      let left = rect.left;
      if (left + popoverWidth > window.innerWidth - 12) {
        left = window.innerWidth - popoverWidth - 12;
      }
      setPopoverPos({
        top: rect.bottom + 6,
        left: Math.max(12, left),
      });
    }
  };

  useEffect(() => {
    if (open) {
      updatePosition();
      window.addEventListener("scroll", updatePosition, true);
      window.addEventListener("resize", updatePosition);
      return () => {
        window.removeEventListener("scroll", updatePosition, true);
        window.removeEventListener("resize", updatePosition);
      };
    }
  }, [open, isMobile]);

  // Outside click & escape listeners
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(target) &&
        popoverRef.current &&
        !popoverRef.current.contains(target)
      ) {
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

  // Navigate months
  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  // Build grid of days for viewMonth & viewYear
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(viewYear, viewMonth, 1);
    const lastDayOfMonth = new Date(viewYear, viewMonth + 1, 0);
    const numDays = lastDayOfMonth.getDate();

    let startingDayIndex = firstDayOfMonth.getDay() - 1;
    if (startingDayIndex === -1) startingDayIndex = 6;

    const days: ({ day: number; dateStr: string; isSunday: boolean; isToday: boolean; isSelected: boolean } | null)[] = [];

    for (let i = 0; i < startingDayIndex; i++) {
      days.push(null);
    }

    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    for (let d = 1; d <= numDays; d++) {
      const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const dObj = new Date(viewYear, viewMonth, d);
      const isSunday = dObj.getDay() === 0;
      const isToday = dateStr === todayStr;
      const isSelected = selectedDates.includes(dateStr);

      days.push({ day: d, dateStr, isSunday, isToday, isSelected });
    }

    return days;
  }, [viewYear, viewMonth, today, selectedDates]);

  const handleSelectDate = (dateStr: string) => {
    if (multiple) {
      const exists = selectedDates.includes(dateStr);
      const nextDates = exists
        ? selectedDates.filter((d) => d !== dateStr)
        : [...selectedDates, dateStr].sort();
      onChangeMultiple?.(nextDates);
      onChange?.(nextDates.join(","));
    } else {
      onChange?.(dateStr);
      onChangeMultiple?.([dateStr]);
      setOpen(false);
    }
  };

  const handleClear = () => {
    onChange?.("");
    onChangeMultiple?.([]);
  };

  // Quick shortcuts
  const selectToday = () => {
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    handleSelectDate(dateStr);
  };

  const selectNextSunday = () => {
    const d = new Date();
    const day = d.getDay();
    const daysUntilSunday = day === 0 ? 0 : 7 - day;
    const nextSunday = new Date(d);
    nextSunday.setDate(d.getDate() + daysUntilSunday);
    const dateStr = `${nextSunday.getFullYear()}-${String(nextSunday.getMonth() + 1).padStart(2, "0")}-${String(nextSunday.getDate()).padStart(2, "0")}`;
    handleSelectDate(dateStr);
  };

  const selectAllSundaysInMonth = () => {
    const lastDay = new Date(viewYear, viewMonth + 1, 0).getDate();
    const monthSundays: string[] = [];
    for (let d = 1; d <= lastDay; d++) {
      const dObj = new Date(viewYear, viewMonth, d);
      if (dObj.getDay() === 0) {
        monthSundays.push(`${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
      }
    }
    const allAlready = monthSundays.every((s) => selectedDates.includes(s));
    const nextDates = allAlready
      ? selectedDates.filter((d) => !monthSundays.includes(d))
      : Array.from(new Set([...selectedDates, ...monthSundays])).sort();
    onChangeMultiple?.(nextDates);
    onChange?.(nextDates.join(","));
  };

  // Formatted trigger label
  const formattedDisplay = useMemo(() => {
    if (selectedDates.length === 0) return placeholder;
    if (selectedDates.length === 1) {
      const parts = selectedDates[0].split("-").map(Number);
      if (parts.length === 3 && !isNaN(parts[0])) {
        const d = new Date(parts[0], parts[1] - 1, parts[2]);
        const dayName = ["Dim.", "Lun.", "Mar.", "Mer.", "Jeu.", "Ven.", "Sam."][d.getDay()];
        const dayNum = String(d.getDate()).padStart(2, "0");
        const monthName = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."][d.getMonth()];
        const year = d.getFullYear();
        return `${dayName} ${dayNum} ${monthName} ${year}`;
      }
      return selectedDates[0];
    }
    if (selectedDates.length === 2) {
      return selectedDates.map((dStr) => {
        const p = dStr.split("-");
        return `${p[2]}/${p[1]}`;
      }).join(", ");
    }
    return `${selectedDates.length} dates`;
  }, [selectedDates, placeholder]);

  return (
    <div className={`${styles.wrapper} ${className || ""}`} style={style} ref={wrapperRef}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className={`${styles.trigger} ${size === "sm" ? styles.triggerSm : ""} ${open ? styles.triggerActive : ""}`}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <CalendarIcon size={size === "sm" ? 13 : 15} className={styles.calendarIcon} />
        <span className={`${selectedDates.length === 0 ? styles.placeholder : ""} ${size === "sm" ? styles.labelSm : ""}`}>
          {formattedDisplay}
        </span>
        {multiple && selectedDates.length > 1 && (
          <span className={styles.countBadgeMini}>{selectedDates.length}</span>
        )}
        {clearable && selectedDates.length > 0 && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              handleClear();
            }}
            className={styles.clearBtn}
            title="Effacer la sélection"
            aria-label="Effacer la sélection"
          >
            <X size={12} />
          </span>
        )}
      </button>

      {/* Popover / Mobile Sheet rendered via Portal to prevent any parent overflow clipping */}
      {open && typeof document !== "undefined" && createPortal(
        <>
          {isMobile && <div className={styles.backdrop} style={{ zIndex: 99998 }} onClick={() => setOpen(false)} />}

          <div
            ref={popoverRef}
            className={`${styles.calendarPopover} ${isMobile ? styles.calendarMobile : ""}`}
            style={!isMobile ? {
              position: "fixed",
              top: popoverPos.top,
              left: popoverPos.left,
              zIndex: 99999,
            } : { zIndex: 99999 }}
            role="dialog"
            aria-label="Choisir une date"
          >
            {isMobile && <div className={styles.dragHandle} />}

            {/* Header: Month Year + Chevrons */}
            <div className={styles.header}>
              <div className={styles.headerNavRow}>
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className={styles.navButton}
                  aria-label="Mois précédent"
                >
                  <ChevronLeft size={16} />
                </button>
                <div className={styles.headerSelectGroup}>
                  <select
                    value={viewMonth}
                    onChange={(e) => setViewMonth(Number(e.target.value))}
                    className={styles.headerSelect}
                    aria-label="Sélectionner le mois"
                  >
                    {MONTH_NAMES_FR.map((name, i) => (
                      <option key={name} value={i}>{name}</option>
                    ))}
                  </select>
                  <select
                    value={viewYear}
                    onChange={(e) => setViewYear(Number(e.target.value))}
                    className={styles.headerSelect}
                    aria-label="Sélectionner l'année"
                  >
                    {Array.from({ length: 15 }, (_, i) => today.getFullYear() - 8 + i).map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  className={styles.navButton}
                  aria-label="Mois suivant"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
              {multiple && (
                <div className={styles.multipleHint}>
                  {selectedDates.length > 0 
                    ? `${selectedDates.length} date${selectedDates.length > 1 ? "s" : ""} sélectionnée${selectedDates.length > 1 ? "s" : ""}` 
                    : "Sélection multiple"}
                </div>
              )}
            </div>

            {/* Days of week header */}
            <div className={styles.weekdaysGrid}>
              {WEEKDAY_NAMES_FR.map((wd, i) => (
                <div key={wd} className={`${styles.weekdayHeader} ${i === 6 ? styles.sundayHeader : ""}`}>
                  {wd}
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            <div className={styles.daysGrid}>
              {calendarDays.map((item, idx) => {
                if (!item) {
                  return <div key={`empty-${idx}`} className={`${styles.dayCell} ${styles.dayEmpty}`} />;
                }
                return (
                  <button
                    key={item.dateStr}
                    type="button"
                    onClick={() => handleSelectDate(item.dateStr)}
                    className={`${styles.dayCell} ${item.isSunday ? styles.daySunday : ""} ${
                      item.isToday ? styles.dayToday : ""
                    } ${item.isSelected ? styles.daySelected : ""}`}
                  >
                    {item.day}
                  </button>
                );
              })}
            </div>

            {/* Quick shortcuts */}
            {multiple ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
                <div style={{ display: "flex", gap: 6 }}>
                  <button type="button" onClick={selectAllSundaysInMonth} className={styles.shortcutBtn}>
                    Dimanches
                  </button>
                  <button type="button" onClick={selectToday} className={styles.shortcutBtn}>
                    Aujourd'hui
                  </button>
                  {clearable && selectedDates.length > 0 && (
                    <button type="button" onClick={handleClear} className={`${styles.shortcutBtn} ${styles.shortcutBtnClear}`}>
                      Effacer
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className={styles.applyBtn}
                >
                  <Check size={14} style={{ marginRight: 5 }} />
                  Valider {selectedDates.length > 0 ? `(${selectedDates.length})` : ""}
                </button>
              </div>
            ) : (
              <div className={styles.shortcuts}>
                <button type="button" onClick={selectToday} className={styles.shortcutBtn}>
                  Aujourd'hui
                </button>
                <button type="button" onClick={selectNextSunday} className={styles.shortcutBtn}>
                  Dimanche prochain
                </button>
                {clearable && (
                  <button
                    type="button"
                    onClick={() => {
                      handleClear();
                      setOpen(false);
                    }}
                    className={`${styles.shortcutBtn} ${styles.shortcutBtnClear}`}
                  >
                    Toutes les dates
                  </button>
                )}
              </div>
            )}
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
