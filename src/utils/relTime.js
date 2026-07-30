import { formatDistanceToNow, format } from 'date-fns';

// "2 hours ago", "just now", "in 3 days" — relative, then absolute on second line.
export function relTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return formatDistanceToNow(d, { addSuffix: true });
}

export function shortDate(iso) {
  if (!iso) return '';
  return format(new Date(iso), 'MMM d, h:mm a');
}
