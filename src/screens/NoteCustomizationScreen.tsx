import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput, Modal,
  Image, ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import {
  getNoteMeta, setNoteMeta, lockNote, removeLock, isNoteLocked,
  FONT_FAMILIES, FONT_SIZES, type NoteMeta,
} from '../services/noteMetaService';
import { pickImageFromGallery, attachmentToNoteAttachment } from '../services/attachmentService';
import type { RootStackParamList } from '../navigation/types';

type Route = RouteProp<RootStackParamList, 'NoteCustomization'>;

const BG_PRESETS = [
  null,             // No background
  '#FEF3C7',        // Cream
  '#DBEAFE',        // Sky
  '#DCFCE7',        // Mint
  '#FCE7F3',        // Rose
  '#E9D5FF',        // Lilac
  '#FED7AA',        // Peach
  '#CFFAFE',        // Cyan
  '#FECACA',        // Coral
  '#0F172A',        // Midnight
];

export function NoteCustomizationScreen() {
  const navigation = useNavigation();
  const route = useRoute<Route>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const noteId = route.params.noteId;

  const [meta, setMeta] = useState<NoteMeta>({});
  const [loading, setLoading] = useState(true);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinMode, setPinMode] = useState<'set' | 'remove'>('set');
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    (async () => {
      const [m, l] = await Promise.all([getNoteMeta(noteId), isNoteLocked(noteId)]);
      setMeta(m);
      setLocked(l);
      setLoading(false);
    })();
  }, [noteId]);

  const update = async (patch: Partial<NoteMeta>) => {
    const next = await setNoteMeta(noteId, patch);
    setMeta(next);
  };

  const pickCustomBg = async () => {
    try {
      const att = await pickImageFromGallery();
      if (att) {
        const note = attachmentToNoteAttachment(att);
        await update({ background: note.uri });
      }
    } catch (e: any) {
      Alert.alert('Could not pick image', e?.message ?? 'Try again');
    }
  };

  const handlePinSubmit = async () => {
    setPinError('');
    if (pinMode === 'set') {
      if (!/^\d{4,8}$/.test(pinInput)) { setPinError('PIN must be 4-8 digits'); return; }
      try {
        await lockNote(noteId, pinInput);
        setLocked(true);
        setShowPinModal(false);
        setPinInput('');
        Alert.alert('Locked', 'This note is now locked. Enter the PIN to view it.');
      } catch (e: any) { setPinError(e.message); }
    } else {
      const ok = await removeLock(noteId, pinInput);
      if (!ok) { setPinError('Incorrect PIN'); return; }
      setLocked(false);
      setShowPinModal(false);
      setPinInput('');
      Alert.alert('Unlocked', 'PIN protection removed.');
    }
  };

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    header: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingHorizontal: 16, paddingTop: insets.top + 12, paddingBottom: 12,
      backgroundColor: theme.colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border,
    },
    headerTitle: { fontSize: 20, fontWeight: '700', color: theme.colors.text, flex: 1 },
    section: { padding: 16, gap: 8 },
    sectionLabel: {
      fontSize: 11, fontWeight: '800', color: theme.colors.textMuted,
      textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6,
    },
    bgRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    bgSwatch: {
      width: 56, height: 80, borderRadius: 10,
      borderWidth: 2.5, borderColor: 'transparent',
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: theme.colors.inputBg, overflow: 'hidden',
    },
    bgSwatchSel: { borderColor: theme.colors.primary },
    swatchLetter: { fontSize: 22, fontWeight: '700', color: theme.colors.text },
    fontRow: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingHorizontal: 14, paddingVertical: 12,
      backgroundColor: theme.colors.cardBg,
      borderRadius: 12, marginBottom: 8,
      borderWidth: 2, borderColor: 'transparent',
    },
    fontRowSel: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary + '10' },
    fontPreview: { fontSize: 15, color: theme.colors.text, fontWeight: '500', flex: 1 },
    sizeChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    sizeChip: {
      paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
      backgroundColor: theme.colors.inputBg,
      borderWidth: 2, borderColor: 'transparent',
    },
    sizeChipSel: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary + '15' },
    sizeChipText: { fontWeight: '700', color: theme.colors.text },
    lockCard: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      padding: 16, backgroundColor: theme.colors.cardBg,
      borderRadius: 14, ...theme.shadows.card,
    },
    lockTitle: { fontSize: 14, fontWeight: '700', color: theme.colors.text },
    lockDesc: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
    lockBtn: {
      paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10,
      backgroundColor: theme.colors.primary,
    },
    lockBtnText: { color: '#FFF', fontWeight: '800', fontSize: 13 },
    // Modal
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
    modalCard: { backgroundColor: theme.colors.surface, borderRadius: 18, padding: 22, width: '100%', maxWidth: 360, gap: 14 },
    modalTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.text },
    pinInput: {
      backgroundColor: theme.colors.inputBg, borderRadius: 12,
      paddingHorizontal: 16, paddingVertical: 14,
      fontSize: 22, color: theme.colors.text, fontWeight: '800',
      letterSpacing: 8, textAlign: 'center',
    },
    err: { color: theme.colors.error, fontSize: 13, fontWeight: '600' },
    primary: { backgroundColor: theme.colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
    primaryText: { color: '#FFF', fontWeight: '800', fontSize: 15 },
    secondary: { alignItems: 'center', paddingVertical: 8 },
    secondaryText: { color: theme.colors.textMuted, fontSize: 14 },
  }), [theme, insets]);

  if (loading) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={theme.colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Customize Note</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        {/* Background */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Background</Text>
          <View style={styles.bgRow}>
            {BG_PRESETS.map((bg, i) => {
              const isSel = (meta.background ?? null) === bg;
              return (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles.bgSwatch,
                    isSel && styles.bgSwatchSel,
                    bg ? { backgroundColor: bg } : null,
                  ]}
                  onPress={() => update({ background: bg })}
                >
                  {bg === null && (
                    <Ionicons name="ban-outline" size={20} color={theme.colors.textMuted} />
                  )}
                </TouchableOpacity>
              );
            })}
            {/* Custom photo */}
            <TouchableOpacity
              style={[
                styles.bgSwatch,
                meta.background?.startsWith('file://') && styles.bgSwatchSel,
              ]}
              onPress={pickCustomBg}
            >
              {meta.background?.startsWith('file://') ? (
                <Image source={{ uri: meta.background }} style={{ width: '100%', height: '100%' }} />
              ) : (
                <Ionicons name="image-outline" size={22} color={theme.colors.textMuted} />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Typography */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Font Family</Text>
          {FONT_FAMILIES.map(f => {
            const isSel = (meta.fontFamily ?? 'system') === f.id;
            return (
              <TouchableOpacity
                key={f.id}
                style={[styles.fontRow, isSel && styles.fontRowSel]}
                onPress={() => update({ fontFamily: f.id })}
              >
                <Text style={[styles.fontPreview, { fontFamily: f.family }]}>
                  {f.label} — Aa Bb Cc 123
                </Text>
                {isSel && <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} />}
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Font Size</Text>
          <View style={styles.sizeChips}>
            {FONT_SIZES.map(sz => {
              const isSel = (meta.fontSize ?? 15) === sz;
              return (
                <TouchableOpacity
                  key={sz}
                  style={[styles.sizeChip, isSel && styles.sizeChipSel]}
                  onPress={() => update({ fontSize: sz })}
                >
                  <Text style={[styles.sizeChipText, { fontSize: Math.min(sz, 18) }]}>{sz}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Lock */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Privacy</Text>
          <View style={styles.lockCard}>
            <Ionicons name={locked ? 'lock-closed' : 'lock-open'} size={28} color={locked ? theme.colors.primary : theme.colors.textMuted} />
            <View style={{ flex: 1 }}>
              <Text style={styles.lockTitle}>{locked ? 'Note is locked' : 'Lock this note'}</Text>
              <Text style={styles.lockDesc}>
                {locked ? 'Requires PIN to open' : 'Set a PIN to require unlock'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.lockBtn}
              onPress={() => {
                setPinMode(locked ? 'remove' : 'set');
                setPinInput('');
                setPinError('');
                setShowPinModal(true);
              }}
            >
              <Text style={styles.lockBtnText}>{locked ? 'Remove' : 'Lock'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* PIN Modal */}
      <Modal visible={showPinModal} transparent animationType="fade" onRequestClose={() => setShowPinModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {pinMode === 'set' ? 'Set Note PIN' : 'Enter PIN to Remove Lock'}
            </Text>
            <TextInput
              style={styles.pinInput}
              value={pinInput}
              onChangeText={(t) => { setPinInput(t.replace(/\D/g, '').slice(0, 8)); setPinError(''); }}
              keyboardType="number-pad"
              placeholder="••••"
              placeholderTextColor={theme.colors.textDisabled}
              maxLength={8}
              secureTextEntry
              autoFocus
            />
            {pinError ? <Text style={styles.err}>{pinError}</Text> : null}
            <TouchableOpacity style={styles.primary} onPress={handlePinSubmit}>
              <Text style={styles.primaryText}>{pinMode === 'set' ? 'Lock Note' : 'Confirm'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondary} onPress={() => setShowPinModal(false)}>
              <Text style={styles.secondaryText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
