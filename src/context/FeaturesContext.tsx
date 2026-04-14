/**
 * FeaturesContext: manages Habits, Journal, Pomodoro, Shared Lists,
 * Task Templates, Badges — keeping AppContext focused on core data.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { storage } from '../services/storage';
import { syncWidgetData } from '../services/widgetService';
import { scheduleDailyDigest } from '../services/smartNotificationService';
import { DEFAULT_POMODORO } from '../core/constants';
import { categoryColors } from '../core/theme';
import { generateId } from '../utils/id';
import { useApp } from './AppContext';
import type {
  Habit, HabitFrequency, JournalEntry, MoodLevel,
  PomodoroSession, PomodoroSettings,
  SharedList, SharedListItem,
  TaskTemplate, Badge, BadgeCondition,
} from '../types';

// ─── Default badges ──────────────────────────────────

const DEFAULT_BADGES: Badge[] = [
  { id: 'b-first-task', name: 'First Step', description: 'Complete your first task', icon: 'rocket-outline', color: categoryColors.blue, unlockedAt: null, condition: { type: 'tasks_completed', count: 1 } },
  { id: 'b-10-tasks', name: 'Task Master', description: 'Complete 10 tasks', icon: 'trophy-outline', color: categoryColors.orange, unlockedAt: null, condition: { type: 'tasks_completed', count: 10 } },
  { id: 'b-50-tasks', name: 'Productivity Pro', description: 'Complete 50 tasks', icon: 'medal-outline', color: categoryColors.purple, unlockedAt: null, condition: { type: 'tasks_completed', count: 50 } },
  { id: 'b-100-tasks', name: 'Centurion', description: 'Complete 100 tasks', icon: 'star-outline', color: categoryColors.red, unlockedAt: null, condition: { type: 'tasks_completed', count: 100 } },
  { id: 'b-7-streak', name: 'Week Warrior', description: '7-day habit streak', icon: 'flame-outline', color: categoryColors.orange, unlockedAt: null, condition: { type: 'habit_streak', days: 7 } },
  { id: 'b-30-streak', name: 'Monthly Master', description: '30-day habit streak', icon: 'flame-outline', color: categoryColors.red, unlockedAt: null, condition: { type: 'habit_streak', days: 30 } },
  { id: 'b-5-pomodoro', name: 'Focus Finder', description: 'Complete 5 pomodoro sessions', icon: 'timer-outline', color: categoryColors.teal, unlockedAt: null, condition: { type: 'pomodoro_sessions', count: 5 } },
  { id: 'b-25-pomodoro', name: 'Deep Worker', description: 'Complete 25 pomodoro sessions', icon: 'timer-outline', color: categoryColors.indigo, unlockedAt: null, condition: { type: 'pomodoro_sessions', count: 25 } },
  { id: 'b-7-journal', name: 'Journaler', description: 'Write 7 journal entries', icon: 'book-outline', color: categoryColors.green, unlockedAt: null, condition: { type: 'journal_entries', count: 7 } },
  { id: 'b-10-notes', name: 'Note Taker', description: 'Create 10 notes', icon: 'document-text-outline', color: categoryColors.blue, unlockedAt: null, condition: { type: 'notes_created', count: 10 } },
];

// ─── Default templates ──────────────────────────────

const DEFAULT_TEMPLATES: TaskTemplate[] = [
  { id: 'tpl-morning', name: 'Morning Routine', icon: 'sunny-outline', tasks: [
    { title: 'Wake up & stretch', subtasks: [] },
    { title: 'Drink water', subtasks: [] },
    { title: 'Meditate 10 min', subtasks: [] },
    { title: 'Breakfast', subtasks: [] },
    { title: 'Review today\'s goals', subtasks: [] },
  ]},
  { id: 'tpl-weekly', name: 'Weekly Review', icon: 'refresh-outline', tasks: [
    { title: 'Review completed tasks', subtasks: [] },
    { title: 'Plan next week', subtasks: [] },
    { title: 'Clean up inbox', subtasks: [] },
    { title: 'Update goals', subtasks: [] },
  ]},
  { id: 'tpl-shopping', name: 'Shopping List', icon: 'cart-outline', tasks: [
    { title: 'Fruits & vegetables', subtasks: ['Apples', 'Bananas', 'Tomatoes'] },
    { title: 'Dairy', subtasks: ['Milk', 'Cheese', 'Yogurt'] },
    { title: 'Pantry', subtasks: ['Bread', 'Rice', 'Pasta'] },
  ]},
  { id: 'tpl-travel', name: 'Travel Checklist', icon: 'airplane-outline', tasks: [
    { title: 'Book flights', subtasks: [] },
    { title: 'Book accommodation', subtasks: [] },
    { title: 'Pack essentials', subtasks: ['Passport', 'Charger', 'Clothes', 'Toiletries'] },
    { title: 'Arrange transport', subtasks: [] },
  ]},
  { id: 'tpl-meeting', name: 'Meeting Prep', icon: 'people-outline', tasks: [
    { title: 'Set agenda', subtasks: [] },
    { title: 'Prepare slides', subtasks: [] },
    { title: 'Send invites', subtasks: [] },
    { title: 'Follow up notes', subtasks: [] },
  ]},
];

// ─── Context Types ──────────────────────────────────

interface FeaturesContextValue {
  // Habits
  habits: Habit[];
  addHabit: (h: Omit<Habit, 'id' | 'createdAt' | 'completedDates' | 'archived'>) => Habit;
  updateHabit: (id: string, patch: Partial<Habit>) => void;
  deleteHabit: (id: string) => void;
  toggleHabitDate: (id: string, date: string) => void;
  getHabitStreak: (habit: Habit) => number;

  // Journal
  journalEntries: JournalEntry[];
  addJournalEntry: (mood: MoodLevel, note: string, date?: string) => JournalEntry;
  updateJournalEntry: (id: string, patch: Partial<JournalEntry>) => void;
  deleteJournalEntry: (id: string) => void;
  getJournalForDate: (date: string) => JournalEntry | undefined;

  // Pomodoro
  pomodoroSessions: PomodoroSession[];
  addPomodoroSession: (session: Omit<PomodoroSession, 'id'>) => void;
  pomodoroSettings: PomodoroSettings;

  // Shared Lists
  sharedLists: SharedList[];
  addSharedList: (title: string) => SharedList;
  updateSharedList: (id: string, patch: Partial<SharedList>) => void;
  deleteSharedList: (id: string) => void;
  addSharedListItem: (listId: string, title: string) => void;
  toggleSharedListItem: (listId: string, itemId: string) => void;
  deleteSharedListItem: (listId: string, itemId: string) => void;

  // Task Templates
  taskTemplates: TaskTemplate[];
  addTaskTemplate: (t: Omit<TaskTemplate, 'id'>) => TaskTemplate;
  deleteTaskTemplate: (id: string) => void;

  // Badges
  badges: Badge[];
  checkBadges: (stats: { tasksCompleted: number; maxHabitStreak: number; pomodoroCount: number; journalCount: number; notesCount: number }) => Badge[];

  isHydrated: boolean;
}

const FeaturesContext = createContext<FeaturesContextValue | null>(null);

export function FeaturesProvider({ children }: { children: React.ReactNode }) {
  const { tasks } = useApp();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [pomodoroSessions, setPomodoroSessions] = useState<PomodoroSession[]>([]);
  const [sharedLists, setSharedLists] = useState<SharedList[]>([]);
  const [taskTemplates, setTaskTemplates] = useState<TaskTemplate[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loaded, setLoaded] = useState(false);

  const pomodoroSettings: PomodoroSettings = { ...DEFAULT_POMODORO };

  // ─── Hydration ──────────────────────────────────
  useEffect(() => {
    (async () => {
      const [h, j, p, sl, tt, b] = await Promise.all([
        storage.getHabits(),
        storage.getJournalEntries(),
        storage.getPomodoroSessions(),
        storage.getSharedLists(),
        storage.getTaskTemplates(),
        storage.getBadges(),
      ]);
      setHabits(h);
      setJournalEntries(j);
      setPomodoroSessions(p);
      setSharedLists(sl);
      setTaskTemplates(tt.length > 0 ? tt : DEFAULT_TEMPLATES);
      setBadges(b.length > 0 ? b : DEFAULT_BADGES);
      setLoaded(true);
    })();
  }, []);

  // ─── Auto-save ──────────────────────────────────
  useEffect(() => { if (loaded) storage.setHabits(habits); }, [loaded, habits]);
  useEffect(() => { if (loaded) syncWidgetData([], habits); }, [loaded, habits]);
  useEffect(() => { if (loaded) scheduleDailyDigest(tasks, habits); }, [loaded, tasks, habits]);
  useEffect(() => { if (loaded) storage.setJournalEntries(journalEntries); }, [loaded, journalEntries]);
  useEffect(() => { if (loaded) storage.setPomodoroSessions(pomodoroSessions); }, [loaded, pomodoroSessions]);
  useEffect(() => { if (loaded) storage.setSharedLists(sharedLists); }, [loaded, sharedLists]);
  useEffect(() => { if (loaded) storage.setTaskTemplates(taskTemplates); }, [loaded, taskTemplates]);
  useEffect(() => { if (loaded) storage.setBadges(badges); }, [loaded, badges]);

  // ─── Habits ─────────────────────────────────────
  const addHabit = useCallback((h: Omit<Habit, 'id' | 'createdAt' | 'completedDates' | 'archived'>): Habit => {
    const habit: Habit = { ...h, id: generateId(), createdAt: Date.now(), completedDates: [], archived: false };
    setHabits((prev) => [habit, ...prev]);
    return habit;
  }, []);

  const updateHabit = useCallback((id: string, patch: Partial<Habit>) => {
    setHabits((prev) => prev.map((h) => (h.id === id ? { ...h, ...patch } : h)));
  }, []);

  const deleteHabit = useCallback((id: string) => {
    setHabits((prev) => prev.filter((h) => h.id !== id));
  }, []);

  const toggleHabitDate = useCallback((id: string, date: string) => {
    setHabits((prev) => prev.map((h) => {
      if (h.id !== id) return h;
      const dates = h.completedDates ?? [];
      const has = dates.includes(date);
      return { ...h, completedDates: has ? dates.filter((d) => d !== date) : [...dates, date] };
    }));
  }, []);

  const getHabitStreak = useCallback((habit: Habit): number => {
    const dates = habit.completedDates ?? [];
    if (dates.length === 0) return 0;
    const today = new Date();
    let streak = 0;
    for (let i = 0; i < 365; i++) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (dates.includes(key)) streak++;
      else if (i > 0) break; // allow today to be incomplete
    }
    return streak;
  }, []);

  // ─── Journal ────────────────────────────────────
  const todayKey = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const addJournalEntry = useCallback((mood: MoodLevel, note: string, date?: string): JournalEntry => {
    const entry: JournalEntry = { id: generateId(), date: date ?? todayKey(), mood, note, createdAt: Date.now() };
    setJournalEntries((prev) => [entry, ...prev]);
    return entry;
  }, []);

  const updateJournalEntry = useCallback((id: string, patch: Partial<JournalEntry>) => {
    setJournalEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }, []);

  const deleteJournalEntry = useCallback((id: string) => {
    setJournalEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const getJournalForDate = useCallback((date: string) => {
    return journalEntries.find((e) => e.date === date);
  }, [journalEntries]);

  // ─── Pomodoro ───────────────────────────────────
  const addPomodoroSession = useCallback((session: Omit<PomodoroSession, 'id'>) => {
    setPomodoroSessions((prev) => [{ ...session, id: generateId() }, ...prev]);
  }, []);

  // ─── Shared Lists ──────────────────────────────
  const addSharedList = useCallback((title: string): SharedList => {
    const list: SharedList = {
      id: generateId(),
      title,
      items: [],
      shareCode: Math.random().toString(36).slice(2, 8).toUpperCase(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setSharedLists((prev) => [list, ...prev]);
    return list;
  }, []);

  const updateSharedList = useCallback((id: string, patch: Partial<SharedList>) => {
    setSharedLists((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch, updatedAt: Date.now() } : l)));
  }, []);

  const deleteSharedList = useCallback((id: string) => {
    setSharedLists((prev) => prev.filter((l) => l.id !== id));
  }, []);

  const addSharedListItem = useCallback((listId: string, title: string) => {
    setSharedLists((prev) => prev.map((l) => {
      if (l.id !== listId) return l;
      const item: SharedListItem = { id: generateId(), title, completed: false, addedBy: 'me' };
      return { ...l, items: [...l.items, item], updatedAt: Date.now() };
    }));
  }, []);

  const toggleSharedListItem = useCallback((listId: string, itemId: string) => {
    setSharedLists((prev) => prev.map((l) => {
      if (l.id !== listId) return l;
      return { ...l, items: l.items.map((i) => (i.id === itemId ? { ...i, completed: !i.completed } : i)), updatedAt: Date.now() };
    }));
  }, []);

  const deleteSharedListItem = useCallback((listId: string, itemId: string) => {
    setSharedLists((prev) => prev.map((l) => {
      if (l.id !== listId) return l;
      return { ...l, items: l.items.filter((i) => i.id !== itemId), updatedAt: Date.now() };
    }));
  }, []);

  // ─── Task Templates ─────────────────────────────
  const addTaskTemplate = useCallback((t: Omit<TaskTemplate, 'id'>): TaskTemplate => {
    const tpl: TaskTemplate = { ...t, id: generateId() };
    setTaskTemplates((prev) => [...prev, tpl]);
    return tpl;
  }, []);

  const deleteTaskTemplate = useCallback((id: string) => {
    setTaskTemplates((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ─── Badges ─────────────────────────────────────
  const checkBadges = useCallback((stats: {
    tasksCompleted: number; maxHabitStreak: number;
    pomodoroCount: number; journalCount: number; notesCount: number;
  }): Badge[] => {
    const newlyUnlocked: Badge[] = [];
    setBadges((prev) => prev.map((b) => {
      if (b.unlockedAt) return b;
      let unlocked = false;
      const c = b.condition;
      if (c.type === 'tasks_completed' && stats.tasksCompleted >= c.count) unlocked = true;
      if (c.type === 'habit_streak' && stats.maxHabitStreak >= c.days) unlocked = true;
      if (c.type === 'pomodoro_sessions' && stats.pomodoroCount >= c.count) unlocked = true;
      if (c.type === 'journal_entries' && stats.journalCount >= c.count) unlocked = true;
      if (c.type === 'notes_created' && stats.notesCount >= c.count) unlocked = true;
      if (unlocked) {
        const updated = { ...b, unlockedAt: Date.now() };
        newlyUnlocked.push(updated);
        return updated;
      }
      return b;
    }));
    return newlyUnlocked;
  }, []);

  const value = useMemo<FeaturesContextValue>(() => ({
    habits, addHabit, updateHabit, deleteHabit, toggleHabitDate, getHabitStreak,
    journalEntries, addJournalEntry, updateJournalEntry, deleteJournalEntry, getJournalForDate,
    pomodoroSessions, addPomodoroSession, pomodoroSettings,
    sharedLists, addSharedList, updateSharedList, deleteSharedList, addSharedListItem, toggleSharedListItem, deleteSharedListItem,
    taskTemplates, addTaskTemplate, deleteTaskTemplate,
    badges, checkBadges,
    isHydrated: loaded,
  }), [
    habits, addHabit, updateHabit, deleteHabit, toggleHabitDate, getHabitStreak,
    journalEntries, addJournalEntry, updateJournalEntry, deleteJournalEntry, getJournalForDate,
    pomodoroSessions, addPomodoroSession, pomodoroSettings,
    sharedLists, addSharedList, updateSharedList, deleteSharedList, addSharedListItem, toggleSharedListItem, deleteSharedListItem,
    taskTemplates, addTaskTemplate, deleteTaskTemplate,
    badges, checkBadges, loaded,
  ]);

  return <FeaturesContext.Provider value={value}>{children}</FeaturesContext.Provider>;
}

export function useFeatures() {
  const ctx = useContext(FeaturesContext);
  if (!ctx) throw new Error('useFeatures must be used within FeaturesProvider');
  return ctx;
}
