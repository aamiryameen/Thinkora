import React from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { useTheme } from '../context/ThemeContext';

/**
 * Full-screen loading state shown until app data is hydrated.
 */
export function AppLoading() {
  const { theme } = useTheme();
  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.background,
          gap: theme.spacing.lg,
        },
      ]}
    >
      <ActivityIndicator size="large" color={theme.colors.primary} />
      <Text style={[styles.label, { ...theme.typography.body, color: theme.colors.textMuted, fontWeight: '500' }]}>
        Loading…
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {},
});
