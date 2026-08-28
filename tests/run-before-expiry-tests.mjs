// Pre-commit test for BUGS.md #2 / tests.md Section B.
// Plain-Node ESM — no Jest, no extra deps. Exercises the same
// `activeChipLabel` and `isCustomStepperVisible` helpers that
// AddTaskScreen uses to decide which chip is highlighted and whether
// the custom stepper is shown.
//
// Usage: node tests/run-before-expiry-tests.mjs
// Exit code: 0 = all pass, 1 = at least one fail.

import {
  BEFORE_EXPIRY_PRESETS,
  activeChipLabel,
  isCustomStepperVisible,
  unitToMinutes,
  minutesToParts,
  clampUnitValue,
  partsToMinutes,
  partsWithinMax,
  maxBeforeExpiryMinutes,
  maxForUnit,
  formatDuration,
  MAX_BEFORE_EXPIRY_MINUTES,
  UNITS,
} from '../src/utils/beforeExpiry.js';

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

const PRESET_VALUES = BEFORE_EXPIRY_PRESETS.filter((p) => p.minutes !== null).map((p) => p.minutes);

// ─── TASK-01 — Custom mode survives stepper to 60 ────────────────────────
// User enters custom mode, then increments the stepper until the value
// is 60. The active chip must remain "Custom…", not flip to "1 hour".
{
  const active = activeChipLabel({ minutes: 60, customMode: true });
  expect('TASK-01', active, 'Custom…',
    'custom mode with minutes=60 keeps "Custom…" active');
}

// ─── TASK-01b — Custom stepper is visible while in custom mode ───────────
{
  const visible = isCustomStepperVisible({ minutes: 60, customMode: true });
  expect('TASK-01b', visible, true,
    'custom stepper is visible while in custom mode at 60 min');
}

// ─── TASK-02 — Explicit preset tap exits custom mode ─────────────────────
// Saved as "1 hour" preset (customMode=false). Active chip is "1 hour".
{
  const active = activeChipLabel({ minutes: 60, customMode: false });
  expect('TASK-02', active, '1 hour',
    'preset value 60 with customMode=false shows "1 hour"');
}

// ─── TASK-02b — Custom stepper hidden in preset mode ─────────────────────
{
  const visible = isCustomStepperVisible({ minutes: 60, customMode: false });
  expect('TASK-02b', visible, false,
    'custom stepper is hidden when in a preset (60 = "1 hour")');
}

// ─── TASK-03 — Saved value (47 min) preserves custom mode ────────────────
// A user who set 47 (which is not in the preset list) and saved, then
// re-opens the task, should see "Custom…" active on entry.
{
  const active = activeChipLabel({ minutes: 47, customMode: true });
  expect('TASK-03', active, 'Custom…',
    '47 min with customMode=true shows "Custom…"');
}

// ─── TASK-04 — All preset values show their own label when in preset mode
for (const v of PRESET_VALUES) {
  const expected = BEFORE_EXPIRY_PRESETS.find((p) => p.minutes === v).label;
  const actual = activeChipLabel({ minutes: v, customMode: false });
  expect(`TASK-04-${v}`, actual, expected,
    `preset value ${v} with customMode=false shows "${expected}"`);
}

// ─── TASK-05 — Edge: minutes=0 (beforeExpiryOff) doesn't crash and falls back to "Custom…"
{
  const active = activeChipLabel({ minutes: 0, customMode: false });
  expect('TASK-05', active, 'Custom…',
    'minutes=0 with customMode=false falls back to "Custom…"');
}

// ─── TASK-06 — Edge: a non-preset value (137) with customMode=false falls back to "Custom…"
{
  const active = activeChipLabel({ minutes: 137, customMode: false });
  expect('TASK-06', active, 'Custom…',
    'non-preset value 137 with customMode=false falls back to "Custom…"');
  const visible = isCustomStepperVisible({ minutes: 137, customMode: false });
  expect('TASK-06b', visible, true,
    'non-preset value 137 with customMode=false shows custom stepper');
}

