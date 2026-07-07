import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useApp } from '../context/AppContext';
import { useFeatures } from '../context/FeaturesContext';
import { useTheme } from '../context/ThemeContext';
import { getCurrentWeather, type WeatherSnapshot } from '../services/weatherService';
import { getHolidaysForRange, type Holiday } from '../services/holidayService';
import { freezesAvailable } from '../services/streakService';
import { loadPulseState, type DailyPulseState } from '../services/dailyPulseService';
import { markBrewShown } from '../services/morningBrewService';
import { dayKey } from '../services/streakService';
import type { RootStackParamList } from '../navigation/types';
import type { Task } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function MorningBrewScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { tasks, settings, streak, toggleTaskComplete } = useApp();
  const { habits } = useFeatures();

  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);
  const [holiday, setHoliday] = useState<Holiday | null>(null);
  const [pulse, setPulse] = useState<DailyPulseState | null>(null);
  const [loading, setLoading] = useState(true);

  // Mark as shown the first time we hit this screen so it won't reappear
  // automatically today. Manual entry from Dashboard always works.
  useEffect(() => {
    markBrewShown().catch(() => {});
  }, []);

  // Parallel fetches: weather, today's holiday, pulse state.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const country = settings.holidayCountry || 'PK';
    const year = new Date().getFullYear();

    Promise.allSettled([
      getCurrentWeather().catch(() => null),
      getHolidaysForRange(country, year, year).catch(() => [] as Holiday[]),
      loadPulseState(),
    ]).then(([w, h, p]) => {
      if (cancelled) return;
      if (w.status === 'fulfilled') setWeather(w.value);
      if (h.status === 'fulfilled') {
        const today = dayKey();
        setHoliday(h.value.find((x) => x.date === today) ?? null);
      }
      if (p.status === 'fulfilled') setPulse(p.value);
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [settings.holidayCountry]);

  // ── Yesterday's One Thing (the most recent unfinished one for today) ───
  const yesterdayOneThing = useMemo(() => {
    if (!pulse) return null;
    const today = dayKey();
    const candidate = [...pulse.oneThings].reverse().find((o) => o.forDate === today);
    if (!candidate) return null;
    if (candidate.completed) return null;
    return candidate;
  }, [pulse]);

  // Look up the linked task so we can complete it inline
  const oneThingTask = useMemo(() => {
    if (!yesterdayOneThing?.taskId) return null;
    return tasks.find((t) => t.id === yesterdayOneThing.taskId) ?? null;
  }, [yesterdayOneThing, tasks]);

  // ── Today's tasks count ────────────────────────────────────────────────
  const todayTasksCount = useMemo(() => {
    const today = dayKey();
    return tasks.filter((t: Task) => {
      if (t.completed || !t.dueDate) return false;
      return dayKey(new Date(t.dueDate)) === today;
    }).length;
  }, [tasks]);

  // ── Suggest one habit they typically do today (day-of-week heuristic) ─
  const suggestedHabit = useMemo(() => {
    const today = dayKey();
    const dow = new Date().getDay();
    const active = habits.filter((h) => !h.archived);
    if (active.length === 0) return null;
    // Already done today? Skip.
    const undone = active.filter((h) => !h.completedDates.includes(today));
    if (undone.length === 0) return null;
    // Prefer habits that have been done on this day-of-week before.
    const ranked = [...undone].sort((a, b) => {
      const aDow = a.completedDates.filter((d) => {
        const date = new Date(d + 'T00:00:00');
        return date.getDay() === dow;
      }).length;
      const bDow = b.completedDates.filter((d) => {
        const date = new Date(d + 'T00:00:00');
        return date.getDay() === dow;
      }).length;
      return bDow - aDow;
    });
    return ranked[0];
  }, [habits]);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 6) return 'Up early';
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: theme.spacing.lg,
      paddingTop: insets.top + theme.spacing.md,
      paddingBottom: theme.spacing.sm,
    },
    title: { ...theme.typography.title, fontSize: 22, fontWeight: '800', color: theme.colors.text },
    closeBtn: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: theme.colors.inputBg,
      alignItems: 'center', justifyContent: 'center',
    },
    scroll: {
      paddingHorizontal: theme.spacing.lg,
      paddingBottom: insets.bottom + 100,
      gap: theme.spacing.md,
    },

    greetingBlock: {
      paddingTop: theme.spacing.md,
      paddingBottom: theme.spacing.sm,
    },
    greetingText: {
      fontSize: 32, fontWeight: '900', color: theme.colors.text,
    },
    dateText: {
      fontSize: 14, color: theme.colors.textMuted, marginTop: 4, fontWeight: '600',
    },

    card: {
      backgroundColor: theme.colors.cardBg,
      borderRadius: 18,
      padding: theme.spacing.md,
      ...theme.shadows.card,
    },
    cardLabel: {
      ...theme.typography.overline,
      color: theme.colors.textMuted,
      letterSpacing: 1.2,
      marginBottom: 6,
    },
    cardRow: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
    },

    // Weather
    weatherEmoji: { fontSize: 38 },
    weatherTemp: {
      fontSize: 28, fontWeight: '900', color: theme.colors.text,
    },
    weatherCondition: {
      fontSize: 13, color: theme.colors.textMuted, fontWeight: '600',
    },
    weatherSub: {
      fontSize: 12, color: theme.colors.textMuted, marginTop: 2,
    },

    // One Thing card (hero)
    heroCard: {
      backgroundColor: '#F9731620',
      borderRadius: 18,
      padding: theme.spacing.md,
      borderWidth: 1.5,
      borderColor: '#F9731640',
    },
    heroLabel: {
      ...theme.typography.overline,
      color: '#F97316',
      letterSpacing: 1.2,
      marginBottom: 6,
      fontWeight: '900',
    },
    heroText: {
      fontSize: 18, fontWeight: '800', color: theme.colors.text, lineHeight: 24,
    },
    heroBtn: {
      marginTop: 12,
      backgroundColor: '#F97316',
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: 'center',
    },
    heroBtnText: { color: '#FFF', fontSize: 14, fontWeight: '800' },

    // Streak chip
    streakRow: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
    },
    streakNum: {
      fontSize: 22, fontWeight: '900', color: theme.colors.text,
    },
    streakLabel: { fontSize: 12, fontWeight: '700', color: theme.colors.textMuted },
    chipFlame: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: '#FF950020',
      alignItems: 'center', justifyContent: 'center',
    },
    chipSnow: {
      backgroundColor: '#3B82F620',
      paddingHorizontal: 10, paddingVertical: 6,
      borderRadius: 12,
      flexDirection: 'row', alignItems: 'center', gap: 4,
      marginLeft: 'auto',
    },
    chipSnowText: { color: '#3B82F6', fontWeight: '800', fontSize: 11 },

    // Holiday banner
    holidayCard: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      backgroundColor: '#EF444418',
      borderRadius: 16,
      padding: theme.spacing.md,
      borderWidth: 1, borderColor: '#EF444430',
    },
    holidayText: { fontSize: 14, fontWeight: '700', color: theme.colors.text },
    holidaySub: { fontSize: 11, color: theme.colors.textMuted, marginTop: 2 },

    // Tasks/habits row
    bigStat: { fontSize: 22, fontWeight: '900', color: theme.colors.text },
    bigStatSub: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },

    // CTA
    cta: {
      backgroundColor: theme.colors.primary,
      paddingVertical: 16, borderRadius: 16,
      alignItems: 'center',
      flexDirection: 'row', justifyContent: 'center', gap: 8,
      marginTop: theme.spacing.md,
    },
    ctaText: { color: '#FFF', fontSize: 15, fontWeight: '800' },

    loading: {
      paddingVertical: 60, alignItems: 'center', gap: 12,
    },
    loadingText: { color: theme.colors.textMuted, fontSize: 13 },
  }), [theme, insets]);

  const todayLong = new Date().toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Morning Brew ☕</Text>
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={20} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.greetingBlock}>
          <Text style={styles.greetingText}>{greeting}</Text>
          <Text style={styles.dateText}>{todayLong}</Text>
        </View>

        {loading && (
          <View style={styles.loading}>
            <ActivityIndicator color={theme.colors.primary} />
            <Text style={styles.loadingText}>Brewing your morning…</Text>
          </View>
        )}

        {/* Yesterday's "One Thing" — hero card if it exists */}
        {!loading && yesterdayOneThing && (
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>⭐ TODAY'S ONE THING</Text>
            <Text style={styles.heroText}>{yesterdayOneThing.title}</Text>
            {oneThingTask && (
              <TouchableOpacity
                style={styles.heroBtn}
                onPress={() => {
                  toggleTaskComplete(oneThingTask.id);
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.heroBtnText}>
                  {oneThingTask.completed ? '✓ Done' : 'Mark Done'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Streak status */}
        {!loading && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>YOUR STREAK</Text>
            <View style={styles.streakRow}>
              <View style={styles.chipFlame}>
                <Ionicons name="flame" size={22} color={streak.currentStreak > 0 ? '#FF9500' : theme.colors.textMuted} />
              </View>
              <View>
                <Text style={styles.streakNum}>{streak.currentStreak}-day streak</Text>
                <Text style={styles.streakLabel}>
                  {streak.currentStreak === 0
                    ? 'Today is day 1 if you show up'
                    : 'Keep it alive today'}
                </Text>
              </View>
              <View style={styles.chipSnow}>
                <Ionicons name="snow" size={12} color="#3B82F6" />
                <Text style={styles.chipSnowText}>{freezesAvailable(streak)}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Weather */}
        {!loading && weather && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>WEATHER</Text>
            <View style={styles.cardRow}>
              <Text style={styles.weatherEmoji}>{weather.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.weatherTemp}>{weather.temperature}°C</Text>
                <Text style={styles.weatherCondition}>
                  {weather.condition} · {weather.locationLabel}
                </Text>
                <Text style={styles.weatherSub}>
                  H {weather.highToday}° · L {weather.lowToday}°{' '}
                  {weather.precipMm > 0 ? `· ☔ ${weather.precipMm.toFixed(1)}mm` : ''}
                  {weather.isWindy ? ' · 💨 windy' : ''}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Today's holiday */}
        {!loading && holiday && (
          <View style={styles.holidayCard}>
            <Ionicons name="sparkles" size={20} color="#EF4444" />
            <View style={{ flex: 1 }}>
              <Text style={styles.holidayText}>
                Today is {holiday.localName || holiday.name}
              </Text>
              <Text style={styles.holidaySub}>{holiday.countryCode} · public holiday</Text>
            </View>
          </View>
        )}

        {/* Today's tasks count */}
        {!loading && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>TODAY'S TASKS</Text>
            <View style={styles.cardRow}>
              <View style={[styles.chipFlame, { backgroundColor: '#3B82F620' }]}>
                <Ionicons name="checkbox-outline" size={20} color="#3B82F6" />
              </View>
              <View>
                <Text style={styles.bigStat}>{todayTasksCount}</Text>
                <Text style={styles.bigStatSub}>
                  {todayTasksCount === 0 ? 'Nothing scheduled — make today yours' : `task${todayTasksCount === 1 ? '' : 's'} due today`}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Suggested habit */}
        {!loading && suggestedHabit && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>SUGGESTED · BASED ON YOUR HABITS</Text>
            <View style={styles.cardRow}>
              <View style={[styles.chipFlame, { backgroundColor: suggestedHabit.color + '22' }]}>
                <Ionicons name={suggestedHabit.icon as any} size={20} color={suggestedHabit.color} />
              </View>
              <View>
                <Text style={[styles.bigStat, { fontSize: 16 }]}>{suggestedHabit.name}</Text>
                <Text style={styles.bigStatSub}>You usually do this on this day</Text>
              </View>
            </View>
          </View>
        )}

        <TouchableOpacity
          style={styles.cta}
          onPress={() => navigation.goBack()}
          activeOpacity={0.85}
        >
          <Text style={styles.ctaText}>Let's go ☀️</Text>
          <Ionicons name="arrow-forward" size={18} color="#FFF" />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
