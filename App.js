import React, { useEffect, useRef, useState } from 'react';
import { AppState, BackHandler, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';

import { AppProvider } from './src/context/AppContext';
import { ToastProvider } from './src/context/ToastContext';
import { ThemeProvider, useTheme } from './src/utils/theme';
import { withTabSwipe, registerPeekScreen } from './src/components/TabSwipe';
import ConfirmDialog from './src/components/ConfirmDialog';

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

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// Bug 7 — swipe left/right switches between the five main tabs. Only the
// five list screens are wrapped; stack screens (AddTask, HobbyDetail,
// EditCategory, …) are left alone — and stackGuard additionally refuses
// to navigate when the tab's own stack holds a pushed screen. Defined at
// module level so the wrapped component types are stable across MainTabs
// re-renders.
const SwipeableDashboard  = withTabSwipe(DashboardScreen,  'Dashboard');
const SwipeableTasksList  = withTabSwipe(TasksScreen,      'Tasks',      { stackGuard: true });
const SwipeableCategories = withTabSwipe(CategoriesScreen, 'Categories', { stackGuard: true });
const SwipeableHobbies    = withTabSwipe(HobbiesScreen,    'Hobbies',    { stackGuard: true });
const SwipeableInsights   = withTabSwipe(InsightsScreen,   'Insights');

// The swipe preview shows a cached STATIC SNAPSHOT of the adjacent tab.
// The plain screen (no swipe wrapper, no nested navigator) is registered
// so the hidden capture rig can screenshot it after focus — without
// firing navigation focus events that would re-trigger captures.
registerPeekScreen('Dashboard',  DashboardScreen);
registerPeekScreen('Tasks',      TasksScreen);
registerPeekScreen('Categories', CategoriesScreen);
registerPeekScreen('Hobbies',    HobbiesScreen);
registerPeekScreen('Insights',   InsightsScreen);

function TaskStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="TasksList" component={SwipeableTasksList} />
      <Stack.Screen name="AddTask"   component={AddTaskScreen} />
    </Stack.Navigator>
  );
}

function HobbiesStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HobbiesList"  component={SwipeableHobbies} />
      <Stack.Screen name="HobbyDetail"  component={HobbyDetailScreen} />
      <Stack.Screen name="EditHobby"    component={EditHobbyScreen} />
    </Stack.Navigator>
  );
}

function CategoryStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CategoriesList" component={SwipeableCategories} />
      <Stack.Screen name="EditCategory"   component={EditCategoryScreen} />
    </Stack.Navigator>
  );
}

const TAB_ICONS = {
  Dashboard:  { active: 'grid',           inactive: 'grid-outline' },
  Tasks:      { active: 'checkmark-circle',inactive: 'checkmark-circle-outline' },
  Categories: { active: 'folder',         inactive: 'folder-outline' },
  Hobbies:    { active: 'leaf',           inactive: 'leaf-outline' },
  Insights:   { active: 'stats-chart',    inactive: 'stats-chart-outline' },
};

function MainTabs() {
  const { COLORS, mode } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor:  COLORS.border,
          borderTopWidth: 1,
          paddingBottom: 8,
          paddingTop: 6,
          height: 66,
        },
        tabBarActiveTintColor:   COLORS.accent,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', letterSpacing: 0.4 },
        tabBarIcon: ({ focused, color, size }) => {
          const set = TAB_ICONS[route.name] || { active: 'ellipse', inactive: 'ellipse-outline' };
          return (
            <Ionicons
              name={focused ? set.active : set.inactive}
              size={size || 22}
              color={color}
            />
          );
        },
      })}
    >
      <Tab.Screen name="Dashboard"  component={SwipeableDashboard}  options={{ tabBarLabel: 'Home' }} />
      <Tab.Screen name="Tasks"      component={TaskStack}        />
      <Tab.Screen name="Categories" component={CategoryStack}   />
      <Tab.Screen name="Hobbies"    component={HobbiesStack}     />
      <Tab.Screen name="Insights"   component={SwipeableInsights}   />
    </Tab.Navigator>
  );
}

const RootStack = createStackNavigator();

function Navigation({ navRef }) {
  const { mode } = useTheme();
  return (
    <>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        <RootStack.Screen name="Main"     component={MainTabs} />
        <RootStack.Screen name="Settings" component={SettingsScreen} />
      </RootStack.Navigator>
    </>
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
  const [exitVisible, setExitVisible] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      const st = navRef.current?.getState();
      if (!st) return false;
      // Settings pushed on the root stack — let it pop normally.
      if (st.routes.length > 1) return false;
      const mainRoute = st.routes.find((r) => r.name === 'Main');
      const tabState = mainRoute?.state;
      if (!tabState) return false;
      const active = tabState.routes[tabState.index];
      // A pushed screen inside the tab's own stack (AddTask, HobbyDetail,
      // EditHobby, EditCategory) — default pop; the unsaved-changes guard
      // asks before discarding there.
      if (active?.state && active.state.routes.length > 1) return false;
      // Tab list → dashboard first; dashboard → confirm exit.
      if (active?.name !== 'Dashboard') {
        navRef.current?.navigate('Main', { screen: 'Dashboard' });
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
              <NavigationContainer ref={navRef}>
                <Navigation navRef={navRef} />
              </NavigationContainer>
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