// ─── TASK-07 — The actual bug: at 60 with customMode=true, no preset chip is "active"
{
  for (const p of BEFORE_EXPIRY_PRESETS) {
    if (p.minutes === null) continue; // Custom… itself, which is correct
    const active = activeChipLabel({ minutes: 60, customMode: true });
    if (p.label === '1 hour') {
      // The whole point: in custom mode, "1 hour" must NOT be active even
      // though the minutes value equals 60.
      expect(`TASK-07-no-${p.label}`, p.label === active, false,
        `"1 hour" is NOT active when customMode=true and minutes=60`);
    }
  }
}

// ─── TASK-08 — unitToMinutes covers all three units ─────────────────────
expect('TASK-08',  unitToMinutes(2, 'days'),    2880, 'unitToMinutes(2, days) === 2880');
expect('TASK-08b', unitToMinutes(3, 'hours'),   180,  'unitToMinutes(3, hours) === 180');
expect('TASK-08c', unitToMinutes(30, 'minutes'), 30,  'unitToMinutes(30, minutes) === 30');

// ─── TASK-09 — minutesToParts splits cleanly across boundaries ───────────
expect('TASK-09',  minutesToParts(90),   { days: 0, hours: 1, minutes: 30 },
  'minutesToParts(90) → 0d 1h 30m');
expect('TASK-09b', minutesToParts(2880), { days: 2, hours: 0, minutes: 0 },
  'minutesToParts(2880) → 2d 0h 0m');
expect('TASK-09c', minutesToParts(0),    { days: 0, hours: 0, minutes: 0 },
  'minutesToParts(0) → 0d 0h 0m');
expect('TASK-09d', minutesToParts(1500), { days: 1, hours: 1, minutes: 0 },
  'minutesToParts(1500) → 1d 1h 0m');

// ─── TASK-10 — clampUnitValue respects each unit's range ────────────────
expect('TASK-10',  clampUnitValue(25, 'hours'),   23, 'clampUnitValue(25, hours) → 23');
expect('TASK-10b', clampUnitValue(8,  'days'),    7,  'clampUnitValue(8, days) → 7');
expect('TASK-10c', clampUnitValue(-1, 'minutes'), 0,  'clampUnitValue(-1, minutes) → 0');
expect('TASK-10d', clampUnitValue(60, 'minutes'), 59, 'clampUnitValue(60, minutes) → 59');

// ─── TASK-11 — partsToMinutes composes and clamps to MAX ────────────────
expect('TASK-11',  partsToMinutes({ days: 1, hours: 2, minutes: 3 }), 1 * 1440 + 2 * 60 + 3,
  'partsToMinutes(1d 2h 3m) === 1485');
expect('TASK-11b', partsToMinutes({}), 0,
  'partsToMinutes({}) === 0');
expect('TASK-11c', partsToMinutes({ days: 99 }), MAX_BEFORE_EXPIRY_MINUTES,
  `partsToMinutes({days:99}) clamped to ${MAX_BEFORE_EXPIRY_MINUTES}`);

// ─── TASK-12 — UNITS exposes the canonical d/h/m order ──────────────────
expect('TASK-12', UNITS, ['days', 'hours', 'minutes'],
  'UNITS === ["days", "hours", "minutes"]');

// ─── TASK-13 — maxBeforeExpiryMinutes derives from expiryDate ───────────
{
  const now = new Date('2026-08-24T10:00:00');
  const future = new Date('2026-08-24T13:00:00'); // 3 hours = 180 min
  expect('TASK-13', maxBeforeExpiryMinutes(future, now), 180,
    'maxBeforeExpiryMinutes(now+3h) === 180');

  const past = new Date('2026-08-24T09:00:00');
  expect('TASK-13b', maxBeforeExpiryMinutes(past, now), null,
    'maxBeforeExpiryMinutes(now-1h) === null (past)');

  expect('TASK-13c', maxBeforeExpiryMinutes(null, now), null,
    'maxBeforeExpiryMinutes(null) === null');

  const tight = new Date(now.getTime() + 30 * 1000); // 30 seconds
  expect('TASK-13d', maxBeforeExpiryMinutes(tight, now), 1,
    'maxBeforeExpiryMinutes(now+30s) floors to 1 minute minimum');
}

