import { Alert, Platform, Share } from 'react-native';
import RNFS from 'react-native-fs';
import {
  budgetCategoriesCollection,
  budgetsCollection,
  database,
  recurringExpensesCollection,
  transactionsCollection,
} from '../db';
import {
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_INCOME_CATEGORIES,
  dateKey,
  dueOccurrences,
  toCsv,
} from '../core/budget';
import type {
  Budget,
  BudgetCategory,
  RecurringExpense,
  Transaction,
  TxKind,
} from '../types/budget';

// ─── Categories ──────────────────────────────────────────────────────────────

export async function getCategories(): Promise<BudgetCategory[]> {
  const rows = await budgetCategoriesCollection.query().fetch();
  return rows.map(r => r.toPlain()).sort((a, b) => a.order - b.order);
}

/** Seeds built-in categories once; a user who deleted them keeps them gone. */
export async function seedCategoriesIfEmpty(): Promise<BudgetCategory[]> {
  // Check-then-write: without a guard two overlapping calls would both see an
  // empty table and seed a duplicate set.
  if (seedRun) return seedRun;
  seedRun = doSeedCategories().finally(() => { seedRun = null; });
  return seedRun;
}

let seedRun: Promise<BudgetCategory[]> | null = null;

async function doSeedCategories(): Promise<BudgetCategory[]> {
  const existing = await getCategories();
  if (existing.length > 0) return existing;

  const now = Date.now();
  const seeds = [...DEFAULT_EXPENSE_CATEGORIES, ...DEFAULT_INCOME_CATEGORIES];
  await database.write(async () => {
    await database.batch(
      ...seeds.map(seed =>
        budgetCategoriesCollection.prepareCreate(r => {
          r.name = seed.name;
          r.icon = seed.icon;
          r.color = seed.color;
          r.kind = seed.kind;
          r.builtIn = seed.builtIn;
          r.archived = seed.archived;
          r.order = seed.order;
          r.createdAt = now;
        }),
      ),
    );
  });
  return getCategories();
}

export async function createCategory(
  input: Omit<BudgetCategory, 'id' | 'createdAt' | 'builtIn' | 'archived'>,
): Promise<void> {
  await database.write(async () => {
    await budgetCategoriesCollection.create(r => {
      r.name = input.name;
      r.icon = input.icon;
      r.color = input.color;
      r.kind = input.kind;
      r.builtIn = false;
      r.archived = false;
      r.order = input.order;
      r.createdAt = Date.now();
    });
  });
}

export async function updateCategory(id: string, patch: Partial<BudgetCategory>): Promise<void> {
  const row = await budgetCategoriesCollection.find(id).catch(() => null);
  if (!row) return;
  await database.write(async () => {
    await row.update(r => {
      if (patch.name !== undefined) r.name = patch.name;
      if (patch.icon !== undefined) r.icon = patch.icon;
      if (patch.color !== undefined) r.color = patch.color;
      if (patch.archived !== undefined) r.archived = patch.archived;
      if (patch.order !== undefined) r.order = patch.order;
    });
  });
}

/**
 * Deletes a category and unfiles its transactions rather than deleting them —
 * losing spend history because a label was removed would be wrong.
 */
export async function deleteCategory(id: string): Promise<void> {
  const row = await budgetCategoriesCollection.find(id).catch(() => null);
  if (!row) return;
  // Both reads are independent, so they run together rather than one after the
  // other. category_id isn't indexed on either table, so the match stays in JS.
  const [affected, budgetRows] = await Promise.all([
    transactionsCollection.query().fetch(),
    budgetsCollection.query().fetch(),
  ]);
  const orphans = affected.filter(t => t.categoryId === id);
  const budgetOrphans = budgetRows.filter(b => b.categoryId === id);

  await database.write(async () => {
    await database.batch(
      ...orphans.map(t => t.prepareUpdate(r => { r.categoryId = null; })),
      ...budgetOrphans.map(b => b.prepareDestroyPermanently()),
      row.prepareDestroyPermanently(),
    );
  });
}

// ─── Transactions ────────────────────────────────────────────────────────────

export async function getTransactions(): Promise<Transaction[]> {
  const rows = await transactionsCollection.query().fetch();
  return rows.map(r => r.toPlain());
}

export async function createTransaction(input: {
  kind: TxKind;
  amount: number;
  categoryId: string | null;
  note: string;
  date: string;
  recurringId?: string | null;
}): Promise<void> {
  const now = Date.now();
  await database.write(async () => {
    await transactionsCollection.create(r => {
      r.kind = input.kind;
      r.amount = input.amount;
      r.categoryId = input.categoryId;
      r.note = input.note;
      r.date = input.date;
      r.recurringId = input.recurringId ?? null;
      r.createdAt = now;
      r.updatedAt = now;
    });
  });
}

export async function updateTransaction(id: string, patch: Partial<Transaction>): Promise<void> {
  const row = await transactionsCollection.find(id).catch(() => null);
  if (!row) return;
  await database.write(async () => {
    await row.update(r => {
      if (patch.kind !== undefined) r.kind = patch.kind;
      if (patch.amount !== undefined) r.amount = patch.amount;
      if (patch.categoryId !== undefined) r.categoryId = patch.categoryId;
      if (patch.note !== undefined) r.note = patch.note;
      if (patch.date !== undefined) r.date = patch.date;
      r.updatedAt = Date.now();
    });
  });
}

export async function deleteTransaction(id: string): Promise<void> {
  const row = await transactionsCollection.find(id).catch(() => null);
  if (!row) return;
  await database.write(async () => { await row.destroyPermanently(); });
}

// ─── Budgets ─────────────────────────────────────────────────────────────────

export async function getBudgets(): Promise<Budget[]> {
  const rows = await budgetsCollection.query().fetch();
  return rows.map(r => r.toPlain());
}

