import { Model } from '@nozbe/watermelondb';
import { text } from '@nozbe/watermelondb/decorators';

export class SettingModel extends Model {
  static table = 'settings';

  @text('key') key!: string;
  @text('value') value!: string; // JSON-encoded value
}
