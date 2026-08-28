# Test Plan

This plan is the pre-commit gate. **No change to any of the bugs listed in `BUGS.md` ships unless every applicable test below is run and reports `PASS`.** A `FAIL` or `PARTIAL` blocks the commit. The plan is intentionally strict, specific, and vast — every area of the app is touched, not only the lines the fix touches.

Each test has:

- **ID** — stable, file-prefixed (e.g. `STREAK-03`).
- **Pre-conditions** — exact state required to start the test.
- **Steps** — numbered, deterministic actions.
- **Expected result** — what `PASS` looks like.
- **Reporting** — the line to print into the commit notes:
  `[<id>] <PASS|FAIL|PARTIAL> — <one-sentence reason>`

Tests that cannot be automated (e.g. notification ringer on a real device) are marked **[MANUAL]** and must be checked off by hand before commit.

---

## Reporting format (verbatim, in the commit body)

```
TESTS
[STREAK-01]  PASS — task completion today increments streak
[STREAK-02]  PASS — hobby completion today increments streak
[STREAK-03]  PASS — no task + no hobby today does not increment
[STREAK-04]  PASS — streak resets to 1 on a gap day
[STREAK-05]  PASS — streak continues on consecutive days
[STREAK-FULL] [MANUAL] — full week simulation

[TASK-01]    PASS — custom mode survives stepper to 60
[TASK-02]    PASS — explicit preset tap exits custom mode
[TASK-03]    PASS — saved value is exact
[TASK-04]    [MANUAL] — validation still blocks past triggers
[TASK-04b]   [MANUAL] — empty title shows an error toast (no crash)
[TASK-05]    [MANUAL] — custom wheels render d/h/m columns
[TASK-06]    [MANUAL] — scrolling a wheel changes that unit only
[TASK-07]    [MANUAL] — subtitle reflects d/h/m breakdown
[TASK-08]    [MANUAL] — preset tap re-seeds the parts
[TASK-09]    [MANUAL] — before-expiry card hidden when no expiry
[TASK-10]    [MANUAL] — dynamic cap reflects time-to-expiry
[TASK-11]    [MANUAL] — shrinking expiry clamps parts
[TASK-08-helper]  PASS — unitToMinutes(2, days) === 2880
[TASK-08b-helper] PASS — unitToMinutes(3, hours) === 180
[TASK-08c-helper] PASS — unitToMinutes(30, minutes) === 30
[TASK-09-helper]  PASS — minutesToParts(90) splits to 0d 1h 30m
[TASK-09b-helper] PASS — minutesToParts(2880) splits to 2d 0h 0m
[TASK-09c-helper] PASS — minutesToParts(0) is all zeros
[TASK-09d-helper] PASS — minutesToParts(1500) splits to 1d 1h 0m
[TASK-10-helper]  PASS — clampUnitValue caps hours at 23
[TASK-10b-helper] PASS — clampUnitValue caps days at 7
[TASK-10c-helper] PASS — clampUnitValue floors minutes at 0
[TASK-10d-helper] PASS — clampUnitValue caps minutes at 59
[TASK-11-helper]  PASS — partsToMinutes composes 1d 2h 3m to 1485
[TASK-11b-helper] PASS — partsToMinutes({}) === 0
[TASK-11c-helper] PASS — partsToMinutes clamps to 7-day max
[TASK-12-helper]  PASS — UNITS exposes canonical d/h/m order
[TASK-13-helper]  PASS — maxBeforeExpiryMinutes(now+3h) === 180
[TASK-13b-helper] PASS — past expiry → null
[TASK-13c-helper] PASS — null expiry → null
[TASK-13d-helper] PASS — tight expiry floors to 1 min
[TASK-14-helper]  PASS — partsWithinMax(180) → 0d 3h 0m
[TASK-14b-helper] PASS — partsWithinMax(1500) → 1d 1h 0m
[TASK-14c-helper] PASS — partsWithinMax(90) → 0d 1h 30m
[TASK-14d-helper] PASS — partsWithinMax(0) → all zeros
[TASK-15-helper]  PASS — maxForUnit respects chosen parts
[TASK-15b-helper] PASS — maxForUnit hard-caps minutes at 59
[TASK-15c-helper] PASS — maxForUnit floors days at 0 below 1440
[TASK-15d-helper] PASS — maxForUnit hard-caps hours at 23
[TASK-16]         PASS — formatDuration(0) → "0 min"
[TASK-16b-helper] PASS — formatDuration(7) → "7 min"
[TASK-16c-helper] PASS — formatDuration(59) → "59 min"
[TASK-16d-helper] PASS — formatDuration(60) → "1 hour"
[TASK-16e-helper] PASS — formatDuration(90) → "1 hour 30 min"
[TASK-16e2-helper] PASS — formatDuration(180) → "3 hours"
[TASK-16f-helper] PASS — formatDuration(1500) → "1 day 1 hour"
[TASK-16g-helper] PASS — formatDuration(8775) → full d/h/m
[TASK-16h-helper] PASS — formatDuration(1440) → "1 day"
[TASK-16i-helper] PASS — dynamic cap formats as d/h/m

[CAL-01]    PASS — WEEKDAY_LABELS is Mon-first
[CAL-02]    PASS — MONTH_SHORT is the canonical 12
[CAL-03]    PASS — matrix has 6 rows
[CAL-03b]   PASS — Aug 2026 first row in-month days: 1, 2
[CAL-03c]   PASS — Aug 2026 ends on day 31
[CAL-03d]   PASS — Aug 31 2026 is a Monday
[CAL-04]    PASS — matrix has 42 cells
[CAL-04b]   PASS — every row has 7 cells
[CAL-05]    PASS — August has 31 in-month cells
[CAL-05b]   PASS — Aug 2026 has 11 padding cells
[CAL-06]    PASS — Feb 2026 has 28 days
[CAL-07]    PASS — Mar 2026 first row in-month day: 1
[CAL-08]    PASS — yesterday is disabled
[CAL-08b]   PASS — today (any time) is enabled
[CAL-08c]   PASS — tomorrow is enabled
[CAL-09]    PASS — Aug 29 <= max
[CAL-09b]   PASS — Aug 30 == max (any time)
[CAL-09c]   PASS — Aug 31 > max
[CAL-10]    PASS — before min
[CAL-10b]   PASS — inside range
[CAL-10c]   PASS — after max
[CAL-11]    PASS — null cell is disabled
[CAL-12]    PASS — composeDateWithTime merges date + time
[CAL-13]    PASS — null inputs → valid Date
[CAL-14]    PASS — isSameLocalDay ignores time-of-day
[CAL-15]    PASS — matrix carries today
[CAL-16]    PASS — Dec 2026 boundary in-month days

[CAL-LIVE-01] [MANUAL] — calendar renders 6×7 grid
[CAL-LIVE-02] [MANUAL] — tap a day updates the date
[CAL-LIVE-03] [MANUAL] — chevrons change month
[CAL-LIVE-04] [MANUAL] — past days are disabled
[CAL-LIVE-05] [MANUAL] — custom reminder caps at expiry
[CAL-LIVE-06] [MANUAL] — expiry has no upper cap

[CR-01]     PASS — new task has no startDate
[CR-02]     [MANUAL] — startDate UI is gone
[CR-03]     [MANUAL] — saved task has no startDate
[CR-04]     [MANUAL] — no "starts in 30 min" notification

[CARD-01]   [MANUAL] — date card expands on body tap
[CARD-02]   [MANUAL] — × clear does not bubble to card tap
[CARD-03]   [MANUAL] — reminder card toggles on body tap
[CARD-04]   [MANUAL] — reminder card toggles off on body tap
[CARD-05]   [MANUAL] — reminder × does not bubble
[CARD-06]   [MANUAL] — before-expiry toggles on body tap when expiry set
[CARD-07]   [MANUAL] — hobby reminder toggles on body tap
[CARD-08]   [MANUAL] — hobby reminder toggles off on body tap
[CARD-09]   [MANUAL] — hobby reminder × does not bubble

[TIME-01]   PASS — hours scroll 1..12
[TIME-02]   PASS — minutes scroll 0..59
[TIME-03]   PASS — AM/PM toggle unaffected
[TIME-04]   [MANUAL] — wheel selection is the centered row
[TIME-05]   [MANUAL] — duration wheels range days 0..7 / hrs 0..23 / min 0..59
[TIME-06]   [MANUAL] — duration wheels allow 1-minute granularity (7 min)
[TIME-07]   [MANUAL] — duration wheels clamp to the dynamic expiry cap

[GRID-01]   PASS — no future cells rendered
[GRID-02]   PASS — month label anchored to 1st-of-month column
[GRID-03]   PASS — day-of-week gutter matches Mon..Sun
[GRID-04]   PASS — week column count is correct for elapsed weeks

[MID-01]    PASS — recompute fires within 1s of local midnight
[MID-02]    PASS — "Today's hobbies" flips at midnight

[NOTIF-01]  PASS — channel importance MAX
[NOTIF-02]  PASS — handler shouldPlaySound true
[NOTIF-03]  [MANUAL] — sound + vibration on real device

[SWIPE-01]  PASS — horizontal swipe changes tab
[SWIPE-02]  PASS — vertical scroll does not change tab
[SWIPE-03]  PASS — short swipe is ignored
[SWIPE-04]  PASS — swipe disabled in stack screens
[SWIPE-05]  [MANUAL] — static snapshot of adjacent page slides in during drag; page springs back if swipe incomplete
[SWIPE-06]  [MANUAL] — swipe unavailable while a task/category is being created or edited
[SWIPE-07]  [MANUAL] — swipe past outer edges does nothing, no white background

[BACK-01]   [MANUAL] — system back on a tab list returns to Dashboard
[BACK-02]   [MANUAL] — system back on Dashboard pops "Leave the app?" dialog
[BACK-03]   [MANUAL] — deeper screens (forms/settings) keep default pop

[UNSAVED-01] [MANUAL] — back with unsaved task edits pops "Discard changes?" dialog
[UNSAVED-02] [MANUAL] — Keep editing stays on screen; Discard leaves and loses changes
[UNSAVED-03] [MANUAL] — saving then back does NOT pop the dialog (task/hobby/category)
[UNSAVED-04] [MANUAL] — back with NO edits navigates immediately, no dialog
[UNSAVED-05] [MANUAL] — editing every field back to its original value → back is immediate, no dialog

[THEME-01]  PASS — dark/cream toggle persists
[THEME-02]  PASS — accent picker persists per theme

[PERSIST-01] PASS — kill + relaunch restores state
[PERSIST-02] PASS — corrupted JSON recovers to defaults

[NAV-01]    PASS — tab order matches bar order
[NAV-02]    PASS — settings opens from header
[CAT-01]    PASS — add/edit/delete category works
[TASK-A01]  PASS — create task with all fields
[TASK-A02]  PASS — edit task preserves id
[TASK-A03]  PASS — delete task cancels notifications
[TASK-A04]  PASS — complete task cancels notifications
[TASK-A05]  PASS — undo restores pending + future reminders
[TASK-A06]  [MANUAL] — completed card shows Undo/Delete, no Edit
[TOAST-01]  [MANUAL] — validation error toast, no crash (task/hobby/category)
[HOBBY-A01] PASS — create hobby with reminder
[HOBBY-A02] PASS — toggle hobby for past date
[HOBBY-A03] PASS — delete hobby cancels notifications
[INS-01]    PASS — range filter changes charts
```

