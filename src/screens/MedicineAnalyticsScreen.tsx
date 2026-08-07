import React, { useCallback, useMemo, useState } from 'react';
import {
  ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Svg, { Rect } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';
import { useMedicine } from '../context/MedicineContext';
import { exportMedicineData } from '../services/medicineService';
import {
  addDays, adherence, adherenceByMedicine, adherenceTrend, dateKey,
  missesByTimeOfDay, parseDateKey,
} from '../core/medicine';

const RANGES = [7, 30, 90];

export function MedicineAnalyticsScreen() {
  const nav = useNavigation();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { profiles, activeProfileId, profileMedicines, profileLogs } = useMedicine();

  const [range, setRange] = useState(30);
  const [busy, setBusy] = useState(false);

  const profileName = useMemo(
    () => profiles.find(p => p.id === activeProfileId)?.name ?? 'Me',
    [activeProfileId, profiles],
  );

  const today = dateKey();
  const fromDate = useMemo(() => addDays(today, -(range - 1)), [range, today]);

  const overall = useMemo(
    () => adherence(profileMedicines, profileLogs, fromDate, today),
    [fromDate, profileLogs, profileMedicines, today],
  );

  const perMedicine = useMemo(
    () => adherenceByMedicine(profileMedicines, profileLogs, fromDate, today),
    [fromDate, profileLogs, profileMedicines, today],
  );

  const trend = useMemo(
    () => adherenceTrend(profileMedicines, profileLogs, fromDate, today),
    [fromDate, profileLogs, profileMedicines, today],
  );

  const misses = useMemo(
    () => missesByTimeOfDay(profileMedicines, profileLogs, fromDate, today),
    [fromDate, profileLogs, profileMedicines, today],
  );

  /** Monthly rollup: one row per calendar month inside the range. */
  const monthly = useMemo(() => {
    const byMonth = new Map<string, { taken: number; expected: number }>();
    trend.forEach(day => {
      const key = day.date.slice(0, 7);
      const cur = byMonth.get(key) ?? { taken: 0, expected: 0 };
      cur.taken += day.taken;
      cur.expected += day.expected;
      byMonth.set(key, cur);
    });
    return Array.from(byMonth.entries())
      .map(([month, v]) => ({
        month,
        ...v,
        rate: v.expected > 0 ? v.taken / v.expected : 0,
      }))
      .sort((a, b) => b.month.localeCompare(a.month));
  }, [trend]);

  const worstSlot = useMemo(
    () => misses.reduce((worst, m) => (m.missed > worst.missed ? m : worst), misses[0]),
    [misses],
  );

  const handleExport = useCallback(async () => {
    setBusy(true);
    try { await exportMedicineData(); } finally { setBusy(false); }
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
    sectionTitle: {
      ...theme.typography.overline, color: theme.colors.textMuted,
      textTransform: 'uppercase', letterSpacing: 1, marginLeft: theme.spacing.xs,
    },
    bigRate: { fontSize: 36, fontWeight: '800', color: theme.colors.text },
    statLabel: { ...theme.typography.caption, fontSize: 11, color: theme.colors.textMuted },
    statRow: { flexDirection: 'row', gap: theme.spacing.md },
    stat: { flex: 1, gap: 2 },
    statValue: { fontSize: 18, fontWeight: '800', color: theme.colors.text },
    row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, paddingVertical: 6 },
    dot: { width: 10, height: 10, borderRadius: 5 },
    rowName: { ...theme.typography.bodySmall, color: theme.colors.text, flex: 1 },
    rowMeta: { ...theme.typography.caption, fontSize: 11, color: theme.colors.textMuted },
    track: { height: 6, borderRadius: 3, backgroundColor: theme.colors.border, overflow: 'hidden' },
    insight: {
      flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm,
      backgroundColor: theme.colors.primaryLight,
      padding: theme.spacing.md, borderRadius: theme.borderRadius.md,
    },
    insightText: { ...theme.typography.caption, color: theme.colors.primary, flex: 1, fontWeight: '600' },
    exportBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      backgroundColor: theme.colors.primary,
      borderRadius: theme.borderRadius.lg,
      paddingVertical: 14,
    },
    exportText: { ...theme.typography.button, color: '#FFF', fontWeight: '800' },
    empty: {
      ...theme.typography.bodySmall, color: theme.colors.textMuted,
      textAlign: 'center', paddingVertical: theme.spacing.xl,
    },
    axisRow: { flexDirection: 'row', justifyContent: 'space-between' },
  }), [insets.top, theme]);

  // Bar width shrinks as the range grows so 90 days still fits the card.
  const barWidth = range <= 7 ? 26 : range <= 30 ? 8 : 3;
  const barGap = range <= 7 ? 8 : range <= 30 ? 2 : 1;
  const chartHeight = 110;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => nav.goBack()}>
          <Ionicons name="chevron-back" size={20} color={theme.colors.text} />
        </TouchableOpacity>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>Analytics</Text>
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
            <Text style={styles.statLabel}>Overall adherence</Text>
            <Text style={styles.bigRate}>{Math.round(overall.rate * 100)}%</Text>
          </View>
          <View style={styles.statRow}>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Taken</Text>
              <Text style={[styles.statValue, { color: theme.colors.success }]}>{overall.taken}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Missed</Text>
              <Text style={[styles.statValue, { color: theme.colors.error }]}>{overall.missed}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Skipped</Text>
              <Text style={styles.statValue}>{overall.skipped}</Text>
            </View>
          </View>

          {worstSlot && worstSlot.missed > 0 && (
            <View style={styles.insight}>
              <Ionicons name="bulb-outline" size={17} color={theme.colors.primary} />
              <Text style={styles.insightText}>
                Most doses are missed in the {worstSlot.label.toLowerCase()}
                {' '}({worstSlot.missed} in this range).
              </Text>
            </View>
          )}
        </View>

        <Text style={styles.sectionTitle}>Daily trend</Text>
        <View style={styles.card}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <Svg
              width={Math.max(1, trend.length * (barWidth + barGap))}
              height={chartHeight}
            >
              {trend.map((day, i) => {
                const h = Math.round(day.rate * (chartHeight - 6));
                return (
                  <Rect
                    key={day.date}
                    x={i * (barWidth + barGap)}
                    y={chartHeight - Math.max(2, h)}
                    width={barWidth}
                    height={Math.max(2, h)}
                    rx={barWidth > 6 ? 3 : 1}
                    fill={
                      day.expected === 0
                        ? theme.colors.border
                        : day.rate >= 0.8
                          ? theme.colors.success
                          : day.rate >= 0.5
                            ? theme.colors.accent
                            : theme.colors.error
                    }
                  />
                );
              })}
            </Svg>
          </ScrollView>
          <View style={styles.axisRow}>
            <Text style={styles.rowMeta}>
              {parseDateKey(fromDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </Text>
            <Text style={styles.rowMeta}>Today</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>By medicine</Text>
        <View style={styles.card}>
          {perMedicine.length === 0 ? (
            <Text style={styles.empty}>No doses recorded in this range</Text>
          ) : (
            perMedicine.map(m => (
              <View key={m.medicineId} style={{ gap: 4, paddingVertical: 4 }}>
                <View style={styles.row}>
                  <View style={[styles.dot, { backgroundColor: m.color }]} />
                  <Text style={styles.rowName} numberOfLines={1}>{m.name}</Text>
                  <Text style={styles.statLabel}>{Math.round(m.rate * 100)}%</Text>
                </View>
                <View style={styles.track}>
                  <View style={{
                    height: 6, borderRadius: 3,
                    width: `${Math.round(m.rate * 100)}%`,
                    backgroundColor: m.rate >= 0.8 ? theme.colors.success : theme.colors.error,
                  }} />
                </View>
                <Text style={styles.rowMeta}>
                  {m.taken} taken · {m.missed} missed · {m.skipped} skipped
                </Text>
              </View>
            ))
          )}
        </View>

        <Text style={styles.sectionTitle}>Monthly summary</Text>
        <View style={styles.card}>
          {monthly.length === 0 ? (
            <Text style={styles.empty}>Nothing to summarise yet</Text>
          ) : (
            monthly.map(m => (
              <View key={m.month} style={styles.row}>
                <Ionicons name="calendar-outline" size={17} color={theme.colors.textMuted} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowName}>
                    {new Date(
                      Number(m.month.slice(0, 4)),
                      Number(m.month.slice(5, 7)) - 1,
                      1,
                    ).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                  </Text>
                  <Text style={styles.rowMeta}>
                    {m.taken} of {m.expected} doses taken
                  </Text>
                </View>
                <Text style={styles.statLabel}>{Math.round(m.rate * 100)}%</Text>
              </View>
            ))
          )}
        </View>

        <Text style={styles.sectionTitle}>Backup</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.exportBtn}
            onPress={handleExport}
            disabled={busy}
            activeOpacity={0.85}
          >
            <Ionicons name="download-outline" size={18} color="#FFF" />
            <Text style={styles.exportText}>Export medicine data (JSON)</Text>
          </TouchableOpacity>
          <Text style={styles.rowMeta}>
            Includes every profile, medicine and dose log. Photos are device-local
            and are not included.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
