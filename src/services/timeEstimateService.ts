/**
 * Time Estimation AI — predict how long a task will take based on history.
 *
 * Approach: pure-JS heuristic similarity over your tracked task history.
 *  - Find past completed tasks with similar titles (token Jaccard).
 *  - Average their tracked durations, weighted by similarity.
 *  - Confidence scales with sample count.
 *
 * No network calls; works offline.
 */

import { storage } from './storage';
import { getAllTimeRecords } from './timeTrackingService';
import type { Task } from '../types';

export interface TimeEstimate {
  /** Predicted duration in minutes. */
  minutes: number;
  /** 0..1 confidence based on # of similar past tasks. */
  confidence: number;
  /** Number of past tasks used to derive the estimate. */
  sampleCount: number;
  /** Brief explanation for the UI. */
  rationale: string;
}

const STOP_WORDS = new Set(['the', 'a', 'an', 'to', 'and', 'or', 'of', 'for', 'in', 'on', 'with', 'is', 'are']);

function tokenize(s: string): Set<string> {
  return new Set(
    s.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length >= 3 && !STOP_WORDS.has(t)),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

/** Estimate duration for a task given its title (and optional category). */
export async function estimateTaskDuration(
  taskTitle: string,
  taskCategoryId: string | null,
  allTasks: Task[],
): Promise<TimeEstimate> {
  const titleTokens = tokenize(taskTitle);
  if (titleTokens.size === 0) {
    return { minutes: 25, confidence: 0, sampleCount: 0, rationale: 'No keywords to match — using default 25 minutes.' };
  }

  // Pull tracked-time records for past completed tasks
  const records = await getAllTimeRecords(allTasks.map(t => t.id));

  type Sample = { task: Task; minutes: number; similarity: number };
  const samples: Sample[] = [];
  for (const t of allTasks) {
    const rec = records[t.id];
    if (!rec || rec.totalSeconds < 60) continue; // need >= 1 min of tracking
    if (!t.completed) continue;

    const sim = jaccard(titleTokens, tokenize(t.title));
    // Boost if same category
    const boosted = sim + (taskCategoryId && t.categoryId === taskCategoryId ? 0.1 : 0);
    if (boosted < 0.15) continue;
    samples.push({ task: t, minutes: rec.totalSeconds / 60, similarity: boosted });
  }

  if (samples.length === 0) {
    // No history — return a neutral default
    return {
      minutes: 25, confidence: 0, sampleCount: 0,
      rationale: 'No similar past tasks. Default: 25 minutes.',
    };
  }

  // Weighted average — top 5 most similar
  samples.sort((a, b) => b.similarity - a.similarity);
  const top = samples.slice(0, 5);
  const totalWeight = top.reduce((s, x) => s + x.similarity, 0);
  const weightedMins = top.reduce((s, x) => s + x.minutes * x.similarity, 0) / totalWeight;

  const minutes = Math.round(weightedMins);
  const confidence = Math.min(1, top.length / 5);
  const top1 = top[0];

  return {
    minutes: Math.max(5, minutes), // floor at 5 min
    confidence,
    sampleCount: top.length,
    rationale: `Based on ${top.length} similar past task${top.length === 1 ? '' : 's'} (closest: "${top1.task.title}", ${Math.round(top1.minutes)} min).`,
  };
}

export function formatMinutes(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
