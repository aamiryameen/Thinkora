/**
 * Daily Planner Service — persistence for planner blocks and per-day plans,
 * plus block reminder scheduling.
 *
 * Blocks and days live in WatermelonDB (`planner_blocks` / `planner_days`),
 * so everything works fully offline; preferences live in the settings
 * key/value table.
 *
 * Reminders reuse the existing notifee wiring in reminderService via a
 * dedicated "planner" channel.
 */

import { Platform } from 'react-native';
import { Q } from '@nozbe/watermelondb';
import { database, plannerBlocksCollection, plannerDaysCollection } from '../db';
import { storage } from './storage';
import { generateId } from '../utils/id';
import { formatDuration, formatMinutes, timestampFor, todayKey } from '../core/plannerTime';
import {
  DEFAULT_PLANNER_PREFERENCES,
  type DailyGoal,
  type PlannerBlock,
  type PlannerDay,
  type PlannerPreferences,
  type TopPriority,
} from '../types/planner';

// ─── notifee (optional — same lazy-require pattern as reminderService) ────────

/**
 * Minimal surface of the notifee default export that this service uses.
 * Typed locally because notifee is an optional dependency loaded via require
 * (it isn't present on every build), so we can't rely on its own types.
 */
interface NotifeeModule {
  createChannel(channel: Record<string, unknown>): Promise<string>;
  createTriggerNotification(
    notification: Record<string, unknown>,
    trigger: Record<string, unknown>
  ): Promise<string>;
  cancelNotification(id: string): Promise<void>;
}

let notifee: NotifeeModule | null = null;
let TriggerType: { TIMESTAMP: number; INTERVAL: number } | null = null;
try {
  const mod = require('@notifee/react-native');
  notifee = mod.default as NotifeeModule;
  TriggerType = mod.TriggerType ?? { TIMESTAMP: 0, INTERVAL: 1 };
} catch {
  notifee = null;
}

const PLANNER_CHANNEL_ID = 'planner-blocks';

async function ensurePlannerChannel(): Promise<void> {
  if (Platform.OS !== 'android' || !notifee) return;
  await notifee.createChannel({
    id: PLANNER_CHANNEL_ID,
    name: 'Planner Time Blocks',
    description: 'Reminders for scheduled time blocks',
    importance: 4,
    vibration: true,
  });
}

// ─── Date helpers ────────────────────────────────────────────────────────────
// These live in core/plannerTime so the pure scheduling engine can use them
// without importing this module (and with it, the database). Re-exported here
// because most callers want the service as a single entry point.

export {
  addDaysToKey,
  formatDuration,
  formatMinutes,
  fromDateKey,
  parseHHmm,
  timestampFor,
  toDateKey,
  todayKey,
  weekKeys,
  weekStartKey,
} from '../core/plannerTime';

// ─── Preferences ─────────────────────────────────────────────────────────────

const PREFS_KEY = 'planner_preferences_v1';

export async function getPlannerPreferences(): Promise<PlannerPreferences> {
  const stored = await storage.getSetting<Partial<PlannerPreferences>>(PREFS_KEY, {});
  return { ...DEFAULT_PLANNER_PREFERENCES, ...stored };
}

export async function savePlannerPreferences(patch: Partial<PlannerPreferences>): Promise<PlannerPreferences> {
  const next = { ...(await getPlannerPreferences()), ...patch };
  await storage.setSetting(PREFS_KEY, next);
  return next;
}

// ─── Blocks ──────────────────────────────────────────────────────────────────

export async function getBlocksForDate(date: string): Promise<PlannerBlock[]> {
  const rows = await plannerBlocksCollection.query(Q.where('date', date)).fetch();
  return rows.map(r => r.toPlain()).sort((a, b) => a.startMinutes - b.startMinutes);
}

export async function getBlocksForDates(dates: string[]): Promise<PlannerBlock[]> {
  if (dates.length === 0) return [];
  const rows = await plannerBlocksCollection.query(Q.where('date', Q.oneOf(dates))).fetch();
  return rows.map(r => r.toPlain()).sort((a, b) => a.startMinutes - b.startMinutes);
}

export type NewBlockInput = Omit<
  PlannerBlock,
  'id' | 'createdAt' | 'updatedAt' | 'notifeeId' | 'completed' | 'autoScheduled' | 'locked'
