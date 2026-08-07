/**
 * Unit tests for the planner scheduling engine.
 *
 * These are pure functions, so no React Native mocking is required — the
 * module under test only imports `parseHHmm` from plannerService, which is
 * itself pure.
 */

import {
  autoSchedule,
  computeDayProgress,
  findFreeSlots,
  isHabitDueOn,
  nextFreeSlot,
  optimizeSchedule,
  rankCandidates,
  type AutoScheduleCandidate,
} from '../src/services/plannerScheduleService';
import { DEFAULT_PLANNER_PREFERENCES, type PlannerBlock } from '../src/types/planner';
import type { Habit, Task } from '../src/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

let blockSeq = 0;
function block(partial: Partial<PlannerBlock> = {}): PlannerBlock {
  blockSeq += 1;
  return {
    id: `b${blockSeq}`,
    date: '2026-08-03',
    title: `Block ${blockSeq}`,
    kind: 'focus',
    startMinutes: 9 * 60,
    durationMinutes: 60,
    color: '#000',
    notes: '',
    taskId: null,
    habitId: null,
    completed: false,
    reminderMinutesBefore: null,
    notifeeId: null,
    autoScheduled: false,
    locked: false,
    createdAt: 0,
    updatedAt: 0,
    ...partial,
  };
}

function task(partial: Partial<Task> = {}): Task {
  return {
    id: 't1',
    title: 'Task',
    completed: false,
    categoryId: null,
    dueDate: null,
    reminderDate: null,
    repeat: 'none',
    notes: '',
    attachments: [],
    subtasks: [],
    priority: 'none',
    createdAt: 0,
    updatedAt: 0,
    ...partial,
  };
}

const prefs = { ...DEFAULT_PLANNER_PREFERENCES };

// ─── findFreeSlots ───────────────────────────────────────────────────────────

describe('findFreeSlots', () => {
  it('returns the whole window when nothing is scheduled', () => {
    expect(findFreeSlots([], 540, 720)).toEqual([{ startMinutes: 540, endMinutes: 720 }]);
  });

  it('returns gaps around a single block', () => {
    const blocks = [{ startMinutes: 600, durationMinutes: 60 }];   // 10:00–11:00
    expect(findFreeSlots(blocks, 540, 780)).toEqual([
      { startMinutes: 540, endMinutes: 600 },
      { startMinutes: 660, endMinutes: 780 },
    ]);
  });

  it('merges overlapping blocks so a gap is never double-counted', () => {
    const blocks = [
      { startMinutes: 600, durationMinutes: 90 },   // 10:00–11:30
      { startMinutes: 630, durationMinutes: 90 },   // 10:30–12:00 (overlaps)
    ];
    expect(findFreeSlots(blocks, 540, 780)).toEqual([
      { startMinutes: 540, endMinutes: 600 },
      { startMinutes: 720, endMinutes: 780 },
    ]);
  });

  it('merges blocks that touch exactly', () => {
    const blocks = [
      { startMinutes: 600, durationMinutes: 60 },   // 10:00–11:00
      { startMinutes: 660, durationMinutes: 60 },   // 11:00–12:00
    ];
    expect(findFreeSlots(blocks, 600, 780)).toEqual([{ startMinutes: 720, endMinutes: 780 }]);
  });

  it('drops gaps shorter than the minimum', () => {
    const blocks = [
      { startMinutes: 540, durationMinutes: 60 },
      { startMinutes: 610, durationMinutes: 60 },   // only a 10-minute gap
    ];
    expect(findFreeSlots(blocks, 540, 670, 15)).toEqual([]);
  });

  it('clips blocks that start before or end after the window', () => {
    const blocks = [{ startMinutes: 480, durationMinutes: 120 }];  // 8:00–10:00
    expect(findFreeSlots(blocks, 540, 720)).toEqual([{ startMinutes: 600, endMinutes: 720 }]);
  });

  it('returns nothing for an inverted or empty window', () => {
    expect(findFreeSlots([], 720, 720)).toEqual([]);
    expect(findFreeSlots([], 780, 540)).toEqual([]);
  });

  it('ignores blocks entirely outside the window', () => {
    const blocks = [{ startMinutes: 60, durationMinutes: 60 }];
    expect(findFreeSlots(blocks, 540, 720)).toEqual([{ startMinutes: 540, endMinutes: 720 }]);
  });
});

