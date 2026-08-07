import React, { useMemo } from 'react';
import {
  ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { useMedicine } from '../context/MedicineContext';
import {
  daysOfStockLeft, describeSchedule, dosesPerDay, MEDICINE_FORMS,
} from '../core/medicine';

export function MedicineInventoryScreen() {
  const nav = useNavigation();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { profileMedicines, changeStock } = useMedicine();

  const tracked = useMemo(
    () => profileMedicines.filter(m => !m.archived && m.stockCount !== null),
    [profileMedicines],
  );

  const untracked = useMemo(
    () => profileMedicines.filter(m => !m.archived && m.stockCount === null),
    [profileMedicines],
  );

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
    title: {
      ...theme.typography.title, fontSize: 22, fontWeight: '700',
      color: theme.colors.text, flex: 1,
    },
    scroll: { padding: theme.spacing.lg, paddingBottom: 140, gap: theme.spacing.sm },
    sectionTitle: {
      ...theme.typography.overline, color: theme.colors.textMuted,
      textTransform: 'uppercase', letterSpacing: 1, marginLeft: theme.spacing.xs,
      marginTop: theme.spacing.sm,
    },
    card: {
      backgroundColor: theme.colors.cardBg,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.md,
      gap: theme.spacing.sm,
    },
    top: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
    pill: {
      width: 42, height: 42, borderRadius: 13,
      alignItems: 'center', justifyContent: 'center',
    },
    name: { ...theme.typography.bodySmall, fontWeight: '700', color: theme.colors.text },
    meta: { ...theme.typography.caption, fontSize: 11, color: theme.colors.textMuted },
    count: { fontSize: 22, fontWeight: '800', color: theme.colors.text },
    low: { color: theme.colors.error },
    controls: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
    stepBtn: {
      width: 38, height: 34, borderRadius: 11,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: theme.colors.inputBg,
    },
    stepLabel: { ...theme.typography.caption, fontWeight: '800', color: theme.colors.text },
    warnRow: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: theme.colors.error + '15',
      paddingHorizontal: 10, paddingVertical: 6,
      borderRadius: theme.borderRadius.md,
    },
    warnText: { ...theme.typography.caption, fontSize: 11, color: theme.colors.error, fontWeight: '700' },
    empty: {
      ...theme.typography.bodySmall, color: theme.colors.textMuted,
      textAlign: 'center', paddingVertical: theme.spacing.xxl, lineHeight: 20,
    },
    hint: { ...theme.typography.caption, fontSize: 11, color: theme.colors.textMuted },
  }), [insets.top, theme]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => nav.goBack()}>
          <Ionicons name="chevron-back" size={20} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Inventory</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {tracked.length === 0 ? (
          <Text style={styles.empty}>
            No medicines are tracking stock.{'\n'}
            Edit a medicine and set an amount to track it here.
          </Text>
        ) : (
          tracked.map(m => {
            const days = daysOfStockLeft(m);
            const isLow = m.refillThreshold !== null && (m.stockCount ?? 0) <= m.refillThreshold;
            const perDay = dosesPerDay(m);
            return (
              <View key={m.id} style={styles.card}>
                <View style={styles.top}>
                  <View style={[styles.pill, { backgroundColor: m.color + '22' }]}>
                    <Ionicons
                      name={MEDICINE_FORMS.find(f => f.value === m.form)?.icon ?? 'medkit-outline'}
                      size={19} color={m.color}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{m.name}</Text>
                    <Text style={styles.meta} numberOfLines={1}>{describeSchedule(m)}</Text>
                  </View>
                  <Text style={[styles.count, isLow && styles.low]}>{m.stockCount}</Text>
                </View>

                {isLow && (
                  <View style={styles.warnRow}>
                    <Ionicons name="alert-circle-outline" size={13} color={theme.colors.error} />
                    <Text style={styles.warnText}>
                      Refill soon — at or below {m.refillThreshold}
                    </Text>
                  </View>
                )}

                <View style={styles.controls}>
                  <TouchableOpacity style={styles.stepBtn} onPress={() => changeStock(m.id, -1)}>
                    <Ionicons name="remove" size={17} color={theme.colors.text} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.stepBtn} onPress={() => changeStock(m.id, 1)}>
                    <Ionicons name="add" size={17} color={theme.colors.text} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.stepBtn} onPress={() => changeStock(m.id, 10)}>
                    <Text style={styles.stepLabel}>+10</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.stepBtn} onPress={() => changeStock(m.id, 30)}>
                    <Text style={styles.stepLabel}>+30</Text>
                  </TouchableOpacity>
                  <View style={{ flex: 1 }} />
                  {days !== null && perDay > 0 && (
                    <Text style={styles.hint}>~{days} day{days === 1 ? '' : 's'} left</Text>
                  )}
                </View>
              </View>
            );
          })
        )}

        {untracked.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Not tracked</Text>
            {untracked.map(m => (
              <View key={m.id} style={styles.card}>
                <View style={styles.top}>
                  <View style={[styles.pill, { backgroundColor: m.color + '22' }]}>
                    <Ionicons
                      name={MEDICINE_FORMS.find(f => f.value === m.form)?.icon ?? 'medkit-outline'}
                      size={19} color={m.color}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{m.name}</Text>
                    <Text style={styles.meta}>No stock amount set</Text>
                  </View>
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}
