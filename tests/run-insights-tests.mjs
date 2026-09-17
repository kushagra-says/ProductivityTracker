// Tests for the Insights hobby statistics helpers (hobbyStats.js).
// Plain-Node ESM — no Jest, no extra deps. Covers the distinct-day
// union fix plus the new best/lowest streak + hobby stats the
// Insights Hobbies card renders.
//
// Usage: node tests/run-insights-tests.mjs
// Exit code: 0 = all pass, 1 = at least one fail.

import {
  currentStreak,
  longestStreak,
  hobbyTotalDays,
  distinctCompletionDays,
  maxLongestStreak,
  maxCurrentStreak,
  lowestHobby,
} from '../src/utils/hobbyStats.js';

// Fixed reference day for determinism: Sep 17 2026.
const NOW = new Date(2026, 8, 17);

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

// Hobby factory — completions keyed 'YYYY-MM-DD' → true, exactly as
// the TOGGLE_HOBBY_TODAY reducer writes them.
function hobby(name, days) {
  return {
    id: name,
    name,
    completions: Object.fromEntries((days || []).map((d) => [d, true])),
  };
}

// ─── INSH-01 — Distinct-day union: 4 hobbies completed the same day → 1 ──
// This is the bug fix: "Days completed" used to sum per-hobby counts.
{
  const hobbies = [
    hobby('A', ['2026-09-17']),
    hobby('B', ['2026-09-17']),
    hobby('C', ['2026-09-17']),
    hobby('D', ['2026-09-17']),
  ];
  expect('INSH-01', distinctCompletionDays(hobbies), 1,
    '4 hobbies completed on the same single day → 1 distinct day');
}

// ─── INSH-02 — Distinct-day union across many hobbies, overlapping ──────
// A covers Sep 1-3, B covers Sep 3-5, C overlaps A on Sep 2.
// Union = Sep 1..5 → 5 (old sum would have said 8).
{
  const hobbies = [
    hobby('A', ['2026-09-01', '2026-09-02', '2026-09-03']),
    hobby('B', ['2026-09-03', '2026-09-04', '2026-09-05']),
    hobby('C', ['2026-09-02']),
  ];
  expect('INSH-02', distinctCompletionDays(hobbies), 5,
    'overlapping completion days are deduplicated across hobbies');
}

// ─── INSH-03 — Distinct-day union: empty state → 0 (null-safe) ──────────
{
  expect('INSH-03',  distinctCompletionDays([]), 0, 'no hobbies → 0');
  expect('INSH-03b', distinctCompletionDays([hobby('A'), hobby('B')]), 0,
    'hobbies with absent completions → 0');
  expect('INSH-03c', distinctCompletionDays([{ id: 'x', name: 'x' }]), 0,
    'hobby without a completions object is skipped safely');
}

// ─── INSH-04 — hobbyTotalDays counts one hobby, null-safe ───────────────
{
  expect('INSH-04',  hobbyTotalDays(hobby('A', ['2026-09-01', '2026-09-02'])), 2,
    'hobbyTotalDays counts its own completion days');
  expect('INSH-04b', hobbyTotalDays(null), 0, 'hobbyTotalDays(null) → 0');
  expect('INSH-04c', hobbyTotalDays({ id: 'x', name: 'x' }), 0,
    'hobby without completions → 0');
}

