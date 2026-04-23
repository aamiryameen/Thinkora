import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  Modal,
  Pressable,
  Share,
  NativeModules,
  DeviceEventEmitter,
  PermissionsAndroid,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RichNoteEditor, RichNoteEditorHandle } from '../components/RichNoteEditor';
import { AttachmentList } from '../components/AttachmentList';
import { SketchCanvasModal } from '../components/SketchCanvas';
import { Icon } from '../components/Icons';
import { useApp } from '../context/AppContext';
import { suggestTasksFromNote, autoCategorizeNote } from '../services/aiService';
import {
  UNDO_HISTORY_MAX,
  DEFAULT_NOTE_TITLE,
  REMINDER_BODY_MAX_LENGTH,
} from '../core/constants';
import { useTheme } from '../context/ThemeContext';
import type { RootStackParamList } from '../navigation/types';
import { stripHtml } from '../utils/stripHtml';
import type { Note, NoteAttachment, SmartCategory } from '../types';
import type { HistoryEntry } from '../types';
import {
  pickImageFromGallery,
  takePhoto,
  pickDocument,
  attachmentToNoteAttachment,
  saveSketchToFile,
} from '../services/attachmentService';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ReminderTunePicker } from '../components/ReminderTunePicker';
import {
  REMINDER_TUNES,
  getTuneIdForItem,
  setTuneForItem,
  clearTuneForItem,
} from '../services/soundService';

type NoteEditorRouteProp = RouteProp<RootStackParamList, 'NoteEditor'>;
type NoteEditorNavProp = NativeStackNavigationProp<RootStackParamList, 'NoteEditor'>;

const HEADER_HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 };

