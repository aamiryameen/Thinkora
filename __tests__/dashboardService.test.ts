const mockStore = new Map<string, unknown>();

jest.mock('../src/services/storage', () => ({
  storage: {
    getSetting: jest.fn(async (key: string, fallback: unknown) =>
      mockStore.has(key) ? mockStore.get(key) : fallback),
    setSetting: jest.fn(async (key: string, value: unknown) => { mockStore.set(key, value); }),
  },
}));

import {
  addFocusMinutes,
  addWaterGlass,
  getDailyLog,
  getDashboardLayoutId,
  getRecentLogs,
  setDashboardLayoutId,
  setMood,
  todayKey,
  WATER_GOAL_GLASSES,
} from '../src/services/dashboardService';
import { DEFAULT_LAYOUT } from '../src/core/dashboardLayouts';

beforeEach(() => { mockStore.clear(); });

describe('todayKey', () => {
  it('formats as YYYY-MM-DD with zero padding', () => {
    expect(todayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(todayKey(new Date(2026, 11, 25))).toBe('2026-12-25');
  });

  it('uses local date parts, so it matches Habit.completedDates', () => {
    const d = new Date(2026, 7, 3, 23, 30);
    expect(todayKey(d)).toBe('2026-08-03');
  });
});

describe('layout preference', () => {
  it('defaults to the free layout when nothing is stored', async () => {
    expect(await getDashboardLayoutId()).toBe(DEFAULT_LAYOUT.id);
  });

  it('round-trips a selection', async () => {
    await setDashboardLayoutId('wellness');
    expect(await getDashboardLayoutId()).toBe('wellness');
  });
});

describe('daily log', () => {
  it('starts empty for today', async () => {
    const log = await getDailyLog();
    expect(log).toEqual({ date: todayKey(), waterGlasses: 0, mood: null, focusMinutes: 0 });
  });

  it('increments and decrements water', async () => {
    expect((await addWaterGlass(1)).waterGlasses).toBe(1);
    expect((await addWaterGlass(1)).waterGlasses).toBe(2);
    expect((await addWaterGlass(-1)).waterGlasses).toBe(1);
  });

  it('never goes below zero glasses', async () => {
    expect((await addWaterGlass(-5)).waterGlasses).toBe(0);
  });

  it('allows exceeding the goal', async () => {
    for (let i = 0; i < WATER_GOAL_GLASSES + 2; i++) await addWaterGlass(1);
    expect((await getDailyLog()).waterGlasses).toBe(WATER_GOAL_GLASSES + 2);
  });

  it('stores and clears mood', async () => {
    expect((await setMood(4)).mood).toBe(4);
    expect((await setMood(null)).mood).toBeNull();
  });

  it('accumulates focus minutes without clobbering water', async () => {
    await addWaterGlass(3);
    const log = await addFocusMinutes(25);
    expect(log.focusMinutes).toBe(25);
    expect(log.waterGlasses).toBe(3);
    expect((await addFocusMinutes(25)).focusMinutes).toBe(50);
  });

  it('never accumulates negative focus time', async () => {
    expect((await addFocusMinutes(-30)).focusMinutes).toBe(0);
  });

  it('keeps days separate, so yesterday does not leak into today', async () => {
    await addWaterGlass(5, '2026-08-02');
    await addWaterGlass(1, '2026-08-03');
    expect((await getDailyLog('2026-08-02')).waterGlasses).toBe(5);
    expect((await getDailyLog('2026-08-03')).waterGlasses).toBe(1);
  });

  it('returns an empty log for a date never written', async () => {
    const log = await getDailyLog('2020-01-01');
    expect(log.waterGlasses).toBe(0);
    expect(log.mood).toBeNull();
  });
});

describe('log retention', () => {
  it('keeps only the most recent 30 days', async () => {
    for (let d = 1; d <= 40; d++) {
      await addWaterGlass(1, `2026-03-${String(d).padStart(2, '0')}`);
    }
    const logs = mockStore.get('dashboard_daily_v1') as Record<string, unknown>;
    expect(Object.keys(logs)).toHaveLength(30);
    // Newest kept, oldest dropped.
    expect(logs['2026-03-40']).toBeDefined();
    expect(logs['2026-03-01']).toBeUndefined();
  });
});

describe('getRecentLogs', () => {
  it('returns one entry per day, oldest first, filling gaps', async () => {
    const logs = await getRecentLogs(7);
    expect(logs).toHaveLength(7);
    expect(logs[6].date).toBe(todayKey());
    logs.forEach(l => expect(l.waterGlasses).toBe(0));
  });

  it('includes written values for days that exist', async () => {
    await addWaterGlass(4);
    const logs = await getRecentLogs(3);
    expect(logs[2].waterGlasses).toBe(4);
  });
});