A `PARTIAL` is only acceptable when a single sub-step of a multi-step test is blocked by an unrelated environment issue; the commit must include a written justification.

---

## A. Streak logic (Bug 1) — Completed

The streak is incremented when **either** a task is completed today **or** at least one hobby is marked today, and is reset to 0 on a day with neither. `lastActiveDate` is recomputed every tick and on app foreground.

Covered by: `tests/run-streak-tests.mjs` (18 PASS), plus the manual smoke below.

### STREAK-01 — Task completion today increments the streak
- **Pre-conditions:** Cold install; `streak = 0`; no hobbies; one pending task.
- **Steps:** Complete the task via the dashboard checkbox.
- **Expected:** Dashboard header `state.streak` is `1`; `state.lastActiveDate` is today's `YYYY-MM-DD`.

### STREAK-02 — Hobby completion today increments the streak
- **Pre-conditions:** Cold install; `streak = 0`; no tasks; one hobby.
- **Steps:** Toggle the hobby checkbox for today on the dashboard hobby row.
- **Expected:** Dashboard header `state.streak` is `1`; `state.lastActiveDate` is today.

### STREAK-03 — Day with neither a task nor a hobby does not change the streak
- **Pre-conditions:** `streak = 5`; `lastActiveDate = yesterday`; no tasks completed today; no hobbies marked today.
- **Steps:** Open the app; trigger `recomputeStreak` (background → foreground).
- **Expected:** `streak` remains `5`.

