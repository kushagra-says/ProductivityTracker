# Productivity Tracker

A focused, no-clutter React Native (Expo) app for tracking tasks, daily hobbies, and your all-time progress. Dark and cream themes, all data stored locally.

---

## Features

### Tasks
- Add tasks with title, notes, category, priority, and optional start/expiry dates.
- Custom reminders with preset offsets (5 / 15 / 30 min, 1 / 2 hr, 1 day) and free-form labels.
- Auto-expire when deadline passes.
- Filter by status and category, search by name.
- Each task surfaces `createdAt` and `completedAt` timestamps.

### Hobbies
- Daily-checkable habits that persist across days.
- 7-day consistency strip on each card.
- Big "Mark today" action on the detail page.
- Stats: current streak, longest streak, total days completed.
- All-time history rendered as a year-grid calendar.
- Hobby completion feeds into the Insights weekly chart.

### Categories
- Create custom categories with name, Ionicons icon, and color.
- Each category tracks its own completion %.
- Quick view on the dashboard with mini progress bars.

### Insights
- All-time completion rate ring with current streak.
- Range filter: `All time` / `30 days` / `7 days`.
- Task completions and hobby consistency as separate 7-day bar charts.
- Per-category and per-priority breakdowns, scoped to the selected range.
- Monthly history line chart, multi-category.

### Theming
- Dark and cream palettes, both polished and consistent.
- Toggle from the dashboard header (sun/moon icon).
- Toast-free, system-status-bar-aware.
- Four accent color choices (purple, teal, rose, amber) — pick from Settings. Choice persists.

### Polish
- Pull-to-refresh on every list.
- Animated counters that ease between values on the Insights hero.
- Soft tap haptic + press-scale on primary buttons.
- Action feedback via a slide-in toast (success / info / danger variants).
- Per-hobby monthly history chart (alongside the 7-day strip and year grid).

---

## Settings

Open Settings from the gear icon in the dashboard header to:
- Switch between dark and cream themes.
- Pick an accent color (purple/teal/rose/amber). Saved under `@pt_accent`.

---

## Data

- All app data is stored on-device under the AsyncStorage key `@pt_state`.
- Reinstalling over the existing app keeps your tasks, hobbies, and categories intact.
- The accent choice is stored under `@pt_accent` independently.

## Setup

```bash
cd ProductivityTracker
npm install
npx expo start
```

Scan the QR code with the Expo Go app on your phone.

---

## Project Structure

```
ProductivityTracker/
├── App.js                        # Root navigation
├── app.json                      # Expo config
├── package.json
└── src/
    ├── context/
    │   ├── AppContext.js         # Global state + actions
    │   └── ToastContext.js       # In-app toast notifications
    ├── screens/
    │   ├── DashboardScreen.js
    │   ├── TasksScreen.js
    │   ├── AddTaskScreen.js
    │   ├── CategoriesScreen.js
    │   ├── EditCategoryScreen.js
    │   ├── HobbiesScreen.js
    │   ├── HobbyDetailScreen.js
    │   ├── InsightsScreen.js
    │   └── SettingsScreen.js
    ├── components/
    │   ├── LineChart.js          # Reusable SVG line chart primitive
    │   ├── MonthlyCategoryLineChart.js
    │   ├── HobbyMonthlyChart.js  # Per-hobby monthly view
    │   └── PrimaryButton.js      # Themed press-feedback button
    ├── hooks/
    │   ├── useCountUp.js         # Animated number tween
    │   └── usePullRefresh.js     # RefreshControl wrapper
    └── utils/
        ├── theme.js              # Palettes + ThemeProvider + accent presets
        ├── hobbyStats.js         # Streak math, day helpers
        └── relTime.js            # Relative-time formatter
```

---

## Permissions

| Permission | Reason |
|---|---|
| **Notifications** | Task reminders (start / expiry / custom) |

---

## Notes

- Notifications only fire on real devices (not Expo Go simulator).
- All data is stored locally via AsyncStorage.
- Hobby completion history is preserved indefinitely and powers the all-time stats.
- Old task data with `walkSessions` is loaded harmlessly and dropped on first save.
