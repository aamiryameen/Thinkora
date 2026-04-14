import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { useFeatures } from '../context/FeaturesContext';
import { analyzeMoodInsights } from '../services/aiService';
import type { MoodInsight } from '../services/aiService';

const INSIGHT_COLORS = {
  positive: { bg: '#ECFDF5', border: '#10B981', icon: '#10B981' },
  negative: { bg: '#FFF1F2', border: '#F43F5E', icon: '#F43F5E' },
  neutral: { bg: '#F0F9FF', border: '#0EA5E9', icon: '#0EA5E9' },
  tip: { bg: '#FFFBEB', border: '#F59E0B', icon: '#F59E0B' },
};

export function AIMoodInsightsScreen() {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { journalEntries } = useFeatures();

  const insights = useMemo(() => analyzeMoodInsights(journalEntries), [journalEntries]);

  const totalEntries = journalEntries.length;
  const avgMood = useMemo(() => {
    if (journalEntries.length === 0) return 0;
    return journalEntries.slice(0, 30).reduce((s, e) => s + e.mood, 0) / Math.min(journalEntries.length, 30);
  }, [journalEntries]);

  const MOOD_EMOJIS = ['', '😞', '😕', '😐', '🙂', '😊'];

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    header: {
      paddingTop: insets.top + theme.spacing.sm,
      paddingHorizontal: theme.spacing.lg,
      paddingBottom: theme.spacing.md,
      backgroundColor: theme.colors.surface,
    },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
    title: { ...theme.typography.title, color: theme.colors.text, fontSize: 24, fontWeight: '700' },
    aiBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: '#7C3AED20',
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 4,
      borderRadius: theme.borderRadius.full,
      marginTop: 6,
    },
    aiBadgeText: { ...theme.typography.caption, color: '#7C3AED', fontWeight: '700' },
    scroll: { padding: theme.spacing.lg, paddingBottom: 100 },
    statsRow: { flexDirection: 'row', gap: theme.spacing.md, marginBottom: theme.spacing.lg },
    statCard: {
      flex: 1,
      backgroundColor: theme.colors.cardBg,
      borderRadius: theme.borderRadius.xl,
      padding: theme.spacing.lg,
      alignItems: 'center',
      gap: theme.spacing.xs,
      ...theme.shadows.card,
    },
    statEmoji: { fontSize: 32 },
    statValue: { ...theme.typography.title, color: theme.colors.text, fontWeight: '700' },
    statLabel: { ...theme.typography.caption, color: theme.colors.textMuted, textAlign: 'center' },
    sectionTitle: {
      ...theme.typography.label,
      color: theme.colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: theme.spacing.md,
    },
    insightCard: {
      borderRadius: theme.borderRadius.xl,
      padding: theme.spacing.lg,
      marginBottom: theme.spacing.md,
      borderLeftWidth: 4,
      ...theme.shadows.card,
    },
    insightHeader: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.xs },
    insightEmoji: { fontSize: 24 },
    insightTitle: { ...theme.typography.titleSmall, color: theme.colors.text, fontWeight: '700', flex: 1 },
    insightDesc: { ...theme.typography.body, color: theme.colors.textSecondary, lineHeight: 22 },
    emptyCard: {
      backgroundColor: theme.colors.cardBg,
      borderRadius: theme.borderRadius.xl,
      padding: theme.spacing.xxl,
      alignItems: 'center',
      gap: theme.spacing.md,
      ...theme.shadows.card,
    },
    emptyText: { ...theme.typography.body, color: theme.colors.textMuted, textAlign: 'center' },
  }), [theme, insets]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <View>
            <Text style={styles.title}>Mood Insights</Text>
            <View style={styles.aiBadge}>
              <Ionicons name="sparkles" size={12} color="#7C3AED" />
              <Text style={styles.aiBadgeText}>AI Analysis</Text>
            </View>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statEmoji}>{MOOD_EMOJIS[Math.round(avgMood)] || '😐'}</Text>
            <Text style={styles.statValue}>{avgMood > 0 ? avgMood.toFixed(1) : '—'}</Text>
            <Text style={styles.statLabel}>Avg Mood{'\n'}(30 days)</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statEmoji}>📔</Text>
            <Text style={styles.statValue}>{totalEntries}</Text>
            <Text style={styles.statLabel}>Total{'\n'}Entries</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Your Insights</Text>

        {totalEntries === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="analytics-outline" size={48} color={theme.colors.textDisabled} />
            <Text style={styles.emptyText}>
              Start logging your mood in the Mood Journal to unlock AI-powered insights about your emotional patterns.
            </Text>
          </View>
        ) : (
          insights.map((insight, i) => {
            const colors = INSIGHT_COLORS[insight.type];
            return (
              <View key={i} style={[styles.insightCard, { backgroundColor: colors.bg, borderLeftColor: colors.border }]}>
                <View style={styles.insightHeader}>
                  <Text style={styles.insightEmoji}>{insight.emoji}</Text>
                  <Text style={styles.insightTitle}>{insight.title}</Text>
                </View>
                <Text style={styles.insightDesc}>{insight.description}</Text>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}