### STREAK-04 — A gap day followed by activity resets the streak to 1
- **Pre-conditions:** `streak = 5`; `lastActiveDate = 3 days ago`.
- **Steps:** Complete a task today.
- **Expected:** `streak = 1`; `lastActiveDate = today`.

### STREAK-05 — Consecutive days keep incrementing
- **Pre-conditions:** `streak = 5`; `lastActiveDate = yesterday`.
- **Steps:** Complete a hobby today.
- **Expected:** `streak = 6`; `lastActiveDate = today`.

### STREAK-FULL — Full week simulation **[MANUAL]**
- **Pre-conditions:** Fresh state.
- **Steps:** For seven consecutive days, mark at least one hobby (or complete one task) per day. Record `streak` at the end of each day.
- **Expected:** `streak` ends at `7`; the dashboard header shows `7` from the start of day 8 onwards.

---

## B. Task add/edit — before-expiry (Bug 2) — Completed

The `beforeExpiryCustomMode` flag keeps the user in "Custom…" mode even when the picked minutes happen to coincide with a preset. The d/h/m unit picker splits the offset into days + hours + minutes; total minutes is recomputed via `partsToMinutes` whenever the user is in custom mode.

Covered by: `tests/run-before-expiry-tests.mjs` (52 PASS — `TASK-01`..`TASK-07` for the active-chip semantics, `TASK-08-helper`..`TASK-15d-helper` for the helpers, `TASK-16`..`TASK-16i` for `formatDuration`), plus the manual smoke below.

### TASK-01 — Custom mode survives wheel input to 60
- **Pre-conditions:** New task screen open; Before-expiry toggle on.
- **Steps:** Tap `Custom…`. On the d/h/m wheels, set days=0, hours=1, minutes=0.
- **Expected:** `Custom…` chip remains highlighted. The d/h/m wheels remain visible. `1 hour` chip is not highlighted.

### TASK-02 — Explicit preset tap exits custom mode
- **Pre-conditions:** State from TASK-01.
- **Steps:** Tap `1 hour` chip.
- **Expected:** `1 hour` chip is highlighted. `Custom…` chip is not. The d/h/m wheels are hidden. `beforeExpiryMinutes === 60`.

### TASK-03 — Saved value is exact
- **Pre-conditions:** Custom wheels at days=0, hours=0, minutes=47.
- **Steps:** Save the task; reopen it for edit.
- **Expected:** `beforeExpiryMinutes === 47`; the `Custom…` chip is highlighted on reopen.

### TASK-04 — Validation still blocks past triggers **[MANUAL]**
- **Pre-conditions:** Expiry = now + 30 minutes. Custom at 60.
- **Steps:** Tap Save.
- **Expected:** Red toast "This expiry is too close for the chosen reminder offset." appears; no crash. Task is not saved.

### TASK-04b — Empty title shows an error toast, no crash **[MANUAL]**
- **Pre-conditions:** New task screen, title empty.
- **Steps:** Tap `Create task`.
- **Expected:** Red toast "Please enter a task title." appears; the screen stays open; no crash. (Regression gate for the missing `toast.error` crash — also check the same on Add/Edit hobby and Add/Edit category.)

### TASK-05 — Custom wheels render d/h/m **[MANUAL]**
- **Pre-conditions:** Before-expiry toggle on. `Custom…` active.
- **Steps:** Inspect the custom duration picker.
- **Expected:** Three scrollable wheel columns are visible with `DAYS` / `HRS` / `MIN` labels, each with a highlighted selection band in the middle. No unit chips, no ± buttons.

### TASK-06 — Scrolling a wheel changes that unit only **[MANUAL]**
- **Pre-conditions:** State from TASK-05, parts d/h/m = 0/0/0.
- **Steps:** Scroll the hours wheel to 4. Then the days wheel to 2. Then the minutes wheel to 7.
- **Expected:** Parts read 0/4/0, then 2/4/0, then 2/4/7. Days never exceeds 7, hours never exceeds 23, minutes never exceeds 59; each wheel loops at its own ends instead of stopping.

### TASK-07 — Card subtitle reflects d/h/m breakdown **[MANUAL]**
- **Pre-conditions:** Days=2, Hours=3, Minutes=15, expiry date set.
- **Steps:** Look at the card subtitle.
- **Expected:** Subtitle reads `Notify 2 days 3 hours 15 min before expiry`. No raw minute total is shown anywhere on the card.

### TASK-08 — Preset tap re-seeds the parts **[MANUAL]**
- **Pre-conditions:** Custom mode active, current parts d/h/m = 2/3/15.
- **Steps:** Tap the `1 hour` preset.
- **Expected:** `1 hour` chip becomes active, `Custom…` is not. Tap `Custom…` again — d/h/m now show 0/1/0, not the previous 2/3/15. Total minutes is 60.

