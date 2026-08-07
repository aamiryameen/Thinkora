import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Modal,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';
import { useKnowledge } from '../context/KnowledgeContext';
import {
  askKnowledgeBase,
  clearMessages,
  deleteMessage,
  loadMessages,
  retryLastAnswer,
  suggestQuestions,
} from '../services/kbChatService';
import { KB_EXPLAIN_LABELS } from '../types/knowledge';
import type { KbCitation, KbExplainMode, KbMessage } from '../types/knowledge';

export function KbChatScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const kbId: string = route.params?.kbId;
  /** Optional: scope the conversation to one document. */
  const documentId: string | undefined = route.params?.documentId;

  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { settings } = useApp();
  const { getKnowledgeBase, documentsFor, getDocument } = useKnowledge();

  const kb = getKnowledgeBase(kbId);
  const documents = documentsFor(kbId);
  const scopedDoc = documentId ? getDocument(documentId) : undefined;

  const [messages, setMessages] = useState<KbMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [explainMode, setExplainMode] = useState<KbExplainMode | null>(null);
  const [showExplainSheet, setShowExplainSheet] = useState(false);
  const [activeCitation, setActiveCitation] = useState<KbCitation | null>(null);
  const [loading, setLoading] = useState(true);

  const scrollRef = useRef<ScrollView | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const readyDocs = documents.filter(
    (d) => d.status === 'ready' || d.status === 'partial',
  );
  const hasIndexedContent = scopedDoc
    ? scopedDoc.status === 'ready' || scopedDoc.status === 'partial'
    : readyDocs.length > 0;

  const suggestions = useMemo(
    () => suggestQuestions(
      (scopedDoc ? [scopedDoc] : readyDocs).map((d) => ({ title: d.title, tags: d.tags })),
    ),
    [scopedDoc, readyDocs],
  );

  // ─── Load history ─────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    loadMessages(kbId)
      .then((loaded) => { if (!cancelled) setMessages(loaded); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [kbId]);

  useEffect(() => {
    // Cancel any in-flight request if the screen unmounts.
    return () => abortRef.current?.abort();
  }, []);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }, []);

  useEffect(() => {
    if (messages.length) scrollToEnd();
  }, [messages.length, scrollToEnd]);

  // ─── Send ─────────────────────────────────────────────────────────────────

  const send = useCallback(
    async (question: string) => {
      const trimmed = question.trim();
      if (!trimmed || sending) return;

      if (!hasIndexedContent) {
        Alert.alert(
          'Nothing to search yet',
          'Add at least one document before asking questions.',
        );
        return;
      }

      setInput('');
      setSending(true);
      setNotice(null);

      // Show the user's turn immediately; the service persists it too.
      const optimistic: KbMessage = {
        id: `pending-${Date.now()}`,
        kbId,
        role: 'user',
        content: trimmed,
        citations: [],
        error: null,
        createdAt: Date.now(),
      };
      setMessages((prev) => [...prev, optimistic]);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const outcome = await askKnowledgeBase(kbId, trimmed, {
          userApiKey: settings.geminiApiKey ?? null,
          explainMode: explainMode ?? undefined,
          documentIds: documentId ? [documentId] : undefined,
          signal: controller.signal,
        });

        // Replace the optimistic turn with what was actually persisted.
        setMessages(await loadMessages(kbId));
        setNotice(outcome.notice);
      } catch (err) {
        if ((err as any)?.name === 'AbortError') {
          setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
        } else {
          setMessages(await loadMessages(kbId));
        }
      } finally {
        abortRef.current = null;
        setSending(false);
      }
    },
    [kbId, sending, hasIndexedContent, settings.geminiApiKey, explainMode, documentId],
  );

  const handleRetry = useCallback(async () => {
    if (sending) return;
    setSending(true);
    setNotice(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await retryLastAnswer(kbId, {
        userApiKey: settings.geminiApiKey ?? null,
        explainMode: explainMode ?? undefined,
        documentIds: documentId ? [documentId] : undefined,
        signal: controller.signal,
      });
      setMessages(await loadMessages(kbId));
    } catch {
      setMessages(await loadMessages(kbId));
    } finally {
      abortRef.current = null;
      setSending(false);
    }
  }, [kbId, sending, settings.geminiApiKey, explainMode, documentId]);

  /**
   * Removes a failed turn and the question that produced it, so a stale error
   * doesn't sit in the transcript forever. The paired user message is only
   * dropped when it directly precedes this failure.
   */
  const handleDismissError = useCallback(
    async (message: KbMessage) => {
      const index = messages.findIndex((m) => m.id === message.id);
      const previous = index > 0 ? messages[index - 1] : null;

      await deleteMessage(message.id);
      if (previous?.role === 'user') {
        await deleteMessage(previous.id);
      }
      setMessages(await loadMessages(kbId));
    },
    [messages, kbId],
  );

  const handleClear = () => {
    if (messages.length === 0) return;
    Alert.alert('Clear conversation?', 'This deletes the chat history for this knowledge base.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          await clearMessages(kbId);
          setMessages([]);
          setNotice(null);
        },
      },
    ]);
  };

  const openCitation = (citation: KbCitation) => setActiveCitation(citation);

  const jumpToDocument = (citation: KbCitation) => {
    setActiveCitation(null);
    navigation.navigate('KbDocument', {
      kbId,
      documentId: citation.documentId,
      highlightChunkId: citation.chunkId,
    });
  };

  // ─── Styles ───────────────────────────────────────────────────────────────

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
    headerTitle: { fontSize: 17, fontWeight: '700', color: theme.colors.text },
    headerSub: { fontSize: 11, color: theme.colors.textMuted, marginTop: 1 },
    headerBtn: {
      width: 34, height: 34, borderRadius: 17,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: theme.colors.inputBg,
    },

    scroll: { flex: 1 },
    content: {
      padding: theme.spacing.lg,
      gap: theme.spacing.md,
      paddingBottom: theme.spacing.lg,
    },

    notice: {
      flexDirection: 'row', alignItems: 'center', gap: 7,
      backgroundColor: theme.colors.warningLight,
      borderRadius: theme.borderRadius.sm,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
    },
    noticeText: { flex: 1, fontSize: 12, color: theme.colors.warning, fontWeight: '600' },

    bubbleUser: {
      alignSelf: 'flex-end', maxWidth: '88%',
      backgroundColor: theme.colors.primary,
      borderRadius: theme.borderRadius.lg,
      borderBottomRightRadius: theme.borderRadius.xxs,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm + 2,
    },
    bubbleUserText: { fontSize: 14, color: '#FFF', lineHeight: 20 },

    bubbleAi: {
      alignSelf: 'flex-start', maxWidth: '95%',
      backgroundColor: theme.colors.cardBg,
      borderRadius: theme.borderRadius.lg,
      borderBottomLeftRadius: theme.borderRadius.xxs,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm + 2,
      ...theme.shadows.card,
      gap: 8,
    },
    bubbleAiText: { fontSize: 14, color: theme.colors.text, lineHeight: 21 },
    errorText: { fontSize: 13, color: theme.colors.error, lineHeight: 19 },

    citationHeader: {
      ...theme.typography.overline,
      color: theme.colors.textMuted,
      marginTop: 2,
    },
    citationRow: {
      flexDirection: 'row', alignItems: 'center', gap: 7,
      paddingVertical: 6, paddingHorizontal: 9,
      borderRadius: theme.borderRadius.sm,
      backgroundColor: theme.colors.surfaceMuted,
    },
    citationIndex: {
      width: 18, height: 18, borderRadius: 9,
      backgroundColor: theme.colors.primary,
      alignItems: 'center', justifyContent: 'center',
    },
    citationIndexText: { fontSize: 10, fontWeight: '700', color: '#FFF' },
    citationBody: { flex: 1 },
    citationTitle: { fontSize: 12, fontWeight: '600', color: theme.colors.text },
    citationMeta: { fontSize: 10, color: theme.colors.textMuted, marginTop: 1 },

    retryRow: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      alignSelf: 'flex-start',
      paddingHorizontal: 11, paddingVertical: 6,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.primaryLight,
    },
    retryText: { fontSize: 12, fontWeight: '700', color: theme.colors.primaryDark },
    errorActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
    dismissRow: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      paddingHorizontal: 11, paddingVertical: 6,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.surfaceMuted,
    },
    dismissText: { fontSize: 12, fontWeight: '600', color: theme.colors.textMuted },

    thinkingRow: {
      flexDirection: 'row', alignItems: 'center', gap: 9,
      alignSelf: 'flex-start',
      backgroundColor: theme.colors.cardBg,
      borderRadius: theme.borderRadius.lg,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.md,
      ...theme.shadows.card,
    },
    thinkingText: { fontSize: 13, color: theme.colors.textSecondary, fontWeight: '500' },

    // Empty state
    empty: { alignItems: 'center', paddingTop: 36, gap: 9 },
    emptyIcon: {
      width: 66, height: 66, borderRadius: 33,
      backgroundColor: theme.colors.primaryLight,
      alignItems: 'center', justifyContent: 'center', marginBottom: 3,
    },
    emptyTitle: { fontSize: 17, fontWeight: '700', color: theme.colors.text },
    emptyText: {
      fontSize: 13, color: theme.colors.textMuted, textAlign: 'center',
      lineHeight: 19, paddingHorizontal: 22,
    },
    suggestionsWrap: { width: '100%', gap: 8, marginTop: theme.spacing.md },
    suggestion: {
      flexDirection: 'row', alignItems: 'center', gap: 9,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1, borderColor: theme.colors.border,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.md,
    },
    suggestionText: { flex: 1, fontSize: 13, color: theme.colors.text, fontWeight: '500' },

    // Composer
    composer: {
      flexDirection: 'row', alignItems: 'flex-end', gap: 9,
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.md,
      paddingBottom: insets.bottom + theme.spacing.md,
      backgroundColor: theme.colors.surface,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
    },
    modeBtn: {
      width: 40, height: 40, borderRadius: 20,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: theme.colors.inputBg,
    },
    modeBtnActive: { backgroundColor: theme.colors.primaryLight },
    input: {
      flex: 1,
      backgroundColor: theme.colors.inputBg,
      borderRadius: theme.borderRadius.lg,
      paddingHorizontal: theme.spacing.md,
      paddingTop: 11, paddingBottom: 11,
      fontSize: 14, color: theme.colors.text,
      maxHeight: 110,
    },
    sendBtn: {
      width: 40, height: 40, borderRadius: 20,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: theme.colors.primary,
    },
    sendBtnDisabled: { backgroundColor: theme.colors.border },
    modeBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      alignSelf: 'flex-start',
      marginHorizontal: theme.spacing.lg,
      marginBottom: -4,
      paddingHorizontal: 9, paddingVertical: 4,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.primaryLight,
    },
    modeBadgeText: { fontSize: 11, fontWeight: '700', color: theme.colors.primaryDark },

    // Sheets
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: theme.borderRadius.xxl,
      borderTopRightRadius: theme.borderRadius.xxl,
      padding: theme.spacing.xl,
      paddingBottom: insets.bottom + theme.spacing.xl,
      gap: 4,
      maxHeight: '80%',
    },
    sheetTitle: { fontSize: 17, fontWeight: '700', color: theme.colors.text, marginBottom: 8 },
    sheetOption: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingVertical: theme.spacing.md,
    },
    sheetOptionText: { flex: 1, fontSize: 14, color: theme.colors.text },
    sheetOptionActive: { fontWeight: '700', color: theme.colors.primary },
    closeBtn: {
      marginTop: 10, paddingVertical: 13,
      borderRadius: theme.borderRadius.md,
      backgroundColor: theme.colors.inputBg,
      alignItems: 'center',
    },
    closeBtnText: { fontSize: 15, fontWeight: '600', color: theme.colors.text },

    excerpt: {
      fontSize: 13, lineHeight: 20, color: theme.colors.textSecondary,
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: theme.borderRadius.sm,
      padding: theme.spacing.md,
    },
    jumpBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
      marginTop: 10, paddingVertical: 13,
      borderRadius: theme.borderRadius.md,
      backgroundColor: theme.colors.primary,
    },
    jumpBtnText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  }), [theme, insets]);

  // ─── Rendering ────────────────────────────────────────────────────────────

  /**
   * Renders answer text with [n] markers turned into tappable chips.
   * Keeps everything in one Text so wrapping stays natural.
   */
  const renderAnswer = (message: KbMessage) => {
    if (!message.citations.length) {
      return <Text style={styles.bubbleAiText}>{message.content}</Text>;
    }

    /**
     * Citations are compacted to only the sources the answer used, so the
     * model's marker numbers are sparse (an answer citing [3] and [7] yields a
     * 2-item list). Map each emitted marker to its 1-based position in that
     * list, so the inline markers and the SOURCES list below always agree.
     */
    const displayByRef = new Map<number, { position: number; citation: KbCitation }>();
    message.citations.forEach((citation, i) => {
      // Fall back to i + 1 for messages saved before sourceRef existed.
      displayByRef.set(citation.sourceRef ?? i + 1, { position: i + 1, citation });
    });

    const parts = message.content.split(/(\[\d{1,2}\])/g);
    return (
      <Text style={styles.bubbleAiText}>
        {parts.map((part, index) => {
          const match = /^\[(\d{1,2})\]$/.exec(part);
          if (!match) return <Text key={index}>{part}</Text>;

          const entry = displayByRef.get(parseInt(match[1], 10));
          // An uncited marker (the model referenced a dropped source) stays
          // as plain text rather than linking to the wrong document.
          if (!entry) return <Text key={index}>{part}</Text>;

          return (
            <Text
              key={index}
              style={{ color: theme.colors.primary, fontWeight: '700' }}
              onPress={() => openCitation(entry.citation)}
            >
              {` [${entry.position}] `}
            </Text>
          );
        })}
      </Text>
    );
  };

  const renderMessage = (message: KbMessage, index: number) => {
    if (message.role === 'user') {
      return (
        <View key={message.id || index} style={styles.bubbleUser}>
          <Text style={styles.bubbleUserText}>{message.content}</Text>
        </View>
      );
    }

    const isLast = index === messages.length - 1;

    return (
      <View key={message.id || index} style={styles.bubbleAi}>
        {message.error ? (
          <>
            <Text style={styles.errorText}>{message.error}</Text>
            {/* Only the newest failure can be retried — retrying an older one
                would re-ask a question that has since been superseded. Every
                failure is dismissible, so stale errors don't pile up in the
                transcript with no way to clear them short of wiping the chat. */}
            <View style={styles.errorActions}>
              {isLast ? (
                <TouchableOpacity style={styles.retryRow} onPress={handleRetry}>
                  <Ionicons name="refresh" size={13} color={theme.colors.primaryDark} />
                  <Text style={styles.retryText}>Try again</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                style={styles.dismissRow}
                onPress={() => handleDismissError(message)}
              >
                <Ionicons name="close" size={13} color={theme.colors.textMuted} />
                <Text style={styles.dismissText}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            {renderAnswer(message)}
            {message.citations.length > 0 ? (
              <>
                <Text style={styles.citationHeader}>SOURCES</Text>
                {message.citations.map((citation, i) => (
                  <TouchableOpacity
                    key={citation.chunkId}
                    style={styles.citationRow}
                    onPress={() => openCitation(citation)}
                  >
                    <View style={styles.citationIndex}>
                      <Text style={styles.citationIndexText}>{i + 1}</Text>
                    </View>
                    <View style={styles.citationBody}>
                      <Text style={styles.citationTitle} numberOfLines={1}>
                        {citation.documentTitle}
                      </Text>
                      {citation.heading || citation.page ? (
                        <Text style={styles.citationMeta} numberOfLines={1}>
                          {[
                            citation.heading,
                            citation.page ? `page ${citation.page}` : null,
                          ].filter(Boolean).join(' · ')}
                        </Text>
                      ) : null}
                    </View>
                    <Ionicons name="chevron-forward" size={14} color={theme.colors.textMuted} />
                  </TouchableOpacity>
                ))}
              </>
            ) : null}
          </>
        )}
      </View>
    );
  };

  const title = scopedDoc ? scopedDoc.title : (kb?.name ?? 'Knowledge Base');
  const subtitle = scopedDoc
    ? 'Asking this document only'
    : `${readyDocs.length} document${readyDocs.length === 1 ? '' : 's'} indexed`;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <View style={styles.headerBody}>
          <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
          <Text style={styles.headerSub}>{subtitle}</Text>
        </View>
        {messages.length > 0 ? (
          <TouchableOpacity style={styles.headerBtn} onPress={handleClear}>
            <Ionicons name="trash-outline" size={17} color={theme.colors.text} />
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={scrollToEnd}
      >
        {notice ? (
          <View style={styles.notice}>
            <Ionicons name="cloud-offline-outline" size={15} color={theme.colors.warning} />
            <Text style={styles.noticeText}>{notice}</Text>
          </View>
        ) : null}

        {loading ? (
          <ActivityIndicator style={{ marginTop: 30 }} color={theme.colors.primary} />
        ) : messages.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="sparkles-outline" size={29} color={theme.colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>
              {hasIndexedContent ? 'Ask anything' : 'Add a document first'}
            </Text>
            <Text style={styles.emptyText}>
              {hasIndexedContent
                ? 'Answers come only from your documents, and every claim links back to its source.'
                : 'Once you add a document, you can ask questions about it here.'}
            </Text>

            {suggestions.length > 0 ? (
              <View style={styles.suggestionsWrap}>
                {suggestions.map((suggestion) => (
                  <TouchableOpacity
                    key={suggestion}
                    style={styles.suggestion}
                    onPress={() => send(suggestion)}
                  >
                    <Ionicons name="arrow-forward-circle-outline" size={17} color={theme.colors.primary} />
                    <Text style={styles.suggestionText}>{suggestion}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
          </View>
        ) : (
          messages.map(renderMessage)
        )}

        {sending ? (
          <View style={styles.thinkingRow}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <Text style={styles.thinkingText}>Searching your documents…</Text>
          </View>
        ) : null}
      </ScrollView>

      {explainMode ? (
        <TouchableOpacity style={styles.modeBadge} onPress={() => setExplainMode(null)}>
          <Ionicons name="color-wand-outline" size={12} color={theme.colors.primaryDark} />
          <Text style={styles.modeBadgeText}>{KB_EXPLAIN_LABELS[explainMode]}</Text>
          <Ionicons name="close" size={12} color={theme.colors.primaryDark} />
        </TouchableOpacity>
      ) : null}

      <View style={styles.composer}>
        <TouchableOpacity
          style={[styles.modeBtn, explainMode && styles.modeBtnActive]}
          onPress={() => setShowExplainSheet(true)}
        >
          <Ionicons
            name="color-wand-outline"
            size={19}
            color={explainMode ? theme.colors.primary : theme.colors.textSecondary}
          />
        </TouchableOpacity>

        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder={hasIndexedContent ? 'Ask about your documents…' : 'Add a document to start'}
          placeholderTextColor={theme.colors.textMuted}
          multiline
          editable={!sending}
        />

        <TouchableOpacity
          style={[
            styles.sendBtn,
            (!input.trim() || sending || !hasIndexedContent) && styles.sendBtnDisabled,
          ]}
          onPress={() => send(input)}
          disabled={!input.trim() || sending || !hasIndexedContent}
        >
          <Ionicons name="arrow-up" size={20} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* Explain-mode sheet */}
      <Modal
        visible={showExplainSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowExplainSheet(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>How should answers be written?</Text>
            <ScrollView style={{ maxHeight: 380 }}>
              <TouchableOpacity
                style={styles.sheetOption}
                onPress={() => { setExplainMode(null); setShowExplainSheet(false); }}
              >
                <Ionicons
                  name={explainMode === null ? 'radio-button-on' : 'radio-button-off'}
                  size={19}
                  color={explainMode === null ? theme.colors.primary : theme.colors.textMuted}
                />
                <Text style={[styles.sheetOptionText, explainMode === null && styles.sheetOptionActive]}>
                  Default
                </Text>
              </TouchableOpacity>

              {(Object.keys(KB_EXPLAIN_LABELS) as KbExplainMode[]).map((mode) => (
                <TouchableOpacity
                  key={mode}
                  style={styles.sheetOption}
                  onPress={() => { setExplainMode(mode); setShowExplainSheet(false); }}
                >
                  <Ionicons
                    name={explainMode === mode ? 'radio-button-on' : 'radio-button-off'}
                    size={19}
                    color={explainMode === mode ? theme.colors.primary : theme.colors.textMuted}
                  />
                  <Text style={[styles.sheetOptionText, explainMode === mode && styles.sheetOptionActive]}>
                    {KB_EXPLAIN_LABELS[mode]}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setShowExplainSheet(false)}>
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Citation detail */}
      <Modal
        visible={activeCitation !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setActiveCitation(null)}
      >
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle} numberOfLines={2}>
              {activeCitation?.documentTitle}
            </Text>
            {activeCitation?.heading || activeCitation?.page ? (
              <Text style={styles.citationMeta}>
                {[
                  activeCitation?.heading,
                  activeCitation?.page ? `page ${activeCitation.page}` : null,
                ].filter(Boolean).join(' · ')}
              </Text>
            ) : null}
            <ScrollView style={{ maxHeight: 320, marginTop: 10 }}>
              <Text style={styles.excerpt}>{activeCitation?.excerpt}</Text>
            </ScrollView>
            <TouchableOpacity
              style={styles.jumpBtn}
              onPress={() => activeCitation && jumpToDocument(activeCitation)}
            >
              <Ionicons name="open-outline" size={17} color="#FFF" />
              <Text style={styles.jumpBtnText}>Open document</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setActiveCitation(null)}>
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}
