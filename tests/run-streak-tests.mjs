// Pre-commit test for BUGS.md #1 / tests.md Section A.
// Runs with plain Node — no Jest, no extra deps. Exercises the same
// `computeNextStreak` and `hasActivityToday` that AppContext.recomputeStreak
// uses, so a pass here means the live app passes too.
//
// Usage: node tests/run-streak-tests.mjs
// Exit code: 0 = all pass, 1 = at least one fail.

import {
  todayKey,
  hasActivityToday,
  computeNextStreak,
} from '../src/utils/streak.js';

let pass = 0;
let fail = 0;
let partial = 0;
const results = [];

function record(id, status, reason) {
  results.push({ id, status, reason });
  if (status === 'PASS') pass++;
  else if (status === 'PARTIAL') partial++;
  else fail++;
}

function expect(id, actual, expected, reason) {
  // Deep-equal via JSON (decision objects are JSON-safe).
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  record(
    id,
    ok ? 'PASS' : 'FAIL',
    ok
      ? reason
      : `${reason} — got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`,
  );
}

const today = new Date(2026, 7, 24, 14, 30, 0); // 2026-08-24 14:30 local
const todayK = todayKey(today);
const yesterdayK = todayKey(new Date(today.getTime() - 86400000));
const threeDaysAgoK = todayKey(new Date(today.getTime() - 3 * 86400000));
console.log('today =', todayK, 'yesterday =', yesterdayK, 'threeDaysAgo =', threeDaysAgoK);

// ─── STREAK-01 — Task completion today increments the streak ──────────────
{
  const tasks = [
    {
      id: 't1',
      status: 'completed',
      completedAt: new Date(2026, 7, 24, 9, 0, 0).toISOString(),
    },
  ];
  const hobbies = [];
  const decision = computeNextStreak({
    tasks, hobbies,
    anchorDate: null, currentStreak: 0,
    ref: today,
  });
  expect('STREAK-01', decision, { kind: 'credit', streak: 1, anchorDate: todayK },
    'task completion today credits streak 0 → 1');
}

// ─── STREAK-02 — Hobby completion today increments the streak ────────────
{
  const tasks = [];
  const hobbies = [{ id: 'h1', completions: { [todayK]: true } }];
  const decision = computeNextStreak({
    tasks, hobbies,
    anchorDate: null, currentStreak: 0,
    ref: today,
  });
  expect('STREAK-02', decision, { kind: 'credit', streak: 1, anchorDate: todayK },
    'hobby completion today credits streak 0 → 1');
}

// ─── STREAK-03 — Day with neither task nor hobby does not change the streak
{
  const decision = computeNextStreak({
    tasks: [], hobbies: [],
    anchorDate: yesterdayK, currentStreak: 5,
    ref: today,
  });
  expect('STREAK-03', decision, { kind: 'noop' },
    'no activity today → noop');
}

// ─── STREAK-04 — A gap day followed by activity resets the streak to 1 ────
{
  const hobbies = [{ id: 'h1', completions: { [todayK]: true } }];
  const decision = computeNextStreak({
    tasks: [], hobbies,
    anchorDate: threeDaysAgoK, currentStreak: 5,
    ref: today,
  });
  expect('STREAK-04', decision, { kind: 'credit', streak: 1, anchorDate: todayK },
    'gap day + activity today resets streak to 1');
}

// ─── STREAK-05 — Consecutive days keep incrementing ───────────────────────
{
  const hobbies = [{ id: 'h1', completions: { [todayK]: true } }];
  const decision = computeNextStreak({
    tasks: [], hobbies,
    anchorDate: yesterdayK, currentStreak: 5,
    ref: today,
  });
  expect('STREAK-05', decision, { kind: 'credit', streak: 6, anchorDate: todayK },
    'consecutive day + activity today → 5 + 1 = 6');
}

// ─── STREAK-EXTRA-01 — already credited today + activity present: noop ───
{
  const decision = computeNextStreak({
    tasks: [],
    hobbies: [{ id: 'h1', completions: { [todayK]: true } }],
    anchorDate: todayK, currentStreak: 7,
    ref: today,
  });
  expect('STREAK-EXTRA-01', decision, { kind: 'noop' },
    'already credited today + activity present → noop');
}

