import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal,
  TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { useKnowledge, KB_PRESETS } from '../context/KnowledgeContext';
import { categoryColors } from '../core/theme';
import type { KnowledgeBase } from '../types/knowledge';

const ICON_CHOICES = [
  'library-outline', 'briefcase-outline', 'school-outline', 'code-slash-outline',
  'trending-up-outline', 'flask-outline', 'heart-outline', 'wallet-outline',
  'book-outline', 'bulb-outline', 'person-outline', 'folder-outline',
];

const COLOR_CHOICES: string[] = Object.values(categoryColors);

export function KnowledgeBasesScreen() {
  const navigation = useNavigation<any>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const {
    knowledgeBases, isHydrated, queue,
    createKnowledgeBase, updateKnowledgeBase, deleteKnowledgeBase,
  } = useKnowledge();

  const [showEditor, setShowEditor] = useState(false);
  const [editing, setEditing] = useState<KnowledgeBase | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState(ICON_CHOICES[0]);
  const [color, setColor] = useState(COLOR_CHOICES[1]);
  const [saving, setSaving] = useState(false);

  const activeCountByKb = useMemo(() => {
    const counts: Record<string, number> = {};
    Object.values(queue).forEach((item) => {
      counts[item.kbId] = (counts[item.kbId] ?? 0) + 1;
    });
    return counts;
  }, [queue]);

  const openCreate = (preset?: typeof KB_PRESETS[number]) => {
    setEditing(null);
    setName(preset?.name ?? '');
    setDescription(preset?.description ?? '');
    setIcon(preset?.icon ?? ICON_CHOICES[0]);
    setColor(preset?.color ?? COLOR_CHOICES[1]);
    setShowEditor(true);
  };

  const openEdit = (kb: KnowledgeBase) => {
    setEditing(kb);
    setName(kb.name);
    setDescription(kb.description);
    setIcon(kb.icon);
    setColor(kb.color);
    setShowEditor(true);
  };

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert('Name required', 'Give this knowledge base a name.');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateKnowledgeBase(editing.id, {
          name: trimmed,
          description: description.trim(),
          icon,
          color,
        });
        setShowEditor(false);
      } else {
        const id = await createKnowledgeBase({
          name: trimmed,
          description: description.trim(),
          icon,
          color,
        });
        setShowEditor(false);
        navigation.navigate('KnowledgeBaseDetail', { kbId: id });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (kb: KnowledgeBase) => {
    Alert.alert(
      `Delete "${kb.name}"?`,
      kb.documentCount > 0
        ? `This permanently removes ${kb.documentCount} document${kb.documentCount === 1 ? '' : 's'}, its search index and all chat history.`
        : 'This also removes its chat history.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteKnowledgeBase(kb.id),
        },
      ],
    );
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
    headerTitle: {
      ...theme.typography.title, fontSize: 22, fontWeight: '700',
      color: theme.colors.text, flex: 1,
    },
    addBtn: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: theme.colors.primary,
      alignItems: 'center', justifyContent: 'center',
    },
    scroll: { flex: 1 },
    content: { padding: theme.spacing.lg, gap: theme.spacing.md, paddingBottom: 100 },

    intro: {
      backgroundColor: theme.colors.primaryLight,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.lg,
      gap: 6,
    },
    introTitle: { fontSize: 15, fontWeight: '700', color: theme.colors.primaryDark },
    introText: { fontSize: 13, lineHeight: 19, color: theme.colors.primaryDark },

    card: {
      backgroundColor: theme.colors.cardBg,
      borderRadius: theme.borderRadius.xl,
      padding: theme.spacing.lg,
      ...theme.shadows.card,
      flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md,
    },
    iconWrap: {
      width: 46, height: 46, borderRadius: 14,
      alignItems: 'center', justifyContent: 'center',
    },
    cardBody: { flex: 1, gap: 3 },
    cardTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.text },
    cardMeta: { fontSize: 12, color: theme.colors.textMuted },
    cardDesc: { fontSize: 12, color: theme.colors.textSecondary },
    busyRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
    busyText: { fontSize: 11, fontWeight: '600', color: theme.colors.primary },

    empty: { alignItems: 'center', paddingTop: 40, gap: 10 },
    emptyIcon: {
      width: 72, height: 72, borderRadius: 36,
      backgroundColor: theme.colors.primaryLight,
      alignItems: 'center', justifyContent: 'center', marginBottom: 4,
    },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: theme.colors.text },
    emptyText: {
      fontSize: 14, color: theme.colors.textMuted,
      textAlign: 'center', lineHeight: 20, paddingHorizontal: 20,
    },
    presetLabel: {
      ...theme.typography.overline, color: theme.colors.textMuted,
      marginTop: theme.spacing.lg, marginBottom: 2,
    },
    presetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
    presetChip: {
      flexDirection: 'row', alignItems: 'center', gap: 7,
      paddingHorizontal: 14, paddingVertical: 10,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.surface,
      borderWidth: 1, borderColor: theme.colors.border,
    },
    presetChipText: { fontSize: 13, fontWeight: '600', color: theme.colors.text },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalCard: {
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: theme.borderRadius.xxl,
      borderTopRightRadius: theme.borderRadius.xxl,
      padding: theme.spacing.xl,
      paddingBottom: insets.bottom + theme.spacing.xl,
      gap: theme.spacing.md,
      maxHeight: '88%',
    },
    modalTitle: { fontSize: 18, fontWeight: '700', color: theme.colors.text },
    label: {
      ...theme.typography.label, color: theme.colors.textSecondary, marginBottom: -4,
    },
    input: {
      backgroundColor: theme.colors.inputBg,
      borderRadius: theme.borderRadius.md,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.md,
      fontSize: 15, color: theme.colors.text,
    },
    inputMultiline: { minHeight: 64, textAlignVertical: 'top' },
    swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    swatch: {
      width: 34, height: 34, borderRadius: 17,
      alignItems: 'center', justifyContent: 'center',
    },
    iconTile: {
      width: 44, height: 44, borderRadius: 12,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: theme.colors.inputBg,
    },
    iconTileActive: { backgroundColor: theme.colors.primaryLight },
    modalActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
    btn: {
      flex: 1, paddingVertical: 14, borderRadius: theme.borderRadius.md,
      alignItems: 'center', justifyContent: 'center',
    },
    btnPrimary: { backgroundColor: theme.colors.primary },
    btnSecondary: { backgroundColor: theme.colors.inputBg },
    btnPrimaryText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
    btnSecondaryText: { color: theme.colors.text, fontWeight: '600', fontSize: 15 },
  }), [theme, insets]);

  const renderCard = (kb: KnowledgeBase) => {
    const busy = activeCountByKb[kb.id] ?? 0;
    return (
      <TouchableOpacity
        key={kb.id}
        style={styles.card}
        activeOpacity={0.8}
        onPress={() => navigation.navigate('KnowledgeBaseDetail', { kbId: kb.id })}
        onLongPress={() => openEdit(kb)}
      >
        <View style={[styles.iconWrap, { backgroundColor: `${kb.color}22` }]}>
          <Ionicons name={kb.icon} size={24} color={kb.color} />
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={1}>{kb.name}</Text>
          {kb.description ? (
            <Text style={styles.cardDesc} numberOfLines={1}>{kb.description}</Text>
          ) : null}
          <Text style={styles.cardMeta}>
            {kb.documentCount === 0
              ? 'No documents yet'
              : `${kb.documentCount} document${kb.documentCount === 1 ? '' : 's'}`}
          </Text>
          {busy > 0 ? (
            <View style={styles.busyRow}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
              <Text style={styles.busyText}>
                Processing {busy} document{busy === 1 ? '' : 's'}
              </Text>
            </View>
          ) : null}
        </View>
        <TouchableOpacity
          onPress={() => handleDelete(kb)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="trash-outline" size={19} color={theme.colors.textMuted} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Knowledge Base</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => openCreate()}>
          <Ionicons name="add" size={22} color="#FFF" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {!isHydrated ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={theme.colors.primary} />
        ) : knowledgeBases.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="library-outline" size={34} color={theme.colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>Ask your documents anything</Text>
            <Text style={styles.emptyText}>
              Upload PDFs, notes and images, then ask questions in plain language.
              Answers cite the exact section they came from.
            </Text>
            <Text style={styles.presetLabel}>START WITH</Text>
            <View style={styles.presetGrid}>
              {KB_PRESETS.map((preset) => (
                <TouchableOpacity
                  key={preset.name}
                  style={styles.presetChip}
                  onPress={() => openCreate(preset)}
                >
                  <Ionicons name={preset.icon} size={16} color={preset.color} />
                  <Text style={styles.presetChipText}>{preset.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          <>
            <View style={styles.intro}>
              <Text style={styles.introTitle}>Chat with your documents</Text>
              <Text style={styles.introText}>
                Everything is indexed on your device, so browsing and keyword search
                keep working offline.
              </Text>
            </View>
            {knowledgeBases.map(renderCard)}
          </>
        )}
      </ScrollView>

      <Modal
        visible={showEditor}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditor(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {editing ? 'Edit knowledge base' : 'New knowledge base'}
            </Text>

            <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 420 }}>
              <View style={{ gap: theme.spacing.md }}>
                <Text style={styles.label}>NAME</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g. University"
                  placeholderTextColor={theme.colors.textMuted}
                  autoFocus={!editing}
                />

                <Text style={styles.label}>WHAT'S IT FOR? (OPTIONAL)</Text>
                <TextInput
                  style={[styles.input, styles.inputMultiline]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Helps the AI understand the context of your questions"
                  placeholderTextColor={theme.colors.textMuted}
                  multiline
                />

                <Text style={styles.label}>COLOUR</Text>
                <View style={styles.swatchRow}>
                  {COLOR_CHOICES.map((c) => (
                    <TouchableOpacity
                      key={c}
                      style={[styles.swatch, { backgroundColor: c }]}
                      onPress={() => setColor(c)}
                    >
                      {color === c ? <Ionicons name="checkmark" size={18} color="#FFF" /> : null}
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.label}>ICON</Text>
                <View style={styles.swatchRow}>
                  {ICON_CHOICES.map((name_) => (
                    <TouchableOpacity
                      key={name_}
                      style={[styles.iconTile, icon === name_ && styles.iconTileActive]}
                      onPress={() => setIcon(name_)}
                    >
                      <Ionicons
                        name={name_}
                        size={21}
                        color={icon === name_ ? theme.colors.primary : theme.colors.textSecondary}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.btn, styles.btnSecondary]}
                onPress={() => setShowEditor(false)}
                disabled={saving}
              >
                <Text style={styles.btnSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.btnPrimaryText}>{editing ? 'Save' : 'Create'}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
