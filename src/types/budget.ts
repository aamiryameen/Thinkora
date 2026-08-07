export type TxKind = 'income' | 'expense';

export interface BudgetCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  kind: TxKind;
  /** Built-in categories cannot be deleted, only hidden. */
  builtIn: boolean;
  archived: boolean;
  order: number;
  createdAt: number;
}

export interface Transaction {
  id: string;
  kind: TxKind;
  /** Positive major units, e.g. 12.50. Sign is carried by `kind`. */
  amount: number;
  categoryId: string | null;
  note: string;
  /** YYYY-MM-DD */
  date: string;
  /** Set when this row was generated from a recurring rule. */
  recurringId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface Budget {
  id: string;
  categoryId: string | null;
  /** Null for the overall monthly budget. */
  limit: number;
  /** YYYY-MM, or null for an every-month budget. */
  month: string | null;
  createdAt: number;
}

export type RecurringInterval = 'weekly' | 'monthly' | 'yearly';

export interface RecurringExpense {
  id: string;
  kind: TxKind;
  amount: number;
  categoryId: string | null;
  note: string;
  interval: RecurringInterval;
  /** Day of month (1–31) for monthly/yearly, or weekday (0–6) for weekly. */
  dayOfPeriod: number;
  /** YYYY-MM-DD the rule starts generating from. */
  startDate: string;
  /** YYYY-MM-DD of the last generated occurrence; null before the first run. */
  lastRunDate: string | null;
  active: boolean;
  createdAt: number;
}

export interface MonthSummary {
  month: string;
  income: number;
  expense: number;
  net: number;
}

export interface CategoryTotal {
  categoryId: string | null;
  name: string;
  color: string;
  icon: string;
  total: number;
  /** Share of the month's expense total, 0–1. */
  share: number;
}
