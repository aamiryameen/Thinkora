import React, { useRef, useCallback, useEffect, useState, useMemo, useImperativeHandle, forwardRef } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Icon } from './Icons';
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
  /** When this changes, editor content is synced from `content` (e.g. after undo/redo). */
  contentRestoreKey?: number;
  /** Voice input mic buttons — when provided, shown next to title and above content. */
  titleVoiceActive?: boolean;
  onTitleVoicePress?: () => void;
  contentVoiceActive?: boolean;
  onContentVoicePress?: () => void;
}

export const RichNoteEditor = forwardRef<RichNoteEditorHandle, RichNoteEditorProps>(function RichNoteEditor({
  title,
  content,
  onTitleChange,
  onContentChange,
  placeholder = 'Start writing...',
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

  useImperativeHandle(ref, () => ({
    insertText: (text: string) => {
      if (richRef.current && Platform.OS === 'android') {
        (richRef.current as any).insertText(text);
        // Flush after a short delay so the WebView has processed the insertion
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

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1 },
        fallback: { flex: 1, padding: theme.spacing.md },
        titleRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          paddingRight: theme.spacing.sm,
        },
        titleInput: {
          ...theme.typography.title,
          flex: 1,
          paddingVertical: theme.spacing.sm,
          paddingHorizontal: theme.spacing.xs,
          marginBottom: theme.spacing.xs,
          color: theme.colors.text,
        },
        toolbarRow: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingRight: theme.spacing.sm,
        },
        toolbar: {
          backgroundColor: theme.colors.background,
          minHeight: 40,
          flex: 1,
        },
        editor: {
          flex: 1,
          minHeight: 360,
          paddingHorizontal: theme.spacing.sm,
        },
        fallbackBody: {
          flex: 1,
          minHeight: 360,
          ...theme.typography.body,
          color: theme.colors.text,
          paddingVertical: theme.spacing.sm,
          textAlignVertical: 'top',
        },
        loading: {
          position: 'absolute',
          left: 0,
          right: 0,
          top: 120,
          alignItems: 'center',
        },
        micBtn: {
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: 'center',
          justifyContent: 'center',
        },
        micBtnSmall: {
          width: 30,
          height: 30,
          borderRadius: 15,
          alignItems: 'center',
          justifyContent: 'center',
        },
      }),
    [theme]
  );

  const renderTitleMic = () => {
    if (!onTitleVoicePress) return null;
    return (
      <Pressable
        onPress={onTitleVoicePress}
        hitSlop={16}
        style={[styles.micBtn, { backgroundColor: titleVoiceActive ? theme.colors.error : theme.colors.primary }]}
      >
        <Ionicons name={titleVoiceActive ? 'stop' : 'mic'} size={18} color="#FFF" />
      </Pressable>
    );
  };

  const renderContentMic = () => {
    if (!onContentVoicePress) return null;
    return (
      <Pressable
        onPress={onContentVoicePress}
        hitSlop={16}
        style={[styles.micBtnSmall, { backgroundColor: contentVoiceActive ? theme.colors.error : theme.colors.primary }]}
      >
        <Ionicons name={contentVoiceActive ? 'stop' : 'mic'} size={15} color="#FFF" />
      </Pressable>
    );
  };

  if (Platform.OS !== 'android' || !RichEditor || !RichToolbar) {
    return (
      <View style={styles.fallback}>
        <View style={styles.titleRow}>
          <TextInput
            style={styles.titleInput}
            value={title}
            onChangeText={onTitleChange}
            placeholder="Title"
            editable={editable}
            placeholderTextColor={theme.colors.textDisabled}
          />
          {renderTitleMic()}
        </View>
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
      <View style={styles.titleRow}>
        <TextInput
          style={styles.titleInput}
          value={title}
          onChangeText={onTitleChange}
          placeholder="Title"
          editable={editable}
          placeholderTextColor={theme.colors.textDisabled}
        />
        {renderTitleMic()}
      </View>
      <View style={styles.toolbarRow}>
        <RichToolbar
          getEditor={() => richRef.current}
          actions={[
            actions.setBold,
            actions.setItalic,
            actions.setUnderline,
            actions.insertBulletsList,
            actions.insertOrderedList,
          ]}
          style={styles.toolbar}
          iconTint={theme.colors.icon}
          selectedIconTint={theme.colors.primary}
        />
        {renderContentMic()}
      </View>
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
          minHeight: 360,
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
