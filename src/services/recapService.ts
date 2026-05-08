/**
 * Recap Service — generate a personalized year-in-review summary.
 *
 * Used by:
 *   - Birthday Recap screen (uses the user's set birthday or app-install date)
 *   - Year-End Predictions (December → run-up to January)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { storage } from './storage';
import type { Note, Task, Habit, JournalEntry, PomodoroSession } from '../types';

const BIRTHDAY_KEY = '@thinkora/birthday';
const FIRST_LAUNCH_KEY = '@thinkora/first_launch_at';

export async function getBirthday(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(BIRTHDAY_KEY);
  } catch { return null; }
}

export async function setBirthday(mmdd: string | null): Promise<void> {
  if (mmdd === null) {
    await AsyncStorage.removeItem(BIRTHDAY_KEY);
  } else {
    await AsyncStorage.setItem(BIRTHDAY_KEY, mmdd);
  }
}

/** Tracked at first launch so Birthday Recap can show app-anniversary stats. */
export async function getFirstLaunchTimestamp(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(FIRST_LAUNCH_KEY);
    if (raw) return parseInt(raw, 10);
    const now = Date.now();
    await AsyncStorage.setItem(FIRST_LAUNCH_KEY, String(now));
    return now;
  } catch { return Date.now(); }
}

export interface RecapData {
  rangeStart: number;
  rangeEnd: number;
  totalTasksCompleted: number;
  totalNotes: number;
  totalFocusMinutes: number;
  totalHabitCheckins: number;
  totalJournalEntries: number;
  longestStreak: number;
  busiestMonth: { month: string; count: number };
  topCategory: { name: string; count: number } | null;
  averageMood: number | null;
  funFact: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Build a recap for the past 12 months (or any custom range). */
export function buildRecap(
  rangeStart: number,
  rangeEnd: number,
  data: {
    notes: Note[];
    tasks: Task[];
    habits: Habit[];
    journalEntries: JournalEntry[];
    pomodoroSessions: PomodoroSession[];
    longestStreak: number;
    taskCategories: { id: string; name: string }[];
  },
): RecapData {
  const inRange = (ts: number) => ts >= rangeStart && ts < rangeEnd;
  const inRangeDate = (yyyymmdd: string) => {
    const t = new Date(yyyymmdd + 'T12:00:00').getTime();
    return inRange(t);
  };

  const completedTasks = data.tasks.filter(t => t.completed && inRange(t.updatedAt));
  const newNotes = data.notes.filter(n => inRange(n.createdAt));
  const work = data.pomodoroSessions.filter(s => s.type === 'work' && inRange(s.completedAt));
  const totalFocusMinutes = work.reduce((s, x) => s + x.duration, 0);

  let totalHabitCheckins = 0;
  data.habits.forEach(h => {
    h.completedDates.forEach(d => { if (inRangeDate(d)) totalHabitCheckins += 1; });
  });

  const journalInRange = data.journalEntries.filter(e => inRangeDate(e.date));
  const averageMood = journalInRange.length > 0
    ? journalInRange.reduce((s, e) => s + e.mood, 0) / journalInRange.length
    : null;

  // Busiest month
  const monthlyCounts = new Array(12).fill(0);
  completedTasks.forEach(t => { monthlyCounts[new Date(t.updatedAt).getMonth()] += 1; });
  newNotes.forEach(n => { monthlyCounts[new Date(n.createdAt).getMonth()] += 1; });
  let busiestIdx = 0;
  for (let i = 1; i < 12; i++) if (monthlyCounts[i] > monthlyCounts[busiestIdx]) busiestIdx = i;

  // Top category by tasks completed
  const catCounts: Record<string, number> = {};
  completedTasks.forEach(t => {
    if (t.categoryId) catCounts[t.categoryId] = (catCounts[t.categoryId] ?? 0) + 1;
  });
  let topCategory: { name: string; count: number } | null = null;
  Object.entries(catCounts).forEach(([id, count]) => {
    if (!topCategory || count > topCategory.count) {
      const cat = data.taskCategories.find(c => c.id === id);
      topCategory = { name: cat?.name ?? 'Unknown', count };
    }
  });

  // Fun fact
  const totalEvents = completedTasks.length + newNotes.length + totalHabitCheckins;
  const wordsWritten = newNotes.reduce((s, n) => s + (n.plainText?.split(/\s+/).filter(Boolean).length ?? 0), 0);
  const funFacts = [
    `You wrote ${wordsWritten.toLocaleString()} words across your notes.`,
    `You completed an average of ${Math.round(completedTasks.length / 12)} tasks per month.`,
    `You spent ${Math.round(totalFocusMinutes / 60)} hours in focused work.`,
    `You created ${newNotes.length} notes — that's roughly ${Math.round(newNotes.length / 52)} per week.`,
    `You crossed ${totalEvents} milestones this year.`,
  ];
  const funFact = funFacts[Math.floor(Math.random() * funFacts.length)];

  return {
    rangeStart, rangeEnd,
    totalTasksCompleted: completedTasks.length,
    totalNotes: newNotes.length,
    totalFocusMinutes,
    totalHabitCheckins,
    totalJournalEntries: journalInRange.length,
    longestStreak: data.longestStreak,
    busiestMonth: { month: MONTHS[busiestIdx], count: monthlyCounts[busiestIdx] },
    topCategory,
    averageMood,
    funFact,
  };
}

/** Year-end predictions: simple linear extrapolation from current trends. */
export interface YearEndPrediction {
  predictedTasks: number;
  predictedFocusHours: number;
  predictedStreak: number;
  topHabit: string | null;
  message: string;
}

export function buildYearEndPrediction(recap: RecapData, currentStreak: number): YearEndPrediction {
  const now = new Date();
  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 86400000) + 1;
  const remainingFraction = (365 - dayOfYear) / 365;

  const predictedTasks = Math.round(recap.totalTasksCompleted * (1 + remainingFraction * (365 / dayOfYear - 1)));
  const predictedFocusHours = Math.round((recap.totalFocusMinutes / 60) * (365 / dayOfYear));
  const predictedStreak = Math.max(currentStreak, recap.longestStreak);

  const message = remainingFraction > 0.5
    ? `You're on track for a strong year! Keep the momentum going.`
    : remainingFraction > 0.1
      ? `Big year ahead. Finish strong over the next few months.`
      : `What an incredible year. Just a few weeks left to lock in your wins.`;

  return {
    predictedTasks,
    predictedFocusHours,
    predictedStreak,
    topHabit: null,
    message,
  };
}
