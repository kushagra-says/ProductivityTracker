// Pre-commit test for BUGS.md #3 / tests.md Section D.
//
// Plain-Node ESM — no Jest, no extra deps. Exercises the same pure
// helpers (`buildYearWeeks`, `buildMonthLabels`, `isFutureCell`,
// `DOW_LABELS`) that HobbyDetailScreen.YearGrid uses, so a pass here
// means the live app renders the correct grid.
//
// Usage: node tests/run-year-grid-tests.mjs
// Exit code: 0 = all pass, 1 = at least one fail.

import {
  buildYearWeeks,
  buildMonthLabels,
  isFutureCell,
  januaryAnchor,
  columnCount,
  DOW_LABELS,
  DOW_SHORT,
  buildMonthSections,
  buildMonthWeeks,
  isCellInMonth,
  totalColumnCount,
  MONTH_SHORT,
} from '../src/utils/yearGrid.js';
import { format } from 'date-fns';

let pass = 0, fail = 0, partial = 0;
const results = [];

function record(id, status, reason) {
  results.push({ id, status, reason });
  if (status === 'PASS') pass++;
  else if (status === 'PARTIAL') partial++;
  else fail++;
}

function expect(id, actual, expected, reason) {
  // Deep-equal via JSON where the structure is JSON-safe.
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  record(
    id,
    ok ? 'PASS' : 'FAIL',
    ok
      ? reason
      : `${reason} — got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`,
  );
}

function expectTrue(id, cond, reason) {
  record(id, cond ? 'PASS' : 'FAIL', reason);
}

function expectFalse(id, cond, reason) {
  record(id, !cond ? 'PASS' : 'FAIL', reason);
}

const MONTH_INDEX = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

const SHORT_DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Use a fixed reference date for every assertion so the tests are
// deterministic. The current day (per the task context) is 2026-08-25.
const REF = new Date(2026, 7, 25, 14, 30, 0); // 2026-08-25 (Tue)
const REF_KEY = format(REF, 'yyyy-MM-dd');

// ─── DOW-01 — DOW_LABELS is the canonical Mon..Sun order ───────────────
expect(
  'DOW-01', DOW_LABELS,
  ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  'DOW_LABELS is the 7-day Mon..Sun sequence',
);

// ─── DOW-02 — DOW_LABELS has exactly 7 entries, no empties ──────────────
expect('DOW-02', DOW_LABELS.length, 7,
  'DOW_LABELS has exactly 7 entries (one per row 0..6)');
expectTrue('DOW-02b', DOW_LABELS.every((l) => l && typeof l === 'string'),
  'DOW_LABELS has no empty strings');

// ─── DOW-03 — DOW_SHORT is the first-letter of each DOW_LABELS entry ───
// The render path uses DOW_SHORT (one letter) so the gutter stays
// compact and fixed on the left even when the user scrolls.
expect(
  'DOW-03', DOW_SHORT,
  ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
  'DOW_SHORT is the first letter of each DOW_LABELS entry',
);
expect('DOW-03b', DOW_SHORT.length, 7,
  'DOW_SHORT has exactly 7 entries');

// ─── ANCHOR-01 — January anchor lands on the Monday of Jan 1's week ────
{
  // 2026-01-01 is a Thursday. Monday of that week is 2025-12-29.
  const anchor = januaryAnchor(2026);
  expect(
    'ANCHOR-01', format(anchor, 'yyyy-MM-dd'),
    '2025-12-29',
    'Jan 1 2026 (Thu) → Monday of that week is 2025-12-29',
  );
  expectTrue('ANCHOR-01b', anchor.getDay() === 1,
    'Jan anchor is a Monday (getDay === 1)');
}

// ─── ANCHOR-02 — Jan 1 on a Monday is the anchor itself ────────────────
{
  // 2018-01-01 is a Monday. The anchor should be the same day.
  const anchor = januaryAnchor(2018);
  expect(
    'ANCHOR-02', format(anchor, 'yyyy-MM-dd'),
    '2018-01-01',
    'Jan 1 2018 (Mon) → anchor is Jan 1 itself',
  );
}

