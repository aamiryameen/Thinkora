import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RichNoteEditor, RichNoteEditorHandle } from '../components/RichNoteEditor';
import { AttachmentList } from '../components/AttachmentList';
import { SketchCanvasModal } from '../components/SketchCanvas';
import { Icon } from '../components/Icons';
import { VoiceInputButton } from '../components/VoiceInputButton';
import { useApp } from '../context/AppContext';
import {
  AUTO_SAVE_INTERVAL_MS,
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
    removeReminder,
    getReminder,
    tags,
    getTag,
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
  const initialEntry: HistoryEntry = {
    title: note?.title ?? '',
    content: note?.content ?? '',
    timestamp: Date.now(),
  };
  const [historyState, setHistoryState] = useState<{ history: HistoryEntry[]; index: number }>({
    history: [initialEntry],
    index: 0,
  });
  const { history, historyIndex } = historyState;
  const richEditorRef = useRef<RichNoteEditorHandle>(null);
  const isRestoringFromHistory = useRef(false);
  const [sketchModal, setSketchModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  /** On Android we use date then time (two steps) to avoid crash when dismissing mode="datetime". */
  const [pickerStep, setPickerStep] = useState<'date' | 'time'>('date');
  const [pendingDateForTime, setPendingDateForTime] = useState<Date | null>(null);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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
      navigation.goBack();
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
  ]);

  useEffect(() => {
    autoSaveTimer.current = setInterval(persistNote, AUTO_SAVE_INTERVAL_MS);
    return () => {
      if (autoSaveTimer.current) clearInterval(autoSaveTimer.current);
    };
  }, [persistNote]);

  const handleBack = useCallback(() => {
    persistNote();
    navigation.goBack();
  }, [persistNote, navigation]);

  const addAttachment = useCallback(
    (att: NoteAttachment) => setAttachments((prev) => [...prev, att]),
    []
  );

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const showAttachMenu = useCallback(() => {
    const options: Parameters<typeof Alert.alert>[2] = [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Photo from gallery',
        onPress: async () => {
          const r = await pickImageFromGallery();
          if (r) addAttachment(attachmentToNoteAttachment(r));
        },
      },
      {
        text: 'Take photo',
        onPress: async () => {
          const r = await takePhoto();
          if (r) addAttachment(attachmentToNoteAttachment(r));
        },
      },
      {
        text: 'Document / PDF',
        onPress: async () => {
          const r = await pickDocument();
          if (r) addAttachment(attachmentToNoteAttachment(r));
        },
      },
      {
        text: 'Sketch',
        onPress: () => setSketchModal(true),
      },
    ];
    Alert.alert('Add attachment', undefined, options);
  }, [addAttachment]);

  const handleSketchSave = useCallback(
    async (base64: string) => {
      const path = await saveSketchToFile(base64);
      if (path)
        addAttachment(
          attachmentToNoteAttachment({ uri: path, name: 'sketch.png', type: 'sketch' })
        );
    },
    [addAttachment]
  );


  const toggleTag = useCallback((tagId: string) => {
    setTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  }, []);

  const addReminderTime = useCallback(() => {
    setShowDatePicker(true);
    if (Platform.OS === 'android') {
      setPickerStep('date');
      setPendingDateForTime(null);
    }
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
        if (pickerStep === 'date') {
          if (isDismissed) {
            setShowDatePicker(false);
            setPickerStep('date');
            setPendingDateForTime(null);
            return;
          }
          if (date) {
            setPendingDateForTime(date);
            setPickerStep('time');
          }
          return;
        }
        if (pickerStep === 'time') {
          setShowDatePicker(false);
          setPickerStep('date');
          setPendingDateForTime(null);
          if (!isDismissed && date) await saveReminderWithTimestamp(date.getTime());
          return;
        }
      }
      setShowDatePicker(false);
      if (isDismissed) return;
      if (date) await saveReminderWithTimestamp(date.getTime());
    },
    [pickerStep, saveReminderWithTimestamp]
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

  const categories: SmartCategory[] = ['work', 'personal', 'ideas', 'todos', 'none'];

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: theme.colors.surface },
        header: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: theme.spacing.lg,
          paddingTop: insets.top + theme.spacing.sm,
          paddingBottom: theme.spacing.md,
          backgroundColor: theme.colors.surfaceElevated,
          borderBottomWidth: 2,
          borderBottomColor: theme.colors.border,
        },
        headerActions: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
        scroll: { flex: 1 },
        section: {
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.md,
        },
        sectionLabel: {
          ...theme.typography.overline,
          color: theme.colors.textMuted,
          textTransform: 'uppercase',
          letterSpacing: 1,
          marginBottom: theme.spacing.sm,
        },
        tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
        tagChip: {
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: 8,
          borderRadius: theme.borderRadius.full,
          backgroundColor: theme.colors.inputBg,
          borderWidth: 2,
          borderColor: 'transparent',
        },
        tagChipSelected: {
          backgroundColor: theme.colors.primary,
          borderColor: theme.colors.primaryDark,
        },
        tagText: { ...theme.typography.bodySmall, color: theme.colors.text, fontWeight: '500' },
        tagTextSelected: { color: theme.colors.surface },
        reminderText: {
          ...theme.typography.bodySmall,
          color: theme.colors.primary,
          fontWeight: '600',
        },
        reminderSubtext: {
          ...theme.typography.caption,
          color: theme.colors.textMuted,
          marginTop: theme.spacing.xxs,
        },
        smartRow: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          marginTop: theme.spacing.sm,
          gap: theme.spacing.sm,
        },
        smartChip: {
          paddingVertical: 8,
          paddingHorizontal: theme.spacing.lg,
          backgroundColor: theme.colors.primaryLight,
          borderRadius: theme.borderRadius.full,
        },
        smartChipText: { ...theme.typography.caption, color: theme.colors.primaryDark, fontWeight: '600' },
        repeatRow: {
          flexDirection: 'row',
          alignItems: 'center',
          marginTop: theme.spacing.sm,
          flexWrap: 'wrap',
          gap: theme.spacing.sm,
        },
        repeatLabel: {
          ...theme.typography.bodySmall,
          color: theme.colors.textSecondary,
        },
        repeatChip: {
          paddingVertical: theme.spacing.xs,
          paddingHorizontal: theme.spacing.md,
          borderRadius: theme.borderRadius.lg,
          backgroundColor: theme.colors.inputBg,
        },
      }),
    [theme, insets.top]
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleBack}
          hitSlop={HEADER_HIT_SLOP}
          accessibilityLabel="Go back"
          activeOpacity={0.7}
        >
          <Icon name="back" size={28} />
        </TouchableOpacity>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={handleUndo}
            hitSlop={HEADER_HIT_SLOP}
            accessibilityLabel="Undo"
            activeOpacity={0.7}
            disabled={historyIndex <= 0}
          >
            <Icon name="undo" size={22} color={historyIndex <= 0 ? theme.colors.textDisabled : theme.colors.icon} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleRedo}
            hitSlop={HEADER_HIT_SLOP}
            accessibilityLabel="Redo"
            activeOpacity={0.7}
            disabled={historyIndex >= history.length - 1}
          >
            <Icon name="redo" size={22} color={historyIndex >= history.length - 1 ? theme.colors.textDisabled : theme.colors.icon} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={showAttachMenu}
            hitSlop={HEADER_HIT_SLOP}
            accessibilityLabel="Add attachment"
            activeOpacity={0.7}
          >
            <Icon name="attach" size={22} />
          </TouchableOpacity>
          <VoiceInputButton
            size={34}
            onResult={(text) => {
              if (!title.trim()) {
                handleTitleChange(text);
              } else {
                richEditorRef.current?.insertText(' ' + text);
                const newContent = content ? `${content} ${text}` : `<p>${text}</p>`;
                const newPlain = plainText ? `${plainText} ${text}` : text;
                handleContentChange(newContent, newPlain);
              }
            }}
          />
          {!isNew && (
            <TouchableOpacity
              onPress={confirmDelete}
              hitSlop={HEADER_HIT_SLOP}
              accessibilityLabel="Delete note"
              activeOpacity={0.7}
            >
              <Icon name="delete" size={22} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
        <RichNoteEditor
          ref={richEditorRef}
          title={title}
          content={content}
          onTitleChange={handleTitleChange}
          onContentChange={handleContentChange}
          contentRestoreKey={contentRestoreKey}
        />

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Tags</Text>
          <View style={styles.tagRow}>
            {tags.map((t) => (
              <TouchableOpacity
                key={t.id}
                style={[styles.tagChip, tagIds.includes(t.id) && styles.tagChipSelected]}
                onPress={() => toggleTag(t.id)}
              >
                <Text style={[styles.tagText, tagIds.includes(t.id) && styles.tagTextSelected]}>{t.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Category</Text>
          <View style={styles.tagRow}>
            {categories.map((c) => (
              <TouchableOpacity
                key={c}
                style={[styles.tagChip, category === c && styles.tagChipSelected]}
                onPress={() => setCategory(c)}
              >
                <Text style={[styles.tagText, category === c && styles.tagTextSelected]}>{c === 'none' ? 'None' : c}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Reminder</Text>
          {reminderId || pendingReminderDate ? (
            <TouchableOpacity onPress={removeReminderNote}>
              <Text style={styles.reminderText}>
                <Icon name="reminder" size={16} />{' '}
                {reminderDateLabel ?? 'Set – tap to remove'}
              </Text>
              {reminderDateLabel != null && (
                <Text style={styles.reminderSubtext}>Tap to remove</Text>
              )}
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity onPress={addReminderTime}>
                <Text style={styles.reminderText}><Icon name="reminder" size={16} /> Pick date & time</Text>
              </TouchableOpacity>
              <View style={styles.smartRow}>
                {smartSuggestions.map((s) => (
                  <TouchableOpacity
                    key={s.label}
                    style={styles.smartChip}
                    onPress={() => setSmartReminder(s.getDate)}
                  >
                    <Text style={styles.smartChipText}>{s.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.repeatRow}>
                <Text style={styles.repeatLabel}>Repeat: </Text>
                {(['none', 'daily', 'weekly'] as const).map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.repeatChip, pendingReminderRepeat === r && styles.tagChipSelected]}
                    onPress={() => setPendingReminderRepeat(r)}
                  >
                    <Text style={[styles.tagText, pendingReminderRepeat === r && styles.tagTextSelected]}>{r === 'none' ? 'Once' : r}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
        </View>

        <AttachmentList
          attachments={attachments}
          onRemove={removeAttachment}
        />
      </ScrollView>

      <SketchCanvasModal
        visible={sketchModal}
        onClose={() => setSketchModal(false)}
        onSave={handleSketchSave}
      />

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

    </View>
  );
}
