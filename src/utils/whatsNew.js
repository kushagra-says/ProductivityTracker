// Per-release What's-New copy, shown in Settings → WHAT'S NEW.
//
// Release ritual — the only steps needed when new code is pushed:
//   1. Bump APP_VERSION in src/utils/appVersion.js
//   2. Replace the list below with this release's changes
//
// Everything else is automatic: the dashboard reminder card reappears
// (it shows whenever the stored seen-version differs from APP_VERSION)
// and its copy is GENERIC — it never mentions the changes themselves, so
// it needs no editing. "See now" deep-links into Settings, which
// auto-scrolls to this list.
export const WHATS_NEW = [
  'Better swipe animations with no lag',
  'Task cards now show the set priority right in the list, next to the category',
  'More accent colors to choose from — ten accents in both themes',
  'Morning briefing now lists the day’s top 5 oldest pending tasks, high to low priority',
  'Hobbies that are already completed for the day no longer send a reminder',
];