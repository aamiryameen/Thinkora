import React, { useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useApp } from '../context/AppContext';
import { useFeatures } from '../context/FeaturesContext';
import { useTheme } from '../context/ThemeContext';
import type { RootStackParamList } from '../navigation/types';
import type { TaskTemplate } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function TemplatesScreen() {
  const navigation = useNavigation<Nav>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { addTask } = useApp();
  const { taskTemplates } = useFeatures();

  const applyTemplate = (tpl: TaskTemplate) => {
    Alert.alert(`Apply "${tpl.name}"?`, `This will create ${tpl.tasks.length} tasks.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Apply', onPress: () => {
          tpl.tasks.forEach((t) => {
            addTask({
              title: t.title,
              completed: false,
              categoryId: null,
              dueDate: null,
              reminderDate: null,
              repeat: 'none',
              notes: '',
              attachments: [],
              subtasks: t.subtasks.map((s, i) => ({ id: `${Date.now()}-${i}`, title: s, completed: false })),
              priority: 'none',
            });
          });
          Alert.alert('Done!', `${tpl.tasks.length} tasks created from "${tpl.name}".`);
        },
      },
    ]);
  };

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    header: { paddingHorizontal: theme.spacing.lg, paddingTop: insets.top + theme.spacing.md, paddingBottom: theme.spacing.md, backgroundColor: theme.colors.surface },
    title: { ...theme.typography.title, color: theme.colors.text, fontSize: 26, fontWeight: '700' },
    subtitle: { ...theme.typography.caption, color: theme.colors.textMuted },
    list: { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md, paddingBottom: 100 },
    card: { backgroundColor: theme.colors.cardBg, borderRadius: theme.borderRadius.xl, padding: theme.spacing.lg, marginBottom: theme.spacing.md, ...theme.shadows.card },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, marginBottom: theme.spacing.md },
    iconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    cardTitle: { ...theme.typography.titleSmall, color: theme.colors.text, flex: 1 },
    taskCount: { ...theme.typography.caption, color: theme.colors.textMuted },
    taskPreview: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs, marginBottom: 4 },
    bulletDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.textMuted },
    taskPreviewText: { ...theme.typography.bodySmall, color: theme.colors.textSecondary },
    applyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.spacing.sm, marginTop: theme.spacing.md, paddingVertical: theme.spacing.md, borderRadius: theme.borderRadius.lg, backgroundColor: theme.colors.primaryLight },
    applyBtnText: { ...theme.typography.button, color: theme.colors.primary },
  }), [theme, insets]);

  const TEMPLATE_COLORS = [theme.colors.primary, '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

  const renderTemplate = ({ item, index }: { item: TaskTemplate; index: number }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.iconWrap, { backgroundColor: TEMPLATE_COLORS[index % TEMPLATE_COLORS.length] + '20' }]}>
          <Ionicons name={item.icon} size={24} color={TEMPLATE_COLORS[index % TEMPLATE_COLORS.length]} />
        </View>
        <Text style={styles.cardTitle}>{item.name}</Text>
        <Text style={styles.taskCount}>{item.tasks.length} tasks</Text>
      </View>
      {item.tasks.slice(0, 4).map((t, i) => (
        <View key={i} style={styles.taskPreview}>
          <View style={styles.bulletDot} />
          <Text style={styles.taskPreviewText}>{t.title}</Text>
        </View>
      ))}
      {item.tasks.length > 4 && <Text style={styles.taskPreviewText}>+{item.tasks.length - 4} more...</Text>}
      <TouchableOpacity style={styles.applyBtn} onPress={() => applyTemplate(item)}>
        <Ionicons name="add-circle-outline" size={18} color={theme.colors.primary} />
        <Text style={styles.applyBtnText}>Use Template</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Templates</Text>
        </View>
        <Text style={styles.subtitle}>Quick-start with pre-built task lists</Text>
      </View>
      <FlatList data={taskTemplates} renderItem={renderTemplate} keyExtractor={(t) => t.id} contentContainerStyle={styles.list} />
    </View>
  );
}
