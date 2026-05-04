import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal,
  TextInput, Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';
import { useFeatures } from '../context/FeaturesContext';
import { storage } from '../services/storage';
import {
  getGoals, addGoal, deleteGoal, periodRange, GOAL_METRICS,
  type Goal, type GoalMetric, type GoalPeriod,
} from '../services/goalService';
import type { PomodoroSession } from '../types';

export function GoalsScreen() {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { tasks, notes, settings } = useApp();
  const { habits } = useFeatures();

  const [goals, setGoals] = useState<Goal[]>([]);
  const [pomodoroSessions, setPomodoroSessions] = useState<PomodoroSession[]>([]);
  const [showAdd, setShowAdd] = useState(false);

  // Add-goal form state
  const [title, setTitle] = useState('');
  const [metric, setMetric] = useState<GoalMetric>('tasks_completed');
  const [target, setTarget] = useState('5');
  const [period, setPeriod] = useState<GoalPeriod>('weekly');

  useEffect(() => {
    getGoals().then(setGoals);
    storage.getPomodoroSessions().then(setPomodoroSessions);
  }, []);

  const computeProgress = (g: Goal): number => {
    const { start, end } = periodRange(g.period, settings.firstDayOfWeek);
    switch (g.metric) {
      case 'tasks_completed':
        return tasks.filter(t => t.completed && t.updatedAt >= start && t.updatedAt < end).length;
      case 'focus_minutes':
        return pomodoroSessions
          .filter(s => s.type === 'work' && s.completedAt >= start && s.completedAt < end)
          .reduce((sum, s) => sum + s.duration, 0);
      case 'notes_created':
        return notes.filter(n => n.createdAt >= start && n.createdAt < end).length;
      case 'habits_completed': {
        // Count check-ins in the date range across all habits
        const startDate = new Date(start);
        const endDate = new Date(end);
        let count = 0;
        habits.forEach(h => {
          h.completedDates.forEach(ds => {
            const d = new Date(ds + 'T12:00:00').getTime();
            if (d >= startDate.getTime() && d < endDate.getTime()) count += 1;
          });
        });
        return count;
      }
    }
  };

  const handleAdd = async () => {
    const t = parseInt(target, 10);
    if (!title.trim()) { Alert.alert('Title required'); return; }
    if (!t || t <= 0) { Alert.alert('Target must be a positive number'); return; }
    const meta = GOAL_METRICS.find(m => m.id === metric)!;
    await addGoal({ title: title.trim(), metric, target: t, period, color: meta.color });
    setGoals(await getGoals());
    setTitle(''); setTarget('5'); setMetric('tasks_completed'); setPeriod('weekly');
    setShowAdd(false);
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete goal?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await deleteGoal(id);
        setGoals(await getGoals());
      }},
    ]);
  };

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
    addBtn: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: theme.colors.primary,
      alignItems: 'center', justifyContent: 'center',
    },
    scroll: { flex: 1 },
    content: { padding: theme.spacing.lg, gap: theme.spacing.md, paddingBottom: 80 },
    empty: { alignItems: 'center', paddingTop: 60, gap: 10 },
    emptyText: { fontSize: 14, color: theme.colors.textMuted, textAlign: 'center' },
    emptyBtn: {
      marginTop: 12, paddingHorizontal: 20, paddingVertical: 12,
      borderRadius: theme.borderRadius.full, backgroundColor: theme.colors.primary,
    },
    emptyBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
    goalCard: {
      backgroundColor: theme.colors.cardBg,
      borderRadius: theme.borderRadius.xl,
      padding: theme.spacing.lg,
      ...theme.shadows.card,
      gap: 10,
    },
    goalHeader: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
    goalIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    goalTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: theme.colors.text },
    goalPeriod: { fontSize: 11, fontWeight: '700', color: theme.colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
    progressRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
    progressValue: { fontSize: 24, fontWeight: '900', color: theme.colors.text, fontVariant: ['tabular-nums'] },
    progressTarget: { fontSize: 14, color: theme.colors.textMuted, fontWeight: '600' },
    progressBar: { height: 8, borderRadius: 4, backgroundColor: theme.colors.inputBg, overflow: 'hidden' },
    progressFill: { height: '100%', borderRadius: 4 },
    completeBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      alignSelf: 'flex-start',
      paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
      backgroundColor: '#10B981' + '20',
    },
    completeBadgeText: { color: '#10B981', fontSize: 11, fontWeight: '800' },
    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheet: { backgroundColor: theme.colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 14 },
    sheetTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.text },
    label: { fontSize: 12, fontWeight: '700', color: theme.colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
    input: { backgroundColor: theme.colors.inputBg, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: theme.colors.text },
    metricRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    metricChip: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10,
      backgroundColor: theme.colors.inputBg,
    },
    metricChipSelected: { backgroundColor: theme.colors.primary },
    metricChipText: { fontSize: 12, fontWeight: '700', color: theme.colors.text },
    metricChipTextSelected: { color: '#FFF' },
    periodRow: { flexDirection: 'row', gap: 8 },
    periodChip: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10, backgroundColor: theme.colors.inputBg },
    periodChipSelected: { backgroundColor: theme.colors.primary },
    periodChipText: { fontSize: 13, fontWeight: '700', color: theme.colors.text },
    periodChipTextSelected: { color: '#FFF' },
    primary: { backgroundColor: theme.colors.primary, borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
    primaryText: { color: '#FFF', fontWeight: '800', fontSize: 15 },
    secondary: { alignItems: 'center', paddingVertical: 10 },
    secondaryText: { color: theme.colors.textMuted, fontSize: 14 },
  }), [theme, insets]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Goals</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowAdd(true)}>
          <Ionicons name="add" size={22} color="#FFF" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {goals.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="trophy-outline" size={56} color={theme.colors.textDisabled} />
            <Text style={styles.emptyText}>No goals yet.{'\n'}Set a weekly or monthly target to track your progress.</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => setShowAdd(true)}>
              <Text style={styles.emptyBtnText}>Add Your First Goal</Text>
            </TouchableOpacity>
          </View>
        ) : (
          goals.map(g => {
            const meta = GOAL_METRICS.find(m => m.id === g.metric)!;
            const progress = computeProgress(g);
            const pct = Math.min(100, Math.round((progress / g.target) * 100));
            const isComplete = progress >= g.target;
            return (
              <TouchableOpacity
                key={g.id}
                style={styles.goalCard}
                onLongPress={() => handleDelete(g.id)}
                activeOpacity={0.85}
              >
                <View style={styles.goalHeader}>
                  <View style={[styles.goalIcon, { backgroundColor: (g.color ?? meta.color) + '20' }]}>
                    <Ionicons name={meta.icon as any} size={20} color={g.color ?? meta.color} />
                  </View>
                  <Text style={styles.goalTitle} numberOfLines={1}>{g.title}</Text>
                  <Text style={styles.goalPeriod}>{g.period}</Text>
                </View>
                <View style={styles.progressRow}>
                  <Text style={styles.progressValue}>{progress}</Text>
                  <Text style={styles.progressTarget}>/ {g.target} {meta.unit}</Text>
                </View>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: g.color ?? meta.color }]} />
                </View>
                {isComplete && (
                  <View style={styles.completeBadge}>
                    <Ionicons name="checkmark-circle" size={12} color="#10B981" />
                    <Text style={styles.completeBadgeText}>COMPLETED</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      <Modal visible={showAdd} transparent animationType="slide" onRequestClose={() => setShowAdd(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>New Goal</Text>

            <View>
              <Text style={styles.label}>Title</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="e.g., Finish 10 tasks this week"
                placeholderTextColor={theme.colors.textMuted}
              />
            </View>

            <View>
              <Text style={styles.label}>Metric</Text>
              <View style={styles.metricRow}>
                {GOAL_METRICS.map(m => {
                  const isSel = metric === m.id;
                  return (
                    <TouchableOpacity
                      key={m.id}
                      style={[styles.metricChip, isSel && styles.metricChipSelected]}
                      onPress={() => setMetric(m.id)}
                    >
                      <Ionicons name={m.icon as any} size={14} color={isSel ? '#FFF' : m.color} />
                      <Text style={[styles.metricChipText, isSel && styles.metricChipTextSelected]}>{m.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View>
              <Text style={styles.label}>Target</Text>
              <TextInput
                style={styles.input}
                value={target}
                onChangeText={setTarget}
                keyboardType="number-pad"
                maxLength={4}
              />
            </View>

            <View>
              <Text style={styles.label}>Period</Text>
              <View style={styles.periodRow}>
                {(['weekly', 'monthly'] as GoalPeriod[]).map(p => {
                  const isSel = period === p;
                  return (
                    <TouchableOpacity
                      key={p}
                      style={[styles.periodChip, isSel && styles.periodChipSelected]}
                      onPress={() => setPeriod(p)}
                    >
                      <Text style={[styles.periodChipText, isSel && styles.periodChipTextSelected]}>
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <TouchableOpacity style={styles.primary} onPress={handleAdd}>
              <Text style={styles.primaryText}>Add Goal</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondary} onPress={() => setShowAdd(false)}>
              <Text style={styles.secondaryText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
