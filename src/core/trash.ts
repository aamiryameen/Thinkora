/** Items in trash older than this are purged automatically. */
export const TRASH_RETENTION_DAYS = 30;

/**
 * Days left before a trashed item is purged.
 *
 * Pure so it can be tested without the database — archiveService imports the
 * WatermelonDB adapter, which needs the native module.
 */
export function daysUntilPurge(trashedAt: number | null, now = Date.now()): number {
  if (!trashedAt) return TRASH_RETENTION_DAYS;
  const elapsed = Math.floor((now - trashedAt) / (24 * 60 * 60 * 1000));
  return Math.max(0, TRASH_RETENTION_DAYS - elapsed);
}
