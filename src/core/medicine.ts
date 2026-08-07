import type {
  AdherenceStats, DailyAdherence, DoctorVisit, DoseLog, FamilyProfile, Gender,
  MealTiming, Medicine, MedicineAdherence, MedicineCategory, MedicineForm,
  ScheduledDose,
} from '../types/medicine';

export const MEDICINE_FORMS: { value: MedicineForm; label: string; icon: string }[] = [
  { value: 'tablet', label: 'Tablet', icon: 'ellipse-outline' },
  { value: 'capsule', label: 'Capsule', icon: 'egg-outline' },
  { value: 'liquid', label: 'Liquid', icon: 'water-outline' },
  { value: 'injection', label: 'Injection', icon: 'medical-outline' },
  { value: 'drops', label: 'Drops', icon: 'eyedrop-outline' },
  { value: 'inhaler', label: 'Inhaler', icon: 'cloud-outline' },
  { value: 'cream', label: 'Cream', icon: 'color-fill-outline' },
  { value: 'other', label: 'Other', icon: 'medkit-outline' },
];

export const MEDICINE_CATEGORIES: {
  value: MedicineCategory; label: string; icon: string; color: string;
}[] = [
  { value: 'prescription', label: 'Prescription', icon: 'document-text-outline', color: '#6366F1' },
  { value: 'vitamin', label: 'Vitamin', icon: 'nutrition-outline', color: '#F59E0B' },
  { value: 'supplement', label: 'Supplement', icon: 'fitness-outline', color: '#10B981' },
  { value: 'painkiller', label: 'Painkiller', icon: 'bandage-outline', color: '#EF4444' },
  { value: 'antibiotic', label: 'Antibiotic', icon: 'bug-outline', color: '#8B5CF6' },
  { value: 'chronic', label: 'Chronic', icon: 'heart-outline', color: '#EC4899' },
  { value: 'other', label: 'Other', icon: 'medkit-outline', color: '#64748B' },
];

export const MEAL_TIMINGS: { value: MealTiming; label: string; icon: string }[] = [
  { value: 'any', label: 'Anytime', icon: 'time-outline' },
  { value: 'before', label: 'Before food', icon: 'arrow-up-circle-outline' },
  { value: 'with', label: 'With food', icon: 'restaurant-outline' },
  { value: 'after', label: 'After food', icon: 'arrow-down-circle-outline' },
];

/**
 * Notification sounds. Free users get the default; the rest are premium.
 *
 * These map to Android notification channels — a channel's sound is fixed at
 * creation, so each sound needs its own channel.
 */
export const REMINDER_SOUNDS: {
  id: string; label: string; premium: boolean;
}[] = [
  { id: 'default', label: 'Default', premium: false },
  { id: 'gentle', label: 'Gentle chime', premium: true },
  { id: 'bell', label: 'Bell', premium: true },
  { id: 'alarm', label: 'Alarm', premium: true },
  { id: 'silent', label: 'Silent', premium: true },
];

/** Snooze options offered on a reminder, in minutes. */
export const SNOOZE_OPTIONS = [5, 10, 15, 30, 60];

/** Warn this many days before a medicine expires. */
export const EXPIRY_WARNING_DAYS = 30;

export const MEDICINE_COLORS = [
  '#EF4444', '#F59E0B', '#10B981', '#0EA5E9',
  '#6366F1', '#8B5CF6', '#EC4899', '#14B8A6',
];

/** Common dosing presets, in minutes from midnight. */
export const TIME_PRESETS: { label: string; times: number[] }[] = [
  { label: 'Once daily', times: [8 * 60] },
  { label: 'Twice daily', times: [8 * 60, 20 * 60] },
  { label: '3 times daily', times: [8 * 60, 14 * 60, 20 * 60] },
  { label: '4 times daily', times: [8 * 60, 12 * 60, 16 * 60, 20 * 60] },
];

