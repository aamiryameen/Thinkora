import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import type { RootStackParamList } from '../navigation/types';
import type { Task } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function EisenhowerScreen() {
  const navigation = useNavigation<Nav>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { tasks, toggleTaskComplete } = useApp();

  const pending = tasks.filter((t) => !t.completed);

  const quadrants = useMemo(() => {
    const urgent = (t: Task) => !!(t.dueDate && t.dueDate < Date.now() + 86400000 * 2);
    const important = (t: Task) => t.priority === 'high' || t.priority === 'medium';
    return {
      do: pending.filter((t) => urgent(t) && important(t)),
      schedule: pending.filter((t) => !urgent(t) && important(t)),
      delegate: pending.filter((t) => urgent(t) && !important(t)),
      eliminate: pending.filter((t) => !urgent(t) && !important(t)),
    };
  }, [pending]);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    header: { paddingHorizontal: theme.spacing.lg, paddingTop: insets.top + theme.spacing.md, paddingBottom: theme.spacing.md, backgroundColor: theme.colors.surface },
    title: { ...theme.typography.title, color: theme.colors.text, fontSize: 26, fontWeight: '700' },
    subtitle: { ...theme.typography.caption, color: theme.colors.textMuted },
    grid: { flex: 1, padding: theme.spacing.sm },
    row: { flexDirection: 'row', flex: 1, gap: theme.spacing.sm },
    quadrant: { flex: 1, borderRadius: theme.borderRadius.xl, padding: theme.spacing.md, marginBottom: theme.spacing.sm },
    qHeader: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs, marginBottom: theme.spacing.sm },
    qTitle: { ...theme.typography.label, fontWeight: '700', color: '#FFF', flex: 1 },
    qCount: { ...theme.typography.label, color: '#FFFFFFAA' },
    taskRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs, marginBottom: 6 },
    checkbox: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#FFFFFF80', alignItems: 'center', justifyContent: 'center' },
    taskText: { ...theme.typography.caption, color: '#FFF', flex: 1 },
    emptyQ: { ...theme.typography.caption, color: '#FFFFFF60', fontStyle: 'italic' },
    axisLabel: { ...theme.typography.overline, color: theme.colors.textMuted, textAlign: 'center', marginBottom: 4, letterSpacing: 2 },
    sideLabel: { ...theme.typography.overline, color: theme.colors.textMuted, letterSpacing: 2 },
  }), [theme, insets]);

  const renderQuadrant = (title: string, tasks: Task[], color: string, icon: string) => (
    <View style={[styles.quadrant, { backgroundColor: color }]}>
      <View style={styles.qHeader}>
        <Ionicons name={icon} size={16} color="#FFF" />
        <Text style={styles.qTitle}>{title}</Text>
        <Text style={styles.qCount}>{tasks.length}</Text>
      </View>
      {tasks.length === 0 ? (
        <Text style={styles.emptyQ}>No tasks</Text>
      ) : (
        tasks.slice(0, 5).map((t) => (
          <TouchableOpacity key={t.id} style={styles.taskRow} onPress={() => navigation.navigate('TaskEditor', { taskId: t.id })}>
            <TouchableOpacity style={styles.checkbox} onPress={() => toggleTaskComplete(t.id)}>
              {t.completed && <Ionicons name="checkmark" size={12} color="#FFF" />}
            </TouchableOpacity>
            <Text style={styles.taskText} numberOfLines={1}>{t.title}</Text>
          </TouchableOpacity>
        ))
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Priority Matrix</Text>
        </View>
        <Text style={styles.subtitle}>Eisenhower method — focus on what matters</Text>
      </View>
      <View style={styles.grid}>
        <Text style={styles.axisLabel}>← URGENT →</Text>
        <View style={styles.row}>
          {renderQuadrant('DO', quadrants.do, '#EF4444', 'flash-outline')}
          {renderQuadrant('SCHEDULE', quadrants.schedule, '#3B82F6', 'calendar-outline')}
        </View>
        <View style={styles.row}>
          {renderQuadrant('DELEGATE', quadrants.delegate, '#F59E0B', 'people-outline')}
          {renderQuadrant('ELIMINATE', quadrants.eliminate, '#6B778C', 'close-circle-outline')}
        </View>
      </View>
    </View>
  );
}
