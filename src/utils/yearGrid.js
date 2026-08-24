// Pure helpers for the all-time history grid (Bug 3 + spacing).
//
// The grid renders the current year of hobby completion as a series of
// per-month week columns (Mon..Sun) — a GitHub-style contribution
// graph, but with each month rendered as its own self-contained block
// of weeks, with a visual gap between blocks so the user can see where
// one month ends and the next begins.
//
// This module contains no React or native code; it is consumed both by
// the YearGrid component in HobbyDetailScreen and by the test harness
// in tests/run-year-grid-tests.mjs.
//
// Design rules enforced by these helpers:
//   1. Cells for days strictly after `today` are NOT emitted at all
//      (no ghost, no border). Only days up to and including today are
//      rendered.
//   2. The grid is split into per-month blocks. Each block is a series
//      of week columns, where the first column starts on the Monday of
//      the week containing the 1st of the month, and the last column
//      ends on the Sunday of the week containing the last day of the
//      month.
//   3. Cells inside a block that don't belong to the block's month
//      (e.g. Jun 29-30 in the July block, Aug 1-2 in the July block)
//      are skipped at render time — the block has empty cells in
//      those positions. This is what creates the visual "empty space
//      after Wednesday until the next month's block starts".
//   4. The day-of-week gutter maps rowIdx 0..6 to Mon..Sun in order.
//   5. Each block carries its own month label (e.g. "Aug") at the top.

import { startOfWeek, addDays, isAfter, format } from 'date-fns';

// Vertical day-of-week labels for the fixed left gutter. Index `i`
// matches `rowIdx` of the body rows: row 0 = Mon, row 6 = Sun.
//
// Only the first letter is shown, following the standard calendar
// convention. Tue/Thu and Sat/Sun share a letter (T and S) — the user
// is expected to read the position in the grid, not the letter, to
// tell them apart. The labels are kept full-length here so tests can
// match unambiguously; the render path takes `label[0]` for display.
export const DOW_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// First-letter variant for the rendered gutter.
export const DOW_SHORT = DOW_LABELS.map((l) => l[0]);

// Short month names indexed 0..11 — exposed so callers can render the
// block header without re-deriving from `date-fns`.
export const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

// Compute the Monday-of-the-week-of-Jan-1 for the given year.
export function januaryAnchor(year, weekStartsOn = 1) {
  return startOfWeek(new Date(year, 0, 1), { weekStartsOn });
}

// Build the week columns for a single month (Mon-anchored).
//
// `year` and `month` are 0-indexed (Jan = 0, Dec = 11). The returned
// array is a list of week columns, each column a 7-element array of
// Date objects (Mon..Sun). The first column starts on the Monday of
// the week containing the 1st of the month. The last column ends on
// the Sunday of the week containing the last day of the month.
//
// Cells that are NOT in the requested month (e.g. Jun 29-30 in the
// July column) are present in the returned week arrays — callers
// should filter at render time using `isCellInMonth`.
export function buildMonthWeeks(year, month) {
  const firstOfMonth = new Date(year, month, 1);
  const lastOfMonth = new Date(year, month + 1, 0); // day 0 of next month
  const start = startOfWeek(firstOfMonth, { weekStartsOn: 1 });
  // The end of the block is the Sunday of the week containing the
  // last day of the month. Compute that by walking forward from
  // `lastOfMonth` to the next Sunday.
  const lastDay = (lastOfMonth.getDay() + 6) % 7; // Mon=0..Sun=6
  const daysToSunday = 6 - lastDay;
  const end = addDays(
    new Date(year, month, lastOfMonth.getDate()),
    daysToSunday,
  );

  const weeks = [];
  let cursor = new Date(start);
  while (!isAfter(cursor, end)) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      week.push(new Date(cursor));
      cursor = addDays(cursor, 1);
    }
    weeks.push(week);
  }
  return weeks;
}

// True iff the given Date falls in the given (year, month) — by
// local-day comparison. Used to filter cells in a month block.
export function isCellInMonth(date, year, month) {
  return date.getFullYear() === year && date.getMonth() === month;
}

// True iff the given Date is strictly after `reference` (by local-day
// comparison, not by time-of-day). Cells that fall on today count as
// not-future.
export function isFutureCell(date, reference) {
  // Build a local-day comparison: zero out the time on both sides.
  const a = new Date(date);
  a.setHours(0, 0, 0, 0);
  const b = new Date(reference);
  b.setHours(0, 0, 0, 0);
  return a.getTime() > b.getTime();
}

// Build the list of per-month sections for the year containing
// `reference`. The list runs from January through the month of
// `reference` (inclusive). Each section has:
//
//   { year, month, label, weeks }
//
// where `weeks` is the list of week columns for that month. The
// caller renders each section as its own block of columns, with a
// visual gap between blocks.
//
// Months that are entirely in the future relative to `reference`
// (i.e. their entire `weeks` array is future) are still included as
// empty sections — so the caller can still render the month label
// above an empty block. The caller filters future cells at render
// time.
export function buildMonthSections(reference = new Date()) {
  const year = reference.getFullYear();
  const lastMonth = reference.getMonth();
  const sections = [];
  for (let m = 0; m <= lastMonth; m++) {
    sections.push({
      year,
      month: m,
      label: MONTH_SHORT[m],
      weeks: buildMonthWeeks(year, m),
    });
  }
  return sections;
}

// Total number of week columns across all sections. Convenience for
// callers that just want the count (e.g. for layout / tests).
export function totalColumnCount(sections) {
  return sections.reduce((sum, s) => sum + s.weeks.length, 0);
}

// ─── Backwards-compatible helpers ─────────────────────────────────────
// These build the original continuous grid (one big strip of weeks
// from the Monday of Jan 1's week to the Sunday of today's week).
// Existing tests still use them; new code should prefer
// `buildMonthSections`.
export function buildYearWeeks(reference = new Date()) {
  const start = januaryAnchor(reference.getFullYear());
  // The grid ends on the Sunday of today's week so today's cell is
  // always in the rightmost column. `endOfWeek` from date-fns would
  // work, but we compute it inline to avoid a new import.
  const todayDay = (reference.getDay() + 6) % 7; // Mon=0..Sun=6
  const daysToSunday = 6 - todayDay;
  const end = addDays(
    new Date(reference.getFullYear(), reference.getMonth(), reference.getDate()),
    daysToSunday,
  );

  const weeks = [];
  let cursor = new Date(start);
  while (!isAfter(cursor, end)) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      week.push(new Date(cursor));
      cursor = addDays(cursor, 1);
    }
    weeks.push(week);
  }
  return weeks;
}

export function buildMonthLabels(weeks) {
  const labels = [];
  weeks.forEach((week, colIdx) => {
    const firstOfMonth = week.find((d) => d.getDate() === 1);
    if (!firstOfMonth) return;
    labels.push({
      colIdx,
      label: format(firstOfMonth, 'MMM'),
    });
  });
  return labels;
}

export function columnCount(weeks) {
  return weeks.length;
}
