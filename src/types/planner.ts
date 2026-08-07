/**
 * Daily Planner types.
 *
 * The planner is a *view layer* over data that already lives elsewhere
 * (tasks, habits, goals) plus three planner-owned records:
 *
 *   - PlannerBlock  — a scheduled block of time on a given day
 *   - PlannerDay    — per-day plan (focus, top-3, daily goals, notes)
 *   - PlannerTemplate — a reusable set of blocks applied to a day
 *
 * Blocks and days are persisted in WatermelonDB (`planner_blocks`,
 * `planner_days`); templates live in the settings key/value table since
 * they are few and small.
 */

/** What a block on the timeline came from. */
export type PlannerBlockKind =
  | 'task'      // linked to a Task
  | 'event'     // standalone calendar-style event
  | 'habit'     // linked to a Habit
  | 'focus'     // deep-work / pomodoro block
  | 'break'     // rest, lunch, buffer
  | 'custom';

export interface PlannerBlock {
  id: string;
  /** "YYYY-MM-DD" — the day this block belongs to. */
  date: string;
  title: string;
  kind: PlannerBlockKind;
  /** Minutes from midnight (0–1439). */
  startMinutes: number;
  durationMinutes: number;
  color: string;
  notes: string;
  /** Linked Task id, when kind === 'task'. */
  taskId: string | null;
  /** Linked Habit id, when kind === 'habit'. */
  habitId: string | null;
  completed: boolean;
  /** Minutes before start to fire a reminder; null = no reminder. */
  reminderMinutesBefore: number | null;
  /** notifee notification id, so we can cancel/reschedule. */
  notifeeId: string | null;
  /** True when placed by auto-scheduling rather than by the user. */
  autoScheduled: boolean;
  /** True when the user pinned it so optimization won't move it. */
  locked: boolean;
  createdAt: number;
  updatedAt: number;
}

/** A single checkable goal for one day. */
export interface DailyGoal {
  id: string;
  title: string;
  completed: boolean;
}

export interface PlannerDay {
  id: string;
  /** "YYYY-MM-DD" — unique. */
  date: string;
  /** One-line intention for the day. */
  focus: string;
  /** Up to three priority task ids or free-text entries. */
  topPriorities: TopPriority[];
  dailyGoals: DailyGoal[];
  /** Free-form journal/scratch notes for the day. */
  notes: string;
  /** Set once the user finishes the morning planning flow. */
  plannedAt: number | null;
  /** Set once the user finishes the evening review. */
  reviewedAt: number | null;
  /** Optional planner theme id override for this day. */
  createdAt: number;
  updatedAt: number;
}

export interface TopPriority {
  id: string;
  title: string;
  /** When set, completion mirrors the linked task. */
  taskId: string | null;
  completed: boolean;
}

// ─── Templates ───────────────────────────────────────────────────────────────

export interface PlannerTemplateBlock {
  title: string;
  kind: PlannerBlockKind;
  startMinutes: number;
  durationMinutes: number;
  color: string;
}

export interface PlannerTemplate {
  id: string;
  name: string;
  icon: string;
  description: string;
  blocks: PlannerTemplateBlock[];
  /** Built-in templates ship with the app and can't be edited or deleted. */
  builtIn: boolean;
  /** Suggested daily goals seeded when the template is applied. */
  suggestedGoals: string[];
  createdAt: number;
}

// ─── Preferences ─────────────────────────────────────────────────────────────

export interface PlannerPreferences {
  /** First hour rendered on the timeline (0–23). */
  dayStartHour: number;
  /** Last hour rendered on the timeline (1–24), exclusive. */
  dayEndHour: number;
  /** Auto-scheduling only places blocks inside working hours. */
  workStartHour: number;
  workEndHour: number;
  /** Gap in minutes inserted between auto-scheduled blocks. */
  bufferMinutes: number;
  /** Default reminder lead time for new blocks; null = off. */
  defaultReminderMinutes: number | null;
  /** Planner theme id (see PLANNER_THEMES). */
  themeId: string;
  /** Show habits on the timeline at their reminder time. */
  showHabits: boolean;
  /** Show tasks that have a due time on the timeline. */
  showTasks: boolean;
}

export const DEFAULT_PLANNER_PREFERENCES: PlannerPreferences = {
  dayStartHour: 6,
  dayEndHour: 23,
  workStartHour: 9,
  workEndHour: 18,
  bufferMinutes: 10,
  defaultReminderMinutes: 10,
  themeId: 'classic',
  showHabits: true,
  showTasks: true,
};

// ─── Timeline (derived, not persisted) ───────────────────────────────────────

/** A unified item rendered on the day timeline. */
export interface TimelineItem {
  key: string;
  title: string;
  kind: PlannerBlockKind;
  startMinutes: number;
  durationMinutes: number;
  color: string;
  completed: boolean;
  /** Present when this row is a real planner block (editable/draggable). */
  block: PlannerBlock | null;
  /** Present when derived from a task with a due time (read-only ghost). */
  taskId: string | null;
  habitId: string | null;
  hasReminder: boolean;
  locked: boolean;
}

/** A free stretch of time used by auto-scheduling. */
export interface FreeSlot {
  startMinutes: number;
  endMinutes: number;
}
