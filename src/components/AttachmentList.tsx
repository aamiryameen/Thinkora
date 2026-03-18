import React, { useMemo } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Icon } from './Icons';
import { useTheme } from '../context/ThemeContext';
import type { NoteAttachment } from '../types';

export function AttachmentList({
  attachments,
  onRemove,
  onPress,
}: {
  attachments: NoteAttachment[];
  onRemove: (id: string) => void;
  onPress?: (a: NoteAttachment) => void;
}) {
  const { theme } = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { marginVertical: theme.spacing.sm },
        label: {
          ...theme.typography.label,
          color: theme.colors.textSecondary,
          marginBottom: theme.spacing.xs,
        },
        scroll: { flexGrow: 0 },
        item: {
          width: 80,
          marginRight: theme.spacing.md,
          alignItems: 'center',
        },
        thumb: {
          width: 72,
          height: 72,
          borderRadius: theme.borderRadius.sm,
        },
        iconBox: {
          width: 72,
          height: 72,
          borderRadius: theme.borderRadius.sm,
          backgroundColor: theme.colors.border,
          alignItems: 'center',
          justifyContent: 'center',
        },
        name: {
          ...theme.typography.caption,
          fontSize: 10,
          color: theme.colors.textSecondary,
          marginTop: theme.spacing.xs,
          maxWidth: 76,
        },
        removeBtn: {
          position: 'absolute',
          top: -theme.spacing.xs,
          right: theme.spacing.xs,
        },
      }),
    [theme]
  );

  if (attachments.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Attachments</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll}>
        {attachments.map((a) => (
          <TouchableOpacity
            key={a.id}
            style={styles.item}
            onPress={() => onPress?.(a)}
            activeOpacity={0.8}
          >
            {a.type === 'photo' || a.type === 'camera' ? (
              <Image source={{ uri: a.uri }} style={styles.thumb} resizeMode="cover" />
            ) : (
              <View style={styles.iconBox}>
                <Icon
                  name={a.type === 'pdf' ? 'doc' : a.type === 'sketch' ? 'draw' : 'attach'}
                  size={28}
                />
              </View>
            )}
            <Text style={styles.name} numberOfLines={1}>
              {a.name ?? a.type}
            </Text>
            <TouchableOpacity
              style={styles.removeBtn}
              onPress={() => onRemove(a.id)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Icon name="delete" size={16} />
            </TouchableOpacity>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}
