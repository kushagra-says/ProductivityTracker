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
- A "Today" hero card: completion rate with an "X of Y done today" breakdown and the current streak.
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
- **Swipe between pages** — a horizontal swipe on any of the five tabs moves to the adjacent page, with a cached static snapshot of the next page sliding in so the pages look physically adjacent. The gesture never fights vertical list scrolling, outer-edge swipes are impossible, and swiping is locked while a create/edit form is open.
- Smooth swipe completion — a passing swipe glides off-screen with an eased animation before the tab switches underneath.
- **Android back flow** — system back on a tab list returns to the Dashboard; a second back from the Dashboard asks before leaving the app.
- **Unsaved-changes guard** — leaving Add/Edit Task, Edit Hobby, or Edit Category with unsaved edits asks first; manually reverting every change does not.
- Card-as-button UX: date and reminder cards expand/toggle from a tap anywhere on the card, with a `×` that clears without bubbling.
- Inline month-grid calendar picker (past days disabled, custom reminders capped at expiry) and loop-scrolling wheel pickers with 1-minute granularity.
- Validation feedback via a slide-in toast (success / info / danger variants) instead of system alerts.
- Pull-to-refresh on every list (Dashboard, Tasks, Hobbies, Categories, Insights).
- Animated counters that ease between values on the Insights hero.
- Soft tap haptic + press-scale on primary buttons.
- Auto-expire sweep for tasks in the background.
- Midnight-aware timers that update streaks, hobbies, and the auto-expire sweep the moment the day changes — no manual reload needed.

---

## 🧠 How it works

Two pieces of logic do most of the app's "smart" work, and both live as **pure, React-free modules** so the Node test harness exercises the exact code path the app runs:

### Streak math — [`src/utils/streak.js`](./src/utils/streak.js)

The dashboard's day streak is a single global number credited by *any* activity — completing a task or checking a hobby earns the same unit: a day.

