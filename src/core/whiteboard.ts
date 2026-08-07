import {
  DEFAULT_TEXT_STYLE,
  type BoardItem,
  type Handle,
  type BoardLayer,
  type Point,
  type Viewport,
} from '../types/whiteboard';

export const FREE_BOARD_LIMIT = 3;
export const FREE_LAYER_LIMIT = 2;
export const FREE_IMAGE_LIMIT = 5;

export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 4;

export const GRID_SIZE = 20;

export const NOTE_SIZE = 160;
export const NOTE_COLORS = [
  '#FDE68A', '#FCA5A5', '#A7F3D0', '#BFDBFE',
  '#DDD6FE', '#FBCFE8', '#FED7AA', '#E5E7EB',
];

export const STROKE_COLORS = [
  '#1F2937', '#EF4444', '#F59E0B', '#10B981',
  '#0EA5E9', '#6366F1', '#8B5CF6', '#EC4899',
];

export const STROKE_WIDTHS = [2, 4, 8, 16];
/** Highlighter is deliberately fat and translucent. */
export const HIGHLIGHTER_WIDTH = 22;
export const HIGHLIGHTER_OPACITY = 0.35;

export const BOARD_BACKGROUNDS = ['#FFFFFF', '#F8FAFC', '#1F2937', '#FEF3C7'];

export const DEFAULT_VIEWPORT: Viewport = { panX: 0, panY: 0, zoom: 1 };

/** Minimum size an item can be resized to, in world units. */
export const MIN_ITEM_SIZE = 24;

export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom) || zoom <= 0) return 1;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

export function toWorld(screen: Point, vp: Viewport): Point {
  const zoom = clampZoom(vp.zoom);
  return { x: (screen.x - vp.panX) / zoom, y: (screen.y - vp.panY) / zoom };
}

export function toScreen(world: Point, vp: Viewport): Point {
  const zoom = clampZoom(vp.zoom);
  return { x: world.x * zoom + vp.panX, y: world.y * zoom + vp.panY };
}

/**
 * Zooms about a screen anchor so the point under the user's fingers stays
 * fixed — pinching about the origin would make the canvas lurch.
 */
