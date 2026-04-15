/**
 * Daily Streak Service
 *
 * Tracks consecutive days the user was active in the app.
 * Active = completed a task, checked a habit, wrote a note, or journaled.
 *
 * Data is stored in WatermelonDB settings table under key 'daily_streak'.
 *
 * Streak freeze: 1 free freeze per week — if user misses a day,
 * the freeze is auto-consumed and streak is preserved.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STREAK_KEY = '@thinkora/daily_streak';

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string;       // 'YYYY-MM-DD'
  activeDates: string[];        // last 90 days of active dates
  freezesUsedThisWeek: number;
  weekStartDate: string;        // 'YYYY-MM-DD' (Monday)
  milestones: number[];         // milestone days already celebrated
}

const DEFAULT_STREAK: StreakData = {
  currentStreak: 0,
  longestStreak: 0,
  lastActiveDate: '',
  activeDates: [],
  freezesUsedThisWeek: 0,
  weekStartDate: '',
  milestones: [],
};

const MILESTONE_DAYS = [3, 7, 14, 21, 30, 50, 75, 100, 150, 200, 365];

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function yesterdayKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function mondayOfThisWeek(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.getFullYear(), d.getMonth(), diff);
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
}

function daysBetween(dateA: string, dateB: string): number {
  if (!dateA || !dateB) return 999;
  const a = new Date(dateA + 'T00:00:00');
  const b = new Date(dateB + 'T00:00:00');
  return Math.round(Math.abs(b.getTime() - a.getTime()) / 86400000);
}

export async function loadStreak(): Promise<StreakData> {
  try {
    const raw = await AsyncStorage.getItem(STREAK_KEY);
    if (!raw) return { ...DEFAULT_STREAK };
    return { ...DEFAULT_STREAK, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_STREAK };
  }
}

async function saveStreak(data: StreakData): Promise<void> {
  try {
    // Trim activeDates to last 90 entries
    if (data.activeDates.length > 90) {
      data.activeDates = data.activeDates.slice(-90);
    }
    await AsyncStorage.setItem(STREAK_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('[Streak] Save failed:', e);
  }
}

/**
 * Call this whenever the user performs a meaningful action:
 * - Completes a task
 * - Checks a habit
 * - Creates/edits a note
 * - Writes a journal entry
 * - Completes a pomodoro session
 *
 * Returns the updated streak data + whether a new milestone was reached.
 */
export async function recordActivity(): Promise<{
  streak: StreakData;
  newMilestone: number | null;
}> {
  const data = await loadStreak();
  const today = todayKey();
  const yesterday = yesterdayKey();
  const thisMonday = mondayOfThisWeek();

  // Reset weekly freeze counter if new week
  if (data.weekStartDate !== thisMonday) {
    data.freezesUsedThisWeek = 0;
    data.weekStartDate = thisMonday;
  }

  // Already active today — no changes needed
  if (data.lastActiveDate === today) {
    await saveStreak(data);
    return { streak: data, newMilestone: null };
  }

  // Was active yesterday — streak continues
  if (data.lastActiveDate === yesterday) {
    data.currentStreak += 1;
  }
  // Missed yesterday but streak freeze available
  else if (
    data.lastActiveDate !== '' &&
    daysBetween(data.lastActiveDate, today) === 2 &&
    data.freezesUsedThisWeek < 1
  ) {
    // Use freeze — streak preserved
    data.freezesUsedThisWeek += 1;
    data.currentStreak += 1; // today still counts
  }
  // Missed more than 1 day or no freeze left — streak resets
  else if (data.lastActiveDate !== '' && daysBetween(data.lastActiveDate, today) > 1) {
    data.currentStreak = 1; // today is day 1 of new streak
  }
  // First ever activity
  else {
    data.currentStreak = 1;
  }

  // Update tracking
  data.lastActiveDate = today;
  if (!data.activeDates.includes(today)) {
    data.activeDates.push(today);
  }
  if (data.currentStreak > data.longestStreak) {
    data.longestStreak = data.currentStreak;
  }

  // Check milestones
  let newMilestone: number | null = null;
  for (const m of MILESTONE_DAYS) {
    if (data.currentStreak >= m && !data.milestones.includes(m)) {
      data.milestones.push(m);
      newMilestone = m;
    }
  }

  await saveStreak(data);
  return { streak: data, newMilestone };
}

/**
 * Check and update streak on app open.
 * Handles the case where user opens app but doesn't do anything active —
 * if they missed yesterday, streak may need to be reset.
 */
export async function checkStreakOnAppOpen(): Promise<StreakData> {
  const data = await loadStreak();
  const today = todayKey();
  const yesterday = yesterdayKey();
  const thisMonday = mondayOfThisWeek();

  // Reset weekly freeze counter if new week
  if (data.weekStartDate !== thisMonday) {
    data.freezesUsedThisWeek = 0;
    data.weekStartDate = thisMonday;
  }

  // If last active was today or yesterday, streak is still valid
  if (data.lastActiveDate === today || data.lastActiveDate === yesterday) {
    await saveStreak(data);
    return data;
  }

  // Missed yesterday — check freeze
  if (
    data.lastActiveDate !== '' &&
    daysBetween(data.lastActiveDate, today) === 2 &&
    data.freezesUsedThisWeek < 1
  ) {
    // Freeze will be consumed when user records activity today
    await saveStreak(data);
    return data;
  }

  // Missed more than 1 day — streak is broken
  if (data.lastActiveDate !== '' && daysBetween(data.lastActiveDate, today) > 2) {
    data.currentStreak = 0;
    await saveStreak(data);
  }

  return data;
}

/**
 * Get the last 7 days activity for the week dots display.
 */
export function getWeekActivity(data: StreakData): { key: string; label: string; active: boolean }[] {
  const days: { key: string; label: string; active: boolean }[] = [];
  const labels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const today = new Date();

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const dayOfWeek = d.getDay(); // 0=Sun
    const labelIdx = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    days.push({
      key,
      label: labels[labelIdx],
      active: data.activeDates.includes(key),
    });
  }

  return days;
}

/**
 * Check if streak freeze is available this week.
 */
export function hasFreezeAvailable(data: StreakData): boolean {
  const thisMonday = mondayOfThisWeek();
  if (data.weekStartDate !== thisMonday) return true; // new week
  return data.freezesUsedThisWeek < 1;
}

/**
 * Get next milestone target.
 */
export function getNextMilestone(currentStreak: number): number | null {
  for (const m of MILESTONE_DAYS) {
    if (currentStreak < m) return m;
  }
  return null;
}
