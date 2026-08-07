import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { storage } from '../services/storage';
import {
  createNotificationChannel,
  requestNotificationPermission,
  scheduleTimeReminder,
  cancelReminderNotification,
  snoozeReminder as snoozeReminderService,
} from '../services/reminderService';
import type {
  Note, Folder, Tag, Reminder, NotesFilter, SortField, SortOrder, SmartCategory,
  Task, TaskCategory, SubTask, TasksFilter, TaskSortField, AppSettings,
} from '../types';
import { generateId } from '../utils/id';
import { useDebouncedSave } from '../utils/useDebouncedSave';
import { categoryColors } from '../core/theme';
import { syncWidgetData } from '../services/widgetService';
import {
  syncSmartDeadlineReminders,
  scheduleOverdueCheck,
  scheduleEveningReflection,
} from '../services/smartNotificationService';
import {
  recordActivity,
  checkStreakOnAppOpen,
  loadStreak,
  repairStreak,
  type StreakData,
} from '../services/streakService';
import {
  scheduleStreakNudge,
  scheduleWeeklyRecap,
} from '../services/streakNotificationService';
import { schedulePulseNotification, loadPulseState } from '../services/dailyPulseService';
import { evaluateAndScheduleComeback } from '../services/comebackService';
import { shouldShowBrewNow } from '../services/morningBrewService';
import { navigateTo } from '../services/navigationService';
import { detectDeviceCountry } from '../services/holidayService';
import { stripHtml } from '../utils/stripHtml';

// ─── Default task categories ────────────────────────
const DEFAULT_CATEGORIES: TaskCategory[] = [
  { id: 'cat-work', name: 'Work', color: categoryColors.orange, icon: 'briefcase-outline' },
  { id: 'cat-personal', name: 'Personal', color: categoryColors.blue, icon: 'person-outline' },
  { id: 'cat-health', name: 'Health', color: categoryColors.green, icon: 'heart-outline' },
  { id: 'cat-urgent', name: 'Urgent', color: categoryColors.red, icon: 'flag-outline' },
  { id: 'cat-wishlist', name: 'Wishlist', color: categoryColors.purple, icon: 'star-outline' },
];

interface AppState {
  notes: Note[];
  folders: Folder[];
  tags: Tag[];
  reminders: Reminder[];
  filter: NotesFilter;
  tasks: Task[];
  taskCategories: TaskCategory[];
  taskFilter: TasksFilter;
  settings: AppSettings;
  streak: StreakData;
}

interface TaskStats {
  completed: number;
  pending: number;
  byCategory: Record<string, number>;
  weeklyCompleted: number[];
}

interface AppContextValue extends AppState {
  // Notes
  addNote: (note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>) => Note;
  updateNote: (id: string, patch: Partial<Note>) => void;
  deleteNote: (id: string) => void;
  deleteAllNotes: () => void;
  getNote: (id: string) => Note | undefined;
  toggleFavorite: (id: string) => void;
  togglePin: (id: string) => void;
  setNoteCategory: (noteId: string, category: SmartCategory) => void;
  setNoteColor: (noteId: string, color: string | null) => void;

  // Folders
  addFolder: (
    name: string,
    parentId?: string | null,
    cover?: { color?: string | null; icon?: string | null },
  ) => Folder;
  updateFolder: (id: string, patch: Partial<Folder>) => void;
  deleteFolder: (id: string) => void;
  getFolder: (id: string) => Folder | undefined;

  // Tags
  addTag: (name: string, parentId?: string | null, color?: string) => Tag;
  updateTag: (id: string, patch: Partial<Tag>) => void;
  deleteTag: (id: string) => void;
  getTag: (id: string) => Tag | undefined;

  // Reminders
  addReminder: (reminder: Omit<Reminder, 'id' | 'createdAt'>) => Promise<Reminder | null>;
  updateReminder: (id: string, patch: Partial<Reminder>) => Promise<void>;
  removeReminder: (id: string) => Promise<void>;
  getReminder: (id: string) => Reminder | undefined;
  snoozeReminder: (id: string, minutes: number) => Promise<void>;

  // Filter
  setFilter: (patch: Partial<NotesFilter>) => void;
  setSort: (sortBy: SortField, sortOrder: SortOrder) => void;
  filteredNotes: Note[];

