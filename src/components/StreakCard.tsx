import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import type { StreakData } from '../services/streakService';
import {
  getWeekActivity,
  freezesAvailable,
  getNextMilestone,
  canRepair,
  repairHoursRemaining,
} from '../services/streakService';

interface Props {
  streak: StreakData;
  onRepair?: () => void;
}

export function StreakCard({ streak, onRepair }: Props) {
  const { theme } = useTheme();

  const weekDays = useMemo(() => getWeekActivity(streak), [streak]);
  const freezesLeft = useMemo(() => freezesAvailable(streak), [streak]);
  const nextMilestone = useMemo(() => getNextMilestone(streak.currentStreak), [streak.currentStreak]);
  const repairable = useMemo(() => canRepair(streak), [streak]);
  const hoursLeft = useMemo(() => repairHoursRemaining(streak), [streak]);
  const progressToMilestone = useMemo(() => {
    if (!nextMilestone) return 1;
    const prevMilestone = [0, 3, 7, 14, 21, 30, 50, 75, 100, 150, 200, 365]
      .filter(m => m < nextMilestone)
      .pop() ?? 0;
    const range = nextMilestone - prevMilestone;
    return Math.min(1, (streak.currentStreak - prevMilestone) / range);
  }, [streak.currentStreak, nextMilestone]);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      backgroundColor: theme.colors.cardBg,
      borderRadius: 20,
      padding: 20,
      marginBottom: 20,
      ...theme.shadows.card,
    },
    topRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    streakLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    fireCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: streak.currentStreak > 0 ? '#FF950020' : theme.colors.inputBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    streakNum: {
      fontSize: 28,
      fontWeight: '900',
      color: streak.currentStreak > 0 ? theme.colors.text : theme.colors.textMuted,
    },
    streakLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.textMuted,
      marginTop: -2,
    },
    freezeBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: freezesLeft > 0 ? '#3B82F620' : theme.colors.inputBg,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 12,
    },
    freezeText: {
      fontSize: 11,
      fontWeight: '700',
      color: freezesLeft > 0 ? '#3B82F6' : theme.colors.textMuted,
    },
    repairBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 12,
      backgroundColor: '#F59E0B18',
      borderRadius: 14,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: '#F59E0B40',
    },
    repairTextWrap: { flex: 1 },
    repairTitle: {
      fontSize: 13,
      fontWeight: '800',
      color: theme.colors.text,
    },
    repairSub: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.colors.textMuted,
      marginTop: 2,
    },
    repairBtn: {
      backgroundColor: '#F59E0B',
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 10,
    },
    repairBtnText: {
      color: '#FFF',
      fontSize: 12,
      fontWeight: '800',
    },
    weekRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    dayCol: {
      alignItems: 'center',
      gap: 6,
      flex: 1,
    },
    dayDot: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayDotActive: {
      backgroundColor: theme.colors.primary,
    },
    dayDotInactive: {
      backgroundColor: theme.colors.inputBg,
    },
    dayDotToday: {
      borderWidth: 2,
      borderColor: theme.colors.primary,
    },
    dayLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.colors.textMuted,
    },
    progressWrap: {
      marginBottom: 8,
    },
    progressLabel: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 6,
    },
    progressText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.textMuted,
    },
    progressMilestone: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.primary,
    },
    progressTrack: {
      height: 8,
      backgroundColor: theme.colors.inputBg,
      borderRadius: 4,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: theme.colors.primary,
      borderRadius: 4,
    },
    statsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 12,
    },
    statItem: {
      alignItems: 'center',
      flex: 1,
    },
    statValue: {
      fontSize: 16,
      fontWeight: '800',
      color: theme.colors.text,
    },
    statLabel: {
      fontSize: 10,
      fontWeight: '600',
      color: theme.colors.textMuted,
      marginTop: 2,
    },
  }), [theme, streak, freezesLeft]);

  const todayKey = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  return (
    <View style={styles.container}>
      {/* Top: Streak number + freeze badge */}
      <View style={styles.topRow}>
        <View style={styles.streakLeft}>
          <View style={styles.fireCircle}>
            <Ionicons
              name="flame"
              size={24}
              color={streak.currentStreak > 0 ? '#FF9500' : theme.colors.textMuted}
            />
          </View>
          <View>
            <Text style={styles.streakNum}>{streak.currentStreak}</Text>
            <Text style={styles.streakLabel}>Day Streak</Text>
          </View>
        </View>
        <View style={styles.freezeBadge}>
          <Ionicons
            name="snow"
            size={14}
            color={freezesLeft > 0 ? '#3B82F6' : theme.colors.textMuted}
          />
          <Text style={styles.freezeText}>
            {freezesLeft} Freeze{freezesLeft !== 1 ? 's' : ''}
          </Text>
        </View>
      </View>

      {/* Repair banner — only when a recently-broken streak is recoverable */}
      {repairable && onRepair && (
        <View style={styles.repairBanner}>
          <Ionicons name="bandage" size={22} color="#F59E0B" />
          <View style={styles.repairTextWrap}>
            <Text style={styles.repairTitle}>
              Repair your {streak.brokenStreakLength}-day streak
            </Text>
            <Text style={styles.repairSub}>
              {hoursLeft}h left · 1 repair / month
            </Text>
          </View>
          <TouchableOpacity style={styles.repairBtn} onPress={onRepair} activeOpacity={0.8}>
            <Text style={styles.repairBtnText}>REPAIR</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Week dots */}
      <View style={styles.weekRow}>
        {weekDays.map((day) => {
          const isToday = day.key === todayKey;
          return (
            <View key={day.key} style={styles.dayCol}>
              <View
                style={[
                  styles.dayDot,
                  day.active ? styles.dayDotActive : styles.dayDotInactive,
                  isToday && !day.active && styles.dayDotToday,
                ]}
              >
                {day.active && (
                  <Ionicons name="checkmark" size={16} color="#FFF" />
                )}
              </View>
              <Text style={[styles.dayLabel, isToday && { color: theme.colors.primary, fontWeight: '800' }]}>
                {day.label}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Progress to next milestone */}
      {nextMilestone && (
        <View style={styles.progressWrap}>
          <View style={styles.progressLabel}>
            <Text style={styles.progressText}>
              {nextMilestone - streak.currentStreak} day{nextMilestone - streak.currentStreak !== 1 ? 's' : ''} to next milestone
            </Text>
            <Text style={styles.progressMilestone}>{nextMilestone} 🏆</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressToMilestone * 100}%` }]} />
          </View>
        </View>
      )}

      {/* Bottom stats */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{streak.currentStreak}</Text>
          <Text style={styles.statLabel}>Current</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{streak.longestStreak}</Text>
          <Text style={styles.statLabel}>Longest</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{streak.activeDates.length}</Text>
          <Text style={styles.statLabel}>Total Days</Text>
        </View>
      </View>
    </View>
  );
}
