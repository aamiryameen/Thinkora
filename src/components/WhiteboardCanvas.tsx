import React, { useMemo, useRef, useState } from 'react';
import { Image, PanResponder, StyleSheet, Text, View } from 'react-native';
import Svg, {
  Circle, Defs, Ellipse, G, Line, Path, Pattern, Polygon, Rect,
} from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';
import {
  arrowHead, centerOf, clampZoom, distance, GRID_SIZE, HIGHLIGHTER_OPACITY,
  itemAt, itemsBounds, midpoint, normalizeRect, resizeItem, rotationFor,
  simplify, snapPoint, strokePath, toScreen, toWorld, zoomAbout,
} from '../core/whiteboard';
import type {
  BoardBackgroundPattern, BoardItem, Handle, Point, Tool, Viewport,
} from '../types/whiteboard';

interface Props {
  items: BoardItem[];
  viewport: Viewport;
  onViewportChange: (vp: Viewport) => void;
  tool: Tool;
  strokeColor: string;
  strokeWidth: number;
  fillColor: string | null;
  noteColor: string;
  background: string;
  pattern: BoardBackgroundPattern;
  snapEnabled: boolean;
  hiddenLayers: number[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onStrokeEnd: (points: Point[]) => void;
  onCreateAt: (world: Point) => void;
  onCreateShape: (from: Point, to: Point) => void;
  onMoveItems: (moves: { id: string; x: number; y: number }[]) => void;
  onCommit: (ids: string[]) => void;
  onTransform: (id: string, patch: Partial<BoardItem>) => void;
  onEraseItem: (id: string) => void;
  onOpenItem: (item: BoardItem) => void;
}

type Mode = 'idle' | 'pan' | 'pinch' | 'draw' | 'drag' | 'resize' | 'rotate' | 'shape';

const HANDLE_SIZE = 11;

export function WhiteboardCanvas({
  items, viewport, onViewportChange, tool, strokeColor, strokeWidth, fillColor,
  noteColor, background, pattern, snapEnabled, hiddenLayers, selectedIds,
  onSelectionChange, onStrokeEnd, onCreateAt, onCreateShape, onMoveItems,
  onCommit, onTransform, onEraseItem, onOpenItem,
}: Props) {
  const { theme } = useTheme();

  const [draft, setDraft] = useState<Point[]>([]);
  const [shapeDraft, setShapeDraft] = useState<{ from: Point; to: Point } | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  // Gesture bookkeeping lives in refs: PanResponder callbacks are created once
  // and would otherwise close over stale state.
  const mode = useRef<Mode>('idle');
  const vpRef = useRef(viewport);
  vpRef.current = viewport;
  const startVp = useRef<Viewport>(viewport);
  const startPinch = useRef({ dist: 1, center: { x: 0, y: 0 } });
  const draftRef = useRef<Point[]>([]);
  const shapeRef = useRef<{ from: Point; to: Point } | null>(null);
  const dragRef = useRef<{ items: BoardItem[]; grabWorld: Point } | null>(null);
  const transformRef = useRef<{ item: BoardItem; handle: Handle } | null>(null);
  const movedRef = useRef(false);
  const toolRef = useRef(tool);
  toolRef.current = tool;
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const selectedRef = useRef(selectedIds);
  selectedRef.current = selectedIds;
  const hiddenRef = useRef(hiddenLayers);
  hiddenRef.current = hiddenLayers;
  const snapRef = useRef(snapEnabled);
  snapRef.current = snapEnabled;

  const visible = useMemo(
    () => items.filter(i => !hiddenLayers.includes(i.layer)),
    [hiddenLayers, items],
  );

  const selection = useMemo(
    () => visible.filter(i => selectedIds.includes(i.id)),
    [selectedIds, visible],
  );

  const touchesOf = (e: any): Point[] =>
    (e.nativeEvent.touches ?? []).map((t: any) => ({ x: t.locationX, y: t.locationY }));

  /** Which resize/rotate handle, if any, is under a screen point. */
  const handleAt = (screen: Point): { item: BoardItem; handle: Handle } | null => {
    const sel = itemsRef.current.filter(i => selectedRef.current.includes(i.id));
    if (sel.length !== 1) return null;
    const item = sel[0];
    if (item.locked) return null;

    const r = normalizeRect(item);
    const corners: { handle: Handle; world: Point }[] = [
      { handle: 'nw', world: { x: r.x, y: r.y } },
      { handle: 'ne', world: { x: r.x + r.width, y: r.y } },
      { handle: 'sw', world: { x: r.x, y: r.y + r.height } },
      { handle: 'se', world: { x: r.x + r.width, y: r.y + r.height } },
      { handle: 'rotate', world: { x: r.x + r.width / 2, y: r.y - 34 / clampZoom(vpRef.current.zoom) } },
    ];

    for (const c of corners) {
      if (distance(toScreen(c.world, vpRef.current), screen) <= HANDLE_SIZE + 9) {
        return { item, handle: c.handle };
      }
    }
    return null;
  };

  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,

    onPanResponderGrant: (e) => {
      const touches = touchesOf(e);
      movedRef.current = false;
      startVp.current = vpRef.current;

      if (touches.length >= 2) {
        mode.current = 'pinch';
        startPinch.current = {
          dist: Math.max(1, distance(touches[0], touches[1])),
          center: midpoint(touches[0], touches[1]),
        };
        return;
      }

      const screen = touches[0] ?? { x: 0, y: 0 };
      const world = toWorld(screen, vpRef.current);
      const t = toolRef.current;

      // Transform handles win over everything: they sit on top of the item.
      const handle = handleAt(screen);
      if (handle && (t === 'select' || t === 'pan')) {
        mode.current = handle.handle === 'rotate' ? 'rotate' : 'resize';
        transformRef.current = handle;
        return;
      }

      if (t === 'draw' || t === 'highlight') {
        mode.current = 'draw';
        draftRef.current = [world];
        setDraft([world]);
        return;
      }

      if (t === 'erase') {
        mode.current = 'idle';
        const hit = itemAt(itemsRef.current, world, { hiddenLayers: hiddenRef.current });
        if (hit) onEraseItem(hit.id);
        return;
      }

      if (t === 'note' || t === 'text') {
        mode.current = 'idle';
        onCreateAt(snapPoint(world, snapRef.current));
        return;
      }

      if (t === 'rect' || t === 'circle' || t === 'line' || t === 'arrow') {
        mode.current = 'shape';
        const start = snapPoint(world, snapRef.current);
        shapeRef.current = { from: start, to: start };
        setShapeDraft(shapeRef.current);
        return;
      }

      // select / pan: grab an item, else pan the canvas.
      const hit = itemAt(itemsRef.current, world, { hiddenLayers: hiddenRef.current });
      if (hit && !hit.locked) {
        // Dragging a grouped item drags the whole group.
        const group = hit.groupId
          ? itemsRef.current.filter(i => i.groupId === hit.groupId)
          : selectedRef.current.includes(hit.id)
            ? itemsRef.current.filter(i => selectedRef.current.includes(i.id))
            : [hit];

        mode.current = 'drag';
        dragRef.current = { items: group.map(i => ({ ...i })), grabWorld: world };
        onSelectionChange(group.map(i => i.id));
        return;
      }

      mode.current = 'pan';
      if (selectedRef.current.length > 0) onSelectionChange([]);
    },

    onPanResponderMove: (e, gesture) => {
      const touches = touchesOf(e);

      if (touches.length >= 2) {
        if (mode.current !== 'pinch') {
          mode.current = 'pinch';
          startVp.current = vpRef.current;
          startPinch.current = {
            dist: Math.max(1, distance(touches[0], touches[1])),
            center: midpoint(touches[0], touches[1]),
          };
          draftRef.current = [];
          setDraft([]);
          shapeRef.current = null;
          setShapeDraft(null);
          return;
        }
        const dist = Math.max(1, distance(touches[0], touches[1]));
        onViewportChange(zoomAbout(
          startVp.current,
          startPinch.current.center,
          startVp.current.zoom * (dist / startPinch.current.dist),
        ));
        return;
      }

      if (Math.abs(gesture.dx) > 3 || Math.abs(gesture.dy) > 3) movedRef.current = true;
      const screen = touches[0] ?? { x: 0, y: 0 };
      const world = toWorld(screen, vpRef.current);

      switch (mode.current) {
        case 'draw':
          draftRef.current = [...draftRef.current, world];
          setDraft(draftRef.current);
          return;

        case 'shape':
          if (shapeRef.current) {
            shapeRef.current = {
              from: shapeRef.current.from,
              to: snapPoint(world, snapRef.current),
            };
            setShapeDraft(shapeRef.current);
          }
          return;

        case 'resize': {
          const t = transformRef.current;
          if (!t) return;
          onTransform(t.item.id, resizeItem(t.item, t.handle, world, snapRef.current));
          return;
        }

        case 'rotate': {
          const t = transformRef.current;
          if (!t) return;
          onTransform(t.item.id, { rotation: rotationFor(t.item, world, snapRef.current) });
          return;
        }

        case 'drag': {
          const d = dragRef.current;
          if (!d) return;
          const dx = world.x - d.grabWorld.x;
          const dy = world.y - d.grabWorld.y;
          onMoveItems(d.items.map(i => {
            const p = snapPoint({ x: i.x + dx, y: i.y + dy }, snapRef.current);
            return { id: i.id, x: p.x, y: p.y };
          }));
          return;
        }

        case 'pan':
          onViewportChange({
            ...startVp.current,
            panX: startVp.current.panX + gesture.dx,
            panY: startVp.current.panY + gesture.dy,
          });
          return;
      }
    },

    onPanResponderRelease: () => {
      const m = mode.current;

      if (m === 'draw' && draftRef.current.length > 0) {
        onStrokeEnd(simplify(draftRef.current));
      }

      if (m === 'shape' && shapeRef.current) {
        const { from, to } = shapeRef.current;
        // A tap with no drag would create a zero-size shape.
        if (Math.abs(to.x - from.x) > 4 || Math.abs(to.y - from.y) > 4) {
          onCreateShape(from, to);
        }
      }

      if ((m === 'drag' || m === 'resize' || m === 'rotate') && movedRef.current) {
        // Report the ids this gesture touched: the screen's selection state may
        // not have re-rendered yet when the gesture started on a fresh item.
        const touched = m === 'drag'
          ? (dragRef.current?.items.map(i => i.id) ?? [])
          : transformRef.current ? [transformRef.current.item.id] : [];
        if (touched.length > 0) onCommit(touched);
      }

      // A tap with no drag opens the item for editing.
      if (m === 'drag' && !movedRef.current && dragRef.current?.items.length === 1) {
        const hit = itemsRef.current.find(i => i.id === dragRef.current!.items[0].id);
        if (hit && (hit.kind === 'note' || hit.kind === 'text')) onOpenItem(hit);
      }

      draftRef.current = [];
      setDraft([]);
      shapeRef.current = null;
      setShapeDraft(null);
      dragRef.current = null;
      transformRef.current = null;
      mode.current = 'idle';
    },

    onPanResponderTerminate: () => {
      draftRef.current = [];
      setDraft([]);
      shapeRef.current = null;
      setShapeDraft(null);
      dragRef.current = null;
      transformRef.current = null;
      mode.current = 'idle';
    },
  }), [
    onCommit, onCreateAt, onCreateShape, onEraseItem, onMoveItems, onOpenItem,
    onSelectionChange, onStrokeEnd, onTransform, onViewportChange,
  ]);

  const zoom = clampZoom(viewport.zoom);
  const isDark = background === '#1F2937';
  const gridColor = isDark ? '#374151' : '#E5E7EB';

  const strokes = useMemo(() => visible.filter(i => i.kind === 'stroke'), [visible]);
  const shapes = useMemo(
    () => visible.filter(i => ['rect', 'circle', 'line', 'arrow'].includes(i.kind))
      .sort((a, b) => a.layer - b.layer || a.z - b.z),
    [visible],
  );
  const blocks = useMemo(
    () => visible.filter(i => ['note', 'text', 'image'].includes(i.kind))
      .sort((a, b) => a.layer - b.layer || a.z - b.z),
    [visible],
  );

  const selBounds = selection.length > 0 ? itemsBounds(selection) : null;
  const single = selection.length === 1 && !selection[0].locked ? selection[0] : null;

  const styles = useMemo(() => StyleSheet.create({
    root: { flex: 1, overflow: 'hidden', backgroundColor: background },
    note: {
      position: 'absolute',
      borderRadius: 6,
      padding: 8,
      shadowColor: '#000',
      shadowOpacity: 0.18,
      shadowOffset: { width: 0, height: 3 },
      shadowRadius: 5,
      elevation: 4,
    },
    textBox: { position: 'absolute', padding: 4 },
    image: { position: 'absolute', borderRadius: 6 },
    lockBadge: {
      position: 'absolute',
      alignItems: 'center', justifyContent: 'center',
    },
  }), [background]);

  /** Renders the shape draft while the user is still dragging it out. */
  const draftShape = () => {
    if (!shapeDraft) return null;
    const a = toScreen(shapeDraft.from, viewport);
    const b = toScreen(shapeDraft.to, viewport);
    const x = Math.min(a.x, b.x);
    const y = Math.min(a.y, b.y);
    const w = Math.abs(b.x - a.x);
    const h = Math.abs(b.y - a.y);
    const sw = strokeWidth * zoom;

    if (tool === 'rect') {
      return (
        <Rect x={x} y={y} width={w} height={h} rx={4}
          stroke={strokeColor} strokeWidth={sw} fill={fillColor ?? 'none'} opacity={0.8} />
      );
    }
    if (tool === 'circle') {
      return (
        <Ellipse cx={x + w / 2} cy={y + h / 2} rx={w / 2} ry={h / 2}
          stroke={strokeColor} strokeWidth={sw} fill={fillColor ?? 'none'} opacity={0.8} />
      );
    }
    return (
      <Line x1={a.x} y1={a.y} x2={b.x} y2={b.y}
        stroke={strokeColor} strokeWidth={sw} strokeLinecap="round" opacity={0.8} />
    );
  };

  return (
    <View
      style={styles.root}
      onLayout={e => setSize({
        width: e.nativeEvent.layout.width,
        height: e.nativeEvent.layout.height,
      })}
      {...responder.panHandlers}
    >
      {/* One SVG layer for the background pattern, strokes, shapes and the
          selection chrome — a view per item would be hundreds of native views. */}
      <Svg style={StyleSheet.absoluteFill} width={size.width} height={size.height}>
        {pattern !== 'plain' && (
          <>
            <Defs>
              <Pattern
                id="bg"
                x={viewport.panX % (GRID_SIZE * zoom)}
                y={viewport.panY % (GRID_SIZE * zoom)}
                width={GRID_SIZE * zoom}
                height={GRID_SIZE * zoom}
                patternUnits="userSpaceOnUse"
              >
                {pattern === 'grid' && (
                  <Path
                    d={`M ${GRID_SIZE * zoom} 0 L 0 0 0 ${GRID_SIZE * zoom}`}
                    stroke={gridColor} strokeWidth={1} fill="none"
                  />
                )}
                {pattern === 'dots' && (
                  <Circle cx={1} cy={1} r={1.4} fill={gridColor} />
                )}
                {pattern === 'lines' && (
                  <Path
                    d={`M 0 0 L ${GRID_SIZE * zoom} 0`}
                    stroke={gridColor} strokeWidth={1} fill="none"
                  />
                )}
              </Pattern>
            </Defs>
            <Rect x={0} y={0} width={size.width} height={size.height} fill="url(#bg)" />
          </>
        )}

        {shapes.map(s => {
          const a = toScreen({ x: s.x, y: s.y }, viewport);
          const b = toScreen({ x: s.x + s.width, y: s.y + s.height }, viewport);
          const r = normalizeRect(s);
          const p = toScreen({ x: r.x, y: r.y }, viewport);
          const w = r.width * zoom;
          const h = r.height * zoom;
          const c = toScreen(centerOf(s), viewport);
          const rot = s.rotation ? `rotate(${s.rotation} ${c.x} ${c.y})` : undefined;
          const sw = Math.max(1, s.strokeWidth * zoom);
          const dim = selectedIds.includes(s.id) ? 0.75 : 1;

          if (s.kind === 'rect') {
            return (
              <Rect key={s.id} x={p.x} y={p.y} width={w} height={h} rx={4}
                stroke={s.color} strokeWidth={sw} fill={s.fill ?? 'none'}
                transform={rot} opacity={dim} />
            );
          }
          if (s.kind === 'circle') {
            return (
              <Ellipse key={s.id} cx={p.x + w / 2} cy={p.y + h / 2} rx={w / 2} ry={h / 2}
                stroke={s.color} strokeWidth={sw} fill={s.fill ?? 'none'}
                transform={rot} opacity={dim} />
            );
          }
          return (
            <G key={s.id} transform={rot} opacity={dim}>
              <Line x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke={s.color} strokeWidth={sw} strokeLinecap="round" />
              {s.kind === 'arrow' && (
                <Polygon
                  points={arrowHead(s)
                    .map(pt => toScreen(pt, viewport))
                    .map(pt => `${pt.x},${pt.y}`)
                    .join(' ')}
                  fill={s.color}
                />
              )}
            </G>
          );
        })}

        {strokes.map(s => (
          <Path
            key={s.id}
            d={strokePath(s.points.map(p => toScreen(p, viewport)))}
            stroke={s.color}
            strokeWidth={Math.max(1, s.strokeWidth * zoom)}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            opacity={
              (s.pen === 'highlighter' ? HIGHLIGHTER_OPACITY : 1)
              * (selectedIds.includes(s.id) ? 0.6 : 1)
            }
          />
        ))}

        {draft.length > 0 && (
          <Path
            d={strokePath(draft.map(p => toScreen(p, viewport)))}
            stroke={strokeColor}
            strokeWidth={Math.max(1, strokeWidth * zoom)}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            opacity={tool === 'highlight' ? HIGHLIGHTER_OPACITY : 1}
          />
        )}

        {draftShape()}

        {/* Selection outline and transform handles */}
        {selBounds && (() => {
          const p = toScreen({ x: selBounds.x, y: selBounds.y }, viewport);
          const w = selBounds.width * zoom;
          const h = selBounds.height * zoom;
          return (
            <>
              <Rect
                x={p.x - 4} y={p.y - 4} width={w + 8} height={h + 8}
                stroke={theme.colors.primary} strokeWidth={1.5}
                strokeDasharray="6 4" fill="none"
              />
              {single && [
                { x: p.x, y: p.y },
                { x: p.x + w, y: p.y },
                { x: p.x, y: p.y + h },
                { x: p.x + w, y: p.y + h },
              ].map((c, idx) => (
                <Rect
                  key={idx}
                  x={c.x - HANDLE_SIZE / 2} y={c.y - HANDLE_SIZE / 2}
                  width={HANDLE_SIZE} height={HANDLE_SIZE} rx={2}
                  fill="#FFF" stroke={theme.colors.primary} strokeWidth={1.5}
                />
              ))}
              {single && (
                <>
                  <Line
                    x1={p.x + w / 2} y1={p.y - 4}
                    x2={p.x + w / 2} y2={p.y - 34}
                    stroke={theme.colors.primary} strokeWidth={1.5}
                  />
                  <Circle
                    cx={p.x + w / 2} cy={p.y - 34} r={HANDLE_SIZE / 2 + 1}
                    fill="#FFF" stroke={theme.colors.primary} strokeWidth={1.5}
                  />
                </>
              )}
            </>
          );
        })()}
      </Svg>

      {blocks.map(item => {
        const r = normalizeRect(item);
        const pos = toScreen({ x: r.x, y: r.y }, viewport);
        const w = r.width * zoom;
        const h = r.height * zoom;

        // Skip anything fully off-screen: an infinite canvas holds far more
        // than is ever visible at once.
        if (
          size.width > 0
          && (pos.x + w < -60 || pos.y + h < -60
            || pos.x > size.width + 60 || pos.y > size.height + 60)
        ) return null;

        const selected = selectedIds.includes(item.id);
        const rotate = item.rotation ? [{ rotate: `${item.rotation}deg` }] : [];
        const style = item.textStyle;

        if (item.kind === 'image' && item.uri) {
          return (
            <Image
              key={item.id}
              source={{ uri: item.uri }}
              style={[
                styles.image,
                { left: pos.x, top: pos.y, width: w, height: h, transform: rotate },
                selected && { opacity: 0.85 },
              ]}
              resizeMode="cover"
            />
          );
        }

        const isNote = item.kind === 'note';
        return (
          <View
            key={item.id}
            style={[
              isNote ? styles.note : styles.textBox,
              {
                left: pos.x, top: pos.y, width: w, height: h,
                transform: rotate,
                ...(isNote ? { backgroundColor: item.color } : null),
              },
            ]}
            pointerEvents="none"
          >
            <Text
              style={{
                color: isNote ? '#1F2937' : item.color,
                fontSize: Math.max(7, style.fontSize * zoom),
                fontWeight: style.bold ? '800' : '600',
                fontStyle: style.italic ? 'italic' : 'normal',
                textDecorationLine: style.underline ? 'underline' : 'none',
                textAlign: style.align,
              }}
              numberOfLines={Math.max(1, Math.floor(h / Math.max(1, style.fontSize * zoom * 1.3)))}
            >
              {item.text || (isNote ? 'Tap to edit' : 'Text')}
            </Text>
            {item.locked && (
              <View style={[styles.lockBadge, { right: 2, top: 2 }]}>
                <Text style={{ fontSize: Math.max(8, 10 * zoom) }}>🔒</Text>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}
