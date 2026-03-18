import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Vibration } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';

interface Props {
  onUnlock: () => void;
  correctPin: string;
}

export function AppLockScreen({ onUnlock, correctPin }: Props) {
  const { theme } = useTheme();
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  const handlePress = useCallback((digit: string) => {
    setError(false);
    const next = pin + digit;
    if (next.length === 4) {
      if (next === correctPin) {
        onUnlock();
      } else {
        Vibration.vibrate(200);
        setError(true);
        setTimeout(() => { setPin(''); setError(false); }, 600);
      }
    }
    setPin(next.slice(0, 4));
  }, [pin, correctPin, onUnlock]);

  const handleDelete = useCallback(() => {
    setPin((p) => p.slice(0, -1));
    setError(false);
  }, []);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center', paddingHorizontal: theme.spacing.xl },
    icon: { marginBottom: theme.spacing.xl },
    title: { ...theme.typography.title, color: theme.colors.text, marginBottom: theme.spacing.sm },
    subtitle: { ...theme.typography.bodySmall, color: theme.colors.textMuted, marginBottom: theme.spacing.xxl },
    dotsRow: { flexDirection: 'row', gap: theme.spacing.lg, marginBottom: theme.spacing.xxl },
    dot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: theme.colors.border },
    dotFilled: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
    dotError: { backgroundColor: theme.colors.error, borderColor: theme.colors.error },
    keypad: { width: '100%', maxWidth: 280 },
    keyRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: theme.spacing.md },
    key: { width: 72, height: 72, borderRadius: 36, backgroundColor: theme.colors.cardBg, alignItems: 'center', justifyContent: 'center', ...theme.shadows.card },
    keyText: { fontSize: 28, fontWeight: '600', color: theme.colors.text },
    keyEmpty: { backgroundColor: 'transparent', elevation: 0, shadowOpacity: 0 },
    keyDelete: { backgroundColor: 'transparent', elevation: 0, shadowOpacity: 0 },
    errorText: { ...theme.typography.bodySmall, color: theme.colors.error, marginTop: theme.spacing.md },
  }), [theme]);

  const KEYS = [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['', '0', 'del']];

  return (
    <View style={styles.container}>
      <View style={styles.icon}>
        <Ionicons name="lock-closed" size={48} color={theme.colors.primary} />
      </View>
      <Text style={styles.title}>Enter PIN</Text>
      <Text style={styles.subtitle}>Enter your 4-digit PIN to unlock</Text>

      <View style={styles.dotsRow}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={[styles.dot, pin.length > i && styles.dotFilled, error && styles.dotError]} />
        ))}
      </View>

      <View style={styles.keypad}>
        {KEYS.map((row, ri) => (
          <View key={ri} style={styles.keyRow}>
            {row.map((k, ci) => {
              if (k === '') return <View key={ci} style={[styles.key, styles.keyEmpty]} />;
              if (k === 'del') {
                return (
                  <TouchableOpacity key={ci} style={[styles.key, styles.keyDelete]} onPress={handleDelete}>
                    <Ionicons name="backspace-outline" size={28} color={theme.colors.textSecondary} />
                  </TouchableOpacity>
                );
              }
              return (
                <TouchableOpacity key={ci} style={styles.key} onPress={() => handlePress(k)} activeOpacity={0.6}>
                  <Text style={styles.keyText}>{k}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>

      {error && <Text style={styles.errorText}>Incorrect PIN. Try again.</Text>}
    </View>
  );
}

// PIN Setup screen
export function PinSetupScreen({ onComplete }: { onComplete: (pin: string) => void }) {
  const { theme } = useTheme();
  const [step, setStep] = useState<'set' | 'confirm'>('set');
  const [firstPin, setFirstPin] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  const handlePress = useCallback((digit: string) => {
    setError(false);
    const next = pin + digit;
    if (next.length === 4) {
      if (step === 'set') {
        setFirstPin(next);
        setStep('confirm');
        setPin('');
        return;
      }
      if (next === firstPin) {
        onComplete(next);
      } else {
        Vibration.vibrate(200);
        setError(true);
        setTimeout(() => { setPin(''); setError(false); }, 600);
      }
    }
    setPin(next.slice(0, 4));
  }, [pin, step, firstPin, onComplete]);

  const handleDelete = useCallback(() => {
    setPin((p) => p.slice(0, -1));
  }, []);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center', paddingHorizontal: theme.spacing.xl },
    title: { ...theme.typography.title, color: theme.colors.text, marginBottom: theme.spacing.sm },
    subtitle: { ...theme.typography.bodySmall, color: theme.colors.textMuted, marginBottom: theme.spacing.xxl },
    dotsRow: { flexDirection: 'row', gap: theme.spacing.lg, marginBottom: theme.spacing.xxl },
    dot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: theme.colors.border },
    dotFilled: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
    dotError: { backgroundColor: theme.colors.error, borderColor: theme.colors.error },
    keypad: { width: '100%', maxWidth: 280 },
    keyRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: theme.spacing.md },
    key: { width: 72, height: 72, borderRadius: 36, backgroundColor: theme.colors.cardBg, alignItems: 'center', justifyContent: 'center', ...theme.shadows.card },
    keyText: { fontSize: 28, fontWeight: '600', color: theme.colors.text },
    keyEmpty: { backgroundColor: 'transparent', elevation: 0, shadowOpacity: 0 },
    keyDelete: { backgroundColor: 'transparent', elevation: 0, shadowOpacity: 0 },
    errorText: { ...theme.typography.bodySmall, color: theme.colors.error, marginTop: theme.spacing.md },
  }), [theme]);

  const KEYS = [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['', '0', 'del']];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{step === 'set' ? 'Set PIN' : 'Confirm PIN'}</Text>
      <Text style={styles.subtitle}>{step === 'set' ? 'Choose a 4-digit PIN' : 'Re-enter your PIN to confirm'}</Text>
      <View style={styles.dotsRow}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={[styles.dot, pin.length > i && styles.dotFilled, error && styles.dotError]} />
        ))}
      </View>
      <View style={styles.keypad}>
        {KEYS.map((row, ri) => (
          <View key={ri} style={styles.keyRow}>
            {row.map((k, ci) => {
              if (k === '') return <View key={ci} style={[styles.key, styles.keyEmpty]} />;
              if (k === 'del') return <TouchableOpacity key={ci} style={[styles.key, styles.keyDelete]} onPress={handleDelete}><Ionicons name="backspace-outline" size={28} color={theme.colors.textSecondary} /></TouchableOpacity>;
              return <TouchableOpacity key={ci} style={styles.key} onPress={() => handlePress(k)} activeOpacity={0.6}><Text style={styles.keyText}>{k}</Text></TouchableOpacity>;
            })}
          </View>
        ))}
      </View>
      {error && <Text style={styles.errorText}>PINs don't match. Try again.</Text>}
    </View>
  );
}
