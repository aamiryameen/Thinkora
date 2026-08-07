import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert, Modal, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { useBudget } from '../context/BudgetContext';
import { dateKey, parseAmount } from '../core/budget';
import type { RecurringExpense, RecurringInterval, TxKind } from '../types/budget';

const INTERVALS: { value: RecurringInterval; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function BudgetRecurringScreen() {
  const nav = useNavigation();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const {
    categories, recurring, addRecurring, editRecurring, removeRecurring, money,
  } = useBudget();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringExpense | null>(null);
  const [kind, setKind] = useState<TxKind>('expense');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [interval, setInterval] = useState<RecurringInterval>('monthly');
  const [dayOfPeriod, setDayOfPeriod] = useState('1');

  const catById = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories]);
  const options = useMemo(
    () => categories.filter(c => c.kind === kind && !c.archived),
    [categories, kind],
  );

  const openForm = useCallback((rule: RecurringExpense | null) => {
    setEditing(rule);
    setKind(rule?.kind ?? 'expense');
    setAmount(rule ? String(rule.amount) : '');
    setNote(rule?.note ?? '');
    setCategoryId(rule?.categoryId ?? null);
    setInterval(rule?.interval ?? 'monthly');
    setDayOfPeriod(String(rule?.dayOfPeriod ?? 1));
    setFormOpen(true);
  }, []);

  const save = useCallback(async () => {
    const parsed = parseAmount(amount);
    if (parsed === null) return;
    const day = Number(dayOfPeriod);
    const safeDay = Number.isFinite(day) ? Math.max(interval === 'weekly' ? 0 : 1, Math.min(interval === 'weekly' ? 6 : 31, day)) : 1;

    if (editing) {
      await editRecurring(editing.id, {
        amount: parsed, note: note.trim(), categoryId, interval, dayOfPeriod: safeDay,
      });
    } else {
      await addRecurring({
        kind, amount: parsed, note: note.trim(), categoryId,
        interval, dayOfPeriod: safeDay, startDate: dateKey(), active: true,
      });
    }
    setFormOpen(false);
    setEditing(null);
  }, [addRecurring, amount, categoryId, dayOfPeriod, editRecurring, editing, interval, kind, note]);

  const confirmDelete = useCallback((rule: RecurringExpense) => {
    Alert.alert(
      'Delete recurring entry',
      'Transactions already created from it are kept.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => removeRecurring(rule.id) },
      ],
    );
  }, [removeRecurring]);

  const describe = useCallback((rule: RecurringExpense) => {
    if (rule.interval === 'weekly') return `Every ${WEEKDAYS[rule.dayOfPeriod] ?? 'week'}`;
    if (rule.interval === 'yearly') return `Yearly on day ${rule.dayOfPeriod}`;
    return `Monthly on day ${rule.dayOfPeriod}`;
  }, []);

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
    addBtn: {
      width: 38, height: 38, borderRadius: 12,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: theme.colors.primary,
    },
    title: {
      ...theme.typography.title, fontSize: 22, fontWeight: '700',
      color: theme.colors.text, flex: 1,
    },
    scroll: { padding: theme.spacing.lg, paddingBottom: 140, gap: theme.spacing.sm },
    row: {
      flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md,
      backgroundColor: theme.colors.cardBg,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.md,
    },
    swatch: {
      width: 38, height: 38, borderRadius: 12,
      alignItems: 'center', justifyContent: 'center',
    },
    rowName: { ...theme.typography.bodySmall, fontWeight: '700', color: theme.colors.text },
    rowMeta: { ...theme.typography.caption, fontSize: 11, color: theme.colors.textMuted },
    amount: { ...theme.typography.bodySmall, fontWeight: '800' },
    empty: {
      ...theme.typography.bodySmall, color: theme.colors.textMuted,
      textAlign: 'center', paddingVertical: theme.spacing.xxl, lineHeight: 20,
    },
    overlay: { flex: 1, backgroundColor: theme.colors.overlay, justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: 28, borderTopRightRadius: 28,
      paddingTop: theme.spacing.lg,
      paddingBottom: insets.bottom + theme.spacing.lg,
      maxHeight: '88%',
    },
    grabber: {
      alignSelf: 'center', width: 40, height: 4, borderRadius: 2,
      backgroundColor: theme.colors.border, marginBottom: theme.spacing.md,
    },
    body: { paddingHorizontal: theme.spacing.lg, gap: theme.spacing.lg },
    label: {
      ...theme.typography.caption, color: theme.colors.textMuted,
      textTransform: 'uppercase', letterSpacing: 1, fontWeight: '700',
    },
    input: {
      backgroundColor: theme.colors.inputBg,
      borderRadius: theme.borderRadius.lg,
      paddingVertical: 12, paddingHorizontal: theme.spacing.lg,
      borderWidth: 2, borderColor: theme.colors.border,
      ...theme.typography.body, color: theme.colors.text,
    },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
    chip: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingHorizontal: 12, paddingVertical: 9,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.inputBg,
      borderWidth: 2, borderColor: 'transparent',
    },
    chipText: { ...theme.typography.caption, fontWeight: '700', color: theme.colors.text },
    save: {
      backgroundColor: theme.colors.primary,
      borderRadius: theme.borderRadius.lg,
      paddingVertical: 15, alignItems: 'center',
    },
    saveText: { ...theme.typography.button, color: '#FFF', fontWeight: '800' },
  }), [insets.bottom, insets.top, theme]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => nav.goBack()}>
          <Ionicons name="chevron-back" size={20} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Recurring</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => openForm(null)}>
          <Ionicons name="add" size={22} color="#FFF" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {recurring.length === 0 ? (
          <Text style={styles.empty}>
            No recurring entries yet.{'\n'}
            Add rent, salary or subscriptions and they'll be logged automatically.
          </Text>
        ) : (
          recurring.map(rule => {
            const cat = rule.categoryId ? catById.get(rule.categoryId) : undefined;
            const color = cat?.color
              ?? (rule.kind === 'income' ? theme.colors.success : theme.colors.textMuted);
            return (
              <View key={rule.id} style={styles.row}>
                <View style={[styles.swatch, { backgroundColor: color + '25' }]}>
                  <Ionicons name={cat?.icon ?? 'repeat-outline'} size={19} color={color} />
                </View>
                <TouchableOpacity style={{ flex: 1 }} onPress={() => openForm(rule)} activeOpacity={0.7}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {rule.note || cat?.name || 'Recurring'}
                  </Text>
                  <Text style={styles.rowMeta}>
                    {describe(rule)}
                    {rule.lastRunDate ? ` · last ${rule.lastRunDate}` : ''}
                  </Text>
                </TouchableOpacity>
                <Text style={[
                  styles.amount,
                  { color: rule.kind === 'income' ? theme.colors.success : theme.colors.text },
                ]}>
                  {rule.kind === 'income' ? '+' : '−'}{money(rule.amount)}
                </Text>
                <Switch
                  value={rule.active}
                  onValueChange={v => editRecurring(rule.id, { active: v })}
                  trackColor={{ true: theme.colors.primary, false: theme.colors.border }}
                />
                <TouchableOpacity onPress={() => confirmDelete(rule)} style={{ padding: 4 }}>
                  <Ionicons name="trash-outline" size={17} color={theme.colors.error} />
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal visible={formOpen} transparent animationType="slide" onRequestClose={() => setFormOpen(false)}>
        <View style={styles.overlay}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setFormOpen(false)} />
          <View style={styles.sheet}>
            <View style={styles.grabber} />
            <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
              {!editing && (
                <View style={styles.chips}>
                  {(['expense', 'income'] as TxKind[]).map(k => {
                    const on = kind === k;
                    const c = k === 'income' ? theme.colors.success : theme.colors.error;
                    return (
                      <TouchableOpacity
                        key={k}
                        style={[styles.chip, on && { borderColor: c, backgroundColor: c + '18' }]}
                        onPress={() => { setKind(k); setCategoryId(null); }}
                      >
                        <Text style={styles.chipText}>{k === 'income' ? 'Income' : 'Expense'}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              <View style={{ gap: theme.spacing.sm }}>
                <Text style={styles.label}>Amount</Text>
                <TextInput
                  style={styles.input}
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="0"
                  placeholderTextColor={theme.colors.textDisabled}
                  keyboardType="decimal-pad"
                />
              </View>

              <View style={{ gap: theme.spacing.sm }}>
                <Text style={styles.label}>Description</Text>
                <TextInput
                  style={styles.input}
                  value={note}
                  onChangeText={setNote}
                  placeholder="Rent, Netflix, Salary…"
                  placeholderTextColor={theme.colors.textDisabled}
                  maxLength={60}
                />
              </View>

              <View style={{ gap: theme.spacing.sm }}>
                <Text style={styles.label}>Category</Text>
                <View style={styles.chips}>
                  {options.map(c => {
                    const on = c.id === categoryId;
                    return (
                      <TouchableOpacity
                        key={c.id}
                        style={[styles.chip, on && { borderColor: c.color, backgroundColor: c.color + '18' }]}
                        onPress={() => setCategoryId(on ? null : c.id)}
                      >
                        <Ionicons name={c.icon} size={14} color={c.color} />
                        <Text style={styles.chipText}>{c.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={{ gap: theme.spacing.sm }}>
                <Text style={styles.label}>Repeats</Text>
                <View style={styles.chips}>
                  {INTERVALS.map(i => {
                    const on = interval === i.value;
                    return (
                      <TouchableOpacity
                        key={i.value}
                        style={[styles.chip, on && {
                          borderColor: theme.colors.primary,
                          backgroundColor: theme.colors.primaryLight,
                        }]}
                        onPress={() => {
                          setInterval(i.value);
                          setDayOfPeriod(i.value === 'weekly' ? '1' : '1');
                        }}
                      >
                        <Text style={styles.chipText}>{i.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={{ gap: theme.spacing.sm }}>
                <Text style={styles.label}>
                  {interval === 'weekly' ? 'Day of week (0=Sun)' : 'Day of month'}
                </Text>
                <TextInput
                  style={styles.input}
                  value={dayOfPeriod}
                  onChangeText={setDayOfPeriod}
                  keyboardType="number-pad"
                  maxLength={2}
                />
              </View>

              <TouchableOpacity
                style={[styles.save, parseAmount(amount) === null && { opacity: 0.45 }]}
                disabled={parseAmount(amount) === null}
                onPress={save}
              >
                <Text style={styles.saveText}>{editing ? 'Save changes' : 'Add recurring'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