export const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function dateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * True for a real `YYYY-MM-DD` calendar date.
 *
 * The shape check alone would pass 2026-02-31, so the parsed date is compared
 * back against the input to catch a day that rolled into the next month.
 */
export function isDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = parseDateKey(value);
  return !Number.isNaN(d.getTime()) && dateKey(d) === value;
}

/**
 * Minutes past midnight from `HH:MM`, or null when it isn't a valid time.
 *
 * Returns null rather than clamping so callers can tell the user to fix a typo
 * instead of silently storing a different time than they typed.
 */
export function parseTimeInput(value: string): number | null {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

export function addDays(key: string, days: number): string {
  const d = parseDateKey(key);
  d.setDate(d.getDate() + days);
  return dateKey(d);
}

/** Whole days between two date keys, ignoring clock time and DST. */
export function daysBetween(from: string, to: string): number {
  const a = parseDateKey(from);
  const b = parseDateKey(to);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/**
 * Age in whole years from a `YYYY-MM-DD` birth date.
 *
 * Derived rather than stored so it never goes stale, and returns null for a
 * missing or future date instead of a negative number.
 */
export function ageFromBirthDate(
  birthDate: string | null | undefined,
  now = new Date(),
): number | null {
  if (!birthDate || !isDateKey(birthDate)) return null;
  const born = parseDateKey(birthDate);

  let years = now.getFullYear() - born.getFullYear();
  // Subtract a year when this year's birthday hasn't happened yet.
  const monthDiff = now.getMonth() - born.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < born.getDate())) {
    years -= 1;
  }
  return years < 0 ? null : years;
}

export function describeGender(gender: Gender): string {
  switch (gender) {
    case 'male': return 'Male';
    case 'female': return 'Female';
    case 'other': return 'Other';
    default: return '';
  }
}

/**
 * One-line summary under a profile name — relationship, age and gender,
 * skipping whatever the user hasn't filled in.
 */
export function describeProfile(
  profile: Pick<FamilyProfile, 'relationship' | 'birthDate' | 'gender'>,
  now = new Date(),
): string {
  const age = ageFromBirthDate(profile.birthDate, now);
  return [
    profile.relationship.trim(),
    age === null ? '' : `${age} yr`,
    describeGender(profile.gender),
  ].filter(Boolean).join(' · ');
}

export function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const period = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

/** Evening the day before, so there's still time to rearrange. */
export const VISIT_DAY_BEFORE_MINUTES = 18 * 60;
/** Morning of the follow-up date. */
export const VISIT_FOLLOW_UP_MINUTES = 9 * 60;

export type VisitSlotKey = 'day-before' | 'at-time' | 'follow-up';

/**
 * The reminder times for one appointment, in fire order.
 *
 * Kept separate from scheduling so the timing is verifiable without notifee,
 * and so past slots are filtered in one place rather than at each call site.
 */
export function visitReminderSlots(
  visit: Pick<DoctorVisit, 'date' | 'minutes' | 'followUpDate'>,
  now = new Date(),
): { key: VisitSlotKey; at: number }[] {
  const slots: { key: VisitSlotKey; at: number }[] = [
    { key: 'day-before', at: timestampFor(addDays(visit.date, -1), VISIT_DAY_BEFORE_MINUTES) },
    { key: 'at-time', at: timestampFor(visit.date, visit.minutes) },
  ];
  if (visit.followUpDate) {
    slots.push({
      key: 'follow-up',
      at: timestampFor(visit.followUpDate, VISIT_FOLLOW_UP_MINUTES),
    });
  }
  // An alarm in the past never fires, so drop it rather than scheduling noise.
  return slots.filter(s => s.at > now.getTime());
}

/** Absolute timestamp for a dose, in local time. */
export function timestampFor(date: string, minutes: number): number {
  const d = parseDateKey(date);
  d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return d.getTime();
}

/**
 * Whether a medicine is due on a date, ignoring time of day.
 *
 * Handles the date window first so an ended course never reappears, then the
 * recurrence rule.
 */
