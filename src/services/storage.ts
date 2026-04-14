/**
 * Storage service — backed by WatermelonDB (SQLite via JSI)
 *
 * Public API is identical to the old AsyncStorage version so that
 * AppContext / FeaturesContext need no structural changes.
 *
 * Each "set*" call runs inside a WatermelonDB batch write for atomicity
 * and performance.  Each "get*" call does a plain query and maps models
 * to plain TypeScript objects via model.toPlain().
 */

import { Q } from '@nozbe/watermelondb';
import { DEFAULT_POMODORO } from '../core/constants';
import {
  database,
  notesCollection,
  foldersCollection,
  tagsCollection,
  remindersCollection,
  tasksCollection,
  taskCategoriesCollection,
  habitsCollection,
  journalCollection,
  pomodoroCollection,
  sharedListsCollection,
  taskTemplatesCollection,
  badgesCollection,
  settingsCollection,
} from '../db';
import type {
  Note, Folder, Tag, Reminder, Task, TaskCategory, AppSettings,
  Habit, JournalEntry, PomodoroSession, SharedList, TaskTemplate, Badge,
} from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function j(v: unknown): string { return JSON.stringify(v); }
function jOpt(v: unknown): string | null { return v == null ? null : JSON.stringify(v); }
function n(v: number | null | undefined): number { return v ?? 0; }

const defaultSettings: AppSettings = {
  firstDayOfWeek: 0,
  notificationsEnabled: true,
  appLockEnabled: false,
  appLockPin: null,
  useBiometrics: false,
  themeColorId: 'default',
  pomodoroSettings: { ...DEFAULT_POMODORO },
};

// ─── Settings helpers (key/value table) ──────────────────────────────────────

async function getSetting<T>(key: string, fallback: T): Promise<T> {
  try {
    const rows = await settingsCollection.query(Q.where('key', key)).fetch();
    if (rows.length === 0) return fallback;
    return JSON.parse(rows[0].value) as T;
  } catch { return fallback; }
}

async function setSetting(key: string, value: unknown): Promise<void> {
  await database.write(async () => {
    const rows = await settingsCollection.query(Q.where('key', key)).fetch();
    if (rows.length > 0) {
      await rows[0].update((r) => { r.value = j(value); });
    } else {
      await settingsCollection.create((r) => { r.key = key; r.value = j(value); });
    }
  });
}

// ─── Notes ────────────────────────────────────────────────────────────────────

async function getNotes(): Promise<Note[]> {
  const rows = await notesCollection.query().fetch();
  return rows.map((r) => r.toPlain());
}

async function setNotes(notes: Note[]): Promise<void> {
  await database.write(async () => {
    const existing = await notesCollection.query().fetch();
    const existingMap = new Map(existing.map((r) => [r.id, r]));
    const incomingIds = new Set(notes.map((n) => n.id));

    const ops: any[] = [];

    // Delete removed
    for (const row of existing) {
      if (!incomingIds.has(row.id)) ops.push(row.prepareDestroyPermanently());
    }

    for (const note of notes) {
      const row = existingMap.get(note.id);
      if (row) {
        ops.push(row.prepareUpdate((r) => {
          r.title = note.title;
          r.content = note.content;
          r.plainText = note.plainText;
          r.folderId = note.folderId ?? null;
          r.tagIdsRaw = j(note.tagIds);
          r.isFavorite = note.isFavorite;
          r.isPinned = note.isPinned;
          r.color = note.color ?? null;
          r.category = note.category;
          r.attachmentsRaw = j(note.attachments);
          r.reminderId = note.reminderId ?? null;
          r.updatedAt = note.updatedAt;
        }));
      } else {
        ops.push(notesCollection.prepareCreate((r) => {
          // @ts-ignore — WatermelonDB allows setting id on prepareCreate
          r._raw.id = note.id;
          r.title = note.title;
          r.content = note.content;
          r.plainText = note.plainText;
          r.folderId = note.folderId ?? null;
          r.tagIdsRaw = j(note.tagIds);
          r.isFavorite = note.isFavorite;
          r.isPinned = note.isPinned;
          r.color = note.color ?? null;
          r.category = note.category;
          r.attachmentsRaw = j(note.attachments);
          r.reminderId = note.reminderId ?? null;
          r.createdAt = note.createdAt;
          r.updatedAt = note.updatedAt;
        }));
      }
    }

    await database.batch(...ops);
  });
}

