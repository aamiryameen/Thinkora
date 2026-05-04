/**
 * Habit Stack Service — chain habits together so users can complete them
 * sequentially. "After morning coffee → Meditate → Journal → Plan day"
 *
 * Storage: settings key/value table under "habit_stacks_v1".
 */

import { storage } from './storage';
import { generateId } from '../utils/id';

export interface HabitStack {
  id: string;
  name: string;        // e.g., "Morning Routine"
  emoji: string;
  habitIds: string[];  // ordered list, references Habit.id
  createdAt: number;
}

const KEY = 'habit_stacks_v1';

export async function getHabitStacks(): Promise<HabitStack[]> {
  return storage.getSetting<HabitStack[]>(KEY, []);
}

async function saveStacks(stacks: HabitStack[]): Promise<void> {
  await storage.setSetting(KEY, stacks);
}

export async function addHabitStack(stack: Omit<HabitStack, 'id' | 'createdAt'>): Promise<HabitStack> {
  const all = await getHabitStacks();
  const newStack: HabitStack = { ...stack, id: generateId(), createdAt: Date.now() };
  await saveStacks([...all, newStack]);
  return newStack;
}

export async function updateHabitStack(id: string, patch: Partial<HabitStack>): Promise<void> {
  const all = await getHabitStacks();
  await saveStacks(all.map(s => s.id === id ? { ...s, ...patch } : s));
}

export async function deleteHabitStack(id: string): Promise<void> {
  const all = await getHabitStacks();
  await saveStacks(all.filter(s => s.id !== id));
}
