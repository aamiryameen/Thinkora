import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';
import type { TaskCategory } from '../../types';

export class TaskCategoryModel extends Model {
  static table = 'task_categories';

  @text('name') name!: string;
  @text('color') color!: string;
  @text('icon') icon!: string;

  toPlain(): TaskCategory {
    return { id: this.id, name: this.name, color: this.color, icon: this.icon };
  }
}
