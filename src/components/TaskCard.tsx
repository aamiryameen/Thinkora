import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { fontStyle } from '../core/fonts';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import type { Task, TaskCategory } from '../types';

interface Props {
  task: Task;
  category?: TaskCategory;
  onToggle: () => void;
  onPress: () => void;
  onLongPress?: () => void;
  /** Optional pastel palette entry — if provided, tints the card. */
  palette?: { bg: string; accent: string };
}

function TaskCardImpl({ task, category, onToggle, onPress, onLongPress, palette }: Props) {
  const { theme } = useTheme();

  const dueDateLabel = useMemo(() => {
    if (!task.dueDate) return null;
    const d = new Date(task.dueDate);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const due = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diff = (due.getTime() - today.getTime()) / 86400000;
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff === -1) return 'Yesterday';
    if (diff < 0) return `${Math.abs(diff)}d overdue`;
    if (diff <= 7) return d.toLocaleDateString(undefined, { weekday: 'short' });
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }, [task.dueDate]);

  const isOverdue = !!(task.dueDate && !task.completed && task.dueDate < Date.now());
  const completedSubs = task.subtasks.filter((s) => s.completed).length;
  const totalSubs = task.subtasks.length;
  const catColor = category?.color ?? palette?.accent ?? theme.colors.primary;
  const cardBg = palette?.bg ?? theme.colors.cardBg;
  const onTint = !!palette;

  const styles = useMemo(() => StyleSheet.create({
    card: {
      backgroundColor: cardBg,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.lg,
      marginBottom: theme.spacing.sm,
      flexDirection: 'row',
      alignItems: 'flex-start',
      borderLeftWidth: palette ? 4 : 0,
      borderLeftColor: palette?.accent ?? 'transparent',
      ...theme.shadows.card,
    },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: catColor,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: theme.spacing.md,
      marginTop: 2,
    },
    checkboxDone: {
      backgroundColor: catColor,
    },
    content: {
      flex: 1,
    },
    title: {
      ...theme.typography.body,
      color: onTint ? '#1a1a2e' : theme.colors.text,
      fontWeight: '500',
    },
    titleDone: {
      textDecorationLine: 'line-through',
      color: onTint ? '#64748B' : theme.colors.textMuted,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: theme.spacing.xs,
      gap: theme.spacing.sm,
      flexWrap: 'wrap',
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 3,
      borderRadius: theme.borderRadius.full,
      backgroundColor: onTint ? 'rgba(255,255,255,0.6)' : theme.colors.inputBg,
      gap: 4,
    },
    chipOverdue: {
      backgroundColor: theme.colors.errorLight,
    },
    chipText: {
      ...theme.typography.caption,
      color: theme.colors.textSecondary,
    },
    chipTextOverdue: {
      color: theme.colors.error,
    },
    categoryDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: catColor,
    },
    categoryName: {
      ...theme.typography.caption,
      color: catColor,
    },
  }), [theme, catColor, cardBg, onTint, palette]);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
    >
      <TouchableOpacity style={[styles.checkbox, task.completed && styles.checkboxDone]} onPress={onToggle}>
        {task.completed && <Ionicons name="checkmark" size={16} color="#FFF" />}
      </TouchableOpacity>

      <View style={styles.content}>
        <Text
          style={[styles.title, task.completed && styles.titleDone, fontStyle(task.fontId)]}
          numberOfLines={2}
        >
          {task.title}
        </Text>

        <View style={styles.metaRow}>
          {category && (
            <View style={styles.chip}>
              <View style={styles.categoryDot} />
              <Text style={styles.categoryName}>{category.name}</Text>
            </View>
          )}
          {dueDateLabel && (
            <View style={[styles.chip, isOverdue && styles.chipOverdue]}>
              <Ionicons
                name="calendar-outline"
                size={12}
                color={isOverdue ? theme.colors.error : theme.colors.textSecondary}
              />
              <Text style={[styles.chipText, isOverdue && styles.chipTextOverdue]}>{dueDateLabel}</Text>
            </View>
          )}
          {totalSubs > 0 && (
            <View style={styles.chip}>
              <Ionicons name="list-outline" size={12} color={theme.colors.textSecondary} />
              <Text style={styles.chipText}>{completedSubs}/{totalSubs}</Text>
            </View>
          )}
          {task.priority !== 'none' && (
            <View style={styles.chip}>
              <Ionicons
                name="flag"
                size={12}
                color={task.priority === 'high' ? theme.colors.error : task.priority === 'medium' ? theme.colors.warning : theme.colors.success}
              />
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

/** Memoized — re-renders only when task fields, category, or palette change.
 *  This is the hottest component in the app (rendered N times in every list)
 *  so it deserves a custom equality check that ignores parent re-renders. */
export const TaskCard = React.memo(TaskCardImpl, (prev, next) => (
  prev.task === next.task &&
  prev.category === next.category &&
  prev.palette === next.palette &&
  prev.onToggle === next.onToggle &&
  prev.onPress === next.onPress &&
  prev.onLongPress === next.onLongPress
));
