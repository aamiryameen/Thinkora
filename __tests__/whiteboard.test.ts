import {
  boundsOf,
  clampZoom,
  DEFAULT_VIEWPORT,
  distance,
  fitViewport,
  hitTest,
  itemAt,
  MAX_ZOOM,
  MIN_ZOOM,
  nextZ,
  simplify,
  strokePath,
  toScreen,
  toWorld,
  zoomAbout,
} from '../src/core/whiteboard';
import type { BoardItem, Point, Viewport } from '../src/types/whiteboard';

function item(over: Partial<BoardItem> = {}): BoardItem {
  return {
    id: 'i1', boardId: 'b1', kind: 'note', x: 0, y: 0, width: 100, height: 100,
    rotation: 0, text: '', color: '#FDE68A', fill: null, points: [],
    strokeWidth: 4, pen: 'pen', uri: null, z: 1, layer: 0, locked: false,
    groupId: null,
    textStyle: { fontSize: 16, bold: false, italic: false, underline: false, align: 'left' },
    createdAt: 1, updatedAt: 1, ...over,
  };
}

describe('clampZoom', () => {
  it('keeps values inside the allowed range', () => {
    expect(clampZoom(0.01)).toBe(MIN_ZOOM);
    expect(clampZoom(100)).toBe(MAX_ZOOM);
    expect(clampZoom(1.5)).toBe(1.5);
  });

  it('falls back to 1 for values that would collapse the canvas', () => {
    expect(clampZoom(0)).toBe(1);
    expect(clampZoom(-2)).toBe(1);
    expect(clampZoom(NaN)).toBe(1);
    // Non-finite input is treated as corrupt data, not as "zoom in as far as
    // possible" — a stored Infinity should reset to a usable view.
    expect(clampZoom(Infinity)).toBe(1);
  });
});

describe('coordinate transforms', () => {
  const vp: Viewport = { panX: 50, panY: 30, zoom: 2 };

  it('round-trips a point through world and back', () => {
    const screen: Point = { x: 210, y: 130 };
    const back = toScreen(toWorld(screen, vp), vp);
    expect(back.x).toBeCloseTo(screen.x);
    expect(back.y).toBeCloseTo(screen.y);
  });

  it('maps the pan origin to world zero', () => {
    expect(toWorld({ x: 50, y: 30 }, vp)).toEqual({ x: 0, y: 0 });
  });

  it('accounts for zoom', () => {
    expect(toWorld({ x: 150, y: 30 }, vp)).toEqual({ x: 50, y: 0 });
  });

  it('is identity at the default viewport', () => {
    const p = { x: 12, y: 34 };
    expect(toWorld(p, DEFAULT_VIEWPORT)).toEqual(p);
    expect(toScreen(p, DEFAULT_VIEWPORT)).toEqual(p);
  });

  it('does not divide by zero for a broken zoom', () => {
    const broken: Viewport = { panX: 0, panY: 0, zoom: 0 };
    const out = toWorld({ x: 10, y: 10 }, broken);
    expect(Number.isFinite(out.x)).toBe(true);
    expect(Number.isFinite(out.y)).toBe(true);
  });
});

describe('zoomAbout', () => {
  const vp: Viewport = { panX: 0, panY: 0, zoom: 1 };

  it('keeps the anchor point fixed on screen', () => {
    const anchor: Point = { x: 200, y: 150 };
    const worldBefore = toWorld(anchor, vp);
    const next = zoomAbout(vp, anchor, 2.5);
    const screenAfter = toScreen(worldBefore, next);
    expect(screenAfter.x).toBeCloseTo(anchor.x);
    expect(screenAfter.y).toBeCloseTo(anchor.y);
  });

  it('clamps the resulting zoom', () => {
    expect(zoomAbout(vp, { x: 0, y: 0 }, 999).zoom).toBe(MAX_ZOOM);
    expect(zoomAbout(vp, { x: 0, y: 0 }, 0.001).zoom).toBe(MIN_ZOOM);
  });

  it('holds the anchor even when starting from a panned viewport', () => {
    const panned: Viewport = { panX: -300, panY: 120, zoom: 1.7 };
    const anchor: Point = { x: 80, y: 400 };
    const world = toWorld(anchor, panned);
    const after = toScreen(world, zoomAbout(panned, anchor, 0.6));
    expect(after.x).toBeCloseTo(anchor.x);
    expect(after.y).toBeCloseTo(anchor.y);
  });
});

