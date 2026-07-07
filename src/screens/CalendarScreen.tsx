import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView,
  Modal, ActivityIndicator, TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Icon } from '../components/Icons';
import { CalendarGrid } from '../components/CalendarGrid';
import { TaskCard } from '../components/TaskCard';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import type { RootStackParamList } from '../navigation/types';
import type { Task } from '../types';
import {
  getHolidaysForRange,
  countryName,
  SUPPORTED_COUNTRIES,
  type Holiday,
} from '../services/holidayService';
import { syncHolidayNotifications } from '../services/holidayNotificationService';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type ViewMode = 'month' | 'week' | 'agenda';

const HOLIDAY_COLOR = '#EF4444';

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function startOfWeek(d: Date, firstDay = 0): Date {
  const day = d.getDay();
  const diff = (day - firstDay + 7) % 7;
  const result = new Date(d);
  result.setDate(d.getDate() - diff);
  result.setHours(0, 0, 0, 0);
  return result;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function shortDateLabel(d: Date): string {
  const now = new Date();
  if (isSameDay(d, now)) return 'Today';
  if (isSameDay(d, addDays(now, 1))) return 'Tomorrow';
  if (isSameDay(d, addDays(now, -1))) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export function CalendarScreen() {
  const navigation = useNavigation<Nav>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { tasks, tasksForDate, toggleTaskComplete, getTaskCategory, settings, updateSettings } = useApp();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');

  const firstDay = settings.firstDayOfWeek ?? 0;
  const country = settings.holidayCountry || 'PK';

  // ── Holidays ────────────────────────────────────────────────────────────
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [holidaysLoading, setHolidaysLoading] = useState(false);
  const [holidaysError, setHolidaysError] = useState<string | null>(null);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    setHolidaysLoading(true);
    setHolidaysError(null);
    const thisYear = new Date().getFullYear();
    getHolidaysForRange(country, thisYear, thisYear + 1)
      .then((list) => {
        if (cancelled) return;
        setHolidays(list);
      })
      .catch((err) => {
        if (cancelled) return;
        setHolidaysError(err?.message ?? 'Could not load holidays');
        setHolidays([]);
      })
      .finally(() => {
        if (cancelled) return;
        setHolidaysLoading(false);
      });
    return () => { cancelled = true; };
  }, [country]);

  // Re-sync notifications whenever the holiday list or toggle changes.
  useEffect(() => {
    syncHolidayNotifications(holidays, !!settings.holidayNotificationsEnabled).catch(() => {});
  }, [holidays, settings.holidayNotificationsEnabled]);

  const holidaysByDate = useMemo(() => {
    const m = new Map<string, Holiday[]>();
    for (const h of holidays) {
      const list = m.get(h.date) ?? [];
      list.push(h);
      m.set(h.date, list);
    }
    return m;
  }, [holidays]);

  // ── Calendar dots: tasks + a single holiday marker ──────────────────────
  const calendarDots = useMemo(() => {
    const map = new Map<string, string[]>();
    tasks.forEach((t) => {
      if (!t.dueDate) return;
      const d = new Date(t.dueDate);
      const key = dateKey(d);
      const cat = t.categoryId ? getTaskCategory(t.categoryId) : undefined;
      const color = cat?.color ?? theme.colors.primary;
      const existing = map.get(key) ?? [];
      existing.push(color);
      map.set(key, existing);
    });
    // Prepend a holiday dot so it shows first in the row.
    holidaysByDate.forEach((_list, key) => {
      const existing = map.get(key) ?? [];
      map.set(key, [HOLIDAY_COLOR, ...existing]);
    });
    return map;
  }, [tasks, getTaskCategory, theme.colors.primary, holidaysByDate]);

  const selectedTasks = useMemo(
    () => tasksForDate(selectedDate.getTime()),
    [tasksForDate, selectedDate]
  );

  const selectedHolidays = useMemo(
    () => holidaysByDate.get(dateKey(selectedDate)) ?? [],
    [holidaysByDate, selectedDate]
  );

  const weekDays = useMemo(() => {
    const start = startOfWeek(selectedDate, firstDay);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [selectedDate, firstDay]);

  // ── Agenda: combine tasks + holidays for next ~60 days ──────────────────
  type AgendaItem = { date: Date; tasks: Task[]; holidays: Holiday[] };
  const agendaItems = useMemo<AgendaItem[]>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const items: AgendaItem[] = [];
    for (let i = -7; i <= 60; i++) {
      const d = addDays(today, i);
      const dayTasks = tasksForDate(d.getTime());
      const dayHolidays = holidaysByDate.get(dateKey(d)) ?? [];
      if (dayTasks.length > 0 || dayHolidays.length > 0) {
        items.push({ date: d, tasks: dayTasks, holidays: dayHolidays });
      }
    }
    return items;
  }, [tasksForDate, holidaysByDate]);

  // ── Upcoming holidays (next 6) for a dedicated month-view section ───────
  const upcomingHolidays = useMemo(() => {
    const now = Date.now();
    return holidays
      .filter((h) => {
        const [y, m, d] = h.date.split('-').map((s) => parseInt(s, 10));
        return new Date(y, m - 1, d).getTime() >= now - 24 * 60 * 60 * 1000;
      })
      .slice(0, 6);
  }, [holidays]);

  const prevWeek = useCallback(() => setSelectedDate((d) => addDays(d, -7)), []);
  const nextWeek = useCallback(() => setSelectedDate((d) => addDays(d, 7)), []);

  const renderTaskItem = useCallback(({ item }: { item: Task }) => {
    const cat = item.categoryId ? getTaskCategory(item.categoryId) : undefined;
    return (
      <TaskCard
        task={item}
        category={cat}
        onToggle={() => toggleTaskComplete(item.id)}
        onPress={() => navigation.navigate('TaskEditor', { taskId: item.id })}
      />
    );
  }, [getTaskCategory, toggleTaskComplete, navigation]);

  const filteredCountries = useMemo(() => {
    const q = countrySearch.trim().toLowerCase();
    if (!q) return SUPPORTED_COUNTRIES;
    return SUPPORTED_COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q),
    );
  }, [countrySearch]);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },

    header: {
      paddingHorizontal: theme.spacing.lg,
      paddingTop: insets.top + theme.spacing.md,
      paddingBottom: theme.spacing.sm,
      backgroundColor: theme.colors.surface,
    },
    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    title: { ...theme.typography.title, color: theme.colors.text, fontSize: 26, fontWeight: '700' },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },

    countryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: 6,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.inputBg,
    },
    countryBtnText: { ...theme.typography.caption, color: theme.colors.text, fontWeight: '700' },

    todayPill: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: 6,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.primaryLight,
    },
    todayPillText: { ...theme.typography.caption, color: theme.colors.primary, fontWeight: '700' },

    notifToggle: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.inputBg,
    },

    tabRow: {
      flexDirection: 'row',
      gap: theme.spacing.xs,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.sm,
      backgroundColor: theme.colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    tab: {
      flex: 1,
      paddingVertical: 7,
      borderRadius: theme.borderRadius.lg,
      alignItems: 'center',
      backgroundColor: theme.colors.inputBg,
    },
    tabActive: { backgroundColor: theme.colors.primary },
    tabText: { ...theme.typography.caption, color: theme.colors.textSecondary, fontWeight: '600' },
    tabTextActive: { color: '#FFF' },

    calendarWrap: { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md },
    dayHeader: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md,
    },
    dayLabel: { ...theme.typography.titleSmall, color: theme.colors.text, fontWeight: '700' },
    taskCount: { ...theme.typography.caption, color: theme.colors.textMuted },
    list: { paddingHorizontal: theme.spacing.lg, paddingBottom: 100 },
    emptyDay: { alignItems: 'center', paddingTop: theme.spacing.xl, gap: theme.spacing.sm },
    emptyText: { ...theme.typography.bodySmall, color: theme.colors.textMuted },

    holidayBanner: {
      marginHorizontal: theme.spacing.lg,
      marginBottom: theme.spacing.sm,
      padding: theme.spacing.md,
      backgroundColor: HOLIDAY_COLOR + '15',
      borderRadius: theme.borderRadius.lg,
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    holidayBannerText: { flex: 1, ...theme.typography.bodySmall, color: theme.colors.text, fontWeight: '600' },
    holidaySectionTitle: {
      ...theme.typography.overline,
      color: theme.colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginHorizontal: theme.spacing.lg,
      marginTop: theme.spacing.md,
      marginBottom: theme.spacing.sm,
    },
    holidayRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.lg,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    holidayDot: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: HOLIDAY_COLOR + '22',
      alignItems: 'center', justifyContent: 'center',
    },
    holidayName: { ...theme.typography.body, color: theme.colors.text, fontWeight: '600' },
    holidaySub: { ...theme.typography.caption, color: theme.colors.textMuted },

    weekNav: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.sm,
      backgroundColor: theme.colors.surface,
    },
    weekNavLabel: { ...theme.typography.body, color: theme.colors.text, fontWeight: '600' },
    weekDaysRow: {
      flexDirection: 'row',
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.sm,
      backgroundColor: theme.colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
      gap: 4,
    },
    weekDayCell: {
      flex: 1, alignItems: 'center', gap: 4,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.borderRadius.lg,
    },
    weekDayCellSelected: { backgroundColor: theme.colors.primaryLight },
    weekDayName: { ...theme.typography.overline, color: theme.colors.textMuted },
    weekDayNum: { ...theme.typography.body, color: theme.colors.text, fontWeight: '600' },
    weekDayNumSelected: { color: theme.colors.primary, fontWeight: '800' },
    weekDayNumToday: {
      backgroundColor: theme.colors.primary,
      color: '#FFF',
      width: 28, height: 28, borderRadius: 14,
      textAlign: 'center', lineHeight: 28,
      fontWeight: '700',
      overflow: 'hidden',
    },
    weekDotRow: { flexDirection: 'row', gap: 2, justifyContent: 'center' },
    weekDot: { width: 4, height: 4, borderRadius: 2 },
    weekContent: { flex: 1, paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md },

    agendaContainer: { flex: 1, paddingBottom: 100 },
    agendaDateGroup: { marginBottom: theme.spacing.lg, paddingHorizontal: theme.spacing.lg },
    agendaDateHeader: {
      flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm,
      marginBottom: theme.spacing.sm,
    },
    agendaDateDot: { width: 10, height: 10, borderRadius: 5 },
    agendaDateLabel: { ...theme.typography.label, color: theme.colors.text, fontWeight: '700' },
    agendaDateSub: { ...theme.typography.caption, color: theme.colors.textMuted },
    agendaHolidayChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: HOLIDAY_COLOR + '18',
      borderRadius: theme.borderRadius.lg,
      paddingHorizontal: 10,
      paddingVertical: 6,
      marginLeft: 18,
      marginBottom: 6,
      alignSelf: 'flex-start',
    },
    agendaHolidayText: { ...theme.typography.bodySmall, color: theme.colors.text, fontWeight: '600' },
    agendaEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: theme.spacing.md },
    agendaEmptyText: { ...theme.typography.body, color: theme.colors.textMuted },
    agendaEmptyHint: { ...theme.typography.caption, color: theme.colors.textDisabled },

    fab: {
      position: 'absolute',
      bottom: insets.bottom + theme.spacing.xl,
      right: theme.spacing.lg,
      width: 56, height: 56, borderRadius: 28,
      backgroundColor: theme.colors.primary,
      alignItems: 'center', justifyContent: 'center',
      ...theme.shadows.fab,
    },

    // Country picker modal
    modalRoot: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
    modalSheet: {
      flex: 1,
      marginTop: insets.top + 60,
      backgroundColor: theme.colors.background,
      borderTopLeftRadius: theme.borderRadius.xl,
      borderTopRightRadius: theme.borderRadius.xl,
      overflow: 'hidden',
    },
    modalHeader: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      padding: theme.spacing.lg,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border,
    },
    modalTitle: { ...theme.typography.titleSmall, color: theme.colors.text, fontWeight: '700' },
    searchInput: {
      backgroundColor: theme.colors.inputBg,
      borderRadius: theme.borderRadius.lg,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: 10,
      margin: theme.spacing.lg,
      color: theme.colors.text,
    },
    countryRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border,
    },
    countryLabel: { ...theme.typography.body, color: theme.colors.text, flex: 1 },
    countryCode: { ...theme.typography.caption, color: theme.colors.textMuted, marginRight: theme.spacing.sm },
  }), [theme, insets]);

  const isToday = isSameDay(selectedDate, new Date());

  const weekLabel = useMemo(() => {
    const start = weekDays[0];
    const end = weekDays[6];
    if (start.getMonth() === end.getMonth()) {
      return start.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    }
    return `${start.toLocaleDateString(undefined, { month: 'short' })} – ${end.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}`;
  }, [weekDays]);

  const renderHolidayHeader = () => (
    <>
      {selectedHolidays.length > 0 && (
        <View style={styles.holidayBanner}>
          <Ionicons name="sparkles" size={18} color={HOLIDAY_COLOR} />
          <Text style={styles.holidayBannerText}>
            {selectedHolidays.map((h) => h.localName || h.name).join(' • ')}
          </Text>
        </View>
      )}
      {holidaysError && (
        <View style={[styles.holidayBanner, { backgroundColor: theme.colors.warning + '15' }]}>
          <Ionicons name="cloud-offline-outline" size={18} color={theme.colors.warning} />
          <Text style={styles.holidayBannerText}>Couldn't load holidays. Tap retry.</Text>
          <TouchableOpacity onPress={() => updateSettings({ holidayCountry: country })}>
            <Text style={[styles.todayPillText, { color: theme.colors.warning }]}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}
    </>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Calendar</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.notifToggle}
              onPress={() => updateSettings({
                holidayNotificationsEnabled: !settings.holidayNotificationsEnabled,
              })}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name={settings.holidayNotificationsEnabled ? 'notifications' : 'notifications-off-outline'}
                size={18}
                color={settings.holidayNotificationsEnabled ? theme.colors.primary : theme.colors.textMuted}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.countryBtn}
              onPress={() => setShowCountryPicker(true)}
            >
              <Ionicons name="flag-outline" size={14} color={theme.colors.text} />
              <Text style={styles.countryBtnText}>{country}</Text>
            </TouchableOpacity>
            {!isToday && (
              <TouchableOpacity
                onPress={() => setSelectedDate(new Date())}
                style={styles.todayPill}
              >
                <Text style={styles.todayPillText}>Today</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      <View style={styles.tabRow}>
        {(['month', 'week', 'agenda'] as ViewMode[]).map((mode) => (
          <TouchableOpacity
            key={mode}
            style={[styles.tab, viewMode === mode && styles.tabActive]}
            onPress={() => setViewMode(mode)}
          >
            <Text style={[styles.tabText, viewMode === mode && styles.tabTextActive]}>
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {viewMode === 'month' && (
        <FlatList
          ListHeaderComponent={
            <>
              <View style={styles.calendarWrap}>
                <CalendarGrid
                  selectedDate={selectedDate}
                  onSelectDate={setSelectedDate}
                  onMonthChange={setSelectedDate}
                  taskDots={calendarDots}
                  firstDayOfWeek={firstDay}
                />
              </View>
              {renderHolidayHeader()}
              <View style={styles.dayHeader}>
                <Text style={styles.dayLabel}>{shortDateLabel(selectedDate)}</Text>
                <Text style={styles.taskCount}>
                  {selectedTasks.length} task{selectedTasks.length !== 1 ? 's' : ''}
                </Text>
              </View>
              {upcomingHolidays.length > 0 && (
                <>
                  <Text style={styles.holidaySectionTitle}>
                    Upcoming Holidays · {countryName(country)}
                  </Text>
                  {upcomingHolidays.map((h) => {
                    const [y, m, d] = h.date.split('-').map((s) => parseInt(s, 10));
                    const date = new Date(y, m - 1, d);
                    return (
                      <TouchableOpacity
                        key={`${h.date}-${h.name}`}
                        style={styles.holidayRow}
                        onPress={() => setSelectedDate(date)}
                      >
                        <View style={styles.holidayDot}>
                          <Ionicons name="sparkles" size={18} color={HOLIDAY_COLOR} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.holidayName}>{h.localName || h.name}</Text>
                          <Text style={styles.holidaySub}>
                            {date.toLocaleDateString(undefined, {
                              weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
                            })}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={theme.colors.textDisabled} />
                      </TouchableOpacity>
                    );
                  })}
                </>
              )}
              {holidaysLoading && upcomingHolidays.length === 0 && (
                <View style={{ paddingVertical: theme.spacing.lg, alignItems: 'center' }}>
                  <ActivityIndicator color={theme.colors.primary} />
                </View>
              )}
            </>
          }
          data={selectedTasks}
          renderItem={renderTaskItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            selectedHolidays.length === 0 ? (
              <View style={styles.emptyDay}>
                <Icon name="calendar" size={40} color={theme.colors.textDisabled} />
                <Text style={styles.emptyText}>No tasks for this day</Text>
              </View>
            ) : null
          }
        />
      )}

      {viewMode === 'week' && (
        <>
          <View style={styles.weekNav}>
            <TouchableOpacity onPress={prevWeek} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="chevron-back" size={22} color={theme.colors.text} />
            </TouchableOpacity>
            <Text style={styles.weekNavLabel}>{weekLabel}</Text>
            <TouchableOpacity onPress={nextWeek} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="chevron-forward" size={22} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.weekDaysRow}>
            {weekDays.map((day) => {
              const isSelected = isSameDay(day, selectedDate);
              const isTodayDay = isSameDay(day, new Date());
              const dayTasks = tasksForDate(day.getTime());
              const dayHolidays = holidaysByDate.get(dateKey(day)) ?? [];
              const dots: string[] = [];
              if (dayHolidays.length > 0) dots.push(HOLIDAY_COLOR);
              dayTasks.slice(0, 2).forEach((t) => {
                const cat = t.categoryId ? getTaskCategory(t.categoryId) : undefined;
                dots.push(cat?.color ?? theme.colors.primary);
              });
              return (
                <TouchableOpacity
                  key={dateKey(day)}
                  style={[styles.weekDayCell, isSelected && styles.weekDayCellSelected]}
                  onPress={() => setSelectedDate(day)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.weekDayName}>
                    {day.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 2).toUpperCase()}
                  </Text>
                  <Text style={[
                    styles.weekDayNum,
                    isSelected && styles.weekDayNumSelected,
                    isTodayDay && !isSelected && styles.weekDayNumToday,
                  ]}>
                    {day.getDate()}
                  </Text>
                  <View style={styles.weekDotRow}>
                    {dots.slice(0, 3).map((c, i) => (
                      <View key={i} style={[styles.weekDot, { backgroundColor: c }]} />
                    ))}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          <FlatList
            style={styles.weekContent}
            data={selectedTasks}
            renderItem={renderTaskItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: 100 }}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <>
                <View style={[styles.dayHeader, { paddingHorizontal: 0 }]}>
                  <Text style={styles.dayLabel}>{shortDateLabel(selectedDate)}</Text>
                  <Text style={styles.taskCount}>
                    {selectedTasks.length} task{selectedTasks.length !== 1 ? 's' : ''}
                  </Text>
                </View>
                {selectedHolidays.length > 0 && (
                  <View style={[styles.holidayBanner, { marginHorizontal: 0 }]}>
                    <Ionicons name="sparkles" size={18} color={HOLIDAY_COLOR} />
                    <Text style={styles.holidayBannerText}>
                      {selectedHolidays.map((h) => h.localName || h.name).join(' • ')}
                    </Text>
                  </View>
                )}
              </>
            }
            ListEmptyComponent={
              selectedHolidays.length === 0 ? (
                <View style={styles.emptyDay}>
                  <Icon name="calendar" size={36} color={theme.colors.textDisabled} />
                  <Text style={styles.emptyText}>No tasks this day</Text>
                </View>
              ) : null
            }
          />
        </>
      )}

      {viewMode === 'agenda' && (
        agendaItems.length === 0 ? (
          <View style={styles.agendaEmpty}>
            <Ionicons name="list-outline" size={64} color={theme.colors.textDisabled} />
            <Text style={styles.agendaEmptyText}>No upcoming tasks or holidays</Text>
            <Text style={styles.agendaEmptyHint}>
              Add tasks with due dates or change country to see public holidays
            </Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={[styles.agendaContainer, { paddingTop: theme.spacing.md }]}
            showsVerticalScrollIndicator={false}
          >
            {agendaItems.map(({ date, tasks: dayTasks, holidays: dayHolidays }) => {
              const isSelectedDay = isSameDay(date, selectedDate);
              const isTodayDay = isSameDay(date, new Date());
              return (
                <View key={dateKey(date)} style={styles.agendaDateGroup}>
                  <TouchableOpacity
                    style={styles.agendaDateHeader}
                    onPress={() => { setSelectedDate(date); setViewMode('month'); }}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.agendaDateDot, {
                      backgroundColor: isTodayDay
                        ? theme.colors.primary
                        : isSelectedDay
                          ? theme.colors.accent ?? '#F59E0B'
                          : theme.colors.border,
                      width: isTodayDay ? 12 : 10,
                      height: isTodayDay ? 12 : 10,
                      borderRadius: isTodayDay ? 6 : 5,
                    }]} />
                    <Text style={[styles.agendaDateLabel, isTodayDay && { color: theme.colors.primary }]}>
                      {shortDateLabel(date)}
                    </Text>
                    <Text style={styles.agendaDateSub}>
                      {date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </Text>
                    <View style={{ flex: 1 }} />
                    <Text style={styles.taskCount}>
                      {dayTasks.length} task{dayTasks.length !== 1 ? 's' : ''}
                    </Text>
                  </TouchableOpacity>

                  {dayHolidays.map((h) => (
                    <View key={`${h.date}-${h.name}`} style={styles.agendaHolidayChip}>
                      <Ionicons name="sparkles" size={14} color={HOLIDAY_COLOR} />
                      <Text style={styles.agendaHolidayText}>{h.localName || h.name}</Text>
                    </View>
                  ))}

                  {dayTasks.map((task) => {
                    const cat = task.categoryId ? getTaskCategory(task.categoryId) : undefined;
                    return (
                      <View key={task.id} style={{ marginLeft: 18, marginBottom: 6 }}>
                        <TaskCard
                          task={task}
                          category={cat}
                          onToggle={() => toggleTaskComplete(task.id)}
                          onPress={() => navigation.navigate('TaskEditor', { taskId: task.id })}
                        />
                      </View>
                    );
                  })}
                </View>
              );
            })}
          </ScrollView>
        )
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('TaskEditor', { date: selectedDate.getTime() })}
        activeOpacity={0.8}
      >
        <Icon name="add" size={28} color="#FFF" />
      </TouchableOpacity>

      {/* Country picker modal */}
      <Modal
        visible={showCountryPicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCountryPicker(false)}
      >
        <View style={styles.modalRoot}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose Country</Text>
              <TouchableOpacity onPress={() => setShowCountryPicker(false)}>
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
            <TextInput
              value={countrySearch}
              onChangeText={setCountrySearch}
              placeholder="Search country..."
              placeholderTextColor={theme.colors.textMuted}
              style={styles.searchInput}
              autoCorrect={false}
              autoCapitalize="none"
            />
            <FlatList
              data={filteredCountries}
              keyExtractor={(c) => c.code}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const isSelected = item.code === country;
                return (
                  <TouchableOpacity
                    style={styles.countryRow}
                    onPress={() => {
                      updateSettings({ holidayCountry: item.code });
                      setShowCountryPicker(false);
                      setCountrySearch('');
                    }}
                  >
                    <Text style={styles.countryLabel}>{item.name}</Text>
                    <Text style={styles.countryCode}>{item.code}</Text>
                    {isSelected && (
                      <Ionicons name="checkmark" size={18} color={theme.colors.primary} />
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}
