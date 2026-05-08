/**
 * AI Idea Resurfacer — surfaces forgotten note ideas at smart moments.
 *
 * A "candidate" note is one that:
 *   - was created 14+ days ago
 *   - hasn't been opened/edited in 7+ days
 *   - has at least 80 chars of plain text
 *   - hasn't been resurfaced in the last 14 days
 *   - isn't a task-style note (heuristic: doesn't start with "todo:" or "- [")
 *
 * Pure heuristic ranking + optional Gemini-powered "Here's how to make
 * progress" suggestions when the user opens the resurface card.
 */

import { storage } from './storage';
import type { Note } from '../types';

const RESURFACED_KEY = 'idea_resurfaced_v1';
const RESURFACE_COOLDOWN_DAYS = 14;
const MIN_AGE_DAYS = 14;
const STALE_DAYS = 7;
const MIN_LENGTH = 80;

interface ResurfaceLog {
  /** noteId -> timestamp last resurfaced */
  [noteId: string]: number;
}

async function getLog(): Promise<ResurfaceLog> {
  return storage.getSetting<ResurfaceLog>(RESURFACED_KEY, {});
}

async function saveLog(log: ResurfaceLog): Promise<void> {
  await storage.setSetting(RESURFACED_KEY, log);
}

export interface ResurfaceCandidate {
  note: Note;
  score: number;          // higher = better candidate
  daysSinceCreated: number;
  daysSinceUpdated: number;
}

function daysAgo(ts: number): number {
  return Math.floor((Date.now() - ts) / 86400000);
}

function looksLikeTask(text: string): boolean {
  const t = text.trim().toLowerCase();
  return /^(todo:|\- \[|☐ |✓ |\* \[)/.test(t);
}

/** Pick up to N notes worth surfacing. Caller decides when/how to show. */
export async function pickResurfaceCandidates(
  notes: Note[],
  limit: number = 3,
): Promise<ResurfaceCandidate[]> {
  const log = await getLog();
  const now = Date.now();

  const candidates: ResurfaceCandidate[] = [];
  for (const n of notes) {
    const ageDays = daysAgo(n.createdAt);
    if (ageDays < MIN_AGE_DAYS) continue;

    const staleDays = daysAgo(n.updatedAt);
    if (staleDays < STALE_DAYS) continue;

    const lastResurfaced = log[n.id];
    if (lastResurfaced && daysAgo(lastResurfaced) < RESURFACE_COOLDOWN_DAYS) continue;

    const text = (n.plainText || '').trim();
    if (text.length < MIN_LENGTH) continue;
    if (looksLikeTask(text)) continue;

    // Score: favor older + longer + favorited
    const score = ageDays * 1.0 + Math.min(text.length / 200, 5) + (n.isFavorite ? 5 : 0) + (n.isPinned ? 3 : 0);
    candidates.push({ note: n, score, daysSinceCreated: ageDays, daysSinceUpdated: staleDays });
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, limit);
}

/** Mark a note as resurfaced — applies cooldown so it won't reappear for 14 days. */
export async function markResurfaced(noteId: string): Promise<void> {
  const log = await getLog();
  log[noteId] = Date.now();
  await saveLog(log);
}

/** Dismiss permanently — set a far-future timestamp so it never resurfaces. */
export async function dismissForever(noteId: string): Promise<void> {
  const log = await getLog();
  log[noteId] = Date.now() + 365 * 86400000 * 10; // 10 years
  await saveLog(log);
}
