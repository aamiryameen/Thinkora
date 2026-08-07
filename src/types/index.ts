// Note & content
export type AttachmentType = 'photo' | 'camera' | 'pdf' | 'document' | 'sketch' | 'file';

export interface NoteAttachment {
  id: string;
  type: AttachmentType;
  uri: string;
  name?: string;
  mimeType?: string;
  createdAt: number;
  thumbnailUri?: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  plainText: string;
  folderId: string | null;
  tagIds: string[];
  isFavorite: boolean;
  isPinned: boolean;
  color: string | null; // hex color, null = default
  category: SmartCategory;
  attachments: NoteAttachment[];
  reminderId: string | null;
  /** Local uri of a background image behind the note content. */
  backgroundUri?: string | null;
  /** Font id from core/fonts; null uses the app default. */
  fontId?: string | null;
  archived?: boolean;
  /** Epoch ms when moved to trash; null when not trashed. */
  trashedAt?: number | null;
  createdAt: number;
  updatedAt: number;
}

// Folders
export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  order: number;
  createdAt: number;
  /** Cover colour (hex). Null falls back to a palette colour by index. */
  color?: string | null;
  /** Cover icon (Ionicons name). Null falls back to a generic book icon. */
  icon?: string | null;
}

// Tags (nested via parentId)
export interface Tag {
  id: string;
  name: string;
  parentId: string | null;
  color?: string;
  order: number;
  createdAt: number;
}

// Smart categories
export type SmartCategory = 'all' | 'work' | 'personal' | 'ideas' | 'todos' | 'none';

// Reminders
export type ReminderRepeat = 'none' | 'daily' | 'weekly' | 'custom';
export type ReminderTriggerType = 'time' | 'location';

export interface ReminderLocation {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  label?: string;
}

export interface Reminder {
  id: string;
  noteId: string;
  title: string;
  body: string;
  triggerType: ReminderTriggerType;
  date?: number;
  location?: ReminderLocation;
  repeat: ReminderRepeat;
  customRepeatDays?: number[];
  customRepeatIntervalMinutes?: number;
  notifeeId?: string;
  snoozedUntil?: number; // timestamp if currently snoozed
  createdAt: number;
}

// Sort & filter
export type SortField = 'createdAt' | 'updatedAt' | 'title' | 'tags';
export type SortOrder = 'asc' | 'desc';

export interface NotesFilter {
  searchQuery: string;
  folderId: string | null;
  tagIds: string[];
  category: SmartCategory | null;
  sortBy: SortField;
  sortOrder: SortOrder;
  favoritesOnly: boolean;
  pinnedOnly: boolean;
}

// Undo/redo history entry
export interface HistoryEntry {
  content: string;
  title: string;
  timestamp: number;
}

// ─── Tasks & Planner ─────────────────────────────────

export interface TaskCategory {
  id: string;
  name: string;
  color: string;
  icon: string;
}

export interface SubTask {
  id: string;
  title: string;
  completed: boolean;
}

export type TaskRepeat = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
export type TaskPriority = 'none' | 'low' | 'medium' | 'high';

export interface Task {
  id: string;
  title: string;
  completed: boolean;
  categoryId: string | null;
  dueDate: number | null;
  reminderDate: number | null;
  repeat: TaskRepeat;
  notes: string;
  attachments: NoteAttachment[];
  subtasks: SubTask[];
  priority: TaskPriority;
  /** Local uri of a background image behind the task detail. */
  backgroundUri?: string | null;
  /** Font id from core/fonts; null uses the app default. */
  fontId?: string | null;
  archived?: boolean;
  /** Epoch ms when moved to trash; null when not trashed. */
  trashedAt?: number | null;
  createdAt: number;
  updatedAt: number;
}

export type TaskSortField = 'dueDate' | 'createdAt' | 'title' | 'priority';

export interface TasksFilter {
  searchQuery: string;
  categoryId: string | null;
  showCompleted: boolean;
  sortBy: TaskSortField;
  sortOrder: SortOrder;
}

// ─── Habits ──────────────────────────────────────────

export interface Habit {
  id: string;
  name: string;
  icon: string;
  color: string;
  frequency: HabitFrequency;
  targetDays: number[]; // 0-6 for weekly, empty for daily
  reminderTime: string | null; // "HH:mm"
  completedDates: string[]; // "YYYY-MM-DD"
  createdAt: number;
  archived: boolean;
}

export type HabitFrequency = 'daily' | 'weekly' | 'custom';

// ─── Mood / Journal ──────────────────────────────────

export type MoodLevel = 1 | 2 | 3 | 4 | 5;

export interface JournalEntry {
  id: string;
  date: string; // "YYYY-MM-DD"
  mood: MoodLevel;
  note: string;
  createdAt: number;
}

// ─── Pomodoro ────────────────────────────────────────

export interface PomodoroSession {
  id: string;
  taskId: string | null;
  duration: number; // minutes
  completedAt: number;
  type: 'work' | 'break';
}

export interface PomodoroSettings {
  workMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  sessionsBeforeLongBreak: number;
}

// ─── Shared Lists ────────────────────────────────────

export interface SharedList {
  id: string;
  title: string;
  items: SharedListItem[];
  shareCode: string;
  createdAt: number;
  updatedAt: number;
}

export interface SharedListItem {
  id: string;
  title: string;
  completed: boolean;
  addedBy: string;
}

// ─── Task Templates ──────────────────────────────────

export interface TaskTemplate {
  id: string;
  name: string;
  icon: string;
  tasks: { title: string; subtasks: string[] }[];
}

// ─── Badges ──────────────────────────────────────────

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  unlockedAt: number | null;
  condition: BadgeCondition;
}

export type BadgeCondition =
  | { type: 'tasks_completed'; count: number }
  | { type: 'habit_streak'; days: number }
  | { type: 'pomodoro_sessions'; count: number }
  | { type: 'journal_entries'; count: number }
  | { type: 'notes_created'; count: number };

// ─── App Settings ────────────────────────────────────

export type AppThemeId = 'default' | 'ocean' | 'sunset' | 'forest' | 'berry' | 'lavender' | 'coral' | 'midnight' | 'mint' | 'rose' | 'amber';

export interface AppSettings {
  firstDayOfWeek: 0 | 1;
  notificationsEnabled: boolean;
  appLockEnabled: boolean;
  appLockPin: string | null;
  useBiometrics: boolean;
  themeColorId: AppThemeId;
  pomodoroSettings: PomodoroSettings;
  /** User-provided Gemini API key. Stored locally on-device only. */
  geminiApiKey: string | null;
  /** ISO 3166-1 alpha-2 code used to fetch public holidays for the calendar. */
  holidayCountry: string;
  /** Whether to schedule a 1-day-before notification for each public holiday. */
  holidayNotificationsEnabled: boolean;
}
