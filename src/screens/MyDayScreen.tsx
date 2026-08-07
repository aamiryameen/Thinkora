import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Alert } from 'react-native';
import { AdBanner, SCREEN_BOTTOM_INSET } from '../components/AdBanner';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { TaskCard } from '../components/TaskCard';
import { StreakCard } from '../components/StreakCard';
import { MilestoneCelebrationModal } from '../components/MilestoneCelebrationModal';
import { loadPulseState, isPulseDoneToday, type DailyPulseState } from '../services/dailyPulseService';
import { WeatherCard } from '../components/WeatherCard';
import { SpeedDialFab, type SpeedDialAction } from '../components/SpeedDialFab';
import { useApp } from '../context/AppContext';
import { useFeatures } from '../context/FeaturesContext';
import { useTheme } from '../context/ThemeContext';
import type { RootStackParamList } from '../navigation/types';
import { getDailyQuote } from '../core/quotes';
import { getBlocksForDate, getDay, todayKey } from '../services/plannerService';
import type { PlannerBlock, PlannerDay } from '../types/planner';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const QUICK_ACTIONS = [
  { label: 'New Task', icon: 'add-circle-outline', color: '#4A90D9', route: 'TaskEditor' },
  { label: 'Planner', icon: 'today-outline', color: '#6366F1', route: 'DailyPlanner' },
  { label: 'Focus', icon: 'timer-outline', color: '#14B8A6', route: 'Pomodoro' },
  { label: 'Sketch', icon: 'brush-outline', color: '#FF6347', route: 'Sketch' },
] as const;

/**
 * Explore grid, ordered by value to the user rather than by when each feature
 * was built. The first two rows (six items) are the app's headline features —
 * the ones worth discovering first — so they stay above the fold.
 */
const FEATURE_SHORTCUTS = [
  // ── Rows 1–2: headline features ──
  { label: 'Planner', icon: 'today-outline', color: '#6366F1', route: 'DailyPlanner' },
  { label: 'Weekly', icon: 'calendar-number-outline', color: '#0EA5E9', route: 'WeeklyPlanner' },
  { label: 'AI Knowledge', icon: 'library-outline', color: '#8B5CF6', route: 'KnowledgeBases' },
  { label: 'Calendar', icon: 'calendar-outline', color: '#EF4444', route: 'Calendar' },
  { label: 'Focus', icon: 'timer-outline', color: '#14B8A6', route: 'Pomodoro' },
  { label: 'Budget', icon: 'wallet-outline', color: '#10B981', route: 'Budget' },
  { label: 'Medicine', icon: 'medkit-outline', color: '#EF4444', route: 'Medicine' },
  { label: 'Whiteboard', icon: 'grid-outline', color: '#8B5CF6', route: 'Whiteboards' },
  // ── Rows 3+: everything else ──
  { label: 'Habits', icon: 'flame-outline', color: '#F59E0B', route: 'HabitTracker' },
  { label: 'Goals', icon: 'trophy-outline', color: '#F59E0B', route: 'Goals' },
  { label: 'Voice', icon: 'mic-outline', color: '#8B5CF6', route: 'VoiceCapture' },
  { label: 'Journal', icon: 'happy-outline', color: '#EC4899', route: 'MoodJournal' },
  { label: 'Matrix', icon: 'grid-outline', color: '#8B5CF6', route: 'Eisenhower' },
  { label: 'Stats', icon: 'stats-chart-outline', color: '#10B981', route: 'ProductivityStats' },
  { label: 'Reports', icon: 'bar-chart-outline', color: '#4A90D9', route: 'Reports' },
  { label: 'Lists', icon: 'people-outline', color: '#3B82F6', route: 'SharedLists' },
  { label: 'Templates', icon: 'copy-outline', color: '#6366F1', route: 'Templates' },
  { label: 'Badges', icon: 'trophy-outline', color: '#F59E0B', route: 'Badges' },
] as const;

