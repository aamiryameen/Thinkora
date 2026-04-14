import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';
import type { SharedList, SharedListItem } from '../../types';

export class SharedListModel extends Model {
  static table = 'shared_lists';

  @text('title') title!: string;
  @text('items') itemsRaw!: string;
  @text('share_code') shareCode!: string;
  @field('created_at') createdAt!: number;
  @field('updated_at') updatedAt!: number;

  get items(): SharedListItem[] {
    try { return JSON.parse(this.itemsRaw || '[]'); } catch { return []; }
  }

  toPlain(): SharedList {
    return {
      id: this.id,
      title: this.title,
      items: this.items,
      shareCode: this.shareCode,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
