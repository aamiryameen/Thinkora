import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import type { SubTask } from '../types';

interface Props {
  subtasks: SubTask[];
  onToggle: (id: string) => void;
  onAdd: (title: string) => void;
  onDelete: (id: string) => void;
}

export function SubTaskList({ subtasks, onToggle, onAdd, onDelete }: Props) {
  const { theme } = useTheme();
  const [newTitle, setNewTitle] = useState('');

  const handleAdd = () => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setNewTitle('');
  };

  const styles = useMemo(() => StyleSheet.create({
    container: {
      gap: theme.spacing.xs,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: theme.spacing.xs,
      gap: theme.spacing.sm,
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxDone: {
      backgroundColor: theme.colors.success,
      borderColor: theme.colors.success,
    },
    title: {
      ...theme.typography.bodySmall,
      color: theme.colors.text,
      flex: 1,
    },
    titleDone: {
      textDecorationLine: 'line-through',
      color: theme.colors.textMuted,
    },
    deleteBtn: {
      padding: 4,
    },
    addRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      marginTop: theme.spacing.xs,
    },
    addIcon: {
      width: 22,
      height: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addInput: {
      flex: 1,
      ...theme.typography.bodySmall,
      color: theme.colors.text,
      padding: 0,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      paddingVertical: theme.spacing.xs,
    },
  }), [theme]);

  return (
    <View style={styles.container}>
      {subtasks.map((sub) => (
        <View key={sub.id} style={styles.row}>
          <TouchableOpacity
            style={[styles.checkbox, sub.completed && styles.checkboxDone]}
            onPress={() => onToggle(sub.id)}
          >
            {sub.completed && <Ionicons name="checkmark" size={14} color="#FFF" />}
          </TouchableOpacity>
          <Text style={[styles.title, sub.completed && styles.titleDone]}>{sub.title}</Text>
          <TouchableOpacity style={styles.deleteBtn} onPress={() => onDelete(sub.id)}>
            <Ionicons name="close" size={18} color={theme.colors.textMuted} />
          </TouchableOpacity>
        </View>
      ))}

      <View style={styles.addRow}>
        <View style={styles.addIcon}>
          <Ionicons name="add" size={20} color={theme.colors.primary} />
        </View>
        <TextInput
          style={styles.addInput}
          value={newTitle}
          onChangeText={setNewTitle}
          onSubmitEditing={handleAdd}
          placeholder="Add Sub-task"
          placeholderTextColor={theme.colors.textMuted}
          returnKeyType="done"
        />
      </View>
    </View>
  );
}
