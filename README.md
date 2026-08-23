# Productivity Tracker

> A focused, no-clutter React Native (Expo) app for tracking daily tasks, recurring hobbies, and the streaks that fall out of doing both — all stored locally, themed for day or night, with charts and notifications that actually work.

ProductivityTracker is a single-user, on-device productivity journal. It doesn't sync to a server, it doesn't ask for an account, and it doesn't try to be a project-management suite. It is the smallest app that still does every one of these things well:

- Manage a task list with categories, priorities, start/expiry dates, and two kinds of reminders.
- Track daily hobbies with streaks, longest streaks, and a full year history.
- Watch a streak number on the dashboard grow as you keep up with *either* tasks or hobbies.
- See your work as charts (per-category, per-priority, 7-day bars, monthly lines).
- Switch between a polished dark mode and a warm cream mode, with four (or five) accent colors to choose from.
- Get real notifications — sound and vibration — when a reminder fires.

---

## ✨ Features

### ✅ Task Tracker
- Create tasks with title, notes, category, and one of three priority levels.
- Optional start date and time, and an optional expiry date and time.
- Two independent reminders per task:
  - **Before expiry** — `5 / 15 / 30 min`, `1 / 2 hour`, `1 day`, or a custom value.
  - **Custom one-shot** — pick any future date and time.
- Auto-expire: any task whose expiry has passed flips to `expired` automatically.
- Filter by status (`pending / completed / expired`) and category, search by name.
- Every task tracks `createdAt`, `updatedAt`, and `completedAt` timestamps shown relative to "now".

### 🌿 Hobby Tracker
- Daily-checkable habits that persist forever.
- Each hobby has its own colour and Ionicons icon.
- A 7-day strip on every hobby card for at-a-glance consistency.
- A big "Mark today" action on the detail page.
- Stats: current streak, longest streak, total days completed.
- **All-time history grid** — a year of weeks, day-of-week gutter, month labels on top. Only the days up to today are drawn, never future days.
- A scrollable **monthly chart** that complements the year grid for the most recent month.
- Per-hobby reminder — pick time of day and which weekdays, stored as a `HH:mm` + a day-of-week array.

### 🔥 Streaks
- A single global **day streak** on the dashboard header that grows whenever the user earns *any* activity (task completion *or* a hobby check) on a consecutive day.
- A "longest streak" stat on the Insights screen and a per-hobby longest streak.
- Streak math is independent of task vs hobby — the day is the unit of credit.
- Resets correctly after a gap day; carries over correctly after a day with only a hobby.

### 📊 Insights & Charts
- An all-time completion ring with the current streak.
- Range filter: `All time` / `30 days` / `7 days` — every chart in the screen respects the range.
- Task completions and hobby consistency as separate 7-day bar charts.
- Per-category and per-priority breakdowns scoped to the selected range.
- A multi-category monthly line chart for spotting trends across categories.
- Animated counters that ease between values on the hero stat.

### 🏷️ Categories
- Create custom categories with name, Ionicons icon, and colour.
- Each category tracks its own completion % (done / total).
- A quick view on the dashboard with a mini progress bar for every category.
- Editing a category renames it everywhere it is used.

### 🎨 Themes
- Two full palettes: **dark** (deep slate) and **cream** (warm beige), each polished and consistent.
- Toggle from the dashboard header (sun/moon icon) — choice persists.
- Four accent colors for dark mode (purple, teal, rose, amber). Cream mode adds a fifth: **brown**.
- Per-theme accent memory: pick `teal` in dark and `brown` in cream, and both stick when you switch back.
- System status bar follows the theme.

