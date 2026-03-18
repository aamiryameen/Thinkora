import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert, ScrollView,
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
        <Text style={styles.subtitle}>{habits.filter((h) => (h.completedDates ?? []).includes(today)).length}/{habits.length} completed today</Text>
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
          </>
        )}
      </ScrollView>
    </View>
  );
}