// ─── STREAK-EXTRA-02 — task completed yesterday does not count for today ─
{
  const tasks = [
    {
      id: 't1',
      status: 'completed',
      completedAt: new Date(2026, 7, 23, 23, 59, 0).toISOString(),
    },
  ];
  const has = hasActivityToday(tasks, [], today);
  expect('STREAK-EXTRA-02', has, false, 'yesterday completion is not today activity');
}

// ─── STREAK-EXTRA-03 — task completed just after midnight today counts ───
{
  const tasks = [
    {
      id: 't1',
      status: 'completed',
      completedAt: new Date(2026, 7, 24, 0, 5, 0).toISOString(),
    },
  ];
  const has = hasActivityToday(tasks, [], today);
  expect('STREAK-EXTRA-03', has, true, '00:05 today completion is today activity');
}

// ─── STREAK-EXTRA-04 — hobby marked yesterday does not count for today ───
{
  const hobbies = [{ id: 'h1', completions: { [yesterdayK]: true } }];
  const has = hasActivityToday([], hobbies, today);
  expect('STREAK-EXTRA-04', has, false, 'yesterday hobby is not today activity');
}

// ─── STREAK-REVERT-01 — unmarking today's only hobby reverts by 1 ─────────
{
  // After revert: streak=4, anchor moves BACK to yesterday (the day the
  // new lower streak was first reached). The next day's activity will
  // see anchorDate=yesterday and continue at +1.
  const hobbies = [{ id: 'h1', completions: {} }];
  const decision = computeNextStreak({
    tasks: [], hobbies,
    anchorDate: todayK, currentStreak: 5,
    ref: today,
  });
  expect('STREAK-REVERT-01', decision, { kind: 'revert', streak: 4, anchorDate: yesterdayK },
    "unmark today's only hobby reverts streak 5 → 4, anchor→yesterday");
}

// ─── STREAK-REVERT-02 — unmarking when streak is 1 clamps to 0, anchor→null
{
  const hobbies = [{ id: 'h1', completions: {} }];
  const decision = computeNextStreak({
    tasks: [], hobbies,
    anchorDate: todayK, currentStreak: 1,
    ref: today,
  });
  expect('STREAK-REVERT-02', decision, { kind: 'revert', streak: 0, anchorDate: null },
    'revert with streak=1 clamps to 0, anchor→null');
}

// ─── STREAK-REVERT-03 — task completion today keeps streak even if hobby unmarked
{
  const hobbies = [{ id: 'h1', completions: {} }];
  const tasks = [
    {
      id: 't1',
      status: 'completed',
      completedAt: new Date(2026, 7, 24, 12, 0, 0).toISOString(),
    },
  ];
  const decision = computeNextStreak({
    tasks, hobbies,
    anchorDate: todayK, currentStreak: 7,
    ref: today,
  });
  expect('STREAK-REVERT-03', decision, { kind: 'noop' },
    'task completion today keeps streak at 7 (activity present → noop)');
}

// ─── STREAK-REVERT-04 — re-marking the hobby after revert continues streak ─
{
  // Scenario: anchorDate=yesterday, streak=4 (post-revert state). User
  // re-marks the hobby. Activity present, anchorDate === yesterday →
  // +1, new anchor=today. Streak continues, doesn't reset.
  const hobbies = [{ id: 'h1', completions: { [todayK]: true } }];
  const decision = computeNextStreak({
    tasks: [], hobbies,
    anchorDate: yesterdayK, currentStreak: 4,
    ref: today,
  });
  expect('STREAK-REVERT-04', decision, { kind: 'credit', streak: 5, anchorDate: todayK },
    're-mark after revert: anchor=yesterday, +1, anchor→today (streak continues)');
}

// ─── STREAK-REVERT-05 — unmarking when no credit was given today: noop ──
{
  const hobbies = [{ id: 'h1', completions: {} }];
  const decision = computeNextStreak({
    tasks: [], hobbies,
    anchorDate: yesterdayK, currentStreak: 3,
    ref: today,
  });
  expect('STREAK-REVERT-05', decision, { kind: 'noop' },
    'unmark with anchorDate=yesterday: no change');
}

