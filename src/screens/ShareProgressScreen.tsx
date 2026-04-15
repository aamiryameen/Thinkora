import React, { useMemo, useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Share,
  Dimensions,
} from 'react-native';
import { captureRef } from 'react-native-view-shot';
import RNFS from 'react-native-fs';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Icon } from '../components/Icons';
import { useApp } from '../context/AppContext';
import { useFeatures } from '../context/FeaturesContext';
import { useTheme } from '../context/ThemeContext';
import type { Habit } from '../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 48;
const CARD_ASPECT = 1.5; // Instagram story-friendly 2:3
const CARD_HEIGHT = CARD_WIDTH * CARD_ASPECT;

// ── Helper functions ───────────────────────────────────────────

function getStreak(habit: Habit): number {
  const dates = habit.completedDates ?? [];
  if (dates.length === 0) return 0;
  const today = new Date();
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (dates.includes(key)) streak++;
    else if (i > 0) break;
  }
  return streak;
}

function getCompletionRate(habit: Habit): number {
  if (!habit.completedDates || habit.completedDates.length === 0) return 0;
  const daysSinceCreation = Math.max(1, Math.ceil((Date.now() - habit.createdAt) / 86400000));
  return Math.min(100, Math.round((habit.completedDates.length / daysSinceCreation) * 100));
}

function getWeekDots(habit: Habit): boolean[] {
  const today = new Date();
  const dots: boolean[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    dots.push(habit.completedDates.includes(key));
  }
  return dots;
}

const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

interface CardData {
  id: string;
  type: 'streak' | 'weekly' | 'habits-overview' | 'mood' | 'productivity';
  title: string;
  gradient: [string, string];
}

// ── Shareable Card Components ──────────────────────────────────

function StreakCard({
  habit,
  gradient,
}: {
  habit: Habit;
  gradient: [string, string];
}) {
  const streak = getStreak(habit);
  const rate = getCompletionRate(habit);
  const dots = getWeekDots(habit);

  return (
    <View style={[cardStyles.card, { backgroundColor: gradient[0] }]}>
      {/* Decorative elements */}
      <View style={[cardStyles.circle1, { backgroundColor: gradient[1] + '30' }]} />
      <View style={[cardStyles.circle2, { backgroundColor: gradient[1] + '20' }]} />
      <View style={[cardStyles.circle3, { backgroundColor: '#FFFFFF10' }]} />

      <View style={cardStyles.content}>
        {/* Header */}
        <View style={cardStyles.header}>
          <View style={cardStyles.iconBadge}>
            <Text style={cardStyles.iconText}>{habit.icon || '🔥'}</Text>
          </View>
          <Text style={cardStyles.label}>CURRENT STREAK</Text>
        </View>

        {/* Big streak number */}
        <View style={cardStyles.bigNumberWrap}>
          <Text style={cardStyles.bigNumber}>{streak}</Text>
          <Text style={cardStyles.bigUnit}>{streak === 1 ? 'day' : 'days'}</Text>
        </View>

        {/* Habit name */}
        <Text style={cardStyles.habitName}>{habit.name}</Text>

        {/* Week dots */}
        <View style={cardStyles.weekRow}>
          {dots.map((done, i) => (
            <View key={i} style={cardStyles.weekDayCol}>
              <View
                style={[
                  cardStyles.weekDot,
                  done ? { backgroundColor: '#FFFFFF' } : { backgroundColor: '#FFFFFF30' },
                ]}
              >
                {done && <Ionicons name="checkmark" size={12} color={gradient[0]} />}
              </View>
              <Text style={cardStyles.weekLabel}>{WEEKDAY_LABELS[i]}</Text>
            </View>
          ))}
        </View>

        {/* Stats row */}
        <View style={cardStyles.statsRow}>
          <View style={cardStyles.statItem}>
            <Text style={cardStyles.statValue}>{rate}%</Text>
            <Text style={cardStyles.statLabel}>Completion</Text>
          </View>
          <View style={cardStyles.statDivider} />
          <View style={cardStyles.statItem}>
            <Text style={cardStyles.statValue}>{habit.completedDates.length}</Text>
            <Text style={cardStyles.statLabel}>Total Days</Text>
          </View>
          <View style={cardStyles.statDivider} />
          <View style={cardStyles.statItem}>
            <Text style={cardStyles.statValue}>{streak}</Text>
            <Text style={cardStyles.statLabel}>Best Streak</Text>
          </View>
        </View>

        {/* Branding */}
        <View style={cardStyles.branding}>
          <Text style={cardStyles.brandText}>Thinkora</Text>
          <Text style={cardStyles.brandSub}>Track your habits</Text>
        </View>
      </View>
    </View>
  );
}

