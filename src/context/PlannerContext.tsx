/**
 * PlannerContext — state for the Daily Planner module.
 *
 * Owns the currently-viewed date, that day's plan + blocks, and planner
 * preferences. Tasks and habits are read from AppContext / FeaturesContext
 * rather than duplicated here, so the planner always reflects the same data
 * the rest of the app shows.
 */

import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import { useApp } from './AppContext';
import { useFeatures } from './FeaturesContext';
import {
  addDaysToKey,
  createBlock,
  createBlocks,
  deleteBlock as deleteBlockRecord,
  deleteBlocksForDate,
  fromDateKey,
  getBlocksForDate,
  getBlocksForDates,
  getDay,
  getDays,
  getPlannerPreferences,
  isDayEmpty,
  makeDailyGoal,
  makeTopPriority,
  rescheduleAllBlockReminders,
  saveDay,
  savePlannerPreferences,
  todayKey,
  updateBlock as updateBlockRecord,
  weekKeys,
  type NewBlockInput,
} from '../services/plannerService';
import {
  autoSchedule,
  buildTimeline,
  computeDayProgress,
  DEFAULT_TASK_BLOCK_MINUTES,
  isHabitDueOn,
  nextFreeSlot,
  optimizeSchedule,
  BLOCK_KIND_COLORS,
  type AutoScheduleCandidate,
  type AutoScheduleResult,
  type DayProgress,
  type OptimizeResult,
} from '../services/plannerScheduleService';
import { getTemplate } from '../services/plannerTemplateService';
import type {
  DailyGoal, PlannerBlock, PlannerDay, PlannerPreferences, TimelineItem, TopPriority,
} from '../types/planner';
import { DEFAULT_PLANNER_PREFERENCES } from '../types/planner';

interface PlannerContextValue {
  // ── Current date ──
  /** "YYYY-MM-DD" currently being viewed. */
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  goToDate: (date: string) => void;
  shiftDay: (delta: number) => void;
  goToToday: () => void;
  isToday: boolean;

  // ── Day plan ──
  day: PlannerDay;
  setFocus: (focus: string) => Promise<void>;
  addPriority: (title: string, taskId?: string | null) => Promise<void>;
  togglePriority: (id: string) => Promise<void>;
  removePriority: (id: string) => Promise<void>;
  addDailyGoal: (title: string) => Promise<void>;
  toggleDailyGoal: (id: string) => Promise<void>;
  removeDailyGoal: (id: string) => Promise<void>;
  setNotes: (notes: string) => Promise<void>;
  markPlanned: () => Promise<void>;
  /** True when nothing has been planned for the selected day yet. */
  needsPlanning: boolean;

  // ── Blocks ──
  blocks: PlannerBlock[];
  timeline: TimelineItem[];
  addBlock: (input: Omit<NewBlockInput, 'date'> & { date?: string }) => Promise<PlannerBlock | null>;
  editBlock: (id: string, patch: Partial<PlannerBlock>) => Promise<void>;
  moveBlock: (id: string, startMinutes: number) => Promise<void>;
  resizeBlock: (id: string, durationMinutes: number) => Promise<void>;
  toggleBlockComplete: (id: string) => Promise<void>;
  toggleBlockLock: (id: string) => Promise<void>;
  removeBlock: (id: string) => Promise<void>;
  clearDay: () => Promise<void>;

  // ── Derived ──
  progress: DayProgress;
  /** Next free gap of at least `minutes`, in minutes-from-midnight. */
  suggestNextSlot: (minutes: number) => number | null;

  // ── Premium operations (gating is the caller's responsibility) ──
  applyTemplate: (templateId: string, opts?: { replace?: boolean }) => Promise<number>;
  runAutoSchedule: (opts?: { taskIds?: string[] }) => Promise<AutoScheduleResult>;
  runOptimize: (opts?: { apply?: boolean }) => Promise<OptimizeResult>;

  // ── Week (premium screen, data loader is free to call) ──
  loadWeek: (anchorDate: string) => Promise<{ keys: string[]; days: PlannerDay[]; blocks: PlannerBlock[] }>;

