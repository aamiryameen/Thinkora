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
 * CURRENT SCHEMA VERSION: 1
 * PRODUCTION VERSIONS HISTORY:
 *   v1.0 – v1.2 : schema version 1 (initial release)
 *
 * ─────────────────────────────────────────────────────────────────
 */

import {
  schemaMigrations,
  // Uncomment these as needed:
  // createTable,
  // addColumns,
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

    // Future migrations go here. Example:
    //
    // {
    //   toVersion: 2,
    //   steps: [
    //     addColumns({
    //       table: 'tasks',
    //       columns: [
    //         { name: 'color', type: 'string', isOptional: true },
    //       ],
    //     }),
    //   ],
    // },
  ],
});
