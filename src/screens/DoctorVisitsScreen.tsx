import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert, Modal, ScrollView, StyleSheet, Switch, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { useMedicine } from '../context/MedicineContext';
import {
  dateKey, formatTime, isDateKey, parseDateKey, parseTimeInput,
} from '../core/medicine';
import type { DoctorVisit } from '../types/medicine';

export function DoctorVisitsScreen() {
  const nav = useNavigation();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const {
    profiles, activeProfileId, profileVisits, addVisit, editVisit, removeVisit,
  } = useMedicine();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<DoctorVisit | null>(null);
  const [doctorName, setDoctorName] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState(dateKey());
  const [time, setTime] = useState('10:00');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [followUp, setFollowUp] = useState('');
  const [remind, setRemind] = useState(true);

  const profile = useMemo(
    () => profiles.find(p => p.id === activeProfileId),
    [activeProfileId, profiles],
  );

  const today = dateKey();
  const upcoming = useMemo(
    () => profileVisits.filter(v => !v.completed && v.date >= today),
    [profileVisits, today],
  );
  const past = useMemo(
    () => profileVisits
      .filter(v => v.completed || v.date < today)
      .sort((a, b) => b.date.localeCompare(a.date)),
    [profileVisits, today],
  );

  const openForm = useCallback((visit: DoctorVisit | null) => {
    setEditing(visit);
    setDoctorName(visit?.doctorName ?? profile?.doctorName ?? '');
    setLocation(visit?.location ?? '');
    setDate(visit?.date ?? dateKey());
    setTime(visit
      ? `${String(Math.floor(visit.minutes / 60)).padStart(2, '0')}:${String(visit.minutes % 60).padStart(2, '0')}`
      : '10:00');
    setReason(visit?.reason ?? '');
    setNotes(visit?.prescriptionNotes ?? '');
    setFollowUp(visit?.followUpDate ?? '');
    setRemind(visit?.reminderEnabled ?? true);
    setFormOpen(true);
  }, [profile?.doctorName]);

  const save = useCallback(async () => {
    if (!activeProfileId) return;

    // Reject a malformed date rather than defaulting to today — every reminder
    // hangs off it, so a silent fallback would fire alarms straight away.
    const cleanDate = date.trim();
    if (!isDateKey(cleanDate)) {
      Alert.alert('Check the date', 'Enter the appointment date as YYYY-MM-DD.');
      return;
    }

    const cleanFollowUp = followUp.trim();
    if (cleanFollowUp && !isDateKey(cleanFollowUp)) {
      Alert.alert('Check the follow-up date', 'Enter it as YYYY-MM-DD, or leave it empty.');
      return;
    }

    const minutes = parseTimeInput(time);
    if (minutes === null) {
      Alert.alert('Check the time', 'Enter the time as HH:MM, for example 14:30.');
      return;
    }

    const payload = {
      profileId: activeProfileId,
      doctorName: doctorName.trim(),
      location: location.trim(),
      date: cleanDate,
      minutes,
      reason: reason.trim(),
      prescriptionNotes: notes.trim(),
      followUpDate: cleanFollowUp || null,
      reminderEnabled: remind,
    };

    setFormOpen(false);
    if (editing) await editVisit(editing.id, payload);
    else await addVisit(payload);
    setEditing(null);
  }, [activeProfileId, addVisit, date, doctorName, editVisit, editing, followUp, location, notes, reason, remind, time]);

  const confirmDelete = useCallback((visit: DoctorVisit) => {
    Alert.alert(
      'Delete appointment?',
      visit.doctorName ? `Visit with ${visit.doctorName}` : 'This appointment',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => removeVisit(visit.id) },
      ],
    );
  }, [removeVisit]);

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
    iconBtn: {
      width: 38, height: 38, borderRadius: 12,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: theme.colors.inputBg,
    },
    addBtn: {
      width: 38, height: 38, borderRadius: 12,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: theme.colors.primary,
    },
    titleWrap: { flex: 1 },
    title: { ...theme.typography.title, fontSize: 22, fontWeight: '700', color: theme.colors.text },
    subtitle: { ...theme.typography.caption, color: theme.colors.textMuted },
    scroll: { padding: theme.spacing.lg, paddingBottom: 140, gap: theme.spacing.sm },
    sectionTitle: {
      ...theme.typography.overline, color: theme.colors.textMuted,
      textTransform: 'uppercase', letterSpacing: 1,
      marginLeft: theme.spacing.xs, marginTop: theme.spacing.sm,
    },
    card: {
      backgroundColor: theme.colors.cardBg,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.md,
      gap: 6,
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
    dateBox: {
      width: 52, borderRadius: 12, paddingVertical: 6,
      alignItems: 'center',
      backgroundColor: theme.colors.primaryLight,
    },
    dateDay: { fontSize: 19, fontWeight: '800', color: theme.colors.primary },
    dateMonth: { ...theme.typography.caption, fontSize: 10, color: theme.colors.primary },
    name: { ...theme.typography.bodySmall, fontWeight: '700', color: theme.colors.text },
    meta: { ...theme.typography.caption, fontSize: 11, color: theme.colors.textMuted },
    notes: {
      ...theme.typography.caption, fontSize: 12, color: theme.colors.textSecondary,
      backgroundColor: theme.colors.inputBg,
      padding: theme.spacing.sm, borderRadius: theme.borderRadius.md,
    },
    badge: {
      paddingHorizontal: 8, paddingVertical: 3,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.accent + '22',
    },
    badgeText: {
      ...theme.typography.caption, fontSize: 10, fontWeight: '800',
      color: theme.colors.accent,
    },
    empty: {
      ...theme.typography.bodySmall, color: theme.colors.textMuted,
      textAlign: 'center', paddingVertical: theme.spacing.xxl, lineHeight: 20,
    },
    overlay: { flex: 1, backgroundColor: theme.colors.overlay, justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: 28, borderTopRightRadius: 28,
      paddingTop: theme.spacing.lg,
      paddingBottom: insets.bottom + theme.spacing.lg,
      maxHeight: '90%',
    },
    grabber: {
      alignSelf: 'center', width: 40, height: 4, borderRadius: 2,
      backgroundColor: theme.colors.border, marginBottom: theme.spacing.md,
    },
    body: { paddingHorizontal: theme.spacing.lg, gap: theme.spacing.lg },
    label: {
      ...theme.typography.caption, color: theme.colors.textMuted,
      textTransform: 'uppercase', letterSpacing: 1, fontWeight: '700',
    },
    input: {
      backgroundColor: theme.colors.inputBg,
      borderRadius: theme.borderRadius.lg,
      paddingVertical: 12, paddingHorizontal: theme.spacing.lg,
      borderWidth: 2, borderColor: theme.colors.border,
      ...theme.typography.body, color: theme.colors.text,
    },
    switchRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    },
    switchLabel: { ...theme.typography.bodySmall, color: theme.colors.text, flex: 1 },
    save: {
      backgroundColor: theme.colors.primary,
      borderRadius: theme.borderRadius.lg,
      paddingVertical: 15, alignItems: 'center',
    },
    saveText: { ...theme.typography.button, color: '#FFF', fontWeight: '800' },
  }), [insets.bottom, insets.top, theme]);

  const renderVisit = (visit: DoctorVisit, isPast: boolean) => {
    const d = parseDateKey(visit.date);
    return (
      <View key={visit.id} style={styles.card}>
        <View style={styles.row}>
          <View style={[
            styles.dateBox,
            isPast && { backgroundColor: theme.colors.inputBg },
          ]}>
            <Text style={[styles.dateDay, isPast && { color: theme.colors.textMuted }]}>
              {d.getDate()}
            </Text>
            <Text style={[styles.dateMonth, isPast && { color: theme.colors.textMuted }]}>
              {d.toLocaleDateString(undefined, { month: 'short' }).toUpperCase()}
            </Text>
          </View>

          <TouchableOpacity style={{ flex: 1 }} onPress={() => openForm(visit)} activeOpacity={0.7}>
            <Text style={styles.name} numberOfLines={1}>
              {visit.doctorName || 'Appointment'}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              {formatTime(visit.minutes)}
              {visit.location ? ` · ${visit.location}` : ''}
            </Text>
            {visit.reason ? (
              <Text style={styles.meta} numberOfLines={1}>{visit.reason}</Text>
            ) : null}
          </TouchableOpacity>

          {!isPast && (
            <TouchableOpacity
              onPress={() => editVisit(visit.id, { completed: true })}
              style={{ padding: 6 }}
              accessibilityLabel="Mark as attended"
            >
              <Ionicons name="checkmark-circle-outline" size={21} color={theme.colors.success} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => confirmDelete(visit)}
            style={{ padding: 6 }}
            accessibilityLabel="Delete appointment"
          >
            <Ionicons name="trash-outline" size={18} color={theme.colors.error} />
          </TouchableOpacity>
        </View>

        {visit.followUpDate ? (
          <View style={{ flexDirection: 'row' }}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>FOLLOW-UP {visit.followUpDate}</Text>
            </View>
          </View>
        ) : null}

        {visit.prescriptionNotes ? (
          <Text style={styles.notes}>{visit.prescriptionNotes}</Text>
        ) : null}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => nav.goBack()}>
          <Ionicons name="chevron-back" size={20} color={theme.colors.text} />
        </TouchableOpacity>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>Doctor visits</Text>
          <Text style={styles.subtitle}>{profile?.name ?? 'Me'}</Text>
        </View>
        <TouchableOpacity
          style={[styles.addBtn, !activeProfileId && { opacity: 0.45 }]}
          disabled={!activeProfileId}
          onPress={() => openForm(null)}
        >
          <Ionicons name="add" size={22} color="#FFF" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {profileVisits.length === 0 ? (
          <Text style={styles.empty}>
            No appointments yet.{'\n'}
            Tap + to add one and get reminded the day before.
          </Text>
        ) : (
          <>
            {upcoming.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Upcoming</Text>
                {upcoming.map(v => renderVisit(v, false))}
              </>
            )}
            {past.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Past</Text>
                {past.map(v => renderVisit(v, true))}
              </>
            )}
          </>
        )}
      </ScrollView>

      <Modal visible={formOpen} transparent animationType="slide" onRequestClose={() => setFormOpen(false)}>
        <View style={styles.overlay}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setFormOpen(false)} />
          <View style={styles.sheet}>
            <View style={styles.grabber} />
            <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
              <View style={{ gap: theme.spacing.sm }}>
                <Text style={styles.label}>Doctor</Text>
                <TextInput
                  style={styles.input}
                  value={doctorName}
                  onChangeText={setDoctorName}
                  placeholder="Dr. name"
                  placeholderTextColor={theme.colors.textDisabled}
                  maxLength={60}
                />
                <TextInput
                  style={styles.input}
                  value={location}
                  onChangeText={setLocation}
                  placeholder="Clinic, hospital or video link"
                  placeholderTextColor={theme.colors.textDisabled}
                  maxLength={80}
                />
              </View>

              <View style={{ gap: theme.spacing.sm }}>
                <Text style={styles.label}>When</Text>
                <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    value={date}
                    onChangeText={setDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={theme.colors.textDisabled}
                    maxLength={10}
                  />
                  <TextInput
                    style={[styles.input, { width: 110 }]}
                    value={time}
                    onChangeText={setTime}
                    placeholder="HH:MM"
                    placeholderTextColor={theme.colors.textDisabled}
                    maxLength={5}
                  />
                </View>
              </View>

              <View style={{ gap: theme.spacing.sm }}>
                <Text style={styles.label}>Reason</Text>
                <TextInput
                  style={styles.input}
                  value={reason}
                  onChangeText={setReason}
                  placeholder="Check-up, blood test…"
                  placeholderTextColor={theme.colors.textDisabled}
                  maxLength={100}
                />
              </View>

              <View style={{ gap: theme.spacing.sm }}>
                <Text style={styles.label}>Prescription notes</Text>
                <TextInput
                  style={[styles.input, { minHeight: 84, textAlignVertical: 'top' }]}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="What the doctor said, medicines prescribed…"
                  placeholderTextColor={theme.colors.textDisabled}
                  multiline
                  maxLength={600}
                />
              </View>

              <View style={{ gap: theme.spacing.sm }}>
                <Text style={styles.label}>Follow-up date</Text>
                <TextInput
                  style={styles.input}
                  value={followUp}
                  onChangeText={setFollowUp}
                  placeholder="YYYY-MM-DD (optional)"
                  placeholderTextColor={theme.colors.textDisabled}
                  maxLength={10}
                />
              </View>

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>
                  Remind me the day before and at the time
                </Text>
                <Switch
                  value={remind}
                  onValueChange={setRemind}
                  trackColor={{ true: theme.colors.primary, false: theme.colors.border }}
                />
              </View>

              <TouchableOpacity style={styles.save} onPress={save}>
                <Text style={styles.saveText}>
                  {editing ? 'Save appointment' : 'Add appointment'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
