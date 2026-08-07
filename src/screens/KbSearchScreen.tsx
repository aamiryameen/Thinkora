import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';
import { useKnowledge } from '../context/KnowledgeContext';
import { searchKnowledgeBase } from '../services/kbSearchService';
import type { KbSearchHit } from '../types/knowledge';

const EXAMPLE_QUERIES = [
  'Where did I write about authentication?',
  'Everything about performance',
  'Which document explains caching?',
  'Notes related to pricing',
];

export function KbSearchScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const kbId: string = route.params?.kbId;

  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { settings } = useApp();
  const { getKnowledgeBase, documentsFor } = useKnowledge();

  const kb = getKnowledgeBase(kbId);
  const documents = documentsFor(kbId);

  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<KbSearchHit[] | null>(null);
  const [mode, setMode] = useState<'semantic' | 'keyword'>('semantic');
  const [notice, setNotice] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setSearching(true);
      setNotice(null);
      try {
        const outcome = await searchKnowledgeBase(kbId, trimmed, {
          topK: 20,
          userApiKey: settings.geminiApiKey ?? null,
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        setHits(outcome.hits);
        setMode(outcome.mode);
        setNotice(outcome.fallbackReason);
      } catch (err) {
        if ((err as any)?.name !== 'AbortError') {
          setHits([]);
          setNotice('Search failed. Please try again.');
        }
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    },
    [kbId, settings.geminiApiKey],
  );

  const submit = () => {
    setQuery(query);
    run(query);
  };

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    header: {
      flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      paddingTop: insets.top + theme.spacing.md,
      paddingBottom: theme.spacing.md,
      backgroundColor: theme.colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    searchWrap: {
      flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: theme.colors.inputBg,
      borderRadius: theme.borderRadius.md,
      paddingHorizontal: theme.spacing.md,
    },
    input: {
      flex: 1, paddingVertical: 10,
      fontSize: 14, color: theme.colors.text,
    },
    scroll: { flex: 1 },
    content: { padding: theme.spacing.lg, gap: theme.spacing.md, paddingBottom: 110 },

    modeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    modeText: { fontSize: 12, color: theme.colors.textMuted },
    modeBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      paddingHorizontal: 9, paddingVertical: 4,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.primaryLight,
    },
    modeBadgeText: { fontSize: 11, fontWeight: '700', color: theme.colors.primaryDark },

    notice: {
      flexDirection: 'row', alignItems: 'center', gap: 7,
      backgroundColor: theme.colors.warningLight,
      borderRadius: theme.borderRadius.sm,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
    },
    noticeText: { flex: 1, fontSize: 12, color: theme.colors.warning, fontWeight: '600' },

    hitCard: {
      backgroundColor: theme.colors.cardBg,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.md,
      ...theme.shadows.card,
      gap: 6,
    },
    hitHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    hitTitle: { flex: 1, fontSize: 13, fontWeight: '700', color: theme.colors.text },
    hitScore: {
      fontSize: 10, fontWeight: '700', color: theme.colors.primaryDark,
      backgroundColor: theme.colors.primaryLight,
      paddingHorizontal: 7, paddingVertical: 3,
      borderRadius: theme.borderRadius.xxs,
      overflow: 'hidden',
    },
    hitMeta: { fontSize: 11, color: theme.colors.textMuted },
    hitText: { fontSize: 13, lineHeight: 20, color: theme.colors.textSecondary },

    empty: { alignItems: 'center', paddingTop: 44, gap: 9 },
    emptyIcon: {
      width: 66, height: 66, borderRadius: 33,
      backgroundColor: theme.colors.primaryLight,
      alignItems: 'center', justifyContent: 'center', marginBottom: 3,
    },
    emptyTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.text },
    emptyText: {
      fontSize: 13, color: theme.colors.textMuted, textAlign: 'center',
      lineHeight: 19, paddingHorizontal: 22,
    },
    exampleWrap: { width: '100%', gap: 8, marginTop: theme.spacing.md },
    example: {
      flexDirection: 'row', alignItems: 'center', gap: 9,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1, borderColor: theme.colors.border,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.md,
    },
    exampleText: { flex: 1, fontSize: 13, color: theme.colors.text, fontWeight: '500' },

    askBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      paddingVertical: 13, borderRadius: theme.borderRadius.md,
      backgroundColor: theme.colors.primary,
    },
    askBtnText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  }), [theme, insets]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={17} color={theme.colors.textMuted} />
          <TextInput
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={submit}
            placeholder={`Search ${kb?.name ?? 'documents'}`}
            placeholderTextColor={theme.colors.textMuted}
            returnKeyType="search"
            autoFocus
          />
          {query.length > 0 ? (
            <TouchableOpacity onPress={() => { setQuery(''); setHits(null); setNotice(null); }}>
              <Ionicons name="close-circle" size={17} color={theme.colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {searching ? (
          <ActivityIndicator style={{ marginTop: 30 }} color={theme.colors.primary} />
        ) : hits === null ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="search-outline" size={29} color={theme.colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>Search by meaning</Text>
            <Text style={styles.emptyText}>
              Ask in your own words — you don't need the exact keywords used in the document.
            </Text>
            {documents.length > 0 ? (
              <View style={styles.exampleWrap}>
                {EXAMPLE_QUERIES.map((example) => (
                  <TouchableOpacity
                    key={example}
                    style={styles.example}
                    onPress={() => { setQuery(example); run(example); }}
                  >
                    <Ionicons name="sparkles-outline" size={16} color={theme.colors.primary} />
                    <Text style={styles.exampleText}>{example}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <Text style={styles.emptyText}>Add a document first.</Text>
            )}
          </View>
        ) : (
          <>
            {notice ? (
              <View style={styles.notice}>
                <Ionicons name="cloud-offline-outline" size={15} color={theme.colors.warning} />
                <Text style={styles.noticeText}>{notice}</Text>
              </View>
            ) : null}

            <View style={styles.modeRow}>
              <Text style={styles.modeText}>
                {hits.length} result{hits.length === 1 ? '' : 's'}
              </Text>
              <View style={styles.modeBadge}>
                <Ionicons
                  name={mode === 'semantic' ? 'sparkles' : 'text'}
                  size={10}
                  color={theme.colors.primaryDark}
                />
                <Text style={styles.modeBadgeText}>
                  {mode === 'semantic' ? 'AI search' : 'Keyword'}
                </Text>
              </View>
            </View>

            {hits.length > 0 ? (
              <TouchableOpacity
                style={styles.askBtn}
                onPress={() => navigation.navigate('KbChat', { kbId })}
              >
                <Ionicons name="chatbubbles-outline" size={16} color="#FFF" />
                <Text style={styles.askBtnText}>Ask AI this question instead</Text>
              </TouchableOpacity>
            ) : null}

            {hits.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>No matches</Text>
                <Text style={styles.emptyText}>
                  Try rephrasing, or ask the AI — it can combine information across documents.
                </Text>
              </View>
            ) : (
              hits.map((hit) => (
                <TouchableOpacity
                  key={hit.chunk.id}
                  style={styles.hitCard}
                  onPress={() =>
                    navigation.navigate('KbDocument', {
                      kbId,
                      documentId: hit.document.id,
                      highlightChunkId: hit.chunk.id,
                    })
                  }
                >
                  <View style={styles.hitHeader}>
                    <Text style={styles.hitTitle} numberOfLines={1}>
                      {hit.document.title}
                    </Text>
                    <Text style={styles.hitScore}>{Math.round(hit.score * 100)}%</Text>
                  </View>
                  {hit.chunk.heading || hit.chunk.page ? (
                    <Text style={styles.hitMeta}>
                      {[
                        hit.chunk.heading,
                        hit.chunk.page ? `page ${hit.chunk.page}` : null,
                      ].filter(Boolean).join(' · ')}
                    </Text>
                  ) : null}
                  <Text style={styles.hitText} numberOfLines={4}>
                    {hit.chunk.text}
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