### TASK-09 — Before-expiry card hidden when no expiry **[MANUAL]**
- **Pre-conditions:** New task screen, expiry date not set.
- **Steps:** Inspect the reminders section.
- **Expected:** The "Before expiry" card is not visible at all — no header, no toggle, no chip. The "Custom reminder" card is still shown.

### TASK-10 — Dynamic cap reflects time-to-expiry **[MANUAL]**
- **Pre-conditions:** Expiry set to now + 3 hours.
- **Steps:** Toggle before-expiry on, tap `Custom…`. Scroll the days wheel up, then the hours wheel.
- **Expected:** Card subtitle includes "max 3 hours" (d/h/m, no raw minute total). Days cannot exceed 0 (3 h < 1 day) — the parts clamp back so the total stays ≤ 180. Hours caps at 3 (180 min).

### TASK-11 — Shrinking expiry clamps parts **[MANUAL]**
- **Pre-conditions:** Expiry = now + 2 days, custom parts = 1 day 5 hours (total 1740 min).
- **Steps:** Change expiry to now + 3 hours (e.g. via the date picker).
- **Expected:** Without you touching the wheels, they re-anchor to 0/3/0. Scrolling further up cannot exceed the cap. The card subtitle now reads "max 3 hours".

### TASK-13..15d — Pure-helper gates (run-before-expiry-tests.mjs)
See `tests/run-before-expiry-tests.mjs` for the full assertion list. Every case must report `PASS`.

---

## C. Time picker — scrollable wheel (Bug 6)

The picker is a set of scroll wheels (`src/components/WheelPicker.js`): the row that
settles in the middle selection band IS the applied value. Wheels LOOP — scrolling
past the last item wraps around to the first (and vice versa), like a rotary dial.
Used by the task custom reminder, the hobby reminder, the settings times (via
`InlineTimePicker`), and the before-expiry custom duration (`DurationWheelPicker`).

### TIME-01 — Hours scroll 1..12
- **Pre-conditions:** Any time picker (hobby reminder, task custom reminder).
- **Steps:** Scroll the hour column past 12, then past 1.
- **Expected:** The wheel wraps — scrolling past 12 shows 1 again, scrolling back past 1 shows 12. Only values 1..12 are ever applied.

### TIME-02 — Minutes scroll 0..59
- **Steps:** Scroll the minute column past 59, then past 0.
- **Expected:** The wheel wraps — past 59 comes 00 again, past 00 comes 59. Every single minute (e.g. 7) is reachable — no 5-minute stepping.

### TIME-03 — AM/PM toggle unaffected
- **Steps:** With time `3:00 AM`, tap PM.
- **Expected:** Displayed value becomes `3:00 PM`. The underlying 24-hour `value.getHours()` is `15`.

### TIME-04 — Wheel selection is the centered row **[MANUAL]**
- **Steps:** Flick a wheel, let it settle. Repeat with a slow drag that ends without momentum.
- **Expected:** In both cases the bold row inside the selection band is the value applied (check the card subtitle / summary line matches). No +/− buttons are rendered anywhere.

### TIME-05 — Duration wheels range days 0..7 / hrs 0..23 / min 0..59 **[MANUAL]**
- **Pre-conditions:** New task → Before expiry → Custom….
- **Steps:** Scroll each of the three duration wheels to both ends.
- **Expected:** Days stays within 0 and 7, hours within 0 and 23, minutes within 0 and 59 (each wheel loops at its own ends). All three columns show bare numbers only — the units live in the `DAYS` / `HRS` / `MIN` header row below the wheels.

### TIME-06 — Duration wheels allow 1-minute granularity **[MANUAL]**
- **Steps:** Set the wheels to days=0, hours=0, minutes=7. Save the task; reopen for edit.
- **Expected:** The summary reads `Notify 7 min before expiry`; on reopen the minute wheel is anchored at 7 and `Custom…` is active. (Regression gate for the old 5-minute-step stepper.)

### TIME-07 — Duration wheels clamp to the dynamic expiry cap **[MANUAL]**
- **Pre-conditions:** Expiry = now + 45 minutes; custom mode on.
- **Steps:** Scroll the minutes wheel up to 59.
- **Expected:** The wheels re-anchor so the total never exceeds the cap (0/0/45 for a 45-min-away expiry). Saving the task succeeds with the clamped value; no "too close" toast appears.

---

## D. Hobby history grid (Bug 3)

### GRID-01 — No future cells rendered
- **Pre-conditions:** Today is `2026-08-23`.
- **Steps:** Open any hobby's detail screen.
- **Expected:** The grid contains exactly the cells for the year up to and including today. There are no cells after today in any row.

### GRID-02 — Month label anchored to 1st-of-month column
- **Pre-conditions:** Today is in August.
- **Steps:** Visually trace the `Aug` label.
- **Expected:** `Aug` label sits directly above the column that contains `Aug 1`.

### GRID-03 — Day-of-week gutter matches Mon..Sun
- **Steps:** Compare each row index (`0..6`) against the day-of-week of the date in that row.
- **Expected:** Row 0 = Mon, row 1 = Tue, … row 6 = Sun. Gutter text matches.

### GRID-04 — Week column count is correct for elapsed weeks
- **Pre-conditions:** Today is `2026-08-23`.
- **Steps:** Count the columns in the grid.
- **Expected:** Number of columns matches `ceil(((today − monday-of-week-of-jan-1) + 1) / 7)`.

---

## E. Midnight rollover (Bug 4)

### MID-01 — Recompute fires within 1 s of local midnight
- **Pre-conditions:** App open at `23:59:30`.
- **Steps:** Watch the system clock cross `00:00:00`.
- **Expected:** `recomputeStreak` is called within 1 s; `state.streak` is updated atomically.

