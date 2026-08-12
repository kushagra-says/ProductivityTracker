import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { defaultCategoryColors } from '../utils/theme';

// ─── Notification handler & channel ─────────────────────────────────────────
// sounds + vibration. On Android we have to create a channel before the
// first notification fires — without it the OS silently drops vibration
// and the sound goes to the default channel (often mute).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const DEFAULT_CHANNEL_ID = 'default';
if (Platform.OS === 'android') {
  Notifications.setNotificationChannelAsync(DEFAULT_CHANNEL_ID, {
    name: 'Default',
    sound: 'default',
    enableVibrate: true,
    vibrationPattern: [0, 250, 250, 250],
    importance: Notifications.AndroidImportance.DEFAULT,
  }).catch(() => {});
}

// Helper to decorate a scheduled notification's content with the right
// sound + channel id. Keeps the call-sites readable.
function decorate(content) {
  return {
    ...content,
    sound: 'default',
    ...(Platform.OS === 'android' ? { channelId: DEFAULT_CHANNEL_ID } : {}),
  };
}

const STORAGE_KEY = '@pt_state';

// YYYY-MM-DD in local time. Used for hobby completions + streak comparisons.
const todayKey = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const initialSettings = {
  tasksReminderEnabled: false,
  tasksReminderTime: '20:00',
  morningBriefingEnabled: false,
  morningBriefingTime: '08:00',
  streakNudgeEnabled: true,
  streakNudgeTime: '21:00',
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
  lastActiveDate: null, // YYYY-MM-DD of the most recent day the user earned a streak increment
  settings: initialSettings,
};

function appReducer(state, action) {
  switch (action.type) {
    case 'LOAD_STATE':
      return {
        ...state,
        ...action.payload,
        settings: { ...initialSettings, ...(action.payload?.settings || {}) },
        // Backfill missing reminder fields on saved tasks (added in v1.3).
        tasks: (action.payload?.tasks || []).map((t) => ({
          // Drop the old recurring fields silently if any task ever had them
          // — they're no longer scheduled anywhere.
          reminderTime: undefined,
          reminderDays: undefined,
          ...t,
          customReminderTime: t.customReminderTime ?? null,
          beforeExpiryMinutes: t.beforeExpiryMinutes ?? null,
        })),
      };

    case 'ADD_TASK':
      return {
        ...state,
        // Seed updatedAt to createdAt so the "most recent on top" sort
        // works on fresh tasks without a separate edit history.
        tasks: [...state.tasks, { updatedAt: action.payload.createdAt, ...action.payload }],
      };

    case 'UPDATE_TASK':
      return {
        ...state,
        // Stamp updatedAt server-side so callers don't have to remember —
        // every reducer-driven edit becomes a "most recent activity" event.
        tasks: state.tasks.map((t) =>
          t.id === action.payload.id
            ? { ...action.payload, updatedAt: new Date().toISOString() }
            : t,
        ),
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
            ? {
                ...t,
                status: 'completed',
                completedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              }
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

    case 'UPDATE_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.payload } };

    default:
      return state;
  }
}

const AppContext = createContext(null);

// True iff the user has at least one task completed whose completedAt
// falls within today's local-day window.
function hasCompletionToday(tasks, ref = new Date()) {
  const start = new Date(ref);
  start.setHours(0, 0, 0, 0);
  const end = new Date(ref);
  end.setHours(23, 59, 59, 999);
  return tasks.some(
    (t) =>
      t.status === 'completed' &&
      t.completedAt &&
      new Date(t.completedAt) >= start &&
      new Date(t.completedAt) <= end,
  );
}

function pendingTaskCount(tasks, ref = new Date()) {
  const start = new Date(ref);
  start.setHours(0, 0, 0, 0);
  return tasks.filter((t) => {
    if (t.status !== 'pending') return false;
    if (t.expiryDate && new Date(t.expiryDate) < start) return false;
    return true;
  }).length;
}

function pendingHobbyCount(hobbies, ref = new Date()) {
  const k = todayKey(ref);
  return hobbies.filter((h) => !h.completions || !h.completions[k]).length;
}

// ─── Notification helpers ──────────────────────────────────────────────────

async function cancelByPredicate(predicate) {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of scheduled) {
      if (predicate(n)) {
        await Notifications.cancelScheduledNotificationAsync(n.identifier);
      }
    }
  } catch (e) {
    // Quiet — AsyncStorage save is more important than scheduling.
  }
}

// Schedule a single trigger at an absolute Date (used for the streak nudge
// which is a one-shot, not a repeating notification).
async function scheduleAt(date, content) {
  if (!date || date <= new Date()) return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: decorate(content),
      trigger: date,
    });
  } catch (e) {
    console.warn('scheduleAt error', e);
  }
}

