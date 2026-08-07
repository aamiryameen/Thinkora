import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, FlatList, Image, Modal, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { pickImageFromGallery, takePhoto } from '../services/attachmentService';
import {
  downloadWallpaper, isWallpaperSearchAvailable, saveLocalBackground,
  searchWallpapers, WALLPAPER_CATEGORIES, type Wallpaper,
} from '../services/wallpaperService';

interface Props {
  visible: boolean;
  /** Currently applied background, so it can be shown as selected. */
  currentUri: string | null;
  onSelect: (uri: string | null) => void;
  onClose: () => void;
}

export function BackgroundPickerSheet({ visible, currentUri, onSelect, onClose }: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const [category, setCategory] = useState(WALLPAPER_CATEGORIES[0]);
  const [results, setResults] = useState<Wallpaper[] | null>(null);
  const [busy, setBusy] = useState(false);

  const searchAvailable = isWallpaperSearchAvailable();

  const runSearch = useCallback(async (query: string) => {
    setResults(null);
    const found = await searchWallpapers(query);
    setResults(found);
  }, []);

  useEffect(() => {
    if (!visible || !searchAvailable) return;
    runSearch(category);
  }, [category, runSearch, searchAvailable, visible]);

  const applyWallpaper = useCallback(async (wallpaper: Wallpaper) => {
    setBusy(true);
    try {
      const uri = await downloadWallpaper(wallpaper);
      if (uri) onSelect(uri);
    } finally {
      setBusy(false);
    }
  }, [onSelect]);

  const applyLocal = useCallback(async (fromCamera: boolean) => {
    setBusy(true);
    try {
      const picked = fromCamera ? await takePhoto() : await pickImageFromGallery();
      if (!picked?.uri) return;
      const uri = await saveLocalBackground(picked.uri);
      if (uri) onSelect(uri);
    } catch { /* cancelled */ } finally {
      setBusy(false);
    }
  }, [onSelect]);

  const styles = useMemo(() => StyleSheet.create({
    overlay: { flex: 1, backgroundColor: theme.colors.overlay, justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: 28, borderTopRightRadius: 28,
      paddingTop: theme.spacing.lg,
      paddingBottom: insets.bottom + theme.spacing.md,
      height: '82%',
    },
    grabber: {
      alignSelf: 'center', width: 40, height: 4, borderRadius: 2,
      backgroundColor: theme.colors.border, marginBottom: theme.spacing.md,
    },
    title: {
      ...theme.typography.title, fontSize: 20, fontWeight: '800',
      color: theme.colors.text, paddingHorizontal: theme.spacing.lg,
    },
    actions: {
      flexDirection: 'row', gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md,
    },
    actionBtn: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 6, paddingVertical: 12,
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.inputBg,
    },
    actionText: { ...theme.typography.caption, fontWeight: '700', color: theme.colors.text },
    chips: {
      flexDirection: 'row', gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md,
    },
    chip: {
      paddingHorizontal: 13, paddingVertical: 7,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.inputBg,
    },
    chipOn: { backgroundColor: theme.colors.primaryLight },
    chipText: { ...theme.typography.caption, fontWeight: '700', color: theme.colors.textMuted },
    chipTextOn: { color: theme.colors.primary },
    grid: { paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.lg, gap: 8 },
    tile: {
      flex: 1, aspectRatio: 0.62, margin: 4,
      borderRadius: 12, overflow: 'hidden',
      backgroundColor: theme.colors.inputBg,
      borderWidth: 3, borderColor: 'transparent',
    },
    tileOn: { borderColor: theme.colors.primary },
    credit: {
      position: 'absolute', bottom: 0, left: 0, right: 0,
      paddingHorizontal: 5, paddingVertical: 3,
      backgroundColor: '#00000080',
    },
    creditText: { color: '#FFF', fontSize: 8 },
    hint: {
      ...theme.typography.caption, fontSize: 12, color: theme.colors.textMuted,
      textAlign: 'center', lineHeight: 18,
      marginHorizontal: theme.spacing.lg,
      backgroundColor: theme.colors.inputBg,
      padding: theme.spacing.md, borderRadius: theme.borderRadius.md,
    },
    center: { paddingVertical: theme.spacing.xxl, alignItems: 'center' },
  }), [insets.bottom, theme]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.grabber} />
          <Text style={styles.title}>Background</Text>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.actionBtn} onPress={() => applyLocal(false)} disabled={busy}>
              <Ionicons name="image-outline" size={17} color={theme.colors.text} />
              <Text style={styles.actionText}>Gallery</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => applyLocal(true)} disabled={busy}>
              <Ionicons name="camera-outline" size={17} color={theme.colors.text} />
              <Text style={styles.actionText}>Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => onSelect(null)}
              disabled={busy || !currentUri}
            >
              <Ionicons
                name="close-circle-outline" size={17}
                color={currentUri ? theme.colors.error : theme.colors.textDisabled}
              />
              <Text style={styles.actionText}>None</Text>
            </TouchableOpacity>
          </View>

          {!searchAvailable ? (
            <View style={{ paddingTop: theme.spacing.lg }}>
              <Text style={styles.hint}>
                Add a free Pexels API key to browse wallpapers in-app.
                {'\n'}Gallery and camera work without it.
              </Text>
            </View>
          ) : (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.chips}>
                  {WALLPAPER_CATEGORIES.map(c => (
                    <TouchableOpacity
                      key={c}
                      style={[styles.chip, category === c && styles.chipOn]}
                      onPress={() => setCategory(c)}
                    >
                      <Text style={[styles.chipText, category === c && styles.chipTextOn]}>
                        {c === 'mobile wallpaper' ? 'Featured' : c}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              {results === null ? (
                <View style={styles.center}>
                  <ActivityIndicator color={theme.colors.primary} />
                </View>
              ) : results.length === 0 ? (
                <Text style={styles.hint}>
                  Couldn't load wallpapers. Check your connection, or use gallery instead.
                </Text>
              ) : (
                <FlatList
                  data={results}
                  keyExtractor={w => w.id}
                  numColumns={3}
                  contentContainerStyle={styles.grid}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[styles.tile, currentUri?.includes(item.id) && styles.tileOn]}
                      onPress={() => applyWallpaper(item)}
                      activeOpacity={0.8}
                      disabled={busy}
                    >
                      <Image
                        source={{ uri: item.thumbUrl }}
                        style={StyleSheet.absoluteFill}
                        resizeMode="cover"
                      />
                      {/* Pexels asks for photographer credit where practical. */}
                      <View style={styles.credit}>
                        <Text style={styles.creditText} numberOfLines={1}>
                          {item.photographer}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )}
                />
              )}
            </>
          )}

          {busy && (
            <View style={[StyleSheet.absoluteFill, {
              backgroundColor: theme.colors.overlay,
              alignItems: 'center', justifyContent: 'center',
            }]}>
              <ActivityIndicator color={theme.colors.primary} size="large" />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}
