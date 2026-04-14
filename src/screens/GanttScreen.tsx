/**
 * Gantt Chart Screen
 *
 * Displays tasks as horizontal bars on a scrollable timeline.
 * - X axis: dates (60 days total starting 7 days before today, each col = DAY_WIDTH px)
 * - Y axis: task rows grouped by category
 * - Bar spans from task.createdAt to task.dueDate; single dot if no dueDate
 * - Tap a bar / label to open the task editor
 */

import React, { useMemo, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Pressable,
  NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';
import type { RootStackParamList } from '../navigation/types';
import type { Task } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const DAY_WIDTH = 44;
const ROW_HEIGHT = 44;
const GROUP_ROW_HEIGHT = 28;
const LABEL_WIDTH = 100;
const DATE_HEADER_HEIGHT = 32;
const DAYS_BEFORE = 7;
const DAYS_TOTAL = 60;

function startOfDay(ts: number): number {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function addDays(base: number, n: number): number {
  return base + n * 86400000;
}

function colIndex(timelineStart: number, ts: number): number {
  return Math.round((startOfDay(ts) - timelineStart) / 86400000);
}

const PRIORITY_COLORS: Record<string, string> = {
  high: '#EF4444',
  medium: '#F59E0B',
  low: '#3B82F6',
  none: '#6B7280',
};

type Row =
  | { kind: 'group'; label: string; color: string; count: number }
  | { kind: 'task'; task: Task; groupColor: string };

export function GanttScreen() {
  const navigation = useNavigation<Nav>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { tasks, taskCategories } = useApp();

  // Refs for scroll sync
  const labelScrollRef = useRef<ScrollView>(null);
  const timelineBodyRef = useRef<ScrollView>(null);
  const dateHeaderRef = useRef<ScrollView>(null);
  const timelineHRef = useRef<ScrollView>(null);
  const isSyncingV = useRef(false);
  const isSyncingH = useRef(false);

  const onLabelScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (isSyncingV.current) return;
    isSyncingV.current = true;
    timelineBodyRef.current?.scrollTo({ y: e.nativeEvent.contentOffset.y, animated: false });
    setTimeout(() => { isSyncingV.current = false; }, 50);
  }, []);

  const onTimelineBodyScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (isSyncingV.current) return;
    isSyncingV.current = true;
    labelScrollRef.current?.scrollTo({ y: e.nativeEvent.contentOffset.y, animated: false });
    setTimeout(() => { isSyncingV.current = false; }, 50);
  }, []);

  const onDateHeaderHScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (isSyncingH.current) return;
    isSyncingH.current = true;
    timelineHRef.current?.scrollTo({ x: e.nativeEvent.contentOffset.x, animated: false });
    setTimeout(() => { isSyncingH.current = false; }, 50);
  }, []);

  const onTimelineHScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (isSyncingH.current) return;
    isSyncingH.current = true;
    dateHeaderRef.current?.scrollTo({ x: e.nativeEvent.contentOffset.x, animated: false });
    setTimeout(() => { isSyncingH.current = false; }, 50);
  }, []);

  const todayStart = useMemo(() => startOfDay(Date.now()), []);
  const timelineStart = useMemo(() => addDays(todayStart, -DAYS_BEFORE), [todayStart]);
  const todayColX = DAYS_BEFORE * DAY_WIDTH;
  const totalTimelineWidth = DAYS_TOTAL * DAY_WIDTH;

  const columns = useMemo(() =>
    Array.from({ length: DAYS_TOTAL }, (_, i) => {
      const ts = addDays(timelineStart, i);
      const d = new Date(ts);
      const isToday = startOfDay(ts) === todayStart;
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      const label = (d.getDate() === 1 || i === 0)
        ? `${d.toLocaleString('default', { month: 'short' })} ${d.getDate()}`
        : `${d.getDate()}`;
      return { label, isToday, isWeekend };
    }),
  [timelineStart, todayStart]);

  const rows = useMemo<Row[]>(() => {
    type Group = { label: string; color: string; tasks: Task[] };
    const map = new Map<string, Group>();
    for (const cat of taskCategories) {
      map.set(cat.id, { label: cat.name, color: cat.color, tasks: [] });
    }
    map.set('none', { label: 'No Category', color: '#6B7280', tasks: [] });
    for (const task of tasks) {
      const key = task.categoryId ?? 'none';
      if (!map.has(key)) map.set(key, { label: 'Other', color: '#6B7280', tasks: [] });
      map.get(key)!.tasks.push(task);
    }
    const result: Row[] = [];
    for (const [, g] of map) {
      if (g.tasks.length === 0) continue;
      result.push({ kind: 'group', label: g.label, color: g.color, count: g.tasks.length });
      for (const t of g.tasks) {
        result.push({ kind: 'task', task: t, groupColor: g.color });
      }
    }
    return result;
  }, [tasks, taskCategories]);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    header: {
      paddingHorizontal: theme.spacing.lg,
      paddingTop: insets.top + theme.spacing.md,
      paddingBottom: theme.spacing.md,
      backgroundColor: theme.colors.surface,
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
    },
    headerTitle: { ...theme.typography.title, fontSize: 22, fontWeight: '700', color: theme.colors.text, flex: 1 },
    todayBtn: { color: theme.colors.primary, fontWeight: '600', fontSize: 13 },
    body: { flex: 1, flexDirection: 'row' },
    // Label column
    labelCol: { width: LABEL_WIDTH, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: theme.colors.border, flexShrink: 0 },
    labelHeaderCell: { height: DATE_HEADER_HEIGHT, backgroundColor: theme.colors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border, justifyContent: 'center', paddingHorizontal: theme.spacing.sm },
    labelHeaderText: { ...theme.typography.caption, color: theme.colors.textMuted, fontWeight: '700' },
    labelGroupRow: { height: GROUP_ROW_HEIGHT, flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.spacing.sm, backgroundColor: theme.colors.inputBg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
    labelGroupDot: { width: 7, height: 7, borderRadius: 4, marginRight: 4 },
    labelGroupText: { ...theme.typography.caption, color: theme.colors.textMuted, fontWeight: '700', textTransform: 'uppercase', fontSize: 9, letterSpacing: 0.5, flex: 1 },
    labelGroupCount: { ...theme.typography.caption, color: theme.colors.textDisabled, fontSize: 9 },
    labelTaskRow: { height: ROW_HEIGHT, justifyContent: 'center', paddingHorizontal: theme.spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border + '50' },
    labelTaskText: { ...theme.typography.bodySmall, color: theme.colors.text, fontSize: 11 },
    labelTaskDone: { textDecorationLine: 'line-through', color: theme.colors.textMuted },
    // Timeline area
    timelineArea: { flex: 1, overflow: 'hidden' },
    dateHeaderScroll: { height: DATE_HEADER_HEIGHT, backgroundColor: theme.colors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
    dateCell: { width: DAY_WIDTH, height: DATE_HEADER_HEIGHT, alignItems: 'center', justifyContent: 'center' },
    dateCellToday: { backgroundColor: theme.colors.primaryLight + '80' },
    dateCellWeekend: { backgroundColor: theme.colors.border + '30' },
    dateCellText: { fontSize: 10, color: theme.colors.textMuted },
    dateCellTextToday: { color: theme.colors.primary, fontWeight: '700' },
    // Task bars inside timeline
    timelineCanvas: { width: totalTimelineWidth },
    groupCanvasRow: { height: GROUP_ROW_HEIGHT, backgroundColor: theme.colors.inputBg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border, position: 'relative', overflow: 'hidden' },
    taskCanvasRow: { height: ROW_HEIGHT, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border + '50', position: 'relative', overflow: 'hidden' },
    todayLineInRow: { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: theme.colors.primary + 'BB', zIndex: 10 },
    bar: { position: 'absolute', top: (ROW_HEIGHT - 22) / 2, height: 22, borderRadius: 6, justifyContent: 'center', paddingHorizontal: 5, zIndex: 2 },
    barText: { color: '#FFF', fontSize: 10, fontWeight: '600' },
    dot: { position: 'absolute', top: (ROW_HEIGHT - 10) / 2, width: 10, height: 10, borderRadius: 5, zIndex: 2 },
    // Empty
    emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: theme.spacing.md },
    emptyText: { ...theme.typography.body, color: theme.colors.textMuted, textAlign: 'center' },
  }), [theme, insets, totalTimelineWidth]);

  if (tasks.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Gantt Chart</Text>
        </View>
        <View style={styles.emptyWrap}>
          <Ionicons name="git-branch-outline" size={56} color={theme.colors.textDisabled} />
          <Text style={styles.emptyText}>No tasks yet. Create tasks with due dates to see them on the Gantt chart.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Gantt Chart</Text>
        <TouchableOpacity
          onPress={() => {
            const x = Math.max(0, todayColX - 80);
            dateHeaderRef.current?.scrollTo({ x, animated: true });
            timelineHRef.current?.scrollTo({ x, animated: true });
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.todayBtn}>Today</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        {/* ── Fixed label column ── */}
        <View style={styles.labelCol}>
          <View style={styles.labelHeaderCell}>
            <Text style={styles.labelHeaderText}>Task</Text>
          </View>
          <ScrollView
            ref={labelScrollRef}
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={onLabelScroll}
            bounces={false}
          >
            {rows.map((row, i) =>
              row.kind === 'group' ? (
                <View key={`g${i}`} style={styles.labelGroupRow}>
                  <View style={[styles.labelGroupDot, { backgroundColor: row.color }]} />
                  <Text style={styles.labelGroupText} numberOfLines={1}>{row.label}</Text>
                  <Text style={styles.labelGroupCount}>({row.count})</Text>
                </View>
              ) : (
                <TouchableOpacity
                  key={`t${row.task.id}`}
                  style={styles.labelTaskRow}
                  onPress={() => navigation.navigate('TaskEditor', { taskId: row.task.id })}
                  activeOpacity={0.6}
                >
                  <Text
                    style={[styles.labelTaskText, row.task.completed && styles.labelTaskDone]}
                    numberOfLines={2}
                  >
                    {row.task.title}
                  </Text>
                </TouchableOpacity>
              )
            )}
            <View style={{ height: 80 }} />
          </ScrollView>
        </View>

        {/* ── Timeline area ── */}
        <View style={styles.timelineArea}>
          {/* Date column headers — horizontal scroll only */}
          <ScrollView
            ref={dateHeaderRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={onDateHeaderHScroll}
            bounces={false}
            style={styles.dateHeaderScroll}
            contentContainerStyle={{ flexDirection: 'row' }}
          >
            {columns.map((col, i) => (
              <View
                key={i}
                style={[
                  styles.dateCell,
                  col.isToday && styles.dateCellToday,
                  col.isWeekend && !col.isToday && styles.dateCellWeekend,
                ]}
              >
                <Text style={[styles.dateCellText, col.isToday && styles.dateCellTextToday]}>
                  {col.label}
                </Text>
              </View>
            ))}
          </ScrollView>

          {/* Timeline body — vertical scroll, contains horizontal scroll for bars */}
          <ScrollView
            ref={timelineBodyRef}
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={onTimelineBodyScroll}
            bounces={false}
          >
            <ScrollView
              ref={timelineHRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              scrollEventThrottle={16}
              onScroll={onTimelineHScroll}
              bounces={false}
            >
              <View style={styles.timelineCanvas}>
                {rows.map((row, i) => {
                  const todayLineEl = (
                    <View
                      key="today"
                      style={[styles.todayLineInRow, { left: todayColX + DAY_WIDTH / 2 - 1 }]}
                    />
                  );
                  if (row.kind === 'group') {
                    return (
                      <View key={`g${i}`} style={styles.groupCanvasRow}>
                        {todayLineEl}
                      </View>
                    );
                  }

                  const task = row.task;
                  const barColor = PRIORITY_COLORS[task.priority] ?? row.groupColor;
                  const startCol = Math.max(0, colIndex(timelineStart, task.createdAt));
                  const endCol = task.dueDate != null
                    ? Math.min(DAYS_TOTAL - 1, colIndex(timelineStart, task.dueDate))
                    : null;

                  const visible = endCol !== null
                    ? endCol >= 0 && startCol < DAYS_TOTAL
                    : startCol >= 0 && startCol < DAYS_TOTAL;

                  return (
                    <View key={`t${task.id}`} style={styles.taskCanvasRow}>
                      {todayLineEl}
                      {visible && endCol !== null && (
                        <Pressable
                          style={[
                            styles.bar,
                            {
                              left: startCol * DAY_WIDTH + 2,
                              width: Math.max(20, (endCol - startCol + 1) * DAY_WIDTH - 4),
                              backgroundColor: task.completed ? theme.colors.textDisabled + 'BB' : barColor + 'DD',
                            },
                          ]}
                          onPress={() => navigation.navigate('TaskEditor', { taskId: task.id })}
                        >
                          <Text style={styles.barText} numberOfLines={1}>{task.title}</Text>
                        </Pressable>
                      )}
                      {visible && endCol === null && (
                        <View
                          style={[
                            styles.dot,
                            { left: startCol * DAY_WIDTH + (DAY_WIDTH - 10) / 2, backgroundColor: barColor },
                          ]}
                        />
                      )}
                    </View>
                  );
                })}
                <View style={{ height: 80 }} />
              </View>
            </ScrollView>
          </ScrollView>
        </View>
      </View>
    </View>
  );
}
