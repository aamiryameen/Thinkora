/**
 * Streak notification service — keeps the user coming back with two nudges:
 *
 *  1. Daily 8 PM "don't break your streak" if they haven't been active yet.
 *  2. Sunday 8 PM weekly recap of the streak progress.
 *
 * Both notifications are scheduled with `alarmManager: true` so they fire
 * even when the app is closed. The 8 PM nudge is rescheduled every app open
 * so its body reflects the current streak number; on the day it fires
 * (`onForegroundEvent`), we drop it if the user already qualified for the day.
 */

import { Platform } from 'react-native';
import { loadStreak, isActiveToday } from './streakService';

let notifee: any = null;
let TriggerType: any = null;
let RepeatFrequency: any = null;
if (Platform.OS === 'android') {
  try {
    const n = require('@notifee/react-native').default;
    const types = require('@notifee/react-native');
    notifee = n;
    TriggerType = types.TriggerType ?? { TIMESTAMP: 0 };
    RepeatFrequency = types.RepeatFrequency ?? { NONE: -1, DAILY: 1, WEEKLY: 2 };
  } catch {}
}

const CHANNEL_STREAK = 'thinkora-streak';
const NUDGE_ID = 'streak-nudge-8pm';
const RECAP_ID = 'streak-weekly-recap';

async function ensureChannel(): Promise<void> {
  if (!notifee) return;
  await notifee.createChannel({
    id: CHANNEL_STREAK,
    name: 'Streaks',
    importance: 4,
    sound: 'default',
    vibration: true,
  });
}

/** Next occurrence of the given hour today/tomorrow (local). */
function nextDailyAt(hour: number, minute = 0): Date {
  const t = new Date();
  t.setHours(hour, minute, 0, 0);
  if (t.getTime() <= Date.now()) t.setDate(t.getDate() + 1);
  return t;
}

/** Next occurrence of Sunday at the given hour (local). */
function nextSundayAt(hour: number, minute = 0): Date {
  const t = new Date();
  // 0 = Sunday in JS
  const daysAhead = (7 - t.getDay()) % 7;
  t.setDate(t.getDate() + daysAhead);
  t.setHours(hour, minute, 0, 0);
  if (t.getTime() <= Date.now()) t.setDate(t.getDate() + 7);
  return t;
}

/**
 * Schedule the 8 PM "don't break your streak" nudge. We only schedule when
 * the user has something to lose (currentStreak >= 3) so newer users aren't
 * pestered. Re-call on app open to refresh the body text.
 */
export async function scheduleStreakNudge(): Promise<void> {
  if (Platform.OS !== 'android' || !notifee) return;
  await ensureChannel();

  const streak = await loadStreak();

  // Already active today — no point firing tonight; it'll re-evaluate tomorrow.
  if (isActiveToday(streak) || streak.currentStreak < 3) {
    try { await notifee.cancelNotification(NUDGE_ID); } catch {}
    return;
  }

  try { await notifee.cancelNotification(NUDGE_ID); } catch {}

  const fireAt = nextDailyAt(20); // 8 PM
  await notifee.createTriggerNotification(
    {
      id: NUDGE_ID,
      title: `🔥 Don't break your ${streak.currentStreak}-day streak`,
      body: `30 seconds — finish a task, jot a note, or check a habit to keep it going.`,
      android: {
        channelId: CHANNEL_STREAK,
        sound: 'default',
        pressAction: { id: 'default' },
      },
      data: { type: 'streak-nudge', streak: String(streak.currentStreak) },
    },
    {
      type: TriggerType?.TIMESTAMP ?? 0,
      timestamp: fireAt.getTime(),
      alarmManager: true,
      // No repeatFrequency — we re-schedule each app open so the body
      // reflects the latest streak number.
    },
  );
}

/**
 * Schedule the weekly recap on Sunday 8 PM. Uses WEEKLY repeat so it fires
 * every Sunday automatically without needing a re-schedule.
 */
export async function scheduleWeeklyRecap(): Promise<void> {
  if (Platform.OS !== 'android' || !notifee) return;
  await ensureChannel();

  const streak = await loadStreak();
  // Skip the recap when there's nothing to celebrate.
  if (streak.currentStreak === 0 && streak.longestStreak === 0) return;

  try { await notifee.cancelNotification(RECAP_ID); } catch {}

  const fireAt = nextSundayAt(20);
  const body =
    streak.currentStreak >= streak.longestStreak && streak.currentStreak > 0
      ? `🏆 ${streak.currentStreak} days — your longest streak yet!`
      : `🔥 ${streak.currentStreak}-day streak this week. Keep showing up.`;

  await notifee.createTriggerNotification(
    {
      id: RECAP_ID,
      title: 'Your week in Thinkora',
      body,
      android: {
        channelId: CHANNEL_STREAK,
        sound: 'default',
        pressAction: { id: 'default' },
      },
      data: { type: 'streak-recap' },
    },
    {
      type: TriggerType?.TIMESTAMP ?? 0,
      timestamp: fireAt.getTime(),
      alarmManager: true,
      repeatFrequency: RepeatFrequency?.WEEKLY,
    },
  );
}

export async function cancelStreakNotifications(): Promise<void> {
  if (Platform.OS !== 'android' || !notifee) return;
  try { await notifee.cancelNotification(NUDGE_ID); } catch {}
  try { await notifee.cancelNotification(RECAP_ID); } catch {}
}
