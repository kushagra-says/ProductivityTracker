import { subDays, format } from 'date-fns';

// a function to compute current streak from a completion map
// `now` is injectable so callers (and tests) can pin the reference day.
export function currentStreak(completions, now = new Date()) {
  if (!completions) return 0;
  let streak = 0;
  let cursor = now;
  // Allow today not yet checked — count from yesterday.
  const todayKey = format(cursor, 'yyyy-MM-dd');
  if (!completions[todayKey]) {
    cursor = subDays(cursor, 1);
  }
  // Walk back day by day until we hit a gap.
  while (true) {
    const key = format(cursor, 'yyyy-MM-dd');
    if (completions[key]) {
      streak++;
      cursor = subDays(cursor, 1);
    } else {
      break;
    }
  }
  return streak;
}

export function longestStreak(completions) {
  if (!completions) return 0;
  const dates = Object.keys(completions)
    .filter((k) => completions[k])
    .sort();
  if (dates.length === 0) return 0;

  let longest = 1;
  let current = 1;
  const prev = new Date(dates[0]);
  for (let i = 1; i < dates.length; i++) {
    const d = new Date(dates[i]);
    const diff = Math.round((d - prev) / (1000 * 60 * 60 * 24));
    if (diff === 1) {
      current++;
      if (current > longest) longest = current;
    } else {
      current = 1;
    }
    prev.setTime(d.getTime());
  }
  return longest;
}

// Completion-day count for a single hobby (null-safe). Toggling a day
// off deletes the key, so the key count IS the day count.
export function hobbyTotalDays(hobby) {
  if (!hobby || !hobby.completions) return 0;
  return Object.keys(hobby.completions).length;
}

// Distinct days on which ANY hobby was completed — the union of all
// completion maps' keys. Four hobbies done the same day count once.
export function distinctCompletionDays(hobbies) {
  if (!Array.isArray(hobbies)) return 0;
  const days = new Set();
  for (const h of hobbies) {
    if (!h || !h.completions) continue;
    for (const k of Object.keys(h.completions)) days.add(k);
  }
  return days.size;
}

// Best streak ever reached across all hobbies.
export function maxLongestStreak(hobbies) {
  if (!Array.isArray(hobbies)) return 0;
  return hobbies.reduce(
    (acc, h) => Math.max(acc, longestStreak(h && h.completions)),
    0,
  );
}

// Best currently-running streak across all hobbies.
export function maxCurrentStreak(hobbies, now = new Date()) {
  if (!Array.isArray(hobbies)) return 0;
  return hobbies.reduce(
    (acc, h) => Math.max(acc, currentStreak(h && h.completions, now)),
    0,
  );
}

// The hobby with the fewest completion days; ties keep list order.
export function lowestHobby(hobbies) {
  if (!Array.isArray(hobbies)) return null;
  let lowest = null;
  for (const h of hobbies) {
    if (!h) continue;
    if (!lowest || hobbyTotalDays(h) < hobbyTotalDays(lowest)) lowest = h;
  }
  return lowest;
}

// Last 7 days — Mon..Sun, days[6] is today.
export function lastNDays(n = 7) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    out.push(subDays(new Date(), i));
  }
  return out;
}

export function dayKey(d) {
  return format(d, 'yyyy-MM-dd');
}

export function dayLabel(d) {
  return format(d, 'EEE');
}