export function isDueOn(medicine: Medicine, date: string): boolean {
  if (medicine.archived) return false;
  if (date < medicine.startDate) return false;
  if (medicine.endDate && date > medicine.endDate) return false;

  switch (medicine.scheduleKind) {
    case 'daily':
      return true;
    case 'weekly':
      return medicine.weekdays.includes(parseDateKey(date).getDay());
    case 'interval': {
      const step = Math.max(1, medicine.intervalDays);
      return daysBetween(medicine.startDate, date) % step === 0;
    }
    case 'monthly': {
      // Clamp to month length so a "31st" course still fires in February.
      const target = parseDateKey(medicine.startDate).getDate();
      const d = parseDateKey(date);
      const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      return d.getDate() === Math.min(target, lastDay);
    }
    case 'as_needed':
      return false;
    default:
      return false;
  }
}

function logKey(medicineId: string, date: string, minutes: number | null): string {
  return `${medicineId}|${date}|${minutes ?? 'prn'}`;
}

/**
 * Every dose expected on a date, with its logged outcome.
 *
 * An unlogged dose is always 'pending' here; whether it counts as missed also
 * depends on the clock and any active snooze, so that lives in `isMissed`
 * rather than being baked into the status.
 */
export function dosesForDate(
  medicines: Medicine[],
  logs: DoseLog[],
  date: string,
): ScheduledDose[] {
  const byKey = new Map<string, DoseLog>();
  logs.forEach(l => byKey.set(logKey(l.medicineId, l.date, l.scheduledMinutes), l));

  const out: ScheduledDose[] = [];

  medicines.forEach(medicine => {
    if (!isDueOn(medicine, date)) return;
    medicine.times.forEach(minutes => {
      const log = byKey.get(logKey(medicine.id, date, minutes)) ?? null;
      out.push({ medicine, date, minutes, status: log?.status ?? 'pending', log });
    });
  });

  // As-needed doses only exist once logged, so surface those too.
  logs
    .filter(l => l.date === date && l.scheduledMinutes === null)
    .forEach(l => {
      const medicine = medicines.find(m => m.id === l.medicineId);
      if (medicine) out.push({ medicine, date, minutes: null, status: l.status, log: l });
    });

  return out.sort((a, b) => (a.minutes ?? 24 * 60 + 1) - (b.minutes ?? 24 * 60 + 1));
}

/**
 * True when a dose's time has passed without being taken.
 *
 * A snoozed dose is not missed until its snooze also expires — otherwise
 * snoozing would immediately count against adherence.
 */
export function isMissed(dose: ScheduledDose, now = new Date()): boolean {
  if (dose.minutes === null) return false;
  if (dose.status === 'taken' || dose.status === 'skipped') return false;

  if (dose.status === 'snoozed') {
    const until = dose.log?.snoozedUntil ?? 0;
    return until > 0 && until < now.getTime();
  }

  return dose.status === 'pending'
    && timestampFor(dose.date, dose.minutes) < now.getTime();
}

/** A snoozed dose still waiting for its new time. */
export function isSnoozeActive(dose: ScheduledDose, now = new Date()): boolean {
  if (dose.status !== 'snoozed') return false;
  return (dose.log?.snoozedUntil ?? 0) > now.getTime();
}

/**
 * Adherence over a date range.
 *
 * Only counts doses whose time has passed — including today's later doses
 * would drag the rate down for no reason.
 */
export function adherence(
  medicines: Medicine[],
  logs: DoseLog[],
  fromDate: string,
  toDate: string,
  now = new Date(),
): AdherenceStats {
  let taken = 0;
  let skipped = 0;
  let missed = 0;

  const span = Math.max(0, daysBetween(fromDate, toDate));
  for (let i = 0; i <= span; i++) {
    const date = addDays(fromDate, i);
    dosesForDate(medicines, logs, date).forEach(dose => {
      if (dose.status === 'taken') { taken++; return; }
      if (dose.status === 'skipped') { skipped++; return; }
      if (isMissed(dose, now)) missed++;
    });
  }

  const total = taken + skipped + missed;
  return { taken, skipped, missed, total, rate: total > 0 ? taken / total : 0 };
}

