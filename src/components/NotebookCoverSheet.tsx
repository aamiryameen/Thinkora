import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { COVER_COLORS, COVER_ICONS } from '../core/notebooks';

interface Props {
  visible: boolean;
  /** Empty for a new notebook. */
  initialName?: string;
  initialColor?: string | null;
  initialIcon?: string | null;
  onSave: (values: { name: string; color: string; icon: string }) => void;
  onClose: () => void;
}

export function NotebookCoverSheet({
  visible, initialName = '', initialColor, initialIcon, onSave, onClose,
}: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const [name, setName] = useState(initialName);
  const [color, setColor] = useState(initialColor || COVER_COLORS[0]);
  const [icon, setIcon] = useState(initialIcon || COVER_ICONS[0]);

  // Re-seed each time the sheet opens so editing notebook B never shows
  // notebook A's leftover values.
  useEffect(() => {
    if (!visible) return;
    setName(initialName);
    setColor(initialColor || COVER_COLORS[0]);
    setIcon(initialIcon || COVER_ICONS[0]);
  }, [initialColor, initialIcon, initialName, visible]);

  const styles = useMemo(() => StyleSheet.create({
    overlay: { flex: 1, backgroundColor: theme.colors.overlay, justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: 28, borderTopRightRadius: 28,
      paddingTop: theme.spacing.lg,
      paddingBottom: insets.bottom + theme.spacing.lg,
      maxHeight: '88%',
    },
    grabber: {
      alignSelf: 'center', width: 40, height: 4, borderRadius: 2,
      backgroundColor: theme.colors.border, marginBottom: theme.spacing.md,
    },
    body: { paddingHorizontal: theme.spacing.lg, gap: theme.spacing.lg },
    preview: { alignItems: 'center', gap: theme.spacing.sm },
    coverBig: {
      width: 72, height: 88, borderRadius: 14,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: color,
    },
    label: {
      ...theme.typography.caption, color: theme.colors.textMuted,
      textTransform: 'uppercase', letterSpacing: 1, fontWeight: '700',
    },
    input: {
      backgroundColor: theme.colors.inputBg,
      borderRadius: theme.borderRadius.lg,
      paddingVertical: 12, paddingHorizontal: theme.spacing.lg,
      borderWidth: 2, borderColor: theme.colors.border,
      ...theme.typography.body, color: theme.colors.text,
    },
    swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
    swatch: {
      width: 40, height: 40, borderRadius: 12,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 3, borderColor: 'transparent',
    },
    icons: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
    iconBtn: {
      width: 44, height: 44, borderRadius: 12,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: theme.colors.inputBg,
      borderWidth: 2, borderColor: 'transparent',
    },
    iconBtnActive: { borderColor: color, backgroundColor: color + '18' },
    save: {
      backgroundColor: theme.colors.primary,
      borderRadius: theme.borderRadius.lg,
      paddingVertical: 15, alignItems: 'center',
    },
    saveDisabled: { opacity: 0.45 },
    saveText: { ...theme.typography.button, color: '#FFF', fontWeight: '800' },
  }), [color, insets.bottom, theme]);

  const trimmed = name.trim();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.grabber} />
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <View style={styles.preview}>
              <View style={styles.coverBig}>
                <Ionicons name={icon} size={34} color="#FFF" />
              </View>
            </View>

            <View style={{ gap: theme.spacing.sm }}>
              <Text style={styles.label}>Name</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Notebook name"
                placeholderTextColor={theme.colors.textDisabled}
                maxLength={40}
              />
            </View>

            <View style={{ gap: theme.spacing.sm }}>
              <Text style={styles.label}>Colour</Text>
              <View style={styles.swatches}>
                {COVER_COLORS.map(c => (
                  <TouchableOpacity
                    key={c}
                    style={[
                      styles.swatch,
                      { backgroundColor: c },
                      c === color && { borderColor: theme.colors.text },
                    ]}
                    onPress={() => setColor(c)}
                    activeOpacity={0.8}
                  >
                    {c === color && <Ionicons name="checkmark" size={19} color="#FFF" />}
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={{ gap: theme.spacing.sm }}>
              <Text style={styles.label}>Icon</Text>
              <View style={styles.icons}>
                {COVER_ICONS.map(ic => (
                  <TouchableOpacity
                    key={ic}
                    style={[styles.iconBtn, ic === icon && styles.iconBtnActive]}
                    onPress={() => setIcon(ic)}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={ic}
                      size={21}
                      color={ic === icon ? color : theme.colors.textMuted}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity
              style={[styles.save, !trimmed && styles.saveDisabled]}
              disabled={!trimmed}
              onPress={() => onSave({ name: trimmed, color, icon })}
              activeOpacity={0.85}
            >
              <Text style={styles.saveText}>Save notebook</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
