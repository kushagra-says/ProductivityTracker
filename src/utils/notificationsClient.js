import { Platform } from 'react-native';

// ─── Crash-proof expo-notifications access ────────────────────────────────
// Two environments, two failure modes, both caught here so the app always
// boots and local notifications keep working wherever the runtime allows:
//
// 1. Development builds: the package index imports cleanly and is used whole.
//
// 2. Expo Go (SDK 53+): Expo Go's binary removed Android push support and
//    binds `ExpoPushTokenManager` to a stub that THROWS the push-removal
//    error the moment the package index touches it — so `require('expo-
//    notifications')` dies at import on Android even though local
//    notifications are still supported in Expo Go. Fallback: import only the
//    local-notification submodules directly (handler, scheduler, channel,
//    permissions, trigger types). Their dependency graphs never touch the
//    push-token path, so they bind cleanly in Expo Go.
//
// Whatever still fails to load is filled by no-op fallbacks so every
// call-site stays promise-shaped and harmless.

let full = null;
let indexError = null;
try {
  // Static string require — Metro bundles it; only its *execution* is lazy.
  // eslint-disable-next-line global-require
  full = require('expo-notifications');
} catch (e) {
  indexError = e;
}

// Submodule fallback — only exercised when the package index threw.
// Each require is static (Metro bundles it) and isolated, so one bad
// submodule degrades alone instead of taking the rest down.
function loadPieces() {
  const pieces = {};
  try {
    pieces.setNotificationHandler =
      // eslint-disable-next-line global-require
      require('expo-notifications/build/NotificationsHandler').setNotificationHandler;
  } catch (e) { console.warn('[ProductivityTracker] notifications handler unavailable:', e?.message); }
  try {
    pieces.scheduleNotificationAsync =
      // eslint-disable-next-line global-require
      require('expo-notifications/build/scheduleNotificationAsync').scheduleNotificationAsync;
  } catch (e) { console.warn('[ProductivityTracker] scheduleNotificationAsync unavailable:', e?.message); }
  try {
    const scheduler =
      // eslint-disable-next-line global-require
      require('expo-notifications/build/getAllScheduledNotificationsAsync');
    pieces.getAllScheduledNotificationsAsync = scheduler.getAllScheduledNotificationsAsync;
    pieces.cancelScheduledNotificationAsync =
      // eslint-disable-next-line global-require
      require('expo-notifications/build/cancelScheduledNotificationAsync').cancelScheduledNotificationAsync;
  } catch (e) { console.warn('[ProductivityTracker] scheduled-notification queries unavailable:', e?.message); }
  try {
    pieces.setNotificationChannelAsync =
      // eslint-disable-next-line global-require
      require('expo-notifications/build/setNotificationChannelAsync').setNotificationChannelAsync;
  } catch (e) { console.warn('[ProductivityTracker] notification channels unavailable:', e?.message); }
  try {
    const permissions =
      // eslint-disable-next-line global-require
      require('expo-notifications/build/NotificationPermissions');
    pieces.requestPermissionsAsync = permissions.requestPermissionsAsync;
    pieces.getPermissionsAsync = permissions.getPermissionsAsync;
  } catch (e) { console.warn('[ProductivityTracker] notification permissions unavailable:', e?.message); }
  try {
    pieces.AndroidImportance =
      // eslint-disable-next-line global-require
      require('expo-notifications/build/NotificationChannelManager.types').AndroidImportance;
  } catch (e) { /* typed trigger constants below cover the rest */ }
  try {
    pieces.SchedulableTriggerInputTypes =
      // eslint-disable-next-line global-require
      require('expo-notifications/build/Notifications.types').SchedulableTriggerInputTypes;
  } catch (e) { /* fallback constants below cover the rest */ }
  return pieces;
}

// No-op fallbacks keep every call-site promise-shaped and harmless when the
// library could not be loaded at all.
const noopAsync = async () => undefined;
const noop = () => undefined;

const fallback = {
  setNotificationHandler: noop,
  setNotificationChannelAsync: noopAsync,
  scheduleNotificationAsync: noopAsync,
  getAllScheduledNotificationsAsync: async () => [],
  cancelScheduledNotificationAsync: noopAsync,
  cancelAllScheduledNotificationsAsync: noopAsync,
  requestPermissionsAsync: noopAsync,
  getPermissionsAsync: noopAsync,
  addNotificationResponseReceivedListener: () => ({ remove: noop }),
  // Trigger-type discriminators required by the 2.x schedule API
  // (mirrors Notifications.types.ts SchedulableTriggerInputTypes).
  SchedulableTriggerInputTypes: {
    CALENDAR: 'calendar',
    DAILY: 'daily',
    WEEKLY: 'weekly',
    MONTHLY: 'monthly',
    YEARLY: 'yearly',
    DATE: 'date',
    TIME_INTERVAL: 'timeInterval',
  },
  AndroidImportance: { DEFAULT: 3, HIGH: 4, MAX: 5 },
};

const pieces = full ? null : loadPieces();

if (!full && !pieces.scheduleNotificationAsync) {
  console.warn(
    '[ProductivityTracker] expo-notifications is unavailable in this runtime — '
      + 'notifications are disabled. Cause:', indexError?.message || indexError,
  );
} else if (!full && Platform.OS === 'android') {
  console.info(
    '[ProductivityTracker] Running in a runtime without the full expo-notifications '
      + 'module set (Expo Go since SDK 53). Loaded the local-notification subset; '
      + 'push notifications are not available here.',
  );
}

const Notifications = full || { ...fallback, ...pieces };

// ─── Default-channel management ────────────────────────────────────────────
// Expo Go partially stubs ExpoNotificationChannelManager too — the call
// rejects with a NullPointerException from its missing NotificationsChannels
// provider. Attempt the channel exactly once, remember the outcome, and let
// call-sites decide: attach `channelId` only when the channel actually
// exists, because Android silently drops notifications posted to a channel
// id that was never created.
const DEFAULT_CHANNEL_ID = 'default';
let channelResolved = false;
let channelAvailable = false;

export async function ensureDefaultChannelAsync(options) {
  if (Platform.OS !== 'android') return null;
  if (channelResolved) return channelAvailable ? DEFAULT_CHANNEL_ID : null;
  channelResolved = true;
  try {
    await Notifications.setNotificationChannelAsync(DEFAULT_CHANNEL_ID, options);
    channelAvailable = true;
  } catch (e) {
    channelAvailable = false;
    console.info(
      '[ProductivityTracker] Notification channels are unavailable in this runtime '
        + '(Expo Go). Reminders will fire through the OS default channel; sound and '
        + 'vibration settings for the custom channel are skipped. Cause:', e?.message || e,
    );
  }
  return channelAvailable ? DEFAULT_CHANNEL_ID : null;
}

// 'default' once the channel provably exists, otherwise null — a null means
// "do not attach a channelId" rather than "use a channel named null".
export function getDefaultChannelId() {
  return channelAvailable ? DEFAULT_CHANNEL_ID : null;
}

export default Notifications;
export const isNotificationsRuntimeAvailable = Boolean(full || pieces.scheduleNotificationAsync);
export const NOTIFICATIONS_PLATFORM = Platform.OS;