  // Tasks
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => Task;
  updateTask: (id: string, patch: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  deleteAllTasks: () => void;
  getTask: (id: string) => Task | undefined;
  toggleTaskComplete: (id: string) => void;
  toggleSubTaskComplete: (taskId: string, subTaskId: string) => void;
  addSubTask: (taskId: string, title: string) => SubTask;
  deleteSubTask: (taskId: string, subTaskId: string) => void;

  // Task Categories
  addTaskCategory: (cat: Omit<TaskCategory, 'id'>) => TaskCategory;
  updateTaskCategory: (id: string, patch: Partial<TaskCategory>) => void;
  deleteTaskCategory: (id: string) => void;
  getTaskCategory: (id: string) => TaskCategory | undefined;

  // Task Filter
  setTaskFilter: (patch: Partial<TasksFilter>) => void;
  setTaskSort: (sortBy: TaskSortField, sortOrder: SortOrder) => void;
  filteredTasks: Task[];
  tasksForDate: (date: number) => Task[];
  taskStats: TaskStats;

  // Settings
  updateSettings: (patch: Partial<AppSettings>) => void;

  // Streak
  streak: StreakData;
  recordStreakActivity: () => Promise<number | null>;
  repairCurrentStreak: () => Promise<boolean>;

  // Cloud sync
  /** Re-reads notes and tasks from the database. */
  reloadFromStorage: () => Promise<void>;
  restoreData: (data: {
    notes?: Note[]; folders?: Folder[]; tags?: Tag[];
    reminders?: Reminder[]; tasks?: Task[]; taskCategories?: TaskCategory[];
    settings?: AppSettings;
  }) => void;

  isHydrated: boolean;
}

const defaultFilter: NotesFilter = {
  searchQuery: '',
  folderId: null,
  tagIds: [],
  category: null,
  sortBy: 'updatedAt',
  sortOrder: 'desc',
  favoritesOnly: false,
  pinnedOnly: false,
};

const defaultTaskFilter: TasksFilter = {
  searchQuery: '',
  categoryId: null,
  showCompleted: false,
  sortBy: 'dueDate',
  sortOrder: 'asc',
};

const defaultSettings: AppSettings = {
  firstDayOfWeek: 0,
  notificationsEnabled: true,
  appLockEnabled: false,
  appLockPin: null,
  useBiometrics: false,
  themeColorId: 'default',
  pomodoroSettings: { workMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15, sessionsBeforeLongBreak: 4 },
  geminiApiKey: null,
  holidayCountry: '',
  holidayNotificationsEnabled: true,
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [filter, setFilterState] = useState<NotesFilter>(defaultFilter);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskCategories, setTaskCategories] = useState<TaskCategory[]>([]);
  const [taskFilter, setTaskFilterState] = useState<TasksFilter>(defaultTaskFilter);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [streak, setStreak] = useState<StreakData>({
    currentStreak: 0, longestStreak: 0, lastActiveDate: '',
    activeDates: [], freezesUsedThisWeek: 0, weekStartDate: '', milestones: [],
    streakBrokenAt: null, brokenStreakLength: 0, repairsUsedThisMonth: 0, monthStartKey: '',
  });
  const [loaded, setLoaded] = useState(false);

