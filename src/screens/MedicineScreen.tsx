import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useTheme } from '../context/ThemeContext';
import { useMedicine } from '../context/MedicineContext';
import { usePremium, type PremiumFeature } from '../services/premiumService';
import { PremiumGateSheet } from '../components/PremiumGateSheet';
import { MedicineSheet } from '../components/MedicineSheet';
import { SCREEN_BOTTOM_INSET } from '../components/AdBanner';
import {
  addDays, adherence, dateKey, describeMealTiming, describeSchedule,
  dosesForDate, expiringSoon, formatTime, isMissed, isSnoozeActive, lowStock,
  MEDICINE_FORMS, nextDose, parseDateKey, SNOOZE_OPTIONS,
} from '../core/medicine';
import type { Medicine, ScheduledDose } from '../types/medicine';
import type { MedicineInput } from '../services/medicineService';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function MedicineScreen() {
  const navigation = useNavigation<Nav>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { hasPremium } = usePremium();
  const {
    profiles, activeProfileId, setActiveProfile, profileMedicines, profileLogs,
    loaded, addMedicine, editMedicine, removeMedicine, recordDose, clearDose,
    snooze,
  } = useMedicine();

  const [date, setDate] = useState(dateKey());
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Medicine | null>(null);
  const [gateFeature, setGateFeature] = useState<PremiumFeature | null>(null);

  const activeProfile = useMemo(
    () => profiles.find(p => p.id === activeProfileId) ?? profiles[0],
    [activeProfileId, profiles],
  );

  const doses = useMemo(
    () => dosesForDate(profileMedicines, profileLogs, date),
    [date, profileLogs, profileMedicines],
  );

  const taken = doses.filter(d => d.status === 'taken').length;
  const isToday = date === dateKey();

  const upcoming = useMemo(
    () => (isToday ? nextDose(profileMedicines, profileLogs) : null),
    [isToday, profileLogs, profileMedicines],
  );

  const weekStats = useMemo(
    () => adherence(profileMedicines, profileLogs, addDays(dateKey(), -6), dateKey()),
    [profileLogs, profileMedicines],
  );

  const refills = useMemo(
    () => (hasPremium ? lowStock(profileMedicines) : []),
    [hasPremium, profileMedicines],
  );

  const expiring = useMemo(
    () => expiringSoon(profileMedicines),
    [profileMedicines],
  );

  const activeMeds = useMemo(
    () => profileMedicines.filter(m => !m.archived),
    [profileMedicines],
  );

  const requirePremium = useCallback((feature: PremiumFeature, run: () => void) => {
    if (hasPremium) { run(); return; }
    setGateFeature(feature);
  }, [hasPremium]);

  const handleSave = useCallback(async (input: MedicineInput) => {
    if (editing) await editMedicine(editing.id, input);
    else await addMedicine(input);
    setSheetOpen(false);
    setEditing(null);
  }, [addMedicine, editMedicine, editing]);

  const handleDelete = useCallback(() => {
    if (!editing) return;
    Alert.alert(
      `Delete ${editing.name}?`,
      'Its dose history and reminders are removed too.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            await removeMedicine(editing.id);
            setSheetOpen(false);
            setEditing(null);
          },
        },
      ],
    );
  }, [editing, removeMedicine]);

  const toggleDose = useCallback(async (dose: ScheduledDose, status: 'taken' | 'skipped') => {
    // Tapping the same status again clears it, so a mis-tap is undoable.
    if (dose.status === status) {
      await clearDose(dose.medicine.id, dose.date, dose.minutes);
      return;
    }
    await recordDose({
      medicineId: dose.medicine.id,
      date: dose.date,
      scheduledMinutes: dose.minutes,
      status,
    });
  }, [clearDose, recordDose]);

  const promptSnooze = useCallback((dose: ScheduledDose) => {
    Alert.alert(
      `Snooze ${dose.medicine.name}`,
      'Remind me again in…',
      [
        ...SNOOZE_OPTIONS.map(minutes => ({
          text: minutes >= 60 ? `${minutes / 60} hour` : `${minutes} min`,
          onPress: () => snooze({
            medicineId: dose.medicine.id,
            date: dose.date,
            scheduledMinutes: dose.minutes,
            minutes,
          }),
        })),
        { text: 'Cancel', style: 'cancel' as const },
      ],
    );
  }, [snooze]);

  const openNewMedicine = useCallback(() => {
    if (!activeProfileId) return;
    setEditing(null);
    setSheetOpen(true);
  }, [activeProfileId]);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    header: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: theme.spacing.lg,
      paddingTop: insets.top + theme.spacing.md,
      paddingBottom: theme.spacing.md,
      backgroundColor: theme.colors.surface,
      gap: theme.spacing.sm,
    },
    title: {
      ...theme.typography.title, fontSize: 24, fontWeight: '700',
      color: theme.colors.text, flex: 1,
    },
    headerBtn: {
      width: 38, height: 38, borderRadius: 12,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: theme.colors.inputBg,
    },
    profileRow: {
      flexDirection: 'row', gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.md,
      backgroundColor: theme.colors.surface,
    },
    profileChip: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingHorizontal: 12, paddingVertical: 8,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.inputBg,
      borderWidth: 2, borderColor: 'transparent',
    },
    profileText: { ...theme.typography.caption, fontWeight: '700', color: theme.colors.text },
    dateRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.sm,
      backgroundColor: theme.colors.surface,
    },
    dateLabel: { ...theme.typography.body, fontWeight: '700', color: theme.colors.text },
    scroll: {
      padding: theme.spacing.lg,
      paddingBottom: SCREEN_BOTTOM_INSET + 60,
      gap: theme.spacing.md,
    },
    card: {
      backgroundColor: theme.colors.cardBg,
      borderRadius: theme.borderRadius.xl,
      padding: theme.spacing.lg,
      gap: theme.spacing.md,
      ...theme.shadows.card,
    },
    statRow: { flexDirection: 'row', gap: theme.spacing.md },
    stat: { flex: 1, gap: 2 },
    statLabel: { ...theme.typography.caption, fontSize: 11, color: theme.colors.textMuted },
    statValue: { fontSize: 20, fontWeight: '800', color: theme.colors.text },
    sectionTitle: {
      ...theme.typography.overline, color: theme.colors.textMuted,
      textTransform: 'uppercase', letterSpacing: 1, marginLeft: theme.spacing.xs,
    },
    doseRow: {
      flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
    },
    pill: {
      width: 42, height: 42, borderRadius: 13,
      alignItems: 'center', justifyContent: 'center',
    },
    doseName: { ...theme.typography.bodySmall, fontWeight: '700', color: theme.colors.text },
    doseMeta: { ...theme.typography.caption, fontSize: 11, color: theme.colors.textMuted },
    doseTaken: { textDecorationLine: 'line-through', color: theme.colors.textMuted },
    actionBtn: {
      width: 36, height: 36, borderRadius: 12,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: theme.colors.inputBg,
    },
    medRow: {
      flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
    },
    warnCard: {
      flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md,
      backgroundColor: theme.colors.error + '15',
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.md,
    },
    warnText: { ...theme.typography.caption, color: theme.colors.error, flex: 1, fontWeight: '600' },
    empty: {
      ...theme.typography.bodySmall, color: theme.colors.textMuted,
      textAlign: 'center', paddingVertical: theme.spacing.xl, lineHeight: 20,
    },
    fab: {
      position: 'absolute',
      right: theme.spacing.lg,
      bottom: insets.bottom + theme.spacing.lg,
      width: 58, height: 58, borderRadius: 29,
      backgroundColor: theme.colors.primary,
      alignItems: 'center', justifyContent: 'center',
      ...theme.shadows.fab,
    },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  }), [insets.bottom, insets.top, theme]);

  if (!loaded) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Medicine</Text>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => requirePremium('medicine_family', () => navigation.navigate('MedicineProfiles'))}
        >
          <Ionicons
            name={hasPremium ? 'people-outline' : 'lock-closed-outline'}
            size={18} color={theme.colors.textMuted}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => requirePremium('medicine_analytics', () => navigation.navigate('MedicineAnalytics'))}
        >
          <Ionicons
            name={hasPremium ? 'stats-chart-outline' : 'lock-closed-outline'}
            size={18} color={theme.colors.textMuted}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => navigation.navigate('MedicineHistory')}
        >
          <Ionicons name="time-outline" size={18} color={theme.colors.textMuted} />
        </TouchableOpacity>
      </View>

      {profiles.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.profileRow}
        >
          {profiles.map(p => {
            const on = p.id === activeProfileId;
            return (
              <TouchableOpacity
                key={p.id}
                style={[styles.profileChip, on && { borderColor: p.color, backgroundColor: p.color + '18' }]}
                onPress={() => setActiveProfile(p.id)}
              >
                <Ionicons name={p.icon} size={14} color={p.color} />
                <Text style={styles.profileText}>{p.name}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      <View style={styles.dateRow}>
        <TouchableOpacity onPress={() => setDate(addDays(date, -1))} style={{ padding: 6 }}>
          <Ionicons name="chevron-back" size={20} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.dateLabel}>
          {isToday ? 'Today' : parseDateKey(date).toLocaleDateString(undefined, {
            weekday: 'short', month: 'short', day: 'numeric',
          })}
        </Text>
        <TouchableOpacity
          onPress={() => setDate(addDays(date, 1))}
          style={{ padding: 6 }}
          disabled={isToday}
        >
          <Ionicons
            name="chevron-forward" size={20}
            color={isToday ? theme.colors.textDisabled : theme.colors.text}
          />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.statRow}>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Doses today</Text>
              <Text style={styles.statValue}>{taken}/{doses.length}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>7-day adherence</Text>
              <Text style={styles.statValue}>{Math.round(weekStats.rate * 100)}%</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Next dose</Text>
              <Text style={[styles.statValue, { fontSize: 15 }]}>
                {upcoming?.minutes != null ? formatTime(upcoming.minutes) : '—'}
              </Text>
            </View>
          </View>
        </View>

        {refills.length > 0 && (
          <TouchableOpacity
            style={styles.warnCard}
            onPress={() => navigation.navigate('MedicineInventory')}
            activeOpacity={0.8}
          >
            <Ionicons name="alert-circle-outline" size={20} color={theme.colors.error} />
            <Text style={styles.warnText}>
              {refills.length === 1
                ? `${refills[0].name} is running low`
                : `${refills.length} medicines running low`}
            </Text>
            <Ionicons name="chevron-forward" size={17} color={theme.colors.error} />
          </TouchableOpacity>
        )}

        {expiring.length > 0 && (
          <View style={[styles.warnCard, { backgroundColor: theme.colors.accent + '18' }]}>
            <Ionicons name="calendar-outline" size={20} color={theme.colors.accent} />
            <Text style={[styles.warnText, { color: theme.colors.accent }]}>
              {expiring.length === 1
                ? `${expiring[0].name} expires soon`
                : `${expiring.length} medicines expiring soon`}
            </Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>Schedule</Text>
        <View style={styles.card}>
          {doses.length === 0 ? (
            <Text style={styles.empty}>
              Nothing scheduled{isToday ? ' today' : ''}.{'\n'}
              Tap + to add a medicine.
            </Text>
          ) : (
            doses.map(dose => {
              const missed = isMissed(dose);
              const key = `${dose.medicine.id}-${dose.minutes ?? 'prn'}`;
              return (
                <View key={key} style={styles.doseRow}>
                  <View style={[styles.pill, { backgroundColor: dose.medicine.color + '22' }]}>
                    <Ionicons
                      name={MEDICINE_FORMS.find(f => f.value === dose.medicine.form)?.icon ?? 'medkit-outline'}
                      size={19}
                      color={dose.medicine.color}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.doseName, dose.status === 'taken' && styles.doseTaken]}>
                      {dose.medicine.name}
                    </Text>
                    <Text style={[styles.doseMeta, missed && { color: theme.colors.error }]}>
                      {dose.minutes === null ? 'As needed' : formatTime(dose.minutes)}
                      {dose.medicine.dosage ? ` · ${dose.medicine.dosage}` : ''}
                      {dose.medicine.mealTiming !== 'any'
                        ? ` · ${describeMealTiming(dose.medicine.mealTiming)}`
                        : ''}
                      {missed ? ' · missed' : ''}
                      {dose.status === 'skipped' ? ' · skipped' : ''}
                      {isSnoozeActive(dose) ? ' · snoozed' : ''}
                    </Text>
                  </View>
                  {dose.minutes !== null && dose.status !== 'taken' && (
                    <TouchableOpacity
                      style={[
                        styles.actionBtn,
                        dose.status === 'snoozed' && { backgroundColor: theme.colors.accent + '25' },
                      ]}
                      onPress={() => promptSnooze(dose)}
                      accessibilityLabel={`Snooze ${dose.medicine.name}`}
                    >
                      <Ionicons name="alarm-outline" size={17} color={theme.colors.accent} />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[
                      styles.actionBtn,
                      dose.status === 'skipped' && { backgroundColor: theme.colors.error + '20' },
                    ]}
                    onPress={() => toggleDose(dose, 'skipped')}
                    accessibilityLabel={`Skip ${dose.medicine.name}`}
                  >
                    <Ionicons name="close" size={18} color={theme.colors.error} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.actionBtn,
                      dose.status === 'taken' && { backgroundColor: theme.colors.success + '25' },
                    ]}
                    onPress={() => toggleDose(dose, 'taken')}
                    accessibilityLabel={`Mark ${dose.medicine.name} taken`}
                  >
                    <Ionicons name="checkmark" size={19} color={theme.colors.success} />
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </View>

        <Text style={styles.sectionTitle}>
          Medicines{activeMeds.length > 0 ? ` (${activeMeds.length})` : ''}
        </Text>
        <View style={styles.card}>
          {activeMeds.length === 0 ? (
            <Text style={styles.empty}>No medicines yet</Text>
          ) : (
            activeMeds.map(m => (
              <TouchableOpacity
                key={m.id}
                style={styles.medRow}
                onPress={() => { setEditing(m); setSheetOpen(true); }}
                activeOpacity={0.7}
              >
                <View style={[styles.pill, { backgroundColor: m.color + '22' }]}>
                  {m.photoUri ? (
                    <Image
                      source={{ uri: m.photoUri }}
                      style={StyleSheet.absoluteFill}
                      resizeMode="cover"
                    />
                  ) : (
                    <Ionicons
                      name={MEDICINE_FORMS.find(f => f.value === m.form)?.icon ?? 'medkit-outline'}
                      size={19} color={m.color}
                    />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.doseName}>{m.name}</Text>
                  <Text style={styles.doseMeta} numberOfLines={1}>
                    {describeSchedule(m)}
                    {m.stockCount !== null ? ` · ${m.stockCount} left` : ''}
                  </Text>
                </View>
                {!m.remindersEnabled && m.scheduleKind !== 'as_needed' && (
                  <Ionicons name="notifications-off-outline" size={16} color={theme.colors.textMuted} />
                )}
                <Ionicons name="chevron-forward" size={17} color={theme.colors.textDisabled} />
              </TouchableOpacity>
            ))
          )}
        </View>

        {hasPremium && activeMeds.some(m => m.stockCount !== null) && (
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('MedicineInventory')}
            activeOpacity={0.8}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
              <Ionicons name="cube-outline" size={20} color={theme.colors.primary} />
              <Text style={[styles.doseName, { flex: 1 }]}>Inventory</Text>
              <Ionicons name="chevron-forward" size={17} color={theme.colors.textDisabled} />
            </View>
          </TouchableOpacity>
        )}
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={openNewMedicine} activeOpacity={0.85}>
        <Ionicons name="add" size={30} color="#FFF" />
      </TouchableOpacity>

      {activeProfile && (
        <MedicineSheet
          visible={sheetOpen}
          profileId={activeProfile.id}
          editing={editing}
          canTrackStock={hasPremium}
          onSave={handleSave}
          onDelete={editing ? handleDelete : undefined}
          onClose={() => { setSheetOpen(false); setEditing(null); }}
        />
      )}
      <PremiumGateSheet
        visible={gateFeature !== null}
        feature={gateFeature ?? undefined}
        onClose={() => setGateFeature(null)}
      />
    </View>
  );
}