/** Next upcoming dose across all medicines, or null when none remain today. */
export function nextDose(
  medicines: Medicine[],
  logs: DoseLog[],
  now = new Date(),
): ScheduledDose | null {
  const today = dateKey(now);

  const remainingToday = dosesForDate(medicines, logs, today)
    .filter(d => d.status === 'pending' && d.minutes !== null && !isMissed(d, now));
  if (remainingToday.length > 0) return remainingToday[0];

  // Look ahead a week so a weekly or interval medicine still reports a date.
  for (let i = 1; i <= 7; i++) {
    const date = addDays(today, i);
    const doses = dosesForDate(medicines, [], date).filter(d => d.minutes !== null);
    if (doses.length > 0) return doses[0];
  }
  return null;
}

/** Days until a medicine expires; null when no expiry is set. */
export function daysUntilExpiry(medicine: Medicine, now = new Date()): number | null {
  if (!medicine.expiryDate) return null;
  return daysBetween(dateKey(now), medicine.expiryDate);
}

/** Already expired. */
export function isExpired(medicine: Medicine, now = new Date()): boolean {
  const days = daysUntilExpiry(medicine, now);
  return days !== null && days < 0;
}

/** Expiring within the warning window, or already expired. */
export function expiringSoon(medicines: Medicine[], now = new Date()): Medicine[] {
  return medicines.filter(m => {
    if (m.archived) return false;
    const days = daysUntilExpiry(m, now);
    return days !== null && days <= EXPIRY_WARNING_DAYS;
  });
}

/** Medicines at or below their refill threshold. */
export function lowStock(medicines: Medicine[]): Medicine[] {
  return medicines.filter(
    m => !m.archived
      && m.stockCount !== null
      && m.refillThreshold !== null
      && m.stockCount <= m.refillThreshold,
  );
}

/** How many days of stock remain at the current daily rate. */
export function daysOfStockLeft(medicine: Medicine): number | null {
  if (medicine.stockCount === null) return null;
  const perDay = dosesPerDay(medicine);
  if (perDay <= 0) return null;
  return Math.floor(medicine.stockCount / perDay);
}

/** Average doses per day, used for stock projections. */
export function dosesPerDay(medicine: Medicine): number {
  const perOccurrence = medicine.times.length;
  switch (medicine.scheduleKind) {
    case 'daily': return perOccurrence;
    case 'weekly': return (perOccurrence * medicine.weekdays.length) / 7;
    case 'interval': return perOccurrence / Math.max(1, medicine.intervalDays);
    default: return 0;
  }
}

export function describeSchedule(medicine: Medicine): string {
  const times = medicine.times.map(formatTime).join(', ');

  switch (medicine.scheduleKind) {
    case 'daily':
      return medicine.times.length ? `Daily · ${times}` : 'Daily';
    case 'weekly': {
      const days = medicine.weekdays.map(d => WEEKDAY_LABELS[d]).join(', ');
      return `${days || 'No days'} · ${times}`;
    }
    case 'interval': {
      const n = Math.max(1, medicine.intervalDays);
      return `Every ${n === 1 ? 'day' : `${n} days`} · ${times}`;
    }
    case 'as_needed':
      return 'As needed';
    default:
      return '';
  }
}