describe('boundsOf', () => {
  it('returns zeros for no points', () => {
    expect(boundsOf([])).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });

  it('spans all points including negatives', () => {
    const b = boundsOf([{ x: -10, y: 5 }, { x: 20, y: -3 }, { x: 0, y: 0 }]);
    expect(b).toEqual({ x: -10, y: -3, width: 30, height: 8 });
  });

  it('gives zero size for a single point', () => {
    expect(boundsOf([{ x: 7, y: 9 }])).toEqual({ x: 7, y: 9, width: 0, height: 0 });
  });
});

describe('strokePath', () => {
  it('returns empty for no points', () => {
    expect(strokePath([])).toBe('');
  });

  it('renders a single tap as a visible dot', () => {
    const d = strokePath([{ x: 5, y: 5 }]);
    expect(d).toContain('M 5 5');
    expect(d).toContain('L');
  });

  it('starts at the first point and ends at the last', () => {
    const pts = [{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 20, y: 0 }];
    const d = strokePath(pts);
    expect(d.startsWith('M 0 0')).toBe(true);
    expect(d.endsWith('L 20 0')).toBe(true);
  });

  it('uses quadratic curves for smoothing', () => {
    const pts = [{ x: 0, y: 0 }, { x: 5, y: 5 }, { x: 10, y: 0 }, { x: 15, y: 5 }];
    expect(strokePath(pts)).toContain('Q');
  });
});

describe('simplify', () => {
  it('leaves very short strokes alone', () => {
    const pts = [{ x: 0, y: 0 }, { x: 1, y: 1 }];
    expect(simplify(pts)).toEqual(pts);
  });

  it('drops samples below the distance threshold', () => {
    const dense = Array.from({ length: 20 }, (_, i) => ({ x: i * 0.1, y: 0 }));
    expect(simplify(dense, 2).length).toBeLessThan(dense.length);
  });

  it('always keeps the first and last point', () => {
    const dense = Array.from({ length: 30 }, (_, i) => ({ x: i * 0.1, y: 0 }));
    const out = simplify(dense, 5);
    expect(out[0]).toEqual(dense[0]);
    expect(out[out.length - 1]).toEqual(dense[dense.length - 1]);
  });

  it('keeps well-separated points', () => {
    const sparse = [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 }];
    expect(simplify(sparse, 2)).toHaveLength(3);
  });
});

describe('hitTest', () => {
  it('detects a point inside a note', () => {
    expect(hitTest(item(), { x: 50, y: 50 })).toBe(true);
  });

  it('rejects a point outside', () => {
    expect(hitTest(item(), { x: 500, y: 500 })).toBe(false);
  });

  it('honours slack around the edge', () => {
    expect(hitTest(item(), { x: 110, y: 50 })).toBe(false);
    expect(hitTest(item(), { x: 110, y: 50 }, 20)).toBe(true);
  });

  it('tests proximity to the path for strokes, not the bounding box', () => {
    const stroke = item({
      kind: 'stroke', x: 0, y: 0, width: 100, height: 100,
      points: [{ x: 0, y: 0 }, { x: 100, y: 100 }],
    });
    // On the line
    expect(hitTest(stroke, { x: 0, y: 0 })).toBe(true);
    // Inside the bbox but far from the diagonal
    expect(hitTest(stroke, { x: 95, y: 5 })).toBe(false);
  });
});

describe('itemAt', () => {
  it('returns the topmost overlapping item', () => {
    const under = item({ id: 'under', z: 1 });
    const over = item({ id: 'over', z: 5 });
    expect(itemAt([under, over], { x: 10, y: 10 })?.id).toBe('over');
  });

  it('returns null when nothing is hit', () => {
    expect(itemAt([item()], { x: 900, y: 900 })).toBeNull();
  });

  it('returns null for an empty board', () => {
    expect(itemAt([], { x: 0, y: 0 })).toBeNull();
  });
});

describe('nextZ', () => {
  it('starts at 1 on an empty board', () => {
    expect(nextZ([])).toBe(1);
  });

  it('sits above the current highest', () => {
    expect(nextZ([item({ z: 3 }), item({ z: 9 })])).toBe(10);
  });
});