// ─── STREAK-STUCK-01 — repro of the live-app bug; now resolved ───────────
// The exact state from the user's log: anchorDate=today, streak=0, but
// activity is present. With the OLD logic this was a noop and the user
// was stuck on 0 forever. With the new logic we need to make sure this
// never happens — and the LOAD_STATE migration cleans it up.
//
// Simulate the post-migration state (anchorDate=null, streak=0) and
// confirm the next activity credits to 1.
{
  const hobbies = [{ id: 'h1', completions: { [todayK]: true } }];
  const decision = computeNextStreak({
    tasks: [], hobbies,
    anchorDate: null, currentStreak: 0,
    ref: today,
  });
  expect('STREAK-STUCK-01', decision, { kind: 'credit', streak: 1, anchorDate: todayK },
    'post-migration: activity today with anchor=null credits to 1');
}

// ─── STREAK-STUCK-02 — revert from a fresh credit, then re-credit, full cycle
{
  // Step 1: user marks hobby. anchor=null, streak=0 → credit to 1, anchor=today.
  let s = computeNextStreak({
    tasks: [], hobbies: [{ id: 'h1', completions: { [todayK]: true } }],
    anchorDate: null, currentStreak: 0, ref: today,
  });
  // Step 2: user unmarks. anchor=today, streak=1 → revert to 0, anchor=null.
  s = computeNextStreak({
    tasks: [], hobbies: [{ id: 'h1', completions: {} }],
    anchorDate: s.anchorDate, currentStreak: s.streak, ref: today,
  });
  // Step 3: user re-marks. anchor=null, streak=0 → credit to 1, anchor=today.
  s = computeNextStreak({
    tasks: [], hobbies: [{ id: 'h1', completions: { [todayK]: true } }],
    anchorDate: s.anchorDate, currentStreak: s.streak, ref: today,
  });
  expect('STREAK-STUCK-02', s, { kind: 'credit', streak: 1, anchorDate: todayK },
    'mark → unmark → re-mark ends with streak=1, anchor=today (no stuck state)');
}

// ─── STREAK-ANCHOR-01 — five-day run, single revert on day 5 ─────────────
{
  // Walk a 5-day streak forward, then on the 5th day unmark the hobby.
  // Streak should revert to 4, anchor should land on day-1 (yesterday
  // of the 5th day), so a 6th day of activity would credit to 5.
  let s = { kind: 'noop' };
  // Day 1: anchor=null, streak=0 → credit
  s = computeNextStreak({
    tasks: [], hobbies: [{ id: 'h1', completions: { [todayKey(new Date(today.getTime() - 4 * 86400000))]: true } }],
    anchorDate: null, currentStreak: 0,
    ref: new Date(today.getTime() - 4 * 86400000),
  });
  // Day 2..4: each day anchor=yesterday, so +1
  for (let d = 3; d >= 1; d--) {
    const ref = new Date(today.getTime() - d * 86400000);
    s = computeNextStreak({
      tasks: [], hobbies: [{ id: 'h1', completions: { [todayKey(ref)]: true } }],
      anchorDate: s.anchorDate, currentStreak: s.streak, ref,
    });
  }
  // Day 5 (today): mark hobby, then unmark. Use today's ref.
  // First mark:
  s = computeNextStreak({
    tasks: [], hobbies: [{ id: 'h1', completions: { [todayK]: true } }],
    anchorDate: yesterdayK, currentStreak: 4, ref: today,
  });
  expect('STREAK-ANCHOR-01a', s, { kind: 'credit', streak: 5, anchorDate: todayK },
    'day 5 credit: streak 4 → 5, anchor=today');
  // Now unmark on day 5:
  s = computeNextStreak({
    tasks: [], hobbies: [{ id: 'h1', completions: {} }],
    anchorDate: todayK, currentStreak: 5, ref: today,
  });
  expect('STREAK-ANCHOR-01b', s, { kind: 'revert', streak: 4, anchorDate: yesterdayK },
    'day 5 revert: streak 5 → 4, anchor→yesterday (so day 6 would continue)');
}

// ─── Report ──────────────────────────────────────────────────────────────
console.log('\n=== STREAK TEST REPORT ===');
for (const r of results) {
  console.log(`[${r.id}] ${r.status} — ${r.reason}`);
}
console.log(`\nTotals: ${pass} pass / ${fail} fail / ${partial} partial`);
process.exit(fail === 0 ? 0 : 1);