> & Partial<Pick<PlannerBlock, 'completed' | 'autoScheduled' | 'locked'>>;

export async function createBlock(input: NewBlockInput): Promise<PlannerBlock> {
  const now = Date.now();
  let created!: PlannerBlock;
  await database.write(async () => {
    const row = await plannerBlocksCollection.create(r => {
      r.date = input.date;
      r.title = input.title;
      r.kind = input.kind;
      r.startMinutes = input.startMinutes;
      r.durationMinutes = input.durationMinutes;
      r.color = input.color;
      r.notes = input.notes ?? '';
      r.taskId = input.taskId ?? null;
      r.habitId = input.habitId ?? null;
      r.completed = input.completed ?? false;
      r.reminderMinutesBefore = input.reminderMinutesBefore ?? null;
      r.notifeeId = null;
      r.autoScheduled = input.autoScheduled ?? false;
      r.locked = input.locked ?? false;
      r.createdAtNum = now;
      r.updatedAtNum = now;
    });
    created = row.toPlain();
  });
  if (created.reminderMinutesBefore != null) {
    const notifeeId = await scheduleBlockReminder(created);
    if (notifeeId) created = await persistNotifeeId(created, notifeeId);
  }
  return created;
}

/** Create several blocks in one write (used by templates and auto-scheduling). */
export async function createBlocks(inputs: NewBlockInput[]): Promise<PlannerBlock[]> {
  if (inputs.length === 0) return [];
  const now = Date.now();
  const created: PlannerBlock[] = [];
  await database.write(async () => {
    const prepared = inputs.map(input =>
      plannerBlocksCollection.prepareCreate(r => {
        r.date = input.date;
        r.title = input.title;
        r.kind = input.kind;
        r.startMinutes = input.startMinutes;
        r.durationMinutes = input.durationMinutes;
        r.color = input.color;
        r.notes = input.notes ?? '';
        r.taskId = input.taskId ?? null;
        r.habitId = input.habitId ?? null;
        r.completed = input.completed ?? false;
        r.reminderMinutesBefore = input.reminderMinutesBefore ?? null;
        r.notifeeId = null;
        r.autoScheduled = input.autoScheduled ?? false;
        r.locked = input.locked ?? false;
        r.createdAtNum = now;
        r.updatedAtNum = now;
      })
    );
    await database.batch(...prepared);
    prepared.forEach(row => created.push(row.toPlain()));
  });
  for (let i = 0; i < created.length; i += 1) {
    if (created[i].reminderMinutesBefore != null) {
      const notifeeId = await scheduleBlockReminder(created[i]);
      if (notifeeId) created[i] = await persistNotifeeId(created[i], notifeeId);
    }
  }
  return created;
}

export async function updateBlock(id: string, patch: Partial<PlannerBlock>): Promise<PlannerBlock | null> {
  let updated: PlannerBlock | null = null;
  let previousNotifeeId: string | null = null;
  await database.write(async () => {
    const row = await plannerBlocksCollection.find(id).catch(() => null);
    if (!row) return;
    previousNotifeeId = row.notifeeId ?? null;
    await row.update(r => {
      if (patch.date !== undefined) r.date = patch.date;
      if (patch.title !== undefined) r.title = patch.title;
      if (patch.kind !== undefined) r.kind = patch.kind;
      if (patch.startMinutes !== undefined) r.startMinutes = patch.startMinutes;
      if (patch.durationMinutes !== undefined) r.durationMinutes = patch.durationMinutes;
      if (patch.color !== undefined) r.color = patch.color;
      if (patch.notes !== undefined) r.notes = patch.notes;
      if (patch.taskId !== undefined) r.taskId = patch.taskId;
      if (patch.habitId !== undefined) r.habitId = patch.habitId;
      if (patch.completed !== undefined) r.completed = patch.completed;
      if (patch.reminderMinutesBefore !== undefined) r.reminderMinutesBefore = patch.reminderMinutesBefore;
      if (patch.autoScheduled !== undefined) r.autoScheduled = patch.autoScheduled;
      if (patch.locked !== undefined) r.locked = patch.locked;
      r.updatedAtNum = Date.now();
    });
    updated = row.toPlain();
  });
  if (!updated) return null;

  // Any change to timing, title or reminder lead time invalidates the
  // scheduled notification — cancel and (re)schedule.
  const timingChanged =
    patch.startMinutes !== undefined ||
    patch.durationMinutes !== undefined ||
    patch.date !== undefined ||
    patch.title !== undefined ||
    patch.reminderMinutesBefore !== undefined ||
    patch.completed !== undefined;

  if (timingChanged) {
    if (previousNotifeeId) await cancelNotification(previousNotifeeId);
    const block: PlannerBlock = updated;
    const notifeeId = block.completed ? null : await scheduleBlockReminder(block);
    updated = await persistNotifeeId(block, notifeeId);
  }
  return updated;
}