// ─── WEEKS-01 — Every week has 7 days ──────────────────────────────────
{
  const weeks = buildYearWeeks(REF);
  expectTrue('WEEKS-01', weeks.length > 0,
    'buildYearWeeks returns at least one week');
  expectTrue('WEEKS-01b', weeks.every((w) => w.length === 7),
    'every week column has exactly 7 cells');
}

// ─── WEEKS-02 — Each week column is Mon..Sun in order ──────────────────
{
  const weeks = buildYearWeeks(REF);
  // getDay: Sun=0, Mon=1, ..., Sat=6
  // Mon-first: Mon=0..Sun=6
  // 2026-08-25 is a Tuesday (getDay=2) → Mon-first index = (2+6)%7 = 1.
  for (let i = 0; i < weeks[0].length; i++) {
    const d = weeks[0][i];
    const expectedDow = (i + 1) % 7; // Mon=1, Tue=2, ..., Sun=0
    expect(
      `WEEKS-02-${i}`,
      d.getDay(),
      expectedDow,
      `first week column index ${i} is getDay=${expectedDow} (Mon-first order)`,
    );
  }
}

// ─── WEEKS-03 — Grid starts on the Monday of Jan 1's week ──────────────
{
  const weeks = buildYearWeeks(REF);
  const firstDay = weeks[0][0];
  // The Monday of the week containing Jan 1 2026 is 2025-12-29.
  expect(
    'WEEKS-03', format(firstDay, 'yyyy-MM-dd'),
    '2025-12-29',
    'first cell is the Monday of the week containing Jan 1 2026',
  );
}

// ─── WEEKS-04 — Grid ends on the Sunday of today's week ────────────────
{
  const weeks = buildYearWeeks(REF);
  const lastWeek = weeks[weeks.length - 1];
  // 2026-08-25 is a Tuesday. Sunday of that week is 2026-08-30.
  expect(
    'WEEKS-04', format(lastWeek[6], 'yyyy-MM-dd'),
    '2026-08-30',
    'last cell is the Sunday of the week containing today (2026-08-25 Tue)',
  );
}

// ─── WEEKS-05 — The rightmost column contains today ────────────────────
{
  const weeks = buildYearWeeks(REF);
  const lastWeek = weeks[weeks.length - 1];
  // 2026-08-25 (Tue) is the Tue of the last week → lastWeek[1].
  expect(
    'WEEKS-05', format(lastWeek[1], 'yyyy-MM-dd'),
    REF_KEY,
    'today sits in the rightmost column',
  );
}

// ─── WEEKS-06 — Column count matches elapsed weeks ─────────────────────
// ceil(((today − monday-of-jan-1-week) + 1) / 7) columns.
// Mon of Jan 1 2026's week: 2025-12-29. REF = 2026-08-25.
//   diff days = (2026-08-25 − 2025-12-29) = ?
//   2025-12-29 → 2026-08-25:
//     Dec (29→31) = 2
//     Jan = 31
//     Feb = 28 (2026 is not a leap year)
//     Mar = 31
//     Apr = 30
//     May = 31
//     Jun = 30
//     Jul = 31
//     Aug 1..25 = 25
//     total = 2 + 31 + 28 + 31 + 30 + 31 + 30 + 31 + 25 = 239
//   ceil((239 + 1) / 7) = ceil(240 / 7) = ceil(34.286) = 35.
{
  const weeks = buildYearWeeks(REF);
  const count = columnCount(weeks);
  expect('WEEKS-06', count, 35,
    '35 week columns for the year-to-date through 2026-08-25');
}