export function zoomAbout(vp: Viewport, anchor: Point, nextZoom: number): Viewport {
  const zoom = clampZoom(nextZoom);
  const world = toWorld(anchor, vp);
  return { zoom, panX: anchor.x - world.x * zoom, panY: anchor.y - world.y * zoom };
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function snap(value: number, enabled: boolean, size = GRID_SIZE): number {
  return enabled ? Math.round(value / size) * size : value;
}

export function snapPoint(p: Point, enabled: boolean, size = GRID_SIZE): Point {
  return { x: snap(p.x, enabled, size), y: snap(p.y, enabled, size) };
}

export function boundsOf(points: Point[]): {
  x: number; y: number; width: number; height: number;
} {
  if (points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  let minX = points[0].x, maxX = points[0].x, minY = points[0].y, maxY = points[0].y;
  points.forEach(p => {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  });
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * Normalised extent of a single item.
 *
 * Lines and arrows store width/height as a direction vector, so either can be
 * negative — a leftward arrow has negative width. Anything reasoning about
 * area (bounds, alignment, hit boxes) needs the positive form.
 */
export function normalizeRect(item: BoardItem): {
  x: number; y: number; width: number; height: number;
} {
  return {
    x: item.width < 0 ? item.x + item.width : item.x,
    y: item.height < 0 ? item.y + item.height : item.y,
    width: Math.abs(item.width),
    height: Math.abs(item.height),
  };
}

/** Bounding box covering several items. */
export function itemsBounds(items: BoardItem[]): {
  x: number; y: number; width: number; height: number;
} {
  const corners: Point[] = [];
  items.forEach(i => {
    const r = normalizeRect(i);
    corners.push({ x: r.x, y: r.y });
    corners.push({ x: r.x + r.width, y: r.y + r.height });
  });
  return boundsOf(corners);
}

export function centerOf(item: BoardItem): Point {
  // Uses the raw values: for a line the midpoint of the vector *is* the centre,
  // and it coincides with the normalised box centre either way.
  return { x: item.x + item.width / 2, y: item.y + item.height / 2 };
}

/** Rotates a point about a pivot by `degrees` clockwise. */
export function rotatePoint(p: Point, pivot: Point, degrees: number): Point {
  if (!degrees) return p;
  const rad = (degrees * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = p.x - pivot.x;
  const dy = p.y - pivot.y;
  return {
    x: pivot.x + dx * cos - dy * sin,
    y: pivot.y + dx * sin + dy * cos,
  };
}

export function strokePath(points: Point[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) {
    const p = points[0];
    // A dot: a zero-length line renders nothing, so nudge the end point.
    return `M ${p.x} ${p.y} L ${p.x + 0.01} ${p.y}`;
  }
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const mid = midpoint(points[i], points[i + 1]);
    d += ` Q ${points[i].x} ${points[i].y} ${mid.x} ${mid.y}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}

/**
 * Drops samples closer together than `min` world units. Touch events arrive
 * far faster than the detail a stroke needs.
 */
export function simplify(points: Point[], min = 2): Point[] {
  if (points.length < 3) return points;
  const out: Point[] = [points[0]];
  points.forEach(p => {
    if (distance(p, out[out.length - 1]) >= min) out.push(p);
  });
  const last = points[points.length - 1];
  if (out[out.length - 1] !== last) out.push(last);
  return out;
}

/**
 * True when a world point falls inside an item.
 *
 * Rotation is undone first: testing the axis-aligned box of a rotated item
 * would report hits on empty corners.
 */
export function hitTest(item: BoardItem, world: Point, slack = 0): boolean {
  const local = item.rotation
    ? rotatePoint(world, centerOf(item), -item.rotation)
    : world;

  if (item.kind === 'stroke') {
    const tolerance = Math.max(item.strokeWidth, 12) + slack;
    return item.points.some(p => distance(p, local) <= tolerance);
  }

  if (item.kind === 'line' || item.kind === 'arrow') {
    // Thin diagonals need proximity to the segment, not the bbox.
    const a = { x: item.x, y: item.y };
    const b = { x: item.x + item.width, y: item.y + item.height };
    return pointToSegment(local, a, b) <= Math.max(item.strokeWidth, 12) + slack;
  }

  const r = normalizeRect(item);
  return (
    local.x >= r.x - slack
    && local.x <= r.x + r.width + slack
    && local.y >= r.y - slack
    && local.y <= r.y + r.height + slack
  );
}

/** Shortest distance from a point to a line segment. */
export function pointToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return distance(p, a);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return distance(p, { x: a.x + t * dx, y: a.y + t * dy });
}

/** Topmost visible, unlocked-aware item under a world point. */
export function itemAt(
  items: BoardItem[],
  world: Point,
  opts: { includeLocked?: boolean; hiddenLayers?: number[] } = {},
): BoardItem | null {
  const hidden = new Set(opts.hiddenLayers ?? []);
  const hits = items.filter(i =>
    !hidden.has(i.layer)
    && (opts.includeLocked || !i.locked)
    && hitTest(i, world),
  );
  if (hits.length === 0) return null;
  return hits.reduce((top, i) => (i.z > top.z ? i : top), hits[0]);
}

export function nextZ(items: BoardItem[]): number {
  return items.reduce((max, i) => Math.max(max, i.z), 0) + 1;
}

export function fitViewport(
  items: BoardItem[],
  screenWidth: number,
  screenHeight: number,
  padding = 48,
): Viewport {
  if (items.length === 0) return DEFAULT_VIEWPORT;
  const b = itemsBounds(items);
  const usableW = Math.max(1, screenWidth - padding * 2);
  const usableH = Math.max(1, screenHeight - padding * 2);
  const zoom = clampZoom(Math.min(
    usableW / Math.max(1, b.width),
    usableH / Math.max(1, b.height),
  ));
  return {
    zoom,
    panX: padding + (usableW - b.width * zoom) / 2 - b.x * zoom,
    panY: padding + (usableH - b.height * zoom) / 2 - b.y * zoom,
  };
}

// ─── Selection & grouping ────────────────────────────────────────────────────

/** Every item that moves together with the given one. */
export function groupMembers(items: BoardItem[], item: BoardItem): BoardItem[] {
  if (!item.groupId) return [item];
  return items.filter(i => i.groupId === item.groupId);
}

export function newGroupId(): string {
  // Random enough for local grouping; ids never leave the device.
  return `g${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}

// ─── Resize ──────────────────────────────────────────────────────────────────

/**
 * New geometry after dragging a corner handle.
 *
 * The opposite corner stays pinned, and size is clamped so an item can never
 * be dragged inside-out or to zero.
 */
export function resizeItem(
  item: BoardItem,
  handle: Handle,
  world: Point,
  snapEnabled: boolean,
): { x: number; y: number; width: number; height: number } {
  const right = item.x + item.width;
  const bottom = item.y + item.height;
  const p = snapPoint(world, snapEnabled);

  let x = item.x, y = item.y, width = item.width, height = item.height;

  if (handle === 'se') {
    width = Math.max(MIN_ITEM_SIZE, p.x - item.x);
    height = Math.max(MIN_ITEM_SIZE, p.y - item.y);
  } else if (handle === 'ne') {
    width = Math.max(MIN_ITEM_SIZE, p.x - item.x);
    height = Math.max(MIN_ITEM_SIZE, bottom - p.y);
    y = bottom - height;
  } else if (handle === 'sw') {
    width = Math.max(MIN_ITEM_SIZE, right - p.x);
    height = Math.max(MIN_ITEM_SIZE, p.y - item.y);
    x = right - width;
  } else if (handle === 'nw') {
    width = Math.max(MIN_ITEM_SIZE, right - p.x);
    height = Math.max(MIN_ITEM_SIZE, bottom - p.y);
    x = right - width;
    y = bottom - height;
  }

  return { x, y, width, height };
}

/** Rotation in degrees from the item centre to a world point. */
export function rotationFor(item: BoardItem, world: Point, snapEnabled: boolean): number {
  const c = centerOf(item);
  const deg = (Math.atan2(world.y - c.y, world.x - c.x) * 180) / Math.PI + 90;
  const normalised = ((deg % 360) + 360) % 360;
  // Snapping to 15° makes clean diagrams achievable by hand.
  return snapEnabled ? Math.round(normalised / 15) * 15 : Math.round(normalised);
}

// ─── Alignment & distribution ────────────────────────────────────────────────

export type AlignMode =
  | 'left' | 'right' | 'hcenter'
  | 'top' | 'bottom' | 'vcenter'
  | 'hdistribute' | 'vdistribute';

/**
 * New positions for aligning or distributing a selection.
 *
 * Returns only the items that actually move, so callers can write a minimal
 * batch.
 */
export function alignItems(
  items: BoardItem[],
  mode: AlignMode,
): { id: string; x: number; y: number }[] {
  if (items.length < 2) return [];
  const b = itemsBounds(items);
  const out: { id: string; x: number; y: number }[] = [];

  if (mode === 'hdistribute' || mode === 'vdistribute') {
    const horizontal = mode === 'hdistribute';
    const sorted = [...items].sort((p, q) => (horizontal ? p.x - q.x : p.y - q.y));
    const totalSize = sorted.reduce(
      (sum, i) => sum + (horizontal ? Math.abs(i.width) : Math.abs(i.height)), 0,
    );
    const span = horizontal ? b.width : b.height;
    // Even gaps between items; negative gap means they overlap, which is fine.
    const gap = (span - totalSize) / Math.max(1, sorted.length - 1);

    let cursor = horizontal ? b.x : b.y;
    sorted.forEach(i => {
      out.push(horizontal ? { id: i.id, x: cursor, y: i.y } : { id: i.id, x: i.x, y: cursor });
      cursor += (horizontal ? Math.abs(i.width) : Math.abs(i.height)) + gap;
    });
    return out;
  }

  items.forEach(i => {
    const r = normalizeRect(i);
    // Offsets preserve a negative vector: we move the item, not reshape it.
    const offsetX = i.x - r.x;
    const offsetY = i.y - r.y;
    let x = r.x;
    let y = r.y;
    switch (mode) {
      case 'left': x = b.x; break;
      case 'right': x = b.x + b.width - r.width; break;
      case 'hcenter': x = b.x + (b.width - r.width) / 2; break;
      case 'top': y = b.y; break;
      case 'bottom': y = b.y + b.height - r.height; break;
      case 'vcenter': y = b.y + (b.height - r.height) / 2; break;
    }
    const nx = x + offsetX;
    const ny = y + offsetY;
    if (nx !== i.x || ny !== i.y) out.push({ id: i.id, x: nx, y: ny });
  });
  return out;
}

// ─── Layers ──────────────────────────────────────────────────────────────────

export function layersOf(items: BoardItem[], maxLayer = 0): BoardLayer[] {
  const highest = items.reduce((max, i) => Math.max(max, i.layer), maxLayer);
  const out: BoardLayer[] = [];
  for (let index = 0; index <= highest; index++) {
    out.push({
      index,
      name: index === 0 ? 'Base' : `Layer ${index + 1}`,
      visible: true,
      itemCount: items.filter(i => i.layer === index).length,
    });
  }
  return out;
}

// ─── Undo / redo ─────────────────────────────────────────────────────────────

export interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
}

/** Bounded so a long session can't grow memory without limit. */
export const HISTORY_LIMIT = 40;

export function pushHistory<T>(state: HistoryState<T>, next: T): HistoryState<T> {
  const past = [...state.past, state.present].slice(-HISTORY_LIMIT);
  // A new action invalidates anything that was undone.
  return { past, present: next, future: [] };
}

export function undo<T>(state: HistoryState<T>): HistoryState<T> {
  if (state.past.length === 0) return state;
  const previous = state.past[state.past.length - 1];
  return {
    past: state.past.slice(0, -1),
    present: previous,
    future: [state.present, ...state.future].slice(0, HISTORY_LIMIT),
  };
}

export function redo<T>(state: HistoryState<T>): HistoryState<T> {
  if (state.future.length === 0) return state;
  const next = state.future[0];
  return {
    past: [...state.past, state.present].slice(-HISTORY_LIMIT),
    present: next,
    future: state.future.slice(1),
  };
}

export function canUndo<T>(state: HistoryState<T>): boolean {
  return state.past.length > 0;
}

export function canRedo<T>(state: HistoryState<T>): boolean {
  return state.future.length > 0;
}

// ─── SVG export ──────────────────────────────────────────────────────────────

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Renders a board to standalone SVG.
 *
 * Vector output, unlike the PNG capture, covers the whole board rather than
 * the visible viewport — and stays sharp at any size.
 */
export function boardToSvg(
  items: BoardItem[],
  background: string,
  padding = 40,
): string {
  if (items.length === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">`
      + `<rect width="100" height="100" fill="${background}"/></svg>`;
  }

  const b = itemsBounds(items);
  const width = Math.max(1, Math.ceil(b.width + padding * 2));
  const height = Math.max(1, Math.ceil(b.height + padding * 2));
  const dx = padding - b.x;
  const dy = padding - b.y;

  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<rect width="${width}" height="${height}" fill="${background}"/>`,
    `<g transform="translate(${dx} ${dy})">`,
  ];

  [...items].sort((p, q) => p.layer - q.layer || p.z - q.z).forEach(i => {
    const c = centerOf(i);
    const rot = i.rotation
      ? ` transform="rotate(${i.rotation} ${c.x} ${c.y})"`
      : '';

    switch (i.kind) {
      case 'stroke': {
        const opacity = i.pen === 'highlighter' ? HIGHLIGHTER_OPACITY : 1;
        parts.push(
          `<path d="${strokePath(i.points)}" stroke="${i.color}" stroke-width="${i.strokeWidth}" `
          + `fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}"/>`,
        );
        break;
      }
      case 'rect':
        parts.push(
          `<rect x="${i.x}" y="${i.y}" width="${i.width}" height="${i.height}" rx="4" `
          + `fill="${i.fill ?? 'none'}" stroke="${i.color}" stroke-width="${i.strokeWidth}"${rot}/>`,
        );
        break;
      case 'circle':
        parts.push(
          `<ellipse cx="${c.x}" cy="${c.y}" rx="${i.width / 2}" ry="${i.height / 2}" `
          + `fill="${i.fill ?? 'none'}" stroke="${i.color}" stroke-width="${i.strokeWidth}"${rot}/>`,
        );
        break;
      case 'line':
      case 'arrow': {
        parts.push(
          `<line x1="${i.x}" y1="${i.y}" x2="${i.x + i.width}" y2="${i.y + i.height}" `
          + `stroke="${i.color}" stroke-width="${i.strokeWidth}" stroke-linecap="round"${rot}/>`,
        );
        if (i.kind === 'arrow') {
          const head = arrowHead(i);
          parts.push(
            `<polygon points="${head.map(p => `${p.x},${p.y}`).join(' ')}" fill="${i.color}"${rot}/>`,
          );
        }
        break;
      }
      case 'image':
        // Local file uris can't be inlined without base64; draw a placeholder
        // box so the layout still reads correctly.
        parts.push(
          `<rect x="${i.x}" y="${i.y}" width="${i.width}" height="${i.height}" `
          + `fill="#E5E7EB" stroke="#9CA3AF" stroke-width="1"${rot}/>`,
        );
        break;
      case 'note':
      case 'text': {
        if (i.kind === 'note') {
          parts.push(
            `<rect x="${i.x}" y="${i.y}" width="${i.width}" height="${i.height}" rx="6" `
            + `fill="${i.color}"${rot}/>`,
          );
        }
        const style = i.textStyle;
        const anchor = style.align === 'center' ? 'middle' : style.align === 'right' ? 'end' : 'start';
        const tx = style.align === 'center' ? c.x : style.align === 'right' ? i.x + i.width - 8 : i.x + 8;
        // Wrap by character count: SVG has no automatic text flow.
        const perLine = Math.max(8, Math.floor(i.width / (style.fontSize * 0.55)));
        const lines = wrapText(i.text, perLine);
        parts.push(`<g${rot}>`);
        lines.forEach((line, idx) => {
          parts.push(
            `<text x="${tx}" y="${i.y + style.fontSize * (idx + 1.2)}" `
            + `font-size="${style.fontSize}" fill="${i.kind === 'note' ? '#1F2937' : i.color}" `
            + `text-anchor="${anchor}" `
            + `font-weight="${style.bold ? 'bold' : 'normal'}" `
            + `font-style="${style.italic ? 'italic' : 'normal'}" `
            + `${style.underline ? 'text-decoration="underline" ' : ''}>`
            + `${escapeXml(line)}</text>`,
          );
        });
        parts.push('</g>');
        break;
      }
    }
  });

  parts.push('</g></svg>');
  return parts.join('\n');
}

