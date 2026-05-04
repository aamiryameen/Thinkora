import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';
import { testGeminiKey, GeminiError } from '../services/geminiService';
import { AI_PROXY_ENABLED } from '../core/env';

const AI_STUDIO_URL = 'https://aistudio.google.com/apikey';

export function AISettingsScreen() {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { settings, updateSettings } = useApp();
  const insets = useSafeAreaInsets();

  const [draft, setDraft] = useState(settings.geminiApiKey ?? '');
  const [reveal, setReveal] = useState(false);
  const [testing, setTesting] = useState(false);

  const isDirty = draft.trim() !== (settings.geminiApiKey ?? '');

  const handleSave = () => {
    const trimmed = draft.trim();
    updateSettings({ geminiApiKey: trimmed ? trimmed : null });
    Alert.alert('Saved', trimmed ? 'API key saved on this device.' : 'API key cleared.');
  };

  const handleTest = async () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      Alert.alert('No key', 'Paste a Gemini API key first.');
      return;
    }
    setTesting(true);
    try {
      await testGeminiKey(trimmed);
      Alert.alert('Key works', 'Your Gemini API key is valid.');
    } catch (e: any) {
      const msg = e instanceof GeminiError ? e.message : (e?.message ?? 'Unknown error');
      Alert.alert('Test failed', msg);
    } finally {
      setTesting(false);
    }
  };

  const handleRemove = () => {
    Alert.alert('Remove API key?', 'AI features will stop working until you add a key again.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          setDraft('');
          updateSettings({ geminiApiKey: null });
        },
      },
    ]);
  };

  const openStudio = () => Linking.openURL(AI_STUDIO_URL).catch(() => {});

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
        },
        headerTitle: { ...theme.typography.title, fontSize: 22, fontWeight: '700', color: theme.colors.text },
        scroll: { flex: 1 },
        scrollContent: { padding: theme.spacing.lg, gap: theme.spacing.lg, paddingBottom: insets.bottom + 40 },
        heroCard: {
          backgroundColor: '#7C3AED10',
          borderRadius: theme.borderRadius.xl,
          padding: theme.spacing.lg,
          gap: theme.spacing.sm,
          borderWidth: 1,
          borderColor: '#7C3AED30',
        },
        heroTitleRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
        heroTitle: { ...theme.typography.title, fontSize: 16, fontWeight: '700', color: '#7C3AED' },
        heroBody: { ...theme.typography.bodySmall, color: theme.colors.textSecondary, lineHeight: 20 },
        linkRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: theme.spacing.xs },
        linkText: { ...theme.typography.bodySmall, color: '#7C3AED', fontWeight: '600' },

        sectionTitle: {
          ...theme.typography.overline,
          color: theme.colors.textMuted,
          textTransform: 'uppercase',
          letterSpacing: 1,
          marginBottom: theme.spacing.sm,
          marginLeft: theme.spacing.xs,
        },
        card: {
          backgroundColor: theme.colors.cardBg,
          borderRadius: theme.borderRadius.xl,
          padding: theme.spacing.lg,
          gap: theme.spacing.md,
          ...theme.shadows.card,
        },
        inputRow: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: theme.colors.inputBg,
          borderRadius: theme.borderRadius.lg,
          paddingHorizontal: theme.spacing.md,
        },
        input: {
          flex: 1,
          ...theme.typography.body,
          color: theme.colors.text,
          paddingVertical: theme.spacing.md,
        },
        iconBtn: {
          width: 36,
          height: 36,
          alignItems: 'center',
          justifyContent: 'center',
        },
        actionRow: { flexDirection: 'row', gap: theme.spacing.sm },
        btn: {
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          paddingVertical: 12,
          borderRadius: theme.borderRadius.lg,
        },
        btnPrimary: { backgroundColor: theme.colors.primary },
        btnPrimaryDisabled: { backgroundColor: theme.colors.primary + '60' },
        btnPrimaryText: { ...theme.typography.button, color: '#FFF' },
        btnSecondary: { backgroundColor: theme.colors.inputBg },
        btnSecondaryText: { ...theme.typography.button, color: theme.colors.text, fontWeight: '600' },
        btnDangerText: { ...theme.typography.button, color: theme.colors.error, fontWeight: '600' },
        helpLabel: { ...theme.typography.caption, color: theme.colors.textMuted, marginTop: theme.spacing.xs, lineHeight: 16 },
        statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
        statusDot: { width: 8, height: 8, borderRadius: 4 },
        statusText: { ...theme.typography.bodySmall, fontWeight: '600' },
      }),
    [theme, insets],
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>AI Settings</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Hero / intro */}
        <View style={styles.heroCard}>
          <View style={styles.heroTitleRow}>
            <Ionicons name="sparkles" size={18} color="#7C3AED" />
            <Text style={styles.heroTitle}>
              {settings.geminiApiKey ? 'Using your own Gemini key' : AI_PROXY_ENABLED ? 'Thinkora AI is ready to use' : 'Bring your own Gemini key'}
            </Text>
          </View>
          <Text style={styles.heroBody}>
            {settings.geminiApiKey
              ? 'AI requests use your personal Gemini API key — no daily limit from Thinkora.'
              : AI_PROXY_ENABLED
                ? 'AI features work out of the box with a shared daily limit. For unlimited use, add your own free Gemini API key below — it stays on this device.'
                : "Thinkora uses Google's Gemini to summarize, rewrite, and polish your notes. Free on Google's generous free tier. Your key is stored only on this device."}
          </Text>
          <TouchableOpacity style={styles.linkRow} onPress={openStudio} activeOpacity={0.7}>
            <Text style={styles.linkText}>Get a free key at aistudio.google.com</Text>
            <Ionicons name="open-outline" size={14} color="#7C3AED" />
          </TouchableOpacity>
        </View>

        {/* Status */}
        <View>
          <Text style={styles.sectionTitle}>Status</Text>
          <View style={styles.card}>
            <View style={styles.statusRow}>
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor: settings.geminiApiKey
                      ? theme.colors.success
                      : AI_PROXY_ENABLED
                        ? theme.colors.primary
                        : theme.colors.textDisabled,
                  },
                ]}
              />
              <Text
                style={[
                  styles.statusText,
                  {
                    color: settings.geminiApiKey
                      ? theme.colors.success
                      : AI_PROXY_ENABLED
                        ? theme.colors.primary
                        : theme.colors.textMuted,
                  },
                ]}
              >
                {settings.geminiApiKey
                  ? 'Using your personal API key'
                  : AI_PROXY_ENABLED
                    ? 'Using Thinkora AI (shared daily limit)'
                    : 'No API key set'}
              </Text>
            </View>
          </View>
        </View>

        {/* API key input */}
        <View>
          <Text style={styles.sectionTitle}>Your API Key (optional)</Text>
          <View style={styles.card}>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={draft}
                onChangeText={setDraft}
                placeholder="Paste your Gemini API key"
                placeholderTextColor={theme.colors.textDisabled}
                secureTextEntry={!reveal}
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
                selectTextOnFocus
              />
              <TouchableOpacity style={styles.iconBtn} onPress={() => setReveal((v) => !v)} hitSlop={10}>
                <Ionicons
                  name={reveal ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={theme.colors.textMuted}
                />
              </TouchableOpacity>
            </View>

            <Text style={styles.helpLabel}>
              {AI_PROXY_ENABLED
                ? 'Adding your own key removes the daily limit. Keys start with "AIza…" and stay on this device only.'
                : 'Keys start with "AIza…". Thinkora never sends your key to our servers — it stays on this device.'}
            </Text>

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.btn, styles.btnSecondary]}
                onPress={handleTest}
                disabled={testing || !draft.trim()}
                activeOpacity={0.7}
              >
                {testing ? (
                  <ActivityIndicator size="small" color={theme.colors.text} />
                ) : (
                  <>
                    <Ionicons name="flash-outline" size={16} color={theme.colors.text} />
                    <Text style={styles.btnSecondaryText}>Test</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, isDirty ? styles.btnPrimary : styles.btnPrimaryDisabled]}
                onPress={handleSave}
                disabled={!isDirty}
                activeOpacity={0.85}
              >
                <Ionicons name="checkmark" size={16} color="#FFF" />
                <Text style={styles.btnPrimaryText}>Save</Text>
              </TouchableOpacity>
            </View>

            {!!settings.geminiApiKey && (
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: theme.colors.errorLight }]}
                onPress={handleRemove}
                activeOpacity={0.7}
              >
                <Ionicons name="trash-outline" size={16} color={theme.colors.error} />
                <Text style={styles.btnDangerText}>Remove key</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
