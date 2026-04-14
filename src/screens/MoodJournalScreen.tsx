import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { useFeatures } from '../context/FeaturesContext';
import type { MoodLevel, JournalEntry } from '../types';

const MOOD_EMOJIS: { level: MoodLevel; emoji: string; label: string }[] = [
  { level: 1, emoji: '😞', label: 'Awful' },
  { level: 2, emoji: '😕', label: 'Bad' },
  { level: 3, emoji: '😐', label: 'Okay' },
  { level: 4, emoji: '🙂', label: 'Good' },
  { level: 5, emoji: '😊', label: 'Great' },
];

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function MoodJournalScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { journalEntries, addJournalEntry, updateJournalEntry, deleteJournalEntry, getJournalForDate } = useFeatures();
  const today = dateKey(new Date());
  const todayEntry = getJournalForDate(today);

  const [selectedMood, setSelectedMood] = useState<MoodLevel>(todayEntry?.mood ?? 3);
  const [note, setNote] = useState(todayEntry?.note ?? '');
  const [editing, setEditing] = useState(!todayEntry);

  const handleSave = () => {
    if (todayEntry) {
      updateJournalEntry(todayEntry.id, { mood: selectedMood, note: note.trim() });
    } else {
      addJournalEntry(selectedMood, note.trim());
    }
    setEditing(false);
  };

  // Last 30 days mood chart
  const last30Days = useMemo(() => {
    const days: { key: string; entry?: JournalEntry; label: string }[] = [];
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const key = dateKey(d);
      days.push({ key, entry: journalEntries.find((e) => e.date === key), label: String(d.getDate()) });
    }
    return days;
  }, [journalEntries]);

  const avgMood = useMemo(() => {
    const withMood = last30Days.filter((d) => d.entry);
    if (withMood.length === 0) return 0;
    return withMood.reduce((s, d) => s + (d.entry?.mood ?? 0), 0) / withMood.length;
  }, [last30Days]);

  const MOOD_COLORS = ['', '#EF4444', '#F59E0B', '#8E99A8', '#3B82F6', '#10B981'];

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    header: { paddingHorizontal: theme.spacing.lg, paddingTop: insets.top + theme.spacing.md, paddingBottom: theme.spacing.md, backgroundColor: theme.colors.surface },
    title: { ...theme.typography.title, color: theme.colors.text, fontSize: 26, fontWeight: '700' },
    scroll: { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.lg, paddingBottom: 120 },
    card: { backgroundColor: theme.colors.cardBg, borderRadius: theme.borderRadius.xl, padding: theme.spacing.xl, ...theme.shadows.card, marginBottom: theme.spacing.lg },
    cardTitle: { ...theme.typography.titleSmall, color: theme.colors.text, marginBottom: theme.spacing.lg },
    moodRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: theme.spacing.lg },
    moodBtn: { alignItems: 'center', gap: 4, paddingVertical: theme.spacing.sm, paddingHorizontal: theme.spacing.md, borderRadius: theme.borderRadius.lg, borderWidth: 2, borderColor: 'transparent' },
    moodBtnSelected: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primaryLight },
    moodEmoji: { fontSize: 32 },
    moodLabel: { ...theme.typography.caption, color: theme.colors.textMuted },
    moodLabelSelected: { color: theme.colors.primary, fontWeight: '600' },
    noteInput: { ...theme.typography.body, color: theme.colors.text, backgroundColor: theme.colors.inputBg, borderRadius: theme.borderRadius.lg, padding: theme.spacing.md, minHeight: 80, textAlignVertical: 'top', marginBottom: theme.spacing.md },
    saveBtn: { backgroundColor: theme.colors.primary, borderRadius: theme.borderRadius.lg, paddingVertical: theme.spacing.md, alignItems: 'center' },
    saveBtnText: { ...theme.typography.button, color: '#FFF' },
    editBtn: { alignSelf: 'flex-end', paddingVertical: theme.spacing.xs },
    editBtnText: { ...theme.typography.bodySmall, color: theme.colors.primary, fontWeight: '600' },
    savedCard: { alignItems: 'center', gap: theme.spacing.sm },
    savedEmoji: { fontSize: 48 },
    savedMood: { ...theme.typography.titleSmall, color: theme.colors.text },
    savedNote: { ...theme.typography.bodySmall, color: theme.colors.textSecondary, textAlign: 'center' },
    chartCard: { backgroundColor: theme.colors.cardBg, borderRadius: theme.borderRadius.xl, padding: theme.spacing.lg, ...theme.shadows.card },
    chartRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: theme.spacing.md },
    chartDot: { width: 28, height: 28, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
    chartDotLabel: { ...theme.typography.overline, color: '#FFF', fontWeight: '700', fontSize: 9 },
    avgRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.spacing.sm, marginTop: theme.spacing.sm },
    avgText: { ...theme.typography.bodySmall, color: theme.colors.textSecondary },
    avgNum: { ...theme.typography.titleSmall, color: theme.colors.text, fontWeight: '700' },
    historyTitle: { ...theme.typography.titleSmall, color: theme.colors.text, marginTop: theme.spacing.xl, marginBottom: theme.spacing.sm },
    entryCard: { backgroundColor: theme.colors.cardBg, borderRadius: theme.borderRadius.lg, padding: theme.spacing.md, marginBottom: theme.spacing.sm, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, ...theme.shadows.card },
    entryEmoji: { fontSize: 24 },
    entryContent: { flex: 1 },
    entryDate: { ...theme.typography.caption, color: theme.colors.textMuted },
    entryNote: { ...theme.typography.bodySmall, color: theme.colors.text, marginTop: 2 },
  }), [theme, insets]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
            </TouchableOpacity>
            <Text style={styles.title}>Mood Journal</Text>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate('AIMoodInsights')}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#7C3AED20', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="sparkles" size={14} color="#7C3AED" />
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#7C3AED' }}>AI Insights</Text>
          </TouchableOpacity>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Today's entry */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>How are you feeling today?</Text>
          {editing ? (
            <>
              <View style={styles.moodRow}>
                {MOOD_EMOJIS.map((m) => (
                  <TouchableOpacity key={m.level} style={[styles.moodBtn, selectedMood === m.level && styles.moodBtnSelected]} onPress={() => setSelectedMood(m.level)}>
                    <Text style={styles.moodEmoji}>{m.emoji}</Text>
                    <Text style={[styles.moodLabel, selectedMood === m.level && styles.moodLabelSelected]}>{m.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput style={styles.noteInput} value={note} onChangeText={setNote} placeholder="What's on your mind?" placeholderTextColor={theme.colors.textMuted} multiline />
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                <Text style={styles.saveBtnText}>Save Entry</Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.savedCard}>
              <Text style={styles.savedEmoji}>{MOOD_EMOJIS.find((m) => m.level === todayEntry?.mood)?.emoji}</Text>
              <Text style={styles.savedMood}>{MOOD_EMOJIS.find((m) => m.level === todayEntry?.mood)?.label}</Text>
              {todayEntry?.note ? <Text style={styles.savedNote}>{todayEntry.note}</Text> : null}
              <TouchableOpacity style={styles.editBtn} onPress={() => setEditing(true)}>
                <Text style={styles.editBtnText}>Edit</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* 30-day chart */}
        <View style={styles.chartCard}>
          <Text style={styles.cardTitle}>Last 30 Days</Text>
          <View style={styles.chartRow}>
            {last30Days.map((d) => {
              const mood = d.entry?.mood ?? 0;
              const bg = mood > 0 ? MOOD_COLORS[mood] : theme.colors.inputBg;
              return (
                <View key={d.key} style={[styles.chartDot, { backgroundColor: bg }]}>
                  <Text style={[styles.chartDotLabel, mood === 0 && { color: theme.colors.textDisabled }]}>{d.label}</Text>
                </View>
              );
            })}
          </View>
          <View style={styles.avgRow}>
            <Text style={styles.avgText}>Average mood:</Text>
            <Text style={styles.avgNum}>{avgMood > 0 ? avgMood.toFixed(1) : '—'}</Text>
            {avgMood > 0 && <Text style={{ fontSize: 18 }}>{MOOD_EMOJIS[Math.round(avgMood) - 1]?.emoji}</Text>}
          </View>
        </View>

        {/* History */}
        {journalEntries.length > 0 && (
          <>
            <Text style={styles.historyTitle}>Recent Entries</Text>
            {journalEntries.slice(0, 14).map((e) => (
              <TouchableOpacity key={e.id} style={styles.entryCard} onLongPress={() => Alert.alert('Delete entry?', undefined, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => deleteJournalEntry(e.id) }])}>
                <Text style={styles.entryEmoji}>{MOOD_EMOJIS.find((m) => m.level === e.mood)?.emoji}</Text>
                <View style={styles.entryContent}>
                  <Text style={styles.entryDate}>{new Date(e.createdAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</Text>
                  {e.note ? <Text style={styles.entryNote} numberOfLines={2}>{e.note}</Text> : null}
                </View>
              </TouchableOpacity>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}
