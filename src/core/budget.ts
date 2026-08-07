import type {
  Budget,
  BudgetCategory,
  CategoryTotal,
  MonthSummary,
  RecurringExpense,
  Transaction,
  TxKind,
} from '../types/budget';

export const DEFAULT_EXPENSE_CATEGORIES: Omit<BudgetCategory, 'id' | 'createdAt'>[] = [
  { name: 'Food', icon: 'restaurant-outline', color: '#F59E0B', kind: 'expense', builtIn: true, archived: false, order: 0 },
  { name: 'Transport', icon: 'car-outline', color: '#0EA5E9', kind: 'expense', builtIn: true, archived: false, order: 1 },
  { name: 'Shopping', icon: 'bag-handle-outline', color: '#EC4899', kind: 'expense', builtIn: true, archived: false, order: 2 },
  { name: 'Bills', icon: 'receipt-outline', color: '#EF4444', kind: 'expense', builtIn: true, archived: false, order: 3 },
  { name: 'Health', icon: 'medkit-outline', color: '#10B981', kind: 'expense', builtIn: true, archived: false, order: 4 },
  { name: 'Fun', icon: 'game-controller-outline', color: '#8B5CF6', kind: 'expense', builtIn: true, archived: false, order: 5 },
  { name: 'Home', icon: 'home-outline', color: '#F97316', kind: 'expense', builtIn: true, archived: false, order: 6 },
  { name: 'Other', icon: 'ellipsis-horizontal-outline', color: '#64748B', kind: 'expense', builtIn: true, archived: false, order: 7 },
];

export const DEFAULT_INCOME_CATEGORIES: Omit<BudgetCategory, 'id' | 'createdAt'>[] = [
  { name: 'Salary', icon: 'cash-outline', color: '#10B981', kind: 'income', builtIn: true, archived: false, order: 0 },
  { name: 'Freelance', icon: 'laptop-outline', color: '#6366F1', kind: 'income', builtIn: true, archived: false, order: 1 },
  { name: 'Gift', icon: 'gift-outline', color: '#EC4899', kind: 'income', builtIn: true, archived: false, order: 2 },
  { name: 'Other', icon: 'add-circle-outline', color: '#64748B', kind: 'income', builtIn: true, archived: false, order: 3 },
];

const UNCATEGORIZED: Pick<CategoryTotal, 'name' | 'color' | 'icon'> = {
  name: 'Uncategorised',
  color: '#64748B',
  icon: 'help-circle-outline',
};

/** YYYY-MM-DD in local time. */
export function dateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** YYYY-MM in local time. */
export function monthKey(d: Date = new Date()): string {
  return dateKey(d).slice(0, 7);
}

export function monthOf(date: string): string {
  return date.slice(0, 7);
}

/** Shifts a YYYY-MM key by whole months, handling year boundaries. */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, (m - 1) + delta, 1);
  return monthKey(d);
}

export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

/**
 * Formats an amount for display. Uses the locale's grouping but a plain
 * prefix symbol — Intl currency codes would force a currency the user never
 * chose.
 */
