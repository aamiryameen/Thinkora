import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useTheme } from '../context/ThemeContext';
import { usePremium, type PremiumFeature } from '../services/premiumService';
import { PremiumGateSheet } from '../components/PremiumGateSheet';
import { SCREEN_BOTTOM_INSET } from '../components/AdBanner';
import * as svc from '../services/whiteboardService';
import { BOARD_TEMPLATES, FREE_BOARD_LIMIT } from '../core/whiteboard';
import type { Board } from '../types/whiteboard';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function WhiteboardsScreen() {
  const navigation = useNavigation<Nav>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { hasPremium } = usePremium();

  const [boards, setBoards] = useState<Board[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [query, setQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [nameOpen, setNameOpen] = useState(false);
  const [renaming, setRenaming] = useState<Board | null>(null);
  const [name, setName] = useState('');
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [pinTarget, setPinTarget] = useState<Board | null>(null);
  const [pin, setPin] = useState('');
  const [gateFeature, setGateFeature] = useState<PremiumFeature | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      // Boards first and rendered on their own: the list is what the user is
      // waiting for, and holding it back until every count is known made the
      // screen appear blank for the duration.
      const list = await svc.getBoards(true);
      setBoards(list);
      setCounts(await svc.getItemCounts());
    } catch {
      setBoards([]);
    }
  }, []);

  // useFocusEffect alone: it fires on mount too, so a separate useEffect just
  // ran the whole load twice on the way in.
  // Item counts change while editing, so refresh whenever this regains focus.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const activeCount = useMemo(
    () => (boards ?? []).filter(b => !b.archived).length,
    [boards],
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (boards ?? [])
      .filter(b => b.archived === showArchived)
      .filter(b => !q || b.name.toLowerCase().includes(q));
  }, [boards, query, showArchived]);

  const openNew = useCallback(() => {
    if (!hasPremium && activeCount >= FREE_BOARD_LIMIT) {
      setGateFeature('whiteboard_unlimited');
      return;
    }
    setRenaming(null);
    setName('');
    setTemplateId(null);
    setNameOpen(true);
  }, [activeCount, hasPremium]);

  const submit = useCallback(async () => {
    const trimmed = name.trim() || 'Untitled board';
    setNameOpen(false);
    setBusy(true);
    try {
      if (renaming) {
        await svc.updateBoard(renaming.id, { name: trimmed });
        setRenaming(null);
        await load();
        return;
      }
      const template = BOARD_TEMPLATES.find(t => t.id === templateId);
      const id = await svc.createBoard(trimmed, template ? template.build() : []);
      await load();
      navigation.navigate('Whiteboard', { boardId: id });
    } catch { /* leaves the list unchanged */ } finally {
      setBusy(false);
    }
  }, [load, name, navigation, renaming, templateId]);

  const pickTemplate = useCallback((id: string) => {
    if (!hasPremium) { setNameOpen(false); setGateFeature('whiteboard_templates'); return; }
    setTemplateId(prev => (prev === id ? null : id));
  }, [hasPremium]);

  const confirmDelete = useCallback((board: Board) => {
    const n = counts[board.id] ?? 0;
    Alert.alert(
      `Delete "${board.name}"?`,
      n > 0 ? `${n} item${n > 1 ? 's' : ''} on this board will be removed.` : 'This board is empty.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try { await svc.deleteBoard(board.id); await load(); } catch { /* ignore */ }
          },
        },
      ],
    );
  }, [counts, load]);

  const duplicate = useCallback(async (board: Board) => {
    if (!hasPremium) { setGateFeature('whiteboard_archive'); return; }
    setBusy(true);
    try { await svc.duplicateBoard(board.id); await load(); } catch { /* ignore */ } finally {
      setBusy(false);
    }
  }, [hasPremium, load]);

  const toggleArchive = useCallback(async (board: Board) => {
    if (!hasPremium) { setGateFeature('whiteboard_archive'); return; }
    try {
      await svc.updateBoard(board.id, { archived: !board.archived });
      await load();
    } catch { /* ignore */ }
  }, [hasPremium, load]);

  const openPin = useCallback((board: Board) => {
    if (!hasPremium) { setGateFeature('whiteboard_password'); return; }
    setPinTarget(board);
    setPin('');
  }, [hasPremium]);

  const savePin = useCallback(async () => {
    if (!pinTarget) return;
    const target = pinTarget;
    setPinTarget(null);
    const trimmed = pin.trim();
    try {
      // Empty input removes protection.
      await svc.updateBoard(target.id, { passcode: trimmed.length >= 4 ? trimmed : null });
      await load();
      if (trimmed.length > 0 && trimmed.length < 4) {
        Alert.alert('PIN too short', 'Use at least 4 digits, or leave it empty to remove protection.');
      }
    } catch { /* ignore */ }
  }, [load, pin, pinTarget]);

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
    titleWrap: { flex: 1 },
    title: { ...theme.typography.title, fontSize: 24, fontWeight: '700', color: theme.colors.text },
    subtitle: { ...theme.typography.caption, color: theme.colors.textMuted },
    squareBtn: {
      width: 40, height: 40, borderRadius: 13,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: theme.colors.primary,
    },
    ghostBtn: { backgroundColor: theme.colors.inputBg },
    search: {
      marginHorizontal: theme.spacing.lg, marginTop: theme.spacing.md,
      flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm,
      backgroundColor: theme.colors.inputBg,
      borderRadius: theme.borderRadius.lg,
      paddingHorizontal: theme.spacing.md,
    },
    searchInput: {
      flex: 1, paddingVertical: 10,
      ...theme.typography.bodySmall, color: theme.colors.text,
    },
    tabs: {
      flexDirection: 'row', gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md,
    },
    tab: {
      paddingHorizontal: 14, paddingVertical: 7,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.inputBg,
    },
    tabOn: { backgroundColor: theme.colors.primaryLight },
    tabText: { ...theme.typography.caption, fontWeight: '700', color: theme.colors.textMuted },
    tabTextOn: { color: theme.colors.primary },
    scroll: { padding: theme.spacing.lg, paddingBottom: SCREEN_BOTTOM_INSET, gap: theme.spacing.md },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md },
    card: {
      width: '47%',
      backgroundColor: theme.colors.cardBg,
      borderRadius: theme.borderRadius.xl,
      padding: theme.spacing.md,
      gap: theme.spacing.sm,
      ...theme.shadows.card,
    },
    preview: {
      height: 88, borderRadius: 10,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.border,
    },
    cardName: { ...theme.typography.bodySmall, fontWeight: '700', color: theme.colors.text },
    cardMeta: { ...theme.typography.caption, fontSize: 11, color: theme.colors.textMuted },
    cardActions: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 },
    empty: {
      ...theme.typography.bodySmall, color: theme.colors.textMuted,
      textAlign: 'center', paddingVertical: theme.spacing.xxl, lineHeight: 20,
    },
    limitNote: {
      ...theme.typography.caption, fontSize: 12, color: theme.colors.textMuted,
      textAlign: 'center', lineHeight: 18,
      backgroundColor: theme.colors.inputBg,
      padding: theme.spacing.md, borderRadius: theme.borderRadius.md,
    },
    overlay: { flex: 1, backgroundColor: theme.colors.overlay, justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: 28, borderTopRightRadius: 28,
      padding: theme.spacing.lg,
      paddingBottom: insets.bottom + theme.spacing.lg,
      gap: theme.spacing.lg,
      maxHeight: '88%',
    },
    label: {
      ...theme.typography.caption, color: theme.colors.textMuted,
      textTransform: 'uppercase', letterSpacing: 1, fontWeight: '700',
    },
    input: {
      backgroundColor: theme.colors.inputBg,
      borderRadius: theme.borderRadius.lg,
      paddingVertical: 13, paddingHorizontal: theme.spacing.lg,
      borderWidth: 2, borderColor: theme.colors.border,
      ...theme.typography.body, color: theme.colors.text,
    },
    pinInput: {
      backgroundColor: theme.colors.inputBg,
      borderRadius: theme.borderRadius.lg,
      paddingVertical: 14,
      borderWidth: 2, borderColor: theme.colors.border,
      fontSize: 22, letterSpacing: 8, textAlign: 'center',
      color: theme.colors.text,
    },
    templateRow: {
      flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md,
      padding: theme.spacing.md,
      borderRadius: theme.borderRadius.lg,
      borderWidth: 2, borderColor: 'transparent',
      backgroundColor: theme.colors.inputBg,
    },
    templateOn: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primaryLight },
    save: {
      backgroundColor: theme.colors.primary,
      borderRadius: theme.borderRadius.lg,
      paddingVertical: 15, alignItems: 'center',
    },
    saveText: { ...theme.typography.button, color: '#FFF', fontWeight: '800' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  }), [insets.bottom, insets.top, theme]);

  if (boards === null) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.squareBtn, styles.ghostBtn]}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={20} color={theme.colors.text} />
        </TouchableOpacity>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>Whiteboards</Text>
          <Text style={styles.subtitle}>
            {activeCount} board{activeCount === 1 ? '' : 's'}
            {hasPremium ? '' : ` · ${FREE_BOARD_LIMIT} free`}
          </Text>
        </View>
        <TouchableOpacity style={styles.squareBtn} onPress={openNew} disabled={busy}>
          <Ionicons name="add" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.search}>
        <Ionicons name="search-outline" size={17} color={theme.colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search boards"
          placeholderTextColor={theme.colors.textDisabled}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={17} color={theme.colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.tabs}>
        {([false, true] as const).map(archived => (
          <TouchableOpacity
            key={String(archived)}
            style={[styles.tab, showArchived === archived && styles.tabOn]}
            onPress={() => setShowArchived(archived)}
          >
            <Text style={[styles.tabText, showArchived === archived && styles.tabTextOn]}>
              {archived ? 'Archived' : 'Active'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {shown.length === 0 ? (
          <Text style={styles.empty}>
            {query
              ? `No boards match "${query}".`
              : showArchived
                ? 'Nothing archived.'
                : 'No boards yet.\nTap + to start an infinite canvas.'}
          </Text>
        ) : (
          <View style={styles.grid}>
            {shown.map(board => (
              <View key={board.id} style={styles.card}>
                <TouchableOpacity
                  onPress={() => navigation.navigate('Whiteboard', { boardId: board.id })}
                  activeOpacity={0.85}
                >
                  <View style={[styles.preview, { backgroundColor: board.background }]}>
                    <Ionicons
                      name={board.passcode ? 'lock-closed-outline' : 'grid-outline'}
                      size={24}
                      color={theme.colors.textDisabled}
                    />
                  </View>
                </TouchableOpacity>
                <View>
                  <Text style={styles.cardName} numberOfLines={1}>{board.name}</Text>
                  <Text style={styles.cardMeta}>
                    {counts[board.id] ?? 0} item{(counts[board.id] ?? 0) === 1 ? '' : 's'}
                  </Text>
                </View>
                <View style={styles.cardActions}>
                  <TouchableOpacity
                    onPress={() => {
                      setRenaming(board);
                      setName(board.name);
                      setTemplateId(null);
                      setNameOpen(true);
                    }}
                    style={{ padding: 4 }}
                  >
                    <Ionicons name="create-outline" size={15} color={theme.colors.textMuted} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => duplicate(board)} style={{ padding: 4 }}>
                    <Ionicons
                      name={hasPremium ? 'copy-outline' : 'lock-closed-outline'}
                      size={15} color={theme.colors.textMuted}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => openPin(board)} style={{ padding: 4 }}>
                    <Ionicons
                      name={board.passcode ? 'lock-closed' : hasPremium ? 'key-outline' : 'lock-closed-outline'}
                      size={15}
                      color={board.passcode ? theme.colors.primary : theme.colors.textMuted}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => toggleArchive(board)} style={{ padding: 4 }}>
                    <Ionicons
                      name={board.archived ? 'arrow-up-circle-outline' : 'archive-outline'}
                      size={15} color={theme.colors.textMuted}
                    />
                  </TouchableOpacity>
                  <View style={{ flex: 1 }} />
                  <TouchableOpacity onPress={() => confirmDelete(board)} style={{ padding: 4 }}>
                    <Ionicons name="trash-outline" size={15} color={theme.colors.error} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {!hasPremium && !showArchived && (
          <Text style={styles.limitNote}>
            Free includes {FREE_BOARD_LIMIT} boards. Upgrade for unlimited boards,
            templates, export and version history.
          </Text>
        )}
      </ScrollView>

      {/* ── New / rename ── */}
      <Modal visible={nameOpen} transparent animationType="slide" onRequestClose={() => setNameOpen(false)}>
        <View style={styles.overlay}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setNameOpen(false)} />
          <View style={styles.sheet}>
            <ScrollView contentContainerStyle={{ gap: theme.spacing.lg }}>
              <Text style={styles.label}>{renaming ? 'Rename board' : 'New board'}</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Board name"
                placeholderTextColor={theme.colors.textDisabled}
                maxLength={50}
                autoFocus
                onSubmitEditing={submit}
              />

              {!renaming && (
                <View style={{ gap: theme.spacing.sm }}>
                  <Text style={styles.label}>
                    Start from a template {hasPremium ? '' : '· PRO'}
                  </Text>
                  {BOARD_TEMPLATES.map(t => (
                    <TouchableOpacity
                      key={t.id}
                      style={[styles.templateRow, templateId === t.id && styles.templateOn]}
                      onPress={() => pickTemplate(t.id)}
                    >
                      <Ionicons
                        name={hasPremium ? t.icon : 'lock-closed-outline'}
                        size={20}
                        color={templateId === t.id ? theme.colors.primary : theme.colors.textMuted}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cardName}>{t.name}</Text>
                        <Text style={styles.cardMeta}>{t.description}</Text>
                      </View>
                      {templateId === t.id && (
                        <Ionicons name="checkmark-circle" size={19} color={theme.colors.primary} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <TouchableOpacity style={styles.save} onPress={submit} disabled={busy}>
                <Text style={styles.saveText}>{renaming ? 'Save' : 'Create board'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── PIN ── */}
      <Modal
        visible={pinTarget !== null}
        transparent animationType="slide"
        onRequestClose={() => setPinTarget(null)}
      >
        <View style={styles.overlay}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setPinTarget(null)} />
          <View style={styles.sheet}>
            <Text style={styles.label}>
              {pinTarget?.passcode ? 'Change or remove PIN' : 'Protect this board'}
            </Text>
            <TextInput
              style={styles.pinInput}
              value={pin}
              onChangeText={setPin}
              placeholder="••••"
              placeholderTextColor={theme.colors.textDisabled}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={8}
              autoFocus
            />
            <Text style={styles.cardMeta}>
              At least 4 digits. Leave empty to remove protection.
              {'\n'}The PIN is stored on this device only — it is not recoverable.
            </Text>
            <TouchableOpacity style={styles.save} onPress={savePin}>
              <Text style={styles.saveText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <PremiumGateSheet
        visible={gateFeature !== null}
        feature={gateFeature ?? undefined}
        onClose={() => setGateFeature(null)}
      />
    </View>
  );
}
