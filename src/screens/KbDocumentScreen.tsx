import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal,
  ActivityIndicator, Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';
import { useKnowledge } from '../context/KnowledgeContext';
import {
  generateStudyMaterial,
  STUDY_TOOL_LABELS,
  type StudyDifficulty,
  type StudyToolKind,
} from '../services/kbChatService';
import { findRelatedDocuments } from '../services/kbSearchService';
import { isScannedFailure, sourceTypeLabel } from '../services/kbExtractionService';
import type { KbDocument } from '../types/knowledge';

type Tab = 'summary' | 'text' | 'study';

const STUDY_TOOLS: { kind: StudyToolKind; icon: string }[] = [
  { kind: 'flashcards', icon: 'albums-outline' },
  { kind: 'mcq', icon: 'help-circle-outline' },
  { kind: 'short-answer', icon: 'create-outline' },
  { kind: 'revision-notes', icon: 'reader-outline' },
  { kind: 'cheat-sheet', icon: 'flash-outline' },
  { kind: 'key-concepts', icon: 'bulb-outline' },
];

export function KbDocumentScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const kbId: string = route.params?.kbId;
  const documentId: string = route.params?.documentId;
  const highlightChunkId: string | undefined = route.params?.highlightChunkId;

  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { settings } = useApp();
  const { getDocument, removeDocument, retryDocument, regenerateSummary } = useKnowledge();

  const doc = getDocument(documentId);

  const [tab, setTab] = useState<Tab>(highlightChunkId ? 'text' : 'summary');
  const [related, setRelated] = useState<{ document: KbDocument; score: number }[]>([]);
  const [studyBusy, setStudyBusy] = useState<StudyToolKind | null>(null);
  const [studyResult, setStudyResult] = useState<{ kind: StudyToolKind; content: string } | null>(null);
  const [difficulty, setDifficulty] = useState<StudyDifficulty>('medium');
  const [regenerating, setRegenerating] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    findRelatedDocuments(kbId, documentId, 4)
      .then(setRelated)
      .catch(() => setRelated([]));
  }, [kbId, documentId]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const handleStudyTool = useCallback(
    async (kind: StudyToolKind) => {
      if (studyBusy) return;
      setStudyBusy(kind);
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const { content, error } = await generateStudyMaterial(kbId, kind, {
          userApiKey: settings.geminiApiKey ?? null,
          documentIds: [documentId],
          difficulty,
          signal: controller.signal,
        });
        if (error) {
          Alert.alert("Couldn't generate", error);
        } else {
          setStudyResult({ kind, content });
        }
      } catch (err) {
        if ((err as any)?.name !== 'AbortError') {
          Alert.alert("Couldn't generate", 'Please try again.');
        }
      } finally {
        abortRef.current = null;
        setStudyBusy(null);
      }
    },
    [kbId, documentId, difficulty, settings.geminiApiKey, studyBusy],
  );

  const handleRegenerate = useCallback(async () => {
    setRegenerating(true);
    try {
      const ok = await regenerateSummary(documentId);
      if (!ok) Alert.alert("Couldn't regenerate", 'Please try again in a moment.');
    } finally {
      setRegenerating(false);
    }
  }, [documentId, regenerateSummary]);

  const handleDelete = () => {
    if (!doc) return;
    Alert.alert(`Remove "${doc.title}"?`, 'This also removes it from search and chat.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await removeDocument(documentId);
          navigation.goBack();
        },
      },
    ]);
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
    headerBody: { flex: 1 },
    headerTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.text },
    headerSub: { fontSize: 11, color: theme.colors.textMuted, marginTop: 1 },
    headerBtn: {
      width: 34, height: 34, borderRadius: 17,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: theme.colors.inputBg,
    },

    tabs: {
      flexDirection: 'row',
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.md,
      gap: 8,
    },
    tab: {
      flex: 1, paddingVertical: 9, borderRadius: theme.borderRadius.md,
      alignItems: 'center', backgroundColor: theme.colors.surface,
      borderWidth: 1, borderColor: theme.colors.border,
    },
    tabActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
    tabText: { fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary },
    tabTextActive: { color: '#FFF' },

    scroll: { flex: 1 },
    content: { padding: theme.spacing.lg, gap: theme.spacing.md, paddingBottom: 110 },

    askBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      paddingVertical: 14, borderRadius: theme.borderRadius.md,
      backgroundColor: theme.colors.primary,
    },
    askBtnText: { fontSize: 15, fontWeight: '700', color: '#FFF' },

    card: {
      backgroundColor: theme.colors.cardBg,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.lg,
      ...theme.shadows.card,
      gap: 8,
    },
    cardLabel: { ...theme.typography.overline, color: theme.colors.textMuted },
    cardText: { fontSize: 14, lineHeight: 21, color: theme.colors.text },
    bulletRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
    bulletDot: {
      width: 5, height: 5, borderRadius: 3,
      backgroundColor: theme.colors.primary, marginTop: 7,
    },
    bulletText: { flex: 1, fontSize: 14, lineHeight: 21, color: theme.colors.text },

    tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    tagPill: {
      paddingHorizontal: 10, paddingVertical: 5,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.primaryLight,
    },
    tagPillText: { fontSize: 11, fontWeight: '600', color: theme.colors.primaryDark },

    statusCard: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 10,
      backgroundColor: theme.colors.warningLight,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.md,
    },
    statusText: { flex: 1, fontSize: 13, lineHeight: 19, color: theme.colors.warning, fontWeight: '500' },
    inlineBtn: {
      alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingHorizontal: 12, paddingVertical: 7,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.primaryLight,
    },
    inlineBtnText: { fontSize: 12, fontWeight: '700', color: theme.colors.primaryDark },

    docText: {
      fontSize: 14, lineHeight: 22, color: theme.colors.text,
    },
    pageMarker: {
      ...theme.typography.overline,
      color: theme.colors.textMuted,
      marginTop: theme.spacing.md,
      marginBottom: 4,
    },

    relatedRow: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingVertical: theme.spacing.sm,
    },
    relatedTitle: { flex: 1, fontSize: 13, fontWeight: '600', color: theme.colors.text },
    relatedScore: { fontSize: 11, color: theme.colors.textMuted },

    toolGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    toolCard: {
      width: '47.5%',
      backgroundColor: theme.colors.cardBg,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.md,
      ...theme.shadows.card,
      gap: 7, alignItems: 'flex-start',
      minHeight: 84, justifyContent: 'center',
    },
    toolIcon: {
      width: 32, height: 32, borderRadius: 10,
      backgroundColor: theme.colors.primaryLight,
      alignItems: 'center', justifyContent: 'center',
    },
    toolLabel: { fontSize: 13, fontWeight: '700', color: theme.colors.text },

    diffRow: { flexDirection: 'row', gap: 8 },
    diffChip: {
      flex: 1, paddingVertical: 8, borderRadius: theme.borderRadius.sm,
      alignItems: 'center', backgroundColor: theme.colors.surface,
      borderWidth: 1, borderColor: theme.colors.border,
    },
    diffChipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
    diffText: { fontSize: 12, fontWeight: '600', color: theme.colors.textSecondary },
    diffTextActive: { color: '#FFF' },

    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: theme.borderRadius.xxl,
      borderTopRightRadius: theme.borderRadius.xxl,
      padding: theme.spacing.xl,
      paddingBottom: insets.bottom + theme.spacing.xl,
      maxHeight: '88%',
    },
    sheetTitle: { fontSize: 17, fontWeight: '700', color: theme.colors.text, marginBottom: 10 },
    closeBtn: {
      marginTop: 12, paddingVertical: 13,
      borderRadius: theme.borderRadius.md,
      backgroundColor: theme.colors.inputBg,
      alignItems: 'center',
    },
    closeBtnText: { fontSize: 15, fontWeight: '600', color: theme.colors.text },

    busyOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.35)',
      alignItems: 'center', justifyContent: 'center',
    },
    busyCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.xl,
      alignItems: 'center', gap: 12,
    },
    busyText: { fontSize: 14, fontWeight: '600', color: theme.colors.text },
  }), [theme, insets]);

  if (!doc) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Document not found</Text>
        </View>
      </View>
    );
  }

  const renderSummaryTab = () => (
    <>
      {doc.status === 'failed' || doc.status === 'partial' ? (
        <View style={styles.statusCard}>
          <Ionicons
            name={doc.status === 'failed' ? 'alert-circle' : 'warning'}
            size={18}
            color={theme.colors.warning}
          />
          <View style={{ flex: 1, gap: 8 }}>
            <Text style={styles.statusText}>
              {doc.errorMessage ?? 'This document needs attention.'}
            </Text>
            {/* A scan can never be re-extracted, so send the user to the OCR
                flow rather than a retry that is guaranteed to fail again. */}
            {isScannedFailure(doc) ? (
              <TouchableOpacity
                style={styles.inlineBtn}
                onPress={() => navigation.navigate('Scan')}
              >
                <Ionicons name="scan-outline" size={12} color={theme.colors.primaryDark} />
                <Text style={styles.inlineBtnText}>Scan with OCR</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.inlineBtn} onPress={() => retryDocument(doc.id)}>
                <Ionicons name="refresh" size={12} color={theme.colors.primaryDark} />
                <Text style={styles.inlineBtnText}>
                  {doc.status === 'partial' ? 'Finish indexing' : 'Retry'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      ) : null}

      <TouchableOpacity
        style={styles.askBtn}
        onPress={() => navigation.navigate('KbChat', { kbId, documentId })}
      >
        <Ionicons name="chatbubbles-outline" size={18} color="#FFF" />
        <Text style={styles.askBtnText}>Ask this document</Text>
      </TouchableOpacity>

      {doc.quickSummary ? (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>QUICK SUMMARY</Text>
          <Text style={styles.cardText}>{doc.quickSummary}</Text>
        </View>
      ) : null}

      {doc.standardSummary ? (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>STANDARD SUMMARY</Text>
          <Text style={styles.cardText}>{doc.standardSummary}</Text>
        </View>
      ) : null}

      {doc.keyPoints.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>KEY POINTS</Text>
          {doc.keyPoints.map((point, index) => (
            <View key={index} style={styles.bulletRow}>
              <View style={styles.bulletDot} />
              <Text style={styles.bulletText}>{point}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {doc.tags.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>TOPICS</Text>
          <View style={styles.tagRow}>
            {doc.tags.map((tag) => (
              <View key={tag} style={styles.tagPill}>
                <Text style={styles.tagPillText}>{tag}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {!doc.quickSummary && doc.status === 'ready' ? (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>NO SUMMARY YET</Text>
          <Text style={styles.cardText}>
            This document is searchable, but its summary hasn't been generated.
          </Text>
          <TouchableOpacity style={styles.inlineBtn} onPress={handleRegenerate}>
            <Ionicons name="sparkles-outline" size={12} color={theme.colors.primaryDark} />
            <Text style={styles.inlineBtnText}>Generate summary</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {related.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>RELATED DOCUMENTS</Text>
          {related.map(({ document, score }) => (
            <TouchableOpacity
              key={document.id}
              style={styles.relatedRow}
              onPress={() =>
                navigation.push('KbDocument', { kbId, documentId: document.id })
              }
            >
              <Ionicons name="link-outline" size={15} color={theme.colors.primary} />
              <Text style={styles.relatedTitle} numberOfLines={1}>{document.title}</Text>
              <Text style={styles.relatedScore}>{Math.round(score * 100)}%</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {doc.quickSummary ? (
        <TouchableOpacity style={styles.inlineBtn} onPress={handleRegenerate}>
          <Ionicons name="refresh" size={12} color={theme.colors.primaryDark} />
          <Text style={styles.inlineBtnText}>Regenerate summary</Text>
        </TouchableOpacity>
      ) : null}
    </>
  );

  const renderTextTab = () => {
    if (!doc.extractedText) {
      return (
        <View style={styles.card}>
          <Text style={styles.cardText}>No text was extracted from this document.</Text>
        </View>
      );
    }

    // Page breaks were encoded as form feeds during extraction.
    const pages = doc.extractedText.split('\f');
    return (
      <View style={styles.card}>
        {pages.map((page, index) => (
          <View key={index}>
            {pages.length > 1 ? (
              <Text style={styles.pageMarker}>PAGE {index + 1}</Text>
            ) : null}
            <Text style={styles.docText} selectable>{page.trim()}</Text>
          </View>
        ))}
      </View>
    );
  };

  const renderStudyTab = () => (
    <>
      <View style={styles.card}>
        <Text style={styles.cardLabel}>DIFFICULTY</Text>
        <View style={styles.diffRow}>
          {(['easy', 'medium', 'hard'] as StudyDifficulty[]).map((level) => (
            <TouchableOpacity
              key={level}
              style={[styles.diffChip, difficulty === level && styles.diffChipActive]}
              onPress={() => setDifficulty(level)}
            >
              <Text style={[styles.diffText, difficulty === level && styles.diffTextActive]}>
                {level[0].toUpperCase() + level.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.toolGrid}>
        {STUDY_TOOLS.map(({ kind, icon }) => (
          <TouchableOpacity
            key={kind}
            style={styles.toolCard}
            onPress={() => handleStudyTool(kind)}
            disabled={studyBusy !== null}
          >
            <View style={styles.toolIcon}>
              {studyBusy === kind ? (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              ) : (
                <Ionicons name={icon} size={17} color={theme.colors.primary} />
              )}
            </View>
            <Text style={styles.toolLabel}>{STUDY_TOOL_LABELS[kind]}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <View style={styles.headerBody}>
          <Text style={styles.headerTitle} numberOfLines={2}>{doc.title}</Text>
          <Text style={styles.headerSub}>
            {sourceTypeLabel(doc.sourceType)}
            {doc.pageCount > 0 ? ` · ${doc.pageCount} page${doc.pageCount === 1 ? '' : 's'}` : ''}
            {doc.chunkCount > 0 ? ` · ${doc.chunkCount} sections` : ''}
          </Text>
        </View>
        <TouchableOpacity style={styles.headerBtn} onPress={handleDelete}>
          <Ionicons name="trash-outline" size={17} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        {([['summary', 'Summary'], ['text', 'Full text'], ['study', 'Study']] as [Tab, string][]).map(
          ([value, label]) => (
            <TouchableOpacity
              key={value}
              style={[styles.tab, tab === value && styles.tabActive]}
              onPress={() => setTab(value)}
            >
              <Text style={[styles.tabText, tab === value && styles.tabTextActive]}>{label}</Text>
            </TouchableOpacity>
          ),
        )}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {tab === 'summary' ? renderSummaryTab() : null}
        {tab === 'text' ? renderTextTab() : null}
        {tab === 'study' ? renderStudyTab() : null}
      </ScrollView>

      {/* Study result */}
      <Modal
        visible={studyResult !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setStudyResult(null)}
      >
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>
              {studyResult ? STUDY_TOOL_LABELS[studyResult.kind] : ''}
            </Text>
            <ScrollView style={{ maxHeight: 460 }}>
              <Text style={styles.cardText} selectable>{studyResult?.content}</Text>
            </ScrollView>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setStudyResult(null)}>
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {regenerating ? (
        <View style={styles.busyOverlay}>
          <View style={styles.busyCard}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.busyText}>Generating summary…</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}
