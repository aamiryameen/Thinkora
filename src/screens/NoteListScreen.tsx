import React, { useState, useCallback, useMemo } from 'react';
import { AdBanner } from '../components/AdBanner';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Icon } from '../components/Icons';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import type { RootStackParamList } from '../navigation/types';
import type { Note } from '../types';
import type { SortField, SortOrder } from '../types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type StackNav = NativeStackNavigationProp<RootStackParamList>;

export function NoteListScreen() {
  const navigation = useNavigation();
  const stackNav = navigation.getParent() as StackNav | undefined;
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const {
    filteredNotes,
    filter,
    setFilter,
    setSort,
    toggleFavorite,
    togglePin,
    getFolder,
    getTag,
  } = useApp();
  const [searchFocused, setSearchFocused] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: theme.colors.background },
        header: {
          paddingHorizontal: theme.spacing.lg,
          paddingTop: insets.top + theme.spacing.md,
          paddingBottom: theme.spacing.sm,
          backgroundColor: theme.colors.surface,
        },
        headerTitle: {
          ...theme.typography.title,
          fontSize: 28,
          color: theme.colors.text,
          letterSpacing: -0.5,
        },
        headerSubtitle: {
          ...theme.typography.caption,
          color: theme.colors.textMuted,
          marginTop: theme.spacing.xxs,
        },
        searchRow: {
          flexDirection: 'row',
          paddingHorizontal: theme.spacing.lg,
          paddingTop: theme.spacing.md,
          paddingBottom: theme.spacing.sm,
          gap: theme.spacing.sm,
        },
        searchBox: {
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: theme.colors.surface,
          borderRadius: theme.borderRadius.lg,
          paddingHorizontal: theme.spacing.md,
          borderWidth: 2,
          borderColor: theme.colors.border,
          ...theme.shadows.input,
        },
        searchBoxFocused: {
          borderColor: theme.colors.borderFocus,
          backgroundColor: theme.colors.surface,
        },
        searchInput: {
          flex: 1,
          paddingVertical: 12,
          paddingLeft: theme.spacing.sm,
          ...theme.typography.body,
          color: theme.colors.text,
        },
        sortBtn: {
          width: 48,
          height: 48,
          borderRadius: theme.borderRadius.md,
          backgroundColor: theme.colors.surface,
          alignItems: 'center',
          justifyContent: 'center',
          ...theme.shadows.input,
        },
        sortMenu: {
          backgroundColor: theme.colors.surface,
          marginHorizontal: theme.spacing.lg,
          borderRadius: theme.borderRadius.lg,
          padding: theme.spacing.xs,
          marginBottom: theme.spacing.sm,
          ...theme.shadows.card,
        },
        sortOption: {
          paddingVertical: theme.spacing.md,
          paddingHorizontal: theme.spacing.lg,
          borderRadius: theme.borderRadius.md,
        },
        sortOptionText: { ...theme.typography.body, color: theme.colors.text },
        filterScroll: { maxHeight: 52, marginBottom: theme.spacing.sm },
        filterRow: {
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.xs,
          gap: theme.spacing.sm,
          flexDirection: 'row',
          alignItems: 'center',
        },
        filterChip: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 8,
          paddingHorizontal: theme.spacing.lg,
          borderRadius: theme.borderRadius.full,
          backgroundColor: theme.colors.surface,
          gap: theme.spacing.xs,
          borderWidth: 2,
          borderColor: 'transparent',
          ...theme.shadows.input,
        },
        filterChipOn: {
          backgroundColor: theme.colors.primaryLight,
          borderColor: theme.colors.primary,
        },
        filterChipText: { ...theme.typography.caption, color: theme.colors.textSecondary, fontWeight: '500' },
        filterChipTextOn: { color: theme.colors.primaryDark, fontWeight: '600' },
        list: { padding: theme.spacing.lg, paddingBottom: 100 },
        noteCard: {
          backgroundColor: theme.colors.cardBg,
          borderRadius: theme.borderRadius.lg,
          padding: theme.spacing.lg,
          marginBottom: theme.spacing.md,
          borderLeftWidth: 4,
          borderLeftColor: 'transparent',
          ...theme.shadows.card,
        },
        noteCardPinned: { borderLeftColor: theme.colors.primary },
        noteHeader: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        },
        noteTitle: {
          ...theme.typography.titleSmall,
          flex: 1,
          color: theme.colors.text,
        },
        noteBadges: { flexDirection: 'row', gap: theme.spacing.xs },
        notePreview: {
          ...theme.typography.bodySmall,
          color: theme.colors.textSecondary,
          marginTop: theme.spacing.xs,
          lineHeight: 20,
        },
        noteMeta: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          marginTop: theme.spacing.sm,
          gap: theme.spacing.sm,
        },
        metaText: { ...theme.typography.caption, color: theme.colors.textMuted },
        metaDate: {
          ...theme.typography.caption,
          color: theme.colors.textMuted,
          marginLeft: 'auto',
        },
        empty: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 48,
          paddingHorizontal: theme.spacing.xxl,
        },
        emptyIconWrap: {
          width: 88,
          height: 88,
          borderRadius: 44,
          backgroundColor: theme.colors.primaryLight,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: theme.spacing.xl,
        },
        emptyTitle: {
          ...theme.typography.title,
          color: theme.colors.text,
          marginBottom: theme.spacing.xs,
          textAlign: 'center',
        },
        emptyText: {
          ...theme.typography.body,
          color: theme.colors.textMuted,
          marginBottom: theme.spacing.xl,
          textAlign: 'center',
          lineHeight: 22,
        },
        emptyBtn: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          paddingVertical: 14,
          paddingHorizontal: theme.spacing.xxl,
          backgroundColor: theme.colors.primary,
          borderRadius: theme.borderRadius.lg,
          ...theme.shadows.card,
        },
        emptyBtnText: { ...theme.typography.button, color: theme.colors.surface },
        fab: {
          position: 'absolute',
          right: theme.spacing.xl,
          bottom: theme.spacing.xxl + 24,
          width: 58,
          height: 58,
          borderRadius: 29,
          backgroundColor: theme.colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
          ...theme.shadows.fab,
        },
      }),
    [theme, insets.top]
  );

  const openNote = useCallback(
    (note: Note) => {
      stackNav?.navigate('NoteEditor', { noteId: note.id });
    },
    [stackNav]
  );

  const openNewNote = useCallback(() => {
    stackNav?.navigate('NoteEditor', {});
  }, [stackNav]);

  const renderNote = useCallback(
    ({ item }: { item: Note }) => {
      const folder = item.folderId ? getFolder(item.folderId) : null;
      const tagNames = item.tagIds.map((tid) => getTag(tid)?.name).filter(Boolean);
      return (
        <TouchableOpacity
          style={[styles.noteCard, item.isPinned && styles.noteCardPinned]}
          onPress={() => openNote(item)}
          onLongPress={() =>
            Alert.alert('Note', undefined, [
              { text: 'Cancel', style: 'cancel' },
              {
                text: item.isFavorite ? 'Unfavorite' : 'Favorite',
                onPress: () => toggleFavorite(item.id),
              },
              {
                text: item.isPinned ? 'Unpin' : 'Pin',
                onPress: () => togglePin(item.id),
              },
            ])
          }
          activeOpacity={0.8}
        >
          <View style={styles.noteHeader}>
            <Text style={styles.noteTitle} numberOfLines={1}>
              {item.title || 'Untitled'}
            </Text>
            <View style={styles.noteBadges}>
              {item.isPinned && <Icon name="pin" size={14} />}
              {item.isFavorite && <Icon name="star" size={14} />}
            </View>
          </View>
          <Text style={styles.notePreview} numberOfLines={2}>
            {item.plainText || 'No content'}
          </Text>
          <View style={styles.noteMeta}>
            {folder && <Text style={styles.metaText}>{folder.name}</Text>}
            {tagNames.length > 0 && (
              <Text style={styles.metaText}>{tagNames.join(', ')}</Text>
            )}
            <Text style={styles.metaDate}>
              {new Date(item.updatedAt).toLocaleDateString()}
            </Text>
          </View>
        </TouchableOpacity>
      );
    },
    [getFolder, getTag, openNote, styles, toggleFavorite, togglePin]
  );

  const categoryLabels: Record<string, string> = {
    work: 'Work',
    personal: 'Personal',
    ideas: 'Ideas',
    todos: 'To-Dos',
  };

  const sortOptions: { label: string; field: SortField; order: SortOrder }[] = [
    { label: 'Newest first', field: 'updatedAt', order: 'desc' },
    { label: 'Oldest first', field: 'updatedAt', order: 'asc' },
    { label: 'Title A–Z', field: 'title', order: 'asc' },
    { label: 'Title Z–A', field: 'title', order: 'desc' },
    { label: 'Created (newest)', field: 'createdAt', order: 'desc' },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notes</Text>
        <Text style={styles.headerSubtitle}>
          {filteredNotes.length} {filteredNotes.length === 1 ? 'note' : 'notes'}
        </Text>
      </View>
      <View style={styles.searchRow}>
        <View style={[styles.searchBox, searchFocused && styles.searchBoxFocused]}>
          <Icon name="search" size={20} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search notes, tags..."
            value={filter.searchQuery}
            onChangeText={(q) => setFilter({ searchQuery: q })}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholderTextColor={theme.colors.textDisabled}
          />
        </View>
        <TouchableOpacity
          style={styles.sortBtn}
          onPress={() => setShowSortMenu(!showSortMenu)}
        >
          <Icon name="sort" size={22} />
        </TouchableOpacity>
      </View>

      {showSortMenu && (
        <View style={styles.sortMenu}>
          {sortOptions.map((opt) => (
            <TouchableOpacity
              key={opt.label}
              style={styles.sortOption}
              onPress={() => {
                setSort(opt.field, opt.order);
                setShowSortMenu(false);
              }}
            >
              <Text style={styles.sortOptionText}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterRow}
      >
        <TouchableOpacity
          style={[styles.filterChip, filter.favoritesOnly && styles.filterChipOn]}
          onPress={() => setFilter({ favoritesOnly: !filter.favoritesOnly })}
        >
          <Icon name="star" size={16} />
          <Text style={[styles.filterChipText, filter.favoritesOnly && styles.filterChipTextOn]}>Favorites</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, filter.pinnedOnly && styles.filterChipOn]}
          onPress={() => setFilter({ pinnedOnly: !filter.pinnedOnly })}
        >
          <Icon name="pin" size={16} />
          <Text style={[styles.filterChipText, filter.pinnedOnly && styles.filterChipTextOn]}>Pinned</Text>
        </TouchableOpacity>
        {(['work', 'personal', 'ideas', 'todos'] as const).map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[styles.filterChip, filter.category === cat && styles.filterChipOn]}
            onPress={() =>
              setFilter({ category: filter.category === cat ? null : cat })
            }
          >
            <Text style={[styles.filterChipText, filter.category === cat && styles.filterChipTextOn]}>{categoryLabels[cat]}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={filteredNotes}
        keyExtractor={(item) => item.id}
        renderItem={renderNote}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIconWrap}>
              <Icon name="draw" size={40} color={theme.colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>No notes yet</Text>
            <Text style={styles.emptyText}>
              Tap the button below to create your first note.
            </Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={openNewNote} activeOpacity={0.85}>
              <Icon name="add" size={22} color={theme.colors.surface} />
              <Text style={styles.emptyBtnText}>New note</Text>
            </TouchableOpacity>
          </View>
        }
      />

      <AdBanner />

      <TouchableOpacity style={styles.fab} onPress={openNewNote} activeOpacity={0.9}>
        <Icon name="add" size={30} color={theme.colors.surface} />
      </TouchableOpacity>
    </View>
  );
}
