import React, { useEffect, useRef, useState } from 'react';
import { AppState, BackHandler, Platform, View } from 'react-native';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';

import { AppProvider } from './src/context/AppContext';
import { ToastProvider } from './src/context/ToastContext';
import { ThemeProvider, useTheme } from './src/utils/theme';
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

// Tab switching is via the bottom tab bar. The swipe-between-tabs gesture
// was removed: the preview-cover choreography could not be made flash-free
// on device alongside react-native-screens' managed tab switching.

function TaskStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="TasksList" component={TasksScreen} />
      <Stack.Screen name="AddTask"   component={AddTaskScreen} />
    </Stack.Navigator>
  );
}

function HobbiesStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HobbiesList"  component={HobbiesScreen} />
      <Stack.Screen name="HobbyDetail"  component={HobbyDetailScreen} />
      <Stack.Screen name="EditHobby"    component={EditHobbyScreen} />
    </Stack.Navigator>
  );
}

function CategoryStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CategoriesList" component={CategoriesScreen} />
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
        // Themed native screen container. BottomTabView passes sceneStyle
        // straight to the react-native-screens Screen, which otherwise has
        // no background — the native default (white) would show for the
        // frame(s) before a tab's themed content paints (Bug 23).
        sceneStyle: { backgroundColor: COLORS.bg },
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
      <Tab.Screen name="Dashboard"  component={DashboardScreen}  options={{ tabBarLabel: 'Home' }} />
      <Tab.Screen name="Tasks"      component={TaskStack}        />
      <Tab.Screen name="Categories" component={CategoryStack}   />
      <Tab.Screen name="Hobbies"    component={HobbiesStack}     />
      <Tab.Screen name="Insights"   component={InsightsScreen}   />
    </Tab.Navigator>
  );
}

const RootStack = createStackNavigator();

function Navigation({ navRef }) {
  const { COLORS, mode } = useTheme();

  // The navigation theme drives the NATIVE screen containers: stack cards
  // are painted with theme.colors.background (@react-navigation/stack
  // CardContainer), and tab screens with our sceneStyle above. Without a
  // theme the library default (near-white) was the container colour, so
  // every push/pop/tab switch flashed white for the frame(s) before the
  // screen's own themed content painted (Bug 23).
  const navTheme = {
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
  };

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
          <RootStack.Screen name="Main"     component={MainTabs} />
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
              <Navigation navRef={navRef} />
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
