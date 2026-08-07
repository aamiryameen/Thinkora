/**
 * Planner scheduling engine — pure functions over planner blocks.
 *
 * Responsibilities:
 *   • Merge planner blocks + tasks + habits into one timeline (free)
 *   • Find free slots in a day (free — powers "next free slot" hints)
 *   • Auto time blocking: pack unscheduled tasks into free slots (premium)
 *   • Smart schedule optimization: re-order the day by priority/deadline (premium)
 *
 * Everything here is deterministic and side-effect free so it can be unit
 * tested and reused by both the daily and weekly planner screens.
 */

import type { Habit, Task, TaskPriority } from '../types';
import type {
  FreeSlot,
  PlannerBlock,
  PlannerBlockKind,
  PlannerPreferences,
  TimelineItem,
} from '../types/planner';
import { parseHHmm } from '../core/plannerTime';

export const BLOCK_KIND_COLORS: Record<PlannerBlockKind, string> = {
  task: '#6366F1',
  event: '#3B82F6',
  habit: '#EF4444',
  focus: '#8B5CF6',
  break: '#10B981',
  custom: '#F59E0B',
};

export const BLOCK_KIND_ICONS: Record<PlannerBlockKind, string> = {
  task: 'checkbox-outline',
  event: 'calendar-outline',
  habit: 'flame-outline',
  focus: 'timer-outline',
  break: 'cafe-outline',
  custom: 'ellipse-outline',
};

export const BLOCK_PALETTE = [
  '#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#14B8A6', '#F97316', '#3B82F6', '#84CC16',
];

const PRIORITY_WEIGHT: Record<TaskPriority, number> = {
  high: 3,
  medium: 2,
  low: 1,
  none: 0,
};

/** Default block length for a task with no time estimate. */
export const DEFAULT_TASK_BLOCK_MINUTES = 45;
const MIN_BLOCK_MINUTES = 15;

// ─── Timeline ────────────────────────────────────────────────────────────────

interface BuildTimelineArgs {
  date: string;
  blocks: PlannerBlock[];
  tasks: Task[];
  habits: Habit[];
  prefs: PlannerPreferences;
  /** Start of the day in epoch ms — used to bucket task due dates. */
  dayStart: number;
}

/**
 * Merge planner blocks with same-day tasks and habits into one sorted list.
 *
 * Tasks/habits already represented by a block are skipped so nothing appears
 * twice. Tasks contribute a read-only "ghost" row only when they have a due
 * time that isn't exactly midnight (a midnight due date means "due today",
 * not "due at 12 AM").
 */
export function buildTimeline({
  date, blocks, tasks, habits, prefs, dayStart,
}: BuildTimelineArgs): TimelineItem[] {
  const items: TimelineItem[] = [];
  const linkedTaskIds = new Set(blocks.map(b => b.taskId).filter(Boolean) as string[]);
  const linkedHabitIds = new Set(blocks.map(b => b.habitId).filter(Boolean) as string[]);

  for (const block of blocks) {
    items.push({
      key: `block-${block.id}`,
      title: block.title,
      kind: block.kind,
      startMinutes: block.startMinutes,
      durationMinutes: block.durationMinutes,
      color: block.color,
      completed: block.completed,
      block,
      taskId: block.taskId,
      habitId: block.habitId,
      hasReminder: block.reminderMinutesBefore != null,
      locked: block.locked,
    });
  }

  if (prefs.showTasks) {
    const dayEnd = dayStart + 86_400_000;
    for (const task of tasks) {
      if (!task.dueDate) continue;
      if (task.dueDate < dayStart || task.dueDate >= dayEnd) continue;
      if (linkedTaskIds.has(task.id)) continue;
      const due = new Date(task.dueDate);
      const minutes = due.getHours() * 60 + due.getMinutes();
      if (minutes === 0) continue;  // all-day task — shown in the task list, not the timeline
      items.push({
        key: `task-${task.id}`,
        title: task.title,
        kind: 'task',
        startMinutes: minutes,
        durationMinutes: DEFAULT_TASK_BLOCK_MINUTES,
        color: BLOCK_KIND_COLORS.task,
        completed: task.completed,
        block: null,
        taskId: task.id,
        habitId: null,
        hasReminder: task.reminderDate != null,
        locked: false,
      });
    }
  }

  if (prefs.showHabits) {
    for (const habit of habits) {
      if (habit.archived) continue;
      if (linkedHabitIds.has(habit.id)) continue;
      const minutes = parseHHmm(habit.reminderTime);
      if (minutes == null) continue;
      if (!isHabitDueOn(habit, date)) continue;
      items.push({
        key: `habit-${habit.id}`,
        title: habit.name,
        kind: 'habit',
        startMinutes: minutes,
        durationMinutes: 30,
        color: habit.color || BLOCK_KIND_COLORS.habit,
        completed: (habit.completedDates ?? []).includes(date),
        block: null,
        taskId: null,
        habitId: habit.id,
        hasReminder: true,
        locked: false,
      });
    }
  }

  return items.sort((a, b) => a.startMinutes - b.startMinutes || a.title.localeCompare(b.title));
}

