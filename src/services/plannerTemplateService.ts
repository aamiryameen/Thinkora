/**
 * Planner Templates — reusable day layouts.
 *
 * Built-in templates ship with the app (read-only). Custom templates are
 * stored in the settings key/value table under "planner_templates_v1".
 *
 * Free tier: one built-in template ("Balanced Day") can be applied.
 * Premium: every built-in template + unlimited custom templates.
 */

import { storage } from './storage';
import { generateId } from '../utils/id';
import type { PlannerTemplate, PlannerTemplateBlock } from '../types/planner';

const KEY = 'planner_templates_v1';

function b(
  title: string,
  kind: PlannerTemplateBlock['kind'],
  startHour: number,
  startMin: number,
  durationMinutes: number,
  color: string
): PlannerTemplateBlock {
  return { title, kind, startMinutes: startHour * 60 + startMin, durationMinutes, color };
}

/** The single template available without premium. */
export const FREE_TEMPLATE_ID = 'builtin-balanced';

export const BUILT_IN_TEMPLATES: PlannerTemplate[] = [
  {
    id: FREE_TEMPLATE_ID,
    name: 'Balanced Day',
    icon: 'sunny-outline',
    description: 'A simple morning-focus, afternoon-admin rhythm with real breaks.',
    builtIn: true,
    createdAt: 0,
    suggestedGoals: ['Finish my top priority', 'Take a proper lunch break'],
    blocks: [
      b('Morning routine', 'habit', 7, 0, 45, '#EF4444'),
      b('Deep work', 'focus', 9, 0, 120, '#8B5CF6'),
      b('Break', 'break', 11, 0, 15, '#10B981'),
      b('Focused work', 'focus', 11, 15, 105, '#8B5CF6'),
      b('Lunch', 'break', 13, 0, 60, '#10B981'),
      b('Admin & email', 'custom', 14, 0, 60, '#F59E0B'),
      b('Afternoon work', 'focus', 15, 0, 120, '#8B5CF6'),
      b('Wind down & review', 'custom', 18, 0, 30, '#3B82F6'),
    ],
  },
  {
    id: 'builtin-student',
    name: 'Student',
    icon: 'school-outline',
    description: 'Lectures, spaced study sessions and revision blocks.',
    builtIn: true,
    createdAt: 0,
    suggestedGoals: ['Review today\'s lecture notes', 'Complete one assignment section'],
    blocks: [
      b('Morning review', 'focus', 7, 30, 30, '#8B5CF6'),
      b('Lectures', 'event', 9, 0, 180, '#3B82F6'),
      b('Lunch', 'break', 12, 0, 60, '#10B981'),
      b('Study session 1', 'focus', 13, 0, 90, '#8B5CF6'),
      b('Break', 'break', 14, 30, 20, '#10B981'),
      b('Study session 2', 'focus', 14, 50, 90, '#8B5CF6'),
      b('Assignments', 'task', 16, 30, 90, '#6366F1'),
      b('Revision & flashcards', 'focus', 19, 0, 45, '#8B5CF6'),
    ],
  },
  {
    id: 'builtin-work',
    name: 'Work / 9–5',
    icon: 'briefcase-outline',
    description: 'Meeting-friendly workday with protected deep-work mornings.',
    builtIn: true,
    createdAt: 0,
    suggestedGoals: ['Ship one meaningful thing', 'Clear the inbox to zero'],
    blocks: [
      b('Plan the day', 'custom', 9, 0, 15, '#F59E0B'),
      b('Deep work', 'focus', 9, 15, 105, '#8B5CF6'),
      b('Standup', 'event', 11, 0, 15, '#3B82F6'),
      b('Meetings', 'event', 11, 30, 90, '#3B82F6'),
      b('Lunch', 'break', 13, 0, 45, '#10B981'),
      b('Focus block', 'focus', 14, 0, 120, '#8B5CF6'),
      b('Email & admin', 'custom', 16, 0, 45, '#F59E0B'),
      b('Wrap up & plan tomorrow', 'custom', 17, 0, 30, '#3B82F6'),
    ],
  },
  {
    id: 'builtin-fitness',
    name: 'Fitness',
    icon: 'barbell-outline',
    description: 'Training, meals and recovery structured around the day.',
    builtIn: true,
    createdAt: 0,
    suggestedGoals: ['Hit my training session', 'Drink 3L of water'],
    blocks: [
      b('Wake & hydrate', 'habit', 6, 30, 15, '#EF4444'),
      b('Training', 'habit', 7, 0, 75, '#EF4444'),
      b('Breakfast', 'break', 8, 30, 30, '#10B981'),
      b('Work block', 'focus', 9, 30, 150, '#8B5CF6'),
      b('Lunch & meal prep', 'break', 12, 30, 60, '#10B981'),
      b('Work block', 'focus', 14, 0, 150, '#8B5CF6'),
      b('Mobility & stretch', 'habit', 17, 30, 30, '#EF4444'),
      b('Dinner', 'break', 19, 0, 45, '#10B981'),
      b('Sleep routine', 'habit', 21, 30, 30, '#EF4444'),
    ],
  },
  {
    id: 'builtin-deep-work',
    name: 'Deep Work',
    icon: 'moon-outline',
    description: 'Two long uninterrupted blocks with a hard stop on admin.',
    builtIn: true,
    createdAt: 0,
    suggestedGoals: ['Four hours of undistracted work', 'No meetings before noon'],
    blocks: [
      b('Ritual & warm-up', 'custom', 8, 0, 30, '#F59E0B'),
      b('Deep work I', 'focus', 8, 30, 180, '#8B5CF6'),
      b('Long break', 'break', 11, 30, 60, '#10B981'),
      b('Deep work II', 'focus', 12, 30, 180, '#8B5CF6'),
      b('Shutdown ritual', 'custom', 15, 30, 30, '#3B82F6'),
      b('Shallow work / admin', 'custom', 16, 0, 60, '#F59E0B'),
    ],
  },
  {
    id: 'builtin-weekend',
    name: 'Weekend Reset',
    icon: 'home-outline',
    description: 'Chores, errands and genuine rest without the day disappearing.',
    builtIn: true,
    createdAt: 0,
    suggestedGoals: ['Reset the home', 'Do one thing purely for fun'],
    blocks: [
      b('Slow morning', 'break', 8, 30, 60, '#10B981'),
      b('Chores & tidy', 'task', 10, 0, 90, '#6366F1'),
      b('Errands', 'task', 11, 30, 90, '#6366F1'),
      b('Lunch', 'break', 13, 0, 60, '#10B981'),
      b('Personal project', 'focus', 14, 30, 120, '#8B5CF6'),
      b('Outdoors / movement', 'habit', 17, 0, 60, '#EF4444'),
      b('Plan the week', 'custom', 19, 30, 45, '#F59E0B'),
    ],
  },
];