export async function deleteBlock(id: string): Promise<void> {
  let notifeeId: string | null = null;
  await database.write(async () => {
    const row = await plannerBlocksCollection.find(id).catch(() => null);
    if (!row) return;
    notifeeId = row.notifeeId ?? null;
    await row.destroyPermanently();
  });
  if (notifeeId) await cancelNotification(notifeeId);
}

export async function deleteBlocksForDate(date: string, opts?: { autoScheduledOnly?: boolean }): Promise<void> {
  const rows = await plannerBlocksCollection.query(Q.where('date', date)).fetch();
  const targets = opts?.autoScheduledOnly
    ? rows.filter(r => r.autoScheduled && !r.locked)
    : rows;
  if (targets.length === 0) return;
  const notifeeIds = targets.map(r => r.notifeeId).filter((v): v is string => !!v);
  await database.write(async () => {
    await database.batch(...targets.map(r => r.prepareDestroyPermanently()));
  });
  for (const id of notifeeIds) await cancelNotification(id);
}

async function persistNotifeeId(block: PlannerBlock, notifeeId: string | null): Promise<PlannerBlock> {
  await database.write(async () => {
    const row = await plannerBlocksCollection.find(block.id).catch(() => null);
    if (!row) return;
    await row.update(r => { r.notifeeId = notifeeId; });
  });
  return { ...block, notifeeId };
}

// ─── Block reminders ─────────────────────────────────────────────────────────

/** Schedule a block's reminder. Returns the notifee id, or null if not scheduled. */
export async function scheduleBlockReminder(block: PlannerBlock): Promise<string | null> {
  if (Platform.OS !== 'android' || !notifee) return null;
  if (block.reminderMinutesBefore == null || block.completed) return null;

  const fireAt = timestampFor(block.date, block.startMinutes) - block.reminderMinutesBefore * 60_000;
  if (fireAt <= Date.now()) return null;   // in the past — nothing to schedule

  await ensurePlannerChannel();
  try {
    return await notifee.createTriggerNotification(
      {
        id: `planner-block-${block.id}`,
        title: block.title || 'Time block',
        body:
          block.reminderMinutesBefore === 0
            ? `Starting now · ${formatDuration(block.durationMinutes)}`
            : `Starts in ${formatDuration(block.reminderMinutesBefore)} at ${formatMinutes(block.startMinutes)}`,
        android: {
          channelId: PLANNER_CHANNEL_ID,
          pressAction: { id: 'default', launchActivity: 'default' },
          importance: 4,
          smallIcon: 'ic_launcher',
        },
        data: { type: 'planner-block', blockId: block.id, date: block.date },
      },
      {
        type: TriggerType?.TIMESTAMP ?? 0,
        timestamp: fireAt,
        alarmManager: true,
      }
    );
  } catch (e) {
    return null;
  }
}

async function cancelNotification(notifeeId: string): Promise<void> {
  if (Platform.OS !== 'android' || !notifee) return;
  try { await notifee.cancelNotification(notifeeId); } catch { /* already gone */ }
}

/**
 * Re-schedule every future block reminder. Safe to call on app start —
 * Android drops pending alarms on reboot / app update.
 */
export async function rescheduleAllBlockReminders(): Promise<number> {
  if (Platform.OS !== 'android' || !notifee) return 0;
  const from = todayKey();
  const rows = await plannerBlocksCollection.query(Q.where('date', Q.gte(from))).fetch();
  let count = 0;
  for (const row of rows) {
    const block = row.toPlain();
    if (block.reminderMinutesBefore == null || block.completed) continue;
    const notifeeId = await scheduleBlockReminder(block);
    if (!notifeeId) continue;
    count += 1;
    if (notifeeId !== block.notifeeId) await persistNotifeeId(block, notifeeId);
  }
  return count;
}

