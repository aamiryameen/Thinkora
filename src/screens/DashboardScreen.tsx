import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { AdBanner, SCREEN_BOTTOM_INSET } from '../components/AdBanner';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface QuickLink {
  label: string;
  icon: string;
  color: string;
  route: keyof RootStackParamList;
}

/** A headline feature, rendered as a full-width row with a description. */
interface HighlightLink extends QuickLink {
  description: string;
}

/**
 * The features worth leading with. Rendered larger and first, because a flat
 * grid of 27 equal tiles gives the best features no more prominence than
 * "Categories".
 */
const HIGHLIGHT_LINKS: HighlightLink[] = [
  {
    label: 'Daily Planner', icon: 'today-outline', color: '#6366F1', route: 'DailyPlanner',
    description: 'Plan your day on one timeline',
  },
  {
    label: 'AI Knowledge Base', icon: 'library-outline', color: '#8B5CF6', route: 'KnowledgeBases',
    description: 'Ask questions about your documents',
  },
  {
    label: 'Weekly Planner', icon: 'calendar-number-outline', color: '#0EA5E9', route: 'WeeklyPlanner',
    description: 'See and plan all seven days',
  },
  {
    label: 'Budget & Expenses', icon: 'wallet-outline', color: '#10B981', route: 'Budget',
    description: 'Track income, spending and budgets',
  },
];

/** Grouped so related tools sit together instead of in one long wall. */
const FEATURE_GROUPS: { title: string; links: QuickLink[] }[] = [
  {
    title: 'Plan & Organize',
    links: [
      { label: 'Calendar', icon: 'calendar-outline', color: '#EF4444', route: 'Calendar' },
      { label: 'Goals', icon: 'trophy-outline', color: '#F59E0B', route: 'Goals' },
      { label: 'Time Blocks', icon: 'time-outline', color: '#6366F1', route: 'TimeBlocking' },
      { label: 'Matrix', icon: 'apps-outline', color: '#8B5CF6', route: 'Eisenhower' },
      { label: 'Templates', icon: 'copy-outline', color: '#6366F1', route: 'Templates' },
      { label: 'Gantt', icon: 'git-branch-outline', color: '#0EA5E9', route: 'Gantt' },
    ],
  },
  {
    title: 'Focus & Habits',
    links: [
      { label: 'Pomodoro', icon: 'timer-outline', color: '#14B8A6', route: 'Pomodoro' },
      { label: 'Habits', icon: 'flame-outline', color: '#F59E0B', route: 'HabitTracker' },
      { label: 'Habit Stacks', icon: 'link-outline', color: '#EC4899', route: 'HabitStacks' },
      { label: 'Journal', icon: 'happy-outline', color: '#EC4899', route: 'MoodJournal' },
      { label: 'Daily Pulse', icon: 'pulse-outline', color: '#F97316', route: 'DailyPulse' },
      { label: 'Morning Brew', icon: 'cafe-outline', color: '#D97706', route: 'MorningBrew' },
    ],
  },
  {
    title: 'Capture',
    links: [
      { label: 'Voice Capture', icon: 'mic-circle-outline', color: '#7C3AED', route: 'VoiceCapture' },
      { label: 'Voice Command', icon: 'mic-outline', color: '#8B5CF6', route: 'VoiceCommand' },
      { label: 'Sketch', icon: 'brush-outline', color: '#FF6347', route: 'Sketch' },
      { label: 'Whiteboard', icon: 'grid-outline', color: '#8B5CF6', route: 'Whiteboards' },
      { label: 'Lists', icon: 'people-outline', color: '#3B82F6', route: 'SharedLists' },
      { label: 'Categories', icon: 'pricetags-outline', color: '#10B981', route: 'CategoryManager' },
      // Also reachable from the quote card on MyDay, but that's an easy entry
      // point to miss — keep an explicit tile here.
      { label: 'Quotes', icon: 'chatbubble-ellipses-outline', color: '#7C3AED', route: 'Quotes' },
    ],
  },
  {
    title: 'Health',
    links: [
      { label: 'Medicine', icon: 'medkit-outline', color: '#EF4444', route: 'Medicine' },
      { label: 'History', icon: 'time-outline', color: '#8B5CF6', route: 'MedicineHistory' },
      { label: 'Family', icon: 'people-outline', color: '#0EA5E9', route: 'MedicineProfiles' },
      { label: 'Inventory', icon: 'cube-outline', color: '#F59E0B', route: 'MedicineInventory' },
    ],
  },
  {
    title: 'Money',
    links: [
      { label: 'Budget', icon: 'wallet-outline', color: '#10B981', route: 'Budget' },
      { label: 'Categories', icon: 'pricetags-outline', color: '#F59E0B', route: 'BudgetCategories' },
      { label: 'Budgets', icon: 'speedometer-outline', color: '#6366F1', route: 'BudgetLimits' },
      { label: 'Recurring', icon: 'repeat-outline', color: '#0EA5E9', route: 'BudgetRecurring' },
      { label: 'Reports', icon: 'bar-chart-outline', color: '#8B5CF6', route: 'BudgetReports' },
    ],
  },
  {
    title: 'Progress',
    links: [
      { label: 'Stats', icon: 'stats-chart-outline', color: '#10B981', route: 'ProductivityStats' },
      { label: 'Reports', icon: 'bar-chart-outline', color: '#4A90D9', route: 'Reports' },
      { label: 'Badges', icon: 'trophy-outline', color: '#F59E0B', route: 'Badges' },
      { label: 'Rewards', icon: 'ribbon-outline', color: '#F97316', route: 'StreakRewards' },
      { label: 'Today Card', icon: 'share-social-outline', color: '#FBBF24', route: 'TodayCard' },
      { label: 'Share', icon: 'share-social-outline', color: '#EC4899', route: 'ShareProgress' },
      { label: 'Year Recap', icon: 'gift-outline', color: '#EC4899', route: 'BirthdayRecap' },
      { label: 'Cloud Sync', icon: 'cloud-outline', color: '#3B82F6', route: 'CloudSync' },
    ],
  },
];

