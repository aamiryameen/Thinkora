import React, { useMemo } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { DASHBOARD_LAYOUTS } from '../core/dashboardLayouts';

interface Props {
  visible: boolean;
  currentId: string;
  hasPremium: boolean;
  onSelect: (id: string) => void;
  onLocked: () => void;
  onClose: () => void;
}

export function DashboardLayoutSheet({
  visible, currentId, hasPremium, onSelect, onLocked, onClose,
}: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const styles = useMemo(() => StyleSheet.create({
    overlay: { flex: 1, backgroundColor: theme.colors.overlay, justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingTop: theme.spacing.lg,
      paddingBottom: insets.bottom + theme.spacing.lg,
      maxHeight: '80%',
    },
    grabber: {
      alignSelf: 'center', width: 40, height: 4, borderRadius: 2,
      backgroundColor: theme.colors.border, marginBottom: theme.spacing.md,
    },
    title: {
      ...theme.typography.title, fontSize: 20, fontWeight: '800',
      color: theme.colors.text,
      paddingHorizontal: theme.spacing.lg,
    },
    subtitle: {
      ...theme.typography.bodySmall, color: theme.colors.textMuted,
      paddingHorizontal: theme.spacing.lg, marginTop: 2,
    },
    list: { padding: theme.spacing.lg, gap: theme.spacing.sm },
    row: {
      flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md,
      padding: theme.spacing.md,
      borderRadius: theme.borderRadius.lg,
      borderWidth: 2, borderColor: theme.colors.border,
      backgroundColor: theme.colors.inputBg,
    },
    rowActive: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primaryLight },
    label: { ...theme.typography.bodySmall, fontWeight: '700', color: theme.colors.text },
    desc: { ...theme.typography.caption, fontSize: 12, color: theme.colors.textMuted, marginTop: 1 },
    proTag: {
      paddingHorizontal: 7, paddingVertical: 2,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.accent + '25',
    },
    proTagText: {
      ...theme.typography.caption, fontSize: 10, fontWeight: '800',
      color: theme.colors.accent, letterSpacing: 0.5,
    },
  }), [insets.bottom, theme]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.grabber} />
          <Text style={styles.title}>Dashboard layout</Text>
          <Text style={styles.subtitle}>Choose which widgets lead your day</Text>

          <ScrollView contentContainerStyle={styles.list}>
            {DASHBOARD_LAYOUTS.map(layout => {
              const locked = layout.premium && !hasPremium;
              const active = layout.id === currentId;
              return (
                <TouchableOpacity
                  key={layout.id}
                  style={[styles.row, active && styles.rowActive]}
                  activeOpacity={0.8}
                  onPress={() => {
                    if (locked) { onLocked(); return; }
                    onSelect(layout.id);
                  }}
                >
                  <Ionicons
                    name={active ? 'radio-button-on' : locked ? 'lock-closed' : 'radio-button-off'}
                    size={20}
                    color={active ? theme.colors.primary : theme.colors.textMuted}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>{layout.label}</Text>
                    <Text style={styles.desc}>{layout.description}</Text>
                  </View>
                  {layout.premium && (
                    <View style={styles.proTag}><Text style={styles.proTagText}>PRO</Text></View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
