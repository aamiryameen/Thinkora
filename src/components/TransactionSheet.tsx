import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { dateKey, parseAmount } from '../core/budget';
import type { BudgetCategory, Transaction, TxKind } from '../types/budget';

interface Props {
  visible: boolean;
  categories: BudgetCategory[];
  /** Provided when editing; omitted for a new entry. */
  editing?: Transaction | null;
  onSave: (values: {
    kind: TxKind; amount: number; categoryId: string | null; note: string; date: string;
  }) => void;
  onDelete?: () => void;
  onClose: () => void;
}

export function TransactionSheet({
  visible, categories, editing, onSave, onDelete, onClose,
}: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const [kind, setKind] = useState<TxKind>('expense');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [date, setDate] = useState(dateKey());

  // Re-seed on open so a previous entry's values never leak into a new one.
  useEffect(() => {
    if (!visible) return;
    setKind(editing?.kind ?? 'expense');
    setAmount(editing ? String(editing.amount) : '');
    setCategoryId(editing?.categoryId ?? null);
    setNote(editing?.note ?? '');
    setDate(editing?.date ?? dateKey());
  }, [editing, visible]);

  const options = useMemo(
    () => categories.filter(c => c.kind === kind && !c.archived),
    [categories, kind],
  );

  // Clear a category that belongs to the other kind after a toggle.
  useEffect(() => {
    if (categoryId && !options.some(c => c.id === categoryId)) setCategoryId(null);
  }, [categoryId, options]);

  const parsed = parseAmount(amount);
  const valid = parsed !== null;

  const styles = useMemo(() => StyleSheet.create({
    overlay: { flex: 1, backgroundColor: theme.colors.overlay, justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: 28, borderTopRightRadius: 28,
      paddingTop: theme.spacing.lg,
      paddingBottom: insets.bottom + theme.spacing.lg,
      maxHeight: '90%',
    },
    grabber: {
      alignSelf: 'center', width: 40, height: 4, borderRadius: 2,
      backgroundColor: theme.colors.border, marginBottom: theme.spacing.md,
    },
    body: { paddingHorizontal: theme.spacing.lg, gap: theme.spacing.lg },
    toggle: {
      flexDirection: 'row', gap: 4, padding: 4,
      backgroundColor: theme.colors.inputBg,
      borderRadius: theme.borderRadius.lg,
    },
    toggleBtn: {
      flex: 1, paddingVertical: 10, borderRadius: theme.borderRadius.md,
      alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6,
    },
    toggleText: { ...theme.typography.bodySmall, fontWeight: '700', color: theme.colors.textMuted },
    amountRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
    amountInput: {
      flex: 1, fontSize: 34, fontWeight: '800',
      color: theme.colors.text, padding: 0,
    },
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
    saveDisabled: { opacity: 0.45 },
    saveText: { ...theme.typography.button, color: '#FFF', fontWeight: '800' },
    deleteBtn: { alignItems: 'center', paddingVertical: theme.spacing.sm },
    deleteText: { ...theme.typography.bodySmall, color: theme.colors.error, fontWeight: '700' },
  }), [insets.bottom, theme]);

  const accent = kind === 'income' ? theme.colors.success : theme.colors.error;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.grabber} />
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <View style={styles.toggle}>
              {(['expense', 'income'] as TxKind[]).map(k => {
                const on = kind === k;
                const c = k === 'income' ? theme.colors.success : theme.colors.error;
                return (
                  <TouchableOpacity
                    key={k}
                    style={[styles.toggleBtn, on && { backgroundColor: c + '20' }]}
                    onPress={() => setKind(k)}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={k === 'income' ? 'arrow-down-circle-outline' : 'arrow-up-circle-outline'}
                      size={17}
                      color={on ? c : theme.colors.textMuted}
                    />
                    <Text style={[styles.toggleText, on && { color: c }]}>
                      {k === 'income' ? 'Income' : 'Expense'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.amountRow}>
              <Text style={{ fontSize: 30, fontWeight: '800', color: accent }}>
                {kind === 'income' ? '+' : '−'}
              </Text>
              <TextInput
                style={styles.amountInput}
                value={amount}
                onChangeText={setAmount}
                placeholder="0"
                placeholderTextColor={theme.colors.textDisabled}
                keyboardType="decimal-pad"
                autoFocus={!editing}
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
                      activeOpacity={0.8}
                    >
                      <Ionicons name={c.icon} size={14} color={c.color} />
                      <Text style={styles.chipText}>{c.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={{ gap: theme.spacing.sm }}>
              <Text style={styles.label}>Note</Text>
              <TextInput
                style={styles.input}
                value={note}
                onChangeText={setNote}
                placeholder="What was it for?"
                placeholderTextColor={theme.colors.textDisabled}
                maxLength={120}
              />
            </View>

            <View style={{ gap: theme.spacing.sm }}>
              <Text style={styles.label}>Date</Text>
              <TextInput
                style={styles.input}
                value={date}
                onChangeText={setDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={theme.colors.textDisabled}
                maxLength={10}
              />
            </View>

            <TouchableOpacity
              style={[styles.save, !valid && styles.saveDisabled]}
              disabled={!valid}
              onPress={() => onSave({ kind, amount: parsed!, categoryId, note: note.trim(), date })}
              activeOpacity={0.85}
            >
              <Text style={styles.saveText}>{editing ? 'Save changes' : 'Add transaction'}</Text>
            </TouchableOpacity>

            {editing && onDelete && (
              <TouchableOpacity style={styles.deleteBtn} onPress={onDelete}>
                <Text style={styles.deleteText}>Delete transaction</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
