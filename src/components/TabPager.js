import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import PagerView from 'react-native-pager-view';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../utils/theme';
import { TabNavProvider } from '../tabNav';

// The pager shell (see planswipe.md): all 5 main pages sit side by side in
// a native pager; the device screen is a viewport aligned to one of them.
// Swiping slides the strip natively — nothing mounts/unmounts on a tab
// switch, so the flash/lag class of bugs the old screenshot-preview rig
// fought cannot occur here.
//
// Windowing: a page's content mounts the first time the scroll offset comes
// within a page of it, and never unmounts afterwards — state (including
// stack depth) is preserved for every visited tab; never-visited pages cost
// nothing until first approach.

export const TAB_ICONS = {
  Dashboard:  { active: 'grid',              inactive: 'grid-outline' },
  Tasks:      { active: 'checkmark-circle',  inactive: 'checkmark-circle-outline' },
  Categories: { active: 'folder',            inactive: 'folder-outline' },
  Hobbies:    { active: 'leaf',              inactive: 'leaf-outline' },
  Insights:   { active: 'stats-chart',       inactive: 'stats-chart-outline' },
};

// Internal seam for the stack pages App renders inside pager slots: they
// report their stack depth here and register their `navigate` fn so
// jump-and-push works from any page.
const PagerInternals = createContext(null);

export function usePagerInternals() {
  return useContext(PagerInternals);
}

/**
 * Mount inside a stack page's FIRST screen (render-prop on Stack.Screen).
 * Registers that stack's navigate fn for navigateInTab, consumes a queued
 * push if one arrived before registration, and nulls the entry on unmount.
 */
export function PagerBridge({ tabName, navigation }) {
  const { registryRef } = usePagerInternals();

  useEffect(() => {
    const reg = registryRef.current;
    reg[tabName] = { navigate: (screen, params) => navigation.navigate?.(screen, params) };
    const pending = reg.pending?.[tabName];
    if (pending) {
      delete reg.pending[tabName];
      navigation.navigate(pending.screen, pending.params);
    }
    return () => { delete registryRef.current[tabName]; };
  }, [tabName, navigation, registryRef]);

  return null;
}

/**
 * props:
 *   navRef       — NavigationContainer ref (openSettings targets the root stack)
 *   tabStateRef  — { index, depths } shared with App's back handler
 *   pagerRef     — pager handle, shared with App's back handler (jump to Dashboard)
 *   pages        — [{ name, element }] in TAB order
 */
export default function TabPager({ navRef, tabStateRef, pagerRef, pages }) {
  const { COLORS } = useTheme();
  const insets = useSafeAreaInsets();

  // Stack navigators register here via PagerBridge; pending pushes queue
  // here until their page mounts (jump-and-push from a never-visited tab).
  const registryRef = useRef({});
  // Mirrors `focus` for callbacks that must not re-bind every focus change.
  const focusRef = useRef(0);

  const [focus, setFocus] = useState(0);
  // Bumped when the FOCUSED tab's stack depth changes, so the
  // pager-enabled prop recomputes (depths themselves live in the ref).
  const [depthTick, setDepthTick] = useState(0);

  // Windowing (planswipe.md §3.3): visited pages stay mounted forever.
  // Seeded with page 0 and its neighbor so the very first swipe has content
  // to slide in.
  const [visited, setVisited] = useState(() => new Set([0, 1]));
  const pageCount = pages.length;
  const markAround = useCallback((pos) => {
    const center = Math.round(pos);
    setVisited((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (let j = center - 1; j <= center + 1; j++) {
        if (j >= 0 && j < pageCount && !next.has(j)) { next.add(j); changed = true; }
      }
      return changed ? next : prev;
    });
  }, [pageCount]);

  const onDepth = useCallback((name, depth) => {
    tabStateRef.current.depths[name] = depth;
    if (name === pages[focusRef.current]?.name) setDepthTick((t) => t + 1);
  }, [tabStateRef, pages]);

  const onPageSelected = useCallback((e) => {
    const i = e.nativeEvent.position;
    focusRef.current = i;
    tabStateRef.current.index = i;
    setFocus(i);
    markAround(i);
  }, [tabStateRef, markAround]);

  // Swiping out of a pushed screen (AddTask, EditHobby, …) is disabled —
  // you'd otherwise slide to a different tab while a detail screen covers
  // this one. Depth returns to 1 on pop and re-enables. depthTick only
  // exists to re-run this when the focused tab's stack depth changes.
  const focusedDepth = useMemo(
    () => tabStateRef.current.depths[pages[focus].name] ?? 1,
    [tabStateRef, pages, focus, depthTick],
  );
  const pagerEnabled = focusedDepth <= 1;

  const tabNav = { navRef, tabStateRef, registryRef, pagerRef };

  return (
    <TabNavProvider {...tabNav}>
      <PagerInternals.Provider value={{ registryRef, onDepth }}>
        <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
          <PagerView
            ref={pagerRef}
            style={{ flex: 1 }}
            initialPage={0}
            enabled={pagerEnabled}
            onPageSelected={onPageSelected}
            onPageScroll={(e) => markAround(e.nativeEvent.position)}
          >
            {pages.map((page, i) => (
              <View
                key={page.name}
                // Themed fill behind page content: until a lazily-mounted
                // page paints, this shows instead of a white frame
                // (Bug 23-equivalent; no react-native-screens at tab level).
                style={{ flex: 1, backgroundColor: COLORS.bg }}
                collapsable={false}
              >
                {/* Windowing: mounted on first approach, never unmounted. */}
                {visited.has(i) && page.element}
              </View>
            ))}
          </PagerView>

          <TabBar
            pages={pages}
            focus={focus}
            insetsBottom={insets.bottom}
            COLORS={COLORS}
            onPress={(i) => pagerRef.current?.setPage(i)}
          />
        </View>
      </PagerInternals.Provider>
    </TabNavProvider>
  );
}

// Ported from the former Tab.Navigator screenOptions (App.js pre-pager):
// same surface/border/height, same icons, same tints. Bottom inset is added
// by hand here — bottom-tabs used to fold it into its own safe-area padding.
function TabBar({ pages, focus, insetsBottom, COLORS, onPress }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: COLORS.surface,
        borderTopColor: COLORS.border,
        borderTopWidth: 1,
        paddingBottom: 8 + insetsBottom,
        paddingTop: 6,
        height: 66 + insetsBottom,
      }}
    >
      {pages.map((tab, index) => {
        const active = index === focus;
        const set = TAB_ICONS[tab.name] || { active: 'ellipse', inactive: 'ellipse-outline' };
        return (
          <TouchableOpacity
            key={tab.name}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
            onPress={() => onPress(index)}
          >
            <Ionicons
              name={active ? set.active : set.inactive}
              size={22}
              color={active ? COLORS.accent : COLORS.textMuted}
            />
            <Text
              style={{
                fontSize: 11,
                fontWeight: '600',
                letterSpacing: 0.4,
                color: active ? COLORS.accent : COLORS.textMuted,
              }}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}