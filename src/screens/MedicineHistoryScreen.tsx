import React, { useCallback, useMemo, useState } from 'react';
import {
  ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { useMedicine } from '../context/MedicineContext';
import { usePremium, type PremiumFeature } from '../services/premiumService';
import { PremiumGateSheet } from '../components/PremiumGateSheet';
import { exportHistoryCsv } from '../services/medicineService';
import {
  addDays, adherence, dateKey, dosesForDate, formatTime, isMissed,
  MEDICINE_FORMS, parseDateKey,
} from '../core/medicine';
import type { ScheduledDose } from '../types/medicine';

const RANGES = [7, 30, 90];

export function MedicineHistoryScreen() {
  const nav = useNavigation();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { hasPremium } = usePremium();
  const { profiles, activeProfileId, profileMedicines, profileLogs } = useMedicine();

  const [range, setRange] = useState(7);
  const [gateFeature, setGateFeature] = useState<PremiumFeature | null>(null);
  const [busy, setBusy] = useState(false);

  const profileName = useMemo(
    () => profiles.find(p => p.id === activeProfileId)?.name ?? 'Me',
    [activeProfileId, profiles],
  );

  const today = dateKey();
  const fromDate = useMemo(() => addDays(today, -(range - 1)), [range, today]);

  const stats = useMemo(
    () => adherence(profileMedicines, profileLogs, fromDate, today),
    [fromDate, profileLogs, profileMedicines, today],
  );

  /** Days newest first, each with its doses — only days that had any. */
  const days = useMemo(() => {
    const out: { date: string; doses: ScheduledDose[] }[] = [];
    for (let i = 0; i < range; i++) {
      const date = addDays(today, -i);
      const doses = dosesForDate(profileMedicines, profileLogs, date);
      if (doses.length > 0) out.push({ date, doses });
    }
    return out;
  }, [profileLogs, profileMedicines, range, today]);

  const allDoses = useMemo(() => days.flatMap(d => d.doses), [days]);

  const handleExport = useCallback(async () => {
    if (!hasPremium) { setGateFeature('medicine_reports'); return; }
    setBusy(true);
    await exportHistoryCsv(allDoses, profileName);
    setBusy(false);
  }, [allDoses, hasPremium, profileName]);

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
    chips: { flexDirection: 'row', gap: theme.spacing.sm },
    chip: {
      paddingHorizontal: 14, paddingVertical: 8,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.inputBg,
    },
    chipOn: { backgroundColor: theme.colors.primaryLight },
    chipText: { ...theme.typography.caption, fontWeight: '700', color: theme.colors.textMuted },
    chipTextOn: { color: theme.colors.primary },
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
    bigRate: { fontSize: 34, fontWeight: '800', color: theme.colors.text },
    track: {
      height: 8, borderRadius: 4,
      backgroundColor: theme.colors.border, overflow: 'hidden',
    },
    sectionTitle: {
      ...theme.typography.overline, color: theme.colors.textMuted,
      textTransform: 'uppercase', letterSpacing: 1, marginLeft: theme.spacing.xs,
    },
    dayLabel: {
      ...theme.typography.bodySmall, fontWeight: '700',
      color: theme.colors.text, marginBottom: 4,
    },
    doseRow: {
      flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm,
      paddingVertical: 5,
    },
    dot: { width: 8, height: 8, borderRadius: 4 },
    doseName: { ...theme.typography.caption, color: theme.colors.text, flex: 1 },
    doseTime: { ...theme.typography.caption, fontSize: 11, color: theme.colors.textMuted },
    empty: {
      ...theme.typography.bodySmall, color: theme.colors.textMuted,
      textAlign: 'center', paddingVertical: theme.spacing.xl,
    },
    exportBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      backgroundColor: theme.colors.primary,
      borderRadius: theme.borderRadius.lg,
      paddingVertical: 14,
    },
    exportText: { ...theme.typography.button, color: '#FFF', fontWeight: '800' },
  }), [insets.top, theme]);

  const statusColor = (dose: ScheduledDose) => {
    if (dose.status === 'taken') return theme.colors.success;
    if (dose.status === 'skipped') return theme.colors.warning ?? theme.colors.accent;
    return isMissed(dose) ? theme.colors.error : theme.colors.border;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => nav.goBack()}>
          <Ionicons name="chevron-back" size={20} color={theme.colors.text} />
        </TouchableOpacity>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>History</Text>
          <Text style={styles.subtitle}>{profileName}</Text>
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
                {r} days
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.card}>
          <View>
            <Text style={styles.statLabel}>Adherence</Text>
            <Text style={styles.bigRate}>{Math.round(stats.rate * 100)}%</Text>
          </View>
          <View style={styles.track}>
            <View style={{
              height: 8, borderRadius: 4,
              width: `${Math.round(stats.rate * 100)}%`,
              backgroundColor: theme.colors.success,
            }} />
          </View>
          <View style={styles.statRow}>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Taken</Text>
              <Text style={[styles.statValue, { color: theme.colors.success }]}>{stats.taken}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Skipped</Text>
              <Text style={styles.statValue}>{stats.skipped}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Missed</Text>
              <Text style={[styles.statValue, { color: theme.colors.error }]}>{stats.missed}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Doctor report</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.exportBtn}
            onPress={handleExport}
            disabled={busy}
            activeOpacity={0.85}
          >
            <Ionicons
              name={hasPremium ? 'document-text-outline' : 'lock-closed-outline'}
              size={18} color="#FFF"
            />
            <Text style={styles.exportText}>Export {range}-day report</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Log</Text>
        {days.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.empty}>No doses recorded in this range</Text>
          </View>
        ) : (
          days.map(day => (
            <View key={day.date} style={styles.card}>
              <View>
                <Text style={styles.dayLabel}>
                  {day.date === today
                    ? 'Today'
                    : parseDateKey(day.date).toLocaleDateString(undefined, {
                      weekday: 'short', month: 'short', day: 'numeric',
                    })}
                </Text>
                {day.doses.map(dose => (
                  <View key={`${dose.medicine.id}-${dose.minutes ?? 'prn'}`} style={styles.doseRow}>
                    <View style={[styles.dot, { backgroundColor: statusColor(dose) }]} />
                    <Ionicons
                      name={MEDICINE_FORMS.find(f => f.value === dose.medicine.form)?.icon ?? 'medkit-outline'}
                      size={13}
                      color={dose.medicine.color}
                    />
                    <Text style={styles.doseName} numberOfLines={1}>{dose.medicine.name}</Text>
                    <Text style={styles.doseTime}>
                      {dose.minutes === null ? 'PRN' : formatTime(dose.minutes)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <PremiumGateSheet
        visible={gateFeature !== null}
        feature={gateFeature ?? undefined}
        onClose={() => setGateFeature(null)}
      />
    </View>
  );
}
