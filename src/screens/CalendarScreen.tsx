import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../components/Icons';
import { CalendarGrid } from '../components/CalendarGrid';
import { TaskCard } from '../components/TaskCard';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function CalendarScreen() {
  const navigation = useNavigation<Nav>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { tasks, tasksForDate, toggleTaskComplete, getTaskCategory, settings } = useApp();
  const [selectedDate, setSelectedDate] = useState(new Date());

  const selectedTasks = useMemo(
    () => tasksForDate(selectedDate.getTime()),
    [tasksForDate, selectedDate]
  );

  const taskDots = useMemo(() => {
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
    return map;
  }, [tasks, getTaskCategory, theme.colors.primary]);

  const onMonthChange = useCallback((date: Date) => {
    setSelectedDate(date);
  }, []);

  const selectedLabel = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sel = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
    const diff = (sel.getTime() - today.getTime()) / 86400000;
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff === -1) return 'Yesterday';
    return selectedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  }, [selectedDate]);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    header: {
      paddingHorizontal: theme.spacing.lg,
      paddingTop: insets.top + theme.spacing.md,
      paddingBottom: theme.spacing.md,
      backgroundColor: theme.colors.surface,
    },
    title: {
      ...theme.typography.title,
      color: theme.colors.text,
      fontSize: 26,
      fontWeight: '700',
    },
    calendarWrap: {
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.md,
    },
    dayHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.lg,
      paddingBottom: theme.spacing.sm,
    },
    dayLabel: {
      ...theme.typography.titleSmall,
      color: theme.colors.text,
    },
    taskCount: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
    },
    list: {
      paddingHorizontal: theme.spacing.lg,
      paddingBottom: 100,
    },
    emptyDay: {
      alignItems: 'center',
      paddingTop: theme.spacing.xl,
      gap: theme.spacing.sm,
    },
    emptyText: {
      ...theme.typography.bodySmall,
      color: theme.colors.textMuted,
    },
    fab: {
      position: 'absolute',
      bottom: insets.bottom + theme.spacing.xl,
      right: theme.spacing.lg,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      ...theme.shadows.fab,
    },
  }), [theme, insets]);

  const renderTask = useCallback(({ item }: { item: typeof selectedTasks[number] }) => {
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Calendar</Text>
      </View>

      <FlatList
        ListHeaderComponent={
          <>
            <View style={styles.calendarWrap}>
              <CalendarGrid
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                onMonthChange={onMonthChange}
                taskDots={taskDots}
                firstDayOfWeek={settings.firstDayOfWeek}
              />
            </View>

            <View style={styles.dayHeader}>
              <Text style={styles.dayLabel}>{selectedLabel}</Text>
              <Text style={styles.taskCount}>{selectedTasks.length} tasks</Text>
            </View>
          </>
        }
        data={selectedTasks}
        renderItem={renderTask}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyDay}>
            <Icon name="calendar" size={40} color={theme.colors.textDisabled} />
            <Text style={styles.emptyText}>No tasks for this day</Text>
          </View>
        }
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('TaskEditor', { date: selectedDate.getTime() })}
        activeOpacity={0.8}
      >
        <Icon name="add" size={28} color="#FFF" />
      </TouchableOpacity>
    </View>
  );
}
