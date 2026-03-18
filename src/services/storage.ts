import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS, DEFAULT_POMODORO } from '../core/constants';
import type {
  Note, Folder, Tag, Reminder, Task, TaskCategory, AppSettings,
  Habit, JournalEntry, PomodoroSession, SharedList, TaskTemplate, Badge,
} from '../types';

function getter<T>(key: string, fallback: T) {
  return async (): Promise<T> => {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return fallback;
    try { return JSON.parse(raw); } catch { return fallback; }
  };
}

function setter<T>(key: string) {
  return async (data: T): Promise<void> => {
    await AsyncStorage.setItem(key, JSON.stringify(data));
  };
}

const defaultSettings: AppSettings = {
  firstDayOfWeek: 0,
  notificationsEnabled: true,
  appLockEnabled: false,
  appLockPin: null,
  useBiometrics: false,
  themeColorId: 'default',
  pomodoroSettings: { ...DEFAULT_POMODORO },
};

export const storage = {
  getNotes: getter<Note[]>(STORAGE_KEYS.NOTES, []),
  setNotes: setter<Note[]>(STORAGE_KEYS.NOTES),
  getFolders: getter<Folder[]>(STORAGE_KEYS.FOLDERS, []),
  setFolders: setter<Folder[]>(STORAGE_KEYS.FOLDERS),
  getTags: getter<Tag[]>(STORAGE_KEYS.TAGS, []),
  setTags: setter<Tag[]>(STORAGE_KEYS.TAGS),
  getReminders: getter<Reminder[]>(STORAGE_KEYS.REMINDERS, []),
  setReminders: setter<Reminder[]>(STORAGE_KEYS.REMINDERS),
  getTasks: getter<Task[]>(STORAGE_KEYS.TASKS, []),
  setTasks: setter<Task[]>(STORAGE_KEYS.TASKS),
  getTaskCategories: getter<TaskCategory[]>(STORAGE_KEYS.TASK_CATEGORIES, []),
  setTaskCategories: setter<TaskCategory[]>(STORAGE_KEYS.TASK_CATEGORIES),
  getSettings: getter<AppSettings>(STORAGE_KEYS.SETTINGS, defaultSettings),
  setSettings: setter<AppSettings>(STORAGE_KEYS.SETTINGS),
  getHabits: getter<Habit[]>(STORAGE_KEYS.HABITS, []),
  setHabits: setter<Habit[]>(STORAGE_KEYS.HABITS),
  getJournalEntries: getter<JournalEntry[]>(STORAGE_KEYS.JOURNAL, []),
  setJournalEntries: setter<JournalEntry[]>(STORAGE_KEYS.JOURNAL),
  getPomodoroSessions: getter<PomodoroSession[]>(STORAGE_KEYS.POMODORO_SESSIONS, []),
  setPomodoroSessions: setter<PomodoroSession[]>(STORAGE_KEYS.POMODORO_SESSIONS),
  getSharedLists: getter<SharedList[]>(STORAGE_KEYS.SHARED_LISTS, []),
  setSharedLists: setter<SharedList[]>(STORAGE_KEYS.SHARED_LISTS),
  getTaskTemplates: getter<TaskTemplate[]>(STORAGE_KEYS.TASK_TEMPLATES, []),
  setTaskTemplates: setter<TaskTemplate[]>(STORAGE_KEYS.TASK_TEMPLATES),
  getBadges: getter<Badge[]>(STORAGE_KEYS.BADGES, []),
  setBadges: setter<Badge[]>(STORAGE_KEYS.BADGES),
};