/** Triangle points for an arrow's head. */
export function arrowHead(item: BoardItem): Point[] {
  const tip = { x: item.x + item.width, y: item.y + item.height };
  const angle = Math.atan2(item.height, item.width);
  const size = Math.max(10, item.strokeWidth * 3);
  return [
    tip,
    {
      x: tip.x - size * Math.cos(angle - Math.PI / 7),
      y: tip.y - size * Math.sin(angle - Math.PI / 7),
    },
    {
      x: tip.x - size * Math.cos(angle + Math.PI / 7),
      y: tip.y - size * Math.sin(angle + Math.PI / 7),
    },
  ];
}

export function wrapText(text: string, perLine: number): string[] {
  if (!text) return [];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  words.forEach(w => {
    if (!current) { current = w; return; }
    if ((current + ' ' + w).length <= perLine) current += ' ' + w;
    else { lines.push(current); current = w; }
  });
  if (current) lines.push(current);
  return lines;
}

// ─── Templates ───────────────────────────────────────────────────────────────

export type TemplateSeed = Omit<
  BoardItem,
  'id' | 'boardId' | 'createdAt' | 'updatedAt'
>;

function seed(over: Partial<TemplateSeed>): TemplateSeed {
  return {
    kind: 'note', x: 0, y: 0, width: NOTE_SIZE, height: NOTE_SIZE, rotation: 0,
    text: '', color: NOTE_COLORS[0], fill: null, points: [], strokeWidth: 3,
    pen: 'pen', uri: null, z: 1, layer: 0, locked: false, groupId: null,
    textStyle: { ...DEFAULT_TEXT_STYLE }, ...over,
  };
}

