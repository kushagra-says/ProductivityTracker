// Pure helpers for the inline month-grid calendar.
//
// Used by the Expiry date card and the Custom reminder card so the same
// grid UI can pick any future date and respect per-card caps.

import { startOfDay } from 'date-fns';

// Short, fixed-order day labels — Monday first to match the existing
// dashboard / hobby grid convention.
export const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

// Full weekday names for any place we want to render a long caption.
export const WEEKDAY_LONG = [
  'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun',
];

// Month short labels indexed 0..11.
export const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

// Build the 6×7 day grid for the given month. The first column is
// Monday. Every cell is `{ day, date, inMonth }` — never `null` — so
// the caller can render greyed-out day numbers from prev/next months
// (standard calendar look). `inMonth: false` flags the padding cells.
//
// `reference` (optional Date) is "today". If omitted, `new Date()` is
// used. We expose it as a parameter so tests can pin time.
export function buildMonthMatrix(year, month, reference = new Date()) {
  // JS months are 0-indexed; `month` here is also 0-indexed.
  const firstOfMonth = new Date(year, month, 1);
  // dayOfWeek where Mon=0..Sun=6. JS getDay() is Sun=0..Sat=6 — shift.
  const firstCol = (firstOfMonth.getDay() + 6) % 7;

  // Days in the displayed month and the previous month.
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const today = startOfDay(reference);

  const cells = [];
  // Leading padding: trailing days of previous month, Mon-first aligned.
  // e.g. for firstCol=5 (Sat-start), we need 5 leading cells with day
  // numbers [daysInPrevMonth-4, ..., daysInPrevMonth].
  for (let i = firstCol - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i;
    const date = new Date(year, month - 1, d);
    cells.push({ day: d, date, inMonth: false });
  }
  // Current month.
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    cells.push({ day: d, date, inMonth: true });
  }
  // Trailing padding: leading days of next month, to round up to 42.
  let nextDay = 1;
  while (cells.length < 42) {
    const date = new Date(year, month + 1, nextDay);
    cells.push({ day: nextDay, date, inMonth: false });
    nextDay++;
  }

  return {
    year,
    month,
    weeks: [
      cells.slice(0, 7),
      cells.slice(7, 14),
      cells.slice(14, 21),
      cells.slice(21, 28),
      cells.slice(28, 35),
      cells.slice(35, 42),
    ],
    today,
  };
}

// True iff `date` should be unselectable. We compare by start-of-day so
// hours / minutes / seconds don't make a same-day comparison fail.
export function isCellDisabled(date, minDate, maxDate) {
  if (!date) return true;
  const d = startOfDay(date).getTime();
  if (minDate) {
    const lo = startOfDay(minDate).getTime();
    if (d < lo) return true;
  }
  if (maxDate) {
    const hi = startOfDay(maxDate).getTime();
    if (d > hi) return true;
  }
  return false;
}

// Combine the date portion of `dateOnly` with the time-of-day of
// `timeOnly`, returning a fresh Date. Both must be Date instances;
// non-Date inputs fall back to `new Date()` for the respective portion.
export function composeDateWithTime(dateOnly, timeOnly) {
  const d = dateOnly instanceof Date ? new Date(dateOnly) : new Date();
  const t = timeOnly instanceof Date ? timeOnly : new Date();
  d.setHours(t.getHours(), t.getMinutes(), t.getSeconds(), t.getMilliseconds());
  return d;
}

// True if two Dates fall on the same local calendar day.
export function isSameLocalDay(a, b) {
  if (!(a instanceof Date) || !(b instanceof Date)) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}