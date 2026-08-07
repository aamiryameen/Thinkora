import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';
import type { KbChunk } from '../../types/knowledge';

export class KbChunkModel extends Model {
  static table = 'kb_chunks';

  @field('kb_id') kbId!: string;
  @field('document_id') documentId!: string;
  @field('chunk_index') chunkIndex!: number;
  @text('text') text!: string;
  @field('heading') heading!: string | null;
  @field('page') page!: number | null;
  @field('char_start') charStart!: number;
  @field('char_end') charEnd!: number;
  @text('embedding') embeddingRaw!: string;   // stored as JSON number[]
  @field('created_at') createdAt!: number;

  get embedding(): number[] | null {
    if (!this.embeddingRaw) return null;
    try {
      const parsed = JSON.parse(this.embeddingRaw);
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
    } catch {
      return null;
    }
  }

  toPlain(): KbChunk {
    return {
      id: this.id,
      kbId: this.kbId,
      documentId: this.documentId,
      chunkIndex: this.chunkIndex ?? 0,
      text: this.text ?? '',
      heading: this.heading ?? null,
      page: this.page ?? null,
      charStart: this.charStart ?? 0,
      charEnd: this.charEnd ?? 0,
      embedding: this.embedding,
      createdAt: this.createdAt,
    };
  }
}