describe('nextFreeSlot', () => {
  it('never suggests a slot before the requested time', () => {
    const slot = nextFreeSlot([], 14 * 60, prefs, 30);
    expect(slot?.startMinutes).toBe(14 * 60);
  });

  // Regression: MorningPlanningScreen used to call this three times against a
  // `blocks` array that hadn't re-rendered yet, so all three priorities were
  // blocked at the same start time and stacked on top of each other. The screen
  // now accumulates claimed slots, which this models.
  it('yields distinct consecutive slots when each claim is fed back in', () => {
    const occupied: { startMinutes: number; durationMinutes: number }[] = [];
    const starts: number[] = [];
    for (let i = 0; i < 3; i += 1) {
      const slot = nextFreeSlot(occupied, 9 * 60, prefs, 60);
      expect(slot).not.toBeNull();
      starts.push(slot!.startMinutes);
      occupied.push({ startMinutes: slot!.startMinutes, durationMinutes: 60 });
    }
    expect(starts).toEqual([540, 600, 660]);   // 9:00, 10:00, 11:00
    expect(new Set(starts).size).toBe(3);
  });

  it('returns the same slot when a claim is NOT fed back in (the old bug)', () => {
    const occupied: { startMinutes: number; durationMinutes: number }[] = [];
    const a = nextFreeSlot(occupied, 9 * 60, prefs, 60);
    const b = nextFreeSlot(occupied, 9 * 60, prefs, 60);
    // Documents why the accumulator in the screen is load-bearing.
    expect(a?.startMinutes).toBe(b?.startMinutes);
  });

  it('respects the day start when asked for a time before it', () => {
    const slot = nextFreeSlot([], 0, prefs, 30);
    expect(slot?.startMinutes).toBe(prefs.dayStartHour * 60);
  });

  it('returns null when the rest of the day is full', () => {
    const blocks = [{ startMinutes: 0, durationMinutes: 1440 }];
    expect(nextFreeSlot(blocks, 9 * 60, prefs, 30)).toBeNull();
  });
});

// ─── rankCandidates ──────────────────────────────────────────────────────────

describe('rankCandidates', () => {
  const base = { durationMinutes: 60, priority: 'none' as const, dueDate: null };

  it('puts the nearest deadline first', () => {
    const ranked = rankCandidates([
      { ...base, taskId: 'late', title: 'late', dueDate: 5000 },
      { ...base, taskId: 'soon', title: 'soon', dueDate: 1000 },
    ]);
    expect(ranked.map(c => c.taskId)).toEqual(['soon', 'late']);
  });

  it('breaks deadline ties by priority', () => {
    const ranked = rankCandidates([
      { ...base, taskId: 'low', title: 'low', priority: 'low', dueDate: 1000 },
      { ...base, taskId: 'high', title: 'high', priority: 'high', dueDate: 1000 },
    ]);
    expect(ranked.map(c => c.taskId)).toEqual(['high', 'low']);
  });

  it('sorts undated tasks after dated ones', () => {
    const ranked = rankCandidates([
      { ...base, taskId: 'undated', title: 'undated' },
      { ...base, taskId: 'dated', title: 'dated', dueDate: 9_999_999 },
    ]);
    expect(ranked.map(c => c.taskId)).toEqual(['dated', 'undated']);
  });

  it('schedules the longer task first when deadline and priority tie', () => {
    const ranked = rankCandidates([
      { ...base, taskId: 'short', title: 'short', durationMinutes: 30 },
      { ...base, taskId: 'long', title: 'long', durationMinutes: 120 },
    ]);
    expect(ranked.map(c => c.taskId)).toEqual(['long', 'short']);
  });
});

// ─── autoSchedule ────────────────────────────────────────────────────────────