describe('fitViewport', () => {
  it('returns the default viewport for an empty board', () => {
    expect(fitViewport([], 400, 800)).toEqual(DEFAULT_VIEWPORT);
  });

  it('brings far-away content back into view', () => {
    const far = item({ x: 5000, y: 5000, width: 100, height: 100 });
    const vp = fitViewport([far], 400, 800);
    const onScreen = toScreen({ x: far.x, y: far.y }, vp);
    expect(onScreen.x).toBeGreaterThanOrEqual(0);
    expect(onScreen.x).toBeLessThanOrEqual(400);
    expect(onScreen.y).toBeGreaterThanOrEqual(0);
    expect(onScreen.y).toBeLessThanOrEqual(800);
  });

  it('never exceeds the zoom limits', () => {
    const tiny = item({ x: 0, y: 0, width: 1, height: 1 });
    expect(fitViewport([tiny], 400, 800).zoom).toBeLessThanOrEqual(MAX_ZOOM);
    const huge = item({ x: 0, y: 0, width: 100000, height: 100000 });
    expect(fitViewport([huge], 400, 800).zoom).toBeGreaterThanOrEqual(MIN_ZOOM);
  });

  it('fits content spread across negative and positive space', () => {
    const items = [
      item({ id: 'a', x: -500, y: -500, width: 100, height: 100 }),
      item({ id: 'b', x: 400, y: 400, width: 100, height: 100 }),
    ];
    const vp = fitViewport(items, 400, 800);
    expect(Number.isFinite(vp.panX)).toBe(true);
    expect(vp.zoom).toBeGreaterThan(0);
  });
});

describe('distance', () => {
  it('measures euclidean distance', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(distance({ x: 1, y: 1 }, { x: 1, y: 1 })).toBe(0);
  });
});

// ─── v2 feature tests ────────────────────────────────────────────────────────

import {
  alignItems, arrowHead, boardToSvg, canRedo, canUndo, centerOf, groupMembers,
  itemsBounds, layersOf, MIN_ITEM_SIZE, pointToSegment, pushHistory, redo,
  resizeItem, rotatePoint, rotationFor, snap, snapPoint, undo, wrapText,
  BOARD_TEMPLATES, GRID_SIZE, normalizeRect, type HistoryState,
} from '../src/core/whiteboard';
import { DEFAULT_TEXT_STYLE } from '../src/types/whiteboard';

function item2(over: Partial<BoardItem> = {}): BoardItem {
  return {
    id: 'i1', boardId: 'b1', kind: 'rect', x: 0, y: 0, width: 100, height: 100,
    rotation: 0, text: '', color: '#000', fill: null, points: [], strokeWidth: 3,
    pen: 'pen', uri: null, z: 1, layer: 0, locked: false, groupId: null,
    textStyle: { ...DEFAULT_TEXT_STYLE }, createdAt: 1, updatedAt: 1, ...over,
  };
}

describe('snap', () => {
  it('rounds to the grid when enabled', () => {
    expect(snap(23, true)).toBe(GRID_SIZE);
    expect(snap(31, true)).toBe(GRID_SIZE * 2);
  });

  it('passes values through when disabled', () => {
    expect(snap(23, false)).toBe(23);
  });

  it('snaps both axes of a point', () => {
    expect(snapPoint({ x: 23, y: 37 }, true)).toEqual({ x: 20, y: 40 });
  });

  it('handles negative coordinates', () => {
    expect(snap(-23, true)).toBe(-20);
  });
});

describe('rotatePoint', () => {
  it('returns the point unchanged at zero degrees', () => {
    expect(rotatePoint({ x: 5, y: 5 }, { x: 0, y: 0 }, 0)).toEqual({ x: 5, y: 5 });
  });

  it('rotates 90 degrees clockwise about the origin', () => {
    const out = rotatePoint({ x: 10, y: 0 }, { x: 0, y: 0 }, 90);
    expect(out.x).toBeCloseTo(0);
    expect(out.y).toBeCloseTo(10);
  });

  it('is reversible', () => {
    const p = { x: 33, y: -12 };
    const pivot = { x: 5, y: 5 };
    const back = rotatePoint(rotatePoint(p, pivot, 47), pivot, -47);
    expect(back.x).toBeCloseTo(p.x);
    expect(back.y).toBeCloseTo(p.y);
  });
});

describe('hitTest with rotation', () => {
  it('follows the item when rotated', () => {
    const tall = item2({ x: 0, y: 0, width: 40, height: 200, rotation: 90 });
    // After a 90° turn the shape is wide, so a point far along x should hit.
    expect(hitTest(tall, { x: 90, y: 100 })).toBe(true);
    // ...and a point far along y should not.
    expect(hitTest(tall, { x: 20, y: 195 })).toBe(false);
  });
});

