# Bug List

This document lists every known issue filed against the ProductivityTracker app. Each entry follows the same shape so the corresponding test in `tests.md` is unambiguous about what to verify.

| # | Area | Severity | Status |
|---|---|---|---|
| 1 | Streak logic | High | ✅ Completed |
| 2 | Add/Edit Task — reminders | High | ✅ Completed |
| 3 | Hobby detail — year history grid | High | ✅ Completed |
| 4 | Midnight rollover | High | Open |
| 5 | Notifications (sound + vibration) | High | Open |
| 6 | Reminder time input | Medium | Open |
| 7 | Bottom-tab navigation | Medium | Open |
| 8 | README / docs | Low | Open |
| 9 | Add/Edit Task — card interactions | Medium | Open |

---

## Bug 1 — Day streak not updated by hobby completion

**File:** `src/context/AppContext.js` (`recomputeStreak`, `hasCompletionToday`)

**Status:** ✅ Completed

**Reported behaviour**

- A user who only completes hobbies and does no tasks on a given day still gets their global "day streak" reset to `0` on the dashboard header.
- Hobby streak (per hobby, in the hobby detail) keeps growing as expected.
- Conversely, if a task is completed in the past without a hobby, the streak increments — which is the intended behaviour and should be preserved.

**Expected behaviour**

- The dashboard streak badge must be incremented if *either* a task is completed today *or* at least one hobby has `completions[todayKey] === true`.
- The streak must still reset to 0 on a day where the user does nothing (i.e. neither completed a task nor marked a hobby).
- The increment should respect continuity: today follows yesterday's increment, otherwise reset to 1.

**Reproduction**

1. Fresh install. Add 1 hobby. Mark it complete for two consecutive days.
2. Open the app on the third day; the hobby streak shows `2` but the dashboard streak badge shows `0`.

**Resolution**

`recomputeStreak` now consults both `task.completedAt` and `hobby.completions[todayKey]`. The streak increments if *either* signal is set, and `lastActiveDate` is recomputed atomically with the increment so reverting a hobby / task on the same day does not leave the streak stuck.

**Covered by:** `tests/run-streak-tests.mjs` (18 PASS — `STREAK-01..05` + edge cases). `tests.md` Section A.

---

## Bug 2 — Custom "before expiry" reminder auto-switches to "1 hour" at 60 min

**File:** `src/screens/AddTaskScreen.js` (`BEFORE_EXPIRY_PRESETS`, `active` resolver, custom stepper)

**Status:** ✅ Completed

**Reported behaviour**

- In the "Before expiry" section of *New task* / *Edit task*, when the user picks "Custom…" and increments the stepper until it reaches 60, the chip that stays highlighted is `1 hour`, not `Custom…`.
- Trying to tap `Custom…` again to "go back to custom" then has no effect, because the value (60) is still in the preset list and the custom stepper collapses.

**Expected behaviour**

- Once the user enters "Custom…" mode, the active chip should be `Custom…` for any value, including values that numerically equal a preset (60, 120, 1440).
- A separate latched `beforeExpiryCustomMode` flag should keep the user in Custom mode after the stepper changes the value, and only an explicit tap on a preset chip should switch them out of Custom.
- Saving the task should still persist the exact chosen number of minutes.

**Reproduction**

1. New task → Before-expiry toggle on.
2. Tap "Custom…", tap `+` until value reads `60`. Observe that "1 hour" is the highlighted chip and the custom stepper is gone.

**Resolution**

`activeChipLabel({ minutes, customMode })` now consults `customMode` first — once the user enters Custom, the chip label stays `Custom…` for any value. The custom stepper was also extended to a d/h/m unit picker (days 0–7, hours 0–23, minutes 0–59) so the user can express offsets like "2 days 3 hours" instead of being rounded into 60-minute buckets. The dynamic cap from `maxBeforeExpiryMinutes(expiryDate)` clamps the d/h/m parts so the reminder always fires strictly before the expiry.

**Covered by:** `tests/run-before-expiry-tests.mjs` (42 PASS — `TASK-01..07` for the chip semantics, `TASK-08..15d` for the d/h/m helpers). `tests.md` Section B.

---

## Bug 3 — Hobby history grid: month/day alignment and future-date rendering

**File:** `src/screens/HobbyDetailScreen.js` (`YearGrid`)

**Reported behaviour**

