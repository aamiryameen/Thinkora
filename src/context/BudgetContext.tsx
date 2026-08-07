import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from 'react';
import * as svc from '../services/budgetService';
import { storage } from '../services/storage';
import { findCurrency, formatCurrency, guessCurrency, type Currency } from '../core/currency';
import { monthKey } from '../core/budget';
import type {
  Budget, BudgetCategory, RecurringExpense, Transaction, TxKind,
} from '../types/budget';

interface BudgetContextValue {
  categories: BudgetCategory[];
  transactions: Transaction[];
  budgets: Budget[];
  recurring: RecurringExpense[];
  loaded: boolean;
  /** YYYY-MM currently being viewed. */
  month: string;
  setMonth: (month: string) => void;
  currency: Currency;
  setCurrency: (code: string) => Promise<void>;
  /** Formats an amount in the chosen currency. */
  money: (amount: number) => string;
  refresh: () => Promise<void>;

  addTransaction: (input: {
    kind: TxKind; amount: number; categoryId: string | null; note: string; date: string;
  }) => Promise<void>;
  editTransaction: (id: string, patch: Partial<Transaction>) => Promise<void>;
  removeTransaction: (id: string) => Promise<void>;

  addCategory: (input: Omit<BudgetCategory, 'id' | 'createdAt' | 'builtIn' | 'archived'>) => Promise<void>;
  editCategory: (id: string, patch: Partial<BudgetCategory>) => Promise<void>;
  removeCategory: (id: string) => Promise<void>;

  setBudget: (input: { categoryId: string | null; limit: number; month: string | null }) => Promise<void>;
  removeBudget: (id: string) => Promise<void>;

  addRecurring: (input: Omit<RecurringExpense, 'id' | 'createdAt' | 'lastRunDate'>) => Promise<void>;
  editRecurring: (id: string, patch: Partial<RecurringExpense>) => Promise<void>;
  removeRecurring: (id: string) => Promise<void>;
}

const CURRENCY_KEY = 'budget_currency_v1';

const BudgetContext = createContext<BudgetContextValue | undefined>(undefined);

export function BudgetProvider({ children }: { children: React.ReactNode }) {
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [recurring, setRecurring] = useState<RecurringExpense[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [month, setMonth] = useState(monthKey());
  const [currency, setCurrencyState] = useState<Currency>(guessCurrency);

  const refresh = useCallback(async () => {
    const [cats, txs, buds, recs] = await Promise.all([
      svc.getCategories(), svc.getTransactions(), svc.getBudgets(), svc.getRecurring(),
    ]);
    setCategories(cats);
    setTransactions(txs);
    setBudgets(buds);
    setRecurring(recs);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const storedCode = await storage.getSetting<string | null>(CURRENCY_KEY, null);
        if (alive && storedCode) setCurrencyState(findCurrency(storedCode));
        await svc.seedCategoriesIfEmpty();
        // Generate any bills that came due while the app was closed before
        // the first read, so the totals shown are already correct.
        await svc.runRecurring();
        if (alive) await refresh();
      } catch {
        // A read failure leaves empty lists rather than blocking the screen.
      } finally {
        if (alive) setLoaded(true);
      }
    })();
    return () => { alive = false; };
  }, [refresh]);

  // Swallows write failures: these are called fire-and-forget from onPress
  // handlers, where a rejection would be an unhandled promise rather than
  // something the user can act on.
  const wrap = useCallback(
    <A extends unknown[]>(fn: (...args: A) => Promise<unknown>) =>
      async (...args: A) => {
        try { await fn(...args); await refresh(); } catch { /* state unchanged */ }
      },
    [refresh],
  );

  const setCurrency = useCallback(async (code: string) => {
    const next = findCurrency(code);
    setCurrencyState(next);
    await storage.setSetting(CURRENCY_KEY, next.code);
  }, []);

  const money = useCallback(
    (amount: number) => formatCurrency(amount, currency),
    [currency],
  );

  const value = useMemo<BudgetContextValue>(() => ({
    categories, transactions, budgets, recurring, loaded, month, setMonth, refresh,
    currency, setCurrency, money,
    addTransaction: wrap(svc.createTransaction),
    editTransaction: wrap(svc.updateTransaction),
    removeTransaction: wrap(svc.deleteTransaction),
    addCategory: wrap(svc.createCategory),
    editCategory: wrap(svc.updateCategory),
    removeCategory: wrap(svc.deleteCategory),
    setBudget: wrap(svc.saveBudget),
    removeBudget: wrap(svc.deleteBudget),
    addRecurring: wrap(svc.createRecurring),
    editRecurring: wrap(svc.updateRecurring),
    removeRecurring: wrap(svc.deleteRecurring),
  }), [budgets, categories, currency, loaded, money, month, recurring, refresh, setCurrency, transactions, wrap]);

  return <BudgetContext.Provider value={value}>{children}</BudgetContext.Provider>;
}

export function useBudget(): BudgetContextValue {
  const ctx = useContext(BudgetContext);
  if (!ctx) throw new Error('useBudget must be used inside BudgetProvider');
  return ctx;
}
