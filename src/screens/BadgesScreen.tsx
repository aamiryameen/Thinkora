import React, { useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { useFeatures } from '../context/FeaturesContext';
import type { Badge } from '../types';

export function BadgesScreen() {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { badges } = useFeatures();

  const unlocked = badges.filter((b) => b.unlockedAt);
  const locked = badges.filter((b) => !b.unlockedAt);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    header: { paddingHorizontal: theme.spacing.lg, paddingTop: insets.top + theme.spacing.md, paddingBottom: theme.spacing.md, backgroundColor: theme.colors.surface },
    title: { ...theme.typography.title, color: theme.colors.text, fontSize: 26, fontWeight: '700' },
    subtitle: { ...theme.typography.caption, color: theme.colors.textMuted },
    list: { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md, paddingBottom: 100 },
    sectionTitle: { ...theme.typography.label, color: theme.colors.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginTop: theme.spacing.lg, marginBottom: theme.spacing.sm },
    card: { backgroundColor: theme.colors.cardBg, borderRadius: theme.borderRadius.xl, padding: theme.spacing.lg, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.lg, marginBottom: theme.spacing.sm, ...theme.shadows.card },
    cardLocked: { opacity: 0.5 },
    iconWrap: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
    content: { flex: 1 },
    badgeName: { ...theme.typography.body, color: theme.colors.text, fontWeight: '600' },
    badgeDesc: { ...theme.typography.caption, color: theme.colors.textSecondary, marginTop: 2 },
    unlockedDate: { ...theme.typography.overline, color: theme.colors.success, marginTop: 4 },
    lockIcon: { position: 'absolute', right: -4, bottom: -4 },
    progressRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.spacing.lg, marginBottom: theme.spacing.lg, marginTop: theme.spacing.md },
    progressCard: { alignItems: 'center', gap: 4 },
    progressNum: { ...theme.typography.title, color: theme.colors.primary, fontWeight: '800', fontSize: 28 },
    progressLabel: { ...theme.typography.caption, color: theme.colors.textMuted },
  }), [theme, insets]);

  const data = [
    { type: 'progress' as const },
    ...(unlocked.length > 0 ? [{ type: 'header' as const, title: 'Unlocked' }] : []),
    ...unlocked.map((b) => ({ type: 'badge' as const, badge: b })),
    ...(locked.length > 0 ? [{ type: 'header' as const, title: 'Locked' }] : []),
    ...locked.map((b) => ({ type: 'badge' as const, badge: b })),
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Badges & Streaks</Text>
        </View>
        <Text style={styles.subtitle}>{unlocked.length}/{badges.length} unlocked</Text>
      </View>
      <FlatList
        data={data}
        keyExtractor={(item, i) => item.type === 'badge' ? item.badge.id : `${item.type}-${i}`}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          if (item.type === 'progress') {
            return (
              <View style={styles.progressRow}>
                <View style={styles.progressCard}>
                  <Text style={styles.progressNum}>{unlocked.length}</Text>
                  <Text style={styles.progressLabel}>Earned</Text>
                </View>
                <View style={styles.progressCard}>
                  <Text style={[styles.progressNum, { color: theme.colors.textMuted }]}>{locked.length}</Text>
                  <Text style={styles.progressLabel}>Remaining</Text>
                </View>
              </View>
            );
          }
          if (item.type === 'header') return <Text style={styles.sectionTitle}>{item.title}</Text>;
          const b = item.badge;
          const isLocked = !b.unlockedAt;
          return (
            <View style={[styles.card, isLocked && styles.cardLocked]}>
              <View style={[styles.iconWrap, { backgroundColor: b.color + '20' }]}>
                <Ionicons name={b.icon as any} size={28} color={b.color} />
                {isLocked && <View style={styles.lockIcon}><Ionicons name="lock-closed" size={14} color={theme.colors.textMuted} /></View>}
              </View>
              <View style={styles.content}>
                <Text style={styles.badgeName}>{b.name}</Text>
                <Text style={styles.badgeDesc}>{b.description}</Text>
                {b.unlockedAt && <Text style={styles.unlockedDate}>Unlocked {new Date(b.unlockedAt).toLocaleDateString()}</Text>}
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}