// ─── Days ────────────────────────────────────────────────────────────────────

function emptyDay(date: string): PlannerDay {
  return {
    id: '',
    date,
    focus: '',
    topPriorities: [],
    dailyGoals: [],
    notes: '',
    plannedAt: null,
    reviewedAt: null,
    createdAt: 0,
    updatedAt: 0,
  };
}

/** Fetch the plan for a date. Returns an unsaved blank plan when none exists. */
export async function getDay(date: string): Promise<PlannerDay> {
  const rows = await plannerDaysCollection.query(Q.where('date', date)).fetch();
  return rows.length > 0 ? rows[0].toPlain() : emptyDay(date);
}

export async function getDays(dates: string[]): Promise<PlannerDay[]> {
  if (dates.length === 0) return [];
  const rows = await plannerDaysCollection.query(Q.where('date', Q.oneOf(dates))).fetch();
  const found = new Map(rows.map(r => [r.date, r.toPlain()]));
  return dates.map(d => found.get(d) ?? emptyDay(d));
}

/** All saved plans in a date range, for analytics. */
export async function getDaysInRange(startKey: string, endKey: string): Promise<PlannerDay[]> {
  const rows = await plannerDaysCollection
    .query(Q.where('date', Q.gte(startKey)), Q.where('date', Q.lte(endKey)))
    .fetch();
  return rows.map(r => r.toPlain()).sort((a, b) => a.date.localeCompare(b.date));
}

export async function getBlocksInRange(startKey: string, endKey: string): Promise<PlannerBlock[]> {
  const rows = await plannerBlocksCollection
    .query(Q.where('date', Q.gte(startKey)), Q.where('date', Q.lte(endKey)))
    .fetch();
  return rows.map(r => r.toPlain());
}

/** Create-or-update the plan for a date. */
export async function saveDay(date: string, patch: Partial<PlannerDay>): Promise<PlannerDay> {
  const now = Date.now();
  let saved!: PlannerDay;
  await database.write(async () => {
    const rows = await plannerDaysCollection.query(Q.where('date', date)).fetch();
    if (rows.length > 0) {
      const row = rows[0];
      await row.update(r => {
        if (patch.focus !== undefined) r.focus = patch.focus;
        if (patch.topPriorities !== undefined) r.topPrioritiesRaw = JSON.stringify(patch.topPriorities);
        if (patch.dailyGoals !== undefined) r.dailyGoalsRaw = JSON.stringify(patch.dailyGoals);
        if (patch.notes !== undefined) r.notes = patch.notes;
        if (patch.plannedAt !== undefined) r.plannedAt = patch.plannedAt;
        if (patch.reviewedAt !== undefined) r.reviewedAt = patch.reviewedAt;
        r.updatedAtNum = now;
      });
      saved = row.toPlain();
    } else {
      const row = await plannerDaysCollection.create(r => {
        r.date = date;
        r.focus = patch.focus ?? '';
        r.topPrioritiesRaw = JSON.stringify(patch.topPriorities ?? []);
        r.dailyGoalsRaw = JSON.stringify(patch.dailyGoals ?? []);
        r.notes = patch.notes ?? '';
        r.plannedAt = patch.plannedAt ?? null;
        r.reviewedAt = patch.reviewedAt ?? null;
        r.createdAtNum = now;
        r.updatedAtNum = now;
      });
      saved = row.toPlain();
    }
  });
  return saved;
}

// ─── Day-plan item helpers ───────────────────────────────────────────────────

export function makeTopPriority(title: string, taskId: string | null = null): TopPriority {
  return { id: generateId(), title, taskId, completed: false };
}

export function makeDailyGoal(title: string): DailyGoal {
  return { id: generateId(), title, completed: false };
}

/** True when the plan has nothing in it — used to decide whether to prompt. */
export function isDayEmpty(day: PlannerDay): boolean {
  return (
    !day.focus.trim() &&
    day.topPriorities.length === 0 &&
    day.dailyGoals.length === 0 &&
    !day.notes.trim()
  );
}
