import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Modal, Platform, Alert } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import {
  isVoiceAvailable,
  startVoiceInput,
  stopVoiceInput,
  destroyVoiceInput,
} from '../services/voiceInputService';

interface VoiceInputButtonProps {
  onResult: (text: string) => void;
  size?: number;
  style?: any;
}

export function VoiceInputButton({ onResult, size = 44, style }: VoiceInputButtonProps) {
  const { theme } = useTheme();
  const [listening, setListening] = useState(false);
  const [partialText, setPartialText] = useState('');
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (listening) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.3, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ]),
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [listening]);

  useEffect(() => {
    return () => { destroyVoiceInput(); };
  }, []);

  const handleStop = useCallback(async () => {
    await stopVoiceInput();
    setListening(false);
  }, []);

  const handlePress = useCallback(() => {
    if (listening) {
      handleStop();
      return;
    }

    const available = isVoiceAvailable();
    if (!available) {
      Alert.alert('Voice Unavailable', 'Speech recognition module not found. The app needs to be rebuilt.');
      return;
    }

    setPartialText('');
    startVoiceInput({
      onResult: (text) => {
        setPartialText(text);
        onResult(text);
        setListening(false);
      },
      onPartial: (text) => {
        setPartialText(text);
      },
      onStart: () => {
        setListening(true);
      },
      onEnd: () => {
        setListening(false);
      },
      onError: (err) => {
        setListening(false);
        Alert.alert('Voice Error', err);
      },
    }).then((started) => {
      if (!started) setListening(false);
    });
  }, [listening, onResult, handleStop]);

  if (Platform.OS !== 'android') return null;

  return (
    <>
      <Pressable
        onPress={handlePress}
        hitSlop={12}
        style={[{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: listening ? theme.colors.error : theme.colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
          elevation: 3,
          zIndex: 10,
        }, style]}
      >
        <Ionicons name={listening ? 'stop' : 'mic'} size={size * 0.5} color="#FFF" />
      </Pressable>

      <Modal
        visible={listening}
        transparent
        animationType="fade"
        onRequestClose={handleStop}
      >
        <View style={styles.modal}>
          <View style={[styles.modalCard, { backgroundColor: theme.colors.cardBg }]}>
            <View style={styles.ringContainer}>
              <Animated.View style={[styles.ring, {
                backgroundColor: theme.colors.error + '20',
                transform: [{ scale: pulseAnim }],
              }]} />
              <Pressable style={[styles.stopBtn, { backgroundColor: theme.colors.error }]} onPress={handleStop}>
                <Ionicons name="stop" size={28} color="#FFF" />
              </Pressable>
            </View>

            <Text style={[styles.listeningText, { color: theme.colors.text }]}>
              {partialText ? 'Recognizing...' : 'Listening...'}
            </Text>
            <Text style={[styles.partialText, { color: theme.colors.textSecondary }]}>
              {partialText || 'Speak now'}
            </Text>
            <Text style={[styles.hint, { color: theme.colors.textMuted }]}>Tap to stop</Text>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  modal: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    width: '80%',
    gap: 16,
  },
  ringContainer: {
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  stopBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  listeningText: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 8,
  },
  partialText: {
    fontSize: 15,
    textAlign: 'center',
    minHeight: 40,
    lineHeight: 22,
  },
  hint: {
    fontSize: 12,
  },
});
