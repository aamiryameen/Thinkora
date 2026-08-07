import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { useBudget } from '../context/BudgetContext';
import { COVER_COLORS, COVER_ICONS } from '../core/notebooks';
import type { BudgetCategory, TxKind } from '../types/budget';

export function BudgetCategoriesScreen() {
  const nav = useNavigation();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { categories, transactions, addCategory, editCategory, removeCategory } = useBudget();

  const [kind, setKind] = useState<TxKind>('expense');
  const [editing, setEditing] = useState<BudgetCategory | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState(COVER_COLORS[0]);
  const [icon, setIcon] = useState(COVER_ICONS[0]);

  const shown = useMemo(
    () => categories.filter(c => c.kind === kind).sort((a, b) => a.order - b.order),
    [categories, kind],
  );

  const usage = useMemo(() => {
    const counts = new Map<string, number>();
    transactions.forEach(t => {
      if (t.categoryId) counts.set(t.categoryId, (counts.get(t.categoryId) ?? 0) + 1);
    });
    return counts;
  }, [transactions]);

  const openForm = useCallback((cat: BudgetCategory | null) => {
    setEditing(cat);
    setName(cat?.name ?? '');
    setColor(cat?.color ?? COVER_COLORS[0]);
    setIcon(cat?.icon ?? COVER_ICONS[0]);
    setFormOpen(true);
  }, []);

  const save = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (editing) await editCategory(editing.id, { name: trimmed, color, icon });
    else await addCategory({ name: trimmed, color, icon, kind, order: shown.length });
    setFormOpen(false);
    setEditing(null);
  }, [addCategory, color, editCategory, editing, icon, kind, name, shown.length]);

  const confirmDelete = useCallback((cat: BudgetCategory) => {
    const used = usage.get(cat.id) ?? 0;
    const detail = used > 0
      ? `${used} transaction${used > 1 ? 's' : ''} will become uncategorised. The amounts are kept.`
      : 'This category is not used by any transaction.';
    Alert.alert(`Delete "${cat.name}"?`, detail, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => removeCategory(cat.id) },
    ]);
  }, [removeCategory, usage]);

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
      ...theme.typography.title, fontSize: 22, fontWeight: '700',
      color: theme.colors.text, flex: 1,
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
    toggle: {
      flexDirection: 'row', gap: 4, margin: theme.spacing.lg, padding: 4,
      backgroundColor: theme.colors.inputBg, borderRadius: theme.borderRadius.lg,
    },
    toggleBtn: { flex: 1, paddingVertical: 9, borderRadius: theme.borderRadius.md, alignItems: 'center' },
    toggleText: { ...theme.typography.bodySmall, fontWeight: '700', color: theme.colors.textMuted },
    scroll: { paddingHorizontal: theme.spacing.lg, paddingBottom: 140, gap: theme.spacing.sm },
    row: {
      flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md,
      backgroundColor: theme.colors.cardBg,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.md,
    },
    swatch: {
      width: 40, height: 40, borderRadius: 12,
      alignItems: 'center', justifyContent: 'center',
    },
    rowName: { ...theme.typography.bodySmall, fontWeight: '700', color: theme.colors.text },
    rowMeta: { ...theme.typography.caption, fontSize: 11, color: theme.colors.textMuted },
    // Sheet
    overlay: { flex: 1, backgroundColor: theme.colors.overlay, justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: 28, borderTopRightRadius: 28,
      paddingTop: theme.spacing.lg,
      paddingBottom: insets.bottom + theme.spacing.lg,
      maxHeight: '85%',
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
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
    pick: {
      width: 40, height: 40, borderRadius: 12,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 3, borderColor: 'transparent',
    },
    iconPick: {
      width: 44, height: 44, borderRadius: 12,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: theme.colors.inputBg,
      borderWidth: 2, borderColor: 'transparent',
    },
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
        <Text style={styles.title}>Categories</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => openForm(null)}>
          <Ionicons name="add" size={22} color="#FFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.toggle}>
        {(['expense', 'income'] as TxKind[]).map(k => {
          const on = kind === k;
          return (
            <TouchableOpacity
              key={k}
              style={[styles.toggleBtn, on && { backgroundColor: theme.colors.primaryLight }]}
              onPress={() => setKind(k)}
            >
              <Text style={[styles.toggleText, on && { color: theme.colors.primary }]}>
                {k === 'income' ? 'Income' : 'Expense'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {shown.map(cat => {
          const used = usage.get(cat.id) ?? 0;
          return (
            <View key={cat.id} style={styles.row}>
              <View style={[styles.swatch, { backgroundColor: cat.color + '25' }]}>
                <Ionicons name={cat.icon} size={20} color={cat.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowName}>{cat.name}</Text>
                <Text style={styles.rowMeta}>
                  {used} transaction{used === 1 ? '' : 's'}{cat.builtIn ? ' · built-in' : ''}
                </Text>
              </View>
              <TouchableOpacity onPress={() => openForm(cat)} style={{ padding: 6 }}>
                <Ionicons name="create-outline" size={18} color={theme.colors.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => confirmDelete(cat)} style={{ padding: 6 }}>
                <Ionicons name="trash-outline" size={18} color={theme.colors.error} />
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>

      <Modal visible={formOpen} transparent animationType="slide" onRequestClose={() => setFormOpen(false)}>
        <View style={styles.overlay}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setFormOpen(false)} />
          <View style={styles.sheet}>
            <View style={styles.grabber} />
            <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
              <View style={{ alignItems: 'center' }}>
                <View style={[styles.swatch, { backgroundColor: color, width: 56, height: 56, borderRadius: 16 }]}>
                  <Ionicons name={icon} size={26} color="#FFF" />
                </View>
              </View>

              <View style={{ gap: theme.spacing.sm }}>
                <Text style={styles.label}>Name</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Category name"
                  placeholderTextColor={theme.colors.textDisabled}
                  maxLength={30}
                />
              </View>

              <View style={{ gap: theme.spacing.sm }}>
                <Text style={styles.label}>Colour</Text>
                <View style={styles.grid}>
                  {COVER_COLORS.map(c => (
                    <TouchableOpacity
                      key={c}
                      style={[styles.pick, { backgroundColor: c }, c === color && { borderColor: theme.colors.text }]}
                      onPress={() => setColor(c)}
                    >
                      {c === color && <Ionicons name="checkmark" size={18} color="#FFF" />}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={{ gap: theme.spacing.sm }}>
                <Text style={styles.label}>Icon</Text>
                <View style={styles.grid}>
                  {COVER_ICONS.map(ic => (
                    <TouchableOpacity
                      key={ic}
                      style={[styles.iconPick, ic === icon && { borderColor: color, backgroundColor: color + '18' }]}
                      onPress={() => setIcon(ic)}
                    >
                      <Ionicons name={ic} size={20} color={ic === icon ? color : theme.colors.textMuted} />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <TouchableOpacity
                style={[styles.save, !name.trim() && { opacity: 0.45 }]}
                disabled={!name.trim()}
                onPress={save}
              >
                <Text style={styles.saveText}>{editing ? 'Save changes' : 'Add category'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