function WeeklySummaryCard({
  completed,
  pending,
  weeklyCompleted,
  gradient,
}: {
  completed: number;
  pending: number;
  weeklyCompleted: number[];
  gradient: [string, string];
}) {
  const total = completed + pending;
  const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
  const maxWeekly = Math.max(...weeklyCompleted, 1);
  const weekTotal = weeklyCompleted.reduce((a, b) => a + b, 0);
  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <View style={[cardStyles.card, { backgroundColor: gradient[0] }]}>
      <View style={[cardStyles.circle1, { backgroundColor: gradient[1] + '30' }]} />
      <View style={[cardStyles.circle2, { backgroundColor: gradient[1] + '20' }]} />
      <View style={[cardStyles.circle3, { backgroundColor: '#FFFFFF10' }]} />

      <View style={cardStyles.content}>
        <View style={cardStyles.header}>
          <View style={cardStyles.iconBadge}>
            <Ionicons name="trending-up" size={22} color="#FFF" />
          </View>
          <Text style={cardStyles.label}>WEEKLY SUMMARY</Text>
        </View>

        <View style={cardStyles.bigNumberWrap}>
          <Text style={cardStyles.bigNumber}>{weekTotal}</Text>
          <Text style={cardStyles.bigUnit}>tasks this week</Text>
        </View>

        {/* Bar chart */}
        <View style={cardStyles.barChart}>
          {weeklyCompleted.map((val, i) => (
            <View key={i} style={cardStyles.barCol}>
              <View style={cardStyles.barTrack}>
                <View
                  style={[
                    cardStyles.barFill,
                    {
                      height: `${Math.max(8, (val / maxWeekly) * 100)}%`,
                      backgroundColor: '#FFFFFF',
                      opacity: val > 0 ? 1 : 0.3,
                    },
                  ]}
                />
              </View>
              <Text style={cardStyles.barLabel}>{dayLabels[i]}</Text>
            </View>
          ))}
        </View>

        <View style={cardStyles.statsRow}>
          <View style={cardStyles.statItem}>
            <Text style={cardStyles.statValue}>{completed}</Text>
            <Text style={cardStyles.statLabel}>Completed</Text>
          </View>
          <View style={cardStyles.statDivider} />
          <View style={cardStyles.statItem}>
            <Text style={cardStyles.statValue}>{pending}</Text>
            <Text style={cardStyles.statLabel}>Pending</Text>
          </View>
          <View style={cardStyles.statDivider} />
          <View style={cardStyles.statItem}>
            <Text style={cardStyles.statValue}>{rate}%</Text>
            <Text style={cardStyles.statLabel}>Done Rate</Text>
          </View>
        </View>

        <View style={cardStyles.branding}>
          <Text style={cardStyles.brandText}>Thinkora</Text>
          <Text style={cardStyles.brandSub}>Productivity tracker</Text>
        </View>
      </View>
    </View>
  );
}

