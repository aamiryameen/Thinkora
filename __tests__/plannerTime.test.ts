/**
 * Unit tests for the planner's pure date/time helpers and analytics
 * aggregation. Both modules are dependency-free by design.
 */

import {
  addDaysToKey,
  formatDuration,
  formatMinutes,
  fromDateKey,
  parseHHmm,
  timestampFor,
  toDateKey,
  weekKeys,
  weekStartKey,
} from '../src/core/plannerTime';
import {
  computePlannerAnalytics,
  dayKeyRange,
} from '../src/services/plannerAnalyticsService';
import type { PlannerBlock, PlannerDay } from '../src/types/planner';

describe('toDateKey / fromDateKey', () => {
  it('zero-pads month and day', () => {
    expect(toDateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('round-trips a key through a Date', () => {
    expect(toDateKey(fromDateKey('2026-08-03'))).toBe('2026-08-03');
  });

  it('parses to local midnight, not UTC', () => {
    const d = fromDateKey('2026-08-03');
    expect(d.getHours()).toBe(0);
    expect(d.getDate()).toBe(3);
    expect(d.getMonth()).toBe(7);
  });
});

describe('addDaysToKey', () => {
  it('advances within a month', () => {
    expect(addDaysToKey('2026-08-03', 3)).toBe('2026-08-06');
  });

  it('rolls over a month boundary', () => {
    expect(addDaysToKey('2026-08-31', 1)).toBe('2026-09-01');
  });

  it('rolls back over a year boundary', () => {
    expect(addDaysToKey('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('handles a leap day', () => {
    expect(addDaysToKey('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDaysToKey('2028-02-29', 1)).toBe('2028-03-01');
  });

  it('is a no-op for zero', () => {
    expect(addDaysToKey('2026-08-03', 0)).toBe('2026-08-03');
  });
});

describe('weekStartKey / weekKeys', () => {
  // 2026-08-03 is a Monday.
  it('finds the Sunday start by default', () => {
    expect(weekStartKey('2026-08-03', 0)).toBe('2026-08-02');
  });

  it('finds the Monday start when the week begins on Monday', () => {
    expect(weekStartKey('2026-08-03', 1)).toBe('2026-08-03');
  });

  it('returns seven consecutive days', () => {
    const keys = weekKeys('2026-08-05', 0);
    expect(keys).toHaveLength(7);
    expect(keys[0]).toBe('2026-08-02');
    expect(keys[6]).toBe('2026-08-08');
  });

  it('is stable for any day inside the same week', () => {
    expect(weekStartKey('2026-08-08', 0)).toBe(weekStartKey('2026-08-02', 0));
  });
});

describe('timestampFor', () => {
  it('offsets from local midnight by the given minutes', () => {
    const ts = timestampFor('2026-08-03', 9 * 60 + 30);
    const d = new Date(ts);
    expect(d.getHours()).toBe(9);
    expect(d.getMinutes()).toBe(30);
    expect(d.getDate()).toBe(3);
  });

  it('handles midnight', () => {
    const d = new Date(timestampFor('2026-08-03', 0));
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
  });
});

describe('formatMinutes', () => {
  it.each([
    [0, '12:00 AM'],
    [1, '12:01 AM'],
    [9 * 60, '9:00 AM'],
    [11 * 60 + 59, '11:59 AM'],
    [12 * 60, '12:00 PM'],
    [13 * 60 + 5, '1:05 PM'],
    [23 * 60 + 45, '11:45 PM'],
  ])('formats %i as %s', (minutes, expected) => {
    expect(formatMinutes(minutes)).toBe(expected);
  });

  it('wraps past midnight rather than printing an invalid hour', () => {
    expect(formatMinutes(1440)).toBe('12:00 AM');
    expect(formatMinutes(1500)).toBe('1:00 AM');
  });

  it('wraps negative values', () => {
    expect(formatMinutes(-60)).toBe('11:00 PM');
  });
});

describe('formatDuration', () => {
  it.each([
    [0, '0m'],
    [15, '15m'],
    [59, '59m'],
    [60, '1h'],
    [90, '1h 30m'],
    [120, '2h'],
    [485, '8h 5m'],
  ])('formats %i as %s', (minutes, expected) => {
    expect(formatDuration(minutes)).toBe(expected);
  });
});

describe('parseHHmm', () => {
  it('parses valid times', () => {
    expect(parseHHmm('07:30')).toBe(450);
    expect(parseHHmm('7:30')).toBe(450);
    expect(parseHHmm('00:00')).toBe(0);
    expect(parseHHmm('23:59')).toBe(1439);
  });

  it('tolerates surrounding whitespace', () => {
    expect(parseHHmm('  9:15 ')).toBe(555);
  });

  it('rejects out-of-range and malformed values', () => {
    expect(parseHHmm('24:00')).toBeNull();
    expect(parseHHmm('12:60')).toBeNull();
    expect(parseHHmm('9')).toBeNull();
    expect(parseHHmm('nine')).toBeNull();
    expect(parseHHmm('')).toBeNull();
    expect(parseHHmm(null)).toBeNull();
    expect(parseHHmm(undefined)).toBeNull();
  });
});

// ─── Analytics ───────────────────────────────────────────────────────────────

let seq = 0;
function block(partial: Partial<PlannerBlock> = {}): PlannerBlock {
  seq += 1;
  return {
    id: `b${seq}`, date: '2026-08-03', title: `B${seq}`, kind: 'focus',
    startMinutes: 9 * 60, durationMinutes: 60, color: '#000', notes: '',
    taskId: null, habitId: null, completed: false, reminderMinutesBefore: null,
    notifeeId: null, autoScheduled: false, locked: false, createdAt: 0, updatedAt: 0,
    ...partial,
  };
}

function day(partial: Partial<PlannerDay> = {}): PlannerDay {
  return {
    id: 'd1', date: '2026-08-03', focus: '', topPriorities: [], dailyGoals: [],
    notes: '', plannedAt: null, reviewedAt: null, createdAt: 0, updatedAt: 0,
    ...partial,
  };
}

describe('dayKeyRange', () => {
  it('is inclusive of both ends', () => {
    expect(dayKeyRange('2026-08-01', '2026-08-03')).toEqual([
      '2026-08-01', '2026-08-02', '2026-08-03',
    ]);
  });

  it('returns a single day when start equals end', () => {
    expect(dayKeyRange('2026-08-03', '2026-08-03')).toEqual(['2026-08-03']);
  });

  it('returns nothing for an inverted range instead of looping forever', () => {
    expect(dayKeyRange('2026-08-05', '2026-08-01')).toEqual([]);
  });
});

describe('computePlannerAnalytics', () => {
  it('returns zeroed metrics with no data, without dividing by zero', () => {
    const a = computePlannerAnalytics([], [], '2026-08-01', '2026-08-07');
    expect(a.daysInRange).toBe(7);
    expect(a.daysPlanned).toBe(0);
    expect(a.adherencePct).toBe(0);
    expect(a.planningRatePct).toBe(0);
    expect(a.avgPlannedMinutesPerActiveDay).toBe(0);
    expect(a.peakHour).toBeNull();
    expect(a.bestWeekday).toBeNull();
    expect(a.planningStreak).toBe(0);
  });

  it('computes adherence from completed vs planned minutes', () => {
    const blocks = [
      block({ date: '2026-08-03', durationMinutes: 60, completed: true }),
      block({ date: '2026-08-03', durationMinutes: 60, completed: false }),
    ];
    const a = computePlannerAnalytics(blocks, [], '2026-08-03', '2026-08-03');
    expect(a.totalPlannedMinutes).toBe(120);
    expect(a.totalCompletedMinutes).toBe(60);
    expect(a.adherencePct).toBe(50);
  });

  it('counts a day as planned when it only has a focus', () => {
    const days = [day({ date: '2026-08-03', focus: 'Ship it' })];
    const a = computePlannerAnalytics([], days, '2026-08-03', '2026-08-03');
    expect(a.daysPlanned).toBe(1);
    expect(a.planningRatePct).toBe(100);
  });

  it('attributes block minutes to every hour the block overlaps', () => {
    // 9:30–11:00 → 30 min in hour 9, 60 min in hour 10.
    const blocks = [block({ startMinutes: 9 * 60 + 30, durationMinutes: 90 })];
    const a = computePlannerAnalytics(blocks, [], '2026-08-03', '2026-08-03');
    expect(a.byHour[9].minutes).toBe(30);
    expect(a.byHour[10].minutes).toBe(60);
    expect(a.byHour[11].minutes).toBe(0);
  });

  it('sums per-kind minutes to the total', () => {
    const blocks = [
      block({ kind: 'focus', durationMinutes: 120 }),
      block({ kind: 'break', durationMinutes: 60 }),
      block({ kind: 'focus', durationMinutes: 60 }),
    ];
    const a = computePlannerAnalytics(blocks, [], '2026-08-03', '2026-08-03');
    const focus = a.byKind.find(k => k.kind === 'focus')!;
    expect(focus.minutes).toBe(180);
    expect(focus.blocks).toBe(2);
    expect(a.byKind.reduce((s, k) => s + k.minutes, 0)).toBe(240);
    // Sorted by minutes descending.
    expect(a.byKind[0].kind).toBe('focus');
  });

  it('counts the planning streak backwards from the end of the range', () => {
    const days = [
      day({ date: '2026-08-01', focus: 'a' }),
      // 2026-08-02 deliberately missing — breaks the streak.
      day({ date: '2026-08-03', focus: 'c' }),
      day({ date: '2026-08-04', focus: 'd' }),
    ];
    const a = computePlannerAnalytics([], days, '2026-08-01', '2026-08-04');
    expect(a.planningStreak).toBe(2);
  });

  it('reports a zero streak when the last day is unplanned', () => {
    const days = [day({ date: '2026-08-01', focus: 'a' })];
    const a = computePlannerAnalytics([], days, '2026-08-01', '2026-08-03');
    expect(a.planningStreak).toBe(0);
  });

  it('aggregates goals and priorities across days', () => {
    const days = [
      day({
        date: '2026-08-03',
        dailyGoals: [
          { id: 'g1', title: 'a', completed: true },
          { id: 'g2', title: 'b', completed: false },
        ],
        topPriorities: [{ id: 'p1', title: 'p', taskId: null, completed: true }],
      }),
    ];
    const a = computePlannerAnalytics([], days, '2026-08-03', '2026-08-03');
    expect(a.goalsTotal).toBe(2);
    expect(a.goalsDone).toBe(1);
    expect(a.goalCompletionPct).toBe(50);
    expect(a.prioritiesTotal).toBe(1);
    expect(a.priorityCompletionPct).toBe(100);
  });

  it('produces one bucket per day in the range', () => {
    const a = computePlannerAnalytics([], [], '2026-08-01', '2026-08-07');
    expect(a.byDay).toHaveLength(7);
    expect(a.byDay[0].date).toBe('2026-08-01');
    expect(a.byDay[6].date).toBe('2026-08-07');
  });

  it('identifies the peak hour by completed minutes', () => {
    const blocks = [
      block({ startMinutes: 9 * 60, durationMinutes: 60, completed: false }),
      block({ startMinutes: 14 * 60, durationMinutes: 60, completed: true }),
    ];
    const a = computePlannerAnalytics(blocks, [], '2026-08-03', '2026-08-03');
    expect(a.peakHour).toBe(14);
  });

  it('clips a block that would run past midnight', () => {
    const blocks = [block({ startMinutes: 23 * 60, durationMinutes: 120 })];
    const a = computePlannerAnalytics(blocks, [], '2026-08-03', '2026-08-03');
    expect(a.byHour[23].minutes).toBe(60);
    expect(a.byHour).toHaveLength(24);
  });
});
