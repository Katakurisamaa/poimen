"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import styles from "./CustomDatePicker.module.css";

const MONTH_NAMES_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
];

const WEEKDAY_NAMES_FR = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

export interface CustomDatePickerProps {
  value: string; // Format: "YYYY-MM-DD"
  onChange: (dateStr: string) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
}

export default function CustomDatePicker({
  value,
  onChange,
  placeholder = "Sélectionner une date",
  className,
  style,
  disabled = false,
}: CustomDatePickerProps) {
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const wrapperRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Parse current selected date
  const parsedDate = useMemo(() => {
    if (!value) return null;
    const parts = value.split("-").map(Number);
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      return new Date(parts[0], parts[1] - 1, parts[2]);
    }
    return null;
  }, [value]);

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
    const checkMobile = () => setIsMobile(window.innerWidth <= 640);
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
      const isSelected = dateStr === value;

      days.push({ day: d, dateStr, isSunday, isToday, isSelected });
    }

    return days;
  }, [viewYear, viewMonth, today, value]);

  const handleSelectDate = (dateStr: string) => {
    onChange(dateStr);
    setOpen(false);
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

  // Formatted trigger label
  const formattedDisplay = useMemo(() => {
    if (!parsedDate) return placeholder;
    const dayName = ["Dim.", "Lun.", "Mar.", "Mer.", "Jeu.", "Ven.", "Sam."][parsedDate.getDay()];
    const dayNum = String(parsedDate.getDate()).padStart(2, "0");
    const monthName = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."][parsedDate.getMonth()];
    const year = parsedDate.getFullYear();
    return `${dayName} ${dayNum} ${monthName} ${year}`;
  }, [parsedDate, placeholder]);

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
        <span className={!parsedDate ? styles.placeholder : ""}>{formattedDisplay}</span>
      </button>

      {/* Popover / Mobile Sheet rendered via Portal to prevent any parent overflow clipping */}
      {open && typeof document !== "undefined" && createPortal(
        <>
          {isMobile && <div className={styles.backdrop} onClick={() => setOpen(false)} />}

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
              <button
                type="button"
                onClick={handlePrevMonth}
                className={styles.navButton}
                aria-label="Mois précédent"
              >
                <ChevronLeft size={16} />
              </button>
              <span className={styles.monthTitle}>
                {MONTH_NAMES_FR[viewMonth]} {viewYear}
              </span>
              <button
                type="button"
                onClick={handleNextMonth}
                className={styles.navButton}
                aria-label="Mois suivant"
              >
                <ChevronRight size={16} />
              </button>
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
            <div className={styles.shortcuts}>
              <button type="button" onClick={selectToday} className={styles.shortcutBtn}>
                Aujourd'hui
              </button>
              <button type="button" onClick={selectNextSunday} className={styles.shortcutBtn}>
                Dimanche prochain
              </button>
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
