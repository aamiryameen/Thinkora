import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Pressable,
  ScrollView,
  Alert,
  Platform,
  NativeModules,
  DeviceEventEmitter,
  PermissionsAndroid,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Icon } from '../components/Icons';
import { SubTaskList } from '../components/SubTaskList';
import { CategoryPicker } from '../components/CategoryPicker';
import { ReminderTunePicker } from '../components/ReminderTunePicker';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import type { RootStackParamList } from '../navigation/types';
import type { TaskRepeat, TaskPriority } from '../types';
import {
  REMINDER_TUNES,
  getTuneIdForItem,
  setTuneForItem,
  clearTuneForItem,
} from '../services/soundService';

type EditorRouteProp = RouteProp<RootStackParamList, 'TaskEditor'>;
type Nav = NativeStackNavigationProp<RootStackParamList, 'TaskEditor'>;

const REPEAT_OPTIONS: { label: string; value: TaskRepeat }[] = [
  { label: 'None', value: 'none' },
  { label: 'Daily', value: 'daily' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
  { label: 'Yearly', value: 'yearly' },
];

const PRIORITY_OPTIONS: { label: string; value: TaskPriority; color: string }[] = [
  { label: 'None', value: 'none', color: '#B8C1CC' },
  { label: 'Low', value: 'low', color: '#10B981' },
  { label: 'Medium', value: 'medium', color: '#F59E0B' },
  { label: 'High', value: 'high', color: '#EF4444' },
];

export function TaskEditorScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<EditorRouteProp>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { taskId, date: prefilledDate } = route.params ?? {};
  const {
    getTask,
    addTask,
    updateTask,
    deleteTask,
    taskCategories,
    toggleSubTaskComplete,
    addSubTask,
    deleteSubTask,
  } = useApp();

  const existing = taskId ? getTask(taskId) : null;
  const isNew = !taskId;

  const [title, setTitle] = useState(existing?.title ?? '');
  const [categoryId, setCategoryId] = useState<string | null>(existing?.categoryId ?? null);
  const [dueDate, setDueDate] = useState<number | null>(existing?.dueDate ?? prefilledDate ?? null);
  const [reminderDate, setReminderDate] = useState<number | null>(existing?.reminderDate ?? null);
  const [repeat, setRepeat] = useState<TaskRepeat>(existing?.repeat ?? 'none');
  const [priority, setPriority] = useState<TaskPriority>(existing?.priority ?? 'none');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [subtasks, setSubtasks] = useState(existing?.subtasks ?? []);
  const [tuneId, setTuneIdState] = useState<string | null>(null);
  const [showTunePicker, setShowTunePicker] = useState(false);

  // Load per-task tune override (only for existing tasks)
  useEffect(() => {
    if (existing?.id) {
      getTuneIdForItem(`task-reminder-${existing.id}`).then(setTuneIdState);
    }
  }, [existing?.id]);

  // Handle tune selection
  const handleTuneSelect = useCallback(async (newTuneId: string | null) => {
    setTuneIdState(newTuneId);
    // We apply the tune based on the task id when save happens
    setShowTunePicker(false);
  }, []);

  const tuneLabel = useMemo(() => {
    if (!tuneId) return 'Default';
    const tune = REMINDER_TUNES.find(t => t.id === tuneId);
    return tune?.name ?? 'Default';
  }, [tuneId]);

  // Voice input state
  const [isListening, setIsListening] = useState(false);
  const [voiceTarget, setVoiceTarget] = useState<'title' | 'notes' | null>(null);
  const voiceTargetRef = useRef<'title' | 'notes' | null>(null);

  // DatePicker state
  const [showPicker, setShowPicker] = useState<'due' | 'reminder' | null>(null);
  const [pickerStep, setPickerStep] = useState<'date' | 'time'>('date');

  // Sync subtasks from context if editing existing
  useEffect(() => {
    if (existing) setSubtasks(existing.subtasks);
  }, [existing?.subtasks]);

  // Voice recognition
  const startVoice = useCallback(async (target: 'title' | 'notes') => {
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          { title: 'Microphone Permission', message: 'App needs access to your microphone for voice input.', buttonPositive: 'OK' },
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert('Permission Denied', 'Microphone permission is required for voice input.');
          return;
        }
      }
      const { SpeechModule } = NativeModules;
      if (!SpeechModule) {
        Alert.alert('Not Available', 'Speech recognition is not available on this device.');
        return;
      }
      voiceTargetRef.current = target;
      setVoiceTarget(target);
      setIsListening(true);
      SpeechModule.startListening('en-US');
    } catch (e: any) {
      Alert.alert('Voice Error', e?.message ?? 'Failed to start voice input');
      setIsListening(false);
      setVoiceTarget(null);
    }
  }, []);

  const stopVoice = useCallback(() => {
    try {
      const { SpeechModule } = NativeModules;
      SpeechModule?.stopListening();
    } catch (_) {}
    voiceTargetRef.current = null;
    setIsListening(false);
    setVoiceTarget(null);
  }, []);

  // Listen for speech events — mounted once, reads voiceTargetRef to avoid stale closures
  useEffect(() => {
    const { SpeechModule } = NativeModules;
    if (!SpeechModule) return;
    const subs = [
      DeviceEventEmitter.addListener('onSpeechResults', (e: any) => {
        const text = e?.value?.[0];
        if (text) {
          if (voiceTargetRef.current === 'title') {
            setTitle((prev: string) => prev ? `${prev} ${text}` : text);
          } else if (voiceTargetRef.current === 'notes') {
            setNotes((prev: string) => prev ? `${prev} ${text}` : text);
          }
        }
        voiceTargetRef.current = null;
        setIsListening(false);
        setVoiceTarget(null);
      }),
      DeviceEventEmitter.addListener('onSpeechError', (e: any) => {
        Alert.alert('Voice Error', e?.error ?? 'Recognition failed');
        voiceTargetRef.current = null;
        setIsListening(false);
        setVoiceTarget(null);
      }),
    ];
    return () => subs.forEach(s => s.remove());
  }, []);

  const handleSave = useCallback(() => {
    if (!title.trim()) {
      Alert.alert('Title required', 'Please enter a task title.');
      return;
    }
    let savedId: string | null = null;
    if (isNew) {
      const created = addTask({
        title: title.trim(),
        completed: false,
        categoryId,
        dueDate,
        reminderDate,
        repeat,
        notes,
        attachments: [],
        subtasks,
        priority,
      });
      savedId = created.id;
    } else if (existing) {
      updateTask(existing.id, {
        title: title.trim(),
        categoryId,
        dueDate,
        reminderDate,
        repeat,
        notes,
        subtasks,
        priority,
      });
      savedId = existing.id;
    }
    // Persist tune choice (async but fire-and-forget)
    if (savedId) {
      const reminderKey = `task-reminder-${savedId}`;
      if (tuneId) {
        setTuneForItem(reminderKey, tuneId).catch(() => {});
      } else {
        clearTuneForItem(reminderKey).catch(() => {});
      }
    }
    navigation.goBack();
  }, [isNew, title, categoryId, dueDate, reminderDate, repeat, notes, subtasks, priority, existing, addTask, updateTask, navigation, tuneId]);

  const handleDelete = useCallback(() => {
    if (!taskId) return;
    Alert.alert('Delete task', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { deleteTask(taskId); navigation.goBack(); } },
    ]);
  }, [taskId, deleteTask, navigation]);

  // Refs hold all picker state so callbacks are never stale and no effects needed
  const activePickerType = useRef<'due' | 'reminder'>('due');
  const pendingDateRef = useRef<Date | null>(null);
  const pickerStepRef = useRef<'date' | 'time'>('date');

  const onDatePick = useCallback(
    (event: { type: string }, date?: Date) => {
      const isDismissed = event?.type === 'dismissed' || date == null;

      if (Platform.OS === 'android') {
        if (pickerStepRef.current === 'date') {
          // Close the date picker first
          setShowPicker(null);
          setPickerStep('date');
          if (isDismissed || !date) {
            pendingDateRef.current = null;
            return;
          }
          // Store chosen date, then open time picker after a short delay
          pendingDateRef.current = date;
          pickerStepRef.current = 'time';
          setPickerStep('time');
          setTimeout(() => {
            setShowPicker(activePickerType.current);
          }, 100);
          return;
        }

        if (pickerStepRef.current === 'time') {
          setShowPicker(null);
          pickerStepRef.current = 'date';
          setPickerStep('date');
          if (!isDismissed && date && pendingDateRef.current) {
            const merged = new Date(pendingDateRef.current);
            merged.setHours(date.getHours(), date.getMinutes(), 0, 0);
            if (activePickerType.current === 'due') setDueDate(merged.getTime());
            else setReminderDate(merged.getTime());
          }
          pendingDateRef.current = null;
          return;
        }
      }

      // iOS — single datetime picker
      setShowPicker(null);
      if (!isDismissed && date) {
        if (activePickerType.current === 'due') setDueDate(date.getTime());
        else setReminderDate(date.getTime());
      }
    },
    [] // no deps needed — all state accessed via refs
  );

  const openDatePicker = useCallback((type: 'due' | 'reminder') => {
    activePickerType.current = type;
    pickerStepRef.current = 'date';
    pendingDateRef.current = null;
    setPickerStep('date');
    setShowPicker(type);
  }, []);

  const formatDate = (ts: number) => new Date(ts).toLocaleDateString(undefined, { dateStyle: 'medium' });
  const formatTime = (ts: number) => new Date(ts).toLocaleTimeString(undefined, { timeStyle: 'short' });

  // Handle subtasks locally for new tasks, via context for existing
  const handleToggleSub = useCallback((subId: string) => {
    if (existing) {
      toggleSubTaskComplete(existing.id, subId);
    } else {
      setSubtasks((prev) => prev.map((s) => (s.id === subId ? { ...s, completed: !s.completed } : s)));
    }
  }, [existing, toggleSubTaskComplete]);

  const handleAddSub = useCallback((subTitle: string) => {
    if (existing) {
      addSubTask(existing.id, subTitle);
    } else {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setSubtasks((prev) => [...prev, { id, title: subTitle, completed: false }]);
    }
  }, [existing, addSubTask]);

  const handleDeleteSub = useCallback((subId: string) => {
    if (existing) {
      deleteSubTask(existing.id, subId);
    } else {
      setSubtasks((prev) => prev.filter((s) => s.id !== subId));
    }
  }, [existing, deleteSubTask]);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.lg,
      paddingTop: insets.top + theme.spacing.sm,
      paddingBottom: theme.spacing.md,
      backgroundColor: theme.colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    headerBtn: {
      paddingVertical: theme.spacing.xs,
      paddingHorizontal: theme.spacing.md,
    },
    saveBtn: {
      backgroundColor: theme.colors.primary,
      borderRadius: theme.borderRadius.lg,
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.lg,
    },
    saveBtnText: {
      ...theme.typography.button,
      color: '#FFF',
    },
    scroll: { flex: 1 },
    scrollContent: { padding: theme.spacing.lg, paddingBottom: 100, gap: theme.spacing.lg },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    titleInput: {
      ...theme.typography.title,
      color: theme.colors.text,
      fontSize: 24,
      fontWeight: '700',
      padding: 0,
      flex: 1,
    },
    section: {
      gap: theme.spacing.sm,
    },
    sectionLabel: {
      ...theme.typography.label,
      color: theme.colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.cardBg,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.md,
      gap: theme.spacing.md,
    },
    rowText: {
      ...theme.typography.body,
      color: theme.colors.text,
      flex: 1,
    },
    rowPlaceholder: {
      color: theme.colors.textMuted,
    },
    rowValue: {
      ...theme.typography.bodySmall,
      color: theme.colors.primary,
      fontWeight: '600',
    },
    clearBtn: {
      padding: 4,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.sm,
    },
    chip: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.inputBg,
      borderWidth: 1.5,
      borderColor: 'transparent',
    },
    chipSelected: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primaryLight,
    },
    chipText: {
      ...theme.typography.bodySmall,
      color: theme.colors.text,
      fontWeight: '500',
    },
    chipTextSelected: {
      color: theme.colors.primary,
      fontWeight: '600',
    },
    notesHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    notesInput: {
      ...theme.typography.body,
      color: theme.colors.text,
      backgroundColor: theme.colors.cardBg,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.md,
      minHeight: 80,
      textAlignVertical: 'top',
    },
    subtaskCard: {
      backgroundColor: theme.colors.cardBg,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.md,
    },
    deleteBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.md,
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.errorLight,
    },
    deleteBtnText: {
      ...theme.typography.button,
      color: theme.colors.error,
    },
  }), [theme, insets]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()}>
          <Icon name="back" size={24} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
          <Text style={styles.saveBtnText}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="always">
        <View style={styles.titleRow}>
          <TextInput
            style={styles.titleInput}
            value={title}
            onChangeText={setTitle}
            placeholder="Task title"
            placeholderTextColor={theme.colors.textMuted}
            autoFocus={isNew}
          />
          <Pressable
            onPress={() => { isListening && voiceTarget === 'title' ? stopVoice() : startVoice('title'); }}
            hitSlop={16}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: isListening && voiceTarget === 'title' ? theme.colors.error : theme.colors.primary,
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 999,
            }}
          >
            <Ionicons name={isListening && voiceTarget === 'title' ? 'stop' : 'mic'} size={20} color="#FFF" />
          </Pressable>
        </View>

        {/* Category */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Category</Text>
          <CategoryPicker categories={taskCategories} selectedId={categoryId} onSelect={setCategoryId} />
        </View>

        {/* Due Date */}
        <TouchableOpacity style={styles.row} onPress={() => openDatePicker('due')}>
          <Ionicons name="calendar-outline" size={22} color={theme.colors.primary} />
          <Text style={[styles.rowText, !dueDate && styles.rowPlaceholder]}>
            {dueDate ? `Due: ${formatDate(dueDate)}` : 'Due Date'}
          </Text>
          {dueDate && (
            <TouchableOpacity style={styles.clearBtn} onPress={() => setDueDate(null)}>
              <Ionicons name="close-circle" size={20} color={theme.colors.textMuted} />
            </TouchableOpacity>
          )}
        </TouchableOpacity>

        {/* Reminder */}
        <TouchableOpacity style={styles.row} onPress={() => openDatePicker('reminder')}>
          <Ionicons name="alarm-outline" size={22} color={theme.colors.accent} />
          <Text style={[styles.rowText, !reminderDate && styles.rowPlaceholder]}>
            {reminderDate ? `Reminder: ${formatDate(reminderDate)} ${formatTime(reminderDate)}` : 'Set reminder'}
          </Text>
          {reminderDate && (
            <TouchableOpacity style={styles.clearBtn} onPress={() => setReminderDate(null)}>
              <Ionicons name="close-circle" size={20} color={theme.colors.textMuted} />
            </TouchableOpacity>
          )}
        </TouchableOpacity>
        {reminderDate && (
          <View style={[styles.chipRow, { paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.sm }]}>
            <Text style={[styles.chipText, { color: theme.colors.textMuted, marginRight: 4 }]}>Snooze:</Text>
            {[{ label: '10m', min: 10 }, { label: '30m', min: 30 }, { label: '1h', min: 60 }, { label: '3h', min: 180 }].map((s) => (
              <TouchableOpacity
                key={s.label}
                style={[styles.chip, { borderColor: theme.colors.accent, backgroundColor: theme.colors.accent + '15' }]}
                onPress={() => setReminderDate((d) => (d ? d + s.min * 60000 : Date.now() + s.min * 60000))}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, { color: theme.colors.accent, fontWeight: '600' }]}>{s.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Alarm sound picker — only shown when reminder is set */}
        {reminderDate && (
          <TouchableOpacity style={styles.row} onPress={() => setShowTunePicker(true)}>
            <Ionicons name="musical-notes-outline" size={22} color={theme.colors.accent} />
            <Text style={styles.rowText}>Alarm sound: {tuneLabel}</Text>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
          </TouchableOpacity>
        )}

        {/* Repeat */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Repeat</Text>
          <View style={styles.chipRow}>
            {REPEAT_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.chip, repeat === opt.value && styles.chipSelected]}
                onPress={() => setRepeat(opt.value)}
              >
                <Text style={[styles.chipText, repeat === opt.value && styles.chipTextSelected]}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Priority */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Priority</Text>
          <View style={styles.chipRow}>
            {PRIORITY_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.chip, priority === opt.value && { borderColor: opt.color, backgroundColor: opt.color + '15' }]}
                onPress={() => setPriority(opt.value)}
              >
                <Text style={[styles.chipText, priority === opt.value && { color: opt.color, fontWeight: '600' }]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <View style={styles.notesHeader}>
            <Text style={styles.sectionLabel}>Notes</Text>
            <Pressable
              onPress={() => isListening && voiceTarget === 'notes' ? stopVoice() : startVoice('notes')}
              hitSlop={16}
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: isListening && voiceTarget === 'notes' ? theme.colors.error : theme.colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name={isListening && voiceTarget === 'notes' ? 'stop' : 'mic'} size={16} color="#FFF" />
            </Pressable>
          </View>
          <TextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={setNotes}
            placeholder="Add notes..."
            placeholderTextColor={theme.colors.textMuted}
            multiline
          />
        </View>

        {/* Sub-tasks */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Sub-tasks</Text>
          <View style={styles.subtaskCard}>
            <SubTaskList
              subtasks={subtasks}
              onToggle={handleToggleSub}
              onAdd={handleAddSub}
              onDelete={handleDeleteSub}
            />
          </View>
        </View>

        {/* Delete */}
        {!isNew && (
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
            <Icon name="delete" size={20} color={theme.colors.error} />
            <Text style={styles.deleteBtnText}>Delete Task</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {showPicker && (
        <DateTimePicker
          value={(() => {
            if (Platform.OS === 'android' && pickerStep === 'time' && pendingDateRef.current) return pendingDateRef.current;
            if (activePickerType.current === 'due' && dueDate) return new Date(dueDate);
            if (activePickerType.current === 'reminder' && reminderDate) return new Date(reminderDate);
            return new Date();
          })()}
          mode={Platform.OS === 'android' ? pickerStep : 'datetime'}
          display="default"
          onChange={onDatePick}
          minimumDate={pickerStep === 'date' ? new Date() : undefined}
        />
      )}

      {/* Reminder Tune Picker */}
      <ReminderTunePicker
        visible={showTunePicker}
        selectedTuneId={tuneId}
        onSelect={handleTuneSelect}
        onClose={() => setShowTunePicker(false)}
      />
    </View>
  );
}
