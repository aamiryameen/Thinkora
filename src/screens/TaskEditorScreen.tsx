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
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Icon } from '../components/Icons';
import { SubTaskList } from '../components/SubTaskList';
import { TaskTimer } from '../components/TaskTimer';
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
import {
  summarizeNote,
  rewriteNote,
  fixGrammar,
  shiftTone,
  generateSubtasks,
  GeminiError,
  type ToneStyle,
  type AiCallResult,
} from '../services/geminiService';

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
    settings,
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

  // AI action modal state
  const [aiActionLabel, setAiActionLabel] = useState<string | null>(null);
  const [aiActionLoading, setAiActionLoading] = useState(false);
  const [aiActionResult, setAiActionResult] = useState<string | null>(null);
  const [aiActionError, setAiActionError] = useState<string | null>(null);
  const [aiActionRetryable, setAiActionRetryable] = useState(false);
  const [aiToneMenuOpen, setAiToneMenuOpen] = useState(false);
  // Subtasks suggestion state — separate from text-result modal
  const [subtaskSuggestions, setSubtaskSuggestions] = useState<string[] | null>(null);
  const [subtaskLoading, setSubtaskLoading] = useState(false);
  const [subtaskError, setSubtaskError] = useState<string | null>(null);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<number>>(new Set());
  const aiAbortRef = useRef<AbortController | null>(null);
  const lastAiRunRef = useRef<{
    label: string;
    fn: (signal: AbortSignal) => Promise<AiCallResult>;
  } | null>(null);

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

  // ─── AI: text actions (summarize / rewrite / grammar / tone) ───
  const runTextAiAction = useCallback(
    async (label: string, fn: (signal: AbortSignal) => Promise<AiCallResult>) => {
      const text = notes.trim();
      if (!text) {
        Alert.alert('Nothing to process', 'Add some text in Notes first.');
        return;
      }
      lastAiRunRef.current = { label, fn };
      aiAbortRef.current?.abort();
      const ctrl = new AbortController();
      aiAbortRef.current = ctrl;
      setAiActionLabel(label);
      setAiActionLoading(true);
      setAiActionResult(null);
      setAiActionError(null);
      setAiActionRetryable(false);
      try {
        const out = await fn(ctrl.signal);
        if (ctrl.signal.aborted) return;
        setAiActionResult(out.text);
      } catch (e: any) {
        if (e?.name === 'AbortError') return;
        const msg = e instanceof GeminiError ? e.message : 'Something went wrong. Please try again.';
        const canRetry = e instanceof GeminiError ? e.isRetryable : true;
        setAiActionError(msg);
        setAiActionRetryable(canRetry);
      } finally {
        setAiActionLoading(false);
      }
    },
    [notes],
  );

  const retryTextAiAction = useCallback(() => {
    const last = lastAiRunRef.current;
    if (!last) return;
    runTextAiAction(last.label, last.fn);
  }, [runTextAiAction]);

  const closeTextAiModal = useCallback(() => {
    aiAbortRef.current?.abort();
    aiAbortRef.current = null;
    setAiActionLabel(null);
    setAiActionLoading(false);
    setAiActionResult(null);
    setAiActionError(null);
    setAiActionRetryable(false);
    setAiToneMenuOpen(false);
  }, []);

  const applyTextAiResult = useCallback(
    (mode: 'replace' | 'append') => {
      if (!aiActionResult) return;
      setNotes((prev) => (mode === 'replace' ? aiActionResult : prev + (prev ? '\n\n' : '') + aiActionResult));
      closeTextAiModal();
    },
    [aiActionResult, closeTextAiModal],
  );

  // ─── AI: subtasks suggester ───
  const runSuggestSubtasks = useCallback(async () => {
    const descriptor = `${title.trim()}${notes.trim() ? `\n\n${notes.trim()}` : ''}`.trim();
    if (descriptor.length < 3) {
      Alert.alert('Need more context', 'Add a task title (and optionally notes) first so the AI has something to break down.');
      return;
    }
    aiAbortRef.current?.abort();
    const ctrl = new AbortController();
    aiAbortRef.current = ctrl;
    setSubtaskLoading(true);
    setSubtaskError(null);
    setSubtaskSuggestions(null);
    setSelectedSuggestions(new Set());
    try {
      const out = await generateSubtasks(settings.geminiApiKey, descriptor, ctrl.signal);
      if (ctrl.signal.aborted) return;
      setSubtaskSuggestions(out.subtasks);
      // Preselect all by default
      setSelectedSuggestions(new Set(out.subtasks.map((_, i) => i)));
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      const msg = e instanceof GeminiError ? e.message : 'Something went wrong. Please try again.';
      setSubtaskError(msg);
    } finally {
      setSubtaskLoading(false);
    }
  }, [title, notes, settings.geminiApiKey]);

  const closeSubtaskModal = useCallback(() => {
    aiAbortRef.current?.abort();
    aiAbortRef.current = null;
    setSubtaskLoading(false);
    setSubtaskSuggestions(null);
    setSubtaskError(null);
    setSelectedSuggestions(new Set());
  }, []);

  const toggleSuggestion = useCallback((idx: number) => {
    setSelectedSuggestions((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  const acceptSelectedSuggestions = useCallback(() => {
    if (!subtaskSuggestions) return;
    const picks = subtaskSuggestions.filter((_, i) => selectedSuggestions.has(i));
    picks.forEach((title) => handleAddSub(title));
    closeSubtaskModal();
  }, [subtaskSuggestions, selectedSuggestions, handleAddSub, closeSubtaskModal]);

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

    // ── AI Assistant card (mirrors NoteEditorScreen) ─────────────
    aiSectionTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      marginTop: theme.spacing.md,
      marginBottom: theme.spacing.sm,
    },
    aiSectionTitleIcon: {
      width: 28,
      height: 28,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
    },
    aiSectionTitle: {
      ...theme.typography.label,
      color: theme.colors.text,
      fontWeight: '700',
      fontSize: 14,
      letterSpacing: 0.3,
    },
    aiMetaCard: {
      borderRadius: 20,
      backgroundColor: theme.colors.cardBg,
      overflow: 'hidden',
      ...theme.shadows.card,
    },
    aiCardSection: {
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.lg,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    aiCardSectionLast: { borderBottomWidth: 0 },
    aiActionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
    aiActionBtn: {
      flexGrow: 1,
      flexBasis: '48%',
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      paddingVertical: 12,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.borderRadius.lg,
      backgroundColor: '#7C3AED10',
      borderWidth: 1,
      borderColor: '#7C3AED25',
    },
    aiActionIcon: {
      width: 28,
      height: 28,
      borderRadius: 9,
      backgroundColor: '#7C3AED20',
      alignItems: 'center',
      justifyContent: 'center',
    },
    aiActionLabel: {
      ...theme.typography.bodySmall,
      color: '#4C1D95',
      fontWeight: '700',
      flex: 1,
    },
    aiToneRowCard: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.sm,
      marginTop: theme.spacing.sm,
    },
    aiToneChipCard: {
      paddingVertical: 6,
      paddingHorizontal: theme.spacing.md,
      backgroundColor: theme.colors.inputBg,
      borderRadius: theme.borderRadius.full,
    },
    aiToneChipCardText: {
      ...theme.typography.bodySmall,
      color: theme.colors.text,
      fontWeight: '500',
    },

    // ── Suggest subtasks button ───────────────────────────────────
    suggestBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginTop: theme.spacing.sm,
      paddingVertical: 10,
      borderRadius: theme.borderRadius.lg,
      backgroundColor: '#7C3AED10',
      borderWidth: 1,
      borderColor: '#7C3AED25',
    },
    suggestBtnText: {
      ...theme.typography.bodySmall,
      color: '#7C3AED',
      fontWeight: '700',
    },

    // ── AI result modal (shared shape) ────────────────────────────
    aiOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'center',
      padding: theme.spacing.lg,
    },
    aiCard: {
      backgroundColor: theme.colors.cardBg,
      borderRadius: 20,
      overflow: 'hidden',
      maxHeight: '85%',
    },
    aiHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      padding: theme.spacing.lg,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    aiHeaderTitle: {
      ...theme.typography.title,
      fontSize: 16,
      fontWeight: '700',
      color: theme.colors.text,
      flex: 1,
    },
    aiBody: {
      padding: theme.spacing.lg,
      minHeight: 120,
    },
    aiBodyText: {
      ...theme.typography.body,
      color: theme.colors.text,
      lineHeight: 22,
    },
    aiLoading: {
      alignItems: 'center',
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.xl,
    },
    aiLoadingText: {
      ...theme.typography.bodySmall,
      color: theme.colors.textMuted,
    },
    aiErrorWrap: {
      alignItems: 'center',
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.md,
    },
    aiErrorIcon: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.warningLight,
    },
    aiErrorText: {
      ...theme.typography.body,
      color: theme.colors.text,
      textAlign: 'center',
      lineHeight: 22,
      paddingHorizontal: theme.spacing.md,
    },
    aiActions: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
      padding: theme.spacing.lg,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
    },
    aiBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      borderRadius: theme.borderRadius.lg,
    },
    aiBtnPrimary: { backgroundColor: theme.colors.primary },
    aiBtnPrimaryText: { ...theme.typography.button, color: '#FFF' },
    aiBtnSecondary: { backgroundColor: theme.colors.inputBg },
    aiBtnSecondaryText: { ...theme.typography.button, color: theme.colors.text, fontWeight: '600' },

    // ── Subtask suggestion row ────────────────────────────────────
    suggestionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      paddingVertical: 10,
      paddingHorizontal: theme.spacing.sm,
      borderRadius: theme.borderRadius.md,
      backgroundColor: theme.colors.inputBg,
      marginBottom: 6,
    },
    suggestionCheckbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    suggestionCheckboxOn: { backgroundColor: theme.colors.primary },
    suggestionText: { ...theme.typography.body, color: theme.colors.text, flex: 1 },
    suggestionTextDim: { color: theme.colors.textMuted, textDecorationLine: 'line-through' },
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

        {/* ── AI Assistant (matches note editor) ── */}
        <View style={styles.aiSectionTitleRow}>
          <View style={[styles.aiSectionTitleIcon, { backgroundColor: '#7C3AED15' }]}>
            <Ionicons name="color-wand-outline" size={16} color="#7C3AED" />
          </View>
          <Text style={styles.aiSectionTitle}>AI Assistant</Text>
        </View>
        <View style={styles.aiMetaCard}>
          <View style={[styles.aiCardSection, styles.aiCardSectionLast]}>
            <View style={styles.aiActionsGrid}>
              <TouchableOpacity
                style={styles.aiActionBtn}
                activeOpacity={0.8}
                onPress={() => runTextAiAction('Summary', (signal) => summarizeNote(settings.geminiApiKey, notes, signal))}
              >
                <View style={styles.aiActionIcon}>
                  <Ionicons name="document-text-outline" size={16} color="#7C3AED" />
                </View>
                <Text style={styles.aiActionLabel}>Summarize</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.aiActionBtn}
                activeOpacity={0.8}
                onPress={() => runTextAiAction('Rewrite', (signal) => rewriteNote(settings.geminiApiKey, notes, signal))}
              >
                <View style={styles.aiActionIcon}>
                  <Ionicons name="create-outline" size={16} color="#7C3AED" />
                </View>
                <Text style={styles.aiActionLabel}>Rewrite</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.aiActionBtn}
                activeOpacity={0.8}
                onPress={() => runTextAiAction('Grammar fix', (signal) => fixGrammar(settings.geminiApiKey, notes, signal))}
              >
                <View style={styles.aiActionIcon}>
                  <Ionicons name="checkmark-done-outline" size={16} color="#7C3AED" />
                </View>
                <Text style={styles.aiActionLabel}>Fix grammar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.aiActionBtn}
                activeOpacity={0.8}
                onPress={() => setAiToneMenuOpen((v) => !v)}
              >
                <View style={styles.aiActionIcon}>
                  <Ionicons name="color-palette-outline" size={16} color="#7C3AED" />
                </View>
                <Text style={styles.aiActionLabel}>Change tone</Text>
              </TouchableOpacity>
            </View>
            {aiToneMenuOpen && (
              <View style={styles.aiToneRowCard}>
                {(['formal', 'casual', 'friendly', 'concise'] as ToneStyle[]).map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={styles.aiToneChipCard}
                    activeOpacity={0.7}
                    onPress={() => {
                      setAiToneMenuOpen(false);
                      const label = `Tone: ${t.charAt(0).toUpperCase()}${t.slice(1)}`;
                      runTextAiAction(label, (signal) => shiftTone(settings.geminiApiKey, notes, t, signal));
                    }}
                  >
                    <Text style={styles.aiToneChipCardText}>{t.charAt(0).toUpperCase()}{t.slice(1)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
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
          <TouchableOpacity
            style={styles.suggestBtn}
            activeOpacity={0.8}
            onPress={runSuggestSubtasks}
          >
            <Ionicons name="sparkles" size={14} color="#7C3AED" />
            <Text style={styles.suggestBtnText}>Suggest subtasks with AI</Text>
          </TouchableOpacity>
        </View>

        {/* Time Tracking — only for existing tasks (needs an id) */}
        {!isNew && existing && (
          <View style={styles.section}>
            <TaskTimer taskId={existing.id} />
          </View>
        )}

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

      {/* ── AI text-result modal (summarize/rewrite/grammar/tone) ── */}
      <Modal
        visible={aiActionLabel !== null}
        transparent
        animationType="fade"
        onRequestClose={closeTextAiModal}
      >
        <Pressable style={styles.aiOverlay} onPress={closeTextAiModal}>
          <Pressable style={styles.aiCard} onPress={() => {}}>
            <View style={styles.aiHeader}>
              <Ionicons name="sparkles" size={18} color="#7C3AED" />
              <Text style={styles.aiHeaderTitle}>{aiActionLabel}</Text>
              <TouchableOpacity onPress={closeTextAiModal} hitSlop={10}>
                <Ionicons name="close" size={22} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.aiBody}>
              {aiActionLoading ? (
                <View style={styles.aiLoading}>
                  <ActivityIndicator size="large" color={theme.colors.primary} />
                  <Text style={styles.aiLoadingText}>Thinking…</Text>
                </View>
              ) : aiActionError ? (
                <View style={styles.aiErrorWrap}>
                  <View style={styles.aiErrorIcon}>
                    <Ionicons name="alert-circle-outline" size={28} color={theme.colors.warning} />
                  </View>
                  <Text style={styles.aiErrorText}>{aiActionError}</Text>
                </View>
              ) : (
                <Text style={styles.aiBodyText}>{aiActionResult}</Text>
              )}
            </ScrollView>
            {!aiActionLoading && aiActionResult && (
              <View style={styles.aiActions}>
                <TouchableOpacity
                  style={[styles.aiBtn, styles.aiBtnSecondary]}
                  onPress={() => applyTextAiResult('append')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.aiBtnSecondaryText}>Append</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.aiBtn, styles.aiBtnPrimary]}
                  onPress={() => applyTextAiResult('replace')}
                  activeOpacity={0.85}
                >
                  <Text style={styles.aiBtnPrimaryText}>Replace</Text>
                </TouchableOpacity>
              </View>
            )}
            {!aiActionLoading && aiActionError && (
              <View style={styles.aiActions}>
                <TouchableOpacity
                  style={[styles.aiBtn, styles.aiBtnSecondary]}
                  onPress={closeTextAiModal}
                  activeOpacity={0.8}
                >
                  <Text style={styles.aiBtnSecondaryText}>Close</Text>
                </TouchableOpacity>
                {aiActionRetryable && (
                  <TouchableOpacity
                    style={[styles.aiBtn, styles.aiBtnPrimary]}
                    onPress={retryTextAiAction}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="refresh" size={16} color="#FFF" />
                    <Text style={[styles.aiBtnPrimaryText, { marginLeft: 6 }]}>Try again</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── AI subtask-suggestions modal ── */}
      <Modal
        visible={subtaskLoading || subtaskSuggestions !== null || subtaskError !== null}
        transparent
        animationType="fade"
        onRequestClose={closeSubtaskModal}
      >
        <Pressable style={styles.aiOverlay} onPress={closeSubtaskModal}>
          <Pressable style={styles.aiCard} onPress={() => {}}>
            <View style={styles.aiHeader}>
              <Ionicons name="sparkles" size={18} color="#7C3AED" />
              <Text style={styles.aiHeaderTitle}>Suggested subtasks</Text>
              <TouchableOpacity onPress={closeSubtaskModal} hitSlop={10}>
                <Ionicons name="close" size={22} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.aiBody}>
              {subtaskLoading ? (
                <View style={styles.aiLoading}>
                  <ActivityIndicator size="large" color={theme.colors.primary} />
                  <Text style={styles.aiLoadingText}>Breaking it down…</Text>
                </View>
              ) : subtaskError ? (
                <View style={styles.aiErrorWrap}>
                  <View style={styles.aiErrorIcon}>
                    <Ionicons name="alert-circle-outline" size={28} color={theme.colors.warning} />
                  </View>
                  <Text style={styles.aiErrorText}>{subtaskError}</Text>
                </View>
              ) : subtaskSuggestions ? (
                <>
                  {subtaskSuggestions.map((s, i) => {
                    const on = selectedSuggestions.has(i);
                    return (
                      <TouchableOpacity
                        key={i}
                        style={styles.suggestionRow}
                        onPress={() => toggleSuggestion(i)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.suggestionCheckbox, on && styles.suggestionCheckboxOn]}>
                          {on && <Ionicons name="checkmark" size={14} color="#FFF" />}
                        </View>
                        <Text style={[styles.suggestionText, !on && styles.suggestionTextDim]}>{s}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </>
              ) : null}
            </ScrollView>
            {!subtaskLoading && subtaskSuggestions && (
              <View style={styles.aiActions}>
                <TouchableOpacity
                  style={[styles.aiBtn, styles.aiBtnSecondary]}
                  onPress={closeSubtaskModal}
                  activeOpacity={0.8}
                >
                  <Text style={styles.aiBtnSecondaryText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.aiBtn,
                    selectedSuggestions.size > 0 ? styles.aiBtnPrimary : styles.aiBtnSecondary,
                  ]}
                  onPress={acceptSelectedSuggestions}
                  disabled={selectedSuggestions.size === 0}
                  activeOpacity={0.85}
                >
                  <Text
                    style={
                      selectedSuggestions.size > 0 ? styles.aiBtnPrimaryText : styles.aiBtnSecondaryText
                    }
                  >
                    Add {selectedSuggestions.size || ''}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
            {!subtaskLoading && subtaskError && (
              <View style={styles.aiActions}>
                <TouchableOpacity
                  style={[styles.aiBtn, styles.aiBtnSecondary]}
                  onPress={closeSubtaskModal}
                  activeOpacity={0.8}
                >
                  <Text style={styles.aiBtnSecondaryText}>Close</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.aiBtn, styles.aiBtnPrimary]}
                  onPress={runSuggestSubtasks}
                  activeOpacity={0.85}
                >
                  <Ionicons name="refresh" size={16} color="#FFF" />
                  <Text style={[styles.aiBtnPrimaryText, { marginLeft: 6 }]}>Try again</Text>
                </TouchableOpacity>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