/** Whether a habit is scheduled on the given "YYYY-MM-DD". */
export function isHabitDueOn(habit: Habit, dateKey: string): boolean {
  if (habit.frequency === 'daily') return true;
  const [y, m, d] = dateKey.split('-').map(Number);
  const weekday = new Date(y, (m ?? 1) - 1, d ?? 1).getDay();
  const target = habit.targetDays ?? [];
  if (target.length === 0) return true;
  return target.includes(weekday);
}

// ─── Free slots ──────────────────────────────────────────────────────────────

/**
 * Find gaps not covered by any block, clipped to [windowStart, windowEnd).
 * Overlapping blocks are merged first so gaps are never double-counted.
 */
export function findFreeSlots(
  blocks: Pick<PlannerBlock, 'startMinutes' | 'durationMinutes'>[],
  windowStart: number,
  windowEnd: number,
  minSlotMinutes = MIN_BLOCK_MINUTES
): FreeSlot[] {
  if (windowEnd <= windowStart) return [];

  const busy = blocks
    .map(b => ({ start: b.startMinutes, end: b.startMinutes + b.durationMinutes }))
    .filter(b => b.end > windowStart && b.start < windowEnd)
    .sort((a, b) => a.start - b.start);

  // Merge overlaps
  const merged: { start: number; end: number }[] = [];
  for (const span of busy) {
    const last = merged[merged.length - 1];
    if (last && span.start <= last.end) {
      last.end = Math.max(last.end, span.end);
    } else {
      merged.push({ ...span });
    }
  }

  const slots: FreeSlot[] = [];
  let cursor = windowStart;
  for (const span of merged) {
    const gapEnd = Math.min(span.start, windowEnd);
    if (gapEnd - cursor >= minSlotMinutes) slots.push({ startMinutes: cursor, endMinutes: gapEnd });
    cursor = Math.max(cursor, Math.min(span.end, windowEnd));
  }
  if (windowEnd - cursor >= minSlotMinutes) slots.push({ startMinutes: cursor, endMinutes: windowEnd });
  return slots;
}

/** The next free slot at or after `fromMinutes`; null when the day is full. */
export function nextFreeSlot(
  blocks: Pick<PlannerBlock, 'startMinutes' | 'durationMinutes'>[],
  fromMinutes: number,
  prefs: PlannerPreferences,
  minSlotMinutes = MIN_BLOCK_MINUTES
): FreeSlot | null {
  const windowStart = Math.max(fromMinutes, prefs.dayStartHour * 60);
  const slots = findFreeSlots(blocks, windowStart, prefs.dayEndHour * 60, minSlotMinutes);
  return slots[0] ?? null;
}

// ─── Auto time blocking (premium) ────────────────────────────────────────────

export interface AutoScheduleCandidate {
  taskId: string;
  title: string;
  durationMinutes: number;
  priority: TaskPriority;
  dueDate: number | null;
}

export interface AutoSchedulePlacement {
  taskId: string;
  title: string;
  startMinutes: number;
  durationMinutes: number;
}

