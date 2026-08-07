import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';
import type { PlannerDay, DailyGoal, TopPriority } from '../../types/planner';

function parseArr<T>(raw: string | null | undefined): T[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? (v as T[]) : [];
  } catch { return []; }
}

export class PlannerDayModel extends Model {
  static table = 'planner_days';

  @field('date') date!: string;
  @field('focus') focus!: string;
  @field('top_priorities') topPrioritiesRaw!: string;
  @field('daily_goals') dailyGoalsRaw!: string;
  @field('notes') notes!: string;
  @field('planned_at') plannedAt!: number | null;
  @field('reviewed_at') reviewedAt!: number | null;
  @field('created_at') createdAtNum!: number;
  @field('updated_at') updatedAtNum!: number;

  toPlain(): PlannerDay {
    return {
      id: this.id,
      date: this.date,
      focus: this.focus ?? '',
      topPriorities: parseArr<TopPriority>(this.topPrioritiesRaw),
      dailyGoals: parseArr<DailyGoal>(this.dailyGoalsRaw),
      notes: this.notes ?? '',
      plannedAt: this.plannedAt ?? null,
      reviewedAt: this.reviewedAt ?? null,
      createdAt: this.createdAtNum,
      updatedAt: this.updatedAtNum,
    };
  }
}
