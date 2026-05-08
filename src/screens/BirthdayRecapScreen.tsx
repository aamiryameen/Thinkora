import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  Share,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';
import { useFeatures } from '../context/FeaturesContext';
import { storage } from '../services/storage';
import { buildRecap, getFirstLaunchTimestamp, type RecapData } from '../services/recapService';
import type { JournalEntry, PomodoroSession } from '../types';

export function BirthdayRecapScreen() {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { tasks, notes, taskCategories, streak } = useApp();
  const { habits } = useFeatures();

  const [recap, setRecap] = useState<RecapData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [pomodoroSessions, journalEntries, firstLaunch] = await Promise.all([
          storage.getPomodoroSessions(),
          storage.getJournalEntries(),
          getFirstLaunchTimestamp(),
        ]);
        // Cover the past 12 months ending today
        const rangeEnd = Date.now();
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        const rangeStart = Math.max(firstLaunch, oneYearAgo.getTime());

        const r = buildRecap(rangeStart, rangeEnd, {
          notes,
          tasks,
          habits,
          journalEntries: journalEntries as JournalEntry[],
          pomodoroSessions: pomodoroSessions as PomodoroSession[],
          longestStreak: streak.longestStreak,
          taskCategories: taskCategories.map(c => ({ id: c.id, name: c.name })),
        });
        setRecap(r);
      } finally {
        setLoading(false);
      }
    })();
  }, [tasks, notes, habits, taskCategories, streak.longestStreak]);

  const handleShare = async () => {
    if (!recap) return;
    const text = `My Thinkora Year in Review 🎉

✅ ${recap.totalTasksCompleted} tasks completed
📝 ${recap.totalNotes} notes written
🍅 ${Math.round(recap.totalFocusMinutes / 60)} hours focused
🔥 ${recap.longestStreak}-day longest streak
📅 Busiest month: ${recap.busiestMonth.month}

${recap.funFact}

Get Thinkora: https://play.google.com/store/apps/details?id=com.thinkora`;
    try { await Share.share({ message: text }); } catch {}
  };

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    header: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingHorizontal: 16, paddingTop: insets.top + 12, paddingBottom: 12,
      backgroundColor: theme.colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border,
    },
    headerTitle: { fontSize: 20, fontWeight: '800', color: theme.colors.text, flex: 1 },
    hero: {
      backgroundColor: theme.colors.primary, padding: 28, alignItems: 'center', gap: 6,
    },
    heroEmoji: { fontSize: 56 },
    heroTitle: { fontSize: 22, fontWeight: '900', color: '#FFF', textAlign: 'center' },
    heroSub: { fontSize: 14, color: 'rgba(255,255,255,0.85)', fontWeight: '600', textAlign: 'center' },
    statsGrid: { padding: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    statCard: {
      flex: 1, minWidth: '45%',
      backgroundColor: theme.colors.cardBg,
      borderRadius: 14, padding: 16, gap: 4,
      ...theme.shadows.card,
    },
    statValue: { fontSize: 28, fontWeight: '900', color: theme.colors.text },
    statLabel: { fontSize: 11, fontWeight: '700', color: theme.colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
    statSub: { fontSize: 11, color: theme.colors.textMuted, marginTop: 2 },
    funFactCard: {
      margin: 16, padding: 18,
      backgroundColor: theme.colors.primary + '12',
      borderRadius: 14, borderLeftWidth: 4, borderLeftColor: theme.colors.primary,
      gap: 4,
    },
    funFactLabel: { fontSize: 11, fontWeight: '800', color: theme.colors.primary, textTransform: 'uppercase', letterSpacing: 0.5 },
    funFactText: { fontSize: 16, fontWeight: '700', color: theme.colors.text, lineHeight: 24 },
    shareBtn: {
      margin: 16, marginTop: 8,
      backgroundColor: theme.colors.primary,
      borderRadius: 14, paddingVertical: 16,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    },
    shareBtnText: { color: '#FFF', fontWeight: '800', fontSize: 15 },
  }), [theme, insets]);

  if (loading || !recap) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={theme.colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Your Year in Review</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
        <View style={styles.hero}>
          <Text style={styles.heroEmoji}>🎉</Text>
          <Text style={styles.heroTitle}>What a Year!</Text>
          <Text style={styles.heroSub}>Here's everything you accomplished</Text>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{recap.totalTasksCompleted}</Text>
            <Text style={styles.statLabel}>Tasks Done</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{recap.totalNotes}</Text>
            <Text style={styles.statLabel}>Notes Written</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{Math.round(recap.totalFocusMinutes / 60)}h</Text>
            <Text style={styles.statLabel}>Focused Time</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{recap.totalHabitCheckins}</Text>
            <Text style={styles.statLabel}>Habit Check-ins</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{recap.longestStreak}</Text>
            <Text style={styles.statLabel}>Longest Streak (days)</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{recap.totalJournalEntries}</Text>
            <Text style={styles.statLabel}>Journal Entries</Text>
            {recap.averageMood !== null && (
              <Text style={styles.statSub}>Avg mood: {recap.averageMood.toFixed(1)}/5</Text>
            )}
          </View>
        </View>

        {recap.busiestMonth.count > 0 && (
          <View style={[styles.statCard, { marginHorizontal: 16, padding: 18 }]}>
            <Text style={styles.statLabel}>Busiest Month</Text>
            <Text style={styles.statValue}>{recap.busiestMonth.month}</Text>
            <Text style={styles.statSub}>{recap.busiestMonth.count} activities</Text>
          </View>
        )}

        {recap.topCategory && (
          <View style={[styles.statCard, { marginHorizontal: 16, marginTop: 12, padding: 18 }]}>
            <Text style={styles.statLabel}>Top Category</Text>
            <Text style={styles.statValue}>{recap.topCategory.name}</Text>
            <Text style={styles.statSub}>{recap.topCategory.count} tasks completed</Text>
          </View>
        )}

        <View style={styles.funFactCard}>
          <Text style={styles.funFactLabel}>Did you know?</Text>
          <Text style={styles.funFactText}>{recap.funFact}</Text>
        </View>

        <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.85}>
          <Ionicons name="share-social-outline" size={20} color="#FFF" />
          <Text style={styles.shareBtnText}>Share My Recap</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
