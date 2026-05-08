/**
 * Note Meta Service — per-note customization that doesn't fit the Note
 * schema (background, typography, lock PIN). Stored as a single map in
 * the settings k/v table to avoid a DB migration.
 */

import { storage } from './storage';

export interface NoteMeta {
  /** URI of a custom background image OR a hex color OR null. */
  background?: string | null;
  /** 0..1 opacity for the background image (so text remains readable). */
  backgroundOpacity?: number;
  /** Font family identifier — see FONT_FAMILIES below. */
  fontFamily?: string | null;
  /** Body font size in pt. */
  fontSize?: number | null;
  /** Hashed PIN to unlock this note (sha-like simple hash for v1). */
  lockHash?: string | null;
}

const KEY = 'note_meta_v1';

type AllMeta = Record<string, NoteMeta>;

async function loadAll(): Promise<AllMeta> {
  return storage.getSetting<AllMeta>(KEY, {});
}

async function saveAll(map: AllMeta): Promise<void> {
  await storage.setSetting(KEY, map);
}

export async function getNoteMeta(noteId: string): Promise<NoteMeta> {
  const all = await loadAll();
  return all[noteId] ?? {};
}

export async function setNoteMeta(noteId: string, patch: Partial<NoteMeta>): Promise<NoteMeta> {
  const all = await loadAll();
  const next = { ...(all[noteId] ?? {}), ...patch };
  // Strip nullish fields so meta map stays clean
  Object.keys(next).forEach(k => {
    if (next[k as keyof NoteMeta] === undefined) delete (next as any)[k];
  });
  all[noteId] = next;
  await saveAll(all);
  return next;
}

export async function clearNoteMeta(noteId: string): Promise<void> {
  const all = await loadAll();
  delete all[noteId];
  await saveAll(all);
}

// ─── Lock helpers ──────────────────────────────────────────────────────────

/** Lightweight non-crypto hash. Fine for "this PIN matches" gate; NOT
 *  suitable as a security primitive (data is unencrypted). */
function simpleHash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) + s.charCodeAt(i);
  return String(h >>> 0);
}

export async function lockNote(noteId: string, pin: string): Promise<void> {
  if (!/^\d{4,8}$/.test(pin)) throw new Error('PIN must be 4-8 digits');
  await setNoteMeta(noteId, { lockHash: simpleHash(pin) });
}

export async function unlockNote(noteId: string, pin: string): Promise<boolean> {
  const meta = await getNoteMeta(noteId);
  if (!meta.lockHash) return true;
  return simpleHash(pin) === meta.lockHash;
}

export async function removeLock(noteId: string, pin: string): Promise<boolean> {
  const ok = await unlockNote(noteId, pin);
  if (!ok) return false;
  await setNoteMeta(noteId, { lockHash: null });
  return true;
}

export async function isNoteLocked(noteId: string): Promise<boolean> {
  const meta = await getNoteMeta(noteId);
  return !!meta.lockHash;
}

// ─── Typography catalog ────────────────────────────────────────────────────

export interface FontOption {
  id: string;
  label: string;
  /** Real font family — must exist on the device or fall back to system. */
  family: string;
}

export const FONT_FAMILIES: FontOption[] = [
  { id: 'system',     label: 'System (default)', family: 'System' },
  { id: 'sans',       label: 'Sans-Serif',       family: 'sans-serif' },
  { id: 'serif',      label: 'Serif',            family: 'serif' },
  { id: 'mono',       label: 'Monospace',        family: 'monospace' },
  { id: 'sans-light', label: 'Light',            family: 'sans-serif-light' },
  { id: 'sans-thin',  label: 'Thin',             family: 'sans-serif-thin' },
  { id: 'condensed',  label: 'Condensed',        family: 'sans-serif-condensed' },
  { id: 'casual',     label: 'Casual',           family: 'casual' },
];

export const FONT_SIZES = [13, 14, 15, 16, 18, 20, 22, 24, 28];
