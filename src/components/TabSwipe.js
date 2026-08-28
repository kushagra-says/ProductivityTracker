import React, { useEffect, useRef, useState } from 'react';
import {
  Animated, Easing, Image, InteractionManager, Text, View, useWindowDimensions,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useNavigation } from '@react-navigation/native';
import { captureRef } from 'react-native-view-shot';
import { useTheme } from '../utils/theme';
import { useApp } from '../context/AppContext';

/**
 * Swipe between the five main tabs (Bug 7).
 *
 * `withTabSwipe(Screen, tabName)` wraps one of the five list screens so a
 * horizontal swipe moves to the adjacent tab:
 *
 *   - The current page follows the finger while a STATIC SNAPSHOT of the
 *     adjacent page slides in over it from the swipe edge, so the pages
 *     look physically adjacent. Snapshots are pre-rendered in the
 *     background (hidden rig + react-native-view-shot) into a shared,
 *     app-wide cache that persists across tab switches, so the gesture
 *     itself only animates two values — no screen mounting, no per-frame
 *     JS work, no lag, and (after the first seconds) no label fallback
 *     mid-swipe either. The cache is dropped only when the underlying
 *     data or theme changes. The snapshot is read-only by nature. Past
 *     the threshold the tab actually switches (standard tab animation);
 *     otherwise the page springs back. At the outer edges (before Home,
 *     after Insights) the swipe is not possible at all — the page doesn't
 *     move.
 *   - The gesture only claims the touch after ACTIVATE_X px of horizontal
 *     travel; FAIL_Y px of vertical travel hands it back. Vertical list
 *     scrolling therefore always wins — a small horizontal jitter while
 *     scrolling vertically never claims (let alone switches) the tab.
 *   - Only the five list screens get the wrapper — stack screens
 *     (AddTask, HobbyDetail, EditCategory, …) keep their in-stack
 *     gestures untouched. `stackGuard` additionally refuses to navigate
 *     whenever the wrapped screen's own stack holds a pushed screen
 *     (e.g. AddTask is open in the Tasks tab); those swipes rubber-band.
 */
export const TAB_ORDER = ['Dashboard', 'Tasks', 'Categories', 'Hobbies', 'Insights'];

const ACTIVATE_X = 24;    // horizontal travel needed to claim the gesture
const FAIL_Y = 14;        // vertical travel that hands the gesture back to scroll views
const SWIPE_RATIO = 0.35; // fraction of screen width that counts as a deliberate swipe

/**
 * Registry of the REAL screen component for each tab, populated once at
 * module scope in App.js. Because bottom-tabs unmounts inactive tabs, the
 * adjacent tab's screen is mounted here — in a hidden rig behind the
 * current page, briefly, right after focus — purely to be screenshotted
 * into the static snapshot cache. The registered component is the PLAIN
 * screen (no wrapper, no nested navigator), so the rig never fires
 * navigation focus events of its own. If a tab has no registered screen,
 * swipes onto it fall back to a plain label preview.
 */
const PEEK_SCREENS = {};
export function registerPeekScreen(tabName, Component) {
  PEEK_SCREENS[tabName] = Component;
}

// ─── Snapshot cache (module-level, shared by all five wrapped screens) ──────
// One cache for the whole app: a snapshot of a tab captured from any
// neighbor is equally valid, so the cache outlives tab switches — after
// the first ~3 s the whole set is warm and EVERY swipe shows its page
// instantly, no capture mid-gesture. The cache is only dropped when the
// underlying data actually changes (app state / theme), never on focus.
const SNAPSHOT_CACHE = {}; // tabName -> file:// uri
const CACHE_LISTENERS = new Set();

function cacheSnapshot(tabName, uri) {
  SNAPSHOT_CACHE[tabName] = uri;
  CACHE_LISTENERS.forEach((fn) => fn());
}

function invalidateSnapshots() {
  for (const k of Object.keys(SNAPSHOT_CACHE)) delete SNAPSHOT_CACHE[k];
  FAILED_TABS.clear();
  CACHE_LISTENERS.forEach((fn) => fn());
}

