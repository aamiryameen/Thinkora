import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';
import type { Habit, HabitFrequency } from '../../types';

export class HabitModel extends Model {
  static table = 'habits';

  @text('name') name!: string;
  @text('icon') icon!: string;
  @text('color') color!: string;
  @text('frequency') frequency!: string;
  @text('target_days') targetDaysRaw!: string;
  @field('reminder_time') reminderTime!: string | null;
  @text('completed_dates') completedDatesRaw!: string;
  @field('archived') archived!: boolean;
  @field('created_at') createdAt!: number;

  get targetDays(): number[] {
    try { return JSON.parse(this.targetDaysRaw || '[]'); } catch { return []; }
  }

  get completedDates(): string[] {
    try { return JSON.parse(this.completedDatesRaw || '[]'); } catch { return []; }
  }

  toPlain(): Habit {
    return {
      id: this.id,
      name: this.name,
      icon: this.icon,
      color: this.color,
      frequency: this.frequency as HabitFrequency,
      targetDays: this.targetDays,
      reminderTime: this.reminderTime ?? null,
      completedDates: this.completedDates,
      archived: this.archived,
      createdAt: this.createdAt,
    };
  }
}
