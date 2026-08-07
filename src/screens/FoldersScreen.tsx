import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import { usePremium, type PremiumFeature } from '../services/premiumService';
import { PremiumGateSheet } from '../components/PremiumGateSheet';
import { NotebookCoverSheet } from '../components/NotebookCoverSheet';
import {
  canCreateNotebook,
  childFolders,
  DEFAULT_NOTEBOOKS,
  FREE_NOTEBOOK_LIMIT,
  noteCountFor,
  resolveCover,
  rootNotebooks,
} from '../core/notebooks';
import type { Folder } from '../types';

export function FoldersScreen() {
  const nav = useNavigation();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { folders, notes, filter, setFilter, addFolder, deleteFolder, updateFolder, isHydrated } = useApp();
  const { hasPremium } = usePremium();

  const [editing, setEditing] = useState<Folder | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [gateFeature, setGateFeature] = useState<PremiumFeature | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [nestingParent, setNestingParent] = useState<string | null>(null);
  const seeded = useRef(false);

  const books = useMemo(() => rootNotebooks(folders), [folders]);

  // Seed the starter shelf once, and only for a genuinely empty library — a
  // user who deleted every notebook on purpose shouldn't get them back.
  useEffect(() => {
    if (!isHydrated || seeded.current) return;
    seeded.current = true;
    if (folders.length > 0) return;
    DEFAULT_NOTEBOOKS.forEach(nb => addFolder(nb.name, null, nb.cover));
  }, [addFolder, folders.length, isHydrated]);

  const openNew = useCallback(() => {
    if (!canCreateNotebook(folders, hasPremium)) {
      setGateFeature('notebooks_unlimited');
      return;
    }
    setEditing(null);
    setNestingParent(null);
    setSheetOpen(true);
  }, [folders, hasPremium]);

  const openNested = useCallback((parentId: string) => {
    if (!hasPremium) {
      setGateFeature('notebooks_nested');
      return;
    }
    setEditing(null);
    setNestingParent(parentId);
    setSheetOpen(true);
  }, [hasPremium]);

  const handleSave = useCallback((values: { name: string; color: string; icon: string }) => {
    if (editing) {
      updateFolder(editing.id, { name: values.name, color: values.color, icon: values.icon });
    } else {
      addFolder(values.name, nestingParent, { color: values.color, icon: values.icon });
    }
    setSheetOpen(false);
    setEditing(null);
    setNestingParent(null);
  }, [addFolder, editing, nestingParent, updateFolder]);

  const handleDelete = useCallback((folder: Folder) => {
    const children = childFolders(folders, folder.id).length;
    const extra = children > 0 ? ` and ${children} folder${children > 1 ? 's' : ''} inside it` : '';
    Alert.alert(
      'Delete notebook',
      `Delete "${folder.name}"${extra}? Notes inside will move to All Notes.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteFolder(folder.id) },
      ],
    );
  }, [deleteFolder, folders]);

  const select = useCallback((folderId: string | null) => {
    setFilter({ folderId });
    nav.goBack();
  }, [nav, setFilter]);

  const toggleExpanded = useCallback((id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

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
    headerText: { flex: 1 },
    headerTitle: { ...theme.typography.title, fontSize: 26, color: theme.colors.text, fontWeight: '700' },
    headerSubtitle: { ...theme.typography.caption, color: theme.colors.textMuted, marginTop: 2 },
    addBtn: {
      width: 40, height: 40, borderRadius: 13,
      backgroundColor: theme.colors.primary,
      alignItems: 'center', justifyContent: 'center',
    },
    scroll: { padding: theme.spacing.lg, paddingBottom: 140, gap: theme.spacing.md },
    allRow: {
      flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md,
      backgroundColor: theme.colors.cardBg,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.md,
    },
    allIcon: {
      width: 42, height: 42, borderRadius: 12,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: theme.colors.primaryLight,
    },
    sectionTitle: {
      ...theme.typography.overline, color: theme.colors.textMuted,
      textTransform: 'uppercase', letterSpacing: 1,
      marginLeft: theme.spacing.xs,
    },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md },
    card: {
      width: '47%',
      backgroundColor: theme.colors.cardBg,
      borderRadius: theme.borderRadius.xl,
      padding: theme.spacing.md,
      gap: theme.spacing.sm,
      ...theme.shadows.card,
    },
    cardActive: { borderWidth: 2, borderColor: theme.colors.primary },
    cover: {
      height: 76, borderRadius: 12,
      alignItems: 'center', justifyContent: 'center',
    },
    cardName: { ...theme.typography.bodySmall, fontWeight: '700', color: theme.colors.text },
    cardMeta: { ...theme.typography.caption, fontSize: 11, color: theme.colors.textMuted },
    cardActions: { flexDirection: 'row', gap: theme.spacing.sm, marginTop: 2 },
    actionBtn: { padding: 4 },
    childRow: {
      flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm,
      paddingVertical: 6, paddingLeft: theme.spacing.sm,
    },
    childName: { ...theme.typography.caption, color: theme.colors.text, flex: 1 },
    limitNote: {
      ...theme.typography.caption, fontSize: 12, color: theme.colors.textMuted,
      textAlign: 'center', lineHeight: 18,
      backgroundColor: theme.colors.inputBg,
      padding: theme.spacing.md, borderRadius: theme.borderRadius.md,
    },
    proTag: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      alignSelf: 'flex-start',
      paddingHorizontal: 7, paddingVertical: 2,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.accent + '25',
    },
    proTagText: {
      ...theme.typography.caption, fontSize: 10, fontWeight: '800',
      color: theme.colors.accent, letterSpacing: 0.5,
    },
  }), [insets.top, theme]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Notebooks</Text>
          <Text style={styles.headerSubtitle}>
            {books.length} notebook{books.length === 1 ? '' : 's'}
          </Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={openNew} activeOpacity={0.8}>
          <Ionicons name="add" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.allRow} onPress={() => select(null)} activeOpacity={0.8}>
          <View style={styles.allIcon}>
            <Ionicons name="documents-outline" size={21} color={theme.colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardName}>All Notes</Text>
            <Text style={styles.cardMeta}>{notes.length} note{notes.length === 1 ? '' : 's'}</Text>
          </View>
          {!filter.folderId && (
            <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} />
          )}
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Notebooks</Text>

        <View style={styles.grid}>
          {books.map((book, i) => {
            const cover = resolveCover(book, i);
            const children = childFolders(folders, book.id);
            const count = noteCountFor(book.id, folders, notes);
            const isOpen = expanded.has(book.id);

            return (
              <View
                key={book.id}
                style={[styles.card, filter.folderId === book.id && styles.cardActive]}
              >
                <TouchableOpacity onPress={() => select(book.id)} activeOpacity={0.85}>
                  <View style={[styles.cover, { backgroundColor: cover.color }]}>
                    <Ionicons name={cover.icon} size={30} color="#FFF" />
                  </View>
                </TouchableOpacity>

                <View>
                  <Text style={styles.cardName} numberOfLines={1}>{book.name}</Text>
                  <Text style={styles.cardMeta}>
                    {count} note{count === 1 ? '' : 's'}
                    {children.length > 0 ? ` · ${children.length} folder${children.length > 1 ? 's' : ''}` : ''}
                  </Text>
                </View>

                {isOpen && children.map(child => (
                  <TouchableOpacity
                    key={child.id}
                    style={styles.childRow}
                    onPress={() => select(child.id)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="folder-outline" size={14} color={theme.colors.textMuted} />
                    <Text style={styles.childName} numberOfLines={1}>{child.name}</Text>
                  </TouchableOpacity>
                ))}

                <View style={styles.cardActions}>
                  {children.length > 0 && (
                    <TouchableOpacity style={styles.actionBtn} onPress={() => toggleExpanded(book.id)}>
                      <Ionicons
                        name={isOpen ? 'chevron-up' : 'chevron-down'}
                        size={16}
                        color={theme.colors.textMuted}
                      />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={styles.actionBtn} onPress={() => openNested(book.id)}>
                    <Ionicons
                      name={hasPremium ? 'folder-open-outline' : 'lock-closed-outline'}
                      size={16}
                      color={theme.colors.textMuted}
                    />
                  </TouchableOpacity>
                  <View style={{ flex: 1 }} />
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => { setEditing(book); setNestingParent(null); setSheetOpen(true); }}
                  >
                    <Ionicons name="create-outline" size={16} color={theme.colors.textMuted} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => handleDelete(book)}>
                    <Ionicons name="trash-outline" size={16} color={theme.colors.error} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>

        {!hasPremium && (
          <>
            <View style={styles.proTag}>
              <Ionicons name="diamond-outline" size={11} color={theme.colors.accent} />
              <Text style={styles.proTagText}>PRO</Text>
            </View>
            <Text style={styles.limitNote}>
              Free includes {FREE_NOTEBOOK_LIMIT} notebooks. Upgrade for unlimited
              notebooks and nested folders.
            </Text>
          </>
        )}
      </ScrollView>

      <NotebookCoverSheet
        visible={sheetOpen}
        initialName={editing?.name ?? ''}
        initialColor={editing?.color ?? null}
        initialIcon={editing?.icon ?? null}
        onSave={handleSave}
        onClose={() => { setSheetOpen(false); setEditing(null); setNestingParent(null); }}
      />
      <PremiumGateSheet
        visible={gateFeature !== null}
        feature={gateFeature ?? undefined}
        onClose={() => setGateFeature(null)}
      />
    </View>
  );
}
