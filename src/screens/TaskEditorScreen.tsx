import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
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
import { estimateTaskDuration, formatMinutes, type TimeEstimate } from '../services/timeEstimateService';
import { CategoryPicker } from '../components/CategoryPicker';
import { ReminderTunePicker } from '../components/ReminderTunePicker';
import { useApp } from '../context/AppContext';
import { BackgroundPickerSheet } from '../components/BackgroundPickerSheet';
import { FontPickerSheet } from '../components/FontPickerSheet';
import { PremiumGateSheet } from '../components/PremiumGateSheet';
import { usePremium } from '../services/premiumService';
import { cssFontFamily, fontStyle } from '../core/fonts';
import { moveToTrash } from '../services/archiveService';
import { pickImageFromGallery, takePhoto } from '../services/attachmentService';
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
import { stripHtml } from '../utils/stripHtml';

const RichEditor = Platform.OS === 'android'
  ? require('react-native-pell-rich-editor').RichEditor
  : null;
const RichToolbar = Platform.OS === 'android'
  ? require('react-native-pell-rich-editor').RichToolbar
  : null;
const richActions = Platform.OS === 'android'
  ? require('react-native-pell-rich-editor').actions
  : { setBold: '', setItalic: '', setUnderline: '', insertBulletsList: '', insertOrderedList: '', checkboxList: '' };

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
    reloadFromStorage,
    taskCategories,
    tasks,
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
  const { hasPremium } = usePremium();
  const [backgroundUri, setBackgroundUri] = useState<string | null>(existing?.backgroundUri ?? null);
  const [fontId, setFontId] = useState<string>(existing?.fontId ?? 'default');
  const [attachments, setAttachments] = useState(existing?.attachments ?? []);
  const attachImage = useCallback(async (fromCamera: boolean) => {
    try {
      const picked = fromCamera ? await takePhoto() : await pickImageFromGallery();
      if (!picked?.uri) return;
      setAttachments(prev => [...prev, {
        id: `att-${Date.now()}`,
        type: fromCamera ? 'camera' : 'photo',
        uri: picked.uri,
        createdAt: Date.now(),
      }]);
    } catch { /* cancelled */ }
  }, []);

  const [bgPickerVisible, setBgPickerVisible] = useState(false);
  const [fontPickerVisible, setFontPickerVisible] = useState(false);
  const [fontGateVisible, setFontGateVisible] = useState(false);
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const notesRichRef = useRef<any>(null);
  const [subtasks, setSubtasks] = useState(existing?.subtasks ?? []);
  const [timeEstimate, setTimeEstimate] = useState<TimeEstimate | null>(null);
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
  const [subtaskSource, setSubtaskSource] = useState<'proxy' | 'user-key' | 'heuristic' | null>(null);
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

  // Compute AI time estimate from title + category vs past tracked tasks
  useEffect(() => {
    if (!title || title.trim().length < 3) { setTimeEstimate(null); return; }
    let cancelled = false;
    estimateTaskDuration(title, categoryId, tasks).then((est) => {
      if (!cancelled) setTimeEstimate(est);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [title, categoryId, tasks]);

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
            if (Platform.OS === 'android' && notesRichRef.current) {
              notesRichRef.current.insertText(text);
            } else {
              setNotes((prev: string) => prev ? `${prev} ${text}` : text);
            }
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
        attachments,
        subtasks,
        priority,
        backgroundUri,
        fontId,
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
        attachments,
        backgroundUri,
        fontId,
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

  /**
   * Pushes the chosen font into the notes WebView.
   *
   * `contentCSSText` is only read when the editor initialises, and the text
   * lives in a contenteditable div rather than `document.body` — so the rule
   * has to be injected as a stylesheet covering both.
   */
  useEffect(() => {
    const family = cssFontFamily(fontId);
    const css = `body, #editor, .content, [contenteditable] { font-family: ${family} !important; }`;
    const script = `
      (function() {
        var id = 'thinkora-font';
        var tag = document.getElementById(id);
        if (!tag) {
          tag = document.createElement('style');
          tag.id = id;
          document.head.appendChild(tag);
        }
        tag.innerHTML = ${JSON.stringify(css)};
      })();
      true;
    `;
    const apply = () => {
      try { notesRichRef.current?.injectJavascript?.(script); } catch { /* not ready */ }
    };
    apply();
    // The WebView bridge can mount a frame or two after this effect runs.
    const retry = setTimeout(apply, 150);
    return () => clearTimeout(retry);
  }, [fontId]);

  const handleDelete = useCallback(() => {
    if (!taskId) return;
    // Trash rather than destroy, matching the task list's long-press action.
    Alert.alert('Move to trash', 'You can restore it from Settings for 30 days.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Move to trash',
        style: 'destructive',
        onPress: async () => {
          await moveToTrash('task', taskId);
          await reloadFromStorage();
          navigation.goBack();
        },
      },
    ]);
  }, [navigation, reloadFromStorage, taskId]);

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
      const text = stripHtml(notes).trim();
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
      const resultHtml = aiActionResult.replace(/\n/g, '<br/>');
      const next = mode === 'replace' ? resultHtml : notes + (notes ? '<br/><br/>' : '') + resultHtml;
      setNotes(next);
      if (Platform.OS === 'android' && notesRichRef.current) {
        notesRichRef.current.setContentHTML(next);
      }
      closeTextAiModal();
    },
    [aiActionResult, notes, closeTextAiModal],
  );

  // ─── AI: subtasks suggester ───
  const runSuggestSubtasks = useCallback(async () => {
    const plainNotes = stripHtml(notes).trim();
    const descriptor = `${title.trim()}${plainNotes ? `\n\n${plainNotes}` : ''}`.trim();
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
    setSubtaskSource(null);
    setSelectedSuggestions(new Set());
    try {
      const out = await generateSubtasks(settings.geminiApiKey, descriptor, ctrl.signal);
      if (ctrl.signal.aborted) return;
      setSubtaskSuggestions(out.subtasks);
      setSubtaskSource(out.source);
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
    setSubtaskSource(null);
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
      alignItems: 'center',
      gap: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      paddingTop: insets.top + theme.spacing.sm,
      paddingBottom: theme.spacing.md,
      backgroundColor: backgroundUri ? 'transparent' : theme.colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    headerBtn: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.inputBg,
    },
    headerTitle: {
      ...theme.typography.titleSmall,
      color: theme.colors.text,
      flex: 1,
    },
    saveBtn: {
      backgroundColor: theme.colors.primary,
      borderRadius: theme.borderRadius.lg,
      paddingVertical: 10,
      paddingHorizontal: theme.spacing.lg,
      ...theme.shadows.card,
    },
    saveBtnText: {
      ...theme.typography.button,
      color: '#FFF',
    },
    scroll: { flex: 1, backgroundColor: 'transparent' },
    scrollContent: {
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.lg,
      paddingBottom: 120,
      gap: theme.spacing.xl,
    },

    // Title card
    attachCard: {
      backgroundColor: theme.colors.cardBg,
      borderRadius: theme.borderRadius.xl,
      padding: theme.spacing.md,
      marginTop: theme.spacing.md,
      gap: theme.spacing.sm,
    },
    attachHeader: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
    attachLabel: {
      ...theme.typography.caption, fontWeight: '700',
      color: theme.colors.textMuted, flex: 1,
      textTransform: 'uppercase', letterSpacing: 1,
    },
    attachBtn: {
      width: 32, height: 32, borderRadius: 10,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: theme.colors.primaryLight,
    },
    attachRow: { flexDirection: 'row', gap: theme.spacing.sm },
    attachThumb: {
      width: 72, height: 72, borderRadius: 12,
      overflow: 'hidden', backgroundColor: theme.colors.inputBg,
    },
    attachRemove: {
      position: 'absolute', top: 3, right: 3,
      width: 18, height: 18, borderRadius: 9,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: '#000000AA',
    },
    titleCard: {
      backgroundColor: backgroundUri ? theme.colors.surface + 'B8' : theme.colors.cardBg,
      borderRadius: theme.borderRadius.xl,
      // Clips the background image to the card's rounded corners.
      overflow: 'hidden',
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.lg,
      paddingBottom: theme.spacing.md,
      ...theme.shadows.card,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    titleInput: {
      ...theme.typography.title,
      color: theme.colors.text,
      fontSize: 26,
      lineHeight: 32,
      fontWeight: '700',
      padding: 0,
      flex: 1,
    },
    titleMicBtn: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.inputBg,
    },
    titleMicBtnActive: {
      backgroundColor: theme.colors.error,
    },

    // Section header (icon + label) — matches NoteEditor styling
    sectionTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.sm,
    },
    sectionTitleIcon: {
      width: 28,
      height: 28,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primaryLight,
    },
    sectionTitle: {
      ...theme.typography.label,
      color: theme.colors.text,
      fontWeight: '700',
      fontSize: 14,
      letterSpacing: 0.3,
    },
    section: {
      gap: theme.spacing.sm,
    },
    sectionLabel: {
      ...theme.typography.overline,
      color: theme.colors.textMuted,
      textTransform: 'uppercase',
    },

    // Grouped meta card
    metaCard: {
      backgroundColor: theme.colors.cardBg,
      borderRadius: theme.borderRadius.xl,
      overflow: 'hidden',
      ...theme.shadows.card,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
      gap: theme.spacing.md,
      minHeight: 56,
    },
    metaRowDivider: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.borderSubtle,
    },
    metaIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    metaText: {
      ...theme.typography.body,
      color: theme.colors.text,
      flex: 1,
    },
    metaPlaceholder: {
      color: theme.colors.textMuted,
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
    scrollChipRow: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
      paddingRight: theme.spacing.sm,
    },

    // Priority — 4 equal-width segments, never wraps
    priorityRow: {
      flexDirection: 'row',
      gap: 8,
    },
    priorityCell: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.inputBg,
      borderWidth: 1.5,
      borderColor: 'transparent',
    },
    chip: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: 8,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.inputBg,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    chipSelected: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primaryLight,
    },
    chipText: {
      ...theme.typography.bodySmall,
      color: theme.colors.textSecondary,
      fontWeight: '500',
    },
    chipTextSelected: {
      color: theme.colors.primary,
      fontWeight: '700',
    },

    // Notes card with focus styling
    notesCard: {
      // Translucent when a background image is set, so the image reads through
      // instead of being hidden by an opaque card.
      backgroundColor: backgroundUri ? theme.colors.surface + 'B8' : theme.colors.cardBg,
      borderRadius: theme.borderRadius.xl,
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.md,
      paddingBottom: theme.spacing.md,
      ...theme.shadows.card,
    },
    notesHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      marginBottom: theme.spacing.xs,
    },
    /* Formatting dock — mirrors the create-note editor toolbar */
    notesDockRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.xs,
      padding: 4,
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: theme.borderRadius.full,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.borderSubtle,
    },
    notesDock: {
      flex: 1,
      minHeight: 40,
      paddingHorizontal: 4,
      flexDirection: 'row',
      alignItems: 'center',
    },
    notesDockToolbar: {
      backgroundColor: 'transparent',
      minHeight: 36,
      flex: 1,
    },
    notesMicBtn: {
      width: 30,
      height: 30,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.inputBg,
    },
    notesMicBtnActive: {
      backgroundColor: theme.colors.error,
    },
    notesInput: {
      ...theme.typography.body,
      color: theme.colors.text,
      paddingHorizontal: 0,
      paddingVertical: theme.spacing.xs,
      minHeight: 96,
      textAlignVertical: 'top',
      lineHeight: 22,
    },

    subtaskCard: {
      backgroundColor: theme.colors.cardBg,
      borderRadius: theme.borderRadius.xl,
      padding: theme.spacing.md,
      ...theme.shadows.card,
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
      flexBasis: '47%',
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      paddingVertical: 14,
      paddingHorizontal: 14,
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.borderSubtle,
      ...theme.shadows.subtle,
    },
    aiActionIcon: {
      width: 36,
      height: 36,
      borderRadius: 11,
      backgroundColor: '#7C3AED1A',
      alignItems: 'center',
      justifyContent: 'center',
    },
    aiActionLabel: {
      ...theme.typography.bodySmall,
      color: theme.colors.text,
      fontWeight: '700',
      flex: 1,
      letterSpacing: -0.1,
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

    heuristicHint: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: theme.borderRadius.md,
      backgroundColor: theme.colors.inputBg,
      marginBottom: 10,
    },
    heuristicHintText: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
      flex: 1,
      fontStyle: 'italic',
    },

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
  }), [backgroundUri, theme, insets]);

  return (
    <View style={styles.container}>
      {/* Page background sits behind everything, not just the title card. */}
      {backgroundUri && (
        <>
          <Image
            source={{ uri: backgroundUri }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
          {/* Scrim keeps text legible over an arbitrary photo. */}
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: theme.colors.background + 'C4' },
            ]}
          />
        </>
      )}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Icon name="back" size={22} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{isNew ? 'New task' : 'Edit task'}</Text>
        <TouchableOpacity style={styles.headerBtn} onPress={() => setBgPickerVisible(true)} activeOpacity={0.7}>
          <Ionicons
            name={backgroundUri ? 'image' : 'image-outline'}
            size={20}
            color={backgroundUri ? theme.colors.primary : theme.colors.icon}
          />
        </TouchableOpacity>
        <TouchableOpacity style={styles.headerBtn} onPress={() => setFontPickerVisible(true)} activeOpacity={0.7}>
          <Ionicons
            name="text"
            size={20}
            color={fontId !== 'default' ? theme.colors.primary : theme.colors.icon}
          />
        </TouchableOpacity>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.85}>
          <Text style={styles.saveBtnText}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="always">
        {/* Title card */}
        <View style={styles.titleCard}>
          <View style={styles.titleRow}>
            <TextInput
              style={[styles.titleInput, fontStyle(fontId)]}
              value={title}
              onChangeText={setTitle}
              placeholder="Task here"
              placeholderTextColor={theme.colors.textMuted}
              autoFocus={isNew}
              multiline
            />
            <Pressable
              onPress={() => { isListening && voiceTarget === 'title' ? stopVoice() : startVoice('title'); }}
              hitSlop={12}
              style={[
                styles.titleMicBtn,
                isListening && voiceTarget === 'title' && styles.titleMicBtnActive,
              ]}
            >
              <Ionicons
                name={isListening && voiceTarget === 'title' ? 'stop' : 'mic-outline'}
                size={18}
                color={isListening && voiceTarget === 'title' ? '#FFF' : theme.colors.textSecondary}
              />
            </Pressable>
          </View>
        </View>

        {/* Attachments */}
        <View style={styles.attachCard}>
          <View style={styles.attachHeader}>
            <Text style={styles.attachLabel}>Attachments</Text>
            <TouchableOpacity onPress={() => attachImage(false)} style={styles.attachBtn}>
              <Ionicons name="image-outline" size={17} color={theme.colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => attachImage(true)} style={styles.attachBtn}>
              <Ionicons name="camera-outline" size={17} color={theme.colors.primary} />
            </TouchableOpacity>
          </View>
          {attachments.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.attachRow}>
                {attachments.map(a => (
                  <View key={a.id} style={styles.attachThumb}>
                    <Image source={{ uri: a.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                    <TouchableOpacity
                      style={styles.attachRemove}
                      onPress={() => setAttachments(prev => prev.filter(x => x.id !== a.id))}
                    >
                      <Ionicons name="close" size={12} color="#FFF" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </ScrollView>
          )}
        </View>

        {/* Notes — right below the title, with the same formatting dock as create-note */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <View style={styles.sectionTitleIcon}>
              <Ionicons name="document-text-outline" size={14} color={theme.colors.primary} />
            </View>
            <Text style={styles.sectionTitle}>Notes</Text>
          </View>
          <View style={styles.notesCard}>
            {Platform.OS === 'android' && RichEditor && RichToolbar ? (
              <>
                <View style={styles.notesDockRow}>
                  <View style={styles.notesDock}>
                    <RichToolbar
                      getEditor={() => notesRichRef.current}
                      actions={[
                        richActions.setBold,
                        richActions.setItalic,
                        richActions.setUnderline,
                        richActions.insertBulletsList,
                        richActions.insertOrderedList,
                        richActions.checkboxList,
                      ]}
                      style={styles.notesDockToolbar}
                      iconTint={theme.colors.textSecondary}
                      selectedIconTint={theme.colors.primary}
                    />
                  </View>
                  <Pressable
                    onPress={() => isListening && voiceTarget === 'notes' ? stopVoice() : startVoice('notes')}
                    hitSlop={12}
                    style={[
                      styles.notesMicBtn,
                      isListening && voiceTarget === 'notes' && styles.notesMicBtnActive,
                    ]}
                  >
                    <Ionicons
                      name={isListening && voiceTarget === 'notes' ? 'stop' : 'mic-outline'}
                      size={15}
                      color={isListening && voiceTarget === 'notes' ? '#FFF' : theme.colors.textSecondary}
                    />
                  </Pressable>
                </View>
                <RichEditor
                  ref={(r: any) => { if (r) notesRichRef.current = r; }}
                  initialContentHTML={notes}
                  onChange={(html: string) => setNotes(typeof html === 'string' ? html : '')}
                  placeholder="Add details, context, links…"
                  initialHeight={120}
                  editorStyle={{
                    backgroundColor: 'transparent',
                    color: theme.colors.text,
                    placeholderColor: theme.colors.textSecondary,
                    caretColor: theme.colors.primary,
                    contentCSSText: `font-size: 15px; line-height: 1.6; min-height: 96px; padding: 4px 2px; font-family: ${cssFontFamily(fontId)};`,
                  }}
                  useContainer={true}
                />
              </>
            ) : (
              <>
                <View style={styles.notesHeader}>
                  <Pressable
                    onPress={() => isListening && voiceTarget === 'notes' ? stopVoice() : startVoice('notes')}
                    hitSlop={12}
                    style={[
                      styles.notesMicBtn,
                      isListening && voiceTarget === 'notes' && styles.notesMicBtnActive,
                    ]}
                  >
                    <Ionicons
                      name={isListening && voiceTarget === 'notes' ? 'stop' : 'mic-outline'}
                      size={15}
                      color={isListening && voiceTarget === 'notes' ? '#FFF' : theme.colors.textSecondary}
                    />
                  </Pressable>
                </View>
                <TextInput
                  style={[styles.notesInput, fontStyle(fontId)]}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Add details, context, links…"
                  placeholderTextColor={theme.colors.textMuted}
                  multiline
                />
              </>
            )}
          </View>
        </View>

        {/* Category */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <View style={styles.sectionTitleIcon}>
              <Ionicons name="pricetag-outline" size={14} color={theme.colors.primary} />
            </View>
            <Text style={styles.sectionTitle}>Category</Text>
          </View>
          <CategoryPicker categories={taskCategories} selectedId={categoryId} onSelect={setCategoryId} />
        </View>

        {/* Schedule — grouped meta card */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <View style={styles.sectionTitleIcon}>
              <Ionicons name="calendar-outline" size={14} color={theme.colors.primary} />
            </View>
            <Text style={styles.sectionTitle}>Schedule</Text>
          </View>
          <View style={styles.metaCard}>
            <TouchableOpacity style={styles.metaRow} onPress={() => openDatePicker('due')} activeOpacity={0.7}>
              <View style={[styles.metaIconWrap, { backgroundColor: theme.colors.primaryLight }]}>
                <Ionicons name="calendar-outline" size={18} color={theme.colors.primary} />
              </View>
              <Text style={[styles.metaText, !dueDate && styles.metaPlaceholder]}>
                {dueDate ? formatDate(dueDate) : 'Due date'}
              </Text>
              {dueDate ? (
                <TouchableOpacity style={styles.clearBtn} onPress={() => setDueDate(null)} hitSlop={8}>
                  <Ionicons name="close-circle" size={20} color={theme.colors.textMuted} />
                </TouchableOpacity>
              ) : (
                <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
              )}
            </TouchableOpacity>

            <TouchableOpacity style={[styles.metaRow, styles.metaRowDivider]} onPress={() => openDatePicker('reminder')} activeOpacity={0.7}>
              <View style={[styles.metaIconWrap, { backgroundColor: theme.colors.accent + '20' }]}>
                <Ionicons name="alarm-outline" size={18} color={theme.colors.accent} />
              </View>
              <Text style={[styles.metaText, !reminderDate && styles.metaPlaceholder]}>
                {reminderDate ? `${formatDate(reminderDate)} · ${formatTime(reminderDate)}` : 'Reminder'}
              </Text>
              {reminderDate ? (
                <TouchableOpacity style={styles.clearBtn} onPress={() => setReminderDate(null)} hitSlop={8}>
                  <Ionicons name="close-circle" size={20} color={theme.colors.textMuted} />
                </TouchableOpacity>
              ) : (
                <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
              )}
            </TouchableOpacity>

            {reminderDate && (
              <TouchableOpacity style={[styles.metaRow, styles.metaRowDivider]} onPress={() => setShowTunePicker(true)} activeOpacity={0.7}>
                <View style={[styles.metaIconWrap, { backgroundColor: theme.colors.accent + '20' }]}>
                  <Ionicons name="musical-notes-outline" size={18} color={theme.colors.accent} />
                </View>
                <Text style={styles.metaText}>Alarm sound</Text>
                <Text style={styles.rowValue}>{tuneLabel}</Text>
                <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {reminderDate && (
            <View style={[styles.chipRow, { marginTop: theme.spacing.sm, alignItems: 'center' }]}>
              <Text style={[styles.chipText, { color: theme.colors.textMuted, marginRight: 2 }]}>Snooze</Text>
              {[{ label: '10m', min: 10 }, { label: '30m', min: 30 }, { label: '1h', min: 60 }, { label: '3h', min: 180 }].map((s) => (
                <TouchableOpacity
                  key={s.label}
                  style={[styles.chip, { borderColor: theme.colors.accent + '40', backgroundColor: theme.colors.accent + '12' }]}
                  onPress={() => setReminderDate((d) => (d ? d + s.min * 60000 : Date.now() + s.min * 60000))}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.chipText, { color: theme.colors.accent, fontWeight: '700' }]}>{s.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Repeat */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <View style={styles.sectionTitleIcon}>
              <Ionicons name="repeat-outline" size={14} color={theme.colors.primary} />
            </View>
            <Text style={styles.sectionTitle}>Repeat</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.scrollChipRow}
          >
            {REPEAT_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.chip, repeat === opt.value && styles.chipSelected]}
                onPress={() => setRepeat(opt.value)}
                activeOpacity={0.75}
              >
                <Text style={[styles.chipText, repeat === opt.value && styles.chipTextSelected]}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Priority */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <View style={styles.sectionTitleIcon}>
              <Ionicons name="flag-outline" size={14} color={theme.colors.primary} />
            </View>
            <Text style={styles.sectionTitle}>Priority</Text>
          </View>
          <View style={styles.priorityRow}>
            {PRIORITY_OPTIONS.map((opt) => {
              const selected = priority === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.priorityCell,
                    selected && {
                      borderColor: opt.color,
                      backgroundColor: opt.color + '18',
                    },
                  ]}
                  onPress={() => setPriority(opt.value)}
                  activeOpacity={0.75}
                >
                  {opt.value !== 'none' && (
                    <Ionicons
                      name="flag"
                      size={12}
                      color={selected ? opt.color : theme.colors.textMuted}
                      style={{ marginRight: 4 }}
                    />
                  )}
                  <Text
                    style={[
                      styles.chipText,
                      selected && { color: opt.color, fontWeight: '700' },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── AI Assistant (matches note editor) ── */}
        <View style={styles.aiSectionTitleRow}>
          <View style={[styles.aiSectionTitleIcon, { backgroundColor: '#7C3AED22' }]}>
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
                  <Ionicons name="document-text-outline" size={18} color="#A78BFA" />
                </View>
                <Text style={styles.aiActionLabel}>Summarize</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.aiActionBtn}
                activeOpacity={0.8}
                onPress={() => runTextAiAction('Rewrite', (signal) => rewriteNote(settings.geminiApiKey, notes, signal))}
              >
                <View style={styles.aiActionIcon}>
                  <Ionicons name="create-outline" size={18} color="#A78BFA" />
                </View>
                <Text style={styles.aiActionLabel}>Rewrite</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.aiActionBtn}
                activeOpacity={0.8}
                onPress={() => runTextAiAction('Grammar fix', (signal) => fixGrammar(settings.geminiApiKey, notes, signal))}
              >
                <View style={styles.aiActionIcon}>
                  <Ionicons name="checkmark-done-outline" size={18} color="#A78BFA" />
                </View>
                <Text style={styles.aiActionLabel}>Fix grammar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.aiActionBtn}
                activeOpacity={0.8}
                onPress={() => setAiToneMenuOpen((v) => !v)}
              >
                <View style={styles.aiActionIcon}>
                  <Ionicons name="color-palette-outline" size={18} color="#A78BFA" />
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
          <View style={styles.sectionTitleRow}>
            <View style={styles.sectionTitleIcon}>
              <Ionicons name="list-outline" size={14} color={theme.colors.primary} />
            </View>
            <Text style={styles.sectionTitle}>Sub-tasks</Text>
            {subtasks.length > 0 && (
              <Text style={[styles.chipText, { color: theme.colors.textMuted, marginLeft: 4 }]}>
                {subtasks.filter((s) => s.completed).length}/{subtasks.length}
              </Text>
            )}
          </View>
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

        {/* AI Time Estimate */}
        {timeEstimate && timeEstimate.sampleCount > 0 && (
          <View style={styles.section}>
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 12,
              backgroundColor: theme.colors.primary + '12',
              borderRadius: 12, padding: 14,
              borderLeftWidth: 4, borderLeftColor: theme.colors.primary,
            }}>
              <Ionicons name="hourglass-outline" size={22} color={theme.colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '800', color: theme.colors.text }}>
                  Estimated: {formatMinutes(timeEstimate.minutes)}
                </Text>
                <Text style={{ fontSize: 11, color: theme.colors.textMuted, marginTop: 2 }}>
                  {timeEstimate.rationale}
                </Text>
              </View>
            </View>
          </View>
        )}

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
                  {subtaskSource === 'heuristic' && (
                    <View style={styles.heuristicHint}>
                      <Ionicons name="information-circle-outline" size={14} color={theme.colors.textMuted} />
                      <Text style={styles.heuristicHintText}>
                        Generated offline. Add a Gemini key in Settings for smarter suggestions.
                      </Text>
                    </View>
                  )}
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

      <BackgroundPickerSheet
        visible={bgPickerVisible}
        currentUri={backgroundUri}
        onSelect={(uri) => { setBackgroundUri(uri); setBgPickerVisible(false); }}
        onClose={() => setBgPickerVisible(false)}
      />
      <FontPickerSheet
        visible={fontPickerVisible}
        currentId={fontId}
        sample={title.trim().slice(0, 12) || 'Thinkora'}
        hasPremium={hasPremium}
        onSelect={(id) => { setFontId(id); setFontPickerVisible(false); }}
        onLocked={() => { setFontPickerVisible(false); setFontGateVisible(true); }}
        onClose={() => setFontPickerVisible(false)}
      />
      <PremiumGateSheet
        visible={fontGateVisible}
        feature="note_fonts"
        onClose={() => setFontGateVisible(false)}
      />
    </View>
  );
}