export interface AutoScheduleResult {
  placements: AutoSchedulePlacement[];
  /** Candidates that didn't fit anywhere. */
  unplaced: AutoScheduleCandidate[];
}

/**
 * Rank tasks for scheduling: nearest deadline first, then highest priority,
 * then longest (big rocks go in before small ones fragment the day).
 */
export function rankCandidates(candidates: AutoScheduleCandidate[]): AutoScheduleCandidate[] {
  return [...candidates].sort((a, b) => {
    const aDue = a.dueDate ?? Number.MAX_SAFE_INTEGER;
    const bDue = b.dueDate ?? Number.MAX_SAFE_INTEGER;
    if (aDue !== bDue) return aDue - bDue;
    const pw = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
    if (pw !== 0) return pw;
    return b.durationMinutes - a.durationMinutes;
  });
}

/**
 * Pack candidates into the day's free time inside working hours.
 *
 * Existing blocks are never moved — this only fills gaps. A buffer is left
 * after each newly placed block so the day doesn't become wall-to-wall.
 * When a task is longer than every remaining gap it is reported as unplaced
 * rather than being silently truncated.
 */
export function autoSchedule(
  candidates: AutoScheduleCandidate[],
  existingBlocks: Pick<PlannerBlock, 'startMinutes' | 'durationMinutes'>[],
  prefs: PlannerPreferences,
  /** Don't place anything before this minute (e.g. "now" for today). */
  earliestMinutes = 0
): AutoScheduleResult {
  const windowStart = Math.max(prefs.workStartHour * 60, earliestMinutes, prefs.dayStartHour * 60);
  const windowEnd = Math.min(prefs.workEndHour * 60, prefs.dayEndHour * 60);

  const slots = findFreeSlots(existingBlocks, windowStart, windowEnd).map(s => ({ ...s }));
  const placements: AutoSchedulePlacement[] = [];
  const unplaced: AutoScheduleCandidate[] = [];
  const buffer = Math.max(0, prefs.bufferMinutes);

  for (const candidate of rankCandidates(candidates)) {
    const duration = Math.max(MIN_BLOCK_MINUTES, candidate.durationMinutes);
    // First slot that fits — keeps the day front-loaded.
    const slot = slots.find(s => s.endMinutes - s.startMinutes >= duration);
    if (!slot) { unplaced.push(candidate); continue; }

    placements.push({
      taskId: candidate.taskId,
      title: candidate.title,
      startMinutes: slot.startMinutes,
      durationMinutes: duration,
    });
    slot.startMinutes += duration + buffer;
  }

  return { placements, unplaced };
}

// ─── Smart schedule optimization (premium) ───────────────────────────────────

export interface OptimizedMove {
  blockId: string;
  title: string;
  fromMinutes: number;
  toMinutes: number;
}

export interface OptimizeResult {
  moves: OptimizedMove[];
  /** Blocks left untouched because they're locked, done, or already placed. */
  keptCount: number;
}

/**
 * Reorganize a day so that the highest-value work sits earliest in the
 * available window, without changing any block's duration.
 *
 * Rules:
 *   • Locked, completed and past blocks stay exactly where they are.
 *   • Everything else is re-sorted by score (deadline → priority → kind)
 *     and repacked from the earliest free minute onward, keeping gaps
 *     that the fixed blocks occupy.
 *   • A block that ends up at the same start time is not reported as a move.
 */