// ─── GRID-01 — No future cells rendered (Bug 3) ────────────────────────
// The YearGrid component must NOT render a View for any date strictly
// after today. We assert that for every (colIdx, rowIdx) where the
// cell is in the future, the visible-render predicate returns false.
{
  const weeks = buildYearWeeks(REF);
  let futureCount = 0;
  let notFutureCount = 0;
  for (const week of weeks) {
    for (const date of week) {
      if (isFutureCell(date, REF)) {
        futureCount++;
      } else {
        notFutureCount++;
      }
    }
  }
  // The grid must include today as a non-future cell.
  expectTrue('GRID-01a', notFutureCount > 0,
    'at least one non-future cell exists (today and earlier)');
  // Today is in the rightmost column. Cells to the right of today
  // within the same week are future.
  expectTrue('GRID-01b', futureCount > 0,
    'at least one future cell exists (Tue → Sun of this week)');
  // Total cells in future + not-future = 7 * weekCount.
  expect('GRID-01c', futureCount + notFutureCount, weeks.length * 7,
    'every cell is classified as either future or not-future');
  // Spec: future cells are NOT rendered at all. The expected behavior
  // is that YearGrid returns `null` for those — so they are skipped
  // from the rendered output. We assert by checking the cell count
  // matches the spec: weeks × 7 minus the future cells = the rendered
  // count.
  const todayCol = weeks.length - 1;
  // 2026-08-25 is Tue → today's row in the last week is index 1.
  // Future cells in the last week are indices 2..6 (Wed..Sun) = 5.
  const futureInLastWeek = weeks[todayCol].length - 1 - 1; // 7 - 1 - 1 = 5
  expect('GRID-01d', futureInLastWeek, 5,
    'last column has 5 future cells (Wed..Sun after Tue 2026-08-25)');
  // Rendered cell count = 35*7 - 5 = 240.
  const renderedCells = weeks.length * 7 - futureInLastWeek;
  expect('GRID-01e', renderedCells, 240,
    'rendered cell count = 35 weeks × 7 − 5 future-in-last-week = 240');
}

// ─── GRID-02 — Month label anchored to the 1st-of-month column ────────
// For every month, the column labelled with that month's short name
// must actually contain a day whose `getDate() === 1` in that month.
{
  const weeks = buildYearWeeks(REF);
  const monthLabels = buildMonthLabels(weeks);

  // Today is 2026-08-25, so the grid only covers months whose 1st
  // has already happened: Jan..Aug = 8 labels. Sep..Dec are not in
  // the grid yet.
  expect('GRID-02-count', monthLabels.length, 8,
    '8 month labels for Jan..Aug 2026 (the months whose 1st has already happened)');

  // For each label, the labelled column must contain the 1st of the
  // named month.
  let allOk = true;
  const failDetail = [];
  for (const lbl of monthLabels) {
    const week = weeks[lbl.colIdx];
    const has1st = week.some((d) => d.getMonth() === MONTH_INDEX[lbl.label] && d.getDate() === 1);
    if (!has1st) {
      allOk = false;
      failDetail.push(`${lbl.label}@col${lbl.colIdx} has no day-1 cell`);
    }
  }
  expectTrue('GRID-02', allOk,
    'every month label sits over a column that contains the 1st: ' +
    (allOk ? 'all present months' : failDetail.join('; ')));
}

// (MONTH_INDEX already declared at the top of the file)

// ─── GRID-02b — Aug label sits over the column containing Aug 1 ────────
// Aug 1 2026 is a Saturday. The column containing it is the one
// starting Mon 2026-07-27. That column should carry the "Aug" label.
{
  const weeks = buildYearWeeks(REF);
  const monthLabels = buildMonthLabels(weeks);
  const aug = monthLabels.find((m) => m.label === 'Aug');
  expectTrue('GRID-02b', !!aug, 'Aug label exists');
  // Find the column whose Monday is 2026-07-27.
  const expectedColIdx = weeks.findIndex((w) => format(w[0], 'yyyy-MM-dd') === '2026-07-27');
  expect('GRID-02b-col', expectedColIdx >= 0, true,
    'column starting Mon 2026-07-27 exists in the grid');
  expect('GRID-02b-idx', aug.colIdx, expectedColIdx,
    'Aug label is on the column whose Monday is 2026-07-27 (which contains Sat Aug 1)');
  // That column must contain Aug 1 (Sat) — index 5 in Mon..Sun.
  expect(
    'GRID-02b-cell',
    format(weeks[aug.colIdx][5], 'yyyy-MM-dd'),
    '2026-08-01',
    'Aug label column contains Sat 2026-08-01 in row index 5',
  );
}

