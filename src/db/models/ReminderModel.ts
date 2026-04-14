import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';
import type { Reminder, ReminderLocation, ReminderRepeat, ReminderTriggerType } from '../../types';

export class ReminderModel extends Model {
  static table = 'reminders';

  @text('note_id') noteId!: string;
  @text('title') title!: string;
  @text('body') body!: string;
  @text('trigger_type') triggerType!: string;
  @field('date') date!: number | null;
  @field('location') locationRaw!: string | null;
  @text('repeat') repeat!: string;
  @field('custom_repeat_days') customRepeatDaysRaw!: string | null;
  @field('custom_repeat_interval_minutes') customRepeatIntervalMinutes!: number | null;
  @field('notifee_id') notifeeId!: string | null;
  @field('snoozed_until') snoozedUntil!: number | null;
  @field('created_at') createdAt!: number;

  get location(): ReminderLocation | undefined {
    try { return this.locationRaw ? JSON.parse(this.locationRaw) : undefined; } catch { return undefined; }
  }

  get customRepeatDays(): number[] | undefined {
    try { return this.customRepeatDaysRaw ? JSON.parse(this.customRepeatDaysRaw) : undefined; } catch { return undefined; }
  }

  toPlain(): Reminder {
    return {
      id: this.id,
      noteId: this.noteId,
      title: this.title,
      body: this.body,
      triggerType: this.triggerType as ReminderTriggerType,
      date: this.date ?? undefined,
      location: this.location,
      repeat: this.repeat as ReminderRepeat,
      customRepeatDays: this.customRepeatDays,
      customRepeatIntervalMinutes: this.customRepeatIntervalMinutes ?? undefined,
      notifeeId: this.notifeeId ?? undefined,
      snoozedUntil: this.snoozedUntil ?? undefined,
      createdAt: this.createdAt,
    };
  }
}
