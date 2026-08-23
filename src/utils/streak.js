// Pure functions for the global day-streak. No React, no native imports —
// pulled out of AppContext so the same code path is exercised by the test
// harness (tests/run-streak-tests.js) and by the live app.

// YYYY-MM-DD in local time. Used for hobby completions + streak comparisons.
export const todayKey = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// True iff the user has any "earning" activity today — a task completed
// within today's local-day window, OR at least one hobby marked done
// for today's YYYY-MM-DD. Hobby completion is the same unit of credit
// as a task completion: a day with only a hobby check still increments
// the dashboard streak, and a day with neither resets the streak.
export function hasActivityToday(tasks, hobbies, ref = new Date()) {
  const start = new Date(ref);
  start.setHours(0, 0, 0, 0);
  const end = new Date(ref);
  end.setHours(23, 59, 59, 999);
  const taskDone = tasks.some(
    (t) =>
      t.status === 'completed' &&
      t.completedAt &&
      new Date(t.completedAt) >= start &&
      new Date(t.completedAt) <= end,
  );
  if (taskDone) return true;
  const k = todayKey(ref);
  return hobbies.some((h) => h.completions && h.completions[k]);
}

// Pure version of the streak-recompute decision. Returns the new value
// to assign to `streak`, or `null` when no change should be applied.
//
// `anchorDate` is the day on which the *current* streak value was first
// reached. It is what `lastActiveDate` used to be before we split the
// two concepts: a credit sets `anchorDate = today`, a revert decrements
// the streak and rolls the anchor back to yesterday. Keeping the anchor
// separate is what allows the next day's activity to either continue
// (+1) or reset (→ 1) the streak correctly — and what prevents the
// inconsistent state "streak=0, lastActiveDate=today" that the old
// reducer could leave behind.
//
// Returns one of:
//   - { kind: 'noop' }                                    → no change
//   - { kind: 'credit', streak, anchorDate }              → +1 or reset to 1
//   - { kind: 'revert', streak, anchorDate }              → -1, anchor→yesterday (or null)
export function computeNextStreak({ tasks, hobbies, anchorDate, currentStreak, ref = new Date() }) {
  const today = todayKey(ref);
  const yesterday = todayKey(new Date(ref.getTime() - 86400000));
  const active = hasActivityToday(tasks, hobbies, ref);

  if (anchorDate === today) {
    if (active) return { kind: 'noop' };
    // Activity that earned today's credit has been removed → revert.
    // The new streak is the previous value minus 1, anchored on yesterday
    // (or null if the new value is 0). Clamped at 0.
    const newStreak = Math.max(0, currentStreak - 1);
    return { kind: 'revert', streak: newStreak, anchorDate: newStreak === 0 ? null : yesterday };
  }

  if (!active) return { kind: 'noop' };
  const newStreak = anchorDate === yesterday ? currentStreak + 1 : 1;
  return { kind: 'credit', streak: newStreak, anchorDate: today };
}