export function formatMoney(amount: number, symbol = '$'): string {
  const abs = Math.abs(amount);
  const body = abs.toLocaleString(undefined, {
    minimumFractionDigits: abs % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `${amount < 0 ? '-' : ''}${symbol}${body}`;
}

/**
 * Parses user input into a positive amount, or null when unusable.
 * Accepts "12", "12.5", "1,234.56"; rejects negatives and gibberish so a
 * typo can never silently become income.
 */
export function parseAmount(input: string): number | null {
  const cleaned = input.replace(/,/g, '').trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n <= 0) return null;
  // Money is 2dp; more precision is a typo, not intent.
  return round2(n);
}

/**
 * Rounds to 2dp via the decimal string rather than `n * 100`, which loses a
 * cent on values like 1.005 (stored as 1.00499999…) — unacceptable for money.
 */
function round2(n: number): number {
  return Number(`${Math.round(Number(`${n}e2`))}e-2`);
}

export function transactionsForMonth(txs: Transaction[], month: string): Transaction[] {
  return txs
    .filter(t => monthOf(t.date) === month)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
}

function sumBy(txs: Transaction[], kind: TxKind): number {
  const total = txs.reduce((sum, t) => (t.kind === kind ? sum + t.amount : sum), 0);
  return round2(total);
}

export function summarizeMonth(txs: Transaction[], month: string): MonthSummary {
  const scoped = transactionsForMonth(txs, month);
  const income = sumBy(scoped, 'income');
  const expense = sumBy(scoped, 'expense');
  return { month, income, expense, net: round2(income - expense) };
}

/** Summaries for the N months ending at `month`, oldest first. */
export function monthSeries(txs: Transaction[], month: string, count: number): MonthSummary[] {
  const out: MonthSummary[] = [];
  for (let i = count - 1; i >= 0; i--) {
    out.push(summarizeMonth(txs, shiftMonth(month, -i)));
  }
  return out;
}

/**
 * Spend per category for a month, largest first. Only expenses — mixing
 * income in would make the shares meaningless.
 */
export function categoryTotals(
  txs: Transaction[],
  categories: BudgetCategory[],
  month: string,
): CategoryTotal[] {
  const scoped = transactionsForMonth(txs, month).filter(t => t.kind === 'expense');
  const grandTotal = sumBy(scoped, 'expense');
  const byId = new Map(categories.map(c => [c.id, c]));
  const buckets = new Map<string | null, number>();

  scoped.forEach(t => {
    const key = t.categoryId && byId.has(t.categoryId) ? t.categoryId : null;
    buckets.set(key, (buckets.get(key) ?? 0) + t.amount);
  });

  return Array.from(buckets.entries())
    .map(([categoryId, total]) => {
      const cat = categoryId ? byId.get(categoryId) : undefined;
      return {
        categoryId,
        name: cat?.name ?? UNCATEGORIZED.name,
        color: cat?.color ?? UNCATEGORIZED.color,
        icon: cat?.icon ?? UNCATEGORIZED.icon,
        total: round2(total),
        share: grandTotal > 0 ? total / grandTotal : 0,
      };
    })
    .sort((a, b) => b.total - a.total);
}

export interface BudgetProgress {
  budget: Budget;
  spent: number;
  limit: number;
  /** 0–1, clamped for display; `over` reports the real breach. */
  ratio: number;
  over: boolean;
  remaining: number;
}

/**
 * Resolves the budget that applies to a category for a month, preferring a
 * month-specific budget over an every-month one.
 */
export function budgetFor(
  budgets: Budget[],
  categoryId: string | null,
  month: string,
): Budget | undefined {
  const matches = budgets.filter(b => b.categoryId === categoryId);
  return matches.find(b => b.month === month) ?? matches.find(b => b.month === null);
}

export function budgetProgress(
  budget: Budget,
  txs: Transaction[],
  month: string,
): BudgetProgress {
  const scoped = transactionsForMonth(txs, month).filter(t => t.kind === 'expense');
  const relevant = budget.categoryId
    ? scoped.filter(t => t.categoryId === budget.categoryId)
    : scoped;
  const spent = round2(relevant.reduce((s, t) => s + t.amount, 0));
  const limit = budget.limit;

  return {
    budget,
    spent,
    limit,
    ratio: limit > 0 ? Math.min(1, spent / limit) : 0,
    over: limit > 0 && spent > limit,
    remaining: round2(limit - spent),
  };
}

/**
 * Occurrence dates a recurring rule should have produced by `today` but
 * hasn't yet. Returns them oldest first.
 *
 * Catch-up matters: someone who doesn't open the app for two months should
 * still get both months' rent, not just the latest.
 */
export function dueOccurrences(rule: RecurringExpense, today = new Date()): string[] {
  if (!rule.active) return [];

  const todayKeyStr = dateKey(today);
  const out: string[] = [];
  const start = rule.startDate;
  const from = rule.lastRunDate && rule.lastRunDate >= start ? rule.lastRunDate : null;

  if (rule.interval === 'weekly') {
    const cursor = new Date(`${from ?? start}T00:00:00`);
    if (from) cursor.setDate(cursor.getDate() + 7);
    // Align the very first run onto the requested weekday.
    else while (cursor.getDay() !== rule.dayOfPeriod) cursor.setDate(cursor.getDate() + 1);

    while (dateKey(cursor) <= todayKeyStr && out.length < 200) {
      out.push(dateKey(cursor));
      cursor.setDate(cursor.getDate() + 7);
    }
    return out;
  }

  const step = rule.interval === 'yearly' ? 12 : 1;
  let month = from ? shiftMonth(monthOf(from), step) : monthOf(start);

  while (month <= monthKey(today) && out.length < 200) {
    const [y, m] = month.split('-').map(Number);
    // Clamp to the month's length so a "31st" rule still fires in February.
    const lastDay = new Date(y, m, 0).getDate();
    const day = Math.min(rule.dayOfPeriod, lastDay);
    const occurrence = `${month}-${String(day).padStart(2, '0')}`;
    if (occurrence >= start && occurrence <= todayKeyStr) out.push(occurrence);
    month = shiftMonth(month, step);
  }

  return out;
}

/** CSV of transactions, newest first. */
export function toCsv(
  txs: Transaction[],
  categories: BudgetCategory[],
  currencyCode?: string,
): string {
  const byId = new Map(categories.map(c => [c.id, c.name]));
  const escape = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

  const amountHeader = currencyCode ? `Amount (${currencyCode})` : 'Amount';
  const rows = [['Date', 'Type', 'Category', amountHeader, 'Note'].join(',')];
  [...txs]
    .sort((a, b) => b.date.localeCompare(a.date))
    .forEach(t => {
      rows.push([
        t.date,
        t.kind,
        escape(t.categoryId ? byId.get(t.categoryId) ?? '' : ''),
        t.amount.toFixed(2),
        escape(t.note),
      ].join(','));
    });

  return rows.join('\n');
}
