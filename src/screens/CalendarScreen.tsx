import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Icon } from '../components/Icons';
import { CalendarGrid } from '../components/CalendarGrid';
import { TaskCard } from '../components/TaskCard';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import type { RootStackParamList } from '../navigation/types';
import type { Task } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type ViewMode = 'month' | 'week' | 'agenda';

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function startOfWeek(d: Date, firstDay = 0): Date {
  const day = d.getDay();
  const diff = (day - firstDay + 7) % 7;
  const result = new Date(d);
  result.setDate(d.getDate() - diff);
  result.setHours(0, 0, 0, 0);
  return result;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function shortDateLabel(d: Date): string {
  const now = new Date();
  if (isSameDay(d, now)) return 'Today';
  if (isSameDay(d, addDays(now, 1))) return 'Tomorrow';
  if (isSameDay(d, addDays(now, -1))) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export function CalendarScreen() {
  const navigation = useNavigation<Nav>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { tasks, tasksForDate, toggleTaskComplete, getTaskCategory, settings } = useApp();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');

  const firstDay = settings.firstDayOfWeek ?? 0;

  // ── Task dots for monthly calendar ──────────────────────────────────────
  const taskDots = useMemo(() => {
    const map = new Map<string, string[]>();
    tasks.forEach((t) => {
      if (!t.dueDate) return;
      const d = new Date(t.dueDate);
      const key = dateKey(d);
      const cat = t.categoryId ? getTaskCategory(t.categoryId) : undefined;
      const color = cat?.color ?? theme.colors.primary;
      const existing = map.get(key) ?? [];
      existing.push(color);
      map.set(key, existing);
    });
    return map;
  }, [tasks, getTaskCategory, theme.colors.primary]);

  // ── Selected day tasks ───────────────────────────────────────────────────
  const selectedTasks = useMemo(
    () => tasksForDate(selectedDate.getTime()),
    [tasksForDate, selectedDate]
  );

  // ── Week days (7 days from week start) ──────────────────────────────────
  const weekDays = useMemo(() => {
    const start = startOfWeek(selectedDate, firstDay);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [selectedDate, firstDay]);

  // ── Agenda: next 30 days with tasks ─────────────────────────────────────
  const agendaItems = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const items: { date: Date; tasks: Task[] }[] = [];
    for (let i = -7; i <= 60; i++) {
      const d = addDays(today, i);
      const dayTasks = tasksForDate(d.getTime());
      if (dayTasks.length > 0) {
        items.push({ date: d, tasks: dayTasks });
      }
    }
    return items;
  }, [tasksForDate]);

  // ── Navigate week ────────────────────────────────────────────────────────
  const prevWeek = useCallback(() => setSelectedDate((d) => addDays(d, -7)), []);
  const nextWeek = useCallback(() => setSelectedDate((d) => addDays(d, 7)), []);

  const renderTaskItem = useCallback(({ item }: { item: Task }) => {
    const cat = item.categoryId ? getTaskCategory(item.categoryId) : undefined;
    return (
      <TaskCard
        task={item}
        category={cat}
        onToggle={() => toggleTaskComplete(item.id)}
        onPress={() => navigation.navigate('TaskEditor', { taskId: item.id })}
      />
    );
  }, [getTaskCategory, toggleTaskComplete, navigation]);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },

    // Header
    header: {
      paddingHorizontal: theme.spacing.lg,
      paddingTop: insets.top + theme.spacing.md,
      paddingBottom: theme.spacing.sm,
      backgroundColor: theme.colors.surface,
    },
    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    title: { ...theme.typography.title, color: theme.colors.text, fontSize: 26, fontWeight: '700' },

    // View mode tabs
    tabRow: {
      flexDirection: 'row',
      gap: theme.spacing.xs,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.sm,
      backgroundColor: theme.colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    tab: {
      flex: 1,
      paddingVertical: 7,
      borderRadius: theme.borderRadius.lg,
      alignItems: 'center',
      backgroundColor: theme.colors.inputBg,
    },
    tabActive: { backgroundColor: theme.colors.primary },
    tabText: { ...theme.typography.caption, color: theme.colors.textSecondary, fontWeight: '600' },
    tabTextActive: { color: '#FFF' },

    // Monthly
    calendarWrap: { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md },
    dayHeader: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md,
    },
    dayLabel: { ...theme.typography.titleSmall, color: theme.colors.text, fontWeight: '700' },
    taskCount: { ...theme.typography.caption, color: theme.colors.textMuted },
    list: { paddingHorizontal: theme.spacing.lg, paddingBottom: 100 },
    emptyDay: { alignItems: 'center', paddingTop: theme.spacing.xl, gap: theme.spacing.sm },
    emptyText: { ...theme.typography.bodySmall, color: theme.colors.textMuted },

    // Weekly
    weekNav: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.sm,
      backgroundColor: theme.colors.surface,
    },
    weekNavLabel: { ...theme.typography.body, color: theme.colors.text, fontWeight: '600' },
    weekDaysRow: {
      flexDirection: 'row',
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.sm,
      backgroundColor: theme.colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
      gap: 4,
    },
    weekDayCell: {
      flex: 1, alignItems: 'center', gap: 4,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.borderRadius.lg,
    },
    weekDayCellSelected: { backgroundColor: theme.colors.primaryLight },
    weekDayName: { ...theme.typography.overline, color: theme.colors.textMuted },
    weekDayNum: { ...theme.typography.body, color: theme.colors.text, fontWeight: '600' },
    weekDayNumSelected: { color: theme.colors.primary, fontWeight: '800' },
    weekDayNumToday: {
      backgroundColor: theme.colors.primary,
      color: '#FFF',
      width: 28, height: 28, borderRadius: 14,
      textAlign: 'center', lineHeight: 28,
      fontWeight: '700',
      overflow: 'hidden',
    },
    weekDotRow: { flexDirection: 'row', gap: 2, justifyContent: 'center' },
    weekDot: { width: 4, height: 4, borderRadius: 2 },
    weekContent: { flex: 1, paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md },

    // Agenda
    agendaContainer: { flex: 1, paddingBottom: 100 },
    agendaDateGroup: { marginBottom: theme.spacing.lg, paddingHorizontal: theme.spacing.lg },
    agendaDateHeader: {
      flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm,
      marginBottom: theme.spacing.sm,
    },
    agendaDateDot: { width: 10, height: 10, borderRadius: 5 },
    agendaDateLabel: { ...theme.typography.label, color: theme.colors.text, fontWeight: '700' },
    agendaDateSub: { ...theme.typography.caption, color: theme.colors.textMuted },
    agendaLine: {
      position: 'absolute', left: 20, top: 0, bottom: 0,
      width: 1, backgroundColor: theme.colors.border,
    },
    agendaEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: theme.spacing.md },
    agendaEmptyText: { ...theme.typography.body, color: theme.colors.textMuted },
    agendaEmptyHint: { ...theme.typography.caption, color: theme.colors.textDisabled },

    // FAB
    fab: {
      position: 'absolute',
      bottom: insets.bottom + theme.spacing.xl,
      right: theme.spacing.lg,
      width: 56, height: 56, borderRadius: 28,
      backgroundColor: theme.colors.primary,
      alignItems: 'center', justifyContent: 'center',
      ...theme.shadows.fab,
    },
  }), [theme, insets]);

  // ── Today shortcut ───────────────────────────────────────────────────────
  const isToday = isSameDay(selectedDate, new Date());

  // ── Weekly view month/week label ─────────────────────────────────────────
  const weekLabel = useMemo(() => {
    const start = weekDays[0];
    const end = weekDays[6];
    if (start.getMonth() === end.getMonth()) {
      return start.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    }
    return `${start.toLocaleDateString(undefined, { month: 'short' })} – ${end.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}`;
  }, [weekDays]);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Calendar</Text>
          {!isToday && (
            <TouchableOpacity
              onPress={() => setSelectedDate(new Date())}
              style={{ paddingHorizontal: theme.spacing.md, paddingVertical: 6, borderRadius: theme.borderRadius.full, backgroundColor: theme.colors.primaryLight }}
            >
              <Text style={{ ...theme.typography.caption, color: theme.colors.primary, fontWeight: '700' }}>Today</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* View mode tabs */}
      <View style={styles.tabRow}>
        {(['month', 'week', 'agenda'] as ViewMode[]).map((mode) => (
          <TouchableOpacity
            key={mode}
            style={[styles.tab, viewMode === mode && styles.tabActive]}
            onPress={() => setViewMode(mode)}
          >
            <Text style={[styles.tabText, viewMode === mode && styles.tabTextActive]}>
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── MONTHLY VIEW ── */}
      {viewMode === 'month' && (
        <FlatList
          ListHeaderComponent={
            <>
              <View style={styles.calendarWrap}>
                <CalendarGrid
                  selectedDate={selectedDate}
                  onSelectDate={setSelectedDate}
                  onMonthChange={setSelectedDate}
                  taskDots={taskDots}
                  firstDayOfWeek={firstDay}
                />
              </View>
              <View style={styles.dayHeader}>
                <Text style={styles.dayLabel}>{shortDateLabel(selectedDate)}</Text>
                <Text style={styles.taskCount}>{selectedTasks.length} task{selectedTasks.length !== 1 ? 's' : ''}</Text>
              </View>
            </>
          }
          data={selectedTasks}
          renderItem={renderTaskItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyDay}>
              <Icon name="calendar" size={40} color={theme.colors.textDisabled} />
              <Text style={styles.emptyText}>No tasks for this day</Text>
            </View>
          }
        />
      )}

      {/* ── WEEKLY VIEW ── */}
      {viewMode === 'week' && (
        <>
          {/* Week navigation */}
          <View style={styles.weekNav}>
            <TouchableOpacity onPress={prevWeek} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="chevron-back" size={22} color={theme.colors.text} />
            </TouchableOpacity>
            <Text style={styles.weekNavLabel}>{weekLabel}</Text>
            <TouchableOpacity onPress={nextWeek} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="chevron-forward" size={22} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          {/* Day columns */}
          <View style={styles.weekDaysRow}>
            {weekDays.map((day) => {
              const isSelected = isSameDay(day, selectedDate);
              const isTodayDay = isSameDay(day, new Date());
              const dayTasks = tasksForDate(day.getTime());
              const dots = dayTasks.slice(0, 3).map((t) => {
                const cat = t.categoryId ? getTaskCategory(t.categoryId) : undefined;
                return cat?.color ?? theme.colors.primary;
              });
              return (
                <TouchableOpacity
                  key={dateKey(day)}
                  style={[styles.weekDayCell, isSelected && styles.weekDayCellSelected]}
                  onPress={() => setSelectedDate(day)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.weekDayName}>
                    {day.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 2).toUpperCase()}
                  </Text>
                  <Text style={[
                    styles.weekDayNum,
                    isSelected && styles.weekDayNumSelected,
                    isTodayDay && !isSelected && styles.weekDayNumToday,
                  ]}>
                    {day.getDate()}
                  </Text>
                  <View style={styles.weekDotRow}>
                    {dots.map((c, i) => (
                      <View key={i} style={[styles.weekDot, { backgroundColor: c }]} />
                    ))}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Selected day tasks */}
          <FlatList
            style={styles.weekContent}
            data={selectedTasks}
            renderItem={renderTaskItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: 100 }}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <View style={[styles.dayHeader, { paddingHorizontal: 0 }]}>
                <Text style={styles.dayLabel}>{shortDateLabel(selectedDate)}</Text>
                <Text style={styles.taskCount}>{selectedTasks.length} task{selectedTasks.length !== 1 ? 's' : ''}</Text>
              </View>
            }
            ListEmptyComponent={
              <View style={styles.emptyDay}>
                <Icon name="calendar" size={36} color={theme.colors.textDisabled} />
                <Text style={styles.emptyText}>No tasks this day</Text>
              </View>
            }
          />
        </>
      )}

      {/* ── AGENDA VIEW ── */}
      {viewMode === 'agenda' && (
        agendaItems.length === 0 ? (
          <View style={styles.agendaEmpty}>
            <Ionicons name="list-outline" size={64} color={theme.colors.textDisabled} />
            <Text style={styles.agendaEmptyText}>No upcoming tasks</Text>
            <Text style={styles.agendaEmptyHint}>Add tasks with due dates to see them here</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={[styles.agendaContainer, { paddingTop: theme.spacing.md }]} showsVerticalScrollIndicator={false}>
            {agendaItems.map(({ date, tasks: dayTasks }) => {
              const isSelectedDay = isSameDay(date, selectedDate);
              const isTodayDay = isSameDay(date, new Date());
              return (
                <View key={dateKey(date)} style={styles.agendaDateGroup}>
                  {/* Date header */}
                  <TouchableOpacity
                    style={styles.agendaDateHeader}
                    onPress={() => { setSelectedDate(date); setViewMode('month'); }}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.agendaDateDot, {
                      backgroundColor: isTodayDay ? theme.colors.primary : isSelectedDay ? theme.colors.accent ?? '#F59E0B' : theme.colors.border,
                      width: isTodayDay ? 12 : 10,
                      height: isTodayDay ? 12 : 10,
                      borderRadius: isTodayDay ? 6 : 5,
                    }]} />
                    <Text style={[styles.agendaDateLabel, isTodayDay && { color: theme.colors.primary }]}>
                      {shortDateLabel(date)}
                    </Text>
                    <Text style={styles.agendaDateSub}>
                      {date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </Text>
                    <View style={{ flex: 1 }} />
                    <Text style={styles.taskCount}>{dayTasks.length} task{dayTasks.length !== 1 ? 's' : ''}</Text>
                  </TouchableOpacity>

                  {/* Tasks for this day */}
                  {dayTasks.map((task) => {
                    const cat = task.categoryId ? getTaskCategory(task.categoryId) : undefined;
                    return (
                      <View key={task.id} style={{ marginLeft: 18, marginBottom: 6 }}>
                        <TaskCard
                          task={task}
                          category={cat}
                          onToggle={() => toggleTaskComplete(task.id)}
                          onPress={() => navigation.navigate('TaskEditor', { taskId: task.id })}
                        />
                      </View>
                    );
                  })}
                </View>
              );
            })}
          </ScrollView>
        )
      )}

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('TaskEditor', { date: selectedDate.getTime() })}
        activeOpacity={0.8}
      >
        <Icon name="add" size={28} color="#FFF" />
      </TouchableOpacity>
    </View>
  );
}
