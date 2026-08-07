import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal,
  TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';
import { useKnowledge } from '../context/KnowledgeContext';
import {
  pickKbDocument,
  pickKbImage,
} from '../services/kbPickerService';
import {
  isScannedFailure,
  sourceTypeIcon,
  sourceTypeLabel,
} from '../services/kbExtractionService';
import type { KbDocStatus, KbDocument } from '../types/knowledge';

type Filter = 'all' | 'ready' | 'needs-attention';

export function KnowledgeBaseDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const kbId: string = route.params?.kbId;

  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { notes } = useApp();
  const {
    getKnowledgeBase, documentsFor, queue,
    addFileDocument, addNoteDocument, removeDocument, retryDocument,
    allTags,
  } = useKnowledge();

  const kb = getKnowledgeBase(kbId);
  const documents = documentsFor(kbId);

  const [filter, setFilter] = useState<Filter>('all');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [showNotePicker, setShowNotePicker] = useState(false);
  const [noteQuery, setNoteQuery] = useState('');
  const [busy, setBusy] = useState(false);

  const tags = allTags(kbId);
  const queueItems = useMemo(
    () => Object.values(queue).filter((q) => q.kbId === kbId),
    [queue, kbId],
  );

  const readyCount = documents.filter((d) => d.status === 'ready').length;
  const attentionCount = documents.filter(
    (d) => d.status === 'failed' || d.status === 'partial',
  ).length;

  const visibleDocuments = useMemo(() => {
    let list = documents;
    if (filter === 'ready') list = list.filter((d) => d.status === 'ready');
    if (filter === 'needs-attention') {
      list = list.filter((d) => d.status === 'failed' || d.status === 'partial');
    }
    if (activeTag) list = list.filter((d) => d.tags.includes(activeTag));
    return list;
  }, [documents, filter, activeTag]);

  const indexableNotes = useMemo(() => {
    const already = new Set(documents.map((d) => d.noteId).filter(Boolean));
    const query = noteQuery.trim().toLowerCase();
    return notes
      .filter((n) => !already.has(n.id))
      .filter((n) => (n.plainText ?? '').trim().length >= 20)
      .filter((n) =>
        !query ||
        n.title.toLowerCase().includes(query) ||
        (n.plainText ?? '').toLowerCase().includes(query),
      )
      .slice(0, 50);
  }, [notes, documents, noteQuery]);

  // ─── Actions ──────────────────────────────────────────────────────────────

  const handlePickFile = useCallback(async () => {
    setShowAddSheet(false);
    const file = await pickKbDocument();
    if (!file) return;

    setBusy(true);
    try {
      const { error } = await addFileDocument(kbId, file);
      if (error) {
        Alert.alert("Couldn't add document", error);
      }
    } finally {
      setBusy(false);
    }
  }, [kbId, addFileDocument]);

  const handlePickImage = useCallback(async () => {
    setShowAddSheet(false);
    const image = await pickKbImage();
    if (!image) return;

    setBusy(true);
    try {
      const { error } = await addFileDocument(kbId, image);
      if (error) {
        Alert.alert("Couldn't add image", error);
      }
    } finally {
      setBusy(false);
    }
  }, [kbId, addFileDocument]);

  const handleAddNote = useCallback(
    async (noteId: string) => {
      setShowNotePicker(false);
      setBusy(true);
      try {
        const { error } = await addNoteDocument(kbId, noteId);
        if (error) Alert.alert("Couldn't add note", error);
      } finally {
        setBusy(false);
      }
    },
    [kbId, addNoteDocument],
  );

  const handleDeleteDoc = (doc: KbDocument) => {
    Alert.alert(`Remove "${doc.title}"?`, 'This also removes it from search and chat.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeDocument(doc.id) },
    ]);
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
    headerTitle: { fontSize: 19, fontWeight: '700', color: theme.colors.text },
    headerSub: { fontSize: 12, color: theme.colors.textMuted, marginTop: 1 },
    headerIconBtn: {
      width: 36, height: 36, borderRadius: 18,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: theme.colors.inputBg,
    },

    actionRow: {
      flexDirection: 'row', gap: 10,
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.md,
    },
    actionBtn: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 7, paddingVertical: 13, borderRadius: theme.borderRadius.md,
    },
    actionPrimary: { backgroundColor: theme.colors.primary },
    actionSecondary: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1, borderColor: theme.colors.border,
    },
    actionPrimaryText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
    actionSecondaryText: { color: theme.colors.text, fontWeight: '600', fontSize: 14 },

    scroll: { flex: 1 },
    content: { padding: theme.spacing.lg, gap: theme.spacing.md, paddingBottom: 110 },

    filterRow: { flexDirection: 'row', gap: 8 },
    chip: {
      paddingHorizontal: 13, paddingVertical: 7,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.surface,
      borderWidth: 1, borderColor: theme.colors.border,
    },
    chipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
    chipText: { fontSize: 12, fontWeight: '600', color: theme.colors.textSecondary },
    chipTextActive: { color: '#FFF' },

    tagScroll: { marginHorizontal: -theme.spacing.lg, paddingHorizontal: theme.spacing.lg },

    queueCard: {
      backgroundColor: theme.colors.primaryLight,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.md,
      gap: 8,
    },
    queueRow: { gap: 5 },
    queueTitle: { fontSize: 13, fontWeight: '600', color: theme.colors.primaryDark },
    queueLabel: { fontSize: 11, color: theme.colors.primaryDark },
    progressTrack: {
      height: 4, borderRadius: 2,
      backgroundColor: `${theme.colors.primary}33`,
      overflow: 'hidden',
    },
    progressFill: { height: 4, borderRadius: 2, backgroundColor: theme.colors.primary },

    docCard: {
      backgroundColor: theme.colors.cardBg,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.md,
      ...theme.shadows.card,
      flexDirection: 'row', gap: theme.spacing.md, alignItems: 'flex-start',
    },
    docIcon: {
      width: 38, height: 38, borderRadius: 10,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: theme.colors.inputBg,
    },
    docBody: { flex: 1, gap: 3 },
    docTitle: { fontSize: 14, fontWeight: '700', color: theme.colors.text },
    docMeta: { fontSize: 11, color: theme.colors.textMuted },
    docSummary: { fontSize: 12, color: theme.colors.textSecondary, lineHeight: 17 },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
    statusText: { fontSize: 11, fontWeight: '600' },
    tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 4 },
    tagPill: {
      paddingHorizontal: 8, paddingVertical: 3,
      borderRadius: theme.borderRadius.xxs,
      backgroundColor: theme.colors.inputBg,
    },
    tagPillText: { fontSize: 10, fontWeight: '600', color: theme.colors.textSecondary },
    retryBtn: {
      marginTop: 6, alignSelf: 'flex-start',
      flexDirection: 'row', alignItems: 'center', gap: 5,
      paddingHorizontal: 11, paddingVertical: 6,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.primaryLight,
    },
    retryText: { fontSize: 11, fontWeight: '700', color: theme.colors.primaryDark },

    empty: { alignItems: 'center', paddingTop: 50, gap: 10 },
    emptyIcon: {
      width: 68, height: 68, borderRadius: 34,
      backgroundColor: theme.colors.primaryLight,
      alignItems: 'center', justifyContent: 'center',
    },
    emptyTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.text },
    emptyText: {
      fontSize: 13, color: theme.colors.textMuted, textAlign: 'center',
      lineHeight: 19, paddingHorizontal: 24,
    },

    // Sheets
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: theme.borderRadius.xxl,
      borderTopRightRadius: theme.borderRadius.xxl,
      padding: theme.spacing.xl,
      paddingBottom: insets.bottom + theme.spacing.xl,
      gap: theme.spacing.sm,
      maxHeight: '85%',
    },
    sheetTitle: { fontSize: 17, fontWeight: '700', color: theme.colors.text, marginBottom: 4 },
    sheetHint: { fontSize: 12, color: theme.colors.textMuted, marginBottom: 8 },
    sheetRow: {
      flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md,
      paddingVertical: theme.spacing.md,
    },
    sheetRowIcon: {
      width: 40, height: 40, borderRadius: 12,
      backgroundColor: theme.colors.primaryLight,
      alignItems: 'center', justifyContent: 'center',
    },
    sheetRowTitle: { fontSize: 15, fontWeight: '600', color: theme.colors.text },
    sheetRowSub: { fontSize: 12, color: theme.colors.textMuted, marginTop: 1 },
    searchInput: {
      backgroundColor: theme.colors.inputBg,
      borderRadius: theme.borderRadius.md,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      fontSize: 14, color: theme.colors.text,
      marginBottom: 6,
    },
    noteRow: {
      paddingVertical: theme.spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    noteTitle: { fontSize: 14, fontWeight: '600', color: theme.colors.text },
    notePreview: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
    closeBtn: {
      marginTop: 8, paddingVertical: 13,
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

  // ─── Status presentation ──────────────────────────────────────────────────

  const statusMeta = (status: KbDocStatus): { color: string; icon: string; label: string } => {
    switch (status) {
      case 'ready':
        return { color: theme.colors.success, icon: 'checkmark-circle', label: 'Ready' };
      case 'failed':
        return { color: theme.colors.error, icon: 'alert-circle', label: 'Failed' };
      case 'partial':
        return { color: theme.colors.warning, icon: 'warning', label: 'Keyword only' };
      default:
        return { color: theme.colors.primary, icon: 'time-outline', label: 'Processing' };
    }
  };

  const renderDoc = (doc: KbDocument) => {
    const meta = statusMeta(doc.status);
    const inQueue = queue[doc.id];

    return (
      <TouchableOpacity
        key={doc.id}
        style={styles.docCard}
        activeOpacity={0.8}
        onPress={() => navigation.navigate('KbDocument', { kbId, documentId: doc.id })}
        onLongPress={() => handleDeleteDoc(doc)}
      >
        <View style={styles.docIcon}>
          <Ionicons
            name={sourceTypeIcon(doc.sourceType)}
            size={19}
            color={theme.colors.textSecondary}
          />
        </View>

        <View style={styles.docBody}>
          <Text style={styles.docTitle} numberOfLines={2}>{doc.title}</Text>
          <Text style={styles.docMeta}>
            {sourceTypeLabel(doc.sourceType)}
            {doc.pageCount > 0 ? ` · ${doc.pageCount} page${doc.pageCount === 1 ? '' : 's'}` : ''}
            {doc.chunkCount > 0 ? ` · ${doc.chunkCount} sections` : ''}
          </Text>

          {doc.quickSummary ? (
            <Text style={styles.docSummary} numberOfLines={2}>{doc.quickSummary}</Text>
          ) : null}

          {inQueue ? (
            <View style={styles.queueRow}>
              <Text style={styles.queueLabel}>{inQueue.label}</Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${inQueue.progress}%` }]} />
              </View>
            </View>
          ) : (
            <View style={styles.statusRow}>
              <Ionicons name={meta.icon} size={12} color={meta.color} />
              <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
            </View>
          )}

          {doc.errorMessage && !inQueue ? (
            <Text style={[styles.docMeta, { color: meta.color }]} numberOfLines={3}>
              {doc.errorMessage}
            </Text>
          ) : null}

          {doc.tags.length > 0 ? (
            <View style={styles.tagRow}>
              {doc.tags.slice(0, 4).map((tag) => (
                <View key={tag} style={styles.tagPill}>
                  <Text style={styles.tagPillText}>{tag}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {!inQueue && doc.status === 'partial' ? (
            <TouchableOpacity style={styles.retryBtn} onPress={() => retryDocument(doc.id)}>
              <Ionicons name="refresh" size={12} color={theme.colors.primaryDark} />
              <Text style={styles.retryText}>Finish indexing</Text>
            </TouchableOpacity>
          ) : null}

          {/* A scan has no text layer, so retrying the same extraction can only
              fail again. Send the user to the OCR flow that can actually read
              it, instead of offering a button that never works. */}
          {!inQueue && doc.status === 'failed' && isScannedFailure(doc) ? (
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => navigation.navigate('Scan')}
            >
              <Ionicons name="scan-outline" size={12} color={theme.colors.primaryDark} />
              <Text style={styles.retryText}>Scan with OCR</Text>
            </TouchableOpacity>
          ) : null}

          {!inQueue && doc.status === 'failed' && !isScannedFailure(doc) ? (
            <TouchableOpacity style={styles.retryBtn} onPress={() => retryDocument(doc.id)}>
              <Ionicons name="refresh" size={12} color={theme.colors.primaryDark} />
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  if (!kb) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Not found</Text>
        </View>
      </View>
    );
  }

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
          <Text style={styles.headerTitle} numberOfLines={1}>{kb.name}</Text>
          <Text style={styles.headerSub}>
            {documents.length === 0
              ? 'No documents yet'
              : `${readyCount} of ${documents.length} ready`}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.headerIconBtn}
          onPress={() => navigation.navigate('KbSearch', { kbId })}
        >
          <Ionicons name="search" size={19} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.actionPrimary]}
          onPress={() => navigation.navigate('KbChat', { kbId })}
        >
          <Ionicons name="chatbubbles-outline" size={17} color="#FFF" />
          <Text style={styles.actionPrimaryText}>Ask AI</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.actionSecondary]}
          onPress={() => setShowAddSheet(true)}
        >
          <Ionicons name="add-circle-outline" size={17} color={theme.colors.text} />
          <Text style={styles.actionSecondaryText}>Add document</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {queueItems.length > 0 ? (
          <View style={styles.queueCard}>
            <Text style={styles.queueTitle}>
              Processing {queueItems.length} document{queueItems.length === 1 ? '' : 's'}
            </Text>
            {queueItems.map((item) => (
              <View key={item.documentId} style={styles.queueRow}>
                <Text style={styles.queueLabel} numberOfLines={1}>
                  {item.title} — {item.label}
                </Text>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${item.progress}%` }]} />
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {documents.length > 0 ? (
          <View style={styles.filterRow}>
            {([
              ['all', `All ${documents.length}`],
              ['ready', `Ready ${readyCount}`],
              ...(attentionCount > 0
                ? [['needs-attention', `Needs attention ${attentionCount}`] as [Filter, string]]
                : []),
            ] as [Filter, string][]).map(([value, label]) => (
              <TouchableOpacity
                key={value}
                style={[styles.chip, filter === value && styles.chipActive]}
                onPress={() => setFilter(value)}
              >
                <Text style={[styles.chipText, filter === value && styles.chipTextActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        {tags.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.tagScroll}
            contentContainerStyle={{ gap: 8, paddingRight: theme.spacing.lg }}
          >
            <TouchableOpacity
              style={[styles.chip, activeTag === null && styles.chipActive]}
              onPress={() => setActiveTag(null)}
            >
              <Text style={[styles.chipText, activeTag === null && styles.chipTextActive]}>
                All topics
              </Text>
            </TouchableOpacity>
            {tags.map((tag) => (
              <TouchableOpacity
                key={tag}
                style={[styles.chip, activeTag === tag && styles.chipActive]}
                onPress={() => setActiveTag(activeTag === tag ? null : tag)}
              >
                <Text style={[styles.chipText, activeTag === tag && styles.chipTextActive]}>
                  {tag}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : null}

        {visibleDocuments.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="documents-outline" size={30} color={theme.colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>
              {documents.length === 0 ? 'Add your first document' : 'Nothing matches'}
            </Text>
            <Text style={styles.emptyText}>
              {documents.length === 0
                ? 'Upload a PDF, pick an image to read with OCR, or import a note you already have.'
                : 'Try a different filter or topic.'}
            </Text>
          </View>
        ) : (
          visibleDocuments.map(renderDoc)
        )}
      </ScrollView>

      {/* Add-document sheet */}
      <Modal visible={showAddSheet} transparent animationType="slide" onRequestClose={() => setShowAddSheet(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Add a document</Text>
            <Text style={styles.sheetHint}>
              PDFs, text, markdown, CSV and images are supported.
            </Text>

            <TouchableOpacity style={styles.sheetRow} onPress={handlePickFile}>
              <View style={styles.sheetRowIcon}>
                <Ionicons name="document-text-outline" size={20} color={theme.colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetRowTitle}>Choose a file</Text>
                <Text style={styles.sheetRowSub}>PDF, TXT, Markdown or CSV</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.sheetRow} onPress={handlePickImage}>
              <View style={styles.sheetRowIcon}>
                <Ionicons name="image-outline" size={20} color={theme.colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetRowTitle}>Pick an image</Text>
                <Text style={styles.sheetRowSub}>Text is read on-device with OCR</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sheetRow}
              onPress={() => { setShowAddSheet(false); setShowNotePicker(true); }}
            >
              <View style={styles.sheetRowIcon}>
                <Ionicons name="reader-outline" size={20} color={theme.colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetRowTitle}>Import a note</Text>
                <Text style={styles.sheetRowSub}>
                  {indexableNotes.length} note{indexableNotes.length === 1 ? '' : 's'} available
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.closeBtn} onPress={() => setShowAddSheet(false)}>
              <Text style={styles.closeBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Note picker */}
      <Modal visible={showNotePicker} transparent animationType="slide" onRequestClose={() => setShowNotePicker(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Import a note</Text>
            <TextInput
              style={styles.searchInput}
              value={noteQuery}
              onChangeText={setNoteQuery}
              placeholder="Search notes"
              placeholderTextColor={theme.colors.textMuted}
            />
            <ScrollView style={{ maxHeight: 380 }} keyboardShouldPersistTaps="handled">
              {indexableNotes.length === 0 ? (
                <Text style={styles.sheetHint}>
                  No notes available. Notes need at least a short paragraph to be indexed.
                </Text>
              ) : (
                indexableNotes.map((note) => (
                  <TouchableOpacity
                    key={note.id}
                    style={styles.noteRow}
                    onPress={() => handleAddNote(note.id)}
                  >
                    <Text style={styles.noteTitle} numberOfLines={1}>
                      {note.title || 'Untitled note'}
                    </Text>
                    <Text style={styles.notePreview} numberOfLines={2}>
                      {(note.plainText ?? '').slice(0, 120)}
                    </Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setShowNotePicker(false)}>
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {busy ? (
        <View style={styles.busyOverlay}>
          <View style={styles.busyCard}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.busyText}>Reading document…</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}