// Schedule a repeating daily notification for one weekday.
// `weekday` follows Expo's convention: 1 = Sunday, 7 = Saturday.
async function scheduleWeekdayDaily({ weekday, hour, minute }, content) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: decorate(content),
      trigger: { weekday, hour, minute, repeats: true },
    });
  } catch (e) {
    console.warn('scheduleWeekdayDaily error', e);
  }
}

// Convert a JS getDay() day (0=Sun..6=Sat) to Expo's weekday (1=Sun..7=Sat).
const toExpoWeekday = (jsDay) => jsDay + 1;

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  // Refs read by interval/foreground callbacks so they never use a stale closure.
  const settingsRef = useRef(state.settings);
  const tasksRef = useRef(state.tasks);
  const hobbiesRef = useRef(state.hobbies);
  const lastActiveDateRef = useRef(state.lastActiveDate);
  const streakRef = useRef(state.streak);
  const initializedRef = useRef(false);

  useEffect(() => { settingsRef.current = state.settings; }, [state.settings]);
  useEffect(() => { tasksRef.current = state.tasks; }, [state.tasks]);
  useEffect(() => { hobbiesRef.current = state.hobbies; }, [state.hobbies]);
  useEffect(() => { lastActiveDateRef.current = state.lastActiveDate; }, [state.lastActiveDate]);
  useEffect(() => { streakRef.current = state.streak; }, [state.streak]);

  // ─── Hydration ────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && 'walkSessions' in parsed) delete parsed.walkSessions;
          dispatch({ type: 'LOAD_STATE', payload: parsed });
        }
        await Notifications.requestPermissionsAsync();
      } catch (e) {
        console.warn('Load error', e);
      } finally {
        initializedRef.current = true;
      }
    })();
  }, []);

  // Persist on every change.
  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(console.warn);
  }, [state]);

  // ─── Auto-expire pending tasks whose expiryDate has passed ────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      tasksRef.current.forEach((task) => {
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
  }, []);

  // ─── Streak logic ─────────────────────────────────────────────────────────
  // Triggered:
  //   1. Whenever tasks change (immediate feedback when a task completes)
  //   2. Every 60 seconds (catches midnight rollover while app is open)
  //   3. When app comes back to foreground
  const recomputeStreak = useCallback(() => {
    const today = todayKey();
    const yesterday = todayKey(new Date(Date.now() - 86400000));
    const tasks = tasksRef.current;
    const lastActiveDate = lastActiveDateRef.current;
    if (lastActiveDate === today) return; // already credited for today
    if (!hasCompletionToday(tasks)) return;
    const newStreak =
      lastActiveDate === yesterday ? (streakRef.current + 1) : 1;
    dispatch({ type: 'UPDATE_STREAK', payload: { streak: newStreak, date: today } });
  }, []);

  useEffect(() => {
    if (!initializedRef.current) return;
    recomputeStreak();
  }, [state.tasks, recomputeStreak]);

  useEffect(() => {
    const interval = setInterval(recomputeStreak, 60000);
    return () => clearInterval(interval);
  }, [recomputeStreak]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') recomputeStreak();
    });
    return () => sub?.remove?.();
  }, [recomputeStreak]);

  // ─── Notification scheduling helpers (forward-declared for actions) ─────
  const scheduleHobbyReminder = useCallback(async (hobby) => {
    if (!hobby || !hobby.reminderTime) return;
    await cancelByPredicate(
      (n) => n.content?.data?.kind === 'hobby-reminder' && n.content?.data?.hobbyId === hobby.id,
    );
    const [hh, mm] = hobby.reminderTime.split(':').map((n) => parseInt(n, 10));
    const days = Array.isArray(hobby.reminderDays) && hobby.reminderDays.length > 0
      ? hobby.reminderDays
      : [0, 1, 2, 3, 4, 5, 6];
    for (const jsDay of days) {
      await scheduleWeekdayDaily(
        { weekday: toExpoWeekday(jsDay), hour: hh, minute: mm },
        {
          title: hobby.name,
          body: 'Time to do your hobby!',
          data: { kind: 'hobby-reminder', hobbyId: hobby.id },
        },
      );
    }
  }, []);

  const cancelHobbyReminders = useCallback(async (hobbyId) => {
    await cancelByPredicate(
      (n) => n.content?.data?.kind === 'hobby-reminder' && n.content?.data?.hobbyId === hobbyId,
    );
  }, []);

  // ─── Daily "pending tasks" reminder ──────────────────────────────────────
  const rescheduleTasksReminder = useCallback(async () => {
    const settings = settingsRef.current;
    await cancelByPredicate((n) => n.content?.data?.kind === 'tasks-reminder');
    if (!settings?.tasksReminderEnabled) return;

    const tasks = tasksRef.current;
    const hobbies = hobbiesRef.current;
    const pendingTasks = pendingTaskCount(tasks);
    const pendingHobbies = pendingHobbyCount(hobbies);
    if (pendingTasks === 0 && pendingHobbies === 0) return;

    const [hh, mm] = settings.tasksReminderTime.split(':').map((n) => parseInt(n, 10));
    const body = pendingTasks > 0
      ? `You have ${pendingTasks} pending task${pendingTasks === 1 ? '' : 's'} today.`
      : `You have ${pendingHobbies} hobby${pendingHobbies === 1 ? '' : 's'} to finish today.`;

    try {
      await Notifications.scheduleNotificationAsync({
        content: decorate({
          title: 'Today’s plan',
          body,
          data: { kind: 'tasks-reminder' },
        }),
        trigger: { hour: hh, minute: mm, repeats: true },
      });
    } catch (e) {
      console.warn('tasks-reminder schedule error', e);
    }
  }, []);

  // ─── Morning briefing ────────────────────────────────────────────────────
  const rescheduleMorningBriefing = useCallback(async () => {
    const settings = settingsRef.current;
    await cancelByPredicate((n) => n.content?.data?.kind === 'morning-briefing');
    if (!settings?.morningBriefingEnabled) return;

    const tasks = pendingTaskCount(tasksRef.current);
    const hobbies = pendingHobbyCount(hobbiesRef.current);
    if (tasks === 0 && hobbies === 0) return;

    const [hh, mm] = settings.morningBriefingTime.split(':').map((n) => parseInt(n, 10));
    const parts = [];
    if (tasks > 0) parts.push(`${tasks} pending task${tasks === 1 ? '' : 's'}`);
    if (hobbies > 0) parts.push(`${hobbies} hobby${hobbies === 1 ? '' : 's'} to do`);
    const body = `Good morning! You have ${parts.join(' and ')} today.`;

    try {
      await Notifications.scheduleNotificationAsync({
        content: decorate({
          title: 'Good morning \u{1F305}',
          body,
          data: { kind: 'morning-briefing' },
        }),
        trigger: { hour: hh, minute: mm, repeats: true },
      });
    } catch (e) {
      console.warn('morning-briefing schedule error', e);
    }
  }, []);

  // ─── Streak-at-risk nudge (one-shot, fires today only) ───────────────────
  const rescheduleStreakNudge = useCallback(async () => {
    const settings = settingsRef.current;
    await cancelByPredicate((n) => n.content?.data?.kind === 'streak-nudge');
    if (!settings?.streakNudgeEnabled) return;

    // Only fire if user has an active streak, hasn't completed anything
    // yet today, and we're still within today.
    const streak = streakRef.current;
    if (streak < 1) return;
    if (hasCompletionToday(tasksRef.current)) return;

    const [hh, mm] = settings.streakNudgeTime.split(':').map((n) => parseInt(n, 10));
    const now = new Date();
    const target = new Date(now);
    target.setHours(hh, mm, 0, 0);
    await scheduleAt(target, {
      title: 'Don’t break your streak',
      body: `Finish at least one task to keep your ${streak}-day streak alive.`,
      data: { kind: 'streak-nudge' },
    });
  }, []);

  // Whenever tasks or hobbies change, refresh the three count-based reminders
  // so the scheduled body uses the latest pending count.
  useEffect(() => {
    if (!initializedRef.current) return;
    rescheduleTasksReminder();
    rescheduleMorningBriefing();
    rescheduleStreakNudge();
  }, [
    state.tasks,
    state.hobbies,
    state.settings.tasksReminderEnabled,
    state.settings.tasksReminderTime,
    state.settings.morningBriefingEnabled,
    state.settings.morningBriefingTime,
    state.settings.streakNudgeEnabled,
    state.settings.streakNudgeTime,
    rescheduleTasksReminder,
    rescheduleMorningBriefing,
    rescheduleStreakNudge,
  ]);

  // ─── Task notification helpers ───────────────────────────────────────────
  // Cancel every notification previously scheduled for this task, then
  // re-schedule (a) the implicit "start soon" warning, and (b) whichever
  // user-picked reminders the task has on it.
  //
  // User reminders (either or both may be set):
  //   - customReminderTime: ISO datetime string — one-shot at that moment.
  //   - beforeExpiryMinutes: number (5/15/30/60/120/1440/custom) — fires
  //     that many minutes before expiryDate. When the user picks this,
  //     the implicit 1hr-before-expiry warning is suppressed.
  const rescheduleTaskNotifications = useCallback(async (task) => {
    try {
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      for (const n of scheduled) {
        if (n.content?.data?.kind === 'task-reminder' && n.content?.data?.taskId === task.id) {
          await Notifications.cancelScheduledNotificationAsync(n.identifier);
        }
      }

      const scheduleOne = async (when, content) => {
        if (!when || when <= new Date()) return;
        try {
          await Notifications.scheduleNotificationAsync({ content: decorate(content), trigger: when });
        } catch (e) {
          console.warn('scheduleOne error', e);
        }
      };

      // (a) Implicit "starts in 30 min" warning whenever a start is set.
      if (task.startDate) {
        const t = new Date(task.startDate);
        t.setMinutes(t.getMinutes() - 30);
        await scheduleOne(t, {
          title: 'Task starting soon',
          body: `"${task.title}" starts in 30 min`,
          data: { kind: 'task-reminder', taskId: task.id },
        });
      }

      // (b) User-picked "before expiry" reminder replaces the implicit 1hr
      //     warning. If the user is picking their own offset, ignore the
      //     default to avoid duplicate notifications.
      const hasBeforeExpiry =
        typeof task.beforeExpiryMinutes === 'number' && task.beforeExpiryMinutes > 0 && task.expiryDate;

      if (hasBeforeExpiry) {
        const t = new Date(task.expiryDate);
        t.setMinutes(t.getMinutes() - task.beforeExpiryMinutes);
        await scheduleOne(t, {
          title: 'Task due soon',
          body: `"${task.title}" expires in ${task.beforeExpiryMinutes} min`,
          data: { kind: 'task-reminder', taskId: task.id },
        });
      } else if (task.expiryDate) {
        // Default keeps the previous behavior when the user didn't pick one.
        const t = new Date(task.expiryDate);
        t.setHours(t.getHours() - 1);
        await scheduleOne(t, {
          title: 'Expiring soon',
          body: `"${task.title}" expires in 1 hour`,
          data: { kind: 'task-reminder', taskId: task.id },
        });
      }

      // (c) User-picked custom one-shot at an exact datetime.
      if (task.customReminderTime) {
        await scheduleOne(new Date(task.customReminderTime), {
          title: 'Task reminder',
          body: `"${task.title}" — reminder`,
          data: { kind: 'task-reminder', taskId: task.id },
        });
      }
    } catch (e) {
      console.warn('Task notification error', e);
    }
  }, []);

  // ─── Actions ─────────────────────────────────────────────────────────────
  const actions = {
    addTask: useCallback(
      (task) => {
        const full = {
          customReminderTime: null,
          beforeExpiryMinutes: null,
          ...task,
        };
        dispatch({ type: 'ADD_TASK', payload: full });
        rescheduleTaskNotifications(full);
      },
      [rescheduleTaskNotifications],
    ),
    updateTask: useCallback(
      (task) => {
        dispatch({ type: 'UPDATE_TASK', payload: task });
        rescheduleTaskNotifications(task);
      },
      [rescheduleTaskNotifications],
    ),
    completeTask: useCallback((id) => {
      dispatch({ type: 'COMPLETE_TASK', payload: id });
    }, []),
    deleteTask: useCallback(async (id) => {
      dispatch({ type: 'DELETE_TASK', payload: id });
      await cancelByPredicate(
        (n) => n.content?.data?.kind === 'task-reminder' && n.content?.data?.taskId === id,
      );
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

    addHobby: useCallback(
      (hobby) => {
        const full = {
          reminderTime: null,
          reminderDays: null,
          ...hobby,
        };
        dispatch({ type: 'ADD_HOBBY', payload: full });
        if (full.reminderTime) scheduleHobbyReminder(full);
      },
      [scheduleHobbyReminder],
    ),
    updateHobby: useCallback(
      (hobby) => {
        dispatch({ type: 'UPDATE_HOBBY', payload: hobby });
        if (hobby.reminderTime) scheduleHobbyReminder(hobby);
        else cancelHobbyReminders(hobby.id);
      },
      [scheduleHobbyReminder, cancelHobbyReminders],
    ),
    deleteHobby: useCallback(
      async (id) => {
        dispatch({ type: 'DELETE_HOBBY', payload: id });
        await cancelHobbyReminders(id);
      },
      [cancelHobbyReminders],
    ),
    toggleHobbyToday: useCallback((id, date) => {
      dispatch({ type: 'TOGGLE_HOBBY_TODAY', payload: { id, date } });
    }, []),

    updateSettings: useCallback((patch) => {
      dispatch({ type: 'UPDATE_SETTINGS', payload: patch });
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