// ─── Folders ──────────────────────────────────────────────────────────────────

async function getFolders(): Promise<Folder[]> {
  const rows = await foldersCollection.query().fetch();
  return rows.map((r) => r.toPlain());
}

async function setFolders(folders: Folder[]): Promise<void> {
  await database.write(async () => {
    const existing = await foldersCollection.query().fetch();
    const existingMap = new Map(existing.map((r) => [r.id, r]));
    const incomingIds = new Set(folders.map((f) => f.id));
    const ops: any[] = [];

    for (const row of existing) {
      if (!incomingIds.has(row.id)) ops.push(row.prepareDestroyPermanently());
    }
    for (const folder of folders) {
      const row = existingMap.get(folder.id);
      if (row) {
        ops.push(row.prepareUpdate((r) => {
          r.name = folder.name;
          r.parentId = folder.parentId ?? null;
          r.order = folder.order;
        }));
      } else {
        ops.push(foldersCollection.prepareCreate((r) => {
          // @ts-ignore
          r._raw.id = folder.id;
          r.name = folder.name;
          r.parentId = folder.parentId ?? null;
          r.order = folder.order;
          r.createdAt = folder.createdAt;
        }));
      }
    }
    await database.batch(...ops);
  });
}

// ─── Tags ─────────────────────────────────────────────────────────────────────

async function getTags(): Promise<Tag[]> {
  const rows = await tagsCollection.query().fetch();
  return rows.map((r) => r.toPlain());
}

async function setTags(tags: Tag[]): Promise<void> {
  await database.write(async () => {
    const existing = await tagsCollection.query().fetch();
    const existingMap = new Map(existing.map((r) => [r.id, r]));
    const incomingIds = new Set(tags.map((t) => t.id));
    const ops: any[] = [];

    for (const row of existing) {
      if (!incomingIds.has(row.id)) ops.push(row.prepareDestroyPermanently());
    }
    for (const tag of tags) {
      const row = existingMap.get(tag.id);
      if (row) {
        ops.push(row.prepareUpdate((r) => {
          r.name = tag.name;
          r.parentId = tag.parentId ?? null;
          r.color = tag.color;
          r.order = tag.order;
        }));
      } else {
        ops.push(tagsCollection.prepareCreate((r) => {
          // @ts-ignore
          r._raw.id = tag.id;
          r.name = tag.name;
          r.parentId = tag.parentId ?? null;
          r.color = tag.color;
          r.order = tag.order;
          r.createdAt = tag.createdAt;
        }));
      }
    }
    await database.batch(...ops);
  });
}

// ─── Reminders ────────────────────────────────────────────────────────────────

async function getReminders(): Promise<Reminder[]> {
  const rows = await remindersCollection.query().fetch();
  return rows.map((r) => r.toPlain());
}

