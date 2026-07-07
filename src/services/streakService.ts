/**
 * Daily Streak Service
 *
 * Tracks consecutive days the user was active in the app.
 * Active = completed a task, checked a habit, wrote a note, or journaled.
 *
 * Forgiveness model
 *  • 2 free freezes per ISO week (Mon–Sun). When the user misses a day,
 *    a freeze is auto-consumed and the streak is preserved.
 *  • If both freezes are spent and the streak breaks, the user has up to
 *    24 hours to "repair" it (consumes a paid repair token tracked here as
 *    `repairsUsedThisMonth`, capped at 1/month).
 *  • After 24h with no repair, the streak resets to 0.
 *
 * Storage: AsyncStorage under `@thinkora/daily_streak`.
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
  /** ms timestamp when the streak broke. Allows "Repair" within 24h. */
  streakBrokenAt: number | null;
  /** The streak length right before it broke (used to restore on repair). */
  brokenStreakLength: number;
  /** Repair tokens consumed this calendar month (limit 1). */
  repairsUsedThisMonth: number;
  /** 'YYYY-MM' first-of-month key used to roll the repair counter. */
  monthStartKey: string;
}

const DEFAULT_STREAK: StreakData = {
  currentStreak: 0,
  longestStreak: 0,
  lastActiveDate: '',
  activeDates: [],
  freezesUsedThisWeek: 0,
  weekStartDate: '',
  milestones: [],
  streakBrokenAt: null,
  brokenStreakLength: 0,
  repairsUsedThisMonth: 0,
  monthStartKey: '',
};

const MILESTONE_DAYS = [3, 7, 14, 21, 30, 50, 75, 100, 150, 200, 365];
const MAX_FREEZES_PER_WEEK = 2;
const MAX_REPAIRS_PER_MONTH = 1;
const REPAIR_WINDOW_MS = 24 * 60 * 60 * 1000;

/** "YYYY-MM-DD" for the given Date (local time). */
export function dayKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function todayKey(): string {
  return dayKey(new Date());
}

function yesterdayKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return dayKey(d);
}

function mondayOfThisWeek(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.getFullYear(), d.getMonth(), diff);
  return dayKey(monday);
}

function monthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
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
    if (data.activeDates.length > 90) {
      data.activeDates = data.activeDates.slice(-90);
    }
    await AsyncStorage.setItem(STREAK_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('[Streak] Save failed:', e);
  }
}

/** Roll weekly/monthly counters. Mutates and returns `data`. */
function rollPeriodicCounters(data: StreakData): StreakData {
  const thisMonday = mondayOfThisWeek();
  if (data.weekStartDate !== thisMonday) {
    data.freezesUsedThisWeek = 0;
    data.weekStartDate = thisMonday;
  }
  const thisMonth = monthKey();
  if (data.monthStartKey !== thisMonth) {
    data.repairsUsedThisMonth = 0;
    data.monthStartKey = thisMonth;
  }
  return data;
}

/**
 * Call whenever the user performs a meaningful action (complete task,
 * check habit, save note, write journal, finish pomodoro).
 *
 * Returns the updated streak + a `newMilestone` if one was just reached.
 */