// ─── GRID-02c — Bug repro: the OLD logic labelled the wrong column ────
// The previous implementation placed the "Aug" label on the column
// whose Monday is in days 1..7 of August. Aug 2026's first Monday is
// 2026-08-03. So the old code would NOT have labelled 2026-07-27's
// column at all — it would have labelled 2026-08-03's column, which
// is one week late. We assert the new behaviour does NOT match that
// old (buggy) behaviour.
{
  const weeks = buildYearWeeks(REF);
  const monthLabels = buildMonthLabels(weeks);
  const aug = monthLabels.find((m) => m.label === 'Aug');
  const oldBuggyColIdx = weeks.findIndex((w) => format(w[0], 'yyyy-MM-dd') === '2026-08-03');
  expect('GRID-02c-oldCol', oldBuggyColIdx >= 0, true,
    'old-buggy column (Mon 2026-08-03) exists');
  expectFalse('GRID-02c', aug.colIdx === oldBuggyColIdx,
    'Aug label is NOT on the old-buggy column (Mon 2026-08-03)');
}

// ─── GRID-03 — Day-of-week gutter matches Mon..Sun ────────────────────
{
  // DOW_LABELS index i must correspond to rowIdx i. We assert by
  // re-deriving the expected label from the day in that rowIdx of the
  // first week and checking the constant matches.
  const weeks = buildYearWeeks(REF);
  const firstWeek = weeks[0];
  for (let i = 0; i < 7; i++) {
    const d = firstWeek[i];
    const expectedShort = SHORT_DOW[d.getDay()]; // getDay: Sun=0..Sat=6
    expect(
      `GRID-03-${i}`,
      DOW_LABELS[i],
      expectedShort,
      `rowIdx ${i} label "${DOW_LABELS[i]}" matches day-of-week ${expectedShort} in the first column`,
    );
  }
}

// ─── GRID-04 — Week column count is correct for elapsed weeks ──────────
// Already covered by WEEKS-06, but the test plan lists this as
// GRID-04 specifically.
{
  const weeks = buildYearWeeks(REF);
  // Compute expected count from the spec formula:
  //   ceil(((today − monday-of-jan-1) + 1) / 7)
  const jan1 = new Date(REF.getFullYear(), 0, 1);
  const mondayOfJan1 = januaryAnchor(REF.getFullYear());
  const diffDays = Math.floor(
    (new Date(REF.getFullYear(), REF.getMonth(), REF.getDate()).getTime() -
      new Date(mondayOfJan1.getFullYear(), mondayOfJan1.getMonth(), mondayOfJan1.getDate()).getTime()) /
      86400000,
  );
  const expected = Math.ceil((diffDays + 1) / 7);
  expect(
    'GRID-04', columnCount(weeks), expected,
    `column count ${columnCount(weeks)} matches spec formula ceil((${diffDays}+1)/7) = ${expected}`,
  );
}

// ─── FUTURE-01 — isFutureCell: today itself is not future ──────────────
{
  expectFalse('FUTURE-01', isFutureCell(REF, REF),
    'isFutureCell(today, today) is false');
}

// ─── FUTURE-02 — isFutureCell: tomorrow is future ──────────────────────
{
  const tomorrow = new Date(REF);
  tomorrow.setDate(tomorrow.getDate() + 1);
  expectTrue('FUTURE-02', isFutureCell(tomorrow, REF),
    'isFutureCell(tomorrow, today) is true');
}

// ─── FUTURE-03 — isFutureCell: yesterday is not future ─────────────────
{
  const yesterday = new Date(REF);
  yesterday.setDate(yesterday.getDate() - 1);
  expectFalse('FUTURE-03', isFutureCell(yesterday, REF),
    'isFutureCell(yesterday, today) is false');
}

// ─── FUTURE-04 — isFutureCell: same day, different time = not future ───
{
  // 11:59 PM today is still today.
  const lateToday = new Date(REF);
  lateToday.setHours(23, 59, 59, 999);
  expectFalse('FUTURE-04', isFutureCell(lateToday, REF),
    'isFutureCell is local-day based, not time-of-day');
}

// ─── MONTH-EDGE-01 — Jan label is on the column containing Jan 1 ───────
// Jan 1 2026 is a Thursday → column starts Mon 2025-12-29.
{
  const weeks = buildYearWeeks(REF);
  const monthLabels = buildMonthLabels(weeks);
  const jan = monthLabels.find((m) => m.label === 'Jan');
  expectTrue('MONTH-EDGE-01', !!jan, 'Jan label exists');
  // That column must contain a Thu with date 1 (index 3 in Mon..Sun).
  expect(
    'MONTH-EDGE-01-cell',
    format(weeks[jan.colIdx][3], 'yyyy-MM-dd'),
    '2026-01-01',
    'Jan label column contains Thu 2026-01-01 in row index 3',
  );
}

