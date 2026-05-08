import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';
import { STREAK_REWARDS, getUnlocked, type StreakReward } from '../services/streakRewardsService';

export function StreakRewardsScreen() {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { streak } = useApp();
  const [unlockedDays, setUnlockedDays] = useState<number[]>([]);

  useEffect(() => {
    getUnlocked().then(s => setUnlockedDays(s.unlockedDays));
  }, []);

  const currentStreak = streak.currentStreak;

  const rewards = useMemo(() => {
    return STREAK_REWARDS.map(r => ({
      ...r,
      unlocked: unlockedDays.includes(r.day) || r.day <= currentStreak,
      progress: Math.min(100, Math.round((currentStreak / r.day) * 100)),
    }));
  }, [unlockedDays, currentStreak]);

  const nextReward = rewards.find(r => !r.unlocked);

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
      backgroundColor: theme.colors.primary, padding: 24, alignItems: 'center', gap: 6,
    },
    flame: { fontSize: 48 },
    streakText: { fontSize: 36, fontWeight: '900', color: '#FFF' },
    streakSub: { fontSize: 14, color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
    nextCard: {
      backgroundColor: theme.colors.cardBg, marginHorizontal: 16, marginTop: 16,
      borderRadius: 14, padding: 16, gap: 8, ...theme.shadows.card,
    },
    nextLabel: { fontSize: 11, fontWeight: '800', color: theme.colors.textMuted, textTransform: 'uppercase', letterSpacing: 1 },
    nextTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.text },
    nextDesc: { fontSize: 13, color: theme.colors.textMuted },
    nextBar: { height: 8, borderRadius: 4, backgroundColor: theme.colors.inputBg, overflow: 'hidden', marginTop: 4 },
    nextBarFill: { height: '100%', borderRadius: 4 },
    nextDays: { fontSize: 11, fontWeight: '700', color: theme.colors.textMuted, marginTop: 4 },
    grid: { padding: 16, gap: 10 },
    rewardCard: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: theme.colors.cardBg, borderRadius: 14,
      padding: 14, ...theme.shadows.card,
    },
    rewardCardLocked: { opacity: 0.5 },
    rewardIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
    rewardTitle: { fontSize: 14, fontWeight: '800', color: theme.colors.text },
    rewardDesc: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
    badge: {
      paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
      backgroundColor: '#10B98120',
    },
    badgeText: { fontSize: 10, fontWeight: '800', color: '#10B981', letterSpacing: 0.5 },
  }), [theme, insets]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Streak Rewards</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
        <View style={styles.hero}>
          <Text style={styles.flame}>🔥</Text>
          <Text style={styles.streakText}>{currentStreak}</Text>
          <Text style={styles.streakSub}>day{currentStreak === 1 ? '' : 's'} streak · longest {streak.longestStreak}</Text>
        </View>

        {nextReward && (
          <View style={styles.nextCard}>
            <Text style={styles.nextLabel}>Next Reward</Text>
            <Text style={styles.nextTitle}>{nextReward.title}</Text>
            <Text style={styles.nextDesc}>{nextReward.description}</Text>
            <View style={styles.nextBar}>
              <View style={[styles.nextBarFill, { width: `${nextReward.progress}%`, backgroundColor: nextReward.color }]} />
            </View>
            <Text style={styles.nextDays}>
              {nextReward.day - currentStreak} day{nextReward.day - currentStreak === 1 ? '' : 's'} to go
            </Text>
          </View>
        )}

        <View style={styles.grid}>
          {rewards.map(r => (
            <View key={r.day} style={[styles.rewardCard, !r.unlocked && styles.rewardCardLocked]}>
              <View style={[styles.rewardIcon, { backgroundColor: r.color + '20' }]}>
                <Ionicons name={r.unlocked ? r.icon as any : 'lock-closed'} size={22} color={r.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rewardTitle}>Day {r.day} · {r.title}</Text>
                <Text style={styles.rewardDesc}>{r.description}</Text>
              </View>
              {r.unlocked && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>UNLOCKED</Text>
                </View>
              )}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