export function DashboardScreen() {
  const navigation = useNavigation<Nav>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { taskStats } = useApp();

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    header: {
      paddingHorizontal: theme.spacing.lg,
      paddingTop: insets.top + theme.spacing.md,
      paddingBottom: theme.spacing.md,
      backgroundColor: theme.colors.surface,
    },
    title: {
      ...theme.typography.title,
      color: theme.colors.text,
      fontSize: 26,
      fontWeight: '700',
    },
    subtitle: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
      marginTop: 2,
    },
    scroll: {
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.lg,
      paddingBottom: SCREEN_BOTTOM_INSET,
      gap: theme.spacing.lg,
    },
    summaryRow: {
      flexDirection: 'row',
      gap: theme.spacing.md,
    },
    summaryCard: {
      flex: 1,
      borderRadius: theme.borderRadius.xl,
      padding: theme.spacing.lg,
      alignItems: 'center',
      gap: theme.spacing.xs,
      ...theme.shadows.card,
    },
    summaryNumber: {
      fontSize: 32,
      fontWeight: '800',
      color: '#FFF',
    },
    summaryLabel: {
      ...theme.typography.caption,
      color: '#FFF',
      fontWeight: '600',
      opacity: 0.9,
    },
    sectionTitle: {
      ...theme.typography.overline,
      color: theme.colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: theme.spacing.sm,
      marginLeft: theme.spacing.xs,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.sm,
    },
    highlightList: { gap: theme.spacing.sm },
    highlightCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      backgroundColor: theme.colors.cardBg,
      borderRadius: theme.borderRadius.xl,
      padding: theme.spacing.lg,
      borderLeftWidth: 4,
      ...theme.shadows.card,
    },
    highlightIconWrap: {
      width: 46,
      height: 46,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    highlightText: { flex: 1, gap: 2 },
    highlightLabel: {
      ...theme.typography.body,
      color: theme.colors.text,
      fontWeight: '700',
    },
    highlightDesc: {
      ...theme.typography.caption,
      fontSize: 12,
      color: theme.colors.textMuted,
    },
    gridItem: {
      width: '31%',
      backgroundColor: theme.colors.cardBg,
      borderRadius: theme.borderRadius.xl,
      paddingVertical: theme.spacing.lg,
      alignItems: 'center',
      gap: theme.spacing.sm,
      ...theme.shadows.card,
    },
    gridIconWrap: {
      width: 48,
      height: 48,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    gridLabel: {
      ...theme.typography.caption,
      color: theme.colors.text,
      fontWeight: '600',
      textAlign: 'center',
    },
    settingsBtn: {
      backgroundColor: theme.colors.cardBg,
      borderRadius: theme.borderRadius.xl,
      flexDirection: 'row',
      alignItems: 'center',
      padding: theme.spacing.lg,
      gap: theme.spacing.md,
      ...theme.shadows.card,
    },
    settingsLabel: {
      ...theme.typography.body,
      color: theme.colors.text,
      fontWeight: '600',
      flex: 1,
    },
  }), [theme, insets]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Dashboard</Text>
        <Text style={styles.subtitle}>Quick access to all features</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Quick stats */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { backgroundColor: theme.colors.success }]}>
            <Ionicons name="checkmark-circle" size={26} color="#FFF" />
            <Text style={styles.summaryNumber}>{taskStats.completed}</Text>
            <Text style={styles.summaryLabel}>Done</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: theme.colors.accent }]}>
            <Ionicons name="time-outline" size={26} color="#FFF" />
            <Text style={styles.summaryNumber}>{taskStats.pending}</Text>
            <Text style={styles.summaryLabel}>Pending</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: theme.colors.primary }]}>
            <Ionicons name="list-outline" size={26} color="#FFF" />
            <Text style={styles.summaryNumber}>{taskStats.completed + taskStats.pending}</Text>
            <Text style={styles.summaryLabel}>Total</Text>
          </View>
        </View>

        {/* Highlighted features — full-width rows so they read first */}
        <View>
          <Text style={styles.sectionTitle}>Highlights</Text>
          <View style={styles.highlightList}>
            {HIGHLIGHT_LINKS.map((link) => (
              <TouchableOpacity
                key={link.route}
                style={[styles.highlightCard, { borderLeftColor: link.color }]}
                onPress={() => navigation.navigate(link.route as any)}
                activeOpacity={0.75}
              >
                <View style={[styles.highlightIconWrap, { backgroundColor: link.color + '20' }]}>
                  <Ionicons name={link.icon} size={24} color={link.color} />
                </View>
                <View style={styles.highlightText}>
                  <Text style={styles.highlightLabel}>{link.label}</Text>
                  <Text style={styles.highlightDesc}>{link.description}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.colors.textDisabled} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Everything else, grouped by what it's for */}
        {FEATURE_GROUPS.map((group) => (
          <View key={group.title}>
            <Text style={styles.sectionTitle}>{group.title}</Text>
            <View style={styles.grid}>
              {group.links.map((link) => (
                <TouchableOpacity
                  key={link.route}
                  style={styles.gridItem}
                  onPress={() => navigation.navigate(link.route as any)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.gridIconWrap, { backgroundColor: link.color + '20' }]}>
                    <Ionicons name={link.icon} size={24} color={link.color} />
                  </View>
                  <Text style={styles.gridLabel}>{link.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {/* Settings link */}
        <View>
          <Text style={styles.sectionTitle}>Preferences</Text>
          <TouchableOpacity
            style={styles.settingsBtn}
            onPress={() => navigation.navigate('Settings')}
            activeOpacity={0.7}
          >
            <View style={[styles.gridIconWrap, { backgroundColor: '#6B728020', width: 40, height: 40, borderRadius: 12 }]}>
              <Ionicons name="settings-outline" size={22} color={theme.colors.textMuted} />
            </View>
            <Text style={styles.settingsLabel}>Settings</Text>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.textDisabled} />
          </TouchableOpacity>
        </View>
      </ScrollView>
      <AdBanner />
    </View>
  );
}
