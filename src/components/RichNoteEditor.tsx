import React, { useRef, useCallback, useEffect, useState, useMemo, useImperativeHandle, forwardRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Animated,
  Easing,
  Platform,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { EDITOR_CONTENT_DEBOUNCE_MS } from '../core/constants';
import { useTheme } from '../context/ThemeContext';
import { stripHtml } from '../utils/stripHtml';

const RichEditor = Platform.OS === 'android'
  ? require('react-native-pell-rich-editor').RichEditor
  : null;
const RichToolbar = Platform.OS === 'android'
  ? require('react-native-pell-rich-editor').RichToolbar
  : null;
const actions = Platform.OS === 'android'
  ? require('react-native-pell-rich-editor').actions
  : { setBold: '', setItalic: '', setUnderline: '', insertBulletsList: '', insertOrderedList: '' };

export interface RichNoteEditorHandle {
  insertText: (text: string) => void;
}

interface RichNoteEditorProps {
  title: string;
  content: string;
  onTitleChange: (title: string) => void;
  onContentChange: (content: string, plainText: string) => void;
  placeholder?: string;
  editable?: boolean;
  contentRestoreKey?: number;
  titleVoiceActive?: boolean;
  onTitleVoicePress?: () => void;
  contentVoiceActive?: boolean;
  onContentVoicePress?: () => void;
}

/** Slow shimmer for the focus accent under the title. */
function useShimmerLoop() {
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(value, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [value]);
  return value;
}

export const RichNoteEditor = forwardRef<RichNoteEditorHandle, RichNoteEditorProps>(function RichNoteEditor({
  title,
  content,
  onTitleChange,
  onContentChange,
  placeholder = 'Begin your story…',
  editable = true,
  contentRestoreKey = 0,
  titleVoiceActive = false,
  onTitleVoicePress,
  contentVoiceActive = false,
  onContentVoicePress,
}: RichNoteEditorProps, ref) {
  const { theme } = useTheme();
  const richRef = useRef<{
    setContentHTML: (html: string) => void;
    getContentHtml: () => Promise<string>;
  } | null>(null);
  const [editorReady, setEditorReady] = useState(false);
  const contentChangeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shimmer = useShimmerLoop();

  useImperativeHandle(ref, () => ({
    insertText: (text: string) => {
      if (richRef.current && Platform.OS === 'android') {
        (richRef.current as any).insertText(text);
        setTimeout(() => flushContent(), 300);
      }
    },
  }));

  const lastRestoreKeyRef = useRef(0);
  useEffect(() => {
    if (contentRestoreKey === 0 || lastRestoreKeyRef.current === contentRestoreKey) return;
    if (Platform.OS !== 'android') return;
    lastRestoreKeyRef.current = contentRestoreKey;
    const apply = () => {
      if (richRef.current) richRef.current.setContentHTML(content || '');
    };
    apply();
    const t = setTimeout(apply, 50);
    return () => clearTimeout(t);
  }, [contentRestoreKey, content]);

  const flushContent = useCallback(async () => {
    if (Platform.OS !== 'android' || !richRef.current) return;
    try {
      const html = await richRef.current.getContentHtml();
      const plain = stripHtml(html);
      onContentChange(html, plain);
    } catch {
      // ignore
    }
  }, [onContentChange]);

  const scheduleContentSave = useCallback(() => {
    if (contentChangeTimeout.current) clearTimeout(contentChangeTimeout.current);
    contentChangeTimeout.current = setTimeout(() => {
      contentChangeTimeout.current = null;
      flushContent();
    }, EDITOR_CONTENT_DEBOUNCE_MS);
  }, [flushContent]);

  const handleEditorChange = useCallback(
    (data: string | undefined) => {
      const html = typeof data === 'string' ? data : '';
      const plain = stripHtml(html);
      onContentChange(html, plain);
      scheduleContentSave();
    },
    [onContentChange, scheduleContentSave]
  );

  useEffect(() => {
    return () => {
      if (contentChangeTimeout.current) clearTimeout(contentChangeTimeout.current);
    };
  }, []);

  const wordCount = useMemo(() => {
    const plain = content ? stripHtml(content).trim() : '';
    if (!plain) return 0;
    return plain.split(/\s+/).filter(Boolean).length;
  }, [content]);
  const charCount = useMemo(() => (content ? stripHtml(content).length : 0), [content]);
  const readingMin = Math.max(1, Math.ceil(wordCount / 220));
  const todayLabel = useMemo(
    () =>
      new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }),
    [],
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1 },
        fallback: { flex: 1 },

        /* ── Cinematic cover band ─────────────────────── */
        cover: {
          height: 96,
          width: '100%',
          backgroundColor: theme.colors.primary + '12',
          overflow: 'hidden',
        },
        coverGradTop: {
          position: 'absolute',
          top: 0, left: 0, right: 0, height: '60%',
          backgroundColor: theme.colors.primary + '1A',
        },
        coverBlob1: {
          position: 'absolute',
          top: -60, left: -40,
          width: 200, height: 200,
          borderRadius: 100,
          backgroundColor: theme.colors.primary + '26',
        },
        coverBlob2: {
          position: 'absolute',
          top: -30, right: -30,
          width: 160, height: 160,
          borderRadius: 80,
          backgroundColor: theme.colors.accent + '2A',
        },
        coverBlob3: {
          position: 'absolute',
          bottom: -40, left: '40%',
          width: 130, height: 130,
          borderRadius: 65,
          backgroundColor: theme.colors.primary + '18',
        },
        coverDateRow: {
          position: 'absolute',
          left: theme.spacing.lg,
          right: theme.spacing.lg,
          top: theme.spacing.md,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        },
        coverEyebrow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: 10,
          paddingVertical: 5,
          borderRadius: theme.borderRadius.full,
          backgroundColor: theme.colors.surface,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.colors.border,
        },
        coverEyebrowText: {
          fontSize: 10,
          fontWeight: '800',
          letterSpacing: 1,
          color: theme.colors.primary,
          textTransform: 'uppercase',
        },
        coverDateText: {
          fontSize: 11,
          fontWeight: '700',
          color: theme.colors.textSecondary,
          letterSpacing: 0.4,
          textTransform: 'uppercase',
        },
        coverWatermark: {
          position: 'absolute',
          right: -10, bottom: -22,
          opacity: 0.12,
        },

        /* Title section overlaps the cover for a "magazine cover" feel */
        titleSection: {
          marginTop: -18,
          paddingHorizontal: theme.spacing.lg,
          paddingTop: 0,
          paddingBottom: theme.spacing.xs,
        },
        titleRow: {
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: theme.spacing.sm,
        },
        titleInput: {
          flex: 1,
          fontSize: 30,
          lineHeight: 36,
          fontWeight: '800',
          letterSpacing: -0.8,
          paddingVertical: theme.spacing.xs,
          color: theme.colors.text,
        },
        accentLineWrap: {
          height: 4,
          marginTop: 4,
          marginBottom: 6,
          borderRadius: 2,
          overflow: 'hidden',
          backgroundColor: theme.colors.primary + '1A',
          alignSelf: 'flex-start',
          width: 60,
        },
        accentLineFill: {
          height: '100%',
          width: '100%',
          backgroundColor: theme.colors.primary,
          borderRadius: 2,
        },
        subline: {
          fontSize: 13,
          fontWeight: '600',
          color: theme.colors.textMuted,
          fontStyle: 'italic',
          marginTop: 2,
          marginBottom: 4,
          letterSpacing: 0.1,
        },

        /* Meta strip */
        metaRow: {
          flexDirection: 'row',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 6,
          paddingHorizontal: theme.spacing.lg,
          paddingTop: 6,
          paddingBottom: theme.spacing.sm,
        },
        metaChip: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5,
          paddingHorizontal: 10,
          paddingVertical: 5,
          borderRadius: theme.borderRadius.full,
          backgroundColor: theme.colors.surfaceMuted,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.colors.borderSubtle,
        },
        metaChipPrimary: {
          backgroundColor: theme.colors.primary + '14',
          borderColor: theme.colors.primary + '30',
        },
        metaDotLive: {
          width: 6, height: 6, borderRadius: 3,
          backgroundColor: theme.colors.success,
        },
        metaChipText: {
          fontSize: 11,
          fontWeight: '700',
          color: theme.colors.textSecondary,
          letterSpacing: 0.2,
        },
        metaChipTextPrimary: {
          color: theme.colors.primary,
        },

        /* Decorative separator */
        sepWrap: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          paddingHorizontal: theme.spacing.lg,
          marginTop: 6,
          marginBottom: 4,
        },
        sepLine: {
          flex: 1,
          height: StyleSheet.hairlineWidth,
          backgroundColor: theme.colors.borderSubtle,
        },
        sepGlyph: {
          width: 24, height: 24,
          borderRadius: 12,
          alignItems: 'center', justifyContent: 'center',
          backgroundColor: theme.colors.primary + '14',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.colors.primary + '24',
        },

        /* Floating dock-style toolbar */
        dockRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          marginHorizontal: theme.spacing.md,
          marginTop: theme.spacing.xs,
          marginBottom: theme.spacing.xs,
          padding: 4,
          backgroundColor: theme.colors.surfaceMuted,
          borderRadius: theme.borderRadius.full,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.colors.borderSubtle,
        },
        dock: {
          flex: 1,
          minHeight: 44,
          paddingHorizontal: 4,
          flexDirection: 'row',
          alignItems: 'center',
        },
        dockToolbar: {
          backgroundColor: 'transparent',
          minHeight: 40,
          flex: 1,
        },
        dockMic: {
          width: 38,
          height: 38,
          borderRadius: 19,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.surface,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.colors.borderSubtle,
        },
        dockMicActive: {
          backgroundColor: theme.colors.error,
          borderColor: theme.colors.error,
        },

        /* Editor body — needs an explicit height (not just minHeight)
           because the parent ScrollView lets the WebView collapse to its
           content size otherwise. */
        editor: {
          height: 720,
          paddingHorizontal: theme.spacing.md,
          paddingTop: theme.spacing.xs,
        },
        fallbackBody: {
          height: 720,
          fontSize: 16,
          color: theme.colors.text,
          paddingVertical: theme.spacing.sm,
          paddingHorizontal: theme.spacing.lg,
          textAlignVertical: 'top',
          lineHeight: 26,
        },
        loading: {
          position: 'absolute',
          left: 0,
          right: 0,
          top: 220,
          alignItems: 'center',
        },

        /* Inline title mic */
        titleMic: {
          width: 38,
          height: 38,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.surfaceMuted,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.colors.borderSubtle,
          marginTop: 4,
        },
        titleMicActive: {
          backgroundColor: theme.colors.error,
          borderColor: theme.colors.error,
        },
      }),
    [theme]
  );

  /** Decorative top cover with gradient blobs and a quill watermark. */
  const Cover = () => (
    <View style={styles.cover}>
      <View style={styles.coverGradTop} />
      <View style={styles.coverBlob1} />
      <View style={styles.coverBlob2} />
      <View style={styles.coverBlob3} />
      <View style={styles.coverWatermark}>
        <Ionicons name="create-outline" size={120} color={theme.colors.primary} />
      </View>
      <View style={styles.coverDateRow}>
        <View style={styles.coverEyebrow}>
          <Ionicons name="sparkles" size={10} color={theme.colors.primary} />
          <Text style={styles.coverEyebrowText}>Composing</Text>
        </View>
        <Text style={styles.coverDateText}>{todayLabel}</Text>
      </View>
    </View>
  );

  /** Animated accent line: pulses width when title is empty, locks at 60 once typed. */
  const accentWidth = shimmer.interpolate({ inputRange: [0, 1], outputRange: [40, 90] });
  const accentOpacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] });
  const AccentLine = () => (
    <Animated.View
      style={[
        styles.accentLineWrap,
        !title
          ? { width: accentWidth, opacity: accentOpacity }
          : { width: 60, opacity: 1 },
      ]}
    >
      <View style={styles.accentLineFill} />
    </Animated.View>
  );

  /** Italic prompt below title — disappears once user starts typing. */
  const SublineHint = () =>
    !title ? <Text style={styles.subline}>Give your thoughts a name…</Text> : null;

  /** Compact status row — just the auto-save indicator. */
  const MetaStrip = () => (
    <View style={styles.metaRow}>
      <View style={[styles.metaChip, styles.metaChipPrimary]}>
        <View style={styles.metaDotLive} />
        <Text style={[styles.metaChipText, styles.metaChipTextPrimary]}>
          {wordCount > 0 ? 'Auto-saved' : 'New draft'}
        </Text>
      </View>
    </View>
  );

  /** Decorative separator with a centered diamond glyph. */
  const Separator = () => (
    <View style={styles.sepWrap}>
      <View style={styles.sepLine} />
      <View style={styles.sepGlyph}>
        <Ionicons name="diamond-outline" size={11} color={theme.colors.primary} />
      </View>
      <View style={styles.sepLine} />
    </View>
  );

  /** Floating dock toolbar with the mic on the right. */
  const Dock = ({ active, onPress }: { active: boolean; onPress?: () => void }) => (
    <View style={styles.dockRow}>
      <View style={styles.dock}>
        <RichToolbar
          getEditor={() => richRef.current}
          actions={[
            actions.setBold,
            actions.setItalic,
            actions.setUnderline,
            actions.insertBulletsList,
            actions.insertOrderedList,
            actions.checkboxList,
          ]}
          style={styles.dockToolbar}
          iconTint={theme.colors.textSecondary}
          selectedIconTint={theme.colors.primary}
        />
      </View>
      {onPress && (
        <Pressable
          onPress={onPress}
          hitSlop={12}
          style={[styles.dockMic, active && styles.dockMicActive]}
        >
          <Ionicons
            name={active ? 'stop' : 'mic-outline'}
            size={18}
            color={active ? '#FFF' : theme.colors.textSecondary}
          />
        </Pressable>
      )}
    </View>
  );

  /** Standalone mic next to the title field. */
  const TitleMic = () => {
    if (!onTitleVoicePress) return null;
    return (
      <Pressable
        onPress={onTitleVoicePress}
        hitSlop={12}
        style={[styles.titleMic, titleVoiceActive && styles.titleMicActive]}
      >
        <Ionicons
          name={titleVoiceActive ? 'stop' : 'mic-outline'}
          size={18}
          color={titleVoiceActive ? '#FFF' : theme.colors.textSecondary}
        />
      </Pressable>
    );
  };

  if (Platform.OS !== 'android' || !RichEditor || !RichToolbar) {
    return (
      <View style={styles.fallback}>
        <Cover />
        <View style={styles.titleSection}>
          <View style={styles.titleRow}>
            <TextInput
              style={styles.titleInput}
              value={title}
              onChangeText={onTitleChange}
              placeholder="Title"
              editable={editable}
              placeholderTextColor={theme.colors.textDisabled}
              multiline
            />
            <TitleMic />
          </View>
          <AccentLine />
          <SublineHint />
        </View>
        <MetaStrip />
        <Separator />
        <TextInput
          style={styles.fallbackBody}
          value={content ? stripHtml(content) : ''}
          onChangeText={(text) => onContentChange(text, text)}
          placeholder={placeholder}
          multiline
          editable={editable}
          placeholderTextColor={theme.colors.textDisabled}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Cover />
      <View style={styles.titleSection}>
        <View style={styles.titleRow}>
          <TextInput
            style={styles.titleInput}
            value={title}
            onChangeText={onTitleChange}
            placeholder="Title"
            editable={editable}
            placeholderTextColor={theme.colors.textDisabled}
            multiline
          />
          <TitleMic />
        </View>
        <AccentLine />
        <SublineHint />
      </View>
      <MetaStrip />
      <Separator />
      <Dock active={contentVoiceActive} onPress={onContentVoicePress} />
      <RichEditor
        ref={(r: any) => {
          if (r) richRef.current = r;
          if (r && !editorReady) {
            setEditorReady(true);
          }
        }}
        initialContentHTML={content || ''}
        editorInitializedCallback={() => {
          setEditorReady(true);
        }}
        onChange={handleEditorChange}
        onBlur={flushContent}
        placeholder={placeholder}
        style={styles.editor}
        editorStyle={{
          backgroundColor: 'transparent',
          minHeight: 680,
          color: theme.colors.text,
          placeholderColor: theme.colors.textMuted,
          caretColor: theme.colors.primary,
        }}
        useContainer={true}
      />
      {!editorReady && (
        <View style={styles.loading}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
        </View>
      )}
    </View>
  );
});
