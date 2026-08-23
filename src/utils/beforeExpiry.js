// Pure helpers for the "before expiry" reminder picker.
// Pulled out of AddTaskScreen so the chip-resolution logic is testable
// without React or the native layer.

// Preset offsets the user can pick. `null` minutes = "Custom…" pseudo-preset.
export const BEFORE_EXPIRY_PRESETS = [
  { label: '5 min',     minutes: 5 },
  { label: '15 min',    minutes: 15 },
  { label: '30 min',    minutes: 30 },
  { label: '1 hour',    minutes: 60 },
  { label: '2 hours',   minutes: 120 },
  { label: '1 day',     minutes: 1440 },
  { label: 'Custom…',   minutes: null },
];

// Return the label of the chip that should appear active given the current
// state. Once the user enters "Custom…" mode, the active chip stays
// "Custom…" even when the numeric value coincides with a preset — this is
// the fix for the bug where the picker auto-switched to "1 hour" at 60 min.
export function activeChipLabel({ minutes, customMode, presets = BEFORE_EXPIRY_PRESETS }) {
  if (customMode) {
    const customPreset = presets.find((p) => p.minutes === null);
    return customPreset ? customPreset.label : 'Custom…';
  }
  const match = presets.find((p) => p.minutes === minutes);
  return match ? match.label : 'Custom…';
}

// True iff the custom stepper (the +/- row) should be visible.
export function isCustomStepperVisible({ minutes, customMode, presets = BEFORE_EXPIRY_PRESETS }) {
  if (customMode) return true;
  return !presets.some((p) => p.minutes === minutes);
}

// ─── d/h/m unit picker (used by the Custom… stepper) ────────────────────
// The custom stepper lets the user pick a duration as days + hours +
// minutes and stores the total as a single number of minutes
// (`beforeExpiryMinutes`). These helpers split / recombine the two
// representations.

export const MAX_BEFORE_EXPIRY_MINUTES = 7 * 24 * 60; // 10080

export const UNITS = ['days', 'hours', 'minutes'];

// Inclusive [min, max] value range for each unit.
export const UNIT_RANGE = {
  days:    [0, 7],
  hours:   [0, 23],
  minutes: [0, 59],
};

// Convert a single unit+value to total minutes.
export function unitToMinutes(value, unit) {
  if (unit === 'days')    return value * 24 * 60;
  if (unit === 'hours')   return value * 60;
  return value; // minutes
}

// Split a total-minutes value into { days, hours, minutes }.
export function minutesToParts(totalMinutes) {
  const t = Math.max(0, Math.floor(totalMinutes));
  const days = Math.floor(t / (24 * 60));
  const hours = Math.floor((t % (24 * 60)) / 60);
  const minutes = t % 60;
  return { days, hours, minutes };
}

// Clamp a value for a given unit to its legal [min, max] range. Returns
// the clamped value, or `value` unchanged if the unit is unknown.
export function clampUnitValue(value, unit) {
  const range = UNIT_RANGE[unit];
  if (!range) return value;
  const [lo, hi] = range;
  return Math.max(lo, Math.min(hi, value));
}

// Total minutes from a { days, hours, minutes } object, clamped to the
// app's max (7 days).
export function partsToMinutes({ days = 0, hours = 0, minutes = 0 } = {}) {
  const total = days * 24 * 60 + hours * 60 + minutes;
  return Math.max(0, Math.min(MAX_BEFORE_EXPIRY_MINUTES, total));
}

// Default unit when entering Custom mode: the first unit (preference
// days > hours > minutes) whose value is non-zero, otherwise 'minutes'.
export function defaultUnitFor(parts) {
  if (parts.days > 0)    return 'days';
  if (parts.hours > 0)   return 'hours';
  return 'minutes';
}

// ─── Dynamic cap based on time-to-expiry ─────────────────────────────────
// When the user picks an expiry, the before-expiry reminder offset must
// be strictly less than the time between now and expiry. Otherwise the
// reminder would fire in the past or exactly at expiry (which is the
// wrong UX). These helpers compute that dynamic max and clamp d/h/m
// parts so the total never exceeds it.

// Max minutes the user can pick, given an expiry Date in the future.
// Returns null if `expiryDate` is missing or already in the past (in
// which case the before-expiry card is hidden, see AddTaskScreen).
export function maxBeforeExpiryMinutes(expiryDate, now = new Date()) {
  if (!(expiryDate instanceof Date)) return null;
  const diffMs = expiryDate.getTime() - now.getTime();
  if (diffMs <= 0) return null;
  // Floor the diff in minutes; require at least 1 so the "+/-" stepper
  // always has a valid target.
  return Math.max(1, Math.floor(diffMs / 60000));
}

// Returns the largest parts {days, hours, minutes} whose total is <=
// `max`. Greedy from days down.
export function partsWithinMax(max) {
  const m = Math.max(0, Math.floor(max));
  const days = Math.min(7, Math.floor(m / (24 * 60)));
  const hours = Math.min(23, Math.floor((m - days * 24 * 60) / 60));
  const minutes = Math.min(59, m - days * 24 * 60 - hours * 60);
  return { days, hours, minutes };
}

// Clamp a candidate {days, hours, minutes} so its total never exceeds
// `max`. If the candidate already fits, returns it unchanged.
export function clampPartsToMax(parts, max) {
  const total = (parts?.days || 0) * 1440 + (parts?.hours || 0) * 60 + (parts?.minutes || 0);
  if (total <= max) return { ...parts };
  return partsWithinMax(max);
}

// Max value allowed for a single unit, given the chosen parts and the
// overall dynamic cap. e.g. unit='days' → floor(max/1440) capped at 7.
// Used by the +/- stepper to know when to stop.
export function maxForUnit(unit, parts, maxMinutes) {
  if (unit === 'days') {
    return Math.min(7, Math.floor(maxMinutes / 1440));
  }
  if (unit === 'hours') {
    const used = (parts?.days || 0) * 1440;
    return Math.min(23, Math.floor((maxMinutes - used) / 60));
  }
  // minutes
  const used = (parts?.days || 0) * 1440 + (parts?.hours || 0) * 60;
  return Math.min(59, maxMinutes - used);
}
