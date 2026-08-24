// Pure helpers for the local-midnight rollover timer (Bug 4).
//
// When the user keeps the app open across midnight, day-bound
// recomputes (streak, hobby "today" reset, task auto-expire sweep)
// need to fire at 00:00:00 local — not on a 60-second polling tick
// and not just on AppState foreground. This module computes the
// next-midnight timestamp and schedules a self-rearming callback
// that fires once per local day at midnight.
//
// The module contains no React or native code. The scheduling helper
// uses `globalThis.setTimeout` / `globalThis.clearTimeout` so tests
// can stub them.

import { addDays } from 'date-fns';

// Returns a new Date set to the next local 00:00:00.000 strictly after
// `reference`. If `reference` is exactly at midnight, the result is
// 24 hours later (we never fire at "now" — we always look forward).
export function nextLocalMidnight(reference = new Date()) {
  const next = new Date(reference);
  next.setHours(0, 0, 0, 0);
  // If we're already at the local midnight boundary, advance by a
  // full day. The caller wants the NEXT midnight, not this one.
  if (next.getTime() <= reference.getTime()) {
    return addDays(next, 1);
  }
  return next;
}

// Milliseconds from `reference` to the next local midnight. Always
// strictly positive.
export function msUntilNextMidnight(reference = new Date()) {
  return nextLocalMidnight(reference).getTime() - reference.getTime();
}

// Schedule `callback` to fire at the next local midnight, then
// re-arm for the following midnight, then again, etc. Returns a
// handle `{ cancel }` the caller can use to stop the loop.
//
// `onTick` (optional) is called immediately before each scheduled
// fire, with the timestamp of the upcoming midnight as its argument.
// It runs synchronously from the same setTimeout tick as the
// callback, so it can be used to stamp a "today" value into the
// caller's state before the callback runs.
//
// The scheduling uses `globalThis.setTimeout` so tests can stub it.
// The re-arm pattern is `setTimeout` after the callback returns
// (rather than `setInterval`) so a slow callback can't accumulate
// drift — the next fire is always relative to the previous one
// actually running.
export function scheduleMidnightLoop(callback, { setTimer, clearTimer, now = () => new Date() } = {}) {
  if (typeof callback !== 'function') {
    throw new TypeError('scheduleMidnightLoop: callback must be a function');
  }
  const _set = setTimer || globalThis.setTimeout;
  const _clear = clearTimer || globalThis.clearTimeout;
  let cancelled = false;
  let timer = null;

  const arm = () => {
    if (cancelled) return;
    const next = nextLocalMidnight(now());
    const delay = next.getTime() - now().getTime();
    timer = _set(() => {
      if (cancelled) return;
      // Call after stamping the fire time so the callback can read it
      // (e.g. for logging or for stamping "today" into state).
      try {
        callback(next);
      } catch (e) {
        // Don't let a callback exception kill the loop — log via
        // console.warn (the live app's default handler) and re-arm.
        // Tests can stub console.warn to assert the exception.
        // eslint-disable-next-line no-console
        console.warn('midnight callback threw', e);
      }
      arm();
    }, delay);
  };

  arm();

  return {
    cancel() {
      cancelled = true;
      if (timer != null) {
        _clear(timer);
        timer = null;
      }
    },
  };
}
