import React, { useCallback, useMemo, useState } from 'react';
import {
  ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { useBudget } from '../context/BudgetContext';
import { MonthlyBarChart } from '../components/BudgetCharts';
import { exportCsv } from '../services/budgetService';
import {
  categoryTotals, monthLabel, monthSeries, summarizeMonth,
  transactionsForMonth,
} from '../core/budget';

const RANGES = [3, 6, 12];

export function BudgetReportsScreen() {
  const nav = useNavigation();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { categories, transactions, month, money, currency } = useBudget();
  const [range, setRange] = useState(6);
  const [busy, setBusy] = useState(false);

  const series = useMemo(
    () => monthSeries(transactions, month, range),
    [month, range, transactions],
  );

  const totals = useMemo(() => {
    const income = series.reduce((s, m) => s + m.income, 0);
    const expense = series.reduce((s, m) => s + m.expense, 0);
    const months = series.filter(m => m.income > 0 || m.expense > 0).length || 1;
    return {
      income, expense, net: income - expense,
      avgExpense: expense / months,
      avgIncome: income / months,
    };
  }, [series]);

  const topCategories = useMemo(
    () => categoryTotals(transactions, categories, month).slice(0, 5),
    [categories, month, transactions],
  );

  const biggest = useMemo(() => {
    const scoped = transactionsForMonth(transactions, month).filter(t => t.kind === 'expense');
    return [...scoped].sort((a, b) => b.amount - a.amount).slice(0, 5);
  }, [month, transactions]);

  const thisMonth = useMemo(() => summarizeMonth(transactions, month), [month, transactions]);

  const handleExportMonth = useCallback(async () => {
    setBusy(true);
    await exportCsv(transactionsForMonth(transactions, month), categories, month, currency.code);
    setBusy(false);
  }, [categories, currency.code, month, transactions]);

  const handleExportAll = useCallback(async () => {
    setBusy(true);
    await exportCsv(transactions, categories, 'all', currency.code);
    setBusy(false);
  }, [categories, currency.code, transactions]);

  const catById = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories]);

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
    iconBtn: {
      width: 38, height: 38, borderRadius: 12,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: theme.colors.inputBg,
    },
    titleWrap: { flex: 1 },
    title: { ...theme.typography.title, fontSize: 22, fontWeight: '700', color: theme.colors.text },
    subtitle: { ...theme.typography.caption, color: theme.colors.textMuted },
    scroll: { padding: theme.spacing.lg, paddingBottom: 140, gap: theme.spacing.md },
    card: {
      backgroundColor: theme.colors.cardBg,
      borderRadius: theme.borderRadius.xl,
      padding: theme.spacing.lg,
      gap: theme.spacing.md,
      ...theme.shadows.card,
    },
    sectionTitle: {
      ...theme.typography.overline, color: theme.colors.textMuted,
      textTransform: 'uppercase', letterSpacing: 1, marginLeft: theme.spacing.xs,
    },
    chips: { flexDirection: 'row', gap: theme.spacing.sm },
    chip: {
      paddingHorizontal: 14, paddingVertical: 8,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.inputBg,
    },
    chipOn: { backgroundColor: theme.colors.primaryLight },
    chipText: { ...theme.typography.caption, fontWeight: '700', color: theme.colors.textMuted },
    chipTextOn: { color: theme.colors.primary },
    statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md },
    stat: { minWidth: '45%', flex: 1, gap: 2 },
    statLabel: { ...theme.typography.caption, fontSize: 11, color: theme.colors.textMuted },
    statValue: { fontSize: 18, fontWeight: '800', color: theme.colors.text },
    row: {
      flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md,
      paddingVertical: 7,
    },
    dot: { width: 10, height: 10, borderRadius: 3 },
    rowName: { ...theme.typography.bodySmall, color: theme.colors.text, flex: 1 },
    rowAmount: { ...theme.typography.bodySmall, fontWeight: '700', color: theme.colors.text },
    rowMeta: { ...theme.typography.caption, fontSize: 11, color: theme.colors.textMuted },
    exportBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      backgroundColor: theme.colors.primary,
      borderRadius: theme.borderRadius.lg,
      paddingVertical: 14,
    },
    exportSecondary: {
      backgroundColor: theme.colors.inputBg,
    },
    exportText: { ...theme.typography.button, color: '#FFF', fontWeight: '800' },
    exportTextSecondary: { color: theme.colors.text },
    empty: {
      ...theme.typography.bodySmall, color: theme.colors.textMuted,
      textAlign: 'center', paddingVertical: theme.spacing.lg,
    },
  }), [insets.top, theme]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => nav.goBack()}>
          <Ionicons name="chevron-back" size={20} color={theme.colors.text} />
        </TouchableOpacity>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>Reports</Text>
          <Text style={styles.subtitle}>{monthLabel(month)}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.chips}>
          {RANGES.map(r => (
            <TouchableOpacity
              key={r}
              style={[styles.chip, range === r && styles.chipOn]}
              onPress={() => setRange(r)}
            >
              <Text style={[styles.chipText, range === r && styles.chipTextOn]}>
                {r} months
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.card}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <MonthlyBarChart data={series} />
          </ScrollView>
        </View>

        <Text style={styles.sectionTitle}>Totals over {range} months</Text>
        <View style={styles.card}>
          <View style={styles.statGrid}>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Total income</Text>
              <Text style={[styles.statValue, { color: theme.colors.success }]}>
                {money(totals.income)}
              </Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Total spent</Text>
              <Text style={[styles.statValue, { color: theme.colors.error }]}>
                {money(totals.expense)}
              </Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Net</Text>
              <Text style={styles.statValue}>{money(totals.net)}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Avg spend / month</Text>
              <Text style={styles.statValue}>{money(totals.avgExpense)}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Top categories · {monthLabel(month)}</Text>
        <View style={styles.card}>
          {topCategories.length === 0 ? (
            <Text style={styles.empty}>No spending this month</Text>
          ) : (
            topCategories.map(c => (
              <View key={c.categoryId ?? 'none'} style={styles.row}>
                <View style={[styles.dot, { backgroundColor: c.color }]} />
                <Text style={styles.rowName} numberOfLines={1}>{c.name}</Text>
                <Text style={styles.rowAmount}>{money(c.total)}</Text>
                <Text style={styles.rowMeta}>{Math.round(c.share * 100)}%</Text>
              </View>
            ))
          )}
        </View>

        <Text style={styles.sectionTitle}>Largest expenses</Text>
        <View style={styles.card}>
          {biggest.length === 0 ? (
            <Text style={styles.empty}>Nothing recorded this month</Text>
          ) : (
            biggest.map(t => {
              const cat = t.categoryId ? catById.get(t.categoryId) : undefined;
              return (
                <View key={t.id} style={styles.row}>
                  <View style={[styles.dot, { backgroundColor: cat?.color ?? theme.colors.textMuted }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowName} numberOfLines={1}>
                      {t.note || cat?.name || 'Expense'}
                    </Text>
                    <Text style={styles.rowMeta}>{t.date}</Text>
                  </View>
                  <Text style={styles.rowAmount}>{money(t.amount)}</Text>
                </View>
              );
            })
          )}
        </View>

        <Text style={styles.sectionTitle}>Export</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.exportBtn}
            onPress={handleExportMonth}
            disabled={busy}
            activeOpacity={0.85}
          >
            <Ionicons name="download-outline" size={18} color="#FFF" />
            <Text style={styles.exportText}>
              Export {monthLabel(month)} ({thisMonth.income + thisMonth.expense > 0 ? 'CSV' : 'empty'})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.exportBtn, styles.exportSecondary]}
            onPress={handleExportAll}
            disabled={busy}
            activeOpacity={0.85}
          >
            <Ionicons name="albums-outline" size={18} color={theme.colors.text} />
            <Text style={[styles.exportText, styles.exportTextSecondary]}>
              Export all {transactions.length} transactions
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
