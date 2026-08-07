import { appSchema, tableSchema } from '@nozbe/watermelondb';

/**
 * WatermelonDB schema — version 3
 *
 * Complex fields (arrays / nested objects) are stored as JSON text columns.
 * Boolean fields use WatermelonDB's boolean column type (stored as 0/1).
 * Timestamps are stored as number (milliseconds since epoch).
 *
 * v2 adds the AI Knowledge Base tables: knowledge_bases, kb_documents,
 * kb_chunks, kb_messages.
 * v3 adds the Daily Planner tables: planner_blocks, planner_days.
 * See migrations.ts.
 */
export const schema = appSchema({
  version: 11,
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
        { name: 'background_uri', type: 'string', isOptional: true },
        { name: 'font_id', type: 'string', isOptional: true },
        { name: 'archived', type: 'boolean' },
        { name: 'trashed_at', type: 'number', isOptional: true },
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
        { name: 'color', type: 'string', isOptional: true },
        { name: 'icon', type: 'string', isOptional: true },
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
        { name: 'background_uri', type: 'string', isOptional: true },
        { name: 'font_id', type: 'string', isOptional: true },
        { name: 'archived', type: 'boolean' },
        { name: 'trashed_at', type: 'number', isOptional: true },
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

    // ── Knowledge Bases (AI Knowledge Base) ───────────────────────────────
    tableSchema({
      name: 'knowledge_bases',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'icon', type: 'string' },
        { name: 'color', type: 'string' },
        { name: 'description', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),

    // ── KB Documents ──────────────────────────────────────────────────────
    tableSchema({
      name: 'kb_documents',
      columns: [
        { name: 'kb_id', type: 'string', isIndexed: true },
        { name: 'title', type: 'string' },
        { name: 'source_type', type: 'string' },
        { name: 'file_name', type: 'string' },
        { name: 'file_uri', type: 'string', isOptional: true },
        { name: 'note_id', type: 'string', isOptional: true },
        { name: 'file_size', type: 'number' },
        { name: 'extracted_text', type: 'string' },
        { name: 'page_count', type: 'number' },
        { name: 'status', type: 'string' },
        { name: 'progress', type: 'number' },
        { name: 'error_message', type: 'string', isOptional: true },
        { name: 'chunk_count', type: 'number' },
        { name: 'language', type: 'string', isOptional: true },
        { name: 'quick_summary', type: 'string', isOptional: true },
        { name: 'standard_summary', type: 'string', isOptional: true },
        { name: 'key_points', type: 'string' },   // JSON string[]
        { name: 'tags', type: 'string' },         // JSON string[]
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),

    // ── KB Chunks (embedding vectors stored as JSON) ───────────────────────
    tableSchema({
      name: 'kb_chunks',
      columns: [
        { name: 'kb_id', type: 'string', isIndexed: true },
        { name: 'document_id', type: 'string', isIndexed: true },
        { name: 'chunk_index', type: 'number' },
        { name: 'text', type: 'string' },
        { name: 'heading', type: 'string', isOptional: true },
        { name: 'page', type: 'number', isOptional: true },
        { name: 'char_start', type: 'number' },
        { name: 'char_end', type: 'number' },
        { name: 'embedding', type: 'string', isOptional: true }, // JSON number[]
        { name: 'created_at', type: 'number' },
      ],
    }),

    // ── KB Chat Messages ──────────────────────────────────────────────────
    tableSchema({
      name: 'kb_messages',
      columns: [
        { name: 'kb_id', type: 'string', isIndexed: true },
        { name: 'role', type: 'string' },
        { name: 'content', type: 'string' },
        { name: 'citations', type: 'string' },  // JSON KbCitation[]
        { name: 'error', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
      ],
    }),

    // ── Planner Blocks (Daily Planner timeline) ───────────────────────────
    tableSchema({
      name: 'planner_blocks',
      columns: [
        { name: 'date', type: 'string', isIndexed: true },   // "YYYY-MM-DD"
        { name: 'title', type: 'string' },
        { name: 'kind', type: 'string' },
        { name: 'start_minutes', type: 'number' },           // from midnight
        { name: 'duration_minutes', type: 'number' },
        { name: 'color', type: 'string' },
        { name: 'notes', type: 'string' },
        { name: 'task_id', type: 'string', isOptional: true },
        { name: 'habit_id', type: 'string', isOptional: true },
        { name: 'completed', type: 'boolean' },
        { name: 'reminder_minutes_before', type: 'number', isOptional: true },
        { name: 'notifee_id', type: 'string', isOptional: true },
        { name: 'auto_scheduled', type: 'boolean' },
        { name: 'locked', type: 'boolean' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),

    // ── Planner Days (one plan per date) ──────────────────────────────────
    tableSchema({
      name: 'planner_days',
      columns: [
        { name: 'date', type: 'string', isIndexed: true },   // "YYYY-MM-DD"
        { name: 'focus', type: 'string' },
        { name: 'top_priorities', type: 'string' },          // JSON TopPriority[]
        { name: 'daily_goals', type: 'string' },             // JSON DailyGoal[]
        { name: 'notes', type: 'string' },
        { name: 'planned_at', type: 'number', isOptional: true },
        { name: 'reviewed_at', type: 'number', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),

    // ── Budget & Expenses ────────────────────────────────────────────────
    tableSchema({
      name: 'budget_categories',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'icon', type: 'string' },
        { name: 'color', type: 'string' },
        { name: 'kind', type: 'string' },
        { name: 'built_in', type: 'boolean' },
        { name: 'archived', type: 'boolean' },
        { name: 'order_index', type: 'number' },
        { name: 'created_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'transactions',
      columns: [
        { name: 'kind', type: 'string' },
        { name: 'amount', type: 'number' },
        { name: 'category_id', type: 'string', isOptional: true },
        { name: 'note', type: 'string' },
        { name: 'date', type: 'string', isIndexed: true },
        { name: 'recurring_id', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'budgets',
      columns: [
        { name: 'category_id', type: 'string', isOptional: true },
        { name: 'limit_amount', type: 'number' },
        { name: 'month', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'recurring_expenses',
      columns: [
        { name: 'kind', type: 'string' },
        { name: 'amount', type: 'number' },
        { name: 'category_id', type: 'string', isOptional: true },
        { name: 'note', type: 'string' },
        { name: 'interval', type: 'string' },
        { name: 'day_of_period', type: 'number' },
        { name: 'start_date', type: 'string' },
        { name: 'last_run_date', type: 'string', isOptional: true },
        { name: 'active', type: 'boolean' },
        { name: 'created_at', type: 'number' },
      ],
    }),

    // ── Medicine Reminder ────────────────────────────────────────────────
    tableSchema({
      name: 'family_profiles',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'color', type: 'string' },
        { name: 'icon', type: 'string' },
        { name: 'photo_uri', type: 'string', isOptional: true },
        { name: 'relationship', type: 'string' },
        { name: 'birth_date', type: 'string', isOptional: true },
        { name: 'gender', type: 'string' },
        { name: 'blood_group', type: 'string' },
        { name: 'allergies', type: 'string' },
        { name: 'conditions', type: 'string' },
        { name: 'emergency_contact', type: 'string' },
        { name: 'doctor_name', type: 'string' },
        { name: 'doctor_phone', type: 'string' },
        { name: 'doctor_notes', type: 'string' },
        { name: 'is_default', type: 'boolean' },
        { name: 'created_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'doctor_visits',
      columns: [
        { name: 'profile_id', type: 'string', isIndexed: true },
        { name: 'doctor_name', type: 'string' },
        { name: 'location', type: 'string' },
        { name: 'date', type: 'string', isIndexed: true },
        { name: 'minutes', type: 'number' },
        { name: 'reason', type: 'string' },
        { name: 'prescription_notes', type: 'string' },
        { name: 'follow_up_date', type: 'string', isOptional: true },
        { name: 'reminder_enabled', type: 'boolean' },
        { name: 'completed', type: 'boolean' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'medicines',
      columns: [
        { name: 'profile_id', type: 'string', isIndexed: true },
        { name: 'name', type: 'string' },
        { name: 'dosage', type: 'string' },
        { name: 'form', type: 'string' },
        { name: 'category', type: 'string' },
        { name: 'color', type: 'string' },
        { name: 'notes', type: 'string' },
        { name: 'photo_uri', type: 'string', isOptional: true },
        { name: 'meal_timing', type: 'string' },
        { name: 'expiry_date', type: 'string', isOptional: true },
        { name: 'sound_id', type: 'string' },
        { name: 'missed_alert_minutes', type: 'number', isOptional: true },
        { name: 'schedule_kind', type: 'string' },
        { name: 'times', type: 'string' },              // JSON number[]
        { name: 'weekdays', type: 'string' },           // JSON number[]
        { name: 'interval_days', type: 'number' },
        { name: 'start_date', type: 'string' },
        { name: 'end_date', type: 'string', isOptional: true },
        { name: 'reminders_enabled', type: 'boolean' },
        { name: 'stock_count', type: 'number', isOptional: true },
        { name: 'refill_threshold', type: 'number', isOptional: true },
        { name: 'archived', type: 'boolean' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'dose_logs',
      columns: [
        { name: 'medicine_id', type: 'string', isIndexed: true },
        { name: 'profile_id', type: 'string', isIndexed: true },
        { name: 'date', type: 'string', isIndexed: true },
        { name: 'scheduled_minutes', type: 'number', isOptional: true },
        { name: 'status', type: 'string' },
        { name: 'taken_at', type: 'number', isOptional: true },
        { name: 'snoozed_until', type: 'number', isOptional: true },
        { name: 'note', type: 'string' },
        { name: 'created_at', type: 'number' },
      ],
    }),

    // ── Whiteboard ───────────────────────────────────────────────────────
    tableSchema({
      name: 'boards',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'background', type: 'string' },
        { name: 'pattern', type: 'string' },
        { name: 'passcode', type: 'string', isOptional: true },
        { name: 'archived', type: 'boolean' },
        { name: 'pan_x', type: 'number' },
        { name: 'pan_y', type: 'number' },
        { name: 'zoom', type: 'number' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'board_items',
      columns: [
        { name: 'board_id', type: 'string', isIndexed: true },
        { name: 'kind', type: 'string' },
        { name: 'x', type: 'number' },
        { name: 'y', type: 'number' },
        { name: 'width', type: 'number' },
        { name: 'height', type: 'number' },
        { name: 'text', type: 'string' },
        { name: 'color', type: 'string' },
        { name: 'points', type: 'string' },          // JSON Point[]
        { name: 'stroke_width', type: 'number' },
        { name: 'uri', type: 'string', isOptional: true },
        { name: 'z', type: 'number' },
        { name: 'rotation', type: 'number' },
        { name: 'fill', type: 'string', isOptional: true },
        { name: 'pen', type: 'string' },
        { name: 'layer', type: 'number' },
        { name: 'locked', type: 'boolean' },
        { name: 'group_id', type: 'string', isOptional: true },
        { name: 'text_style', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'board_versions',
      columns: [
        { name: 'board_id', type: 'string', isIndexed: true },
        { name: 'label', type: 'string' },
        { name: 'snapshot', type: 'string' },
        { name: 'item_count', type: 'number' },
        { name: 'created_at', type: 'number' },
      ],
    }),
  ],
});
