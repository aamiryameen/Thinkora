import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';
import type { Tag } from '../../types';

export class TagModel extends Model {
  static table = 'tags';

  @text('name') name!: string;
  @field('parent_id') parentId!: string | null;
  @field('color') color!: string | undefined;
  @field('order_index') order!: number;
  @field('created_at') createdAt!: number;

  toPlain(): Tag {
    return {
      id: this.id,
      name: this.name,
      parentId: this.parentId ?? null,
      color: this.color || undefined,
      order: this.order,
      createdAt: this.createdAt,
    };
  }
}