  // ── Preferences ──
  prefs: PlannerPreferences;
  updatePrefs: (patch: Partial<PlannerPreferences>) => Promise<void>;

  isLoading: boolean;
  /** Force a re-read of the selected day from the DB. */
  refresh: () => Promise<void>;
}

const PlannerContext = createContext<PlannerContextValue | null>(null);

const EMPTY_DAY: PlannerDay = {
  id: '', date: '', focus: '', topPriorities: [], dailyGoals: [],
  notes: '', plannedAt: null, reviewedAt: null, createdAt: 0, updatedAt: 0,
};

export function PlannerProvider({ children }: { children: React.ReactNode }) {
  const { tasks, toggleTaskComplete } = useApp();
  const { habits } = useFeatures();

  // Held in a ref so the toggle helpers don't need it in their dep lists.
  const toggleTaskRef = useRef(toggleTaskComplete);
  useEffect(() => { toggleTaskRef.current = toggleTaskComplete; }, [toggleTaskComplete]);

  const [selectedDate, setSelectedDateState] = useState<string>(todayKey());
  const [day, setDay] = useState<PlannerDay>({ ...EMPTY_DAY, date: todayKey() });
  const [blocks, setBlocks] = useState<PlannerBlock[]>([]);
  const [prefs, setPrefs] = useState<PlannerPreferences>(DEFAULT_PLANNER_PREFERENCES);
  const [isLoading, setIsLoading] = useState(true);

  // Guards against a slow fetch for a previous date overwriting a newer one.
  const loadTokenRef = useRef(0);

  // ── Initial load: preferences + reminder recovery ──
  useEffect(() => {
    let alive = true;
    getPlannerPreferences().then(p => { if (alive) setPrefs(p); });
    // Android drops pending alarms across reboots/updates.
    rescheduleAllBlockReminders().catch(() => { /* best effort */ });
    return () => { alive = false; };
  }, []);

  // ── Load the selected day ──
  const loadDate = useCallback(async (date: string) => {
    const token = ++loadTokenRef.current;
    setIsLoading(true);
    const [nextDay, nextBlocks] = await Promise.all([getDay(date), getBlocksForDate(date)]);
    if (token !== loadTokenRef.current) return;   // a newer load won
    setDay(nextDay);
    setBlocks(nextBlocks);
    setIsLoading(false);
  }, []);

  useEffect(() => { loadDate(selectedDate); }, [selectedDate, loadDate]);

  const refresh = useCallback(async () => { await loadDate(selectedDate); }, [loadDate, selectedDate]);

  // ── Date navigation ──
  const setSelectedDate = useCallback((date: string) => { setSelectedDateState(date); }, []);
  const shiftDay = useCallback((delta: number) => {
    setSelectedDateState(prev => addDaysToKey(prev, delta));
  }, []);
  const goToToday = useCallback(() => { setSelectedDateState(todayKey()); }, []);

  // ── Day-plan mutations ─────────────────────────────────────────────────────

  const persistDay = useCallback(async (patch: Partial<PlannerDay>) => {
    // Optimistic update so typing/checking never lags behind the UI.
    setDay(prev => ({ ...prev, ...patch }));
    const saved = await saveDay(selectedDate, patch);
    setDay(saved);
  }, [selectedDate]);

  const setFocus = useCallback(async (focus: string) => {
    await persistDay({ focus });
  }, [persistDay]);

  const setNotes = useCallback(async (notes: string) => {
    await persistDay({ notes });
  }, [persistDay]);

  const addPriority = useCallback(async (title: string, taskId: string | null = null) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    // Top 3 — replacing the oldest would silently lose the user's input, so
    // we simply refuse beyond three and let the UI explain.
    if (day.topPriorities.length >= 3) return;
    await persistDay({ topPriorities: [...day.topPriorities, makeTopPriority(trimmed, taskId)] });
  }, [day.topPriorities, persistDay]);

  const togglePriority = useCallback(async (id: string) => {
    const target = day.topPriorities.find(p => p.id === id);
    const next: TopPriority[] = day.topPriorities.map(p =>
      p.id === id ? { ...p, completed: !p.completed } : p
    );
    await persistDay({ topPriorities: next });
    // Keep a linked task in sync so the two views never disagree.
    if (target?.taskId) {
      const task = tasks.find(t => t.id === target.taskId);
      if (task && task.completed === target.completed) toggleTaskRef.current?.(target.taskId);
    }
  }, [day.topPriorities, persistDay, tasks]);

  const removePriority = useCallback(async (id: string) => {
    await persistDay({ topPriorities: day.topPriorities.filter(p => p.id !== id) });
  }, [day.topPriorities, persistDay]);

  const addDailyGoal = useCallback(async (title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    await persistDay({ dailyGoals: [...day.dailyGoals, makeDailyGoal(trimmed)] });
  }, [day.dailyGoals, persistDay]);

  const toggleDailyGoal = useCallback(async (id: string) => {
    const next: DailyGoal[] = day.dailyGoals.map(g =>
      g.id === id ? { ...g, completed: !g.completed } : g
    );
    await persistDay({ dailyGoals: next });
  }, [day.dailyGoals, persistDay]);

  const removeDailyGoal = useCallback(async (id: string) => {
    await persistDay({ dailyGoals: day.dailyGoals.filter(g => g.id !== id) });
  }, [day.dailyGoals, persistDay]);

  const markPlanned = useCallback(async () => {
    await persistDay({ plannedAt: Date.now() });
  }, [persistDay]);

  // ── Block mutations ────────────────────────────────────────────────────────

  const addBlock = useCallback(async (input: Omit<NewBlockInput, 'date'> & { date?: string }) => {
    const date = input.date ?? selectedDate;
    const created = await createBlock({
      ...input,
      date,
      notes: input.notes ?? '',
      reminderMinutesBefore:
        input.reminderMinutesBefore !== undefined
          ? input.reminderMinutesBefore
          : prefs.defaultReminderMinutes,
    });
    if (date === selectedDate) {
      setBlocks(prev => [...prev, created].sort((a, b) => a.startMinutes - b.startMinutes));
    }
    return created;
  }, [prefs.defaultReminderMinutes, selectedDate]);

  const editBlock = useCallback(async (id: string, patch: Partial<PlannerBlock>) => {
    const updated = await updateBlockRecord(id, patch);
    if (!updated) return;
    setBlocks(prev => {
      // A block moved to another date leaves the current day's list.
      if (updated.date !== selectedDate) return prev.filter(b => b.id !== id);
      return prev
        .map(b => (b.id === id ? updated : b))
        .sort((a, b) => a.startMinutes - b.startMinutes);
    });
  }, [selectedDate]);

  const moveBlock = useCallback(async (id: string, startMinutes: number) => {
    const clamped = Math.max(0, Math.min(1440 - 5, Math.round(startMinutes)));
    await editBlock(id, { startMinutes: clamped });
  }, [editBlock]);

  const resizeBlock = useCallback(async (id: string, durationMinutes: number) => {
    const block = blocks.find(b => b.id === id);
    const maxDuration = block ? 1440 - block.startMinutes : 1440;
    const clamped = Math.max(5, Math.min(maxDuration, Math.round(durationMinutes)));
    await editBlock(id, { durationMinutes: clamped });
  }, [blocks, editBlock]);

  const toggleBlockComplete = useCallback(async (id: string) => {
    const block = blocks.find(b => b.id === id);
    if (!block) return;
    await editBlock(id, { completed: !block.completed });
    // Completing a task-linked block completes the task too.
    if (block.taskId && !block.completed) {
      const task = tasks.find(t => t.id === block.taskId);
      if (task && !task.completed) toggleTaskRef.current?.(block.taskId);
    }
  }, [blocks, editBlock, tasks]);

  const toggleBlockLock = useCallback(async (id: string) => {
    const block = blocks.find(b => b.id === id);
    if (!block) return;
    await editBlock(id, { locked: !block.locked });
  }, [blocks, editBlock]);

  const removeBlock = useCallback(async (id: string) => {
    await deleteBlockRecord(id);
    setBlocks(prev => prev.filter(b => b.id !== id));
  }, []);

  const clearDay = useCallback(async () => {
    await deleteBlocksForDate(selectedDate);
    setBlocks([]);
  }, [selectedDate]);

  // ── Derived: timeline & progress ───────────────────────────────────────────

  const dayStartMs = useMemo(() => fromDateKey(selectedDate).getTime(), [selectedDate]);

  const timeline = useMemo(
    () => buildTimeline({ date: selectedDate, blocks, tasks, habits, prefs, dayStart: dayStartMs }),
    [blocks, dayStartMs, habits, prefs, selectedDate, tasks]
  );

  const progress = useMemo(
    () => computeDayProgress({
      blocks,
      timeline,
      goalsTotal: day.dailyGoals.length,
      goalsDone: day.dailyGoals.filter(g => g.completed).length,
      prioritiesTotal: day.topPriorities.length,
      prioritiesDone: day.topPriorities.filter(p => p.completed).length,
    }),
    [blocks, day.dailyGoals, day.topPriorities, timeline]
  );

  const isToday = selectedDate === todayKey();

  const needsPlanning = useMemo(
    () => day.plannedAt == null && isDayEmpty(day) && blocks.length === 0,
    [blocks.length, day]
  );

  const suggestNextSlot = useCallback((minutes: number) => {
    const now = new Date();
    const from = isToday ? now.getHours() * 60 + now.getMinutes() : prefs.dayStartHour * 60;
    const slot = nextFreeSlot(blocks, from, prefs, minutes);
    return slot?.startMinutes ?? null;
  }, [blocks, isToday, prefs]);

  // ── Templates ──────────────────────────────────────────────────────────────

  const applyTemplate = useCallback(async (templateId: string, opts?: { replace?: boolean }) => {
    const template = await getTemplate(templateId);
    if (!template) return 0;

    if (opts?.replace) {
      await deleteBlocksForDate(selectedDate);
      setBlocks([]);
    }

    const inputs: NewBlockInput[] = template.blocks.map(b => ({
      date: selectedDate,
      title: b.title,
      kind: b.kind,
      startMinutes: b.startMinutes,
      durationMinutes: b.durationMinutes,
      color: b.color,
      notes: '',
      taskId: null,
      habitId: null,
      reminderMinutesBefore: prefs.defaultReminderMinutes,
    }));
    const created = await createBlocks(inputs);

    // Seed suggested goals, but never clobber goals the user already wrote.
    if (template.suggestedGoals.length > 0 && day.dailyGoals.length === 0) {
      await persistDay({ dailyGoals: template.suggestedGoals.map(makeDailyGoal) });
    }

    setBlocks(prev => [...prev, ...created].sort((a, b) => a.startMinutes - b.startMinutes));
    return created.length;
  }, [day.dailyGoals.length, persistDay, prefs.defaultReminderMinutes, selectedDate]);

  // ── Auto time blocking ─────────────────────────────────────────────────────

  const runAutoSchedule = useCallback(async (opts?: { taskIds?: string[] }) => {
    const alreadyBlocked = new Set(blocks.map(b => b.taskId).filter(Boolean) as string[]);
    const dayEndMs = dayStartMs + 86_400_000;

    const pool = tasks.filter(t => {
      if (t.completed) return false;
      if (alreadyBlocked.has(t.id)) return false;
      if (opts?.taskIds) return opts.taskIds.includes(t.id);
      // Default pool: overdue or due on the selected day.
      if (t.dueDate == null) return false;
      return t.dueDate < dayEndMs;
    });

    const candidates: AutoScheduleCandidate[] = pool.map(t => ({
      taskId: t.id,
      title: t.title,
      // Subtasks are a decent proxy for size when no estimate exists.
      durationMinutes: t.subtasks.length > 1
        ? Math.min(180, DEFAULT_TASK_BLOCK_MINUTES + (t.subtasks.length - 1) * 15)
        : DEFAULT_TASK_BLOCK_MINUTES,
      priority: t.priority,
      dueDate: t.dueDate,
    }));

    const now = new Date();
    const earliest = selectedDate === todayKey() ? now.getHours() * 60 + now.getMinutes() : 0;
    const result = autoSchedule(candidates, blocks, prefs, earliest);

    if (result.placements.length > 0) {
      const created = await createBlocks(result.placements.map(p => ({
        date: selectedDate,
        title: p.title,
        kind: 'task' as const,
        startMinutes: p.startMinutes,
        durationMinutes: p.durationMinutes,
        color: BLOCK_KIND_COLORS.task,
        notes: '',
        taskId: p.taskId,
        habitId: null,
        reminderMinutesBefore: prefs.defaultReminderMinutes,
        autoScheduled: true,
      })));
      setBlocks(prev => [...prev, ...created].sort((a, b) => a.startMinutes - b.startMinutes));
    }
    return result;
  }, [blocks, dayStartMs, prefs, selectedDate, tasks]);

  // ── Smart optimization ─────────────────────────────────────────────────────

  const runOptimize = useCallback(async (opts?: { apply?: boolean }) => {
    const taskById = new Map(tasks.map(t => [t.id, t]));
    const now = new Date();
    const earliest = selectedDate === todayKey() ? now.getHours() * 60 + now.getMinutes() : 0;
    const result = optimizeSchedule(blocks, prefs, taskById, earliest);

    if (opts?.apply && result.moves.length > 0) {
      for (const move of result.moves) {
        await updateBlockRecord(move.blockId, { startMinutes: move.toMinutes });
      }
      setBlocks(await getBlocksForDate(selectedDate));
    }
    return result;
  }, [blocks, prefs, selectedDate, tasks]);

  // ── Week loading ───────────────────────────────────────────────────────────

  const loadWeek = useCallback(async (anchorDate: string) => {
    const keys = weekKeys(anchorDate, 0);
    const [days, weekBlocks] = await Promise.all([getDays(keys), getBlocksForDates(keys)]);
    return { keys, days, blocks: weekBlocks };
  }, []);

  // ── Preferences ────────────────────────────────────────────────────────────

  const updatePrefs = useCallback(async (patch: Partial<PlannerPreferences>) => {
    setPrefs(prev => ({ ...prev, ...patch }));   // optimistic
    const next = await savePlannerPreferences(patch);
    setPrefs(next);
  }, []);

  const value: PlannerContextValue = useMemo(() => ({
    selectedDate,
    setSelectedDate,
    goToDate: setSelectedDate,
    shiftDay,
    goToToday,
    isToday,
    day,
    setFocus,
    addPriority,
    togglePriority,
    removePriority,
    addDailyGoal,
    toggleDailyGoal,
    removeDailyGoal,
    setNotes,
    markPlanned,
    needsPlanning,
    blocks,
    timeline,
    addBlock,
    editBlock,
    moveBlock,
    resizeBlock,
    toggleBlockComplete,
    toggleBlockLock,
    removeBlock,
    clearDay,
    progress,
    suggestNextSlot,
    applyTemplate,
    runAutoSchedule,
    runOptimize,
    loadWeek,
    prefs,
    updatePrefs,
    isLoading,
    refresh,
  }), [
    addBlock, addDailyGoal, addPriority, applyTemplate, blocks, clearDay, day, editBlock,
    goToToday, isLoading, isToday, loadWeek, markPlanned, moveBlock, needsPlanning, prefs,
    progress, refresh, removeBlock, removeDailyGoal, removePriority, resizeBlock,
    runAutoSchedule, runOptimize, selectedDate, setFocus, setNotes, setSelectedDate, shiftDay,
    suggestNextSlot, timeline, toggleBlockComplete, toggleBlockLock, toggleDailyGoal,
    togglePriority, updatePrefs,
  ]);

  return <PlannerContext.Provider value={value}>{children}</PlannerContext.Provider>;
}

export function usePlanner(): PlannerContextValue {
  const ctx = useContext(PlannerContext);
  if (!ctx) throw new Error('usePlanner must be used inside a PlannerProvider');
  return ctx;
}

export { isHabitDueOn };