function label(text: string, x: number, y: number, size = 20): TemplateSeed {
  return seed({
    kind: 'text', x, y, width: 220, height: 40, text, color: '#1F2937',
    textStyle: { ...DEFAULT_TEXT_STYLE, fontSize: size, bold: true },
  });
}

export interface BoardTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  build: () => TemplateSeed[];
}

export const BOARD_TEMPLATES: BoardTemplate[] = [
  {
    id: 'brainstorm',
    name: 'Brainstorm',
    description: 'Central idea with radiating notes',
    icon: 'bulb-outline',
    build: () => {
      const cx = 320, cy = 300;
      const items: TemplateSeed[] = [
        seed({
          kind: 'circle', x: cx - 90, y: cy - 60, width: 180, height: 120,
          color: '#6366F1', fill: '#DDD6FE', strokeWidth: 3, z: 1,
        }),
        label('Main idea', cx - 60, cy - 14, 18),
      ];
      const spokes = [
        { x: cx - 300, y: cy - 240 }, { x: cx + 180, y: cy - 240 },
        { x: cx - 300, y: cy + 140 }, { x: cx + 180, y: cy + 140 },
      ];
      spokes.forEach((p, i) => {
        items.push(seed({
          x: p.x, y: p.y, color: NOTE_COLORS[i % NOTE_COLORS.length],
          text: `Idea ${i + 1}`, z: 2 + i,
        }));
        items.push(seed({
          kind: 'line',
          x: p.x + NOTE_SIZE / 2, y: p.y + NOTE_SIZE / 2,
          width: cx - (p.x + NOTE_SIZE / 2), height: cy - (p.y + NOTE_SIZE / 2),
          color: '#9CA3AF', strokeWidth: 2, z: 1,
        }));
      });
      return items;
    },
  },
  {
    id: 'kanban',
    name: 'Kanban',
    description: 'To do · Doing · Done columns',
    icon: 'albums-outline',
    build: () => {
      const cols = ['To do', 'Doing', 'Done'];
      const items: TemplateSeed[] = [];
      cols.forEach((name, i) => {
        const x = 60 + i * 260;
        items.push(seed({
          kind: 'rect', x, y: 60, width: 220, height: 560,
          color: '#9CA3AF', fill: '#F8FAFC', strokeWidth: 2, z: 1,
        }));
        items.push(label(name, x + 16, 76, 18));
        for (let k = 0; k < 2; k++) {
          items.push(seed({
            x: x + 30, y: 140 + k * 120, width: 160, height: 100,
            color: NOTE_COLORS[(i + k) % NOTE_COLORS.length],
            text: '', z: 3 + i * 2 + k,
          }));
        }
      });
      return items;
    },
  },
  {
    id: 'flowchart',
    name: 'Flowchart',
    description: 'Start, decision and outcomes',
    icon: 'git-branch-outline',
    build: () => [
      seed({
        kind: 'circle', x: 220, y: 60, width: 180, height: 90,
        color: '#10B981', fill: '#A7F3D0', z: 1,
      }),
      label('Start', 275, 92, 18),
      seed({
        kind: 'arrow', x: 310, y: 150, width: 0, height: 70,
        color: '#6B7280', strokeWidth: 3, z: 2,
      }),
      seed({
        kind: 'rect', x: 200, y: 220, width: 220, height: 110,
        color: '#F59E0B', fill: '#FEF3C7', z: 3,
      }),
      label('Decision?', 245, 262, 18),
      seed({
        kind: 'arrow', x: 200, y: 330, width: -110, height: 90,
        color: '#6B7280', strokeWidth: 3, z: 4,
      }),
      seed({
        kind: 'arrow', x: 420, y: 330, width: 110, height: 90,
        color: '#6B7280', strokeWidth: 3, z: 5,
      }),
      seed({
        kind: 'rect', x: 20, y: 420, width: 180, height: 90,
        color: '#0EA5E9', fill: '#BFDBFE', z: 6,
      }),
      label('Yes', 80, 452, 16),
      seed({
        kind: 'rect', x: 440, y: 420, width: 180, height: 90,
        color: '#EF4444', fill: '#FCA5A5', z: 7,
      }),
      label('No', 505, 452, 16),
    ],
  },
  {
    id: 'wireframe',
    name: 'Wireframe',
    description: 'Phone screen skeleton',
    icon: 'phone-portrait-outline',
    build: () => [
      seed({
        kind: 'rect', x: 120, y: 40, width: 300, height: 600,
        color: '#1F2937', fill: '#FFFFFF', strokeWidth: 3, z: 1,
      }),
      seed({
        kind: 'rect', x: 140, y: 70, width: 260, height: 60,
        color: '#9CA3AF', fill: '#E5E7EB', z: 2,
      }),
      label('Header', 160, 88, 16),
      seed({
        kind: 'rect', x: 140, y: 150, width: 260, height: 180,
        color: '#9CA3AF', fill: '#F3F4F6', z: 3,
      }),
      label('Hero', 160, 230, 16),
      seed({
        kind: 'rect', x: 140, y: 350, width: 260, height: 90,
        color: '#9CA3AF', fill: '#F3F4F6', z: 4,
      }),
      seed({
        kind: 'rect', x: 140, y: 460, width: 260, height: 90,
        color: '#9CA3AF', fill: '#F3F4F6', z: 5,
      }),
      seed({
        kind: 'rect', x: 140, y: 570, width: 260, height: 50,
        color: '#6366F1', fill: '#DDD6FE', z: 6,
      }),
      label('Tab bar', 160, 583, 14),
    ],
  },
  {
    id: 'bmc',
    name: 'Business Model Canvas',
    description: 'Nine-block strategy canvas',
    icon: 'grid-outline',
    build: () => {
      const blocks = [
        { t: 'Key Partners', x: 0, y: 0, w: 200, h: 240 },
        { t: 'Key Activities', x: 200, y: 0, w: 200, h: 120 },
        { t: 'Key Resources', x: 200, y: 120, w: 200, h: 120 },
        { t: 'Value Proposition', x: 400, y: 0, w: 200, h: 240 },
        { t: 'Customer Relationships', x: 600, y: 0, w: 200, h: 120 },
        { t: 'Channels', x: 600, y: 120, w: 200, h: 120 },
        { t: 'Customer Segments', x: 800, y: 0, w: 200, h: 240 },
        { t: 'Cost Structure', x: 0, y: 240, w: 500, h: 140 },
        { t: 'Revenue Streams', x: 500, y: 240, w: 500, h: 140 },
      ];
      const items: TemplateSeed[] = [];
      blocks.forEach((b, i) => {
        items.push(seed({
          kind: 'rect', x: 40 + b.x, y: 60 + b.y, width: b.w, height: b.h,
          color: '#9CA3AF', fill: '#FFFFFF', strokeWidth: 2, z: 1 + i,
        }));
        items.push(label(b.t, 52 + b.x, 72 + b.y, 14));
      });
      return items;
    },
  },
];
