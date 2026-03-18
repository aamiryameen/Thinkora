import React, { useMemo } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Modal,
  Platform,
} from 'react-native';
import { Icon } from './Icons';
import { useTheme } from '../context/ThemeContext';

let SignatureCanvas: React.ComponentType<{
  onOK: (base64: string) => void;
  onClear: () => void;
  onEmpty: () => void;
  descriptionText?: string;
  clearText?: string;
  confirmText?: string;
  webStyle?: string;
  style?: object;
}> | null = null;

if (Platform.OS === 'android') {
  try {
    SignatureCanvas = require('react-native-signature-canvas').default;
  } catch {
    SignatureCanvas = null;
  }
}

export function SketchCanvasModal({
  visible,
  onClose,
  onSave,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (base64: string) => void;
}) {
  const { theme } = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        overlay: {
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          padding: 16,
        },
        box: {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.borderRadius.lg,
          padding: theme.spacing.xxl,
          alignItems: 'center',
        },
        unsupported: {
          ...theme.typography.body,
          color: theme.colors.textSecondary,
          marginBottom: theme.spacing.lg,
        },
        btn: {
          paddingVertical: theme.spacing.sm,
          paddingHorizontal: theme.spacing.xxl,
          backgroundColor: theme.colors.primary,
        },
        btnText: { ...theme.typography.button, color: theme.colors.surface },
        container: {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.borderRadius.lg,
          maxHeight: '80%',
        },
        header: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: theme.spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border,
        },
        title: { ...theme.typography.title, color: theme.colors.text },
        canvasWrap: { height: 300 },
        canvas: { flex: 1, height: 300 },
      }),
    [theme]
  );

  if (Platform.OS !== 'android' || !SignatureCanvas) {
    return (
      <Modal visible={visible} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.box}>
            <Text style={styles.unsupported}>Sketches are only supported on Android.</Text>
            <TouchableOpacity style={styles.btn} onPress={onClose}>
              <Text style={styles.btnText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Draw a sketch</Text>
            <TouchableOpacity onPress={onClose}>
              <Icon name="back" size={24} />
            </TouchableOpacity>
          </View>
          <View style={styles.canvasWrap}>
            <SignatureCanvas
              onOK={(base64) => {
                onSave(base64);
                onClose();
              }}
              onClear={() => {}}
              onEmpty={() => {}}
              descriptionText=""
              clearText="Clear"
              confirmText="Save"
              webStyle={`.m-signature-pad { box-shadow: none; border: 1px solid ${theme.colors.border}; }`}
              style={styles.canvas}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}
