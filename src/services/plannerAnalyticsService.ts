/**
 * Planner analytics (premium) — aggregate planner blocks and day plans over a
 * range into the numbers the analytics screen renders.
 *
 * Pure aggregation over data already fetched by the caller so the screen can
 * re-compute without hitting the DB again.
 */

import type { PlannerBlock, PlannerBlockKind, PlannerDay } from '../types/planner';
import { addDaysToKey, fromDateKey, toDateKey } from '../core/plannerTime';

export interface KindBreakdown {
  kind: PlannerBlockKind;
  minutes: number;
  completedMinutes: number;
  blocks: number;
  pct: number;
}

export interface DayBucket {
  date: string;
  /** Mon/Tue/… single letter for charts. */
  label: string;
  plannedMinutes: number;
  completedMinutes: number;
  blocksTotal: number;
  blocksDone: number;
  goalsTotal: number;
  goalsDone: number;
  planned: boolean;
  completionPct: number;
}

export interface HourHeat {
  hour: number;
  minutes: number;
  completedMinutes: number;
}

export interface PlannerAnalytics {
  rangeStart: string;
  rangeEnd: string;
  daysInRange: number;
  /** Days with a saved plan (focus/priorities/goals/notes or blocks). */
  daysPlanned: number;
  planningRatePct: number;
  totalPlannedMinutes: number;
  totalCompletedMinutes: number;
  /** completedMinutes / plannedMinutes. */
  adherencePct: number;
  avgPlannedMinutesPerActiveDay: number;
  blocksTotal: number;
  blocksDone: number;
  goalsTotal: number;
  goalsDone: number;
  goalCompletionPct: number;
  prioritiesTotal: number;
  prioritiesDone: number;
  priorityCompletionPct: number;
  byKind: KindBreakdown[];
  byDay: DayBucket[];
  byHour: HourHeat[];
  /** Most productive hour by completed minutes; null when no data. */
  peakHour: number | null;
  /** Weekday (0–6) with the highest completion rate; null when no data. */
  bestWeekday: number | null;
  /** Consecutive days ending at rangeEnd that have a plan. */
  planningStreak: number;
}

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function pct(part: number, whole: number): number {
  return whole <= 0 ? 0 : Math.round((part / whole) * 100);
}

/** Inclusive list of day keys between two keys. */
export function dayKeyRange(startKey: string, endKey: string): string[] {
  const keys: string[] = [];
  let cursor = startKey;
  // Guard against an inverted range or a runaway loop.
  for (let i = 0; i < 800 && cursor <= endKey; i += 1) {
    keys.push(cursor);
    cursor = addDaysToKey(cursor, 1);
  }
  return keys;
}