// ─── INSH-05 — maxLongestStreak picks the best streak ever ──────────────
// A ran a 5-day streak (Sep 1-5), B only ever did 2 isolated days,
// C has none. Max must be 5, not the sum or the last hobby's.
{
  const hobbies = [
    hobby('A', ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05']),
    hobby('B', ['2026-09-01', '2026-09-03']),
    hobby('C', []),
  ];
  expect('INSH-05', maxLongestStreak(hobbies), 5,
    'maxLongestStreak returns the longest of all hobbies (5)');
  expect('INSH-05b', maxLongestStreak([]), 0, 'no hobbies → 0');
}

// ─── INSH-06 — maxCurrentStreak with a fixed now ────────────────────────
// A is checked off today (Sep 17) and yesterday → running streak 2.
// B lapsed on Sep 14 → 0. C missed today but did Sep 15-16 → streak 2
// (today optional, counted from yesterday). Max = 2.
{
  const hobbies = [
    hobby('A', ['2026-09-16', '2026-09-17']),
    hobby('B', ['2026-09-13', '2026-09-14']),
    hobby('C', ['2026-09-15', '2026-09-16']),
  ];
  expect('INSH-06', maxCurrentStreak(hobbies, NOW), 2,
    'today-completion counts; a hobby that lapsed on Sep 14 contributes 0');
}

// ─── INSH-07 — maxCurrentStreak: a lapsed hobby cannot fake a streak ────
// Only hobby left the running one entirely and stopped Sep 14 → 0.
{
  const hobbies = [hobby('A', ['2026-09-13', '2026-09-14'])];
  expect('INSH-07', maxCurrentStreak(hobbies, NOW), 0,
    'a hobby that lapsed before now has a current streak of 0');
  expect('INSH-07b', maxCurrentStreak([], NOW), 0, 'no hobbies → 0');
}

// ─── INSH-08 — lowestHobby picks the fewest days completed ──────────────
{
  const a = hobby('A', ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05']);
  const b = hobby('B', ['2026-09-01']);
  const c = hobby('C', ['2026-09-01', '2026-09-02']);
  const lowest = lowestHobby([a, b, c]);
  expect('INSH-08', lowest && lowest.name, 'B',
    'lowestHobby returns the hobby with the fewest completion days');
}

// ─── INSH-09 — lowestHobby ties resolve to the first in list order ──────
{
  const a = hobby('A', ['2026-09-01']);
  const b = hobby('B', ['2026-09-02']);
  const lowest = lowestHobby([a, b]);
  expect('INSH-09', lowest && lowest.name, 'A',
    'tie on day count keeps the first hobby in list order');
}

// ─── INSH-10 — lowestHobby on empty state → null ────────────────────────
{
  expect('INSH-10', lowestHobby([]), null, 'no hobbies → null');
  const single = lowestHobby([hobby('A', ['2026-09-01'])]);
  expect('INSH-10b', single && single.name, 'A',
    'single hobby is its own lowest performer');
}

// ─── INSH-11 — currentStreak's optional now param (old behavior intact) ─
// With `now` pinned: today checked → counts from today.
{
  const completions = { '2026-09-17': true, '2026-09-16': true, '2026-09-15': true };
  expect('INSH-11', currentStreak(completions, NOW), 3,
    'currentStreak(completions, now) walks back from the given day');
}

// ─── INSH-12 — today optional: missing today counts from yesterday ──────
{
  const completions = { '2026-09-16': true, '2026-09-15': true };
  expect('INSH-12', currentStreak(completions, NOW), 2,
    'today not yet checked → streak starts from yesterday');
}

// ─── INSH-13 — omitting `now` keeps the original behavior ───────────────
// Complete only the real current day: the walk-back can never go past
// it, so the streak is exactly 1 no matter when the test runs.
{
  // Local-date key (not toISOString — that is UTC and can lag a day).
  const local = new Date();
  const key = `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}-${String(local.getDate()).padStart(2, '0')}`;
  expect('INSH-13', currentStreak({ [key]: true }), 1,
    'omitted now → original behavior (walks back from real today)');
  expect('INSH-13b', currentStreak(null), 0, 'null completions → 0');
}

// ─── Report ──────────────────────────────────────────────────────────────
console.log('=== INSIGHTS HOBBY-STATS TEST REPORT ===');
for (const r of results) {
  console.log(`[${r.id}] ${r.status} — ${r.reason}`);
}
console.log(`\nTotals: ${pass} pass / ${fail} fail / ${partial} partial`);
process.exit(fail === 0 ? 0 : 1);