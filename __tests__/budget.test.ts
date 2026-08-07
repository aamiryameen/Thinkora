import {
  budgetFor,
  budgetProgress,
  categoryTotals,
  dueOccurrences,
  formatMoney,
  monthOf,
  monthSeries,
  parseAmount,
  shiftMonth,
  summarizeMonth,
  toCsv,
  transactionsForMonth,
} from '../src/core/budget';
import type {
  Budget, BudgetCategory, RecurringExpense, Transaction,
} from '../src/types/budget';

function tx(over: Partial<Transaction> = {}): Transaction {
  return {
    id: Math.random().toString(36).slice(2),
    kind: 'expense', amount: 10, categoryId: null, note: '',
    date: '2026-08-03', recurringId: null, createdAt: 1, updatedAt: 1,
    ...over,
  };
}

function cat(id: string, over: Partial<BudgetCategory> = {}): BudgetCategory {
  return {
    id, name: id, icon: 'x', color: '#000', kind: 'expense',
    builtIn: false, archived: false, order: 0, createdAt: 1, ...over,
  };
}

describe('parseAmount', () => {
  it('accepts plain and decimal input', () => {
    expect(parseAmount('12')).toBe(12);
    expect(parseAmount('12.5')).toBe(12.5);
    expect(parseAmount('  8.25 ')).toBe(8.25);
  });

  it('strips thousands separators', () => {
    expect(parseAmount('1,234.56')).toBe(1234.56);
  });

  it('rounds to two decimals', () => {
    expect(parseAmount('1.005')).toBe(1.01);
    expect(parseAmount('0.999')).toBe(1);
  });

  it('rejects anything that is not a positive number', () => {
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('0')).toBeNull();
    expect(parseAmount('-5')).toBeNull();
    expect(parseAmount('NaN')).toBeNull();
    expect(parseAmount('Infinity')).toBeNull();
  });
});

describe('formatMoney', () => {
  it('omits decimals for whole amounts', () => {
    expect(formatMoney(12)).toBe('$12');
  });

  it('shows two decimals otherwise', () => {
    expect(formatMoney(12.5)).toBe('$12.50');
  });

  it('puts the sign before the symbol', () => {
    expect(formatMoney(-8)).toBe('-$8');
  });

  it('accepts another symbol', () => {
    expect(formatMoney(5, '₨')).toBe('₨5');
  });
});

describe('month helpers', () => {
  it('extracts the month from a date key', () => {
    expect(monthOf('2026-08-03')).toBe('2026-08');
  });

  it('shifts across year boundaries in both directions', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-08', 0)).toBe('2026-08');
    expect(shiftMonth('2026-03', -14)).toBe('2025-01');
  });
});

describe('summarizeMonth', () => {
  const txs = [
    tx({ kind: 'income', amount: 1000, date: '2026-08-01' }),
    tx({ kind: 'expense', amount: 250.5, date: '2026-08-02' }),
    tx({ kind: 'expense', amount: 99.5, date: '2026-08-31' }),
    tx({ kind: 'expense', amount: 500, date: '2026-07-15' }),
  ];

  it('totals income and expense for the month only', () => {
    const s = summarizeMonth(txs, '2026-08');
    expect(s.income).toBe(1000);
    expect(s.expense).toBe(350);
    expect(s.net).toBe(650);
  });

  it('excludes other months', () => {
    expect(summarizeMonth(txs, '2026-07').expense).toBe(500);
  });

  it('returns zeros for a month with no activity', () => {
    expect(summarizeMonth(txs, '2020-01')).toEqual({
      month: '2020-01', income: 0, expense: 0, net: 0,
    });
  });

  it('avoids floating-point drift', () => {
    const drifty = [tx({ amount: 0.1 }), tx({ amount: 0.2 })];
    expect(summarizeMonth(drifty, '2026-08').expense).toBe(0.3);
  });
});

describe('transactionsForMonth', () => {
  it('sorts newest first', () => {
    const txs = [
      tx({ date: '2026-08-01', note: 'first' }),
      tx({ date: '2026-08-20', note: 'last' }),
    ];
    expect(transactionsForMonth(txs, '2026-08')[0].note).toBe('last');
  });
});

