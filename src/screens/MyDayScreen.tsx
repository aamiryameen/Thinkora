import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { AdBanner } from '../components/AdBanner';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { TaskCard } from '../components/TaskCard';
import { useApp } from '../context/AppContext';
import { useFeatures } from '../context/FeaturesContext';
import { useTheme } from '../context/ThemeContext';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const MOTIVATIONAL_QUOTES = [
  { text: 'The secret of getting ahead is getting started.', author: 'Mark Twain' },
  { text: 'Small daily improvements are the key to staggering long-term results.', author: '' },
  { text: 'Focus on being productive instead of busy.', author: 'Tim Ferriss' },
  { text: "You don't have to be great to start, but you have to start to be great.", author: 'Zig Ziglar' },
  { text: 'A journey of a thousand miles begins with a single step.', author: 'Lao Tzu' },
  { text: 'Do the hard jobs first. The easy jobs will take care of themselves.', author: 'Dale Carnegie' },
  { text: "It's not about having time, it's about making time.", author: '' },
  { text: 'Progress, not perfection.', author: '' },
  { text: 'Every day is a fresh start.', author: '' },
  { text: 'Done is better than perfect.', author: '' },
];

const QUICK_ACTIONS = [
  { label: 'New Task', icon: 'add-circle-outline', color: '#4A90D9', route: 'TaskEditor' },
  { label: 'Habits', icon: 'flame-outline', color: '#F59E0B', route: 'HabitTracker' },
  { label: 'Focus', icon: 'timer-outline', color: '#14B8A6', route: 'Pomodoro' },
  { label: 'Journal', icon: 'happy-outline', color: '#EC4899', route: 'MoodJournal' },
] as const;

const FEATURE_SHORTCUTS = [
  { label: 'Matrix', icon: 'grid-outline', color: '#8B5CF6', route: 'Eisenhower' },
  { label: 'Lists', icon: 'people-outline', color: '#3B82F6', route: 'SharedLists' },
  { label: 'Focus', icon: 'timer-outline', color: '#14B8A6', route: 'Pomodoro' },
  { label: 'Templates', icon: 'copy-outline', color: '#6366F1', route: 'Templates' },
  { label: 'Badges', icon: 'trophy-outline', color: '#F59E0B', route: 'Badges' },
  { label: 'Reports', icon: 'bar-chart-outline', color: '#4A90D9', route: 'Reports' },
  { label: 'Categories', icon: 'pricetags-outline', color: '#10B981', route: 'CategoryManager' },
  { label: 'Habits', icon: 'flame-outline', color: '#EF4444', route: 'HabitTracker' },
  { label: 'Journal', icon: 'happy-outline', color: '#EC4899', route: 'MoodJournal' },
] as const;

