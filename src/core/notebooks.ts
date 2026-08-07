import type { Folder } from '../types';

export interface NotebookCover {
  color: string;
  icon: string;
}

/** Seeded on first run so a new user never faces an empty shelf. */
export const DEFAULT_NOTEBOOKS: { name: string; cover: NotebookCover }[] = [
  { name: 'Work', cover: { color: '#6366F1', icon: 'briefcase-outline' } },
  { name: 'Personal', cover: { color: '#EC4899', icon: 'heart-outline' } },
  { name: 'Ideas', cover: { color: '#F59E0B', icon: 'bulb-outline' } },
  { name: 'Recipes', cover: { color: '#10B981', icon: 'restaurant-outline' } },
  { name: 'Travel', cover: { color: '#0EA5E9', icon: 'airplane-outline' } },
  { name: 'Study', cover: { color: '#8B5CF6', icon: 'school-outline' } },
  { name: 'Journal', cover: { color: '#F97316', icon: 'journal-outline' } },
];

/** How many notebooks a free user may keep. */
export const FREE_NOTEBOOK_LIMIT = DEFAULT_NOTEBOOKS.length;

export const COVER_COLORS = [
  '#6366F1', '#EC4899', '#F59E0B', '#10B981',
  '#0EA5E9', '#8B5CF6', '#F97316', '#EF4444',
  '#14B8A6', '#A855F7', '#64748B', '#D97706',
];

export const COVER_ICONS = [
  'book-outline', 'briefcase-outline', 'heart-outline', 'bulb-outline',
  'restaurant-outline', 'airplane-outline', 'school-outline', 'journal-outline',
  'barbell-outline', 'musical-notes-outline', 'cash-outline', 'home-outline',
  'people-outline', 'leaf-outline', 'camera-outline', 'game-controller-outline',
];

const FALLBACK_ICON = 'book-outline';

/**
 * Resolve a notebook's cover, falling back to a palette colour keyed by
 * position so notebooks created before covers existed still look distinct
 * rather than all sharing one default.
 */
export function resolveCover(folder: Folder, index = 0): NotebookCover {
  return {
    color: folder.color || COVER_COLORS[index % COVER_COLORS.length],
    icon: folder.icon || FALLBACK_ICON,
  };
}

/** Top-level notebooks, in display order. */
export function rootNotebooks(folders: Folder[]): Folder[] {
  return folders
    .filter(f => !f.parentId)
    .sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);
}

/** Direct children of a notebook — the premium "nested folders" feature. */
export function childFolders(folders: Folder[], parentId: string): Folder[] {
  return folders
    .filter(f => f.parentId === parentId)
    .sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);
}

/**
 * Whether a free user may create another notebook.
 *
 * Counts only top-level notebooks: nested folders are gated separately, so
 * counting them here would report the limit reached twice over.
 */
export function canCreateNotebook(folders: Folder[], hasPremium: boolean): boolean {
  if (hasPremium) return true;
  return rootNotebooks(folders).length < FREE_NOTEBOOK_LIMIT;
}

/** Notes counted per notebook, including notes in its nested folders. */
export function noteCountFor(
  folderId: string,
  folders: Folder[],
  notes: { folderId: string | null }[],
): number {
  const ids = new Set<string>([folderId]);
  childFolders(folders, folderId).forEach(c => ids.add(c.id));
  return notes.filter(n => n.folderId && ids.has(n.folderId)).length;
}
