import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';
import type {
  Budget,
  BudgetCategory,
  RecurringExpense,
  RecurringInterval,
  Transaction,
  TxKind,
} from '../../types/budget';

export class BudgetCategoryModel extends Model {
  static table = 'budget_categories';

  @text('name') name!: string;
  @text('icon') icon!: string;
  @text('color') color!: string;
  @text('kind') kind!: string;
  @field('built_in') builtIn!: boolean;
  @field('archived') archived!: boolean;
  @field('order_index') order!: number;
  @field('created_at') createdAt!: number;

  toPlain(): BudgetCategory {
    return {
      id: this.id,
      name: this.name,
      icon: this.icon,
      color: this.color,
      kind: this.kind as TxKind,
      builtIn: !!this.builtIn,
      archived: !!this.archived,
      order: this.order,
      createdAt: this.createdAt,
    };
  }
}

export class TransactionModel extends Model {
  static table = 'transactions';

  @text('kind') kind!: string;
  @field('amount') amount!: number;
  @field('category_id') categoryId!: string | null;
  @text('note') note!: string;
  @text('date') date!: string;
  @field('recurring_id') recurringId!: string | null;
  @field('created_at') createdAt!: number;
  @field('updated_at') updatedAt!: number;

  toPlain(): Transaction {
    return {
      id: this.id,
      kind: this.kind as TxKind,
      amount: this.amount,
      categoryId: this.categoryId ?? null,
      note: this.note,
      date: this.date,
      recurringId: this.recurringId ?? null,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

export class BudgetModel extends Model {
  static table = 'budgets';

  @field('category_id') categoryId!: string | null;
  @field('limit_amount') limit!: number;
  @field('month') month!: string | null;
  @field('created_at') createdAt!: number;

  toPlain(): Budget {
    return {
      id: this.id,
      categoryId: this.categoryId ?? null,
      limit: this.limit,
      month: this.month ?? null,
      createdAt: this.createdAt,
    };
  }
}

export class RecurringExpenseModel extends Model {
  static table = 'recurring_expenses';

  @text('kind') kind!: string;
  @field('amount') amount!: number;
  @field('category_id') categoryId!: string | null;
  @text('note') note!: string;
  @text('interval') interval!: string;
  @field('day_of_period') dayOfPeriod!: number;
  @text('start_date') startDate!: string;
  @field('last_run_date') lastRunDate!: string | null;
  @field('active') active!: boolean;
  @field('created_at') createdAt!: number;

  toPlain(): RecurringExpense {
    return {
      id: this.id,
      kind: this.kind as TxKind,
      amount: this.amount,
      categoryId: this.categoryId ?? null,
      note: this.note,
      interval: this.interval as RecurringInterval,
      dayOfPeriod: this.dayOfPeriod,
      startDate: this.startDate,
      lastRunDate: this.lastRunDate ?? null,
      active: !!this.active,
      createdAt: this.createdAt,
    };
  }
}
