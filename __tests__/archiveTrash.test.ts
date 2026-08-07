import { daysUntilPurge, TRASH_RETENTION_DAYS } from '../src/core/trash';
import { cssFontFamily, findFont, fontStyle, NOTE_FONTS } from '../src/core/fonts';

const DAY = 24 * 60 * 60 * 1000;

describe('daysUntilPurge', () => {
  const now = new Date(2026, 7, 4).getTime();

  it('gives the full window for a freshly trashed item', () => {
    expect(daysUntilPurge(now, now)).toBe(TRASH_RETENTION_DAYS);
  });

  it('counts down as days pass', () => {
    expect(daysUntilPurge(now - 5 * DAY, now)).toBe(TRASH_RETENTION_DAYS - 5);
  });

  it('never goes negative for an overdue item', () => {
    expect(daysUntilPurge(now - 90 * DAY, now)).toBe(0);
  });

  it('treats a missing timestamp as the full window', () => {
    expect(daysUntilPurge(null, now)).toBe(TRASH_RETENTION_DAYS);
  });

  it('reaches zero exactly at the retention boundary', () => {
    expect(daysUntilPurge(now - TRASH_RETENTION_DAYS * DAY, now)).toBe(0);
  });
});

describe('fonts', () => {
  it('has unique ids', () => {
    const ids = NOTE_FONTS.map(f => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('offers a free default that needs no font family', () => {
    const first = NOTE_FONTS[0];
    expect(first.id).toBe('default');
    expect(first.premium).toBe(false);
    expect(first.fontFamily).toBeUndefined();
  });

  it('has both free and premium faces', () => {
    expect(NOTE_FONTS.some(f => !f.premium)).toBe(true);
    expect(NOTE_FONTS.some(f => f.premium)).toBe(true);
  });

  it('falls back to the default for an unknown id', () => {
    expect(findFont('no-such-font').id).toBe('default');
    expect(findFont(null).id).toBe('default');
    expect(findFont(undefined).id).toBe('default');
  });

  it('omits undefined keys so they never override a base style', () => {
    // Spreading `{ fontFamily: undefined }` onto a style would blank out an
    // inherited family rather than leaving it alone.
    const style = fontStyle('default');
    expect('fontFamily' in style).toBe(false);
    expect('fontWeight' in style).toBe(false);
  });

  it('returns a family for a named face', () => {
    expect(fontStyle('serif').fontFamily).toBeTruthy();
  });

  it('scales size for faces with a different x-height', () => {
    const mono = fontStyle('mono', 100);
    expect(mono.fontSize).toBeLessThan(100);
    const cursive = fontStyle('cursive', 100);
    expect(cursive.fontSize).toBeGreaterThan(100);
  });

  it('leaves size out when no base size is given', () => {
    expect(fontStyle('mono').fontSize).toBeUndefined();
  });

  it('builds a css stack with a generic fallback for the rich editor', () => {
    expect(cssFontFamily('mono')).toContain('monospace');
    expect(cssFontFamily('serif')).toContain('serif');
    expect(cssFontFamily('cursive')).toContain('cursive');
  });

  it('gives the default a plain system stack', () => {
    expect(cssFontFamily('default')).toContain('sans-serif');
  });

  it('never throws for any listed font', () => {
    NOTE_FONTS.forEach(f => {
      expect(() => fontStyle(f.id, 16)).not.toThrow();
      expect(cssFontFamily(f.id).length).toBeGreaterThan(0);
    });
  });
});

// ─── Background pruning ──────────────────────────────────────────────────────

const mockFiles: { path: string }[] = [];
const mockUnlinked: string[] = [];

jest.mock('react-native-fs', () => ({
  DocumentDirectoryPath: '/docs',
  DownloadDirectoryPath: '/dl',
  exists: jest.fn(async () => true),
  readDir: jest.fn(async () => mockFiles),
  unlink: jest.fn(async (p: string) => { mockUnlinked.push(p); }),
  mkdir: jest.fn(async () => {}),
  copyFile: jest.fn(async () => {}),
  downloadFile: jest.fn(() => ({ promise: Promise.resolve({ statusCode: 200 }) })),
  writeFile: jest.fn(async () => {}),
}));

jest.mock('../src/core/env', () => ({ PEXELS_API_KEY: '' }));

describe('pruneOrphanBackgrounds', () => {
  const { pruneOrphanBackgrounds } = require('../src/services/wallpaperService');

  beforeEach(() => {
    mockFiles.length = 0;
    mockUnlinked.length = 0;
  });

  it('keeps files that are still referenced', async () => {
    mockFiles.push({ path: '/docs/backgrounds/local-1.jpg' });
    const removed = await pruneOrphanBackgrounds(['file:///docs/backgrounds/local-1.jpg']);
    expect(removed).toBe(0);
    expect(mockUnlinked).toEqual([]);
  });

  it('removes files nothing points at', async () => {
    mockFiles.push({ path: '/docs/backgrounds/orphan.jpg' });
    const removed = await pruneOrphanBackgrounds([]);
    expect(removed).toBe(1);
    expect(mockUnlinked).toEqual(['/docs/backgrounds/orphan.jpg']);
  });

  it('matches regardless of the file:// prefix', async () => {
    mockFiles.push({ path: '/docs/backgrounds/keep.jpg' });
    // A note may store the path with or without the scheme.
    await pruneOrphanBackgrounds(['/docs/backgrounds/keep.jpg']);
    expect(mockUnlinked).toEqual([]);
  });

  it('ignores null and undefined references rather than treating them as paths', async () => {
    mockFiles.push({ path: '/docs/backgrounds/a.jpg' });
    const removed = await pruneOrphanBackgrounds([null, undefined, 'file:///docs/backgrounds/a.jpg']);
    expect(removed).toBe(0);
  });

  it('keeps a file shared by several notes', async () => {
    mockFiles.push({ path: '/docs/backgrounds/pexels-9.jpg' });
    const shared = 'file:///docs/backgrounds/pexels-9.jpg';
    await pruneOrphanBackgrounds([shared, shared, shared]);
    expect(mockUnlinked).toEqual([]);
  });

  it('removes several orphans in one pass', async () => {
    mockFiles.push({ path: '/docs/backgrounds/a.jpg' });
    mockFiles.push({ path: '/docs/backgrounds/b.jpg' });
    mockFiles.push({ path: '/docs/backgrounds/keep.jpg' });
    const removed = await pruneOrphanBackgrounds(['file:///docs/backgrounds/keep.jpg']);
    expect(removed).toBe(2);
    expect(mockUnlinked).not.toContain('/docs/backgrounds/keep.jpg');
  });
});

describe('deleteBackgroundFile', () => {
  const { deleteBackgroundFile } = require('../src/services/wallpaperService');

  beforeEach(() => { mockUnlinked.length = 0; });

  it('does nothing for a null uri', async () => {
    await deleteBackgroundFile(null);
    expect(mockUnlinked).toEqual([]);
  });

  it('refuses paths outside the backgrounds folder', async () => {
    // Guards against ever unlinking a user's original gallery photo.
    await deleteBackgroundFile('file:///storage/emulated/0/DCIM/photo.jpg');
    expect(mockUnlinked).toEqual([]);
  });

  it('deletes a background file', async () => {
    await deleteBackgroundFile('file:///docs/backgrounds/x.jpg');
    expect(mockUnlinked).toEqual(['/docs/backgrounds/x.jpg']);
  });
});
