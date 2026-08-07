import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';
import type {
  DoctorVisit, DoseLog, DoseStatus, FamilyProfile, Gender, MealTiming,
  Medicine, MedicineCategory, MedicineForm, ScheduleKind,
} from '../../types/medicine';

function parseNumbers(json: string): number[] {
  try {
    const parsed = JSON.parse(json || '[]');
    return Array.isArray(parsed) ? parsed.filter(n => typeof n === 'number') : [];
  } catch {
    return [];
  }
}

export class FamilyProfileModel extends Model {
  static table = 'family_profiles';

  @text('name') name!: string;
  @text('color') color!: string;
  @text('icon') icon!: string;
  @field('photo_uri') photoUri!: string | null;
  @field('relationship') relationship!: string | null;
  @field('birth_date') birthDate!: string | null;
  @field('gender') gender!: string | null;
  @field('blood_group') bloodGroup!: string | null;
  @field('allergies') allergies!: string | null;
  @field('conditions') conditions!: string | null;
  @field('emergency_contact') emergencyContact!: string | null;
  @field('doctor_name') doctorName!: string | null;
  @field('doctor_phone') doctorPhone!: string | null;
  @field('doctor_notes') doctorNotes!: string | null;
  @field('is_default') isDefault!: boolean;
  @field('created_at') createdAt!: number;

  toPlain(): FamilyProfile {
    return {
      id: this.id,
      name: this.name,
      color: this.color,
      icon: this.icon,
      photoUri: this.photoUri ?? null,
      // The v11 migration adds these columns without a default, so rows created
      // before it read back null — every one is coerced rather than trusted.
      relationship: this.relationship || '',
      birthDate: this.birthDate || null,
      gender: (this.gender || 'unspecified') as Gender,
      bloodGroup: this.bloodGroup || '',
      allergies: this.allergies || '',
      conditions: this.conditions || '',
      emergencyContact: this.emergencyContact || '',
      doctorName: this.doctorName || '',
      doctorPhone: this.doctorPhone || '',
      doctorNotes: this.doctorNotes || '',
      isDefault: !!this.isDefault,
      createdAt: this.createdAt,
    };
  }
}

export class DoctorVisitModel extends Model {
  static table = 'doctor_visits';

  @field('profile_id') profileId!: string;
  @text('doctor_name') doctorName!: string;
  @text('location') location!: string;
  @text('date') date!: string;
  @field('minutes') minutes!: number;
  @text('reason') reason!: string;
  @text('prescription_notes') prescriptionNotes!: string;
  @field('follow_up_date') followUpDate!: string | null;
  @field('reminder_enabled') reminderEnabled!: boolean;
  @field('completed') completed!: boolean;
  @field('created_at') createdAt!: number;
  @field('updated_at') updatedAt!: number;

  toPlain(): DoctorVisit {
    return {
      id: this.id,
      profileId: this.profileId,
      doctorName: this.doctorName,
      location: this.location,
      date: this.date,
      minutes: this.minutes,
      reason: this.reason,
      prescriptionNotes: this.prescriptionNotes,
      followUpDate: this.followUpDate || null,
      reminderEnabled: !!this.reminderEnabled,
      completed: !!this.completed,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

export class MedicineModel extends Model {
  static table = 'medicines';

  @field('profile_id') profileId!: string;
  @text('name') name!: string;
  @text('dosage') dosage!: string;
  @text('form') form!: string;
  @field('category') category!: string | null;
  @field('photo_uri') photoUri!: string | null;
  @field('meal_timing') mealTiming!: string | null;
  @field('expiry_date') expiryDate!: string | null;
  @field('sound_id') soundId!: string | null;
  @field('missed_alert_minutes') missedAlertMinutes!: number | null;
  @text('color') color!: string;
  @text('notes') notes!: string;
  @text('schedule_kind') scheduleKind!: string;
  @text('times') timesJson!: string;
  @text('weekdays') weekdaysJson!: string;
  @field('interval_days') intervalDays!: number;
  @text('start_date') startDate!: string;
  @field('end_date') endDate!: string | null;
  @field('reminders_enabled') remindersEnabled!: boolean;
  @field('stock_count') stockCount!: number | null;
  @field('refill_threshold') refillThreshold!: number | null;
  @field('archived') archived!: boolean;
  @field('created_at') createdAt!: number;
  @field('updated_at') updatedAt!: number;

  toPlain(): Medicine {
    return {
      id: this.id,
      profileId: this.profileId,
      name: this.name,
      dosage: this.dosage,
      form: this.form as MedicineForm,
      // Pre-v10 rows have empty strings; normalise on read.
      category: (this.category || 'other') as MedicineCategory,
      photoUri: this.photoUri ?? null,
      mealTiming: (this.mealTiming || 'any') as MealTiming,
      expiryDate: this.expiryDate || null,
      soundId: this.soundId || 'default',
      missedAlertMinutes: this.missedAlertMinutes ?? null,
      color: this.color,
      notes: this.notes,
      scheduleKind: this.scheduleKind as ScheduleKind,
      times: parseNumbers(this.timesJson).sort((a, b) => a - b),
      weekdays: parseNumbers(this.weekdaysJson).sort((a, b) => a - b),
      intervalDays: this.intervalDays,
      startDate: this.startDate,
      endDate: this.endDate ?? null,
      remindersEnabled: !!this.remindersEnabled,
      stockCount: this.stockCount ?? null,
      refillThreshold: this.refillThreshold ?? null,
      archived: !!this.archived,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

export class DoseLogModel extends Model {
  static table = 'dose_logs';

  @field('medicine_id') medicineId!: string;
  @field('profile_id') profileId!: string;
  @text('date') date!: string;
  @field('scheduled_minutes') scheduledMinutes!: number | null;
  @text('status') status!: string;
  @field('taken_at') takenAt!: number | null;
  @field('snoozed_until') snoozedUntil!: number | null;
  @text('note') note!: string;
  @field('created_at') createdAt!: number;

  toPlain(): DoseLog {
    return {
      id: this.id,
      medicineId: this.medicineId,
      profileId: this.profileId,
      date: this.date,
      scheduledMinutes: this.scheduledMinutes ?? null,
      status: this.status as DoseStatus,
      takenAt: this.takenAt ?? null,
      snoozedUntil: this.snoozedUntil ?? null,
      note: this.note,
      createdAt: this.createdAt,
    };
  }
}