/** CSV of dose history for a doctor's report. */
export function historyToCsv(
  doses: ScheduledDose[],
  profileName: string,
): string {
  const escape = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const rows = [['Date', 'Time', 'Medicine', 'Dosage', 'Status', 'Note'].join(',')];

  [...doses]
    .sort((a, b) => b.date.localeCompare(a.date) || (b.minutes ?? 0) - (a.minutes ?? 0))
    .forEach(d => {
      rows.push([
        d.date,
        d.minutes === null ? 'as needed' : formatTime(d.minutes),
        escape(d.medicine.name),
        escape(d.medicine.dosage),
        d.status,
        escape(d.log?.note ?? ''),
      ].join(','));
    });

  return `Medicine history for ${escape(profileName)}\n\n${rows.join('\n')}`;
}

// ─── Analytics ───────────────────────────────────────────────────────────────

/**
 * Adherence broken down per medicine, worst first.
 *
 * Sorted by rate so the screen leads with what the user is actually struggling
 * to take, which is the point of showing it.
 */
export function adherenceByMedicine(
  medicines: Medicine[],
  logs: DoseLog[],
  fromDate: string,
  toDate: string,
  now = new Date(),
): MedicineAdherence[] {
  return medicines
    .filter(m => !m.archived)
    .map(medicine => {
      const stats = adherence([medicine], logs, fromDate, toDate, now);
      return {
        medicineId: medicine.id,
        name: medicine.name,
        color: medicine.color,
        taken: stats.taken,
        missed: stats.missed,
        skipped: stats.skipped,
        rate: stats.rate,
      };
    })
    .filter(m => m.taken + m.missed + m.skipped > 0)
    .sort((a, b) => a.rate - b.rate);
}

/** Per-day adherence across a range, oldest first — for the trend chart. */
export function adherenceTrend(
  medicines: Medicine[],
  logs: DoseLog[],
  fromDate: string,
  toDate: string,
  now = new Date(),
): DailyAdherence[] {
  const out: DailyAdherence[] = [];
  const span = Math.max(0, daysBetween(fromDate, toDate));

  for (let i = 0; i <= span; i++) {
    const date = addDays(fromDate, i);
    const doses = dosesForDate(medicines, logs, date);
    let taken = 0;
    let expected = 0;

    doses.forEach(dose => {
      if (dose.status === 'taken') { taken++; expected++; return; }
      if (dose.status === 'skipped' || isMissed(dose, now)) expected++;
    });

    out.push({ date, taken, expected, rate: expected > 0 ? taken / expected : 0 });
  }
  return out;
}

/** Which time of day gets missed most — useful for spotting a bad slot. */
export function missesByTimeOfDay(
  medicines: Medicine[],
  logs: DoseLog[],
  fromDate: string,
  toDate: string,
  now = new Date(),
): { label: string; missed: number }[] {
  const buckets = [
    { label: 'Morning', from: 5 * 60, to: 12 * 60, missed: 0 },
    { label: 'Afternoon', from: 12 * 60, to: 17 * 60, missed: 0 },
    { label: 'Evening', from: 17 * 60, to: 21 * 60, missed: 0 },
    { label: 'Night', from: 21 * 60, to: 24 * 60 + 5 * 60, missed: 0 },
  ];

  const span = Math.max(0, daysBetween(fromDate, toDate));
  for (let i = 0; i <= span; i++) {
    const date = addDays(fromDate, i);
    dosesForDate(medicines, logs, date).forEach(dose => {
      if (dose.minutes === null || !isMissed(dose, now)) return;
      // Night wraps past midnight, so shift small values into its range.
      const m = dose.minutes < 5 * 60 ? dose.minutes + 24 * 60 : dose.minutes;
      const bucket = buckets.find(b => m >= b.from && m < b.to);
      if (bucket) bucket.missed++;
    });
  }

  return buckets.map(b => ({ label: b.label, missed: b.missed }));
}

export function describeMealTiming(timing: MealTiming): string {
  return MEAL_TIMINGS.find(t => t.value === timing)?.label ?? 'Anytime';
}

export function describeCategory(category: MedicineCategory): string {
  return MEDICINE_CATEGORIES.find(c => c.value === category)?.label ?? 'Other';
}