- The all-time history grid renders square blocks for every day in the current year, including days that are still in the future relative to today. Those future cells should not be drawn.
- The month-name labels (e.g. `Jan`, `Feb`, …) currently do not always sit directly above the first week column that contains the 1st of that month, because the label is placed wherever the *first 7 days* of a month start — which can land on a column a week before the actual 1st.
- The day-of-week labels (`Mon`, `Wed`, `Fri`) on the left gutter do not always line up with the correct row because the row index is computed against a generic 0..6 array, but a `Mon`-anchored grid expects indices 0 = Mon, 6 = Sun. The current constant has 7 entries but uses `''` for some, which is visually correct but disconnected from the data row index.

**Expected behaviour**

- Only days up to and including `today` are rendered. Cells for any day strictly after today are *not* drawn at all (no ghost, no border).
- Month labels are anchored to the *column whose Monday falls in the same month as the 1st* — i.e. the column where the new month actually starts.
- Day-of-week gutter is `Mon Tue Wed Thu Fri Sat Sun`, drawn left of the row whose `rowIdx` matches the day of week.
- The grid is a single, static layout (no trailing "ghost" week). It ends on the rightmost column containing today.

**Reproduction**

1. Open any hobby that has completions in the current year.
2. Note the empty cell blocks appearing for future dates and the month label appearing one week before the actual 1st of a month.

**Status:** ✅ Completed

**Resolution**

The grid was extracted into a pure helper module `src/utils/yearGrid.js` exposing `buildYearWeeks`, `buildMonthLabels`, `januaryAnchor`, `isFutureCell`, `columnCount`, plus the `DOW_LABELS` constant. The `YearGrid` component in `src/screens/HobbyDetailScreen.js` was rewritten to:

- Skip rendering any cell whose date is strictly after today (`isFutureCell` returns null — no ghost, no border).
- Anchor month labels to the column that actually contains the 1st of the month (`buildMonthLabels` scans each week for a day whose `getDate() === 1`).
- Tie the day-of-week gutter to `DOW_LABELS` so rowIdx 0..6 maps cleanly to Mon..Sun.
- End on the rightmost column that contains today, with no trailing "ghost" week.

**Follow-up (inter-month spacing + fixed DOW gutter)**

Per user feedback, the grid was further restructured to render each month as a self-contained block of week columns, separated by a visual `SECTION_GAP` (12px). Inside a block, cells from other months (e.g. Jun 29-30 in the July block, Aug 1-2 in the July block) are skipped at render time using `isCellInMonth`, so the rest of the week becomes empty space. The DOW gutter was moved OUTSIDE the horizontal `ScrollView` so it stays fixed on the left edge while the user scrolls through months, and now uses first-letter labels (`DOW_SHORT`: M, T, W, T, F, S, S).

**Covered by:** `tests/run-year-grid-tests.mjs` (106 PASS — `DOW-01..03b`, `ANCHOR-01..02`, `WEEKS-01..06`, `GRID-01a..04`, `FUTURE-01..04`, `MONTH-EDGE-01..03`, `SECTION-01..22`). `tests.md` Section D.

---

## Bug 4 — App does not refresh immediately at midnight

**File:** `src/context/AppContext.js` (interval for `recomputeStreak`)

**Reported behaviour**

- When the user keeps the app open across midnight, the day-streak recompute, the hobby "today" reset, and the auto-expire sweep do not happen until the next time the interval fires (up to 60 s later) or until the user backgrounds and re-foregrounds the app.
- A task or hobby that the user toggles in the first few minutes of a new day may be saved against the *previous* day's `lastActiveDate`, causing the streak to attribute today's activity to yesterday.

**Expected behaviour**

- A timer scheduled to fire at the next local midnight (and every subsequent 24 h) calls `recomputeStreak`, the auto-expire sweep, and any other day-bound recompute.
- The render path consumes a `today` value that updates on the same tick, so the dashboard's "Today's hobbies" and the tasks list flip over to the new day without a manual reload.
- An `AppState` `change → active` listener still runs the same recompute for the foreground-resume case.

**Reproduction**

1. Keep the app open and watch the system clock cross 00:00 local.
2. Note that the "Today" sections and the streak do not update for up to a minute.

---

## Bug 5 — Notifications received silently (no sound, no vibration)

**File:** `src/context/AppContext.js` (notification channel + handler)

**Reported behaviour**

- Notifications reach the system tray, but the device does not ring, vibrate, or play any sound for them.
- Other apps' notifications work normally on the same device. App-internal settings claim notifications are not muted.

**Expected behaviour**

- On Android, the app's notification channel is created at startup with `importance: MAX`, `enableVibrate: true`, an explicit `vibrationPattern`, and `sound: 'default'`.
- The handler returns `shouldPlaySound: true`, `shouldSetBadge: true`, `shouldShowBanner: true`, `shouldShowList: true`.
- On iOS, the scheduled notification's `content.sound` is set to `'default'`.
- Every `scheduleNotificationAsync` call passes the decorated content, including the channel id on Android.