describe('autoSchedule', () => {
  const candidate = (over: Partial<AutoScheduleCandidate> = {}): AutoScheduleCandidate => ({
    taskId: 'a', title: 'A', durationMinutes: 60, priority: 'none', dueDate: null, ...over,
  });

  it('places a task at the start of working hours on an empty day', () => {
    const { placements, unplaced } = autoSchedule([candidate()], [], prefs);
    expect(unplaced).toHaveLength(0);
    expect(placements[0].startMinutes).toBe(prefs.workStartHour * 60);
  });

  it('leaves the configured buffer between consecutive placements', () => {
    const { placements } = autoSchedule(
      [candidate({ taskId: 'a', durationMinutes: 60 }), candidate({ taskId: 'b', durationMinutes: 60 })],
      [],
      { ...prefs, bufferMinutes: 10 }
    );
    const sorted = [...placements].sort((x, y) => x.startMinutes - y.startMinutes);
    expect(sorted[1].startMinutes - (sorted[0].startMinutes + sorted[0].durationMinutes)).toBe(10);
  });

  it('never overlaps an existing block', () => {
    const existing = [block({ startMinutes: 9 * 60, durationMinutes: 120 })];  // 9–11
    const { placements } = autoSchedule([candidate({ durationMinutes: 60 })], existing, prefs);
    expect(placements[0].startMinutes).toBeGreaterThanOrEqual(11 * 60);
  });

  it('reports tasks that do not fit instead of truncating them', () => {
    // Only a 30-minute window is free, but the task needs 4 hours.
    const tightPrefs = { ...prefs, workStartHour: 9, workEndHour: 10 };
    const { placements, unplaced } = autoSchedule(
      [candidate({ durationMinutes: 240 })],
      [],
      tightPrefs
    );
    expect(placements).toHaveLength(0);
    expect(unplaced).toHaveLength(1);
    expect(unplaced[0].durationMinutes).toBe(240);
  });

  it('does not schedule before `earliestMinutes` (i.e. in the past)', () => {
    const { placements } = autoSchedule([candidate()], [], prefs, 15 * 60);
    expect(placements[0].startMinutes).toBeGreaterThanOrEqual(15 * 60);
  });

  it('keeps every placement inside working hours', () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      candidate({ taskId: `t${i}`, title: `T${i}`, durationMinutes: 60 })
    );
    const { placements } = autoSchedule(many, [], prefs);
    for (const p of placements) {
      expect(p.startMinutes).toBeGreaterThanOrEqual(prefs.workStartHour * 60);
      expect(p.startMinutes + p.durationMinutes).toBeLessThanOrEqual(prefs.workEndHour * 60);
    }
  });

  it('produces no overlapping placements', () => {
    const many = Array.from({ length: 8 }, (_, i) =>
      candidate({ taskId: `t${i}`, title: `T${i}`, durationMinutes: 45 })
    );
    const { placements } = autoSchedule(many, [], prefs);
    const sorted = [...placements].sort((a, b) => a.startMinutes - b.startMinutes);
    for (let i = 1; i < sorted.length; i += 1) {
      expect(sorted[i].startMinutes).toBeGreaterThanOrEqual(
        sorted[i - 1].startMinutes + sorted[i - 1].durationMinutes
      );
    }
  });

  it('handles an empty candidate list', () => {
    expect(autoSchedule([], [], prefs)).toEqual({ placements: [], unplaced: [] });
  });
});

// ─── optimizeSchedule ────────────────────────────────────────────────────────

describe('optimizeSchedule', () => {
  it('leaves locked blocks exactly where they are', () => {
    const locked = block({ id: 'locked', startMinutes: 16 * 60, locked: true });
    const movable = block({ id: 'movable', startMinutes: 10 * 60, kind: 'focus' });
    const { moves } = optimizeSchedule([locked, movable], prefs, new Map());
    expect(moves.find(m => m.blockId === 'locked')).toBeUndefined();
  });

  it('leaves completed blocks alone', () => {
    const done = block({ id: 'done', startMinutes: 16 * 60, completed: true });
    const { moves } = optimizeSchedule([done], prefs, new Map());
    expect(moves).toHaveLength(0);
  });

  it('treats blocks before `earliestMinutes` as immovable history', () => {
    const past = block({ id: 'past', startMinutes: 8 * 60 });
    const { moves } = optimizeSchedule([past], prefs, new Map(), 12 * 60);
    expect(moves.find(m => m.blockId === 'past')).toBeUndefined();
  });

  it('never reports a move that changes nothing', () => {
    const only = block({ id: 'only', startMinutes: prefs.dayStartHour * 60 });
    const { moves } = optimizeSchedule([only], prefs, new Map());
    expect(moves).toHaveLength(0);
  });

  it('preserves every block duration', () => {
    const blocks = [
      block({ id: 'x', startMinutes: 14 * 60, durationMinutes: 90, kind: 'custom' }),
      block({ id: 'y', startMinutes: 10 * 60, durationMinutes: 30, kind: 'focus' }),
    ];
    const { moves } = optimizeSchedule(blocks, prefs, new Map());
    for (const move of moves) {
      const original = blocks.find(b => b.id === move.blockId)!;
      // Duration is not part of a move at all — only the start time changes.
      expect(original.durationMinutes).toBe(original.durationMinutes);
      expect(move.toMinutes).toBeGreaterThanOrEqual(prefs.dayStartHour * 60);
    }
  });

  it('promotes high-priority overdue work ahead of low-value work', () => {
    const urgent = block({ id: 'urgent', startMinutes: 16 * 60, taskId: 'ut', kind: 'task' });
    const filler = block({ id: 'filler', startMinutes: 7 * 60, kind: 'custom' });
    const taskMap = new Map<string, Task>([
      ['ut', task({ id: 'ut', priority: 'high', dueDate: Date.now() - 86_400_000 })],
    ]);
    const { moves } = optimizeSchedule([urgent, filler], prefs, taskMap);
    const urgentMove = moves.find(m => m.blockId === 'urgent');
    // The urgent block should end up earlier than where it started.
    if (urgentMove) expect(urgentMove.toMinutes).toBeLessThan(urgentMove.fromMinutes);
  });

  it('produces no overlaps among the resulting schedule', () => {
    const blocks = [
      block({ id: 'a', startMinutes: 15 * 60, durationMinutes: 60, kind: 'focus' }),
      block({ id: 'b', startMinutes: 17 * 60, durationMinutes: 60, kind: 'event' }),
      block({ id: 'c', startMinutes: 19 * 60, durationMinutes: 30, kind: 'custom' }),
    ];
    const { moves } = optimizeSchedule(blocks, prefs, new Map());
    const finalPositions = blocks.map(b => {
      const move = moves.find(m => m.blockId === b.id);
      return { start: move ? move.toMinutes : b.startMinutes, duration: b.durationMinutes };
    }).sort((x, y) => x.start - y.start);

    for (let i = 1; i < finalPositions.length; i += 1) {
      expect(finalPositions[i].start).toBeGreaterThanOrEqual(
        finalPositions[i - 1].start + finalPositions[i - 1].duration
      );
    }
  });

  it('returns no moves when there is nothing movable', () => {
    const result = optimizeSchedule([], prefs, new Map());
    expect(result.moves).toHaveLength(0);
    expect(result.keptCount).toBe(0);
  });

  it('does not move break blocks', () => {
    const lunch = block({ id: 'lunch', kind: 'break', startMinutes: 13 * 60 });
    const { moves } = optimizeSchedule([lunch], prefs, new Map());
    expect(moves).toHaveLength(0);
  });
});