// Single GLOBAL capture pipeline. Every wrapped screen used to run its own
// rig + queue, so one data change re-rendered and screenshotted the same
// tabs once per mounted wrapper (~20 mounts for one toggle) — and quick
// successive actions kept re-triggering the burst, which is exactly the
// laggy-quick-actions symptom. Now one pump owns all captures:
//   - captureHostTab — the last-focused wrapper; only it mounts a rig.
//   - capturingTab   — global mutex; at most ONE hidden screen mounted.
//   - pumpCaptures() — debounced (400 ms) and deferred until ongoing
//     user interactions finish (InteractionManager), so captures never
//     compete with taps/toggles for the JS thread.
let captureHostTab = null;
let capturingTab = null;
let pumpTimer = null;
const CAPTURE_WATCHERS = new Set();
// Tabs whose screenshot failed (e.g. detached off-screen views on some
// devices). Skipped until the next invalidation so a persistent capture
// failure can't turn into an endless mount/screenshot retry loop.
const FAILED_TABS = new Set();

function notifyCaptureChanged() {
  CAPTURE_WATCHERS.forEach((fn) => fn());
}

function pumpCaptures() {
  clearTimeout(pumpTimer);
  pumpTimer = setTimeout(() => {
    InteractionManager.runAfterInteractions(() => {
      if (capturingTab || !captureHostTab) return;
      const next = TAB_ORDER.find(
        (n) =>
          n !== captureHostTab &&
          PEEK_SCREENS[n] &&
          !SNAPSHOT_CACHE[n] &&
          !FAILED_TABS.has(n),
      );
      if (!next) return;
      capturingTab = next;
      notifyCaptureChanged();
    });
  }, 400);
}

