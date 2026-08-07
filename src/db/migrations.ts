/**
 * WatermelonDB Schema Migrations
 *
 * IMPORTANT RULES:
 * ─────────────────────────────────────────────────────────────────
 * 1. NEVER delete or edit a past migration — users who already
 *    ran it won't re-run it, and new users need the full chain.
 * 2. ALWAYS add new migrations at the end of the array.
 * 3. Schema version in schema.ts MUST equal the latest toVersion here.
 * 4. After adding a migration:
 *    a. Bump `version` in schema.ts to match
 *    b. Add the new column/table to schema.ts tables (for fresh installs)
 *    c. Update the model class if adding columns
 *    d. Update storage.ts if the field needs to be read/written
 * 5. Test on a device with the OLD schema before releasing.
 * ─────────────────────────────────────────────────────────────────
 *
 * Available migration steps:
 *
 *   addColumns({
 *     table: 'tasks',
 *     columns: [
 *       { name: 'color', type: 'string', isOptional: true },
 *     ],
 *   })
 *
 *   createTable({
 *     name: 'goals',
 *     columns: [
 *       { name: 'title', type: 'string' },
 *       { name: 'completed', type: 'boolean' },
 *       { name: 'created_at', type: 'number' },
 *     ],
 *   })
 *
 *   unsafeExecuteSql('UPDATE tasks SET color = null WHERE color = ""')
 *
 * ─────────────────────────────────────────────────────────────────
 *
 * CURRENT SCHEMA VERSION: 11
 * PRODUCTION VERSIONS HISTORY:
 *   v1.0 – v1.2 : schema version 1 (initial release)
 *   v1.3        : schema version 2 (AI Knowledge Base tables)
 *   v1.4        : schema version 3 (Daily Planner tables)
 *   v1.4.11     : schema version 4 (notebook cover columns)
 *   v1.4.11     : schema version 5 (budget & expense tables)
 *   v1.4.11     : schema version 6 (medicine reminder tables)
 *   v1.4.11     : schema version 7 (whiteboard tables)
 *   v1.4.11     : schema version 8 (whiteboard shapes, layers, versions)
 *   v1.4.11     : schema version 9 (note/task backgrounds, fonts, archive, trash)
 *   v1.4.11     : schema version 10 (medicine photo, category, meal, snooze)
 *   v1.4.11     : schema version 11 (family profile details, doctor visits)
 *
 * ─────────────────────────────────────────────────────────────────
 */

import {
  schemaMigrations,
  createTable,
  addColumns,
  // Uncomment these as needed:
  // unsafeExecuteSql,
} from '@nozbe/watermelondb/Schema/migrations';

