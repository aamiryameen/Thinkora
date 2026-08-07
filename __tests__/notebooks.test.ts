import {
  canCreateNotebook,
  childFolders,
  COVER_COLORS,
  DEFAULT_NOTEBOOKS,
  FREE_NOTEBOOK_LIMIT,
  noteCountFor,
  resolveCover,
  rootNotebooks,
} from '../src/core/notebooks';
import type { Folder } from '../src/types';

function folder(id: string, over: Partial<Folder> = {}): Folder {
  return {
    id, name: id, parentId: null, order: 0, createdAt: 1000,
    color: null, icon: null, ...over,
  };
}

describe('default notebooks', () => {
  it('ships the seven starter notebooks', () => {
    expect(DEFAULT_NOTEBOOKS.map(n => n.name)).toEqual([
      'Work', 'Personal', 'Ideas', 'Recipes', 'Travel', 'Study', 'Journal',
    ]);
  });

  it('gives every default a distinct colour and an icon', () => {
    const colors = DEFAULT_NOTEBOOKS.map(n => n.cover.color);
    expect(new Set(colors).size).toBe(colors.length);
    DEFAULT_NOTEBOOKS.forEach(n => expect(n.cover.icon).toBeTruthy());
  });

  it('sets the free limit to the number of defaults, so a new user is never gated', () => {
    expect(FREE_NOTEBOOK_LIMIT).toBe(DEFAULT_NOTEBOOKS.length);
  });
});

describe('resolveCover', () => {
  it('uses the stored cover when present', () => {
    const f = folder('a', { color: '#123456', icon: 'star-outline' });
    expect(resolveCover(f, 0)).toEqual({ color: '#123456', icon: 'star-outline' });
  });

  it('falls back to a palette colour keyed by position', () => {
    expect(resolveCover(folder('a'), 0).color).toBe(COVER_COLORS[0]);
    expect(resolveCover(folder('b'), 1).color).toBe(COVER_COLORS[1]);
  });

  it('wraps the palette rather than returning undefined past the end', () => {
    const cover = resolveCover(folder('z'), COVER_COLORS.length + 2);
    expect(COVER_COLORS).toContain(cover.color);
  });

  it('always yields an icon', () => {
    expect(resolveCover(folder('a'), 0).icon).toBeTruthy();
  });
});

describe('rootNotebooks', () => {
  it('excludes nested folders', () => {
    const folders = [folder('a'), folder('child', { parentId: 'a' })];
    expect(rootNotebooks(folders).map(f => f.id)).toEqual(['a']);
  });

  it('sorts by order, then creation time as a tiebreak', () => {
    const folders = [
      folder('third', { order: 2 }),
      folder('first', { order: 0 }),
      folder('second', { order: 1 }),
    ];
    expect(rootNotebooks(folders).map(f => f.id)).toEqual(['first', 'second', 'third']);
  });

  it('is stable for equal order values', () => {
    const folders = [
      folder('newer', { order: 0, createdAt: 2000 }),
      folder('older', { order: 0, createdAt: 1000 }),
    ];
    expect(rootNotebooks(folders).map(f => f.id)).toEqual(['older', 'newer']);
  });

  it('handles an empty library', () => {
    expect(rootNotebooks([])).toEqual([]);
  });
});

describe('childFolders', () => {
  it('returns only direct children', () => {
    const folders = [
      folder('book'),
      folder('c1', { parentId: 'book' }),
      folder('c2', { parentId: 'book' }),
      folder('other'),
    ];
    expect(childFolders(folders, 'book').map(f => f.id)).toEqual(['c1', 'c2']);
  });

  it('returns empty for a notebook with no children', () => {
    expect(childFolders([folder('book')], 'book')).toEqual([]);
  });
});

describe('canCreateNotebook', () => {
  const full = Array.from({ length: FREE_NOTEBOOK_LIMIT }, (_, i) => folder(`n${i}`));

  it('allows a free user below the limit', () => {
    expect(canCreateNotebook(full.slice(0, FREE_NOTEBOOK_LIMIT - 1), false)).toBe(true);
  });

  it('blocks a free user at the limit', () => {
    expect(canCreateNotebook(full, false)).toBe(false);
  });

  it('always allows a premium user', () => {
    expect(canCreateNotebook(full, true)).toBe(true);
    expect(canCreateNotebook([...full, ...full], true)).toBe(true);
  });

  it('does not count nested folders towards the notebook limit', () => {
    // Otherwise a premium user who nests folders and later lapses would be
    // blocked far below the real notebook count.
    const withNesting = [
      ...full.slice(0, FREE_NOTEBOOK_LIMIT - 1),
      folder('nested', { parentId: 'n0' }),
      folder('nested2', { parentId: 'n0' }),
    ];
    expect(canCreateNotebook(withNesting, false)).toBe(true);
  });

  it('allows the first notebook in an empty library', () => {
    expect(canCreateNotebook([], false)).toBe(true);
  });
});

describe('noteCountFor', () => {
  const folders = [
    folder('book'),
    folder('child', { parentId: 'book' }),
    folder('other'),
  ];

  it('counts notes directly in the notebook', () => {
    const notes = [{ folderId: 'book' }, { folderId: 'book' }, { folderId: 'other' }];
    expect(noteCountFor('book', folders, notes)).toBe(2);
  });

  it('includes notes in nested folders', () => {
    const notes = [{ folderId: 'book' }, { folderId: 'child' }];
    expect(noteCountFor('book', folders, notes)).toBe(2);
  });

  it('ignores unfiled notes', () => {
    const notes = [{ folderId: null }, { folderId: 'book' }];
    expect(noteCountFor('book', folders, notes)).toBe(1);
  });

  it('returns zero for an empty notebook', () => {
    expect(noteCountFor('book', folders, [{ folderId: 'other' }])).toBe(0);
  });

  it('does not count another notebook\'s notes', () => {
    const notes = [{ folderId: 'other' }, { folderId: 'other' }];
    expect(noteCountFor('book', folders, notes)).toBe(0);
  });
});
