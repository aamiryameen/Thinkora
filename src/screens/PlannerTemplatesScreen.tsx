/**
 * PlannerTemplatesScreen — apply, create and manage day templates.
 *
 * Free users can apply the one built-in "Balanced Day" template; the rest,
 * plus creating custom templates, is premium. A custom template can be built
 * from scratch or snapshotted from the currently-selected day's blocks.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Modal, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { PremiumGateSheet } from '../components/PremiumGateSheet';
import { usePlanner } from '../context/PlannerContext';
import { useTheme } from '../context/ThemeContext';
import {
  addCustomTemplate, BUILT_IN_TEMPLATES, deleteCustomTemplate, FREE_TEMPLATE_ID,
  getCustomTemplates, templateFromBlocks,
} from '../services/plannerTemplateService';
import { formatDuration, formatMinutes } from '../services/plannerService';
import { usePremium, type PremiumFeature } from '../services/premiumService';
import type { PlannerTemplate } from '../types/planner';

const ICON_CHOICES = [
  'sunny-outline', 'briefcase-outline', 'school-outline', 'barbell-outline',
  'moon-outline', 'home-outline', 'cafe-outline', 'rocket-outline',
  'heart-outline', 'color-palette-outline',
];

export function PlannerTemplatesScreen() {
  const navigation = useNavigation<any>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { hasPremium } = usePremium();
  const { applyTemplate, blocks, selectedDate } = usePlanner();

  const [custom, setCustom] = useState<PlannerTemplate[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [gateFeature, setGateFeature] = useState<PremiumFeature | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState(ICON_CHOICES[0]);
  const [newDescription, setNewDescription] = useState('');

  const reload = useCallback(async () => { setCustom(await getCustomTemplates()); }, []);
  useEffect(() => { reload(); }, [reload]);

  const handleApply = useCallback((template: PlannerTemplate) => {
    const locked = !hasPremium && template.id !== FREE_TEMPLATE_ID;
    if (locked) { setGateFeature('planner_templates'); return; }

    const hasExisting = blocks.length > 0;
    const apply = async (replace: boolean) => {
      const count = await applyTemplate(template.id, { replace });
      Alert.alert(
        'Template applied',
        `Added ${count} block${count === 1 ? '' : 's'} to your day.`,
        [{ text: 'View day', onPress: () => navigation.goBack() }, { text: 'Stay here', style: 'cancel' }]
      );
    };

    if (!hasExisting) { apply(false); return; }
    Alert.alert(
      `Apply "${template.name}"?`,
      `This day already has ${blocks.length} block${blocks.length === 1 ? '' : 's'}. Replace them, or add the template on top?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Add on top', onPress: () => apply(false) },
        { text: 'Replace', style: 'destructive', onPress: () => apply(true) },
      ]
    );
  }, [applyTemplate, blocks.length, hasPremium, navigation]);

  const handleCreateFromDay = useCallback(async () => {
    if (!hasPremium) { setGateFeature('planner_custom_templates'); return; }
    if (blocks.length === 0) {
      Alert.alert('Nothing to save', 'Add some time blocks to the day first, then save it as a template.');
      return;
    }
    setNewName('');
    setNewDescription(`Snapshot of ${selectedDate} · ${blocks.length} blocks`);
    setNewIcon(ICON_CHOICES[0]);
    setCreateOpen(true);
  }, [blocks.length, hasPremium, selectedDate]);

  const submitCreate = useCallback(async () => {
    const name = newName.trim();
    if (!name) { Alert.alert('Name required', 'Give your template a name.'); return; }
    await addCustomTemplate(templateFromBlocks(
      name,
      newIcon,
      newDescription.trim(),
      blocks.map(b => ({
        title: b.title,
        kind: b.kind,
        startMinutes: b.startMinutes,
        durationMinutes: b.durationMinutes,
        color: b.color,
      }))
    ));
    await reload();
    setCreateOpen(false);
    Alert.alert('Template saved', `"${name}" is ready to reuse on any day.`);
  }, [blocks, newDescription, newIcon, newName, reload]);

  const handleDelete = useCallback((template: PlannerTemplate) => {
    Alert.alert(`Delete "${template.name}"?`, 'This only removes the template, not any days you applied it to.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => { await deleteCustomTemplate(template.id); await reload(); },
      },
    ]);
  }, [reload]);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    header: {
      paddingTop: insets.top + theme.spacing.sm,
      paddingBottom: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      backgroundColor: theme.colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
      flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm,
    },
    headerTitle: { ...theme.typography.titleSmall, fontWeight: '800', color: theme.colors.text, flex: 1 },
    iconBtn: {
      width: 34, height: 34, borderRadius: 11,
      backgroundColor: theme.colors.inputBg, alignItems: 'center', justifyContent: 'center',
    },
    content: { padding: theme.spacing.lg, paddingBottom: 60, gap: theme.spacing.md },
    intro: { ...theme.typography.bodySmall, color: theme.colors.textMuted, lineHeight: 20, marginBottom: 2 },
    sectionLabel: {
      ...theme.typography.overline, color: theme.colors.textMuted,
      textTransform: 'uppercase', marginTop: theme.spacing.sm,
    },
    card: {
      backgroundColor: theme.colors.cardBg,
      borderRadius: theme.borderRadius.xl,
      padding: theme.spacing.lg,
      ...theme.shadows.card,
      gap: theme.spacing.sm,
    },
    cardHead: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
    cardIcon: {
      width: 44, height: 44, borderRadius: 14,
      backgroundColor: theme.colors.primaryLight,
      alignItems: 'center', justifyContent: 'center',
    },
    cardName: { ...theme.typography.body, fontWeight: '800', color: theme.colors.text },
    cardMeta: { ...theme.typography.caption, fontSize: 11.5, color: theme.colors.textMuted, marginTop: 2 },
    cardDesc: { ...theme.typography.bodySmall, color: theme.colors.textSecondary, lineHeight: 19 },
    proTag: {
      paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6,
      backgroundColor: theme.colors.accent + '22',
    },
    proTagText: { fontSize: 9, fontWeight: '800', color: theme.colors.accent, letterSpacing: 0.4 },
    freeTag: {
      paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6,
      backgroundColor: theme.colors.successLight,
    },
    freeTagText: { fontSize: 9, fontWeight: '800', color: theme.colors.success, letterSpacing: 0.4 },
    blockLine: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, paddingVertical: 4 },
    blockDot: { width: 8, height: 8, borderRadius: 3 },
    blockTime: { ...theme.typography.caption, fontSize: 11, color: theme.colors.textMuted, width: 66, fontWeight: '600' },
    blockTitle: { ...theme.typography.bodySmall, color: theme.colors.text, flex: 1 },
    blockDur: { ...theme.typography.caption, fontSize: 10.5, color: theme.colors.textMuted },
    actionRow: { flexDirection: 'row', gap: theme.spacing.sm, marginTop: 4 },
    applyBtn: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      backgroundColor: theme.colors.primary,
      borderRadius: theme.borderRadius.md, paddingVertical: 12,
    },
    applyText: { ...theme.typography.caption, fontWeight: '800', color: '#FFF' },
    secondaryBtn: {
      paddingHorizontal: 14, justifyContent: 'center', alignItems: 'center',
      borderRadius: theme.borderRadius.md, backgroundColor: theme.colors.inputBg,
    },
    createCard: {
      backgroundColor: theme.colors.cardBg,
      borderRadius: theme.borderRadius.xl,
      padding: theme.spacing.lg,
      borderWidth: 1.5, borderStyle: 'dashed', borderColor: theme.colors.border,
      flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md,
    },
    createTitle: { ...theme.typography.bodySmall, fontWeight: '800', color: theme.colors.text },
    createHint: { ...theme.typography.caption, fontSize: 11.5, color: theme.colors.textMuted, marginTop: 2 },

    // Create modal
    overlay: { flex: 1, backgroundColor: theme.colors.overlay, justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: 26, borderTopRightRadius: 26,
      padding: theme.spacing.lg, paddingBottom: insets.bottom + theme.spacing.lg,
      gap: theme.spacing.md,
    },
    // maxHeight must sit on the ScrollView itself, not its content container.
    // The surface + rounded corners live here too, so the sheet still reads as
    // one card when the content is shorter than the cap.
    sheetScroll: {
      flexGrow: 0, flexShrink: 1, maxHeight: '88%',
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: 26, borderTopRightRadius: 26,
    },
    sheetTitle: { ...theme.typography.titleSmall, fontWeight: '800', color: theme.colors.text },
    label: { ...theme.typography.overline, color: theme.colors.textMuted, textTransform: 'uppercase', marginBottom: 6 },
    input: {
      backgroundColor: theme.colors.inputBg, borderRadius: theme.borderRadius.md,
      paddingHorizontal: 14, paddingVertical: 12,
      ...theme.typography.body, color: theme.colors.text,
    },
    iconRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    iconChoice: {
      width: 42, height: 42, borderRadius: 12,
      backgroundColor: theme.colors.inputBg,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 2, borderColor: 'transparent',
    },
    saveBtn: {
      backgroundColor: theme.colors.primary, borderRadius: theme.borderRadius.lg,
      paddingVertical: 15, alignItems: 'center',
    },
    saveText: { ...theme.typography.button, fontWeight: '800', color: '#FFF' },
  }), [insets, theme]);

  const renderTemplate = (template: PlannerTemplate) => {
    const locked = !hasPremium && template.id !== FREE_TEMPLATE_ID;
    const expanded = expandedId === template.id;
    const totalMinutes = template.blocks.reduce((s, b) => s + b.durationMinutes, 0);

    return (
      <View key={template.id} style={styles.card}>
        <TouchableOpacity
          style={styles.cardHead}
          onPress={() => setExpandedId(expanded ? null : template.id)}
          activeOpacity={0.7}
        >
          <View style={styles.cardIcon}>
            <Ionicons name={template.icon} size={22} color={theme.colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
              <Text style={styles.cardName}>{template.name}</Text>
              {locked ? (
                <View style={styles.proTag}><Text style={styles.proTagText}>PRO</Text></View>
              ) : template.id === FREE_TEMPLATE_ID ? (
                <View style={styles.freeTag}><Text style={styles.freeTagText}>FREE</Text></View>
              ) : null}
            </View>
            <Text style={styles.cardMeta}>
              {template.blocks.length} blocks · {formatDuration(totalMinutes)}
            </Text>
          </View>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={19}
            color={theme.colors.textMuted}
          />
        </TouchableOpacity>

        {template.description ? <Text style={styles.cardDesc}>{template.description}</Text> : null}

        {expanded && (
          <View>
            {template.blocks.map((b, i) => (
              <View key={`${template.id}-${i}`} style={styles.blockLine}>
                <View style={[styles.blockDot, { backgroundColor: b.color }]} />
                <Text style={styles.blockTime}>{formatMinutes(b.startMinutes)}</Text>
                <Text style={styles.blockTitle} numberOfLines={1}>{b.title}</Text>
                <Text style={styles.blockDur}>{formatDuration(b.durationMinutes)}</Text>
              </View>
            ))}
            {template.suggestedGoals.length > 0 && (
              <>
                <Text style={[styles.label, { marginTop: 10 }]}>Suggested goals</Text>
                {template.suggestedGoals.map(g => (
                  <Text key={g} style={styles.cardMeta}>• {g}</Text>
                ))}
              </>
            )}
          </View>
        )}

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.applyBtn} onPress={() => handleApply(template)} activeOpacity={0.85}>
            <Ionicons name={locked ? 'lock-closed' : 'add'} size={15} color="#FFF" />
            <Text style={styles.applyText}>{locked ? 'Unlock' : 'Apply to this day'}</Text>
          </TouchableOpacity>
          {!template.builtIn && (
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => handleDelete(template)}>
              <Ionicons name="trash-outline" size={18} color={theme.colors.error} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={19} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Planner Templates</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>
          A template drops a whole day's worth of time blocks onto the day you're viewing.
          Apply one, then drag things around to fit reality.
        </Text>

        <TouchableOpacity style={styles.createCard} onPress={handleCreateFromDay} activeOpacity={0.75}>
          <View style={styles.cardIcon}>
            <Ionicons name="bookmark-outline" size={22} color={theme.colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
              <Text style={styles.createTitle}>Save this day as a template</Text>
              {!hasPremium && <View style={styles.proTag}><Text style={styles.proTagText}>PRO</Text></View>}
            </View>
            <Text style={styles.createHint}>
              {blocks.length > 0
                ? `Snapshots the ${blocks.length} block${blocks.length === 1 ? '' : 's'} on your current day`
                : 'Add blocks to a day first, then snapshot it'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
        </TouchableOpacity>

        {custom.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Your templates</Text>
            {custom.map(renderTemplate)}
          </>
        )}

        <Text style={styles.sectionLabel}>Built-in</Text>
        {BUILT_IN_TEMPLATES.map(renderTemplate)}
      </ScrollView>

      {/* Create-template sheet */}
      <Modal visible={createOpen} transparent animationType="slide" onRequestClose={() => setCreateOpen(false)}>
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setCreateOpen(false)} />
          <ScrollView
            style={styles.sheetScroll}
            contentContainerStyle={styles.sheet}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.sheetTitle}>Save as template</Text>
            <View>
              <Text style={styles.label}>Name</Text>
              <TextInput
                style={styles.input}
                value={newName}
                onChangeText={setNewName}
                placeholder="My ideal workday"
                placeholderTextColor={theme.colors.textMuted}
                autoFocus
              />
            </View>
            <View>
              <Text style={styles.label}>Description</Text>
              <TextInput
                style={styles.input}
                value={newDescription}
                onChangeText={setNewDescription}
                placeholder="What is this day shaped for?"
                placeholderTextColor={theme.colors.textMuted}
              />
            </View>
            <View>
              <Text style={styles.label}>Icon</Text>
              <View style={styles.iconRow}>
                {ICON_CHOICES.map(icon => (
                  <TouchableOpacity
                    key={icon}
                    style={[styles.iconChoice, newIcon === icon && { borderColor: theme.colors.primary }]}
                    onPress={() => setNewIcon(icon)}
                  >
                    <Ionicons
                      name={icon}
                      size={20}
                      color={newIcon === icon ? theme.colors.primary : theme.colors.textMuted}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <TouchableOpacity style={styles.saveBtn} onPress={submitCreate} activeOpacity={0.85}>
              <Text style={styles.saveText}>Save Template</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <PremiumGateSheet
        visible={gateFeature !== null}
        feature={gateFeature ?? undefined}
        onClose={() => setGateFeature(null)}
      />
    </View>
  );
}
