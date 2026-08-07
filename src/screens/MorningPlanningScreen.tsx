/**
 * MorningPlanningScreen — a short guided flow to plan the day.
 *
 * Four steps: set the day's focus → pick the top 3 (from open tasks or typed
 * fresh) → optionally block time for those three → set daily goals.
 * Each step writes as you go, so quitting halfway still keeps the work.
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useApp } from '../context/AppContext';
import { usePlanner } from '../context/PlannerContext';
import { useTheme } from '../context/ThemeContext';
import { BLOCK_KIND_COLORS, nextFreeSlot } from '../services/plannerScheduleService';
import { formatMinutes, todayKey } from '../services/plannerService';

const STEPS = ['Focus', 'Top 3', 'Time', 'Goals'] as const;

/** "9 am" for an hour-of-day, for use in prose. */
function hourText(hour: number): string {
  if (hour === 24 || hour === 0) return '12 am';
  return `${hour % 12 || 12} ${hour < 12 ? 'am' : 'pm'}`;
}

const FOCUS_SUGGESTIONS = [
  'Ship the thing I keep postponing',
  'Protect two hours of deep work',
  'Clear the backlog, then stop',
  'Be present — no multitasking',
];

const GOAL_SUGGESTIONS = [
  'Finish my top priority',
  'Move for 30 minutes',
  'No phone before noon',
  'Inbox to zero',
  'Read for 20 minutes',
  'Drink 2L of water',
];

