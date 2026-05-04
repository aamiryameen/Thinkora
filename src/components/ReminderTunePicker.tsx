import React, { useMemo, useCallback, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import {
  REMINDER_TUNES,
  previewReminderTune,
  stopPreviewTune,
  type ReminderTune,
} from '../services/soundService';

interface Props {
  visible: boolean;
  selectedTuneId: string | null; // null = use default
  onSelect: (tuneId: string | null) => void;
  onClose: () => void;
}

export function ReminderTunePicker({ visible, selectedTuneId, onSelect, onClose }: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [playingId, setPlayingId] = useState<string | null>(null);

  // Stop any playing preview when modal closes
  useEffect(() => {
    if (!visible) {
      stopPreviewTune();
      setPlayingId(null);
    }
  }, [visible]);

  const startPreview = useCallback((tune: ReminderTune) => {
    setPlayingId(tune.id);
    previewReminderTune(tune, () => {
      setPlayingId((curr) => (curr === tune.id ? null : curr));
    });
  }, []);

  const handleSelect = useCallback((tune: ReminderTune | null) => {
    // Selecting silently — never auto-play. Use the play button to preview.
    stopPreviewTune();
    setPlayingId(null);
    onSelect(tune?.id ?? null);
  }, [onSelect]);

  const handleClose = useCallback(() => {
    stopPreviewTune();
    setPlayingId(null);
    onClose();
  }, [onClose]);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top },
    header: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 16, paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    closeBtn: {
      width: 36, height: 36, borderRadius: 10,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: theme.colors.inputBg,
      marginRight: 12,
    },
    title: { fontSize: 18, fontWeight: '700', color: theme.colors.text, flex: 1 },
    hint: {
      fontSize: 13, color: theme.colors.textMuted,
      marginBottom: 12, paddingHorizontal: 4,
    },
    row: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      padding: 14, marginBottom: 8, borderRadius: 14,
      borderWidth: 2,
    },
    iconCircle: {
      width: 40, height: 40, borderRadius: 10,
      alignItems: 'center', justifyContent: 'center',
    },
    rowLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: theme.colors.text },
    rowSubLabel: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  }), [theme, insets]);

  const renderRow = (
    tune: ReminderTune | null,
    label: string,
    subLabel?: string,
  ) => {
    const id = tune?.id ?? null;
    const isSelected = selectedTuneId === id;
    const isPlaying = tune && playingId === tune.id;
    return (
      <View
        key={id ?? 'default'}
        style={[
          styles.row,
          {
            backgroundColor: isSelected ? theme.colors.primary + '15' : theme.colors.cardBg,
            borderColor: isSelected ? theme.colors.primary : 'transparent',
          },
        ]}
      >
        {/* Tap main row to select only — preview is via the play button */}
        <TouchableOpacity
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}
          onPress={() => {
            // Selecting silently — never auto-play. Stop any current preview.
            stopPreviewTune();
            setPlayingId(null);
            onSelect(id);
          }}
          activeOpacity={0.7}
        >
          <View style={[
            styles.iconCircle,
            { backgroundColor: isSelected ? theme.colors.primary : theme.colors.inputBg },
          ]}>
            <Ionicons
              name={tune ? 'musical-note' : 'settings-outline'}
              size={20}
              color={isSelected ? '#FFF' : theme.colors.textMuted}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowLabel}>{label}</Text>
            {subLabel ? <Text style={styles.rowSubLabel}>{subLabel}</Text> : null}
          </View>
        </TouchableOpacity>

        {/* Right action — selected indicator OR play/stop button */}
        {isSelected && !isPlaying ? (
          <Ionicons name="checkmark-circle" size={22} color={theme.colors.primary} />
        ) : tune ? (
          <TouchableOpacity
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            onPress={() => {
              if (isPlaying) {
                stopPreviewTune();
              } else {
                startPreview(tune);
              }
            }}
          >
            <Ionicons
              name={isPlaying ? 'stop-circle' : 'play-circle-outline'}
              size={28}
              color={isPlaying ? theme.colors.error : theme.colors.textMuted}
            />
          </TouchableOpacity>
        ) : null}
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
            <Ionicons name="close" size={20} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Choose Alarm Sound</Text>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 20 }}>
          <Text style={styles.hint}>
            Tap a sound to select it. Tap the play button to preview.
          </Text>

          {/* Use Default option */}
          {renderRow(null, 'Use Default', 'Whatever you set in Settings')}

          {/* All tunes */}
          {REMINDER_TUNES.map((tune) => renderRow(tune, tune.name))}
        </ScrollView>
      </View>
    </Modal>
  );
}
