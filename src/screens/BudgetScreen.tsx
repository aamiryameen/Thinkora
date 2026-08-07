import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useTheme } from '../context/ThemeContext';
import { useBudget } from '../context/BudgetContext';
import { usePremium, type PremiumFeature } from '../services/premiumService';
import { PremiumGateSheet } from '../components/PremiumGateSheet';
import { TransactionSheet } from '../components/TransactionSheet';
import { CurrencySheet } from '../components/CurrencySheet';
import { CategoryDonut, MonthlyBarChart } from '../components/BudgetCharts';
import { SCREEN_BOTTOM_INSET } from '../components/AdBanner';
import {
  budgetFor,
  budgetProgress,
  categoryTotals,
  monthKey,
  monthLabel,
  monthSeries,
  shiftMonth,
  summarizeMonth,
  transactionsForMonth,
} from '../core/budget';
import type { Transaction } from '../types/budget';

type Nav = NativeStackNavigationProp<RootStackParamList>;


export function BudgetScreen() {
  const navigation = useNavigation<Nav>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { hasPremium } = usePremium();
  const {
    categories, transactions, budgets, loaded, month, setMonth, money,
    addTransaction, editTransaction, removeTransaction, currency, setCurrency,
  } = useBudget();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [gateFeature, setGateFeature] = useState<PremiumFeature | null>(null);
  const [currencyOpen, setCurrencyOpen] = useState(false);

  const summary = useMemo(() => summarizeMonth(transactions, month), [month, transactions]);
  const series = useMemo(() => monthSeries(transactions, month, 6), [month, transactions]);
  const totals = useMemo(
    () => categoryTotals(transactions, categories, month),
    [categories, month, transactions],
  );
  const monthTxs = useMemo(
    () => transactionsForMonth(transactions, month),
    [month, transactions],
  );
  const catById = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories]);

  const overall = useMemo(() => {
    const b = budgetFor(budgets, null, month);
    return b ? budgetProgress(b, transactions, month) : null;
  }, [budgets, month, transactions]);

  const isCurrentMonth = month === monthKey();

  const handleSave = useCallback(async (values: {
    kind: 'income' | 'expense'; amount: number; categoryId: string | null; note: string; date: string;
  }) => {
    if (editing) await editTransaction(editing.id, values);
    else await addTransaction(values);
    setSheetOpen(false);
    setEditing(null);
  }, [addTransaction, editTransaction, editing]);

  const handleDelete = useCallback(() => {
    if (!editing) return;
    Alert.alert('Delete transaction', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await removeTransaction(editing.id);
          setSheetOpen(false);
          setEditing(null);
        },
      },
    ]);
  }, [editing, removeTransaction]);

  const requirePremium = useCallback((feature: PremiumFeature, run: () => void) => {
    if (hasPremium) { run(); return; }
    setGateFeature(feature);
  }, [hasPremium]);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    header: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: theme.spacing.lg,
      paddingTop: insets.top + theme.spacing.md,
      paddingBottom: theme.spacing.md,
      backgroundColor: theme.colors.surface,
      gap: theme.spacing.sm,
    },
    title: {
      ...theme.typography.title, fontSize: 24, fontWeight: '700',
      color: theme.colors.text, flex: 1,
    },
    currencyCode: {
      ...theme.typography.caption, fontSize: 11, fontWeight: '800',
      color: theme.colors.textMuted,
    },
    headerBtn: {
      width: 38, height: 38, borderRadius: 12,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: theme.colors.inputBg,
    },
    monthRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.sm,
      backgroundColor: theme.colors.surface,
    },
    monthLabel: { ...theme.typography.body, fontWeight: '700', color: theme.colors.text },
    monthBtn: { padding: 6 },
    scroll: {
      padding: theme.spacing.lg,
      paddingBottom: SCREEN_BOTTOM_INSET + 60,
      gap: theme.spacing.md,
    },
    card: {
      backgroundColor: theme.colors.cardBg,
      borderRadius: theme.borderRadius.xl,
      padding: theme.spacing.lg,
      gap: theme.spacing.md,
      ...theme.shadows.card,
    },
    statRow: { flexDirection: 'row', gap: theme.spacing.md },
    stat: { flex: 1, gap: 2 },
    statLabel: { ...theme.typography.caption, fontSize: 11, color: theme.colors.textMuted },
    statValue: { fontSize: 19, fontWeight: '800' },
    netValue: { fontSize: 28, fontWeight: '800', color: theme.colors.text },
    sectionTitle: {
      ...theme.typography.overline, color: theme.colors.textMuted,
      textTransform: 'uppercase', letterSpacing: 1, marginLeft: theme.spacing.xs,
    },
    legendRow: {
      flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm,
      paddingVertical: 5,
    },
    legendDot: { width: 10, height: 10, borderRadius: 3 },
    legendName: { ...theme.typography.bodySmall, color: theme.colors.text, flex: 1 },
    legendAmount: { ...theme.typography.bodySmall, fontWeight: '700', color: theme.colors.text },
    legendPct: {
      ...theme.typography.caption, fontSize: 11,
      color: theme.colors.textMuted, width: 38, textAlign: 'right',
    },
    txRow: {
      flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
    },
    txIcon: {
      width: 38, height: 38, borderRadius: 12,
      alignItems: 'center', justifyContent: 'center',
    },
    txNote: { ...theme.typography.bodySmall, color: theme.colors.text, fontWeight: '600' },
    txMeta: { ...theme.typography.caption, fontSize: 11, color: theme.colors.textMuted },
    txAmount: { ...theme.typography.bodySmall, fontWeight: '800' },
    empty: {
      ...theme.typography.bodySmall, color: theme.colors.textMuted,
      textAlign: 'center', paddingVertical: theme.spacing.lg,
    },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
    actionBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingHorizontal: 14, paddingVertical: 10,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.inputBg,
    },
    actionText: { ...theme.typography.caption, fontWeight: '700', color: theme.colors.text },
    fab: {
      position: 'absolute',
      right: theme.spacing.lg,
      bottom: insets.bottom + theme.spacing.lg,
      width: 58, height: 58, borderRadius: 29,
      backgroundColor: theme.colors.primary,
      alignItems: 'center', justifyContent: 'center',
      ...theme.shadows.fab,
    },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  }), [insets.bottom, insets.top, theme]);

  if (!loaded) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Budget</Text>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => setCurrencyOpen(true)}
          accessibilityLabel="Change currency"
        >
          <Text style={styles.currencyCode}>{currency.code}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => navigation.navigate('BudgetCategories')}
        >
          <Ionicons name="pricetags-outline" size={18} color={theme.colors.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => requirePremium('budget_reports', () => navigation.navigate('BudgetReports'))}
        >
          <Ionicons
            name={hasPremium ? 'bar-chart-outline' : 'lock-closed-outline'}
            size={18}
            color={theme.colors.textMuted}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.monthRow}>
        <TouchableOpacity style={styles.monthBtn} onPress={() => setMonth(shiftMonth(month, -1))}>
          <Ionicons name="chevron-back" size={20} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.monthLabel}>{monthLabel(month)}</Text>
        <TouchableOpacity
          style={styles.monthBtn}
          onPress={() => setMonth(shiftMonth(month, 1))}
          disabled={isCurrentMonth}
        >
          <Ionicons
            name="chevron-forward"
            size={20}
            color={isCurrentMonth ? theme.colors.textDisabled : theme.colors.text}
          />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View>
            <Text style={styles.statLabel}>Net this month</Text>
            <Text style={styles.netValue}>{money(summary.net)}</Text>
          </View>
          <View style={styles.statRow}>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Income</Text>
              <Text style={[styles.statValue, { color: theme.colors.success }]}>
                {money(summary.income)}
              </Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Expenses</Text>
              <Text style={[styles.statValue, { color: theme.colors.error }]}>
                {money(summary.expense)}
              </Text>
            </View>
          </View>

          {overall && (
            <View style={{ gap: 6 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={styles.statLabel}>Monthly budget</Text>
                <Text style={[
                  styles.statLabel,
                  overall.over && { color: theme.colors.error, fontWeight: '700' },
                ]}>
                  {money(overall.spent)} / {money(overall.limit)}
                </Text>
              </View>
              <View style={{
                height: 8, borderRadius: 4,
                backgroundColor: theme.colors.border, overflow: 'hidden',
              }}>
                <View style={{
                  height: 8, borderRadius: 4,
                  width: `${Math.round(overall.ratio * 100)}%`,
                  backgroundColor: overall.over ? theme.colors.error : theme.colors.primary,
                }} />
              </View>
            </View>
          )}

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => requirePremium('budget_limits', () => navigation.navigate('BudgetLimits'))}
            >
              <Ionicons
                name={hasPremium ? 'speedometer-outline' : 'lock-closed-outline'}
                size={14} color={theme.colors.text}
              />
              <Text style={styles.actionText}>Budgets</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => requirePremium('budget_recurring', () => navigation.navigate('BudgetRecurring'))}
            >
              <Ionicons
                name={hasPremium ? 'repeat-outline' : 'lock-closed-outline'}
                size={14} color={theme.colors.text}
              />
              <Text style={styles.actionText}>Recurring</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Last 6 months</Text>
        <View style={styles.card}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <MonthlyBarChart data={series} />
          </ScrollView>
        </View>

        <Text style={styles.sectionTitle}>Where it went</Text>
        <View style={styles.card}>
          {totals.length === 0 ? (
            <Text style={styles.empty}>No spending this month</Text>
          ) : (
            <>
              <CategoryDonut data={totals} total={summary.expense} money={money} />
              <View>
                {totals.map(t => (
                  <View key={t.categoryId ?? 'none'} style={styles.legendRow}>
                    <View style={[styles.legendDot, { backgroundColor: t.color }]} />
                    <Text style={styles.legendName} numberOfLines={1}>{t.name}</Text>
                    <Text style={styles.legendAmount}>{money(t.total)}</Text>
                    <Text style={styles.legendPct}>{Math.round(t.share * 100)}%</Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </View>

        <Text style={styles.sectionTitle}>
          Transactions{monthTxs.length > 0 ? ` (${monthTxs.length})` : ''}
        </Text>
        <View style={styles.card}>
          {monthTxs.length === 0 ? (
            <Text style={styles.empty}>Tap + to add your first transaction</Text>
          ) : (
            monthTxs.map(t => {
              const cat = t.categoryId ? catById.get(t.categoryId) : undefined;
              const color = cat?.color
                ?? (t.kind === 'income' ? theme.colors.success : theme.colors.textMuted);
              return (
                <TouchableOpacity
                  key={t.id}
                  style={styles.txRow}
                  onPress={() => { setEditing(t); setSheetOpen(true); }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.txIcon, { backgroundColor: color + '20' }]}>
                    <Ionicons
                      name={cat?.icon ?? (t.kind === 'income' ? 'arrow-down-outline' : 'arrow-up-outline')}
                      size={18}
                      color={color}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.txNote} numberOfLines={1}>
                      {t.note || cat?.name || (t.kind === 'income' ? 'Income' : 'Expense')}
                    </Text>
                    <Text style={styles.txMeta}>
                      {t.date}{cat ? ` · ${cat.name}` : ''}
                      {t.recurringId ? ' · recurring' : ''}
                    </Text>
                  </View>
                  <Text style={[
                    styles.txAmount,
                    { color: t.kind === 'income' ? theme.colors.success : theme.colors.text },
                  ]}>
                    {t.kind === 'income' ? '+' : '−'}{money(t.amount)}
                  </Text>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>

      <TouchableOpacity
        style={styles.fab}
        onPress={() => { setEditing(null); setSheetOpen(true); }}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={30} color="#FFF" />
      </TouchableOpacity>

      <TransactionSheet
        visible={sheetOpen}
        categories={categories}
        editing={editing}
        onSave={handleSave}
        onDelete={editing ? handleDelete : undefined}
        onClose={() => { setSheetOpen(false); setEditing(null); }}
      />
      <CurrencySheet
        visible={currencyOpen}
        currentCode={currency.code}
        onSelect={async code => { await setCurrency(code); setCurrencyOpen(false); }}
        onClose={() => setCurrencyOpen(false)}
      />
      <PremiumGateSheet
        visible={gateFeature !== null}
        feature={gateFeature ?? undefined}
        onClose={() => setGateFeature(null)}
      />
    </View>
  );
}
