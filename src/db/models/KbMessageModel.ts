import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';
import type { KbCitation, KbMessage } from '../../types/knowledge';

export class KbMessageModel extends Model {
  static table = 'kb_messages';

  @field('kb_id') kbId!: string;
  @text('role') role!: string;
  @text('content') content!: string;
  @text('citations') citationsRaw!: string;   // stored as JSON
  @field('error') error!: string | null;
  @field('created_at') createdAt!: number;

  get citations(): KbCitation[] {
    try { return JSON.parse(this.citationsRaw || '[]'); } catch { return []; }
  }

  toPlain(): KbMessage {
    return {
      id: this.id,
      kbId: this.kbId,
      role: this.role === 'assistant' ? 'assistant' : 'user',
      content: this.content ?? '',
      citations: this.citations,
      error: this.error ?? null,
      createdAt: this.createdAt,
    };
  }
}
