import React, { useMemo, useState } from 'react';
import {
  FlatList, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { CURRENCIES, formatCurrency } from '../core/currency';

interface Props {
  visible: boolean;
  currentCode: string;
  onSelect: (code: string) => void;
  onClose: () => void;
}

export function CurrencySheet({ visible, currentCode, onSelect, onClose }: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return CURRENCIES;
    return CURRENCIES.filter(
      c => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q),
    );
  }, [query]);

  const styles = useMemo(() => StyleSheet.create({
    overlay: { flex: 1, backgroundColor: theme.colors.overlay, justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: 28, borderTopRightRadius: 28,
      paddingTop: theme.spacing.lg,
      paddingBottom: insets.bottom,
      height: '78%',
    },
    grabber: {
      alignSelf: 'center', width: 40, height: 4, borderRadius: 2,
      backgroundColor: theme.colors.border, marginBottom: theme.spacing.md,
    },
    title: {
      ...theme.typography.title, fontSize: 20, fontWeight: '800',
      color: theme.colors.text, paddingHorizontal: theme.spacing.lg,
    },
    search: {
      margin: theme.spacing.lg,
      marginBottom: theme.spacing.sm,
      backgroundColor: theme.colors.inputBg,
      borderRadius: theme.borderRadius.lg,
      paddingVertical: 11, paddingHorizontal: theme.spacing.lg,
      borderWidth: 2, borderColor: theme.colors.border,
      ...theme.typography.body, color: theme.colors.text,
    },
    row: {
      flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md,
    },
    symbolWrap: {
      width: 44, height: 44, borderRadius: 13,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: theme.colors.inputBg,
    },
    symbol: { fontSize: 17, fontWeight: '800', color: theme.colors.text },
    name: { ...theme.typography.bodySmall, fontWeight: '700', color: theme.colors.text },
    meta: { ...theme.typography.caption, fontSize: 11, color: theme.colors.textMuted },
    empty: {
      ...theme.typography.bodySmall, color: theme.colors.textMuted,
      textAlign: 'center', paddingVertical: theme.spacing.xxl,
    },
  }), [insets.bottom, theme]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.grabber} />
          <Text style={styles.title}>Currency</Text>
          <TextInput
            style={styles.search}
            value={query}
            onChangeText={setQuery}
            placeholder="Search currency"
            placeholderTextColor={theme.colors.textDisabled}
            autoCorrect={false}
          />
          <FlatList
            data={results}
            keyExtractor={c => c.code}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<Text style={styles.empty}>No match</Text>}
            renderItem={({ item }) => {
              const active = item.code === currentCode;
              return (
                <TouchableOpacity
                  style={styles.row}
                  onPress={() => onSelect(item.code)}
                  activeOpacity={0.7}
                >
                  <View style={styles.symbolWrap}>
                    <Text style={styles.symbol}>{item.symbol}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{item.name}</Text>
                    <Text style={styles.meta}>
                      {item.code} · {formatCurrency(1234.5, item)}
                    </Text>
                  </View>
                  {active && (
                    <Ionicons name="checkmark-circle" size={21} color={theme.colors.primary} />
                  )}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
}
