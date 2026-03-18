import React, { useRef, useCallback, useEffect, useState, useMemo, useImperativeHandle, forwardRef } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
} from 'react-native';
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
}

export const RichNoteEditor = forwardRef<RichNoteEditorHandle, RichNoteEditorProps>(function RichNoteEditor({
  title,
  content,
  onTitleChange,
  onContentChange,
  placeholder = 'Start writing...',
  editable = true,
  contentRestoreKey = 0,
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
        titleInput: {
          ...theme.typography.title,
          paddingVertical: theme.spacing.sm,
          paddingHorizontal: theme.spacing.xs,
          marginBottom: theme.spacing.xs,
          color: theme.colors.text,
        },
        toolbar: {
          backgroundColor: theme.colors.background,
          minHeight: 40,
        },
        editor: {
          flex: 1,
          minHeight: 200,
          paddingHorizontal: theme.spacing.sm,
        },
        fallbackBody: {
          flex: 1,
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
      }),
    [theme]
  );

  if (Platform.OS !== 'android' || !RichEditor || !RichToolbar) {
    return (
      <View style={styles.fallback}>
        <TextInput
          style={styles.titleInput}
          value={title}
          onChangeText={onTitleChange}
          placeholder="Title"
          editable={editable}
          placeholderTextColor={theme.colors.textDisabled}
        />
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
      <TextInput
        style={styles.titleInput}
        value={title}
        onChangeText={onTitleChange}
        placeholder="Title"
        editable={editable}
        placeholderTextColor={theme.colors.textDisabled}
      />
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
      <RichEditor
        ref={(r) => {
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
          minHeight: 200,
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