async function setReminders(reminders: Reminder[]): Promise<void> {
  await database.write(async () => {
    const existing = await remindersCollection.query().fetch();
    const existingMap = new Map(existing.map((r) => [r.id, r]));
    const incomingIds = new Set(reminders.map((r) => r.id));
    const ops: any[] = [];

    for (const row of existing) {
      if (!incomingIds.has(row.id)) ops.push(row.prepareDestroyPermanently());
    }
    for (const rem of reminders) {
      const row = existingMap.get(rem.id);
      const apply = (r: any) => {
        r.noteId = rem.noteId;
        r.title = rem.title;
        r.body = rem.body;
        r.triggerType = rem.triggerType;
        r.date = rem.date ?? null;
        r.locationRaw = jOpt(rem.location);
        r.repeat = rem.repeat;
        r.customRepeatDaysRaw = jOpt(rem.customRepeatDays);
        r.customRepeatIntervalMinutes = rem.customRepeatIntervalMinutes ?? null;
        r.notifeeId = rem.notifeeId ?? null;
        r.snoozedUntil = rem.snoozedUntil ?? null;
      };
      if (row) {
        ops.push(row.prepareUpdate(apply));
      } else {
        ops.push(remindersCollection.prepareCreate((r) => {
          // @ts-ignore
          r._raw.id = rem.id;
          apply(r);
          r.createdAt = rem.createdAt;
        }));
      }
    }
    await database.batch(...ops);
  });
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

async function getTasks(): Promise<Task[]> {
  const rows = await tasksCollection.query().fetch();
  return rows.map((r) => r.toPlain());
}

async function setTasks(tasks: Task[]): Promise<void> {
  await database.write(async () => {
    const existing = await tasksCollection.query().fetch();
    const existingMap = new Map(existing.map((r) => [r.id, r]));
    const incomingIds = new Set(tasks.map((t) => t.id));
    const ops: any[] = [];

    for (const row of existing) {
      if (!incomingIds.has(row.id)) ops.push(row.prepareDestroyPermanently());
    }
    for (const task of tasks) {
      const row = existingMap.get(task.id);
      const apply = (r: any) => {
        r.title = task.title;
        r.completed = task.completed;
        r.categoryId = task.categoryId ?? null;
        r.dueDate = task.dueDate ?? null;
        r.reminderDate = task.reminderDate ?? null;
        r.repeat = task.repeat;
        r.notes = task.notes;
        r.attachmentsRaw = j(task.attachments);
        r.subtasksRaw = j(task.subtasks);
        r.priority = task.priority;
        r.myDay = false;
        r.updatedAt = task.updatedAt;
      };
      if (row) {
        ops.push(row.prepareUpdate(apply));
      } else {
        ops.push(tasksCollection.prepareCreate((r) => {
          // @ts-ignore
          r._raw.id = task.id;
          apply(r);
          r.createdAt = task.createdAt;
        }));
      }
    }
    await database.batch(...ops);
  });
}

// ─── Task Categories ──────────────────────────────────────────────────────────

async function getTaskCategories(): Promise<TaskCategory[]> {
  const rows = await taskCategoriesCollection.query().fetch();
  return rows.map((r) => r.toPlain());
}

async function setTaskCategories(cats: TaskCategory[]): Promise<void> {
  await database.write(async () => {
    const existing = await taskCategoriesCollection.query().fetch();
    const existingMap = new Map(existing.map((r) => [r.id, r]));
    const incomingIds = new Set(cats.map((c) => c.id));
    const ops: any[] = [];

    for (const row of existing) {
      if (!incomingIds.has(row.id)) ops.push(row.prepareDestroyPermanently());
    }
    for (const cat of cats) {
      const row = existingMap.get(cat.id);
      if (row) {
        ops.push(row.prepareUpdate((r) => { r.name = cat.name; r.color = cat.color; r.icon = cat.icon; }));
      } else {
        ops.push(taskCategoriesCollection.prepareCreate((r) => {
          // @ts-ignore
          r._raw.id = cat.id;
          r.name = cat.name; r.color = cat.color; r.icon = cat.icon;
        }));
      }
    }
    await database.batch(...ops);
  });
}

// ─── Habits ───────────────────────────────────────────────────────────────────

async function getHabits(): Promise<Habit[]> {
  const rows = await habitsCollection.query().fetch();
  return rows.map((r) => r.toPlain());
}

async function setHabits(habits: Habit[]): Promise<void> {
  await database.write(async () => {
    const existing = await habitsCollection.query().fetch();
    const existingMap = new Map(existing.map((r) => [r.id, r]));
    const incomingIds = new Set(habits.map((h) => h.id));
    const ops: any[] = [];

    for (const row of existing) {
      if (!incomingIds.has(row.id)) ops.push(row.prepareDestroyPermanently());
    }
    for (const habit of habits) {
      const row = existingMap.get(habit.id);
      const apply = (r: any) => {
        r.name = habit.name;
        r.icon = habit.icon;
        r.color = habit.color;
        r.frequency = habit.frequency;
        r.targetDaysRaw = j(habit.targetDays);
        r.reminderTime = habit.reminderTime ?? null;
        r.completedDatesRaw = j(habit.completedDates);
        r.archived = habit.archived;
      };
      if (row) {
        ops.push(row.prepareUpdate(apply));
      } else {
        ops.push(habitsCollection.prepareCreate((r) => {
          // @ts-ignore
          r._raw.id = habit.id;
          apply(r);
          r.createdAt = habit.createdAt;
        }));
      }
    }
    await database.batch(...ops);
  });
}

// ─── Journal ──────────────────────────────────────────────────────────────────

async function getJournalEntries(): Promise<JournalEntry[]> {
  const rows = await journalCollection.query().fetch();
  return rows.map((r) => r.toPlain());
}

async function setJournalEntries(entries: JournalEntry[]): Promise<void> {
  await database.write(async () => {
    const existing = await journalCollection.query().fetch();
    const existingMap = new Map(existing.map((r) => [r.id, r]));
    const incomingIds = new Set(entries.map((e) => e.id));
    const ops: any[] = [];

    for (const row of existing) {
      if (!incomingIds.has(row.id)) ops.push(row.prepareDestroyPermanently());
    }
    for (const entry of entries) {
      const row = existingMap.get(entry.id);
      if (row) {
        ops.push(row.prepareUpdate((r) => { r.date = entry.date; r.mood = entry.mood; r.note = entry.note; }));
      } else {
        ops.push(journalCollection.prepareCreate((r) => {
          // @ts-ignore
          r._raw.id = entry.id;
          r.date = entry.date; r.mood = entry.mood; r.note = entry.note;
          r.createdAt = entry.createdAt;
        }));
      }
    }
    await database.batch(...ops);
  });
}

// ─── Pomodoro Sessions ────────────────────────────────────────────────────────

async function getPomodoroSessions(): Promise<PomodoroSession[]> {
  const rows = await pomodoroCollection.query().fetch();
  return rows.map((r) => r.toPlain());
}

async function setPomodoroSessions(sessions: PomodoroSession[]): Promise<void> {
  await database.write(async () => {
    const existing = await pomodoroCollection.query().fetch();
    const existingMap = new Map(existing.map((r) => [r.id, r]));
    const incomingIds = new Set(sessions.map((s) => s.id));
    const ops: any[] = [];

    for (const row of existing) {
      if (!incomingIds.has(row.id)) ops.push(row.prepareDestroyPermanently());
    }
    for (const sess of sessions) {
      const row = existingMap.get(sess.id);
      if (row) {
        ops.push(row.prepareUpdate((r) => {
          r.taskId = sess.taskId ?? null;
          r.duration = sess.duration;
          r.completedAt = sess.completedAt;
          r.type = sess.type;
        }));
      } else {
        ops.push(pomodoroCollection.prepareCreate((r) => {
          // @ts-ignore
          r._raw.id = sess.id;
          r.taskId = sess.taskId ?? null;
          r.duration = sess.duration;
          r.completedAt = sess.completedAt;
          r.type = sess.type;
        }));
      }
    }
    await database.batch(...ops);
  });
}

// ─── Shared Lists ─────────────────────────────────────────────────────────────

async function getSharedLists(): Promise<SharedList[]> {
  const rows = await sharedListsCollection.query().fetch();
  return rows.map((r) => r.toPlain());
}

async function setSharedLists(lists: SharedList[]): Promise<void> {
  await database.write(async () => {
    const existing = await sharedListsCollection.query().fetch();
    const existingMap = new Map(existing.map((r) => [r.id, r]));
    const incomingIds = new Set(lists.map((l) => l.id));
    const ops: any[] = [];

    for (const row of existing) {
      if (!incomingIds.has(row.id)) ops.push(row.prepareDestroyPermanently());
    }
    for (const list of lists) {
      const row = existingMap.get(list.id);
      if (row) {
        ops.push(row.prepareUpdate((r) => { r.title = list.title; r.itemsRaw = j(list.items); r.updatedAt = list.updatedAt; }));
      } else {
        ops.push(sharedListsCollection.prepareCreate((r) => {
          // @ts-ignore
          r._raw.id = list.id;
          r.title = list.title; r.itemsRaw = j(list.items); r.shareCode = list.shareCode;
          r.createdAt = list.createdAt; r.updatedAt = list.updatedAt;
        }));
      }
    }
    await database.batch(...ops);
  });
}

// ─── Task Templates ───────────────────────────────────────────────────────────

async function getTaskTemplates(): Promise<TaskTemplate[]> {
  const rows = await taskTemplatesCollection.query().fetch();
  return rows.map((r) => r.toPlain());
}

async function setTaskTemplates(templates: TaskTemplate[]): Promise<void> {
  await database.write(async () => {
    const existing = await taskTemplatesCollection.query().fetch();
    const existingMap = new Map(existing.map((r) => [r.id, r]));
    const incomingIds = new Set(templates.map((t) => t.id));
    const ops: any[] = [];

    for (const row of existing) {
      if (!incomingIds.has(row.id)) ops.push(row.prepareDestroyPermanently());
    }
    for (const tpl of templates) {
      const row = existingMap.get(tpl.id);
      if (row) {
        ops.push(row.prepareUpdate((r) => { r.name = tpl.name; r.icon = tpl.icon; r.tasksRaw = j(tpl.tasks); }));
      } else {
        ops.push(taskTemplatesCollection.prepareCreate((r) => {
          // @ts-ignore
          r._raw.id = tpl.id;
          r.name = tpl.name; r.icon = tpl.icon; r.tasksRaw = j(tpl.tasks);
        }));
      }
    }
    await database.batch(...ops);
  });
}

// ─── Badges ───────────────────────────────────────────────────────────────────

async function getBadges(): Promise<Badge[]> {
  const rows = await badgesCollection.query().fetch();
  return rows.map((r) => r.toPlain());
}

async function setBadges(badges: Badge[]): Promise<void> {
  await database.write(async () => {
    const existing = await badgesCollection.query().fetch();
    const existingMap = new Map(existing.map((r) => [r.id, r]));
    const incomingIds = new Set(badges.map((b) => b.id));
    const ops: any[] = [];

    for (const row of existing) {
      if (!incomingIds.has(row.id)) ops.push(row.prepareDestroyPermanently());
    }
    for (const badge of badges) {
      const row = existingMap.get(badge.id);
      if (row) {
        ops.push(row.prepareUpdate((r) => {
          r.name = badge.name; r.description = badge.description; r.icon = badge.icon;
          r.color = badge.color; r.unlockedAt = badge.unlockedAt ?? null; r.conditionRaw = j(badge.condition);
        }));
      } else {
        ops.push(badgesCollection.prepareCreate((r) => {
          // @ts-ignore
          r._raw.id = badge.id;
          r.name = badge.name; r.description = badge.description; r.icon = badge.icon;
          r.color = badge.color; r.unlockedAt = badge.unlockedAt ?? null; r.conditionRaw = j(badge.condition);
        }));
      }
    }
    await database.batch(...ops);
  });
}

// ─── App Settings ─────────────────────────────────────────────────────────────

async function getSettings(): Promise<AppSettings> {
  return getSetting<AppSettings>('app_settings', defaultSettings);
}

async function setSettings(s: AppSettings): Promise<void> {
  return setSetting('app_settings', s);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const storage = {
  getNotes, setNotes,
  getFolders, setFolders,
  getTags, setTags,
  getReminders, setReminders,
  getTasks, setTasks,
  getTaskCategories, setTaskCategories,
  getSettings, setSettings,
  getHabits, setHabits,
  getJournalEntries, setJournalEntries,
  getPomodoroSessions, setPomodoroSessions,
  getSharedLists, setSharedLists,
  getTaskTemplates, setTaskTemplates,
  getBadges, setBadges,
};
