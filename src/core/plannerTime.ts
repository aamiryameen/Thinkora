/**
 * Pure date/time helpers for the planner.
 *
 * Deliberately dependency-free (no DB, no React Native) so the scheduling
 * engine and analytics can import them without dragging in the persistence
 * layer — which also keeps both unit-testable.
 *
 * Convention: a "day key" is a local-time "YYYY-MM-DD" string, and block times
 * are minutes from midnight (0–1439).
 */

/** "YYYY-MM-DD" for a Date, in local time. */
export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function todayKey(): string {
  return toDateKey(new Date());
}

/** Parse "YYYY-MM-DD" into a local Date at midnight. */
export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function addDaysToKey(key: string, days: number): string {
  const d = fromDateKey(key);
  d.setDate(d.getDate() + days);
  return toDateKey(d);
}

/** Absolute timestamp for a given day-key + minutes-from-midnight. */
export function timestampFor(dateKey: string, minutes: number): number {
  const d = fromDateKey(dateKey);
  d.setMinutes(minutes);
  return d.getTime();
}

/** Start (inclusive) of the week containing `key`. */
export function weekStartKey(key: string, firstDayOfWeek: 0 | 1 = 0): string {
  const d = fromDateKey(key);
  const diff = (d.getDay() - firstDayOfWeek + 7) % 7;
  d.setDate(d.getDate() - diff);
  return toDateKey(d);
}

/** The seven day-keys of the week containing `key`. */
export function weekKeys(key: string, firstDayOfWeek: 0 | 1 = 0): string[] {
  const start = weekStartKey(key, firstDayOfWeek);
  return Array.from({ length: 7 }, (_, i) => addDaysToKey(start, i));
}

/** "6:30 AM" for minutes-from-midnight. */
export function formatMinutes(minutes: number): string {
  const norm = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(norm / 60);
  const m = norm % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
}

/** "1h 30m" / "45m" for a duration. */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** Parse "HH:mm" into minutes-from-midnight; null when unparseable. */
export function parseHHmm(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}