### MID-02 — "Today's hobbies" flips at midnight
- **Pre-conditions:** App open at `23:59:30`; all hobbies are marked today.
- **Steps:** Watch the system clock cross `00:00:00`.
- **Expected:** Within 1 s, the dashboard hobby rows un-check and show the "Mark today" empty state.

---

## F. Notifications (Bug 5)

### NOTIF-01 — Channel importance MAX
- **Pre-conditions:** Cold launch on Android.
- **Steps:** `adb shell dumpsys notification` and locate the channel id `default`.
- **Expected:** Importance = `MAX` (5). `enable_vibration = true`. `vibration_pattern` is non-empty. `sound = default`.

### NOTIF-02 — Handler shouldPlaySound true
- **Steps:** Read the source of `AppContext.js` and confirm `Notifications.setNotificationHandler({ handleNotification })` returns `shouldPlaySound: true`.
- **Expected:** Present and true.

### NOTIF-03 — Sound + vibration on real device **[MANUAL]**
- **Pre-conditions:** A real Android device.
- **Steps:** Schedule a notification for now + 30 s. Wait.
- **Expected:** Device rings/vibrates. Notification appears in tray.

### NOTIF-04 — Handler shouldShowAlert true (Bug 11)
- **Steps:** Read the source of `AppContext.js` and confirm the `setNotificationHandler` response includes `shouldShowAlert: true` alongside `shouldPlaySound: true`.
- **Expected:** Present and true — expo-notifications 0.28 defaults `shouldShowAlert` to false, which suppressed all foreground presentation while the sound still played.

### NOTIF-05 — Visible while the app is open (Bug 11) **[MANUAL]**
- **Pre-conditions:** App open on any tab, notifications permitted.
- **Steps:** Schedule a notification for now + 1 min. Keep the app in the foreground and watch.
- **Expected:** A heads-up banner appears over the app at the scheduled moment, and the notification is present in the system notification list afterwards.

### NOTIF-06 — Fires at the scheduled minute (Bug 11) **[MANUAL]**
- **Pre-conditions:** Android 12+. On Android 14+, "Alarms & reminders" is granted to the app (or to Expo Go when running there).
- **Steps:** Set a daily reminder one minute ahead. Watch the device clock tick to the preferred time.
- **Expected:** The ring lands within a second or two of the minute — not 30–40 s later.

---

## G. Swipe between tabs (Bug 7)

### SWIPE-01 — Horizontal swipe changes tab
- **Pre-conditions:** Dashboard tab is active.
- **Steps:** Swipe left across ≥ 40% of the screen width with < 40 px of vertical drift.
- **Expected:** Tasks tab becomes active.

### SWIPE-02 — Vertical scroll does not change tab
- **Pre-conditions:** Dashboard tab is active with a long scrollable list.
- **Steps:** Scroll the list down by 300 px; the finger never moves more than 30 px horizontally.
- **Expected:** Tab does not change.

### SWIPE-03 — Short swipe is ignored
- **Steps:** Swipe left across 12% of the screen width.
- **Expected:** Tab does not change.

### SWIPE-04 — Swipe disabled in stack screens
- **Pre-conditions:** On AddTask (a stack screen inside the Tasks tab).
- **Steps:** Swipe left across 80% of the screen width.
- **Expected:** Tab does not change.

### SWIPE-05 — Static adjacent-page snapshot and spring back **[MANUAL]**
- **Pre-conditions:** Any tab is active; wait ~2–3 s after launch (background snapshot capture of all tabs). Revisit swipes must NOT need this wait — the snapshot cache persists across tab switches.
- **Steps:** Slowly drag the page left, watching the screen; release halfway without passing the threshold. Then repeat with a full swipe past ~35%. Also: switch to another tab, come back, and swipe again immediately.
- **Expected:** While dragging, the current page slides with the finger and a cached STATIC SNAPSHOT of the adjacent tab slides in over it from the swipe edge, so the pages look physically adjacent. The gesture stays smooth — no screen mounts mid-swipe — and the preview appears INSTANTLY on revisit swipes (no label fallback flashing mid-swipe; the label only appears in the first seconds after launch, or right after a data/theme change while the background re-capture runs). After completing or editing a task/hobby, the affected previews refresh within a couple of seconds. The preview is read-only — it can't be tapped or scrolled. Releasing short: the page springs back to place, no tab change. Passing the threshold: the page glides off-screen with an eased animation as the preview expands to cover the screen, then the tab switches seamlessly underneath — no hard cut.

### SWIPE-06 — Swipe unavailable during create/edit **[MANUAL]**
- **Pre-conditions:** On AddTask (creating a task), then on Edit Hobby, then on Edit Category.
- **Steps:** Swipe left/right across most of the screen.
- **Expected:** The tab never switches — the screen only rubber-bands. The gesture must not be able to navigate away while creating or editing.

### SWIPE-07 — Outer-edge swipes are not possible **[MANUAL]**
- **Pre-conditions:** On the Dashboard tab, then on the Insights tab.
- **Steps:** On Dashboard, swipe right (there is no tab before Home). On Insights, swipe left (there is no tab after Insights).
- **Expected:** The page does not move at all — no preview, no motion — and the background stays the themed app background (no white flash).

---

## G2. Android system back (Bug 7 follow-up)

The device back gesture (edge swipe / back button) is intercepted at the app
root: tab lists go back to Dashboard first, and only the Dashboard asks to
leave. Deeper screens keep the default pop so the unsaved-changes guard
still governs them.

### BACK-01 — System back on a tab list returns to Dashboard **[MANUAL]**
- **Pre-conditions:** On Tasks / Categories / Hobbies / Insights (list level).
- **Steps:** Make the system back gesture (edge swipe or back button).
- **Expected:** The Dashboard tab becomes active. The app does not exit.

### BACK-02 — System back on Dashboard asks to leave **[MANUAL]**
- **Pre-conditions:** On the Dashboard tab.
- **Steps:** Make the system back gesture. Then tap *Exit*, and re-open the app from the device's app selector.
- **Expected:** A "Leave the app?" dialog appears. *Exit* closes the app, and re-opening the app afterwards starts clean — no dialog is showing. Cancel (or tapping outside) keeps the app open.