### 🔔 Notifications
- Three local notification channels of behavior:
  - **Task reminders** (before expiry, custom one-shot, implicit 1 hr before expiry if the user hasn't picked one).
  - **Daily "today's plan"** reminder at a time you pick — body reflects pending tasks/hobbies for the day.
  - **Morning briefing** at a time you pick — gentle start-of-day summary.
  - **Streak-at-risk nudge** — fires the same day if you have a streak ≥ 1 and haven't done anything yet.
- Hobby daily reminders with selectable weekdays.
- On Android: a single high-importance channel is created at app start so sound + vibration actually fire.
- All notification content is decorated with the right channel id / sound for the platform.

### ✨ Polish
- Pull-to-refresh on every list (Dashboard, Tasks, Hobbies, Categories, Insights).
- Animated counters that ease between values on the Insights hero.
- Soft tap haptic + press-scale on primary buttons.
- Action feedback via a slide-in toast (success / info / danger variants).
- Auto-expire sweep for tasks in the background.
- Midnight-aware timers that update streaks, hobbies, and the auto-expire sweep the moment the day changes — no manual reload needed.

---

## 🚀 Setup

Requires Node.js 18+ and either:
- **Expo Go** on a real device (notifications only fire on real devices), or
- An Android emulator / iOS simulator (notifications do not fire in Expo Go on simulators).

```bash
cd ProductivityTracker
npm install
npx expo start
```

Then scan the QR code with the Expo Go app on your phone, or press `a` / `i` to launch on an emulator.

### Build for production

```bash
npx expo start --android     # or --ios
# or
eas build --platform android # / ios
```

`eas.json` is already configured.

---

## 🧪 Tests

Every commit is gated by `tests.md`. Before pushing, run through the full test plan and paste the `TESTS` block (in the format defined there) into the commit body. The plan covers:

- Streak math (5 cases + a full-week simulation)
- Task add/edit before-expiry custom-mode behavior (4 cases)
- Time picker scrollability and AM/PM (5 cases)
- Hobby history grid alignment and future-date cutoff (6 cases)
- Midnight rollover and auto-expire (5 cases)
- Notification channel + handler + manual device test (6 cases)
- Swipe-between-tabs behavior (6 cases)
- Sanity coverage for every other area (theming, persistence, navigation, categories, hobbies, insights)

A `FAIL` blocks the commit. A `PARTIAL` is allowed only with a written justification. See [`tests.md`](./tests.md) for the full plan and reporting format.

Open bugs are tracked in [`BUGS.md`](./BUGS.md). A test in `tests.md` is added for every bug; closing a bug requires that test to read `PASS`.

---

## 🧰 Tech Stack

- **React Native** `0.74.5` + **Expo** `~51.0.0`
- **React Navigation** (`bottom-tabs` + `native-stack`)
- **AsyncStorage** for local persistence
- **expo-notifications** for local reminders
- **react-native-svg** + **react-native-chart-kit** for charts
- **react-native-gesture-handler** for swipes and pulls
- **date-fns** for date math (streak, year grid, monthly chart)
- Zero remote services. Zero analytics. Zero ads.

---

## 📁 Project Structure

```
ProductivityTracker/
├── App.js                        # Root navigation (tabs + settings stack)
├── app.json                      # Expo config
├── eas.json                      # EAS Build profile
├── package.json
├── README.md
├── BUGS.md                       # Open bugs and their reproduction steps
├── tests.md                      # Pre-commit test plan + reporting format
└── src/
    ├── context/
    │   ├── AppContext.js         # Global state, streak math, notification scheduling
    │   └── ToastContext.js       # In-app toast notifications
    ├── screens/
    │   ├── DashboardScreen.js    # Streak, hobbies, upcoming tasks, categories
    │   ├── TasksScreen.js        # Searchable task list with filters
    │   ├── AddTaskScreen.js      # New / edit task with reminders
    │   ├── CategoriesScreen.js   # Category list + add modal
    │   ├── EditCategoryScreen.js # Edit a single category
    │   ├── HobbiesScreen.js      # Hobby list with 7-day strip + add modal
    │   ├── HobbyDetailScreen.js  # Year grid, monthly chart, streak stats
    │   ├── EditHobbyScreen.js    # Edit hobby + reminder
    │   ├── InsightsScreen.js     # Charts, range filter, breakdown
    │   └── SettingsScreen.js     # Theme toggle + accent picker
    ├── components/
    │   ├── LineChart.js              # Reusable SVG line chart primitive
    │   ├── MonthlyCategoryLineChart.js
    │   ├── HobbyMonthlyChart.js      # Per-hobby monthly view
    │   ├── InlineDatePicker.js       # In-app date stepper
    │   ├── InlineTimePicker.js       # Scrollable hour/minute wheel + AM/PM
    │   ├── ConfirmDialog.js          # Reusable themed confirm modal
    │   └── PrimaryButton.js          # Themed press-feedback button
    ├── hooks/
    │   ├── useCountUp.js             # Animated number tween
    │   └── usePullRefresh.js         # RefreshControl wrapper
    └── utils/
        ├── theme.js              # Palettes + ThemeProvider + accent presets
        ├── hobbyStats.js         # Streak math, day helpers
        └── relTime.js            # Relative-time formatter
```

---

## ⚙️ Settings

Open Settings from the gear icon in the dashboard header to:
- Switch between dark and cream themes.
- Pick an accent color (purple / teal / rose / amber, or `brown` in cream). The choice is remembered per theme.

---

## 💾 Data

- All app data is stored on-device under the AsyncStorage key `@pt_state`.
- Reinstalling over the existing app keeps your tasks, hobbies, categories, and streak intact.
- The accent choice is stored under `@pt_accent_per_theme` (with a one-time migration from the legacy `@pt_accent`).
- Hobby completion history is preserved indefinitely and powers the all-time stats and year grid.

---

## 🔐 Permissions

| Permission | Reason |
|---|---|
| **Notifications** | Task reminders (before expiry, custom one-shot, implicit 1 hr warning), hobby daily reminders, "today's plan" reminder, morning briefing, streak-at-risk nudge. |

---

## 📝 Notes

- Notifications only fire on real devices (Expo Go on a simulator will not vibrate or play sound).
- All data is stored locally via AsyncStorage — there is no server, no sync, and no telemetry.
- Old task data with `walkSessions` is loaded harmlessly and dropped on first save.
- The app respects the user's local day boundary — streak math, hobby "today" checks, and the auto-expire sweep all roll over at local midnight.