- `todayKey(date)` renders a local-time `YYYY-MM-DD` key; hobby completions are stored under that key (`hobby.completions[key] = true`), so all day-boundary math is string comparison — no timezone drift.
- `hasActivityToday(tasks, hobbies)` scans for a task `completedAt` inside today's local-day window, or any hobby checked for today's key.
- `computeNextStreak({ tasks, hobbies, anchorDate, currentStreak })` is the pure decision function: it returns `credit` (anchor moves to today — streak +1 if it was anchored yesterday, otherwise a fresh 1), `revert` (today's credit was undone — streak −1, anchor steps back, clamped at 0), or `noop`. The context merely dispatches what it decides. A gap day resets to 1; a day with only a hobby still credits; undoing today's only completion reverts instead of resetting.
- It is recomputed on every task/hobby change, every 60 s, on foreground, and within a second of local midnight ([`src/utils/midnight.js`](./src/utils/midnight.js) schedules the midnight tick and stamps `state.today` so all day-boundary UI flips live).

### Year-grid layout — [`src/utils/yearGrid.js`](./src/utils/yearGrid.js)

The hobby detail page renders a GitHub-style history grid, but split into **per-month blocks** — each month is its own self-contained group of week columns (with a visual gap between blocks) so month boundaries are always visible.

- `buildMonthWeeks(year, month)` builds one block: the first column starts on the Monday of the week containing the 1st, the last ends on the Sunday of the week containing the month's final day — fixed 7-row Mon–Sun columns, so nothing shifts mid-row.
- `buildMonthSections(today)` returns the year's sections, January through today's month, each carrying its own month label for the block header.
- Days strictly after today are never rendered — the current week's column fills up day by day, and a cell on today counts as not-future.
- The Mon–Sun gutter (`DOW_LABELS`) maps rows 1:1 with cell rows, so the alignment the tests assert is exactly what the screen draws.

The same pattern holds for the rest of the date logic: the inline calendar ([`src/utils/calendar.js`](./src/utils/calendar.js)), the before-expiry reminder presets/caps ([`src/utils/beforeExpiry.js`](./src/utils/beforeExpiry.js)), and hobby stats ([`src/utils/hobbyStats.js`](./src/utils/hobbyStats.js)) are all pure modules under `src/utils/` with dedicated Node test suites (see [Tests](#-tests)).

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

Every change is gated by [`tests.md`](./tests.md) — the pre-commit gate. A `FAIL` blocks the commit; a `PARTIAL` is allowed only with a written justification.

**Automated gate — 233 assertions.** The pure logic modules run in plain Node (no React, no native), so the same code the app executes is asserted directly:

```bash
node tests/run-streak-tests.mjs          # 18  — global day-streak decisions
node tests/run-before-expiry-tests.mjs   # 52  — before-expiry presets, caps, formatting
node tests/run-calendar-tests.mjs        # 35  — inline month-grid calendar layout
node tests/run-year-grid-tests.mjs       # 106 — hobby history grid coordinates
node tests/run-midnight-tests.mjs        # 22  — local-midnight rollover + auto-expire
```

All five must print `0 fail` before a commit. The expected total is exactly **233 PASS** — if you added cases, update the count in `tests.md` section Z.

**Manual checks** — everything that needs a screen or a device (notification sound/vibration, swipe feel, dialogs, theming) is marked `[MANUAL]` in `tests.md` and is checked off by hand before commit. The commit body carries a verbatim `TESTS` block in the reporting format defined at the top of `tests.md`.

Open bugs are tracked in [`BUGS.md`](./BUGS.md). Every bug gets a test in `tests.md`; closing a bug requires that test to read `PASS`.

---

## 🧰 Tech Stack

- **React Native** `0.74.5` + **Expo** `~51.0.0`
- **React Navigation** (`bottom-tabs` + `stack`)
- **AsyncStorage** for local persistence
- **expo-notifications** for local reminders
- **react-native-svg** + **react-native-chart-kit** for charts
- **react-native-gesture-handler** for swipes and pulls
- **react-native-view-shot** for cached swipe-preview snapshots
- **date-fns** for date math (streak, year grid, monthly chart)
- Zero remote services. Zero analytics. Zero ads.

---

## 📁 Project Structure

```
ProductivityTracker/
├── App.js                        # Root navigation (tabs + settings stack), system-back flow
├── app.json                      # Expo config
├── eas.json                      # EAS Build profile
├── package.json
├── README.md
├── BUGS.md                       # Bug reports, resolutions, reproduction steps
├── tests.md                      # Pre-commit test plan + reporting format
├── tests/                        # Pure-logic Node suites (233 assertions, run pre-commit)
│   ├── run-streak-tests.mjs
│   ├── run-before-expiry-tests.mjs
│   ├── run-calendar-tests.mjs
│   ├── run-year-grid-tests.mjs
│   └── run-midnight-tests.mjs
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
    │   ├── TabSwipe.js           # Swipe-between-tabs HOC + snapshot preview cache
    │   ├── LineChart.js          # Reusable SVG line chart primitive
    │   ├── MonthlyCategoryLineChart.js
    │   ├── HobbyMonthlyChart.js  # Per-hobby monthly view
    │   ├── MonthGridCalendar.js  # Inline month-grid date picker
    │   ├── WheelPicker.js        # Loop-scrolling wheel (time + durations)
    │   ├── InlineTimePicker.js   # Scrollable hour/minute wheel + AM/PM
    │   ├── ConfirmDialog.js      # Reusable themed confirm modal
    │   └── PrimaryButton.js      # Themed press-feedback button
    ├── hooks/
    │   ├── useCountUp.js         # Animated number tween
    │   ├── usePullRefresh.js     # RefreshControl wrapper
    │   └── useUnsavedGuard.js    # Snapshot-based unsaved-changes guard
    └── utils/
        ├── theme.js              # Palettes + ThemeProvider + accent presets
        ├── streak.js             # Pure day-streak math (credited by task OR hobby)
        ├── midnight.js           # Local-midnight loop + today-key stamping
        ├── calendar.js           # Month-grid calendar helpers
        ├── yearGrid.js           # Hobby year-grid week/month coordinates
        ├── beforeExpiry.js       # Before-expiry presets, caps, formatting
        ├── hobbyStats.js         # Per-hobby streaks, day helpers
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
- **Backup / restore** — Settings → Data: export everything (tasks, hobbies, categories, streak, settings, accent choices) as a versioned JSON file to your device's Downloads folder, and import a backup later to restore it. Import validates the file, asks before replacing, and re-arms all reminders from the restored data.
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
