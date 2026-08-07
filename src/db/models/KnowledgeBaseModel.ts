import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';
import type { KnowledgeBase } from '../../types/knowledge';

export class KnowledgeBaseModel extends Model {
  static table = 'knowledge_bases';

  @text('name') name!: string;
  @text('icon') icon!: string;
  @text('color') color!: string;
  @text('description') description!: string;
  @field('created_at') createdAt!: number;
  @field('updated_at') updatedAt!: number;

  /** `documentCount` is filled in by the caller, which knows the doc totals. */
  toPlain(documentCount = 0): KnowledgeBase {
    return {
      id: this.id,
      name: this.name,
      icon: this.icon,
      color: this.color,
      description: this.description ?? '',
      documentCount,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
