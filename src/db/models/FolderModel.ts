import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';
import type { Folder } from '../../types';

export class FolderModel extends Model {
  static table = 'folders';

  @text('name') name!: string;
  @field('parent_id') parentId!: string | null;
  @field('order_index') order!: number;
  @field('created_at') createdAt!: number;

  toPlain(): Folder {
    return {
      id: this.id,
      name: this.name,
      parentId: this.parentId ?? null,
      order: this.order,
      createdAt: this.createdAt,
    };
  }
}