export function MyDayScreen() {
  const navigation = useNavigation<Nav>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { tasks, toggleTaskComplete, getTaskCategory, taskStats, streak, repairCurrentStreak } = useApp();
  const [celebrateMilestone, setCelebrateMilestone] = useState<number | null>(null);
  const seenMilestonesRef = React.useRef<Set<number> | null>(null);

  // `Tasks` is a sibling tab inside `Home`, not a root stack route — target it
  // through the nested-navigation form so the tab navigator handles it.
  const goToTasksTab = useCallback(() => {
    navigation.navigate('Home', { screen: 'Tasks' });
  }, [navigation]);

  // Detect newly-reached milestones so we can pop the celebration modal.
  // Initialize the seen set with whatever was already celebrated so opening
  // the app doesn't replay old milestones.
  useEffect(() => {
    if (seenMilestonesRef.current === null) {
      seenMilestonesRef.current = new Set(streak.milestones);
      return;
    }
    const seen = seenMilestonesRef.current;
    for (const m of streak.milestones) {
      if (!seen.has(m)) {
        seen.add(m);
        setCelebrateMilestone(m);
        break;
      }
    }
  }, [streak.milestones]);

  // Daily Pulse banner — refresh when screen comes into focus.
  const [pulseState, setPulseState] = useState<DailyPulseState | null>(null);
  useEffect(() => {
    loadPulseState().then(setPulseState);
    const unsubscribe = navigation.addListener?.('focus', () => {
      loadPulseState().then(setPulseState);
    });
    return () => { unsubscribe?.(); };
  }, [navigation]);
  const showPulseBanner = useMemo(() => {
    if (!pulseState) return false;
    if (isPulseDoneToday(pulseState)) return false;
    return new Date().getHours() >= (pulseState.notifyHour ?? 20);
  }, [pulseState]);

  const handleRepair = useCallback(async () => {
    const ok = await repairCurrentStreak();
    if (ok) {
      Alert.alert('Streak repaired!', 'Your streak has been restored. Keep showing up.');
    } else {
      Alert.alert('Repair unavailable', 'Repair is only available within 24 hours of breaking a streak, once per month.');
    }
  }, [repairCurrentStreak]);
  const { habits, toggleHabitDate, getHabitStreak, journalEntries, badges } = useFeatures();

  const now = new Date();
  const today = dateKey(now);
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dayEnd = dayStart + 86400000;

  // Quote of the day — unique for 120 consecutive days (shared collection)
  const dailyQuote = useMemo(() => getDailyQuote(now), [today]);

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
    if (h < 5) return 'Good Night';       // 12 AM - 4:59 AM
    if (h < 12) return 'Good Morning';    // 5 AM - 11:59 AM
    if (h < 17) return 'Good Afternoon';  // 12 PM - 4:59 PM
    if (h < 21) return 'Good Evening';    // 5 PM - 8:59 PM
    return 'Good Night';                   // 9 PM - 11:59 PM
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

  // Daily Planner summary — always about *today*, independent of whatever date
  // the planner screen happens to be showing. Refreshed on focus.
  const [plannerToday, setPlannerToday] = useState<{ blocks: PlannerBlock[]; day: PlannerDay } | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () => {
      const key = todayKey();
      Promise.all([getBlocksForDate(key), getDay(key)])
        .then(([blocks, plan]) => { if (alive) setPlannerToday({ blocks, day: plan }); })
        .catch(() => { /* planner data is optional on this screen */ });
    };
    load();
    const unsubscribe = navigation.addListener?.('focus', load);
    return () => { alive = false; unsubscribe?.(); };
  }, [navigation]);

  const plannerSummary = useMemo(() => {
    if (!plannerToday) return { hasPlan: false, label: 'Set a focus and block time for what matters' };
    const { blocks, day: plan } = plannerToday;
    const hasPlan = blocks.length > 0 || !!plan.focus.trim() || plan.topPriorities.length > 0;
    if (!hasPlan) {
      return { hasPlan: false, label: 'Set a focus and block time for what matters' };
    }
    if (plan.focus.trim()) return { hasPlan: true, label: plan.focus.trim() };
    const done = blocks.filter(b => b.completed).length;
    const priorities = plan.topPriorities.length;
    const parts = [`${done}/${blocks.length} blocks done`];
    if (priorities > 0) parts.push(`${plan.topPriorities.filter(p => p.completed).length}/${priorities} priorities`);
    return { hasPlan: true, label: parts.join(' · ') };
  }, [plannerToday]);

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

  const fabActions = useMemo<SpeedDialAction[]>(() => [
    {
      key: 'whiteboard', label: 'Whiteboard', icon: 'grid-outline', color: '#8B5CF6',
      onPress: () => navigation.navigate('Whiteboards'),
    },
    {
      key: 'medicine', label: 'Medicine Reminder', icon: 'medkit-outline', color: '#EF4444',
      onPress: () => navigation.navigate('Medicine'),
    },
    {
      key: 'budget', label: 'Budget & Expense', icon: 'wallet-outline', color: '#10B981',
      onPress: () => navigation.navigate('Budget'),
    },
  ], [navigation]);

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
    scrollOuter: { paddingBottom: SCREEN_BOTTOM_INSET },
    scrollBody: { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.lg },
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
      <ScrollView
        contentContainerStyle={styles.scrollOuter}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header (now scrolls with the rest of the screen) ── */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.greeting}>{greeting}!</Text>
              <Text style={styles.date} numberOfLines={1}>
                {now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
              </Text>
            </View>
            <TouchableOpacity style={styles.moodBtn} onPress={() => navigation.navigate('MoodJournal')}>
              {todayJournal ? (
                <Text style={{ fontSize: 22 }}>{MOOD_EMOJIS[todayJournal.mood]}</Text>
              ) : (
                <Ionicons name="happy-outline" size={22} color="#FFF" />
              )}
            </TouchableOpacity>
          </View>

          {/* Weather — current location */}
          <View style={{ marginTop: theme.spacing.lg }}>
            <WeatherCard onPrimary />
          </View>

          {/* Quote — tap to browse all quotes */}
          <TouchableOpacity
            style={styles.quoteCard}
            onPress={() => navigation.navigate('Quotes')}
            activeOpacity={0.85}
          >
            <Text style={styles.quoteText}>"{dailyQuote.text}"</Text>
            {dailyQuote.author ? <Text style={styles.quoteAuthor}>— {dailyQuote.author}</Text> : null}
          </TouchableOpacity>

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

        <View style={styles.scrollBody}>
        {/* ── Morning Briefing ── */}
        <View style={{ marginBottom: 16 }}>
 
        </View>

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

        {/* ── Daily Pulse banner (evenings only, until completed) ── */}
        {showPulseBanner && (
          <TouchableOpacity
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              padding: 16,
              borderRadius: 18,
              backgroundColor: '#F9731618',
              borderWidth: 1.5,
              borderColor: '#F9731640',
              marginBottom: 16,
            }}
            onPress={() => navigation.navigate('DailyPulse')}
            activeOpacity={0.85}
          >
            <View style={{
              width: 44, height: 44, borderRadius: 22,
              backgroundColor: '#F9731620',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Ionicons name="pulse" size={22} color="#F97316" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '800', color: theme.colors.text }}>
                🌅 Your Daily Pulse is ready
              </Text>
              <Text style={{ fontSize: 12, color: theme.colors.textMuted, marginTop: 2 }}>
                60 seconds · {pulseState?.pulseStreak ? `${pulseState.pulseStreak}-day Pulse streak` : 'Start your Pulse streak'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#F97316" />
          </TouchableOpacity>
        )}

        {/* ── Daily Planner entry ── */}
        <TouchableOpacity
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 12,
            padding: 16, borderRadius: 18, marginBottom: 16,
            backgroundColor: '#6366F118',
            borderWidth: 1.5, borderColor: '#6366F140',
          }}
          onPress={() => navigation.navigate('DailyPlanner')}
          activeOpacity={0.85}
        >
          <View style={{
            width: 44, height: 44, borderRadius: 22,
            backgroundColor: '#6366F120',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Ionicons name="today-outline" size={22} color="#6366F1" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '800', color: theme.colors.text }}>
              {plannerSummary.hasPlan ? '🗓️ Today\'s plan' : '🗓️ Plan your day'}
            </Text>
            <Text style={{ fontSize: 12, color: theme.colors.textMuted, marginTop: 2 }}>
              {plannerSummary.label}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#6366F1" />
        </TouchableOpacity>

        {/* ── Daily Streak ── */}
        <StreakCard streak={streak} onRepair={handleRepair} />

        {/* ── Today Card share shortcut ── */}
        <TouchableOpacity
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 12,
            padding: 14, borderRadius: 16, marginBottom: 16,
            backgroundColor: theme.colors.cardBg,
            borderWidth: 1, borderColor: theme.colors.border,
          }}
          onPress={() => navigation.navigate('TodayCard')}
          activeOpacity={0.7}
        >
          <View style={{
            width: 36, height: 36, borderRadius: 10,
            backgroundColor: '#FBBF2420',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Ionicons name="share-social-outline" size={20} color="#FBBF24" />
          </View>
          <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: theme.colors.text }}>
            Share today's card
          </Text>
          <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
        </TouchableOpacity>

        {/* ── Overdue Alert ── */}
        {overdueTasks.length > 0 && (
          <TouchableOpacity style={styles.overdueCard} onPress={goToTasksTab} activeOpacity={0.7}>
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
              <TouchableOpacity onPress={goToTasksTab}>
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
        </View>
      </ScrollView>

      <SpeedDialFab actions={fabActions} offset={92} />

      <AdBanner />

      <MilestoneCelebrationModal
        visible={celebrateMilestone !== null}
        milestone={celebrateMilestone ?? 0}
        onClose={() => setCelebrateMilestone(null)}
      />
    </View>
  );
}
