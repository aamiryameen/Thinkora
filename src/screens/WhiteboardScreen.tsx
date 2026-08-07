import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Dimensions, Modal, ScrollView, StyleSheet, Switch,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import ViewShot from 'react-native-view-shot';
import type { RootStackParamList } from '../navigation/types';
import { useTheme } from '../context/ThemeContext';
import { usePremium, type PremiumFeature } from '../services/premiumService';
import { PremiumGateSheet } from '../components/PremiumGateSheet';
import { WhiteboardCanvas } from '../components/WhiteboardCanvas';
import * as svc from '../services/whiteboardService';
import { pickImageFromGallery, takePhoto } from '../services/attachmentService';
import {
  alignItems, BOARD_BACKGROUNDS, canRedo, canUndo, clampZoom, fitViewport,
  FREE_IMAGE_LIMIT, FREE_LAYER_LIMIT, HIGHLIGHTER_WIDTH, itemsBounds, layersOf,
  MAX_ZOOM, MIN_ZOOM, newGroupId, NOTE_COLORS, NOTE_SIZE, pushHistory, redo,
  STROKE_COLORS, STROKE_WIDTHS, undo, zoomAbout,
  type AlignMode, type HistoryState,
} from '../core/whiteboard';
import {
  DEFAULT_TEXT_STYLE,
  type Board, type BoardBackgroundPattern, type BoardItem, type Point,
  type TextStyle, type Tool,
} from '../types/whiteboard';

type Route = RouteProp<RootStackParamList, 'Whiteboard'>;

const TOOLS: { value: Tool; icon: string; label: string }[] = [
  { value: 'select', icon: 'move-outline', label: 'Select' },
  { value: 'draw', icon: 'brush-outline', label: 'Pen' },
  { value: 'highlight', icon: 'color-wand-outline', label: 'Marker' },
  { value: 'erase', icon: 'trash-outline', label: 'Erase' },
  { value: 'note', icon: 'square-outline', label: 'Note' },
  { value: 'text', icon: 'text-outline', label: 'Text' },
  { value: 'rect', icon: 'tablet-landscape-outline', label: 'Rect' },
  { value: 'circle', icon: 'ellipse-outline', label: 'Circle' },
  { value: 'arrow', icon: 'arrow-forward-outline', label: 'Arrow' },
  { value: 'line', icon: 'remove-outline', label: 'Line' },
];

const PATTERNS: { value: BoardBackgroundPattern; label: string; icon: string }[] = [
  { value: 'plain', label: 'Plain', icon: 'square-outline' },
  { value: 'grid', label: 'Grid', icon: 'grid-outline' },
  { value: 'dots', label: 'Dots', icon: 'apps-outline' },
  { value: 'lines', label: 'Lines', icon: 'reorder-four-outline' },
];

const ALIGNMENTS: { mode: AlignMode; icon: string; label: string }[] = [
  { mode: 'left', icon: 'arrow-back-outline', label: 'Left' },
  { mode: 'hcenter', icon: 'swap-horizontal-outline', label: 'Center' },
  { mode: 'right', icon: 'arrow-forward-outline', label: 'Right' },
  { mode: 'top', icon: 'arrow-up-outline', label: 'Top' },
  { mode: 'vcenter', icon: 'swap-vertical-outline', label: 'Middle' },
  { mode: 'bottom', icon: 'arrow-down-outline', label: 'Bottom' },
  { mode: 'hdistribute', icon: 'ellipsis-horizontal-outline', label: 'Dist H' },
  { mode: 'vdistribute', icon: 'ellipsis-vertical-outline', label: 'Dist V' },
];

