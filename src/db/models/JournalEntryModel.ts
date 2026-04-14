import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';
import type { JournalEntry, MoodLevel } from '../../types';

export class JournalEntryModel extends Model {
  static table = 'journal_entries';

  @text('date') date!: string;
  @field('mood') mood!: number;
  @text('note') note!: string;
  @field('created_at') createdAt!: number;

  toPlain(): JournalEntry {
    return {
      id: this.id,
      date: this.date,
      mood: this.mood as MoodLevel,
      note: this.note,
      createdAt: this.createdAt,
    };
  }
}
