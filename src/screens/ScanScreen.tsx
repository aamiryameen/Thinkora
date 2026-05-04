import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  Pressable,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';
import { scanAndExtract, isScanAvailable, ScanError, type OcrScript } from '../services/scanService';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const SCRIPT_OPTIONS: { id: OcrScript; label: string }[] = [
  { id: 'latin',      label: 'Latin / English' },
  { id: 'devanagari', label: 'Hindi / Devanagari' },
  { id: 'chinese',    label: 'Chinese' },
  { id: 'japanese',   label: 'Japanese' },
  { id: 'korean',     label: 'Korean' },
];

export function ScanScreen() {
  const navigation = useNavigation<Nav>();
  const { theme } = useTheme();
  const { addNote } = useApp();
  const insets = useSafeAreaInsets();

  const [script, setScript] = useState<OcrScript>('latin');
  const [scanning, setScanning] = useState(false);
  const [imageUris, setImageUris] = useState<string[]>([]);
  const [text, setText] = useState<string>('');
  const [perPageText, setPerPageText] = useState<string[]>([]);

  const startedRef = useRef(false);

  const runScan = useCallback(async (forScript: OcrScript) => {
    if (!isScanAvailable()) {
      Alert.alert('Not available', 'Document scanner is not available on this device.');
      return;
    }
    setScanning(true);
    try {
      const result = await scanAndExtract(forScript);
      setImageUris(result.imageUris);
      setText(result.text);
      setPerPageText(result.perPageText);
    } catch (e: any) {
      if (e instanceof ScanError && e.kind === 'cancelled') {
        // User cancelled — go back if there's nothing on screen.
        if (imageUris.length === 0) navigation.goBack();
      } else {
        Alert.alert('Scan failed', e?.message ?? 'Unknown error.');
      }
    } finally {
      setScanning(false);
    }
  }, [imageUris.length, navigation]);

  // Auto-launch the scanner the first time the screen opens.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    runScan(script);
    // We intentionally don't include `script` — first launch uses the default.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveAsNote = useCallback(() => {
    if (!text.trim() && imageUris.length === 0) {
      Alert.alert('Nothing to save', 'Scan a page first.');
      return;
    }
    const today = new Date().toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const title = `Scan • ${today}`;
    const plainText = text.trim() || '(Scanned image — no text detected)';
    const contentHtml = plainText
      .split(/\n\n+/)
      .map((p) => `<p>${p.replace(/\n/g, '<br/>')}</p>`)
      .join('');

    addNote({
      title,
      content: contentHtml,
      plainText,
      folderId: null,
      tagIds: [],
      isFavorite: false,
      isPinned: false,
      color: null,
      category: 'none',
      attachments: imageUris.map((uri, i) => ({
        id: `scan-${Date.now()}-${i}`,
        uri,
        name: `scan-page-${i + 1}.jpg`,
        type: 'photo' as const,
        mimeType: 'image/jpeg',
        createdAt: Date.now(),
      })),
      reminderId: null,
    });
    Alert.alert('Saved', 'Your scan has been saved as a note.', [
      { text: 'OK', onPress: () => navigation.goBack() },
    ]);
  }, [text, imageUris, addNote, navigation]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: theme.colors.background },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.md,
          paddingHorizontal: theme.spacing.lg,
          paddingTop: insets.top + theme.spacing.md,
          paddingBottom: theme.spacing.md,
          backgroundColor: theme.colors.surface,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.colors.border,
        },
        backBtn: {
          width: 40, height: 40, borderRadius: 12,
          alignItems: 'center', justifyContent: 'center',
          backgroundColor: theme.colors.inputBg,
        },
        title: { ...theme.typography.title, fontSize: 22, fontWeight: '700', color: theme.colors.text, flex: 1 },
        scroll: { flex: 1 },
        content: { padding: theme.spacing.lg, gap: theme.spacing.lg, paddingBottom: insets.bottom + 40 },
        sectionLabel: {
          ...theme.typography.overline,
          color: theme.colors.textMuted,
          textTransform: 'uppercase',
          letterSpacing: 1,
          marginBottom: theme.spacing.sm,
        },

        // Empty / loading state
        centerWrap: {
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 60,
          gap: theme.spacing.md,
        },
        ctaBtn: {
          backgroundColor: theme.colors.primary,
          flexDirection: 'row',
          gap: 8,
          alignItems: 'center',
          paddingHorizontal: theme.spacing.xl,
          paddingVertical: 14,
          borderRadius: theme.borderRadius.full,
          marginTop: theme.spacing.md,
          ...theme.shadows.card,
        },
        ctaBtnText: { ...theme.typography.button, color: '#FFF' },
        ctaSecondary: {
          backgroundColor: theme.colors.inputBg,
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: 10,
          borderRadius: theme.borderRadius.full,
        },
        ctaSecondaryText: { ...theme.typography.bodySmall, color: theme.colors.text, fontWeight: '600' },
        helpText: {
          ...theme.typography.bodySmall,
          color: theme.colors.textMuted,
          textAlign: 'center',
          paddingHorizontal: theme.spacing.xl,
          lineHeight: 20,
        },

        // Image grid
        imageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
        thumb: {
          width: '48%',
          aspectRatio: 0.75,
          borderRadius: theme.borderRadius.lg,
          backgroundColor: theme.colors.inputBg,
          overflow: 'hidden',
        },
        thumbImg: { width: '100%', height: '100%' },

        // OCR text card
        textCard: {
          backgroundColor: theme.colors.cardBg,
          borderRadius: theme.borderRadius.xl,
          padding: theme.spacing.lg,
          ...theme.shadows.card,
        },
        textBody: { ...theme.typography.body, color: theme.colors.text, lineHeight: 22 },

        // Script selector
        scriptRow: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: theme.spacing.sm,
        },
        scriptChip: {
          paddingVertical: 6,
          paddingHorizontal: theme.spacing.md,
          borderRadius: theme.borderRadius.full,
          backgroundColor: theme.colors.inputBg,
          borderWidth: 1.5,
          borderColor: 'transparent',
        },
        scriptChipOn: { backgroundColor: theme.colors.primaryLight, borderColor: theme.colors.primary },
        scriptChipText: { ...theme.typography.bodySmall, color: theme.colors.text, fontWeight: '500' },
        scriptChipTextOn: { color: theme.colors.primary, fontWeight: '700' },

        // Footer actions
        footer: {
          flexDirection: 'row',
          gap: theme.spacing.sm,
          padding: theme.spacing.lg,
          backgroundColor: theme.colors.surface,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: theme.colors.border,
        },
        btn: {
          flex: 1,
          flexDirection: 'row',
          gap: 6,
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 14,
          borderRadius: theme.borderRadius.lg,
        },
        btnPrimary: { backgroundColor: theme.colors.primary },
        btnPrimaryText: { ...theme.typography.button, color: '#FFF' },
        btnSecondary: { backgroundColor: theme.colors.inputBg },
        btnSecondaryText: { ...theme.typography.button, color: theme.colors.text, fontWeight: '600' },
      }),
    [theme, insets],
  );

  const hasResult = imageUris.length > 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={10}>
          <Ionicons name="arrow-back" size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Scan</Text>
      </View>

      {scanning ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.helpText}>Opening scanner…</Text>
        </View>
      ) : !hasResult ? (
        <View style={styles.centerWrap}>
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 24,
              backgroundColor: theme.colors.primaryLight,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="scan-outline" size={40} color={theme.colors.primary} />
          </View>
          <Text style={[styles.title, { fontSize: 18, marginTop: theme.spacing.md }]}>
            Smart document scan
          </Text>
          <Text style={styles.helpText}>
            Capture documents, whiteboards, receipts and notes. Auto-crop, enhance, and extract text — all on your device.
          </Text>
          <TouchableOpacity style={styles.ctaBtn} onPress={() => runScan(script)} activeOpacity={0.85}>
            <Ionicons name="camera" size={20} color="#FFF" />
            <Text style={styles.ctaBtnText}>Open scanner</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          <View>
            <Text style={styles.sectionLabel}>Pages ({imageUris.length})</Text>
            <View style={styles.imageGrid}>
              {imageUris.map((uri, i) => (
                <View key={i} style={styles.thumb}>
                  <Image source={{ uri }} style={styles.thumbImg} resizeMode="cover" />
                </View>
              ))}
            </View>
          </View>

          <View>
            <Text style={styles.sectionLabel}>OCR Language</Text>
            <View style={styles.scriptRow}>
              {SCRIPT_OPTIONS.map((opt) => {
                const on = script === opt.id;
                return (
                  <Pressable
                    key={opt.id}
                    onPress={() => {
                      setScript(opt.id);
                      // Re-OCR with the new script using existing images is not
                      // supported by the plugin; the simple option is to re-scan.
                      Alert.alert(
                        'Re-scan?',
                        'Switching language requires re-scanning the pages.',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Re-scan', onPress: () => runScan(opt.id) },
                        ],
                      );
                    }}
                    style={[styles.scriptChip, on && styles.scriptChipOn]}
                  >
                    <Text style={[styles.scriptChipText, on && styles.scriptChipTextOn]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View>
            <Text style={styles.sectionLabel}>Extracted Text</Text>
            <View style={styles.textCard}>
              {text.trim().length > 0 ? (
                <Text style={styles.textBody}>{text}</Text>
              ) : (
                <Text style={[styles.textBody, { color: theme.colors.textMuted, fontStyle: 'italic' }]}>
                  No text detected on this page. The image is still saved with the note.
                </Text>
              )}
            </View>
          </View>
        </ScrollView>
      )}

      {hasResult && !scanning && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.btn, styles.btnSecondary]}
            onPress={() => runScan(script)}
            activeOpacity={0.85}
          >
            <Ionicons name="camera-outline" size={18} color={theme.colors.text} />
            <Text style={styles.btnSecondaryText}>New scan</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, styles.btnPrimary]}
            onPress={saveAsNote}
            activeOpacity={0.85}
          >
            <Ionicons name="save-outline" size={18} color="#FFF" />
            <Text style={styles.btnPrimaryText}>Save as note</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
