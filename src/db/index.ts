import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { schema } from './schema';
import { migrations } from './migrations';
import { NoteModel } from './models/NoteModel';
import { FolderModel } from './models/FolderModel';
import { TagModel } from './models/TagModel';
import { ReminderModel } from './models/ReminderModel';
import { TaskModel } from './models/TaskModel';
import { TaskCategoryModel } from './models/TaskCategoryModel';
import { HabitModel } from './models/HabitModel';
import { JournalEntryModel } from './models/JournalEntryModel';
import { PomodoroSessionModel } from './models/PomodoroSessionModel';
import { SharedListModel } from './models/SharedListModel';
import { TaskTemplateModel } from './models/TaskTemplateModel';
import { BadgeModel } from './models/BadgeModel';
import { SettingModel } from './models/SettingModel';

const adapter = new SQLiteAdapter({
  schema,
  migrations,
  dbName: 'thinkora',
  jsi: true,
  onSetUpError: (error) => {
    console.error('[WatermelonDB] Setup error:', error);
  },
});

export const database = new Database({
  adapter,
  modelClasses: [
    NoteModel,
    FolderModel,
    TagModel,
    ReminderModel,
    TaskModel,
    TaskCategoryModel,
    HabitModel,
    JournalEntryModel,
    PomodoroSessionModel,
    SharedListModel,
    TaskTemplateModel,
    BadgeModel,
    SettingModel,
  ],
});

// Typed collection accessors
export const notesCollection = database.get<NoteModel>('notes');
export const foldersCollection = database.get<FolderModel>('folders');
export const tagsCollection = database.get<TagModel>('tags');
export const remindersCollection = database.get<ReminderModel>('reminders');
export const tasksCollection = database.get<TaskModel>('tasks');
export const taskCategoriesCollection = database.get<TaskCategoryModel>('task_categories');
export const habitsCollection = database.get<HabitModel>('habits');
export const journalCollection = database.get<JournalEntryModel>('journal_entries');
export const pomodoroCollection = database.get<PomodoroSessionModel>('pomodoro_sessions');
export const sharedListsCollection = database.get<SharedListModel>('shared_lists');
export const taskTemplatesCollection = database.get<TaskTemplateModel>('task_templates');
export const badgesCollection = database.get<BadgeModel>('badges');
export const settingsCollection = database.get<SettingModel>('settings');
