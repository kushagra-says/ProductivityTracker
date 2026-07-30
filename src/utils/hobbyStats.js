import { subDays, format } from 'date-fns';

// a function to compute current streak from a completion map
export function currentStreak(completions) {
  if (!completions) return 0;
  let streak = 0;
  let cursor = new Date();
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
