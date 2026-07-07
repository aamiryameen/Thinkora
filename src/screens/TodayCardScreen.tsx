import React, { useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useApp } from '../context/AppContext';
import { useFeatures } from '../context/FeaturesContext';
import { useTheme } from '../context/ThemeContext';
import { loadPulseState } from '../services/dailyPulseService';
import { buildTodayCard, type TodayCardData } from '../services/todayCardService';
import { shareViewAsCard } from '../services/shareCardService';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const HERO_GRADIENT_TOP = '#1F2937';     // deep slate
const HERO_GRADIENT_BOTTOM = '#0F172A';  // near-black
const GENTLE_TOP = '#1E293B';
const GENTLE_BOTTOM = '#0B1220';

export function TodayCardScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { tasks, streak } = useApp();
  const { habits, journalEntries, pomodoroSessions } = useFeatures();

  const [pulse, setPulse] = useState<TodayCardData | null>(null);
  const [sharing, setSharing] = useState(false);
  const cardRef = useRef<View>(null);

  // Load pulse state once and assemble the card
  const cardData = useMemo<TodayCardData | null>(() => {
    if (!pulse) return null;
    return pulse;
  }, [pulse]);

  React.useEffect(() => {
    loadPulseState().then((p) => {
      const built = buildTodayCard({
        tasks,
        habits,
        journalEntries,
        pomodoroSessions,
        streak,
        pulse: p,
      });
      setPulse(built);
    });
  }, [tasks, habits, journalEntries, pomodoroSessions, streak]);

  const handleShare = async () => {
    if (!cardRef.current || sharing) return;
    setSharing(true);
    try {
      await shareViewAsCard(cardRef.current, `thinkora-today-${cardData?.dateKey ?? ''}`);
    } catch (e) {
      console.warn('[TodayCard] share failed', e);
      Alert.alert('Share failed', 'Could not capture the card. Please try again.');
    } finally {
      setSharing(false);
    }
  };

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
    scrollContent: {
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: insets.bottom + 120,
      alignItems: 'center',
    },

    // Buttons
    btnRow: {
      flexDirection: 'row',
      gap: 10,
      width: '100%',
      maxWidth: 420,
      marginTop: 20,
    },
    primaryBtn: {
      flex: 2,
      backgroundColor: theme.colors.primary,
      paddingVertical: 16,
      borderRadius: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    primaryBtnText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
    secondaryBtn: {
      flex: 1,
      backgroundColor: theme.colors.cardBg,
      paddingVertical: 16,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    secondaryBtnText: { color: theme.colors.text, fontSize: 15, fontWeight: '700' },

    loading: {
      flex: 1, alignItems: 'center', justifyContent: 'center',
    },
    loadingText: { color: theme.colors.textMuted, fontSize: 14 },
  }), [theme, insets]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Today Card</Text>
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={20} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      {!cardData ? (
        <View style={styles.loading}>
          <Text style={styles.loadingText}>Building your card...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <CardArtwork ref={cardRef} data={cardData} />

          <View style={styles.btnRow}>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={handleShare}
              disabled={sharing}
              activeOpacity={0.85}
            >
              <Ionicons name="share-social" size={18} color="#FFF" />
              <Text style={styles.primaryBtnText}>
                {sharing ? 'Preparing…' : 'Share'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
            >
              <Text style={styles.secondaryBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

// ── Card artwork ───────────────────────────────────────────────────────────
interface ArtProps {
  data: TodayCardData;
}

const CardArtwork = React.forwardRef<View, ArtProps>(({ data }, ref) => {
  const isHero = data.framing === 'hero';
  const bgTop = isHero ? HERO_GRADIENT_TOP : GENTLE_TOP;
  const bgBottom = isHero ? HERO_GRADIENT_BOTTOM : GENTLE_BOTTOM;
  const accent = data.perfectDay ? '#FBBF24' : '#FF9500';

  const styles = StyleSheet.create({
    card: {
      width: '100%',
      maxWidth: 420,
      aspectRatio: 9 / 16,
      borderRadius: 28,
      overflow: 'hidden',
      backgroundColor: bgTop,
      padding: 28,
      justifyContent: 'space-between',
      borderWidth: data.perfectDay ? 2 : 0,
      borderColor: data.perfectDay ? accent : 'transparent',
      shadowColor: '#000',
      shadowOpacity: 0.4,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 12,
    },
    // Cheap "gradient" using an absolute layered view with opacity blend.
    bgLayer: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: bgBottom,
      opacity: 0.55,
    },
    badge: {
      alignSelf: 'flex-start',
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: accent + '22',
      borderWidth: 1,
      borderColor: accent + '66',
      marginBottom: 12,
    },
    badgeText: {
      color: accent,
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 0.5,
    },
    dateText: {
      color: '#9CA3AF',
      fontSize: 13,
      fontWeight: '700',
      letterSpacing: 0.3,
    },
    headlineRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginTop: 6,
    },
    headline: {
      color: '#FFF',
      fontSize: 28,
      fontWeight: '900',
      lineHeight: 32,
      flex: 1,
    },
    streakPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: '#FF950022',
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    streakPillText: {
      color: '#FF9500',
      fontWeight: '900',
      fontSize: 13,
    },

    statsBlock: { gap: 14, marginVertical: 22 },
    statRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    statEmoji: { fontSize: 22, width: 28, textAlign: 'center' },
    statText: { color: '#E5E7EB', fontSize: 15, fontWeight: '600', flex: 1 },
    statValue: { color: '#FFF', fontWeight: '900' },

    divider: {
      height: 1,
      backgroundColor: 'rgba(255,255,255,0.1)',
      marginVertical: 16,
    },
    sectionLabel: {
      color: '#9CA3AF',
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 1.4,
      marginBottom: 8,
    },
    oneThingText: {
      color: '#FFF',
      fontSize: 16,
      fontWeight: '700',
      lineHeight: 22,
    },
    quote: {
      color: '#9CA3AF',
      fontSize: 13,
      fontStyle: 'italic',
      lineHeight: 19,
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    brand: {
      color: '#6B7280',
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.4,
    },
    brandHeart: { color: '#FF9500' },
  });

  // Build the stats list dynamically — only include rows with real activity
  // so the card looks clean on slow days.
  const statRows: { emoji: string; text: React.ReactNode }[] = [];
  if (data.tasksTotal > 0 || data.tasksDone > 0) {
    statRows.push({
      emoji: '✅',
      text: (
        <Text style={styles.statText}>
          <Text style={styles.statValue}>{data.tasksDone}</Text>
          {data.tasksTotal > 0 ? `/${data.tasksTotal}` : ''} tasks completed
        </Text>
      ),
    });
  }
  if (data.habitsTotal > 0) {
    statRows.push({
      emoji: '💧',
      text: (
        <Text style={styles.statText}>
          <Text style={styles.statValue}>{data.habitsDone}</Text>/{data.habitsTotal} habits
        </Text>
      ),
    });
  }
  if (data.pomodoroCount > 0) {
    statRows.push({
      emoji: '🍅',
      text: (
        <Text style={styles.statText}>
          <Text style={styles.statValue}>{data.pomodoroCount}</Text> focus session
          {data.pomodoroCount !== 1 ? 's' : ''}
          {data.pomodoroMinutes > 0 ? ` · ${data.pomodoroMinutes} min` : ''}
        </Text>
      ),
    });
  }
  if (data.journaledMood !== null) {
    statRows.push({
      emoji: '📝',
      text: (
        <Text style={styles.statText}>
          Journaled · feeling <Text style={styles.statValue}>{data.journaledEmoji}</Text>
        </Text>
      ),
    });
  }
  // Fallback when nothing happened — gentle framing
  if (statRows.length === 0) {
    statRows.push({
      emoji: '🌱',
      text: <Text style={styles.statText}>Tomorrow's a fresh start.</Text>,
    });
  }

  return (
    <View ref={ref} style={styles.card} collapsable={false}>
      <View style={styles.bgLayer} />

      <View>
        {data.badgeText && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{data.badgeText.toUpperCase()}</Text>
          </View>
        )}
        <Text style={styles.dateText}>{data.longDate.toUpperCase()}</Text>
        <View style={styles.headlineRow}>
          <Text style={styles.headline}>
            {isHero ? 'Today, I showed up.' : 'A quiet day.'}
          </Text>
          {data.activityStreak > 0 && (
            <View style={styles.streakPill}>
              <Text style={styles.streakPillText}>🔥 {data.activityStreak}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.statsBlock}>
        {statRows.map((r, i) => (
          <View key={i} style={styles.statRow}>
            <Text style={styles.statEmoji}>{r.emoji}</Text>
            {r.text}
          </View>
        ))}
      </View>

      {data.tomorrowOneThing && (
        <View>
          <View style={styles.divider} />
          <Text style={styles.sectionLabel}>⭐ TOMORROW</Text>
          <Text style={styles.oneThingText}>{data.tomorrowOneThing}</Text>
          <View style={styles.divider} />
        </View>
      )}

      <View>
        <Text style={styles.quote}>"{data.quote}"</Text>
        <View style={[styles.divider, { marginVertical: 14 }]} />
        <View style={styles.footer}>
          <Text style={styles.brand}>
            Made with Thinkora <Text style={styles.brandHeart}>🔥</Text>
          </Text>
          {data.pulseStreak > 0 && (
            <Text style={styles.brand}>Pulse · {data.pulseStreak}d</Text>
          )}
        </View>
      </View>
    </View>
  );
});

CardArtwork.displayName = 'CardArtwork';
