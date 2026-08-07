import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { usePremium, type PremiumFeature } from '../services/premiumService';
import { PremiumGateSheet } from './PremiumGateSheet';

interface Props {
  feature: PremiumFeature;
  title: string;
  children: React.ReactNode;
}

/**
 * Blocks a whole screen behind the premium entitlement.
 *
 * Screens can be reached from several places — the Dashboard grid links
 * straight to routes — so gating only the buttons that lead in leaves the
 * screen open. This wraps the screen itself, which no entry point can bypass.
 */
export function PremiumScreenGate({ feature, title, children }: Props) {
  const nav = useNavigation();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { hasPremium, loading } = usePremium();

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
    iconBtn: {
      width: 38, height: 38, borderRadius: 12,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: theme.colors.inputBg,
    },
    title: {
      ...theme.typography.title, fontSize: 22, fontWeight: '700',
      color: theme.colors.text, flex: 1,
    },
  }), [insets.top, theme]);

  // While loading, render nothing rather than flashing the paywall at someone
  // who has already paid.
  if (loading) return <View style={styles.container} />;
  if (hasPremium) return <>{children}</>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => nav.goBack()}>
          <Ionicons name="chevron-back" size={20} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{title}</Text>
      </View>
      <PremiumGateSheet visible feature={feature} onClose={() => nav.goBack()} />
    </View>
  );
}
