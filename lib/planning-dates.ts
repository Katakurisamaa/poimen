/**
 * Utility functions to calculate church service weeks (Monday to Sunday)
 */

export function padZero(num: number): string {
  return num < 10 ? `0${num}` : `${num}`;
}

export function formatShortDate(date: Date): string {
  const day = padZero(date.getDate());
  const month = padZero(date.getMonth() + 1);
  const year = String(date.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
}

export function formatWeekPeriod(monday: Date, sunday: Date): string {
  return `DU ${formatShortDate(monday)} AU ${formatShortDate(sunday)}`;
}

/**
 * Parses a "DU DD/MM/YY AU DD/MM/YY" string to get the end Date (Sunday)
 */
export function parseWeekEndDate(periodStr: string): Date | null {
  try {
    const parts = periodStr.toUpperCase().split("AU");
    if (parts.length < 2) return null;
    const datePart = parts[1].trim(); // "DD/MM/YY"
    const [d, m, y] = datePart.split("/").map(s => parseInt(s.trim(), 10));
    if (!d || !m || isNaN(y)) return null;
    const fullYear = y < 100 ? 2000 + y : y;
    return new Date(fullYear, m - 1, d);
  } catch {
    return null;
  }
}

/**
 * Calculates the next Monday-to-Sunday week period given the previous period string
 */
export function getNextWeekPeriod(prevPeriodStr: string): string {
  const prevSunday = parseWeekEndDate(prevPeriodStr);
  if (prevSunday) {
    const nextMonday = new Date(prevSunday);
    nextMonday.setDate(prevSunday.getDate() + 1);

    const nextSunday = new Date(nextMonday);
    nextSunday.setDate(nextMonday.getDate() + 6);

    return formatWeekPeriod(nextMonday, nextSunday);
  }

  // Fallback: today to +6 days
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 is Sunday, 1 is Monday
  const diffToMonday = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return formatWeekPeriod(monday, sunday);
}

/**
 * Computes all Monday-to-Sunday weeks for a given monthKey ("YYYY-MM")
 */
export function getMonthWeeks(monthKey: string): string[] {
  if (!monthKey) return [];
  const [yearStr, monthStr] = monthKey.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1; // 0-indexed

  if (isNaN(year) || isNaN(month)) return [];

  const periods: string[] = [];
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Find all Sundays in the month
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month, day);
    if (d.getDay() === 0) { // Sunday
      const sunday = d;
      const monday = new Date(sunday);
      monday.setDate(sunday.getDate() - 6);
      periods.push(formatWeekPeriod(monday, sunday));
    }
  }

  // Check if the last day of the month is not Sunday and starts a week that contains days of this month
  const lastDay = new Date(year, month, daysInMonth);
  if (lastDay.getDay() !== 0) {
    // There are remaining days in this month that belong to the next week (e.g. Mon 28, Tue 29, Wed 30)
    // Find the Monday of that last week
    const lastDayOfWeek = lastDay.getDay(); // 1=Mon, ..., 6=Sat
    const lastMonday = new Date(lastDay);
    lastMonday.setDate(lastDay.getDate() - (lastDayOfWeek - 1));

    const nextSunday = new Date(lastMonday);
    nextSunday.setDate(lastMonday.getDate() + 6);

    const candidate = formatWeekPeriod(lastMonday, nextSunday);
    if (!periods.includes(candidate)) {
      periods.push(candidate);
    }
  }

  return periods;
}
