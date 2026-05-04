/**
 * Time Tracking Service — start/stop a timer for any task and accumulate
 * total time spent. Backed by the settings key/value table (no schema
 * migration needed).
 *
 * Storage shape:
 *   key = "time_entries_<taskId>"
 *   value = { totalSeconds: number; entries: TimeEntry[]; activeStartedAt: number | null }
 */

import { storage } from './storage';
import { generateId } from '../utils/id';

export interface TimeEntry {
  id: string;
  startedAt: number;
  endedAt: number;
  durationSeconds: number;
  note?: string;
}

export interface TaskTimeRecord {
  totalSeconds: number;
  entries: TimeEntry[];
  activeStartedAt: number | null; // null when not running
}

const EMPTY: TaskTimeRecord = { totalSeconds: 0, entries: [], activeStartedAt: null };

function keyFor(taskId: string): string {
  return `time_entries_${taskId}`;
}

export async function getTimeRecord(taskId: string): Promise<TaskTimeRecord> {
  return storage.getSetting<TaskTimeRecord>(keyFor(taskId), EMPTY);
}

export async function startTimer(taskId: string): Promise<TaskTimeRecord> {
  const record = await getTimeRecord(taskId);
  if (record.activeStartedAt) return record; // Already running
  const updated: TaskTimeRecord = { ...record, activeStartedAt: Date.now() };
  await storage.setSetting(keyFor(taskId), updated);
  return updated;
}

export async function stopTimer(taskId: string, note?: string): Promise<TaskTimeRecord> {
  const record = await getTimeRecord(taskId);
  if (!record.activeStartedAt) return record; // Not running
  const endedAt = Date.now();
  const durationSeconds = Math.max(0, Math.round((endedAt - record.activeStartedAt) / 1000));
  const entry: TimeEntry = {
    id: generateId(),
    startedAt: record.activeStartedAt,
    endedAt,
    durationSeconds,
    note,
  };
  const updated: TaskTimeRecord = {
    totalSeconds: record.totalSeconds + durationSeconds,
    entries: [entry, ...record.entries].slice(0, 100), // keep last 100
    activeStartedAt: null,
  };
  await storage.setSetting(keyFor(taskId), updated);
  return updated;
}

export async function deleteEntry(taskId: string, entryId: string): Promise<TaskTimeRecord> {
  const record = await getTimeRecord(taskId);
  const entry = record.entries.find(e => e.id === entryId);
  if (!entry) return record;
  const updated: TaskTimeRecord = {
    ...record,
    totalSeconds: Math.max(0, record.totalSeconds - entry.durationSeconds),
    entries: record.entries.filter(e => e.id !== entryId),
  };
  await storage.setSetting(keyFor(taskId), updated);
  return updated;
}

export async function clearAllEntries(taskId: string): Promise<void> {
  await storage.setSetting(keyFor(taskId), EMPTY);
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return s ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const remM = m % 60;
  return remM ? `${h}h ${remM}m` : `${h}h`;
}

/** Get all task time records (for productivity stats). */
export async function getAllTimeRecords(taskIds: string[]): Promise<Record<string, TaskTimeRecord>> {
  const result: Record<string, TaskTimeRecord> = {};
  for (const id of taskIds) {
    const rec = await getTimeRecord(id);
    if (rec.totalSeconds > 0 || rec.entries.length > 0 || rec.activeStartedAt) {
      result[id] = rec;
    }
  }
  return result;
}
