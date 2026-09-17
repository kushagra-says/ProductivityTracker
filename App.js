import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, BackHandler, Platform, View } from 'react-native';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { NavigationIndependentTree } from '@react-navigation/core';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AppProvider } from './src/context/AppContext';
import { ToastProvider } from './src/context/ToastContext';
import { ThemeProvider, useTheme } from './src/utils/theme';
import ConfirmDialog from './src/components/ConfirmDialog';
import TabPager, { PagerBridge, usePagerInternals } from './src/components/TabPager';
import { createTabNavState, TAB_NAMES } from './src/tabNav';

import DashboardScreen       from './src/screens/DashboardScreen';
import TasksScreen           from './src/screens/TasksScreen';
import AddTaskScreen         from './src/screens/AddTaskScreen';
import CategoriesScreen      from './src/screens/CategoriesScreen';
import HobbiesScreen         from './src/screens/HobbiesScreen';
import HobbyDetailScreen     from './src/screens/HobbyDetailScreen';
import EditHobbyScreen       from './src/screens/EditHobbyScreen';
import InsightsScreen        from './src/screens/InsightsScreen';
import EditCategoryScreen    from './src/screens/EditCategoryScreen';
import SettingsScreen        from './src/screens/SettingsScreen';

const Stack = createStackNavigator();

// Themed navigation theme for every navigator (root + the per-page
// containers below): stack cards are painted with theme.colors.background
// (@react-navigation/stack CardContainer); without it the library default
// (near-white) was the container colour, so every push/pop flashed white
// for the frame(s) before the screen's own themed content painted (Bug 23).
function useNavTheme() {
  const { COLORS, mode } = useTheme();
  return useMemo(() => ({
    ...(mode === 'dark' ? DarkTheme : DefaultTheme),
    dark: mode === 'dark',
    colors: {
      ...(mode === 'dark' ? DarkTheme.colors : DefaultTheme.colors),
      primary: COLORS.accent,
      background: COLORS.bg,
      card: COLORS.surface,
      text: COLORS.text,
      border: COLORS.border,
      notification: COLORS.danger,
    },
  }), [COLORS, mode]);
}

// Stack tabs keep their react-navigation stacks (pushed screens and the
// unsaved-changes guard are unchanged); they only report their depth to the
// pager shell (back handler + swipe-disable) and register their navigate fn
// so Dashboard's jump-and-push shortcut reaches them.
//
// Each stack lives in its OWN NavigationContainer wrapped in
// NavigationIndependentTree: the pager hosts all three stacks under ONE
// Screen (Main) of the root stack, and react-navigation only allows one
// navigator per Screen/scene (EnsureSingleNavigator) — hosting three plain
// navigators there throws "Another navigator is already registered".
// Independent containers each bring their own registry. Consequences,
// all accounted for:
// - State is per-container and fully preserved (pages never unmount).
// - Android back: every NavigationContainer wires its own back handler.
//   Handlers run in reverse registration order, but a container can only
//   pop while its page's stack has depth > 1 — and the pager is disabled
//   exactly then (see TabPager's pagerEnabled), so a depth > 1 stack is
//   always the FOCUSED page and popping it is correct. Every other
//   container's handler is a no-op that returns false, and App's own
//   handler runs last-registered/first and decides tab-level back first.
// - No linking: each container runs with linking disabled (no prefixes).

