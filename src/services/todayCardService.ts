/**
 * Today Card service — assembles the data shown in the daily share card.
 *
 * Pure function. The screen feeds in tasks/habits/pomodoro/journal/streak/pulse
 * state and gets back a flat object ready to render.
 */

import type { Task, Habit, JournalEntry, PomodoroSession } from '../types';
import { dayKey, type StreakData } from './streakService';
import type { DailyPulseState } from './dailyPulseService';
import { getDailyQuote } from '../core/quotes';

export interface TodayCardData {
  /** "YYYY-MM-DD" the card represents (today by default). */
  dateKey: string;
  /** "Tuesday, May 12" formatted. */
  longDate: string;

  // Stats
  tasksDone: number;
  tasksTotal: number;
  habitsDone: number;
  habitsTotal: number;
  pomodoroCount: number;
  pomodoroMinutes: number;
  journaledMood: number | null;     // 1–5 if journaled today, else null
  journaledEmoji: string | null;    // 😞 😕 😐 🙂 😄 if journaled

  // Streaks
  activityStreak: number;
  pulseStreak: number;
  isLongestStreak: boolean;
  perfectDay: boolean;              // streak ✓ + 100% tasks + 100% habits

  // Tomorrow
  tomorrowOneThing: string | null;

  // Flavor
  quote: string;
  badgeText: string | null;         // "🏆 Perfect Day" / "🥇 New Record" / null
  framing: 'hero' | 'gentle';       // hero for 🔥 days, gentle for low-activity
}

const MOOD_EMOJI: Record<number, string> = {
  1: '😞',
  2: '😕',
  3: '😐',
  4: '🙂',
  5: '😄',
};

interface BuildOpts {
  tasks: Task[];
  habits: Habit[];
  journalEntries: JournalEntry[];
  pomodoroSessions: PomodoroSession[];
  streak: StreakData;
  pulse: DailyPulseState;
  /** Optional override for testing. Defaults to today. */
  forDate?: Date;
}

export function buildTodayCard(opts: BuildOpts): TodayCardData {
  const date = opts.forDate ?? new Date();
  const key = dayKey(date);

  // ── Tasks completed today (by completion timestamp OR due-today) ────────
  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const dayEnd = dayStart + 86400000;
  const tasksToday = opts.tasks.filter((t) => {
    if (!t.dueDate) return false;
    return t.dueDate >= dayStart && t.dueDate < dayEnd;
  });
  const tasksTotal = tasksToday.length;
  const tasksDone = tasksToday.filter((t) => t.completed).length;

  // ── Habits ──────────────────────────────────────────────────────────────
  const activeHabits = opts.habits.filter((h) => !h.archived);
  const habitsTotal = activeHabits.length;
  const habitsDone = activeHabits.filter((h) => h.completedDates.includes(key)).length;

  // ── Pomodoro: only "work" sessions completed today ──────────────────────
  const pomodoroToday = opts.pomodoroSessions.filter(
    (s) => s.type === 'work' && s.completedAt >= dayStart && s.completedAt < dayEnd,
  );
  const pomodoroCount = pomodoroToday.length;
  const pomodoroMinutes = pomodoroToday.reduce((sum, s) => sum + (s.duration ?? 0), 0);

  // ── Journal mood for today ──────────────────────────────────────────────
  const todayEntry = opts.journalEntries.find((e) => e.date === key);
  const journaledMood = todayEntry ? todayEntry.mood : null;
  const journaledEmoji = journaledMood ? MOOD_EMOJI[journaledMood] : null;

  // ── Streak flags ────────────────────────────────────────────────────────
  const activityStreak = opts.streak.currentStreak;
  const pulseStreak = opts.pulse.pulseStreak;
  const isLongestStreak =
    activityStreak > 0 && activityStreak >= opts.streak.longestStreak;

  // Perfect day: kept the streak AND completed all tasks AND all habits
  // (only counts if there were tasks/habits to do).
  const tasksPerfect = tasksTotal > 0 && tasksDone === tasksTotal;
  const habitsPerfect = habitsTotal > 0 && habitsDone === habitsTotal;
  const streakKept = opts.streak.lastActiveDate === key;
  const perfectDay = streakKept && (tasksPerfect || tasksTotal === 0) &&
    (habitsPerfect || habitsTotal === 0) &&
    (tasksTotal > 0 || habitsTotal > 0);

  // ── Tomorrow's One Thing (set during today's Pulse) ─────────────────────
  const tomorrowKey = dayKey(new Date(date.getTime() + 86400000));
  const oneThingForTomorrow = [...opts.pulse.oneThings]
    .reverse()
    .find((o) => o.forDate === tomorrowKey);
  const tomorrowOneThing = oneThingForTomorrow?.title ?? null;

  // ── Badge ───────────────────────────────────────────────────────────────
  let badgeText: string | null = null;
  if (perfectDay) badgeText = '🏆 Perfect Day';
  else if (isLongestStreak && activityStreak >= 7) badgeText = '🥇 New Record';
  else if (activityStreak > 0 && activityStreak % 7 === 0) badgeText = `🔥 ${activityStreak} days strong`;

  // ── Framing: hero for productive days, gentle for sparse ones ──────────
  const totalActivity =
    tasksDone + habitsDone + pomodoroCount + (journaledMood ? 1 : 0) + (streakKept ? 1 : 0);
  const framing: 'hero' | 'gentle' = totalActivity >= 3 ? 'hero' : 'gentle';

  // ── Daily quote (deterministic per date, shared 120-quote rotation) ─────
  const quote = getDailyQuote(date).text;

  const longDate = date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return {
    dateKey: key,
    longDate,
    tasksDone,
    tasksTotal,
    habitsDone,
    habitsTotal,
    pomodoroCount,
    pomodoroMinutes,
    journaledMood,
    journaledEmoji,
    activityStreak,
    pulseStreak,
    isLongestStreak,
    perfectDay,
    tomorrowOneThing,
    quote,
    badgeText,
    framing,
  };
}
