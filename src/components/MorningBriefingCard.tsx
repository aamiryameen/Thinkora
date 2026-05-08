import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';
import { useFeatures } from '../context/FeaturesContext';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { pickResurfaceCandidates, markResurfaced, type ResurfaceCandidate } from '../services/ideaResurfaceService';

const VIBE_BY_HOUR: Record<string, { greeting: string; emoji: string; vibe: string }> = {
  morning: { greeting: 'Good morning', emoji: '☀️', vibe: 'Fresh start. Pick one thing that matters most today.' },
  afternoon: { greeting: 'Good afternoon', emoji: '⛅', vibe: 'You\'re halfway through. What\'s the one thing left to ship?' },
  evening: { greeting: 'Good evening', emoji: '🌙', vibe: 'Wind-down time. What did today teach you?' },
  night: { greeting: 'Late night', emoji: '🌌', vibe: 'Rest matters. Tomorrow is a new day.' },
};

function timeBucket(): keyof typeof VIBE_BY_HOUR {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  if (h >= 17 && h < 22) return 'evening';
  return 'night';
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function MorningBriefingCard() {
  const { theme } = useTheme();
  const { tasks, notes, streak } = useApp();
  const { habits } = useFeatures();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [resurface, setResurface] = useState<ResurfaceCandidate | null>(null);

  useEffect(() => {
    pickResurfaceCandidates(notes, 1).then(c => setResurface(c[0] ?? null));
  }, [notes]);

  const bucket = timeBucket();
  const vibe = VIBE_BY_HOUR[bucket];

  const today = todayStr();
  const todayTime = new Date(today + 'T00:00:00').getTime();
  const todayEnd = todayTime + 86400000;

  // Top task: due today, not completed, highest priority first
  const topTask = useMemo(() => {
    const candidates = tasks.filter(t => !t.completed && (t.dueDate == null || (t.dueDate >= todayTime && t.dueDate < todayEnd)));
    candidates.sort((a, b) => {
      const pmap = { high: 0, medium: 1, low: 2, none: 3 } as Record<string, number>;
      const ap = pmap[a.priority] ?? 3;
      const bp = pmap[b.priority] ?? 3;
      if (ap !== bp) return ap - bp;
      return (a.dueDate ?? Number.MAX_SAFE_INTEGER) - (b.dueDate ?? Number.MAX_SAFE_INTEGER);
    });
    return candidates[0];
  }, [tasks, todayTime, todayEnd]);

  const tasksDoneToday = tasks.filter(t => t.completed && t.updatedAt >= todayTime).length;
  const habitsLeft = habits.filter(h => !h.archived && !h.completedDates.includes(today)).length;

  const handleResurfaceOpen = async () => {
    if (!resurface) return;
    await markResurfaced(resurface.note.id);
    navigation.navigate('NoteEditor', { noteId: resurface.note.id });
  };

  const styles = useMemo(() => StyleSheet.create({
    card: {
      backgroundColor: theme.colors.cardBg,
      borderRadius: theme.borderRadius.xl,
      padding: theme.spacing.lg,
      gap: 12,
      ...theme.shadows.card,
    },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    emoji: { fontSize: 22 },
    greeting: { fontSize: 13, fontWeight: '700', color: theme.colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, flex: 1 },
    streakBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: '#F59E0B20' },
    streakBadgeText: { fontSize: 11, fontWeight: '800', color: '#F59E0B' },
    vibe: { fontSize: 14, fontWeight: '600', color: theme.colors.text, lineHeight: 20 },
    pillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    pill: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      backgroundColor: theme.colors.inputBg,
      paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
    },
    pillText: { fontSize: 12, fontWeight: '700', color: theme.colors.text },
    topTaskRow: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      backgroundColor: theme.colors.primary + '10',
      borderRadius: 10, padding: 12,
    },
    topTaskText: { flex: 1, fontSize: 14, fontWeight: '700', color: theme.colors.text },
    topTaskLabel: { fontSize: 10, fontWeight: '800', color: theme.colors.primary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
    resurfaceRow: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border,
    },
    resurfaceText: { flex: 1, fontSize: 12, color: theme.colors.textMuted },
    resurfaceTitle: { fontSize: 13, fontWeight: '700', color: theme.colors.text, marginBottom: 1 },
  }), [theme]);

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.emoji}>{vibe.emoji}</Text>
        <Text style={styles.greeting}>{vibe.greeting}</Text>
        {streak.currentStreak > 0 && (
          <View style={styles.streakBadge}>
            <Text style={{ fontSize: 11 }}>🔥</Text>
            <Text style={styles.streakBadgeText}>{streak.currentStreak}</Text>
          </View>
        )}
      </View>

      <Text style={styles.vibe}>{vibe.vibe}</Text>

      {topTask && (
        <TouchableOpacity
          style={styles.topTaskRow}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('TaskEditor', { taskId: topTask.id })}
        >
          <Ionicons name="flag" size={20} color={theme.colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.topTaskLabel}>One Thing Today</Text>
            <Text style={styles.topTaskText} numberOfLines={1}>{topTask.title}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
        </TouchableOpacity>
      )}

      <View style={styles.pillsRow}>
        {tasksDoneToday > 0 && (
          <View style={styles.pill}>
            <Ionicons name="checkmark-circle" size={13} color="#10B981" />
            <Text style={styles.pillText}>{tasksDoneToday} done</Text>
          </View>
        )}
        {habitsLeft > 0 && (
          <View style={styles.pill}>
            <Ionicons name="flame-outline" size={13} color="#F59E0B" />
            <Text style={styles.pillText}>{habitsLeft} habit{habitsLeft === 1 ? '' : 's'} left</Text>
          </View>
        )}
        {tasksDoneToday === 0 && habitsLeft === 0 && (
          <View style={styles.pill}>
            <Ionicons name="leaf-outline" size={13} color={theme.colors.textMuted} />
            <Text style={styles.pillText}>Calm day</Text>
          </View>
        )}
      </View>

      {resurface && (
        <TouchableOpacity style={styles.resurfaceRow} activeOpacity={0.85} onPress={handleResurfaceOpen}>
          <Ionicons name="bulb-outline" size={20} color="#F59E0B" />
          <View style={{ flex: 1 }}>
            <Text style={styles.resurfaceTitle} numberOfLines={1}>
              💡 Remember: {resurface.note.title || 'Untitled'}
            </Text>
            <Text style={styles.resurfaceText} numberOfLines={1}>
              From {resurface.daysSinceCreated} days ago — tap to revisit
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
        </TouchableOpacity>
      )}
    </View>
  );
}