### BACK-03 — Deeper screens keep default back **[MANUAL]**
- **Pre-conditions:** AddTask, EditHobby, EditCategory, or Settings open.
- **Steps:** Make the system back gesture.
- **Expected:** The screen pops as usual (with the unsaved-changes dialog if a form is dirty). The app does not jump to the Dashboard.

---

## H. Theming, persistence, navigation (sanity coverage for every area)

### THEME-01 — Dark/cream toggle persists
- **Steps:** Switch to cream, kill the app, relaunch.
- **Expected:** App opens in cream.

### THEME-02 — Accent picker persists per theme
- **Steps:** In dark, pick `teal`. In cream, pick `brown`. Kill, relaunch. Toggle theme.
- **Expected:** Dark opens with teal accent; cream opens with brown accent.

### PERSIST-01 — Kill + relaunch restores state
- **Steps:** Add 3 tasks, 2 hobbies, mark hobbies for 2 days, switch theme, change accent.
- **Steps:** `adb shell am force-stop` the app, relaunch.
- **Expected:** All of the above are still present.

### PERSIST-02 — Corrupted JSON recovers to defaults **[MANUAL]**
- **Steps:** Write garbage to the `@pt_state` key. Relaunch.
- **Expected:** App opens with default state, no crash.

### NAV-01 — Tab order matches bar order
- **Steps:** Read `App.js` MainTabs.
- **Expected:** Order is `Dashboard, Tasks, Categories, Hobbies, Insights`.

### NAV-02 — Settings opens from header
- **Steps:** On the dashboard, tap the gear icon.
- **Expected:** `Settings` screen opens (the RootStack, not a tab).

### CAT-01 — Add / edit / delete category
- **Steps:** Create a category. Edit its color. Delete it.
- **Expected:** All three flows work; changes persist; no dangling `categoryId`.

### TASK-A01 — Create task with all fields
- **Steps:** Fill title, notes, category, priority, expiry, custom reminder, before-expiry. Save.
- **Expected:** Task appears in the list with all fields populated. No `startDate` field exists on the task.

### TASK-A02 — Edit task preserves id
- **Steps:** Open the task above, change the title, save.
- **Expected:** The id is unchanged.

### TASK-A03 — Delete task cancels notifications
- **Steps:** With the task above pending, delete it. Inspect `getAllScheduledNotificationsAsync`.
- **Expected:** No notifications with `data.taskId === <deleted-id>` remain.

### TASK-A04 — Completing a task cancels its notifications
- **Steps:** Create a pending task with a future `customReminderTime` (and a before-expiry reminder). Complete it. Inspect `getAllScheduledNotificationsAsync`.
- **Expected:** No notifications with `data.taskId === <id>` remain — the custom one-shot, the before-expiry reminder, and the implicit 1-hour warning are all gone at the moment of completion.

### TASK-A05 — Undo restores pending status and future reminders
- **Steps:** Tap `Undo` on the completed task from TASK-A04. Inspect `state.tasks` and `getAllScheduledNotificationsAsync`.
- **Expected:** Task is `pending` again with `completedAt === null`. Every reminder whose fire time is still in the future is re-scheduled (`data.taskId === <id>` present); fire times already in the past are not scheduled.

### TASK-A06 — Completed card actions are Undo + Delete only **[MANUAL]**
- **Steps:** Complete a task and inspect its card actions on the Tasks screen.
- **Expected:** The completed card shows only `Undo` and `Delete` — no `Edit` button. Pending cards still show `Complete`, `Edit`, `Delete`; expired cards keep `Edit`, `Delete`.

### TOAST-01 — Validation errors show a toast, no crash **[MANUAL]**
- **Steps:** On New task, tap `Create task` with an empty title. Repeat on Add/Edit hobby with an empty name and no reminder days, and on Add/Edit category with an empty name.
- **Expected:** Each shows a red error toast and stays on the screen; none of them crash. (Regression gate for the missing `toast.error` method.)

### HOBBY-A01 — Create hobby with reminder
- **Steps:** Add a hobby. Toggle on a daily reminder for `08:00`. Save.
- **Expected:** Hobby appears on the list. `reminderTime === "08:00"`. 7 notifications scheduled (one per weekday).

### HOBBY-A02 — Toggle hobby for past date
- **Steps:** Dispatch `toggleHobbyToday(hobbyId, '2026-08-01')`.
- **Expected:** `completions['2026-08-01']` is `true`.

### HOBBY-A03 — Delete hobby cancels notifications
- **Steps:** Delete the hobby from HOBBY-A01.
- **Expected:** No notifications with `data.hobbyId === <deleted-id>` remain.

### INS-01 — Range filter changes charts
- **Steps:** On Insights, switch between `All time`, `30 days`, `7 days`.
- **Expected:** Bar/line charts visibly change. Range label updates.

---

## I. Card-as-button UX (Bug 9 + hobby reminder)

The Start/Expiry date cards and the two reminder cards (Custom reminder, Before expiry) on `AddTaskScreen`, plus the Daily reminder card on `EditHobbyScreen`, all use the same pattern: tap the header to expand/collapse or toggle; `×` inside the header clears without bubbling. The card body is a plain `<View>` (not a `TouchableOpacity`) so nested touchables work.

### CARD-01 — Date card expands on body tap **[MANUAL]**
- **Pre-conditions:** New task screen, no expiry date set.
- **Steps:** Tap the Expiry card header.
- **Expected:** The inline month-grid calendar + TIME field appear. No "Set expiry" button is visible.

### CARD-02 — `×` clear does not bubble to card tap **[MANUAL]**
- **Pre-conditions:** Expiry date set.
- **Steps:** Tap the `×` in the expiry card header.
- **Expected:** The date clears. The calendar collapses. Subtitle reads "Not set — tap to add".

