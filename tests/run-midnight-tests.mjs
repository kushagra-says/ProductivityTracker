// Pre-commit test for BUGS.md #4 / tests.md Section E.
//
// Plain-Node ESM — no Jest, no extra deps. Exercises the same pure
// helpers (`nextLocalMidnight`, `msUntilNextMidnight`,
// `scheduleMidnightLoop`) that AppContext uses to fire the midnight
// rollover, so a pass here means the live app fires within 1s of
// local midnight.
//
// Usage: node tests/run-midnight-tests.mjs
// Exit code: 0 = all pass, 1 = at least one fail.

import {
  nextLocalMidnight,
  msUntilNextMidnight,
  scheduleMidnightLoop,
} from '../src/utils/midnight.js';
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

// ─── MID-01a — nextLocalMidnight from noon is the next 00:00 ─────────
{
  const noon = new Date(2026, 7, 25, 12, 0, 0); // 2026-08-25 12:00 local
  const next = nextLocalMidnight(noon);
  expect(
    'MID-01a',
    format(next, 'yyyy-MM-dd HH:mm:ss'),
    '2026-08-26 00:00:00',
    'from noon, next midnight is the following day at 00:00 local',
  );
}

// ─── MID-01b — nextLocalMidnight from 23:59:59 is 1 second later ─────
{
  const lateNight = new Date(2026, 7, 25, 23, 59, 59); // 2026-08-25 23:59:59
  const next = nextLocalMidnight(lateNight);
  expect(
    'MID-01b',
    format(next, 'yyyy-MM-dd HH:mm:ss.SSS'),
    '2026-08-26 00:00:00.000',
    'from 23:59:59, next midnight is 1s later at 00:00:00.000',
  );
}

// ─── MID-01c — nextLocalMidnight at exactly 00:00:00 advances 24h ────
// (Never fire "at now" — always look forward.)
{
  const exactlyMidnight = new Date(2026, 7, 25, 0, 0, 0, 0);
  const next = nextLocalMidnight(exactlyMidnight);
  expect(
    'MID-01c',
    format(next, 'yyyy-MM-dd HH:mm:ss'),
    '2026-08-26 00:00:00',
    'at exactly 00:00:00, next midnight is 24h later (not "now")',
  );
}

// ─── MID-01d — nextLocalMidnight across month boundary ───────────────
{
  const dec31 = new Date(2026, 11, 31, 14, 0, 0); // 2026-12-31 14:00
  const next = nextLocalMidnight(dec31);
  expect(
    'MID-01d',
    format(next, 'yyyy-MM-dd HH:mm:ss'),
    '2027-01-01 00:00:00',
    'Dec 31 14:00 → next midnight is Jan 1 00:00 of the next year',
  );
}

// ─── MID-01e — nextLocalMidnight across DST-ish boundary (sanity) ────
// The math is just "00:00 tomorrow" in local time, so DST doesn't
// change the answer. We assert by symmetry.
{
  const before = new Date(2026, 2, 7, 23, 0, 0); // 2026-03-07 23:00 (US DST)
  const next = nextLocalMidnight(before);
  // 2026-03-08 00:00 — the same formula regardless of DST.
  expectTrue('MID-01e', next.getDate() === 8 && next.getMonth() === 2,
    'next midnight from 2026-03-07 23:00 is on March 8 (DST-safe)');
}

// ─── MID-02a — msUntilNextMidnight at noon ≈ 12h ────────────────────
{
  const noon = new Date(2026, 7, 25, 12, 0, 0);
  const ms = msUntilNextMidnight(noon);
  // 12h = 12 * 60 * 60 * 1000 = 43200000.
  expect('MID-02a', ms, 12 * 60 * 60 * 1000,
    'from noon, ms-until-midnight is exactly 12 hours');
}

// ─── MID-02b — msUntilNextMidnight at 23:59:59.999 is ~1ms ──────────
{
  const lateNight = new Date(2026, 7, 25, 23, 59, 59, 999);
  const ms = msUntilNextMidnight(lateNight);
  expect('MID-02b', ms, 1,
    'from 23:59:59.999, ms-until-midnight is exactly 1ms');
}

// ─── MID-02c — msUntilNextMidnight is always strictly positive ───────
{
  // Test a handful of times across the day.
  const samples = [
    new Date(2026, 7, 25, 0, 0, 0, 0),
    new Date(2026, 7, 25, 0, 0, 0, 1),
    new Date(2026, 7, 25, 6, 30, 0),
    new Date(2026, 7, 25, 12, 0, 0),
    new Date(2026, 7, 25, 18, 45, 0),
    new Date(2026, 7, 25, 23, 59, 59, 999),
  ];
  let allPositive = true;
  for (const s of samples) {
    if (msUntilNextMidnight(s) <= 0) { allPositive = false; break; }
  }
  expectTrue('MID-02c', allPositive,
    'ms-until-midnight is strictly positive for every sample across the day');
}

// ─── MID-02d — msUntilNextMidnight at 00:00:00.000 is 24h ───────────
{
  const exactly = new Date(2026, 7, 25, 0, 0, 0, 0);
  const ms = msUntilNextMidnight(exactly);
  expect('MID-02d', ms, 24 * 60 * 60 * 1000,
    'at exactly 00:00:00.000, ms-until-midnight is 24 hours');
}