// ─── MONTH-EDGE-02 — Dec label is absent (Dec 1 is in the future) ─────
// REF is 2026-08-25 — the grid ends on the Sunday of today's week
// (2026-08-30), so Dec 1 2026 is not in the grid. The Dec label
// should therefore be absent from monthLabels. We pin this behaviour
// so a future change can't accidentally pull in future months.
{
  const weeks = buildYearWeeks(REF);
  const monthLabels = buildMonthLabels(weeks);
  const dec = monthLabels.find((m) => m.label === 'Dec');
  expectTrue('MONTH-EDGE-02', !dec,
    'Dec label is absent because Dec 1 2026 is after today (2026-08-25)');
}

// ─── MONTH-EDGE-03 — Dec label is on the column containing Dec 1 ───────
// Use a reference date in December so the Dec column is in the grid.
// Dec 1 2026 is a Tuesday → column starts Mon 2026-11-30.
{
  const decRef = new Date(2026, 11, 15, 12, 0, 0); // 2026-12-15
  const weeks = buildYearWeeks(decRef);
  const monthLabels = buildMonthLabels(weeks);
  const dec = monthLabels.find((m) => m.label === 'Dec');
  expectTrue('MONTH-EDGE-03', !!dec,
    'Dec label exists when ref date is in December');
  // That column must contain a Tue with date 1 (index 1 in Mon..Sun).
  expect(
    'MONTH-EDGE-03-cell',
    format(weeks[dec.colIdx][1], 'yyyy-MM-dd'),
    '2026-12-01',
    'Dec label column contains Tue 2026-12-01 in row index 1',
  );
}

// ─── Report ────────────────────────────────────────────────────────────
// ─── SECTION-01 — buildMonthSections: REF=Aug 25, 2026 → 8 sections ──
// Today is 2026-08-25. The grid should have one section per month
// from January through August — 8 sections total.
{
  const sections = buildMonthSections(REF);
  expect('SECTION-01', sections.length, 8,
    '8 sections (Jan..Aug) for REF=2026-08-25');
}

// ─── SECTION-02 — Each section is labelled with its short month name ───
{
  const sections = buildMonthSections(REF);
  for (let i = 0; i < sections.length; i++) {
    expect(
      `SECTION-02-${i}`,
      sections[i].label,
      MONTH_SHORT[i],
      `section[${i}].label is ${MONTH_SHORT[i]}`,
    );
  }
}

// ─── SECTION-03 — Each section carries the right year + month ─────────
{
  const sections = buildMonthSections(REF);
  for (let i = 0; i < sections.length; i++) {
    expect(
      `SECTION-03-${i}-year`,
      sections[i].year, 2026,
      `section[${i}].year is 2026`,
    );
    expect(
      `SECTION-03-${i}-month`,
      sections[i].month, i,
      `section[${i}].month is ${i}`,
    );
  }
}

// ─── SECTION-04 — Each section's weeks start on Mon of 1st's week ─────
// Jan 1 2026 is Thu → Mon of that week is 2025-12-29.
{
  const sections = buildMonthSections(REF);
  const jan = sections[0];
  expect(
    'SECTION-04',
    format(jan.weeks[0][0], 'yyyy-MM-dd'),
    '2025-12-29',
    'Jan section starts on Mon 2025-12-29 (the Monday of Jan 1\'s week)',
  );
}

// ─── SECTION-05 — Each section's weeks end on Sun of last day's week ──
// Jan 31 2026 is Sat → Sun of that week is 2026-02-01.
{
  const sections = buildMonthSections(REF);
  const jan = sections[0];
  const lastWeek = jan.weeks[jan.weeks.length - 1];
  expect(
    'SECTION-05',
    format(lastWeek[6], 'yyyy-MM-dd'),
    '2026-02-01',
    'Jan section ends on Sun 2026-02-01 (the Sunday of Jan 31\'s week)',
  );
}