/** One budget per (category, month) pair; re-saving replaces the limit. */
export async function saveBudget(input: {
  categoryId: string | null;
  limit: number;
  month: string | null;
}): Promise<void> {
  const rows = await budgetsCollection.query().fetch();
  const existing = rows.find(
    r => (r.categoryId ?? null) === input.categoryId && (r.month ?? null) === input.month,
  );

  await database.write(async () => {
    if (existing) {
      await existing.update(r => { r.limit = input.limit; });
      return;
    }
    await budgetsCollection.create(r => {
      r.categoryId = input.categoryId;
      r.limit = input.limit;
      r.month = input.month;
      r.createdAt = Date.now();
    });
  });
}

export async function deleteBudget(id: string): Promise<void> {
  const row = await budgetsCollection.find(id).catch(() => null);
  if (!row) return;
  await database.write(async () => { await row.destroyPermanently(); });
}

// ─── Recurring ───────────────────────────────────────────────────────────────

export async function getRecurring(): Promise<RecurringExpense[]> {
  const rows = await recurringExpensesCollection.query().fetch();
  return rows.map(r => r.toPlain()).sort((a, b) => b.createdAt - a.createdAt);
}

export async function createRecurring(
  input: Omit<RecurringExpense, 'id' | 'createdAt' | 'lastRunDate'>,
): Promise<void> {
  await database.write(async () => {
    await recurringExpensesCollection.create(r => {
      r.kind = input.kind;
      r.amount = input.amount;
      r.categoryId = input.categoryId;
      r.note = input.note;
      r.interval = input.interval;
      r.dayOfPeriod = input.dayOfPeriod;
      r.startDate = input.startDate;
      r.lastRunDate = null;
      r.active = input.active;
      r.createdAt = Date.now();
    });
  });
}

export async function updateRecurring(id: string, patch: Partial<RecurringExpense>): Promise<void> {
  const row = await recurringExpensesCollection.find(id).catch(() => null);
  if (!row) return;
  await database.write(async () => {
    await row.update(r => {
      if (patch.amount !== undefined) r.amount = patch.amount;
      if (patch.categoryId !== undefined) r.categoryId = patch.categoryId;
      if (patch.note !== undefined) r.note = patch.note;
      if (patch.interval !== undefined) r.interval = patch.interval;
      if (patch.dayOfPeriod !== undefined) r.dayOfPeriod = patch.dayOfPeriod;
      if (patch.active !== undefined) r.active = patch.active;
      if (patch.lastRunDate !== undefined) r.lastRunDate = patch.lastRunDate;
    });
  });
}

export async function deleteRecurring(id: string): Promise<void> {
  const row = await recurringExpensesCollection.find(id).catch(() => null);
  if (!row) return;
  await database.write(async () => { await row.destroyPermanently(); });
}

/**
 * Generates any transactions that recurring rules should already have
 * produced. Idempotent: `lastRunDate` advances so a second call in the same
 * session creates nothing.
 *
 * Returns how many rows were created, for an optional "3 bills added" notice.
 */
export async function runRecurring(today = new Date()): Promise<number> {
  // Guarded because this creates money rows: two overlapping calls would each
  // read the same lastRunDate and generate the same charge twice.
  if (recurringRun) return recurringRun;
  recurringRun = generateRecurring(today).finally(() => { recurringRun = null; });
  return recurringRun;
}

let recurringRun: Promise<number> | null = null;

async function generateRecurring(today: Date): Promise<number> {
  const rules = await getRecurring();
  if (rules.length === 0) return 0;

  const now = Date.now();
  let created = 0;

  for (const rule of rules) {
    const due = dueOccurrences(rule, today);
    if (due.length === 0) continue;

    const row = await recurringExpensesCollection.find(rule.id).catch(() => null);
    if (!row) continue;

    await database.write(async () => {
      await database.batch(
        ...due.map(date =>
          transactionsCollection.prepareCreate(r => {
            r.kind = rule.kind;
            r.amount = rule.amount;
            r.categoryId = rule.categoryId;
            r.note = rule.note;
            r.date = date;
            r.recurringId = rule.id;
            r.createdAt = now;
            r.updatedAt = now;
          }),
        ),
        row.prepareUpdate(r => { r.lastRunDate = due[due.length - 1]; }),
      );
    });
    created += due.length;
  }

  return created;
}

// ─── CSV export ──────────────────────────────────────────────────────────────

/**
 * Writes a CSV to Downloads (Android) or Documents (iOS) and offers to share
 * it. Mirrors plannerExportService so both exports behave the same way.
 */
export async function exportCsv(
  txs: Transaction[],
  categories: BudgetCategory[],
  fileLabel = 'transactions',
  currencyCode?: string,
): Promise<string | null> {
  if (txs.length === 0) {
    Alert.alert('Nothing to export', 'Add a transaction first.');
    return null;
  }

  try {
    const csv = toCsv(txs, categories, currencyCode);
    const dir = Platform.OS === 'android' ? RNFS.DownloadDirectoryPath : RNFS.DocumentDirectoryPath;
    const path = `${dir}/thinkora-${fileLabel}-${dateKey()}.csv`;
    await RNFS.writeFile(path, csv, 'utf8');

    Alert.alert('Exported', `Saved to ${path}`, [
      { text: 'Done', style: 'cancel' },
      {
        text: 'Share',
        onPress: () => {
          Share.share({
            title: 'Thinkora transactions',
            message: csv.length > 100000 ? `Saved to ${path}` : csv,
          }).catch(() => { /* user dismissed */ });
        },
      },
    ]);
    return path;
  } catch (e: any) {
    Alert.alert('Export failed', e?.message ?? 'Could not write the file.');
    return null;
  }
}
