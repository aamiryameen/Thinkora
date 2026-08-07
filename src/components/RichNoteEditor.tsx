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
  useWindowDimensions,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { EDITOR_CONTENT_DEBOUNCE_MS } from '../core/constants';
import { useTheme } from '../context/ThemeContext';
import { cssFontFamily, fontStyle } from '../core/fonts';
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
  /** Font id from core/fonts, applied to title and body. */
  fontId?: string | null;
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
  placeholder = 'Note here',
  fontId,
  editable = true,
  contentRestoreKey = 0,
  titleVoiceActive = false,
  onTitleVoicePress,
  contentVoiceActive = false,
  onContentVoicePress,
}: RichNoteEditorProps, ref) {
  const { theme } = useTheme();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  // Writing area floor scales with the device: ~26% of the window height,
  // clamped so it never collapses on small phones nor balloons on tablets.
  const editorMinHeight = Math.round(Math.min(Math.max(windowHeight * 0.26, 160), 340));
  const isNarrow = windowWidth < 360;
  const richRef = useRef<{
    setContentHTML: (html: string) => void;
    getContentHtml: () => Promise<string>;
    injectJavascript?: (script: string) => void;
  } | null>(null);
  const [editorReady, setEditorReady] = useState(false);

  /**
   * Re-applies the font to the editor's editable area.
   *
   * Two reasons this needs injection rather than props:
   *  - `editorStyle.contentCSSText` is only read once, at WebView init, so it
   *    can't change the font on an already-open note.
   *  - the library's own `setContentStyle` only understands background, text
   *    and placeholder colour — it ignores font-family.
   *
   * The text lives in the contenteditable div, not `document.body`, so the rule
   * is written as a stylesheet covering both.
   */
  useEffect(() => {
    if (!editorReady) return;
    const family = cssFontFamily(fontId);
    const css = `body, #editor, .content, [contenteditable] { font-family: ${family} !important; }`;
    const script = `
      (function() {
        var id = 'thinkora-font';
        var tag = document.getElementById(id);
        if (!tag) {
          tag = document.createElement('style');
          tag.id = id;
          document.head.appendChild(tag);
        }
        tag.innerHTML = ${JSON.stringify(css)};
      })();
      true;
    `;

    // The WebView bridge can lag a frame behind `editorReady`, so retry once.
    const apply = () => {
      try { richRef.current?.injectJavascript?.(script); } catch { /* not ready */ }
    };
    apply();
    const retry = setTimeout(apply, 120);
    return () => clearTimeout(retry);
  }, [editorReady, fontId]);
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

        /* ── Minimal header strip ─────────────────────── */
        cover: {
          paddingHorizontal: theme.spacing.lg,
          paddingTop: theme.spacing.md,
          paddingBottom: theme.spacing.sm,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        },
        coverDateText: {
          fontSize: 11,
          fontWeight: '700',
          color: theme.colors.textMuted,
          letterSpacing: 0.6,
          textTransform: 'uppercase',
        },

        /* Title section — clean, no overlap with the header */
        titleSection: {
          paddingHorizontal: theme.spacing.lg,
          paddingTop: theme.spacing.xs,
          paddingBottom: theme.spacing.sm,
        },
        titleRow: {
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: theme.spacing.sm,
        },
        titleInput: {
          flex: 1,
          fontSize: isNarrow ? 24 : 28,
          lineHeight: isNarrow ? 30 : 34,
          fontWeight: '800',
          letterSpacing: -0.6,
          paddingVertical: 6,
          color: theme.colors.text,
        },
        accentLineWrap: {
          height: 3,
          marginTop: 8,
          marginBottom: 4,
          borderRadius: 2,
          overflow: 'hidden',
          backgroundColor: theme.colors.primary + '14',
          alignSelf: 'flex-start',
          width: 48,
        },
        accentLineFill: {
          height: '100%',
          width: '100%',
          backgroundColor: theme.colors.primary,
          borderRadius: 2,
        },
        subline: {
          fontSize: 13,
          fontWeight: '500',
          color: theme.colors.textMuted,
          marginTop: 6,
          marginBottom: 2,
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

        /* Thin divider between title block and editor body */
        sepLine: {
          height: StyleSheet.hairlineWidth,
          backgroundColor: theme.colors.borderSubtle,
          marginHorizontal: theme.spacing.lg,
          marginTop: theme.spacing.xs,
          marginBottom: theme.spacing.sm,
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

        /* Editor body — the pell editor sizes its container from the WebView
           content height (floored by the initialHeight prop), so no fixed
           height here; it must stay free to grow with the note. */
        editor: {
          paddingHorizontal: theme.spacing.md,
          paddingTop: theme.spacing.xs,
        },
        fallbackBody: {
          minHeight: editorMinHeight,
          fontSize: 17,
          color: theme.colors.text,
          paddingVertical: theme.spacing.sm,
          paddingHorizontal: theme.spacing.lg,
          textAlignVertical: 'top',
          lineHeight: 28,
        },
        loading: {
          position: 'absolute',
          left: 0,
          right: 0,
          top: Math.round(windowHeight * 0.3),
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
    [theme, editorMinHeight, isNarrow, windowHeight]
  );

  /** Minimal header — just a tiny live "auto-saved" status + the date. */
  const Cover = () => (
    <View style={styles.cover}>
      <View style={[styles.metaChip, styles.metaChipPrimary]}>
        <View style={styles.metaDotLive} />
        <Text style={[styles.metaChipText, styles.metaChipTextPrimary]}>
          {wordCount > 0 ? 'Auto-saved' : 'New draft'}
        </Text>
      </View>
      <Text style={styles.coverDateText}>{todayLabel}</Text>
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

  /** Thin separator below the title block. */
  const Separator = () => <View style={styles.sepLine} />;

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
              style={[styles.titleInput, fontStyle(fontId)]}
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
        <Separator />
        <TextInput
          style={[styles.fallbackBody, fontStyle(fontId)]}
          value={content ? stripHtml(content) : ''}
          onChangeText={(text) => onContentChange(text, text)}
          placeholder={placeholder}
          multiline
          editable={editable}
          placeholderTextColor={theme.colors.textSecondary}
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
            style={[styles.titleInput, fontStyle(fontId)]}
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
        initialHeight={editorMinHeight}
        editorStyle={{
          backgroundColor: 'transparent',
          color: theme.colors.text,
          placeholderColor: theme.colors.textSecondary,
          caretColor: theme.colors.primary,
          contentCSSText: `font-size: 17px; line-height: 1.7; padding-top: 8px; min-height: ${editorMinHeight - 30}px; font-family: ${cssFontFamily(fontId)};`,
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