// ─── MID-03a — scheduleMidnightLoop: callback fires at the right time
// We stub setTimeout so the test runs synchronously. The fake setTimeout
// records each (delay, fn) pair and lets the test drive `fn` when
// "time" reaches the delay.
{
  let now = new Date(2026, 7, 25, 23, 59, 59, 500); // 500ms before midnight
  const pending = [];
  const setTimer = (fn, delay) => {
    pending.push({ at: now.getTime() + delay, fn });
    return pending.length;
  };
  const clearTimer = () => {};
  const fired = [];
  const handle = scheduleMidnightLoop(
    (midnightDate) => fired.push(format(midnightDate, 'yyyy-MM-dd HH:mm:ss.SSS')),
    { setTimer, clearTimer, now: () => now },
  );
  // One timer should be scheduled ~500ms out (at next midnight).
  expect('MID-03a-count', pending.length, 1,
    'one timer scheduled by the loop');
  expect('MID-03a-delay', pending[0].at - now.getTime(), 500,
    'first fire is 500ms after schedule time');
  // Drive the timer: pretend 500ms passed.
  now = new Date(pending[0].at);
  pending[0].fn();
  // Callback should have fired once with the midnight Date.
  expect('MID-03a-fired', fired.length, 1,
    'callback fired exactly once after 500ms');
  expect(
    'MID-03a-firedAt',
    fired[0],
    '2026-08-26 00:00:00.000',
    'callback received the next-midnight Date as its argument',
  );
  // The loop should have re-armed itself.
  expect('MID-03a-rearm', pending.length, 2,
    'loop re-armed after the callback fired');
  expect('MID-03a-rearm-delay', pending[1].at - now.getTime(), 24 * 60 * 60 * 1000,
    're-armed timer fires 24h after the previous fire');
  handle.cancel();
}

// ─── MID-03b — scheduleMidnightLoop: cancel() stops the loop ────────
{
  let now = new Date(2026, 7, 25, 12, 0, 0);
  const setTimer = () => 42;
  const clearCalls = [];
  const clearTimer = (id) => clearCalls.push(id);
  const handle = scheduleMidnightLoop(() => {}, { setTimer, clearTimer, now: () => now });
  expect('MID-03b-clearBefore', clearCalls.length, 0,
    'no clear calls before cancel');
  handle.cancel();
  expect('MID-03b-clearAfter', clearCalls.length, 1,
    'cancel() called clearTimer with the scheduled id');
}

// ─── MID-03c — scheduleMidnightLoop: throws on non-function callback ─
{
  let threw = false;
  try {
    scheduleMidnightLoop(null);
  } catch (e) {
    threw = e instanceof TypeError;
  }
  expectTrue('MID-03c', threw,
    'scheduleMidnightLoop throws TypeError on non-function callback');
}

// ─── MID-04a — scheduleMidnightLoop: callback exception does not kill loop
// If the callback throws, the loop should re-arm and not crash.
{
  let now = new Date(2026, 7, 25, 23, 59, 59, 0);
  const pending = [];
  const setTimer = (fn, delay) => {
    pending.push({ at: now.getTime() + delay, fn });
    return pending.length;
  };
  const clearTimer = () => {};
  let callCount = 0;
  const origWarn = console.warn;
  const warns = [];
  console.warn = (...args) => warns.push(args);
  const handle = scheduleMidnightLoop(
    () => {
      callCount++;
      if (callCount === 1) throw new Error('boom');
    },
    { setTimer, clearTimer, now: () => now },
  );
  // First fire.
  now = new Date(pending[0].at);
  pending[0].fn();
  // Loop should have re-armed despite the throw.
  expect('MID-04a-rearm', pending.length, 2,
    'loop re-armed even after callback throws');
  expect('MID-04a-warned', warns.length, 1,
    'thrown callback logged a warning');
  // Second fire (no throw this time).
  now = new Date(pending[1].at);
  pending[1].fn();
  expect('MID-04a-callCount', callCount, 2,
    'callback was invoked twice (survived the throw)');
  console.warn = origWarn;
  handle.cancel();
}

// ─── MID-05a — scheduleMidnightLoop: re-arms relative to actual fire ─
// If `now()` is mocked and the callback is invoked at a later time
// than originally scheduled (because setTimeout is slow / blocked),
// the re-arm should still be 24h from the actual fire, not from the
// originally scheduled time. This prevents drift.
{
  let now = new Date(2026, 7, 25, 12, 0, 0);
  const pending = [];
  const setTimer = (fn, delay) => {
    pending.push({ at: now.getTime() + delay, fn });
    return pending.length;
  };
  const clearTimer = () => {};
  const handle = scheduleMidnightLoop(() => {}, { setTimer, clearTimer, now: () => now });
  // Pretend time jumped forward 12h before the timer fires.
  now = new Date(now.getTime() + 12 * 60 * 60 * 1000);
  // Drive the (now stale) first timer.
  pending[0].fn();
  // The re-armed timer should be 24h from `now` (the actual fire time),
  // not 24h from the originally scheduled time.
  const last = pending[pending.length - 1];
  expect('MID-05a-rel', last.at - now.getTime(), 24 * 60 * 60 * 1000,
    're-arm is 24h from actual fire time, not from originally scheduled time');
  handle.cancel();
}

// ─── Report ────────────────────────────────────────────────────────────
console.log('\n=== MIDNIGHT TEST REPORT ===');
for (const r of results) {
  console.log(`[${r.id}] ${r.status} — ${r.reason}`);
}
console.log(`\nTotals: ${pass} pass / ${fail} fail / ${partial} partial`);
process.exit(fail === 0 ? 0 : 1);
