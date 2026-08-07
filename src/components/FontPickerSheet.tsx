import React, { useMemo } from 'react';
import {
  Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { fontStyle, NOTE_FONTS } from '../core/fonts';

interface Props {
  visible: boolean;
  currentId: string;
  /** Sample text shown on each tile, so the choice previews real content. */
  sample?: string;
  hasPremium: boolean;
  onSelect: (id: string) => void;
  onLocked: () => void;
  onClose: () => void;
}

export function FontPickerSheet({
  visible, currentId, sample = 'Thinkora', hasPremium, onSelect, onLocked, onClose,
}: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const styles = useMemo(() => StyleSheet.create({
    overlay: { flex: 1, backgroundColor: theme.colors.overlay, justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: 28, borderTopRightRadius: 28,
      paddingTop: theme.spacing.lg,
      paddingBottom: insets.bottom + theme.spacing.lg,
      maxHeight: '80%',
    },
    header: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.md,
    },
    grabber: {
      alignSelf: 'center', width: 40, height: 4, borderRadius: 2,
      backgroundColor: theme.colors.border, marginBottom: theme.spacing.md,
    },
    title: {
      ...theme.typography.title, fontSize: 19, fontWeight: '800',
      color: theme.colors.text, flex: 1,
    },
    grid: {
      flexDirection: 'row', flexWrap: 'wrap',
      paddingHorizontal: theme.spacing.lg, gap: theme.spacing.sm,
      paddingBottom: theme.spacing.lg,
    },
    tile: {
      width: '48%',
      minHeight: 62,
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.inputBg,
      borderWidth: 2, borderColor: 'transparent',
      alignItems: 'center', justifyContent: 'center',
      paddingHorizontal: 8, paddingVertical: 12,
      gap: 2,
    },
    tileOn: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primaryLight },
    sample: { color: theme.colors.text, fontSize: 19 },
    label: { ...theme.typography.caption, fontSize: 9, color: theme.colors.textMuted },
    crown: { position: 'absolute', top: 5, right: 6 },
  }), [insets.bottom, theme]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.grabber} />
          <View style={styles.header}>
            <Text style={styles.title}>Font</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="checkmark" size={24} color={theme.colors.primary} />
            </TouchableOpacity>
          </View>

          <ScrollView>
            <View style={styles.grid}>
              {NOTE_FONTS.map(font => {
                const locked = font.premium && !hasPremium;
                const on = font.id === currentId;
                return (
                  <TouchableOpacity
                    key={font.id}
                    style={[styles.tile, on && styles.tileOn]}
                    onPress={() => (locked ? onLocked() : onSelect(font.id))}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[styles.sample, fontStyle(font.id, 19)]}
                      numberOfLines={1}
                    >
                      {sample}
                    </Text>
                    <Text style={styles.label}>{font.label}</Text>
                    {locked && (
                      <View style={styles.crown}>
                        <Ionicons name="lock-closed" size={11} color={theme.colors.accent} />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