export function MorningPlanningScreen() {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { tasks } = useApp();
  const {
    selectedDate, day, prefs, blocks,
    setFocus, addPriority, removePriority, addDailyGoal, removeDailyGoal,
    addBlock, markPlanned,
  } = usePlanner();

  const [step, setStep] = useState(0);
  const [focusDraft, setFocusDraft] = useState(day.focus);
  const [priorityDraft, setPriorityDraft] = useState('');
  const [goalDraft, setGoalDraft] = useState('');
  /** Priority ids we've created a block for, and the block id we created. */
  const [blockedPriorities, setBlockedPriorities] = useState<Record<string, string>>({});
  /**
   * Slots claimed during this step. `blocks` from context only updates after a
   * re-render, so three quick taps would otherwise all be handed the same
   * "next free" start and stack on top of each other.
   */
  const claimedSlotsRef = useRef<{ startMinutes: number; durationMinutes: number }[]>([]);
  /** Guards against a double-tap firing two creates for the same priority. */
  const inFlightRef = useRef<Set<string>>(new Set());

  const openTasks = useMemo(() => {
    const chosen = new Set(day.topPriorities.map(p => p.taskId).filter(Boolean));
    return tasks
      .filter(t => !t.completed && !chosen.has(t.id))
      .sort((a, b) => {
        const rank = { high: 0, medium: 1, low: 2, none: 3 } as const;
        const byPriority = rank[a.priority] - rank[b.priority];
        if (byPriority !== 0) return byPriority;
        return (a.dueDate ?? Infinity) - (b.dueDate ?? Infinity);
      })
      .slice(0, 12);
  }, [day.topPriorities, tasks]);

  const priorityFull = day.topPriorities.length >= 3;

  const commitFocus = useCallback(() => {
    if (focusDraft.trim() !== day.focus) setFocus(focusDraft.trim());
  }, [day.focus, focusDraft, setFocus]);

  const handleBlockPriority = useCallback(async (priorityId: string, title: string, taskId: string | null) => {
    if (blockedPriorities[priorityId] || inFlightRef.current.has(priorityId)) return;
    inFlightRef.current.add(priorityId);
    try {
      const duration = 60;
      // Search against the persisted blocks *plus* anything claimed earlier in
      // this step, so consecutive taps get consecutive slots.
      const occupied = [...blocks, ...claimedSlotsRef.current];
      const from = selectedDate === todayKey()
        ? new Date().getHours() * 60 + new Date().getMinutes()
        : prefs.dayStartHour * 60;
      const slot = nextFreeSlot(occupied, from, prefs, duration);
      if (!slot) {
        Alert.alert(
          'No free time left',
          `There's no free ${duration}-minute gap left between ${hourText(prefs.dayStartHour)} and ${hourText(prefs.dayEndHour)}. Move or shorten a block first.`
        );
        return;
      }
      claimedSlotsRef.current.push({ startMinutes: slot.startMinutes, durationMinutes: duration });
      const created = await addBlock({
        title,
        kind: taskId ? 'task' : 'focus',
        startMinutes: slot.startMinutes,
        durationMinutes: duration,
        color: taskId ? BLOCK_KIND_COLORS.task : BLOCK_KIND_COLORS.focus,
        notes: '',
        taskId,
        habitId: null,
        reminderMinutesBefore: prefs.defaultReminderMinutes,
      });
      if (created) {
        setBlockedPriorities(prev => ({ ...prev, [priorityId]: created.id }));
      } else {
        // Creation failed — release the slot so it can be reused.
        claimedSlotsRef.current = claimedSlotsRef.current.filter(
          s => s.startMinutes !== slot.startMinutes
        );
      }
    } finally {
      inFlightRef.current.delete(priorityId);
    }
  }, [addBlock, blockedPriorities, blocks, prefs, selectedDate]);

  const finish = useCallback(async () => {
    commitFocus();
    await markPlanned();
    navigation.goBack();
  }, [commitFocus, markPlanned, navigation]);

  const next = useCallback(() => {
    if (step === 0) commitFocus();
    if (step === STEPS.length - 1) { finish(); return; }
    setStep(s => s + 1);
  }, [commitFocus, finish, step]);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    header: {
      paddingTop: insets.top + theme.spacing.sm,
      paddingBottom: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      backgroundColor: theme.colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
    headerTitle: { ...theme.typography.titleSmall, fontWeight: '800', color: theme.colors.text, flex: 1 },
    skip: { ...theme.typography.caption, color: theme.colors.textMuted, fontWeight: '600' },
    steps: { flexDirection: 'row', gap: 6, marginTop: theme.spacing.md },
    stepDot: { flex: 1, height: 4, borderRadius: 2, backgroundColor: theme.colors.border },
    stepLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
    stepLabel: { fontSize: 10, fontWeight: '700', color: theme.colors.textMuted, flex: 1, textAlign: 'center' },

    body: { padding: theme.spacing.lg, paddingBottom: 40, gap: theme.spacing.lg },
    kicker: { ...theme.typography.overline, color: theme.colors.primary, textTransform: 'uppercase' },
    title: { ...theme.typography.title, fontSize: 23, fontWeight: '800', color: theme.colors.text, marginTop: 4 },
    subtitle: { ...theme.typography.bodySmall, color: theme.colors.textMuted, marginTop: 6, lineHeight: 20 },

    input: {
      backgroundColor: theme.colors.inputBg, borderRadius: theme.borderRadius.lg,
      paddingHorizontal: 16, paddingVertical: 16,
      ...theme.typography.body, color: theme.colors.text,
    },
    addRow: { flexDirection: 'row', gap: theme.spacing.sm },
    addInput: {
      flex: 1, backgroundColor: theme.colors.inputBg, borderRadius: theme.borderRadius.md,
      paddingHorizontal: 14, paddingVertical: 12,
      ...theme.typography.bodySmall, color: theme.colors.text,
    },
    addBtn: {
      width: 44, borderRadius: theme.borderRadius.md,
      backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center',
    },
    sectionLabel: {
      ...theme.typography.overline, color: theme.colors.textMuted,
      textTransform: 'uppercase', marginBottom: 8,
    },
    suggestionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    suggestion: {
      paddingHorizontal: 13, paddingVertical: 9,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.inputBg,
      borderWidth: 1, borderColor: theme.colors.border,
    },
    suggestionText: { ...theme.typography.caption, color: theme.colors.textSecondary, fontWeight: '600' },

    card: {
      backgroundColor: theme.colors.cardBg, borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.md, ...theme.shadows.subtle, gap: 2,
    },
    pickedRow: {
      flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm,
      backgroundColor: theme.colors.cardBg,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.md, ...theme.shadows.subtle,
    },
    rank: {
      width: 26, height: 26, borderRadius: 9,
      backgroundColor: theme.colors.accent + '20',
      alignItems: 'center', justifyContent: 'center',
    },
    rankText: { fontSize: 12, fontWeight: '800', color: theme.colors.accent },
    pickedText: { ...theme.typography.bodySmall, color: theme.colors.text, flex: 1, fontWeight: '600' },
    taskRow: {
      flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm,
      paddingVertical: 11, paddingHorizontal: theme.spacing.md,
      backgroundColor: theme.colors.cardBg, borderRadius: theme.borderRadius.md,
      marginBottom: 8,
    },
    taskText: { ...theme.typography.bodySmall, color: theme.colors.text, flex: 1 },
    priorityDot: { width: 7, height: 7, borderRadius: 4 },
    blockBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      paddingHorizontal: 11, paddingVertical: 7,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.primaryLight,
    },
    blockBtnText: { fontSize: 11.5, fontWeight: '800', color: theme.colors.primary },
    blockedTag: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: 10, paddingVertical: 6, borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.successLight,
    },
    blockedText: { fontSize: 11.5, fontWeight: '800', color: theme.colors.success },
    empty: { ...theme.typography.caption, color: theme.colors.textMuted, lineHeight: 18 },

    footer: {
      flexDirection: 'row', gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.md,
      paddingBottom: insets.bottom + theme.spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    backBtn: {
      paddingHorizontal: 20, borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.inputBg, alignItems: 'center', justifyContent: 'center',
    },
    backText: { ...theme.typography.button, fontWeight: '700', color: theme.colors.textSecondary },
    nextBtn: {
      flex: 1, backgroundColor: theme.colors.primary,
      borderRadius: theme.borderRadius.lg, paddingVertical: 16, alignItems: 'center',
    },
    nextText: { ...theme.typography.button, fontSize: 15, fontWeight: '800', color: '#FFF' },
  }), [insets, theme]);

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <>
            <View>
              <Text style={styles.kicker}>Step 1 of 4</Text>
              <Text style={styles.title}>What's today really about?</Text>
              <Text style={styles.subtitle}>
                One sentence. Not a to-do list — the thing you want to be true by tonight.
              </Text>
            </View>
            <TextInput
              style={styles.input}
              value={focusDraft}
              onChangeText={setFocusDraft}
              placeholder="If I do one thing today, it's…"
              placeholderTextColor={theme.colors.textMuted}
              multiline
              autoFocus
            />
            <View>
              <Text style={styles.sectionLabel}>Or start from one of these</Text>
              <View style={styles.suggestionRow}>
                {FOCUS_SUGGESTIONS.map(s => (
                  <TouchableOpacity key={s} style={styles.suggestion} onPress={() => setFocusDraft(s)}>
                    <Text style={styles.suggestionText}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </>
        );

      case 1:
        return (
          <>
            <View>
              <Text style={styles.kicker}>Step 2 of 4</Text>
              <Text style={styles.title}>Pick your top three</Text>
              <Text style={styles.subtitle}>
                Three is the limit on purpose. Everything else is a bonus, not a failure.
              </Text>
            </View>

            {day.topPriorities.map((p, i) => (
              <View key={p.id} style={styles.pickedRow}>
                <View style={styles.rank}><Text style={styles.rankText}>{i + 1}</Text></View>
                <Text style={styles.pickedText} numberOfLines={2}>{p.title}</Text>
                <TouchableOpacity onPress={() => removePriority(p.id)} hitSlop={8}>
                  <Ionicons name="close-circle" size={20} color={theme.colors.textMuted} />
                </TouchableOpacity>
              </View>
            ))}

            {!priorityFull && (
              <View style={styles.addRow}>
                <TextInput
                  style={styles.addInput}
                  value={priorityDraft}
                  onChangeText={setPriorityDraft}
                  placeholder="Type a priority…"
                  placeholderTextColor={theme.colors.textMuted}
                  returnKeyType="done"
                  onSubmitEditing={() => { addPriority(priorityDraft); setPriorityDraft(''); }}
                />
                <TouchableOpacity
                  style={styles.addBtn}
                  onPress={() => { addPriority(priorityDraft); setPriorityDraft(''); }}
                >
                  <Ionicons name="add" size={22} color="#FFF" />
                </TouchableOpacity>
              </View>
            )}

            {openTasks.length > 0 && (
              <View>
                <Text style={styles.sectionLabel}>
                  {priorityFull ? 'Your top 3 is full' : 'Or pull one from your tasks'}
                </Text>
                {openTasks.map(t => (
                  <TouchableOpacity
                    key={t.id}
                    style={[styles.taskRow, priorityFull && { opacity: 0.45 }]}
                    disabled={priorityFull}
                    onPress={() => addPriority(t.title, t.id)}
                    activeOpacity={0.7}
                  >
                    {t.priority !== 'none' && (
                      <View style={[styles.priorityDot, {
                        backgroundColor: t.priority === 'high'
                          ? theme.colors.error
                          : t.priority === 'medium' ? theme.colors.warning : theme.colors.textMuted,
                      }]} />
                    )}
                    <Text style={styles.taskText} numberOfLines={1}>{t.title}</Text>
                    <Ionicons name="add-circle-outline" size={20} color={theme.colors.primary} />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {openTasks.length === 0 && day.topPriorities.length === 0 && (
              <Text style={styles.empty}>
                No open tasks yet — type your priorities above and they'll be saved to today's plan.
              </Text>
            )}
          </>
        );

      case 2:
        return (
          <>
            <View>
              <Text style={styles.kicker}>Step 3 of 4</Text>
              <Text style={styles.title}>Block time for them</Text>
              <Text style={styles.subtitle}>
                A priority without a time slot is a wish. Each one gets an hour in your next free gap.
              </Text>
            </View>

            {day.topPriorities.length === 0 ? (
              <Text style={styles.empty}>
                You didn't set any priorities — go back a step, or skip ahead to goals.
              </Text>
            ) : (
              day.topPriorities.map((p, i) => {
                // Blocked if we created one in this session, or a persisted
                // block is linked to the same task. Deliberately not matching
                // on title — two priorities can share a name.
                const blocked = !!blockedPriorities[p.id] ||
                  (p.taskId != null && blocks.some(bl => bl.taskId === p.taskId));
                return (
                  <View key={p.id} style={styles.pickedRow}>
                    <View style={styles.rank}><Text style={styles.rankText}>{i + 1}</Text></View>
                    <Text style={styles.pickedText} numberOfLines={2}>{p.title}</Text>
                    {blocked ? (
                      <View style={styles.blockedTag}>
                        <Ionicons name="checkmark" size={12} color={theme.colors.success} />
                        <Text style={styles.blockedText}>Blocked</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.blockBtn}
                        onPress={() => handleBlockPriority(p.id, p.title, p.taskId)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="time-outline" size={13} color={theme.colors.primary} />
                        <Text style={styles.blockBtnText}>Block 1h</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })
            )}

            {blocks.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.sectionLabel}>Already on your timeline</Text>
                {blocks.slice(0, 6).map(bl => (
                  <Text key={bl.id} style={styles.empty}>
                    {formatMinutes(bl.startMinutes)} · {bl.title}
                  </Text>
                ))}
                {blocks.length > 6 && (
                  <Text style={styles.empty}>…and {blocks.length - 6} more</Text>
                )}
              </View>
            )}
          </>
        );

      default:
        return (
          <>
            <View>
              <Text style={styles.kicker}>Step 4 of 4</Text>
              <Text style={styles.title}>Set today's goals</Text>
              <Text style={styles.subtitle}>
                Small, checkable outcomes. These roll into your progress and your analytics.
              </Text>
            </View>

            {day.dailyGoals.map(g => (
              <View key={g.id} style={styles.pickedRow}>
                <Ionicons name="flag-outline" size={17} color={theme.colors.success} />
                <Text style={styles.pickedText} numberOfLines={2}>{g.title}</Text>
                <TouchableOpacity onPress={() => removeDailyGoal(g.id)} hitSlop={8}>
                  <Ionicons name="close-circle" size={20} color={theme.colors.textMuted} />
                </TouchableOpacity>
              </View>
            ))}

            <View style={styles.addRow}>
              <TextInput
                style={styles.addInput}
                value={goalDraft}
                onChangeText={setGoalDraft}
                placeholder="Add a goal…"
                placeholderTextColor={theme.colors.textMuted}
                returnKeyType="done"
                onSubmitEditing={() => { addDailyGoal(goalDraft); setGoalDraft(''); }}
              />
              <TouchableOpacity
                style={styles.addBtn}
                onPress={() => { addDailyGoal(goalDraft); setGoalDraft(''); }}
              >
                <Ionicons name="add" size={22} color="#FFF" />
              </TouchableOpacity>
            </View>

            <View>
              <Text style={styles.sectionLabel}>Quick picks</Text>
              <View style={styles.suggestionRow}>
                {GOAL_SUGGESTIONS
                  .filter(s => !day.dailyGoals.some(g => g.title === s))
                  .map(s => (
                    <TouchableOpacity key={s} style={styles.suggestion} onPress={() => addDailyGoal(s)}>
                      <Text style={styles.suggestionText}>+ {s}</Text>
                    </TouchableOpacity>
                  ))}
              </View>
            </View>
          </>
        );
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Plan your day</Text>
          <TouchableOpacity onPress={finish} hitSlop={10}>
            <Text style={styles.skip}>{step === STEPS.length - 1 ? '' : 'Skip'}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.steps}>
          {STEPS.map((_, i) => (
            <View
              key={i}
              style={[styles.stepDot, i <= step && { backgroundColor: theme.colors.primary }]}
            />
          ))}
        </View>
        <View style={styles.stepLabels}>
          {STEPS.map((label, i) => (
            <Text
              key={label}
              style={[styles.stepLabel, i === step && { color: theme.colors.primary }]}
            >
              {label}
            </Text>
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {renderStep()}
      </ScrollView>

      <View style={styles.footer}>
        {step > 0 && (
          <TouchableOpacity style={styles.backBtn} onPress={() => setStep(s => s - 1)}>
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.nextBtn} onPress={next} activeOpacity={0.85}>
          <Text style={styles.nextText}>
            {step === STEPS.length - 1 ? `Start ${selectedDate === day.date ? 'the day' : 'planning'}` : 'Continue'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
