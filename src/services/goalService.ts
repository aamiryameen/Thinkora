/**
 * Goal Tracking Service — set weekly/monthly goals tied to a metric
 * (tasks completed, focus sessions, habits done, notes created).
 *
 * Backed by the settings key/value table — single record under "goals_v1".
 */

import { storage } from './storage';
import { generateId } from '../utils/id';

export type GoalPeriod = 'weekly' | 'monthly';

export type GoalMetric =
  | 'tasks_completed'
  | 'focus_minutes'
  | 'habits_completed'
  | 'notes_created';

export interface Goal {
  id: string;
  title: string;
  metric: GoalMetric;
  target: number;
  period: GoalPeriod;
  emoji?: string;
  color?: string;
  createdAt: number;
  archived?: boolean;
}

const KEY = 'goals_v1';

export async function getGoals(): Promise<Goal[]> {
  return storage.getSetting<Goal[]>(KEY, []);
}

export async function saveGoals(goals: Goal[]): Promise<void> {
  await storage.setSetting(KEY, goals);
}

export async function addGoal(goal: Omit<Goal, 'id' | 'createdAt'>): Promise<Goal> {
  const all = await getGoals();
  const newGoal: Goal = { ...goal, id: generateId(), createdAt: Date.now() };
  await saveGoals([...all, newGoal]);
  return newGoal;
}

export async function updateGoal(id: string, patch: Partial<Goal>): Promise<void> {
  const all = await getGoals();
  await saveGoals(all.map(g => g.id === id ? { ...g, ...patch } : g));
}

export async function deleteGoal(id: string): Promise<void> {
  const all = await getGoals();
  await saveGoals(all.filter(g => g.id !== id));
}

/** Compute the inclusive [start, end) range for the current period. */
export function periodRange(period: GoalPeriod, firstDayOfWeek: 0 | 1 = 0): { start: number; end: number } {
  const now = new Date();
  if (period === 'weekly') {
    const day = now.getDay();
    const diff = (day - firstDayOfWeek + 7) % 7;
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return { start: start.getTime(), end: end.getTime() };
  }
  // monthly
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { start: start.getTime(), end: end.getTime() };
}

export const GOAL_METRICS: { id: GoalMetric; label: string; icon: string; color: string; unit: string }[] = [
  { id: 'tasks_completed', label: 'Tasks Completed', icon: 'checkbox', color: '#10B981', unit: 'tasks' },
  { id: 'focus_minutes', label: 'Focus Minutes', icon: 'timer', color: '#F59E0B', unit: 'minutes' },
  { id: 'habits_completed', label: 'Habits Done', icon: 'flame', color: '#EF4444', unit: 'check-ins' },
  { id: 'notes_created', label: 'Notes Created', icon: 'document-text', color: '#6366F1', unit: 'notes' },
];
