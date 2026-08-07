import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';
import type { KbDocument, KbDocStatus, KbSourceType } from '../../types/knowledge';

export class KbDocumentModel extends Model {
  static table = 'kb_documents';

  @field('kb_id') kbId!: string;
  @text('title') title!: string;
  @text('source_type') sourceType!: string;
  @text('file_name') fileName!: string;
  @field('file_uri') fileUri!: string | null;
  @field('note_id') noteId!: string | null;
  @field('file_size') fileSize!: number;
  @text('extracted_text') extractedText!: string;
  @field('page_count') pageCount!: number;
  @text('status') status!: string;
  @field('progress') progress!: number;
  @field('error_message') errorMessage!: string | null;
  @field('chunk_count') chunkCount!: number;
  @field('language') language!: string | null;
  @field('quick_summary') quickSummary!: string | null;
  @field('standard_summary') standardSummary!: string | null;
  @text('key_points') keyPointsRaw!: string;   // stored as JSON
  @text('tags') tagsRaw!: string;              // stored as JSON
  @field('created_at') createdAt!: number;
  @field('updated_at') updatedAt!: number;

  get keyPoints(): string[] {
    try { return JSON.parse(this.keyPointsRaw || '[]'); } catch { return []; }
  }

  get tags(): string[] {
    try { return JSON.parse(this.tagsRaw || '[]'); } catch { return []; }
  }

  toPlain(): KbDocument {
    return {
      id: this.id,
      kbId: this.kbId,
      title: this.title,
      sourceType: (this.sourceType as KbSourceType) || 'text',
      fileName: this.fileName,
      fileUri: this.fileUri ?? null,
      noteId: this.noteId ?? null,
      fileSize: this.fileSize ?? 0,
      extractedText: this.extractedText ?? '',
      pageCount: this.pageCount ?? 0,
      status: (this.status as KbDocStatus) || 'queued',
      progress: this.progress ?? 0,
      errorMessage: this.errorMessage ?? null,
      chunkCount: this.chunkCount ?? 0,
      language: this.language ?? null,
      quickSummary: this.quickSummary ?? null,
      standardSummary: this.standardSummary ?? null,
      keyPoints: this.keyPoints,
      tags: this.tags,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
