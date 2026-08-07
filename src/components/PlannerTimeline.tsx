/**
 * PlannerTimeline — the hourly day grid with draggable, resizable blocks.
 *
 * Drag & drop details:
 *   • A long-press (or a vertical drag past the threshold) grabs a block.
 *     A plain tap opens it instead, so scrolling and tapping still work.
 *   • While dragging, the block follows the finger and the drop target snaps
 *     to 15-minute increments; the live time is shown on the block.
 *   • The bottom edge is a resize handle that changes duration only.
 *   • Locked blocks can't be dragged or resized — they show a lock badge.
 *   • Read-only "ghost" rows (tasks/habits with a time but no block) are
 *     rendered dimmed and are tappable but not draggable.
 *
 * Overlapping items are laid out side by side so nothing is hidden.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated, PanResponder, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import type { PlannerTheme } from '../core/plannerThemes';
import { BLOCK_KIND_ICONS } from '../services/plannerScheduleService';
import { formatDuration, formatMinutes } from '../services/plannerService';
import type { TimelineItem } from '../types/planner';

export const HOUR_HEIGHT = 68;
export const SNAP_MINUTES = 15;
const TIME_GUTTER = 56;
const MIN_VISUAL_MINUTES = 20;   // keeps very short blocks tappable

const PX_PER_MIN = HOUR_HEIGHT / 60;

interface LaidOutItem {
  item: TimelineItem;
  /** 0-based column within its overlap group. */
  column: number;
  /** Total columns in its overlap group. */
  columns: number;
}

/**
 * Assign side-by-side columns to overlapping items.
 * Items are grouped into clusters of transitively-overlapping spans; within a
 * cluster each item takes the first column whose last item has already ended.
 */
function layoutItems(items: TimelineItem[]): LaidOutItem[] {
  const sorted = [...items].sort((a, b) => a.startMinutes - b.startMinutes);
  const result: LaidOutItem[] = [];

  let cluster: TimelineItem[] = [];
  let clusterEnd = -1;

  const flush = () => {
    if (cluster.length === 0) return;
    const columnEnds: number[] = [];
    const assigned: { item: TimelineItem; column: number }[] = [];
    for (const item of cluster) {
      const end = item.startMinutes + Math.max(item.durationMinutes, MIN_VISUAL_MINUTES);
      let column = columnEnds.findIndex(colEnd => colEnd <= item.startMinutes);
      if (column === -1) { column = columnEnds.length; columnEnds.push(end); }
      else columnEnds[column] = end;
      assigned.push({ item, column });
    }
    const columns = columnEnds.length;
    assigned.forEach(a => result.push({ ...a, columns }));
    cluster = [];
    clusterEnd = -1;
  };

  for (const item of sorted) {
    const end = item.startMinutes + Math.max(item.durationMinutes, MIN_VISUAL_MINUTES);
    if (cluster.length > 0 && item.startMinutes >= clusterEnd) flush();
    cluster.push(item);
    clusterEnd = Math.max(clusterEnd, end);
  }
  flush();

  return result;
}

function snap(minutes: number): number {
  return Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES;
}

// ─── Single block ────────────────────────────────────────────────────────────

interface BlockViewProps {
  laid: LaidOutItem;
  dayStartMinutes: number;
  contentWidth: number;
  plannerTheme: PlannerTheme;
  onPress: (item: TimelineItem) => void;
  onToggle: (item: TimelineItem) => void;
  onMove: (item: TimelineItem, startMinutes: number) => void;
  onResize: (item: TimelineItem, durationMinutes: number) => void;
}