export function optimizeSchedule(
  blocks: PlannerBlock[],
  prefs: PlannerPreferences,
  taskById: Map<string, Task>,
  /** Blocks starting before this minute are treated as immovable history. */
  earliestMinutes = 0
): OptimizeResult {
  const windowStart = Math.max(prefs.dayStartHour * 60, earliestMinutes);
  const windowEnd = prefs.dayEndHour * 60;

  const fixed: PlannerBlock[] = [];
  const movable: PlannerBlock[] = [];
  for (const block of blocks) {
    const immovable =
      block.locked ||
      block.completed ||
      block.startMinutes < earliestMinutes ||
      block.kind === 'break';
    (immovable ? fixed : movable).push(block);
  }

  if (movable.length === 0) return { moves: [], keptCount: fixed.length };

  const scored = [...movable].sort((a, b) => scoreBlock(b, taskById) - scoreBlock(a, taskById));

  const slots = findFreeSlots(fixed, windowStart, windowEnd, MIN_BLOCK_MINUTES).map(s => ({ ...s }));
  const moves: OptimizedMove[] = [];
  let kept = fixed.length;

  for (const block of scored) {
    const slot = slots.find(s => s.endMinutes - s.startMinutes >= block.durationMinutes);
    if (!slot) { kept += 1; continue; }   // nowhere better to go — leave it alone
    const target = slot.startMinutes;
    slot.startMinutes += block.durationMinutes;
    if (target === block.startMinutes) { kept += 1; continue; }
    moves.push({
      blockId: block.id,
      title: block.title,
      fromMinutes: block.startMinutes,
      toMinutes: target,
    });
  }

  return { moves, keptCount: kept };
}

/** Higher score = should happen earlier in the day. */
function scoreBlock(block: PlannerBlock, taskById: Map<string, Task>): number {
  let score = 0;
  const task = block.taskId ? taskById.get(block.taskId) : undefined;

  if (task) {
    score += PRIORITY_WEIGHT[task.priority] * 20;
    if (task.dueDate) {
      const daysOut = (task.dueDate - Date.now()) / 86_400_000;
      // Overdue and due-today work floats to the top; far-out work sinks.
      score += daysOut <= 0 ? 60 : Math.max(0, 40 - daysOut * 8);
    }
  }

  // Deep work belongs in the morning; admin and errands can wait.
  if (block.kind === 'focus') score += 25;
  if (block.kind === 'habit') score += 15;
  if (block.kind === 'event') score += 30;   // events are semi-fixed commitments
  if (block.kind === 'custom') score += 5;

  // Longer blocks benefit more from an early, uninterrupted start.
  score += Math.min(15, block.durationMinutes / 12);
  return score;
}

// ─── Progress ────────────────────────────────────────────────────────────────

export interface DayProgress {
  blocksTotal: number;
  blocksDone: number;
  tasksTotal: number;
  tasksDone: number;
  goalsTotal: number;
  goalsDone: number;
  prioritiesTotal: number;
  prioritiesDone: number;
  habitsTotal: number;
  habitsDone: number;
  /** Minutes of the day committed to blocks. */
  plannedMinutes: number;
  /** Minutes of completed blocks. */
  completedMinutes: number;
  /** 0–100 across every tracked dimension. */
  overallPct: number;
}

export function computeDayProgress(args: {
  blocks: PlannerBlock[];
  timeline: TimelineItem[];
  goalsTotal: number;
  goalsDone: number;
  prioritiesTotal: number;
  prioritiesDone: number;
}): DayProgress {
  const { blocks, timeline, goalsTotal, goalsDone, prioritiesTotal, prioritiesDone } = args;

  const blocksDone = blocks.filter(b => b.completed).length;
  const taskItems = timeline.filter(i => i.kind === 'task');
  const habitItems = timeline.filter(i => i.kind === 'habit');
  const plannedMinutes = blocks.reduce((sum, b) => sum + b.durationMinutes, 0);
  const completedMinutes = blocks.filter(b => b.completed).reduce((sum, b) => sum + b.durationMinutes, 0);

  const totals = blocks.length + goalsTotal + prioritiesTotal;
  const dones = blocksDone + goalsDone + prioritiesDone;

  return {
    blocksTotal: blocks.length,
    blocksDone,
    tasksTotal: taskItems.length,
    tasksDone: taskItems.filter(i => i.completed).length,
    goalsTotal,
    goalsDone,
    prioritiesTotal,
    prioritiesDone,
    habitsTotal: habitItems.length,
    habitsDone: habitItems.filter(i => i.completed).length,
    plannedMinutes,
    completedMinutes,
    overallPct: totals === 0 ? 0 : Math.round((dones / totals) * 100),
  };
}