export function NoteEditorScreen() {
  const navigation = useNavigation<NoteEditorNavProp>();
  const route = useRoute<NoteEditorRouteProp>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { noteId, folderId } = route.params ?? {};
  const {
    getNote,
    addNote,
    updateNote,
    deleteNote,
    addReminder,
    updateReminder,
    removeReminder,
    getReminder,
    snoozeReminder,
    tags,
    getTag,
    tasks,
    addTask,
    setNoteColor,
  } = useApp();

  const note = noteId ? getNote(noteId) : null;
  const [title, setTitle] = useState(note?.title ?? '');
  const [content, setContent] = useState(note?.content ?? '');
  const [plainText, setPlainText] = useState(note?.plainText ?? '');
  const [tagIds, setTagIds] = useState<string[]>(note?.tagIds ?? []);
  const [attachments, setAttachments] = useState<NoteAttachment[]>(note?.attachments ?? []);
  const [category, setCategory] = useState<SmartCategory>(note?.category ?? 'none');
  const [reminderId, setReminderId] = useState<string | null>(note?.reminderId ?? null);
  const [pendingReminderDate, setPendingReminderDate] = useState<number | null>(null);
  const [pendingReminderRepeat, setPendingReminderRepeat] = useState<'none' | 'daily' | 'weekly'>('none');
  const [tuneId, setTuneIdState] = useState<string | null>(null);
  const [showTunePicker, setShowTunePicker] = useState(false);

  // Load per-reminder tune override
  useEffect(() => {
    if (reminderId && reminderId !== 'pending') {
      getTuneIdForItem(reminderId).then(setTuneIdState);
    }
  }, [reminderId]);

  const handleTuneSelect = useCallback(async (newTuneId: string | null) => {
    setTuneIdState(newTuneId);
    if (reminderId && reminderId !== 'pending') {
      if (newTuneId) await setTuneForItem(reminderId, newTuneId);
      else await clearTuneForItem(reminderId);
    }
    setShowTunePicker(false);
  }, [reminderId]);

  const tuneLabel = useMemo(() => {
    if (!tuneId) return 'Default';
    const tune = REMINDER_TUNES.find(t => t.id === tuneId);
    return tune?.name ?? 'Default';
  }, [tuneId]);

  // Voice input (mirrors TaskEditorScreen)
  const [isListening, setIsListening] = useState(false);
  const [voiceTarget, setVoiceTarget] = useState<'title' | 'content' | null>(null);
  const voiceTargetRef = useRef<'title' | 'content' | null>(null);

  const startVoice = useCallback(async (target: 'title' | 'content') => {
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
  const initialEntry: HistoryEntry = {
    title: note?.title ?? '',
    content: note?.content ?? '',
    timestamp: Date.now(),
  };
  const [historyState, setHistoryState] = useState<{ history: HistoryEntry[]; index: number }>({
    history: [initialEntry],
    index: 0,
  });
  const { history, index: historyIndex } = historyState;
  const richEditorRef = useRef<RichNoteEditorHandle>(null);
  const isRestoringFromHistory = useRef(false);
  const [sketchModal, setSketchModal] = useState(false);
  const [attachMenuVisible, setAttachMenuVisible] = useState(false);
  const [colorPickerVisible, setColorPickerVisible] = useState(false);
  const [noteColor, setNoteColorState] = useState<string | null>(note?.color ?? null);
  const [showAISuggestions, setShowAISuggestions] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  /** On Android we use date then time (two steps) to avoid crash when dismissing mode="datetime". */
  const [pickerStep, setPickerStep] = useState<'date' | 'time'>('date');
  const [pendingDateForTime, setPendingDateForTime] = useState<Date | null>(null);
  const isNew = !noteId;

  useEffect(() => {
    setHistoryState({
      history: [{ title: note?.title ?? '', content: note?.content ?? '', timestamp: Date.now() }],
      index: 0,
    });
  }, [noteId]);


  const pushHistory = useCallback((titleVal: string, contentVal: string) => {
    if (isRestoringFromHistory.current) return;
    setHistoryState((prev) => {
      const last = prev.history[prev.index];
      const isDuplicate = last && last.title === titleVal && last.content === contentVal;
      if (isDuplicate) return prev;
      const next = prev.history.slice(0, prev.index + 1);
      next.push({ title: titleVal, content: contentVal, timestamp: Date.now() });
      if (next.length > UNDO_HISTORY_MAX) next.shift();
      return { history: next, index: next.length - 1 };
    });
  }, []);

  const [contentRestoreKey, setContentRestoreKey] = useState(0);
  const pendingRestoreRef = useRef<{ title: string; content: string } | null>(null);

  useEffect(() => {
    const pending = pendingRestoreRef.current;
    if (!pending) return;
    pendingRestoreRef.current = null;
    isRestoringFromHistory.current = true;
    setTitle(pending.title);
    setContent(pending.content);
    setPlainText(stripHtml(pending.content));
    setContentRestoreKey((k) => k + 1);
    const t = setTimeout(() => {
      isRestoringFromHistory.current = false;
    }, 150);
    return () => clearTimeout(t);
  }, [historyState.index]);

  const handleUndo = useCallback(() => {
    setHistoryState((prev) => {
      if (prev.index <= 0) return prev;
      const idx = prev.index - 1;
      const e = prev.history[idx];
      if (!e) return prev;
      pendingRestoreRef.current = { title: e.title, content: e.content };
      return { ...prev, index: idx };
    });
  }, []);

  const handleRedo = useCallback(() => {
    setHistoryState((prev) => {
      if (prev.index >= prev.history.length - 1) return prev;
      const idx = prev.index + 1;
      const e = prev.history[idx];
      if (!e) return prev;
      pendingRestoreRef.current = { title: e.title, content: e.content };
      return { ...prev, index: idx };
    });
  }, []);

  const handleContentChange = useCallback((newContent: string, newPlain: string) => {
    if (isRestoringFromHistory.current) return;
    setContent(newContent);
    setPlainText(newPlain);
    pushHistory(title, newContent);
  }, [title, pushHistory]);

  const handleTitleChange = useCallback((newTitle: string) => {
    if (isRestoringFromHistory.current) return;
    setTitle(newTitle);
    pushHistory(newTitle, content);
  }, [content, pushHistory]);

  // Listen for speech events — mounted once, reads voiceTargetRef to avoid stale closures
  useEffect(() => {
    const { SpeechModule } = NativeModules;
    if (!SpeechModule) return;
    const subs = [
      DeviceEventEmitter.addListener('onSpeechResults', (e: any) => {
        const text = e?.value?.[0];
        if (text) {
          if (voiceTargetRef.current === 'title') {
            setTitle((prev: string) => {
              const next = prev ? `${prev} ${text}` : text;
              pushHistory(next, content);
              return next;
            });
          } else if (voiceTargetRef.current === 'content') {
            richEditorRef.current?.insertText(text + ' ');
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
  }, [content, pushHistory]);

  const persistNote = useCallback(async () => {
    if (isNew) {
      if (!title.trim() && !plainText.trim()) return;
      const n = addNote({
        title: title.trim() || DEFAULT_NOTE_TITLE,
        content,
        plainText,
        folderId: folderId ?? null,
        tagIds,
        isFavorite: false,
        isPinned: false,
        color: noteColor,
        category,
        attachments,
        reminderId: null,
      });
      if (pendingReminderDate) {
        const r = await addReminder({
          noteId: n.id,
          title: title.trim() || 'Note reminder',
          body: plainText.slice(0, REMINDER_BODY_MAX_LENGTH) || 'Reminder',
          triggerType: 'time',
          date: pendingReminderDate,
          repeat: pendingReminderRepeat,
        });
        if (r) updateNote(n.id, { reminderId: r.id });
      }
      return;
    }
    if (!note) return;
    updateNote(note.id, {
      title: title.trim() || DEFAULT_NOTE_TITLE,
      content,
      plainText,
      tagIds,
      category,
      attachments,
      reminderId,
      color: noteColor,
    });
  }, [
    isNew,
    title,
    content,
    plainText,
    folderId,
    tagIds,
    category,
    attachments,
    reminderId,
    pendingReminderDate,
    addNote,
    updateNote,
    addReminder,
    note,
    navigation,
    noteColor,
  ]);

  const handleBack = useCallback(() => {
    // Existing notes save on back; new notes are intercepted by the
    // beforeRemove listener below which prompts to discard.
    if (!isNew) persistNote();
    navigation.goBack();
  }, [isNew, persistNote, navigation]);

  const allowLeaveRef = useRef(false);
  const handleSave = useCallback(() => {
    persistNote();
    allowLeaveRef.current = true;
    navigation.goBack();
  }, [persistNote, navigation]);

  // Intercept hardware back / gesture back so new-note drafts aren't silently persisted.
  useEffect(() => {
    const sub = navigation.addListener('beforeRemove', (e) => {
      if (allowLeaveRef.current) return;
      if (!isNew) return;
      const hasContent = title.trim() || plainText.trim();
      if (!hasContent) return;
      e.preventDefault();
      Alert.alert('Discard note?', 'Your changes will not be saved.', [
        { text: 'Keep editing', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            allowLeaveRef.current = true;
            navigation.dispatch(e.data.action);
          },
        },
      ]);
    });
    return sub;
  }, [navigation, isNew, title, plainText]);

  const addAttachment = useCallback(
    (att: NoteAttachment) => setAttachments((prev) => [...prev, att]),
    []
  );

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const showAttachMenu = useCallback(() => {
    setAttachMenuVisible(true);
  }, []);

  const handleSketchSave = useCallback(
    (base64: string) => {
      // Use data URI directly — no file write needed, Image supports data URIs on Android
      const dataUri = base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`;
      addAttachment(
        attachmentToNoteAttachment({ uri: dataUri, name: 'sketch.png', type: 'sketch' })
      );
    },
    [addAttachment]
  );


  const toggleTag = useCallback((tagId: string) => {
    setTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  }, []);

  const pickerStepRef = useRef<'date' | 'time'>('date');
  const pendingPickerDateRef = useRef<Date | null>(null);

  const addReminderTime = useCallback(() => {
    pickerStepRef.current = 'date';
    pendingPickerDateRef.current = null;
    setPickerStep('date');
    setPendingDateForTime(null);
    setShowDatePicker(true);
  }, []);

  const smartSuggestions = [
    { label: 'In 1 hour', getDate: () => Date.now() + 3600000 },
    { label: 'In 3 hours', getDate: () => Date.now() + 3 * 3600000 },
    { label: 'Tomorrow 9:00', getDate: () => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
      return d.getTime();
    }},
    { label: 'Next week', getDate: () => Date.now() + 7 * 24 * 3600000 },
  ];

  const setSmartReminder = useCallback(
    async (getDate: () => number) => {
      const ts = getDate();
      if (noteId) {
        const r = await addReminder({
          noteId,
          title: title || 'Note reminder',
          body: plainText.slice(0, REMINDER_BODY_MAX_LENGTH) || 'Reminder',
          triggerType: 'time',
          date: ts,
          repeat: pendingReminderRepeat,
        });
        if (r) setReminderId(r.id);
      } else {
        setPendingReminderDate(ts);
        setReminderId('pending');
      }
    },
    [addReminder, noteId, title, plainText, pendingReminderRepeat]
  );

  const saveReminderWithTimestamp = useCallback(
    async (ts: number) => {
      if (noteId) {
        const r = await addReminder({
          noteId,
          title: title || 'Note reminder',
          body: plainText.slice(0, REMINDER_BODY_MAX_LENGTH) || 'Reminder',
          triggerType: 'time',
          date: ts,
          repeat: pendingReminderRepeat,
        });
        if (r) setReminderId(r.id);
      } else {
        setPendingReminderDate(ts);
        setReminderId('pending');
      }
    },
    [addReminder, noteId, title, plainText, pendingReminderRepeat]
  );

  const onDatePick = useCallback(
    async (event: { type: string }, date?: Date) => {
      const isDismissed = event?.type === 'dismissed' || date == null;
      if (Platform.OS === 'android') {
        if (pickerStepRef.current === 'date') {
          setShowDatePicker(false);
          if (isDismissed || !date) {
            pickerStepRef.current = 'date';
            pendingPickerDateRef.current = null;
            return;
          }
          pendingPickerDateRef.current = date;
          pickerStepRef.current = 'time';
          setPickerStep('time');
          setPendingDateForTime(date);
          setTimeout(() => setShowDatePicker(true), 100);
          return;
        }
        if (pickerStepRef.current === 'time') {
          setShowDatePicker(false);
          pickerStepRef.current = 'date';
          setPickerStep('date');
          if (!isDismissed && date && pendingPickerDateRef.current) {
            const merged = new Date(pendingPickerDateRef.current);
            merged.setHours(date.getHours(), date.getMinutes(), 0, 0);
            await saveReminderWithTimestamp(merged.getTime());
          }
          pendingPickerDateRef.current = null;
          setPendingDateForTime(null);
          return;
        }
      }
      setShowDatePicker(false);
      if (isDismissed) return;
      if (date) await saveReminderWithTimestamp(date.getTime());
    },
    [saveReminderWithTimestamp]
  );

  const removeReminderNote = useCallback(async () => {
    if (reminderId && reminderId !== 'pending') {
      await removeReminder(reminderId);
    }
    setReminderId(null);
    setPendingReminderDate(null);
  }, [reminderId, removeReminder]);

  const reminderTimestamp =
    reminderId && reminderId !== 'pending'
      ? getReminder(reminderId)?.date
      : pendingReminderDate ?? null;
  const reminderDateLabel =
    reminderTimestamp != null
      ? new Date(reminderTimestamp).toLocaleString(undefined, {
          dateStyle: 'medium',
          timeStyle: 'short',
        })
      : null;

  const confirmDelete = useCallback(() => {
    if (!noteId) return;
    Alert.alert('Delete note', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { deleteNote(noteId); navigation.goBack(); } },
    ]);
  }, [noteId, deleteNote, navigation]);

  const NOTE_COLORS = [
    null, // default
    '#FEF3C7', '#FDE68A', '#FCD34D', // yellows
    '#D1FAE5', '#A7F3D0', '#6EE7B7', // greens
    '#DBEAFE', '#BFDBFE', '#93C5FD', // blues
    '#FCE7F3', '#FBCFE8', '#F9A8D4', // pinks
    '#EDE9FE', '#DDD6FE', '#C4B5FD', // purples
    '#FEE2E2', '#FECACA', '#FCA5A5', // reds
  ];

  const handleSetNoteColor = useCallback((color: string | null) => {
    setNoteColorState(color);
    if (noteId) setNoteColor(noteId, color);
    setColorPickerVisible(false);
  }, [noteId, setNoteColor]);

  const handleShare = useCallback(async () => {
    const shareText = `${title ? title + '\n\n' : ''}${plainText}`;
    try {
      await Share.share({ message: shareText, title: title || 'Note' });
    } catch (_) {}
  }, [title, plainText]);

  const aiSuggestions = useMemo(() => {
    if (!plainText.trim()) return [];
    const fakeNote = { id: noteId ?? '', title, content, plainText, folderId: null, tagIds: [], isFavorite: false, isPinned: false, color: null, category, attachments, reminderId: null, createdAt: Date.now(), updatedAt: Date.now() };
    return suggestTasksFromNote(fakeNote as any, tasks);
  }, [plainText, title, tasks, noteId, content, category, attachments]);

  const handleAddSuggestedTask = useCallback((taskTitle: string) => {
    addTask({ title: taskTitle, notes: '', completed: false, priority: 'medium', dueDate: null, reminderDate: null, repeat: 'none', subtasks: [], attachments: [], categoryId: null });
    setShowAISuggestions(false);
  }, [addTask]);

  const handleAutoCategory = useCallback(() => {
    const fakeNote = { id: noteId ?? '', title, content, plainText, folderId: null, tagIds: [], isFavorite: false, isPinned: false, color: null, category, attachments, reminderId: null, createdAt: Date.now(), updatedAt: Date.now() };
    const suggested = autoCategorizeNote(fakeNote as any);
    if (suggested !== 'none' && suggested !== 'all') setCategory(suggested);
  }, [noteId, title, content, plainText, category, attachments]);

  const categories: SmartCategory[] = ['work', 'personal', 'ideas', 'todos', 'none'];

  const CATEGORY_META: Record<SmartCategory, { emoji: string; color: string; bg: string }> = {
    all:      { emoji: '🗂️', color: '#6B7280', bg: '#6B728015' },
    work:     { emoji: '💼', color: '#3B82F6', bg: '#3B82F615' },
    personal: { emoji: '🌿', color: '#10B981', bg: '#10B98115' },
    ideas:    { emoji: '💡', color: '#F59E0B', bg: '#F59E0B15' },
    todos:    { emoji: '✅', color: '#8B5CF6', bg: '#8B5CF615' },
    none:     { emoji: '📝', color: '#6B7280',  bg: '#6B728015' },
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: theme.colors.background },

        /* ── Header ──────────────────────────────── */
        header: {
          paddingHorizontal: theme.spacing.lg,
          paddingTop: insets.top + theme.spacing.sm,
          paddingBottom: theme.spacing.md,
          backgroundColor: theme.colors.surface,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.colors.border,
        },
        headerTopRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: theme.spacing.xs,
          gap: theme.spacing.sm,
        },
        headerLeft: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
        },
        backBtn: {
          width: 36,
          height: 36,
          borderRadius: 10,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.inputBg,
        },
        headerActions: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs, flexShrink: 1 },
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
        headerIconBtn: {
          width: 36,
          height: 36,
          borderRadius: 10,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.inputBg,
        },
        headerIconBtnDisabled: { opacity: 0.25 },
        headerMeta: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          marginTop: theme.spacing.xs,
        },
        categoryBadge: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: theme.borderRadius.full,
        },
        categoryBadgeText: {
          fontSize: 12,
          fontWeight: '600',
        },
        headerDot: {
          width: 3,
          height: 3,
          borderRadius: 2,
          backgroundColor: theme.colors.textDisabled,
        },
        headerDateText: {
          ...theme.typography.caption,
          color: theme.colors.textMuted,
        },

        /* ── Scroll / cards ──────────────────────── */
        scroll: { flex: 1 },
        editorCard: {
          marginHorizontal: theme.spacing.lg,
          marginTop: theme.spacing.lg,
          borderRadius: theme.borderRadius.xl,
          backgroundColor: theme.colors.cardBg,
          overflow: 'hidden',
          ...theme.shadows.card,
        },

        /* ── Section title (like Dashboard "Features") ── */
        sectionTitle: {
          ...theme.typography.overline,
          color: theme.colors.textMuted,
          textTransform: 'uppercase',
          letterSpacing: 1,
          marginBottom: theme.spacing.sm,
          marginLeft: theme.spacing.xs,
          marginTop: theme.spacing.lg,
          marginHorizontal: theme.spacing.lg,
        },

        /* ── Meta card ───────────────────────────── */
        metaCard: {
          marginHorizontal: theme.spacing.lg,
          borderRadius: theme.borderRadius.xl,
          backgroundColor: theme.colors.cardBg,
          overflow: 'hidden',
          ...theme.shadows.card,
        },
        section: {
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.md,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.colors.border,
        },
        sectionLast: { borderBottomWidth: 0 },
        sectionHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          marginBottom: theme.spacing.sm,
        },
        sectionIconWrap: {
          width: 32,
          height: 32,
          borderRadius: 10,
          alignItems: 'center',
          justifyContent: 'center',
        },
        sectionLabel: {
          ...theme.typography.body,
          color: theme.colors.text,
          fontWeight: '600',
          flex: 1,
        },

        /* ── Category grid ───────────────────────── */
        categoryGrid: {
          flexDirection: 'row',
          gap: theme.spacing.sm,
        },
        categoryGridItem: {
          flex: 1,
          borderRadius: theme.borderRadius.lg,
          paddingVertical: 10,
          alignItems: 'center',
          gap: 4,
          borderWidth: 1.5,
          borderColor: 'transparent',
        },
        categoryGridItemSelected: {
          borderColor: theme.colors.primary,
        },
        categoryGridEmoji: { fontSize: 18 },
        categoryGridText: {
          ...theme.typography.caption,
          fontWeight: '600',
          textTransform: 'capitalize',
        },

        /* ── Tags ────────────────────────────────── */
        chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
        chip: {
          paddingHorizontal: theme.spacing.md,
          paddingVertical: 6,
          borderRadius: theme.borderRadius.full,
          backgroundColor: theme.colors.inputBg,
          borderWidth: 1.5,
          borderColor: 'transparent',
        },
        chipSelected: {
          backgroundColor: theme.colors.primaryLight,
          borderColor: theme.colors.primary,
        },
        chipText: { ...theme.typography.bodySmall, color: theme.colors.text, fontWeight: '500' },
        chipTextSelected: { color: theme.colors.primary, fontWeight: '700' },

        /* ── Reminder ────────────────────────────── */
        reminderBtn: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.xs,
          paddingVertical: 8,
          paddingHorizontal: theme.spacing.md,
          borderRadius: theme.borderRadius.full,
          backgroundColor: theme.colors.primaryLight,
          alignSelf: 'flex-start',
          marginBottom: theme.spacing.sm,
        },
        reminderBtnText: { ...theme.typography.bodySmall, color: theme.colors.primary, fontWeight: '600' },
        reminderActiveRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          paddingVertical: 10,
          paddingHorizontal: theme.spacing.md,
          borderRadius: theme.borderRadius.lg,
          backgroundColor: theme.colors.primaryLight,
        },
        reminderActiveText: { ...theme.typography.bodySmall, color: theme.colors.primary, fontWeight: '600', flex: 1 },
        reminderRemove: { ...theme.typography.caption, color: theme.colors.error, fontWeight: '700' },
        quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm, marginBottom: theme.spacing.sm },
        quickChip: {
          paddingVertical: 6,
          paddingHorizontal: theme.spacing.md,
          backgroundColor: theme.colors.inputBg,
          borderRadius: theme.borderRadius.full,
        },
        quickChipText: { ...theme.typography.bodySmall, color: theme.colors.text, fontWeight: '500' },
        repeatRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, flexWrap: 'wrap' },
        repeatLabel: { ...theme.typography.bodySmall, color: theme.colors.textMuted, fontWeight: '500' },

        bottomPad: { height: 80 },

        /* ── Attachment bottom sheet ─────────────── */
        attachOverlay: {
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.55)',
          justifyContent: 'flex-end',
        },
        attachSheet: {
          backgroundColor: theme.colors.cardBg,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          paddingBottom: insets.bottom + 12,
          paddingTop: 8,
          ...theme.shadows.card,
        },
        attachHandle: {
          width: 40,
          height: 4,
          borderRadius: 2,
          backgroundColor: theme.colors.border,
          alignSelf: 'center',
          marginBottom: 12,
        },
        attachTitle: {
          ...theme.typography.title,
          fontSize: 16,
          fontWeight: '700',
          color: theme.colors.text,
          paddingHorizontal: theme.spacing.lg,
          marginBottom: 8,
        },
        attachOption: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 14,
          paddingHorizontal: theme.spacing.lg,
          gap: theme.spacing.md,
        },
        attachOptionIcon: {
          width: 44,
          height: 44,
          borderRadius: 14,
          alignItems: 'center',
          justifyContent: 'center',
        },
        attachOptionLabel: {
          ...theme.typography.body,
          color: theme.colors.text,
          fontWeight: '500',
        },
        attachOptionDesc: {
          ...theme.typography.caption,
          color: theme.colors.textMuted,
        },
        attachCancelBtn: {
          marginHorizontal: theme.spacing.lg,
          marginTop: 8,
          paddingVertical: 14,
          borderRadius: theme.borderRadius.lg,
          backgroundColor: theme.colors.inputBg,
          alignItems: 'center',
        },
        attachCancelText: {
          ...theme.typography.body,
          color: theme.colors.text,
          fontWeight: '600',
        },
        /* ── Color picker ────────────────────────── */
        colorPickerSheet: {
          backgroundColor: theme.colors.cardBg,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          paddingBottom: insets.bottom + 16,
          paddingTop: 8,
          paddingHorizontal: theme.spacing.lg,
          ...theme.shadows.card,
        },
        colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', paddingVertical: theme.spacing.md },
        colorSwatch: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
        /* ── AI Suggestions ──────────────────────── */
        aiSuggCard: {
          marginHorizontal: theme.spacing.lg,
          borderRadius: theme.borderRadius.xl,
          backgroundColor: '#7C3AED10',
          borderWidth: 1,
          borderColor: '#7C3AED30',
          overflow: 'hidden',
          marginBottom: theme.spacing.sm,
        },
        aiSuggHeader: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, padding: theme.spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#7C3AED30' },
        aiSuggTitle: { ...theme.typography.body, color: '#7C3AED', fontWeight: '700', flex: 1 },
        aiSuggItem: { flexDirection: 'row', alignItems: 'center', padding: theme.spacing.md, gap: theme.spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#7C3AED15' },
        aiSuggItemText: { ...theme.typography.body, color: theme.colors.text, flex: 1 },
        aiSuggAddBtn: { backgroundColor: '#7C3AED20', borderRadius: theme.borderRadius.full, paddingHorizontal: theme.spacing.sm, paddingVertical: 4 },
        aiSuggAddText: { ...theme.typography.caption, color: '#7C3AED', fontWeight: '700' },
      }),
    [theme, insets.top, insets.bottom]
  );

  const catMeta = CATEGORY_META[category];

  return (
    <View style={styles.container}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity style={styles.backBtn} onPress={handleBack} hitSlop={HEADER_HIT_SLOP} activeOpacity={0.7}>
            <Icon name="back" size={22} />
          </TouchableOpacity>
          <View style={styles.headerActions}>
            <TouchableOpacity style={[styles.headerIconBtn, historyIndex <= 0 && styles.headerIconBtnDisabled]} onPress={handleUndo} hitSlop={HEADER_HIT_SLOP} activeOpacity={0.7} disabled={historyIndex <= 0}>
              <Icon name="undo" size={20} color={theme.colors.icon} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.headerIconBtn, historyIndex >= history.length - 1 && styles.headerIconBtnDisabled]} onPress={handleRedo} hitSlop={HEADER_HIT_SLOP} activeOpacity={0.7} disabled={historyIndex >= history.length - 1}>
              <Icon name="redo" size={20} color={theme.colors.icon} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerIconBtn} onPress={showAttachMenu} hitSlop={HEADER_HIT_SLOP} activeOpacity={0.7}>
              <Icon name="attach" size={20} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.headerIconBtn, noteColor ? { backgroundColor: noteColor, borderWidth: 2, borderColor: theme.colors.border } : null]} onPress={() => setColorPickerVisible(true)} hitSlop={HEADER_HIT_SLOP} activeOpacity={0.7}>
              <Ionicons name="color-palette-outline" size={20} color={noteColor ? '#1a1a2e' : theme.colors.icon} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerIconBtn} onPress={handleShare} hitSlop={HEADER_HIT_SLOP} activeOpacity={0.7}>
              <Ionicons name="share-outline" size={20} color={theme.colors.icon} />
            </TouchableOpacity>
            {!isNew && (
              <TouchableOpacity style={styles.headerIconBtn} onPress={confirmDelete} hitSlop={HEADER_HIT_SLOP} activeOpacity={0.7}>
                <Icon name="delete" size={20} color={theme.colors.error} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.85}>
            <Text style={styles.saveBtnText}>Save</Text>
          </TouchableOpacity>
        </View>

        {/* Category badge + date hint below top row */}
        <View style={styles.headerMeta}>
          <View style={[styles.categoryBadge, { backgroundColor: catMeta.bg }]}>
            <Text style={styles.categoryGridEmoji}>{catMeta.emoji}</Text>
            <Text style={[styles.categoryBadgeText, { color: catMeta.color }]}>
              {category === 'none' ? 'Note' : category.charAt(0).toUpperCase() + category.slice(1)}
            </Text>
          </View>
          <View style={styles.headerDot} />
          <Text style={styles.headerDateText}>
            {note?.updatedAt
              ? new Date(note.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
              : 'New note'}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} keyboardShouldPersistTaps="always">

        {/* ── Editor card ── */}
        <View style={styles.editorCard}>
          <RichNoteEditor
            ref={richEditorRef}
            title={title}
            content={content}
            onTitleChange={handleTitleChange}
            onContentChange={handleContentChange}
            contentRestoreKey={contentRestoreKey}
            titleVoiceActive={isListening && voiceTarget === 'title'}
            onTitleVoicePress={() => (isListening && voiceTarget === 'title' ? stopVoice() : startVoice('title'))}
            contentVoiceActive={isListening && voiceTarget === 'content'}
            onContentVoicePress={() => (isListening && voiceTarget === 'content' ? stopVoice() : startVoice('content'))}
          />
        </View>

        {/* ── Tags section ── */}
        {tags.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Tags</Text>
            <View style={styles.metaCard}>
              <View style={[styles.section, styles.sectionLast]}>
                <View style={styles.chipRow}>
                  {tags.map((t) => (
                    <TouchableOpacity key={t.id} style={[styles.chip, tagIds.includes(t.id) && styles.chipSelected]} onPress={() => toggleTag(t.id)}>
                      <Text style={[styles.chipText, tagIds.includes(t.id) && styles.chipTextSelected]}>{t.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          </>
        )}

        {/* ── AI Task Suggestions ── */}
        {aiSuggestions.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>AI Suggestions</Text>
            <View style={styles.aiSuggCard}>
              <TouchableOpacity style={styles.aiSuggHeader} onPress={() => setShowAISuggestions((v) => !v)} activeOpacity={0.8}>
                <Ionicons name="sparkles" size={16} color="#7C3AED" />
                <Text style={styles.aiSuggTitle}>{aiSuggestions.length} task{aiSuggestions.length !== 1 ? 's' : ''} found in note</Text>
                <Ionicons name={showAISuggestions ? 'chevron-up' : 'chevron-down'} size={16} color="#7C3AED" />
              </TouchableOpacity>
              {showAISuggestions && aiSuggestions.map((s, i) => (
                <View key={i} style={styles.aiSuggItem}>
                  <Ionicons name="checkbox-outline" size={16} color="#7C3AED" />
                  <Text style={styles.aiSuggItemText} numberOfLines={2}>{s}</Text>
                  <TouchableOpacity style={styles.aiSuggAddBtn} onPress={() => handleAddSuggestedTask(s)}>
                    <Text style={styles.aiSuggAddText}>+ Add</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </>
        )}

        {/* ── Category section ── */}
        <Text style={styles.sectionTitle}>Category</Text>
        <View style={styles.metaCard}>
          <View style={[styles.section, styles.sectionLast]}>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginBottom: theme.spacing.sm, backgroundColor: '#7C3AED15', paddingVertical: 4, paddingHorizontal: theme.spacing.sm, borderRadius: theme.borderRadius.full }}
              onPress={handleAutoCategory}
              activeOpacity={0.8}
            >
              <Ionicons name="sparkles" size={12} color="#7C3AED" />
              <Text style={{ ...theme.typography.caption, color: '#7C3AED', fontWeight: '700' }}>Auto-categorize</Text>
            </TouchableOpacity>
            <View style={styles.categoryGrid}>
              {categories.map((c) => {
                const m = CATEGORY_META[c];
                const selected = category === c;
                return (
                  <TouchableOpacity
                    key={c}
                    style={[styles.categoryGridItem, { backgroundColor: selected ? m.bg : theme.colors.inputBg }, selected && styles.categoryGridItemSelected, selected && { borderColor: m.color }]}
                    onPress={() => setCategory(c)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.categoryGridEmoji}>{m.emoji}</Text>
                    <Text style={[styles.categoryGridText, { color: selected ? m.color : theme.colors.textSecondary }]}>
                      {c === 'none' ? 'None' : c}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* ── Reminder section ── */}
        <Text style={styles.sectionTitle}>Reminder</Text>
        <View style={styles.metaCard}>
          <View style={[styles.section, styles.sectionLast]}>
            {reminderId || pendingReminderDate ? (
              <View>
                <View style={styles.reminderActiveRow}>
                  <View style={[styles.sectionIconWrap, { backgroundColor: theme.colors.warningLight, width: 28, height: 28 }]}>
                    <Icon name="reminder" size={14} color={theme.colors.warning} />
                  </View>
                  <Text style={styles.reminderActiveText} numberOfLines={1}>{reminderDateLabel ?? 'Reminder set'}</Text>
                  <TouchableOpacity onPress={removeReminderNote}>
                    <Text style={styles.reminderRemove}>Remove</Text>
                  </TouchableOpacity>
                </View>
                {reminderId && reminderId !== 'pending' && (
                  <>
                    <View style={[styles.quickRow, { marginTop: theme.spacing.sm }]}>
                      <Text style={[styles.repeatLabel, { marginRight: 4 }]}>Snooze:</Text>
                      {[
                        { label: '10m', minutes: 10 },
                        { label: '30m', minutes: 30 },
                        { label: '1h', minutes: 60 },
                        { label: '3h', minutes: 180 },
                      ].map((s) => (
                        <TouchableOpacity
                          key={s.label}
                          style={styles.quickChip}
                          onPress={() => snoozeReminder(reminderId, s.minutes)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.quickChipText}>{s.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <TouchableOpacity
                      style={[styles.quickRow, { marginTop: theme.spacing.sm, alignItems: 'center' }]}
                      onPress={() => setShowTunePicker(true)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="musical-notes-outline" size={16} color={theme.colors.primary} />
                      <Text style={[styles.reminderBtnText, { marginLeft: 6 }]}>Alarm sound: {tuneLabel}</Text>
                      <Ionicons name="chevron-forward" size={14} color={theme.colors.textMuted} style={{ marginLeft: 'auto' }} />
                    </TouchableOpacity>
                  </>
                )}
              </View>
            ) : (
              <>
                <View style={styles.quickRow}>
                  <TouchableOpacity style={styles.reminderBtn} onPress={addReminderTime} activeOpacity={0.8}>
                    <Icon name="calendar" size={14} color={theme.colors.primary} />
                    <Text style={styles.reminderBtnText}>Pick date & time</Text>
                  </TouchableOpacity>
                  {smartSuggestions.map((s) => (
                    <TouchableOpacity key={s.label} style={styles.quickChip} onPress={() => setSmartReminder(s.getDate)} activeOpacity={0.7}>
                      <Text style={styles.quickChipText}>{s.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.repeatRow}>
                  <Text style={styles.repeatLabel}>Repeat:</Text>
                  {(['none', 'daily', 'weekly'] as const).map((r) => (
                    <TouchableOpacity key={r} style={[styles.chip, pendingReminderRepeat === r && styles.chipSelected]} onPress={() => setPendingReminderRepeat(r)}>
                      <Text style={[styles.chipText, pendingReminderRepeat === r && styles.chipTextSelected]}>{r === 'none' ? 'Once' : r}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
          </View>
        </View>

        <AttachmentList attachments={attachments} onRemove={removeAttachment} />
        <View style={styles.bottomPad} />
      </ScrollView>

      <SketchCanvasModal
        visible={sketchModal}
        onClose={() => setSketchModal(false)}
        onSave={handleSketchSave}
      />

      {/* ── Attachment bottom sheet ── */}
      <Modal visible={attachMenuVisible} transparent animationType="slide" onRequestClose={() => setAttachMenuVisible(false)}>
        <Pressable style={styles.attachOverlay} onPress={() => setAttachMenuVisible(false)}>
          <Pressable style={styles.attachSheet} onPress={() => {}}>
            <View style={styles.attachHandle} />
            <Text style={styles.attachTitle}>Add Attachment</Text>

            {/* Gallery */}
            <TouchableOpacity style={styles.attachOption} activeOpacity={0.7} onPress={() => {
              setAttachMenuVisible(false);
              setTimeout(async () => {
                const r = await pickImageFromGallery();
                if (r) addAttachment(attachmentToNoteAttachment(r));
              }, 350);
            }}>
              <View style={[styles.attachOptionIcon, { backgroundColor: '#3B82F615' }]}>
                <Ionicons name="image-outline" size={24} color="#3B82F6" />
              </View>
              <View>
                <Text style={styles.attachOptionLabel}>Photo from Gallery</Text>
                <Text style={styles.attachOptionDesc}>Choose an existing photo</Text>
              </View>
            </TouchableOpacity>

            {/* Camera */}
            <TouchableOpacity style={styles.attachOption} activeOpacity={0.7} onPress={() => {
              setAttachMenuVisible(false);
              setTimeout(async () => {
                const r = await takePhoto();
                if (r) addAttachment(attachmentToNoteAttachment(r));
              }, 350);
            }}>
              <View style={[styles.attachOptionIcon, { backgroundColor: '#10B98115' }]}>
                <Ionicons name="camera-outline" size={24} color="#10B981" />
              </View>
              <View>
                <Text style={styles.attachOptionLabel}>Take Photo</Text>
                <Text style={styles.attachOptionDesc}>Capture with camera</Text>
              </View>
            </TouchableOpacity>

            {/* Document */}
            <TouchableOpacity style={styles.attachOption} activeOpacity={0.7} onPress={() => {
              setAttachMenuVisible(false);
              setTimeout(async () => {
                const r = await pickDocument();
                if (r) addAttachment(attachmentToNoteAttachment(r));
              }, 350);
            }}>
              <View style={[styles.attachOptionIcon, { backgroundColor: '#F59E0B15' }]}>
                <Ionicons name="document-outline" size={24} color="#F59E0B" />
              </View>
              <View>
                <Text style={styles.attachOptionLabel}>Document / PDF</Text>
                <Text style={styles.attachOptionDesc}>Attach a file from storage</Text>
              </View>
            </TouchableOpacity>

            {/* Sketch */}
            <TouchableOpacity style={styles.attachOption} activeOpacity={0.7} onPress={() => {
              setAttachMenuVisible(false);
              setTimeout(() => setSketchModal(true), 350);
            }}>
              <View style={[styles.attachOptionIcon, { backgroundColor: '#8B5CF615' }]}>
                <Ionicons name="pencil-outline" size={24} color="#8B5CF6" />
              </View>
              <View>
                <Text style={styles.attachOptionLabel}>Sketch</Text>
                <Text style={styles.attachOptionDesc}>Draw or annotate</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.attachCancelBtn} activeOpacity={0.7} onPress={() => setAttachMenuVisible(false)}>
              <Text style={styles.attachCancelText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {showDatePicker && (
        <DateTimePicker
          value={
            Platform.OS === 'android' && pickerStep === 'time' && pendingDateForTime
              ? pendingDateForTime
              : new Date(Date.now() + 3600000)
          }
          mode={Platform.OS === 'android' ? pickerStep : 'datetime'}
          display="default"
          onChange={onDatePick}
          minimumDate={new Date()}
        />
      )}

      {/* ── Color Picker Modal ── */}
      <Modal visible={colorPickerVisible} transparent animationType="slide" onRequestClose={() => setColorPickerVisible(false)}>
        <Pressable style={styles.attachOverlay} onPress={() => setColorPickerVisible(false)}>
          <Pressable style={styles.colorPickerSheet} onPress={() => {}}>
            <View style={styles.attachHandle} />
            <Text style={styles.attachTitle}>Note Color</Text>
            <View style={styles.colorGrid}>
              {NOTE_COLORS.map((c, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.colorSwatch, { backgroundColor: c ?? theme.colors.cardBg, borderColor: noteColor === c ? theme.colors.primary : theme.colors.border }]}
                  onPress={() => handleSetNoteColor(c)}
                  activeOpacity={0.8}
                >
                  {c === null && <Ionicons name="close" size={18} color={theme.colors.textMuted} />}
                  {noteColor === c && c !== null && <Ionicons name="checkmark" size={18} color="#1a1a2e" />}
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.attachCancelBtn} onPress={() => setColorPickerVisible(false)}>
              <Text style={styles.attachCancelText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

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
