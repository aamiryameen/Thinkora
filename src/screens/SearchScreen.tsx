import React, { useMemo, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, FlatList,
  TouchableOpacity, ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import type { RootStackParamList } from '../navigation/types';
import { stripHtml } from '../utils/stripHtml';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type ResultType = 'note' | 'task';
interface SearchResult {
  id: string;
  type: ResultType;
  title: string;
  preview: string;
  meta: string;
  color?: string | null;
}

export function SearchScreen() {
  const navigation = useNavigation<Nav>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { notes, tasks, getFolder } = useApp();
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'notes' | 'tasks'>('all');

  const results = useMemo<SearchResult[]>(() => {
    const q = query.toLowerCase().trim();
    if (!q) return [];
    const out: SearchResult[] = [];

    if (activeFilter !== 'tasks') {
      for (const n of notes) {
        if (n.title.toLowerCase().includes(q) || n.plainText.toLowerCase().includes(q)) {
          const folder = n.folderId ? getFolder(n.folderId) : null;
          out.push({
            id: n.id,
            type: 'note',
            title: n.title || 'Untitled',
            preview: n.plainText?.slice(0, 100) || '',
            meta: folder ? folder.name : new Date(n.updatedAt).toLocaleDateString(),
            color: n.color,
          });
        }
      }
    }

    if (activeFilter !== 'notes') {
      for (const t of tasks) {
        const plainNotes = stripHtml(t.notes || '');
        if (t.title.toLowerCase().includes(q) || plainNotes.toLowerCase().includes(q)) {
          out.push({
            id: t.id,
            type: 'task',
            title: t.title,
            preview: plainNotes.slice(0, 100),
            meta: t.dueDate ? new Date(t.dueDate).toLocaleDateString() : (t.completed ? 'Completed' : 'No due date'),
            color: null,
          });
        }
      }
    }

    return out.slice(0, 50);
  }, [query, notes, tasks, getFolder, activeFilter]);

  const handlePress = useCallback((item: SearchResult) => {
    if (item.type === 'note') {
      navigation.navigate('NoteEditor', { noteId: item.id });
    } else {
      navigation.navigate('TaskEditor', { taskId: item.id });
    }
  }, [navigation]);

  const highlightText = (text: string, q: string) => {
    if (!q.trim() || !text) return text;
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return text;
    return text; // just return plain text, highlighting via selection range is complex in RN
  };

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    header: {
      backgroundColor: theme.colors.surface,
      paddingTop: insets.top + theme.spacing.sm,
      paddingHorizontal: theme.spacing.lg,
      paddingBottom: theme.spacing.md,
      gap: theme.spacing.md,
    },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
    backBtn: { padding: 4 },
    searchBox: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.inputBg,
      borderRadius: theme.borderRadius.full,
      paddingHorizontal: theme.spacing.md,
      gap: theme.spacing.sm,
    },
    searchInput: {
      flex: 1,
      ...theme.typography.body,
      color: theme.colors.text,
      paddingVertical: theme.spacing.sm,
    },
    filterRow: { flexDirection: 'row', gap: theme.spacing.sm },
    filterChip: {
      paddingVertical: 6,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.inputBg,
      borderWidth: 1.5,
      borderColor: 'transparent',
    },
    filterChipActive: {
      backgroundColor: theme.colors.primaryLight,
      borderColor: theme.colors.primary,
    },
    filterChipText: { ...theme.typography.caption, color: theme.colors.textSecondary, fontWeight: '600' },
    filterChipTextActive: { color: theme.colors.primary },
    list: { padding: theme.spacing.lg, paddingBottom: 100 },
    resultCard: {
      backgroundColor: theme.colors.cardBg,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.sm,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: theme.spacing.md,
      ...theme.shadows.card,
    },
    resultIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    resultContent: { flex: 1 },
    resultTitle: { ...theme.typography.body, color: theme.colors.text, fontWeight: '600' },
    resultPreview: { ...theme.typography.bodySmall, color: theme.colors.textSecondary, marginTop: 2 },
    resultMeta: { ...theme.typography.caption, color: theme.colors.textMuted, marginTop: 4 },
    typeTag: {
      alignSelf: 'flex-start',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
      marginTop: 4,
    },
    typeTagText: { fontSize: 10, fontWeight: '700' },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: theme.spacing.md },
    emptyIcon: { opacity: 0.3 },
    emptyText: { ...theme.typography.body, color: theme.colors.textMuted, textAlign: 'center' },
    emptyHint: { ...theme.typography.caption, color: theme.colors.textDisabled, textAlign: 'center' },
  }), [theme, insets]);

  const renderItem = useCallback(({ item }: { item: SearchResult }) => {
    const isNote = item.type === 'note';
    const iconBg = isNote ? theme.colors.primaryLight : theme.colors.accentLight ?? '#FEF3C7';
    const iconColor = isNote ? theme.colors.primary : theme.colors.accent ?? '#F59E0B';
    return (
      <TouchableOpacity style={[styles.resultCard, item.color ? { backgroundColor: item.color } : null]} onPress={() => handlePress(item)} activeOpacity={0.75}>
        <View style={[styles.resultIconWrap, { backgroundColor: iconBg }]}>
          <Ionicons name={isNote ? 'document-text-outline' : 'checkbox-outline'} size={18} color={iconColor} />
        </View>
        <View style={styles.resultContent}>
          <Text style={[styles.resultTitle, item.color ? { color: '#1a1a2e' } : null]} numberOfLines={1}>{item.title}</Text>
          {item.preview ? (
            <Text style={[styles.resultPreview, item.color ? { color: '#444' } : null]} numberOfLines={2}>{item.preview}</Text>
          ) : null}
          <Text style={[styles.resultMeta, item.color ? { color: '#666' } : null]}>{item.meta}</Text>
        </View>
      </TouchableOpacity>
    );
  }, [styles, handlePress, theme]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={18} color={theme.colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Search notes and tasks..."
              placeholderTextColor={theme.colors.textMuted}
              autoFocus
              returnKeyType="search"
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')}>
                <Ionicons name="close-circle" size={18} color={theme.colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        </View>
        <View style={styles.filterRow}>
          {(['all', 'notes', 'tasks'] as const).map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.filterChip, activeFilter === f && styles.filterChipActive]}
              onPress={() => setActiveFilter(f)}
            >
              <Text style={[styles.filterChipText, activeFilter === f && styles.filterChipTextActive]}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {query.trim() === '' ? (
        <View style={styles.empty}>
          <Ionicons name="search-outline" size={64} color={theme.colors.textDisabled} style={styles.emptyIcon} />
          <Text style={styles.emptyText}>Search everything</Text>
          <Text style={styles.emptyHint}>Notes, tasks, and content</Text>
        </View>
      ) : results.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="file-tray-outline" size={64} color={theme.colors.textDisabled} style={styles.emptyIcon} />
          <Text style={styles.emptyText}>No results for "{query}"</Text>
          <Text style={styles.emptyHint}>Try different keywords</Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => `${item.type}-${item.id}`}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <Text style={{ ...theme.typography.caption, color: theme.colors.textMuted, marginBottom: theme.spacing.sm }}>
              {results.length} result{results.length !== 1 ? 's' : ''}
            </Text>
          }
        />
      )}
    </View>
  );
}
