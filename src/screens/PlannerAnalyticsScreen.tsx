/**
 * PlannerAnalyticsScreen (premium) — how the planning actually went.
 *
 * Free users see a locked preview with the headline numbers blurred out and
 * an upgrade path, rather than a dead end.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { PremiumGateSheet } from '../components/PremiumGateSheet';
import { useTheme } from '../context/ThemeContext';
import {
  computePlannerAnalytics, trailingRange, type PlannerAnalytics,
} from '../services/plannerAnalyticsService';
import { BLOCK_KIND_ICONS } from '../services/plannerScheduleService';
import {
  formatDuration, fromDateKey, getBlocksInRange, getDaysInRange,
} from '../services/plannerService';
import { usePremium } from '../services/premiumService';

const RANGES = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
] as const;

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function hourLabel(hour: number): string {
  return `${hour % 12 || 12}${hour < 12 ? 'am' : 'pm'}`;
}

export function PlannerAnalyticsScreen() {
  const navigation = useNavigation<any>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { hasPremium, loading: premiumLoading } = usePremium();

  const [rangeDays, setRangeDays] = useState<number>(30);
  const [analytics, setAnalytics] = useState<PlannerAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [gateOpen, setGateOpen] = useState(false);

  const load = useCallback(async (days: number) => {
    setLoading(true);
    const { startKey, endKey } = trailingRange(days);
    const [blocks, dayPlans] = await Promise.all([
      getBlocksInRange(startKey, endKey),
      getDaysInRange(startKey, endKey),
    ]);
    setAnalytics(computePlannerAnalytics(blocks, dayPlans, startKey, endKey));
    setLoading(false);
  }, []);

  useEffect(() => { load(rangeDays); }, [load, rangeDays]);

  // 30/90-day ranges compress into ~12 buckets so the bars stay readable.
  // Declared before any early return so the hook order never changes when the
  // entitlement flips mid-session.
  const chartBuckets = useMemo(() => {
    if (!analytics) return [];
    if (analytics.byDay.length <= 14) {
      return analytics.byDay.map(d => ({
        label: d.label, plannedMinutes: d.plannedMinutes, completedMinutes: d.completedMinutes,
      }));
    }
    const size = Math.ceil(analytics.byDay.length / 12);
    const buckets: { label: string; plannedMinutes: number; completedMinutes: number }[] = [];
    for (let i = 0; i < analytics.byDay.length; i += size) {
      const slice = analytics.byDay.slice(i, i + size);
      buckets.push({
        label: String(fromDateKey(slice[0].date).getDate()),
        plannedMinutes: slice.reduce((s, d) => s + d.plannedMinutes, 0),
        completedMinutes: slice.reduce((s, d) => s + d.completedMinutes, 0),
      });
    }
    return buckets;
  }, [analytics]);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    header: {
      paddingTop: insets.top + theme.spacing.sm,
      paddingBottom: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      backgroundColor: theme.colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
    headerTitle: { ...theme.typography.titleSmall, fontWeight: '800', color: theme.colors.text, flex: 1 },
    iconBtn: {
      width: 34, height: 34, borderRadius: 11,
      backgroundColor: theme.colors.inputBg, alignItems: 'center', justifyContent: 'center',
    },
    rangeRow: {
      flexDirection: 'row', gap: 5, marginTop: theme.spacing.md,
      backgroundColor: theme.colors.inputBg, borderRadius: 10, padding: 3,
    },
    rangeBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
    rangeText: { ...theme.typography.caption, fontWeight: '700', color: theme.colors.textMuted },

    content: { padding: theme.spacing.lg, paddingBottom: 60, gap: theme.spacing.lg },
    sectionLabel: {
      ...theme.typography.overline, color: theme.colors.textMuted,
      textTransform: 'uppercase', marginBottom: theme.spacing.sm,
    },

    heroRow: { flexDirection: 'row', gap: theme.spacing.sm },
    hero: {
      flex: 1, borderRadius: theme.borderRadius.xl,
      padding: theme.spacing.lg, alignItems: 'center', gap: 3,
      ...theme.shadows.card,
    },
    heroNum: { fontSize: 26, fontWeight: '800', color: '#FFF' },
    heroLabel: { fontSize: 10.5, fontWeight: '700', color: '#FFFFFFCC', textTransform: 'uppercase', textAlign: 'center' },

    card: {
      backgroundColor: theme.colors.cardBg, borderRadius: theme.borderRadius.xl,
      padding: theme.spacing.lg, ...theme.shadows.card,
    },
    statGrid: { flexDirection: 'row', flexWrap: 'wrap' },
    statCell: { width: '50%', paddingVertical: theme.spacing.sm, gap: 2 },
    statNum: { fontSize: 19, fontWeight: '800', color: theme.colors.text },
    statLabel: { ...theme.typography.caption, fontSize: 11.5, color: theme.colors.textMuted, fontWeight: '600' },

    // Bar chart
    chartRow: { flexDirection: 'row', alignItems: 'flex-end', height: 130, gap: 3, marginTop: 4 },
    chartCol: { flex: 1, alignItems: 'center', gap: 3, justifyContent: 'flex-end' },
    barStack: { width: '78%', justifyContent: 'flex-end', alignItems: 'center' },
    barPlanned: { width: '100%', borderRadius: 3, minHeight: 2 },
    barDone: { width: '100%', borderTopLeftRadius: 3, borderTopRightRadius: 3, position: 'absolute', bottom: 0 },
    chartLabel: { fontSize: 8.5, color: theme.colors.textMuted, fontWeight: '700' },
    legendRow: { flexDirection: 'row', gap: theme.spacing.md, marginTop: theme.spacing.md, justifyContent: 'center' },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    legendDot: { width: 9, height: 9, borderRadius: 3 },
    legendText: { fontSize: 10.5, color: theme.colors.textMuted, fontWeight: '600' },

    // Kind breakdown
    kindRow: { paddingVertical: 8, gap: 6 },
    kindHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    kindName: { ...theme.typography.bodySmall, fontWeight: '700', color: theme.colors.text, flex: 1, textTransform: 'capitalize' },
    kindMeta: { ...theme.typography.caption, fontSize: 11.5, color: theme.colors.textMuted, fontWeight: '600' },
    kindTrack: { height: 7, borderRadius: 4, backgroundColor: theme.colors.inputBg, overflow: 'hidden' },
    kindFill: { height: 7, borderRadius: 4 },

    // Hour heat
    heatRow: { flexDirection: 'row', gap: 2, marginTop: 6 },
    heatCell: { flex: 1, height: 34, borderRadius: 3 },
    heatLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 },
    heatLabel: { fontSize: 8.5, color: theme.colors.textMuted, fontWeight: '700' },

    insight: { flexDirection: 'row', gap: theme.spacing.md, paddingVertical: 9, alignItems: 'flex-start' },
    insightIcon: {
      width: 34, height: 34, borderRadius: 11,
      alignItems: 'center', justifyContent: 'center',
    },
    insightTitle: { ...theme.typography.bodySmall, fontWeight: '700', color: theme.colors.text },
    insightBody: { ...theme.typography.caption, fontSize: 11.5, color: theme.colors.textMuted, marginTop: 2, lineHeight: 17 },

    empty: { alignItems: 'center', paddingVertical: 50, gap: 10 },
    emptyText: { ...theme.typography.bodySmall, color: theme.colors.textMuted, textAlign: 'center', lineHeight: 20, paddingHorizontal: 30 },

    lockedBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
      backgroundColor: theme.colors.primary, borderRadius: theme.borderRadius.lg,
      paddingVertical: 15, marginTop: theme.spacing.md,
    },
    lockedBtnText: { ...theme.typography.button, fontWeight: '800', color: '#FFF' },
    loading: { paddingTop: 80, alignItems: 'center' },
  }), [insets, theme]);

  // ── Free-tier locked state ──
  if (!premiumLoading && !hasPremium) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.iconBtn}>
              <Ionicons name="arrow-back" size={19} color={theme.colors.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Planner Analytics</Text>
          </View>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.empty}>
            <Ionicons name="stats-chart-outline" size={46} color={theme.colors.accent} />
            <Text style={styles.emptyText}>
              Advanced analytics shows your planning adherence, peak productive hours, where your
              time actually goes, and your planning streak.
            </Text>
          </View>
          <TouchableOpacity style={styles.lockedBtn} onPress={() => setGateOpen(true)} activeOpacity={0.85}>
            <Ionicons name="diamond-outline" size={17} color="#FFF" />
            <Text style={styles.lockedBtnText}>Unlock analytics</Text>
          </TouchableOpacity>
        </ScrollView>
        <PremiumGateSheet
          visible={gateOpen}
          feature="planner_analytics"
          onClose={() => setGateOpen(false)}
        />
      </View>
    );
  }

  const maxHeat = analytics ? Math.max(1, ...analytics.byHour.map(h => h.minutes)) : 1;
  const hasData = analytics != null && (analytics.blocksTotal > 0 || analytics.daysPlanned > 0);
  const maxBucket = Math.max(1, ...chartBuckets.map(b => b.plannedMinutes));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.iconBtn}>
            <Ionicons name="arrow-back" size={19} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Planner Analytics</Text>
        </View>
        <View style={styles.rangeRow}>
          {RANGES.map(r => (
            <TouchableOpacity
              key={r.days}
              style={[styles.rangeBtn, rangeDays === r.days && {
                backgroundColor: theme.colors.surface, ...theme.shadows.subtle,
              }]}
              onPress={() => setRangeDays(r.days)}
            >
              <Text style={[styles.rangeText, rangeDays === r.days && { color: theme.colors.primary }]}>
                {r.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {loading || !analytics ? (
        <View style={styles.loading}><ActivityIndicator color={theme.colors.primary} /></View>
      ) : !hasData ? (
        <View style={styles.empty}>
          <Ionicons name="analytics-outline" size={46} color={theme.colors.textDisabled} />
          <Text style={styles.emptyText}>
            No planner data in the last {rangeDays} days yet. Plan a few days and block some time —
            the numbers show up here automatically.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Headline */}
          <View style={styles.heroRow}>
            <View style={[styles.hero, { backgroundColor: theme.colors.primary }]}>
              <Text style={styles.heroNum}>{analytics.adherencePct}%</Text>
              <Text style={styles.heroLabel}>Plan adherence</Text>
            </View>
            <View style={[styles.hero, { backgroundColor: theme.colors.success }]}>
              <Text style={styles.heroNum}>{analytics.planningRatePct}%</Text>
              <Text style={styles.heroLabel}>Days planned</Text>
            </View>
            <View style={[styles.hero, { backgroundColor: theme.colors.accent }]}>
              <Text style={styles.heroNum}>{analytics.planningStreak}</Text>
              <Text style={styles.heroLabel}>Day streak</Text>
            </View>
          </View>

          {/* Numbers */}
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>The numbers</Text>
            <View style={styles.statGrid}>
              <View style={styles.statCell}>
                <Text style={styles.statNum}>{formatDuration(analytics.totalPlannedMinutes)}</Text>
                <Text style={styles.statLabel}>Time blocked</Text>
              </View>
              <View style={styles.statCell}>
                <Text style={styles.statNum}>{formatDuration(analytics.totalCompletedMinutes)}</Text>
                <Text style={styles.statLabel}>Time completed</Text>
              </View>
              <View style={styles.statCell}>
                <Text style={styles.statNum}>{analytics.blocksDone}/{analytics.blocksTotal}</Text>
                <Text style={styles.statLabel}>Blocks finished</Text>
              </View>
              <View style={styles.statCell}>
                <Text style={styles.statNum}>{formatDuration(analytics.avgPlannedMinutesPerActiveDay)}</Text>
                <Text style={styles.statLabel}>Avg per planned day</Text>
              </View>
              <View style={styles.statCell}>
                <Text style={styles.statNum}>{analytics.goalCompletionPct}%</Text>
                <Text style={styles.statLabel}>Daily goals hit ({analytics.goalsDone}/{analytics.goalsTotal})</Text>
              </View>
              <View style={styles.statCell}>
                <Text style={styles.statNum}>{analytics.priorityCompletionPct}%</Text>
                <Text style={styles.statLabel}>Top-3 hit ({analytics.prioritiesDone}/{analytics.prioritiesTotal})</Text>
              </View>
            </View>
          </View>

          {/* Planned vs completed over time */}
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Planned vs completed</Text>
            <View style={styles.chartRow}>
              {chartBuckets.map((bucket, i) => {
                const plannedHeight = Math.max(2, (bucket.plannedMinutes / maxBucket) * 104);
                const doneHeight = Math.max(0, (bucket.completedMinutes / maxBucket) * 104);
                return (
                  <View key={i} style={styles.chartCol}>
                    <View style={[styles.barStack, { height: plannedHeight }]}>
                      <View style={[styles.barPlanned, {
                        height: plannedHeight, backgroundColor: theme.colors.primary + '33',
                      }]} />
                      {doneHeight > 0 && (
                        <View style={[styles.barDone, { height: doneHeight, backgroundColor: theme.colors.primary }]} />
                      )}
                    </View>
                    <Text style={styles.chartLabel}>{bucket.label}</Text>
                  </View>
                );
              })}
            </View>
            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: theme.colors.primary + '33' }]} />
                <Text style={styles.legendText}>Planned</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: theme.colors.primary }]} />
                <Text style={styles.legendText}>Completed</Text>
              </View>
            </View>
          </View>

          {/* Where the time goes */}
          {analytics.byKind.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.sectionLabel}>Where your time goes</Text>
              {analytics.byKind.map(k => (
                <View key={k.kind} style={styles.kindRow}>
                  <View style={styles.kindHead}>
                    <Ionicons name={BLOCK_KIND_ICONS[k.kind]} size={15} color={theme.colors.primary} />
                    <Text style={styles.kindName}>{k.kind}</Text>
                    <Text style={styles.kindMeta}>{formatDuration(k.minutes)} · {k.pct}%</Text>
                  </View>
                  <View style={styles.kindTrack}>
                    <View style={[styles.kindFill, {
                      width: `${Math.max(2, k.pct)}%`, backgroundColor: theme.colors.primary,
                    }]} />
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Hour heat map */}
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Busiest hours</Text>
            <View style={styles.heatRow}>
              {analytics.byHour.map(h => {
                const intensity = h.minutes / maxHeat;
                return (
                  <View
                    key={h.hour}
                    style={[styles.heatCell, {
                      backgroundColor: intensity === 0
                        ? theme.colors.inputBg
                        : theme.colors.primary + Math.round(38 + intensity * 217).toString(16).padStart(2, '0'),
                    }]}
                  />
                );
              })}
            </View>
            <View style={styles.heatLabels}>
              {[0, 6, 12, 18, 23].map(h => (
                <Text key={h} style={styles.heatLabel}>{hourLabel(h)}</Text>
              ))}
            </View>
          </View>

          {/* Insights */}
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>What this suggests</Text>

            {analytics.peakHour != null && (
              <View style={styles.insight}>
                <View style={[styles.insightIcon, { backgroundColor: theme.colors.warning + '20' }]}>
                  <Ionicons name="sunny-outline" size={17} color={theme.colors.warning} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.insightTitle}>You finish most work around {hourLabel(analytics.peakHour)}</Text>
                  <Text style={styles.insightBody}>
                    Put your hardest block here instead of leaving it to chance.
                  </Text>
                </View>
              </View>
            )}

            {analytics.bestWeekday != null && (
              <View style={styles.insight}>
                <View style={[styles.insightIcon, { backgroundColor: theme.colors.success + '20' }]}>
                  <Ionicons name="calendar-outline" size={17} color={theme.colors.success} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.insightTitle}>{WEEKDAY_NAMES[analytics.bestWeekday]} is your strongest day</Text>
                  <Text style={styles.insightBody}>
                    Highest completion rate of anything you planned.
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.insight}>
              <View style={[styles.insightIcon, {
                backgroundColor: (analytics.adherencePct >= 70 ? theme.colors.success : theme.colors.error) + '20',
              }]}>
                <Ionicons
                  name={analytics.adherencePct >= 70 ? 'trending-up-outline' : 'alert-circle-outline'}
                  size={17}
                  color={analytics.adherencePct >= 70 ? theme.colors.success : theme.colors.error}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.insightTitle}>
                  {analytics.adherencePct >= 70
                    ? 'Your plans are realistic'
                    : 'You may be over-planning'}
                </Text>
                <Text style={styles.insightBody}>
                  {analytics.adherencePct >= 70
                    ? `You complete ${analytics.adherencePct}% of the time you block. Keep the same shape.`
                    : `Only ${analytics.adherencePct}% of blocked time gets completed. Try blocking less and leaving more buffer.`}
                </Text>
              </View>
            </View>

            {analytics.planningRatePct < 50 && (
              <View style={styles.insight}>
                <View style={[styles.insightIcon, { backgroundColor: theme.colors.primary + '20' }]}>
                  <Ionicons name="repeat-outline" size={17} color={theme.colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.insightTitle}>Planning is still inconsistent</Text>
                  <Text style={styles.insightBody}>
                    You planned {analytics.daysPlanned} of the last {analytics.daysInRange} days.
                    A two-minute morning plan is the highest-leverage habit here.
                  </Text>
                </View>
              </View>
            )}
          </View>
        </ScrollView>
      )}

      <PremiumGateSheet visible={gateOpen} feature="planner_analytics" onClose={() => setGateOpen(false)} />
    </View>
  );
}
