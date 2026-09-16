# Plan: Swipe — Pager-Based Tab Navigation (Rebuild)

> Status: planned, not started.
> Goal: replace the bottom-tab navigator with a pager-based layout where all 5 main
> pages are laid out side by side and the screen is a *viewport* aligned to one page.
> Swiping slides the strip natively; tapping the tab bar animates the same alignment.

---

## 1. The mental model — what exactly is supposed to happen

The current page being shown is not "the screen" — it is **the page the viewport is
currently aligned to**. All 5 main pages exist simultaneously, physically adjacent,
left-to-right in this order:

```
[ Dashboard | Tasks | Categories | Hobbies | Insights ]
            ^ viewport (device screen width)
```

**During a swipe (gesture level):**
1. Finger touches any page and drags horizontally.
2. The pager claims the gesture (native code, no JS per frame). Both the current
   page and the neighbor move **1:1 with the finger** — the neighbor's content
   slides in from the edge, already fully rendered.
3. On release:
   - past ~half width, or a fast flick → the pager animates the remaining distance
     and **settles aligned to the neighbor page**. The tab bar highlight updates.
   - otherwise → the pager springs back to the current page.
4. Nothing mounts, unmounts, or re-renders at the tab level during any of this.
   The only thing that changes is a float: the pager's scroll offset.

**Non-gesture navigation (tab bar tap, Dashboard shortcuts):** same alignment
animation, driven by `setPage(i)` instead of the finger.

**Why this eliminates the old failure mode:** every previous attempt (including the
432-line `TabSwipe.js` screenshot-preview rig from commit `e8ba0d7`) tried to
animate *between* `react-native-screens`–managed tab screens. Those screens mount
and unmount on switch — there is nothing physically adjacent to slide, hence the
choreography, hence the flash/lag. Here the flash class of bugs (Bug 23) cannot
occur at tab level because pages are always painted.

---

## 2. Current architecture (what exists today)

- `App.js`
  - `MainTabs` (`App.js:70-112`) — `createBottomTabNavigator` with 5 tabs:
    Dashboard, Tasks (own stack), Categories (own stack), Hobbies (own stack), Insights.
  - `TAB_ICONS` (`App.js:62-68`) — icon mapping for the tab bar.
  - Root stack (`App.js:114,150-153`) — `Main` (tabs) and `Settings` pushed on top.
  - Android back handler (`App.js:172-196`) — reads tab navigator state:
    Settings pop → inner-stack pop (guarded) → jump to Dashboard → exit dialog.
- Per-tab stacks (`App.js:34-60`): `TaskStack`, `CategoryStack`, `HobbiesStack`.
- Screen-level navigation calls:
  - `DashboardScreen.js:289` — `navigation.getParent()?.navigate('Settings')`
  - `DashboardScreen.js:307,320` — `navigate('Hobbies')`
  - `DashboardScreen.js:337` — `navigate('Tasks')`
  - `DashboardScreen.js:350` — `navigate('Tasks', { screen: 'AddTask' })`
  - `DashboardScreen.js:406` — `navigate('Categories')`
  - All other screens navigate only within their own stack (`goBack` / push) — **untouched**.
- Horizontal-scrolling components inside pages (gesture-conflict test points):
  - `DashboardScreen.js:373` — horizontal list
  - `TasksScreen.js:275` — horizontal chips/list
  - `HobbyDetailScreen.js:127` — horizontal month strip (inside Hobbies stack)

**Constraint this design honours:** the 10 screens keep their internal navigation
(react-navigation stacks stay; `react-native-screens` keeps handling pushed
screens). Only the tab-level shell is rebuilt.

---

## 3. Target architecture

```
RootStack (unchanged)
 ├─ Main
 │   └─ TabPager  ← NEW (replaces Tab.Navigator)
 │       ├─ page 0: DashboardScreen
 │       ├─ page 1: TaskStack        (stack navigator, unchanged)
 │       ├─ page 2: CategoryStack    (stack navigator, unchanged)
 │       ├─ page 3: HobbiesStack     (stack navigator, unchanged)
 │       └─ page 4: InsightsScreen
 │       + custom bottom tab bar (reuses TAB_ICONS + current styling)
 ├─ Settings (pushed on root stack, unchanged)
```

Implementation vehicle: **`react-native-pager-view`** (Expo-supported; native
ViewPager2 on Android). It provides the exact UX spec: 1:1 finger tracking,
snap/overshoot physics, settle callbacks — all native, zero per-frame JS.

### New module: `src/components/TabPager.js`

Single component owning:

1. **The pager** — `PagerView` with 5 pages, `offscreenPageLimit` sized so a
   neighbor exists to slide in; each page a `View` with
   `flex: 1, backgroundColor: COLORS.bg` (Bug 23-equivalent fill; no
   react-native-screens involved at tab level, so nothing to flash).