export function withTabSwipe(ScreenComponent, tabName, { stackGuard = false } = {}) {
  function SwipeableScreen(props) {
    const navigation = useNavigation();
    const { COLORS } = useTheme();
    const { width, height } = useWindowDimensions();
    const idx = TAB_ORDER.indexOf(tabName);

    const translateX = useRef(new Animated.Value(0)).current;
    const peekWidth = useRef(new Animated.Value(0)).current;
    const [peek, setPeek] = useState(null); // { name, side: 'left'|'right' }

    // Local mirror of the shared snapshot cache; kept in sync by listener
    // so a capture from any tab's rig updates every wrapped screen.
    // Seeded from the cache — a lazily-mounted tab may mount after other
    // tabs have already filled it.
    const [snapshots, setSnapshots] = useState(() => ({ ...SNAPSHOT_CACHE }));
    const [captureName, setCaptureName] = useState(null); // tab being captured
    const rigRef = useRef(null);
    // True while the completion animation plays the tab switch — gesture
    // updates are ignored so a stray finger can't fight the animation.
    const settlingRef = useRef(false);

    const { state: appState } = useApp();
    const { mode } = useTheme();

    const stackIsDeeper = () => {
      if (!stackGuard) return false;
      const st = navigation.getState?.();
      return !!st && st.routes.length > 1;
    };

    // Follow the shared cache — but only while this tab is the focused
    // host. Inactive wrappers skip the re-render and re-seed on focus.
    useEffect(() => {
      const listener = () => {
        if (captureHostTab === tabName) setSnapshots({ ...SNAPSHOT_CACHE });
      };
      CACHE_LISTENERS.add(listener);
      return () => CACHE_LISTENERS.delete(listener);
    }, [tabName]);

    // On focus this wrapper becomes the sole capture host and refreshes
    // its mirror (captures may have run while it was inactive).
    useEffect(() => {
      const onFocus = () => {
        captureHostTab = tabName;
        setSnapshots({ ...SNAPSHOT_CACHE });
        pumpCaptures();
      };
      captureHostTab = tabName;
      pumpCaptures();
      const unsub = navigation.addListener('focus', onFocus);
      return unsub;
    }, [navigation, tabName]);

    // The single rig of the whole app lives in the focused wrapper. The
    // module pump names the tab; this effect hosts it.
    useEffect(() => {
      const sync = () => {
        setCaptureName(capturingTab && capturingTab !== tabName ? capturingTab : null);
      };
      CAPTURE_WATCHERS.add(sync);
      sync();
      return () => CAPTURE_WATCHERS.delete(sync);
    }, [tabName]);

    // Data or theme changed → drop the cache and re-capture. The mount run
    // is skipped: a lazily-mounted tab must not wipe the warm cache built
    // by previously visited tabs.
    const firstStateRunRef = useRef(true);
    useEffect(() => {
      if (firstStateRunRef.current) { firstStateRunRef.current = false; return; }
      invalidateSnapshots();
      pumpCaptures();
    }, [appState, mode]);

    // When the rig mounts for a tab, let it render, then screenshot it and
    // hand the global mutex back so the pump can continue.
    useEffect(() => {
      if (!captureName) return undefined;
      let alive = true;
      const t = setTimeout(async () => {
        try {
          const uri = await captureRef(rigRef, { format: 'jpg', quality: 0.85, result: 'tmpfile' });
          if (alive) cacheSnapshot(captureName, uri);
        } catch {
          // Screenshot failed — give up on this tab until the next data
          // change rather than retry-looping; swipes onto it will use the
          // label fallback.
          FAILED_TABS.add(captureName);
        }
        if (!alive) {
          // Unmounted mid-capture: release the mutex or the pipeline deadlocks.
          if (capturingTab === captureName) { capturingTab = null; notifyCaptureChanged(); }
          return;
        }
        capturingTab = null;
        notifyCaptureChanged();
        pumpCaptures();
      }, 400);
      return () => {
        alive = false;
        clearTimeout(t);
        if (capturingTab === captureName) { capturingTab = null; notifyCaptureChanged(); }
      };
    }, [captureName]);

    const pan = Gesture.Pan()
      .activeOffsetX([-ACTIVATE_X, ACTIVATE_X])
      .failOffsetY([-FAIL_Y, FAIL_Y])
      .onUpdate((e) => {
        if (settlingRef.current) return;
        const dx = e.translationX;
        const targetIdx = dx < 0 ? idx + 1 : idx - 1;
        // Outer edges: there IS no adjacent page, so the swipe is simply
        // not possible — no movement, no preview. Stack-guarded screens
        // (create/edit open) rubber-band instead of moving.
        const atEdge = targetIdx < 0 || targetIdx >= TAB_ORDER.length;
        const blocked = atEdge || stackIsDeeper();
        if (atEdge) {
          translateX.setValue(0);
          peekWidth.setValue(0);
          setPeek(null);
          return;
        }
        translateX.setValue(blocked ? dx * 0.15 : dx);
        peekWidth.setValue(blocked ? 0 : Math.min(Math.abs(dx), width));
        const name = blocked ? null : TAB_ORDER[targetIdx];
        setPeek((prev) =>
          prev?.name === name && prev?.side === (dx < 0 ? 'right' : 'left')
            ? prev
            : { name, side: dx < 0 ? 'right' : 'left' },
        );
      })
      .onEnd((e) => {
        if (settlingRef.current) return;
        const dx = e.translationX;
        const targetIdx = dx < 0 ? idx + 1 : idx - 1;
        const passes =
          Math.abs(dx) >= width * SWIPE_RATIO &&
          !stackIsDeeper() &&
          targetIdx >= 0 &&
          targetIdx < TAB_ORDER.length;

        if (passes) {
          // Complete the swipe visually BEFORE switching: the page glides
          // fully off-screen while the snapshot panel expands to cover the
          // viewport, then the (instant) navigator swap happens underneath
          // the covering panel — the transition reads as one continuous
          // motion, never a hard cut. Duration scales with the remaining
          // distance so a barely-passing swipe and a full fling finish at
          // a similar pace.
          settlingRef.current = true;
          const remaining = Math.max(width - Math.abs(dx), 1);
          const duration = Math.round(80 + 140 * (remaining / width));
          const exitX = dx < 0 ? -width : width;
          Animated.parallel([
            Animated.timing(translateX, {
              toValue: exitX,
              duration,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.timing(peekWidth, {
              toValue: width,
              duration,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: false,
            }),
          ]).start(() => {
            navigation.navigate(TAB_ORDER[targetIdx]);
            // Restore the rest state for the next gesture. At this moment
            // the panel covers the whole screen, so the reset is invisible;
            // the fresh tab is already what the user sees.
            translateX.setValue(0);
            peekWidth.setValue(0);
            setPeek(null);
            settlingRef.current = false;
          });
        } else {
          setPeek(null);
          settlingRef.current = true;
          Animated.parallel([
            Animated.timing(translateX, { toValue: 0, duration: 160, useNativeDriver: true }),
            Animated.timing(peekWidth, { toValue: 0, duration: 160, useNativeDriver: false }),
          ]).start(() => {
            settlingRef.current = false;
          });
        }
      });

    return (
      <GestureDetector gesture={pan}>
        <View style={[styles.host, { backgroundColor: COLORS.bg }]}>
          <Animated.View style={[styles.page, { transform: [{ translateX }] }]}>
            <ScreenComponent {...props} />
          </Animated.View>
          {/* The adjacent page's STATIC SNAPSHOT, revealed in a panel that
              slides in from the swipe edge. The image is full-screen-width
              and pinned to the panel's outer edge, so the boundary shows
              the incoming page's leading portion — exactly as if the two
              pages sat side by side. A cached bitmap is all the gesture
              ever touches, so there is zero per-frame JS work. Until the
              snapshot is ready (first seconds after launch) the panel
              shows a plain label fallback. Non-interactive either way. */}
          {peek?.name && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.peek,
                peek.side === 'right' ? styles.peekRight : styles.peekLeft,
                {
                  width: peekWidth,
                  backgroundColor: COLORS.bg,
                  borderColor: COLORS.border,
                },
                peek.side === 'right'
                  ? { borderLeftWidth: 2, borderLeftColor: COLORS.accent + '66' }
                  : { borderRightWidth: 2, borderRightColor: COLORS.accent + '66' },
              ]}
            >
              {snapshots[peek.name] ? (
                <Image
                  source={{ uri: snapshots[peek.name] }}
                  style={[
                    styles.peekContent,
                    { width, height },
                    peek.side === 'right' ? styles.peekContentAtLeft : styles.peekContentAtRight,
                  ]}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.peekFallback}>
                  <Text style={[styles.peekText, { color: COLORS.textMuted }]}>
                    {peek.name}
                  </Text>
                </View>
              )}
            </Animated.View>
          )}
          {/* Hidden capture rig: an uncached tab's real screen, mounted
              behind the current page for ~400 ms apiece in the background,
              long enough to screenshot into the shared cache. `collapsable`
              keeps Android from optimizing the off-screen view away. */}
          {captureName && PEEK_SCREENS[captureName] && (
            <View
              ref={rigRef}
              collapsable={false}
              pointerEvents="none"
              style={[styles.captureRig, { width, height }]}
            >
              {React.createElement(PEEK_SCREENS[captureName])}
            </View>
          )}
        </View>
      </GestureDetector>
    );
  }
  SwipeableScreen.displayName = `withTabSwipe(${ScreenComponent.displayName || ScreenComponent.name || 'Screen'})`;
  return SwipeableScreen;
}

const styles = {
  // A themed background (not transparent) — if the page ever moves, the
  // area revealed behind it shows the app background, never a white void.
  host: { flex: 1, overflow: 'hidden' },
  page: { flex: 1, zIndex: 1 },
  peek: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    overflow: 'hidden',
    zIndex: 2,
  },
  // Full-screen-width container holding the previewed screen, anchored to
  // the panel's outer edge so the boundary reveals the incoming page's
  // leading portion. A right-side panel meets the page on its LEFT edge
  // (content anchored left); a left-side panel on its RIGHT edge.
  peekContent: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    flex: 1,
  },
  peekText: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 2,
    textAlign: 'center',
  },
  peekFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The rig sits at full screen size directly BEHIND the page (zIndex 0
  // under the page's 1), so it is laid out and renderable for the
  // screenshot but completely covered by the current page.
  captureRig: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 0,
  },
};

styles.peekRight = { ...styles.peek, right: 0 };
styles.peekLeft = { ...styles.peek, left: 0 };
styles.peekContentAtLeft = { left: 0 };
styles.peekContentAtRight = { right: 0 };