// ─── Custom templates ────────────────────────────────────────────────────────

export async function getCustomTemplates(): Promise<PlannerTemplate[]> {
  const raw = await storage.getSetting<PlannerTemplate[]>(KEY, []);
  return Array.isArray(raw) ? raw : [];
}

async function saveCustomTemplates(templates: PlannerTemplate[]): Promise<void> {
  await storage.setSetting(KEY, templates);
}

/** Built-ins first, then the user's own templates. */
export async function getAllTemplates(): Promise<PlannerTemplate[]> {
  return [...BUILT_IN_TEMPLATES, ...(await getCustomTemplates())];
}

export async function getTemplate(id: string): Promise<PlannerTemplate | null> {
  const builtIn = BUILT_IN_TEMPLATES.find(t => t.id === id);
  if (builtIn) return builtIn;
  return (await getCustomTemplates()).find(t => t.id === id) ?? null;
}

export async function addCustomTemplate(
  input: Omit<PlannerTemplate, 'id' | 'createdAt' | 'builtIn'>
): Promise<PlannerTemplate> {
  const template: PlannerTemplate = {
    ...input,
    id: generateId(),
    builtIn: false,
    createdAt: Date.now(),
  };
  await saveCustomTemplates([...(await getCustomTemplates()), template]);
  return template;
}

export async function updateCustomTemplate(id: string, patch: Partial<PlannerTemplate>): Promise<void> {
  const all = await getCustomTemplates();
  await saveCustomTemplates(
    all.map(t => (t.id === id ? { ...t, ...patch, id: t.id, builtIn: false } : t))
  );
}

export async function deleteCustomTemplate(id: string): Promise<void> {
  const all = await getCustomTemplates();
  await saveCustomTemplates(all.filter(t => t.id !== id));
}

/** Snapshot a day's blocks as a reusable template. */
export function templateFromBlocks(
  name: string,
  icon: string,
  description: string,
  blocks: { title: string; kind: PlannerTemplateBlock['kind']; startMinutes: number; durationMinutes: number; color: string }[]
): Omit<PlannerTemplate, 'id' | 'createdAt' | 'builtIn'> {
  return {
    name,
    icon,
    description,
    suggestedGoals: [],
    blocks: blocks
      .map(({ title, kind, startMinutes, durationMinutes, color }) => ({
        title, kind, startMinutes, durationMinutes, color,
      }))
      .sort((a, z) => a.startMinutes - z.startMinutes),
  };
}