export const migrations = schemaMigrations({
  migrations: [
    // ┌─────────────────────────────────────────────────────────┐
    // │ Migration template (copy this when adding a new one):   │
    // ├─────────────────────────────────────────────────────────┤
    // │  {                                                      │
    // │    toVersion: 2,                                        │
    // │    steps: [                                             │
    // │      addColumns({                                       │
    // │        table: 'tasks',                                  │
    // │        columns: [                                       │
    // │          { name: 'new_field', type: 'string',           │
    // │            isOptional: true },                          │
    // │        ],                                               │
    // │      }),                                                │
    // │    ],                                                   │
    // │  },                                                     │
    // └─────────────────────────────────────────────────────────┘

    // ── v2: AI Knowledge Base ─────────────────────────────────
    // Four new tables. Purely additive — no existing table is touched,
    // so upgrading users keep all notes, tasks, habits and settings.
    {
      toVersion: 2,
      steps: [
        createTable({
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
        createTable({
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
            { name: 'key_points', type: 'string' },
            { name: 'tags', type: 'string' },
            { name: 'created_at', type: 'number' },
            { name: 'updated_at', type: 'number' },
          ],
        }),
        createTable({
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
            { name: 'embedding', type: 'string', isOptional: true },
            { name: 'created_at', type: 'number' },
          ],
        }),
        createTable({
          name: 'kb_messages',
          columns: [
            { name: 'kb_id', type: 'string', isIndexed: true },
            { name: 'role', type: 'string' },
            { name: 'content', type: 'string' },
            { name: 'citations', type: 'string' },
            { name: 'error', type: 'string', isOptional: true },
            { name: 'created_at', type: 'number' },
          ],
        }),
      ],
    },

    // ── v3: Daily Planner ─────────────────────────────────────
    // Two new tables. Purely additive — tasks, habits and goals are
    // read by the planner but never modified structurally.
    {
      toVersion: 3,
      steps: [
        createTable({
          name: 'planner_blocks',
          columns: [
            { name: 'date', type: 'string', isIndexed: true },
            { name: 'title', type: 'string' },
            { name: 'kind', type: 'string' },
            { name: 'start_minutes', type: 'number' },
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
        createTable({
          name: 'planner_days',
          columns: [
            { name: 'date', type: 'string', isIndexed: true },
            { name: 'focus', type: 'string' },
            { name: 'top_priorities', type: 'string' },
            { name: 'daily_goals', type: 'string' },
            { name: 'notes', type: 'string' },
            { name: 'planned_at', type: 'number', isOptional: true },
            { name: 'reviewed_at', type: 'number', isOptional: true },
            { name: 'created_at', type: 'number' },
            { name: 'updated_at', type: 'number' },
          ],
        }),
      ],
    },

    // ── v4: Notebook covers ───────────────────────────────────
    // Two optional columns on the existing folders table. Additive and
    // nullable, so every existing folder keeps its name, nesting and
    // notes; a null cover falls back to a palette colour by index.
    {
      toVersion: 4,
      steps: [
        addColumns({
          table: 'folders',
          columns: [
            { name: 'color', type: 'string', isOptional: true },
            { name: 'icon', type: 'string', isOptional: true },
          ],
        }),
      ],
    },

    // ── v5: Budget & Expenses ─────────────────────────────────
    // Four new tables. Purely additive — nothing existing is touched, so
    // upgrading users keep every note, task, habit and notebook.
    {
      toVersion: 5,
      steps: [
        createTable({
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
        createTable({
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
        createTable({
          name: 'budgets',
          columns: [
            { name: 'category_id', type: 'string', isOptional: true },
            { name: 'limit_amount', type: 'number' },
            { name: 'month', type: 'string', isOptional: true },
            { name: 'created_at', type: 'number' },
          ],
        }),
        createTable({
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
      ],
    },

    // ── v6: Medicine Reminder ─────────────────────────────────
    // Three new tables. Purely additive — no existing table is touched.
    {
      toVersion: 6,
      steps: [
        createTable({
          name: 'family_profiles',
          columns: [
            { name: 'name', type: 'string' },
            { name: 'color', type: 'string' },
            { name: 'icon', type: 'string' },
            { name: 'is_default', type: 'boolean' },
            { name: 'created_at', type: 'number' },
          ],
        }),
        createTable({
          name: 'medicines',
          columns: [
            { name: 'profile_id', type: 'string', isIndexed: true },
            { name: 'name', type: 'string' },
            { name: 'dosage', type: 'string' },
            { name: 'form', type: 'string' },
            { name: 'color', type: 'string' },
            { name: 'notes', type: 'string' },
            { name: 'schedule_kind', type: 'string' },
            { name: 'times', type: 'string' },
            { name: 'weekdays', type: 'string' },
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
        createTable({
          name: 'dose_logs',
          columns: [
            { name: 'medicine_id', type: 'string', isIndexed: true },
            { name: 'profile_id', type: 'string', isIndexed: true },
            { name: 'date', type: 'string', isIndexed: true },
            { name: 'scheduled_minutes', type: 'number', isOptional: true },
            { name: 'status', type: 'string' },
            { name: 'taken_at', type: 'number', isOptional: true },
            { name: 'note', type: 'string' },
            { name: 'created_at', type: 'number' },
          ],
        }),
      ],
    },

    // ── v7: Whiteboard ────────────────────────────────────────
    // Two new tables. Purely additive.
    {
      toVersion: 7,
      steps: [
        createTable({
          name: 'boards',
          columns: [
            { name: 'name', type: 'string' },
            { name: 'background', type: 'string' },
            { name: 'pan_x', type: 'number' },
            { name: 'pan_y', type: 'number' },
            { name: 'zoom', type: 'number' },
            { name: 'created_at', type: 'number' },
            { name: 'updated_at', type: 'number' },
          ],
        }),
        createTable({
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
            { name: 'points', type: 'string' },
            { name: 'stroke_width', type: 'number' },
            { name: 'uri', type: 'string', isOptional: true },
            { name: 'z', type: 'number' },
            { name: 'created_at', type: 'number' },
            { name: 'updated_at', type: 'number' },
          ],
        }),
      ],
    },

    // ── v8: Whiteboard shapes, layers, versions ───────────────
    // Additive columns default to safe values on existing rows (WatermelonDB
    // fills new non-optional columns with '' / 0 / false), and the model
    // normalises those on read.
    {
      toVersion: 8,
      steps: [
        addColumns({
          table: 'boards',
          columns: [
            { name: 'pattern', type: 'string' },
            { name: 'passcode', type: 'string', isOptional: true },
            { name: 'archived', type: 'boolean' },
          ],
        }),
        addColumns({
          table: 'board_items',
          columns: [
            { name: 'rotation', type: 'number' },
            { name: 'fill', type: 'string', isOptional: true },
            { name: 'pen', type: 'string' },
            { name: 'layer', type: 'number' },
            { name: 'locked', type: 'boolean' },
            { name: 'group_id', type: 'string', isOptional: true },
            { name: 'text_style', type: 'string' },
          ],
        }),
        createTable({
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
    },

    // ── v9: Note & task backgrounds, archive, trash ────────────
    // Additive columns. `archived` defaults to false and `trashed_at` to null
    // on existing rows, so every current note and task stays exactly where it
    // is.
    {
      toVersion: 9,
      steps: [
        addColumns({
          table: 'notes',
          columns: [
            { name: 'background_uri', type: 'string', isOptional: true },
            { name: 'font_id', type: 'string', isOptional: true },
            { name: 'archived', type: 'boolean' },
            { name: 'trashed_at', type: 'number', isOptional: true },
          ],
        }),
        addColumns({
          table: 'tasks',
          columns: [
            { name: 'background_uri', type: 'string', isOptional: true },
            { name: 'font_id', type: 'string', isOptional: true },
            { name: 'archived', type: 'boolean' },
            { name: 'trashed_at', type: 'number', isOptional: true },
          ],
        }),
      ],
    },

    // ── v10: Medicine photo, category, meal timing, snooze ─────
    // Additive columns. Existing medicines default to 'other' category and
    // 'any' meal timing on read, so nothing changes for current data.
    {
      toVersion: 10,
      steps: [
        addColumns({
          table: 'medicines',
          columns: [
            { name: 'category', type: 'string' },
            { name: 'photo_uri', type: 'string', isOptional: true },
            { name: 'meal_timing', type: 'string' },
            { name: 'expiry_date', type: 'string', isOptional: true },
            { name: 'sound_id', type: 'string' },
            { name: 'missed_alert_minutes', type: 'number', isOptional: true },
          ],
        }),
        addColumns({
          table: 'dose_logs',
          columns: [
            { name: 'snoozed_until', type: 'number', isOptional: true },
          ],
        }),
      ],
    },

    // ── v11: Family profile details & doctor visits ────────────
    // Additive columns plus one new table. Text columns arrive as '' on
    // existing rows, which the model normalises, so current profiles are
    // unaffected.
    {
      toVersion: 11,
      steps: [
        addColumns({
          table: 'family_profiles',
          columns: [
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
          ],
        }),
        createTable({
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
      ],
    },
  ],
});
