import { Alert, PermissionsAndroid, Platform, Share } from 'react-native';
import RNFS from 'react-native-fs';
import { Q } from '@nozbe/watermelondb';
import {
  boardItemsCollection, boardVersionsCollection, boardsCollection, database,
} from '../db';
import {
  boardToSvg, BOARD_BACKGROUNDS, DEFAULT_VIEWPORT, itemsBounds, nextZ,
  type TemplateSeed,
} from '../core/whiteboard';
import { DEFAULT_TEXT_STYLE } from '../types/whiteboard';
import type {
  Board, BoardItem, BoardVersion, Point, Viewport,
} from '../types/whiteboard';

export type { BoardVersion };

// ─── Boards ──────────────────────────────────────────────────────────────────

export async function getBoards(includeArchived = false): Promise<Board[]> {
  const rows = await boardsCollection.query().fetch();
  return rows
    .map(r => r.toPlain())
    .filter(b => includeArchived || !b.archived)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function createBoard(
  name: string,
  seeds: TemplateSeed[] = [],
): Promise<string> {
  const now = Date.now();
  let id = '';
  await database.write(async () => {
    const row = await boardsCollection.create(r => {
      r.name = name;
      r.background = BOARD_BACKGROUNDS[0];
      r.pattern = 'plain';
      r.passcode = null;
      r.archived = false;
      r.panX = DEFAULT_VIEWPORT.panX;
      r.panY = DEFAULT_VIEWPORT.panY;
      r.zoom = DEFAULT_VIEWPORT.zoom;
      r.createdAt = now;
      r.updatedAt = now;
    });
    id = row.id;
  });

  if (seeds.length > 0) await addItems(id, seeds);
  return id;
}

export async function updateBoard(
  id: string,
  patch: Partial<Pick<Board, 'name' | 'background' | 'pattern' | 'passcode' | 'archived'>>,
): Promise<void> {
  const row = await boardsCollection.find(id).catch(() => null);
  if (!row) return;
  await database.write(async () => {
    await row.update(r => {
      if (patch.name !== undefined) r.name = patch.name;
      if (patch.background !== undefined) r.background = patch.background;
      if (patch.pattern !== undefined) r.pattern = patch.pattern;
      if (patch.passcode !== undefined) r.passcode = patch.passcode;
      if (patch.archived !== undefined) r.archived = patch.archived;
      r.updatedAt = Date.now();
    });
  });
}

/**
 * Persists the viewport without touching `updatedAt` — panning is not editing,
 * and bumping the timestamp would reshuffle the board list on every look.
 */
export async function saveViewport(id: string, vp: Viewport): Promise<void> {
  const row = await boardsCollection.find(id).catch(() => null);
  if (!row) return;
  await database.write(async () => {
    await row.update(r => {
      r.panX = vp.panX;
      r.panY = vp.panY;
      r.zoom = vp.zoom;
    });
  });
}

export async function deleteBoard(id: string): Promise<void> {
  const row = await boardsCollection.find(id).catch(() => null);
  if (!row) return;
  const [items, versions] = await Promise.all([
    boardItemsCollection.query(Q.where('board_id', id)).fetch(),
    boardVersionsCollection.query(Q.where('board_id', id)).fetch(),
  ]);

  await database.write(async () => {
    await database.batch(
      ...items.map(i => i.prepareDestroyPermanently()),
      ...versions.map(v => v.prepareDestroyPermanently()),
      row.prepareDestroyPermanently(),
    );
  });
}

/** Copies a board and everything on it, preserving groups as fresh ids. */
export async function duplicateBoard(id: string): Promise<string | null> {
  const boards = await getBoards(true);
  const source = boards.find(b => b.id === id);
  if (!source) return null;

  const items = await getItems(id);
  const newId = await createBoard(`${source.name} copy`);
  await updateBoard(newId, {
    background: source.background,
    pattern: source.pattern,
  });

  // Remap group ids so the copy's groups are independent of the original's.
  const groupMap = new Map<string, string>();
  items.forEach(i => {
    if (i.groupId && !groupMap.has(i.groupId)) {
      groupMap.set(i.groupId, `g${Date.now().toString(36)}${groupMap.size}`);
    }
  });

  await addItems(newId, items.map(i => ({
    kind: i.kind, x: i.x, y: i.y, width: i.width, height: i.height,
    rotation: i.rotation, text: i.text, color: i.color, fill: i.fill,
    points: i.points, strokeWidth: i.strokeWidth, pen: i.pen, uri: i.uri,
    z: i.z, layer: i.layer, locked: i.locked,
    groupId: i.groupId ? groupMap.get(i.groupId) ?? null : null,
    textStyle: i.textStyle,
  })));

  return newId;
}

// ─── Items ───────────────────────────────────────────────────────────────────

export async function getItems(boardId: string): Promise<BoardItem[]> {
  // Filter in SQL against the indexed board_id. Fetching the whole table and
  // filtering in JS meant every board's items were read and deserialised on
  // each call — with the boards list calling this once per board, that was the
  // entire table re-read N times just to show item counts.
  const rows = await boardItemsCollection.query(
    Q.where('board_id', boardId),
  ).fetch();
  return rows
    .map(r => r.toPlain())
    .sort((a, b) => a.layer - b.layer || a.z - b.z);
}

/**
 * Item counts for many boards in one query.
 *
 * Exists so the boards list doesn't call `getItems` per board — that was N
 * queries, each deserialising every row, to render a number per card.
 */
export async function getItemCounts(): Promise<Record<string, number>> {
  const rows = await boardItemsCollection.query().fetch();
  const counts: Record<string, number> = {};
  rows.forEach(r => {
    counts[r.boardId] = (counts[r.boardId] ?? 0) + 1;
  });
  return counts;
}

export type NewItem = Omit<BoardItem, 'id' | 'boardId' | 'createdAt' | 'updatedAt' | 'z'>
  & { z?: number };

async function touchBoard(boardId: string): Promise<void> {
  const row = await boardsCollection.find(boardId).catch(() => null);
  if (!row) return;
  await database.write(async () => {
    await row.update(r => { r.updatedAt = Date.now(); });
  });
}

function writeItem(r: any, boardId: string, input: NewItem, z: number, now: number): void {
  r.boardId = boardId;
  r.kind = input.kind;
  r.x = input.x;
  r.y = input.y;
  r.width = input.width;
  r.height = input.height;
  r.rotation = input.rotation ?? 0;
  r.text = input.text;
  r.color = input.color;
  r.fill = input.fill ?? null;
  r.pointsJson = JSON.stringify(input.points ?? []);
  r.strokeWidth = input.strokeWidth;
  r.pen = input.pen ?? 'pen';
  r.uri = input.uri;
  r.z = z;
  r.layer = input.layer ?? 0;
  r.locked = input.locked ?? false;
  r.groupId = input.groupId ?? null;
  r.textStyleJson = JSON.stringify(input.textStyle ?? DEFAULT_TEXT_STYLE);
  r.createdAt = now;
  r.updatedAt = now;
}

export async function addItem(
  boardId: string,
  input: NewItem,
  existing: BoardItem[],
): Promise<string> {
  const now = Date.now();
  let id = '';
  await database.write(async () => {
    const row = await boardItemsCollection.create(r => {
      writeItem(r, boardId, input, input.z ?? nextZ(existing), now);
    });
    id = row.id;
  });
  await touchBoard(boardId);
  return id;
}

/** Batched insert — used by templates, duplicate and paste. */
export async function addItems(boardId: string, inputs: NewItem[]): Promise<void> {
  if (inputs.length === 0) return;
  const now = Date.now();
  const existing = await getItems(boardId);
  let z = nextZ(existing);

  await database.write(async () => {
    await database.batch(
      ...inputs.map(input => boardItemsCollection.prepareCreate(r => {
        writeItem(r, boardId, input, input.z ?? z++, now);
      })),
    );
  });
  await touchBoard(boardId);
}

export type ItemPatch = Partial<Omit<BoardItem, 'id' | 'boardId' | 'createdAt'>>;

function applyPatch(r: any, patch: ItemPatch): void {
  if (patch.x !== undefined) r.x = patch.x;
  if (patch.y !== undefined) r.y = patch.y;
  if (patch.width !== undefined) r.width = patch.width;
  if (patch.height !== undefined) r.height = patch.height;
  if (patch.rotation !== undefined) r.rotation = patch.rotation;
  if (patch.text !== undefined) r.text = patch.text;
  if (patch.color !== undefined) r.color = patch.color;
  if (patch.fill !== undefined) r.fill = patch.fill;
  if (patch.points !== undefined) r.pointsJson = JSON.stringify(patch.points);
  if (patch.strokeWidth !== undefined) r.strokeWidth = patch.strokeWidth;
  if (patch.pen !== undefined) r.pen = patch.pen;
  if (patch.uri !== undefined) r.uri = patch.uri;
  if (patch.z !== undefined) r.z = patch.z;
  if (patch.layer !== undefined) r.layer = patch.layer;
  if (patch.locked !== undefined) r.locked = patch.locked;
  if (patch.groupId !== undefined) r.groupId = patch.groupId;
  if (patch.textStyle !== undefined) r.textStyleJson = JSON.stringify(patch.textStyle);
  r.updatedAt = Date.now();
}

export async function updateItem(id: string, patch: ItemPatch): Promise<void> {
  const row = await boardItemsCollection.find(id).catch(() => null);
  if (!row) return;
  await database.write(async () => {
    await row.update(r => applyPatch(r, patch));
  });
  await touchBoard(row.boardId);
}

/** One write for many items — used by align, group and multi-move. */
export async function updateItems(
  patches: { id: string; patch: ItemPatch }[],
): Promise<void> {
  if (patches.length === 0) return;
  const rows = await boardItemsCollection.query().fetch();
  const byId = new Map(rows.map(r => [r.id, r]));
  const targets = patches
    .map(p => ({ row: byId.get(p.id), patch: p.patch }))
    .filter((t): t is { row: any; patch: ItemPatch } => !!t.row);
  if (targets.length === 0) return;

  await database.write(async () => {
    await database.batch(
      ...targets.map(t => t.row.prepareUpdate((r: any) => applyPatch(r, t.patch))),
    );
  });
  await touchBoard(targets[0].row.boardId);
}

export async function deleteItem(id: string): Promise<void> {
  const row = await boardItemsCollection.find(id).catch(() => null);
  if (!row) return;
  const boardId = row.boardId;
  await database.write(async () => { await row.destroyPermanently(); });
  await touchBoard(boardId);
}

export async function deleteItems(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  // Q.oneOf on the primary key, rather than scanning the table and testing
  // each row with ids.includes — that was O(rows x ids) on every delete.
  const rows = await boardItemsCollection.query(Q.where('id', Q.oneOf(ids))).fetch();
  if (rows.length === 0) return;
  const boardId = rows[0].boardId;
  await database.write(async () => {
    await database.batch(...rows.map(r => r.prepareDestroyPermanently()));
  });
  await touchBoard(boardId);
}

export async function clearBoard(boardId: string): Promise<void> {
  const items = await boardItemsCollection.query(Q.where('board_id', boardId)).fetch();
  if (items.length === 0) return;
  await database.write(async () => {
    await database.batch(...items.map(i => i.prepareDestroyPermanently()));
  });
  await touchBoard(boardId);
}

/**
 * Replaces every item on a board, keeping the original ids.
 *
 * Ids must survive: undo/redo compare snapshots by id, and regenerating them
 * would leave the history stack and the current selection pointing at rows
 * that no longer exist.
 */
export async function replaceItems(boardId: string, items: BoardItem[]): Promise<void> {
  const existing = (await boardItemsCollection.query().fetch())
    .filter(r => r.boardId === boardId);
  const now = Date.now();

  await database.write(async () => {
    await database.batch(
      ...existing.map(r => r.prepareDestroyPermanently()),
      ...items.map(i => boardItemsCollection.prepareCreate(r => {
        // @ts-ignore — assigning the raw id is how WatermelonDB preserves it.
        r._raw.id = i.id;
        writeItem(r, boardId, {
          kind: i.kind, x: i.x, y: i.y, width: i.width, height: i.height,
          rotation: i.rotation, text: i.text, color: i.color, fill: i.fill,
          points: i.points, strokeWidth: i.strokeWidth, pen: i.pen, uri: i.uri,
          layer: i.layer, locked: i.locked, groupId: i.groupId,
          textStyle: i.textStyle,
        }, i.z, now);
      })),
    );
  });
  await touchBoard(boardId);
}

// ─── Version history ─────────────────────────────────────────────────────────

/** Kept bounded so history can't grow without limit. */
const MAX_VERSIONS = 20;

export async function getVersions(boardId: string): Promise<BoardVersion[]> {
  const rows = await boardVersionsCollection.query().fetch();
  return rows
    .map(r => r.toPlain())
    .filter(v => v.boardId === boardId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function saveVersion(boardId: string, label: string): Promise<void> {
  const items = await getItems(boardId);
  const existing = await getVersions(boardId);
  // Drop the oldest beyond the cap in the same write.
  const doomed = existing.slice(MAX_VERSIONS - 1);
  const rows = await boardVersionsCollection.query().fetch();
  const doomedRows = rows.filter(r => doomed.some(d => d.id === r.id));

  await database.write(async () => {
    await database.batch(
      ...doomedRows.map(r => r.prepareDestroyPermanently()),
      boardVersionsCollection.prepareCreate(r => {
        r.boardId = boardId;
        r.label = label;
        r.snapshot = JSON.stringify(items);
        r.itemCount = items.length;
        r.createdAt = Date.now();
      }),
    );
  });
}

export async function restoreVersion(version: BoardVersion): Promise<boolean> {
  try {
    const items = JSON.parse(version.snapshot) as BoardItem[];
    if (!Array.isArray(items)) return false;
    await replaceItems(version.boardId, items);
    return true;
  } catch {
    return false;
  }
}

export async function deleteVersion(id: string): Promise<void> {
  const row = await boardVersionsCollection.find(id).catch(() => null);
  if (!row) return;
  await database.write(async () => { await row.destroyPermanently(); });
}

// ─── Export ──────────────────────────────────────────────────────────────────

async function ensureStoragePermission(): Promise<boolean> {
  if (Platform.OS !== 'android' || Number(Platform.Version) >= 33) return true;
  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

function exportDir(): string {
  return Platform.OS === 'android' ? RNFS.DownloadDirectoryPath : RNFS.DocumentDirectoryPath;
}

function safeName(name: string): string {
  return name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'board';
}

async function offerShare(path: string, title: string, mime: string): Promise<void> {
  Alert.alert('Board exported', `Saved to ${path}`, [
    { text: 'Done', style: 'cancel' },
    {
      text: 'Share',
      onPress: () => {
        Share.share({ url: `file://${path}`, title, message: title })
          .catch(() => { /* dismissed */ });
      },
    },
  ]);
}

/** PNG from a ViewShot capture — the visible viewport. */
export async function exportBoardPng(
  tempPath: string,
  boardName: string,
): Promise<string | null> {
  try {
    if (!(await ensureStoragePermission())) {
      Alert.alert('Permission needed', 'Storage access is required to save the image.');
      return null;
    }
    const dest = `${exportDir()}/thinkora-${safeName(boardName)}-${Date.now()}.png`;
    await RNFS.copyFile(tempPath.replace('file://', ''), dest);
    await offerShare(dest, boardName, 'image/png');
    return dest;
  } catch (e: any) {
    Alert.alert('Export failed', e?.message ?? 'Could not save the image.');
    return null;
  }
}

/**
 * SVG covering the whole board rather than the visible viewport, and sharp at
 * any size — the reason to prefer it over the PNG capture.
 */
export async function exportBoardSvg(
  items: BoardItem[],
  background: string,
  boardName: string,
): Promise<string | null> {
  if (items.length === 0) {
    Alert.alert('Nothing to export', 'Add something to the board first.');
    return null;
  }
  try {
    if (!(await ensureStoragePermission())) {
      Alert.alert('Permission needed', 'Storage access is required to save the file.');
      return null;
    }
    const svg = boardToSvg(items, background);
    const dest = `${exportDir()}/thinkora-${safeName(boardName)}-${Date.now()}.svg`;
    await RNFS.writeFile(dest, svg, 'utf8');
    await offerShare(dest, boardName, 'image/svg+xml');
    return dest;
  } catch (e: any) {
    Alert.alert('Export failed', e?.message ?? 'Could not write the file.');
    return null;
  }
}

/**
 * "PDF" export writes a print-ready HTML page with the board inlined as SVG.
 *
 * There is no PDF renderer in the project; the system print dialog turns this
 * into a real PDF, which matches how pdfExportService already works.
 */
export async function exportBoardPdf(
  items: BoardItem[],
  background: string,
  boardName: string,
): Promise<string | null> {
  if (items.length === 0) {
    Alert.alert('Nothing to export', 'Add something to the board first.');
    return null;
  }
  try {
    if (!(await ensureStoragePermission())) {
      Alert.alert('Permission needed', 'Storage access is required to save the file.');
      return null;
    }
    const b = itemsBounds(items);
    const landscape = b.width > b.height;
    const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>${boardName}</title>
<style>
  @page { size: A4 ${landscape ? 'landscape' : 'portrait'}; margin: 12mm; }
  body { margin: 0; font-family: -apple-system, Roboto, sans-serif; }
  h1 { font-size: 16pt; margin: 0 0 8mm; }
  svg { width: 100%; height: auto; }
</style></head>
<body><h1>${boardName}</h1>${boardToSvg(items, background)}</body></html>`;

    const dest = `${exportDir()}/thinkora-${safeName(boardName)}-${Date.now()}.html`;
    await RNFS.writeFile(dest, html, 'utf8');

    Alert.alert(
      'Ready to print',
      `Saved to ${dest}\n\nOpen it and choose Print → Save as PDF.`,
      [
        { text: 'Done', style: 'cancel' },
        {
          text: 'Share',
          onPress: () => {
            Share.share({ url: `file://${dest}`, title: boardName })
              .catch(() => { /* dismissed */ });
          },
        },
      ],
    );
    return dest;
  } catch (e: any) {
    Alert.alert('Export failed', e?.message ?? 'Could not write the file.');
    return null;
  }
}

