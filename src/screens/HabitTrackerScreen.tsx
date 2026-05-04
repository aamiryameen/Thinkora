import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { useFeatures } from '../context/FeaturesContext';
import { categoryColors } from '../core/theme';
import type { Habit } from '../types';

const HABIT_COLORS = [categoryColors.blue, categoryColors.green, categoryColors.orange, categoryColors.red, categoryColors.purple, categoryColors.pink, categoryColors.teal, categoryColors.indigo];
const HABIT_ICONS = ['fitness-outline', 'water-outline', 'book-outline', 'walk-outline', 'musical-notes-outline', 'code-slash-outline', 'heart-outline', 'leaf-outline'];

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function HabitTrackerScreen() {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { habits, addHabit, toggleHabitDate, deleteHabit, getHabitStreak } = useFeatures();
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [selectedColor, setSelectedColor] = useState(0);
  const [selectedIcon, setSelectedIcon] = useState(0);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selectedCalendarHabit, setSelectedCalendarHabit] = useState<string | null>(null);

  const today = dateKey(new Date());
  const last7Days = useMemo(() => {
    const days: { key: string; label: string; dayNum: string }[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      days.push({
        key: dateKey(d),
        label: d.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 2),
        dayNum: String(d.getDate()),
      });
    }
    return days;
  }, []);

  const handleAdd = () => {
    if (!newName.trim()) return;
    addHabit({ name: newName.trim(), icon: HABIT_ICONS[selectedIcon], color: HABIT_COLORS[selectedColor], frequency: 'daily', targetDays: [], reminderTime: null });
    setNewName('');
    setShowAdd(false);
  };

  const handleDelete = (h: Habit) => {
    Alert.alert('Delete habit', `Remove "${h.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteHabit(h.id) },
    ]);
  };

  // Heatmap: last 12 weeks
  const heatmapData = useMemo(() => {
    const weeks: { key: string; completed: number }[][] = [];
    const now = new Date();
    for (let w = 11; w >= 0; w--) {
      const week: { key: string; completed: number }[] = [];
      for (let d = 0; d < 7; d++) {
        const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (w * 7 + (6 - d)));
        const key = dateKey(date);
        const count = habits.filter((h) => (h.completedDates ?? []).includes(key)).length;
        week.push({ key, completed: count });
      }
      weeks.push(week);
    }
    return weeks;
  }, [habits]);

  const maxHeatmap = Math.max(...heatmapData.flat().map((d) => d.completed), 1);

  // Monthly calendar data
  const calendarDays = useMemo(() => {
    const { year, month } = calendarMonth;
    const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (string | null)[] = Array(firstDay).fill(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    }
    // Pad to complete grid
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [calendarMonth]);

  const calendarHabit = useMemo(() => {
    if (!selectedCalendarHabit) return habits[0] ?? null;
    return habits.find((h) => h.id === selectedCalendarHabit) ?? habits[0] ?? null;
  }, [selectedCalendarHabit, habits]);

  const monthName = new Date(calendarMonth.year, calendarMonth.month, 1)
    .toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    header: { paddingHorizontal: theme.spacing.lg, paddingTop: insets.top + theme.spacing.md, paddingBottom: theme.spacing.md, backgroundColor: theme.colors.surface },
    title: { ...theme.typography.title, color: theme.colors.text, fontSize: 26, fontWeight: '700' },
    subtitle: { ...theme.typography.caption, color: theme.colors.textMuted, marginTop: 2 },
    scroll: { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md, paddingBottom: 120 },
    sectionTitle: { ...theme.typography.label, color: theme.colors.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginTop: theme.spacing.lg, marginBottom: theme.spacing.sm },
    habitCard: { backgroundColor: theme.colors.cardBg, borderRadius: theme.borderRadius.lg, padding: theme.spacing.md, marginBottom: theme.spacing.sm, ...theme.shadows.card },
    habitHeader: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.sm },
    habitIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    habitName: { ...theme.typography.body, color: theme.colors.text, fontWeight: '600', flex: 1 },
    streakBadge: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: theme.colors.warningLight, paddingHorizontal: theme.spacing.sm, paddingVertical: 2, borderRadius: theme.borderRadius.full },
    streakText: { ...theme.typography.caption, color: theme.colors.warning, fontWeight: '700' },
    daysRow: { flexDirection: 'row', justifyContent: 'space-between' },
    dayCol: { alignItems: 'center', gap: 4, flex: 1 },
    dayLabel: { ...theme.typography.overline, color: theme.colors.textMuted },
    dayCircle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
    dayNum: { ...theme.typography.caption, fontWeight: '600' },
    addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.spacing.sm, paddingVertical: theme.spacing.md, borderRadius: theme.borderRadius.lg, borderWidth: 2, borderColor: theme.colors.primary, borderStyle: 'dashed', marginTop: theme.spacing.md },
    addBtnText: { ...theme.typography.button, color: theme.colors.primary },
    addForm: { backgroundColor: theme.colors.cardBg, borderRadius: theme.borderRadius.xl, padding: theme.spacing.lg, gap: theme.spacing.md, ...theme.shadows.card, marginTop: theme.spacing.md },
    input: { ...theme.typography.body, color: theme.colors.text, backgroundColor: theme.colors.inputBg, borderRadius: theme.borderRadius.lg, padding: theme.spacing.md },
    colorRow: { flexDirection: 'row', gap: theme.spacing.sm, flexWrap: 'wrap' },
    colorDot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    iconRow: { flexDirection: 'row', gap: theme.spacing.sm, flexWrap: 'wrap' },
    iconDot: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.inputBg },
    iconDotSelected: { backgroundColor: theme.colors.primaryLight, borderWidth: 2, borderColor: theme.colors.primary },
    formBtnRow: { flexDirection: 'row', gap: theme.spacing.sm },
    formBtn: { flex: 1, alignItems: 'center', paddingVertical: theme.spacing.md, borderRadius: theme.borderRadius.lg },
    formBtnText: { ...theme.typography.button },
    heatmapCard: { backgroundColor: theme.colors.cardBg, borderRadius: theme.borderRadius.xl, padding: theme.spacing.lg, ...theme.shadows.card },
    heatmapRow: { flexDirection: 'row', gap: 3 },
    heatmapCell: { width: 14, height: 14, borderRadius: 3, margin: 1 },
    heatmapLabel: { ...theme.typography.caption, color: theme.colors.textMuted, marginTop: theme.spacing.sm, textAlign: 'center' },
    empty: { alignItems: 'center', paddingTop: 40, gap: theme.spacing.md },
    emptyText: { ...theme.typography.body, color: theme.colors.textMuted },
    // Monthly calendar
    calendarCard: { backgroundColor: theme.colors.cardBg, borderRadius: theme.borderRadius.xl, padding: theme.spacing.lg, ...theme.shadows.card },
    calendarNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.md },
    calendarMonthText: { ...theme.typography.titleSmall, color: theme.colors.text, fontWeight: '700' },
    calendarWeekRow: { flexDirection: 'row', marginBottom: theme.spacing.xs },
    calendarWeekDay: { flex: 1, textAlign: 'center', ...theme.typography.overline, color: theme.colors.textMuted },
    calendarGrid: { gap: 4 },
    calendarRow: { flexDirection: 'row' },
    calendarCell: { flex: 1, aspectRatio: 1, margin: 2, borderRadius: 100, alignItems: 'center', justifyContent: 'center' },
    calendarDayNum: { ...theme.typography.caption, fontWeight: '600' },
    habitSelector: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs, marginBottom: theme.spacing.md },
    habitSelectorChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: theme.spacing.sm, borderRadius: theme.borderRadius.full, borderWidth: 1.5 },
  }), [theme, insets]);

  const renderHabit = (habit: Habit) => {
    const streak = getHabitStreak(habit);
    return (
      <TouchableOpacity key={habit.id} style={styles.habitCard} onLongPress={() => handleDelete(habit)} activeOpacity={0.7}>
        <View style={styles.habitHeader}>
          <View style={[styles.habitIconWrap, { backgroundColor: habit.color + '20' }]}>
            <Ionicons name={habit.icon} size={20} color={habit.color} />
          </View>
          <Text style={styles.habitName}>{habit.name}</Text>
          {streak > 0 && (
            <View style={styles.streakBadge}>
              <Ionicons name="flame-outline" size={14} color={theme.colors.warning} />
              <Text style={styles.streakText}>{streak}d</Text>
            </View>
          )}
        </View>
        <View style={styles.daysRow}>
          {last7Days.map((day) => {
            const done = (habit.completedDates ?? []).includes(day.key);
            return (
              <TouchableOpacity key={day.key} style={styles.dayCol} onPress={() => toggleHabitDate(habit.id, day.key)}>
                <Text style={styles.dayLabel}>{day.label}</Text>
                <View style={[styles.dayCircle, { borderColor: done ? habit.color : theme.colors.border, backgroundColor: done ? habit.color : 'transparent' }]}>
                  {done ? <Ionicons name="checkmark" size={16} color="#FFF" /> : <Text style={[styles.dayNum, { color: theme.colors.textMuted }]}>{day.dayNum}</Text>}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Habits</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={styles.subtitle}>{habits.filter((h) => (h.completedDates ?? []).includes(today)).length}/{habits.length} done</Text>
          <TouchableOpacity
            onPress={() => (navigation as any).navigate('HabitStacks')}
            style={{ width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.inputBg }}
            hitSlop={6}
          >
            <Ionicons name="link-outline" size={20} color={theme.colors.text} />
          </TouchableOpacity>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {habits.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="fitness-outline" size={64} color={theme.colors.textDisabled} />
            <Text style={styles.emptyText}>No habits yet. Start building good habits!</Text>
          </View>
        ) : (
          habits.filter((h) => !h.archived).map(renderHabit)
        )}

        {showAdd ? (
          <View style={styles.addForm}>
            <TextInput style={styles.input} value={newName} onChangeText={setNewName} placeholder="Habit name..." placeholderTextColor={theme.colors.textMuted} autoFocus />
            <Text style={[styles.sectionTitle, { marginTop: 0 }]}>Color</Text>
            <View style={styles.colorRow}>
              {HABIT_COLORS.map((c, i) => (
                <TouchableOpacity key={c} style={[styles.colorDot, { backgroundColor: c }]} onPress={() => setSelectedColor(i)}>
                  {selectedColor === i && <Ionicons name="checkmark" size={16} color="#FFF" />}
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[styles.sectionTitle, { marginTop: 0 }]}>Icon</Text>
            <View style={styles.iconRow}>
              {HABIT_ICONS.map((icon, i) => (
                <TouchableOpacity key={icon} style={[styles.iconDot, selectedIcon === i && styles.iconDotSelected]} onPress={() => setSelectedIcon(i)}>
                  <Ionicons name={icon} size={20} color={selectedIcon === i ? theme.colors.primary : theme.colors.textMuted} />
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.formBtnRow}>
              <TouchableOpacity style={[styles.formBtn, { backgroundColor: theme.colors.inputBg }]} onPress={() => setShowAdd(false)}>
                <Text style={[styles.formBtnText, { color: theme.colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.formBtn, { backgroundColor: theme.colors.primary }]} onPress={handleAdd}>
                <Text style={[styles.formBtnText, { color: '#FFF' }]}>Add Habit</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowAdd(true)}>
            <Ionicons name="add" size={20} color={theme.colors.primary} />
            <Text style={styles.addBtnText}>New Habit</Text>
          </TouchableOpacity>
        )}

        {/* Heatmap */}
        {habits.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Activity (12 weeks)</Text>
            <View style={styles.heatmapCard}>
              {[0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => (
                <View key={dayOfWeek} style={styles.heatmapRow}>
                  {heatmapData.map((week, wi) => {
                    const cell = week[dayOfWeek];
                    const intensity = cell.completed / maxHeatmap;
                    const bg = cell.completed === 0 ? theme.colors.inputBg : `${theme.colors.primary}${Math.round(30 + intensity * 70).toString(16).padStart(2, '0')}`;
                    return <View key={wi} style={[styles.heatmapCell, { backgroundColor: bg }]} />;
                  })}
                </View>
              ))}
              <Text style={styles.heatmapLabel}>Less → More</Text>
            </View>

            {/* Monthly Calendar */}
            <Text style={styles.sectionTitle}>Monthly View</Text>
            <View style={styles.calendarCard}>
              {/* Habit selector */}
              {habits.length > 1 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: theme.spacing.md }}>
                  <View style={styles.habitSelector}>
                    {habits.filter((h) => !h.archived).map((h) => {
                      const isSelected = (calendarHabit?.id === h.id);
                      return (
                        <TouchableOpacity
                          key={h.id}
                          style={[styles.habitSelectorChip, { borderColor: isSelected ? h.color : theme.colors.border, backgroundColor: isSelected ? h.color + '20' : 'transparent' }]}
                          onPress={() => setSelectedCalendarHabit(h.id)}
                        >
                          <Ionicons name={h.icon} size={12} color={h.color} />
                          <Text style={{ ...theme.typography.caption, color: isSelected ? h.color : theme.colors.textSecondary, fontWeight: '600' }}>{h.name}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>
              )}

              {/* Month navigation */}
              <View style={styles.calendarNav}>
                <TouchableOpacity onPress={() => setCalendarMonth(({ year, month }) => {
                  const d = new Date(year, month - 1, 1);
                  return { year: d.getFullYear(), month: d.getMonth() };
                })} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="chevron-back" size={20} color={theme.colors.text} />
                </TouchableOpacity>
                <Text style={styles.calendarMonthText}>{monthName}</Text>
                <TouchableOpacity onPress={() => setCalendarMonth(({ year, month }) => {
                  const d = new Date(year, month + 1, 1);
                  return { year: d.getFullYear(), month: d.getMonth() };
                })} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="chevron-forward" size={20} color={theme.colors.text} />
                </TouchableOpacity>
              </View>

              {/* Week day headers */}
              <View style={styles.calendarWeekRow}>
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                  <Text key={d} style={styles.calendarWeekDay}>{d}</Text>
                ))}
              </View>

              {/* Calendar grid */}
              <View style={styles.calendarGrid}>
                {Array.from({ length: calendarDays.length / 7 }, (_, rowIdx) => (
                  <View key={rowIdx} style={styles.calendarRow}>
                    {calendarDays.slice(rowIdx * 7, rowIdx * 7 + 7).map((key, colIdx) => {
                      if (!key) {
                        return <View key={colIdx} style={styles.calendarCell} />;
                      }
                      const isToday = key === today;
                      const done = calendarHabit ? (calendarHabit.completedDates ?? []).includes(key) : false;
                      const habitColor = calendarHabit?.color ?? theme.colors.primary;
                      const dayNum = parseInt(key.split('-')[2], 10);
                      return (
                        <TouchableOpacity
                          key={key}
                          style={[
                            styles.calendarCell,
                            done ? { backgroundColor: habitColor } : isToday ? { backgroundColor: theme.colors.primaryLight } : { backgroundColor: theme.colors.inputBg },
                          ]}
                          onPress={() => calendarHabit && toggleHabitDate(calendarHabit.id, key)}
                          activeOpacity={0.7}
                        >
                          {done
                            ? <Ionicons name="checkmark" size={14} color="#FFF" />
                            : <Text style={[styles.calendarDayNum, { color: isToday ? theme.colors.primary : theme.colors.textMuted }]}>{dayNum}</Text>
                          }
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}
              </View>

              {calendarHabit && (
                <Text style={[styles.heatmapLabel, { marginTop: theme.spacing.md }]}>
                  {(calendarHabit.completedDates ?? []).filter((k) => k.startsWith(`${calendarMonth.year}-${String(calendarMonth.month + 1).padStart(2, '0')}`)).length} day{(calendarHabit.completedDates ?? []).filter((k) => k.startsWith(`${calendarMonth.year}-${String(calendarMonth.month + 1).padStart(2, '0')}`)).length !== 1 ? 's' : ''} completed this month
                </Text>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}
