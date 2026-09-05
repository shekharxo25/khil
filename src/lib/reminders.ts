import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

/**
 * Local, on-device session reminders — Milestone spec §3:
 *
 *   "Push notification / reminder system — gentle nudges for session streaks
 *    and flag follow-ups (not guilt-trippy — 'Aarav's ready for today's
 *    game!' not 'You haven't played in 3 days')."
 *
 * Honest scope note: this is LOCAL notification scheduling only. There is no
 * push server anywhere in this project, so nothing here can wake the app from
 * a backend event — it can only ask the OS to show a notification the device
 * itself already knows about, at a time we picked in advance. That is enough
 * for "play today" streak nudges; it is not enough for a true push channel
 * (e.g. "the pediatrician just replied"), which would need a server.
 *
 * expo-notifications' local scheduling is Android/iOS only — SDK 57's own
 * docs are explicit that web is unsupported. Every function here is a no-op
 * on web and swallows its own errors, because a reminder failing to schedule
 * must never be something a parent has to see or debug.
 */

const REMINDER_ID = 'khil-daily-session-reminder';
const supported = Platform.OS === 'ios' || Platform.OS === 'android';

let handlerSet = false;
function ensureHandler() {
  if (handlerSet || !supported) return;
  handlerSet = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

/** Cheerful, never guilt-inducing — spec is explicit that streak nudges must not shame a missed day. */
function reminderBody(childName: string): string {
  return `${childName}’s ready for today’s game! It only takes a few minutes.`;
}

export async function enableDailyReminder(childName: string): Promise<boolean> {
  if (!supported) return false;
  ensureHandler();
  try {
    const { status } = await Notifications.getPermissionsAsync();
    const granted =
      status === 'granted' ? true : (await Notifications.requestPermissionsAsync()).status === 'granted';
    if (!granted) return false;

    await Notifications.cancelScheduledNotificationAsync(REMINDER_ID).catch(() => undefined);
    await Notifications.scheduleNotificationAsync({
      identifier: REMINDER_ID,
      content: { title: 'Khil', body: reminderBody(childName) },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: 17, minute: 0 },
    });
    return true;
  } catch {
    // A reminder that fails to schedule is a missed convenience, not a broken app.
    return false;
  }
}

export async function disableDailyReminder(): Promise<void> {
  if (!supported) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(REMINDER_ID);
  } catch {
    /* already gone, or never scheduled — either way, nothing to do */
  }
}

export const REMINDERS_SUPPORTED = supported;
