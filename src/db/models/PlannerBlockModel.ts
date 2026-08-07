import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';
import type { PlannerBlock, PlannerBlockKind } from '../../types/planner';

export class PlannerBlockModel extends Model {
  static table = 'planner_blocks';

  @field('date') date!: string;
  @field('title') title!: string;
  @field('kind') kind!: string;
  @field('start_minutes') startMinutes!: number;
  @field('duration_minutes') durationMinutes!: number;
  @field('color') color!: string;
  @field('notes') notes!: string;
  @field('task_id') taskId!: string | null;
  @field('habit_id') habitId!: string | null;
  @field('completed') completed!: boolean;
  @field('reminder_minutes_before') reminderMinutesBefore!: number | null;
  @field('notifee_id') notifeeId!: string | null;
  @field('auto_scheduled') autoScheduled!: boolean;
  @field('locked') locked!: boolean;
  @field('created_at') createdAtNum!: number;
  @field('updated_at') updatedAtNum!: number;

  toPlain(): PlannerBlock {
    return {
      id: this.id,
      date: this.date,
      title: this.title,
      kind: this.kind as PlannerBlockKind,
      startMinutes: this.startMinutes,
      durationMinutes: this.durationMinutes,
      color: this.color,
      notes: this.notes ?? '',
      taskId: this.taskId ?? null,
      habitId: this.habitId ?? null,
      completed: !!this.completed,
      reminderMinutesBefore: this.reminderMinutesBefore ?? null,
      notifeeId: this.notifeeId ?? null,
      autoScheduled: !!this.autoScheduled,
      locked: !!this.locked,
      createdAt: this.createdAtNum,
      updatedAt: this.updatedAtNum,
    };
  }
}
