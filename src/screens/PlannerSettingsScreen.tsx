/**
 * PlannerSettingsScreen — planner preferences and theme picker.
 *
 * Day window, working hours, auto-scheduling buffer and default reminder are
 * free. Themes beyond Classic are premium; selecting a locked one opens the
 * upgrade sheet instead of silently doing nothing.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { PremiumGateSheet } from '../components/PremiumGateSheet';
import { PLANNER_THEMES } from '../core/plannerThemes';
import { usePlanner } from '../context/PlannerContext';
import { useTheme } from '../context/ThemeContext';
import { rescheduleAllBlockReminders } from '../services/plannerService';
import { usePremium } from '../services/premiumService';

const REMINDER_CHOICES: { value: number | null; label: string }[] = [
  { value: null, label: 'Off' },
  { value: 0, label: 'At start' },
  { value: 5, label: '5 min' },
  { value: 10, label: '10 min' },
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
];

const BUFFER_CHOICES = [0, 5, 10, 15, 30];

export function PlannerSettingsScreen() {
  const navigation = useNavigation<any>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { hasPremium } = usePremium();
  const { prefs, updatePrefs } = usePlanner();

  const [gateOpen, setGateOpen] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const [rescheduleResult, setRescheduleResult] = useState<string | null>(null);

  const stepHour = useCallback((
    key: 'dayStartHour' | 'dayEndHour' | 'workStartHour' | 'workEndHour',
    delta: number
  ) => {
    const current = prefs[key];
    let next = current + delta;

    // Keep the windows coherent: start < end, and working hours inside the day.
    if (key === 'dayStartHour') next = Math.max(0, Math.min(prefs.dayEndHour - 1, next));
    if (key === 'dayEndHour') next = Math.max(prefs.dayStartHour + 1, Math.min(24, next));
    if (key === 'workStartHour') next = Math.max(prefs.dayStartHour, Math.min(prefs.workEndHour - 1, next));
    if (key === 'workEndHour') next = Math.max(prefs.workStartHour + 1, Math.min(prefs.dayEndHour, next));

    if (next !== current) updatePrefs({ [key]: next } as any);
  }, [prefs, updatePrefs]);

  const selectTheme = useCallback((id: string, premium: boolean) => {
    if (premium && !hasPremium) { setGateOpen(true); return; }
    updatePrefs({ themeId: id });
  }, [hasPremium, updatePrefs]);

  const doReschedule = useCallback(async () => {
    setRescheduling(true);
    const count = await rescheduleAllBlockReminders();
    setRescheduling(false);
    // An inline result reads better than an alert for a maintenance action.
    setRescheduleResult(`${count} reminder${count === 1 ? '' : 's'} re-armed`);
  }, []);

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
    content: { padding: theme.spacing.lg, paddingBottom: 60, gap: theme.spacing.lg },
    sectionLabel: {
      ...theme.typography.overline, color: theme.colors.textMuted,
      textTransform: 'uppercase', marginBottom: theme.spacing.sm, marginLeft: 2,
    },
    card: {
      backgroundColor: theme.colors.cardBg, borderRadius: theme.borderRadius.xl,
      padding: theme.spacing.lg, ...theme.shadows.card,
    },
    row: {
      flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm,
      paddingVertical: 11,
    },
    rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.borderSubtle },
    rowLabel: { ...theme.typography.bodySmall, color: theme.colors.text, flex: 1, fontWeight: '600' },
    rowHint: { ...theme.typography.caption, fontSize: 11.5, color: theme.colors.textMuted, marginTop: 2 },
    stepper: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      backgroundColor: theme.colors.inputBg, borderRadius: 10, padding: 3,
    },
    stepBtn: {
      width: 30, height: 30, borderRadius: 8, backgroundColor: theme.colors.surface,
      alignItems: 'center', justifyContent: 'center',
    },
    stepValue: {
      minWidth: 58, textAlign: 'center',
      ...theme.typography.bodySmall, fontWeight: '800', color: theme.colors.text,
    },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
    chip: {
      paddingHorizontal: 13, paddingVertical: 8, borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.inputBg, borderWidth: 1.5, borderColor: 'transparent',
    },
    chipText: { ...theme.typography.caption, fontWeight: '700', color: theme.colors.textSecondary },
    chipActive: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primaryLight },
    chipTextActive: { color: theme.colors.primary },

    themeCard: {
      flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md,
      paddingVertical: 11,
    },
    themePreview: {
      width: 52, height: 40, borderRadius: 10, overflow: 'hidden',
      borderWidth: 1, borderColor: theme.colors.border,
    },
    themeTop: { flex: 1 },
    themeBottom: { flex: 1.4, justifyContent: 'center', paddingHorizontal: 4, gap: 2 },
    themeBar: { height: 4, borderRadius: 2, width: '80%' },
    themeName: { ...theme.typography.bodySmall, fontWeight: '700', color: theme.colors.text },
    proTag: {
      paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5,
      backgroundColor: theme.colors.accent + '22',
    },
    proTagText: { fontSize: 9, fontWeight: '800', color: theme.colors.accent, letterSpacing: 0.4 },
    maintenanceBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      backgroundColor: theme.colors.inputBg, borderRadius: theme.borderRadius.md,
      paddingVertical: 13,
    },
    maintenanceText: { ...theme.typography.caption, fontWeight: '800', color: theme.colors.primary },
    result: { ...theme.typography.caption, color: theme.colors.success, textAlign: 'center', marginTop: 8, fontWeight: '700' },
    footNote: { ...theme.typography.caption, fontSize: 11.5, color: theme.colors.textMuted, lineHeight: 17, marginTop: 8 },
  }), [insets, theme]);

  const hourText = (hour: number) => {
    if (hour === 24) return '12 am';
    return `${hour % 12 || 12} ${hour < 12 ? 'am' : 'pm'}`;
  };

  const hourRow = (
    label: string,
    hint: string,
    key: 'dayStartHour' | 'dayEndHour' | 'workStartHour' | 'workEndHour',
    divider = true
  ) => (
    <View style={[styles.row, divider && styles.rowDivider]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowHint}>{hint}</Text>
      </View>
      <View style={styles.stepper}>
        <TouchableOpacity style={styles.stepBtn} onPress={() => stepHour(key, -1)}>
          <Ionicons name="remove" size={16} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.stepValue}>{hourText(prefs[key])}</Text>
        <TouchableOpacity style={styles.stepBtn} onPress={() => stepHour(key, 1)}>
          <Ionicons name="add" size={16} color={theme.colors.text} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={19} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Planner Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Day window */}
        <View>
          <Text style={styles.sectionLabel}>Timeline</Text>
          <View style={styles.card}>
            {hourRow('Day starts', 'First hour shown on the timeline', 'dayStartHour')}
            {hourRow('Day ends', 'Last hour shown on the timeline', 'dayEndHour', false)}
          </View>
        </View>

        {/* Working hours */}
        <View>
          <Text style={styles.sectionLabel}>Working hours</Text>
          <View style={styles.card}>
            {hourRow('Work starts', 'Auto-scheduling won\'t place work before this', 'workStartHour')}
            {hourRow('Work ends', 'Auto-scheduling won\'t place work after this', 'workEndHour')}
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>Buffer between blocks</Text>
                <Text style={styles.rowHint}>Breathing room left by auto time blocking</Text>
              </View>
            </View>
            <View style={styles.chipRow}>
              {BUFFER_CHOICES.map(b => (
                <TouchableOpacity
                  key={b}
                  style={[styles.chip, prefs.bufferMinutes === b && styles.chipActive]}
                  onPress={() => updatePrefs({ bufferMinutes: b })}
                >
                  <Text style={[styles.chipText, prefs.bufferMinutes === b && styles.chipTextActive]}>
                    {b === 0 ? 'None' : `${b} min`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Reminders */}
        <View>
          <Text style={styles.sectionLabel}>Reminders</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>Default lead time</Text>
                <Text style={styles.rowHint}>Applied to new time blocks</Text>
              </View>
            </View>
            <View style={styles.chipRow}>
              {REMINDER_CHOICES.map(choice => {
                const active = prefs.defaultReminderMinutes === choice.value;
                return (
                  <TouchableOpacity
                    key={String(choice.value)}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => updatePrefs({ defaultReminderMinutes: choice.value })}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{choice.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity
              style={[styles.maintenanceBtn, { marginTop: theme.spacing.md }]}
              onPress={doReschedule}
              disabled={rescheduling}
            >
              <Ionicons name="refresh-outline" size={16} color={theme.colors.primary} />
              <Text style={styles.maintenanceText}>
                {rescheduling ? 'Re-arming…' : 'Re-arm all block reminders'}
              </Text>
            </TouchableOpacity>
            {rescheduleResult && <Text style={styles.result}>{rescheduleResult}</Text>}
            <Text style={styles.footNote}>
              Android clears pending alarms after a reboot or app update. The planner re-arms them
              automatically on launch; use this if a reminder ever goes missing.
            </Text>
          </View>
        </View>

        {/* Timeline contents */}
        <View>
          <Text style={styles.sectionLabel}>Show on the timeline</Text>
          <View style={styles.card}>
            <View style={[styles.row, styles.rowDivider]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>Tasks with a due time</Text>
                <Text style={styles.rowHint}>Shown as dashed placeholders you can turn into blocks</Text>
              </View>
              <Switch
                value={prefs.showTasks}
                onValueChange={v => updatePrefs({ showTasks: v })}
                trackColor={{ true: theme.colors.primary, false: theme.colors.border }}
                thumbColor="#FFF"
              />
            </View>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>Habits with a reminder time</Text>
                <Text style={styles.rowHint}>Only on days the habit is scheduled</Text>
              </View>
              <Switch
                value={prefs.showHabits}
                onValueChange={v => updatePrefs({ showHabits: v })}
                trackColor={{ true: theme.colors.primary, false: theme.colors.border }}
                thumbColor="#FFF"
              />
            </View>
          </View>
        </View>

        {/* Themes */}
        <View>
          <Text style={styles.sectionLabel}>Planner theme</Text>
          <View style={styles.card}>
            {PLANNER_THEMES.map((plannerTheme, i) => {
              const active = prefs.themeId === plannerTheme.id;
              const locked = plannerTheme.premium && !hasPremium;
              return (
                <TouchableOpacity
                  key={plannerTheme.id}
                  style={[styles.themeCard, i < PLANNER_THEMES.length - 1 && styles.rowDivider]}
                  onPress={() => selectTheme(plannerTheme.id, plannerTheme.premium)}
                  activeOpacity={0.75}
                >
                  <View style={styles.themePreview}>
                    <View style={[styles.themeTop, { backgroundColor: plannerTheme.headerGradient[0] }]} />
                    <View style={[styles.themeBottom, {
                      backgroundColor: plannerTheme.timelineBg ?? theme.colors.background,
                    }]}>
                      <View style={[styles.themeBar, { backgroundColor: plannerTheme.nowLine }]} />
                      <View style={[styles.themeBar, { backgroundColor: plannerTheme.gridLine, width: '60%' }]} />
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                      <Text style={styles.themeName}>{plannerTheme.emoji} {plannerTheme.name}</Text>
                      {locked && <View style={styles.proTag}><Text style={styles.proTagText}>PRO</Text></View>}
                    </View>
                  </View>
                  {active && !locked ? (
                    <Ionicons name="checkmark-circle" size={22} color={theme.colors.primary} />
                  ) : locked ? (
                    <Ionicons name="lock-closed-outline" size={18} color={theme.colors.textMuted} />
                  ) : (
                    <Ionicons name="ellipse-outline" size={20} color={theme.colors.border} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <PremiumGateSheet visible={gateOpen} feature="planner_themes" onClose={() => setGateOpen(false)} />
    </View>
  );
}
