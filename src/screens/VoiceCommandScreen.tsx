import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';
import { startVoiceInput, stopVoiceInput, isVoiceAvailable } from '../services/voiceInputService';
import { parseVoiceCommand, describeIntent, type VoiceIntent } from '../services/voiceCommandService';
import type { RootStackParamList } from '../navigation/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

const EXAMPLES = [
  '"Add task buy groceries tomorrow at 5pm"',
  '"New note shopping list"',
  '"Start a 25 minute focus session"',
  '"Show my goals"',
  '"Remind me to call mom tonight"',
];

export function VoiceCommandScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { addTask, addNote } = useApp();

  const [listening, setListening] = useState(false);
  const [partial, setPartial] = useState('');
  const [final, setFinal] = useState('');
  const [intent, setIntent] = useState<VoiceIntent | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const pulse = useRef(new Animated.Value(1)).current;

  // Pulsing mic animation while listening
  useEffect(() => {
    if (listening) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.25, duration: 600, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1.0, duration: 600, useNativeDriver: true }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulse.setValue(1);
    }
  }, [listening, pulse]);

  useEffect(() => {
    return () => { stopVoiceInput().catch(() => {}); };
  }, []);

  const startListening = async () => {
    if (!isVoiceAvailable()) {
      Alert.alert('Voice Unavailable', 'Speech recognition not available on this device.');
      return;
    }
    setFinal(''); setPartial(''); setIntent(null); setConfirmed(false);
    setListening(true);
    await startVoiceInput({
      onPartial: (txt) => setPartial(txt),
      onResult: (txt) => {
        setFinal(txt);
        setListening(false);
        const parsed = parseVoiceCommand(txt);
        setIntent(parsed);
      },
      onError: () => { setListening(false); },
      onEnd: () => { setListening(false); },
    });
  };

  const stopListening = async () => {
    await stopVoiceInput();
    setListening(false);
  };

  const executeIntent = (i: VoiceIntent) => {
    if (confirmed) return;
    switch (i.type) {
      case 'add_task': {
        addTask({
          title: i.title || 'Task',
          notes: '',
          completed: false,
          priority: i.priority ?? 'medium',
          dueDate: i.dueDate ?? null,
          reminderDate: i.dueDate ?? null,
          repeat: 'none',
          subtasks: [],
          attachments: [],
          categoryId: null,
        });
        setConfirmed(true);
        setTimeout(() => navigation.goBack(), 800);
        break;
      }
      case 'add_note': {
        addNote({
          title: i.title || 'Note',
          content: i.body ? `<p>${i.body}</p>` : '',
          plainText: i.body ?? '',
          folderId: null,
          tagIds: [],
          isFavorite: false,
          isPinned: false,
          color: null,
          category: 'none',
          attachments: [],
          reminderId: null,
        });
        setConfirmed(true);
        setTimeout(() => navigation.goBack(), 800);
        break;
      }
      case 'start_pomodoro': {
        navigation.replace('Pomodoro');
        break;
      }
      case 'navigate': {
        if (i.route === 'MyDay' || i.route === 'Tasks' || i.route === 'Notes') {
          navigation.navigate('Home' as any);
        } else {
          navigation.replace(i.route as any);
        }
        break;
      }
    }
  };

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top },
    header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
    headerTitle: { fontSize: 20, fontWeight: '800', color: theme.colors.text, flex: 1 },
    body: { flex: 1, paddingHorizontal: 24, justifyContent: 'center', alignItems: 'center', gap: 24 },
    micWrap: {
      width: 160, height: 160, borderRadius: 80,
      backgroundColor: theme.colors.primary,
      alignItems: 'center', justifyContent: 'center',
      shadowColor: theme.colors.primary,
      shadowOpacity: 0.5, shadowRadius: 30, shadowOffset: { width: 0, height: 12 },
      elevation: 16,
    },
    transcript: {
      minHeight: 60, alignItems: 'center', paddingHorizontal: 16,
    },
    partialText: { fontSize: 22, fontWeight: '700', color: theme.colors.textMuted, textAlign: 'center', lineHeight: 30 },
    finalText: { fontSize: 22, fontWeight: '800', color: theme.colors.text, textAlign: 'center', lineHeight: 30 },
    statusText: { fontSize: 13, color: theme.colors.textMuted, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' },
    resultCard: {
      backgroundColor: theme.colors.cardBg,
      borderRadius: theme.borderRadius.xl,
      padding: 20,
      width: '100%',
      gap: 12,
      ...theme.shadows.card,
    },
    resultHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    resultTitle: { fontSize: 14, fontWeight: '800', color: theme.colors.text, flex: 1 },
    resultDesc: { fontSize: 14, fontWeight: '500', color: theme.colors.text, lineHeight: 20 },
    confirmBtn: {
      backgroundColor: theme.colors.primary, borderRadius: 14,
      paddingVertical: 14, alignItems: 'center',
    },
    confirmBtnText: { color: '#FFF', fontWeight: '800', fontSize: 15 },
    cancelBtn: { alignItems: 'center', paddingVertical: 8 },
    cancelBtnText: { color: theme.colors.textMuted, fontWeight: '600', fontSize: 13 },
    examples: { paddingHorizontal: 24, paddingBottom: insets.bottom + 24, gap: 6 },
    examplesTitle: { fontSize: 11, fontWeight: '800', color: theme.colors.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
    exampleText: { fontSize: 13, color: theme.colors.textMuted, fontStyle: 'italic' },
  }), [theme, insets]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
          <Ionicons name="close" size={26} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Voice Command</Text>
      </View>

      <View style={styles.body}>
        <Text style={styles.statusText}>
          {listening ? 'Listening…' : confirmed ? 'Done!' : final ? 'Got it' : 'Tap mic to speak'}
        </Text>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={listening ? stopListening : startListening}
          disabled={confirmed}
        >
          <Animated.View style={[styles.micWrap, { transform: [{ scale: pulse }] }]}>
            <Ionicons
              name={listening ? 'stop' : confirmed ? 'checkmark' : 'mic'}
              size={64} color="#FFF"
            />
          </Animated.View>
        </TouchableOpacity>

        <View style={styles.transcript}>
          {final ? (
            <Text style={styles.finalText}>"{final}"</Text>
          ) : partial ? (
            <Text style={styles.partialText}>"{partial}"</Text>
          ) : null}
        </View>

        {intent && !confirmed && (
          <View style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <Ionicons
                name={
                  intent.type === 'add_task' ? 'checkbox-outline' :
                  intent.type === 'add_note' ? 'document-text-outline' :
                  intent.type === 'start_pomodoro' ? 'timer-outline' :
                  intent.type === 'navigate' ? 'compass-outline' :
                  'help-circle-outline'
                }
                size={22} color={theme.colors.primary}
              />
              <Text style={styles.resultTitle}>
                {intent.type === 'unknown' ? "Couldn't parse" : 'Action ready'}
              </Text>
            </View>
            <Text style={styles.resultDesc}>{describeIntent(intent)}</Text>
            {intent.type !== 'unknown' && (
              <TouchableOpacity style={styles.confirmBtn} onPress={() => executeIntent(intent)}>
                <Text style={styles.confirmBtnText}>Confirm</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.cancelBtn} onPress={() => { setIntent(null); setFinal(''); }}>
              <Text style={styles.cancelBtnText}>Try again</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.examples}>
        <Text style={styles.examplesTitle}>Try saying</Text>
        {EXAMPLES.map(e => <Text key={e} style={styles.exampleText}>{e}</Text>)}
      </View>
    </View>
  );
}