  // ─── Hydration ──────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        console.log('[Hydration] Loading data from WatermelonDB...');
        const [n, f, t, r, tk, tc, s] = await Promise.all([
          storage.getNotes(),
          storage.getFolders(),
          storage.getTags(),
          storage.getReminders(),
          storage.getTasks(),
          storage.getTaskCategories(),
          storage.getSettings(),
        ]);
        console.log('[Hydration] Loaded:', n.length, 'notes,', tk.length, 'tasks,', tc.length, 'categories');
        setNotes(n);
        setFolders(f);
        setTags(t);
        setReminders(r);
        setTasks(tk);
        setTaskCategories(tc.length > 0 ? tc : DEFAULT_CATEGORIES);
        // Auto-detect country on first launch (or after upgrade) when blank.
        const hydratedSettings: AppSettings = s.holidayCountry
          ? s
          : { ...s, holidayCountry: detectDeviceCountry() };
        setSettings(hydratedSettings);
        // Load and check streak
        const streakData = await checkStreakOnAppOpen();
        setStreak(streakData);
        setLoaded(true);
      } catch (err) {
        console.error('[Hydration] FAILED to load data:', err);
        setLoaded(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (Platform.OS === 'android') {
      createNotificationChannel();
      requestNotificationPermission();
      // Check if app was launched by tapping a notification (app was killed)
      try {
        const notifeeInit = require('@notifee/react-native').default;
        notifeeInit.getInitialNotification().then((initial: any) => {
          if (initial?.notification?.data) {
            const { handleNotificationDeepLink } = require('../services/navigationService');
            handleNotificationDeepLink(initial.notification.data);
          }
        });
      } catch {}
      // Register foreground notification event handler for snooze actions
      try {
        const notifeeModule = require('@notifee/react-native').default;
        const { EventType } = require('@notifee/react-native');
        const { handleNotificationDeepLink } = require('../services/navigationService');
        notifeeModule.onForegroundEvent(({ type, detail }: { type: number; detail: any }) => {
          if (type === EventType.ACTION_PRESS) {
            const actionId = detail.pressAction?.id;
            const reminderId = detail.notification?.data?.reminderId;
            if (actionId === 'dismiss' && detail.notification?.id) {
              notifeeModule.cancelNotification(detail.notification.id);
            } else if (actionId === 'snooze_10' && reminderId) {
              const r = reminders.find((rm: Reminder) => rm.id === reminderId);
              if (r) snoozeReminderService(r, 10);
            } else if (actionId === 'snooze_60' && reminderId) {
              const r = reminders.find((rm: Reminder) => rm.id === reminderId);
              if (r) snoozeReminderService(r, 60);
            } else if (actionId === 'default') {
              handleNotificationDeepLink(detail.notification?.data);
            }
          }
          // Notification body tap (not an action button)
          if (type === EventType.PRESS) {
            handleNotificationDeepLink(detail.notification?.data);
          }
        });
      } catch {}
    }
  }, [reminders]);

  // ─── Auto-save (debounced to prevent write contention) ───
  // Storage writes are debounced — waits 800ms after last change.
  // Side-effects (widget, notifications) remain immediate.
  const saveNotes = useCallback((d: Note[]) => storage.setNotes(d), []);
  const saveFolders = useCallback((d: Folder[]) => storage.setFolders(d), []);
  const saveTags = useCallback((d: Tag[]) => storage.setTags(d), []);
  const saveReminders = useCallback((d: Reminder[]) => storage.setReminders(d), []);
  const saveTasks = useCallback((d: Task[]) => storage.setTasks(d), []);
  const saveCategories = useCallback((d: TaskCategory[]) => storage.setTaskCategories(d), []);
  const saveSettings = useCallback((d: AppSettings) => storage.setSettings(d), []);

  useDebouncedSave(loaded, notes, saveNotes);
  useDebouncedSave(loaded, folders, saveFolders);
  useDebouncedSave(loaded, tags, saveTags);
  useDebouncedSave(loaded, reminders, saveReminders);
  useDebouncedSave(loaded, tasks, saveTasks);
  useDebouncedSave(loaded, taskCategories, saveCategories);
  useDebouncedSave(loaded, settings, saveSettings, 1500); // settings change less often

  // Side-effects driven by `tasks` — debounced 800ms so a single edit
  // doesn't fire 3 native-bridge calls per task in the array. Without this
  // debounce, toggling one task triggers ~50+ notifee calls on a list of
  // 50 tasks (one per task in syncSmartDeadlineReminders).
  const taskSideEffects = useCallback(async (latestTasks: Task[]) => {
    syncWidgetData(latestTasks, []);
    syncSmartDeadlineReminders(latestTasks).catch(() => {});
    scheduleOverdueCheck(latestTasks).catch(() => {});
  }, []);
  useDebouncedSave(loaded, tasks, taskSideEffects, 800);
  // Schedule 8 PM evening reflection notification (once on app load)
  useEffect(() => { if (loaded) scheduleEveningReflection().catch(() => {}); }, [loaded]);
  // Streak: 8 PM "don't break it" nudge + Sunday weekly recap.
  useEffect(() => {
    if (!loaded) return;
    scheduleStreakNudge().catch(() => {});
    scheduleWeeklyRecap().catch(() => {});
  }, [loaded, streak.currentStreak, streak.lastActiveDate]);
  // Daily Pulse: 8 PM evening reminder (idempotent re-schedule on every load).
  useEffect(() => { if (loaded) schedulePulseNotification().catch(() => {}); }, [loaded]);

  // Comeback Engine — re-engagement notification when user has been away.
  useEffect(() => {
    if (!loaded) return;
    (async () => {
      try {
        const [pulseState, journalEntries] = await Promise.all([
          loadPulseState(),
          storage.getJournalEntries(),
        ]);
        await evaluateAndScheduleComeback({
          streak,
          pulse: pulseState,
          journalEntries,
        });
      } catch {
        // non-fatal
      }
    })();
  }, [loaded, streak.lastActiveDate]);

  // Morning Brew — auto-show once per morning between 6 AM and 10 AM.
  useEffect(() => {
    if (!loaded) return;
    (async () => {
      try {
        if (await shouldShowBrewNow()) {
          // Slight delay so the home screen finishes mounting first.
          setTimeout(() => navigateTo('MorningBrew'), 600);
        }
      } catch {}
    })();
  }, [loaded]);

  // Foreground geofence watcher. Only restart when the *count* of location
  // reminders changes, not on every reminders-array reference change. The
  // watcher's getter (remindersRef) always reads the freshest list.
  const remindersRef = useRef(reminders);
  remindersRef.current = reminders;
  const locationReminderCount = useMemo(
    () => reminders.filter(r => r.triggerType === 'location' && r.location).length,
    [reminders],
  );
  useEffect(() => {
    if (!loaded) return;
    if (locationReminderCount === 0) return;
    try {
      const { startLocationWatch, stopLocationWatch } = require('../services/locationReminderService');
      startLocationWatch(() => remindersRef.current);
      return () => stopLocationWatch();
    } catch {}
  }, [loaded, locationReminderCount]);

  // Persistent notification tray — debounced so toggling tasks rapidly
  // doesn't redraw the system notification on every keystroke.
  const trayInputs = useMemo(
    () => ({ tasks, streakDays: streak.currentStreak }),
    [tasks, streak.currentStreak],
  );
  const refreshTray = useCallback(async (input: { tasks: Task[]; streakDays: number }) => {
    try {
      const { refreshPersistentTray } = require('../services/persistentTrayService');
      const pending = input.tasks.filter(t => !t.completed);
      const topTask = pending.find(t => t.priority === 'high') ?? pending.find(t => t.dueDate) ?? pending[0];
      await refreshPersistentTray({
        topTask, streakDays: input.streakDays, pendingCount: pending.length,
      });
    } catch {}
  }, []);
  useDebouncedSave(loaded, trayInputs, refreshTray, 1000);

  // Check streak rewards when current streak changes.
  useEffect(() => {
    if (!loaded || streak.currentStreak === 0) return;
    try {
      const { checkRewardsForStreak } = require('../services/streakRewardsService');
      checkRewardsForStreak(streak.currentStreak).catch(() => {});
    } catch {}
  }, [loaded, streak.currentStreak]);

  // Log engagement for smart-timing learning.
  useEffect(() => {
    if (!loaded) return;
    try {
      const { logEngagement } = require('../services/smartTimingService');
      logEngagement('open').catch(() => {});
    } catch {}
  }, [loaded]);

  // ─── Notes ──────────────────────────────────────────
  const addNote = useCallback((note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>): Note => {
    const now = Date.now();
    const newNote: Note = { ...note, id: generateId(), createdAt: now, updatedAt: now };
    setNotes((prev) => [newNote, ...prev]);
    recordActivity().then(r => setStreak(r.streak)).catch(() => {});
    return newNote;
  }, []);

  const updateNote = useCallback((id: string, patch: Partial<Note>) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n)));
  }, []);

  const deleteNote = useCallback((id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    setReminders((prev) => prev.filter((r) => r.noteId !== id));
  }, []);

  const deleteAllNotes = useCallback(() => {
    setReminders((prev) => {
      prev.forEach((r) => {
        if (r.noteId && r.notifeeId) cancelReminderNotification(r.notifeeId).catch(() => {});
      });
      return prev.filter((r) => !r.noteId);
    });
    setNotes([]);
  }, []);

  const getNote = useCallback((id: string) => notes.find((n) => n.id === id), [notes]);

  const toggleFavorite = useCallback((id: string) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, isFavorite: !n.isFavorite, updatedAt: Date.now() } : n)));
  }, []);

  const togglePin = useCallback((id: string) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, isPinned: !n.isPinned, updatedAt: Date.now() } : n)));
  }, []);

  const setNoteCategory = useCallback((noteId: string, category: SmartCategory) => {
    setNotes((prev) => prev.map((n) => (n.id === noteId ? { ...n, category, updatedAt: Date.now() } : n)));
  }, []);

  const setNoteColor = useCallback((noteId: string, color: string | null) => {
    setNotes((prev) => prev.map((n) => (n.id === noteId ? { ...n, color, updatedAt: Date.now() } : n)));
  }, []);

  // ─── Folders ────────────────────────────────────────
  const addFolder = useCallback((
    name: string,
    parentId: string | null = null,
    cover?: { color?: string | null; icon?: string | null },
  ): Folder => {
    const newFolder: Folder = {
      id: generateId(), name, parentId,
      order: folders.length, createdAt: Date.now(),
      color: cover?.color ?? null,
      icon: cover?.icon ?? null,
    };
    setFolders((prev) => [...prev, newFolder]);
    return newFolder;
  }, [folders.length]);

  const updateFolder = useCallback((id: string, patch: Partial<Folder>) => {
    setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }, []);

  const deleteFolder = useCallback((id: string) => {
    setFolders((prev) => {
      // Children would otherwise be left pointing at a folder that no longer
      // exists, making them invisible in every list.
      const doomed = new Set([id, ...prev.filter((f) => f.parentId === id).map((f) => f.id)]);
      setNotes((notes) =>
        notes.map((n) => (n.folderId && doomed.has(n.folderId) ? { ...n, folderId: null } : n)),
      );
      return prev.filter((f) => !doomed.has(f.id));
    });
  }, []);

  const getFolder = useCallback((id: string) => folders.find((f) => f.id === id), [folders]);

  // ─── Tags ──────────────────────────────────────────
  const addTag = useCallback((name: string, parentId: string | null = null, color?: string): Tag => {
    const newTag: Tag = { id: generateId(), name, parentId, color, order: tags.length, createdAt: Date.now() };
    setTags((prev) => [...prev, newTag]);
    return newTag;
  }, [tags.length]);

  const updateTag = useCallback((id: string, patch: Partial<Tag>) => {
    setTags((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  const deleteTag = useCallback((id: string) => {
    setTags((prev) => prev.filter((t) => t.id !== id));
    setNotes((prev) => prev.map((n) => ({ ...n, tagIds: n.tagIds.filter((tid) => tid !== id) })));
  }, []);

  const getTag = useCallback((id: string) => tags.find((t) => t.id === id), [tags]);

  // ─── Reminders ─────────────────────────────────────
  const addReminder = useCallback(async (reminder: Omit<Reminder, 'id' | 'createdAt'>): Promise<Reminder | null> => {
    const newReminder: Reminder = { ...reminder, id: generateId(), createdAt: Date.now() };
    if (newReminder.triggerType === 'time' && newReminder.date) {
      const notifeeId = await scheduleTimeReminder(newReminder);
      if (notifeeId) newReminder.notifeeId = notifeeId;
    }
    setReminders((prev) => [...prev, newReminder]);
    return newReminder;
  }, []);

  const updateReminder = useCallback(async (id: string, patch: Partial<Reminder>) => {
    const prev = reminders.find((r) => r.id === id);
    if (!prev) return;
    const updated = { ...prev, ...patch };
    if (prev.notifeeId) await cancelReminderNotification(prev.notifeeId);
    if (updated.triggerType === 'time' && updated.date) {
      const notifeeId = await scheduleTimeReminder(updated);
      if (notifeeId) updated.notifeeId = notifeeId;
    }
    setReminders((r) => r.map((x) => (x.id === id ? updated : x)));
  }, [reminders]);

  const removeReminder = useCallback(async (id: string) => {
    const r = reminders.find((x) => x.id === id);
    if (r?.notifeeId) await cancelReminderNotification(r.notifeeId);
    setReminders((prev) => prev.filter((x) => x.id !== id));
    setNotes((prev) => prev.map((n) => (n.reminderId === id ? { ...n, reminderId: null } : n)));
  }, [reminders]);

  const getReminder = useCallback((id: string) => reminders.find((r) => r.id === id), [reminders]);

  const snoozeReminder = useCallback(async (id: string, minutes: number) => {
    const r = reminders.find((x) => x.id === id);
    if (!r) return;
    const newNotifeeId = await snoozeReminderService(r, minutes);
    const snoozedUntil = Date.now() + minutes * 60 * 1000;
    setReminders((prev) => prev.map((x) =>
      x.id === id ? { ...x, snoozedUntil, notifeeId: newNotifeeId ?? x.notifeeId } : x
    ));
  }, [reminders]);

  // ─── Notes filter ──────────────────────────────────
  const setFilter = useCallback((patch: Partial<NotesFilter>) => {
    setFilterState((f) => ({ ...f, ...patch }));
  }, []);

  const setSort = useCallback((sortBy: SortField, sortOrder: SortOrder) => {
    setFilterState((f) => ({ ...f, sortBy, sortOrder }));
  }, []);

  const filteredNotes = useMemo(() => {
    // Archived and trashed notes are kept in the database but never listed;
    // they are reachable only from Settings → Archive & Trash.
    let list = notes.filter((n) => !n.archived && !n.trashedAt);
    if (filter.folderId) list = list.filter((n) => n.folderId === filter.folderId);
    if (filter.tagIds.length) list = list.filter((n) => filter.tagIds.every((tid) => n.tagIds.includes(tid)));
    if (filter.category) list = list.filter((n) => n.category === filter.category);
    if (filter.favoritesOnly) list = list.filter((n) => n.isFavorite);
    if (filter.pinnedOnly) list = list.filter((n) => n.isPinned);
    if (filter.searchQuery.trim()) {
      const q = filter.searchQuery.toLowerCase();
      list = list.filter((n) =>
        n.title.toLowerCase().includes(q) ||
        n.plainText.toLowerCase().includes(q) ||
        n.tagIds.some((tid) => tags.find((t) => t.id === tid)?.name.toLowerCase().includes(q))
      );
    }
    const mult = filter.sortOrder === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      switch (filter.sortBy) {
        case 'title': return mult * a.title.localeCompare(b.title);
        case 'createdAt': return mult * (a.createdAt - b.createdAt);
        case 'updatedAt': return mult * (a.updatedAt - b.updatedAt);
        case 'tags': return mult * (a.tagIds.length - b.tagIds.length) || mult * (a.updatedAt - b.updatedAt);
        default: return mult * (a.updatedAt - b.updatedAt);
      }
    });
    return list;
  }, [notes, filter, tags]);

  // ─── Tasks ─────────────────────────────────────────
  const scheduleTaskReminder = useCallback(async (task: Task) => {
    try {
      // Cancel any previous notification for this task
      await cancelReminderNotification(`task-reminder-${task.id}`).catch(() => {});
      if (!task.reminderDate || task.completed) {
        console.log('[TaskReminder] No reminderDate or completed, skipping');
        return;
      }
      // If reminder is in the past (more than 60s ago), skip it
      if (task.reminderDate < Date.now() - 60000) {
        console.log('[TaskReminder] Reminder too far in past, skipping');
        return;
      }
      // If reminder is very close or slightly past, fire 5s from now
      const fireAt = task.reminderDate <= Date.now() + 5000
        ? Date.now() + 5000
        : task.reminderDate;
      console.log('[TaskReminder] Scheduling for', new Date(fireAt).toLocaleTimeString(), 'task:', task.title);
      const reminder: Reminder = {
        id: `task-reminder-${task.id}`,
        noteId: task.id,
        title: 'Task Reminder',
        body: task.title,
        triggerType: 'time',
        date: fireAt,
        repeat: 'none',
        createdAt: Date.now(),
      };
      await scheduleTimeReminder(reminder);
    } catch (err) {
      console.error('[TaskReminder] Error scheduling:', err);
    }
  }, []);

  const addTask = useCallback((task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Task => {
    const now = Date.now();
    const newTask: Task = { ...task, id: generateId(), createdAt: now, updatedAt: now };
    setTasks((prev) => [newTask, ...prev]);
    scheduleTaskReminder(newTask);
    return newTask;
  }, [scheduleTaskReminder]);

  const updateTask = useCallback((id: string, patch: Partial<Task>) => {
    setTasks((prev) => prev.map((t) => {
      if (t.id !== id) return t;
      const updated = { ...t, ...patch, updatedAt: Date.now() };
      scheduleTaskReminder(updated);
      return updated;
    }));
  }, [scheduleTaskReminder]);

  const deleteTask = useCallback((id: string) => {
    cancelReminderNotification(`task-reminder-${id}`).catch(() => {});
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const deleteAllTasks = useCallback(() => {
    setTasks((prev) => {
      prev.forEach((t) => {
        cancelReminderNotification(`task-reminder-${t.id}`).catch(() => {});
      });
      return [];
    });
  }, []);

  const getTask = useCallback((id: string) => tasks.find((t) => t.id === id), [tasks]);

  const toggleTaskComplete = useCallback((id: string) => {
    setTasks((prev) => {
      const task = prev.find(t => t.id === id);
      // Record streak activity when completing (not uncompleting) a task
      if (task && !task.completed) recordActivity().then(r => setStreak(r.streak)).catch(() => {});
      return prev.map((t) => (t.id === id ? { ...t, completed: !t.completed, updatedAt: Date.now() } : t));
    });
  }, []);

  const toggleSubTaskComplete = useCallback((taskId: string, subTaskId: string) => {
    setTasks((prev) => prev.map((t) => {
      if (t.id !== taskId) return t;
      return {
        ...t,
        subtasks: t.subtasks.map((s) => (s.id === subTaskId ? { ...s, completed: !s.completed } : s)),
        updatedAt: Date.now(),
      };
    }));
  }, []);

  const addSubTask = useCallback((taskId: string, title: string): SubTask => {
    const sub: SubTask = { id: generateId(), title, completed: false };
    setTasks((prev) => prev.map((t) => {
      if (t.id !== taskId) return t;
      return { ...t, subtasks: [...t.subtasks, sub], updatedAt: Date.now() };
    }));
    return sub;
  }, []);

  const deleteSubTask = useCallback((taskId: string, subTaskId: string) => {
    setTasks((prev) => prev.map((t) => {
      if (t.id !== taskId) return t;
      return { ...t, subtasks: t.subtasks.filter((s) => s.id !== subTaskId), updatedAt: Date.now() };
    }));
  }, []);

  // ─── Task Categories ───────────────────────────────
  const addTaskCategory = useCallback((cat: Omit<TaskCategory, 'id'>): TaskCategory => {
    const newCat: TaskCategory = { ...cat, id: generateId() };
    setTaskCategories((prev) => [...prev, newCat]);
    return newCat;
  }, []);

  const updateTaskCategory = useCallback((id: string, patch: Partial<TaskCategory>) => {
    setTaskCategories((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }, []);

  const deleteTaskCategory = useCallback((id: string) => {
    setTaskCategories((prev) => prev.filter((c) => c.id !== id));
    setTasks((prev) => prev.map((t) => (t.categoryId === id ? { ...t, categoryId: null } : t)));
  }, []);

  const getTaskCategory = useCallback((id: string) => taskCategories.find((c) => c.id === id), [taskCategories]);

  // ─── Task Filter ───────────────────────────────────
  const setTaskFilter = useCallback((patch: Partial<TasksFilter>) => {
    setTaskFilterState((f) => ({ ...f, ...patch }));
  }, []);

  const setTaskSort = useCallback((sortBy: TaskSortField, sortOrder: SortOrder) => {
    setTaskFilterState((f) => ({ ...f, sortBy, sortOrder }));
  }, []);

  const filteredTasks = useMemo(() => {
    let list = tasks.filter((t) => !t.archived && !t.trashedAt);
    if (!taskFilter.showCompleted) list = list.filter((t) => !t.completed);
    if (taskFilter.categoryId) list = list.filter((t) => t.categoryId === taskFilter.categoryId);
    if (taskFilter.searchQuery.trim()) {
      const q = taskFilter.searchQuery.toLowerCase();
      list = list.filter((t) =>
        t.title.toLowerCase().includes(q) || stripHtml(t.notes).toLowerCase().includes(q)
      );
    }
    const mult = taskFilter.sortOrder === 'asc' ? 1 : -1;
    const priorityMap = { none: 0, low: 1, medium: 2, high: 3 };
    list.sort((a, b) => {
      switch (taskFilter.sortBy) {
        case 'title': return mult * a.title.localeCompare(b.title);
        case 'createdAt': return mult * (a.createdAt - b.createdAt);
        case 'priority': return mult * (priorityMap[a.priority] - priorityMap[b.priority]);
        case 'dueDate': {
          const aDate = a.dueDate ?? Number.MAX_SAFE_INTEGER;
          const bDate = b.dueDate ?? Number.MAX_SAFE_INTEGER;
          return mult * (aDate - bDate);
        }
        default: return mult * (a.createdAt - b.createdAt);
      }
    });
    return list;
  }, [tasks, taskFilter]);

  // Pre-bucket tasks by day-key once per tasks change. Calendar/agenda views
  // hit this many times per render; an O(1) Map lookup is dramatically
  // faster than re-filtering the whole array per day.
  const tasksByDateKey = useMemo(() => {
    const m = new Map<string, Task[]>();
    for (const t of tasks) {
      if (!t.dueDate) continue;
      // Archived/trashed tasks must not appear on the planner or MyDay.
      if (t.archived || t.trashedAt) continue;
      const d = new Date(t.dueDate);
      const k = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const arr = m.get(k);
      if (arr) arr.push(t);
      else m.set(k, [t]);
    }
    return m;
  }, [tasks]);

  const tasksForDate = useCallback((date: number) => {
    const d = new Date(date);
    const k = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    return tasksByDateKey.get(k) ?? [];
  }, [tasksByDateKey]);

  const taskStats = useMemo<TaskStats>(() => {
    const live = tasks.filter((t) => !t.archived && !t.trashedAt);
    const completed = live.filter((t) => t.completed).length;
    const pending = live.filter((t) => !t.completed).length;
    const byCategory: Record<string, number> = {};
    live.filter((t) => !t.completed).forEach((t) => {
      const key = t.categoryId || 'uncategorized';
      byCategory[key] = (byCategory[key] || 0) + 1;
    });
    // Weekly completed: last 7 days (Sun-Sat or Mon-Sun)
    const now = new Date();
    const weeklyCompleted: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const dayStart = day.getTime();
      const dayEnd = dayStart + 86400000;
      weeklyCompleted.push(
        live.filter((t) => t.completed && t.updatedAt >= dayStart && t.updatedAt < dayEnd).length
      );
    }
    return { completed, pending, byCategory, weeklyCompleted };
  }, [tasks]);

  // ─── Settings ──────────────────────────────────────
  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((s) => ({ ...s, ...patch }));
  }, []);

  // ─── Cloud restore ─────────────────────────────────
  const restoreData = useCallback((data: {
    notes?: Note[]; folders?: Folder[]; tags?: Tag[];
    reminders?: Reminder[]; tasks?: Task[]; taskCategories?: TaskCategory[];
    settings?: AppSettings;
  }) => {
    if (data.notes !== undefined) setNotes(data.notes);
    if (data.folders !== undefined) setFolders(data.folders);
    if (data.tags !== undefined) setTags(data.tags);
    if (data.reminders !== undefined) setReminders(data.reminders);
    if (data.tasks !== undefined) setTasks(data.tasks);
    if (data.taskCategories !== undefined) setTaskCategories(data.taskCategories.length > 0 ? data.taskCategories : DEFAULT_CATEGORIES);
    if (data.settings !== undefined) setSettings(data.settings);
  }, []);

  /**
   * Re-reads notes and tasks from the database.
   *
   * Archive and trash write directly to SQLite, bypassing this context — so
   * after those operations the in-memory lists are stale until this runs.
   */
  const reloadFromStorage = useCallback(async () => {
    try {
      const [freshNotes, freshTasks] = await Promise.all([
        storage.getNotes(),
        storage.getTasks(),
      ]);
      setNotes(freshNotes);
      setTasks(freshTasks);
    } catch { /* keep what is already in memory */ }
  }, []);

  // ─── Streak ───────────────────────────────────────
  const recordStreakActivity = useCallback(async (): Promise<number | null> => {
    try {
      const { streak: updated, newMilestone } = await recordActivity();
      setStreak(updated);
      // Active today → cancel any pending 8 PM nudge.
      scheduleStreakNudge().catch(() => {});
      return newMilestone;
    } catch {
      return null;
    }
  }, []);

  const repairCurrentStreak = useCallback(async (): Promise<boolean> => {
    try {
      const updated = await repairStreak();
      if (!updated) return false;
      setStreak(updated);
      scheduleStreakNudge().catch(() => {});
      return true;
    } catch {
      return false;
    }
  }, []);

  // ─── Context value ─────────────────────────────────
  const value = useMemo<AppContextValue>(
    () => ({
      notes, folders, tags, reminders, filter, isHydrated: loaded,
      tasks, taskCategories, taskFilter, settings, streak,
      addNote, updateNote, deleteNote, deleteAllNotes, getNote, toggleFavorite, togglePin, setNoteCategory, setNoteColor,
      addFolder, updateFolder, deleteFolder, getFolder,
      addTag, updateTag, deleteTag, getTag,
      addReminder, updateReminder, removeReminder, getReminder, snoozeReminder,
      setFilter, setSort, filteredNotes,
      addTask, updateTask, deleteTask, deleteAllTasks, getTask, toggleTaskComplete,
      toggleSubTaskComplete, addSubTask, deleteSubTask,
      addTaskCategory, updateTaskCategory, deleteTaskCategory, getTaskCategory,
      setTaskFilter, setTaskSort, filteredTasks, tasksForDate, taskStats,
      updateSettings, recordStreakActivity, repairCurrentStreak, restoreData, reloadFromStorage,
    }),
    [
      notes, folders, tags, reminders, filter, loaded,
      tasks, taskCategories, taskFilter, settings, streak,
      addNote, updateNote, deleteNote, deleteAllNotes, getNote, toggleFavorite, togglePin, setNoteCategory, setNoteColor,
      addFolder, updateFolder, deleteFolder, getFolder,
      addTag, updateTag, deleteTag, getTag,
      addReminder, updateReminder, removeReminder, getReminder, snoozeReminder,
      setFilter, setSort, filteredNotes,
      addTask, updateTask, deleteTask, deleteAllTasks, getTask, toggleTaskComplete,
      toggleSubTaskComplete, addSubTask, deleteSubTask,
      addTaskCategory, updateTaskCategory, deleteTaskCategory, getTaskCategory,
      setTaskFilter, setTaskSort, filteredTasks, tasksForDate, taskStats,
      updateSettings, recordStreakActivity, repairCurrentStreak, restoreData, reloadFromStorage,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
