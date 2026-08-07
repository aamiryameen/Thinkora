/**
 * DailyPlannerScreen — the Daily Planner module's home.
 *
 * Free: today's timeline, morning planning (focus + top 3), drag & drop
 * scheduling, time blocking with reminders, daily goals, daily notes,
 * progress overview, quick add. Everything reads and writes locally, so the
 * whole screen works offline.
 *
 * Premium entry points (weekly, templates, auto-block, optimize, analytics,
 * export, themes) live in the header menu and show the upgrade sheet when the
 * entitlement is missing.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Dimensions, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { PlannerBlockSheet, type BlockDraft } from '../components/PlannerBlockSheet';
import {
  PlannerQuickAddSheet, type QuickAddMode, type QuickAddPayload,
} from '../components/PlannerQuickAddSheet';
import { PlannerTimeline, HOUR_HEIGHT } from '../components/PlannerTimeline';
import { PremiumGateSheet } from '../components/PremiumGateSheet';
import { resolvePlannerTheme } from '../core/plannerThemes';
import { useApp } from '../context/AppContext';
import { useFeatures } from '../context/FeaturesContext';
import { usePlanner } from '../context/PlannerContext';
import { useTheme } from '../context/ThemeContext';
import { exportDayPlan } from '../services/plannerExportService';
import { BLOCK_KIND_COLORS } from '../services/plannerScheduleService';
import {
  formatDuration, formatMinutes, fromDateKey, timestampFor, todayKey,
} from '../services/plannerService';
import { usePremium, type PremiumFeature } from '../services/premiumService';
import type { RootStackParamList } from '../navigation/types';
import type { TimelineItem } from '../types/planner';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

function dayLabel(dateKey: string): string {
  const today = todayKey();
  if (dateKey === today) return 'Today';
  const date = fromDateKey(dateKey);
  const diff = Math.round((date.getTime() - fromDateKey(today).getTime()) / 86_400_000);
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return date.toLocaleDateString(undefined, { weekday: 'long' });
}

function fullDate(dateKey: string): string {
  return fromDateKey(dateKey).toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
}

export function DailyPlannerScreen() {
  const navigation = useNavigation<Nav>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { tasks, addTask, addNote, toggleTaskComplete } = useApp();
  const { addHabit, habits } = useFeatures();
  const { hasPremium } = usePremium();
  const planner = usePlanner();

  const {
    selectedDate, shiftDay, goToToday, isToday, day, blocks, timeline, progress, prefs,
    setFocus, addPriority, togglePriority, removePriority,
    addDailyGoal, toggleDailyGoal, removeDailyGoal, setNotes, needsPlanning,
    addBlock, editBlock, moveBlock, resizeBlock, toggleBlockComplete,
    removeBlock, clearDay, suggestNextSlot, runAutoSchedule, runOptimize,
  } = planner;

  const plannerTheme = useMemo(
    () => resolvePlannerTheme(prefs.themeId, hasPremium),
    [hasPremium, prefs.themeId]
  );

  // ── Local UI state ──
  const [blockSheetOpen, setBlockSheetOpen] = useState(false);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [newBlockStart, setNewBlockStart] = useState(9 * 60);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddMode, setQuickAddMode] = useState<QuickAddMode>('task');
  const [gateFeature, setGateFeature] = useState<PremiumFeature | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // Draft text inputs — committed on blur/submit so we don't write per keystroke.
  const [focusDraft, setFocusDraft] = useState(day.focus);
  const [notesDraft, setNotesDraft] = useState(day.notes);
  const [priorityDraft, setPriorityDraft] = useState('');
  const [goalDraft, setGoalDraft] = useState('');

  // Re-seed the drafts when the day changes underneath us.
  useEffect(() => { setFocusDraft(day.focus); }, [day.date, day.focus]);
  useEffect(() => { setNotesDraft(day.notes); }, [day.date, day.notes]);

  const scrollRef = useRef<ScrollView>(null);
  const didAutoScrollRef = useRef(false);

  // Scroll the timeline to "now" (or the work-day start) the first time it renders.
  useEffect(() => {
    if (didAutoScrollRef.current) return;
    const now = new Date();
    const anchorHour = isToday ? now.getHours() : prefs.workStartHour;
    const offset = Math.max(0, (anchorHour - prefs.dayStartHour - 1) * HOUR_HEIGHT);
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: offset, animated: false });
      didAutoScrollRef.current = true;
    }, 220);
    return () => clearTimeout(timer);
  }, [isToday, prefs.dayStartHour, prefs.workStartHour]);

  const editingBlock = useMemo(
    () => blocks.find(b => b.id === editingBlockId) ?? null,
    [blocks, editingBlockId]
  );

  const openTasks = useMemo(() => tasks.filter(t => !t.completed), [tasks]);
  const priorityFull = day.topPriorities.length >= 3;

  // ── Premium gate helper ──
  const requirePremium = useCallback((feature: PremiumFeature, run: () => void) => {
    if (hasPremium) { run(); return; }
    setGateFeature(feature);
  }, [hasPremium]);

  // ── Block handlers ──

  const handleItemPress = useCallback((item: TimelineItem) => {
    if (item.block) {
      setEditingBlockId(item.block.id);
      setBlockSheetOpen(true);
      return;
    }
    // Ghost row — offer to turn it into a real block so it becomes editable.
    if (item.taskId) {
      Alert.alert(item.title, 'This task has a due time but no time block yet.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open task', onPress: () => navigation.navigate('TaskEditor', { taskId: item.taskId! }) },
        {
          text: 'Block time',
          onPress: () => {
            addBlock({
              title: item.title,
              kind: 'task',
              startMinutes: item.startMinutes,
              durationMinutes: item.durationMinutes,
              color: BLOCK_KIND_COLORS.task,
              notes: '',
              taskId: item.taskId,
              habitId: null,
              reminderMinutesBefore: prefs.defaultReminderMinutes,
            });
          },
        },
      ]);
      return;
    }
    if (item.habitId) {
      navigation.navigate('HabitTracker');
    }
  }, [addBlock, navigation, prefs.defaultReminderMinutes]);

  const handleItemToggle = useCallback((item: TimelineItem) => {
    if (item.block) { toggleBlockComplete(item.block.id); return; }
    if (item.taskId) { toggleTaskComplete(item.taskId); return; }
    if (item.habitId) { navigation.navigate('HabitTracker'); }
  }, [navigation, toggleBlockComplete, toggleTaskComplete]);

  const handleItemMove = useCallback((item: TimelineItem, startMinutes: number) => {
    if (item.block) moveBlock(item.block.id, startMinutes);
  }, [moveBlock]);

  const handleItemResize = useCallback((item: TimelineItem, durationMinutes: number) => {
    if (item.block) resizeBlock(item.block.id, durationMinutes);
  }, [resizeBlock]);

  const handleEmptySlot = useCallback((startMinutes: number) => {
    setEditingBlockId(null);
    setNewBlockStart(startMinutes);
    setBlockSheetOpen(true);
  }, []);

  const handleBlockSave = useCallback(async (draft: BlockDraft) => {
    if (editingBlock) {
      await editBlock(editingBlock.id, draft);
    } else {
      await addBlock({ ...draft, habitId: null });
    }
    setEditingBlockId(null);
  }, [addBlock, editBlock, editingBlock]);

  // ── Quick add ──

  const openQuickAdd = useCallback((mode: QuickAddMode) => {
    setQuickAddMode(mode);
    setQuickAddOpen(true);
  }, []);

  const handleQuickAdd = useCallback(async (payload: QuickAddPayload) => {
    const { mode, title, startMinutes, durationMinutes, scheduleBlock, makePriority } = payload;

    switch (mode) {
      case 'task': {
        const created = addTask({
          title,
          completed: false,
          categoryId: null,
          // Due at the scheduled time when blocking, otherwise due today.
          dueDate: timestampFor(selectedDate, scheduleBlock ? startMinutes : 0),
          reminderDate: null,
          repeat: 'none',
          notes: '',
          attachments: [],
          subtasks: [],
          priority: makePriority ? 'high' : 'none',
        });
        if (scheduleBlock) {
          await addBlock({
            title,
            kind: 'task',
            startMinutes,
            durationMinutes,
            color: BLOCK_KIND_COLORS.task,
            notes: '',
            taskId: created.id,
            habitId: null,
            reminderMinutesBefore: prefs.defaultReminderMinutes,
          });
        }
        if (makePriority) await addPriority(title, created.id);
        break;
      }

      case 'event': {
        await addBlock({
          title,
          kind: 'event',
          startMinutes,
          durationMinutes,
          color: BLOCK_KIND_COLORS.event,
          notes: '',
          taskId: null,
          habitId: null,
          reminderMinutesBefore: prefs.defaultReminderMinutes,
        });
        break;
      }

      case 'note': {
        const note = addNote({
          title,
          content: '',
          plainText: '',
          folderId: null,
          tagIds: [],
          isFavorite: false,
          isPinned: false,
          color: null,
          category: 'none',
          attachments: [],
          reminderId: null,
        });
        Alert.alert('Note created', `"${title}" was added to your notes.`, [
          { text: 'Later', style: 'cancel' },
          { text: 'Open', onPress: () => navigation.navigate('NoteEditor', { noteId: note.id }) },
        ]);
        break;
      }

      case 'habit': {
        addHabit({
          name: title,
          icon: 'flame-outline',
          color: BLOCK_KIND_COLORS.habit,
          frequency: 'daily',
          targetDays: [],
          reminderTime: null,
        });
        break;
      }

      case 'goal': {
        await addDailyGoal(title);
        break;
      }
    }
  }, [
    addBlock, addDailyGoal, addHabit, addNote, addPriority, addTask,
    navigation, prefs.defaultReminderMinutes, selectedDate,
  ]);

  // ── Premium actions ──

  const doAutoSchedule = useCallback(async () => {
    const result = await runAutoSchedule();
    if (result.placements.length === 0) {
      Alert.alert(
        'Nothing to schedule',
        result.unplaced.length > 0
          ? `No free slot inside your working hours (${prefs.workStartHour}:00–${prefs.workEndHour}:00) is long enough. Free up time or widen your working hours in planner settings.`
          : 'Every task due today already has time blocked, or there are no tasks due today.'
      );
      return;
    }
    const skipped = result.unplaced.length > 0
      ? `\n\n${result.unplaced.length} task${result.unplaced.length > 1 ? 's' : ''} didn't fit and ${result.unplaced.length > 1 ? 'were' : 'was'} left unscheduled.`
      : '';
    Alert.alert(
      'Time blocked',
      `Scheduled ${result.placements.length} task${result.placements.length > 1 ? 's' : ''} into your free time.${skipped}`
    );
  }, [prefs.workEndHour, prefs.workStartHour, runAutoSchedule]);

  const doOptimize = useCallback(async () => {
    const preview = await runOptimize({ apply: false });
    if (preview.moves.length === 0) {
      Alert.alert('Already optimized', 'Your schedule is already in a good order for today.');
      return;
    }
    const summary = preview.moves
      .slice(0, 5)
      .map(m => `• ${m.title}: ${formatMinutes(m.fromMinutes)} → ${formatMinutes(m.toMinutes)}`)
      .join('\n');
    const more = preview.moves.length > 5 ? `\n…and ${preview.moves.length - 5} more` : '';
    Alert.alert(
      'Reorganize your day?',
      `${preview.moves.length} block${preview.moves.length > 1 ? 's' : ''} would move. Locked, completed and past blocks stay put.\n\n${summary}${more}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Apply',
          onPress: async () => {
            const applied = await runOptimize({ apply: true });
            Alert.alert('Schedule optimized', `Moved ${applied.moves.length} block${applied.moves.length === 1 ? '' : 's'}.`);
          },
        },
      ]
    );
  }, [runOptimize]);

  const doExport = useCallback(async () => {
    await exportDayPlan({
      date: selectedDate,
      day,
      blocks,
      tasks: openTasks,
      habits,
    });
  }, [blocks, day, habits, openTasks, selectedDate]);

  const confirmClearDay = useCallback(() => {
    if (blocks.length === 0) { Alert.alert('Nothing to clear', 'This day has no time blocks.'); return; }
    Alert.alert(
      'Clear the schedule?',
      `This removes all ${blocks.length} time block${blocks.length === 1 ? '' : 's'} for ${dayLabel(selectedDate).toLowerCase()} and cancels their reminders. Your tasks, goals and notes are kept.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear blocks', style: 'destructive', onPress: () => clearDay() },
      ]
    );
  }, [blocks.length, clearDay, selectedDate]);

  // ── Styles ──

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    header: {
      paddingTop: insets.top + theme.spacing.sm,
      paddingBottom: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      backgroundColor: plannerTheme.headerGradient[0],
      borderBottomLeftRadius: 22,
      borderBottomRightRadius: 22,
    },
    headerTop: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
    headerTitle: {
      ...theme.typography.title, fontSize: 21, fontWeight: '800',
      color: plannerTheme.headerText, flex: 1,
    },
    iconBtn: {
      width: 36, height: 36, borderRadius: 12,
      backgroundColor: plannerTheme.headerText + '22',
      alignItems: 'center', justifyContent: 'center',
    },
    dateRow: {
      flexDirection: 'row', alignItems: 'center',
      marginTop: theme.spacing.md, gap: theme.spacing.sm,
    },
    dateNavBtn: {
      width: 34, height: 34, borderRadius: 17,
      backgroundColor: plannerTheme.headerText + '1F',
      alignItems: 'center', justifyContent: 'center',
    },
    dateCenter: { flex: 1, alignItems: 'center' },
    dateLabel: { fontSize: 16, fontWeight: '800', color: plannerTheme.headerText },
    dateSub: { fontSize: 11.5, color: plannerTheme.headerText + 'B0', marginTop: 1 },
    todayChip: {
      paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999,
      backgroundColor: plannerTheme.headerText + '2A',
    },
    todayChipText: { fontSize: 11, fontWeight: '800', color: plannerTheme.headerText },

    // Progress
    progressWrap: { marginTop: theme.spacing.md, gap: 7 },
    progressTrack: {
      height: 7, borderRadius: 4,
      backgroundColor: plannerTheme.headerText + '2A', overflow: 'hidden',
    },
    progressFill: { height: 7, borderRadius: 4, backgroundColor: plannerTheme.headerText },
    progressRow: { flexDirection: 'row', justifyContent: 'space-between' },
    progressText: { fontSize: 11.5, fontWeight: '700', color: plannerTheme.headerText + 'DD' },

    // Scroll body
    scroll: { flex: 1 },
    scrollContent: { paddingBottom: 150 },
    section: {
      marginHorizontal: theme.spacing.lg,
      marginTop: theme.spacing.lg,
      backgroundColor: theme.colors.cardBg,
      borderRadius: theme.borderRadius.xl,
      padding: theme.spacing.lg,
      ...theme.shadows.card,
    },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.sm },
    sectionTitle: { ...theme.typography.titleSmall, fontSize: 15, fontWeight: '800', color: theme.colors.text, flex: 1 },
    sectionCount: { ...theme.typography.caption, color: theme.colors.textMuted, fontWeight: '600' },

    focusInput: {
      backgroundColor: theme.colors.inputBg,
      borderRadius: theme.borderRadius.md,
      paddingHorizontal: 14, paddingVertical: 13,
      ...theme.typography.body, color: theme.colors.text,
    },

    rowItem: {
      flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.borderSubtle,
    },
    checkbox: {
      width: 24, height: 24, borderRadius: 8, borderWidth: 2,
      alignItems: 'center', justifyContent: 'center',
    },
    rowText: { ...theme.typography.bodySmall, color: theme.colors.text, flex: 1, fontWeight: '500' },
    rowTextDone: { color: theme.colors.textMuted, textDecorationLine: 'line-through' },
    rankBadge: {
      width: 20, height: 20, borderRadius: 6,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: theme.colors.accent + '22',
    },
    rankText: { fontSize: 10.5, fontWeight: '800', color: theme.colors.accent },

    addRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginTop: theme.spacing.sm },
    addInput: {
      flex: 1, backgroundColor: theme.colors.inputBg,
      borderRadius: theme.borderRadius.md,
      paddingHorizontal: 12, paddingVertical: 10,
      ...theme.typography.bodySmall, color: theme.colors.text,
    },
    addBtn: {
      width: 38, height: 38, borderRadius: 12,
      backgroundColor: theme.colors.primary,
      alignItems: 'center', justifyContent: 'center',
    },
    emptyHint: { ...theme.typography.caption, color: theme.colors.textMuted, paddingVertical: 6, lineHeight: 18 },

    notesInput: {
      backgroundColor: theme.colors.inputBg,
      borderRadius: theme.borderRadius.md,
      padding: 14, minHeight: 110, textAlignVertical: 'top',
      ...theme.typography.bodySmall, color: theme.colors.text, lineHeight: 20,
    },

    // Stats strip
    statsRow: { flexDirection: 'row', gap: theme.spacing.sm, marginHorizontal: theme.spacing.lg, marginTop: theme.spacing.lg },
    statCard: {
      flex: 1, backgroundColor: theme.colors.cardBg,
      borderRadius: theme.borderRadius.lg,
      paddingVertical: theme.spacing.md, alignItems: 'center', gap: 2,
      ...theme.shadows.subtle,
    },
    statNum: { fontSize: 17, fontWeight: '800', color: theme.colors.text },
    statLabel: { fontSize: 10, color: theme.colors.textMuted, fontWeight: '600', textTransform: 'uppercase' },

    // Timeline
    timelineCard: {
      marginHorizontal: theme.spacing.lg, marginTop: theme.spacing.lg,
      backgroundColor: theme.colors.cardBg,
      borderRadius: theme.borderRadius.xl,
      paddingVertical: theme.spacing.md,
      overflow: 'hidden',
      ...theme.shadows.card,
    },
    timelineHeader: {
      flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.lg, marginBottom: theme.spacing.sm,
    },

    // Planning prompt
    prompt: {
      marginHorizontal: theme.spacing.lg, marginTop: theme.spacing.lg,
      borderRadius: theme.borderRadius.xl, padding: theme.spacing.lg,
      backgroundColor: theme.colors.primaryLight,
      borderWidth: 1.5, borderColor: theme.colors.primary + '40',
      gap: theme.spacing.sm,
    },
    promptTitle: { ...theme.typography.titleSmall, fontSize: 15, fontWeight: '800', color: theme.colors.primary },
    promptText: { ...theme.typography.bodySmall, color: theme.colors.textSecondary, lineHeight: 19 },
    promptBtn: {
      alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 16, paddingVertical: 10,
      borderRadius: theme.borderRadius.full, marginTop: 2,
    },
    promptBtnText: { ...theme.typography.caption, fontWeight: '800', color: '#FFF' },

    // Menu
    menuOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 90 },
    menu: {
      position: 'absolute',
      top: insets.top + 46, right: theme.spacing.lg,
      backgroundColor: theme.colors.surfaceElevated,
      borderRadius: theme.borderRadius.lg,
      paddingVertical: 6, minWidth: 232,
      ...theme.shadows.elevated,
      zIndex: 91,
    },
    menuItem: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, paddingHorizontal: 14, paddingVertical: 11 },
    menuLabel: { ...theme.typography.bodySmall, color: theme.colors.text, flex: 1, fontWeight: '500' },
    menuDivider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border, marginVertical: 4 },
    proTag: {
      paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5,
      backgroundColor: theme.colors.accent + '22',
    },
    proTagText: { fontSize: 9, fontWeight: '800', color: theme.colors.accent, letterSpacing: 0.4 },

    // FABs
    fabRow: { position: 'absolute', right: theme.spacing.lg, bottom: insets.bottom + 22, gap: 10, alignItems: 'flex-end' },
    fabSmall: {
      width: 46, height: 46, borderRadius: 15,
      backgroundColor: theme.colors.surfaceElevated,
      alignItems: 'center', justifyContent: 'center',
      ...theme.shadows.elevated,
    },
    fab: {
      flexDirection: 'row', alignItems: 'center', gap: 7,
      paddingHorizontal: 18, height: 54, borderRadius: 18,
      backgroundColor: theme.colors.primary,
      ...theme.shadows.fab,
    },
    fabText: { ...theme.typography.button, fontWeight: '800', color: '#FFF' },
  }), [insets, plannerTheme, theme]);

  // ── Menu items ──
  const menuItems = useMemo(() => ([
    {
      icon: 'calendar-number-outline', label: 'Weekly planner', pro: true,
      run: () => requirePremium('planner_weekly', () => navigation.navigate('WeeklyPlanner')),
    },
    {
      icon: 'albums-outline', label: 'Planner templates', pro: true,
      run: () => requirePremium('planner_templates', () => navigation.navigate('PlannerTemplates')),
    },
    {
      icon: 'flash-outline', label: 'Auto-block my tasks', pro: true,
      run: () => requirePremium('planner_auto_blocking', doAutoSchedule),
    },
    {
      icon: 'sparkles-outline', label: 'Optimize schedule', pro: true,
      run: () => requirePremium('planner_optimize', doOptimize),
    },
    {
      icon: 'stats-chart-outline', label: 'Planner analytics', pro: true,
      run: () => requirePremium('planner_analytics', () => navigation.navigate('PlannerAnalytics')),
    },
    {
      icon: 'print-outline', label: 'Export / print day', pro: true,
      run: () => requirePremium('planner_export', doExport),
    },
    { divider: true as const },
    {
      icon: 'options-outline', label: 'Planner settings', pro: false,
      run: () => navigation.navigate('PlannerSettings'),
    },
    {
      icon: 'trash-outline', label: 'Clear schedule', pro: false,
      run: confirmClearDay,
    },
  ]), [confirmClearDay, doAutoSchedule, doExport, doOptimize, navigation, requirePremium]);

  const suggestedSlot = suggestNextSlot(60) ?? prefs.workStartHour * 60;

  return (
    <View style={styles.container}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.iconBtn}>
            <Ionicons name="arrow-back" size={20} color={plannerTheme.headerText} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Daily Planner</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('PlannerAnalytics')}
            hitSlop={8}
            style={styles.iconBtn}
          >
            <Ionicons name="stats-chart-outline" size={18} color={plannerTheme.headerText} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setMenuOpen(true)} hitSlop={8} style={styles.iconBtn}>
            <Ionicons name="ellipsis-vertical" size={18} color={plannerTheme.headerText} />
          </TouchableOpacity>
        </View>

        <View style={styles.dateRow}>
          <TouchableOpacity style={styles.dateNavBtn} onPress={() => shiftDay(-1)} hitSlop={6}>
            <Ionicons name="chevron-back" size={18} color={plannerTheme.headerText} />
          </TouchableOpacity>
          <View style={styles.dateCenter}>
            <Text style={styles.dateLabel}>{dayLabel(selectedDate)}</Text>
            <Text style={styles.dateSub}>{fullDate(selectedDate)}</Text>
          </View>
          {!isToday && (
            <TouchableOpacity style={styles.todayChip} onPress={goToToday}>
              <Text style={styles.todayChipText}>TODAY</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.dateNavBtn} onPress={() => shiftDay(1)} hitSlop={6}>
            <Ionicons name="chevron-forward" size={18} color={plannerTheme.headerText} />
          </TouchableOpacity>
        </View>

        {/* Progress overview */}
        <View style={styles.progressWrap}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress.overallPct}%` }]} />
          </View>
          <View style={styles.progressRow}>
            <Text style={styles.progressText}>{progress.overallPct}% of today's plan done</Text>
            <Text style={styles.progressText}>
              {formatDuration(progress.completedMinutes)} / {formatDuration(progress.plannedMinutes)}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Morning planning prompt ── */}
        {needsPlanning && (
          <View style={styles.prompt}>
            <Text style={styles.promptTitle}>
              {new Date().getHours() < 12 ? '☀️ Plan your day' : '🗓️ Nothing planned yet'}
            </Text>
            <Text style={styles.promptText}>
              Set one focus, pick your top three, and block time for them. Two minutes now saves an
              hour of drifting later.
            </Text>
            <TouchableOpacity
              style={styles.promptBtn}
              onPress={() => navigation.navigate('MorningPlanning')}
              activeOpacity={0.85}
            >
              <Ionicons name="sunny-outline" size={15} color="#FFF" />
              <Text style={styles.promptBtnText}>Start morning planning</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Stats strip ── */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{progress.blocksDone}/{progress.blocksTotal}</Text>
            <Text style={styles.statLabel}>Blocks</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{progress.prioritiesDone}/{progress.prioritiesTotal}</Text>
            <Text style={styles.statLabel}>Top 3</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{progress.goalsDone}/{progress.goalsTotal}</Text>
            <Text style={styles.statLabel}>Goals</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{formatDuration(progress.plannedMinutes)}</Text>
            <Text style={styles.statLabel}>Planned</Text>
          </View>
        </View>

        {/* ── Today's focus ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="compass-outline" size={17} color={theme.colors.primary} />
            <Text style={styles.sectionTitle}>Today's Focus</Text>
          </View>
          <TextInput
            style={styles.focusInput}
            value={focusDraft}
            onChangeText={setFocusDraft}
            onBlur={() => { if (focusDraft !== day.focus) setFocus(focusDraft); }}
            onSubmitEditing={() => { if (focusDraft !== day.focus) setFocus(focusDraft); }}
            placeholder="If I do one thing today, it's…"
            placeholderTextColor={theme.colors.textMuted}
            returnKeyType="done"
          />
        </View>

        {/* ── Top 3 priorities ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="flag-outline" size={17} color={theme.colors.accent} />
            <Text style={styles.sectionTitle}>Top 3 Priorities</Text>
            <Text style={styles.sectionCount}>{day.topPriorities.length}/3</Text>
          </View>

          {day.topPriorities.length === 0 && (
            <Text style={styles.emptyHint}>
              Pick at most three things that would make today a win.
            </Text>
          )}

          {day.topPriorities.map((p, i) => (
            <View key={p.id} style={styles.rowItem}>
              <View style={styles.rankBadge}><Text style={styles.rankText}>{i + 1}</Text></View>
              <TouchableOpacity
                style={[styles.checkbox, {
                  borderColor: p.completed ? theme.colors.success : theme.colors.border,
                  backgroundColor: p.completed ? theme.colors.success : 'transparent',
                }]}
                onPress={() => togglePriority(p.id)}
              >
                {p.completed && <Ionicons name="checkmark" size={15} color="#FFF" />}
              </TouchableOpacity>
              <Text style={[styles.rowText, p.completed && styles.rowTextDone]} numberOfLines={2}>
                {p.title}
              </Text>
              {p.taskId && <Ionicons name="link-outline" size={14} color={theme.colors.textMuted} />}
              <TouchableOpacity onPress={() => removePriority(p.id)} hitSlop={8}>
                <Ionicons name="close" size={17} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>
          ))}

          {!priorityFull && (
            <View style={styles.addRow}>
              <TextInput
                style={styles.addInput}
                value={priorityDraft}
                onChangeText={setPriorityDraft}
                placeholder="Add a priority…"
                placeholderTextColor={theme.colors.textMuted}
                returnKeyType="done"
                onSubmitEditing={() => { addPriority(priorityDraft); setPriorityDraft(''); }}
              />
              <TouchableOpacity
                style={styles.addBtn}
                onPress={() => { addPriority(priorityDraft); setPriorityDraft(''); }}
              >
                <Ionicons name="add" size={21} color="#FFF" />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ── Timeline ── */}
        <View style={styles.timelineCard}>
          <View style={styles.timelineHeader}>
            <Ionicons name="time-outline" size={17} color={theme.colors.primary} />
            <Text style={styles.sectionTitle}>Timeline</Text>
            <Text style={styles.sectionCount}>
              {prefs.dayStartHour % 12 || 12}{prefs.dayStartHour < 12 ? 'am' : 'pm'} – {prefs.dayEndHour % 12 || 12}{prefs.dayEndHour < 12 || prefs.dayEndHour === 24 ? 'am' : 'pm'}
            </Text>
          </View>
          <PlannerTimeline
            items={timeline}
            dayStartHour={prefs.dayStartHour}
            dayEndHour={prefs.dayEndHour}
            plannerTheme={plannerTheme}
            showNowLine={isToday}
            width={SCREEN_WIDTH - theme.spacing.lg * 2}
            onItemPress={handleItemPress}
            onItemToggle={handleItemToggle}
            onItemMove={handleItemMove}
            onItemResize={handleItemResize}
            onEmptySlotPress={handleEmptySlot}
          />
        </View>

        {/* ── Daily goals ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="trophy-outline" size={17} color={theme.colors.success} />
            <Text style={styles.sectionTitle}>Daily Goals</Text>
            <Text style={styles.sectionCount}>{progress.goalsDone}/{progress.goalsTotal}</Text>
          </View>

          {day.dailyGoals.length === 0 && (
            <Text style={styles.emptyHint}>
              Small, checkable outcomes for today — "walk 5k steps", "no phone before noon".
            </Text>
          )}

          {day.dailyGoals.map(g => (
            <View key={g.id} style={styles.rowItem}>
              <TouchableOpacity
                style={[styles.checkbox, {
                  borderColor: g.completed ? theme.colors.success : theme.colors.border,
                  backgroundColor: g.completed ? theme.colors.success : 'transparent',
                }]}
                onPress={() => toggleDailyGoal(g.id)}
              >
                {g.completed && <Ionicons name="checkmark" size={15} color="#FFF" />}
              </TouchableOpacity>
              <Text style={[styles.rowText, g.completed && styles.rowTextDone]} numberOfLines={2}>
                {g.title}
              </Text>
              <TouchableOpacity onPress={() => removeDailyGoal(g.id)} hitSlop={8}>
                <Ionicons name="close" size={17} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>
          ))}

          <View style={styles.addRow}>
            <TextInput
              style={styles.addInput}
              value={goalDraft}
              onChangeText={setGoalDraft}
              placeholder="Add a goal for today…"
              placeholderTextColor={theme.colors.textMuted}
              returnKeyType="done"
              onSubmitEditing={() => { addDailyGoal(goalDraft); setGoalDraft(''); }}
            />
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => { addDailyGoal(goalDraft); setGoalDraft(''); }}
            >
              <Ionicons name="add" size={21} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Daily notes ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="create-outline" size={17} color="#14B8A6" />
            <Text style={styles.sectionTitle}>Daily Notes</Text>
          </View>
          <TextInput
            style={styles.notesInput}
            value={notesDraft}
            onChangeText={setNotesDraft}
            onBlur={() => { if (notesDraft !== day.notes) setNotes(notesDraft); }}
            placeholder="How did today go? What got in the way? What's worth remembering?"
            placeholderTextColor={theme.colors.textMuted}
            multiline
          />
        </View>
      </ScrollView>

      {/* ── FABs ── */}
      <View style={styles.fabRow}>
        <TouchableOpacity
          style={styles.fabSmall}
          onPress={() => {
            setEditingBlockId(null);
            setNewBlockStart(suggestedSlot);
            setBlockSheetOpen(true);
          }}
          activeOpacity={0.85}
        >
          <Ionicons name="time-outline" size={22} color={theme.colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.fab} onPress={() => openQuickAdd('task')} activeOpacity={0.88}>
          <Ionicons name="add" size={22} color="#FFF" />
          <Text style={styles.fabText}>Quick Add</Text>
        </TouchableOpacity>
      </View>

      {/* ── Overflow menu ── */}
      {menuOpen && (
        <>
          <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setMenuOpen(false)} />
          <View style={styles.menu}>
            {menuItems.map((item, i) => (
              'divider' in item ? (
                <View key={`div-${i}`} style={styles.menuDivider} />
              ) : (
                <TouchableOpacity
                  key={item.label}
                  style={styles.menuItem}
                  onPress={() => { setMenuOpen(false); item.run(); }}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={item.icon}
                    size={18}
                    color={item.label === 'Clear schedule' ? theme.colors.error : theme.colors.textSecondary}
                  />
                  <Text
                    style={[styles.menuLabel, item.label === 'Clear schedule' && { color: theme.colors.error }]}
                  >
                    {item.label}
                  </Text>
                  {item.pro && !hasPremium && (
                    <View style={styles.proTag}><Text style={styles.proTagText}>PRO</Text></View>
                  )}
                </TouchableOpacity>
              )
            ))}
          </View>
        </>
      )}

      {/* ── Sheets ── */}
      <PlannerBlockSheet
        visible={blockSheetOpen}
        onClose={() => { setBlockSheetOpen(false); setEditingBlockId(null); }}
        onSave={handleBlockSave}
        onDelete={editingBlock ? () => removeBlock(editingBlock.id) : undefined}
        block={editingBlock}
        initialStartMinutes={newBlockStart}
        defaultReminderMinutes={prefs.defaultReminderMinutes}
        tasks={openTasks}
      />

      <PlannerQuickAddSheet
        visible={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        onSubmit={handleQuickAdd}
        suggestedStartMinutes={suggestedSlot}
        priorityFull={priorityFull}
        initialMode={quickAddMode}
      />

      <PremiumGateSheet
        visible={gateFeature !== null}
        feature={gateFeature ?? undefined}
        onClose={() => setGateFeature(null)}
      />
    </View>
  );
}
