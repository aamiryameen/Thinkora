/**
 * Smart Notification Service
 *
 * Handles:
 * 1. Smart deadline reminders  — auto-schedule a reminder 1 day before task due date
 * 2. Daily digest              — 8 AM morning summary of today's tasks + habits
 * 3. Overdue task alerts       — notify when tasks become overdue (checked at 9 AM daily)
 */

import { Platform } from 'react-native';
import { loadStreak } from './streakService';
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
const CHANNEL_REFLECTION = 'thinkora-reflection';
const CHANNEL_WEEKLY = 'thinkora-weekly';
const CHANNEL_FORGOT = 'thinkora-forgot';

async function ensureChannels() {
  if (!notifee) return;
  await notifee.createChannel({ id: CHANNEL_SMART, name: 'Smart Reminders', importance: 4, sound: 'default', vibration: true });
  await notifee.createChannel({ id: CHANNEL_DIGEST, name: 'Morning Digest', importance: 3, sound: 'default' });
  await notifee.createChannel({ id: CHANNEL_OVERDUE, name: 'Overdue Alerts', importance: 4, sound: 'default', vibration: true });
  await notifee.createChannel({ id: CHANNEL_REFLECTION, name: 'Evening Reflection', importance: 3, sound: 'default' });
  await notifee.createChannel({ id: CHANNEL_WEEKLY, name: 'Weekly Review', importance: 4, sound: 'default' });
  await notifee.createChannel({ id: CHANNEL_FORGOT, name: 'Habit Reminders', importance: 3, sound: 'default' });
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
  const streakData = await loadStreak();
  const body = buildDigestBody(todayTasks, activeHabits, streakData.currentStreak);

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

function buildDigestBody(todayTasks: Task[], habits: Habit[], streak: number): string {
  const parts: string[] = [];
  if (todayTasks.length > 0) {
    parts.push(`${todayTasks.length} task${todayTasks.length !== 1 ? 's' : ''} due`);
  } else {
    parts.push('No tasks due');
  }
  if (habits.length > 0) {
    parts.push(`${habits.length} habit${habits.length !== 1 ? 's' : ''} to track`);
  }
  if (streak > 0) {
    parts.push(`${streak}-day streak 🔥 — don't break it!`);
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

// ─── 4. Evening Reflection (8 PM Daily) ──────────────────────────────────────

const REFLECTION_NOTIF_ID = 'evening-reflection';

/**
 * Schedule 8 PM daily "How was your day?" notification.
 * Tapping opens the mood journal.
 */
export async function scheduleEveningReflection(): Promise<void> {
  if (Platform.OS !== 'android' || !notifee) return;
  await ensureChannels();

  try { await notifee.cancelNotification(REFLECTION_NOTIF_ID); } catch {}

  const now = new Date();
  const next8pm = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 20, 0, 0, 0);
  if (next8pm.getTime() <= Date.now()) {
    next8pm.setDate(next8pm.getDate() + 1);
  }

  const trigger = {
    type: TriggerType.TIMESTAMP,
    timestamp: next8pm.getTime(),
    alarmManager: true,
    repeatFrequency: RepeatFrequency.DAILY,
  };

  await notifee.createTriggerNotification(
    {
      id: REFLECTION_NOTIF_ID,
      title: '🌙 How was your day?',
      body: 'Take 30 seconds to reflect — your streak depends on it!',
      android: {
        channelId: CHANNEL_REFLECTION,
        sound: 'default',
        pressAction: { id: 'default', launchActivity: 'default' },
      },
      data: { type: 'reflection', screen: 'MoodJournal' },
    },
    trigger
  );
}

export async function cancelEveningReflection(): Promise<void> {
  if (Platform.OS !== 'android' || !notifee) return;
  try { await notifee.cancelNotification(REFLECTION_NOTIF_ID); } catch {}
}

// ─── 5. Weekly Review (Sunday 6 PM) ──────────────────────────────────────────

const WEEKLY_NOTIF_ID = 'weekly-review';

/**
 * Schedule Sunday 6 PM weekly review notification.
 */
export async function scheduleWeeklyReview(tasks: Task[], habits: Habit[]): Promise<void> {
  if (Platform.OS !== 'android' || !notifee) return;
  await ensureChannels();

  try { await notifee.cancelNotification(WEEKLY_NOTIF_ID); } catch {}

  // Next Sunday at 6 PM
  const now = new Date();
  const daysUntilSunday = (7 - now.getDay()) % 7 || 7; // if today is Sunday, go to next Sunday
  const nextSunday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntilSunday, 18, 0, 0, 0);
  // If today IS Sunday and it's before 6 PM, use today
  if (now.getDay() === 0 && now.getHours() < 18) {
    nextSunday.setDate(now.getDate());
  }
  if (nextSunday.getTime() <= Date.now()) {
    nextSunday.setDate(nextSunday.getDate() + 7);
  }

  const completedThisWeek = tasks.filter(t => {
    if (!t.completed) return false;
    const weekAgo = Date.now() - 7 * 86400000;
    return t.updatedAt >= weekAgo;
  }).length;

  const activeHabits = habits.filter(h => !h.archived).length;

  const trigger = {
    type: TriggerType.TIMESTAMP,
    timestamp: nextSunday.getTime(),
    alarmManager: true,
    repeatFrequency: RepeatFrequency.WEEKLY,
  };

  await notifee.createTriggerNotification(
    {
      id: WEEKLY_NOTIF_ID,
      title: '📊 Your weekly review is ready',
      body: completedThisWeek > 0
        ? `You completed ${completedThisWeek} task${completedThisWeek !== 1 ? 's' : ''} this week. See your insights!`
        : 'Check your weekly progress and insights.',
      android: {
        channelId: CHANNEL_WEEKLY,
        sound: 'default',
        pressAction: { id: 'default', launchActivity: 'default' },
      },
      data: { type: 'weekly-review', screen: 'Reports' },
    },
    trigger
  );
}

export async function cancelWeeklyReview(): Promise<void> {
  if (Platform.OS !== 'android' || !notifee) return;
  try { await notifee.cancelNotification(WEEKLY_NOTIF_ID); } catch {}
}

// ─── 6. "Forgot Something?" Habit Alerts ─────────────────────────────────────

/**
 * Schedule reminders for habits with a `reminderTime` (HH:mm).
 * Fires only if the habit wasn't completed today.
 *
 * Note: notifee delivers these at the configured time. We rely on each habit's
 * own reminderTime (user-set). Runs silently if already completed today.
 */
export async function syncHabitReminders(habits: Habit[]): Promise<void> {
  if (Platform.OS !== 'android' || !notifee) return;
  await ensureChannels();

  for (const habit of habits) {
    const notifId = `habit-reminder-${habit.id}`;
    try { await notifee.cancelNotification(notifId); } catch {}

    if (habit.archived || !habit.reminderTime) continue;

    const [hh, mm] = habit.reminderTime.split(':').map(Number);
    if (Number.isNaN(hh) || Number.isNaN(mm)) continue;

    const now = new Date();
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const completedToday = (habit.completedDates ?? []).includes(todayKey);

    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm, 0, 0);
    if (next.getTime() <= Date.now() || completedToday) {
      next.setDate(next.getDate() + 1);
    }

    const trigger = {
      type: TriggerType.TIMESTAMP,
      timestamp: next.getTime(),
      alarmManager: true,
      repeatFrequency: RepeatFrequency.DAILY,
    };

    await notifee.createTriggerNotification(
      {
        id: notifId,
        title: `${habit.icon || '⏰'} Forgot something?`,
        body: `Time for your habit: ${habit.name}`,
        android: {
          channelId: CHANNEL_FORGOT,
          sound: 'default',
          pressAction: { id: 'default', launchActivity: 'default' },
        },
        data: { type: 'habit-reminder', habitId: habit.id, screen: 'HabitTracker' },
      },
      trigger
    );
  }
}