function HabitsOverviewCard({
  habits,
  gradient,
}: {
  habits: Habit[];
  gradient: [string, string];
}) {
  const activeHabits = habits.filter((h) => !h.archived);
  const topHabits = activeHabits
    .map((h) => ({ ...h, streak: getStreak(h) }))
    .sort((a, b) => b.streak - a.streak)
    .slice(0, 5);

  const totalStreakDays = topHabits.reduce((sum, h) => sum + h.streak, 0);

  return (
    <View style={[cardStyles.card, { backgroundColor: gradient[0] }]}>
      <View style={[cardStyles.circle1, { backgroundColor: gradient[1] + '30' }]} />
      <View style={[cardStyles.circle2, { backgroundColor: gradient[1] + '20' }]} />
      <View style={[cardStyles.circle3, { backgroundColor: '#FFFFFF10' }]} />

      <View style={cardStyles.content}>
        <View style={cardStyles.header}>
          <View style={cardStyles.iconBadge}>
            <Ionicons name="flame" size={22} color="#FFF" />
          </View>
          <Text style={cardStyles.label}>MY HABITS</Text>
        </View>

        <View style={cardStyles.bigNumberWrap}>
          <Text style={cardStyles.bigNumber}>{activeHabits.length}</Text>
          <Text style={cardStyles.bigUnit}>active habits</Text>
        </View>

        {/* Habit list */}
        <View style={cardStyles.habitList}>
          {topHabits.map((h, i) => (
            <View key={h.id} style={cardStyles.habitRow}>
              <Text style={cardStyles.habitEmoji}>{h.icon || '✨'}</Text>
              <Text style={cardStyles.habitRowName} numberOfLines={1}>
                {h.name}
              </Text>
              <View style={cardStyles.streakBadge}>
                <Ionicons name="flame" size={12} color="#FF9500" />
                <Text style={cardStyles.streakNum}>{h.streak}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={[cardStyles.statsRow, { marginTop: 16 }]}>
          <View style={cardStyles.statItem}>
            <Text style={cardStyles.statValue}>{totalStreakDays}</Text>
            <Text style={cardStyles.statLabel}>Streak Days</Text>
          </View>
          <View style={cardStyles.statDivider} />
          <View style={cardStyles.statItem}>
            <Text style={cardStyles.statValue}>{activeHabits.length}</Text>
            <Text style={cardStyles.statLabel}>Habits</Text>
          </View>
        </View>

        <View style={cardStyles.branding}>
          <Text style={cardStyles.brandText}>Thinkora</Text>
          <Text style={cardStyles.brandSub}>Build better habits</Text>
        </View>
      </View>
    </View>
  );
}

function ProductivityCard({
  completed,
  notes,
  pomodoroMinutes,
  journalDays,
  gradient,
}: {
  completed: number;
  notes: number;
  pomodoroMinutes: number;
  journalDays: number;
  gradient: [string, string];
}) {
  const dateRange = new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  return (
    <View style={[cardStyles.card, { backgroundColor: gradient[0] }]}>
      <View style={[cardStyles.circle1, { backgroundColor: gradient[1] + '30' }]} />
      <View style={[cardStyles.circle2, { backgroundColor: gradient[1] + '20' }]} />
      <View style={[cardStyles.circle3, { backgroundColor: '#FFFFFF10' }]} />

      <View style={cardStyles.content}>
        <View style={cardStyles.header}>
          <View style={cardStyles.iconBadge}>
            <Ionicons name="rocket" size={22} color="#FFF" />
          </View>
          <Text style={cardStyles.label}>PRODUCTIVITY SNAPSHOT</Text>
        </View>

        <Text style={[cardStyles.habitName, { marginTop: 8, marginBottom: 20, fontSize: 16 }]}>
          {dateRange}
        </Text>

        {/* Grid of stats */}
        <View style={cardStyles.gridWrap}>
          <View style={cardStyles.gridItem}>
            <Ionicons name="checkbox" size={28} color="#FFFFFFCC" />
            <Text style={cardStyles.gridNum}>{completed}</Text>
            <Text style={cardStyles.gridLabel}>Tasks Done</Text>
          </View>
          <View style={cardStyles.gridItem}>
            <Ionicons name="document-text" size={28} color="#FFFFFFCC" />
            <Text style={cardStyles.gridNum}>{notes}</Text>
            <Text style={cardStyles.gridLabel}>Notes</Text>
          </View>
          <View style={cardStyles.gridItem}>
            <Ionicons name="timer" size={28} color="#FFFFFFCC" />
            <Text style={cardStyles.gridNum}>{pomodoroMinutes}</Text>
            <Text style={cardStyles.gridLabel}>Focus Mins</Text>
          </View>
          <View style={cardStyles.gridItem}>
            <Ionicons name="happy" size={28} color="#FFFFFFCC" />
            <Text style={cardStyles.gridNum}>{journalDays}</Text>
            <Text style={cardStyles.gridLabel}>Journal Days</Text>
          </View>
        </View>

        <View style={cardStyles.branding}>
          <Text style={cardStyles.brandText}>Thinkora</Text>
          <Text style={cardStyles.brandSub}>All-in-one productivity</Text>
        </View>
      </View>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 28,
    overflow: 'hidden',
    position: 'relative',
  },
  content: {
    flex: 1,
    padding: 28,
    justifyContent: 'space-between',
    zIndex: 1,
  },
  circle1: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 125,
    top: -60,
    right: -40,
  },
  circle2: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    bottom: 40,
    left: -50,
  },
  circle3: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    bottom: -30,
    right: 30,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFFFFF20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontSize: 20,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF88',
    letterSpacing: 2,
  },
  bigNumberWrap: {
    alignItems: 'center',
    marginVertical: 8,
  },
  bigNumber: {
    fontSize: 72,
    fontWeight: '900',
    color: '#FFFFFF',
    lineHeight: 80,
  },
  bigUnit: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFFAA',
    marginTop: 4,
  },
  habitName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFFDD',
    textAlign: 'center',
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginVertical: 16,
  },
  weekDayCol: {
    alignItems: 'center',
    gap: 6,
  },
  weekDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF66',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    backgroundColor: '#FFFFFF12',
    borderRadius: 16,
    paddingVertical: 14,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF77',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#FFFFFF20',
  },
  branding: {
    alignItems: 'center',
    marginTop: 12,
  },
  brandText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF55',
    letterSpacing: 1,
  },
  brandSub: {
    fontSize: 11,
    color: '#FFFFFF33',
    marginTop: 2,
  },
  barChart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 100,
    marginVertical: 16,
    gap: 6,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  barTrack: {
    width: '100%',
    height: 80,
    backgroundColor: '#FFFFFF15',
    borderRadius: 6,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderRadius: 6,
  },
  barLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF66',
  },
  habitList: {
    gap: 10,
    marginVertical: 8,
  },
  habitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF12',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  habitEmoji: {
    fontSize: 18,
  },
  habitRowName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFFDD',
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFFFFF20',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  streakNum: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FF9500',
  },
  gridWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
    flex: 1,
    alignItems: 'center',
  },
  gridItem: {
    width: '44%',
    backgroundColor: '#FFFFFF12',
    borderRadius: 16,
    paddingVertical: 20,
    alignItems: 'center',
    gap: 6,
  },
  gridNum: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  gridLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF77',
  },
});

