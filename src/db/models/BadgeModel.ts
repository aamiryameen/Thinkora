import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';
import type { Badge, BadgeCondition } from '../../types';

export class BadgeModel extends Model {
  static table = 'badges';

  @text('name') name!: string;
  @text('description') description!: string;
  @text('icon') icon!: string;
  @text('color') color!: string;
  @field('unlocked_at') unlockedAt!: number | null;
  @text('condition') conditionRaw!: string;

  get condition(): BadgeCondition {
    try { return JSON.parse(this.conditionRaw); } catch { return { type: 'tasks_completed', count: 1 }; }
  }

  toPlain(): Badge {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      icon: this.icon,
      color: this.color,
      unlockedAt: this.unlockedAt ?? null,
      condition: this.condition,
    };
  }
}