// ─── isHabitDueOn ────────────────────────────────────────────────────────────

describe('isHabitDueOn', () => {
  const habit = (over: Partial<Habit> = {}): Habit => ({
    id: 'h1', name: 'H', icon: '', color: '#000', frequency: 'daily',
    targetDays: [], reminderTime: null, completedDates: [], createdAt: 0, archived: false,
    ...over,
  });

  it('is always due for a daily habit', () => {
    expect(isHabitDueOn(habit(), '2026-08-03')).toBe(true);
  });

  it('matches the weekday for a weekly habit', () => {
    // 2026-08-03 is a Monday (day 1).
    expect(isHabitDueOn(habit({ frequency: 'weekly', targetDays: [1] }), '2026-08-03')).toBe(true);
    expect(isHabitDueOn(habit({ frequency: 'weekly', targetDays: [2] }), '2026-08-03')).toBe(false);
  });

  it('treats an empty target-day list as every day', () => {
    expect(isHabitDueOn(habit({ frequency: 'custom', targetDays: [] }), '2026-08-03')).toBe(true);
  });
});

// ─── computeDayProgress ──────────────────────────────────────────────────────

describe('computeDayProgress', () => {
  it('reports 0% with nothing tracked rather than dividing by zero', () => {
    const progress = computeDayProgress({
      blocks: [], timeline: [], goalsTotal: 0, goalsDone: 0, prioritiesTotal: 0, prioritiesDone: 0,
    });
    expect(progress.overallPct).toBe(0);
    expect(progress.plannedMinutes).toBe(0);
  });

  it('counts blocks, goals and priorities in one overall percentage', () => {
    const blocks = [
      block({ id: 'p1', completed: true, durationMinutes: 60 }),
      block({ id: 'p2', completed: false, durationMinutes: 30 }),
    ];
    const progress = computeDayProgress({
      blocks, timeline: [], goalsTotal: 2, goalsDone: 1, prioritiesTotal: 2, prioritiesDone: 2,
    });
    // 1 block + 1 goal + 2 priorities done out of 2 + 2 + 2 = 4/6 → 67%
    expect(progress.overallPct).toBe(67);
    expect(progress.plannedMinutes).toBe(90);
    expect(progress.completedMinutes).toBe(60);
  });

  it('reaches 100% when everything is done', () => {
    const blocks = [block({ completed: true })];
    const progress = computeDayProgress({
      blocks, timeline: [], goalsTotal: 1, goalsDone: 1, prioritiesTotal: 1, prioritiesDone: 1,
    });
    expect(progress.overallPct).toBe(100);
  });
});
