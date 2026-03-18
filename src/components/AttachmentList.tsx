import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Pressable,
  Linking,
  Alert,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import type { NoteAttachment } from '../types';

const TYPE_META: Record<string, { icon: string; color: string; bg: string; label: string }> = {
  pdf:      { icon: 'document-text-outline', color: '#EF4444', bg: '#EF444415', label: 'PDF' },
  document: { icon: 'document-outline',      color: '#F59E0B', bg: '#F59E0B15', label: 'Doc' },
  file:     { icon: 'attach-outline',         color: '#6B7280', bg: '#6B728015', label: 'File' },
  sketch:   { icon: 'pencil-outline',         color: '#8B5CF6', bg: '#8B5CF615', label: 'Sketch' },
  camera:   { icon: 'camera-outline',         color: '#10B981', bg: '#10B98115', label: 'Photo' },
  photo:    { icon: 'image-outline',          color: '#3B82F6', bg: '#3B82F615', label: 'Photo' },
};

function isImage(a: NoteAttachment) {
  return a.type === 'photo' || a.type === 'camera';
}

function canShowImage(a: NoteAttachment) {
  return (isImage(a) || a.type === 'sketch') && !!a.uri;
}

async function openFile(uri: string) {
  try {
    const supported = await Linking.canOpenURL(uri);
    if (supported) {
      await Linking.openURL(uri);
    } else {
      Alert.alert('Cannot open', 'No app available to open this file.');
    }
  } catch {
    Alert.alert('Cannot open', 'Failed to open the file.');
  }
}

export function AttachmentList({
  attachments,
  onRemove,
}: {
  attachments: NoteAttachment[];
  onRemove: (id: string) => void;
}) {
  const { theme } = useTheme();
  const [viewer, setViewer] = useState<NoteAttachment | null>(null);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        sectionTitle: {
          fontSize: 11,
          fontWeight: '600',
          color: theme.colors.textMuted,
          textTransform: 'uppercase',
          letterSpacing: 1,
          marginBottom: theme.spacing.sm,
          marginLeft: theme.spacing.xs,
          marginTop: theme.spacing.lg,
          marginHorizontal: theme.spacing.lg,
        },
        card: {
          marginHorizontal: theme.spacing.lg,
          borderRadius: theme.borderRadius.xl,
          backgroundColor: theme.colors.cardBg,
          padding: theme.spacing.md,
          ...theme.shadows.card,
        },
        scroll: { flexGrow: 0 },
        item: {
          width: 90,
          marginRight: theme.spacing.sm,
          position: 'relative',
        },
        thumb: {
          width: 90,
          height: 90,
          borderRadius: 14,
        },
        iconBox: {
          width: 90,
          height: 90,
          borderRadius: 14,
          alignItems: 'center',
          justifyContent: 'center',
        },
        iconLabel: {
          fontSize: 10,
          fontWeight: '700',
          marginTop: 4,
          letterSpacing: 0.5,
        },
        name: {
          fontSize: 11,
          color: theme.colors.textSecondary,
          marginTop: 5,
          maxWidth: 88,
          textAlign: 'center',
        },
        removeBadge: {
          position: 'absolute',
          top: -6,
          right: -6,
          width: 22,
          height: 22,
          borderRadius: 11,
          backgroundColor: theme.colors.error,
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10,
        },

        /* Viewer */
        viewerOverlay: {
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.92)',
          justifyContent: 'center',
          alignItems: 'center',
        },
        viewerImage: {
          width: '100%',
          height: '80%',
        },
        viewerClose: {
          position: 'absolute',
          top: 52,
          right: 20,
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: 'rgba(255,255,255,0.15)',
          alignItems: 'center',
          justifyContent: 'center',
        },
        viewerName: {
          position: 'absolute',
          bottom: 60,
          color: '#FFF',
          fontSize: 13,
          opacity: 0.8,
          paddingHorizontal: 24,
          textAlign: 'center',
        },
        openFileBtn: {
          position: 'absolute',
          bottom: 30,
          backgroundColor: theme.colors.primary,
          paddingHorizontal: 28,
          paddingVertical: 11,
          borderRadius: 24,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        },
        openFileBtnText: {
          color: '#FFF',
          fontWeight: '600',
          fontSize: 14,
        },
      }),
    [theme]
  );

  if (attachments.length === 0) return null;

  return (
    <>
      <Text style={styles.sectionTitle}>Attachments</Text>
      <View style={styles.card}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll}>
          {attachments.map((a) => {
            const meta = TYPE_META[a.type] ?? TYPE_META.file;
            return (
              <TouchableOpacity
                key={a.id}
                style={styles.item}
                onPress={() => {
                  if (canShowImage(a)) {
                    setViewer(a);
                  } else {
                    openFile(a.uri);
                  }
                }}
                activeOpacity={0.8}
              >
                {canShowImage(a) ? (
                  <Image
                    source={{ uri: a.uri }}
                    style={styles.thumb}
                    resizeMode="cover"
                    onError={() => {}}
                  />
                ) : (
                  <View style={[styles.iconBox, { backgroundColor: meta.bg }]}>
                    <Ionicons name={meta.icon} size={32} color={meta.color} />
                    <Text style={[styles.iconLabel, { color: meta.color }]}>{meta.label}</Text>
                  </View>
                )}
                <Text style={styles.name} numberOfLines={1}>
                  {a.name ?? a.type}
                </Text>
                <TouchableOpacity
                  style={styles.removeBadge}
                  onPress={() => onRemove(a.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close" size={14} color="#FFF" />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Image / sketch viewer */}
      <Modal visible={viewer != null} transparent animationType="fade" onRequestClose={() => setViewer(null)}>
        <Pressable style={styles.viewerOverlay} onPress={() => setViewer(null)}>
          {viewer && canShowImage(viewer) && (
            <Image
              source={{ uri: viewer.uri }}
              style={styles.viewerImage}
              resizeMode="contain"
            />
          )}
          <TouchableOpacity style={styles.viewerClose} onPress={() => setViewer(null)}>
            <Ionicons name="close" size={22} color="#FFF" />
          </TouchableOpacity>
          {viewer?.name ? (
            <Text style={styles.viewerName} numberOfLines={2}>{viewer.name}</Text>
          ) : null}
          {viewer && !isImage(viewer) && viewer.type !== 'sketch' && (
            <TouchableOpacity style={styles.openFileBtn} onPress={() => openFile(viewer.uri)}>
              <Ionicons name="open-outline" size={16} color="#FFF" />
              <Text style={styles.openFileBtnText}>Open File</Text>
            </TouchableOpacity>
          )}
        </Pressable>
      </Modal>
    </>
  );
}