function TimelineBlockView({
  laid, dayStartMinutes, contentWidth, plannerTheme, onPress, onToggle, onMove, onResize,
}: BlockViewProps) {
  const { theme } = useTheme();
  const { item, column, columns } = laid;
  const draggable = item.block != null && !item.locked;

  const translateY = useRef(new Animated.Value(0)).current;
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);
  /** Live preview values shown while a gesture is in flight. */
  const [previewStart, setPreviewStart] = useState<number | null>(null);
  const [previewDuration, setPreviewDuration] = useState<number | null>(null);

  const visualMinutes = Math.max(item.durationMinutes, MIN_VISUAL_MINUTES);
  const top = (item.startMinutes - dayStartMinutes) * PX_PER_MIN;
  const height = visualMinutes * PX_PER_MIN;

  /**
   * Absolute rendered height. Held in a ref (not recreated per render) because
   * a fresh Animated.Value each render leaks animation nodes; it's re-synced to
   * `height` whenever the block's own duration changes.
   */
  const animatedHeight = useRef(new Animated.Value(height)).current;
  useEffect(() => { animatedHeight.setValue(height); }, [animatedHeight, height]);

  const gutterWidth = contentWidth - TIME_GUTTER - 10;
  const colWidth = columns > 1 ? (gutterWidth - (columns - 1) * 4) / columns : gutterWidth;
  const left = TIME_GUTTER + 4 + column * (colWidth + 4);

  const movePan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    // Only claim the gesture on a clear vertical drag, so the ScrollView
    // still wins for normal scrolling and taps still register.
    onMoveShouldSetPanResponder: (_, gs) =>
      draggable && Math.abs(gs.dy) > 8 && Math.abs(gs.dy) > Math.abs(gs.dx),
    onPanResponderGrant: () => {
      setDragging(true);
      setPreviewStart(item.startMinutes);
      translateY.setValue(0);
    },
    onPanResponderMove: (_, gs) => {
      // Snap the visual offset as well as the label, so the block always sits
      // on the grid line matching the time it reports.
      const delta = snap(gs.dy / PX_PER_MIN);
      const next = Math.max(0, Math.min(1440 - item.durationMinutes, item.startMinutes + delta));
      translateY.setValue((next - item.startMinutes) * PX_PER_MIN);
      setPreviewStart(next);
    },
    onPanResponderRelease: (_, gs) => {
      const delta = snap(gs.dy / PX_PER_MIN);
      const next = Math.max(0, Math.min(1440 - item.durationMinutes, snap(item.startMinutes) + delta));
      translateY.setValue(0);
      setDragging(false);
      setPreviewStart(null);
      if (next !== item.startMinutes) onMove(item, next);
    },
    onPanResponderTerminate: () => {
      translateY.setValue(0);
      setDragging(false);
      setPreviewStart(null);
    },
  }), [draggable, item, onMove, translateY]);

  const resizePan = useMemo(() => {
    /** Snapped duration for a vertical drag of `dy` pixels. */
    const durationFor = (dy: number) => Math.min(
      1440 - item.startMinutes,
      Math.max(SNAP_MINUTES, snap(item.durationMinutes + dy / PX_PER_MIN))
    );

    return PanResponder.create({
      onStartShouldSetPanResponder: () => draggable,
      onMoveShouldSetPanResponder: () => draggable,
      onPanResponderGrant: () => {
        setResizing(true);
        setPreviewDuration(item.durationMinutes);
      },
      onPanResponderMove: (_, gs) => {
        const next = durationFor(gs.dy);
        // Snap the height too, so the edge lands on the grid line it reports.
        animatedHeight.setValue(Math.max(next, MIN_VISUAL_MINUTES) * PX_PER_MIN);
        setPreviewDuration(next);
      },
      onPanResponderRelease: (_, gs) => {
        const next = durationFor(gs.dy);
        setResizing(false);
        setPreviewDuration(null);
        if (next !== item.durationMinutes) onResize(item, next);
        else animatedHeight.setValue(height);   // no change — snap back
      },
      onPanResponderTerminate: () => {
        animatedHeight.setValue(height);
        setResizing(false);
        setPreviewDuration(null);
      },
    });
  }, [animatedHeight, draggable, height, item, onResize]);

  const isGhost = item.block == null;
  const gesturing = dragging || resizing;
  const displayStart = previewStart ?? item.startMinutes;
  const displayDuration = previewDuration ?? item.durationMinutes;
  const compact = height < 46;

  return (
    <Animated.View
      style={{
        position: 'absolute',
        top,
        left,
        width: colWidth,
        height: animatedHeight,
        transform: [{ translateY }],
        zIndex: gesturing ? 50 : 10,
        elevation: gesturing ? 12 : 2,
      }}
      {...movePan.panHandlers}
    >
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => { if (!gesturing) onPress(item); }}
        style={{
          flex: 1,
          borderRadius: plannerTheme.blockRadius,
          backgroundColor: isGhost ? item.color + '26' : item.color + plannerTheme.blockAlpha,
          borderLeftWidth: plannerTheme.accentWidth,
          borderLeftColor: item.color,
          borderWidth: isGhost ? 1 : 0,
          borderColor: item.color + '66',
          borderStyle: isGhost ? 'dashed' : 'solid',
          overflow: 'hidden',
          opacity: item.completed && !gesturing ? 0.55 : 1,
          transform: [{ scale: gesturing ? 1.02 : 1 }],
        }}
      >
        <View style={{ flex: 1, paddingHorizontal: 9, paddingVertical: compact ? 4 : 7, flexDirection: 'row', gap: 6 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons
                name={BLOCK_KIND_ICONS[item.kind]}
                size={11}
                color={isGhost ? item.color : 'rgba(255,255,255,0.85)'}
              />
              <Text
                numberOfLines={1}
                style={{
                  flex: 1,
                  fontSize: compact ? 11 : 12.5,
                  fontWeight: '700',
                  color: isGhost ? theme.colors.text : '#FFF',
                  textDecorationLine: item.completed ? 'line-through' : 'none',
                }}
              >
                {item.title}
              </Text>
              {item.locked && (
                <Ionicons name="lock-closed" size={10} color={isGhost ? item.color : 'rgba(255,255,255,0.8)'} />
              )}
              {item.hasReminder && (
                <Ionicons
                  name="notifications"
                  size={10}
                  color={isGhost ? item.color : 'rgba(255,255,255,0.8)'}
                />
              )}
            </View>
            {!compact && (
              <Text
                numberOfLines={1}
                style={{
                  fontSize: 10.5,
                  marginTop: 2,
                  color: isGhost ? theme.colors.textMuted : 'rgba(255,255,255,0.82)',
                  fontWeight: gesturing ? '800' : '500',
                }}
              >
                {formatMinutes(displayStart)} · {formatDuration(displayDuration)}
                {isGhost ? '  (not blocked)' : ''}
              </Text>
            )}
          </View>

          {/* Completion toggle */}
          <TouchableOpacity
            onPress={() => onToggle(item)}
            hitSlop={8}
            style={{
              width: 22, height: 22, borderRadius: 11,
              alignItems: 'center', justifyContent: 'center',
              backgroundColor: isGhost ? item.color + '22' : 'rgba(255,255,255,0.22)',
              alignSelf: 'flex-start',
            }}
          >
            <Ionicons
              name={item.completed ? 'checkmark-circle' : 'ellipse-outline'}
              size={15}
              color={isGhost ? item.color : '#FFF'}
            />
          </TouchableOpacity>
        </View>

        {/* Resize handle */}
        {draggable && !compact && (
          <View
            {...resizePan.panHandlers}
            style={{
              height: 13, alignItems: 'center', justifyContent: 'center',
              backgroundColor: 'rgba(0,0,0,0.16)',
            }}
          >
            <View style={{ width: 26, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.7)' }} />
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Timeline ────────────────────────────────────────────────────────────────

interface Props {
  items: TimelineItem[];
  dayStartHour: number;
  dayEndHour: number;
  plannerTheme: PlannerTheme;
  /** Show the "now" line — only meaningful for today. */
  showNowLine: boolean;
  /** Width available to the timeline, for column layout. */
  width: number;
  onItemPress: (item: TimelineItem) => void;
  onItemToggle: (item: TimelineItem) => void;
  onItemMove: (item: TimelineItem, startMinutes: number) => void;
  onItemResize: (item: TimelineItem, durationMinutes: number) => void;
  /** Tap an empty slot to create a block there. */
  onEmptySlotPress: (startMinutes: number) => void;
}

export function PlannerTimeline({
  items, dayStartHour, dayEndHour, plannerTheme, showNowLine, width,
  onItemPress, onItemToggle, onItemMove, onItemResize, onEmptySlotPress,
}: Props) {
  const { theme } = useTheme();

  const dayStartMinutes = dayStartHour * 60;
  const totalHours = Math.max(1, dayEndHour - dayStartHour);
  const contentHeight = totalHours * HOUR_HEIGHT;

  const hours = useMemo(
    () => Array.from({ length: totalHours + 1 }, (_, i) => dayStartHour + i),
    [dayStartHour, totalHours]
  );

  // Only lay out items that intersect the visible window.
  const visibleItems = useMemo(
    () => items.filter(i =>
      i.startMinutes + i.durationMinutes > dayStartMinutes && i.startMinutes < dayEndHour * 60
    ),
    [dayEndHour, dayStartMinutes, items]
  );

  const laidOut = useMemo(() => layoutItems(visibleItems), [visibleItems]);

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const nowTop = (nowMinutes - dayStartMinutes) * PX_PER_MIN;
  const nowVisible = showNowLine && nowMinutes >= dayStartMinutes && nowMinutes <= dayEndHour * 60;

  const handleEmptyPress = useCallback((locationY: number) => {
    const minutes = snap(dayStartMinutes + locationY / PX_PER_MIN);
    onEmptySlotPress(Math.max(0, Math.min(1440 - SNAP_MINUTES, minutes)));
  }, [dayStartMinutes, onEmptySlotPress]);

  return (
    <View style={{ height: contentHeight, backgroundColor: plannerTheme.timelineBg ?? 'transparent' }}>
      {/* Tap-to-add layer, behind the blocks */}
      <TouchableOpacity
        activeOpacity={1}
        onPress={e => handleEmptyPress(e.nativeEvent.locationY)}
        style={{ position: 'absolute', left: TIME_GUTTER, right: 0, top: 0, height: contentHeight }}
      />

      {/* Hour grid */}
      {hours.map((hour, i) => (
        <View key={hour} style={{ position: 'absolute', top: i * HOUR_HEIGHT, left: 0, right: 0, flexDirection: 'row' }}>
          <Text
            style={{
              width: TIME_GUTTER,
              paddingRight: 10,
              textAlign: 'right',
              fontSize: 10.5,
              fontWeight: '600',
              color: plannerTheme.hourLabel,
              marginTop: -6,
            }}
          >
            {hour === 24 ? '12am' : `${hour % 12 || 12}${hour < 12 || hour === 24 ? 'am' : 'pm'}`}
          </Text>
          <View style={{ flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: plannerTheme.gridLine }} />
        </View>
      ))}

      {/* Half-hour guides */}
      {hours.slice(0, -1).map((hour, i) => (
        <View
          key={`half-${hour}`}
          style={{
            position: 'absolute',
            top: i * HOUR_HEIGHT + HOUR_HEIGHT / 2,
            left: TIME_GUTTER,
            right: 0,
            height: StyleSheet.hairlineWidth,
            backgroundColor: plannerTheme.gridLine + '80',
          }}
        />
      ))}

      {/* Now line */}
      {nowVisible && (
        <View style={{ position: 'absolute', top: nowTop, left: TIME_GUTTER - 5, right: 0, zIndex: 40 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: plannerTheme.nowLine }} />
            <View style={{ flex: 1, height: 2, backgroundColor: plannerTheme.nowLine }} />
          </View>
        </View>
      )}

      {/* Empty state */}
      {laidOut.length === 0 && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute', left: TIME_GUTTER + 16, right: 16, top: HOUR_HEIGHT * 1.5,
            alignItems: 'center', gap: 8,
          }}
        >
          <Ionicons name="time-outline" size={38} color={theme.colors.textDisabled} />
          <Text style={{ fontSize: 13, color: theme.colors.textMuted, textAlign: 'center', lineHeight: 19 }}>
            Nothing scheduled yet.{'\n'}Tap any hour to block time, or use Quick Add.
          </Text>
        </View>
      )}

      {/* Blocks */}
      {laidOut.map(laid => (
        <TimelineBlockView
          key={laid.item.key}
          laid={laid}
          dayStartMinutes={dayStartMinutes}
          contentWidth={width}
          plannerTheme={plannerTheme}
          onPress={onItemPress}
          onToggle={onItemToggle}
          onMove={onItemMove}
          onResize={onItemResize}
        />
      ))}
    </View>
  );
}
