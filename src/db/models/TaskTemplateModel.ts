import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';
import type { TaskTemplate } from '../../types';

export class TaskTemplateModel extends Model {
  static table = 'task_templates';

  @text('name') name!: string;
  @text('icon') icon!: string;
  @text('tasks') tasksRaw!: string;

  get templateTasks(): TaskTemplate['tasks'] {
    try { return JSON.parse(this.tasksRaw || '[]'); } catch { return []; }
  }

  toPlain(): TaskTemplate {
    return {
      id: this.id,
      name: this.name,
      icon: this.icon,
      tasks: this.templateTasks,
    };
  }
}