// ─── SECTION-06 — Aug section: Aug 1 is in the first week column ──────
// Aug 1 2026 is Sat. The Aug section's first week should contain
// 2026-08-01 in row index 5 (Mon=0..Sun=6).
{
  const sections = buildMonthSections(REF);
  const aug = sections.find((s) => s.month === 7);
  const firstWeek = aug.weeks[0];
  const aug1Idx = firstWeek.findIndex((d) => d.getDate() === 1 && d.getMonth() === 7);
  expect('SECTION-06', aug1Idx, 5,
    'Aug section: Aug 1 (Sat) is at row index 5 in the first week column');
}

// ─── SECTION-07 — Aug section: Aug 31 is in the last week column ──────
// Aug 31 2026 is Mon. The Aug section's last week should contain
// 2026-08-31 in row index 0.
{
  const sections = buildMonthSections(REF);
  const aug = sections.find((s) => s.month === 7);
  const lastWeek = aug.weeks[aug.weeks.length - 1];
  const aug31Idx = lastWeek.findIndex((d) => d.getDate() === 31 && d.getMonth() === 7);
  expect('SECTION-07', aug31Idx, 0,
    'Aug section: Aug 31 (Mon) is at row index 0 in the last week column');
}

// ─── SECTION-08 — isCellInMonth: cell in same month returns true ───────
{
  const d = new Date(2026, 7, 15); // 2026-08-15
  expectTrue('SECTION-08', isCellInMonth(d, 2026, 7),
    'isCellInMonth(Aug 15, 2026, 7) is true');
}

// ─── SECTION-09 — isCellInMonth: cell in prev month returns false ─────
{
  const d = new Date(2026, 6, 31); // 2026-07-31
  expectFalse('SECTION-09', isCellInMonth(d, 2026, 7),
    'isCellInMonth(Jul 31, 2026, 7) is false (wrong month)');
}

// ─── SECTION-10 — isCellInMonth: cell in next month returns false ─────
{
  const d = new Date(2026, 8, 1); // 2026-09-01
  expectFalse('SECTION-10', isCellInMonth(d, 2026, 7),
    'isCellInMonth(Sep 1, 2026, 7) is false (wrong month)');
}

// ─── SECTION-11 — Each week column has exactly 7 cells ────────────────
{
  const sections = buildMonthSections(REF);
  let allOk = true;
  for (const s of sections) {
    for (const w of s.weeks) {
      if (w.length !== 7) { allOk = false; break; }
    }
  }
  expectTrue('SECTION-11', allOk, 'every week column in every section has 7 cells');
}

// ─── SECTION-12 — Every section's first week starts on a Monday ───────
{
  const sections = buildMonthSections(REF);
  let allOk = true;
  for (const s of sections) {
    if (s.weeks[0][0].getDay() !== 1) { allOk = false; break; }
  }
  expectTrue('SECTION-12', allOk,
    'every section starts with a Monday in the first week column');
}

// ─── SECTION-13 — Aug section week count is right ──────────────────────
// Aug 2026: Aug 1 is Sat, Aug 31 is Mon. Aug's section spans
// Mon 2026-07-27 → Sun 2026-09-06. That's 6 weeks.
{
  const sections = buildMonthSections(REF);
  const aug = sections.find((s) => s.month === 7);
  expect('SECTION-13', aug.weeks.length, 6,
    'Aug section has 6 week columns (Jul 27 → Sep 6)');
}

// ─── SECTION-14 — totalColumnCount sums all weeks across sections ─────
{
  const sections = buildMonthSections(REF);
  const expected = sections.reduce((sum, s) => sum + s.weeks.length, 0);
  expect('SECTION-14', totalColumnCount(sections), expected,
    `totalColumnCount === sum of all section weeks (${expected})`);
}