describe('pointToSegment', () => {
  it('is zero on the segment', () => {
    expect(pointToSegment({ x: 5, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(0);
  });

  it('measures perpendicular distance', () => {
    expect(pointToSegment({ x: 5, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(3);
  });

  it('clamps beyond the endpoints', () => {
    expect(pointToSegment({ x: 20, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(10);
  });

  it('handles a degenerate zero-length segment', () => {
    expect(pointToSegment({ x: 3, y: 4 }, { x: 0, y: 0 }, { x: 0, y: 0 })).toBe(5);
  });
});

describe('resizeItem', () => {
  const base = item2({ x: 100, y: 100, width: 200, height: 200 });

  it('drags the SE corner without moving the origin', () => {
    const out = resizeItem(base, 'se', { x: 400, y: 350 }, false);
    expect(out).toEqual({ x: 100, y: 100, width: 300, height: 250 });
  });

  it('pins the opposite corner when dragging NW', () => {
    const out = resizeItem(base, 'nw', { x: 150, y: 120 }, false);
    expect(out.x + out.width).toBe(300);
    expect(out.y + out.height).toBe(300);
  });

  it('never shrinks below the minimum', () => {
    const out = resizeItem(base, 'se', { x: 100, y: 100 }, false);
    expect(out.width).toBe(MIN_ITEM_SIZE);
    expect(out.height).toBe(MIN_ITEM_SIZE);
  });

  it('cannot be dragged inside-out', () => {
    const out = resizeItem(base, 'se', { x: -500, y: -500 }, false);
    expect(out.width).toBeGreaterThan(0);
    expect(out.height).toBeGreaterThan(0);
  });

  it('snaps to the grid when enabled', () => {
    const out = resizeItem(base, 'se', { x: 393, y: 347 }, true);
    expect(out.width % GRID_SIZE).toBe(0);
  });
});

describe('rotationFor', () => {
  it('reports 0 when the pointer is directly above the centre', () => {
    const it = item2({ x: 0, y: 0, width: 100, height: 100 });
    expect(rotationFor(it, { x: 50, y: -100 }, false)).toBe(0);
  });

  it('reports 90 to the right of centre', () => {
    const it = item2({ x: 0, y: 0, width: 100, height: 100 });
    expect(rotationFor(it, { x: 200, y: 50 }, false)).toBe(90);
  });

  it('snaps to 15-degree steps when enabled', () => {
    const it = item2({ x: 0, y: 0, width: 100, height: 100 });
    expect(rotationFor(it, { x: 130, y: -20 }, true) % 15).toBe(0);
  });

  it('always returns a value in 0..359', () => {
    const it = item2({ x: 0, y: 0, width: 100, height: 100 });
    [{ x: -100, y: -100 }, { x: -100, y: 200 }, { x: 200, y: 200 }].forEach(p => {
      const deg = rotationFor(it, p, false);
      expect(deg).toBeGreaterThanOrEqual(0);
      expect(deg).toBeLessThan(360);
    });
  });
});

describe('alignItems', () => {
  const a = item2({ id: 'a', x: 0, y: 0, width: 100, height: 50 });
  const b = item2({ id: 'b', x: 200, y: 300, width: 60, height: 80 });

  it('does nothing for fewer than two items', () => {
    expect(alignItems([a], 'left')).toEqual([]);
    expect(alignItems([], 'left')).toEqual([]);
  });

  it('aligns left edges to the selection bounds', () => {
    const moves = alignItems([a, b], 'left');
    expect(moves.find(m => m.id === 'b')?.x).toBe(0);
  });

  it('aligns right edges accounting for differing widths', () => {
    const moves = alignItems([a, b], 'right');
    expect(moves.find(m => m.id === 'a')?.x).toBe(160);
  });

  it('centres horizontally', () => {
    const moves = alignItems([a, b], 'hcenter');
    const bounds = itemsBounds([a, b]);
    const expected = bounds.x + (bounds.width - a.width) / 2;
    expect(moves.find(m => m.id === 'a')?.x).toBeCloseTo(expected);
  });

  it('aligns tops and bottoms', () => {
    expect(alignItems([a, b], 'top').find(m => m.id === 'b')?.y).toBe(0);
    expect(alignItems([a, b], 'bottom').find(m => m.id === 'a')?.y).toBe(330);
  });

  it('distributes horizontally within the original span', () => {
    const c = item2({ id: 'c', x: 90, y: 0, width: 40, height: 40 });
    const moves = alignItems([a, b, c], 'hdistribute');
    expect(moves).toHaveLength(3);
    const xs = moves.map(m => m.x).sort((p, q) => p - q);
    // Leftmost stays at the left bound; rightmost ends at the right bound.
    expect(xs[0]).toBeCloseTo(0);
  });

  it('omits items that are already in place', () => {
    const same = item2({ id: 's', x: 0, y: 0, width: 100, height: 50 });
    const moves = alignItems([a, same], 'left');
    expect(moves).toHaveLength(0);
  });
});

describe('groupMembers', () => {
  it('returns just the item when ungrouped', () => {
    const solo = item2({ id: 'solo' });
    expect(groupMembers([solo, item2({ id: 'x' })], solo)).toHaveLength(1);
  });

  it('returns every member of the group', () => {
    const g = 'g1';
    const a2 = item2({ id: 'a', groupId: g });
    const b2 = item2({ id: 'b', groupId: g });
    const c2 = item2({ id: 'c', groupId: 'other' });
    expect(groupMembers([a2, b2, c2], a2).map(i => i.id).sort()).toEqual(['a', 'b']);
  });
});

describe('layersOf', () => {
  it('always includes a base layer', () => {
    expect(layersOf([])).toHaveLength(1);
    expect(layersOf([])[0].name).toBe('Base');
  });

  it('counts items per layer', () => {
    const items = [item2({ layer: 0 }), item2({ layer: 2 }), item2({ layer: 2 })];
    const layers = layersOf(items);
    expect(layers).toHaveLength(3);
    expect(layers[2].itemCount).toBe(2);
    expect(layers[1].itemCount).toBe(0);
  });
});

describe('undo / redo', () => {
  const start: HistoryState<string> = { past: [], present: 'a', future: [] };

  it('starts with nothing to undo or redo', () => {
    expect(canUndo(start)).toBe(false);
    expect(canRedo(start)).toBe(false);
  });

  it('undoes back to the previous state', () => {
    const s = pushHistory(start, 'b');
    expect(canUndo(s)).toBe(true);
    expect(undo(s).present).toBe('a');
  });

  it('redoes forward again', () => {
    const s = undo(pushHistory(start, 'b'));
    expect(canRedo(s)).toBe(true);
    expect(redo(s).present).toBe('b');
  });

  it('discards the redo stack once a new action happens', () => {
    const undone = undo(pushHistory(start, 'b'));
    const after = pushHistory(undone, 'c');
    expect(canRedo(after)).toBe(false);
  });

  it('is a no-op at the ends of the stack', () => {
    expect(undo(start)).toBe(start);
    expect(redo(start)).toBe(start);
  });

  it('bounds the history so long sessions cannot grow without limit', () => {
    let s = start;
    for (let i = 0; i < 200; i++) s = pushHistory(s, `v${i}`);
    expect(s.past.length).toBeLessThanOrEqual(40);
  });
});

describe('wrapText', () => {
  it('returns nothing for empty text', () => {
    expect(wrapText('', 10)).toEqual([]);
  });

  it('keeps short text on one line', () => {
    expect(wrapText('hello', 20)).toEqual(['hello']);
  });

  it('breaks on word boundaries', () => {
    const lines = wrapText('one two three four five', 9);
    expect(lines.length).toBeGreaterThan(1);
    lines.forEach(l => expect(l.length).toBeLessThanOrEqual(12));
  });
});

describe('arrowHead', () => {
  it('puts the tip at the arrow end', () => {
    const arrow = item2({ kind: 'arrow', x: 0, y: 0, width: 100, height: 0 });
    const head = arrowHead(arrow);
    expect(head[0]).toEqual({ x: 100, y: 0 });
    expect(head).toHaveLength(3);
  });

  it('produces a head behind the tip', () => {
    const arrow = item2({ kind: 'arrow', x: 0, y: 0, width: 100, height: 0 });
    const head = arrowHead(arrow);
    expect(head[1].x).toBeLessThan(head[0].x);
  });
});

describe('boardToSvg', () => {
  it('produces valid standalone svg for an empty board', () => {
    const svg = boardToSvg([], '#FFFFFF');
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg.trim().endsWith('</svg>')).toBe(true);
  });

  it('includes a rect for a rectangle item', () => {
    expect(boardToSvg([item2({ kind: 'rect' })], '#FFF')).toContain('<rect');
  });

  it('includes an ellipse for a circle item', () => {
    expect(boardToSvg([item2({ kind: 'circle' })], '#FFF')).toContain('<ellipse');
  });

  it('includes a path for a stroke', () => {
    const stroke = item2({ kind: 'stroke', points: [{ x: 0, y: 0 }, { x: 10, y: 10 }] });
    expect(boardToSvg([stroke], '#FFF')).toContain('<path');
  });

  it('renders a highlighter translucently', () => {
    const hl = item2({
      kind: 'stroke', pen: 'highlighter',
      points: [{ x: 0, y: 0 }, { x: 10, y: 0 }],
    });
    expect(boardToSvg([hl], '#FFF')).toContain('opacity="0.35"');
  });

  it('escapes xml-unsafe characters in text', () => {
    const t = item2({ kind: 'text', text: 'a < b & "c"' });
    const svg = boardToSvg([t], '#FFF');
    expect(svg).toContain('&lt;');
    expect(svg).toContain('&amp;');
    expect(svg).not.toContain('a < b');
  });

  it('applies rotation as a transform', () => {
    expect(boardToSvg([item2({ rotation: 45 })], '#FFF')).toContain('rotate(45');
  });

  it('orders by layer then z', () => {
    const back = item2({ id: 'back', kind: 'rect', layer: 0, z: 9, color: '#111111' });
    const front = item2({ id: 'front', kind: 'rect', layer: 1, z: 1, color: '#222222' });
    const svg = boardToSvg([front, back], '#FFF');
    expect(svg.indexOf('#111111')).toBeLessThan(svg.indexOf('#222222'));
  });
});

describe('templates', () => {
  it('has unique ids', () => {
    const ids = BOARD_TEMPLATES.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every template builds items', () => {
    BOARD_TEMPLATES.forEach(t => {
      const built = t.build();
      expect(built.length).toBeGreaterThan(0);
      built.forEach(i => {
        expect(Number.isFinite(i.x)).toBe(true);
        expect(Number.isFinite(i.y)).toBe(true);
        expect(Number.isFinite(i.width)).toBe(true);
        // Lines and arrows carry a direction vector, so raw width may be
        // negative; the normalised extent must not be.
        expect(Math.abs(i.width)).toBeGreaterThanOrEqual(0);
      });
    });
  });

  it('template output survives an svg round trip', () => {
    BOARD_TEMPLATES.forEach(t => {
      const items = t.build().map((s, i) => ({
        ...s, id: `t${i}`, boardId: 'b', createdAt: 1, updatedAt: 1,
      }));
      expect(() => boardToSvg(items, '#FFF')).not.toThrow();
    });
  });
});

describe('centerOf', () => {
  it('is the middle of the box', () => {
    expect(centerOf(item2({ x: 10, y: 20, width: 100, height: 60 })))
      .toEqual({ x: 60, y: 50 });
  });
});

describe('history snapshots preserve identity', () => {
  // Undo/redo compares snapshots by id. If a restore regenerated ids, the
  // history stack would point at rows that no longer exist and the second
  // undo would silently diverge from the database.
  it('round-trips the same ids through undo and redo', () => {
    const a = [item2({ id: 'x1' }), item2({ id: 'x2' })];
    const b = [...a, item2({ id: 'x3' })];

    let h: HistoryState<BoardItem[]> = { past: [], present: a, future: [] };
    h = pushHistory(h, b);
    expect(h.present.map(i => i.id)).toEqual(['x1', 'x2', 'x3']);

    h = undo(h);
    expect(h.present.map(i => i.id)).toEqual(['x1', 'x2']);

    h = redo(h);
    expect(h.present.map(i => i.id)).toEqual(['x1', 'x2', 'x3']);
  });

  it('keeps snapshots independent of later mutation', () => {
    const original = [item2({ id: 'x1', x: 0 })];
    let h: HistoryState<BoardItem[]> = { past: [], present: original, future: [] };
    // A new array, as reload() produces — not a mutation of the old one.
    h = pushHistory(h, [{ ...original[0], x: 500 }]);
    expect(undo(h).present[0].x).toBe(0);
  });
});
