import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal,
  TextInput, Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { useFeatures } from '../context/FeaturesContext';
import {
  getHabitStacks, addHabitStack, deleteHabitStack,
  type HabitStack,
} from '../services/habitStackService';
import type { Habit } from '../types';

const EMOJI_OPTIONS = ['☀️', '🌙', '💪', '🧘', '📚', '🍵', '🏃', '🎯', '✨', '🔥'];

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function HabitStacksScreen() {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { habits, toggleHabitDate } = useFeatures();

  const [stacks, setStacks] = useState<HabitStack[]>([]);
  const [showAdd, setShowAdd] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState(EMOJI_OPTIONS[0]);
  const [selectedHabitIds, setSelectedHabitIds] = useState<string[]>([]);

  useEffect(() => {
    getHabitStacks().then(setStacks);
  }, []);

  const handleAdd = async () => {
    if (!name.trim()) { Alert.alert('Name required'); return; }
    if (selectedHabitIds.length < 2) { Alert.alert('Pick at least 2 habits to chain'); return; }
    await addHabitStack({ name: name.trim(), emoji, habitIds: selectedHabitIds });
    setStacks(await getHabitStacks());
    setName(''); setEmoji(EMOJI_OPTIONS[0]); setSelectedHabitIds([]);
    setShowAdd(false);
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete stack?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await deleteHabitStack(id);
        setStacks(await getHabitStacks());
      }},
    ]);
  };

  // Toggle habit completion for today (used by stack quick-complete)
  const toggleHabitToday = (habitId: string) => {
    toggleHabitDate(habitId, todayStr());
  };

  const renderStack = (stack: HabitStack) => {
    const stackHabits = stack.habitIds
      .map(id => habits.find((h: Habit) => h.id === id))
      .filter(Boolean) as Habit[];

    if (stackHabits.length === 0) return null;

    const today = todayStr();
    const allDone = stackHabits.every(h => h.completedDates.includes(today));
    const doneCount = stackHabits.filter(h => h.completedDates.includes(today)).length;

    return (
      <TouchableOpacity
        key={stack.id}
        style={[styles.stackCard, allDone && { borderColor: '#10B981', borderWidth: 2 }]}
        onLongPress={() => handleDelete(stack.id)}
        activeOpacity={0.85}
      >
        <View style={styles.stackHeader}>
          <Text style={styles.stackEmoji}>{stack.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.stackName}>{stack.name}</Text>
            <Text style={styles.stackProgress}>{doneCount}/{stackHabits.length} done today</Text>
          </View>
          {allDone && (
            <View style={styles.doneBadge}>
              <Ionicons name="checkmark-circle" size={20} color="#10B981" />
            </View>
          )}
        </View>

        <View style={styles.chainWrap}>
          {stackHabits.map((h, idx) => {
            const done = h.completedDates.includes(today);
            return (
              <React.Fragment key={h.id}>
                {idx > 0 && (
                  <View style={styles.arrow}>
                    <Ionicons name="arrow-down" size={14} color={theme.colors.textMuted} />
                  </View>
                )}
                <TouchableOpacity
                  style={[styles.chainItem, done && { backgroundColor: h.color + '25', borderColor: h.color }]}
                  onPress={() => toggleHabitToday(h.id)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.chainCheck, { borderColor: h.color, backgroundColor: done ? h.color : 'transparent' }]}>
                    {done && <Ionicons name="checkmark" size={14} color="#FFF" />}
                  </View>
                  <Text style={[styles.chainText, done && { color: theme.colors.text, fontWeight: '700' }]}>
                    {h.name}
                  </Text>
                </TouchableOpacity>
              </React.Fragment>
            );
          })}
        </View>
      </TouchableOpacity>
    );
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
    headerTitle: { ...theme.typography.title, fontSize: 22, fontWeight: '700', color: theme.colors.text, flex: 1 },
    addBtn: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: theme.colors.primary,
      alignItems: 'center', justifyContent: 'center',
    },
    scroll: { flex: 1 },
    content: { padding: theme.spacing.lg, gap: theme.spacing.md, paddingBottom: 80 },
    intro: {
      backgroundColor: theme.colors.primary + '10',
      borderRadius: theme.borderRadius.xl,
      padding: theme.spacing.lg,
      borderLeftWidth: 4, borderLeftColor: theme.colors.primary,
    },
    introTitle: { fontSize: 14, fontWeight: '800', color: theme.colors.text, marginBottom: 4 },
    introText: { fontSize: 13, color: theme.colors.textMuted, lineHeight: 18 },
    empty: { alignItems: 'center', paddingTop: 40, gap: 10 },
    emptyText: { fontSize: 14, color: theme.colors.textMuted, textAlign: 'center', paddingHorizontal: 20 },
    emptyBtn: {
      marginTop: 12, paddingHorizontal: 20, paddingVertical: 12,
      borderRadius: theme.borderRadius.full, backgroundColor: theme.colors.primary,
    },
    emptyBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
    stackCard: {
      backgroundColor: theme.colors.cardBg,
      borderRadius: theme.borderRadius.xl,
      padding: theme.spacing.lg,
      ...theme.shadows.card,
      gap: 12,
    },
    stackHeader: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
    stackEmoji: { fontSize: 28 },
    stackName: { fontSize: 16, fontWeight: '800', color: theme.colors.text },
    stackProgress: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
    doneBadge: {},
    chainWrap: { gap: 4 },
    chainItem: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      backgroundColor: theme.colors.inputBg,
      borderRadius: 10,
      paddingHorizontal: 12, paddingVertical: 10,
      borderWidth: 1.5, borderColor: 'transparent',
    },
    chainCheck: {
      width: 20, height: 20, borderRadius: 10,
      borderWidth: 2,
      alignItems: 'center', justifyContent: 'center',
    },
    chainText: { flex: 1, fontSize: 13, fontWeight: '600', color: theme.colors.text },
    arrow: { alignItems: 'center', paddingVertical: 2 },
    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheet: { backgroundColor: theme.colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 14, maxHeight: '85%' },
    sheetTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.text },
    label: { fontSize: 12, fontWeight: '700', color: theme.colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
    input: { backgroundColor: theme.colors.inputBg, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: theme.colors.text },
    emojiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    emojiBtn: {
      width: 44, height: 44, borderRadius: 12,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: theme.colors.inputBg, borderWidth: 2, borderColor: 'transparent',
    },
    emojiBtnSel: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary + '15' },
    emojiText: { fontSize: 22 },
    habitRow: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingVertical: 10, paddingHorizontal: 12,
      borderRadius: 10, backgroundColor: theme.colors.inputBg, marginBottom: 6,
      borderWidth: 1.5, borderColor: 'transparent',
    },
    habitRowSel: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary + '10' },
    orderBadge: {
      width: 24, height: 24, borderRadius: 12,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: theme.colors.primary,
    },
    orderText: { fontSize: 11, color: '#FFF', fontWeight: '800' },
    primary: { backgroundColor: theme.colors.primary, borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
    primaryText: { color: '#FFF', fontWeight: '800', fontSize: 15 },
    secondary: { alignItems: 'center', paddingVertical: 10 },
    secondaryText: { color: theme.colors.textMuted, fontSize: 14 },
  }), [theme, insets]);

  const toggleHabitInForm = (id: string) => {
    setSelectedHabitIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      return [...prev, id]; // append in selection order
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Habit Stacks</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowAdd(true)} disabled={habits.length < 2}>
          <Ionicons name="add" size={22} color="#FFF" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.intro}>
          <Text style={styles.introTitle}>Chain habits together</Text>
          <Text style={styles.introText}>
            "After morning coffee → Meditate → Journal → Plan day" — habit stacks help you build new habits by chaining them to existing ones.
          </Text>
        </View>

        {habits.length < 2 ? (
          <View style={styles.empty}>
            <Ionicons name="link-outline" size={48} color={theme.colors.textDisabled} />
            <Text style={styles.emptyText}>You need at least 2 habits to create a stack.{'\n'}Go to Habits and add a few first.</Text>
          </View>
        ) : stacks.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="link-outline" size={48} color={theme.colors.textDisabled} />
            <Text style={styles.emptyText}>No habit stacks yet.</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => setShowAdd(true)}>
              <Text style={styles.emptyBtnText}>Create Your First Stack</Text>
            </TouchableOpacity>
          </View>
        ) : (
          stacks.map(renderStack)
        )}
      </ScrollView>

      {/* Add Modal */}
      <Modal visible={showAdd} transparent animationType="slide" onRequestClose={() => setShowAdd(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.sheet}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingBottom: 10 }}>
              <Text style={styles.sheetTitle}>New Habit Stack</Text>

              <View>
                <Text style={styles.label}>Name</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g., Morning Routine"
                  placeholderTextColor={theme.colors.textMuted}
                />
              </View>

              <View>
                <Text style={styles.label}>Icon</Text>
                <View style={styles.emojiRow}>
                  {EMOJI_OPTIONS.map(e => (
                    <TouchableOpacity
                      key={e}
                      style={[styles.emojiBtn, emoji === e && styles.emojiBtnSel]}
                      onPress={() => setEmoji(e)}
                    >
                      <Text style={styles.emojiText}>{e}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View>
                <Text style={styles.label}>Chain Habits (tap to add in order)</Text>
                {habits.map((h: Habit) => {
                  const idx = selectedHabitIds.indexOf(h.id);
                  const isSel = idx !== -1;
                  return (
                    <TouchableOpacity
                      key={h.id}
                      style={[styles.habitRow, isSel && styles.habitRowSel]}
                      onPress={() => toggleHabitInForm(h.id)}
                    >
                      {isSel ? (
                        <View style={styles.orderBadge}>
                          <Text style={styles.orderText}>{idx + 1}</Text>
                        </View>
                      ) : (
                        <View style={[styles.orderBadge, { backgroundColor: theme.colors.inputBg, borderWidth: 2, borderColor: theme.colors.border }]} />
                      )}
                      <View style={{ width: 24, height: 24, borderRadius: 6, backgroundColor: h.color, alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name={h.icon as any} size={14} color="#FFF" />
                      </View>
                      <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: theme.colors.text }}>{h.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity style={styles.primary} onPress={handleAdd}>
                <Text style={styles.primaryText}>Create Stack</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondary} onPress={() => setShowAdd(false)}>
                <Text style={styles.secondaryText}>Cancel</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