2. **The bottom tab bar** — extracted from the current `Tab.Navigator`
   `screenOptions` block (`App.js:74-103`): same surface/border/height styling,
   same `TAB_ICONS`, same active/inactive tints. Tap → `pagerRef.setPage(i)`
   (animated). Highlight driven by `onPageSelected` so it flips on settle,
   not on lift.
3. **Windowing mount strategy** — pages mount lazily but *never unmount*:
   - a page's content renders when it has been "touched" (initial page 0 +
     any page within `offscreenPageLimit` of the focused page);
   - once mounted, it stays mounted → **per-tab state is preserved forever**,
     including stack depth inside each tab (better than today: bottom-tabs
     re-mounts lazily-visited tabs from scratch; the pager never does).
   - never-visited pages cost nothing until first approach — comparable memory
     to today's `lazy` default.
4. **Stack-depth tracking** — a small module-level registry
   (`tabNavRegistry.js`, or colocated in TabPager): each stack page registers
   a `onDepthChange(depth)` callback (wired via its navigator's
   `onStateChange` / a small listener component inside the stack).
   Used for (a) disabling swipe and (b) the back handler.
5. **Navigation context** — `TabNavContext` provided by TabPager:
   - `jumpTo(name)` — animate pager to the named page
   - `navigateInTab(name, screen, params)` — animate to the named page, then
     push `screen` inside that page's registered stack
   - `openSettings()` — push on the root stack (unchanged semantics)
   - `stateRef` — a ref App's back handler reads:
     `{ index, stackDepth }` for the currently focused page.

### Changed functions, file by file