/** Builds a stroke item from captured points. */
export function strokeItem(
  points: Point[],
  color: string,
  strokeWidth: number,
  pen: 'pen' | 'highlighter',
  layer: number,
): NewItem {
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);

  return {
    kind: 'stroke',
    x: minX, y: minY,
    width: Math.max(...xs) - minX,
    height: Math.max(...ys) - minY,
    rotation: 0,
    text: '', color, fill: null,
    points, strokeWidth, pen, uri: null,
    layer, locked: false, groupId: null,
    textStyle: { ...DEFAULT_TEXT_STYLE },
  };
}

/**
 * Rebuilds boards from a cloud backup.
 *
 * Existing boards are wiped first so a restore is a true replace rather than a
 * merge that silently duplicates every board.
 */
export async function restoreBoards(
  boards: Board[],
  items: BoardItem[],
): Promise<number> {
  const existing = await getBoards(true);
  for (const b of existing) await deleteBoard(b.id);

  let restored = 0;
  for (const b of boards) {
    const id = await createBoard(b.name);
    await updateBoard(id, {
      background: b.background,
      pattern: b.pattern,
      passcode: b.passcode,
      archived: b.archived,
    });
    const mine = items.filter(i => i.boardId === b.id);
    if (mine.length > 0) {
      await addItems(id, mine.map(i => ({
        kind: i.kind, x: i.x, y: i.y, width: i.width, height: i.height,
        rotation: i.rotation, text: i.text, color: i.color, fill: i.fill,
        points: i.points, strokeWidth: i.strokeWidth, pen: i.pen, uri: i.uri,
        z: i.z, layer: i.layer, locked: i.locked, groupId: i.groupId,
        textStyle: i.textStyle,
      })));
    }
    restored++;
  }
  return restored;
}
