"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  ChevronDown, 
  X, 
  Check 
} from "lucide-react";
import styles from "./CustomDatePicker.module.css";

const calendarCopy = {
  fr: {
    placeholder: "Sélectionner une date",
    clear: "Effacer la sélection",
    previous: "Mois précédent",
    next: "Mois suivant",
    month: "Sélectionner le mois",
    year: "Sélectionner l’année",
    multiple: "Sélection multiple",
    selected: "dates sélectionnées",
    sundays: "Dimanches",
    today: "Aujourd’hui",
    lastSunday: "Dimanche dernier",
    sunday: "Dimanche prochain",
    erase: "Effacer",
    apply: "Valider",
    all: "Toutes les dates",
    chooseMonth: "Choisir le mois",
    backToCalendar: "← Retour aux jours"
  },
  en: {
    placeholder: "Choose a date",
    clear: "Clear selection",
    previous: "Previous month",
    next: "Next month",
    month: "Choose month",
    year: "Choose year",
    multiple: "Multiple selection",
    selected: "selected dates",
    sundays: "Sundays",
    today: "Today",
    lastSunday: "Last Sunday",
    sunday: "Next Sunday",
    erase: "Clear",
    apply: "Apply",
    all: "All dates",
    chooseMonth: "Choose month",
    backToCalendar: "← Back to days"
  },
  nl: {
    placeholder: "Kies een datum",
    clear: "Selectie wissen",
    previous: "Vorige maand",
    next: "Volgende maand",
    month: "Kies een maand",
    year: "Kies een jaar",
    multiple: "Meerdere datums",
    selected: "geselecteerde datums",
    sundays: "Zondagen",
    today: "Vandaag",
    lastSunday: "Vorige zondag",
    sunday: "Volgende zondag",
    erase: "Wissen",
    apply: "Bevestigen",
    all: "Alle datums",
    chooseMonth: "Kies een maand",
    backToCalendar: "← Terug naar dagen"
  },
};

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
  locale?: "fr" | "en" | "nl";
  ariaLabel?: string;
}

