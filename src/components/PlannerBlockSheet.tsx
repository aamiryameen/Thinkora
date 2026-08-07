/**
 * PlannerBlockSheet — create or edit a single time block.
 *
 * Handles title, kind, start time, duration, color, reminder lead time,
 * an optional linked task, and notes. Time is entered with stepper controls
 * rather than a free-text field so an invalid time can't be submitted.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Modal, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { BLOCK_KIND_COLORS, BLOCK_KIND_ICONS, BLOCK_PALETTE } from '../services/plannerScheduleService';
import { formatDuration, formatMinutes } from '../services/plannerService';
import type { PlannerBlock, PlannerBlockKind } from '../types/planner';
import type { Task } from '../types';

const KINDS: { id: PlannerBlockKind; label: string }[] = [
  { id: 'focus', label: 'Focus' },
  { id: 'task', label: 'Task' },
  { id: 'event', label: 'Event' },
  { id: 'habit', label: 'Habit' },
  { id: 'break', label: 'Break' },
  { id: 'custom', label: 'Other' },
];

const DURATION_PRESETS = [15, 30, 45, 60, 90, 120];
const REMINDER_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: 'Off' },
  { value: 0, label: 'At start' },
  { value: 5, label: '5 min' },
  { value: 10, label: '10 min' },
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 60, label: '1 hour' },
];

export interface BlockDraft {
  title: string;
  kind: PlannerBlockKind;
  startMinutes: number;
  durationMinutes: number;
  color: string;
  notes: string;
  taskId: string | null;
  reminderMinutesBefore: number | null;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onSave: (draft: BlockDraft) => void;
  onDelete?: () => void;
  /** Editing an existing block; omit to create a new one. */
  block?: PlannerBlock | null;
  /** Pre-filled start time for a new block. */
  initialStartMinutes?: number;
  /** Default reminder lead time for new blocks. */
  defaultReminderMinutes?: number | null;
  /** Incomplete tasks offered for linking. */
  tasks: Task[];
}

