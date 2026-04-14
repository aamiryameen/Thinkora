import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';
import type { Note, NoteAttachment, SmartCategory } from '../../types';

export class NoteModel extends Model {
  static table = 'notes';

  @text('title') title!: string;
  @text('content') content!: string;
  @text('plain_text') plainText!: string;
  @field('folder_id') folderId!: string | null;
  @text('tag_ids') tagIdsRaw!: string;       // stored as JSON
  @field('is_favorite') isFavorite!: boolean;
  @field('is_pinned') isPinned!: boolean;
  @field('color') color!: string | null;
  @text('category') category!: string;
  @text('attachments') attachmentsRaw!: string; // stored as JSON
  @field('reminder_id') reminderId!: string | null;
  @field('created_at') createdAt!: number;
  @field('updated_at') updatedAt!: number;

  get tagIds(): string[] {
    try { return JSON.parse(this.tagIdsRaw || '[]'); } catch { return []; }
  }

  get attachments(): NoteAttachment[] {
    try { return JSON.parse(this.attachmentsRaw || '[]'); } catch { return []; }
  }

  toPlain(): Note {
    return {
      id: this.id,
      title: this.title,
      content: this.content,
      plainText: this.plainText,
      folderId: this.folderId ?? null,
      tagIds: this.tagIds,
      isFavorite: this.isFavorite,
      isPinned: this.isPinned,
      color: this.color ?? null,
      category: (this.category as SmartCategory) || 'none',
      attachments: this.attachments,
      reminderId: this.reminderId ?? null,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
