import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';
import { useFeatures } from '../context/FeaturesContext';
import { storage } from '../services/storage';
import { getAllTimeRecords, formatDuration } from '../services/timeTrackingService';
import { HeatMapCalendar } from '../components/HeatMapCalendar';
import type { PomodoroSession } from '../types';

interface DayStat {
  label: string;        // 'Mon'
  date: string;         // 'YYYY-MM-DD'
  tasksDone: number;
  notesCreated: number;
  pomodoroMins: number;
  habitsCompleted: number;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function ProductivityStatsScreen() {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { tasks, notes } = useApp();
  const { habits } = useFeatures();

  const [pomodoroSessions, setPomodoroSessions] = useState<PomodoroSession[]>([]);
  const [totalTrackedSeconds, setTotalTrackedSeconds] = useState(0);
  const [taskTrackedSeconds, setTaskTrackedSeconds] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const sessions = await storage.getPomodoroSessions();
        setPomodoroSessions(sessions);
        const records = await getAllTimeRecords(tasks.map(t => t.id));
        let total = 0;
        const perTask: Record<string, number> = {};
        Object.entries(records).forEach(([id, rec]) => {
          total += rec.totalSeconds;
          perTask[id] = rec.totalSeconds;
        });
        setTotalTrackedSeconds(total);
        setTaskTrackedSeconds(perTask);
      } finally {
        setLoading(false);
      }
    })();
  }, [tasks]);

  // Last 7 days breakdown
  const last7Days = useMemo<DayStat[]>(() => {
    const days: DayStat[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const key = ymd(d);
      const dayStart = d.getTime();
      const dayEnd = dayStart + 86400000;

      const tasksDone = tasks.filter(t => t.completed && t.updatedAt >= dayStart && t.updatedAt < dayEnd).length;
      const notesCreated = notes.filter(n => n.createdAt >= dayStart && n.createdAt < dayEnd).length;
      const pomodoroMins = pomodoroSessions
        .filter(s => s.type === 'work' && s.completedAt >= dayStart && s.completedAt < dayEnd)
        .reduce((sum, s) => sum + s.duration, 0);
      const habitsCompleted = habits.filter(h => h.completedDates.includes(key)).length;

      days.push({
        label: DAY_LABELS[d.getDay()],
        date: key,
        tasksDone, notesCreated, pomodoroMins, habitsCompleted,
      });
    }
    return days;
  }, [tasks, notes, habits, pomodoroSessions]);

  // Most active day (by tasks completed)
  const mostActiveDay = useMemo(() => {
    const byDay = [0, 0, 0, 0, 0, 0, 0]; // Sun-Sat
    tasks.filter(t => t.completed).forEach(t => {
      const d = new Date(t.updatedAt).getDay();
      byDay[d] += 1;
    });
    const maxIdx = byDay.indexOf(Math.max(...byDay));
    return { day: DAY_LABELS[maxIdx], count: byDay[maxIdx] };
  }, [tasks]);

  // Best focus hour (most pomodoro sessions started in this hour)
  const bestFocusHour = useMemo(() => {
    const byHour = new Array(24).fill(0);
    pomodoroSessions.filter(s => s.type === 'work').forEach(s => {
      const h = new Date(s.completedAt).getHours();
      byHour[h] += 1;
    });
    const maxIdx = byHour.indexOf(Math.max(...byHour));
    if (byHour[maxIdx] === 0) return null;
    const hourLabel = (h: number) => {
      if (h === 0) return '12am';
      if (h === 12) return '12pm';
      return h > 12 ? `${h - 12}pm` : `${h}am`;
    };
    return { hour: hourLabel(maxIdx), count: byHour[maxIdx] };
  }, [pomodoroSessions]);

  const completionRate = useMemo(() => {
    if (tasks.length === 0) return 0;
    return Math.round((tasks.filter(t => t.completed).length / tasks.length) * 100);
  }, [tasks]);

  const avgSessionMins = useMemo(() => {
    const work = pomodoroSessions.filter(s => s.type === 'work');
    if (work.length === 0) return 0;
    return Math.round(work.reduce((sum, s) => sum + s.duration, 0) / work.length);
  }, [pomodoroSessions]);

  // Heat map data: tasks completed + pomodoro sessions + habit check-ins per day
  const heatmapData = useMemo(() => {
    const map: Record<string, number> = {};
    const add = (ts: number, weight: number = 1) => {
      const d = new Date(ts);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      map[key] = (map[key] ?? 0) + weight;
    };
    tasks.filter(t => t.completed).forEach(t => add(t.updatedAt, 1));
    pomodoroSessions.filter(s => s.type === 'work').forEach(s => add(s.completedAt, 1));
    notes.forEach(n => add(n.createdAt, 1));
    habits.forEach(h => h.completedDates.forEach(ds => {
      map[ds] = (map[ds] ?? 0) + 1;
    }));
    return Object.entries(map).map(([date, count]) => ({ date, count }));
  }, [tasks, pomodoroSessions, notes, habits]);

  const topTrackedTasks = useMemo(() => {
    return Object.entries(taskTrackedSeconds)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, sec]) => ({ task: tasks.find(t => t.id === id), seconds: sec }))
      .filter(item => item.task);
  }, [taskTrackedSeconds, tasks]);

  // Find max value for the bar chart scaling
  const maxBarValue = Math.max(...last7Days.map(d => d.tasksDone + d.habitsCompleted + Math.ceil(d.pomodoroMins / 25)), 1);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    header: {
      flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      paddingTop: insets.top + theme.spacing.md,
      paddingBottom: theme.spacing.md,
      backgroundColor: theme.colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    headerTitle: { ...theme.typography.title, fontSize: 22, fontWeight: '700', color: theme.colors.text, flex: 1 },
    scroll: { flex: 1 },
    content: { padding: theme.spacing.lg, gap: theme.spacing.lg, paddingBottom: 80 },
    sectionLabel: { ...theme.typography.overline, color: theme.colors.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: theme.spacing.xs },
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
    statCard: {
      flex: 1, minWidth: '45%',
      backgroundColor: theme.colors.cardBg,
      borderRadius: theme.borderRadius.xl,
      padding: theme.spacing.lg,
      ...theme.shadows.card,
    },
    statValue: { fontSize: 28, fontWeight: '900', color: theme.colors.text },
    statLabel: { fontSize: 12, fontWeight: '600', color: theme.colors.textMuted, marginTop: 4 },
    statIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
    chartCard: {
      backgroundColor: theme.colors.cardBg,
      borderRadius: theme.borderRadius.xl,
      padding: theme.spacing.lg,
      ...theme.shadows.card,
    },
    chartTitle: { fontSize: 14, fontWeight: '700', color: theme.colors.text, marginBottom: theme.spacing.md },
    barRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 120, marginBottom: 8 },
    barCol: { flex: 1, alignItems: 'center', gap: 4 },
    bar: { width: '60%', backgroundColor: theme.colors.primary, borderRadius: 4, minHeight: 2 },
    barLabel: { fontSize: 10, color: theme.colors.textMuted, fontWeight: '600' },
    legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendText: { fontSize: 11, color: theme.colors.textMuted, fontWeight: '600' },
    insightCard: {
      flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md,
      backgroundColor: theme.colors.primary + '10',
      borderRadius: theme.borderRadius.xl,
      padding: theme.spacing.lg,
      borderLeftWidth: 4,
      borderLeftColor: theme.colors.primary,
    },
    insightTitle: { fontSize: 14, fontWeight: '800', color: theme.colors.text },
    insightSub: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
    taskRow: {
      flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm,
      paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    taskTitle: { flex: 1, fontSize: 13, fontWeight: '600', color: theme.colors.text },
    taskTime: { fontSize: 12, fontWeight: '700', color: theme.colors.primary, fontVariant: ['tabular-nums'] },
    empty: { alignItems: 'center', padding: 40, gap: 8 },
    emptyText: { fontSize: 13, color: theme.colors.textMuted },
  }), [theme, insets]);

  if (loading) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Productivity Stats</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Top stats grid */}
        <View>
          <Text style={styles.sectionLabel}>Overview</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#10B98120' }]}>
                <Ionicons name="checkmark-circle" size={20} color="#10B981" />
              </View>
              <Text style={styles.statValue}>{completionRate}%</Text>
              <Text style={styles.statLabel}>Completion Rate</Text>
            </View>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#6366F120' }]}>
                <Ionicons name="time" size={20} color="#6366F1" />
              </View>
              <Text style={styles.statValue}>{formatDuration(totalTrackedSeconds)}</Text>
              <Text style={styles.statLabel}>Total Tracked</Text>
            </View>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#F59E0B20' }]}>
                <Ionicons name="timer" size={20} color="#F59E0B" />
              </View>
              <Text style={styles.statValue}>{pomodoroSessions.filter(s => s.type === 'work').length}</Text>
              <Text style={styles.statLabel}>Focus Sessions</Text>
            </View>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#EC489920' }]}>
                <Ionicons name="hourglass" size={20} color="#EC4899" />
              </View>
              <Text style={styles.statValue}>{avgSessionMins}m</Text>
              <Text style={styles.statLabel}>Avg Session</Text>
            </View>
          </View>
        </View>

        {/* Insights */}
        {(mostActiveDay.count > 0 || bestFocusHour) && (
          <View>
            <Text style={styles.sectionLabel}>Insights</Text>
            <View style={{ gap: 10 }}>
              {mostActiveDay.count > 0 && (
                <View style={styles.insightCard}>
                  <View style={[styles.statIcon, { backgroundColor: '#3B82F620' }]}>
                    <Ionicons name="trophy" size={20} color="#3B82F6" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.insightTitle}>Most Productive Day</Text>
                    <Text style={styles.insightSub}>You complete the most tasks on {mostActiveDay.day}s ({mostActiveDay.count} tasks)</Text>
                  </View>
                </View>
              )}
              {bestFocusHour && (
                <View style={styles.insightCard}>
                  <View style={[styles.statIcon, { backgroundColor: '#10B98120' }]}>
                    <Ionicons name="flash" size={20} color="#10B981" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.insightTitle}>Best Focus Hour</Text>
                    <Text style={styles.insightSub}>You're most focused around {bestFocusHour.hour} ({bestFocusHour.count} sessions)</Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        )}

        {/* 7-day chart */}
        <View>
          <Text style={styles.sectionLabel}>Last 7 Days</Text>
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Activity</Text>
            <View style={styles.barRow}>
              {last7Days.map(day => {
                const total = day.tasksDone + day.habitsCompleted + Math.ceil(day.pomodoroMins / 25);
                const heightPct = (total / maxBarValue) * 100;
                return (
                  <View key={day.date} style={styles.barCol}>
                    <View style={[styles.bar, { height: `${Math.max(2, heightPct)}%` }]} />
                    <Text style={styles.barLabel}>{day.label}</Text>
                  </View>
                );
              })}
            </View>
            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: theme.colors.primary }]} />
                <Text style={styles.legendText}>Tasks + Habits + Focus blocks</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Heat map */}
        <View>
          <Text style={styles.sectionLabel}>Activity</Text>
          <HeatMapCalendar data={heatmapData} weeks={26} />
        </View>

        {/* Top time-tracked tasks */}
        <View>
          <Text style={styles.sectionLabel}>Most Time Spent</Text>
          <View style={styles.chartCard}>
            {topTrackedTasks.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="time-outline" size={36} color={theme.colors.textDisabled} />
                <Text style={styles.emptyText}>Start tracking time on your tasks to see stats here</Text>
              </View>
            ) : (
              topTrackedTasks.map(({ task, seconds }) => (
                <View key={task!.id} style={styles.taskRow}>
                  <Ionicons name="ellipse" size={8} color={theme.colors.primary} />
                  <Text numberOfLines={1} style={styles.taskTitle}>{task!.title}</Text>
                  <Text style={styles.taskTime}>{formatDuration(seconds)}</Text>
                </View>
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
