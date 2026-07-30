import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { defaultCategoryColors } from '../utils/theme';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const STORAGE_KEY = '@pt_state';

// YYYY-MM-DD in local time. Sparse-map keys for hobby completions.
const todayKey = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const initialState = {
  tasks: [],
  categories: [
    { id: 'cat-1', name: 'Studies',   color: defaultCategoryColors[0], icon: 'book-outline' },
    { id: 'cat-2', name: 'Household', color: defaultCategoryColors[1], icon: 'home-outline' },
    { id: 'cat-3', name: 'Health',    color: defaultCategoryColors[2], icon: 'barbell-outline' },
    { id: 'cat-4', name: 'Work',      color: defaultCategoryColors[3], icon: 'briefcase-outline' },
  ],
  hobbies: [],
  streak: 0,
  lastActiveDate: null,
};

function appReducer(state, action) {
  switch (action.type) {
    case 'LOAD_STATE':
      return { ...state, ...action.payload };

    case 'ADD_TASK':
      return { ...state, tasks: [...state.tasks, action.payload] };

    case 'UPDATE_TASK':
      return {
        ...state,
        tasks: state.tasks.map((t) => (t.id === action.payload.id ? action.payload : t)),
      };

    case 'DELETE_TASK':
      return {
        ...state,
        tasks: state.tasks.filter((t) => t.id !== action.payload),
      };

    case 'COMPLETE_TASK':
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.payload
            ? { ...t, status: 'completed', completedAt: new Date().toISOString() }
            : t,
        ),
      };

    case 'ADD_CATEGORY':
      return { ...state, categories: [...state.categories, action.payload] };

    case 'UPDATE_CATEGORY':
      return {
        ...state,
        categories: state.categories.map((c) =>
          c.id === action.payload.id ? action.payload : c,
        ),
      };

    case 'DELETE_CATEGORY':
      return {
        ...state,
        categories: state.categories.filter((c) => c.id !== action.payload),
      };

    case 'ADD_HOBBY':
      return { ...state, hobbies: [...state.hobbies, action.payload] };

    case 'UPDATE_HOBBY':
      return {
        ...state,
        hobbies: state.hobbies.map((h) => (h.id === action.payload.id ? action.payload : h)),
      };

    case 'DELETE_HOBBY':
      return {
        ...state,
        hobbies: state.hobbies.filter((h) => h.id !== action.payload),
      };

    case 'TOGGLE_HOBBY_TODAY': {
      const { id, date = todayKey() } = action.payload;
      return {
        ...state,
        hobbies: state.hobbies.map((h) => {
          if (h.id !== id) return h;
          const completions = { ...(h.completions || {}) };
          if (completions[date]) {
            delete completions[date];
          } else {
            completions[date] = true;
          }
          return { ...h, completions };
        }),
      };
    }

    case 'UPDATE_STREAK':
      return {
        ...state,
        streak: action.payload.streak,
        lastActiveDate: action.payload.date,
      };

    default:
      return state;
  }
}

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          // Drop walkSessions from older snapshots — it's no longer used.
          if (parsed && 'walkSessions' in parsed) delete parsed.walkSessions;
          dispatch({ type: 'LOAD_STATE', payload: parsed });
        }
        await Notifications.requestPermissionsAsync();
      } catch (e) {
        console.warn('Load error', e);
      }
    })();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(console.warn);
  }, [state]);

  // Auto-expire pending tasks whose expiryDate has passed.
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      state.tasks.forEach((task) => {
        if (
          task.status === 'pending' &&
          task.expiryDate &&
          new Date(task.expiryDate) < now
        ) {
          dispatch({ type: 'UPDATE_TASK', payload: { ...task, status: 'expired' } });
        }
      });
    }, 60000);
    return () => clearInterval(interval);
  }, [state.tasks]);

  // Streak: one completion per day keeps the streak alive.
  useEffect(() => {
    const today = new Date().toDateString();
    const completedToday = state.tasks.some(
      (t) =>
        t.status === 'completed' &&
        t.completedAt &&
        new Date(t.completedAt).toDateString() === today,
    );
    if (completedToday && state.lastActiveDate !== today) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const newStreak =
        state.lastActiveDate === yesterday.toDateString() ? state.streak + 1 : 1;
      dispatch({ type: 'UPDATE_STREAK', payload: { streak: newStreak, date: today } });
    }
  }, [state.tasks]);

  const rescheduleNotifications = useCallback(async (task) => {
    try {
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      for (const n of scheduled) {
        if (n.content?.data?.taskId === task.id) {
          await Notifications.cancelScheduledNotificationAsync(n.identifier);
        }
      }

      if (task.startDate) {
        const t = new Date(task.startDate);
        t.setMinutes(t.getMinutes() - 30);
        if (t > new Date()) {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: 'Task starting soon',
              body: `"${task.title}" starts in 30 min`,
              data: { taskId: task.id },
            },
            trigger: t,
          });
        }
      }
      if (task.expiryDate) {
        const t = new Date(task.expiryDate);
        t.setHours(t.getHours() - 1);
        if (t > new Date()) {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: 'Expiring soon',
              body: `"${task.title}" expires in 1 hour`,
              data: { taskId: task.id },
            },
            trigger: t,
          });
        }
      }

      if (Array.isArray(task.reminders)) {
        for (const reminder of task.reminders) {
          const rt = new Date(reminder.datetime);
          if (rt > new Date()) {
            await Notifications.scheduleNotificationAsync({
              content: {
                title: reminder.label || 'Task reminder',
                body: `"${task.title}" — ${reminder.note || ''}`,
                data: { taskId: task.id },
              },
              trigger: rt,
            });
          }
        }
      }
    } catch (e) {
      console.warn('Notification error', e);
    }
  }, []);

  const actions = {
    addTask: useCallback(
      (task) => {
        dispatch({ type: 'ADD_TASK', payload: task });
        rescheduleNotifications(task);
      },
      [rescheduleNotifications],
    ),
    updateTask: useCallback(
      (task) => {
        dispatch({ type: 'UPDATE_TASK', payload: task });
        rescheduleNotifications(task);
      },
      [rescheduleNotifications],
    ),
    completeTask: useCallback((id) => {
      dispatch({ type: 'COMPLETE_TASK', payload: id });
    }, []),
    deleteTask: useCallback((id) => {
      dispatch({ type: 'DELETE_TASK', payload: id });
    }, []),

    addCategory: useCallback((cat) => {
      dispatch({ type: 'ADD_CATEGORY', payload: cat });
    }, []),
    updateCategory: useCallback((cat) => {
      dispatch({ type: 'UPDATE_CATEGORY', payload: cat });
    }, []),
    deleteCategory: useCallback((id) => {
      dispatch({ type: 'DELETE_CATEGORY', payload: id });
    }, []),

    addHobby: useCallback((hobby) => {
      dispatch({ type: 'ADD_HOBBY', payload: hobby });
    }, []),
    updateHobby: useCallback((hobby) => {
      dispatch({ type: 'UPDATE_HOBBY', payload: hobby });
    }, []),
    deleteHobby: useCallback((id) => {
      dispatch({ type: 'DELETE_HOBBY', payload: id });
    }, []),
    toggleHobbyToday: useCallback((id, date) => {
      dispatch({ type: 'TOGGLE_HOBBY_TODAY', payload: { id, date } });
    }, []),
  };

  return (
    <AppContext.Provider value={{ state, ...actions }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
export { todayKey };
