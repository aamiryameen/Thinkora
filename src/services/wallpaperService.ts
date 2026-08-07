import RNFS from 'react-native-fs';
import { PEXELS_API_KEY } from '../core/env';

export interface Wallpaper {
  id: string;
  /** Small preview used in the picker grid. */
  thumbUrl: string;
  /** Full-size url downloaded when the user commits. */
  fullUrl: string;
  photographer: string;
}

/** Categories offered in the picker, each a Pexels search term. */
export const WALLPAPER_CATEGORIES = [
  'mobile wallpaper', 'abstract', 'nature', 'minimal',
  'texture', 'gradient', 'paper', 'dark',
];

const DIR = `${RNFS.DocumentDirectoryPath}/backgrounds`;

export function isWallpaperSearchAvailable(): boolean {
  return PEXELS_API_KEY.length > 0;
}

/**
 * Searches Pexels for backgrounds.
 *
 * Returns an empty list rather than throwing when no key is configured or the
 * request fails — the picker then shows its "gallery instead" fallback rather
 * than an error the user can do nothing about.
 */
export async function searchWallpapers(
  query: string,
  perPage = 30,
): Promise<Wallpaper[]> {
  if (!isWallpaperSearchAvailable()) return [];

  try {
    const url = 'https://api.pexels.com/v1/search'
      + `?query=${encodeURIComponent(query)}`
      + `&per_page=${perPage}&orientation=portrait`;

    const res = await fetch(url, { headers: { Authorization: PEXELS_API_KEY } });
    if (!res.ok) return [];

    const json = await res.json();
    const photos = Array.isArray(json?.photos) ? json.photos : [];

    return photos
      .filter((p: any) => p?.src?.large && p?.src?.medium)
      .map((p: any) => ({
        id: String(p.id),
        thumbUrl: p.src.medium,
        // `large` is ~940px wide: plenty behind a note, far cheaper than the
        // original, which can be 5000px+.
        fullUrl: p.src.large,
        photographer: p.photographer ?? 'Pexels',
      }));
  } catch {
    return [];
  }
}

/**
 * Downloads a wallpaper into app storage and returns its local uri.
 *
 * Backgrounds must survive going offline, so the remote url is never stored on
 * the note itself.
 */
export async function downloadWallpaper(wallpaper: Wallpaper): Promise<string | null> {
  try {
    await RNFS.mkdir(DIR).catch(() => { /* already exists */ });
    const path = `${DIR}/pexels-${wallpaper.id}.jpg`;

    // Re-picking the same image shouldn't re-download it.
    if (await RNFS.exists(path)) return `file://${path}`;

    const { promise } = RNFS.downloadFile({
      fromUrl: wallpaper.fullUrl,
      toFile: path,
      background: false,
    });
    const result = await promise;
    if (result.statusCode !== 200) {
      await RNFS.unlink(path).catch(() => {});
      return null;
    }
    return `file://${path}`;
  } catch {
    return null;
  }
}

/**
 * Copies a user-picked image into app storage.
 *
 * Gallery uris can be transient content:// handles that stop resolving, so a
 * background has to own its own copy of the file.
 */
export async function saveLocalBackground(uri: string): Promise<string | null> {
  await RNFS.mkdir(DIR).catch(() => { /* already exists */ });
  const path = `${DIR}/local-${Date.now()}.jpg`;

  // Only strip the scheme for file:// — a content:// uri must be passed intact
  // or RNFS can't resolve it through the Android content provider.
  const source = uri.startsWith('file://') ? uri.replace('file://', '') : uri;

  try {
    await RNFS.copyFile(source, path);
    return `file://${path}`;
  } catch {
    // Some providers reject copyFile; reading and writing the bytes works where
    // it doesn't.
    try {
      const base64 = await RNFS.readFile(source, 'base64');
      await RNFS.writeFile(path, base64, 'base64');
      return `file://${path}`;
    } catch {
      // Last resort: keep the original uri and accept it may expire, rather
      // than dropping the user's choice entirely.
      return uri;
    }
  }
}

/** Removes a background file that no note or task references any more. */
export async function deleteBackgroundFile(uri: string | null | undefined): Promise<void> {
  if (!uri || !uri.includes('/backgrounds/')) return;
  try { await RNFS.unlink(uri.replace('file://', '')); } catch { /* already gone */ }
}

/**
 * Deletes background files nothing references any more.
 *
 * Re-picking a background leaves the previous file behind, and `local-*.jpg`
 * names are unique per pick — so without this the folder grows without bound.
 * A Pexels file may be shared by several notes, hence the reference check
 * rather than deleting on swap.
 */
export async function pruneOrphanBackgrounds(
  referencedUris: (string | null | undefined)[],
): Promise<number> {
  try {
    if (!(await RNFS.exists(DIR))) return 0;

    const referenced = new Set(
      referencedUris
        .filter((u): u is string => !!u)
        .map(u => u.replace('file://', '')),
    );

    const files = await RNFS.readDir(DIR);
    let removed = 0;
    for (const file of files) {
      if (!referenced.has(file.path)) {
        await RNFS.unlink(file.path).catch(() => {});
        removed++;
      }
    }
    return removed;
  } catch {
    return 0;
  }
}
