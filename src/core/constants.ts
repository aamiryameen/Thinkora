/**
 * Application-wide constants.
 */

export const AUTO_SAVE_INTERVAL_MS = 3000;
export const UNDO_HISTORY_MAX = 50;
export const EDITOR_CONTENT_DEBOUNCE_MS = 800;

export const STORAGE_KEYS = {
  NOTES: '@notiox/notes',
  FOLDERS: '@notiox/folders',
  TAGS: '@notiox/tags',
  REMINDERS: '@notiox/reminders',
  THEME: '@notiox/theme',
  TASKS: '@notiox/tasks',
  TASK_CATEGORIES: '@notiox/task-categories',
  SETTINGS: '@notiox/settings',
  HABITS: '@notiox/habits',
  JOURNAL: '@notiox/journal',
  POMODORO_SESSIONS: '@notiox/pomodoro-sessions',
  SHARED_LISTS: '@notiox/shared-lists',
  TASK_TEMPLATES: '@notiox/task-templates',
  BADGES: '@notiox/badges',
} as const;

export const NOTIFICATION_CHANNEL_ID = 'notiox-reminders';
export const DEFAULT_NOTE_TITLE = 'Untitled';
export const REMINDER_BODY_MAX_LENGTH = 100;

export const DEFAULT_POMODORO = {
  workMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  sessionsBeforeLongBreak: 4,
} as const;
