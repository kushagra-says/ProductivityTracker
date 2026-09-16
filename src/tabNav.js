import React, { createContext, useContext, useMemo } from 'react';

// Tab-level navigation plumbing for the pager shell (see planswipe.md).
//
// The pager replaces the bottom-tab navigator, so react-navigation no longer
// routes cross-tab jumps. This module carries those jumps instead:
//
//   jumpTo(tabName)                        — slide the pager to a main page
//   navigateInTab(tabName, screen, params) — slide there, then push inside
//                                            that page's own stack (AddTask)
//   openSettings()                         — push on the root stack
//
// The refs are owned by App (so the Android back handler can read them
// synchronously) and passed through TabPager into this provider.

export const TAB_NAMES = ['Dashboard', 'Tasks', 'Categories', 'Hobbies', 'Insights'];

const TabNavContext = createContext(null);

export function useTabNav() {
  const ctx = useContext(TabNavContext);
  if (!ctx) throw new Error('useTabNav must be used inside <TabNavProvider>');
  return ctx;
}

/** Shape of the shared, mutable nav state App owns (tabStateRef.current). */
export function createTabNavState() {
  return {
    // Focused pager index; mirrored to onPageSelected (authoritative on settle).
    index: 0,
    // routes.length per stack tab; Dashboard/Insights have no stack → default 1.
    depths: { Tasks: 1, Categories: 1, Hobbies: 1 },
  };
}

export function TabNavProvider({ navRef, tabStateRef, registryRef, pagerRef, children }) {
  const value = useMemo(() => ({
    // Slide to a main page (animated). Index is set optimistically so the
    // back handler never reads a stale focus mid-animation; onPageSelected
    // confirms the same value when the pager settles.
    jumpTo(name) {
      const i = TAB_NAMES.indexOf(name);
      if (i < 0) return;
      const s = tabStateRef.current;
      if (i === s.index) return;
      s.index = i;
      pagerRef.current?.setPage(i);
    },

    // Slide to the page, then push inside its registered stack. If the
    // page's stack has not registered yet (never visited, still mounting
    // while the slide plays), the push is queued and consumed by the
    // bridge the moment it registers.
    navigateInTab(name, screen, params) {
      const i = TAB_NAMES.indexOf(name);
      if (i < 0) return;
      const s = tabStateRef.current;
      if (i !== s.index) {
        s.index = i;
        pagerRef.current?.setPage(i);
      }
      const reg = registryRef.current;
      if (reg[name]) reg[name].navigate(screen, params);
      else (reg.pending ??= {})[name] = { screen, params };
    },

    // Settings is pushed on the ROOT stack, above the pager. The
    // NavigationContainer ref navigates the root navigator directly.
    // `params` lets callers deep-link inside Settings (e.g. auto-scroll to
    // the What's New card).
    openSettings(params) {
      navRef.current?.navigate('Settings', params);
    },
  }), [navRef, tabStateRef, registryRef, pagerRef]);

  return <TabNavContext.Provider value={value}>{children}</TabNavContext.Provider>;
}