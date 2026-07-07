/**
 * Comeback Engine — re-engagement notifications using the user's actual data.
 *
 * Triggered on every app open. Decides whether to schedule a personalized
 * notification based on how long the user has been inactive, what data they
 * have (broken streak? unfinished one-thing? mood pattern?), and a cooldown
 * so we never spam.
 *
 * Notifications are fired in the future (24h after the trigger) with
 * `alarmManager: true` so they reach the user even when the app is closed.
 * If the user opens the app before the firing time, we cancel the pending
 * notification — they're "back," no need to nag.
 *
 * Levels:
 *   day 1–2 inactive → no comeback (the streak nudge handles this)
 *   day 3            → "your streak missed you" / "your one-thing is waiting"
 *   day 5            → "we noticed your moods last week"
 *   day 7+           → graceful exit "one last hello"
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { dayKey, type StreakData } from './streakService';
import type { DailyPulseState } from './dailyPulseService';
import type { JournalEntry } from '../types';

let notifee: any = null;
let TriggerType: any = null;
if (Platform.OS === 'android') {
  try {
    const n = require('@notifee/react-native').default;
    const types = require('@notifee/react-native');
    notifee = n;
    TriggerType = types.TriggerType ?? { TIMESTAMP: 0 };
  } catch {}
}

const STORAGE_KEY = '@thinkora/comeback_v1';
const CHANNEL_ID = 'thinkora-comeback';
const NOTIF_ID = 'comeback-nudge';

/** Don't fire a comeback nudge more than once every 48h, regardless of how
 *  many times the user opens the app. Avoids alert fatigue. */
const COOLDOWN_MS = 48 * 60 * 60 * 1000;

interface ComebackState {
  lastNudgeFiredAt: number;
  lastNudgeLevel: 'streak' | 'one-thing' | 'mood' | 'farewell' | null;
  /** True after we've fired the day-7 graceful exit. Set only once per
   *  inactivity period — clears when user becomes active again. */
  farewellFired: boolean;
}

const DEFAULT_STATE: ComebackState = {
  lastNudgeFiredAt: 0,
  lastNudgeLevel: null,
  farewellFired: false,
};

async function loadState(): Promise<ComebackState> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

async function saveState(s: ComebackState): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {}
}

async function ensureChannel(): Promise<void> {
  if (!notifee) return;
  await notifee.createChannel({
    id: CHANNEL_ID,
    name: 'Comeback Nudges',
    importance: 3,
    sound: 'default',
    vibration: true,
  });
}

function daysSince(dateStr: string): number {
  if (!dateStr) return 999;
  const last = new Date(dateStr + 'T00:00:00').getTime();
  const today = new Date(dayKey() + 'T00:00:00').getTime();
  return Math.max(0, Math.round((today - last) / 86400000));
}

interface BuildOpts {
  streak: StreakData;
  pulse: DailyPulseState;
  journalEntries: JournalEntry[];
}

/** Decide which message (if any) to fire. Returns null when nothing applies. */
function chooseNudge(opts: BuildOpts): { title: string; body: string; level: ComebackState['lastNudgeLevel'] } | null {
  const inactiveDays = daysSince(opts.streak.lastActiveDate);

  // Day 1–2: handled elsewhere (streak nudge / Pulse reminder).
  if (inactiveDays < 3) return null;

  // Day 7+ → graceful exit (only once per inactivity period).
  if (inactiveDays >= 7) {
    return {
      title: "One last hello 👋",
      body: "It's been a week. We won't bother you again unless you come back.",
      level: 'farewell',
    };
  }

  // Day 3–6 → pick the most personally-relevant message.
  // Priority: unfinished One Thing > broken streak > mood.

  // Unfinished One Thing for a recent date?
  const recentOneThing = [...opts.pulse.oneThings].reverse().find((o) =>
    !o.completed && daysSince(o.forDate) <= 5,
  );
  if (recentOneThing) {
    return {
      title: '⭐ Your One Thing is still waiting',
      body: `"${recentOneThing.title}" — pick it up where you left off?`,
      level: 'one-thing',
    };
  }

  // Broken streak with something to lose?
  if (opts.streak.longestStreak >= 3) {
    return {
      title: `🔥 Your ${opts.streak.longestStreak}-day streak missed you`,
      body: 'Repair it now — one task is all it takes to start again.',
      level: 'streak',
    };
  }

  // Mood pattern: last entry was happy → curiosity hook.
  const lastEntry = [...opts.journalEntries].sort((a, b) => a.date.localeCompare(b.date)).pop();
  if (lastEntry) {
    const moodEmoji: Record<number, string> = { 1: '😞', 2: '😕', 3: '😐', 4: '🙂', 5: '😄' };
    return {
      title: `Last time you felt ${moodEmoji[lastEntry.mood] ?? '🙂'}`,
      body: "How are you doing now? One tap to log today's mood.",
      level: 'mood',
    };
  }

  // No personalized hook — generic warm welcome back.
  return {
    title: 'Pick up where you left off',
    body: `${inactiveDays} days away. Today is a fresh start.`,
    level: 'streak',
  };
}

/**
 * Call this on every app open. If conditions warrant a comeback nudge AND
 * we're outside the cooldown, schedule one for 24h from now. If the user
 * opens the app before then, the next call will cancel it and reschedule
 * (or not).
 */
export async function evaluateAndScheduleComeback(opts: BuildOpts): Promise<void> {
  if (Platform.OS !== 'android' || !notifee) return;

  const state = await loadState();

  // Active today? Cancel any pending comeback and reset the farewell flag.
  if (opts.streak.lastActiveDate === dayKey()) {
    if (state.farewellFired || state.lastNudgeLevel) {
      try { await notifee.cancelNotification(NOTIF_ID); } catch {}
      state.farewellFired = false;
      state.lastNudgeLevel = null;
      await saveState(state);
    }
    return;
  }

  const nudge = chooseNudge(opts);
  if (!nudge) {
    // Nothing to do. Cancel any stale pending nudge.
    try { await notifee.cancelNotification(NOTIF_ID); } catch {}
    return;
  }

  // Cooldown gate.
  if (Date.now() - state.lastNudgeFiredAt < COOLDOWN_MS) return;

  // Farewell only fires once per inactivity period.
  if (nudge.level === 'farewell' && state.farewellFired) return;

  await ensureChannel();

  // Schedule for 24h from now. Replaces any existing pending one.
  const fireAt = Date.now() + 24 * 60 * 60 * 1000;
  try {
    await notifee.cancelNotification(NOTIF_ID);
  } catch {}

  try {
    await notifee.createTriggerNotification(
      {
        id: NOTIF_ID,
        title: nudge.title,
        body: nudge.body,
        android: {
          channelId: CHANNEL_ID,
          sound: 'default',
          pressAction: { id: 'default' },
          smallIcon: 'ic_launcher',
        },
        data: { type: 'comeback', level: nudge.level ?? 'unknown' },
      },
      {
        type: TriggerType?.TIMESTAMP ?? 0,
        timestamp: fireAt,
        alarmManager: true,
      },
    );
    state.lastNudgeFiredAt = Date.now();
    state.lastNudgeLevel = nudge.level;
    if (nudge.level === 'farewell') state.farewellFired = true;
    await saveState(state);
  } catch {
    // non-fatal
  }
}

/** Cancel any pending comeback notification. */
export async function cancelComeback(): Promise<void> {
  if (Platform.OS !== 'android' || !notifee) return;
  try { await notifee.cancelNotification(NOTIF_ID); } catch {}
}
