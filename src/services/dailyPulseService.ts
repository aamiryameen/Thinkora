/**
 * Daily Pulse — a 60-second end-of-day check-in.
 *
 * State stored under `@thinkora/daily_pulse_v1` in AsyncStorage:
 *  • `completedDates`   — every YYYY-MM-DD where the Pulse was finished
 *  • `pulseStreak`      — consecutive completed days (separate from the
 *                         general activity streak)
 *  • `longestPulseStreak`
 *  • `lastCompletedDate`
 *  • `oneThings`        — array of { date, title, taskId, completed } so the
 *                         weekly recap can show last week's seven "wins"
 *  • `notifyHour`       — hour of day for the Pulse reminder (default 20)
 *
 * Notification: a single repeating daily trigger at `notifyHour:00`. Skipped
 * silently when already completed today.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { dayKey } from './streakService';

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

const STORAGE_KEY = '@thinkora/daily_pulse_v1';
const CHANNEL_PULSE = 'thinkora-pulse';
const NOTIF_ID = 'daily-pulse-reminder';

export interface PulseOneThing {
  /** YYYY-MM-DD the Pulse was completed (i.e. today when set). */
  date: string;
  /** YYYY-MM-DD the One Thing is for (i.e. tomorrow). */
  forDate: string;
  title: string;
  taskId: string | null;
  completed: boolean;
}

export interface DailyPulseState {
  completedDates: string[];
  pulseStreak: number;
  longestPulseStreak: number;
  lastCompletedDate: string;
  oneThings: PulseOneThing[];
  notifyHour: number; // 0–23, local time
}

const DEFAULT_STATE: DailyPulseState = {
  completedDates: [],
  pulseStreak: 0,
  longestPulseStreak: 0,
  lastCompletedDate: '',
  oneThings: [],
  notifyHour: 20,
};

function yesterdayKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return dayKey(d);
}

function tomorrowKey(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return dayKey(d);
}

export async function loadPulseState(): Promise<DailyPulseState> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

async function savePulseState(s: DailyPulseState): Promise<void> {
  try {
    // Keep oneThings list bounded (last 60 entries is plenty for recap).
    if (s.oneThings.length > 60) s.oneThings = s.oneThings.slice(-60);
    if (s.completedDates.length > 365) s.completedDates = s.completedDates.slice(-365);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch (e) {
    console.warn('[Pulse] save failed', e);
  }
}

export function isPulseDoneToday(s: DailyPulseState): boolean {
  return s.lastCompletedDate === dayKey();
}

/** True if it's past `notifyHour` and the Pulse hasn't been done today. */
export function shouldPromptPulseNow(s: DailyPulseState): boolean {
  if (isPulseDoneToday(s)) return false;
  return new Date().getHours() >= s.notifyHour;
}

/**
 * Mark today's Pulse as complete, advance the Pulse streak, and record the
 * "One Thing" for tomorrow. Returns the updated state.
 */
export async function completePulse(opts: {
  oneThingTitle: string;
  oneThingTaskId: string | null;
}): Promise<DailyPulseState> {
  const state = await loadPulseState();
  const today = dayKey();

  // Already done — keep idempotent (don't double-advance the streak).
  if (state.lastCompletedDate === today) {
    return state;
  }

  // Streak: continues if completed yesterday, otherwise resets to 1.
  if (state.lastCompletedDate === yesterdayKey()) {
    state.pulseStreak += 1;
  } else {
    state.pulseStreak = 1;
  }

  state.lastCompletedDate = today;
  if (!state.completedDates.includes(today)) {
    state.completedDates.push(today);
  }
  if (state.pulseStreak > state.longestPulseStreak) {
    state.longestPulseStreak = state.pulseStreak;
  }

  if (opts.oneThingTitle.trim().length > 0) {
    state.oneThings.push({
      date: today,
      forDate: tomorrowKey(),
      title: opts.oneThingTitle.trim(),
      taskId: opts.oneThingTaskId,
      completed: false,
    });
  }

  await savePulseState(state);
  return state;
}

/** Update notify hour & re-schedule. */
export async function setPulseNotifyHour(hour: number): Promise<DailyPulseState> {
  const state = await loadPulseState();
  state.notifyHour = Math.max(0, Math.min(23, hour));
  await savePulseState(state);
  await schedulePulseNotification();
  return state;
}

/** Mark a recorded One Thing as completed (called when its task is finished). */
export async function markOneThingCompleted(taskId: string): Promise<void> {
  const state = await loadPulseState();
  let changed = false;
  for (const o of state.oneThings) {
    if (o.taskId === taskId && !o.completed) {
      o.completed = true;
      changed = true;
    }
  }
  if (changed) await savePulseState(state);
}

async function ensureChannel(): Promise<void> {
  if (!notifee) return;
  await notifee.createChannel({
    id: CHANNEL_PULSE,
    name: 'Daily Pulse',
    importance: 4,
    sound: 'default',
    vibration: true,
  });
}

/** Schedule (or reschedule) the daily Pulse reminder. */
export async function schedulePulseNotification(): Promise<void> {
  if (Platform.OS !== 'android' || !notifee) return;
  await ensureChannel();

  const state = await loadPulseState();

  try { await notifee.cancelNotification(NOTIF_ID); } catch {}

  // Next occurrence of `notifyHour:00` local time.
  const fireAt = new Date();
  fireAt.setHours(state.notifyHour, 0, 0, 0);
  if (fireAt.getTime() <= Date.now()) fireAt.setDate(fireAt.getDate() + 1);

  await notifee.createTriggerNotification(
    {
      id: NOTIF_ID,
      title: '🌅 Your Daily Pulse is ready',
      body: '60 seconds to wrap up today and set tomorrow up for a win.',
      android: {
        channelId: CHANNEL_PULSE,
        sound: 'default',
        pressAction: { id: 'default' },
      },
      data: { type: 'daily-pulse' },
    },
    {
      type: TriggerType?.TIMESTAMP ?? 0,
      timestamp: fireAt.getTime(),
      alarmManager: true,
      repeatFrequency: RepeatFrequency?.DAILY,
    },
  );
}

export async function cancelPulseNotification(): Promise<void> {
  if (Platform.OS !== 'android' || !notifee) return;
  try { await notifee.cancelNotification(NOTIF_ID); } catch {}
}

/** Group completed dates into a heat-map-friendly array. */
export function pulseHeatmapData(s: DailyPulseState): { date: string; count: number }[] {
  return s.completedDates.map((d) => ({ date: d, count: 1 }));
}