**Reproduction**

1. Schedule a reminder for 1 minute in the future.
2. Wait for it to fire. Observe: notification appears, but no sound, no vibration, on the same device that rings for other apps.

---

## Bug 6 — Custom reminder input restricted to 5-minute steps

**File:** `src/components/InlineTimePicker.js` (minute wheel), `src/screens/AddTaskScreen.js` (custom stepper)

**Reported behaviour**

- The "Before expiry" custom stepper on tasks only lets the user pick values in multiples of 5 (5, 10, 15, …). Setting e.g. 7 minutes is impossible.
- The time picker in hobby / task reminders only changes minutes in steps of 5.

**Expected behaviour**

- The time picker is a scrollable wheel that lets the user scroll from `1..12` for the hour and `0..59` for the minute. AM/PM toggle remains a separate button and behaves the same as before.
- The "Before expiry" custom stepper is removed; instead, the user is given a scrollable hours/minutes wheel for any value up to 7 days.

**Reproduction**

1. New task → Before-expiry → Custom. Try to pick `7` minutes. The picker only offers multiples of 5.

---

## Bug 7 — Pages can only be switched via the bottom tab bar, not by swiping

**File:** `App.js`, `src/context/AppContext.js` (no swipe handler)

**Reported behaviour**

- The five main pages (Dashboard, Tasks, Categories, Hobbies, Insights) are tabs and can only be switched by tapping the bottom tab bar.
- On a phone, the natural gesture is to swipe left/right to move between pages.

**Expected behaviour**

- A hard horizontal swipe (e.g. > 25% of the screen width, with limited vertical delta) on any of the five tab screens switches to the adjacent tab.
- Vertical scroll on lists/ScrollViews must still work — a small horizontal jitter while the user is scrolling vertically must not switch tabs.
- The animation uses the same navigator transition as a tab tap.
- Swipe is disabled inside any screen that is *not* one of the five main tabs (e.g. AddTask, HobbyDetail, EditCategory, etc.) so that the gesture does not interfere with in-stack navigation.

**Reproduction**

1. Open the app on the Dashboard tab. Swipe left across most of the screen. The Tasks tab does not open.

---

## Bug 8 — README is sparse and undersells the app

**File:** `README.md`

**Reported behaviour**

- The README is short, repeats the obvious, and does not enumerate the feature set (hobby tracker, task tracker, streaks, charts, themes, accent picker, notifications, custom reminders) or show how to run/test the app.

**Expected behaviour**

- The README includes a high-level description, a feature checklist grouped by area (Tasks, Hobbies, Categories, Insights, Theming, Notifications, Polish), a "How it works" section that links the streak math + the year-grid layout, a Setup section, a Tech Stack section, and the Project Structure tree.
- A short "Tests" section points at `tests.md` and explains the gate before each commit.

---

## Bug 9 — Reminders and date cards use controls instead of card-as-button

**File:** `src/screens/AddTaskScreen.js` (Start date card, Expiry date card, Custom reminder card, Before expiry card)

**Reported behaviour**

- Each date card has a dashed "Set &lt;label&gt;" button at the bottom that the user must tap to open the inline date picker. Tapping the card body itself does nothing.
- The two reminder cards (Custom reminder, Before expiry) each show a right-side slider `Switch` that the user must drag to enable the reminder. Tapping anywhere on the card body does nothing.

**Expected behaviour**

- Start date, Expiry date, Custom reminder, and Before expiry cards are tap-anywhere interactive.
  - For an unset date card, tapping anywhere on the card seeds a sensible default (`now + 1h`, rounded to the next 5 minutes) and reveals the inline picker + time field. The dashed "Set …" button is removed.
  - For a set date card, tapping the card body is a no-op visually (the picker is already open inline); the existing `×` clear button inside the card header still works and its tap does *not* trigger the card's tap handler.
  - For a reminder card, tapping anywhere toggles the reminder on/off. The right-side slider `Switch` is removed. A `×` inside the card header still turns the reminder off without bubbling.
- The four cards still expand inline content (date picker, time field, days stepper, d/h/m picker, etc.) when active. The collapse/expand mechanic is unchanged.

**Reproduction**

1. New task → Start date. Tap the card body. Nothing happens. Have to find and tap the dashed "Set start date & time" button.
2. New task → Custom reminder. Drag the slider switch to enable it. There is no way to enable the reminder by tapping the card body.