function TaskStack() {
  const { onDepth } = usePagerInternals();
  const theme = useNavTheme();
  return (
    <NavigationIndependentTree>
      {/* onStateChange is a NavigationContainer prop — on the Navigator it is
          silently ignored, which left stack depths stuck at 1 and the pager
          swipe lock never engaging (and back popping wrongly). */}
      <NavigationContainer
        theme={theme}
        onStateChange={(st) => onDepth('Tasks', st?.routes.length ?? 1)}
      >
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="TasksList">
            {(props) => (
              <>
                <PagerBridge tabName="Tasks" navigation={props.navigation} />
                <TasksScreen {...props} />
              </>
            )}
          </Stack.Screen>
          <Stack.Screen name="AddTask" component={AddTaskScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </NavigationIndependentTree>
  );
}

function HobbiesStack() {
  const { onDepth } = usePagerInternals();
  const theme = useNavTheme();
  return (
    <NavigationIndependentTree>
      <NavigationContainer
        theme={theme}
        onStateChange={(st) => onDepth('Hobbies', st?.routes.length ?? 1)}
      >
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="HobbiesList"  component={HobbiesScreen} />
          <Stack.Screen name="HobbyDetail"  component={HobbyDetailScreen} />
          <Stack.Screen name="EditHobby"    component={EditHobbyScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </NavigationIndependentTree>
  );
}

function CategoryStack() {
  const { onDepth } = usePagerInternals();
  const theme = useNavTheme();
  return (
    <NavigationIndependentTree>
      <NavigationContainer
        theme={theme}
        onStateChange={(st) => onDepth('Categories', st?.routes.length ?? 1)}
      >
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="CategoriesList" component={CategoriesScreen} />
          <Stack.Screen name="EditCategory"   component={EditCategoryScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </NavigationIndependentTree>
  );
}

const RootStack = createStackNavigator();

// The five main pages in pager order. Dashboard first (index 0) — the
// Android back flow lands here before exiting; the tab bar labels/icons
// live in TabPager.
const PAGES = [
  { name: 'Dashboard',  label: 'Home',       element: <DashboardScreen /> },
  { name: 'Tasks',      label: 'Tasks',      element: <TaskStack /> },
  { name: 'Categories', label: 'Categories', element: <CategoryStack /> },
  { name: 'Hobbies',    label: 'Hobbies',    element: <HobbiesStack /> },
  { name: 'Insights',   label: 'Insights',   element: <InsightsScreen /> },
];

function Navigation({ navRef, tabStateRef, pagerRef }) {
  const { COLORS, mode } = useTheme();

  // Tab pages are plain pager views now — TabPager themes their containers
  // directly; the root theme drives this stack's cards (see useNavTheme).
  const navTheme = useNavTheme();

  return (
    <NavigationContainer ref={navRef} theme={navTheme}>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      {/* Themed root for EVERYTHING inside the navigator. Every layer
          between the themed screens and the Android activity window
          (this view, the gesture root, the providers) is otherwise
          transparent, so the window background — white in Expo's default
          activity theme — showed through during a root-stack push/pop,
          i.e. opening and closing Settings (Bug 23b). With this fill,
          any layer that has not yet painted shows the app background. */}
      <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
        <RootStack.Navigator screenOptions={{ headerShown: false }}>
          <RootStack.Screen name="Main">
            {() => <TabPager navRef={navRef} tabStateRef={tabStateRef} pagerRef={pagerRef} pages={PAGES} />}
          </RootStack.Screen>
          <RootStack.Screen name="Settings" component={SettingsScreen} />
        </RootStack.Navigator>
      </View>
    </NavigationContainer>
  );
}

// Android system back (incl. the edge-swipe gesture): back on a tab list
// first returns to the Dashboard; a second back from the Dashboard asks
// to leave the app. Deeper screens (Settings, AddTask, EditHobby, …) keep
// the default pop — the unsaved-changes guard handles those.
//
// This listener lives in App so it registers AFTER the Navigation
// Container's own handler; RN calls back handlers in reverse registration
// order, so ours runs first. Returning false hands the event to the
// navigator's default handling.
export default function App() {
  const navRef = useRef(null);
  // Shared with TabPager: focused page index + stack depths per tab.
  const tabStateRef = useRef(createTabNavState());
  const pagerRef = useRef(null);
  const [exitVisible, setExitVisible] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      const st = navRef.current?.getState();
      if (!st) return false;
      // Settings pushed on the root stack — let it pop normally.
      if (st.routes.length > 1) return false;
      // A pushed screen inside the focused page's own stack (AddTask,
      // HobbyDetail, EditHobby, EditCategory) — default pop; the
      // unsaved-changes guard asks before discarding there.
      const tabs = tabStateRef.current;
      if ((tabs.depths[TAB_NAMES[tabs.index]] ?? 1) > 1) return false;
      // Tab page → dashboard first; dashboard → confirm exit.
      if (tabs.index !== 0) {
        pagerRef.current?.setPage(0);
        return true;
      }
      setExitVisible(true);
      return true;
    });
    return () => sub.remove();
  }, []);

  // After "Exit" the app is killed, but Android may still restore the
  // retained activity from the app selector — with this modal still
  // mounted in the JS state. Any fresh foregrounding starts clean.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') setExitVisible(false);
    });
    return () => sub.remove();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <ToastProvider>
            <AppProvider>
              <Navigation navRef={navRef} tabStateRef={tabStateRef} pagerRef={pagerRef} />
              <ConfirmDialog
                visible={exitVisible}
                title="Leave the app?"
                message="You are back on the dashboard. Exit ProductivityTracker?"
                icon="exit-outline"
                confirmLabel="Exit"
                destructive
                onConfirm={() => { setExitVisible(false); BackHandler.exitApp(); }}
                onCancel={() => setExitVisible(false)}
              />
            </AppProvider>
          </ToastProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
