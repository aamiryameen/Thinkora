export type MedicineForm =
  | 'tablet' | 'capsule' | 'liquid' | 'injection' | 'drops' | 'inhaler' | 'cream' | 'other';

export type MealTiming = 'any' | 'before' | 'after' | 'with';

export type MedicineCategory =
  | 'prescription' | 'vitamin' | 'supplement' | 'painkiller'
  | 'antibiotic' | 'chronic' | 'other';

export type ScheduleKind =
  /** Fixed times every day. */
  | 'daily'
  /** Fixed times on chosen weekdays. */
  | 'weekly'
  /** Every N days from the start date. */
  | 'interval'
  /** Same day each month. */
  | 'monthly'
  /** No schedule — taken when needed. */
  | 'as_needed';

export interface Medicine {
  id: string;
  /** Owning family profile; the default profile is the app's own user. */
  profileId: string;
  name: string;
  /** Free text: "500 mg", "2 puffs", "10 ml". */
  dosage: string;
  form: MedicineForm;
  category: MedicineCategory;
  color: string;
  notes: string;
  /** Local uri of a photo of the medicine or its packaging. */
  photoUri: string | null;
  /** Take before, after or with food. */
  mealTiming: MealTiming;
  /** YYYY-MM-DD the medicine expires; null when not tracked. */
  expiryDate: string | null;
  /** Notification sound id from core/medicine. */
  soundId: string;
  /** Minutes after a missed dose before alerting; null disables it. */
  missedAlertMinutes: number | null;

  scheduleKind: ScheduleKind;
  /** Minutes from midnight, ascending. Empty for as_needed. */
  times: number[];
  /** 0=Sun … 6=Sat. Only meaningful for 'weekly'. */
  weekdays: number[];
  /** Days between doses for 'interval'. */
  intervalDays: number;

  /** YYYY-MM-DD */
  startDate: string;
  /** YYYY-MM-DD, or null for open-ended. */
  endDate: string | null;

  remindersEnabled: boolean;
  /** Premium inventory tracking; null when not tracked. */
  stockCount: number | null;
  /** Warn at or below this remaining count. */
  refillThreshold: number | null;

  archived: boolean;
  createdAt: number;
  updatedAt: number;
}

export type DoseStatus = 'taken' | 'skipped' | 'pending' | 'snoozed';

export interface DoseLog {
  id: string;
  medicineId: string;
  profileId: string;
  /** YYYY-MM-DD of the scheduled dose. */
  date: string;
  /** Minutes from midnight of the scheduled time; null for as-needed doses. */
  scheduledMinutes: number | null;
  status: DoseStatus;
  /** When the user actually recorded it. */
  takenAt: number | null;
  /** Epoch ms the snooze expires; null when not snoozed. */
  snoozedUntil: number | null;
  note: string;
  createdAt: number;
}

export type Gender = 'unspecified' | 'male' | 'female' | 'other';

export interface FamilyProfile {
  id: string;
  name: string;
  color: string;
  icon: string;
  /** Local uri of a profile photo. */
  photoUri: string | null;
  /** Free text so "Father", "Son", "Wife" all work without a fixed list. */
  relationship: string;
  /** YYYY-MM-DD; age is derived so it never goes stale. */
  birthDate: string | null;
  gender: Gender;

  // ── Health information ──
  bloodGroup: string;
  allergies: string;
  conditions: string;
  emergencyContact: string;
  doctorName: string;
  doctorPhone: string;
  doctorNotes: string;

  /** The profile created on first run; cannot be deleted. */
  isDefault: boolean;
  createdAt: number;
}

export type VisitStatus = 'upcoming' | 'done' | 'missed';

/** A doctor's appointment for one profile. */
export interface DoctorVisit {
  id: string;
  profileId: string;
  doctorName: string;
  /** Clinic, hospital or video link. */
  location: string;
  /** YYYY-MM-DD */
  date: string;
  /** Minutes from midnight. */
  minutes: number;
  reason: string;
  /** Notes taken during or after the visit. */
  prescriptionNotes: string;
  /** YYYY-MM-DD of the follow-up, when one was arranged. */
  followUpDate: string | null;
  reminderEnabled: boolean;
  completed: boolean;
  createdAt: number;
  updatedAt: number;
}

/** One expected dose on a given day, with its logged outcome if any. */
export interface ScheduledDose {
  medicine: Medicine;
  date: string;
  minutes: number | null;
  status: DoseStatus;
  log: DoseLog | null;
}

/** Per-medicine adherence, for the analytics screen. */
export interface MedicineAdherence {
  medicineId: string;
  name: string;
  color: string;
  taken: number;
  missed: number;
  skipped: number;
  rate: number;
}

/** One day's adherence, for the trend chart. */
export interface DailyAdherence {
  date: string;
  taken: number;
  expected: number;
  rate: number;
}

export interface AdherenceStats {
  taken: number;
  skipped: number;
  missed: number;
  total: number;
  /** 0–1 share of expected doses actually taken. */
  rate: number;
}