### CARD-03 — Reminder card toggles on body tap **[MANUAL]**
- **Pre-conditions:** New task, Custom reminder currently off.
- **Steps:** Tap the Custom reminder card header.
- **Expected:** The month-grid calendar + time wheel appear. No slider switch is rendered. The `×` is now present in the header.

### CARD-04 — Reminder card toggles off on body tap **[MANUAL]**
- **Pre-conditions:** Custom reminder is on (from CARD-03).
- **Steps:** Tap the Custom reminder card header again, away from the `×`.
- **Expected:** The calendar + time wheel collapse. The subtitle reads `Tap to enable — one-shot at a specific time`. The `×` disappears.

### CARD-05 — Reminder `×` does not bubble **[MANUAL]**
- **Pre-conditions:** Before expiry reminder on.
- **Steps:** Tap the `×` in the Before expiry card header.
- **Expected:** The reminder turns off. The d/h/m picker collapses. The subtitle reads `Tap to enable — fires before the task expires`.

### CARD-06 — Same for Before expiry when expiry present **[MANUAL]**
- **Pre-conditions:** Expiry date set.
- **Steps:** Tap the Before expiry card header.
- **Expected:** The unit chips + stepper + summary appear. No slider switch is rendered.

### CARD-07 — Hobby reminder toggles on body tap **[MANUAL]**
- **Pre-conditions:** Edit Hobby screen, Daily reminder currently off.
- **Steps:** Tap the Daily reminder card header.
- **Expected:** The time picker + day pills appear. No `Switch` slider is rendered.

### CARD-08 — Hobby reminder toggles off on body tap **[MANUAL]**
- **Pre-conditions:** Daily reminder on.
- **Steps:** Tap the Daily reminder card header again.
- **Expected:** The time picker + day pills collapse. The `×` disappears.

### CARD-09 — Hobby reminder `×` does not bubble **[MANUAL]**
- **Pre-conditions:** Daily reminder on.
- **Steps:** Tap the `×` in the Daily reminder card header.
- **Expected:** The reminder turns off. The body collapses.

---

## K. Unsaved-changes guard (Add/Edit Task, Edit Hobby, Edit Category)

Every mutating screen is backed by `src/hooks/useUnsavedGuard.js`: field changes
mark the screen dirty, and back navigation (header back or hardware back) is
intercepted by `beforeRemove` with a themed `ConfirmDialog`.

### UNSAVED-01 — Back with unsaved edits pops the dialog **[MANUAL]**
- **Steps:** On New task, change the title (or any field), then tap the back arrow. Repeat on Edit Hobby and Edit Category.
- **Expected:** A "Discard changes?" dialog appears with *Keep editing* / *Discard*. The screen does NOT navigate back.

### UNSAVED-02 — Keep editing / Discard behave **[MANUAL]**
- **Steps:** From UNSAVED-01, tap *Keep editing*. Then go back again and tap *Discard*.
- **Expected:** *Keep editing* closes the dialog and stays on the screen with all edits intact. *Discard* navigates back and the changes are lost (reopening shows the original values).

### UNSAVED-03 — Saving does not pop the dialog **[MANUAL]**
- **Steps:** On each of the three screens, make changes and tap Save. Then tap back.
- **Expected:** The save navigates back immediately — no dialog appears (the guard is cleared before `goBack()` in each save handler).

### UNSAVED-04 — Back with no edits navigates immediately **[MANUAL]**
- **Steps:** On New task, tap back WITHOUT touching anything.
- **Expected:** No dialog — back works immediately. (Only real edits arm the guard.)

### UNSAVED-05 — Reverting edits is not dirty **[MANUAL]**
- **Steps:** On Edit task, change the title and priority, then type the title back and set the original priority. Do the same on Edit Hobby (e.g. toggle the reminder off then on again) and Edit Category. Then tap back.
- **Expected:** Back navigates immediately — no dialog. (Regression gate: dirty is a comparison against the initial values, not a change counter.)

---

## J. Inline month-grid calendar (Bug — calendar UX)

Replaces the old pill + Today / +1wk / -1wk picker. Used by both the Expiry card and the Custom reminder card. Mon-first, 7 columns × 6 rows, with prev/next-month chevrons. Disabled cells render greyed-out and are non-interactive.

Covered by: `tests/run-calendar-tests.mjs` (35 PASS), plus the manual smoke below.

### CAL-01..16 — Pure-helper gates (run-calendar-tests.mjs)
See `tests/run-calendar-tests.mjs` for the full assertion list. Every case must report `PASS`.

### CAL-LIVE-01 — Calendar renders a 6×7 grid **[MANUAL]**
- **Pre-conditions:** Expiry set, body expanded.
- **Steps:** Inspect the expiry card body.
- **Expected:** A 6-row × 7-column grid is visible with a `Mon Tue Wed Thu Fri Sat Sun` gutter. Today's cell has a thin accent border. The selected day is filled with `COLORS.accent`.

### CAL-LIVE-02 — Tap a day updates the date **[MANUAL]**
- **Pre-conditions:** State from CAL-LIVE-01.
- **Steps:** Tap a different in-month day.
- **Expected:** The selected cell moves to the tapped day. The card subtitle (`EEE, MMM d, yyyy • h:mm a`) updates to that date.

### CAL-LIVE-03 — Chevrons change month **[MANUAL]**
- **Steps:** Tap the right chevron twice.
- **Expected:** Header text cycles `Aug 2026` → `Sep 2026` → `Oct 2026`. The grid redraws for each new month.

### CAL-LIVE-04 — Past days are disabled **[MANUAL]**
- **Steps:** Navigate back to the current month.
- **Expected:** Days before today (and greyed-out padding cells) are visibly faded and do not respond to taps. Tapping a past day does not change the selection.