// ─── TASK-14 — partsWithinMax splits greedily into d/h/m ────────────────
expect('TASK-14',  partsWithinMax(180),  { days: 0, hours: 3,  minutes: 0 },
  'partsWithinMax(180) → 0d 3h 0m');
expect('TASK-14b', partsWithinMax(1500), { days: 1, hours: 1,  minutes: 0 },
  'partsWithinMax(1500) → 1d 1h 0m');
expect('TASK-14c', partsWithinMax(90),   { days: 0, hours: 1,  minutes: 30 },
  'partsWithinMax(90) → 0d 1h 30m');
expect('TASK-14d', partsWithinMax(0),    { days: 0, hours: 0,  minutes: 0 },
  'partsWithinMax(0) → all zeros');

// ─── TASK-15 — maxForUnit respects the chosen parts ─────────────────────
{
  // max = 180 min = 3h. Picking hours=2 leaves 60 min, but the
  // minutes field is hard-capped at 59 (60 overflows into hours).
  const m = maxForUnit('minutes', { days: 0, hours: 2, minutes: 0 }, 180);
  expect('TASK-15', m, 59, 'maxForUnit("minutes", {0,2,0}, 180) → 59 (unit cap)');

  // max = 180 min. Picking days=0, hours=0 → minutes can be 180, but
  // the unit's hard cap is 59.
  const m2 = maxForUnit('minutes', { days: 0, hours: 0, minutes: 0 }, 180);
  expect('TASK-15b', m2, 59, 'maxForUnit("minutes", all-zero, 180) → 59 (unit cap)');

  // max = 180 min = 3h = 0.125 days. floor → 0.
  const d = maxForUnit('days', {}, 180);
  expect('TASK-15c', d, 0, 'maxForUnit("days", {}, 180) → 0');

  // max = 2880 min = 2 days, days picked 1 → hours left = floor(1440/60) = 24, capped at 23.
  const h = maxForUnit('hours', { days: 1, hours: 0, minutes: 0 }, 2880);
  expect('TASK-15d', h, 23, 'maxForUnit("hours", {1,0,0}, 2880) → 23');
}

// ─── TASK-16 — formatDuration renders minutes as d/h/m ───────────────────
// The before-expiry card shows caps and breakdowns in d/h/m, never as a
// raw minute total (e.g. "max 3 hours 30 min", not "max 210 min").
{
  expect('TASK-16',   formatDuration(0),    '0 min',           'formatDuration(0) → "0 min"');
  expect('TASK-16b',  formatDuration(7),    '7 min',           'formatDuration(7) → "7 min"');
  expect('TASK-16c',  formatDuration(59),   '59 min',          'formatDuration(59) → "59 min"');
  expect('TASK-16d',  formatDuration(60),   '1 hour',          'formatDuration(60) → "1 hour"');
  expect('TASK-16e',  formatDuration(90),   '1 hour 30 min',   'formatDuration(90) → "1 hour 30 min"');
  expect('TASK-16e2', formatDuration(180),  '3 hours',         'formatDuration(180) → "3 hours"');
  expect('TASK-16f',  formatDuration(1500), '1 day 1 hour',    'formatDuration(1500) → "1 day 1 hour"');
  expect('TASK-16g',  formatDuration(8775), '6 days 2 hours 15 min', 'formatDuration(8775) → full d/h/m');
  expect('TASK-16h',  formatDuration(1440), '1 day',           'formatDuration(1440) → "1 day" (no zero units)');
  // Dynamic cap from maxBeforeExpiryMinutes must be presentable as d/h/m.
  const expiry = new Date(Date.now() + 210 * 60000); // now + 3h30m
  const cap = maxBeforeExpiryMinutes(expiry);
  expect('TASK-16i',  formatDuration(cap), '3 hours 30 min', 'cap for now+3h30m formats as "3 hours 30 min"');
}

// ─── Report ──────────────────────────────────────────────────────────────
console.log('=== BEFORE-EXPIRY TEST REPORT ===');
for (const r of results) {
  console.log(`[${r.id}] ${r.status} — ${r.reason}`);
}
console.log(`\nTotals: ${pass} pass / ${fail} fail / ${partial} partial`);
process.exit(fail === 0 ? 0 : 1);