describe('monthSeries', () => {
  it('returns N months oldest first, ending at the given month', () => {
    const series = monthSeries([], '2026-08', 3);
    expect(series.map(s => s.month)).toEqual(['2026-06', '2026-07', '2026-08']);
  });
});

describe('categoryTotals', () => {
  const cats = [cat('food', { name: 'Food' }), cat('gas', { name: 'Gas' })];

  it('groups expenses and computes each share', () => {
    const txs = [
      tx({ amount: 75, categoryId: 'food' }),
      tx({ amount: 25, categoryId: 'gas' }),
    ];
    const totals = categoryTotals(txs, cats, '2026-08');
    expect(totals[0]).toMatchObject({ name: 'Food', total: 75, share: 0.75 });
    expect(totals[1]).toMatchObject({ name: 'Gas', total: 25, share: 0.25 });
  });

  it('sorts largest first', () => {
    const txs = [
      tx({ amount: 10, categoryId: 'food' }),
      tx({ amount: 90, categoryId: 'gas' }),
    ];
    expect(categoryTotals(txs, cats, '2026-08')[0].name).toBe('Gas');
  });

  it('excludes income so shares stay meaningful', () => {
    const txs = [
      tx({ amount: 50, categoryId: 'food' }),
      tx({ kind: 'income', amount: 5000, categoryId: 'food' }),
    ];
    expect(categoryTotals(txs, cats, '2026-08')[0].total).toBe(50);
  });

  it('buckets unknown and missing categories as uncategorised', () => {
    const txs = [tx({ amount: 20, categoryId: 'deleted' }), tx({ amount: 5 })];
    const totals = categoryTotals(txs, cats, '2026-08');
    expect(totals).toHaveLength(1);
    expect(totals[0]).toMatchObject({ categoryId: null, total: 25 });
  });

  it('returns an empty list for a month with no spend', () => {
    expect(categoryTotals([], cats, '2026-08')).toEqual([]);
  });
});

describe('budgetFor', () => {
  const monthly: Budget = { id: 'm', categoryId: 'food', limit: 100, month: null, createdAt: 1 };
  const specific: Budget = { id: 's', categoryId: 'food', limit: 200, month: '2026-08', createdAt: 1 };

  it('prefers a month-specific budget over the every-month one', () => {
    expect(budgetFor([monthly, specific], 'food', '2026-08')?.id).toBe('s');
  });

  it('falls back to the every-month budget in other months', () => {
    expect(budgetFor([monthly, specific], 'food', '2026-09')?.id).toBe('m');
  });

  it('returns undefined when no budget matches', () => {
    expect(budgetFor([monthly], 'gas', '2026-08')).toBeUndefined();
  });
});

describe('budgetProgress', () => {
  const budget: Budget = { id: 'b', categoryId: 'food', limit: 100, month: null, createdAt: 1 };

  it('reports spend, ratio and remaining', () => {
    const p = budgetProgress(budget, [tx({ amount: 40, categoryId: 'food' })], '2026-08');
    expect(p).toMatchObject({ spent: 40, ratio: 0.4, over: false, remaining: 60 });
  });

  it('flags a breach and clamps the display ratio', () => {
    const p = budgetProgress(budget, [tx({ amount: 150, categoryId: 'food' })], '2026-08');
    expect(p.over).toBe(true);
    expect(p.ratio).toBe(1);
    expect(p.remaining).toBe(-50);
  });

  it('counts every expense for an overall budget', () => {
    const overall: Budget = { ...budget, categoryId: null };
    const txs = [tx({ amount: 30, categoryId: 'food' }), tx({ amount: 20, categoryId: 'gas' })];
    expect(budgetProgress(overall, txs, '2026-08').spent).toBe(50);
  });

  it('ignores income', () => {
    const txs = [tx({ kind: 'income', amount: 999, categoryId: 'food' })];
    expect(budgetProgress(budget, txs, '2026-08').spent).toBe(0);
  });

  it('does not divide by zero for a zero limit', () => {
    const zero: Budget = { ...budget, limit: 0 };
    const p = budgetProgress(zero, [tx({ amount: 10, categoryId: 'food' })], '2026-08');
    expect(p.ratio).toBe(0);
    expect(p.over).toBe(false);
  });
});

