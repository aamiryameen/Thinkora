import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView,
  Animated, Easing, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useApp } from '../context/AppContext';
import { useFeatures } from '../context/FeaturesContext';
import { useTheme } from '../context/ThemeContext';
import {
  loadPulseState,
  completePulse,
  isPulseDoneToday,
  type DailyPulseState,
} from '../services/dailyPulseService';
import { dayKey } from '../services/streakService';
import type { RootStackParamList } from '../navigation/types';
import type { MoodLevel, Task } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type Step = 'intro' | 'rings' | 'mood' | 'oneThing' | 'done';

const MOODS: { value: MoodLevel; emoji: string; label: string }[] = [
  { value: 1, emoji: '😞', label: 'Rough' },
  { value: 2, emoji: '😕', label: 'Meh' },
  { value: 3, emoji: '😐', label: 'Okay' },
  { value: 4, emoji: '🙂', label: 'Good' },
  { value: 5, emoji: '😄', label: 'Great' },
];

function isToday(ts: number | null): boolean {
  if (!ts) return false;
  return dayKey(new Date(ts)) === dayKey();
}

export function DailyPulseScreen() {
  const navigation = useNavigation<Nav>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const {
    tasks, addTask, recordStreakActivity, streak,
  } = useApp();
  const { addJournalEntry, getJournalForDate, habits } = useFeatures();

  const [step, setStep] = useState<Step>('intro');
  const [state, setState] = useState<DailyPulseState | null>(null);
  const [mood, setMood] = useState<MoodLevel | null>(null);
  const [oneThing, setOneThing] = useState('');

  // Ring animation values
  const streakRing = useRef(new Animated.Value(0)).current;
  const tasksRing = useRef(new Animated.Value(0)).current;
  const habitsRing = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadPulseState().then(setState);
    // Pre-fill mood if user already journaled today
    const existing = getJournalForDate(dayKey());
    if (existing) setMood(existing.mood);
  }, [getJournalForDate]);

  // ── Compute today's three ring values ──────────────────────────────────
  const ringStats = useMemo(() => {
    const today = dayKey();

    // Streak ring: did the activity streak advance/persist today?
    const streakDone = streak.lastActiveDate === today ? 1 : 0;

    // Tasks ring: % of today's due tasks completed (incl. completed today)
    const todayTasks = tasks.filter((t: Task) => {
      if (!t.dueDate) return false;
      return dayKey(new Date(t.dueDate)) === today;
    });
    const totalTasks = todayTasks.length;
    const doneTasks = todayTasks.filter((t) => t.completed).length;
    const tasksPct = totalTasks === 0 ? 0 : doneTasks / totalTasks;

    // Habits ring: % of today's habits checked.
    const activeHabits = habits.filter((h) => !h.archived);
    const totalHabits = activeHabits.length;
    const doneHabits = activeHabits.filter((h) => h.completedDates.includes(today)).length;
    const habitsPct = totalHabits === 0 ? 0 : doneHabits / totalHabits;

    return {
      streakDone,
      tasksPct,
      tasksDone: doneTasks,
      tasksTotal: totalTasks,
      habitsPct,
      habitsDone: doneHabits,
      habitsTotal: totalHabits,
      perfect: streakDone === 1 && tasksPct === 1 && habitsPct === 1
        && (totalTasks > 0 || totalHabits > 0),
    };
  }, [tasks, habits, streak.lastActiveDate]);

  // ── Animate rings when entering the rings step ─────────────────────────
  useEffect(() => {
    if (step !== 'rings') return;
    streakRing.setValue(0);
    tasksRing.setValue(0);
    habitsRing.setValue(0);
    Animated.stagger(180, [
      Animated.timing(streakRing, {
        toValue: ringStats.streakDone,
        duration: 800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(tasksRing, {
        toValue: ringStats.tasksPct,
        duration: 800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(habitsRing, {
        toValue: ringStats.habitsPct,
        duration: 800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start();
  }, [step, ringStats, streakRing, tasksRing, habitsRing]);

  const handleSubmit = async () => {
    // 1) Mood → journal entry (optional, only if mood was tapped)
    if (mood !== null) {
      const existing = getJournalForDate(dayKey());
      if (!existing) {
        addJournalEntry(mood, '');
      }
    }

    // 2) "One Thing" → tomorrow's high-priority task
    let createdTaskId: string | null = null;
    const trimmed = oneThing.trim();
    if (trimmed.length > 0) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      const task = addTask({
        title: `⭐ ${trimmed}`,
        completed: false,
        categoryId: null,
        dueDate: tomorrow.getTime(),
        reminderDate: null,
        repeat: 'none',
        notes: '[One Thing] Set during your Daily Pulse.',
        attachments: [],
        subtasks: [],
        priority: 'high',
      });
      createdTaskId = task.id;
    }

    // 3) Persist Pulse completion + advance Pulse streak
    const updated = await completePulse({
      oneThingTitle: trimmed,
      oneThingTaskId: createdTaskId,
    });
    setState(updated);

    // 4) Count the Pulse itself as activity for the main streak
    recordStreakActivity().catch(() => {});

    setStep('done');
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
    body: { flex: 1, paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md },
    bodyCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: theme.spacing.lg },

    introEmoji: { fontSize: 64, marginBottom: 16 },
    introTitle: { fontSize: 28, fontWeight: '900', color: theme.colors.text, textAlign: 'center', marginBottom: 8 },
    introSub: { fontSize: 15, color: theme.colors.textMuted, textAlign: 'center', lineHeight: 22, marginBottom: 32, maxWidth: 320 },
    bullets: { gap: 12, alignSelf: 'stretch', maxWidth: 360, alignItems: 'flex-start', paddingHorizontal: 24 },
    bullet: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    bulletEmoji: { fontSize: 20 },
    bulletText: { fontSize: 14, color: theme.colors.text, fontWeight: '600' },

    primaryBtn: {
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 32, paddingVertical: 16,
      borderRadius: 16,
      flexDirection: 'row', alignItems: 'center', gap: 8,
      marginTop: 28,
    },
    primaryBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
    secondaryBtn: { paddingVertical: 12, paddingHorizontal: 16, marginTop: 12 },
    secondaryBtnText: { color: theme.colors.textMuted, fontSize: 13, fontWeight: '600' },

    ringsRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'center',
      width: '100%',
      marginVertical: 24,
    },
    sectionLabel: {
      ...theme.typography.overline,
      color: theme.colors.textMuted,
      letterSpacing: 1.5,
      textTransform: 'uppercase',
      textAlign: 'center',
      marginBottom: 8,
    },
    sectionTitle: {
      fontSize: 24, fontWeight: '900', color: theme.colors.text,
      textAlign: 'center', marginBottom: 4,
    },
    sectionSub: {
      fontSize: 14, color: theme.colors.textMuted,
      textAlign: 'center', marginBottom: 24,
    },

    moodGrid: {
      flexDirection: 'row',
      gap: 12,
      justifyContent: 'space-between',
      width: '100%',
      maxWidth: 380,
      marginBottom: 24,
    },
    moodCell: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 14,
      borderRadius: 16,
      backgroundColor: theme.colors.cardBg,
      borderWidth: 2,
      borderColor: 'transparent',
      gap: 6,
    },
    moodCellSelected: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primaryLight,
    },
    moodEmoji: { fontSize: 28 },
    moodLabel: { fontSize: 10, fontWeight: '700', color: theme.colors.textMuted },
    moodLabelSelected: { color: theme.colors.primary },

    oneThingInput: {
      width: '100%', maxWidth: 420,
      backgroundColor: theme.colors.cardBg,
      borderRadius: 16,
      padding: 16,
      fontSize: 16,
      color: theme.colors.text,
      minHeight: 100,
      textAlignVertical: 'top',
      borderWidth: 2,
      borderColor: theme.colors.border,
      marginBottom: 16,
    },
    oneThingHint: {
      fontSize: 12, color: theme.colors.textMuted,
      textAlign: 'center', marginBottom: 24, maxWidth: 340,
    },

    doneCircle: {
      width: 96, height: 96, borderRadius: 48,
      backgroundColor: theme.colors.success + '20',
      borderWidth: 3,
      borderColor: theme.colors.success,
      alignItems: 'center', justifyContent: 'center',
      marginBottom: 20,
    },
    doneTitle: { fontSize: 28, fontWeight: '900', color: theme.colors.text, textAlign: 'center', marginBottom: 8 },
    doneSub: { fontSize: 15, color: theme.colors.textMuted, textAlign: 'center', marginBottom: 24, maxWidth: 320 },
    doneStats: {
      flexDirection: 'row', gap: 12, marginBottom: 32,
    },
    doneStatBox: {
      backgroundColor: theme.colors.cardBg,
      paddingHorizontal: 18, paddingVertical: 12,
      borderRadius: 14,
      alignItems: 'center', minWidth: 100,
    },
    doneStatNumber: { fontSize: 22, fontWeight: '900', color: theme.colors.primary },
    doneStatLabel: { fontSize: 11, fontWeight: '700', color: theme.colors.textMuted, marginTop: 2 },
  }), [theme, insets]);

  // ── Render per step ────────────────────────────────────────────────────
  const renderHeader = (rightLabel?: string, onRight?: () => void) => (
    <View style={styles.header}>
      <Text style={styles.title}>Daily Pulse</Text>
      <TouchableOpacity
        style={styles.closeBtn}
        onPress={() => navigation.goBack()}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="close" size={20} color={theme.colors.text} />
      </TouchableOpacity>
    </View>
  );

  if (step === 'intro') {
    const alreadyDone = state ? isPulseDoneToday(state) : false;
    return (
      <View style={styles.container}>
        {renderHeader()}
        <View style={styles.bodyCenter}>
          <Text style={styles.introEmoji}>🌅</Text>
          <Text style={styles.introTitle}>
            {alreadyDone ? "You've pulsed today" : 'Wrap up your day'}
          </Text>
          <Text style={styles.introSub}>
            {alreadyDone
              ? "Come back tomorrow evening to keep your Pulse streak going."
              : '60 seconds. Three rings. One mood. One win for tomorrow.'}
          </Text>

          {!alreadyDone && (
            <View style={styles.bullets}>
              <View style={styles.bullet}><Text style={styles.bulletEmoji}>🎯</Text><Text style={styles.bulletText}>See today's rings</Text></View>
              <View style={styles.bullet}><Text style={styles.bulletEmoji}>💭</Text><Text style={styles.bulletText}>Tap how you feel</Text></View>
              <View style={styles.bullet}><Text style={styles.bulletEmoji}>⭐</Text><Text style={styles.bulletText}>Plan tomorrow's One Thing</Text></View>
            </View>
          )}

          {state && state.pulseStreak > 0 && (
            <Text style={[styles.sectionSub, { marginTop: 24 }]}>
              🔥 {state.pulseStreak}-day Pulse streak
            </Text>
          )}

          {!alreadyDone ? (
            <TouchableOpacity style={styles.primaryBtn} onPress={() => setStep('rings')} activeOpacity={0.85}>
              <Text style={styles.primaryBtnText}>Start</Text>
              <Ionicons name="arrow-forward" size={18} color="#FFF" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.goBack()} activeOpacity={0.85}>
              <Text style={styles.primaryBtnText}>Done</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  if (step === 'rings') {
    return (
      <View style={styles.container}>
        {renderHeader()}
        <ScrollView contentContainerStyle={[styles.body, { alignItems: 'center', paddingBottom: insets.bottom + 40 }]}>
          <Text style={styles.sectionLabel}>Today's score</Text>
          <Text style={styles.sectionTitle}>
            {ringStats.perfect ? '🏆 All three!' : 'Here\'s your day'}
          </Text>
          <Text style={styles.sectionSub}>
            {ringStats.perfect
              ? 'You closed every ring today.'
              : 'Tap any ring to dig in tomorrow.'}
          </Text>

          <View style={styles.ringsRow}>
            <PulseRing
              label="Streak"
              progress={streakRing}
              color="#FF9500"
              icon="flame"
              valueText={ringStats.streakDone === 1 ? '✓' : '—'}
            />
            <PulseRing
              label="Tasks"
              progress={tasksRing}
              color="#3B82F6"
              icon="checkbox"
              valueText={
                ringStats.tasksTotal === 0
                  ? '—'
                  : `${ringStats.tasksDone}/${ringStats.tasksTotal}`
              }
            />
            <PulseRing
              label="Habits"
              progress={habitsRing}
              color="#10B981"
              icon="water"
              valueText={
                ringStats.habitsTotal === 0
                  ? '—'
                  : `${ringStats.habitsDone}/${ringStats.habitsTotal}`
              }
            />
          </View>

          <TouchableOpacity style={styles.primaryBtn} onPress={() => setStep('mood')} activeOpacity={0.85}>
            <Text style={styles.primaryBtnText}>Next</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFF" />
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  if (step === 'mood') {
    return (
      <View style={styles.container}>
        {renderHeader()}
        <View style={styles.bodyCenter}>
          <Text style={styles.sectionLabel}>How was today</Text>
          <Text style={styles.sectionTitle}>One tap</Text>
          <Text style={styles.sectionSub}>That's the whole journal entry.</Text>

          <View style={styles.moodGrid}>
            {MOODS.map((m) => {
              const selected = mood === m.value;
              return (
                <TouchableOpacity
                  key={m.value}
                  style={[styles.moodCell, selected && styles.moodCellSelected]}
                  onPress={() => setMood(m.value)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.moodEmoji}>{m.emoji}</Text>
                  <Text style={[styles.moodLabel, selected && styles.moodLabelSelected]}>
                    {m.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, mood === null && { opacity: 0.5 }]}
            onPress={() => setStep('oneThing')}
            disabled={mood === null}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>Next</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => setStep('oneThing')}>
            <Text style={styles.secondaryBtnText}>Skip</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (step === 'oneThing') {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {renderHeader()}
        <ScrollView
          contentContainerStyle={[styles.body, { alignItems: 'center', paddingBottom: insets.bottom + 40 }]}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.sectionLabel}>Tomorrow's win</Text>
          <Text style={styles.sectionTitle}>One Thing</Text>
          <Text style={styles.sectionSub}>What's the ONE thing you'll win tomorrow?</Text>

          <TextInput
            value={oneThing}
            onChangeText={setOneThing}
            placeholder="e.g. Send the proposal to Ali"
            placeholderTextColor={theme.colors.textMuted}
            style={styles.oneThingInput}
            multiline
            maxLength={120}
            autoFocus
          />
          <Text style={styles.oneThingHint}>
            We'll add this as your first task tomorrow morning ⭐
          </Text>

          <TouchableOpacity style={styles.primaryBtn} onPress={handleSubmit} activeOpacity={0.85}>
            <Text style={styles.primaryBtnText}>Finish Pulse</Text>
            <Ionicons name="checkmark" size={18} color="#FFF" />
          </TouchableOpacity>
          {oneThing.trim().length === 0 && (
            <TouchableOpacity style={styles.secondaryBtn} onPress={handleSubmit}>
              <Text style={styles.secondaryBtnText}>Skip and finish</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // step === 'done'
  return (
    <View style={styles.container}>
      {renderHeader()}
      <View style={styles.bodyCenter}>
        <View style={styles.doneCircle}>
          <Ionicons name="checkmark" size={56} color={theme.colors.success} />
        </View>
        <Text style={styles.doneTitle}>Pulse logged 🌙</Text>
        <Text style={styles.doneSub}>
          {oneThing.trim().length > 0
            ? `You've decided tomorrow's win. Sleep on it.`
            : 'See you tomorrow evening.'}
        </Text>

        {state && (
          <View style={styles.doneStats}>
            <View style={styles.doneStatBox}>
              <Text style={styles.doneStatNumber}>{state.pulseStreak}</Text>
              <Text style={styles.doneStatLabel}>PULSE STREAK</Text>
            </View>
            <View style={styles.doneStatBox}>
              <Text style={styles.doneStatNumber}>{streak.currentStreak}</Text>
              <Text style={styles.doneStatLabel}>ACTIVITY</Text>
            </View>
          </View>
        )}

        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => navigation.replace('TodayCard')}
          activeOpacity={0.85}
        >
          <Ionicons name="share-social" size={18} color="#FFF" />
          <Text style={styles.primaryBtnText}>See Today's Card</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.secondaryBtnText}>Goodnight</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Ring component ─────────────────────────────────────────────────────────
interface PulseRingProps {
  label: string;
  progress: Animated.Value;
  color: string;
  icon: string;
  valueText: string;
}

function PulseRing({ label, progress, color, icon, valueText }: PulseRingProps) {
  const { theme } = useTheme();
  const SIZE = 92;
  const STROKE = 9;

  // Approximate ring fill via a width-mapped border arc using rotation hack.
  // We render a track + a foreground that scales with progress (0–1) using
  // height-based opacity to keep things simple without an SVG dependency.
  const fillHeight = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View style={{ alignItems: 'center', gap: 8 }}>
      <View style={{
        width: SIZE, height: SIZE, borderRadius: SIZE / 2,
        borderWidth: STROKE,
        borderColor: color + '20',
        alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
      }}>
        <Animated.View style={{
          position: 'absolute',
          left: 0, right: 0, bottom: 0,
          height: fillHeight,
          backgroundColor: color + '33',
        }} />
        <Ionicons name={icon as any} size={28} color={color} />
        <Text style={{
          fontSize: 11, fontWeight: '900',
          color: theme.colors.text, marginTop: 2,
        }}>
          {valueText}
        </Text>
      </View>
      <Text style={{
        fontSize: 11, fontWeight: '800',
        color: theme.colors.textMuted,
        letterSpacing: 0.5,
      }}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
}
