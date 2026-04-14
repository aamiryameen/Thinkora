import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';
import type { PomodoroSession } from '../../types';

export class PomodoroSessionModel extends Model {
  static table = 'pomodoro_sessions';

  @field('task_id') taskId!: string | null;
  @field('duration') duration!: number;
  @field('completed_at') completedAt!: number;
  @text('type') type!: string;

  toPlain(): PomodoroSession {
    return {
      id: this.id,
      taskId: this.taskId ?? null,
      duration: this.duration,
      completedAt: this.completedAt,
      type: this.type as 'work' | 'break',
    };
  }
}