export default function CustomDatePicker({
  value,
  onChange,
  values,
  onChangeMultiple,
  multiple = false,
  placeholder,
  className,
  style,
  disabled = false,
  clearable = false,
  size = "md",
  locale = "fr",
  ariaLabel,
}: CustomDatePickerProps) {
  const copy = calendarCopy[locale];
  const resolvedPlaceholder = placeholder ?? copy.placeholder;
  const months = useMemo(
    () => Array.from({ length: 12 }, (_, index) => new Intl.DateTimeFormat(locale, { month: "long" }).format(new Date(2024, index, 1))),
    [locale]
  );
  const weekdays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => new Intl.DateTimeFormat(locale, { weekday: "short" }).format(new Date(2024, 0, index + 1))),
    [locale]
  );

  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const wrapperRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Sub-view: "days" (calendar) | "months" (12-month grid) | "years" (12-year grid)
  const [pickerView, setPickerView] = useState<"days" | "months" | "years">("days");

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
  const [yearPage, setYearPage] = useState<number>(() => Math.floor((parsedDate?.getFullYear() || today.getFullYear()) / 12) * 12);

  // Keep view aligned when value changes externally
  useEffect(() => {
    if (parsedDate) {
      setViewYear(parsedDate.getFullYear());
      setViewMonth(parsedDate.getMonth());
      setYearPage(Math.floor(parsedDate.getFullYear() / 12) * 12);
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
      const popoverWidth = 320;
      const popoverHeight = 380;
      let left = rect.left;
      let top = rect.bottom + 8;

      // Adjust if overflowing viewport right
      if (left + popoverWidth > window.innerWidth - 12) {
        left = window.innerWidth - popoverWidth - 12;
      }
      if (left < 12) left = 12;

      // Adjust if overflowing viewport bottom
      if (top + popoverHeight > window.innerHeight - 12) {
        const altTop = rect.top - popoverHeight - 8;
        if (altTop > 12) {
          top = altTop;
        }
      }

      setPopoverPos({ top, left });
    }
  };

  useEffect(() => {
    if (open) {
      setPickerView("days");
      updatePosition();
      window.addEventListener("scroll", updatePosition, true);
      window.addEventListener("resize", updatePosition);
      return () => {
        window.removeEventListener("scroll", updatePosition, true);
        window.removeEventListener("resize", updatePosition);
      };
    }
  }, [open, isMobile]);

  // Outside click & ESC dismissal
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node) &&
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
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

  // Navigation handlers
  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (pickerView === "days") {
      if (viewMonth === 0) {
        setViewMonth(11);
        setViewYear(y => y - 1);
      } else {
        setViewMonth(m => m - 1);
      }
    } else if (pickerView === "months") {
      setViewYear(y => y - 1);
    } else if (pickerView === "years") {
      setYearPage(p => p - 12);
    }
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (pickerView === "days") {
      if (viewMonth === 11) {
        setViewMonth(0);
        setViewYear(y => y + 1);
      } else {
        setViewMonth(m => m + 1);
      }
    } else if (pickerView === "months") {
      setViewYear(y => y + 1);
    } else if (pickerView === "years") {
      setYearPage(p => p + 12);
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

  const selectLastSunday = () => {
    const d = new Date();
    const day = d.getDay(); // 0 is Sunday
    const daysBack = day === 0 ? 7 : day;
    const lastSunday = new Date(d);
    lastSunday.setDate(d.getDate() - daysBack);
    const dateStr = `${lastSunday.getFullYear()}-${String(lastSunday.getMonth() + 1).padStart(2, "0")}-${String(lastSunday.getDate()).padStart(2, "0")}`;
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
    if (selectedDates.length === 0) return resolvedPlaceholder;
    if (selectedDates.length === 1) {
      const parts = selectedDates[0].split("-").map(Number);
      if (parts.length === 3 && !isNaN(parts[0])) {
        const d = new Date(parts[0], parts[1] - 1, parts[2]);
        return new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(d);
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
  }, [selectedDates, resolvedPlaceholder, locale]);

  return (
    <div className={`${styles.wrapper} ${className || ""}`} style={style} ref={wrapperRef}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className={`${styles.trigger} ${size === "sm" ? styles.triggerSm : ""} ${open ? styles.triggerActive : ""}`}
        aria-label={ariaLabel ? `${ariaLabel}: ${formattedDisplay}` : undefined}
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
            title={copy.clear}
            aria-label={copy.clear}
          >
            <X size={12} />
          </span>
        )}
      </button>

      {/* Popover / Mobile Sheet rendered via Portal */}
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

            {/* Custom Header Nav with interactive Month & Year triggers */}
            <div className={styles.header}>
              <div className={styles.headerNavRow}>
                <button
                  type="button"
                  onClick={handlePrev}
                  className={styles.navButton}
                  aria-label={copy.previous}
                >
                  <ChevronLeft size={16} />
                </button>

                <div className={styles.headerSelectGroup}>
                  {pickerView === "days" && (
                    <>
                      <button
                        type="button"
                        onClick={() => setPickerView("months")}
                        className={styles.headerButton}
                        aria-label={copy.month}
                        title="Changer de mois"
                      >
                        <span>{months[viewMonth]}</span>
                        <ChevronDown size={13} className={styles.headerChevron} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setYearPage(Math.floor(viewYear / 12) * 12);
                          setPickerView("years");
                        }}
                        className={styles.headerButton}
                        aria-label={copy.year}
                        title="Changer d’année"
                      >
                        <span>{viewYear}</span>
                        <ChevronDown size={13} className={styles.headerChevron} />
                      </button>
                    </>
                  )}

                  {pickerView === "months" && (
                    <>
                      <span className={styles.viewTitle}>{copy.chooseMonth}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setYearPage(Math.floor(viewYear / 12) * 12);
                          setPickerView("years");
                        }}
                        className={styles.headerButton}
                        title="Changer d’année"
                      >
                        <span>{viewYear}</span>
                        <ChevronDown size={13} className={styles.headerChevron} />
                      </button>
                    </>
                  )}

                  {pickerView === "years" && (
                    <span className={styles.viewTitle}>
                      {yearPage} – {yearPage + 11}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleNext}
                  className={styles.navButton}
                  aria-label={copy.next}
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              {multiple && pickerView === "days" && (
                <div className={styles.multipleHint}>
                  {selectedDates.length > 0 
                    ? `${selectedDates.length} ${copy.selected}` 
                    : copy.multiple}
                </div>
              )}
            </div>

            {/* VIEW 1: DAYS CALENDAR */}
            {pickerView === "days" && (
              <>
                {/* Days of week header */}
                <div className={styles.weekdaysGrid}>
                  {weekdays.map((wd, i) => (
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
                        {copy.sundays}
                      </button>
                      <button type="button" onClick={selectToday} className={styles.shortcutBtn}>
                        {copy.today}
                      </button>
                      {clearable && selectedDates.length > 0 && (
                        <button type="button" onClick={handleClear} className={`${styles.shortcutBtn} ${styles.shortcutBtnClear}`}>
                          {copy.erase}
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className={styles.applyBtn}
                    >
                      <Check size={14} style={{ marginRight: 5 }} />
                      {copy.apply} {selectedDates.length > 0 ? `(${selectedDates.length})` : ""}
                    </button>
                  </div>
                ) : (
                  <div className={styles.shortcuts}>
                    <button type="button" onClick={selectLastSunday} className={styles.shortcutBtn} title="Dimanche précédent">
                      {copy.lastSunday}
                    </button>
                    <button type="button" onClick={selectToday} className={styles.shortcutBtn} title="Aujourd'hui">
                      {copy.today}
                    </button>
                    <button type="button" onClick={selectNextSunday} className={styles.shortcutBtn} title="Dimanche à venir">
                      {copy.sunday}
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
                        {copy.all}
                      </button>
                    )}
                  </div>
                )}
              </>
            )}

            {/* VIEW 2: 12-MONTH INTERACTIVE GRID */}
            {pickerView === "months" && (
              <>
                <div className={styles.monthsGrid}>
                  {months.map((name, i) => {
                    const isSelected = viewMonth === i;
                    const isCurrent = today.getFullYear() === viewYear && today.getMonth() === i;
                    return (
                      <button
                        key={name}
                        type="button"
                        onClick={() => {
                          setViewMonth(i);
                          setPickerView("days");
                        }}
                        className={`${styles.monthCell} ${isSelected ? styles.cellSelected : ""} ${isCurrent ? styles.cellCurrent : ""}`}
                      >
                        {name}
                      </button>
                    );
                  })}
                </div>
                <div className={styles.subviewFooter}>
                  <button
                    type="button"
                    onClick={() => setPickerView("days")}
                    className={styles.backToDaysBtn}
                  >
                    {copy.backToCalendar}
                  </button>
                </div>
              </>
            )}

            {/* VIEW 3: 12-YEAR INTERACTIVE GRID */}
            {pickerView === "years" && (
              <>
                <div className={styles.yearsGrid}>
                  {Array.from({ length: 12 }, (_, i) => yearPage + i).map((y) => {
                    const isSelected = viewYear === y;
                    const isCurrent = today.getFullYear() === y;
                    return (
                      <button
                        key={y}
                        type="button"
                        onClick={() => {
                          setViewYear(y);
                          setPickerView("days");
                        }}
                        className={`${styles.yearCell} ${isSelected ? styles.cellSelected : ""} ${isCurrent ? styles.cellCurrent : ""}`}
                      >
                        {y}
                      </button>
                    );
                  })}
                </div>
                <div className={styles.subviewFooter}>
                  <button
                    type="button"
                    onClick={() => setPickerView("days")}
                    className={styles.backToDaysBtn}
                  >
                    {copy.backToCalendar}
                  </button>
                </div>
              </>
            )}
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
