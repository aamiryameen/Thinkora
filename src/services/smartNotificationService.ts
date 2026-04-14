/**
 * Smart Notification Service
 *
 * Handles:
 * 1. Smart deadline reminders  — auto-schedule a reminder 1 day before task due date
 * 2. Daily digest              — 8 AM morning summary of today's tasks + habits
 * 3. Overdue task alerts       — notify when tasks become overdue (checked at 9 AM daily)
 */

import { Platform } from 'react-native';
import type { Task, Habit } from '../types';

let notifee: any = null;
let TriggerType: any = null;
let RepeatFrequency: any = null;
if (Platform.OS === 'android') {
  try {
    const n = require('@notifee/react-native').default;
    const types = require('@notifee/react-native');
    notifee = n;
    TriggerType = types.TriggerType ?? { TIMESTAMP: 0, INTERVAL: 1 };
    RepeatFrequency = types.RepeatFrequency ?? { NONE: -1, HOURLY: 0, DAILY: 1, WEEKLY: 2 };
  } catch {}
}

const CHANNEL_SMART = 'thinkora-smart';
const CHANNEL_DIGEST = 'thinkora-digest';
const CHANNEL_OVERDUE = 'thinkora-overdue';

async function ensureChannels() {
  if (!notifee) return;
  await notifee.createChannel({ id: CHANNEL_SMART, name: 'Smart Reminders', importance: 4, sound: 'default', vibration: true });
  await notifee.createChannel({ id: CHANNEL_DIGEST, name: 'Morning Digest', importance: 3, sound: 'default' });
  await notifee.createChannel({ id: CHANNEL_OVERDUE, name: 'Overdue Alerts', importance: 4, sound: 'default', vibration: true });
}

// ─── 1. Smart Deadline Reminders ─────────────────────────────────────────────

/**
 * Schedule a "1 day before due" reminder for a task.
 * Safe to call every time a task's dueDate changes — cancels old one first.
 */
export async function scheduleSmartDeadlineReminder(task: Task): Promise<void> {
  if (Platform.OS !== 'android' || !notifee || !task.dueDate || task.completed) return;
  await ensureChannels();

  const reminderTs = task.dueDate - 24 * 60 * 60 * 1000; // 1 day before
  if (reminderTs <= Date.now()) return; // already past

  // Cancel any existing smart reminder for this task
  await cancelSmartDeadlineReminder(task.id);

  const trigger = {
    type: TriggerType.TIMESTAMP,
    timestamp: reminderTs,
    alarmManager: true,
  };

  await notifee.createTriggerNotification(
    {
      id: `smart-deadline-${task.id}`,
      title: '⏰ Due tomorrow',
      body: task.title,
      android: {
        channelId: CHANNEL_SMART,
        sound: 'default',
        pressAction: { id: 'default' },
        actions: [
          { title: 'Mark done', pressAction: { id: `complete-${task.id}`, launchActivity: 'default' } },
          { title: 'Snooze 1h', pressAction: { id: 'snooze_60', launchActivity: 'default' } },
        ],
      },
      data: { taskId: task.id, type: 'smart-deadline' },
    },
    trigger
  );
}

export async function cancelSmartDeadlineReminder(taskId: string): Promise<void> {
  if (Platform.OS !== 'android' || !notifee) return;
  try {
    await notifee.cancelNotification(`smart-deadline-${taskId}`);
  } catch {}
}

/** Call this whenever tasks list changes to sync smart reminders */
export async function syncSmartDeadlineReminders(tasks: Task[]): Promise<void> {
  if (Platform.OS !== 'android' || !notifee) return;
  for (const task of tasks) {
    if (!task.completed && task.dueDate && task.dueDate - Date.now() > 0) {
      await scheduleSmartDeadlineReminder(task);
    } else {
      await cancelSmartDeadlineReminder(task.id);
    }
  }
}

// ─── 2. Daily Digest ─────────────────────────────────────────────────────────

const DIGEST_NOTIF_ID = 'daily-digest';

/**
 * Schedule (or re-schedule) the daily 8 AM morning summary notification.
 * Uses DAILY repeat so it fires every morning automatically.
 */