export async function recordActivity(): Promise<{
  streak: StreakData;
  newMilestone: number | null;
}> {
  const data = rollPeriodicCounters(await loadStreak());
  const today = todayKey();
  const yesterday = yesterdayKey();

  // Already active today — no change.
  if (data.lastActiveDate === today) {
    await saveStreak(data);
    return { streak: data, newMilestone: null };
  }

  // Continued from yesterday → simple +1.
  if (data.lastActiveDate === yesterday) {
    data.currentStreak += 1;
  }
  // Missed exactly one day & we still have a freeze → auto-consume freeze.
  else if (
    data.lastActiveDate !== '' &&
    daysBetween(data.lastActiveDate, today) === 2 &&
    data.freezesUsedThisWeek < MAX_FREEZES_PER_WEEK
  ) {
    data.freezesUsedThisWeek += 1;
    data.currentStreak += 1;
  }
  // Otherwise the streak is broken — start a fresh one.
  else if (data.lastActiveDate !== '' && daysBetween(data.lastActiveDate, today) > 1) {
    // Remember what we just lost so the user can Repair within 24h.
    if (data.streakBrokenAt === null && data.currentStreak > 0) {
      data.streakBrokenAt = Date.now();
      data.brokenStreakLength = data.currentStreak;
    }
    data.currentStreak = 1;
  }
  // First ever activity.
  else {
    data.currentStreak = 1;
  }

  // Activity today clears any pending repair offer (user moved on).
  // We keep streakBrokenAt only if the user hasn't started a new streak yet.
  if (data.currentStreak > 1) {
    data.streakBrokenAt = null;
    data.brokenStreakLength = 0;
  }

  data.lastActiveDate = today;
  if (!data.activeDates.includes(today)) data.activeDates.push(today);
  if (data.currentStreak > data.longestStreak) data.longestStreak = data.currentStreak;

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
 * App-open check. If the user opened the app but hasn't done anything yet,
 * we only need to detect a clean break (>1 missed day with no freezes left)
 * and surface the repair offer.
 */
export async function checkStreakOnAppOpen(): Promise<StreakData> {
  const data = rollPeriodicCounters(await loadStreak());
  const today = todayKey();
  const yesterday = yesterdayKey();

  // Active today/yesterday → no break.
  if (data.lastActiveDate === today || data.lastActiveDate === yesterday) {
    await saveStreak(data);
    return data;
  }

  const gap = data.lastActiveDate ? daysBetween(data.lastActiveDate, today) : 999;

  // Missed exactly 1 day and freeze still available — wait for activity to consume.
  if (gap === 2 && data.freezesUsedThisWeek < MAX_FREEZES_PER_WEEK) {
    await saveStreak(data);
    return data;
  }

  // Streak is broken. Record the moment so the Repair offer can show.
  if (gap > 1 && data.currentStreak > 0) {
    if (data.streakBrokenAt === null) {
      data.streakBrokenAt = Date.now();
      data.brokenStreakLength = data.currentStreak;
    }
    data.currentStreak = 0;
  }

  // Past the 24h window? Clear the broken state for good.
  if (data.streakBrokenAt !== null && Date.now() - data.streakBrokenAt > REPAIR_WINDOW_MS) {
    data.streakBrokenAt = null;
    data.brokenStreakLength = 0;
  }

  await saveStreak(data);
  return data;
}

/**
 * Repair a recently-broken streak. Restores `brokenStreakLength + 1` (today
 * counts as the first day of the restored streak). Costs 1 monthly repair
 * token. Returns the updated streak, or `null` if repair isn't available.
 */
export async function repairStreak(): Promise<StreakData | null> {
  const data = rollPeriodicCounters(await loadStreak());
  if (!canRepair(data)) return null;

  const restored = data.brokenStreakLength + 1;
  data.currentStreak = restored;
  data.repairsUsedThisMonth += 1;
  data.streakBrokenAt = null;
  data.brokenStreakLength = 0;
  data.lastActiveDate = todayKey();
  if (!data.activeDates.includes(data.lastActiveDate)) {
    data.activeDates.push(data.lastActiveDate);
  }
  if (restored > data.longestStreak) data.longestStreak = restored;

  await saveStreak(data);
  return data;
}

/** True if the user can use Repair right now. */
export function canRepair(data: StreakData): boolean {
  if (data.streakBrokenAt === null) return false;
  if (Date.now() - data.streakBrokenAt > REPAIR_WINDOW_MS) return false;
  if (data.repairsUsedThisMonth >= MAX_REPAIRS_PER_MONTH) return false;
  return data.brokenStreakLength > 0;
}

/** Hours remaining in the repair window, rounded up. 0 if not repairable. */
export function repairHoursRemaining(data: StreakData): number {
  if (!canRepair(data)) return 0;
  const elapsed = Date.now() - (data.streakBrokenAt ?? 0);
  return Math.max(0, Math.ceil((REPAIR_WINDOW_MS - elapsed) / (60 * 60 * 1000)));
}

/** Last 7 days activity for the week-dot row. */
export function getWeekActivity(data: StreakData): { key: string; label: string; active: boolean }[] {
  const days: { key: string; label: string; active: boolean }[] = [];
  const labels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const today = new Date();

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const key = dayKey(d);
    const dayOfWeek = d.getDay();
    const labelIdx = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    days.push({
      key,
      label: labels[labelIdx],
      active: data.activeDates.includes(key),
    });
  }
  return days;
}

/** Number of freezes still available this week. */
export function freezesAvailable(data: StreakData): number {
  const thisMonday = mondayOfThisWeek();
  if (data.weekStartDate !== thisMonday) return MAX_FREEZES_PER_WEEK;
  return Math.max(0, MAX_FREEZES_PER_WEEK - data.freezesUsedThisWeek);
}

/** Legacy helper kept for existing call sites (any freeze available). */
export function hasFreezeAvailable(data: StreakData): boolean {
  return freezesAvailable(data) > 0;
}

export function getNextMilestone(currentStreak: number): number | null {
  for (const m of MILESTONE_DAYS) {
    if (currentStreak < m) return m;
  }
  return null;
}

/** True if user has been active today. Used to decide whether to fire
 *  loss-aversion nudges. */
export function isActiveToday(data: StreakData): boolean {
  return data.lastActiveDate === todayKey();
}