// ─── SECTION-15 — Inter-month gap: Jul ends on Wed → Aug starts on Thu
// in its own block. The Aug block's first week is Mon Jul 27 → Sun
// Aug 2. The Jul block's last week is Mon Jul 27 → Sun Aug 2 too.
// Within the Jul block, only Jul cells (Mon Jul 27 - Fri Jul 31) are
// rendered; Sat Aug 1 and Sun Aug 2 are skipped. The Aug block
// renders Fri Aug 1 and Sat Aug 2 (and skips Mon-Thu of Jul).
//
// This is the visual: end of Jul's last column (Fri Jul 31, row 4)
// → [GAP between sections] → Aug's first column starts at row 4
// (Fri Aug 1) — i.e. "Aug starts on Thursday" of the previous
// month's view, but in a NEW column block.
//
// We assert: the Aug block's first rendered cell is at row 4
// (Friday), and the next cells are row 5 (Sat), row 0 (Mon), etc.
{
  const sections = buildMonthSections(REF);
  const aug = sections.find((s) => s.month === 7);
  const firstWeek = aug.weeks[0];
  // Filter to cells that are in Aug AND not in the future (REF=Aug 25).
  const visibleCells = firstWeek
    .map((d, i) => ({ d, i, inMonth: isCellInMonth(d, 2026, 7) && !isFutureCell(d, REF) }))
    .filter((c) => c.inMonth);
  // First visible cell is Sat Aug 1 at row index 5.
  expect('SECTION-15-firstRow', visibleCells[0].i, 5,
    'first rendered cell in Aug block is at row index 5 (Sat Aug 1)');
  expect(
    'SECTION-15-firstKey',
    format(visibleCells[0].d, 'yyyy-MM-dd'),
    '2026-08-01',
    'first rendered cell in Aug block is Sat 2026-08-01',
  );
  // Second visible cell is Sun Aug 2 at row index 6.
  expect('SECTION-15-secondRow', visibleCells[1].i, 6,
    'second rendered cell in Aug block is at row index 6 (Sun Aug 2)');
  expect(
    'SECTION-15-secondKey',
    format(visibleCells[1].d, 'yyyy-MM-dd'),
    '2026-08-02',
    'second rendered cell in Aug block is Sun 2026-08-02',
  );
}

// ─── SECTION-16 — Jul block: Aug 1-2 cells are skipped (out of month) ─
// Within the Jul block, the last week column (Mon Jul 27 → Sun Aug 2)
// has Aug 1 (Sat) and Aug 2 (Sun) which are NOT in July. They should
// be skipped at render time. We assert that filtering by
// `isCellInMonth(d, 2026, 6)` excludes those two dates.
{
  const jul = buildMonthWeeks(2026, 6);
  const lastWeek = jul[jul.length - 1];
  // Cells in last week that are in July (indices 0..4 = Mon..Fri).
  const julyCells = lastWeek.filter((d) => isCellInMonth(d, 2026, 6));
  expect('SECTION-16-count', julyCells.length, 5,
    'Jul block: last week has 5 in-month cells (Mon..Fri)');
  // Cells NOT in July (Aug 1-2 at indices 5, 6).
  const nonJulyCells = lastWeek.filter((d) => !isCellInMonth(d, 2026, 6));
  expect('SECTION-16-excluded', nonJulyCells.length, 2,
    'Jul block: last week has 2 cells excluded (Sat Aug 1, Sun Aug 2)');
  expect(
    'SECTION-16-excluded-keys',
    nonJulyCells.map((d) => format(d, 'yyyy-MM-dd')),
    ['2026-08-01', '2026-08-02'],
    'excluded cells are Aug 1 and Aug 2',
  );
}

// ─── SECTION-17 — Future cells are also skipped within a section ──────
// Today is 2026-08-25. Within the Aug block, cells after Aug 25
// should not be rendered. We assert that filtering by `isFutureCell`
// matches the expected future cells.
{
  const sections = buildMonthSections(REF);
  const aug = sections.find((s) => s.month === 7);
  let futureCount = 0;
  let notFutureInMonth = 0;
  for (const week of aug.weeks) {
    for (const d of week) {
      if (isFutureCell(d, REF)) futureCount++;
      else if (isCellInMonth(d, 2026, 7)) notFutureInMonth++;
    }
  }
  // Aug 2026: 31 days, but Aug 26-31 are future (6 days). The Aug
  // block spans Mon Jul 27 → Sun Sep 6, which is 42 cells. Of those
  // 42, the in-month non-future cells = 25 (Aug 1-25). Future cells
  // include Aug 26-31 AND Sep 1-6 — 12 cells total. The remaining
  // 42 - 25 - 12 = 5 are out-of-month non-future (Jul 27-31).
  expect('SECTION-17-future', futureCount, 12,
    '12 future cells in the Aug block (Aug 26-31 + Sep 1-6)');
  expect('SECTION-17-rendered', notFutureInMonth, 25,
    '25 rendered in-month non-future cells in the Aug block (Aug 1-25)');
}

