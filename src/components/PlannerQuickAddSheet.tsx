/**
 * PlannerQuickAddSheet — one entry point for adding anything to the day.
 *
 * Each mode writes to the feature that already owns that data (tasks →
 * AppContext, habits → FeaturesContext, notes → notes collection) so the
 * planner never becomes a second source of truth. "Event" creates a planner
 * block; "Goal" adds a daily goal to the current day's plan.
 */

import React, { useMemo, useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Modal, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { formatDuration, formatMinutes } from '../services/plannerService';
import { BLOCK_KIND_COLORS } from '../services/plannerScheduleService';

export type QuickAddMode = 'task' | 'event' | 'note' | 'habit' | 'goal';

const MODES: { id: QuickAddMode; label: string; icon: string; color: string; placeholder: string }[] = [
  { id: 'task',  label: 'Task',  icon: 'checkbox-outline',       color: '#6366F1', placeholder: 'What needs doing?' },
  { id: 'event', label: 'Event', icon: 'calendar-outline',        color: '#3B82F6', placeholder: 'What’s happening?' },
  { id: 'note',  label: 'Note',  icon: 'document-text-outline',   color: '#14B8A6', placeholder: 'Note title' },
  { id: 'habit', label: 'Habit', icon: 'flame-outline',           color: '#EF4444', placeholder: 'Habit to build' },
  { id: 'goal',  label: 'Goal',  icon: 'flag-outline',            color: '#F59E0B', placeholder: 'Goal for today' },
];

const DURATIONS = [15, 30, 45, 60, 90];

export interface QuickAddPayload {
  mode: QuickAddMode;
  title: string;
  /** Event mode only. */
  startMinutes: number;
  durationMinutes: number;
  /** Task mode: also schedule a block for it at the suggested slot. */
  scheduleBlock: boolean;
  /** Task/priority: mark it one of today's top 3. */
  makePriority: boolean;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onSubmit: (payload: QuickAddPayload) => void | Promise<void>;
  /** Suggested start for a scheduled item; usually the next free slot. */
  suggestedStartMinutes: number;
  /** Whether the day already has three priorities. */
  priorityFull: boolean;
  initialMode?: QuickAddMode;
}

export function PlannerQuickAddSheet({
  visible, onClose, onSubmit, suggestedStartMinutes, priorityFull, initialMode = 'task',
}: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<QuickAddMode>(initialMode);
  const [title, setTitle] = useState('');
  const [startMinutes, setStartMinutes] = useState(suggestedStartMinutes);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [scheduleBlock, setScheduleBlock] = useState(false);
  const [makePriority, setMakePriority] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Re-seed the form each time the sheet opens.
  React.useEffect(() => {
    if (!visible) return;
    setMode(initialMode);
    setTitle('');
    setStartMinutes(suggestedStartMinutes);
    setDurationMinutes(60);
    setScheduleBlock(false);
    setMakePriority(false);
    setSubmitting(false);
  }, [visible, initialMode, suggestedStartMinutes]);

  const active = MODES.find(m => m.id === mode)!;
  const showTime = mode === 'event' || (mode === 'task' && scheduleBlock);

  const handleSubmit = async () => {
    const trimmed = title.trim();
    if (!trimmed) {
      Alert.alert('Nothing to add', `Enter a ${active.label.toLowerCase()} first.`);
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        mode,
        title: trimmed,
        startMinutes,
        durationMinutes,
        scheduleBlock: mode === 'event' ? true : scheduleBlock,
        makePriority: makePriority && !priorityFull,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const styles = useMemo(() => StyleSheet.create({
    overlay: { flex: 1, backgroundColor: theme.colors.overlay, justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: 26, borderTopRightRadius: 26,
      paddingTop: theme.spacing.md,
      // Cap the height so a tall mode (Task, with both toggles + time + length)
      // scrolls instead of pushing the submit button off-screen.
      maxHeight: '88%',
    },
    grabber: {
      alignSelf: 'center', width: 40, height: 4, borderRadius: 2,
      backgroundColor: theme.colors.border, marginBottom: theme.spacing.md,
    },
    modeRow: { flexDirection: 'row', paddingHorizontal: theme.spacing.lg, gap: 8, marginBottom: theme.spacing.lg },
    modeBtn: {
      flex: 1, alignItems: 'center', gap: 5, paddingVertical: theme.spacing.sm,
      borderRadius: theme.borderRadius.md, borderWidth: 1.5, borderColor: 'transparent',
      backgroundColor: theme.colors.inputBg,
    },
    modeLabel: { ...theme.typography.caption, fontSize: 11, fontWeight: '600', color: theme.colors.textMuted },
    body: {
      paddingHorizontal: theme.spacing.lg,
      gap: theme.spacing.md,
      // Clear the home-indicator / gesture bar so the submit button stays tappable.
      paddingBottom: insets.bottom + theme.spacing.lg,
    },
    input: {
      backgroundColor: theme.colors.inputBg, borderRadius: theme.borderRadius.md,
      paddingHorizontal: 14, paddingVertical: 14,
      ...theme.typography.body, color: theme.colors.text,
    },
    label: { ...theme.typography.overline, color: theme.colors.textMuted, textTransform: 'uppercase', marginBottom: 6 },
    toggleRow: {
      flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm,
      backgroundColor: theme.colors.inputBg, borderRadius: theme.borderRadius.md,
      paddingHorizontal: 14, paddingVertical: 12,
    },
    toggleLabel: { ...theme.typography.bodySmall, color: theme.colors.text, flex: 1, fontWeight: '600' },
    toggleHint: { ...theme.typography.caption, fontSize: 11, color: theme.colors.textMuted, marginTop: 1 },
    checkbox: {
      width: 24, height: 24, borderRadius: 7, borderWidth: 2,
      alignItems: 'center', justifyContent: 'center',
    },
    stepper: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: theme.colors.inputBg, borderRadius: theme.borderRadius.md,
      paddingHorizontal: 6, paddingVertical: 6,
    },
    stepBtn: {
      width: 34, height: 34, borderRadius: 10, backgroundColor: theme.colors.surface,
      alignItems: 'center', justifyContent: 'center',
    },
    stepValue: { ...theme.typography.body, fontWeight: '700', color: theme.colors.text },
    chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    chip: {
      paddingHorizontal: 12, paddingVertical: 7, borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.inputBg, borderWidth: 1.5, borderColor: 'transparent',
    },
    chipText: { ...theme.typography.caption, fontWeight: '600', color: theme.colors.textSecondary },
    submit: {
      marginTop: theme.spacing.sm,
      borderRadius: theme.borderRadius.lg, paddingVertical: 15, alignItems: 'center',
    },
    submitText: { ...theme.typography.button, fontSize: 15, fontWeight: '800', color: '#FFF' },
  }), [insets.bottom, theme]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.grabber} />

          <View style={styles.modeRow}>
            {MODES.map(m => {
              const isActive = mode === m.id;
              return (
                <TouchableOpacity
                  key={m.id}
                  style={[styles.modeBtn, isActive && { borderColor: m.color, backgroundColor: m.color + '15' }]}
                  onPress={() => setMode(m.id)}
                  activeOpacity={0.7}
                >
                  <Ionicons name={m.icon} size={20} color={isActive ? m.color : theme.colors.textMuted} />
                  <Text style={[styles.modeLabel, isActive && { color: m.color, fontWeight: '700' }]}>
                    {m.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <ScrollView
            style={{ flexShrink: 1 }}
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder={active.placeholder}
              placeholderTextColor={theme.colors.textMuted}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />

            {mode === 'task' && (
              <>
                <TouchableOpacity
                  style={styles.toggleRow}
                  onPress={() => setScheduleBlock(v => !v)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.checkbox, {
                    borderColor: scheduleBlock ? active.color : theme.colors.border,
                    backgroundColor: scheduleBlock ? active.color : 'transparent',
                  }]}>
                    {scheduleBlock && <Ionicons name="checkmark" size={15} color="#FFF" />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.toggleLabel}>Block time for it</Text>
                    <Text style={styles.toggleHint}>
                      Adds it to today's timeline at {formatMinutes(suggestedStartMinutes)}
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.toggleRow}
                  onPress={() => {
                    if (priorityFull) {
                      Alert.alert('Top 3 is full', 'Remove one of today\'s priorities to add another.');
                      return;
                    }
                    setMakePriority(v => !v);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.checkbox, {
                    borderColor: makePriority ? '#F59E0B' : theme.colors.border,
                    backgroundColor: makePriority ? '#F59E0B' : 'transparent',
                  }]}>
                    {makePriority && <Ionicons name="checkmark" size={15} color="#FFF" />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.toggleLabel}>Make it a top priority</Text>
                    <Text style={styles.toggleHint}>
                      {priorityFull ? 'Today\'s top 3 is already full' : 'Pins it to today\'s top 3'}
                    </Text>
                  </View>
                </TouchableOpacity>
              </>
            )}

            {showTime && (
              <>
                <View>
                  <Text style={styles.label}>Starts at</Text>
                  <View style={styles.stepper}>
                    <TouchableOpacity
                      style={styles.stepBtn}
                      onPress={() => setStartMinutes(v => Math.max(0, v - 15))}
                    >
                      <Ionicons name="remove" size={18} color={theme.colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.stepValue}>{formatMinutes(startMinutes)}</Text>
                    <TouchableOpacity
                      style={styles.stepBtn}
                      onPress={() => setStartMinutes(v => Math.min(1440 - 5, v + 15))}
                    >
                      <Ionicons name="add" size={18} color={theme.colors.text} />
                    </TouchableOpacity>
                  </View>
                </View>
                <View>
                  <Text style={styles.label}>Length</Text>
                  <View style={styles.chipRow}>
                    {DURATIONS.map(d => {
                      const isActive = durationMinutes === d;
                      return (
                        <TouchableOpacity
                          key={d}
                          style={[styles.chip, isActive && { borderColor: active.color, backgroundColor: active.color + '15' }]}
                          onPress={() => setDurationMinutes(d)}
                        >
                          <Text style={[styles.chipText, isActive && { color: active.color, fontWeight: '700' }]}>
                            {formatDuration(d)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </>
            )}

            {mode === 'note' && (
              <Text style={styles.toggleHint}>
                Creates a note you can open and fill in from the Notes tab.
              </Text>
            )}
            {mode === 'habit' && (
              <Text style={styles.toggleHint}>
                Creates a daily habit. Set a reminder time in the Habit Tracker to see it on the timeline.
              </Text>
            )}

            <TouchableOpacity
              style={[styles.submit, { backgroundColor: active.color, opacity: submitting ? 0.6 : 1 }]}
              onPress={handleSubmit}
              disabled={submitting}
              activeOpacity={0.85}
            >
              <Text style={styles.submitText}>Add {active.label}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export { BLOCK_KIND_COLORS };
