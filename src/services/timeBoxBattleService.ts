/**
 * Time Box Battle — race against your past self for the same task.
 *
 * Tracks the best (shortest) completion time for each task. Each new
 * timed session compares against the personal best and emits a result.
 */

import { storage } from './storage';
import { getTimeRecord } from './timeTrackingService';

const KEY_PREFIX = 'time_box_pr_';

export interface PersonalRecord {
  bestSeconds: number;
  setAt: number;
  attempts: number;
}

export interface BattleResult {
  /** Whether this run set a new personal record. */
  newRecord: boolean;
  /** Diff from previous record in seconds (negative = faster). */
  deltaSeconds: number;
  /** Previous record (if any). */
  previousBest?: number;
  /** Current run duration. */
  runSeconds: number;
}

function key(taskId: string): string {
  return `${KEY_PREFIX}${taskId}`;
}

export async function getPersonalRecord(taskId: string): Promise<PersonalRecord | null> {
  return storage.getSetting<PersonalRecord | null>(key(taskId), null);
}

/**
 * Call after the user stops the timer. Reads the most recent entry,
 * compares with the existing personal best, updates if faster.
 */
export async function recordRun(taskId: string): Promise<BattleResult | null> {
  const record = await getTimeRecord(taskId);
  const latest = record.entries[0];
  if (!latest || latest.durationSeconds < 30) return null;

  const existing = await getPersonalRecord(taskId);
  const runSeconds = latest.durationSeconds;
  const previousBest = existing?.bestSeconds;

  if (!existing) {
    await storage.setSetting(key(taskId), {
      bestSeconds: runSeconds,
      setAt: Date.now(),
      attempts: 1,
    });
    return { newRecord: false, deltaSeconds: 0, runSeconds };
  }

  const updated: PersonalRecord = {
    bestSeconds: Math.min(existing.bestSeconds, runSeconds),
    setAt: runSeconds < existing.bestSeconds ? Date.now() : existing.setAt,
    attempts: existing.attempts + 1,
  };
  await storage.setSetting(key(taskId), updated);

  return {
    newRecord: runSeconds < existing.bestSeconds,
    deltaSeconds: runSeconds - existing.bestSeconds,
    previousBest,
    runSeconds,
  };
}

export async function clearPersonalRecord(taskId: string): Promise<void> {
  await storage.setSetting(key(taskId), null);
}