// ── Main Screen ────────────────────────────────────────────────

const GRADIENTS: [string, string][] = [
  ['#7C3AED', '#a855f7'],
  ['#0891B2', '#22d3ee'],
  ['#059669', '#34d399'],
  ['#EA580C', '#fb923c'],
  ['#EC4899', '#f472b6'],
  ['#6366F1', '#818cf8'],
];

export function ShareProgressScreen() {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { tasks, notes, taskStats } = useApp();
  const { habits, pomodoroSessions, journalEntries } = useFeatures();

  const [sharing, setSharing] = useState(false);
  const cardRefs = useRef<(View | null)[]>([]);

  const activeHabits = useMemo(() => habits.filter((h) => !h.archived), [habits]);
  const topHabit = useMemo(() => {
    if (activeHabits.length === 0) return null;
    return activeHabits.reduce((best, h) => (getStreak(h) > getStreak(best) ? h : best), activeHabits[0]);
  }, [activeHabits]);

  const pomodoroMinutes = useMemo(
    () => pomodoroSessions.reduce((sum, s) => sum + Math.round(s.duration / 60), 0),
    [pomodoroSessions],
  );

  const shareCard = useCallback(async (index: number) => {
    const ref = cardRefs.current[index];
    if (!ref || sharing) return;
    setSharing(true);
    try {
      const uri = await captureRef(ref, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });
      const destPath = `${RNFS.CachesDirectoryPath}/thinkora-progress-${Date.now()}.png`;
      await RNFS.moveFile(uri, destPath);
      await Share.share({
        message: 'Check out my progress on Thinkora! https://play.google.com/store/apps/details?id=com.thinkora',
        url: `file://${destPath}`,
      });
    } catch (e) {
      console.error('[ShareProgress] Error:', e);
    } finally {
      setSharing(false);
    }
  }, [sharing]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: theme.colors.background },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 20,
          paddingTop: insets.top + 12,
          paddingBottom: 12,
          backgroundColor: theme.colors.surface,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.colors.border,
          gap: 12,
        },
        backBtn: {
          width: 36,
          height: 36,
          borderRadius: 10,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.inputBg,
        },
        headerTitle: {
          fontSize: 20,
          fontWeight: '700',
          color: theme.colors.text,
          flex: 1,
        },
        scrollContent: {
          padding: 24,
          paddingBottom: 100,
          gap: 24,
        },
        sectionTitle: {
          fontSize: 14,
          fontWeight: '700',
          color: theme.colors.textMuted,
          textTransform: 'uppercase',
          letterSpacing: 1.5,
          marginBottom: 4,
        },
        cardWrapper: {
          alignItems: 'center',
          gap: 12,
        },
        shareBtn: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          backgroundColor: theme.colors.primary,
          borderRadius: 14,
          paddingVertical: 12,
          paddingHorizontal: 24,
          width: CARD_WIDTH,
          shadowColor: theme.colors.primary,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 6,
        },
        shareBtnText: {
          fontSize: 15,
          fontWeight: '700',
          color: '#FFF',
        },
        emptyText: {
          fontSize: 14,
          color: theme.colors.textMuted,
          textAlign: 'center',
          paddingVertical: 40,
        },
      }),
    [theme, insets],
  );

  let cardIndex = 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Icon name="back" size={22} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Share Progress</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Habit Streak Card */}
        {topHabit && (
          <>
            <Text style={styles.sectionTitle}>Top Habit Streak</Text>
            <View style={styles.cardWrapper}>
              <View ref={(r) => { cardRefs.current[0] = r; }} collapsable={false}>
                <StreakCard habit={topHabit} gradient={GRADIENTS[0]} />
              </View>
              <TouchableOpacity style={styles.shareBtn} onPress={() => shareCard(0)} disabled={sharing}>
                <Ionicons name="share-social" size={18} color="#FFF" />
                <Text style={styles.shareBtnText}>Share Streak</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Weekly Summary */}
        <Text style={styles.sectionTitle}>Weekly Summary</Text>
        <View style={styles.cardWrapper}>
          <View ref={(r) => { cardRefs.current[1] = r; }} collapsable={false}>
            <WeeklySummaryCard
              completed={taskStats.completed}
              pending={taskStats.pending}
              weeklyCompleted={taskStats.weeklyCompleted}
              gradient={GRADIENTS[1]}
            />
          </View>
          <TouchableOpacity style={styles.shareBtn} onPress={() => shareCard(1)} disabled={sharing}>
            <Ionicons name="share-social" size={18} color="#FFF" />
            <Text style={styles.shareBtnText}>Share Summary</Text>
          </TouchableOpacity>
        </View>

        {/* Habits Overview */}
        {activeHabits.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Habits Overview</Text>
            <View style={styles.cardWrapper}>
              <View ref={(r) => { cardRefs.current[2] = r; }} collapsable={false}>
                <HabitsOverviewCard habits={habits} gradient={GRADIENTS[2]} />
              </View>
              <TouchableOpacity style={styles.shareBtn} onPress={() => shareCard(2)} disabled={sharing}>
                <Ionicons name="share-social" size={18} color="#FFF" />
                <Text style={styles.shareBtnText}>Share Habits</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Productivity Snapshot */}
        <Text style={styles.sectionTitle}>Productivity Snapshot</Text>
        <View style={styles.cardWrapper}>
          <View ref={(r) => { cardRefs.current[3] = r; }} collapsable={false}>
            <ProductivityCard
              completed={taskStats.completed}
              notes={notes.length}
              pomodoroMinutes={pomodoroMinutes}
              journalDays={journalEntries.length}
              gradient={GRADIENTS[4]}
            />
          </View>
          <TouchableOpacity style={styles.shareBtn} onPress={() => shareCard(3)} disabled={sharing}>
            <Ionicons name="share-social" size={18} color="#FFF" />
            <Text style={styles.shareBtnText}>Share Snapshot</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
