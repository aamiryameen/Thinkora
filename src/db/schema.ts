import { appSchema, tableSchema } from '@nozbe/watermelondb';

/**
 * WatermelonDB schema — version 1
 *
 * Complex fields (arrays / nested objects) are stored as JSON text columns.
 * Boolean fields use WatermelonDB's boolean column type (stored as 0/1).
 * Timestamps are stored as number (milliseconds since epoch).
 */
export const schema = appSchema({
  version: 1,
  tables: [
    // ── Notes ────────────────────────────────────────────────────────────
    tableSchema({
      name: 'notes',
      columns: [
        { name: 'title', type: 'string' },
        { name: 'content', type: 'string' },       // rich-text HTML
        { name: 'plain_text', type: 'string' },
        { name: 'folder_id', type: 'string', isOptional: true },
        { name: 'tag_ids', type: 'string' },        // JSON array
        { name: 'is_favorite', type: 'boolean' },
        { name: 'is_pinned', type: 'boolean' },
        { name: 'color', type: 'string', isOptional: true },
        { name: 'category', type: 'string' },       // SmartCategory
        { name: 'attachments', type: 'string' },    // JSON array of NoteAttachment
        { name: 'reminder_id', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),

    // ── Folders ──────────────────────────────────────────────────────────
    tableSchema({
      name: 'folders',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'parent_id', type: 'string', isOptional: true },
        { name: 'order_index', type: 'number' },
        { name: 'created_at', type: 'number' },
      ],
    }),

    // ── Tags ─────────────────────────────────────────────────────────────
    tableSchema({
      name: 'tags',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'parent_id', type: 'string', isOptional: true },
        { name: 'color', type: 'string', isOptional: true },
        { name: 'order_index', type: 'number' },
        { name: 'created_at', type: 'number' },
      ],
    }),

    // ── Reminders ────────────────────────────────────────────────────────
    tableSchema({
      name: 'reminders',
      columns: [
        { name: 'note_id', type: 'string' },
        { name: 'title', type: 'string' },
        { name: 'body', type: 'string' },
        { name: 'trigger_type', type: 'string' },  // 'time' | 'location'
        { name: 'date', type: 'number', isOptional: true },
        { name: 'location', type: 'string', isOptional: true }, // JSON ReminderLocation
        { name: 'repeat', type: 'string' },
        { name: 'custom_repeat_days', type: 'string', isOptional: true }, // JSON number[]
        { name: 'custom_repeat_interval_minutes', type: 'number', isOptional: true },
        { name: 'notifee_id', type: 'string', isOptional: true },
        { name: 'snoozed_until', type: 'number', isOptional: true },
        { name: 'created_at', type: 'number' },
      ],
    }),

    // ── Tasks ────────────────────────────────────────────────────────────
    tableSchema({
      name: 'tasks',
      columns: [
        { name: 'title', type: 'string' },
        { name: 'completed', type: 'boolean' },
        { name: 'category_id', type: 'string', isOptional: true },
        { name: 'due_date', type: 'number', isOptional: true },
        { name: 'reminder_date', type: 'number', isOptional: true },
        { name: 'repeat', type: 'string' },
        { name: 'notes', type: 'string' },
        { name: 'attachments', type: 'string' },   // JSON array
        { name: 'subtasks', type: 'string' },       // JSON array of SubTask
        { name: 'priority', type: 'string' },
        { name: 'my_day', type: 'boolean' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),

    // ── Task Categories ───────────────────────────────────────────────────
    tableSchema({
      name: 'task_categories',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'color', type: 'string' },
        { name: 'icon', type: 'string' },
      ],
    }),

    // ── Habits ───────────────────────────────────────────────────────────
    tableSchema({
      name: 'habits',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'icon', type: 'string' },
        { name: 'color', type: 'string' },
        { name: 'frequency', type: 'string' },
        { name: 'target_days', type: 'string' },        // JSON number[]
        { name: 'reminder_time', type: 'string', isOptional: true },
        { name: 'completed_dates', type: 'string' },    // JSON string[]
        { name: 'archived', type: 'boolean' },
        { name: 'created_at', type: 'number' },
      ],
    }),

    // ── Journal Entries ───────────────────────────────────────────────────
    tableSchema({
      name: 'journal_entries',
      columns: [
        { name: 'date', type: 'string' },   // "YYYY-MM-DD"
        { name: 'mood', type: 'number' },
        { name: 'note', type: 'string' },
        { name: 'created_at', type: 'number' },
      ],
    }),

    // ── Pomodoro Sessions ─────────────────────────────────────────────────
    tableSchema({
      name: 'pomodoro_sessions',
      columns: [
        { name: 'task_id', type: 'string', isOptional: true },
        { name: 'duration', type: 'number' },
        { name: 'completed_at', type: 'number' },
        { name: 'type', type: 'string' },   // 'work' | 'break'
      ],
    }),

    // ── Shared Lists ──────────────────────────────────────────────────────
    tableSchema({
      name: 'shared_lists',
      columns: [
        { name: 'title', type: 'string' },
        { name: 'items', type: 'string' },  // JSON array of SharedListItem
        { name: 'share_code', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),

    // ── Task Templates ────────────────────────────────────────────────────
    tableSchema({
      name: 'task_templates',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'icon', type: 'string' },
        { name: 'tasks', type: 'string' },  // JSON array
      ],
    }),

    // ── Badges ────────────────────────────────────────────────────────────
    tableSchema({
      name: 'badges',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'description', type: 'string' },
        { name: 'icon', type: 'string' },
        { name: 'color', type: 'string' },
        { name: 'unlocked_at', type: 'number', isOptional: true },
        { name: 'condition', type: 'string' }, // JSON BadgeCondition
      ],
    }),

    // ── Settings (single-row table) ───────────────────────────────────────
    tableSchema({
      name: 'settings',
      columns: [
        { name: 'key', type: 'string' },
        { name: 'value', type: 'string' }, // JSON value
      ],
    }),
  ],
});
