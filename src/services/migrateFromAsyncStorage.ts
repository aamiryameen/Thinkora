/**
 * One-time migration: AsyncStorage → WatermelonDB
 *
 * On the first launch after upgrading to WatermelonDB, any data that was
 * saved in AsyncStorage is read, written into WatermelonDB, then the old
 * AsyncStorage keys are deleted so the migration never runs again.
 *
 * Call `runMigrationIfNeeded()` once during app startup (before hydration).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { storage } from './storage';

const MIGRATION_KEY = '@thinkora/wmelon_migrated_v1';

const OLD_KEYS = {
  NOTES: '@notiox/notes',
  FOLDERS: '@notiox/folders',
  TAGS: '@notiox/tags',
  REMINDERS: '@notiox/reminders',
  TASKS: '@notiox/tasks',
  TASK_CATEGORIES: '@notiox/task-categories',
  SETTINGS: '@notiox/settings',
  HABITS: '@notiox/habits',
  JOURNAL: '@notiox/journal',
  POMODORO_SESSIONS: '@notiox/pomodoro-sessions',
  SHARED_LISTS: '@notiox/shared-lists',
  TASK_TEMPLATES: '@notiox/task-templates',
  BADGES: '@notiox/badges',
};

async function readOld<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function runMigrationIfNeeded(): Promise<void> {
  try {
    const done = await AsyncStorage.getItem(MIGRATION_KEY);
    if (done === 'true') return; // already migrated

    console.log('[Migration] Starting AsyncStorage → WatermelonDB migration…');

    const [
      notes, folders, tags, reminders, tasks, taskCategories,
      settings, habits, journal, pomodoro, sharedLists, templates, badges,
    ] = await Promise.all([
      readOld(OLD_KEYS.NOTES, []),
      readOld(OLD_KEYS.FOLDERS, []),
      readOld(OLD_KEYS.TAGS, []),
      readOld(OLD_KEYS.REMINDERS, []),
      readOld(OLD_KEYS.TASKS, []),
      readOld(OLD_KEYS.TASK_CATEGORIES, []),
      readOld(OLD_KEYS.SETTINGS, null),
      readOld(OLD_KEYS.HABITS, []),
      readOld(OLD_KEYS.JOURNAL, []),
      readOld(OLD_KEYS.POMODORO_SESSIONS, []),
      readOld(OLD_KEYS.SHARED_LISTS, []),
      readOld(OLD_KEYS.TASK_TEMPLATES, []),
      readOld(OLD_KEYS.BADGES, []),
    ]);

    // Write everything into WatermelonDB in parallel
    await Promise.all([
      notes.length > 0 ? storage.setNotes(notes) : Promise.resolve(),
      folders.length > 0 ? storage.setFolders(folders) : Promise.resolve(),
      tags.length > 0 ? storage.setTags(tags) : Promise.resolve(),
      reminders.length > 0 ? storage.setReminders(reminders) : Promise.resolve(),
      tasks.length > 0 ? storage.setTasks(tasks) : Promise.resolve(),
      taskCategories.length > 0 ? storage.setTaskCategories(taskCategories) : Promise.resolve(),
      settings ? storage.setSettings(settings) : Promise.resolve(),
      habits.length > 0 ? storage.setHabits(habits) : Promise.resolve(),
      journal.length > 0 ? storage.setJournalEntries(journal) : Promise.resolve(),
      pomodoro.length > 0 ? storage.setPomodoroSessions(pomodoro) : Promise.resolve(),
      sharedLists.length > 0 ? storage.setSharedLists(sharedLists) : Promise.resolve(),
      templates.length > 0 ? storage.setTaskTemplates(templates) : Promise.resolve(),
      badges.length > 0 ? storage.setBadges(badges) : Promise.resolve(),
    ]);

    // Mark migration complete
    await AsyncStorage.setItem(MIGRATION_KEY, 'true');

    // Remove old keys to free space
    await AsyncStorage.multiRemove(Object.values(OLD_KEYS));

    console.log('[Migration] Done. AsyncStorage data moved to WatermelonDB.');
  } catch (err) {
    // Never crash the app — if migration fails, app still works with empty DB
    console.warn('[Migration] Failed:', err);
  }
}
