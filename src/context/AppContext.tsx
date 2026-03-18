import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { storage } from '../services/storage';
import {
  createNotificationChannel,
  requestNotificationPermission,
  scheduleTimeReminder,
  cancelReminderNotification,
} from '../services/reminderService';
import type {
  Note, Folder, Tag, Reminder, NotesFilter, SortField, SortOrder, SmartCategory,
  Task, TaskCategory, SubTask, TasksFilter, TaskSortField, AppSettings,
} from '../types';
import { generateId } from '../utils/id';
import { categoryColors } from '../core/theme';

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
  getNote: (id: string) => Note | undefined;
  toggleFavorite: (id: string) => void;
  togglePin: (id: string) => void;
  setNoteCategory: (noteId: string, category: SmartCategory) => void;

  // Folders
  addFolder: (name: string, parentId?: string | null) => Folder;
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

  // Filter
  setFilter: (patch: Partial<NotesFilter>) => void;
  setSort: (sortBy: SortField, sortOrder: SortOrder) => void;
  filteredNotes: Note[];

  // Tasks
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => Task;
  updateTask: (id: string, patch: Partial<Task>) => void;
  deleteTask: (id: string) => void;
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
  const [loaded, setLoaded] = useState(false);

  // ─── Hydration ──────────────────────────────────────
  useEffect(() => {
    (async () => {
      const [n, f, t, r, tk, tc, s] = await Promise.all([
        storage.getNotes(),
        storage.getFolders(),
        storage.getTags(),
        storage.getReminders(),
        storage.getTasks(),
        storage.getTaskCategories(),
        storage.getSettings(),
      ]);
      setNotes(n);
      setFolders(f);
      setTags(t);
      setReminders(r);
      setTasks(tk);
      setTaskCategories(tc.length > 0 ? tc : DEFAULT_CATEGORIES);
      setSettings(s);
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (Platform.OS === 'android') {
      createNotificationChannel();
      requestNotificationPermission();
    }
  }, []);

  // ─── Auto-save ──────────────────────────────────────
  useEffect(() => { if (loaded) storage.setNotes(notes); }, [loaded, notes]);
  useEffect(() => { if (loaded) storage.setFolders(folders); }, [loaded, folders]);
  useEffect(() => { if (loaded) storage.setTags(tags); }, [loaded, tags]);
  useEffect(() => { if (loaded) storage.setReminders(reminders); }, [loaded, reminders]);
  useEffect(() => { if (loaded) storage.setTasks(tasks); }, [loaded, tasks]);
  useEffect(() => { if (loaded) storage.setTaskCategories(taskCategories); }, [loaded, taskCategories]);
  useEffect(() => { if (loaded) storage.setSettings(settings); }, [loaded, settings]);

  // ─── Notes ──────────────────────────────────────────
  const addNote = useCallback((note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>): Note => {
    const now = Date.now();
    const newNote: Note = { ...note, id: generateId(), createdAt: now, updatedAt: now };
    setNotes((prev) => [newNote, ...prev]);
    return newNote;
  }, []);

  const updateNote = useCallback((id: string, patch: Partial<Note>) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n)));
  }, []);

  const deleteNote = useCallback((id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    setReminders((prev) => prev.filter((r) => r.noteId !== id));
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

  // ─── Folders ────────────────────────────────────────
  const addFolder = useCallback((name: string, parentId: string | null = null): Folder => {
    const newFolder: Folder = { id: generateId(), name, parentId, order: folders.length, createdAt: Date.now() };
    setFolders((prev) => [...prev, newFolder]);
    return newFolder;
  }, [folders.length]);

  const updateFolder = useCallback((id: string, patch: Partial<Folder>) => {
    setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }, []);

  const deleteFolder = useCallback((id: string) => {
    setFolders((prev) => prev.filter((f) => f.id !== id));
    setNotes((prev) => prev.map((n) => (n.folderId === id ? { ...n, folderId: null } : n)));
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

  // ─── Notes filter ──────────────────────────────────
  const setFilter = useCallback((patch: Partial<NotesFilter>) => {
    setFilterState((f) => ({ ...f, ...patch }));
  }, []);

  const setSort = useCallback((sortBy: SortField, sortOrder: SortOrder) => {
    setFilterState((f) => ({ ...f, sortBy, sortOrder }));
  }, []);

  const filteredNotes = useMemo(() => {
    let list = [...notes];
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
  const addTask = useCallback((task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Task => {
    const now = Date.now();
    const newTask: Task = { ...task, id: generateId(), createdAt: now, updatedAt: now };
    setTasks((prev) => [newTask, ...prev]);
    return newTask;
  }, []);

  const updateTask = useCallback((id: string, patch: Partial<Task>) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch, updatedAt: Date.now() } : t)));
  }, []);

  const deleteTask = useCallback((id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const getTask = useCallback((id: string) => tasks.find((t) => t.id === id), [tasks]);

  const toggleTaskComplete = useCallback((id: string) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, completed: !t.completed, updatedAt: Date.now() } : t)));
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
    let list = [...tasks];
    if (!taskFilter.showCompleted) list = list.filter((t) => !t.completed);
    if (taskFilter.categoryId) list = list.filter((t) => t.categoryId === taskFilter.categoryId);
    if (taskFilter.searchQuery.trim()) {
      const q = taskFilter.searchQuery.toLowerCase();
      list = list.filter((t) =>
        t.title.toLowerCase().includes(q) || t.notes.toLowerCase().includes(q)
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

  const tasksForDate = useCallback((date: number) => {
    const d = new Date(date);
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const dayEnd = dayStart + 86400000;
    return tasks.filter((t) => t.dueDate && t.dueDate >= dayStart && t.dueDate < dayEnd);
  }, [tasks]);

  const taskStats = useMemo<TaskStats>(() => {
    const completed = tasks.filter((t) => t.completed).length;
    const pending = tasks.filter((t) => !t.completed).length;
    const byCategory: Record<string, number> = {};
    tasks.filter((t) => !t.completed).forEach((t) => {
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
        tasks.filter((t) => t.completed && t.updatedAt >= dayStart && t.updatedAt < dayEnd).length
      );
    }
    return { completed, pending, byCategory, weeklyCompleted };
  }, [tasks]);

  // ─── Settings ──────────────────────────────────────
  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((s) => ({ ...s, ...patch }));
  }, []);

  // ─── Context value ─────────────────────────────────
  const value = useMemo<AppContextValue>(
    () => ({
      notes, folders, tags, reminders, filter, isHydrated: loaded,
      tasks, taskCategories, taskFilter, settings,
      addNote, updateNote, deleteNote, getNote, toggleFavorite, togglePin, setNoteCategory,
      addFolder, updateFolder, deleteFolder, getFolder,
      addTag, updateTag, deleteTag, getTag,
      addReminder, updateReminder, removeReminder, getReminder,
      setFilter, setSort, filteredNotes,
      addTask, updateTask, deleteTask, getTask, toggleTaskComplete,
      toggleSubTaskComplete, addSubTask, deleteSubTask,
      addTaskCategory, updateTaskCategory, deleteTaskCategory, getTaskCategory,
      setTaskFilter, setTaskSort, filteredTasks, tasksForDate, taskStats,
      updateSettings,
    }),
    [
      notes, folders, tags, reminders, filter, loaded,
      tasks, taskCategories, taskFilter, settings,
      addNote, updateNote, deleteNote, getNote, toggleFavorite, togglePin, setNoteCategory,
      addFolder, updateFolder, deleteFolder, getFolder,
      addTag, updateTag, deleteTag, getTag,
      addReminder, updateReminder, removeReminder, getReminder,
      setFilter, setSort, filteredNotes,
      addTask, updateTask, deleteTask, getTask, toggleTaskComplete,
      toggleSubTaskComplete, addSubTask, deleteSubTask,
      addTaskCategory, updateTaskCategory, deleteTaskCategory, getTaskCategory,
      setTaskFilter, setTaskSort, filteredTasks, tasksForDate, taskStats,
      updateSettings,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
