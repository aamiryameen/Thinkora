import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useApp } from '../context/AppContext';
import { useFeatures } from '../context/FeaturesContext';
import { useTheme } from '../context/ThemeContext';
import { WeeklyBarChart } from '../components/DashboardCharts';

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function ReportsScreen() {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { tasks, notes, taskStats, taskCategories } = useApp();
  const { habits, pomodoroSessions, journalEntries, getHabitStreak } = useFeatures();

  const now = new Date();

  // Weekly stats
  const weeklyTasksCreated = useMemo(() => {
    const data: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const start = d.getTime();
      const end = start + 86400000;
      data.push(tasks.filter((t) => t.createdAt >= start && t.createdAt < end).length);
    }
    return data;
  }, [tasks]);

  const weekLabels = useMemo(() => {
    const labels: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      labels.push(d.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 3));
    }
    return labels;
  }, []);

  // Monthly stats
  const thisMonth = useMemo(() => {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const tasksCreated = tasks.filter((t) => t.createdAt >= monthStart).length;
    const tasksCompleted = tasks.filter((t) => t.completed && t.updatedAt >= monthStart).length;
    const notesCreated = notes.filter((n) => n.createdAt >= monthStart).length;
    const pomodoroCount = pomodoroSessions.filter((p) => p.completedAt >= monthStart && p.type === 'work').length;
    const pomodoroMinutes = pomodoroCount * (25);
    const journalDays = journalEntries.filter((e) => e.createdAt >= monthStart).length;
    return { tasksCreated, tasksCompleted, notesCreated, pomodoroCount, pomodoroMinutes, journalDays };
  }, [tasks, notes, pomodoroSessions, journalEntries]);

  // Best habit streak
  const bestStreak = useMemo(() => {
    if (habits.length === 0) return { name: '—', streak: 0 };
    let best = { name: '', streak: 0 };
    habits.forEach((h) => {
      const s = getHabitStreak(h);
      if (s > best.streak) best = { name: h.name, streak: s };
    });
    return best;
  }, [habits, getHabitStreak]);

  // Completion rate
  const completionRate = useMemo(() => {
    const total = tasks.length;
    if (total === 0) return 0;
    return Math.round((tasks.filter((t) => t.completed).length / total) * 100);
  }, [tasks]);

  // Category breakdown
  const categoryBreakdown = useMemo(() => {
    return taskCategories.map((cat) => ({
      name: cat.name,
      color: cat.color,
      count: tasks.filter((t) => t.categoryId === cat.id).length,
    })).filter((c) => c.count > 0).sort((a, b) => b.count - a.count);
  }, [tasks, taskCategories]);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    header: { paddingHorizontal: theme.spacing.lg, paddingTop: insets.top + theme.spacing.md, paddingBottom: theme.spacing.md, backgroundColor: theme.colors.surface },
    title: { ...theme.typography.title, color: theme.colors.text, fontSize: 26, fontWeight: '700' },
    subtitle: { ...theme.typography.caption, color: theme.colors.textMuted },
    scroll: { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.lg, paddingBottom: 120, gap: theme.spacing.lg },
    card: { backgroundColor: theme.colors.cardBg, borderRadius: theme.borderRadius.xl, padding: theme.spacing.lg, ...theme.shadows.card },
    cardTitle: { ...theme.typography.titleSmall, color: theme.colors.text, marginBottom: theme.spacing.md },
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
    statItem: { width: '47%', backgroundColor: theme.colors.inputBg, borderRadius: theme.borderRadius.lg, padding: theme.spacing.md, alignItems: 'center', gap: 4 },
    statIcon: { marginBottom: 4 },
    statNum: { ...theme.typography.title, color: theme.colors.text, fontWeight: '800' },
    statLabel: { ...theme.typography.caption, color: theme.colors.textMuted, textAlign: 'center' },
    rateCard: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.lg },
    rateCircle: { width: 80, height: 80, borderRadius: 40, borderWidth: 6, alignItems: 'center', justifyContent: 'center' },
    ratePercent: { ...theme.typography.titleSmall, fontWeight: '800' },
    rateText: { flex: 1 },
    rateTitle: { ...theme.typography.body, color: theme.colors.text, fontWeight: '600' },
    rateDesc: { ...theme.typography.caption, color: theme.colors.textMuted, marginTop: 2 },
    catRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, paddingVertical: theme.spacing.sm },
    catDot: { width: 12, height: 12, borderRadius: 6 },
    catName: { ...theme.typography.body, color: theme.colors.text, flex: 1 },
    catCount: { ...theme.typography.body, color: theme.colors.textSecondary, fontWeight: '600' },
    catBar: { height: 6, borderRadius: 3, marginTop: 2 },
  }), [theme, insets]);

  const rateColor = completionRate >= 70 ? theme.colors.success : completionRate >= 40 ? theme.colors.warning : theme.colors.error;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Reports</Text>
        </View>
        <Text style={styles.subtitle}>Your productivity insights</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Completion rate */}
        <View style={styles.card}>
          <View style={styles.rateCard}>
            <View style={[styles.rateCircle, { borderColor: rateColor }]}>
              <Text style={[styles.ratePercent, { color: rateColor }]}>{completionRate}%</Text>
            </View>
            <View style={styles.rateText}>
              <Text style={styles.rateTitle}>Completion Rate</Text>
              <Text style={styles.rateDesc}>{taskStats.completed} of {tasks.length} tasks completed</Text>
            </View>
          </View>
        </View>

        {/* This month */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>This Month</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Ionicons name="checkbox-outline" size={22} color={theme.colors.primary} style={styles.statIcon} />
              <Text style={styles.statNum}>{thisMonth.tasksCompleted}</Text>
              <Text style={styles.statLabel}>Tasks Done</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="add-circle-outline" size={22} color={theme.colors.accent} style={styles.statIcon} />
              <Text style={styles.statNum}>{thisMonth.tasksCreated}</Text>
              <Text style={styles.statLabel}>Tasks Created</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="timer-outline" size={22} color="#14B8A6" style={styles.statIcon} />
              <Text style={styles.statNum}>{thisMonth.pomodoroMinutes}m</Text>
              <Text style={styles.statLabel}>Focus Time</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="document-text-outline" size={22} color="#8B5CF6" style={styles.statIcon} />
              <Text style={styles.statNum}>{thisMonth.notesCreated}</Text>
              <Text style={styles.statLabel}>Notes</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="happy-outline" size={22} color="#EC4899" style={styles.statIcon} />
              <Text style={styles.statNum}>{thisMonth.journalDays}</Text>
              <Text style={styles.statLabel}>Journal Days</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="flame-outline" size={22} color="#F59E0B" style={styles.statIcon} />
              <Text style={styles.statNum}>{bestStreak.streak}d</Text>
              <Text style={styles.statLabel}>Best Streak</Text>
            </View>
          </View>
        </View>

        {/* Weekly chart */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Tasks Completed This Week</Text>
          <WeeklyBarChart data={taskStats.weeklyCompleted} labels={weekLabels} />
        </View>

        {/* Tasks created chart */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Tasks Created This Week</Text>
          <WeeklyBarChart data={weeklyTasksCreated} labels={weekLabels} />
        </View>

        {/* Category breakdown */}
        {categoryBreakdown.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Tasks by Category</Text>
            {categoryBreakdown.map((cat) => (
              <View key={cat.name}>
                <View style={styles.catRow}>
                  <View style={[styles.catDot, { backgroundColor: cat.color }]} />
                  <Text style={styles.catName}>{cat.name}</Text>
                  <Text style={styles.catCount}>{cat.count}</Text>
                </View>
                <View style={[styles.catBar, { backgroundColor: cat.color + '30', width: '100%' }]}>
                  <View style={[styles.catBar, { backgroundColor: cat.color, width: `${Math.min((cat.count / Math.max(...categoryBreakdown.map((c) => c.count))) * 100, 100)}%` }]} />
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
