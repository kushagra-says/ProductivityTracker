// Pre-commit test for the multiple custom reminders feature (v1.4.6).
// Plain-Node ESM — no Jest, no extra deps. Exercises the pure helpers
// in src/utils/taskReminders.js (migration, due-sweep, validation,
// ordering) without React or the native notification layer.
//
// Usage: node tests/run-reminder-tests.mjs
// Exit code: 0 = all pass, 1 = at least one fail.

import {
  markDueReminderList,
  migrateTaskReminders,
  markDueReminders,
  validateReminderDraft,
  sortReminders,
} from '../src/utils/taskReminders.js';

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

// Fixed reference clock so every case is deterministic.
const NOW = new Date('2026-09-17T12:00:00');
const FUTURE = new Date(NOW.getTime() + 3600000).toISOString();
// Derived from NOW (not a hardcoded Z-string) so the fixtures stay
// correct in any local timezone — NOW parses as local time.
const PAST = new Date(NOW.getTime() - 3600000).toISOString();

// ─── REM-01 — Task without reminders/customReminderTime backfills to [] ──
{
  const task = { id: 'task_1', title: 'Read chapter', status: 'pending' };
  const out = migrateTaskReminders(task);
  expect('REM-01', out.reminders, [],
    'missing reminders field backfills to an empty array');
  expect('REM-01b', out.customReminderTime, null,
    'missing customReminderTime normalizes to null');
  expect('REM-01c', out.title, 'Read chapter',
    'migration preserves the rest of the task');
}

// ─── REM-02 — Legacy customReminderTime converts into one reminder ───────
{
  const legacy = {
    id: 'task_2',
    title: 'Take meds',
    customReminderTime: '2026-09-20T14:30:00.000Z',
  };
  const out = migrateTaskReminders(legacy);
  expect('REM-02', out.customReminderTime, null,
    'legacy field cleared after conversion');
  expect('REM-02b', out.reminders, [{
    id: 'rem_legacy_' + Date.parse('2026-09-20T14:30:00.000Z'),
    title: 'Reminder',
    description: '',
    at: '2026-09-20T14:30:00.000Z',
    triggeredAt: null,
  }],
    'legacy one-shot becomes a single Reminder entry at the same moment');
}

// ─── REM-03 — Migration is idempotent ────────────────────────────────────
{
  const legacy = {
    id: 'task_3',
    title: 'Call back',
    customReminderTime: '2026-09-21T08:00:00.000Z',
  };
  const once = migrateTaskReminders(legacy);
  const twice = migrateTaskReminders(once);
  expect('REM-03', twice, once,
    'migrating an already-migrated task changes nothing');
}

// ─── REM-04 — markDueReminders stamps the reminder's own `at` ────────────
// The stamp is the scheduled moment (which the UI displays), NOT the
// sweep moment — a reminder that came due while the app was closed
// still shows the time it was set for.
{
  const at = PAST;
  const task = { id: 'task_4', reminders: [
    { id: 'rem_a', title: 'Take meds', description: '', at, triggeredAt: null },
  ] };
  const { tasks, updates } = markDueReminders([task], NOW);
  expect('REM-04', updates, [{ taskId: 'task_4', reminderId: 'rem_a', triggeredAt: at }],
    'due reminder reported in updates with its own `at` as triggeredAt');
  expect('REM-04b', tasks[0].reminders[0].triggeredAt, at,
    'returned tasks carry the stamped triggeredAt');
}

// ─── REM-04c — Mixed due/undue across tasks: only due entries stamped ────
{
  const past = new Date(NOW.getTime() - 60000).toISOString();
  const future = new Date(NOW.getTime() + 60000).toISOString();
  const t1 = { id: 't1', reminders: [
    { id: 'r1', title: 'A', description: '', at: past, triggeredAt: null },
    { id: 'r2', title: 'B', description: '', at: future, triggeredAt: null },
  ] };
  const t2 = { id: 't2', reminders: [
    { id: 'r3', title: 'C', description: '', at: NOW.toISOString(), triggeredAt: null },
  ] };
  const { tasks, updates } = markDueReminders([t1, t2], NOW);
  expect('REM-04c', updates, [
    { taskId: 't1', reminderId: 'r1', triggeredAt: past },
    { taskId: 't2', reminderId: 'r3', triggeredAt: NOW.toISOString() },
  ],
    'boundary `at === now` counts as due; future does not');
  expect('REM-04d', tasks[0].reminders[1].triggeredAt, null,
    'undue reminder left untouched');
}

// ─── REM-05 — No double-stamp on a second sweep ──────────────────────────
{
  const at = new Date(NOW.getTime() - 3600000).toISOString();
  const task = { id: 'task_5', reminders: [
    { id: 'rem_b', title: 'Take meds', description: '', at, triggeredAt: at },
  ] };
  const { tasks, updates } = markDueReminders([task], NOW);
  expect('REM-05', updates, [],
    'already-triggered reminder produces no update');
  expect('REM-05b', tasks, [task],
    'no-change sweep returns the same tasks array/reference');
}

