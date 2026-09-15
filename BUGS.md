# Bug List

This document lists every known issue filed against the ProductivityTracker app. Each entry follows the same shape so the corresponding test in `tests.md` is unambiguous about what to verify.

| # | Area | Severity | Status |
|---|---|---|---|
| 1 | Streak logic | High | ✅ Completed |
| 2 | Add/Edit Task — reminders | High | ✅ Completed |
| 3 | Hobby detail — year history grid | High | ✅ Completed |
| 4 | Midnight rollover | High | ✅ Completed |
| 5 | Notifications (sound + vibration) | High | ✅ Completed |
| 6 | Reminder time input | Medium | ✅ Completed |
| 7 | Bottom-tab navigation | Medium | ✅ Completed |
| 8 | README / docs | Low | Open |
| 9 | Add/Edit Task — card interactions | Medium | ✅ Completed |
| 10 | Insights Today card | Low | ✅ Completed |
| 11 | Notifications invisible / late | High | ✅ Completed |
| 12 | Task list — priority display | Medium | ✅ Completed |
| 13 | Theming — accent options | Low | ✅ Completed |
| 14 | Morning briefing — top priorities | Medium | ✅ Completed |
| 15 | Hobby reminder on completed days | High | ✅ Completed |
| 16 | Startup crash — notifications (SDK 57) | High | ✅ Completed |
| 17 | Task card height from priority pill | Low | ✅ Completed |
| 18 | Previous-page flash after swipe | Low | ✅ Completed |
| 19 | Stale swipe preview (scroll/filters lost) | Medium | ✅ Completed |
| 20 | Incomplete swipe stuck at offset | Medium | ✅ Completed |
| 21 | Swipe preview snapshot size mismatch | Medium | ✅ Completed |
| 22 | Left-page flash during a left swipe | Low | ✅ Completed |
| 23 | White flash on every screen navigation | High | ✅ Completed |
| 24 | The entire application became laggy | High | ✅ Completed |
| 25 | Page content visible during left swipe; failed-swipe animation missing | Medium | ✅ Completed |

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

**Status:** ✅ Completed

**Resolution**

A new pure helper module `src/utils/midnight.js` exposes `nextLocalMidnight`, `msUntilNextMidnight`, and `scheduleMidnightLoop` — a self-rearming timer that fires at every local 00:00:00. `AppContext` now:

- Schedules the midnight loop on mount. On every fire it dispatches `TICK_MIDNIGHT` (which bumps `state.today`, sweeps expired tasks) and then calls `recomputeStreak`.
- Bumps `state.today` so consumers (Dashboard's "Today's hobbies" stats, sorted hobby list, and HobbyRow) re-render against the new day without a manual reload.
- Stamps a fresh `today` on hydration (a previously persisted `today` from a stale AsyncStorage state would otherwise persist across an app relaunch that happens after midnight).
- Keeps the AppState `change → active` listener and the 60-second safety-net interval for the foreground-resume case.

The dashboard now reads `state.today` instead of calling `todayKey()` directly, so its day-bound UI flips on the midnight tick.

**Covered by:** `tests/run-midnight-tests.mjs` (22 PASS — `MID-01a..05a`). `tests.md` Section E.

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

**Status:** ✅ Completed

**Resolution**

`src/context/AppContext.js` now:

- Creates the Android notification channel (`default`) at module load with `importance: MAX`, `sound: 'default'`, `enableVibrate: true`, and an explicit `vibrationPattern: [0, 250, 250, 250]`.
- The global handler returns `shouldPlaySound: true`, `shouldSetBadge: true`, `shouldShowBanner: true`, `shouldShowList: true`.
- A `decorate()` helper stamps every scheduled notification's content with `sound: 'default'` plus the Android `channelId`, and is used by every `scheduleNotificationAsync` call site (task reminders, hobby reminders, tasks-reminder, morning briefing, streak nudge).

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

**Status:** ✅ Completed

**Resolution**

- New reusable wheel module `src/components/WheelPicker.js` exposing `WheelColumn` (a vertical snap-scrolling plain `ScrollView` where the item that settles in the middle IS the selection; a `FlatList` here would nest a VirtualizedList inside the screens' ScrollViews), `DurationWheelPicker` (three columns: days 0–7, hours 0–23, minutes 0–59), and `DurationWheelLabels`.
- `src/components/InlineTimePicker.js` was rewritten to render the hour as a scrollable 1–12 wheel and the minute as a scrollable 0–59 wheel in 1-minute steps. The ± buttons are gone; AM/PM stays as separate buttons. All four call sites (AddTaskScreen, EditHobbyScreen, HobbiesScreen, SettingsScreen) pick this up unchanged via the same props.
- In `src/screens/AddTaskScreen.js` the "Before expiry" custom d/h/m stepper (unit chips + ± row, minute step 5) was removed and replaced with `DurationWheelPicker`, so any value from 0 min up to 7 days is reachable with 1-minute granularity (e.g. 7 minutes). Preset chips, the latched "Custom…" mode, and the dynamic expiry cap clamp (`maxBeforeExpiryMinutes` → `partsWithinMax`) behave as before.

**Follow-up — completed tasks keep ringing**

Tapping complete on a task left its future custom/before-expiry notifications scheduled, so they still fired afterwards. `completeTask` in `AppContext` now cancels every scheduled `task-reminder` for that task id (custom one-shot, before-expiry, and the implicit 1-hour warning alike) at the moment of completion.

**Follow-up — max cap shown as d/h/m**

The before-expiry card used to read e.g. `Notify 30 min (30 min) before expiry — max 180 min`, showing raw minute totals. The breakdown and the dynamic cap now use a `formatDuration()` helper (`beforeExpiry.js`), so the card reads `Notify 30 min before expiry — max 3 hours` — d/h/m units only, no raw minute total.

**Follow-up — looping wheels + numbers-only duration columns**

- All wheel columns loop infinitely like a rotary dial: the item list is rendered several times and the offset is re-anchored into the middle copy after every settle, so scrolling past the last item wraps to the first (and vice versa) instead of hitting a hard stop. A plain `ScrollView` is used (not a `FlatList`) to keep the VirtualizedList-nesting warning away; a `momentum`-vs-`drag` fallback (`onScrollEndDrag` + 120 ms timer) settles Android drags released without velocity.
- The before-expiry d/h/m columns show bare numbers only (`12`, `05`) — the unit labels (`DAYS` / `HRS` / `MIN`) live in the header row below the wheels.

**Follow-up — unsaved-changes guard**

Tapping back from Add/Edit Task, Edit Hobby, or Edit Category silently threw away any edits. A shared `src/hooks/useUnsavedGuard.js` hook now backs every mutating screen: the screen passes a snapshot of all its editable values (`draft`) on every render, the hook compares against the first render's values, and a `beforeRemove` listener intercepts back navigation (header back, hardware back) with a themed `ConfirmDialog` — "Discard changes?" with *Keep editing* (stays on the screen) and *Discard* (leaves). Because dirty is a *comparison* against the initial values (not a change counter), editing a field and then manually reverting every change does NOT pop the dialog. Save handlers call `clearDirty()` before `goBack()` so saving never pops the dialog.

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

**Status:** ✅ Completed

**Resolution**

New `src/components/TabSwipe.js` exposes `withTabSwipe(Screen, tabName)` — an HOC wrapping a screen in a `react-native-gesture-handler` `Pan` gesture + `GestureDetector`:

- The gesture only claims the touch after 24 px of horizontal travel; 14 px of vertical travel hands it back (`activeOffsetX` / `failOffsetY`). Vertical list scrolling therefore always wins — a small horizontal jitter while scrolling vertically never claims the gesture, let alone switches the tab.
- A swipe past 35% of the screen width at finger-release navigates one tab left/right in `TAB_ORDER` (`Dashboard → Tasks → Categories → Hobbies → Insights`); anything shorter is ignored. Swipes past the ends do nothing.
- `navigation.navigate` bubbles up from the nested stacks to the tab navigator, so the switch uses the exact same animation as a bottom-bar tap.
- Only the five list screens are wrapped (module-level HOCs in `App.js`); stack screens (AddTask, HobbyDetail, EditCategory, Settings) keep their in-stack gestures untouched. `App` is now wrapped in `GestureHandlerRootView`, which the gesture API requires.

**Follow-up — follow-drag preview + stack guard**

- The current page now follows the finger while a **static snapshot** of the adjacent tab slides in over it from the swipe edge, so the pages look physically adjacent. Mounting the adjacent tab's real screen live in the sliding panel lagged badly (a full screen mount at gesture start + per-frame JS re-renders), so the preview is instead a cached screenshot: shortly after a tab gains focus, every tab that is not yet cached is mounted for ~400 ms in a hidden rig behind the current page (`collapsable={false}` so Android can't optimize the view away), screenshotted to a temp file via `react-native-view-shot`, and cached. The capture pipeline is a single **global** pump — one host (the focused tab), one mutex, at most one hidden screen mounted at any moment, debounced and deferred behind ongoing user interactions (`InteractionManager`) so background captures never compete with quick taps/toggles for the JS thread (an earlier per-wrapper pump re-captured every tab once per mounted wrapper on each data change, which lagged quick successive actions). A failed capture is skipped until the next data change instead of retry-looping. The registered preview component is the **plain** screen (no swipe wrapper, no nested navigator), so the rig never fires navigation focus events that would re-trigger captures. The cache is **shared app-wide and persists across tab switches** — after the first seconds the whole set is warm, so every swipe shows its page instantly with no label fallback appearing mid-gesture (the earlier per-focus invalidation meant revisits always started cold and the label was visible until the capture landed mid-swipe). The cache is dropped only when the underlying data or theme actually changes (reducer state / theme mode are compared by reference), then re-captured in the background. A swipe now only animates two values and reveals a cached `Image` — zero per-frame JS work. Until a snapshot is ready (the first seconds after launch) the panel falls back to a plain label. The preview is read-only by nature (`pointerEvents="none"`). On a passing release the gesture **finishes visually before switching**: the page glides fully off-screen with an eased animation while the snapshot panel expands to cover the viewport, and only then does the (instant) navigator swap happen underneath the covering panel — so the transition reads as one continuous motion instead of a hard cut. The completion duration scales with the remaining distance so a barely-passing drag and a full fling finish at a similar pace; gesture input is ignored while either the completion or the spring-back animation is settling. If the swipe falls short, the page springs back to place.
- At the outer edges (Dashboard swiping left, Insights swiping right) the swipe is simply not possible — the page does not move at all, and the swipe host is painted with the theme background so no white void can appear behind a moving page.
- A `stackGuard` option on the wrapper makes swipe switching unavailable whenever the tab's own stack holds a pushed screen — e.g. while creating/editing a task (Tasks tab) or a category (rubber-band only). Tab-swiping is therefore never available inside create/edit flows.

**Follow-up — Android system back**

The device's edge-swipe (system back) gesture on a tab list first returns to the Dashboard; a second back gesture from the Dashboard pops a themed "Leave the app?" confirm dialog — *Exit* calls `BackHandler.exitApp()`, cancel stays. If Android later restores the retained activity from the app selector, an `AppState` listener dismisses the dialog so the app always foregrounds clean. Deeper screens (Settings, AddTask, EditHobby, EditCategory, HobbyDetail) keep the default pop behaviour, so the unsaved-changes guard still governs them.

---

## Bug 8 — README is sparse and undersells the app

**File:** `README.md`

**Reported behaviour**

- The README is short, repeats the obvious, and does not enumerate the feature set (hobby tracker, task tracker, streaks, charts, themes, accent picker, notifications, custom reminders) or show how to run/test the app.

**Expected behaviour**

- The README includes a high-level description, a feature checklist grouped by area (Tasks, Hobbies, Categories, Insights, Theming, Notifications, Polish), a "How it works" section that links the streak math + the year-grid layout, a Setup section, a Tech Stack section, and the Project Structure tree.
- A short "Tests" section points at `tests.md` and explains the gate before each commit.

**Status:** ✅ Completed

**Resolution**

- A **How it works** section now explains the two core logic pieces and links their modules: the global day-streak math (`src/utils/streak.js` — `todayKey` / `hasActivityToday` / `computeNextStreak`, credit/revert/noop semantics, midnight recomputation via `src/utils/midnight.js`) and the hobby year-grid layout (`src/utils/yearGrid.js` — per-month blocks of Mon-anchored week columns, no future cells). It also points at the other pure date modules (`calendar.js`, `beforeExpiry.js`, `hobbyStats.js`).
- The **Tests** section was rewritten around the actual gate: the five Node suites (`run-streak/before-expiry/calendar/year-grid/midnight`) totalling 233 assertions, the `[MANUAL]` checks, the `TESTS` commit-body format, and the FAIL/PARTIAL blocking rule.
- The **Project Structure** tree was refreshed to match reality (adds `tests/`, `TabSwipe.js`, `MonthGridCalendar.js`, `WheelPicker.js`, `useUnsavedGuard.js`, and the `streak/midnight/calendar/yearGrid/beforeExpiry` utils; drops the non-existent `InlineDatePicker.js`).
- The feature list was brought up to date: swipe-between-tabs with cached page previews + smooth completion, Android back-to-exit flow, unsaved-changes guard, card-as-button UX, wheel pickers, toast validation. The stale "all-time completion ring" Insights claim was corrected to describe the actual Today hero card.
- Tech Stack updated (`react-native-view-shot`, `stack` not `native-stack`).

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

**Status:** ✅ Completed

**Resolution**

Fixed across two commits:

- `4d545c1` — *Expiry and Reminder Fix*: removed the `Switch` sliders from the reminder cards. Add/Edit Task (Custom reminder, Before expiry) and Edit Hobby (Daily reminder) now use the card-as-button pattern: tapping the header toggles the reminder on/off, a `×` inside the header clears it without bubbling, and the body expands inline (calendar / pickers) when on. The date cards seed a sensible default on header tap (now + 1 h, rounded) and render the inline picker directly — the dashed "Set …" buttons are gone.
- `df79c16` — *Notifications / reminder card UX / validation toasts*: applied the same card-as-button pattern to the add-hobby modal's Daily reminder card (it still had a slider), and replaced the `Alert.alert()` validation popups with themed toasts across 6 screens for a consistent card UX.

**Covered by:** tests.md Section I (`CARD-01..09`, manual smoke) — the card body is a plain `View` with a tappable header, and the `×` uses `stopPropagation` so it never triggers the card's own handler.

---

## Bug 10 — Insights "Today" card shows the completion rate twice

**File:** `src/screens/InsightsScreen.js` (Today hero card)

**Reported behaviour**

- The completion-rate card at the top of the Insights page shows the percentage as large text on the left AND again inside a bordered circle on the right. The same number is rendered twice in two different visual treatments.

**Expected behaviour**

- Only the normal rate text is displayed — no duplicate ring/circle with the same percentage.

**Reproduction**

1. Open the Insights tab. The "Today" card shows `N%` as large text and the identical `N%` inside an 80 px bordered circle to its right.

**Status:** ✅ Completed

**Resolution**

Removed the circle (`styles.rateCircle` / `rateCircleInner` / `rateCirclePercent`) and its JSX from the Today hero card. The card now shows only the existing large rate value with its "X of Y done today" subtext and the streak line.

**Covered by:** tests.md INSIGHTS manual check — Today card shows a single percentage.

## Bug 11 — Notifications ring but are not visible, and fire 30–40 s late

**Files:** `src/context/AppContext.js` (notification handler), `app.json` (Android permissions)

**Reported behaviour**

- A reminder fires with its sound, but no notification appears anywhere — not as a heads-up banner while the app is open and not in the system notification list afterwards.
- The ring arrives 30–40 seconds after the scheduled minute, instead of when the clock ticks over to the preferred time.

**Root causes**

1. *Invisible:* `expo-notifications@0.28` (SDK 51) reads only `shouldShowAlert` from the `setNotificationHandler` response and **defaults it to `false`** (`NotificationsHandler.kt:19`). The handler returned the newer `shouldShowBanner` / `shouldShowList` keys, which this version ignores — so while the app was in the foreground the sound played (`shouldPlaySound` is read) but the notification was never displayed.
2. *Delayed:* `ExpoSchedulingDelegate.kt:101` uses `setExactAndAllowWhileIdle` only when `AlarmManager.canScheduleExactAlarms()` is true; otherwise it falls back to inexact `setAndAllowWhileIdle`, which the OS batches (tens of seconds typical). `SCHEDULE_EXACT_ALARM` was not declared, so the app never qualified for exact alarms.

**Expected behaviour**

- A notification that fires while the app is open shows as a heads-up banner and lands in the notification list.
- Reminders ring at the scheduled minute, not tens of seconds after.

**Status:** ✅ Completed

**Resolution**

- Added `shouldShowAlert: true` to the notification handler (the newer banner/list keys kept for forward-compatibility).
- Added `SCHEDULE_EXACT_ALARM` to `app.json` → `android.permissions`, so standalone builds use exact alarms (auto-granted on Android ≤ 13; on Android 14+ the user grants it once via the system toggle).

**Expo Go caveat:** app.json permissions are not applied inside Expo Go — its own manifest governs. On Android 14+ the "Alarms & reminders" special access must be granted to Expo Go once (Settings → Apps → Expo Go → Alarms & reminders) for exact timing there.

**Covered by:** tests.md NOTIF-04 (visible while app open), NOTIF-05 (fires at the scheduled minute).

**Follow-up — Expo SDK 57 migration (expo-notifications 2.x)**

The upgrade to SDK 57 changed both halves of this fix:

- `shouldShowAlert` is deprecated upstream; the handler now returns `shouldShowBanner: true` + `shouldShowList: true` (the pair this version actually reads). Same visible behaviour, native keys.
- Every scheduled trigger now requires an explicit `type` discriminator: one-shots (task reminders, streak nudge, rolling hobby reminders) use `SchedulableTriggerInputTypes.DATE`; the repeating count-based reminders ("today's plan", morning briefing) use `SchedulableTriggerInputTypes.DAILY` in place of the legacy `{ hour, minute, repeats: true }` shape.

---

## Bug 12 — Task priority is not visible in the task list

**File:** `src/screens/TasksScreen.js` (`renderTask`)

**Reported behaviour**

- A task's priority is set on Add/Edit Task, but the task-list card never shows it — only the status pill (Pending / Done / Expired), the category chip, and the due date are visible. The user must open the task to see what priority it has.

**Expected behaviour**

- On every task card, right below the status pill, a second pill shows the set priority (`High` / `Medium` / `Low`) in the same colours the Add/Edit screen uses for its priority chips (High = danger, Medium = warning, Low = success). Tasks saved before priorities existed fall back to `Medium`.

**Status:** ✅ Completed

**Resolution**

`renderTask` now renders a `statusCol` — the status pill with the priority pill stacked directly beneath it — so both read as one column at the card's top right. Priority colours mirror `PRIORITY_LEVELS` in `AddTaskScreen.js`.

**Covered by:** tests.md Section P (`PRIO-01..03`, manual).

---

## Bug 13 — Only the original four accent colors are offered

**Files:** `src/utils/theme.js` (`ACCENTS`, `ACCENTS_CREAM`), `src/screens/SettingsScreen.js`

**Reported behaviour**

- The accent picker offers only four choices in dark mode (purple, teal, rose, amber) and five in cream (those four plus brown).

**Expected behaviour**

- More accents are available in both themes without changing the default for existing users.

**Status:** ✅ Completed

**Resolution**

Four new accent presets — `blue`, `coral`, `lime`, `fuchsia` — were added to both `ACCENTS` (dark) and `ACCENTS_CREAM` (tuned darker/muted so they hold their hue on the warm beige ground, like the existing cream presets). `visibleAccentKeys` derives from the key sets, so the Settings picker, per-theme accent memory, backup export/import, and `applyAccentMap` validation all pick the new keys up automatically. Purple remains the default for both themes.

**Covered by:** tests.md Section Q (`ACC-01..03`, manual).

---

## Bug 14 — Morning briefing does not say what the pending work is

**File:** `src/context/AppContext.js` (`rescheduleMorningBriefing`)

**Reported behaviour**

- The morning briefing notification only contains counts ("You have 3 pending tasks and 2 hobbies to do today.") — it never names the tasks.

**Expected behaviour**

- The briefing also lists the day's top 5 pending tasks, ordered **High → Low** priority, and **oldest first within each priority** (so if five High-priority tasks exist, all five listed are High, with the oldest at the top).

**Status:** ✅ Completed

**Resolution**

A `topPendingTasks(tasks, ref, limit)` helper filters pending tasks with the same "still relevant today" rule as `pendingTaskCount` (an expiry that passed before today's start excludes the task), sorts by priority rank (High=0, Medium=1, Low=2; unknown/missing priorities rank with Medium) then by `createdAt` ascending, and caps at 5. The briefing body appends them after the counts:

```
Good morning! You have 3 pending tasks and 2 hobbies to do today.

Top priorities:
• Pay electricity bill (High)
• Buy groceries (High)
• Read chapter 4 (Medium)
```

The briefing is re-scheduled on every task/hobby/settings change (existing behaviour), so the list stays current with the last state at scheduling time.

**Covered by:** tests.md Section R (`BRIEF-01..03`, manual).

---

## Bug 15 — Hobby reminder still fires after the hobby is completed for the day

**File:** `src/context/AppContext.js` (`scheduleHobbyReminder`, hobby reminder re-arm points)

**Reported behaviour**

- Hobby reminders were scheduled as `repeats: true` daily triggers. A repeating trigger fires with fixed content and cannot be conditioned on data, so a hobby the user had already checked off for the day still rang at its reminder time.

**Expected behaviour**

- A hobby that is completed for a given day must not notify at its reminder time that day. Un-checking the hobby before the reminder time restores the reminder.

**Status:** ✅ Completed

**Resolution**

Hobby reminders are now **rolling one-shots** instead of repeating dailies:

- `scheduleHobbyReminder` cancels everything scheduled for the hobby, then books a one-shot at `hobby.reminderTime` for each of the next 7 days (`HOBBY_ROLLING_DAYS`) that is in the picked weekday set **and not already completed** (`completions[dayKey]` checked per day). Past times — including "reminder time already passed today" — are skipped by `scheduleAt`.
- The window re-rolls whenever the hobby list changes (completion toggles included, so checking a hobby off cancels today's remaining one-shot and un-checking re-books it), on app foreground, and at local midnight, so reminders keep coming as long as the app is opened at least once per window. The first load also migrates any legacy repeating-daily schedules over to the new mechanism.
- Each one-shot carries `data: { kind, hobbyId, date }` so future logic can address a single day's notification.
- Android's scheduled-notification cap (64) is respected: 7 days × hobbies, refreshed in place rather than accumulating.

## Bug 16 — App crashes at startup after the Expo SDK 57 migration ("error with the notifications")

**Files:** `src/context/AppContext.js`, `src/utils/notificationsClient.js` (new)

**Reported behaviour**

- After the SDK 51 → 57 upgrade, the app crashed immediately on launch with an error pointing at notifications.

**Root causes (two, both fixed)**

1. **Native-module binding at import time.** expo-notifications 2.x binds its full native-module set (`ExpoNotificationsEmitter`, `ExpoNotificationsHandlerModule`, `ExpoPushTokenManager`, …) the moment the library is imported. On Android this throws in **Expo Go for every SDK ≥ 53 runtime**: Expo Go's binary removed push support and binds `ExpoPushTokenManager` to a stub that throws the push-removal error ("Android Push notifications … was removed from Expo Go with the release of SDK 53") as soon as the package index touches it — so `import 'expo-notifications'` kills the app before any React code runs, even though local notifications are still supported in Expo Go. (The same throw also occurs on any dev client whose native module set predates the SDK.)
2. **Bare `Date` triggers rejected (real incompatibility in our code).** SDK 57's `hasValidTriggerObject` requires every trigger input to carry a `type` (or `channelId`) discriminator. `rescheduleTaskNotifications`'s `scheduleOne` passed a bare `Date`, so every per-task reminder — before-expiry and custom one-shot alike — threw and was silently swallowed by its catch, meaning task reminders never scheduled at all under the new SDK.

**Expected behaviour**

- The app boots on any runtime, never dying on the notifications import.
- In Expo Go, **local notifications keep working** (handler, scheduler, channels, permissions) — only push is unavailable there.
- Per-task reminders schedule correctly with SDK 57's typed trigger inputs.

**Status:** ✅ Completed

**Resolution**

- New `src/utils/notificationsClient.js` with a two-tier loader:
  - Tier 1 — `require('expo-notifications')` inside try/catch; on a dev build with the full native module set the package index is used whole.
  - Tier 2 — if the index throws (Expo Go SDK ≥ 53 on Android, or an older native module set), the **local-notification submodules are imported directly** (`build/NotificationsHandler`, `build/scheduleNotificationAsync`, `build/getAllScheduledNotificationsAsync`, `build/cancelScheduledNotificationAsync`, `build/setNotificationChannelAsync`, `build/NotificationPermissions`, plus the trigger-type/importance constants). None of their dependency graphs touches `TokenEmitter`/`PushTokenManager`/`topicSubscription`, so they bind cleanly where the index cannot — local reminders work again in Expo Go. Each require is isolated, and whatever still fails is filled by no-op fallbacks so every call-site stays promise-shaped.
  - `AppContext.js` imports from the client module rather than `expo-notifications` directly.
- `scheduleOne` now passes `{ type: SchedulableTriggerInputTypes.DATE, date: when }` — the same typed discriminator the daily triggers already use.

**Follow-up — channel management is stubbed in Expo Go too**

Running in Expo Go surfaced a second stub: `ExpoNotificationChannelManager.setNotificationChannelAsync` rejects with a NullPointerException from the missing `NotificationsChannelsProvider`. `notificationsClient` now owns channel creation (`ensureDefaultChannelAsync`): it attempts the channel exactly once, remembers the outcome, and logs an info line instead of a raw warning in runtimes without channel support. `AppContext`'s `decorate()` attaches a `channelId` **only when the channel provably exists** (`getDefaultChannelId()`), because Android silently drops notifications posted to a channel id that was never created — in Expo Go, reminders fire through the OS default channel instead (the custom vibration pattern is a dev-build-only nicety).

**Coverage:** [MANUAL] `MIG-01`–`MIG-03` (tests.md section T) — needs a device, since the failure mode lives in the native module set.

## Bug 17 — Priority pill below the status made the task card taller than needed

**File:** `src/screens/TasksScreen.js` (task card layout)

**Reported behaviour**

- The Bug 12 priority pill was stacked below the status pill in a right-hand column (`statusCol`). Since `cardTop`'s height is `max(title, pill column)`, a single-line title left the pill stack's extra height as a dead band between the title and the category chip, making every card one pill-row taller than before.

**Expected behaviour**

- The priority stays visible on every task card without adding any height to the card.

**Status:** ✅ Completed

**Resolution**

- The status pill is back to being alone in the top-right (its original footprint). The priority moved into the meta row as a compact chip directly next to the category chip — `[category] [priority] Due …` — reusing the category chip's styling at the same size. The card returns to its pre-feature height, and the title keeps its full width.

**Coverage:** [MANUAL] `PRIO-01`–`PRIO-03` (tests.md section P, updated for the new placement).

## Bug 18 — Previous page flashes for an instant after a completed swipe

**File:** `src/components/TabSwipe.js` (swipe completion handler)

**Reported behaviour**

- Completing a swipe showed the target page, then the previous page for a frame before the target page took over.

**Root cause**

- In the completion callback, `translateX.setValue(0)` and `peekWidth.setValue(0)` are applied on the native side immediately, while the preview panel's removal (`setPeek(null)`) and the navigator's tab swap commit through React — and those commits can land a frame apart. In that gap the old page was back at x=0 with the covering panel gone, so it flashed fully visible.

**Expected behaviour**

- After the completion animation the target page stays on screen; the previous page never reappears.

**Status:** ✅ Completed

**Resolution**

- The completion callback now only dispatches `navigate` and keeps the covering pose (page off-screen, panel at full width). The rest state is restored when the navigator confirms this wrapper lost focus (`blur` listener), by which point the old page is hidden — with a 300 ms timeout fallback in case blur never arrives.

**Coverage:** [MANUAL] `SWIPE-08` (tests.md section F, new).

## Bug 19 — Swipe preview shows a stale, fresh-state snapshot instead of the page as last seen

**File:** `src/components/TabSwipe.js` (snapshot cache, blur capture)

**Reported behaviour**

- After scrolling a page or applying a filter, leaving the tab (swipe or tab bar) and swiping back previewed the page in its DEFAULT state — scroll position reset, filters cleared — because the shared snapshot cache only ever held fresh-state captures from the background rig.

**Expected behaviour**

- The lazy-loaded preview must match the page's latest activity: the scroll position and active filters the user left behind.

**Status:** ✅ Completed

**Resolution**

- On `blur`, the wrapper screenshots its LIVE, fully-rendered page container one last time into the shared cache. The blur moment is safe to capture because the event fires during the navigation dispatch, before the navigator's commit detaches the old screen; if the capture fails (the known detached-view risk on some devices), the previous snapshot is kept. The swipe completion flow now resets the page's position immediately after `navigate` while the covering panel still hides it, so the blur-time capture sees the page at rest.
- The background rig pump only captures tabs with no cached snapshot, so the latest-look capture is not overwritten; it is replaced wholesale on the next data or theme change, which is the same moment the scroll context becomes stale anyway.

**Coverage:** [MANUAL] `SWIPE-09` (tests.md section F, new).

## Bug 20 — Incomplete swipe leaves the page stuck at the offset instead of springing back

**File:** `src/components/TabSwipe.js` (pan gesture end handling)

**Reported behaviour**

- Releasing a swipe that hadn't passed the threshold sometimes left the page frozen at its dragged offset (peek panel still visible) instead of springing back to centre.

**Root cause**

- Two layers, both fixed:
  1. The spring-back originally lived only in the pan's `onEnd`, which react-native-gesture-handler delivers only on a clean END. When the gesture is CANCELLED mid-drag (touch stolen, app-state interruption, overlapping handler), `onFinalize` fires without `onEnd` — so nothing ever animated `translateX` back to 0.
  2. The first fix (spring-back + `onFinalize` safety net) still failed on device. `Animated` completion callbacks are not guaranteed on the New Architecture (RN 0.86), and the original animations mixed `useNativeDriver: true` (translateX) with `false` (peekWidth) in one `Animated.parallel`, with `setValue()` applied to the same nodes mid-drag. When the spring-back's completion callback never fired, `settlingRef.current` stayed `true` — every later gesture was ignored by `onUpdate`, and the page stayed wherever the finger left it, rendered outside the screen.

**Expected behaviour**

- Any gesture that doesn't switch tabs must recenter the page. Above the threshold the tab switches; below it the page returns to centre. The page must never remain rendered off-centre.

**Status:** ✅ Completed

**Resolution**

- All TabSwipe animations are now JS-driven (`useNativeDriver: false` everywhere — no more mixed-driver parallel), so `setValue()` during the drag and `Animated.timing` on the same nodes never contend with a native driver.
- `springBack()` is hardened with a **guard timer**: the recenter pose (`translateX` 0, `peekWidth` 0, peek cleared, `settlingRef` cleared) is applied a moment after the animation starts even if the animation's completion callback never arrives — the page can no longer stay stuck off-centre, and `settlingRef` can no longer wedge shut and swallow future swipes. The guard skips the `translateX` reset only while a finger is back on the glass (tracked via `onTouchesDown/Up/Cancel`), so it never yanks the page out of a fresh drag.
- The passing-swipe completion got the same treatment: its callback is guarded too, so even a lost completion callback still navigates to the target tab and resets the pose.
- `.onFinalize` safety net retained: a CANCELLED gesture (no `onEnd`) recentres as well.

**Coverage:** [MANUAL] `SWIPE-03` (existing, now covers the cancel path too).

## Bug 21 — Swipe preview snapshot is laid out at the wrong size; the real page visibly re-flows on arrival

**File:** `src/components/TabSwipe.js` (capture rig + preview image sizing)

**Reported behaviour**

- The swipe preview showed the incoming page at a slightly wrong size; when the real page took over it appeared to "load, then adjust itself to the screen" — an obvious, jarring difference between snapshot and live page.

**Root cause**

- The rig and the preview image were sized from `useWindowDimensions()` — the FULL window — but the wrapped page actually lives in the tab navigator's content area, which is the window height minus the 66 pt tab bar. The snapshot was therefore rendered and captured one tab-bar taller than the real page: content positions didn't match what the user would see after the switch.

**Expected behaviour**

- The snapshot and the live page must be pixel-identical in layout: same content-area size, so the takeover from preview to real page is invisible except for interactivity.

**Status:** ✅ Completed

**Resolution**

- The wrapper now measures its own host with `onLayout` (`area` state) and sizes BOTH the hidden capture rig and the preview image from that measurement, falling back to the window size only until the first layout pass. Layout runs long before any capture (the pump waits 400 ms + idle), so every rig capture — and the blur-time latest-look capture, which already targeted the in-host page — is now at the exact size the real screen renders at.
- Gesture math still uses the window width (identical horizontally; only the vertical inset differs).

## Bug 22 — Swiping left flashes part of the left page inside the preview panel

**File:** `src/components/TabSwipe.js` (peek panel render + snapshot edge anchoring)

**Reported behaviour**

- Swiping right (to the left page) was fine, but swiping left (to the right page) showed part of the LEFT page's content for an instant during the partial swipe, alongside the right page's preview.

**Root cause**

- Two defects, both in the peek panel:
  1. The peek `<Image>` was reused across peek targets (React reconciles the same element position when `peek` changes name/side). While the new page's bitmap decoded, Android kept showing the PREVIOUS peek's image — after a right-swipe, that is literally the left page's snapshot, flashing inside the right-side panel.
  2. The styles `peekContentAtLeft` / `peekContentAtRight` were referenced in the render but never defined, so the full-screen-width snapshot always fell back to left-anchoring inside the panel. That is correct for a right-side panel but wrong for a left-side one (a left swipe into the previous page showed its leading edge at the boundary instead of its trailing edge).

**Expected behaviour**

- The preview panel must never display any page other than the peek target, in any direction, and the visible strip at the panel's boundary must show the incoming page's edge that would physically be adjacent to the moving page.

**Status:** ✅ Completed

**Resolution**

- The peek `Animated.View` is now keyed by `name + ':' + side`, so a direction/target change mounts a FRESH panel and image: a target switch starts blank (the panel's own background) for a frame instead of flashing the wrong page.
- `peekContentAtLeft: { left: 0 }` and `peekContentAtRight: { right: 0 }` are defined, giving both swipe directions the physically-correct snapshot edge at the moving boundary.

**Follow-up (flash still seen on left swipes after the key/anchor fix)**

The key + anchor fix removed the stale-image reuse, but the flash survived because a decode gap remained: the panel mounted one React commit after the page's first movement (`Animated.setValue` is native-instant; `setPeek` is a commit), and while the target's bitmap decoded the panel showed its plain background — and on the left the target's snapshot was OLDER (captured the last time that tab lost focus, not moments ago like a right-swipe target, which the blur-time capture refreshes after every arrival), so the gap was visible where the right swipe's was not.

A pre-arming approach (mounting BOTH adjacent panels at width 0 at touch-down) was tried and REVERTED: the inactive panel stays mounted through the whole drag, and on the left side its snapshot (the previous page) became visible THROUGHOUT the swipe instead of never — the flash turned persistent. Two full-size mounted previews during every drag is also the wrong shape for the gesture.

Final fix — DECODE PREWARM, NO EXTRA VIEWS: when a tab gains focus, `Image.prefetch` warms its adjacent tabs' snapshot bitmaps into the image cache (no views mounted, no layout cost — and done at focus, long before any touch lands). The single keyed panel then mounts exactly as before, but its bitmap is already warm, so the panel goes from mount to correct content with no visible gap in either direction. The revealed strip can only ever show the panel's themed background or the correct target's snapshot.

## Bug 23 — White flash when opening/closing any stack screen; partial old-page frame during a swipe completion

**File:** `App.js` (navigator theming), `src/components/TabSwipe.js` (completion choreography)

**Reported behaviour**

- Opening New Task, a hobby's details, Edit Hobby, Edit Category or Edit Task — and closing any of them — showed a white screen for an instant before the themed page appeared.
- A left swipe still showed part of the old page for an instant alongside the incoming page.

**Root cause**

- The app themed its screens but never the NAVIGATORS. `@react-navigation/stack` paints each card with `theme.colors.background` from the `NavigationContainer` theme — we passed none, so the library default (near-white) was the container colour. Bottom-tabs passes its `sceneStyle` option to the native screen container — unset, so the native default (white) showed. Any frame where a screen's themed content had not yet painted (push, pop, tab switch, the frame where the swipe's covering panel is removed) displayed that white container.
- The swipe completion also carried avoidable choreography: the covering preview panel was removed later, via a blur listener + 300 ms fallback, opening a window where the already-recentred old page could show through before the new tab painted. All JS-driven now, the switch needs none of it.

**Expected behaviour**

- No frame of any navigation transition may show a colour the app never uses. A successful swipe glides, then switches seamlessly; an unsuccessful swipe springs back; opening/closing stack screens never flashes white.

**Status:** ✅ Completed

**Resolution**

- A navigation theme is built from the app palette and passed to `NavigationContainer` (`background`/`card`/`border`/`text`/`primary`/`notification`): stack cards now paint with `COLORS.bg`, so push/pop transitions show the theme instead of white. `NavigationContainer` moved inside the themed `Navigation` component so the theme follows dark/cream mode.
- The bottom-tabs navigator got `screenOptions.sceneStyle: { backgroundColor: COLORS.bg }`, theming the native tab screen containers — the frame between the covering panel's removal and the new tab's paint now shows the theme, not white.
- Swipe completion SIMPLIFIED: the tab switch and the pose reset (page to 0, peek cleared) happen in one synchronous block inside the animation's completion callback — one atomic React commit, no blur-based sequencing, no fallback race. The panel is unmounted by `setPeek(null)` in that same commit — deliberately NOT collapsed with `peekWidth.setValue(0)`, because an Animated.setValue mutates the native view instantly and would drop the cover a frame before the swap lands, exposing the recentred old page ("previous page flashes after the next page loads"). The blur-time latest-look screenshot (Bug 19) is unaffected.

*Note: the background capture rig referenced in earlier resolutions of Bugs 19–23 was removed entirely in Bug 24 (app-wide lag). The snapshot cache is filled ONLY by the blur-time latest-look capture, and the strip revealed during a drag shows the preview panel (keyed by `name + ':' + side`), which mounts one commit after the first movement.*

**Follow-up (white flash remained on opening/closing Settings)**

Settings sits on the ROOT stack, above the tab navigator. The screen itself, the stack card and the tab scenes were all themed — but every layer BETWEEN the themed screens and the Android activity window (the container root view, the gesture root, the providers) was transparent, and Expo's default activity theme paints the window white. Any frame during a root-stack push/pop where the themed content had not yet been composited showed that white window background. Fix: a themed `View` (`flex: 1`, `backgroundColor: COLORS.bg`) now wraps the root navigator inside `NavigationContainer`, so any layer that has not yet painted shows the app background instead of the window's.

## Bug 24 — The entire application became laggy

**File:** `src/components/TabSwipe.js` (capture rig + background pump), `App.js` (`registerPeekScreen`)

**Reported behaviour**

- The whole app — every list scroll, every tap, every navigation — felt heavy and janky, not just the swipe gesture.

**Root cause**

- The snapshot machinery had grown into a background render-and-capture loop: a hidden rig mounted each tab's REAL screen at full screen size (zIndex 0 behind the page), a pump cycled it through `TAB_ORDER` using `requestIdleCallback` + a 400 ms debounce, and `captureRef` JPEG-encoded each screen into the snapshot cache. The cycle re-triggered on EVERY app-state change — and in this app every data mutation (a task completed, a hobby checked, a category renamed) touches app state, so a single toggle re-mounted up to four full screens and ran up to four full-screen JPEG captures. Constant full-size mounts + bitmap encodes starved the JS thread and the native UI, which read as "the whole app is laggy".
- A secondary cost: `Image.prefetch` ran at every touch-down, doing bitmap decode work in the middle of the user's gesture.

**Expected behaviour**

- The app is smooth everywhere. Snapshot freshness must cost nothing while the user is interacting — at most one capture per navigation, never a loop, never during a gesture.

**Status:** ✅ Completed

**Resolution**

- The capture rig, the pump (`requestIdleCallback` + debounce cycle), `PEEK_SCREENS`/`registerPeekScreen`, the failed-capture retry list, and the app-state invalidation watcher were ALL REMOVED. The snapshot cache is now filled ONLY by the blur-time latest-look capture (Bug 19): exactly one `captureRef` per focus loss — one JPEG per navigation, zero while idle, zero during any gesture.
- Data changes deliberately do NOT invalidate the cache: the preview is a momentary glance at the adjacent page and refreshes the next time that tab loses focus. Only a theme change invalidates (a same-theme snapshot would look wrong in the other palette).
- `Image.prefetch` moved from touch-down to focus gain: each tab's adjacent snapshots are warmed once when the tab is focused, so no decode work happens inside a gesture.
- Unvisited tabs have no snapshot; their preview panel shows the plain label fallback until visited once.

## Bug 25 — Page content visible during left swipe; failed-swipe animation missing

**File:** `src/components/TabSwipe.js` (entire swipe mechanism reconstructed)

**Reported behaviour**

- During a swipe, part of the previous page's content is visible — earlier as a one-frame flash, later as content that stays visible THROUGHOUT the drag.
- The failed-swipe (release-before-threshold) animation disappeared at one point — the page was stuck / snapped without the eased return.
- Several distinct fixes (below) each changed the symptom but never eliminated it.

**Everything attempted**

1. **Panel keying** (Bug 22): peek panel keyed by `name + ':' + side` so React never reuses the previous peek's `<Image>` — removed the wrong-page flash. Flash remained.
2. **Edge anchoring** (Bug 22): `peekContentAtLeft`/`peekContentAtRight` defined — the boundary now shows the physically-adjacent edge in both directions. Flash remained.
3. **Pre-armed dual panels** (tried and REVERTED): mounting both adjacent panels at width 0 at touch-down made the LEFT side's snapshot visible THROUGHOUT the drag instead of never — regression, reverted.
4. **Decode prewarm** (Bug 22 follow-up): `Image.prefetch` on the adjacent snapshots so the keyed panel's bitmap is warm when it mounts (first at touch-down, later moved to focus gain, Bug 24). Flash remained.
5. **Navigator theming** (Bug 23): themed stack cards, tab scene containers, and the root view — removed the WHITE flash on push/pop/tab switch. The page-content flash remained.
6. **Atomic completion** (Bug 23): tab switch + pose reset in one synchronous commit. Unrelated flash remained.
7. **Stale-bundle elimination**: Metro was pushing Fast-Refresh updates of half-edited intermediate files (Hermes `ReferenceError: Property 'X' doesn't exist` in device logs). Metro restarted clean with `--clear`, device full-reloaded. Some symptoms (missing spring, crash) were indeed stale bundles; the content flash itself survived a verified clean reload.

**Root cause (verified)**

- The blur-time latest-look capture (Bug 19) fires from the `blur` listener, which runs during the `navigate()` dispatch — BEFORE the completion block resets `translateX` to 0. So the page being LEFT via a passing swipe is screenshotted while still translated to `exitX` (fully or partially off-screen, mid-exit). That corrupt snapshot enters the cache and is shown the NEXT time a swipe reveals that tab: a shifted/partial image that looks like "part of the previous page loads and stays visible throughout the swipe". It also explains directionality (which tab's snapshot is corrupted depends on the exit direction) and why no amount of panel theming/keying fixes it — the CONTENT of the cache itself is wrong.
- **Additionally**: the original "cover" architecture (page translates, peek panel expands from edge ON TOP) relied on `zIndex` to keep the peek panel above the page. On Android, transformed views (`translateX`) ignore `zIndex` and render on top of siblings — so the dragging page visually covered the peek panel at the boundary, revealing the "previous page" (the page being left) during left swipes. Two separate `Animated.Value`s (`translateX` and `peekWidth`) updated via `setValue` also risked 1-frame desync.

**Resolution**

- **Reconstructed the entire swipe mechanism** using a "reveal from underneath" architecture with a SINGLE animated value (`dragX`):
  - Peek panel renders FIRST (underneath), full-screen-width, positioned at the adjacent page's location (`translateX: +width` for next page, `-width` for previous page).
  - Page renders SECOND (on top), translates with `dragX`.
  - As the page drags, the peek panel is revealed from underneath — no zIndex needed, render order guarantees layering.
  - Android `elevation: -1` on the peek panel ensures it stays underneath.
  - Perfect sync guaranteed because only ONE animated value drives the gesture.
- **Blur-time capture fixed**: completion callback resets `dragX` via zero-duration `Animated.timing` BEFORE `navigation.navigate()`, so the blur capture sees the page at rest (not mid-exit).
- **Failed-swipe spring-back preserved**: page springs back with rubber-band ease while peek is covered again in lockstep. Hard fallback (480 ms) completes reset if animation callback is lost.

**Covered by:** [MANUAL] `SWIPE-05`, `SWIPE-08` (tests.md section G) — directional content flash eliminated; failed-swipe spring-back with lockstep preview works correctly.

**Status:** ✅ Completed
