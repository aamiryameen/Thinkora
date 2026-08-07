import { notesCollection, tasksCollection, database } from '../db';
import { deleteBackgroundFile } from './wallpaperService';
import { daysUntilPurge, TRASH_RETENTION_DAYS } from '../core/trash';
import type { Note, Task } from '../types';

export { daysUntilPurge, TRASH_RETENTION_DAYS };

export type ItemKind = 'note' | 'task';

export interface ArchiveEntry {
  kind: ItemKind;
  id: string;
  title: string;
  preview: string;
  color: string | null;
  backgroundUri: string | null;
  updatedAt: number;
  trashedAt: number | null;
}

function noteEntry(n: Note): ArchiveEntry {
  return {
    kind: 'note',
    id: n.id,
    title: n.title || 'Untitled',
    preview: (n.plainText || '').slice(0, 90),
    color: n.color ?? null,
    backgroundUri: n.backgroundUri ?? null,
    updatedAt: n.updatedAt,
    trashedAt: n.trashedAt ?? null,
  };
}

function taskEntry(t: Task): ArchiveEntry {
  return {
    kind: 'task',
    id: t.id,
    title: t.title || 'Untitled task',
    preview: (t.notes || '').slice(0, 90),
    color: null,
    backgroundUri: t.backgroundUri ?? null,
    updatedAt: t.updatedAt,
    trashedAt: t.trashedAt ?? null,
  };
}

async function allNotes(): Promise<Note[]> {
  const rows = await notesCollection.query().fetch();
  return rows.map(r => r.toPlain());
}

async function allTasks(): Promise<Task[]> {
  const rows = await tasksCollection.query().fetch();
  return rows.map(r => r.toPlain());
}

/** Archived items, newest first. */
export async function getArchived(): Promise<ArchiveEntry[]> {
  const [notes, tasks] = await Promise.all([allNotes(), allTasks()]);
  return [
    ...notes.filter(n => n.archived && !n.trashedAt).map(noteEntry),
    ...tasks.filter(t => t.archived && !t.trashedAt).map(taskEntry),
  ].sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Trashed items, most recently trashed first. */
export async function getTrashed(): Promise<ArchiveEntry[]> {
  const [notes, tasks] = await Promise.all([allNotes(), allTasks()]);
  return [
    ...notes.filter(n => n.trashedAt).map(noteEntry),
    ...tasks.filter(t => t.trashedAt).map(taskEntry),
  ].sort((a, b) => (b.trashedAt ?? 0) - (a.trashedAt ?? 0));
}

async function findRow(kind: ItemKind, id: string) {
  const collection = kind === 'note' ? notesCollection : tasksCollection;
  return collection.find(id).catch(() => null);
}

export async function setArchived(
  kind: ItemKind,
  id: string,
  archived: boolean,
): Promise<void> {
  const row = await findRow(kind, id);
  if (!row) return;
  await database.write(async () => {
    await row.update((r: any) => {
      r.archived = archived;
      // Archiving something in the trash pulls it back out.
      r.trashedAt = null;
      r.updatedAt = Date.now();
    });
  });
}

/** Moves to trash. Reversible until purged. */
export async function moveToTrash(kind: ItemKind, id: string): Promise<void> {
  const row = await findRow(kind, id);
  if (!row) return;
  await database.write(async () => {
    await row.update((r: any) => {
      r.trashedAt = Date.now();
      r.archived = false;
      r.updatedAt = Date.now();
    });
  });
}

export async function restoreFromTrash(kind: ItemKind, id: string): Promise<void> {
  const row = await findRow(kind, id);
  if (!row) return;
  await database.write(async () => {
    await row.update((r: any) => {
      r.trashedAt = null;
      r.updatedAt = Date.now();
    });
  });
}

/**
 * Permanently removes an item and its background file.
 *
 * The background is deleted here rather than on trash so a restore keeps its
 * image.
 */
export async function deleteForever(kind: ItemKind, id: string): Promise<void> {
  const row = await findRow(kind, id);
  if (!row) return;
  const uri = (row as any).backgroundUri as string | null;
  await database.write(async () => { await row.destroyPermanently(); });
  await deleteBackgroundFile(uri);
}

export async function emptyTrash(): Promise<number> {
  const trashed = await getTrashed();
  for (const entry of trashed) await deleteForever(entry.kind, entry.id);
  return trashed.length;
}

/**
 * Purges trash older than the retention window.
 *
 * Called on app start: a trash that never empties is a storage leak, and the
 * 30-day window matches what users expect from other apps.
 */
export async function purgeExpiredTrash(now = Date.now()): Promise<number> {
  const cutoff = now - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const trashed = await getTrashed();
  const expired = trashed.filter(e => (e.trashedAt ?? now) < cutoff);
  for (const entry of expired) await deleteForever(entry.kind, entry.id);
  return expired.length;
}
