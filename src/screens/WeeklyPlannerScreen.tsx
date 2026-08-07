/**
 * WeeklyPlannerScreen (premium) — the seven-day overview.
 *
 * Two views:
 *   • Columns — a compact grid of all seven days, tap a day to open it
 *   • List — day-by-day cards with focus, blocks and goals
 *
 * Everything is read-only here except the completion toggles and the export;
 * editing a block means jumping into that day, which keeps one editing model.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { PremiumGateSheet } from '../components/PremiumGateSheet';
import { usePlanner } from '../context/PlannerContext';
import { useTheme } from '../context/ThemeContext';
import { exportWeekPlan } from '../services/plannerExportService';
import {
  addDaysToKey, formatDuration, formatMinutes, fromDateKey, todayKey, weekStartKey,
} from '../services/plannerService';
import { usePremium } from '../services/premiumService';
import type { PlannerBlock, PlannerDay } from '../types/planner';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DAY_LETTERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type ViewMode = 'columns' | 'list';

export function WeeklyPlannerScreen() {
  const navigation = useNavigation<any>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { hasPremium, loading: premiumLoading } = usePremium();
  const { loadWeek, setSelectedDate, selectedDate } = usePlanner();

  const [anchor, setAnchor] = useState(() => weekStartKey(selectedDate, 0));
  const [keys, setKeys] = useState<string[]>([]);
  const [days, setDays] = useState<PlannerDay[]>([]);
  const [blocks, setBlocks] = useState<PlannerBlock[]>([]);
  const [mode, setMode] = useState<ViewMode>('columns');
  const [loading, setLoading] = useState(true);
  const [gateOpen, setGateOpen] = useState(false);

  // Bounce free users straight to the paywall rather than showing empty chrome.
  useEffect(() => {
    if (!premiumLoading && !hasPremium) setGateOpen(true);
  }, [hasPremium, premiumLoading]);

  const load = useCallback(async (anchorKey: string) => {
    setLoading(true);
    const result = await loadWeek(anchorKey);
    setKeys(result.keys);
    setDays(result.days);
    setBlocks(result.blocks);
    setLoading(false);
  }, [loadWeek]);

  useEffect(() => { load(anchor); }, [anchor, load]);

  const blocksByDate = useMemo(() => {
    const map: Record<string, PlannerBlock[]> = {};
    for (const key of keys) map[key] = [];
    for (const block of blocks) {
      if (!map[block.date]) map[block.date] = [];
      map[block.date].push(block);
    }
    Object.values(map).forEach(list => list.sort((a, b) => a.startMinutes - b.startMinutes));
    return map;
  }, [blocks, keys]);

  const dayByKey = useMemo(() => new Map(days.map(d => [d.date, d])), [days]);

  const weekTotals = useMemo(() => {
    const plannedMinutes = blocks.reduce((s, b) => s + b.durationMinutes, 0);
    const completedMinutes = blocks.filter(b => b.completed).reduce((s, b) => s + b.durationMinutes, 0);
    const goalsTotal = days.reduce((s, d) => s + d.dailyGoals.length, 0);
    const goalsDone = days.reduce((s, d) => s + d.dailyGoals.filter(g => g.completed).length, 0);
    const daysPlanned = keys.filter(k =>
      (blocksByDate[k]?.length ?? 0) > 0 || !!dayByKey.get(k)?.focus.trim()
    ).length;
    return {
      plannedMinutes,
      completedMinutes,
      goalsTotal,
      goalsDone,
      daysPlanned,
      blocksTotal: blocks.length,
      blocksDone: blocks.filter(b => b.completed).length,
      adherencePct: plannedMinutes === 0 ? 0 : Math.round((completedMinutes / plannedMinutes) * 100),
    };
  }, [blocks, blocksByDate, dayByKey, days, keys]);

  const openDay = useCallback((key: string) => {
    setSelectedDate(key);
    navigation.goBack();
  }, [navigation, setSelectedDate]);

  const doExport = useCallback(async () => {
    if (keys.length === 0) return;
    await exportWeekPlan({
      startKey: keys[0],
      endKey: keys[keys.length - 1],
      days,
      blocksByDate,
      dateKeys: keys,
    });
  }, [blocksByDate, days, keys]);

  const weekLabel = useMemo(() => {
    if (keys.length === 0) return '';
    const start = fromDateKey(keys[0]);
    const end = fromDateKey(keys[keys.length - 1]);
    const sameMonth = start.getMonth() === end.getMonth();
    const startStr = start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const endStr = end.toLocaleDateString(undefined, sameMonth ? { day: 'numeric' } : { month: 'short', day: 'numeric' });
    return `${startStr} – ${endStr}`;
  }, [keys]);

  const isCurrentWeek = keys.includes(todayKey());
  const colWidth = (SCREEN_WIDTH - 24) / 7 - 4;

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
    weekNav: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginTop: theme.spacing.md },
    navBtn: {
      width: 32, height: 32, borderRadius: 16,
      backgroundColor: theme.colors.inputBg, alignItems: 'center', justifyContent: 'center',
    },
    weekLabel: { flex: 1, textAlign: 'center', ...theme.typography.body, fontWeight: '800', color: theme.colors.text },
    thisWeek: {
      paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
      backgroundColor: theme.colors.primaryLight,
    },
    thisWeekText: { fontSize: 10.5, fontWeight: '800', color: theme.colors.primary },

    modeRow: { flexDirection: 'row', gap: 6, marginTop: theme.spacing.md, backgroundColor: theme.colors.inputBg, borderRadius: 10, padding: 3 },
    modeBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
    modeText: { ...theme.typography.caption, fontWeight: '700', color: theme.colors.textMuted },

    scroll: { flex: 1 },
    content: { padding: theme.spacing.lg, paddingBottom: 60, gap: theme.spacing.lg },

    statsRow: { flexDirection: 'row', gap: theme.spacing.sm },
    stat: {
      flex: 1, backgroundColor: theme.colors.cardBg, borderRadius: theme.borderRadius.lg,
      paddingVertical: theme.spacing.md, alignItems: 'center', gap: 2, ...theme.shadows.subtle,
    },
    statNum: { fontSize: 17, fontWeight: '800', color: theme.colors.text },
    statLabel: { fontSize: 9.5, color: theme.colors.textMuted, fontWeight: '700', textTransform: 'uppercase' },

    // Columns view
    columnsRow: { flexDirection: 'row', gap: 4 },
    column: {
      width: colWidth,
      backgroundColor: theme.colors.cardBg,
      borderRadius: theme.borderRadius.md,
      padding: 5, gap: 4, minHeight: 190,
      borderWidth: 1.5, borderColor: 'transparent',
    },
    columnToday: { borderColor: theme.colors.primary },
    colHead: { alignItems: 'center', paddingVertical: 3, gap: 1 },
    colDay: { fontSize: 9.5, fontWeight: '800', color: theme.colors.textMuted },
    colDate: { fontSize: 13, fontWeight: '800', color: theme.colors.text },
    colFocus: { fontSize: 8, color: theme.colors.primary, fontWeight: '700', textAlign: 'center' },
    miniBlock: { borderRadius: 4, paddingHorizontal: 4, paddingVertical: 3, borderLeftWidth: 2.5 },
    miniTime: { fontSize: 7.5, color: theme.colors.textMuted, fontWeight: '600' },
    miniTitle: { fontSize: 8.5, fontWeight: '700', color: theme.colors.text },
    colEmpty: { fontSize: 8.5, color: theme.colors.textDisabled, textAlign: 'center', paddingTop: 12 },
    colMore: { fontSize: 8, color: theme.colors.textMuted, textAlign: 'center', fontWeight: '700' },

    // List view
    dayCard: {
      backgroundColor: theme.colors.cardBg, borderRadius: theme.borderRadius.xl,
      padding: theme.spacing.lg, ...theme.shadows.card, gap: theme.spacing.sm,
      borderLeftWidth: 4, borderLeftColor: 'transparent',
    },
    dayCardToday: { borderLeftColor: theme.colors.primary },
    dayHead: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
    dayName: { ...theme.typography.body, fontWeight: '800', color: theme.colors.text, flex: 1 },
    dayMeta: { ...theme.typography.caption, fontSize: 11.5, color: theme.colors.textMuted, fontWeight: '600' },
    focusPill: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: theme.colors.primaryLight,
      borderRadius: theme.borderRadius.md, paddingHorizontal: 11, paddingVertical: 8,
    },
    focusText: { ...theme.typography.caption, color: theme.colors.primary, fontWeight: '700', flex: 1 },
    blockRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, paddingVertical: 6 },
    blockDot: { width: 8, height: 8, borderRadius: 3 },
    blockTime: { ...theme.typography.caption, fontSize: 11, color: theme.colors.textMuted, width: 68, fontWeight: '600' },
    blockTitle: { ...theme.typography.bodySmall, color: theme.colors.text, flex: 1, fontWeight: '500' },
    blockTitleDone: { color: theme.colors.textMuted, textDecorationLine: 'line-through' },
    goalRow: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 4 },
    goalText: { ...theme.typography.caption, color: theme.colors.textSecondary, flex: 1 },
    emptyDay: { ...theme.typography.caption, color: theme.colors.textDisabled, fontStyle: 'italic' },
    planBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      paddingVertical: 10, borderRadius: theme.borderRadius.md,
      backgroundColor: theme.colors.inputBg, marginTop: 4,
    },
    planBtnText: { ...theme.typography.caption, fontWeight: '800', color: theme.colors.primary },
    loading: { paddingTop: 80, alignItems: 'center' },
  }), [colWidth, insets, theme]);

  if (!premiumLoading && !hasPremium) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.iconBtn}>
              <Ionicons name="arrow-back" size={19} color={theme.colors.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Weekly Planner</Text>
          </View>
        </View>
        <View style={styles.loading}>
          <Ionicons name="diamond-outline" size={44} color={theme.colors.accent} />
          <Text style={[styles.dayMeta, { marginTop: 12, textAlign: 'center', paddingHorizontal: 40 }]}>
            The weekly planner is part of Planner Premium.
          </Text>
          <TouchableOpacity
            style={[styles.planBtn, { paddingHorizontal: 24, marginTop: 16 }]}
            onPress={() => setGateOpen(true)}
          >
            <Text style={styles.planBtnText}>See what's included</Text>
          </TouchableOpacity>
        </View>
        <PremiumGateSheet
          visible={gateOpen}
          feature="planner_weekly"
          onClose={() => { setGateOpen(false); if (!hasPremium) navigation.goBack(); }}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.iconBtn}>
            <Ionicons name="arrow-back" size={19} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Weekly Planner</Text>
          <TouchableOpacity onPress={doExport} hitSlop={8} style={styles.iconBtn}>
            <Ionicons name="print-outline" size={18} color={theme.colors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.weekNav}>
          <TouchableOpacity style={styles.navBtn} onPress={() => setAnchor(a => addDaysToKey(a, -7))}>
            <Ionicons name="chevron-back" size={17} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.weekLabel}>{weekLabel}</Text>
          {!isCurrentWeek && (
            <TouchableOpacity
              style={styles.thisWeek}
              onPress={() => setAnchor(weekStartKey(todayKey(), 0))}
            >
              <Text style={styles.thisWeekText}>THIS WEEK</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.navBtn} onPress={() => setAnchor(a => addDaysToKey(a, 7))}>
            <Ionicons name="chevron-forward" size={17} color={theme.colors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.modeRow}>
          {(['columns', 'list'] as ViewMode[]).map(m => (
            <TouchableOpacity
              key={m}
              style={[styles.modeBtn, mode === m && { backgroundColor: theme.colors.surface, ...theme.shadows.subtle }]}
              onPress={() => setMode(m)}
            >
              <Text style={[styles.modeText, mode === m && { color: theme.colors.primary }]}>
                {m === 'columns' ? 'Week grid' : 'Day by day'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {loading ? (
        <View style={styles.loading}><ActivityIndicator color={theme.colors.primary} /></View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Week totals */}
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statNum}>{weekTotals.daysPlanned}/7</Text>
              <Text style={styles.statLabel}>Planned</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statNum}>{weekTotals.blocksDone}/{weekTotals.blocksTotal}</Text>
              <Text style={styles.statLabel}>Blocks</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statNum}>{formatDuration(weekTotals.plannedMinutes)}</Text>
              <Text style={styles.statLabel}>Scheduled</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statNum}>{weekTotals.adherencePct}%</Text>
              <Text style={styles.statLabel}>Adherence</Text>
            </View>
          </View>

          {mode === 'columns' ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.columnsRow}>
                {keys.map(key => {
                  const dayBlocks = blocksByDate[key] ?? [];
                  const dayPlan = dayByKey.get(key);
                  const isTodayCol = key === todayKey();
                  const date = fromDateKey(key);
                  return (
                    <TouchableOpacity
                      key={key}
                      style={[styles.column, isTodayCol && styles.columnToday]}
                      onPress={() => openDay(key)}
                      activeOpacity={0.75}
                    >
                      <View style={styles.colHead}>
                        <Text style={[styles.colDay, isTodayCol && { color: theme.colors.primary }]}>
                          {DAY_LETTERS[date.getDay()].toUpperCase()}
                        </Text>
                        <Text style={[styles.colDate, isTodayCol && { color: theme.colors.primary }]}>
                          {date.getDate()}
                        </Text>
                      </View>
                      {dayPlan?.focus.trim() ? (
                        <Text style={styles.colFocus} numberOfLines={2}>★ {dayPlan.focus}</Text>
                      ) : null}
                      {dayBlocks.length === 0 ? (
                        <Text style={styles.colEmpty}>—</Text>
                      ) : (
                        <>
                          {dayBlocks.slice(0, 5).map(b => (
                            <View
                              key={b.id}
                              style={[styles.miniBlock, {
                                backgroundColor: b.color + '1F',
                                borderLeftColor: b.color,
                                opacity: b.completed ? 0.55 : 1,
                              }]}
                            >
                              <Text style={styles.miniTime}>{formatMinutes(b.startMinutes)}</Text>
                              <Text style={styles.miniTitle} numberOfLines={2}>{b.title}</Text>
                            </View>
                          ))}
                          {dayBlocks.length > 5 && (
                            <Text style={styles.colMore}>+{dayBlocks.length - 5}</Text>
                          )}
                        </>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          ) : (
            keys.map(key => {
              const dayBlocks = blocksByDate[key] ?? [];
              const dayPlan = dayByKey.get(key);
              const isTodayCard = key === todayKey();
              const date = fromDateKey(key);
              const planned = dayBlocks.reduce((s, b) => s + b.durationMinutes, 0);
              const isEmpty = dayBlocks.length === 0 &&
                !dayPlan?.focus.trim() &&
                (dayPlan?.dailyGoals.length ?? 0) === 0;

              return (
                <View key={key} style={[styles.dayCard, isTodayCard && styles.dayCardToday]}>
                  <View style={styles.dayHead}>
                    <Text style={styles.dayName}>
                      {DAY_LETTERS[date.getDay()]} {date.getDate()}
                      {isTodayCard ? '  · Today' : ''}
                    </Text>
                    {dayBlocks.length > 0 && (
                      <Text style={styles.dayMeta}>
                        {dayBlocks.length} block{dayBlocks.length === 1 ? '' : 's'} · {formatDuration(planned)}
                      </Text>
                    )}
                  </View>

                  {dayPlan?.focus.trim() ? (
                    <View style={styles.focusPill}>
                      <Ionicons name="compass-outline" size={13} color={theme.colors.primary} />
                      <Text style={styles.focusText} numberOfLines={2}>{dayPlan.focus}</Text>
                    </View>
                  ) : null}

                  {dayPlan?.topPriorities.map((p, i) => (
                    <View key={p.id} style={styles.goalRow}>
                      <Ionicons
                        name={p.completed ? 'checkmark-circle' : 'ellipse-outline'}
                        size={14}
                        color={p.completed ? theme.colors.success : theme.colors.accent}
                      />
                      <Text style={[styles.goalText, p.completed && styles.blockTitleDone]} numberOfLines={1}>
                        {i + 1}. {p.title}
                      </Text>
                    </View>
                  ))}

                  {dayBlocks.slice(0, 8).map(b => (
                    <View key={b.id} style={styles.blockRow}>
                      <View style={[styles.blockDot, { backgroundColor: b.color }]} />
                      <Text style={styles.blockTime}>{formatMinutes(b.startMinutes)}</Text>
                      <Text style={[styles.blockTitle, b.completed && styles.blockTitleDone]} numberOfLines={1}>
                        {b.title}
                      </Text>
                      {b.completed && <Ionicons name="checkmark" size={14} color={theme.colors.success} />}
                    </View>
                  ))}
                  {dayBlocks.length > 8 && (
                    <Text style={styles.dayMeta}>+{dayBlocks.length - 8} more blocks</Text>
                  )}

                  {(dayPlan?.dailyGoals.length ?? 0) > 0 && dayPlan!.dailyGoals.map(g => (
                    <View key={g.id} style={styles.goalRow}>
                      <Ionicons
                        name={g.completed ? 'checkmark-circle' : 'ellipse-outline'}
                        size={14}
                        color={g.completed ? theme.colors.success : theme.colors.textMuted}
                      />
                      <Text style={[styles.goalText, g.completed && styles.blockTitleDone]} numberOfLines={1}>
                        {g.title}
                      </Text>
                    </View>
                  ))}

                  {isEmpty && <Text style={styles.emptyDay}>Nothing planned yet.</Text>}

                  <TouchableOpacity style={styles.planBtn} onPress={() => openDay(key)} activeOpacity={0.75}>
                    <Ionicons name="create-outline" size={14} color={theme.colors.primary} />
                    <Text style={styles.planBtnText}>{isEmpty ? 'Plan this day' : 'Open day'}</Text>
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      <PremiumGateSheet visible={gateOpen} feature="planner_weekly" onClose={() => setGateOpen(false)} />
    </View>
  );
}
