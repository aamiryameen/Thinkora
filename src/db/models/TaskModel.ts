import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';
import type { Task, SubTask, NoteAttachment, TaskPriority, TaskRepeat } from '../../types';

export class TaskModel extends Model {
  static table = 'tasks';

  @text('title') title!: string;
  @field('completed') completed!: boolean;
  @field('category_id') categoryId!: string | null;
  @field('due_date') dueDate!: number | null;
  @field('reminder_date') reminderDate!: number | null;
  @text('repeat') repeat!: string;
  @text('notes') notes!: string;
  @text('attachments') attachmentsRaw!: string;
  @text('subtasks') subtasksRaw!: string;
  @text('priority') priority!: string;
  @field('my_day') myDay!: boolean;
  @field('created_at') createdAt!: number;
  @field('updated_at') updatedAt!: number;

  get subtasks(): SubTask[] {
    try { return JSON.parse(this.subtasksRaw || '[]'); } catch { return []; }
  }

  get attachments(): NoteAttachment[] {
    try { return JSON.parse(this.attachmentsRaw || '[]'); } catch { return []; }
  }

  toPlain(): Task {
    return {
      id: this.id,
      title: this.title,
      completed: this.completed,
      categoryId: this.categoryId ?? null,
      dueDate: this.dueDate ?? null,
      reminderDate: this.reminderDate ?? null,
      repeat: this.repeat as TaskRepeat,
      notes: this.notes,
      attachments: this.attachments,
      subtasks: this.subtasks,
      priority: this.priority as TaskPriority,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