### CAL-LIVE-05 — Custom reminder caps at expiry **[MANUAL]**
- **Pre-conditions:** Expiry = Aug 30. Custom reminder toggle on.
- **Steps:** In the custom-reminder calendar, attempt to tap Aug 31.
- **Expected:** Aug 31 is greyed out and non-interactive. Tapping Aug 30 succeeds. The card subtitle reads without the `· after expiry!` warning.

### CAL-LIVE-06 — Expiry has no upper cap **[MANUAL]**
- **Pre-conditions:** Custom reminder on (no expiry).
- **Steps:** Navigate forward 6 months in the custom-reminder calendar.
- **Expected:** Every month renders normally; no days are disabled beyond the past-day rule.

---

## M. startDate removal (this fix)

The "task starts when it is created" simplification. There is no Start date field, no Start card, no "Task starting soon — starts in 30 min" notification, and `task.startDate` is never written or read anywhere.

Covered by: source-level grep + smoke below.

### CR-01 — New task has no startDate
- **Steps:** Grep the codebase for `startDate`. Exclude hobby-history week math (`HobbyDetailScreen.startDate` is an unrelated local variable).
- **Expected:** No matches in `AppContext.js`, `AddTaskScreen.js`, or any task-related module.

### CR-02 — Start date UI is gone **[MANUAL]**
- **Pre-conditions:** New task screen open.
- **Steps:** Inspect the form.
- **Expected:** There is no `START` label, no Start date card. Only TITLE, NOTES, CATEGORY, PRIORITY, EXPIRY, and REMINDERS sections are visible.

### CR-03 — Saved task has no startDate **[MANUAL]**
- **Pre-conditions:** New task created.
- **Steps:** Inspect the resulting object in `state.tasks` (e.g. via dev tools or a temporary log).
- **Expected:** `startDate` is not a property on the saved object. Only `expiryDate`, `customReminderTime`, `beforeExpiryMinutes` exist among the date-related fields.

### CR-04 — No "starts in 30 min" notification **[MANUAL]**
- **Pre-conditions:** A task created with no expiry and no reminders.
- **Steps:** Inspect `getAllScheduledNotificationsAsync()`.
- **Expected:** No notification with title `Task starting soon` is present. (Default 1-hour-before-expiry and custom reminders still fire when configured.)

---

## N. Data backup — export / import (Settings)

Export writes a versioned JSON envelope (`format: productivity-tracker-backup`, `version: 1`) containing tasks, categories, hobbies, streak, lastActiveDate, settings, and the accent-per-theme map. Import validates the envelope, asks before replacing, routes through `LOAD_STATE`, and re-schedules every imported reminder. The import picker accepts any file (`*/*`) — Android providers commonly mislabel `.json` as `application/octet-stream`, which greys files out under a strict MIME filter; content validation (`parseBackup`) is the real gate.

### BAK-01 — Export saves a file **[MANUAL]**
- **Pre-conditions:** At least one task and one hobby exist.
- **Steps:** Settings → Data → Export data. Choose the Downloads folder when the folder picker appears (first export only).
- **Expected:** A toast confirms the save; `productivity-tracker-backup-YYYY-MM-DD-HHmm.json` appears in the chosen folder and contains `"format": "productivity-tracker-backup"`.

### BAK-02 — Second export does not re-ask the folder **[MANUAL]**
- **Steps:** Export again.
- **Expected:** No folder picker — the file is written directly and a toast confirms it.

### BAK-08 — Stale remembered folder self-heals **[MANUAL]**
- **Pre-conditions:** An export has completed before (folder remembered). Delete or rename the chosen folder in the device's file manager.
- **Steps:** Export again.
- **Expected:** The write to the stale folder fails silently, the folder picker appears exactly once more, and after re-choosing Downloads the file is saved with a success toast.

### BAK-03 — Import restores everything **[MANUAL]**
- **Pre-conditions:** Use the file from BAK-01 after changing data (add a task, toggle a hobby).
- **Steps:** Settings → Data → Import backup → pick the file → confirm the dialog.
- **Expected:** Data matches the backup exactly (tasks, hobbies, categories, streak). Accent colors revert to the backed-up choices. A toast reports the restored counts.

### BAK-04 — Import asks before destroying **[MANUAL]**
- **Steps:** Pick a valid backup file.
- **Expected:** A confirm dialog lists the backup's task/hobby/category counts and warns it cannot be undone. Cancel restores nothing.

### BAK-05 — Reminders survive a restore **[MANUAL]**
- **Pre-conditions:** Backup contains a task with a future before-expiry reminder.
- **Steps:** Restore on a fresh install (or after deleting the task). Inspect scheduled notifications.
- **Expected:** The task's reminders are re-scheduled from the imported data; expired/past triggers are not scheduled.

### BAK-06 — Bad files are rejected gracefully **[MANUAL]**
- **Steps:** Import a random `.json` file, then a truncated backup.
- **Expected:** An error toast names the problem — no crash, no data change.

### BAK-07 — Non-backup JSON / newer version rejected **[MANUAL]**
- **Steps:** Hand-edit a backup to `"version": 99` and import.
- **Expected:** Toast says the backup version is newer than the app supports.

---

## Z. Pre-commit gate (run order)

1. Run the automated suites in this order:
   ```
   node tests/run-streak-tests.mjs
   node tests/run-before-expiry-tests.mjs
   node tests/run-calendar-tests.mjs
   node tests/run-year-grid-tests.mjs
   node tests/run-midnight-tests.mjs
   ```
2. Run the manual checks marked **[MANUAL]**.
3. Fill the `TESTS` block in the commit message verbatim using the reporting format. The total automated count must equal `18 + 52 + 35 + 106 + 22 = 233` PASS lines (no FAIL, no PARTIAL).
4. The commit is rejected if any line reads `FAIL`. A `PARTIAL` is allowed only with a written justification.
5. The commit is also rejected if the test count is < the lines listed in the example block — i.e. every test ID in the example must be present in the commit body, even if a single test is `PARTIAL`.