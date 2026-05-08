import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { AdBanner } from '../components/AdBanner';
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

const FEATURE_LINKS: QuickLink[] = [
  { label: 'Habits', icon: 'flame-outline', color: '#F59E0B', route: 'HabitTracker' },
  { label: 'Pomodoro', icon: 'timer-outline', color: '#14B8A6', route: 'Pomodoro' },
  { label: 'Journal', icon: 'happy-outline', color: '#EC4899', route: 'MoodJournal' },
  { label: 'Matrix', icon: 'apps-outline', color: '#8B5CF6', route: 'Eisenhower' },
  { label: 'Time Blocks', icon: 'time-outline', color: '#6366F1', route: 'TimeBlocking' },
  { label: 'Goals', icon: 'trophy-outline', color: '#F59E0B', route: 'Goals' },
  { label: 'Stats', icon: 'stats-chart-outline', color: '#10B981', route: 'ProductivityStats' },
  { label: 'Habit Stacks', icon: 'link-outline', color: '#EC4899', route: 'HabitStacks' },
  { label: 'Voice Command', icon: 'mic-outline', color: '#8B5CF6', route: 'VoiceCommand' },
  { label: 'Rewards', icon: 'ribbon-outline', color: '#F97316', route: 'StreakRewards' },
  { label: 'Year Recap', icon: 'gift-outline', color: '#EC4899', route: 'BirthdayRecap' },
  { label: 'Cloud Sync', icon: 'cloud-outline', color: '#3B82F6', route: 'CloudSync' },
  { label: 'Lists', icon: 'people-outline', color: '#3B82F6', route: 'SharedLists' },
  { label: 'Templates', icon: 'copy-outline', color: '#6366F1', route: 'Templates' },
  { label: 'Badges', icon: 'trophy-outline', color: '#F59E0B', route: 'Badges' },
  { label: 'Categories', icon: 'pricetags-outline', color: '#10B981', route: 'CategoryManager' },
  { label: 'Reports', icon: 'bar-chart-outline', color: '#4A90D9', route: 'Reports' },
  { label: 'Gantt', icon: 'git-branch-outline', color: '#0EA5E9', route: 'Gantt' },
  { label: 'Share', icon: 'share-social-outline', color: '#EC4899', route: 'ShareProgress' },
  { label: 'Sketch', icon: 'brush-outline', color: '#FF6347', route: 'Sketch' },
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
      paddingBottom: 180,
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

        {/* Features grid */}
        <View>
          <Text style={styles.sectionTitle}>Features</Text>
          <View style={styles.grid}>
            {FEATURE_LINKS.map((link) => (
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
