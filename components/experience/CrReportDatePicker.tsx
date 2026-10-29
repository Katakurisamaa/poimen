"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react";
import styles from "./CounselorCrWhatsAppModal.module.css";

const MONTHS = Array.from({ length: 12 }, (_, month) => new Date(2024, month, 1).toLocaleDateString("fr-FR", { month: "long" }));
const DAYS = ["L", "M", "M", "J", "V", "S", "D"];
export function dateKey(date: Date): string {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}
function parseDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/** An inline, fully custom calendar: no native picker, select menu or nested modal. */
export default function CrReportDatePicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(() => parseDate(value));
  const [view, setView] = useState<"days" | "months" | "years">("days");
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstYear = Math.floor(year / 12) * 12;
  const today = dateKey(new Date());

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      const selector = view === "days"
        ? '[data-date="' + dateKey(cursor) + '"]'
        : '[data-calendar-choice][aria-pressed="true"]';
      calendarRef.current?.querySelector<HTMLButtonElement>(selector)?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [open, cursor, view]);

  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }
  function choose(key: string) {
    onChange(key);
    close();
  }
  function move(direction: number) {
    if (view === "years") setCursor(new Date(year + direction * 12, month, 1));
    else if (view === "months") setCursor(new Date(year + direction, month, 1));
    else setCursor(new Date(year, month + direction, 1));
  }
  function moveDay(event: KeyboardEvent<HTMLButtonElement>, day: number) {
    const steps: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (event.key in steps) {
      event.preventDefault();
      setCursor(new Date(year, month, day + steps[event.key]));
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      setCursor(new Date(year, month, event.key === "Home" ? 1 : daysInMonth));
    } else if (event.key === "PageUp" || event.key === "PageDown") {
      event.preventDefault();
      move(event.key === "PageUp" ? -1 : 1);
    }
  }

  return (
    <div className={styles.datePicker} onKeyDown={event => {
      if (open && event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); }
    }}>
      <button ref={triggerRef} type="button" className={styles.dateTrigger} aria-label="Changer la date du compte-rendu" aria-expanded={open} aria-controls={id} onClick={() => {
        if (open) close();
        else { setCursor(parseDate(value)); setView("days"); setOpen(true); }
      }}>
        <CalendarDays size={18} aria-hidden="true" />
        <span><small>Date des invités dans le titre du CR</small><strong>{parseDate(value).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</strong></span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open && (
        <div id={id} ref={calendarRef} className={styles.calendar} role="region" aria-label="Calendrier du compte-rendu">
          <div className={styles.calendarToolbar}>
            <button type="button" className={styles.iconButton} onClick={() => move(-1)} aria-label={view === "days" ? "Mois précédent" : "Années précédentes"}><ChevronLeft size={17} /></button>
            <div className={styles.calendarHeading}>
              <button type="button" onClick={() => setView(view === "months" ? "days" : "months")} aria-label="Choisir le mois">{MONTHS[month]}</button>
              <button type="button" onClick={() => setView(view === "years" ? "days" : "years")} aria-label="Choisir l’année">{view === "years" ? firstYear + " – " + (firstYear + 11) : year}</button>
            </div>
            <button type="button" className={styles.iconButton} onClick={() => move(1)} aria-label={view === "days" ? "Mois suivant" : "Années suivantes"}><ChevronRight size={17} /></button>
          </div>
          {view === "days" ? (
            <div className={styles.calendarDays} role="group" aria-label={MONTHS[month] + " " + year}>
              {DAYS.map((day, index) => <span key={index} className={styles.weekday} aria-hidden="true">{day}</span>)}
              {Array.from({ length: firstDay }, (_, index) => <span key={"blank-" + index} />)}
              {Array.from({ length: daysInMonth }, (_, index) => {
                const day = index + 1;
                const date = new Date(year, month, day);
                const key = dateKey(date);
                return <button key={key} type="button" data-date={key} data-today={key === today} aria-label={date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} aria-pressed={key === value} tabIndex={day === cursor.getDate() ? 0 : -1} onKeyDown={event => moveDay(event, day)} onClick={() => choose(key)}>{day}</button>;
              })}
            </div>
          ) : (
            <div className={styles.calendarChoices}>
              {(view === "months" ? MONTHS : Array.from({ length: 12 }, (_, index) => firstYear + index)).map((label, index) => (
                <button key={label} type="button" data-calendar-choice aria-pressed={view === "months" ? index === month : label === year} onClick={() => {
                  setCursor(view === "months" ? new Date(year, index, 1) : new Date(Number(label), month, 1));
                  setView(view === "months" ? "days" : "months");
                }}>{label}</button>
              ))}
            </div>
          )}
          <div className={styles.calendarBottom}>
            <button type="button" onClick={() => choose(today)}>Aujourd’hui</button>
            <button type="button" onClick={close}><X size={14} aria-hidden="true" /> Fermer le calendrier</button>
          </div>
        </div>
      )}
    </div>
  );
}