export function PlannerBlockSheet({
  visible, onClose, onSave, onDelete, block, initialStartMinutes = 9 * 60,
  defaultReminderMinutes = 10, tasks,
}: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<PlannerBlockKind>('focus');
  const [startMinutes, setStartMinutes] = useState(initialStartMinutes);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [color, setColor] = useState(BLOCK_KIND_COLORS.focus);
  const [notes, setNotes] = useState('');
  const [taskId, setTaskId] = useState<string | null>(null);
  const [reminder, setReminder] = useState<number | null>(defaultReminderMinutes);
  /** True once the user picks a color, so changing kind stops overwriting it. */
  const [colorTouched, setColorTouched] = useState(false);

  // Reset the form whenever the sheet opens.
  useEffect(() => {
    if (!visible) return;
    if (block) {
      setTitle(block.title);
      setKind(block.kind);
      setStartMinutes(block.startMinutes);
      setDurationMinutes(block.durationMinutes);
      setColor(block.color);
      setNotes(block.notes);
      setTaskId(block.taskId);
      setReminder(block.reminderMinutesBefore);
      setColorTouched(true);
    } else {
      setTitle('');
      setKind('focus');
      setStartMinutes(initialStartMinutes);
      setDurationMinutes(60);
      setColor(BLOCK_KIND_COLORS.focus);
      setNotes('');
      setTaskId(null);
      setReminder(defaultReminderMinutes);
      setColorTouched(false);
    }
  }, [visible, block, initialStartMinutes, defaultReminderMinutes]);

  const selectKind = (next: PlannerBlockKind) => {
    setKind(next);
    if (!colorTouched) setColor(BLOCK_KIND_COLORS[next]);
    if (next !== 'task') setTaskId(null);
  };

  const stepStart = (delta: number) => {
    setStartMinutes(prev => Math.max(0, Math.min(1440 - 5, prev + delta)));
  };

  const stepDuration = (delta: number) => {
    setDurationMinutes(prev => Math.max(5, Math.min(1440 - startMinutes, prev + delta)));
  };

  const linkedTask = taskId ? tasks.find(t => t.id === taskId) : undefined;

  const handleSave = () => {
    const label = title.trim() || linkedTask?.title.trim() || '';
    if (!label) {
      Alert.alert('Add a title', 'Give the block a name, or link it to a task.');
      return;
    }
    if (startMinutes + durationMinutes > 1440) {
      Alert.alert('Block runs past midnight', 'Shorten the block or start it earlier.');
      return;
    }
    onSave({
      title: label,
      kind,
      startMinutes,
      durationMinutes,
      color,
      notes: notes.trim(),
      taskId,
      reminderMinutesBefore: reminder,
    });
    onClose();
  };

  const confirmDelete = () => {
    Alert.alert('Delete this block?', 'The block and its reminder will be removed.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { onDelete?.(); onClose(); } },
    ]);
  };

  const styles = useMemo(() => StyleSheet.create({
    overlay: { flex: 1, backgroundColor: theme.colors.overlay, justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: 26, borderTopRightRadius: 26,
      paddingTop: theme.spacing.md, maxHeight: '90%',
    },
    grabber: {
      alignSelf: 'center', width: 40, height: 4, borderRadius: 2,
      backgroundColor: theme.colors.border, marginBottom: theme.spacing.sm,
    },
    headerRow: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.sm,
      gap: theme.spacing.sm,
    },
    headerTitle: { ...theme.typography.titleSmall, fontWeight: '800', color: theme.colors.text, flex: 1 },
    body: { paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.lg, gap: theme.spacing.md },
    label: {
      ...theme.typography.overline, color: theme.colors.textMuted,
      textTransform: 'uppercase', marginBottom: 6,
    },
    input: {
      backgroundColor: theme.colors.inputBg, borderRadius: theme.borderRadius.md,
      paddingHorizontal: 14, paddingVertical: 12,
      ...theme.typography.body, color: theme.colors.text,
    },
    notesInput: { minHeight: 74, textAlignVertical: 'top', paddingTop: 12 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      paddingHorizontal: 12, paddingVertical: 8,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.inputBg,
      borderWidth: 1.5, borderColor: 'transparent',
    },
    chipActive: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primaryLight },
    chipText: { ...theme.typography.caption, fontWeight: '600', color: theme.colors.textSecondary },
    chipTextActive: { color: theme.colors.primary, fontWeight: '700' },
    stepperRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
    stepper: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: theme.colors.inputBg, borderRadius: theme.borderRadius.md,
      paddingHorizontal: 6, paddingVertical: 6,
    },
    stepBtn: {
      width: 34, height: 34, borderRadius: 10,
      backgroundColor: theme.colors.surface,
      alignItems: 'center', justifyContent: 'center',
    },
    stepValue: { ...theme.typography.body, fontWeight: '700', color: theme.colors.text },
    endHint: { ...theme.typography.caption, color: theme.colors.textMuted, textAlign: 'center' },
    swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
    swatch: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    taskChip: {
      paddingHorizontal: 12, paddingVertical: 8,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.inputBg,
      borderWidth: 1.5, borderColor: 'transparent',
      maxWidth: 220,
    },
    footer: {
      flexDirection: 'row', gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.sm,
      // Clear the home-indicator / gesture bar so the save button stays tappable.
      paddingBottom: insets.bottom + theme.spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border,
    },
    deleteBtn: {
      width: 52, alignItems: 'center', justifyContent: 'center',
      borderRadius: theme.borderRadius.lg, backgroundColor: theme.colors.errorLight,
    },
    saveBtn: {
      flex: 1, backgroundColor: theme.colors.primary,
      borderRadius: theme.borderRadius.lg, paddingVertical: 15, alignItems: 'center',
    },
    saveText: { ...theme.typography.button, fontSize: 15, fontWeight: '800', color: '#FFF' },
  }), [insets.bottom, theme]);

  const endMinutes = startMinutes + durationMinutes;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.grabber} />
          <View style={styles.headerRow}>
            <View style={[styles.swatch, { backgroundColor: color + '22', width: 34, height: 34 }]}>
              <Ionicons name={BLOCK_KIND_ICONS[kind]} size={18} color={color} />
            </View>
            <Text style={styles.headerTitle}>{block ? 'Edit Block' : 'New Time Block'}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={24} color={theme.colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={{ flexShrink: 1 }}
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View>
              <Text style={styles.label}>Title</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="What are you doing?"
                placeholderTextColor={theme.colors.textMuted}
                autoFocus={!block}
                returnKeyType="done"
              />
            </View>

            <View>
              <Text style={styles.label}>Type</Text>
              <View style={styles.chipRow}>
                {KINDS.map(k => {
                  const active = kind === k.id;
                  return (
                    <TouchableOpacity
                      key={k.id}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => selectKind(k.id)}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={BLOCK_KIND_ICONS[k.id]}
                        size={14}
                        color={active ? theme.colors.primary : theme.colors.textMuted}
                      />
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{k.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View>
              <Text style={styles.label}>Starts at</Text>
              <View style={styles.stepperRow}>
                <View style={styles.stepper}>
                  <TouchableOpacity style={styles.stepBtn} onPress={() => stepStart(-15)}>
                    <Ionicons name="remove" size={18} color={theme.colors.text} />
                  </TouchableOpacity>
                  <Text style={styles.stepValue}>{formatMinutes(startMinutes)}</Text>
                  <TouchableOpacity style={styles.stepBtn} onPress={() => stepStart(15)}>
                    <Ionicons name="add" size={18} color={theme.colors.text} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View>
              <Text style={styles.label}>Length</Text>
              <View style={styles.stepperRow}>
                <View style={styles.stepper}>
                  <TouchableOpacity style={styles.stepBtn} onPress={() => stepDuration(-15)}>
                    <Ionicons name="remove" size={18} color={theme.colors.text} />
                  </TouchableOpacity>
                  <Text style={styles.stepValue}>{formatDuration(durationMinutes)}</Text>
                  <TouchableOpacity style={styles.stepBtn} onPress={() => stepDuration(15)}>
                    <Ionicons name="add" size={18} color={theme.colors.text} />
                  </TouchableOpacity>
                </View>
              </View>
              <View style={{ marginTop: 8 }}>
                <View style={styles.chipRow}>
                  {DURATION_PRESETS.map(preset => (
                    <TouchableOpacity
                      key={preset}
                      style={[styles.chip, durationMinutes === preset && styles.chipActive]}
                      onPress={() => setDurationMinutes(Math.min(preset, 1440 - startMinutes))}
                    >
                      <Text style={[styles.chipText, durationMinutes === preset && styles.chipTextActive]}>
                        {formatDuration(preset)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <Text style={[styles.endHint, { marginTop: 8 }]}>
                {formatMinutes(startMinutes)} → {formatMinutes(endMinutes)}
                {endMinutes > 1440 ? ' · runs past midnight' : ''}
              </Text>
            </View>

            <View>
              <Text style={styles.label}>Reminder</Text>
              <View style={styles.chipRow}>
                {REMINDER_OPTIONS.map(opt => {
                  const active = reminder === opt.value;
                  return (
                    <TouchableOpacity
                      key={String(opt.value)}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => setReminder(opt.value)}
                    >
                      {opt.value === null && (
                        <Ionicons
                          name="notifications-off-outline"
                          size={13}
                          color={active ? theme.colors.primary : theme.colors.textMuted}
                        />
                      )}
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View>
              <Text style={styles.label}>Color</Text>
              <View style={styles.swatchRow}>
                {BLOCK_PALETTE.map(c => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.swatch, {
                      backgroundColor: c,
                      borderWidth: color === c ? 3 : 0,
                      borderColor: theme.colors.surface,
                    }]}
                    onPress={() => { setColor(c); setColorTouched(true); }}
                  >
                    {color === c && <Ionicons name="checkmark" size={16} color="#FFF" />}
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {tasks.length > 0 && (
              <View>
                <Text style={styles.label}>Link a task {taskId ? '(tap to unlink)' : '(optional)'}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {tasks.slice(0, 25).map(t => {
                    const active = taskId === t.id;
                    return (
                      <TouchableOpacity
                        key={t.id}
                        style={[styles.taskChip, active && styles.chipActive]}
                        onPress={() => {
                          if (active) { setTaskId(null); return; }
                          setTaskId(t.id);
                          setKind('task');
                          if (!colorTouched) setColor(BLOCK_KIND_COLORS.task);
                          if (!title.trim()) setTitle(t.title);
                        }}
                      >
                        <Text
                          style={[styles.chipText, active && styles.chipTextActive]}
                          numberOfLines={1}
                        >
                          {t.title}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            <View>
              <Text style={styles.label}>Notes</Text>
              <TextInput
                style={[styles.input, styles.notesInput]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Anything to remember about this block…"
                placeholderTextColor={theme.colors.textMuted}
                multiline
              />
            </View>
          </ScrollView>

          <View style={styles.footer}>
            {block && onDelete && (
              <TouchableOpacity style={styles.deleteBtn} onPress={confirmDelete}>
                <Ionicons name="trash-outline" size={20} color={theme.colors.error} />
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.85}>
              <Text style={styles.saveText}>{block ? 'Save Changes' : 'Add Block'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