export function computePlannerAnalytics(
  blocks: PlannerBlock[],
  days: PlannerDay[],
  startKey: string,
  endKey: string
): PlannerAnalytics {
  const keys = dayKeyRange(startKey, endKey);
  const dayByKey = new Map(days.map(d => [d.date, d]));
  const blocksByKey = new Map<string, PlannerBlock[]>();
  for (const block of blocks) {
    const list = blocksByKey.get(block.date);
    if (list) list.push(block); else blocksByKey.set(block.date, [block]);
  }

  const byDay: DayBucket[] = keys.map(key => {
    const dayBlocks = blocksByKey.get(key) ?? [];
    const day = dayByKey.get(key);
    const plannedMinutes = dayBlocks.reduce((s, b) => s + b.durationMinutes, 0);
    const completedMinutes = dayBlocks.filter(b => b.completed).reduce((s, b) => s + b.durationMinutes, 0);
    const goalsTotal = day?.dailyGoals.length ?? 0;
    const goalsDone = day?.dailyGoals.filter(g => g.completed).length ?? 0;
    const blocksDone = dayBlocks.filter(b => b.completed).length;
    const hasPlan =
      dayBlocks.length > 0 ||
      !!day?.focus.trim() ||
      (day?.topPriorities.length ?? 0) > 0 ||
      goalsTotal > 0 ||
      !!day?.notes.trim();

    const trackedTotal = dayBlocks.length + goalsTotal + (day?.topPriorities.length ?? 0);
    const trackedDone = blocksDone + goalsDone + (day?.topPriorities.filter(p => p.completed).length ?? 0);

    return {
      date: key,
      label: DAY_LETTERS[fromDateKey(key).getDay()],
      plannedMinutes,
      completedMinutes,
      blocksTotal: dayBlocks.length,
      blocksDone,
      goalsTotal,
      goalsDone,
      planned: hasPlan,
      completionPct: pct(trackedDone, trackedTotal),
    };
  });

  // Kind breakdown
  const kindMap = new Map<PlannerBlockKind, { minutes: number; completedMinutes: number; blocks: number }>();
  for (const block of blocks) {
    const entry = kindMap.get(block.kind) ?? { minutes: 0, completedMinutes: 0, blocks: 0 };
    entry.minutes += block.durationMinutes;
    entry.blocks += 1;
    if (block.completed) entry.completedMinutes += block.durationMinutes;
    kindMap.set(block.kind, entry);
  }
  const totalPlannedMinutes = blocks.reduce((s, b) => s + b.durationMinutes, 0);
  const byKind: KindBreakdown[] = [...kindMap.entries()]
    .map(([kind, v]) => ({ kind, ...v, pct: pct(v.minutes, totalPlannedMinutes) }))
    .sort((a, b) => b.minutes - a.minutes);

  // Hour heat map — a block contributes to every hour it overlaps.
  const byHour: HourHeat[] = Array.from({ length: 24 }, (_, hour) => ({ hour, minutes: 0, completedMinutes: 0 }));
  for (const block of blocks) {
    const start = block.startMinutes;
    const end = Math.min(1440, block.startMinutes + block.durationMinutes);
    for (let hour = Math.floor(start / 60); hour < Math.ceil(end / 60) && hour < 24; hour += 1) {
      const overlap = Math.min(end, (hour + 1) * 60) - Math.max(start, hour * 60);
      if (overlap <= 0) continue;
      byHour[hour].minutes += overlap;
      if (block.completed) byHour[hour].completedMinutes += overlap;
    }
  }

  const totalCompletedMinutes = blocks.filter(b => b.completed).reduce((s, b) => s + b.durationMinutes, 0);
  const activeDays = byDay.filter(d => d.plannedMinutes > 0);
  const daysPlanned = byDay.filter(d => d.planned).length;

  const goalsTotal = days.reduce((s, d) => s + d.dailyGoals.length, 0);
  const goalsDone = days.reduce((s, d) => s + d.dailyGoals.filter(g => g.completed).length, 0);
  const prioritiesTotal = days.reduce((s, d) => s + d.topPriorities.length, 0);
  const prioritiesDone = days.reduce((s, d) => s + d.topPriorities.filter(p => p.completed).length, 0);

  // Peak hour by completed minutes, falling back to planned minutes.
  let peakHour: number | null = null;
  let peakValue = 0;
  byHour.forEach(h => {
    const value = h.completedMinutes || h.minutes * 0.001;   // planned only breaks ties
    if (value > peakValue) { peakValue = value; peakHour = h.hour; }
  });
  if (peakValue === 0) peakHour = null;

  // Best weekday by average completion rate across days with tracked items.
  const weekdayTotals = Array.from({ length: 7 }, () => ({ sum: 0, count: 0 }));
  byDay.forEach(d => {
    if (!d.planned) return;
    const weekday = fromDateKey(d.date).getDay();
    weekdayTotals[weekday].sum += d.completionPct;
    weekdayTotals[weekday].count += 1;
  });
  let bestWeekday: number | null = null;
  let bestAvg = -1;
  weekdayTotals.forEach((w, i) => {
    if (w.count === 0) return;
    const avg = w.sum / w.count;
    if (avg > bestAvg) { bestAvg = avg; bestWeekday = i; }
  });

  // Planning streak — walk backwards from the end of the range.
  let planningStreak = 0;
  for (let i = byDay.length - 1; i >= 0; i -= 1) {
    if (!byDay[i].planned) break;
    planningStreak += 1;
  }

  return {
    rangeStart: startKey,
    rangeEnd: endKey,
    daysInRange: keys.length,
    daysPlanned,
    planningRatePct: pct(daysPlanned, keys.length),
    totalPlannedMinutes,
    totalCompletedMinutes,
    adherencePct: pct(totalCompletedMinutes, totalPlannedMinutes),
    avgPlannedMinutesPerActiveDay:
      activeDays.length === 0 ? 0 : Math.round(totalPlannedMinutes / activeDays.length),
    blocksTotal: blocks.length,
    blocksDone: blocks.filter(b => b.completed).length,
    goalsTotal,
    goalsDone,
    goalCompletionPct: pct(goalsDone, goalsTotal),
    prioritiesTotal,
    prioritiesDone,
    priorityCompletionPct: pct(prioritiesDone, prioritiesTotal),
    byKind,
    byDay,
    byHour,
    peakHour,
    bestWeekday,
    planningStreak,
  };
}

/** Convenience: the last `days` calendar days ending today. */
export function trailingRange(days: number): { startKey: string; endKey: string } {
  const endKey = toDateKey(new Date());
  return { startKey: addDaysToKey(endKey, -(days - 1)), endKey };
}
