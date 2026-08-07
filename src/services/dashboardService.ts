import { storage } from './storage';
import { DEFAULT_LAYOUT } from '../core/dashboardLayouts';

const LAYOUT_KEY = 'dashboard_layout_v1';
const DAILY_KEY = 'dashboard_daily_v1';

export const WATER_GOAL_GLASSES = 8;

export type MoodValue = 1 | 2 | 3 | 4 | 5;

export interface DailyLog {
  /** YYYY-MM-DD */
  date: string;
  waterGlasses: number;
  mood: MoodValue | null;
  focusMinutes: number;
}

function emptyLog(date: string): DailyLog {
  return { date, waterGlasses: 0, mood: null, focusMinutes: 0 };
}

export function todayKey(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export async function getDashboardLayoutId(): Promise<string> {
  return storage.getSetting<string>(LAYOUT_KEY, DEFAULT_LAYOUT.id);
}

export async function setDashboardLayoutId(id: string): Promise<void> {
  await storage.setSetting(LAYOUT_KEY, id);
}

/**
 * Daily logs are keyed by date so yesterday's numbers never leak into today.
 * Only the last 30 days are kept — enough for a trend, small enough to stay
 * in a single settings row.
 */
async function readLogs(): Promise<Record<string, DailyLog>> {
  return storage.getSetting<Record<string, DailyLog>>(DAILY_KEY, {});
}

async function writeLogs(logs: Record<string, DailyLog>): Promise<void> {
  const keys = Object.keys(logs).sort().reverse().slice(0, 30);
  const trimmed: Record<string, DailyLog> = {};
  keys.forEach(k => { trimmed[k] = logs[k]; });
  await storage.setSetting(DAILY_KEY, trimmed);
}

export async function getDailyLog(date = todayKey()): Promise<DailyLog> {
  const logs = await readLogs();
  return logs[date] ?? emptyLog(date);
}

async function patchDailyLog(date: string, patch: Partial<DailyLog>): Promise<DailyLog> {
  const logs = await readLogs();
  const next: DailyLog = { ...(logs[date] ?? emptyLog(date)), ...patch, date };
  logs[date] = next;
  await writeLogs(logs);
  return next;
}

export async function addWaterGlass(delta = 1, date = todayKey()): Promise<DailyLog> {
  const current = await getDailyLog(date);
  const waterGlasses = Math.max(0, current.waterGlasses + delta);
  return patchDailyLog(date, { waterGlasses });
}

export async function setMood(mood: MoodValue | null, date = todayKey()): Promise<DailyLog> {
  return patchDailyLog(date, { mood });
}

export async function addFocusMinutes(minutes: number, date = todayKey()): Promise<DailyLog> {
  const current = await getDailyLog(date);
  return patchDailyLog(date, { focusMinutes: Math.max(0, current.focusMinutes + minutes) });
}

export async function getRecentLogs(days = 7): Promise<DailyLog[]> {
  const logs = await readLogs();
  const out: DailyLog[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const key = todayKey(d);
    out.push(logs[key] ?? emptyLog(key));
  }
  return out;
}
