import React, { useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert,
} from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';
import { shareViewAsCard } from '../services/shareCardService';
import type { RootStackParamList } from '../navigation/types';

type Route = RouteProp<RootStackParamList, 'ShareNoteCard'>;

interface CardTheme {
  id: string;
  name: string;
  background: string;       // gradient start (or solid)
  backgroundEnd?: string;   // gradient end
  text: string;
  accent: string;
}

const CARD_THEMES: CardTheme[] = [
  { id: 'purple', name: 'Purple', background: '#6366F1', text: '#FFFFFF', accent: '#FBBF24' },
  { id: 'sunset', name: 'Sunset', background: '#F97316', text: '#FFFFFF', accent: '#FBBF24' },
  { id: 'ocean',  name: 'Ocean',  background: '#0891B2', text: '#FFFFFF', accent: '#A7F3D0' },
  { id: 'forest', name: 'Forest', background: '#10B981', text: '#FFFFFF', accent: '#FEF3C7' },
  { id: 'rose',   name: 'Rose',   background: '#EC4899', text: '#FFFFFF', accent: '#FCE7F3' },
  { id: 'cream',  name: 'Cream',  background: '#FEF3C7', text: '#451A03', accent: '#92400E' },
  { id: 'mono',   name: 'Mono',   background: '#0F172A', text: '#F8FAFC', accent: '#A855F7' },
  { id: 'paper',  name: 'Paper',  background: '#FFFFFF', text: '#0F172A', accent: '#6366F1' },
];

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function ShareNoteCardScreen() {
  const navigation = useNavigation();
  const route = useRoute<Route>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { getNote } = useApp();

  const note = getNote(route.params.noteId);
  const cardRef = useRef<View>(null);
  const [selectedTheme, setSelectedTheme] = useState<CardTheme>(CARD_THEMES[0]);
  const [sharing, setSharing] = useState(false);

  const bodyText = useMemo(() => {
    if (!note) return '';
    const text = note.plainText || stripHtml(note.content || '');
    return text.length > 600 ? text.slice(0, 600).trim() + '…' : text;
  }, [note]);

  const handleShare = async () => {
    setSharing(true);
    try {
      await shareViewAsCard(cardRef.current, note?.title || 'note');
    } catch (err: any) {
      if (err?.message && !/cancel|share/i.test(String(err.message))) {
        Alert.alert('Share Failed', err.message);
      }
    } finally {
      setSharing(false);
    }
  };

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    header: {
      flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      paddingTop: insets.top + theme.spacing.md,
      paddingBottom: theme.spacing.md,
      backgroundColor: theme.colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    headerTitle: { ...theme.typography.title, fontSize: 20, fontWeight: '700', color: theme.colors.text, flex: 1 },
    scroll: { flex: 1 },
    content: { padding: theme.spacing.lg, gap: theme.spacing.lg, alignItems: 'center' },
    cardWrap: {
      width: '100%',
      aspectRatio: 9 / 16, // Instagram story aspect
      maxHeight: 540,
      borderRadius: 24,
      overflow: 'hidden',
      ...theme.shadows.card,
    },
    card: {
      flex: 1,
      padding: 32,
      justifyContent: 'space-between',
    },
    brandRow: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
    },
    brandDot: {
      width: 28, height: 28, borderRadius: 14,
      alignItems: 'center', justifyContent: 'center',
    },
    brandText: {
      fontSize: 14, fontWeight: '800', letterSpacing: 0.5,
    },
    cardTitle: { fontSize: 26, fontWeight: '900', lineHeight: 32, marginBottom: 12 },
    cardBody: { fontSize: 15, lineHeight: 22, fontWeight: '500' },
    accentBar: { height: 4, width: 56, borderRadius: 2, marginTop: 16 },
    footer: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, opacity: 0.85 },
    sectionLabel: {
      ...theme.typography.overline, color: theme.colors.textMuted,
      textTransform: 'uppercase', letterSpacing: 1, marginBottom: theme.spacing.xs, alignSelf: 'flex-start',
    },
    themeRow: {
      flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center',
    },
    themeBtn: {
      width: 64, height: 64, borderRadius: 16,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 3,
    },
    themeName: { fontSize: 10, fontWeight: '700', color: theme.colors.textMuted, marginTop: 4, textAlign: 'center' },
    shareBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
      backgroundColor: theme.colors.primary,
      borderRadius: theme.borderRadius.full,
      paddingVertical: 16, width: '100%',
    },
    shareBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
  }), [theme, insets]);

  if (!note) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: theme.colors.textMuted }}>Note not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Share as Card</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Card Preview (also the captured surface) */}
        <View collapsable={false} ref={cardRef as any} style={styles.cardWrap}>
          <View style={[styles.card, { backgroundColor: selectedTheme.background }]}>
            <View>
              <View style={styles.brandRow}>
                <View style={[styles.brandDot, { backgroundColor: selectedTheme.accent }]}>
                  <Ionicons name="bulb" size={16} color={selectedTheme.background} />
                </View>
                <Text style={[styles.brandText, { color: selectedTheme.text }]}>THINKORA</Text>
              </View>
            </View>

            <View>
              <Text numberOfLines={3} style={[styles.cardTitle, { color: selectedTheme.text }]}>
                {note.title || 'Untitled'}
              </Text>
              <Text numberOfLines={10} style={[styles.cardBody, { color: selectedTheme.text, opacity: 0.92 }]}>
                {bodyText || 'Empty note'}
              </Text>
              <View style={[styles.accentBar, { backgroundColor: selectedTheme.accent }]} />
            </View>

            <Text style={[styles.footer, { color: selectedTheme.text }]}>
              ✍️  thinkora.app
            </Text>
          </View>
        </View>

        {/* Theme Picker */}
        <View style={{ width: '100%' }}>
          <Text style={styles.sectionLabel}>Choose a theme</Text>
          <View style={styles.themeRow}>
            {CARD_THEMES.map(t => {
              const isSelected = selectedTheme.id === t.id;
              return (
                <TouchableOpacity
                  key={t.id}
                  onPress={() => setSelectedTheme(t)}
                  activeOpacity={0.85}
                >
                  <View style={[styles.themeBtn, {
                    backgroundColor: t.background,
                    borderColor: isSelected ? theme.colors.primary : 'transparent',
                  }]}>
                    {isSelected && <Ionicons name="checkmark-circle" size={22} color="#FFF" />}
                  </View>
                  <Text style={styles.themeName}>{t.name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Share Button */}
        <TouchableOpacity style={styles.shareBtn} onPress={handleShare} disabled={sharing} activeOpacity={0.85}>
          {sharing ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Ionicons name="share-social-outline" size={22} color="#FFF" />
              <Text style={styles.shareBtnText}>Share Card</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
