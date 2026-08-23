// Pre-commit test for the inline month-grid calendar helpers.
// Plain-Node ESM — no Jest, no extra deps. Exercises the same pure
// functions the AddTaskScreen uses to render and validate the date
// picker grid.
//
// Usage: node tests/run-calendar-tests.mjs
// Exit code: 0 = all pass, 1 = at least one fail.

import {
  buildMonthMatrix,
  isCellDisabled,
  composeDateWithTime,
  isSameLocalDay,
  WEEKDAY_LABELS,
  MONTH_SHORT,
} from '../src/utils/calendar.js';

let pass = 0, fail = 0, partial = 0;
const results = [];

function record(id, status, reason) {
  results.push({ id, status, reason });
  if (status === 'PASS') pass++;
  else if (status === 'PARTIAL') partial++;
  else fail++;
}

function expect(id, actual, expected, reason) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  record(id, ok ? 'PASS' : 'FAIL',
    ok ? reason : `${reason} — got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
}

// Pin "today" so the helpers are deterministic.
const REF = new Date(2026, 7, 24); // Mon, Aug 24, 2026

// ─── CAL-01 — Weekday labels are Mon-first, 7 entries ────────────────────
expect('CAL-01', WEEKDAY_LABELS, ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
  'WEEKDAY_LABELS is Mon-first');

// ─── CAL-02 — Month labels are 12 entries, Jan..Dec ──────────────────────
expect('CAL-02', MONTH_SHORT, ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
  'MONTH_SHORT is the canonical 12');

// ─── CAL-03 — August 2026 starts on a Saturday and ends on a Monday ─────
{
  const m = buildMonthMatrix(2026, 7, REF);
  expect('CAL-03', m.weeks.length, 6, 'matrix has 6 rows');
  // 2026-08-01 is Saturday → Mon-first index 5.
  const firstRowDays = m.weeks[0].map(c => (c.inMonth ? c.day : null));
  const firstRowInMonth = m.weeks[0].filter(c => c.inMonth).map(c => c.day);
  expect('CAL-03b', firstRowInMonth, [1, 2],
    'Aug 2026 first row in-month days: 1, 2');
  const lastDayCell = m.weeks[m.weeks.length - 1].find(c => c.inMonth);
  expect('CAL-03c', lastDayCell.day, 31, 'Aug 2026 ends on day 31');
  // Last day should also be a Monday.
  expect('CAL-03d', m.weeks[m.weeks.length - 1].filter(c => c.inMonth).slice(-1)[0].date.getDay(), 1,
    'Aug 31 2026 is a Monday (getDay=1)');
  // Reference unused but kept so the matrix helper signature stays stable.
  void firstRowDays;
}

// ─── CAL-04 — Each row has 7 cells (always 6×7 = 42 cells) ──────────────
{
  const m = buildMonthMatrix(2026, 7, REF);
  const total = m.weeks.flat().length;
  expect('CAL-04', total, 42, 'matrix has 42 cells');
  let allSeven = true;
  for (const w of m.weeks) {
    if (w.length !== 7) { allSeven = false; break; }
  }
  expect('CAL-04b', allSeven, true, 'every row has 7 cells');
}

// ─── CAL-05 — Padding cells are flagged inMonth=false ───────────────────
{
  const m = buildMonthMatrix(2026, 7, REF);
  const flat = m.weeks.flat();
  const inMonthCount = flat.filter(c => c.inMonth).length;
  expect('CAL-05', inMonthCount, 31, 'August has 31 in-month cells');
  const paddingCount = flat.filter(c => !c.inMonth).length;
  expect('CAL-05b', paddingCount, 11, 'Aug 2026 has 11 padding cells (5 leading + 6 trailing)');
}

// ─── CAL-06 — February 2026 (non-leap year) has 28 days ─────────────────
{
  const m = buildMonthMatrix(2026, 1, REF);
  const inMonthCount = m.weeks.flat().filter(c => c.inMonth).length;
  expect('CAL-06', inMonthCount, 28, 'Feb 2026 has 28 days');
}

// ─── CAL-07 — March 2026 (Mon-first, starts Sunday index=1) ─────────────
{
  // 2026-03-01 is Sunday → Mon-first index 6.
  const m = buildMonthMatrix(2026, 2, REF);
  const firstRowInMonth = m.weeks[0].filter(c => c.inMonth).map(c => c.day);
  expect('CAL-07', firstRowInMonth, [1],
    'Mar 2026 first row in-month day: 1');
}

// ─── CAL-08 — isCellDisabled honours minDate (start-of-day comparison) ──
{
  const min = new Date(2026, 7, 24); // today
  const before = new Date(2026, 7, 23); // yesterday
  const sameDay = new Date(2026, 7, 24, 13, 0); // today, different time
  const after = new Date(2026, 7, 25); // tomorrow
  expect('CAL-08', isCellDisabled(before, min, null), true, 'yesterday is disabled');
  expect('CAL-08b', isCellDisabled(sameDay, min, null), false, 'today (any time) is enabled');
  expect('CAL-08c', isCellDisabled(after, min, null), false, 'tomorrow is enabled');
}

// ─── CAL-09 — isCellDisabled honours maxDate ────────────────────────────
{
  const max = new Date(2026, 7, 30); // Aug 30
  const aug29 = new Date(2026, 7, 29);
  const aug30 = new Date(2026, 7, 30, 23, 59); // late on last day
  const aug31 = new Date(2026, 7, 31);
  expect('CAL-09', isCellDisabled(aug29, null, max), false, 'Aug 29 <= max');
  expect('CAL-09b', isCellDisabled(aug30, null, max), false, 'Aug 30 == max (any time)');
  expect('CAL-09c', isCellDisabled(aug31, null, max), true, 'Aug 31 > max');
}

// ─── CAL-10 — isCellDisabled with both min and max ──────────────────────
{
  const min = new Date(2026, 7, 24);
  const max = new Date(2026, 7, 30);
  expect('CAL-10', isCellDisabled(new Date(2026, 7, 20), min, max), true, 'before min');
  expect('CAL-10b', isCellDisabled(new Date(2026, 7, 27), min, max), false, 'inside range');
  expect('CAL-10c', isCellDisabled(new Date(2026, 7, 31), min, max), true, 'after max');
}

// ─── CAL-11 — isCellDisabled(null) returns true ─────────────────────────
expect('CAL-11', isCellDisabled(null, null, null), true, 'null cell is disabled');

// ─── CAL-12 — composeDateWithTime merges date + time correctly ──────────
{
  const dateOnly = new Date(2026, 7, 25); // Aug 25, 2026, midnight local
  const timeOnly = new Date(2026, 0, 1, 14, 30, 0, 0); // Jan 1 2:30pm
  const merged = composeDateWithTime(dateOnly, timeOnly);
  expect('CAL-12', merged.getFullYear(), 2026, 'merged year from dateOnly');
  expect('CAL-12b', merged.getMonth(), 7, 'merged month from dateOnly');
  expect('CAL-12c', merged.getDate(), 25, 'merged day from dateOnly');
  expect('CAL-12d', merged.getHours(), 14, 'merged hour from timeOnly');
  expect('CAL-12e', merged.getMinutes(), 30, 'merged minute from timeOnly');
  expect('CAL-12f', merged.getSeconds(), 0, 'merged seconds from timeOnly');
}

// ─── CAL-13 — composeDateWithTime on non-Date falls back gracefully ─────
{
  const merged = composeDateWithTime(null, null);
  expect('CAL-13', merged instanceof Date, true, 'null inputs → valid Date');
}

// ─── CAL-14 — isSameLocalDay ignores time-of-day ────────────────────────
{
  const a = new Date(2026, 7, 24, 9, 0);
  const b = new Date(2026, 7, 24, 23, 59);
  const c = new Date(2026, 7, 25, 0, 0);
  expect('CAL-14', isSameLocalDay(a, b), true, 'same day, different time → true');
  expect('CAL-14b', isSameLocalDay(a, c), false, 'different day → false');
  expect('CAL-14c', isSameLocalDay(a, null), false, 'null other → false');
}

// ─── CAL-15 — Matrix carries `today` so the caller can highlight ───────
{
  const m = buildMonthMatrix(2026, 7, REF);
  expect('CAL-15', m.today.getDate(), 24, 'matrix carries today.getDate()=24');
  expect('CAL-15b', m.today.getMonth(), 7, 'matrix carries today.getMonth()=7');
}

// ─── CAL-16 — December 2026 boundary (Dec 1 is Tuesday, index 1) ────────
{
  const m = buildMonthMatrix(2026, 11, REF); // December 2026
  const firstRowInMonth = m.weeks[0].filter(c => c.inMonth).map(c => c.day);
  // Dec 1 2026 is Tue → one padding Mon (from Nov 30) then 1-6.
  expect('CAL-16', firstRowInMonth, [1, 2, 3, 4, 5, 6],
    'Dec 2026 first row in-month days: 1, 2, 3, 4, 5, 6');
}

// ─── Report ──────────────────────────────────────────────────────────────
console.log('=== CALENDAR TEST REPORT ===');
for (const r of results) {
  console.log(`[${r.id}] ${r.status} — ${r.reason}`);
}
console.log(`\nTotals: ${pass} pass / ${fail} fail / ${partial} partial`);
process.exit(fail === 0 ? 0 : 1);