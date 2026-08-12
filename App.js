import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { AppProvider } from './src/context/AppContext';
import { ToastProvider } from './src/context/ToastContext';
import { ThemeProvider, useTheme } from './src/utils/theme';

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

function Navigation() {
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

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ToastProvider>
          <AppProvider>
            <NavigationContainer>
              <Navigation />
            </NavigationContainer>
          </AppProvider>
        </ToastProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