export function WhiteboardScreen() {
  const nav = useNavigation();
  const route = useRoute<Route>();
  const boardId = route.params?.boardId;
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { hasPremium } = usePremium();

  const [board, setBoard] = useState<Board | null>(null);
  const [history, setHistory] = useState<HistoryState<BoardItem[]>>({
    past: [], present: [], future: [],
  });
  const items = history.present;
  const [loading, setLoading] = useState(true);
  const [unlocked, setUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState('');

  const [viewport, setViewport] = useState({ panX: 0, panY: 0, zoom: 1 });
  const [tool, setTool] = useState<Tool>('select');
  const [strokeColor, setStrokeColor] = useState(STROKE_COLORS[0]);
  const [strokeWidth, setStrokeWidth] = useState(STROKE_WIDTHS[1]);
  const [fillColor, setFillColor] = useState<string | null>(null);
  const [noteColor, setNoteColor] = useState(NOTE_COLORS[0]);
  const [snapEnabled, setSnapEnabled] = useState(false);
  const [activeLayer, setActiveLayer] = useState(0);
  const [hiddenLayers, setHiddenLayers] = useState<number[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [editing, setEditing] = useState<BoardItem | null>(null);
  const [editText, setEditText] = useState('');
  const [editStyle, setEditStyle] = useState<TextStyle>({ ...DEFAULT_TEXT_STYLE });
  const [sheet, setSheet] = useState<null | 'palette' | 'layers' | 'align' | 'export' | 'versions' | 'more'>(null);
  const [versions, setVersions] = useState<svc.BoardVersion[] | null>(null);
  const [presenting, setPresenting] = useState(false);
  const [gateFeature, setGateFeature] = useState<PremiumFeature | null>(null);
  const [busy, setBusy] = useState(false);

  const shotRef = useRef<any>(null);
  const vpRef = useRef(viewport);
  vpRef.current = viewport;
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // ─── Load & persist ────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!boardId) { setLoading(false); return; }
    try {
      const [boards, list] = await Promise.all([svc.getBoards(true), svc.getItems(boardId)]);
      const found = boards.find(b => b.id === boardId) ?? null;
      setBoard(found);
      setHistory({ past: [], present: list, future: [] });
      if (found) {
        setViewport({ panX: found.panX, panY: found.panY, zoom: clampZoom(found.zoom) });
        setUnlocked(!found.passcode);
      }
    } catch { /* leaves an empty board */ } finally {
      setLoading(false);
    }
  }, [boardId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => () => {
    if (boardId) svc.saveViewport(boardId, vpRef.current).catch(() => {});
  }, [boardId]);

  /** Reloads from the DB and records the result as a new history step. */
  const reload = useCallback(async (recordHistory = true) => {
    if (!boardId) return;
    try {
      const list = await svc.getItems(boardId);
      setHistory(h => (recordHistory ? pushHistory(h, list) : { ...h, present: list }));
    } catch { /* keep current */ }
  }, [boardId]);

  // ─── Item creation ─────────────────────────────────────────────────────────

  const handleStrokeEnd = useCallback(async (points: Point[]) => {
    if (!boardId || points.length === 0) return;
    const isMarker = tool === 'highlight';
    try {
      await svc.addItem(
        boardId,
        svc.strokeItem(
          points,
          strokeColor,
          isMarker ? HIGHLIGHTER_WIDTH : strokeWidth,
          isMarker ? 'highlighter' : 'pen',
          activeLayer,
        ),
        itemsRef.current,
      );
      await reload();
    } catch { /* stroke lost rather than crashing */ }
  }, [activeLayer, boardId, reload, strokeColor, strokeWidth, tool]);

  const handleCreateAt = useCallback(async (world: Point) => {
    if (!boardId) return;
    const isText = tool === 'text';
    try {
      await svc.addItem(boardId, {
        kind: isText ? 'text' : 'note',
        x: world.x - (isText ? 90 : NOTE_SIZE / 2),
        y: world.y - (isText ? 18 : NOTE_SIZE / 2),
        width: isText ? 180 : NOTE_SIZE,
        height: isText ? 40 : NOTE_SIZE,
        rotation: 0,
        text: '',
        color: isText ? (board?.background === '#1F2937' ? '#F9FAFB' : '#1F2937') : noteColor,
        fill: null, points: [], strokeWidth: 0, pen: 'pen', uri: null,
        layer: activeLayer, locked: false, groupId: null,
        textStyle: { ...DEFAULT_TEXT_STYLE },
      }, itemsRef.current);
      await reload();
      setTool('select');
    } catch { /* ignore */ }
  }, [activeLayer, board?.background, boardId, noteColor, reload, tool]);

  const handleCreateShape = useCallback(async (from: Point, to: Point) => {
    if (!boardId) return;
    const isLinear = tool === 'line' || tool === 'arrow';
    try {
      await svc.addItem(boardId, {
        kind: tool as 'rect' | 'circle' | 'line' | 'arrow',
        // Lines keep the drag direction; boxes are normalised.
        x: isLinear ? from.x : Math.min(from.x, to.x),
        y: isLinear ? from.y : Math.min(from.y, to.y),
        width: isLinear ? to.x - from.x : Math.abs(to.x - from.x),
        height: isLinear ? to.y - from.y : Math.abs(to.y - from.y),
        rotation: 0, text: '', color: strokeColor,
        fill: isLinear ? null : fillColor,
        points: [], strokeWidth, pen: 'pen', uri: null,
        layer: activeLayer, locked: false, groupId: null,
        textStyle: { ...DEFAULT_TEXT_STYLE },
      }, itemsRef.current);
      await reload();
      setTool('select');
    } catch { /* ignore */ }
  }, [activeLayer, boardId, fillColor, reload, strokeColor, strokeWidth, tool]);

  const addImage = useCallback(async (fromCamera: boolean) => {
    if (!boardId) return;
    const imageCount = itemsRef.current.filter(i => i.kind === 'image').length;
    if (!hasPremium && imageCount >= FREE_IMAGE_LIMIT) {
      setGateFeature('whiteboard_images');
      return;
    }
    try {
      const picked = fromCamera ? await takePhoto() : await pickImageFromGallery();
      if (!picked?.uri) return;
      const { width: sw, height: sh } = Dimensions.get('window');
      const zoom = clampZoom(vpRef.current.zoom);
      const centre = {
        x: (sw / 2 - vpRef.current.panX) / zoom,
        y: (sh / 2 - vpRef.current.panY) / zoom,
      };
      const size = 220;
      await svc.addItem(boardId, {
        kind: 'image',
        x: centre.x - size / 2, y: centre.y - size / 2,
        width: size, height: size, rotation: 0,
        text: '', color: '#00000000', fill: null, points: [],
        strokeWidth: 0, pen: 'pen', uri: picked.uri,
        layer: activeLayer, locked: false, groupId: null,
        textStyle: { ...DEFAULT_TEXT_STYLE },
      }, itemsRef.current);
      await reload();
    } catch { /* picker cancelled */ }
  }, [activeLayer, boardId, hasPremium, reload]);

  // ─── Transform ─────────────────────────────────────────────────────────────

  /** Live local updates during a gesture; the DB write happens on commit. */
  const handleMoveItems = useCallback((moves: { id: string; x: number; y: number }[]) => {
    const byId = new Map(moves.map(m => [m.id, m]));
    setHistory(h => ({
      ...h,
      present: h.present.map(i => {
        const m = byId.get(i.id);
        return m ? { ...i, x: m.x, y: m.y } : i;
      }),
    }));
  }, []);

  const handleTransform = useCallback((id: string, patch: Partial<BoardItem>) => {
    setHistory(h => ({
      ...h,
      present: h.present.map(i => (i.id === id ? { ...i, ...patch } : i)),
    }));
  }, []);

  /** Writes whatever the gesture left in local state. */
  const commitGesture = useCallback(async (ids: string[]) => {
    const dirty = itemsRef.current.filter(i => ids.includes(i.id));
    if (dirty.length === 0) return;
    try {
      await svc.updateItems(dirty.map(i => ({
        id: i.id,
        patch: {
          x: i.x, y: i.y, width: i.width, height: i.height, rotation: i.rotation,
        },
      })));
      await reload();
    } catch { /* ignore */ }
  }, [reload]);

  // ─── Selection actions ─────────────────────────────────────────────────────

  const selection = useMemo(
    () => items.filter(i => selectedIds.includes(i.id)),
    [items, selectedIds],
  );

  const patchSelection = useCallback(async (patch: svc.ItemPatch) => {
    if (selection.length === 0) return;
    try {
      await svc.updateItems(selection.map(i => ({ id: i.id, patch })));
      await reload();
    } catch { /* ignore */ }
  }, [reload, selection]);

  const deleteSelection = useCallback(async () => {
    const unlockedIds = selection.filter(i => !i.locked).map(i => i.id);
    if (unlockedIds.length === 0) return;
    setSelectedIds([]);
    try { await svc.deleteItems(unlockedIds); await reload(); } catch { /* ignore */ }
  }, [reload, selection]);

  const duplicateSelection = useCallback(async () => {
    if (!boardId || selection.length === 0) return;
    const group = selection.length > 1 ? newGroupId() : null;
    try {
      await svc.addItems(boardId, selection.map(i => ({
        kind: i.kind, x: i.x + 24, y: i.y + 24, width: i.width, height: i.height,
        rotation: i.rotation, text: i.text, color: i.color, fill: i.fill,
        points: i.points.map(p => ({ x: p.x + 24, y: p.y + 24 })),
        strokeWidth: i.strokeWidth, pen: i.pen, uri: i.uri,
        layer: i.layer, locked: false, groupId: group,
        textStyle: i.textStyle,
      })));
      await reload();
    } catch { /* ignore */ }
  }, [boardId, reload, selection]);

  const toggleGroup = useCallback(async () => {
    if (selection.length < 2) return;
    const alreadyGrouped = selection.every(i => i.groupId && i.groupId === selection[0].groupId);
    await patchSelection({ groupId: alreadyGrouped ? null : newGroupId() });
  }, [patchSelection, selection]);

  const toggleLock = useCallback(async () => {
    if (selection.length === 0) return;
    const allLocked = selection.every(i => i.locked);
    await patchSelection({ locked: !allLocked });
    setSelectedIds([]);
  }, [patchSelection, selection]);

  const applyAlign = useCallback(async (mode: AlignMode) => {
    if (!hasPremium) { setGateFeature('whiteboard_align'); return; }
    const moves = alignItems(selection, mode);
    if (moves.length === 0) return;
    try {
      await svc.updateItems(moves.map(m => ({ id: m.id, patch: { x: m.x, y: m.y } })));
      await reload();
    } catch { /* ignore */ }
  }, [hasPremium, reload, selection]);

  // ─── Text editing ──────────────────────────────────────────────────────────

  const openItem = useCallback((item: BoardItem) => {
    setEditing(item);
    setEditText(item.text);
    setEditStyle(item.textStyle);
  }, []);

  const saveText = useCallback(async () => {
    if (!editing) return;
    const target = editing;
    setEditing(null);
    try {
      await svc.updateItem(target.id, {
        text: editText.trim(),
        textStyle: editStyle,
        ...(target.kind === 'note' ? { color: noteColor } : {}),
      });
      await reload();
    } catch { /* ignore */ }
  }, [editStyle, editText, editing, noteColor, reload]);

  // ─── Undo / redo ───────────────────────────────────────────────────────────

  /**
   * Undo rewrites the board to the previous snapshot. Cheap for the sizes a
   * phone board reaches, and far simpler than an inverse-operation log.
   */
  const applyUndo = useCallback(async () => {
    if (!boardId || !canUndo(history)) return;
    const next = undo(history);
    setHistory(next);
    setSelectedIds([]);
    try { await svc.replaceItems(boardId, next.present); await reload(false); } catch { /* ignore */ }
  }, [boardId, history, reload]);

  const applyRedo = useCallback(async () => {
    if (!boardId || !canRedo(history)) return;
    const next = redo(history);
    setHistory(next);
    setSelectedIds([]);
    try { await svc.replaceItems(boardId, next.present); await reload(false); } catch { /* ignore */ }
  }, [boardId, history, reload]);

  // ─── Layers ────────────────────────────────────────────────────────────────

  const layers = useMemo(() => layersOf(items, activeLayer), [activeLayer, items]);

  const addLayer = useCallback(() => {
    if (!hasPremium && layers.length >= FREE_LAYER_LIMIT) {
      setGateFeature('whiteboard_layers');
      return;
    }
    setActiveLayer(layers.length);
  }, [hasPremium, layers.length]);

  const toggleLayer = useCallback((index: number) => {
    setHiddenLayers(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]);
  }, []);

  // ─── Export ────────────────────────────────────────────────────────────────

  const requirePremium = useCallback((feature: PremiumFeature, run: () => void) => {
    if (hasPremium) { run(); return; }
    setGateFeature(feature);
  }, [hasPremium]);

  const exportPng = useCallback(async () => {
    if (!shotRef.current?.capture) return;
    setSheet(null);
    setBusy(true);
    try {
      const path = await shotRef.current.capture();
      await svc.exportBoardPng(path, board?.name ?? 'board');
    } catch (e: any) {
      Alert.alert('Export failed', e?.message ?? 'Could not capture the board.');
    } finally { setBusy(false); }
  }, [board?.name]);

  const exportSvg = useCallback(async () => {
    setSheet(null);
    setBusy(true);
    try {
      await svc.exportBoardSvg(items, board?.background ?? '#FFFFFF', board?.name ?? 'board');
    } finally { setBusy(false); }
  }, [board?.background, board?.name, items]);

  const exportPdf = useCallback(async () => {
    setSheet(null);
    setBusy(true);
    try {
      await svc.exportBoardPdf(items, board?.background ?? '#FFFFFF', board?.name ?? 'board');
    } finally { setBusy(false); }
  }, [board?.background, board?.name, items]);

  // ─── Versions ──────────────────────────────────────────────────────────────

  const openVersions = useCallback(async () => {
    if (!boardId) return;
    setSheet('versions');
    setVersions(null);
    try { setVersions(await svc.getVersions(boardId)); } catch { setVersions([]); }
  }, [boardId]);

  const snapshotNow = useCallback(async () => {
    if (!boardId) return;
    try {
      await svc.saveVersion(boardId, new Date().toLocaleString());
      setVersions(await svc.getVersions(boardId));
    } catch { /* ignore */ }
  }, [boardId]);

  const restore = useCallback((version: svc.BoardVersion) => {
    Alert.alert(
      'Restore this version?',
      'The board is replaced with the saved snapshot. Save the current state first if you want to keep it.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          onPress: async () => {
            const ok = await svc.restoreVersion(version);
            if (!ok) { Alert.alert('Restore failed', 'That snapshot could not be read.'); return; }
            setSheet(null);
            await reload();
          },
        },
      ],
    );
  }, [reload]);

  // ─── Board settings ────────────────────────────────────────────────────────

  const setBackground = useCallback(async (bg: string) => {
    if (!boardId) return;
    setBoard(b => (b ? { ...b, background: bg } : b));
    try { await svc.updateBoard(boardId, { background: bg }); } catch { /* ignore */ }
  }, [boardId]);

  const setPattern = useCallback(async (p: BoardBackgroundPattern) => {
    if (!boardId) return;
    if (!hasPremium && p !== 'plain') { setGateFeature('whiteboard_backgrounds'); return; }
    setBoard(b => (b ? { ...b, pattern: p } : b));
    try { await svc.updateBoard(boardId, { pattern: p }); } catch { /* ignore */ }
  }, [boardId, hasPremium]);

  const fitToContent = useCallback(() => {
    const { width, height } = Dimensions.get('window');
    setViewport(fitViewport(itemsRef.current, width, height - 220));
  }, []);

  const stepZoom = useCallback((factor: number) => {
    const { width, height } = Dimensions.get('window');
    setViewport(vp => zoomAbout(vp, { x: width / 2, y: height / 2 }, vp.zoom * factor));
  }, []);

  const clearAll = useCallback(() => {
    if (!boardId || items.length === 0) return;
    Alert.alert('Clear board', `Remove all ${items.length} items?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear', style: 'destructive',
        onPress: async () => {
          setSelectedIds([]);
          try { await svc.clearBoard(boardId); await reload(); } catch { /* ignore */ }
        },
      },
    ]);
  }, [boardId, items.length, reload]);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    header: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: theme.spacing.sm,
      paddingTop: insets.top + theme.spacing.sm,
      paddingBottom: theme.spacing.sm,
      backgroundColor: theme.colors.surface,
      gap: 4,
    },
    title: {
      ...theme.typography.caption, fontWeight: '700',
      color: theme.colors.text, flex: 1,
    },
    iconBtn: {
      width: 34, height: 34, borderRadius: 10,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: theme.colors.inputBg,
    },
    iconBtnOff: { opacity: 0.35 },
    canvasWrap: { flex: 1 },
    selBar: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: theme.spacing.sm, paddingVertical: 6,
      backgroundColor: theme.colors.surface, gap: 4,
    },
    selText: {
      ...theme.typography.caption, fontSize: 11,
      color: theme.colors.textMuted, marginLeft: 4, marginRight: 'auto',
    },
    toolbar: {
      paddingVertical: theme.spacing.sm,
      paddingBottom: insets.bottom + theme.spacing.sm,
      backgroundColor: theme.colors.surface,
    },
    toolRow: { flexDirection: 'row', paddingHorizontal: theme.spacing.sm, gap: 5 },
    toolBtn: {
      width: 54, height: 46, borderRadius: 12,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: theme.colors.inputBg, gap: 1,
    },
    toolBtnOn: { backgroundColor: theme.colors.primaryLight },
    toolLabel: { ...theme.typography.caption, fontSize: 8, color: theme.colors.textMuted },
    toolLabelOn: { color: theme.colors.primary, fontWeight: '700' },
    zoomBadge: {
      position: 'absolute', top: 8, left: 8,
      paddingHorizontal: 8, paddingVertical: 3,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.surface + 'E6',
    },
    zoomText: { ...theme.typography.caption, fontSize: 10, color: theme.colors.textMuted, fontWeight: '700' },
    fabCol: { position: 'absolute', right: 8, bottom: 8, gap: 8 },
    miniFab: {
      width: 38, height: 38, borderRadius: 19,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: theme.colors.surface, ...theme.shadows.card,
    },
    overlay: { flex: 1, backgroundColor: theme.colors.overlay, justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: 28, borderTopRightRadius: 28,
      padding: theme.spacing.lg,
      paddingBottom: insets.bottom + theme.spacing.lg,
      gap: theme.spacing.lg,
      maxHeight: '88%',
    },
    label: {
      ...theme.typography.caption, color: theme.colors.textMuted,
      textTransform: 'uppercase', letterSpacing: 1, fontWeight: '700',
    },
    input: {
      backgroundColor: theme.colors.inputBg,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.lg, minHeight: 90, textAlignVertical: 'top',
      borderWidth: 2, borderColor: theme.colors.border,
      ...theme.typography.body, color: theme.colors.text,
    },
    pinInput: {
      backgroundColor: theme.colors.inputBg,
      borderRadius: theme.borderRadius.lg,
      paddingVertical: 14, paddingHorizontal: theme.spacing.lg,
      borderWidth: 2, borderColor: theme.colors.border,
      fontSize: 22, letterSpacing: 8, textAlign: 'center',
      color: theme.colors.text,
    },
    swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
    swatch: {
      width: 36, height: 36, borderRadius: 11,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 3, borderColor: 'transparent',
    },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
    chip: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      paddingHorizontal: 12, paddingVertical: 9,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.inputBg,
      borderWidth: 2, borderColor: 'transparent',
    },
    chipOn: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primaryLight },
    chipText: { ...theme.typography.caption, fontWeight: '700', color: theme.colors.text },
    row: {
      flexDirection: 'row', alignItems: 'center',
      gap: theme.spacing.md, paddingVertical: 8,
    },
    rowText: { ...theme.typography.bodySmall, color: theme.colors.text, flex: 1 },
    rowMeta: { ...theme.typography.caption, fontSize: 11, color: theme.colors.textMuted },
    save: {
      backgroundColor: theme.colors.primary,
      borderRadius: theme.borderRadius.lg,
      paddingVertical: 15, alignItems: 'center',
    },
    saveText: { ...theme.typography.button, color: '#FFF', fontWeight: '800' },
    deleteText: {
      ...theme.typography.bodySmall, color: theme.colors.error,
      fontWeight: '700', textAlign: 'center',
    },
    empty: {
      ...theme.typography.bodySmall, color: theme.colors.textMuted,
      textAlign: 'center', paddingVertical: theme.spacing.xl,
    },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: theme.spacing.xl, gap: theme.spacing.lg },
  }), [insets.bottom, insets.top, theme]);

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  if (!board) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.rowText}>Board not found</Text>
        <TouchableOpacity onPress={() => nav.goBack()}>
          <Text style={{ color: theme.colors.primary, fontWeight: '700' }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Password gate: the board content is never rendered until the PIN matches.
  if (board.passcode && !unlocked) {
    return (
      <View style={[styles.container, styles.center]}>
        <Ionicons name="lock-closed-outline" size={44} color={theme.colors.textMuted} />
        <Text style={styles.label}>{board.name} is protected</Text>
        <TextInput
          style={[styles.pinInput, { width: 200 }]}
          value={pinInput}
          onChangeText={setPinInput}
          placeholder="••••"
          placeholderTextColor={theme.colors.textDisabled}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={8}
          autoFocus
        />
        <TouchableOpacity
          style={[styles.save, { alignSelf: 'stretch' }]}
          onPress={() => {
            if (pinInput === board.passcode) { setUnlocked(true); setPinInput(''); }
            else Alert.alert('Wrong PIN', 'Try again.');
          }}
        >
          <Text style={styles.saveText}>Unlock</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => nav.goBack()}>
          <Text style={{ color: theme.colors.textMuted }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const canvas = (
    <WhiteboardCanvas
      items={items}
      viewport={viewport}
      onViewportChange={setViewport}
      tool={presenting ? 'pan' : tool}
      strokeColor={strokeColor}
      strokeWidth={tool === 'highlight' ? HIGHLIGHTER_WIDTH : strokeWidth}
      fillColor={fillColor}
      noteColor={noteColor}
      background={board.background}
      pattern={board.pattern}
      snapEnabled={snapEnabled}
      hiddenLayers={hiddenLayers}
      selectedIds={presenting ? [] : selectedIds}
      onSelectionChange={setSelectedIds}
      onStrokeEnd={handleStrokeEnd}
      onCreateAt={handleCreateAt}
      onCreateShape={handleCreateShape}
      onMoveItems={handleMoveItems}
      onCommit={commitGesture}
      onTransform={handleTransform}
      onEraseItem={async id => {
        try { await svc.deleteItem(id); await reload(); } catch { /* ignore */ }
      }}
      onOpenItem={openItem}
    />
  );

  // Presentation mode: canvas only, tap the corner to leave.
  if (presenting) {
    return (
      <View style={styles.container}>
        <View style={styles.canvasWrap}>{canvas}</View>
        <TouchableOpacity
          style={[styles.miniFab, { position: 'absolute', top: insets.top + 8, right: 8 }]}
          onPress={() => setPresenting(false)}
        >
          <Ionicons name="close" size={20} color={theme.colors.text} />
        </TouchableOpacity>
        <View style={[styles.fabCol, { bottom: insets.bottom + 8 }]}>
          <TouchableOpacity style={styles.miniFab} onPress={fitToContent}>
            <Ionicons name="scan-outline" size={17} color={theme.colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.miniFab} onPress={() => stepZoom(1.25)}>
            <Ionicons name="add" size={18} color={theme.colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.miniFab} onPress={() => stepZoom(0.8)}>
            <Ionicons name="remove" size={18} color={theme.colors.text} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => nav.goBack()}>
          <Ionicons name="chevron-back" size={18} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{board.name}</Text>

        <TouchableOpacity
          style={[styles.iconBtn, !canUndo(history) && styles.iconBtnOff]}
          onPress={applyUndo} disabled={!canUndo(history)}
        >
          <Ionicons name="arrow-undo-outline" size={17} color={theme.colors.text} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.iconBtn, !canRedo(history) && styles.iconBtnOff]}
          onPress={applyRedo} disabled={!canRedo(history)}
        >
          <Ionicons name="arrow-redo-outline" size={17} color={theme.colors.text} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.iconBtn, snapEnabled && { backgroundColor: theme.colors.primaryLight }]}
          onPress={() => setSnapEnabled(s => !s)}
        >
          <Ionicons
            name="grid-outline" size={17}
            color={snapEnabled ? theme.colors.primary : theme.colors.text}
          />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn} onPress={() => setSheet('palette')}>
          <View style={{
            width: 16, height: 16, borderRadius: 5,
            backgroundColor: tool === 'note' ? noteColor : strokeColor,
            borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.border,
          }} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn} onPress={() => setSheet('more')}>
          <Ionicons name="ellipsis-vertical" size={17} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.canvasWrap}>
        <ViewShot ref={shotRef} options={{ format: 'png', quality: 1 }} style={{ flex: 1 }}>
          {canvas}
        </ViewShot>

        <View style={styles.zoomBadge}>
          <Text style={styles.zoomText}>{Math.round(clampZoom(viewport.zoom) * 100)}%</Text>
        </View>

        <View style={styles.fabCol}>
          <TouchableOpacity style={styles.miniFab} onPress={fitToContent}>
            <Ionicons name="scan-outline" size={17} color={theme.colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.miniFab} onPress={() => stepZoom(1.25)}
            disabled={viewport.zoom >= MAX_ZOOM}
          >
            <Ionicons name="add" size={18} color={theme.colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.miniFab} onPress={() => stepZoom(0.8)}
            disabled={viewport.zoom <= MIN_ZOOM}
          >
            <Ionicons name="remove" size={18} color={theme.colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {selectedIds.length > 0 && (
        <View style={styles.selBar}>
          <Text style={styles.selText}>
            {selectedIds.length} selected
          </Text>
          {selection.length > 1 && (
            <TouchableOpacity style={styles.iconBtn} onPress={toggleGroup}>
              <Ionicons
                name={selection.every(i => i.groupId) ? 'unlink-outline' : 'link-outline'}
                size={16} color={theme.colors.text}
              />
            </TouchableOpacity>
          )}
          {selection.length > 1 && (
            <TouchableOpacity style={styles.iconBtn} onPress={() => setSheet('align')}>
              <Ionicons
                name={hasPremium ? 'apps-outline' : 'lock-closed-outline'}
                size={16} color={theme.colors.text}
              />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.iconBtn} onPress={toggleLock}>
            <Ionicons
              name={selection.every(i => i.locked) ? 'lock-open-outline' : 'lock-closed-outline'}
              size={16} color={theme.colors.text}
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={duplicateSelection}>
            <Ionicons name="copy-outline" size={16} color={theme.colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={deleteSelection}>
            <Ionicons name="trash-outline" size={16} color={theme.colors.error} />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.toolbar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.toolRow}>
            {TOOLS.map(t => {
              const on = tool === t.value;
              return (
                <TouchableOpacity
                  key={t.value}
                  style={[styles.toolBtn, on && styles.toolBtnOn]}
                  onPress={() => { setTool(t.value); setSelectedIds([]); }}
                >
                  <Ionicons
                    name={t.icon} size={17}
                    color={on ? theme.colors.primary : theme.colors.textMuted}
                  />
                  <Text style={[styles.toolLabel, on && styles.toolLabelOn]}>{t.label}</Text>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity style={styles.toolBtn} onPress={() => addImage(false)}>
              <Ionicons name="image-outline" size={17} color={theme.colors.textMuted} />
              <Text style={styles.toolLabel}>Image</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.toolBtn} onPress={() => addImage(true)}>
              <Ionicons name="camera-outline" size={17} color={theme.colors.textMuted} />
              <Text style={styles.toolLabel}>Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.toolBtn} onPress={() => setSheet('layers')}>
              <Ionicons name="layers-outline" size={17} color={theme.colors.textMuted} />
              <Text style={styles.toolLabel}>Layers</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>

      {/* ── Text / note editor ── */}
      <Modal
        visible={editing !== null}
        transparent animationType="slide"
        onRequestClose={() => setEditing(null)}
      >
        <View style={styles.overlay}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setEditing(null)} />
          <View style={styles.sheet}>
            <ScrollView contentContainerStyle={{ gap: theme.spacing.lg }}>
              <Text style={styles.label}>
                {editing?.kind === 'note' ? 'Sticky note' : 'Text box'}
              </Text>
              <TextInput
                style={styles.input}
                value={editText}
                onChangeText={setEditText}
                placeholder="Type something…"
                placeholderTextColor={theme.colors.textDisabled}
                multiline autoFocus maxLength={800}
              />

              <View style={styles.chips}>
                {([
                  { key: 'bold', icon: 'text', label: 'Bold' },
                  { key: 'italic', icon: 'text-outline', label: 'Italic' },
                  { key: 'underline', icon: 'remove-outline', label: 'Underline' },
                ] as const).map(o => {
                  const on = editStyle[o.key];
                  return (
                    <TouchableOpacity
                      key={o.key}
                      style={[styles.chip, on && styles.chipOn]}
                      onPress={() => setEditStyle(s => ({ ...s, [o.key]: !s[o.key] }))}
                    >
                      <Text style={[
                        styles.chipText,
                        o.key === 'bold' && { fontWeight: '900' },
                        o.key === 'italic' && { fontStyle: 'italic' },
                        o.key === 'underline' && { textDecorationLine: 'underline' },
                      ]}>{o.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={{ gap: theme.spacing.sm }}>
                <Text style={styles.label}>Size</Text>
                <View style={styles.chips}>
                  {[12, 16, 20, 28, 40].map(sz => (
                    <TouchableOpacity
                      key={sz}
                      style={[styles.chip, editStyle.fontSize === sz && styles.chipOn]}
                      onPress={() => setEditStyle(s => ({ ...s, fontSize: sz }))}
                    >
                      <Text style={styles.chipText}>{sz}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={{ gap: theme.spacing.sm }}>
                <Text style={styles.label}>Align</Text>
                <View style={styles.chips}>
                  {(['left', 'center', 'right'] as const).map(a => (
                    <TouchableOpacity
                      key={a}
                      style={[styles.chip, editStyle.align === a && styles.chipOn]}
                      onPress={() => setEditStyle(s => ({ ...s, align: a }))}
                    >
                      <Ionicons
                        name={`text-outline`} size={13}
                        color={theme.colors.textMuted}
                      />
                      <Text style={styles.chipText}>{a}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {editing?.kind === 'note' && (
                <View style={styles.swatches}>
                  {NOTE_COLORS.map(c => (
                    <TouchableOpacity
                      key={c}
                      style={[styles.swatch, { backgroundColor: c }, c === noteColor && { borderColor: theme.colors.text }]}
                      onPress={() => setNoteColor(c)}
                    >
                      {c === noteColor && <Ionicons name="checkmark" size={16} color="#1F2937" />}
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <TouchableOpacity style={styles.save} onPress={saveText}>
                <Text style={styles.saveText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => {
                  const target = editing;
                  setEditing(null);
                  if (!target) return;
                  try { await svc.deleteItem(target.id); await reload(); } catch { /* ignore */ }
                }}
              >
                <Text style={styles.deleteText}>Delete</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Palette ── */}
      <Modal
        visible={sheet === 'palette'}
        transparent animationType="slide"
        onRequestClose={() => setSheet(null)}
      >
        <View style={styles.overlay}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setSheet(null)} />
          <View style={styles.sheet}>
            <ScrollView contentContainerStyle={{ gap: theme.spacing.lg }}>
              <View style={{ gap: theme.spacing.sm }}>
                <Text style={styles.label}>Pen & shape colour</Text>
                <View style={styles.swatches}>
                  {STROKE_COLORS.map(c => (
                    <TouchableOpacity
                      key={c}
                      style={[styles.swatch, { backgroundColor: c }, c === strokeColor && { borderColor: theme.colors.text }]}
                      onPress={() => setStrokeColor(c)}
                    >
                      {c === strokeColor && <Ionicons name="checkmark" size={16} color="#FFF" />}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={{ gap: theme.spacing.sm }}>
                <Text style={styles.label}>Width</Text>
                <View style={styles.chips}>
                  {STROKE_WIDTHS.map(w => (
                    <TouchableOpacity
                      key={w}
                      style={[styles.chip, w === strokeWidth && styles.chipOn]}
                      onPress={() => setStrokeWidth(w)}
                    >
                      <View style={{
                        width: 22, height: w, borderRadius: w / 2,
                        backgroundColor: theme.colors.text,
                      }} />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={{ gap: theme.spacing.sm }}>
                <Text style={styles.label}>Shape fill</Text>
                <View style={styles.swatches}>
                  <TouchableOpacity
                    style={[styles.swatch, { backgroundColor: theme.colors.inputBg }, fillColor === null && { borderColor: theme.colors.text }]}
                    onPress={() => setFillColor(null)}
                  >
                    <Ionicons name="close" size={15} color={theme.colors.textMuted} />
                  </TouchableOpacity>
                  {NOTE_COLORS.map(c => (
                    <TouchableOpacity
                      key={c}
                      style={[styles.swatch, { backgroundColor: c }, c === fillColor && { borderColor: theme.colors.text }]}
                      onPress={() => setFillColor(c)}
                    />
                  ))}
                </View>
              </View>

              <View style={{ gap: theme.spacing.sm }}>
                <Text style={styles.label}>Note colour</Text>
                <View style={styles.swatches}>
                  {NOTE_COLORS.map(c => (
                    <TouchableOpacity
                      key={c}
                      style={[styles.swatch, { backgroundColor: c }, c === noteColor && { borderColor: theme.colors.text }]}
                      onPress={() => setNoteColor(c)}
                    />
                  ))}
                </View>
              </View>

              <View style={{ gap: theme.spacing.sm }}>
                <Text style={styles.label}>Background</Text>
                <View style={styles.swatches}>
                  {BOARD_BACKGROUNDS.map(c => (
                    <TouchableOpacity
                      key={c}
                      style={[
                        styles.swatch,
                        { backgroundColor: c, borderWidth: 2 },
                        { borderColor: c === board.background ? theme.colors.primary : theme.colors.border },
                      ]}
                      onPress={() => setBackground(c)}
                    />
                  ))}
                </View>
              </View>

              <View style={{ gap: theme.spacing.sm }}>
                <Text style={styles.label}>Pattern {hasPremium ? '' : '· PRO'}</Text>
                <View style={styles.chips}>
                  {PATTERNS.map(p => (
                    <TouchableOpacity
                      key={p.value}
                      style={[styles.chip, board.pattern === p.value && styles.chipOn]}
                      onPress={() => setPattern(p.value)}
                    >
                      <Ionicons
                        name={!hasPremium && p.value !== 'plain' ? 'lock-closed-outline' : p.icon}
                        size={13} color={theme.colors.textMuted}
                      />
                      <Text style={styles.chipText}>{p.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <TouchableOpacity style={styles.save} onPress={() => setSheet(null)}>
                <Text style={styles.saveText}>Done</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Layers ── */}
      <Modal
        visible={sheet === 'layers'}
        transparent animationType="slide"
        onRequestClose={() => setSheet(null)}
      >
        <View style={styles.overlay}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setSheet(null)} />
          <View style={styles.sheet}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[styles.label, { flex: 1 }]}>Layers</Text>
              <TouchableOpacity style={styles.iconBtn} onPress={addLayer}>
                <Ionicons
                  name={!hasPremium && layers.length >= FREE_LAYER_LIMIT ? 'lock-closed-outline' : 'add'}
                  size={17} color={theme.colors.text}
                />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {layers.map(l => (
                <View key={l.index} style={styles.row}>
                  <TouchableOpacity onPress={() => toggleLayer(l.index)} style={{ padding: 4 }}>
                    <Ionicons
                      name={hiddenLayers.includes(l.index) ? 'eye-off-outline' : 'eye-outline'}
                      size={18} color={theme.colors.textMuted}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ flex: 1 }}
                    onPress={() => setActiveLayer(l.index)}
                  >
                    <Text style={[
                      styles.rowText,
                      l.index === activeLayer && { color: theme.colors.primary, fontWeight: '700' },
                    ]}>
                      {l.name}{l.index === activeLayer ? ' · drawing here' : ''}
                    </Text>
                    <Text style={styles.rowMeta}>{l.itemCount} item{l.itemCount === 1 ? '' : 's'}</Text>
                  </TouchableOpacity>
                  {selection.length > 0 && (
                    <TouchableOpacity
                      onPress={() => patchSelection({ layer: l.index })}
                      style={{ padding: 4 }}
                    >
                      <Ionicons name="enter-outline" size={17} color={theme.colors.primary} />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.save} onPress={() => setSheet(null)}>
              <Text style={styles.saveText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Align ── */}
      <Modal
        visible={sheet === 'align'}
        transparent animationType="slide"
        onRequestClose={() => setSheet(null)}
      >
        <View style={styles.overlay}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setSheet(null)} />
          <View style={styles.sheet}>
            <Text style={styles.label}>Align & distribute</Text>
            <View style={styles.chips}>
              {ALIGNMENTS.map(a => (
                <TouchableOpacity
                  key={a.mode}
                  style={styles.chip}
                  onPress={() => { applyAlign(a.mode); setSheet(null); }}
                >
                  <Ionicons name={a.icon} size={14} color={theme.colors.textMuted} />
                  <Text style={styles.chipText}>{a.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.save} onPress={() => setSheet(null)}>
              <Text style={styles.saveText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Export ── */}
      <Modal
        visible={sheet === 'export'}
        transparent animationType="slide"
        onRequestClose={() => setSheet(null)}
      >
        <View style={styles.overlay}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setSheet(null)} />
          <View style={styles.sheet}>
            <Text style={styles.label}>Export</Text>
            {([
              { key: 'png', label: 'PNG image', hint: 'Current view', icon: 'image-outline', run: exportPng },
              { key: 'svg', label: 'SVG vector', hint: 'Whole board, sharp at any size', icon: 'shapes-outline', run: exportSvg },
              { key: 'pdf', label: 'PDF (print)', hint: 'Opens a print-ready page', icon: 'document-text-outline', run: exportPdf },
            ] as const).map(o => (
              <TouchableOpacity key={o.key} style={styles.row} onPress={o.run} disabled={busy}>
                <Ionicons name={o.icon} size={20} color={theme.colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowText}>{o.label}</Text>
                  <Text style={styles.rowMeta}>{o.hint}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={theme.colors.textDisabled} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* ── Versions ── */}
      <Modal
        visible={sheet === 'versions'}
        transparent animationType="slide"
        onRequestClose={() => setSheet(null)}
      >
        <View style={styles.overlay}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setSheet(null)} />
          <View style={styles.sheet}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[styles.label, { flex: 1 }]}>Version history</Text>
              <TouchableOpacity style={styles.iconBtn} onPress={snapshotNow}>
                <Ionicons name="add" size={17} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 320 }}>
              {versions === null ? (
                <ActivityIndicator color={theme.colors.primary} style={{ marginVertical: 20 }} />
              ) : versions.length === 0 ? (
                <Text style={styles.empty}>
                  No snapshots yet.{'\n'}Tap + to save the current board.
                </Text>
              ) : (
                versions.map(v => (
                  <View key={v.id} style={styles.row}>
                    <Ionicons name="time-outline" size={18} color={theme.colors.textMuted} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowText}>{v.label}</Text>
                      <Text style={styles.rowMeta}>{v.itemCount} items</Text>
                    </View>
                    <TouchableOpacity onPress={() => restore(v)} style={{ padding: 4 }}>
                      <Ionicons name="refresh-outline" size={17} color={theme.colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={async () => {
                        await svc.deleteVersion(v.id);
                        if (boardId) setVersions(await svc.getVersions(boardId));
                      }}
                      style={{ padding: 4 }}
                    >
                      <Ionicons name="trash-outline" size={17} color={theme.colors.error} />
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </ScrollView>
            <TouchableOpacity style={styles.save} onPress={() => setSheet(null)}>
              <Text style={styles.saveText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── More ── */}
      <Modal
        visible={sheet === 'more'}
        transparent animationType="slide"
        onRequestClose={() => setSheet(null)}
      >
        <View style={styles.overlay}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setSheet(null)} />
          <View style={styles.sheet}>
            <ScrollView>
              <TouchableOpacity
                style={styles.row}
                onPress={() => requirePremium('whiteboard_export', () => setSheet('export'))}
              >
                <Ionicons
                  name={hasPremium ? 'download-outline' : 'lock-closed-outline'}
                  size={20} color={theme.colors.primary}
                />
                <Text style={styles.rowText}>Export…</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.row}
                onPress={() => requirePremium('whiteboard_versions', openVersions)}
              >
                <Ionicons
                  name={hasPremium ? 'time-outline' : 'lock-closed-outline'}
                  size={20} color={theme.colors.primary}
                />
                <Text style={styles.rowText}>Version history</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.row}
                onPress={() => requirePremium('whiteboard_presentation', () => {
                  setSheet(null);
                  setSelectedIds([]);
                  setPresenting(true);
                })}
              >
                <Ionicons
                  name={hasPremium ? 'tv-outline' : 'lock-closed-outline'}
                  size={20} color={theme.colors.primary}
                />
                <Text style={styles.rowText}>Presentation mode</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.row} onPress={clearAll}>
                <Ionicons name="close-circle-outline" size={20} color={theme.colors.error} />
                <Text style={[styles.rowText, { color: theme.colors.error }]}>Clear board</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <PremiumGateSheet
        visible={gateFeature !== null}
        feature={gateFeature ?? undefined}
        onClose={() => setGateFeature(null)}
      />
    </View>
  );
}
