import React, { useCallback, useMemo, useState } from 'react';
import {
  Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { useBudget } from '../context/BudgetContext';
import { BudgetBar } from '../components/BudgetCharts';
import {
  budgetFor, budgetProgress, monthLabel, parseAmount,
} from '../core/budget';


export function BudgetLimitsScreen() {
  const nav = useNavigation();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const {
    categories, transactions, budgets, month, setBudget, removeBudget, money,
  } = useBudget();

  const [target, setTarget] = useState<{ id: string | null; name: string } | null>(null);
  const [limitText, setLimitText] = useState('');

  const expenseCats = useMemo(
    () => categories.filter(c => c.kind === 'expense' && !c.archived).sort((a, b) => a.order - b.order),
    [categories],
  );

  const rows = useMemo(() => {
    const overall = budgetFor(budgets, null, month);
    const list = [{
      categoryId: null as string | null,
      name: 'Overall',
      color: theme.colors.primary,
      icon: 'wallet-outline',
      progress: overall ? budgetProgress(overall, transactions, month) : null,
      budgetId: overall?.id ?? null,
    }];

    expenseCats.forEach(c => {
      const b = budgetFor(budgets, c.id, month);
      list.push({
        categoryId: c.id,
        name: c.name,
        color: c.color,
        icon: c.icon,
        progress: b ? budgetProgress(b, transactions, month) : null,
        budgetId: b?.id ?? null,
      });
    });
    return list;
  }, [budgets, expenseCats, month, theme.colors.primary, transactions]);

  const open = useCallback((categoryId: string | null, name: string, current: number | null) => {
    setTarget({ id: categoryId, name });
    setLimitText(current ? String(current) : '');
  }, []);

  const save = useCallback(async () => {
    if (!target) return;
    const parsed = parseAmount(limitText);
    if (parsed === null) return;
    // Stored with month: null so the limit repeats every month until changed.
    await setBudget({ categoryId: target.id, limit: parsed, month: null });
    setTarget(null);
  }, [limitText, setBudget, target]);

  const clear = useCallback(async (budgetId: string | null) => {
    if (budgetId) await removeBudget(budgetId);
    setTarget(null);
  }, [removeBudget]);

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
    scroll: { padding: theme.spacing.lg, paddingBottom: 140, gap: theme.spacing.sm },
    row: {
      backgroundColor: theme.colors.cardBg,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.md,
      gap: theme.spacing.sm,
    },
    rowTop: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
    swatch: {
      width: 38, height: 38, borderRadius: 12,
      alignItems: 'center', justifyContent: 'center',
    },
    rowName: { ...theme.typography.bodySmall, fontWeight: '700', color: theme.colors.text, flex: 1 },
    amount: { ...theme.typography.caption, fontWeight: '700', color: theme.colors.text },
    unset: { ...theme.typography.caption, color: theme.colors.textMuted },
    over: { color: theme.colors.error },
    overlay: { flex: 1, backgroundColor: theme.colors.overlay, justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: 28, borderTopRightRadius: 28,
      padding: theme.spacing.lg,
      paddingBottom: insets.bottom + theme.spacing.lg,
      gap: theme.spacing.lg,
    },
    label: {
      ...theme.typography.caption, color: theme.colors.textMuted,
      textTransform: 'uppercase', letterSpacing: 1, fontWeight: '700',
    },
    input: {
      backgroundColor: theme.colors.inputBg,
      borderRadius: theme.borderRadius.lg,
      paddingVertical: 14, paddingHorizontal: theme.spacing.lg,
      borderWidth: 2, borderColor: theme.colors.border,
      fontSize: 22, fontWeight: '800', color: theme.colors.text,
    },
    save: {
      backgroundColor: theme.colors.primary,
      borderRadius: theme.borderRadius.lg,
      paddingVertical: 15, alignItems: 'center',
    },
    saveText: { ...theme.typography.button, color: '#FFF', fontWeight: '800' },
    clearBtn: { alignItems: 'center', paddingVertical: theme.spacing.sm },
    clearText: { ...theme.typography.bodySmall, color: theme.colors.error, fontWeight: '700' },
  }), [insets.bottom, insets.top, theme]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => nav.goBack()}>
          <Ionicons name="chevron-back" size={20} color={theme.colors.text} />
        </TouchableOpacity>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>Budgets</Text>
          <Text style={styles.subtitle}>{monthLabel(month)}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {rows.map(r => (
          <TouchableOpacity
            key={r.categoryId ?? 'overall'}
            style={styles.row}
            onPress={() => open(r.categoryId, r.name, r.progress?.limit ?? null)}
            activeOpacity={0.8}
          >
            <View style={styles.rowTop}>
              <View style={[styles.swatch, { backgroundColor: r.color + '25' }]}>
                <Ionicons name={r.icon} size={19} color={r.color} />
              </View>
              <Text style={styles.rowName}>{r.name}</Text>
              {r.progress ? (
                <Text style={[styles.amount, r.progress.over && styles.over]}>
                  {money(r.progress.spent)} / {money(r.progress.limit)}
                </Text>
              ) : (
                <Text style={styles.unset}>Set limit</Text>
              )}
            </View>
            {r.progress && (
              <BudgetBar ratio={r.progress.ratio} over={r.progress.over} color={r.color} />
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Modal visible={target !== null} transparent animationType="slide" onRequestClose={() => setTarget(null)}>
        <View style={styles.overlay}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setTarget(null)} />
          <View style={styles.sheet}>
            <Text style={styles.label}>{target?.name} monthly limit</Text>
            <TextInput
              style={styles.input}
              value={limitText}
              onChangeText={setLimitText}
              placeholder="0"
              placeholderTextColor={theme.colors.textDisabled}
              keyboardType="decimal-pad"
              autoFocus
            />
            <TouchableOpacity
              style={[styles.save, parseAmount(limitText) === null && { opacity: 0.45 }]}
              disabled={parseAmount(limitText) === null}
              onPress={save}
            >
              <Text style={styles.saveText}>Save limit</Text>
            </TouchableOpacity>
            {rows.find(r => r.categoryId === target?.id)?.budgetId && (
              <TouchableOpacity
                style={styles.clearBtn}
                onPress={() => clear(rows.find(r => r.categoryId === target?.id)?.budgetId ?? null)}
              >
                <Text style={styles.clearText}>Remove budget</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}
