import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../components/Icons';
import { TaskCard } from '../components/TaskCard';
import { CategoryPicker } from '../components/CategoryPicker';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import type { RootStackParamList } from '../navigation/types';
import type { Task } from '../types';
import { showInterstitial } from '../services/ads';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function TaskListScreen() {
  const navigation = useNavigation<Nav>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const {
    filteredTasks,
    taskCategories,
    taskFilter,
    setTaskFilter,
    toggleTaskComplete,
    deleteTask,
    getTaskCategory,
  } = useApp();

  const [search, setSearch] = useState('');
  const completionCount = useRef(0);

  const onSearchChange = useCallback((text: string) => {
    setSearch(text);
    setTaskFilter({ searchQuery: text });
  }, [setTaskFilter]);

  const toggleShowCompleted = useCallback(() => {
    setTaskFilter({ showCompleted: !taskFilter.showCompleted });
  }, [setTaskFilter, taskFilter.showCompleted]);

  const handleToggleComplete = useCallback((task: Task) => {
    toggleTaskComplete(task.id);
    if (!task.completed) {
      completionCount.current += 1;
      if (completionCount.current % 5 === 0) {
        showInterstitial();
      }
    }
  }, [toggleTaskComplete]);

  const handleLongPress = useCallback((task: Task) => {
    Alert.alert(task.title, undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: task.completed ? 'Mark Incomplete' : 'Mark Complete', onPress: () => handleToggleComplete(task) },
      { text: 'Delete', style: 'destructive', onPress: () => deleteTask(task.id) },
    ]);
  }, [handleToggleComplete, deleteTask]);

  // Group tasks: Today, Upcoming, No Date, Completed
  const sections = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const todayEnd = todayStart + 86400000;

    const today: Task[] = [];
    const upcoming: Task[] = [];
    const noDate: Task[] = [];
    const completed: Task[] = [];

    filteredTasks.forEach((t) => {
      if (t.completed) {
        completed.push(t);
      } else if (!t.dueDate) {
        noDate.push(t);
      } else if (t.dueDate < todayEnd) {
        today.push(t);
      } else {
        upcoming.push(t);
      }
    });

    const result: { title: string; data: Task[] }[] = [];
    if (today.length) result.push({ title: 'Today', data: today });
    if (upcoming.length) result.push({ title: 'Upcoming', data: upcoming });
    if (noDate.length) result.push({ title: 'No Date', data: noDate });
    if (taskFilter.showCompleted && completed.length) result.push({ title: 'Completed', data: completed });
    return result;
  }, [filteredTasks, taskFilter.showCompleted]);

  const flatData = useMemo(() => {
    const items: ({ type: 'header'; title: string } | { type: 'task'; task: Task })[] = [];
    sections.forEach((s) => {
      items.push({ type: 'header', title: s.title });
      s.data.forEach((task) => items.push({ type: 'task', task }));
    });
    return items;
  }, [sections]);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    header: {
      paddingHorizontal: theme.spacing.lg,
      paddingTop: insets.top + theme.spacing.md,
      paddingBottom: theme.spacing.md,
      backgroundColor: theme.colors.surface,
    },
    titleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing.md,
    },
    title: {
      ...theme.typography.title,
      color: theme.colors.text,
      fontSize: 26,
      fontWeight: '700',
    },
    count: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
    },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.inputBg,
      borderRadius: theme.borderRadius.lg,
      paddingHorizontal: theme.spacing.md,
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.sm,
    },
    searchInput: {
      flex: 1,
      ...theme.typography.body,
      color: theme.colors.text,
      paddingVertical: theme.spacing.sm,
    },
    filterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    showCompletedBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: theme.spacing.xs,
      paddingHorizontal: theme.spacing.sm,
    },
    showCompletedText: {
      ...theme.typography.caption,
      color: theme.colors.primary,
      fontWeight: '600',
    },
    list: {
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.md,
      paddingBottom: 100,
    },
    sectionHeader: {
      ...theme.typography.label,
      color: theme.colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginTop: theme.spacing.lg,
      marginBottom: theme.spacing.sm,
    },
    sectionHeaderFirst: {
      marginTop: 0,
    },
    empty: {
      alignItems: 'center',
      paddingTop: 80,
      gap: theme.spacing.md,
    },
    emptyText: {
      ...theme.typography.body,
      color: theme.colors.textMuted,
    },
    emptyBtn: {
      backgroundColor: theme.colors.primary,
      paddingHorizontal: theme.spacing.xl,
      paddingVertical: theme.spacing.md,
      borderRadius: theme.borderRadius.full,
    },
    emptyBtnText: {
      ...theme.typography.button,
      color: '#FFF',
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

  const renderItem = useCallback(({ item, index }: { item: typeof flatData[number]; index: number }) => {
    if (item.type === 'header') {
      return (
        <Text style={[styles.sectionHeader, index === 0 && styles.sectionHeaderFirst]}>
          {item.title}
        </Text>
      );
    }
    const cat = item.task.categoryId ? getTaskCategory(item.task.categoryId) : undefined;
    return (
      <TaskCard
        task={item.task}
        category={cat}
        onToggle={() => handleToggleComplete(item.task)}
        onPress={() => navigation.navigate('TaskEditor', { taskId: item.task.id })}
        onLongPress={() => handleLongPress(item.task)}
      />
    );
  }, [styles, getTaskCategory, handleToggleComplete, navigation, handleLongPress]);

  const keyExtractor = useCallback((item: typeof flatData[number], index: number) => {
    return item.type === 'header' ? `header-${item.title}` : item.task.id;
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View>
            <Text style={styles.title}>My Tasks</Text>
            <Text style={styles.count}>{filteredTasks.filter((t) => !t.completed).length} pending tasks</Text>
          </View>
        </View>

        <View style={styles.searchRow}>
          <Icon name="search" size={18} color={theme.colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={onSearchChange}
            placeholder="Search tasks..."
            placeholderTextColor={theme.colors.textMuted}
          />
        </View>

        <View style={styles.filterRow}>
          <CategoryPicker
            categories={taskCategories}
            selectedId={taskFilter.categoryId}
            onSelect={(id) => setTaskFilter({ categoryId: id })}
            showAll
          />
        </View>

        <TouchableOpacity style={styles.showCompletedBtn} onPress={toggleShowCompleted}>
          <Icon
            name={taskFilter.showCompleted ? 'checkboxDone' : 'checkboxEmpty'}
            size={16}
            color={theme.colors.primary}
          />
          <Text style={styles.showCompletedText}>
            {taskFilter.showCompleted ? 'Hide completed' : 'Show completed'}
          </Text>
        </TouchableOpacity>
      </View>

      {flatData.length === 0 ? (
        <View style={styles.empty}>
          <Icon name="task" size={64} color={theme.colors.textDisabled} />
          <Text style={styles.emptyText}>No tasks yet</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.navigate('TaskEditor', {})}>
            <Text style={styles.emptyBtnText}>Create Task</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={flatData}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('TaskEditor', {})}
        activeOpacity={0.8}
      >
        <Icon name="add" size={28} color="#FFF" />
      </TouchableOpacity>
    </View>
  );
}