// ─── REM-06 — Identity-preserving no-op when nothing is due ──────────────
{
  const future = new Date(NOW.getTime() + 3600000).toISOString();
  const tasks = [
    { id: 't6', reminders: [
      { id: 'r6', title: 'Later', description: '', at: future, triggeredAt: null },
    ] },
    { id: 't7', title: 'No reminders at all' },
  ];
  const out = markDueReminders(tasks, NOW);
  expect('REM-06', out.updates, [],
    'nothing due → empty updates');
  expect('REM-06b', out.tasks, tasks,
    'nothing due → the SAME tasks reference comes back (caller skips dispatch)');
}

// ─── REM-07 — validateReminderDraft: missing title rejected ──────────────
{
  expect('REM-07', validateReminderDraft({ title: '   ', at: FUTURE }, NOW) !== null, true,
    'blank title → error');
  expect('REM-07b', validateReminderDraft({ title: '', at: FUTURE }, NOW) !== null, true,
    'empty title → error');
  expect('REM-07c', validateReminderDraft({ at: FUTURE }, NOW) !== null, true,
    'missing title → error');
}

// ─── REM-08 — validateReminderDraft: past date rejected ──────────────────
{
  const past = new Date(NOW.getTime() - 60000);
  expect('REM-08a', validateReminderDraft({ title: 'X', at: past }, NOW), 'Reminder must be in the future.',
    'at <= now → error');
  expect('REM-08b', validateReminderDraft({ title: 'X', at: NOW }, NOW) !== null, true,
    'at exactly now → not strictly future → error');
}

// ─── REM-09 — validateReminderDraft: past-expiry rejected, valid passes ──
// Preserves the old rule that a custom reminder cannot land after the
// task's expiry.
{
  const expiry = new Date(NOW.getTime() + 3600000); // NOW + 1h
  const afterExpiry = new Date(NOW.getTime() + 7200000); // NOW + 2h
  expect('REM-09', validateReminderDraft({ title: 'X', at: afterExpiry, expiryDate: expiry }, NOW),
    'Reminder cannot be after the expiry date.',
    'at > expiryDate → error');

  // Boundary: at === expiryDate is allowed ("at <= expiryDate").
  expect('REM-09b', validateReminderDraft({ title: 'X', at: expiry, expiryDate: expiry }, NOW), null,
    'at === expiryDate is allowed');

  expect('REM-09c', validateReminderDraft({ title: 'X', at: FUTURE }, NOW), null,
    'valid future draft with no expiry → null');
  expect('REM-09d', validateReminderDraft({ title: 'X', at: FUTURE, expiryDate: expiry }, NOW), null,
    'valid future draft before expiry → null');
}

// ─── REM-10 — sortReminders orders ascending and never mutates ───────────
{
  const late = { id: 'a', title: 'Late', description: '', at: '2026-09-20T10:00:00.000Z', triggeredAt: null };
  const early = { id: 'b', title: 'Early', description: '', at: '2026-09-18T08:00:00.000Z', triggeredAt: null };
  const mid = { id: 'c', title: 'Mid', description: '', at: '2026-09-19T18:00:00.000Z', triggeredAt: null };
  const input = [late, early, mid];
  const sorted = sortReminders(input);
  expect('REM-10', sorted.map((r) => r.id), ['b', 'c', 'a'],
    'sorted ascending by `at`');
  expect('REM-10b', input.map((r) => r.id), ['a', 'b', 'c'],
    'input array NOT mutated');
  expect('REM-10c', sortReminders(null), [],
    'null/missing list sorts to an empty array');
}

// ─── REM-11 — markDueReminderList: standalone-list sweep for AddTaskScreen ─
// Same stamp semantics as markDueReminders, but for a single task's list —
// used by the open editor so a triggered row flips to read-only without
// waiting for the context sweep.
{
  const past = PAST;
  const future = FUTURE;
  const list = [
    { id: 'r1', title: 'A', description: '', at: past, triggeredAt: null },
    { id: 'r2', title: 'B', description: '', at: future, triggeredAt: null },
    { id: 'r3', title: 'C', description: '', at: past, triggeredAt: past },
  ];
  const out = markDueReminderList(list, NOW);
  expect('REM-11', out.map((r) => r.triggeredAt), [past, null, past],
    'due untriggered entries stamped with their own `at`; future and already-triggered untouched');
  expect('REM-11b', out === list, false,
    'a changed list returns a NEW array (React state must re-render)');

  // No-op is identity-preserving so the 30s tick cannot cause re-renders.
  const quiet = [{ id: 'r4', title: 'D', description: '', at: future, triggeredAt: null }];
  expect('REM-11c', markDueReminderList(quiet, NOW) === quiet, true,
    'nothing due → the SAME list reference comes back');
  expect('REM-11d', markDueReminderList(null, NOW), [],
    'null/missing list → empty array');
}

// ─── Report ──────────────────────────────────────────────────────────────
console.log('=== REMINDER TEST REPORT ===');
for (const r of results) {
  console.log(`[${r.id}] ${r.status} — ${r.reason}`);
}
console.log(`\nTotals: ${pass} pass / ${fail} fail / ${partial} partial`);
process.exit(fail === 0 ? 0 : 1);