export function MyDayScreen() {
  const navigation = useNavigation<Nav>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { tasks, toggleTaskComplete, getTaskCategory, taskStats } = useApp();
  const { habits, toggleHabitDate, getHabitStreak, journalEntries, badges } = useFeatures();

  const now = new Date();
  const today = dateKey(now);
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dayEnd = dayStart + 86400000;

  // Quote of the day (changes daily)
  const dailyQuote = useMemo(() => {
    const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
    return MOTIVATIONAL_QUOTES[dayOfYear % MOTIVATIONAL_QUOTES.length];
  }, []);

  // Tasks
  const overdueTasks = useMemo(() => tasks.filter((t) => !t.completed && t.dueDate && t.dueDate < dayStart), [tasks]);
  const upcomingTasks = useMemo(() =>
    tasks.filter((t) => !t.completed && t.dueDate && t.dueDate >= dayEnd)
      .sort((a, b) => (a.dueDate ?? 0) - (b.dueDate ?? 0))
      .slice(0, 5),
  [tasks]);
  const pendingTasks = useMemo(() => tasks.filter(t => !t.completed), [tasks]);
  const todayCompletedTasks = useMemo(() =>
    tasks.filter(t => t.completed && t.updatedAt >= dayStart && t.updatedAt < dayEnd),
  [tasks]);

  // Greeting
  const greeting = useMemo(() => {
    const h = now.getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  }, []);

  // Pomodoro
  // Journal
  const todayJournal = useMemo(() => journalEntries.find((e) => e.date === today), [journalEntries, today]);

  // Habits
  const completedHabits = useMemo(() => habits.filter((h) => !h.archived && (h.completedDates ?? []).includes(today)).length, [habits, today]);
  const totalHabits = useMemo(() => habits.filter((h) => !h.archived).length, [habits]);
  const activeHabits = useMemo(() => habits.filter(h => !h.archived), [habits]);
  const bestStreak = useMemo(() => {
    let max = 0;
    activeHabits.forEach(h => {
      const streak = getHabitStreak(h);
      if (streak > max) max = streak;
    });
    return max;
  }, [activeHabits, getHabitStreak]);

  // Badges
  const unlockedBadges = useMemo(() => badges.filter(b => b.unlockedAt), [badges]);

  // Completion percentage
  const completionPct = useMemo(() => {
    const total = tasks.length;
    if (total === 0) return 0;
    return Math.round((tasks.filter(t => t.completed).length / total) * 100);
  }, [tasks]);

  // Weekly trend
  const weeklyTrend = useMemo(() => {
    const days: { label: string; completed: number; total: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const ds = d.getTime();
      const de = ds + 86400000;
      const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
      days.push({
        label: dayNames[d.getDay()],
        completed: tasks.filter(t => t.completed && t.updatedAt >= ds && t.updatedAt < de).length,
        total: tasks.filter(t => t.dueDate && t.dueDate >= ds && t.dueDate < de).length,
      });
    }
    return days;
  }, [tasks]);
  const maxWeekly = Math.max(...weeklyTrend.map(d => Math.max(d.completed, d.total, 1)));

  const MOOD_EMOJIS = ['', '😞', '😕', '😐', '🙂', '😊'];

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    // Header
    header: {
      paddingHorizontal: theme.spacing.lg,
      paddingTop: insets.top + theme.spacing.md,
      paddingBottom: theme.spacing.xl,
      backgroundColor: theme.colors.primary,
      borderBottomLeftRadius: 24,
      borderBottomRightRadius: 24,
    },
    headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    greeting: { ...theme.typography.title, color: '#FFF', fontSize: 26, fontWeight: '700' },
    date: { ...theme.typography.bodySmall, color: '#FFFFFFBB', marginTop: 2 },
    moodBtn: {
      width: 44, height: 44, borderRadius: 22,
      backgroundColor: '#FFFFFF25', alignItems: 'center', justifyContent: 'center',
    },
    // Quote
    quoteCard: {
      marginTop: theme.spacing.lg,
      backgroundColor: '#FFFFFF18',
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
    },
    quoteText: { ...theme.typography.bodySmall, color: '#FFFFFFDD', fontStyle: 'italic', lineHeight: 20 },
    quoteAuthor: { ...theme.typography.caption, color: '#FFFFFF88', marginTop: 4, textAlign: 'right' },
    // Progress ring area
    progressRow: {
      flexDirection: 'row',
      marginTop: theme.spacing.lg,
      gap: theme.spacing.md,
    },
    progressCard: {
      flex: 1,
      backgroundColor: '#FFFFFF20',
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    progressPct: { fontSize: 28, fontWeight: '800', color: '#FFF' },
    progressLabel: { ...theme.typography.caption, color: '#FFFFFFBB', marginTop: 2 },
    miniStat: {
      flex: 1,
      backgroundColor: '#FFFFFF20',
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
    },
    miniStatIcon: { marginBottom: 2 },
    miniStatNum: { fontSize: 18, fontWeight: '800', color: '#FFF' },
    miniStatLabel: { ...theme.typography.caption, color: '#FFFFFFBB', fontSize: 10 },
    // Scroll
    scroll: { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.lg, paddingBottom: 100 },
    // Quick actions
    quickActionsRow: { flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.xl },
    quickAction: {
      flex: 1,
      backgroundColor: theme.colors.cardBg,
      borderRadius: theme.borderRadius.xl,
      paddingVertical: theme.spacing.md,
      alignItems: 'center',
      gap: theme.spacing.xs,
      ...theme.shadows.card,
    },
    quickActionIcon: {
      width: 42, height: 42, borderRadius: 12,
      alignItems: 'center', justifyContent: 'center',
    },
    quickActionLabel: { ...theme.typography.caption, color: theme.colors.text, fontWeight: '600' },
    // Sections
    section: { marginBottom: theme.spacing.xl },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.sm },
    sectionTitle: { ...theme.typography.titleSmall, color: theme.colors.text },
    sectionCount: { ...theme.typography.caption, color: theme.colors.textMuted },
    seeAll: { ...theme.typography.caption, color: theme.colors.primary, fontWeight: '600' },
    // Overdue
    overdueCard: {
      backgroundColor: theme.colors.error + '15',
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.md,
      flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm,
      marginBottom: theme.spacing.md,
      borderLeftWidth: 4, borderLeftColor: theme.colors.error,
    },
    overdueText: { ...theme.typography.bodySmall, color: theme.colors.error, fontWeight: '600', flex: 1 },
    // Habits
    habitsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
    habitChip: {
      flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs,
      paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm,
      borderRadius: theme.borderRadius.full, borderWidth: 2,
    },
    habitChipText: { ...theme.typography.bodySmall, fontWeight: '600' },
    // Mood
    moodCard: {
      backgroundColor: theme.colors.cardBg, borderRadius: theme.borderRadius.xl,
      padding: theme.spacing.lg, alignItems: 'center', ...theme.shadows.card, gap: theme.spacing.sm,
    },
    moodEmoji: { fontSize: 32 },
    moodText: { ...theme.typography.bodySmall, color: theme.colors.textSecondary },
    // Weekly chart
    weeklyChart: {
      backgroundColor: theme.colors.cardBg,
      borderRadius: theme.borderRadius.xl,
      padding: theme.spacing.lg,
      ...theme.shadows.card,
    },
    chartRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 80, gap: 4 },
    chartCol: { flex: 1, alignItems: 'center', gap: 4 },
    chartBar: { width: '80%', borderRadius: 4, minHeight: 4 },
    chartLabel: { ...theme.typography.caption, color: theme.colors.textMuted, fontSize: 10 },
    chartValue: { ...theme.typography.caption, color: theme.colors.text, fontSize: 10, fontWeight: '700' },
    // Feature shortcuts
    featureGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm, justifyContent: 'space-between' },
    featureItem: {
      width: Math.floor((SCREEN_WIDTH - theme.spacing.lg * 2 - theme.spacing.sm * 2) / 3),
      backgroundColor: theme.colors.cardBg,
      borderRadius: theme.borderRadius.xl,
      paddingVertical: theme.spacing.md,
      alignItems: 'center',
      gap: theme.spacing.xs,
      ...theme.shadows.card,
    },
    featureIconWrap: {
      width: 40, height: 40, borderRadius: 12,
      alignItems: 'center', justifyContent: 'center',
    },
    featureLabel: { ...theme.typography.caption, color: theme.colors.text, fontWeight: '600' },
    // Empty state
    emptyCard: {
      backgroundColor: theme.colors.cardBg,
      borderRadius: theme.borderRadius.xl,
      padding: theme.spacing.xl,
      alignItems: 'center',
      ...theme.shadows.card,
      gap: theme.spacing.md,
    },
    emptyIcon: { opacity: 0.5 },
    emptyTitle: { ...theme.typography.titleSmall, color: theme.colors.text, textAlign: 'center' },
    emptyText: { ...theme.typography.bodySmall, color: theme.colors.textMuted, textAlign: 'center', lineHeight: 20 },
    emptyBtn: {
      backgroundColor: theme.colors.primary,
      paddingHorizontal: theme.spacing.xl,
      paddingVertical: theme.spacing.sm + 2,
      borderRadius: theme.borderRadius.full,
      marginTop: theme.spacing.sm,
    },
    emptyBtnText: { ...theme.typography.bodySmall, color: '#FFF', fontWeight: '700' },
    // Today completed
    completedRow: {
      backgroundColor: theme.colors.success + '12',
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.md,
      flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm,
      marginBottom: theme.spacing.md,
    },
    completedText: { ...theme.typography.bodySmall, color: theme.colors.success, fontWeight: '600', flex: 1 },
    // Badges row
    badgesRow: { flexDirection: 'row', gap: theme.spacing.sm },
    badgeItem: {
      backgroundColor: theme.colors.cardBg,
      borderRadius: theme.borderRadius.xl,
      padding: theme.spacing.md,
      alignItems: 'center',
      width: 80,
      ...theme.shadows.card,
    },
    badgeIcon: { fontSize: 28 },
    badgeName: { ...theme.typography.caption, color: theme.colors.text, fontSize: 9, textAlign: 'center', marginTop: 4 },
  }), [theme, insets]);

  return (
    <View style={styles.container}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>{greeting}!</Text>
            <Text style={styles.date}>{now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
          </View>
          <TouchableOpacity style={styles.moodBtn} onPress={() => navigation.navigate('MoodJournal')}>
            {todayJournal ? (
              <Text style={{ fontSize: 22 }}>{MOOD_EMOJIS[todayJournal.mood]}</Text>
            ) : (
              <Ionicons name="happy-outline" size={22} color="#FFF" />
            )}
          </TouchableOpacity>
        </View>

        {/* Quote */}
        <View style={styles.quoteCard}>
          <Text style={styles.quoteText}>"{dailyQuote.text}"</Text>
          {dailyQuote.author ? <Text style={styles.quoteAuthor}>— {dailyQuote.author}</Text> : null}
        </View>

        {/* Progress row */}
        <View style={styles.progressRow}>
          <View style={styles.progressCard}>
            <Text style={styles.progressPct}>{completionPct}%</Text>
            <Text style={styles.progressLabel}>Overall</Text>
          </View>
          <View style={styles.miniStat}>
            <Ionicons name="checkmark-done" size={18} color="#FFF" style={styles.miniStatIcon} />
            <Text style={styles.miniStatNum}>{taskStats.completed}</Text>
            <Text style={styles.miniStatLabel}>Done</Text>
          </View>
          <View style={styles.miniStat}>
            <Ionicons name="time-outline" size={18} color="#FFF" style={styles.miniStatIcon} />
            <Text style={styles.miniStatNum}>{taskStats.pending}</Text>
            <Text style={styles.miniStatLabel}>Pending</Text>
          </View>
          <View style={styles.miniStat}>
            <Ionicons name="flame" size={18} color="#FFF" style={styles.miniStatIcon} />
            <Text style={styles.miniStatNum}>{bestStreak}</Text>
            <Text style={styles.miniStatLabel}>Streak</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* ── Quick Actions ── */}
        <View style={styles.quickActionsRow}>
          {QUICK_ACTIONS.map((action) => (
            <TouchableOpacity
              key={action.label}
              style={styles.quickAction}
              onPress={() => navigation.navigate(action.route as any)}
              activeOpacity={0.7}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: action.color + '18' }]}>
                <Ionicons name={action.icon} size={22} color={action.color} />
              </View>
              <Text style={styles.quickActionLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Overdue Alert ── */}
        {overdueTasks.length > 0 && (
          <TouchableOpacity style={styles.overdueCard} onPress={() => navigation.navigate('Home' as any)} activeOpacity={0.7}>
            <Ionicons name="alert-circle" size={22} color={theme.colors.error} />
            <Text style={styles.overdueText}>{overdueTasks.length} overdue task{overdueTasks.length > 1 ? 's' : ''} need attention</Text>
            <Ionicons name="chevron-forward" size={16} color={theme.colors.error} />
          </TouchableOpacity>
        )}

        {/* ── Today Completed ── */}
        {todayCompletedTasks.length > 0 && (
          <View style={styles.completedRow}>
            <Ionicons name="checkmark-circle" size={22} color={theme.colors.success} />
            <Text style={styles.completedText}>{todayCompletedTasks.length} task{todayCompletedTasks.length > 1 ? 's' : ''} completed today!</Text>
          </View>
        )}

        {/* ── Habits ── */}
        {totalHabits > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Habits <Text style={styles.sectionCount}>{completedHabits}/{totalHabits}</Text></Text>
              <TouchableOpacity onPress={() => navigation.navigate('HabitTracker')}>
                <Text style={styles.seeAll}>See all</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.habitsRow}>
              {activeHabits.map((h) => {
                const done = (h.completedDates ?? []).includes(today);
                return (
                  <TouchableOpacity
                    key={h.id}
                    style={[styles.habitChip, {
                      borderColor: done ? h.color : theme.colors.border,
                      backgroundColor: done ? h.color + '15' : 'transparent',
                    }]}
                    onPress={() => toggleHabitDate(h.id, today)}
                  >
                    <Ionicons name={done ? 'checkmark-circle' : h.icon} size={16} color={done ? h.color : theme.colors.textMuted} />
                    <Text style={[styles.habitChipText, { color: done ? h.color : theme.colors.text }]}>{h.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* ── Weekly Activity ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Weekly Activity</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Reports')}>
              <Text style={styles.seeAll}>Reports</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.weeklyChart}>
            <View style={styles.chartRow}>
              {weeklyTrend.map((day, i) => (
                <View key={i} style={styles.chartCol}>
                  {day.completed > 0 && <Text style={styles.chartValue}>{day.completed}</Text>}
                  <View style={[styles.chartBar, {
                    height: Math.max((day.completed / maxWeekly) * 60, 4),
                    backgroundColor: i === 6 ? theme.colors.primary : theme.colors.primary + '60',
                  }]} />
                  <Text style={[styles.chartLabel, i === 6 && { color: theme.colors.primary, fontWeight: '700' }]}>{day.label}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* ── Pending Tasks ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {pendingTasks.length > 0 ? 'Pending Tasks' : 'Tasks'}{' '}
              <Text style={styles.sectionCount}>{pendingTasks.length}</Text>
            </Text>
            {pendingTasks.length > 0 && (
              <TouchableOpacity onPress={() => navigation.navigate('Home' as any)}>
                <Text style={styles.seeAll}>See all</Text>
              </TouchableOpacity>
            )}
          </View>

          {pendingTasks.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="rocket-outline" size={48} color={theme.colors.primary} style={styles.emptyIcon} />
              <Text style={styles.emptyTitle}>Ready to be productive?</Text>
              <Text style={styles.emptyText}>
                Create your first task and start organizing your day. Break big goals into small, achievable steps.
              </Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.navigate('TaskEditor', {})}>
                <Text style={styles.emptyBtnText}>Create Task</Text>
              </TouchableOpacity>
            </View>
          ) : (
            pendingTasks.slice(0, 5).map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                category={t.categoryId ? getTaskCategory(t.categoryId) : undefined}
                onToggle={() => toggleTaskComplete(t.id)}
                onPress={() => navigation.navigate('TaskEditor', { taskId: t.id })}
              />
            ))
          )}
        </View>

        {/* ── Upcoming Tasks ── */}
        {upcomingTasks.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Coming Up</Text>
            </View>
            {upcomingTasks.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                category={t.categoryId ? getTaskCategory(t.categoryId) : undefined}
                onToggle={() => toggleTaskComplete(t.id)}
                onPress={() => navigation.navigate('TaskEditor', { taskId: t.id })}
              />
            ))}
          </View>
        )}

        {/* ── Badges Teaser ── */}
        {unlockedBadges.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Achievements</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Badges')}>
                <Text style={styles.seeAll}>{badges.length - unlockedBadges.length} more</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.badgesRow}>
                {unlockedBadges.slice(0, 5).map((b) => (
                  <View key={b.id} style={styles.badgeItem}>
                    <Text style={styles.badgeIcon}>{b.icon}</Text>
                    <Text style={styles.badgeName} numberOfLines={1}>{b.name}</Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        {/* ── Feature Shortcuts ── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { marginBottom: theme.spacing.sm }]}>Explore</Text>
          <View style={styles.featureGrid}>
            {FEATURE_SHORTCUTS.map((f) => (
              <TouchableOpacity
                key={f.label}
                style={styles.featureItem}
                onPress={() => navigation.navigate(f.route as any)}
                activeOpacity={0.7}
              >
                <View style={[styles.featureIconWrap, { backgroundColor: f.color + '18' }]}>
                  <Ionicons name={f.icon} size={20} color={f.color} />
                </View>
                <Text style={styles.featureLabel}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
      <AdBanner />
    </View>
  );
}
