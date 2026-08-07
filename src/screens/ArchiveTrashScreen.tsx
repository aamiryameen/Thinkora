import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';
import {
  daysUntilPurge, deleteForever, emptyTrash, getArchived, getTrashed,
  restoreFromTrash, setArchived, TRASH_RETENTION_DAYS, type ArchiveEntry,
} from '../services/archiveService';

type Tab = 'archive' | 'trash';

export function ArchiveTrashScreen() {
  const nav = useNavigation();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { reloadFromStorage } = useApp();

  const [tab, setTab] = useState<Tab>('archive');
  const [entries, setEntries] = useState<ArchiveEntry[] | null>(null);

  const load = useCallback(async () => {
    setEntries(null);
    try {
      setEntries(tab === 'archive' ? await getArchived() : await getTrashed());
    } catch {
      setEntries([]);
    }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  /**
   * Archive and trash write straight to the database, so AppContext has to be
   * told to re-read or the notes list would still show the old state.
   */
  const refreshAll = useCallback(async () => {
    await load();
    await reloadFromStorage?.();
  }, [load, reloadFromStorage]);

  const unarchive = useCallback(async (entry: ArchiveEntry) => {
    await setArchived(entry.kind, entry.id, false);
    await refreshAll();
  }, [refreshAll]);

  const restore = useCallback(async (entry: ArchiveEntry) => {
    await restoreFromTrash(entry.kind, entry.id);
    await refreshAll();
  }, [refreshAll]);

  const purge = useCallback((entry: ArchiveEntry) => {
    Alert.alert(
      'Delete forever?',
      `"${entry.title}" cannot be recovered.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            await deleteForever(entry.kind, entry.id);
            await refreshAll();
          },
        },
      ],
    );
  }, [refreshAll]);

  const clearTrash = useCallback(() => {
    if (!entries?.length) return;
    Alert.alert(
      'Empty trash',
      `Permanently delete all ${entries.length} item${entries.length === 1 ? '' : 's'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Empty', style: 'destructive',
          onPress: async () => { await emptyTrash(); await refreshAll(); },
        },
      ],
    );
  }, [entries, refreshAll]);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    header: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: theme.spacing.lg,
      paddingTop: insets.top + theme.spacing.md,
      paddingBottom: theme.spacing.md,
      backgroundColor: theme.colors.surface,
      gap: theme.spacing.sm,
    },
    iconBtn: {
      width: 38, height: 38, borderRadius: 12,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: theme.colors.inputBg,
    },
    title: {
      ...theme.typography.title, fontSize: 22, fontWeight: '700',
      color: theme.colors.text, flex: 1,
    },
    tabs: {
      flexDirection: 'row', gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md,
      backgroundColor: theme.colors.surface,
    },
    tab: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 6, paddingVertical: 9,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.inputBg,
    },
    tabOn: { backgroundColor: theme.colors.primaryLight },
    tabText: { ...theme.typography.caption, fontWeight: '700', color: theme.colors.textMuted },
    tabTextOn: { color: theme.colors.primary },
    scroll: { padding: theme.spacing.lg, paddingBottom: 140, gap: theme.spacing.sm },
    row: {
      flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md,
      backgroundColor: theme.colors.cardBg,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.md,
      overflow: 'hidden',
    },
    thumb: {
      width: 44, height: 44, borderRadius: 12,
      alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
    },
    name: { ...theme.typography.bodySmall, fontWeight: '700', color: theme.colors.text },
    meta: { ...theme.typography.caption, fontSize: 11, color: theme.colors.textMuted },
    empty: {
      ...theme.typography.bodySmall, color: theme.colors.textMuted,
      textAlign: 'center', paddingVertical: theme.spacing.xxl, lineHeight: 20,
    },
    note: {
      ...theme.typography.caption, fontSize: 11, color: theme.colors.textMuted,
      textAlign: 'center', lineHeight: 17,
      backgroundColor: theme.colors.inputBg,
      padding: theme.spacing.md, borderRadius: theme.borderRadius.md,
    },
  }), [insets.top, theme]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => nav.goBack()}>
          <Ionicons name="chevron-back" size={20} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Archive & Trash</Text>
        {tab === 'trash' && (entries?.length ?? 0) > 0 && (
          <TouchableOpacity style={styles.iconBtn} onPress={clearTrash}>
            <Ionicons name="trash-outline" size={18} color={theme.colors.error} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.tabs}>
        {([
          { key: 'archive' as Tab, label: 'Archive', icon: 'archive-outline' },
          { key: 'trash' as Tab, label: 'Trash', icon: 'trash-outline' },
        ]).map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, tab === t.key && styles.tabOn]}
            onPress={() => setTab(t.key)}
          >
            <Ionicons
              name={t.icon} size={15}
              color={tab === t.key ? theme.colors.primary : theme.colors.textMuted}
            />
            <Text style={[styles.tabText, tab === t.key && styles.tabTextOn]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {entries === null ? (
          <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 40 }} />
        ) : entries.length === 0 ? (
          <Text style={styles.empty}>
            {tab === 'archive'
              ? 'Nothing archived.\nArchived notes and tasks are hidden from your lists but kept.'
              : 'Trash is empty.'}
          </Text>
        ) : (
          <>
            {tab === 'trash' && (
              <Text style={styles.note}>
                Items in trash are deleted automatically after {TRASH_RETENTION_DAYS} days.
              </Text>
            )}
            {entries.map(entry => (
              <View key={`${entry.kind}-${entry.id}`} style={styles.row}>
                <View style={[
                  styles.thumb,
                  { backgroundColor: entry.color ?? theme.colors.inputBg },
                ]}>
                  {entry.backgroundUri ? (
                    <Image
                      source={{ uri: entry.backgroundUri }}
                      style={StyleSheet.absoluteFill}
                      resizeMode="cover"
                    />
                  ) : (
                    <Ionicons
                      name={entry.kind === 'note' ? 'document-text-outline' : 'checkmark-circle-outline'}
                      size={19}
                      color={theme.colors.textMuted}
                    />
                  )}
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.name} numberOfLines={1}>{entry.title}</Text>
                  <Text style={styles.meta} numberOfLines={1}>
                    {entry.kind === 'note' ? 'Note' : 'Task'}
                    {entry.preview ? ` · ${entry.preview}` : ''}
                  </Text>
                  {tab === 'trash' && (
                    <Text style={styles.meta}>
                      {daysUntilPurge(entry.trashedAt)} day
                      {daysUntilPurge(entry.trashedAt) === 1 ? '' : 's'} left
                    </Text>
                  )}
                </View>

                <TouchableOpacity
                  onPress={() => (tab === 'archive' ? unarchive(entry) : restore(entry))}
                  style={{ padding: 6 }}
                  accessibilityLabel="Restore"
                >
                  <Ionicons name="arrow-up-circle-outline" size={20} color={theme.colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => purge(entry)}
                  style={{ padding: 6 }}
                  accessibilityLabel="Delete forever"
                >
                  <Ionicons name="close-circle-outline" size={20} color={theme.colors.error} />
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}