export async function scheduleDailyDigest(tasks: Task[], habits: Habit[]): Promise<void> {
  if (Platform.OS !== 'android' || !notifee) return;
  await ensureChannels();

  // Cancel existing
  try { await notifee.cancelNotification(DIGEST_NOTIF_ID); } catch {}

  // Next 8:00 AM
  const now = new Date();
  const next8am = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0, 0, 0);
  if (next8am.getTime() <= Date.now()) {
    next8am.setDate(next8am.getDate() + 1);
  }

  const todayTasks = tasks.filter((t) => {
    if (t.completed) return false;
    if (!t.dueDate) return false;
    const d = new Date(t.dueDate);
    return d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
  });

  const activeHabits = habits.filter((h) => !h.archived);
  const body = buildDigestBody(todayTasks, activeHabits);

  const trigger = {
    type: TriggerType.TIMESTAMP,
    timestamp: next8am.getTime(),
    alarmManager: true,
    repeatFrequency: RepeatFrequency.DAILY,
  };

  await notifee.createTriggerNotification(
    {
      id: DIGEST_NOTIF_ID,
      title: `☀️ Good morning! ${greetingEmoji()}`,
      body,
      android: {
        channelId: CHANNEL_DIGEST,
        sound: 'default',
        pressAction: { id: 'default' },
      },
      data: { type: 'daily-digest' },
    },
    trigger
  );
}

export async function cancelDailyDigest(): Promise<void> {
  if (Platform.OS !== 'android' || !notifee) return;
  try { await notifee.cancelNotification(DIGEST_NOTIF_ID); } catch {}
}

function buildDigestBody(todayTasks: Task[], habits: Habit[]): string {
  const parts: string[] = [];
  if (todayTasks.length > 0) {
    parts.push(`${todayTasks.length} task${todayTasks.length !== 1 ? 's' : ''} due today`);
  } else {
    parts.push('No tasks due today');
  }
  if (habits.length > 0) {
    parts.push(`${habits.length} habit${habits.length !== 1 ? 's' : ''} to track`);
  }
  return parts.join(' · ');
}

function greetingEmoji(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Here\'s your morning summary';
  if (h < 17) return 'Here\'s your afternoon summary';
  return 'Here\'s your evening summary';
}

// ─── 3. Overdue Task Alerts ───────────────────────────────────────────────────

const OVERDUE_NOTIF_ID = 'overdue-alert';

/**
 * Check for overdue tasks and fire a notification if any exist.
 * Also schedules a daily 9 AM repeat check.
 */
export async function scheduleOverdueCheck(tasks: Task[]): Promise<void> {
  if (Platform.OS !== 'android' || !notifee) return;
  await ensureChannels();

  // Cancel existing overdue notification
  try { await notifee.cancelNotification(OVERDUE_NOTIF_ID); } catch {}

  const now = Date.now();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const overdue = tasks.filter((t) =>
    !t.completed && t.dueDate && t.dueDate < today.getTime()
  );

  if (overdue.length === 0) {
    // Schedule next 9 AM check even if nothing overdue now
    await scheduleNextOverdueCheck();
    return;
  }

  // Fire immediately (or at 9 AM if before then)
  const now9am = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 9, 0, 0, 0);
  const fireTs = now9am.getTime() <= now ? now + 5000 : now9am.getTime(); // 5s delay if already past 9am

  const titles = overdue.slice(0, 3).map((t) => `• ${t.title}`).join('\n');
  const body = overdue.length > 3
    ? `${titles}\n…and ${overdue.length - 3} more`
    : titles;

  const trigger = {
    type: TriggerType.TIMESTAMP,
    timestamp: fireTs,
    alarmManager: true,
  };

  await notifee.createTriggerNotification(
    {
      id: OVERDUE_NOTIF_ID,
      title: `⚠️ ${overdue.length} overdue task${overdue.length !== 1 ? 's' : ''}`,
      body,
      android: {
        channelId: CHANNEL_OVERDUE,
        sound: 'default',
        pressAction: { id: 'default' },
      },
      data: { type: 'overdue-alert' },
    },
    trigger
  );

  // Also schedule the next daily check
  await scheduleNextOverdueCheck();
}

/** Schedules a silent 9 AM daily trigger to re-check overdue tasks on next app open */
async function scheduleNextOverdueCheck(): Promise<void> {
  if (!notifee) return;
  // We use a separate ID so it doesn't conflict with the visible overdue notification
  try { await notifee.cancelNotification('overdue-check-trigger'); } catch {}

  const now = new Date();
  const next9am = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0, 0);
  if (next9am.getTime() <= Date.now()) next9am.setDate(next9am.getDate() + 1);

  const trigger = {
    type: TriggerType.TIMESTAMP,
    timestamp: next9am.getTime(),
    alarmManager: true,
    repeatFrequency: RepeatFrequency.DAILY,
  };

  // This fires a silent notification that wakes the app's background handler
  await notifee.createTriggerNotification(
    {
      id: 'overdue-check-trigger',
      title: 'Thinkora',
      body: 'Checking overdue tasks...',
      android: {
        channelId: CHANNEL_OVERDUE,
        pressAction: { id: 'default' },
        // Make it low-profile — user won't see this one in practice
        importance: 1,
        sound: undefined,
        vibrationPattern: [],
      },
      data: { type: 'overdue-check' },
    },
    trigger
  );
}
