import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import type { TaskCategory } from '../types';

interface Props {
  categories: TaskCategory[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  showAll?: boolean;
}

export function CategoryPicker({ categories, selectedId, onSelect, showAll }: Props) {
  const { theme } = useTheme();

  const styles = useMemo(() => StyleSheet.create({
    scroll: {
      flexGrow: 0,
    },
    row: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.inputBg,
      borderWidth: 1.5,
      borderColor: 'transparent',
      gap: theme.spacing.xs,
    },
    chipSelected: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primaryLight,
    },
    dot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    chipText: {
      ...theme.typography.bodySmall,
      fontWeight: '500',
      color: theme.colors.text,
    },
    chipTextSelected: {
      color: theme.colors.primary,
      fontWeight: '600',
    },
  }), [theme]);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll}>
      <View style={styles.row}>
        {showAll && (
          <TouchableOpacity
            style={[styles.chip, selectedId === null && styles.chipSelected]}
            onPress={() => onSelect(null)}
          >
            <Ionicons name="apps-outline" size={14} color={selectedId === null ? theme.colors.primary : theme.colors.textSecondary} />
            <Text style={[styles.chipText, selectedId === null && styles.chipTextSelected]}>All</Text>
          </TouchableOpacity>
        )}
        {categories.map((cat) => {
          const isSelected = selectedId === cat.id;
          return (
            <TouchableOpacity
              key={cat.id}
              style={[styles.chip, isSelected && styles.chipSelected]}
              onPress={() => onSelect(isSelected ? null : cat.id)}
            >
              <View style={[styles.dot, { backgroundColor: cat.color }]} />
              <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>{cat.name}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}