describe('dueOccurrences', () => {
  function rule(over: Partial<RecurringExpense> = {}): RecurringExpense {
    return {
      id: 'r', kind: 'expense', amount: 50, categoryId: null, note: 'Rent',
      interval: 'monthly', dayOfPeriod: 1, startDate: '2026-06-01',
      lastRunDate: null, active: true, createdAt: 1, ...over,
    };
  }

  it('returns nothing for an inactive rule', () => {
    expect(dueOccurrences(rule({ active: false }), new Date(2026, 7, 3))).toEqual([]);
  });

  it('catches up every missed month, oldest first', () => {
    const due = dueOccurrences(rule(), new Date(2026, 7, 3));
    expect(due).toEqual(['2026-06-01', '2026-07-01', '2026-08-01']);
  });

  it('resumes after the last run without repeating it', () => {
    const due = dueOccurrences(rule({ lastRunDate: '2026-07-01' }), new Date(2026, 7, 3));
    expect(due).toEqual(['2026-08-01']);
  });

  it('returns nothing when already up to date', () => {
    expect(dueOccurrences(rule({ lastRunDate: '2026-08-01' }), new Date(2026, 7, 3))).toEqual([]);
  });

  it('does not fire before the start date', () => {
    const due = dueOccurrences(rule({ startDate: '2026-09-01' }), new Date(2026, 7, 3));
    expect(due).toEqual([]);
  });

  it('clamps a 31st rule into short months', () => {
    const due = dueOccurrences(
      rule({ dayOfPeriod: 31, startDate: '2026-01-31' }),
      new Date(2026, 1, 28),
    );
    // February clamps to the 28th rather than skipping or overflowing to March.
    expect(due).toEqual(['2026-01-31', '2026-02-28']);
  });

  it('steps a year at a time for yearly rules', () => {
    const due = dueOccurrences(
      rule({ interval: 'yearly', startDate: '2024-03-10', dayOfPeriod: 10 }),
      new Date(2026, 7, 3),
    );
    expect(due).toEqual(['2024-03-10', '2025-03-10', '2026-03-10']);
  });

  it('steps weekly rules by seven days', () => {
    const due = dueOccurrences(
      rule({ interval: 'weekly', startDate: '2026-08-01', dayOfPeriod: 1, lastRunDate: '2026-08-03' }),
      new Date(2026, 7, 20),
    );
    expect(due).toEqual(['2026-08-10', '2026-08-17']);
  });

  it('is bounded so a very old rule cannot hang the app', () => {
    const due = dueOccurrences(
      rule({ interval: 'weekly', startDate: '1990-01-01', dayOfPeriod: 1 }),
      new Date(2026, 7, 3),
    );
    expect(due.length).toBeLessThanOrEqual(200);
  });
});

describe('toCsv', () => {
  const cats = [cat('food', { name: 'Food' })];

  it('writes a header and one row per transaction', () => {
    const csv = toCsv([tx({ amount: 12.5, categoryId: 'food', note: 'Lunch' })], cats);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('Date,Type,Category,Amount,Note');
    expect(lines[1]).toBe('2026-08-03,expense,Food,12.50,Lunch');
  });

  it('quotes fields containing commas, quotes or newlines', () => {
    const csv = toCsv([tx({ note: 'Lunch, with "friends"' })], cats);
    expect(csv).toContain('"Lunch, with ""friends"""');
  });

  it('leaves the category blank when uncategorised', () => {
    expect(toCsv([tx({ categoryId: null })], cats).split('\n')[1]).toContain(',,');
  });

  it('emits only a header for no transactions', () => {
    expect(toCsv([], cats).split('\n')).toHaveLength(1);
  });
});
