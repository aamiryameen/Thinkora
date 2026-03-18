import React, { useRef, useMemo } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Modal,
  Platform,
  Dimensions,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

let SignatureCanvas: any = null;
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
  const sigRef = useRef<any>(null);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        overlay: {
          flex: 1,
          backgroundColor: theme.colors.background,
        },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingTop: 48,
          paddingBottom: 12,
          backgroundColor: theme.colors.surface,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.colors.border,
        },
        headerTitle: {
          fontSize: 17,
          fontWeight: '700',
          color: theme.colors.text,
        },
        headerBtn: {
          width: 36,
          height: 36,
          borderRadius: 10,
          backgroundColor: theme.colors.inputBg,
          alignItems: 'center',
          justifyContent: 'center',
        },
        saveBtn: {
          backgroundColor: theme.colors.primary,
          borderRadius: 10,
          paddingHorizontal: 18,
          paddingVertical: 8,
        },
        saveBtnText: {
          color: '#FFF',
          fontWeight: '700',
          fontSize: 14,
        },
        canvasWrap: {
          flex: 1,
          backgroundColor: '#FFFFFF',
        },
        canvas: {
          flex: 1,
        },
        toolbar: {
          flexDirection: 'row',
          justifyContent: 'center',
          gap: 16,
          paddingVertical: 12,
          backgroundColor: theme.colors.surface,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: theme.colors.border,
        },
        toolBtn: {
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: theme.colors.inputBg,
          alignItems: 'center',
          justifyContent: 'center',
        },
        unsupportedBox: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
        },
        unsupportedText: {
          fontSize: 15,
          color: theme.colors.textSecondary,
        },
      }),
    [theme]
  );

  if (Platform.OS !== 'android' || !SignatureCanvas) {
    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <View style={[styles.overlay, { justifyContent: 'center', alignItems: 'center' }]}>
          <Text style={styles.unsupportedText}>Sketch is only supported on Android.</Text>
          <TouchableOpacity style={styles.saveBtn} onPress={onClose}>
            <Text style={styles.saveBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  const webStyle = `
    .m-signature-pad {
      box-shadow: none;
      border: none;
      margin: 0;
      width: 100%;
      height: 100%;
    }
    .m-signature-pad--body {
      border: none;
      width: 100%;
      height: 100%;
    }
    .m-signature-pad--footer {
      display: none;
    }
    body, html {
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0;
    }
  `;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerBtn} onPress={onClose}>
            <Ionicons name="close" size={20} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Draw Sketch</Text>
          <TouchableOpacity
            style={styles.saveBtn}
            onPress={() => {
              // Trigger signature canvas to call onOK with the base64 data
              sigRef.current?.readSignature();
            }}
          >
            <Text style={styles.saveBtnText}>Save</Text>
          </TouchableOpacity>
        </View>

        {/* Canvas */}
        <View style={styles.canvasWrap}>
          <SignatureCanvas
            ref={sigRef}
            onOK={(base64: string) => {
              onSave(base64);
              onClose();
            }}
            onEmpty={() => {}}
            webStyle={webStyle}
            style={styles.canvas}
            backgroundColor="#FFFFFF"
            penColor="#000000"
            minWidth={2}
            maxWidth={4}
            autoClear={false}
            descriptionText=""
            clearText="Clear"
            confirmText="Save"
          />
        </View>

        {/* Toolbar */}
        <View style={styles.toolbar}>
          <TouchableOpacity
            style={styles.toolBtn}
            onPress={() => sigRef.current?.clearSignature()}
          >
            <Ionicons name="trash-outline" size={20} color={theme.colors.error} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.toolBtn}
            onPress={() => sigRef.current?.undo()}
          >
            <Ionicons name="arrow-undo-outline" size={20} color={theme.colors.text} />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