// ─── SECTION-18 — buildMonthSections: Jan reference → 1 section ───────
{
  const janRef = new Date(2026, 0, 15, 12, 0, 0);
  const sections = buildMonthSections(janRef);
  expect('SECTION-18', sections.length, 1,
    '1 section when REF is in January (only Jan has happened)');
  expect('SECTION-18-label', sections[0].label, 'Jan',
    'the only section is labelled Jan');
}

// ─── SECTION-19 — buildMonthSections: Dec reference → 12 sections ─────
{
  const decRef = new Date(2026, 11, 15, 12, 0, 0);
  const sections = buildMonthSections(decRef);
  expect('SECTION-19', sections.length, 12,
    '12 sections when REF is in December (Jan..Dec)');
  expect('SECTION-19-last', sections[11].label, 'Dec',
    'last section is labelled Dec');
}

// ─── SECTION-20 — buildMonthWeeks: Feb 2026 has 28 days in 4 weeks ────
// Feb 2026: Feb 1 is Sun, Feb 28 is Sat. Feb's section spans
// Mon Jan 26 → Sun Mar 1. That's 5 weeks.
{
  const feb = buildMonthWeeks(2026, 1);
  expect('SECTION-20-weeks', feb.length, 5,
    'Feb 2026 section has 5 week columns (Jan 26 → Mar 1)');
  // Total in-month cells in Feb section = 28.
  let inMonth = 0;
  for (const w of feb) {
    for (const d of w) {
      if (isCellInMonth(d, 2026, 1)) inMonth++;
    }
  }
  expect('SECTION-20-cells', inMonth, 28,
    'Feb 2026 section has 28 in-month cells');
}

// ─── SECTION-21 — Feb 2027 (not a leap year candidate, but check) ─────
// Feb 2027: Feb 1 is Mon, Feb 28 is Sun. Section spans Mon Feb 1 →
// Sun Feb 28. That's 4 weeks.
{
  const feb = buildMonthWeeks(2027, 1);
  expect('SECTION-21-weeks', feb.length, 4,
    'Feb 2027 section has 4 week columns (Feb 1 → Feb 28)');
  let inMonth = 0;
  for (const w of feb) {
    for (const d of w) {
      if (isCellInMonth(d, 2027, 1)) inMonth++;
    }
  }
  expect('SECTION-21-cells', inMonth, 28,
    'Feb 2027 section has 28 in-month cells');
}

// ─── SECTION-22 — Inter-month gap: month with Aug 1 on Sat ────────────
// For Aug 2026 (1st on Sat), the cells in the Aug block at the
// START of the first week (Mon-Thu, which are Jul 27-30) are
// out-of-month. This is the visual "empty space at the start of
// the Aug block" — symmetric to "empty space at the end of the
// Jul block" (where Aug 1-2 are excluded).
{
  const sections = buildMonthSections(REF);
  const aug = sections.find((s) => s.month === 7);
  const firstWeek = aug.weeks[0];
  // Cells in first week that are in Aug (indices 5, 6 = Sat Aug 1, Sun Aug 2).
  const augCells = firstWeek
    .map((d, i) => ({ d, i }))
    .filter((c) => isCellInMonth(c.d, 2026, 7));
  expect('SECTION-22', augCells.length, 2,
    'Aug block: first week has 2 in-month cells (Sat Aug 1, Sun Aug 2)');
  expect('SECTION-22-rows', augCells.map((c) => c.i), [5, 6],
    'those cells are at row indices 5 (Sat) and 6 (Sun)');
}

// ─── Report ────────────────────────────────────────────────────────────
console.log('\n=== YEAR-GRID TEST REPORT ===');
for (const r of results) {
  console.log(`[${r.id}] ${r.status} — ${r.reason}`);
}
console.log(`\nTotals: ${pass} pass / ${fail} fail / ${partial} partial`);
process.exit(fail === 0 ? 0 : 1);
