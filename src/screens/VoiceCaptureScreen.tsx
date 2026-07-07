import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Alert, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import {
  startVoiceInput, stopVoiceInput, isVoiceAvailable,
} from '../services/voiceInputService';
import { captureFromVoice, type CapturedItem } from '../services/voiceCaptureService';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Phase = 'idle' | 'listening' | 'parsing' | 'preview' | 'saved';

export function VoiceCaptureScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { settings, addTask, addNote, addTag, tags } = useApp();

  const [phase, setPhase] = useState<Phase>('idle');
  const [partial, setPartial] = useState('');
  const [transcript, setTranscript] = useState('');
  const [captured, setCaptured] = useState<CapturedItem | null>(null);
  const pulse = useRef(new Animated.Value(1)).current;

  // Pulsing mic animation while listening
  useEffect(() => {
    if (phase === 'listening') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.25, duration: 600, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1.0, duration: 600, useNativeDriver: true }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    }
    pulse.setValue(1);
  }, [phase, pulse]);

  useEffect(() => {
    return () => { stopVoiceInput().catch(() => {}); };
  }, []);

  const startListening = async () => {
    if (!isVoiceAvailable()) {
      Alert.alert('Voice Unavailable', 'Speech recognition not available on this device.');
      return;
    }
    setTranscript('');
    setPartial('');
    setCaptured(null);
    setPhase('listening');

    await startVoiceInput({
      onPartial: (txt) => setPartial(txt),
      onResult: async (txt) => {
        setTranscript(txt);
        setPhase('parsing');
        const item = await captureFromVoice(txt, settings.geminiApiKey ?? null);
        setCaptured(item);
        setPhase('preview');
      },
      onError: () => { setPhase('idle'); },
      onEnd: () => {
        // If we got nothing usable, return to idle.
        setPhase((p) => (p === 'listening' ? 'idle' : p));
      },
    });
  };

  const stopListening = async () => {
    await stopVoiceInput();
    if (phase === 'listening') setPhase('idle');
  };

  // Resolve tag names → existing tag IDs (or create new)
  const resolveTagIds = (names: string[]): string[] => {
    if (names.length === 0) return [];
    const ids: string[] = [];
    for (const raw of names) {
      const lower = raw.toLowerCase();
      const existing = tags.find((t) => t.name.toLowerCase() === lower);
      if (existing) ids.push(existing.id);
      else {
        const created = addTag(raw);
        ids.push(created.id);
      }
    }
    return ids;
  };

  const handleSave = () => {
    if (!captured || !captured.title.trim()) return;
    if (captured.kind === 'task') {
      addTask({
        title: captured.title,
        notes: captured.body,
        completed: false,
        priority: captured.priority === 'none' ? 'medium' : captured.priority,
        dueDate: captured.dueDate,
        reminderDate: captured.reminderDate,
        repeat: 'none',
        subtasks: [],
        attachments: [],
        categoryId: null,
      });
    } else {
      const tagIds = resolveTagIds(captured.tags);
      addNote({
        title: captured.title,
        content: captured.body ? `<p>${captured.body}</p>` : '',
        plainText: captured.body,
        folderId: null,
        tagIds,
        isFavorite: false,
        isPinned: false,
        color: null,
        category: 'none',
        attachments: [],
        reminderId: null,
      });
    }
    setPhase('saved');
    setTimeout(() => navigation.goBack(), 1100);
  };

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: theme.spacing.lg,
      paddingTop: insets.top + theme.spacing.md,
      paddingBottom: theme.spacing.sm,
    },
    title: { ...theme.typography.title, fontSize: 22, fontWeight: '800', color: theme.colors.text },
    closeBtn: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: theme.colors.inputBg,
      alignItems: 'center', justifyContent: 'center',
    },
    body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: theme.spacing.lg },

    micBtn: {
      width: 140, height: 140, borderRadius: 70,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: theme.colors.primary,
      ...theme.shadows.fab,
    },
    micBtnListening: { backgroundColor: theme.colors.error },
    hint: {
      marginTop: theme.spacing.xl,
      fontSize: 15, color: theme.colors.textMuted,
      textAlign: 'center', maxWidth: 320, lineHeight: 22,
    },
    transcriptBox: {
      marginTop: theme.spacing.xl,
      padding: theme.spacing.md,
      width: '100%',
      maxWidth: 420,
      backgroundColor: theme.colors.cardBg,
      borderRadius: 14,
      minHeight: 70,
    },
    transcriptText: {
      fontSize: 15, color: theme.colors.text, lineHeight: 22,
    },

    examples: {
      marginTop: theme.spacing.lg,
      paddingHorizontal: theme.spacing.lg,
      gap: 8,
      maxWidth: 380,
    },
    exampleText: {
      fontSize: 12, color: theme.colors.textMuted, fontStyle: 'italic', textAlign: 'center',
    },

    // Preview
    previewCard: {
      width: '100%', maxWidth: 420,
      backgroundColor: theme.colors.cardBg,
      borderRadius: 18,
      padding: theme.spacing.lg,
      ...theme.shadows.card,
    },
    kindBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: 10, paddingVertical: 4,
      borderRadius: 999,
      marginBottom: 10,
    },
    kindBadgeText: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
    previewTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.text, marginBottom: 6 },
    previewBody: { fontSize: 13, color: theme.colors.textMuted, lineHeight: 19, marginBottom: 12 },
    metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    metaChip: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      backgroundColor: theme.colors.inputBg,
      paddingHorizontal: 10, paddingVertical: 5,
      borderRadius: 999,
    },
    metaChipText: { fontSize: 11, fontWeight: '700', color: theme.colors.text },

    btnRow: {
      flexDirection: 'row',
      gap: 10,
      width: '100%',
      maxWidth: 420,
      marginTop: theme.spacing.lg,
    },
    primaryBtn: {
      flex: 2,
      backgroundColor: theme.colors.primary,
      paddingVertical: 14, borderRadius: 14,
      alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8,
    },
    primaryBtnText: { color: '#FFF', fontSize: 14, fontWeight: '800' },
    secondaryBtn: {
      flex: 1,
      backgroundColor: theme.colors.inputBg,
      paddingVertical: 14, borderRadius: 14,
      alignItems: 'center',
    },
    secondaryBtnText: { color: theme.colors.text, fontSize: 14, fontWeight: '700' },

    aiBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      backgroundColor: '#7C3AED20',
      paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
    },
    aiBadgeText: { fontSize: 10, fontWeight: '800', color: '#7C3AED', letterSpacing: 0.5 },
  }), [theme, insets]);

  // ── PREVIEW ─────────────────────────────────────────────────────────────
  if (phase === 'preview' && captured) {
    const dueText = captured.dueDate
      ? new Date(captured.dueDate).toLocaleString(undefined, {
          weekday: 'short', month: 'short', day: 'numeric',
          hour: 'numeric', minute: '2-digit',
        })
      : null;

    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Voice Capture 🎙</Text>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={20} color={theme.colors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          <View style={styles.previewCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <View style={[styles.kindBadge, {
                backgroundColor: captured.kind === 'task' ? '#3B82F622' : '#10B98122',
              }]}>
                <Text style={[styles.kindBadgeText, {
                  color: captured.kind === 'task' ? '#3B82F6' : '#10B981',
                }]}>
                  {captured.kind === 'task' ? 'TASK' : 'NOTE'}
                </Text>
              </View>
              {captured.parsedByAi && (
                <View style={styles.aiBadge}>
                  <Ionicons name="sparkles" size={10} color="#7C3AED" />
                  <Text style={styles.aiBadgeText}>AI</Text>
                </View>
              )}
            </View>

            <Text style={styles.previewTitle}>{captured.title}</Text>
            {captured.body.length > 0 && (
              <Text style={styles.previewBody}>{captured.body}</Text>
            )}

            <View style={styles.metaRow}>
              {dueText && (
                <View style={styles.metaChip}>
                  <Ionicons name="time-outline" size={12} color={theme.colors.text} />
                  <Text style={styles.metaChipText}>{dueText}</Text>
                </View>
              )}
              {captured.reminderDate && captured.reminderDate !== captured.dueDate && (
                <View style={styles.metaChip}>
                  <Ionicons name="notifications-outline" size={12} color={theme.colors.text} />
                  <Text style={styles.metaChipText}>Reminder set</Text>
                </View>
              )}
              {captured.priority !== 'none' && (
                <View style={[styles.metaChip, {
                  backgroundColor: captured.priority === 'high' ? '#EF444422' : theme.colors.inputBg,
                }]}>
                  <Ionicons name="flag-outline" size={12} color={captured.priority === 'high' ? '#EF4444' : theme.colors.text} />
                  <Text style={[styles.metaChipText, captured.priority === 'high' && { color: '#EF4444' }]}>
                    {captured.priority}
                  </Text>
                </View>
              )}
              {captured.tags.map((t) => (
                <View key={t} style={styles.metaChip}>
                  <Text style={styles.metaChipText}>#{t}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.primaryBtn} onPress={handleSave} activeOpacity={0.85}>
              <Ionicons name="checkmark" size={16} color="#FFF" />
              <Text style={styles.primaryBtnText}>Save {captured.kind}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={startListening} activeOpacity={0.7}>
              <Text style={styles.secondaryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // ── SAVED CONFIRMATION ──────────────────────────────────────────────────
  if (phase === 'saved' && captured) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Voice Capture 🎙</Text>
        </View>
        <View style={styles.body}>
          <View style={{
            width: 96, height: 96, borderRadius: 48,
            backgroundColor: theme.colors.success + '22',
            borderWidth: 3, borderColor: theme.colors.success,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Ionicons name="checkmark" size={48} color={theme.colors.success} />
          </View>
          <Text style={[styles.title, { marginTop: 24 }]}>
            ✓ Added "{captured.title}"
          </Text>
        </View>
      </View>
    );
  }

  // ── IDLE / LISTENING / PARSING ─────────────────────────────────────────
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Voice Capture 🎙</Text>
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={20} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        <Animated.View style={{ transform: [{ scale: pulse }] }}>
          <TouchableOpacity
            style={[styles.micBtn, phase === 'listening' && styles.micBtnListening]}
            onPress={phase === 'listening' ? stopListening : startListening}
            disabled={phase === 'parsing'}
            activeOpacity={0.85}
          >
            {phase === 'parsing' ? (
              <ActivityIndicator size="large" color="#FFF" />
            ) : (
              <Ionicons
                name={phase === 'listening' ? 'stop' : 'mic'}
                size={56}
                color="#FFF"
              />
            )}
          </TouchableOpacity>
        </Animated.View>

        <Text style={styles.hint}>
          {phase === 'listening'
            ? 'Listening… speak naturally'
            : phase === 'parsing'
              ? 'Understanding what you said…'
              : 'Tap and tell me what you want to remember'}
        </Text>

        {(transcript || partial) && phase !== 'preview' && (
          <View style={styles.transcriptBox}>
            <Text style={styles.transcriptText}>{transcript || partial}</Text>
          </View>
        )}

        {phase === 'idle' && (
          <View style={styles.examples}>
            <Text style={styles.exampleText}>
              "Remind me to call Ali tomorrow at 3, about the proposal"
            </Text>
            <Text style={styles.exampleText}>
              "Note: groceries — milk, bread, coffee"
            </Text>
            <Text style={styles.exampleText}>
              "Urgent task: send the report by 5 pm"
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}