| File | Change | Notes |
|---|---|---|
| `App.js` `MainTabs` (`App.js:70-112`) | **Replaced** by `MainPager` hosting `TabPager` | pages receive the existing components/stacks unchanged |
| `App.js` `TAB_ICONS` (`App.js:62-68`) | **Moved** into TabPager | content identical |
| `App.js` back handler (`App.js:172-196`) | **Rewritten** (logic below) | reads `navRef` (root stack) + TabPager's `stateRef` |
| `App.js` imports | drop `createBottomTabNavigator` | `createStackNavigator`, `react-native-screens` **stay** |
| `DashboardScreen.js` (7 call sites, `:289-406`) | `navigation.navigate(...)` → `useTabNav()` context calls | only the `onPress` bodies change |
| `src/components/TabPager.js` | **New** (~180-220 lines incl. tab bar) | see above |
| 10 screens (except Dashboard's onPress bodies) | **Unchanged** | |

### New back-handler logic (replaces `App.js:172-196`)

```
on hardwareBackPress:
1. root stack depth > 1  (Settings open)      → return false  (default pop)
2. focused page stack depth > 1 (AddTask, EditHobby, …) → return false
   (default pop; useUnsavedGuard still handles the discard warning)
3. focused pager index != 0                   → jumpTo(Dashboard); return true
4. else                                       → exit confirm dialog; return true
```

Same user-visible behaviour as today, sourced from different state.

### Swipe-enable rule

`PagerView` gets `enabled={focusedStackDepth <= 1}` — no swiping out of a pushed
screen (AddTask, HobbyDetail, …) into a different tab. Depth flips back to 1 on
pop, re-enabling the pager. This also prevents the "swipe while a pushed screen
covers the page" ambiguity entirely.

---

## 4. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Horizontal scroll inside pages vs. horizontal pager (Dashboard `:373`, Tasks `:275`, HobbyDetail `:127`) | Native pager yields to an inner horizontal scroll once it claims the gesture (standard `requestDisallowInterceptTouchEvent` behaviour). **First on-device test item.** Fallback if flaky: `nestedScrollEnabled`, or a gesture-config tweak on that component. |
| All-5-pages memory/render cost (Insights has SVG charts) | Windowing (§3.3): content mounts on first approach only; visited pages stay mounted. |
| Cross-tab "jump + push" (Dashboard → AddTask) ordering | `navigateInTab` awaits nothing special: `setPage(i, animated)` and the stack push run in the same frame; the push animation plays inside the page after it settles. Verify visually. |
| Bug 23-class flashes reappearing | Cannot at tab level (no mount/unmount). Root-stack Settings still uses react-navigation — keep the themed `navTheme` + root `View` fill exactly as-is (`App.js:119-154`). |
| Expo dependency | `npx expo install react-native-pager-view` — officially supported in the SDK; no config-plugin change needed. **Fallback:** if pager-view misbehaves, a plain horizontal `ScrollView` with `pagingEnabled` is a dependency-free (slightly less native-feeling) substitute — the rest of this plan is unchanged. |

---

## 5. Implementation — step-by-step TODO

### Phase 0 — Baseline
- [ ] Run the app (`npx expo start --android`), note current tab-switch behaviour,
      Settings push/pop, back flow, exit dialog — this is the regression baseline.
- [ ] Record current APK state (no code changes; per project rule, **no commits**
      until the user commits).

### Phase 1 — Dependency ✅
- [x] `npx expo install react-native-pager-view` → `react-native-pager-view@8.0.2`
- [x] Resolves in the Expo SDK 57 compatibility table (installed by expo install, no patching).

### Phase 2 — Registry + context ✅
- [x] `TabNavContext` with `jumpTo`, `navigateInTab`, `openSettings` — in `src/tabNav.js`.
- [x] Stack registry with pending-push queue (a queued push is consumed by the
      bridge when a never-visited tab's stack mounts) — `PagerBridge` in `TabPager.js`.
      Note: the registry lives inside TabPager; only `tabStateRef`/`pagerRef` are
      owned by App (the back handler reads them synchronously).
- [x] `StackRegistrar` idea became `PagerBridge` (mount inside a stack page's first
      screen via a render-prop on `Stack.Screen`) + `onStateChange` on each navigator.

### Phase 3 — TabPager component ✅
- [x] `src/components/TabPager.js`: bottom tab bar (ported styling, icons, tints,
      bottom inset added by hand), PagerView with themed page containers.
- [x] Windowing: `visited` set seeded {0, 1}; pages mount on first approach
      (`onPageScroll` position ± 1), never unmount.
- [x] `onPageSelected` → tab bar highlight (flips on settle) + `tabStateRef.index`.
- [x] Stack depth → `tabStateRef.depths` → `PagerView enabled` (via `depthTick` state).
- [x] Tab-bar taps → `pagerRef.setPage(i)` (animated).
- [x] `TabNavContext` provided; `usePagerInternals` exposes the registry + `onDepth`.

### Phase 4 — Rewire App.js ✅
- [x] `MainTabs` removed; `PAGES` array feeds `TabPager` under the root `Main` route.
- [x] Stacks keep `react-native-screens`; `navTheme` + themed root `View` fill intact.
- [x] Back handler rewritten (4-step logic; jump to Dashboard via `pagerRef.setPage(0)`).
- [x] `createBottomTabNavigator` import removed.
- [x] Sanity bundle: `npx expo export --platform android` compiles clean; 233/233 Node tests pass.

### Phase 5 — Rewire DashboardScreen ✅
- [x] `:289` → `tabNav.openSettings()`
- [x] `:307, :320` → `tabNav.jumpTo('Hobbies')`
- [x] `:337` → `tabNav.jumpTo('Tasks')`
- [x] `:350` → `tabNav.navigateInTab('Tasks', 'AddTask')`
- [x] `:406` → `tabNav.jumpTo('Categories')`
- [x] `useNavigation` import dropped (grep confirms zero remaining `navigation.` refs).
- [x] Bundle re-verified after all edits.

### Phase 6 — On-device verification checklist (NOT DONE — needs a device)
- [x] **Runtime fix (found on first device run)**: *"Another navigator is already
      registered for this container."* — react-navigation allows ONE navigator per
      parent Screen/scene (`EnsureSingleNavigator`); the pager hosted three stacks
      under the single root `Main` scene. Fix: each stack page now hosts its own
      `<NavigationContainer>` wrapped in `<NavigationIndependentTree>` (from
      `@react-navigation/core`), which brings its own per-container registry.
      Consequences analysed in the `App.js` comment block: state per-container
      (preserved — pages never unmount); Android back stays correct because a
      stack with depth > 1 is always the focused page (the pager is disabled
      otherwise), so backgrounded containers' back handlers are no-ops that fall
      through; no linking in the mini containers.
- [ ] Swipe each adjacent pair both directions: 1:1 finger tracking, snap or
      spring-back, no flash, no white frame, no ghost preview.
- [ ] Tab-bar taps: animated alignment, highlight flips on settle.
- [ ] Dashboard horizontal list (`:373`) still scrolls; pager does NOT steal it.
- [ ] TasksScreen horizontal chips (`:275`): same.
- [ ] Hobbies → HobbyDetail horizontal month strip (`:127`): same.
- [ ] Vertical scrolling inside every page still fluid while pager is present.
- [ ] Push flows: AddTask / HobbyDetail / EditHobby / EditCategory open inside
      their page; pager disabled while pushed; swipe re-enables after pop.
- [ ] Unsaved-changes guard still fires on back from edit screens.
- [ ] Settings push/pop: no white flash (root-stack theming intact).
- [ ] Android back: Settings → pops; pushed stack screen → pops (guarded);
      any tab list → Dashboard; Dashboard → exit dialog; fresh foreground clears it.
- [ ] Cold start lands on Dashboard; state survives tab round-trips
      (scroll position, stack depth, per-tab data).
- [ ] Memory check on device: navigate all 5 tabs, background/foreground, no OOM/jank.

### Phase 7 — Cleanup (partial — finish after on-device verification)
- [x] Dead code removed: tab navigator import dropped; `TAB_ICONS`/tab styling moved
      into TabPager; `@react-navigation/bottom-tabs` now unused (still in
      package.json — remove it if desired).
- [ ] Update `BUGS.md` / `tests.md` notes about the removed bottom-tab navigator
      (suggested: after Phase 6 passes, so the notes reflect verified behaviour).
- [x] Leave all changes **uncommitted** — the user commits.