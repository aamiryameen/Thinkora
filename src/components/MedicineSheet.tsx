import React, { useEffect, useMemo, useState } from 'react';
import {
  Image, Modal, ScrollView, StyleSheet, Switch, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import {
  dateKey, formatTime, MEAL_TIMINGS, MEDICINE_CATEGORIES, MEDICINE_COLORS,
  MEDICINE_FORMS, REMINDER_SOUNDS, TIME_PRESETS, WEEKDAY_LABELS,
} from '../core/medicine';
import { pickImageFromGallery, takePhoto } from '../services/attachmentService';
import type {
  MealTiming, Medicine, MedicineCategory, MedicineForm, ScheduleKind,
} from '../types/medicine';
import type { MedicineInput } from '../services/medicineService';

const KINDS: { value: ScheduleKind; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'interval', label: 'Interval' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'as_needed', label: 'As needed' },
];

interface Props {
  visible: boolean;
  profileId: string;
  editing?: Medicine | null;
  /** Inventory fields are premium; hidden when false. */
  canTrackStock: boolean;
  onSave: (input: MedicineInput) => void;
  onDelete?: () => void;
  onClose: () => void;
}

export function MedicineSheet({
  visible, profileId, editing, canTrackStock, onSave, onDelete, onClose,
}: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [form, setForm] = useState<MedicineForm>('tablet');
  const [color, setColor] = useState(MEDICINE_COLORS[0]);
  const [notes, setNotes] = useState('');
  const [kind, setKind] = useState<ScheduleKind>('daily');
  const [times, setTimes] = useState<number[]>([8 * 60]);
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [intervalDays, setIntervalDays] = useState('2');
  const [startDate, setStartDate] = useState(dateKey());
  const [endDate, setEndDate] = useState('');
  const [reminders, setReminders] = useState(true);
  const [stock, setStock] = useState('');
  const [threshold, setThreshold] = useState('');
  const [newTime, setNewTime] = useState('');
  const [category, setCategory] = useState<MedicineCategory>('other');
  const [mealTiming, setMealTiming] = useState<MealTiming>('any');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [expiryDate, setExpiryDate] = useState('');
  const [soundId, setSoundId] = useState('default');
  const [missedAlert, setMissedAlert] = useState('');

  // Re-seed each open so a previous medicine's values never leak through.
  useEffect(() => {
    if (!visible) return;
    setName(editing?.name ?? '');
    setDosage(editing?.dosage ?? '');
    setForm(editing?.form ?? 'tablet');
    setColor(editing?.color ?? MEDICINE_COLORS[0]);
    setNotes(editing?.notes ?? '');
    setKind(editing?.scheduleKind ?? 'daily');
    setTimes(editing?.times ?? [8 * 60]);
    setWeekdays(editing?.weekdays?.length ? editing.weekdays : [1, 2, 3, 4, 5]);
    setIntervalDays(String(editing?.intervalDays ?? 2));
    setStartDate(editing?.startDate ?? dateKey());
    setEndDate(editing?.endDate ?? '');
    setReminders(editing?.remindersEnabled ?? true);
    setStock(editing?.stockCount != null ? String(editing.stockCount) : '');
    setThreshold(editing?.refillThreshold != null ? String(editing.refillThreshold) : '');
    setNewTime('');
    setCategory(editing?.category ?? 'other');
    setMealTiming(editing?.mealTiming ?? 'any');
    setPhotoUri(editing?.photoUri ?? null);
    setExpiryDate(editing?.expiryDate ?? '');
    setSoundId(editing?.soundId ?? 'default');
    setMissedAlert(editing?.missedAlertMinutes != null ? String(editing.missedAlertMinutes) : '');
  }, [editing, visible]);

  const addTime = () => {
    const match = newTime.trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return;
    const h = Number(match[1]);
    const m = Number(match[2]);
    if (h > 23 || m > 59) return;
    const minutes = h * 60 + m;
    if (times.includes(minutes)) { setNewTime(''); return; }
    setTimes([...times, minutes].sort((a, b) => a - b));
    setNewTime('');
  };

  const styles = useMemo(() => StyleSheet.create({
    overlay: { flex: 1, backgroundColor: theme.colors.overlay, justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: 28, borderTopRightRadius: 28,
      paddingTop: theme.spacing.lg,
      paddingBottom: insets.bottom + theme.spacing.lg,
      maxHeight: '92%',
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
    row: { flexDirection: 'row', gap: theme.spacing.sm },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
    chip: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      paddingHorizontal: 12, paddingVertical: 8,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.inputBg,
      borderWidth: 2, borderColor: 'transparent',
    },
    chipOn: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primaryLight },
    chipText: { ...theme.typography.caption, fontWeight: '700', color: theme.colors.text },
    photoWrap: { width: 56, height: 56 },
    photo: { width: 56, height: 56, borderRadius: 12 },
    photoRemove: {
      position: 'absolute', top: -4, right: -4,
      width: 20, height: 20, borderRadius: 10,
      backgroundColor: theme.colors.error,
      alignItems: 'center', justifyContent: 'center',
    },
    swatch: {
      width: 36, height: 36, borderRadius: 11,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 3, borderColor: 'transparent',
    },
    timePill: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingLeft: 12, paddingRight: 8, paddingVertical: 8,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.primaryLight,
    },
    timeText: { ...theme.typography.caption, fontWeight: '700', color: theme.colors.primary },
    dayBtn: {
      width: 40, height: 40, borderRadius: 12,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: theme.colors.inputBg,
      borderWidth: 2, borderColor: 'transparent',
    },
    dayText: { ...theme.typography.caption, fontSize: 11, fontWeight: '700', color: theme.colors.text },
    switchRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      gap: theme.spacing.md,
    },
    switchLabel: { ...theme.typography.bodySmall, color: theme.colors.text, flex: 1 },
    hint: { ...theme.typography.caption, fontSize: 11, color: theme.colors.textMuted },
    save: {
      backgroundColor: theme.colors.primary,
      borderRadius: theme.borderRadius.lg,
      paddingVertical: 15, alignItems: 'center',
    },
    saveText: { ...theme.typography.button, color: '#FFF', fontWeight: '800' },
    deleteBtn: { alignItems: 'center', paddingVertical: theme.spacing.sm },
    deleteText: { ...theme.typography.bodySmall, color: theme.colors.error, fontWeight: '700' },
  }), [insets.bottom, theme]);

  const needsTimes = kind !== 'as_needed';
  const valid = name.trim().length > 0 && (!needsTimes || times.length > 0);

  const handleSave = () => {
    if (!valid) return;
    onSave({
      profileId,
      name: name.trim(),
      dosage: dosage.trim(),
      form,
      category,
      photoUri,
      mealTiming,
      expiryDate: expiryDate.trim() || null,
      soundId,
      missedAlertMinutes: missedAlert.trim() ? Math.max(1, Number(missedAlert) || 30) : null,
      color,
      notes: notes.trim(),
      scheduleKind: kind,
      times: needsTimes ? times : [],
      weekdays: kind === 'weekly' ? weekdays : [],
      intervalDays: Math.max(1, Number(intervalDays) || 1),
      startDate: startDate.trim() || dateKey(),
      endDate: endDate.trim() || null,
      remindersEnabled: reminders && needsTimes,
      stockCount: canTrackStock && stock.trim() ? Math.max(0, Number(stock) || 0) : null,
      refillThreshold: canTrackStock && threshold.trim() ? Math.max(0, Number(threshold) || 0) : null,
      archived: editing?.archived ?? false,
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.grabber} />
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <View style={{ gap: theme.spacing.sm }}>
              <Text style={styles.label}>Medicine</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="e.g. Amoxicillin"
                placeholderTextColor={theme.colors.textDisabled}
                maxLength={60}
              />
              <TextInput
                style={styles.input}
                value={dosage}
                onChangeText={setDosage}
                placeholder="Dosage — e.g. 500 mg, 2 puffs"
                placeholderTextColor={theme.colors.textDisabled}
                maxLength={40}
              />
            </View>

            <View style={{ gap: theme.spacing.sm }}>
              <Text style={styles.label}>Form</Text>
              <View style={styles.chips}>
                {MEDICINE_FORMS.map(f => (
                  <TouchableOpacity
                    key={f.value}
                    style={[styles.chip, form === f.value && styles.chipOn]}
                    onPress={() => setForm(f.value)}
                  >
                    <Ionicons
                      name={f.icon}
                      size={14}
                      color={form === f.value ? theme.colors.primary : theme.colors.textMuted}
                    />
                    <Text style={styles.chipText}>{f.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={{ gap: theme.spacing.sm }}>
              <Text style={styles.label}>Photo</Text>
              <View style={styles.row}>
                {photoUri ? (
                  <TouchableOpacity
                    style={styles.photoWrap}
                    onPress={() => setPhotoUri(null)}
                    accessibilityLabel="Remove photo"
                  >
                    <Image source={{ uri: photoUri }} style={styles.photo} resizeMode="cover" />
                    <View style={styles.photoRemove}>
                      <Ionicons name="close" size={13} color="#FFF" />
                    </View>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  style={[styles.chip, { paddingVertical: 12 }]}
                  onPress={async () => {
                    const picked = await pickImageFromGallery().catch(() => null);
                    if (picked?.uri) setPhotoUri(picked.uri);
                  }}
                >
                  <Ionicons name="image-outline" size={15} color={theme.colors.textMuted} />
                  <Text style={styles.chipText}>Gallery</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.chip, { paddingVertical: 12 }]}
                  onPress={async () => {
                    const shot = await takePhoto().catch(() => null);
                    if (shot?.uri) setPhotoUri(shot.uri);
                  }}
                >
                  <Ionicons name="camera-outline" size={15} color={theme.colors.textMuted} />
                  <Text style={styles.chipText}>Camera</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={{ gap: theme.spacing.sm }}>
              <Text style={styles.label}>Category</Text>
              <View style={styles.chips}>
                {MEDICINE_CATEGORIES.map(c => (
                  <TouchableOpacity
                    key={c.value}
                    style={[styles.chip, category === c.value && styles.chipOn]}
                    onPress={() => setCategory(c.value)}
                  >
                    <Ionicons
                      name={c.icon} size={14}
                      color={category === c.value ? theme.colors.primary : c.color}
                    />
                    <Text style={styles.chipText}>{c.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={{ gap: theme.spacing.sm }}>
              <Text style={styles.label}>Food</Text>
              <View style={styles.chips}>
                {MEAL_TIMINGS.map(t => (
                  <TouchableOpacity
                    key={t.value}
                    style={[styles.chip, mealTiming === t.value && styles.chipOn]}
                    onPress={() => setMealTiming(t.value)}
                  >
                    <Ionicons
                      name={t.icon} size={14}
                      color={mealTiming === t.value ? theme.colors.primary : theme.colors.textMuted}
                    />
                    <Text style={styles.chipText}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={{ gap: theme.spacing.sm }}>
              <Text style={styles.label}>Colour</Text>
              <View style={styles.chips}>
                {MEDICINE_COLORS.map(c => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.swatch, { backgroundColor: c }, c === color && { borderColor: theme.colors.text }]}
                    onPress={() => setColor(c)}
                  >
                    {c === color && <Ionicons name="checkmark" size={17} color="#FFF" />}
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={{ gap: theme.spacing.sm }}>
              <Text style={styles.label}>Schedule</Text>
              <View style={styles.chips}>
                {KINDS.map(k => (
                  <TouchableOpacity
                    key={k.value}
                    style={[styles.chip, kind === k.value && styles.chipOn]}
                    onPress={() => setKind(k.value)}
                  >
                    <Text style={styles.chipText}>{k.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {kind === 'weekly' && (
              <View style={{ gap: theme.spacing.sm }}>
                <Text style={styles.label}>Days</Text>
                <View style={styles.chips}>
                  {WEEKDAY_LABELS.map((d, i) => {
                    const on = weekdays.includes(i);
                    return (
                      <TouchableOpacity
                        key={d}
                        style={[styles.dayBtn, on && { borderColor: theme.colors.primary, backgroundColor: theme.colors.primaryLight }]}
                        onPress={() => setWeekdays(
                          on ? weekdays.filter(w => w !== i) : [...weekdays, i].sort(),
                        )}
                      >
                        <Text style={styles.dayText}>{d}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {kind === 'interval' && (
              <View style={{ gap: theme.spacing.sm }}>
                <Text style={styles.label}>Every N days</Text>
                <TextInput
                  style={styles.input}
                  value={intervalDays}
                  onChangeText={setIntervalDays}
                  keyboardType="number-pad"
                  maxLength={3}
                />
              </View>
            )}

            {needsTimes && (
              <View style={{ gap: theme.spacing.sm }}>
                <Text style={styles.label}>Times</Text>
                <View style={styles.chips}>
                  {TIME_PRESETS.map(p => (
                    <TouchableOpacity
                      key={p.label}
                      style={styles.chip}
                      onPress={() => setTimes(p.times)}
                    >
                      <Text style={styles.chipText}>{p.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.chips}>
                  {times.map(t => (
                    <View key={t} style={styles.timePill}>
                      <Text style={styles.timeText}>{formatTime(t)}</Text>
                      <TouchableOpacity onPress={() => setTimes(times.filter(x => x !== t))}>
                        <Ionicons name="close-circle" size={16} color={theme.colors.primary} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
                <View style={styles.row}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    value={newTime}
                    onChangeText={setNewTime}
                    placeholder="Add time — HH:MM (24h)"
                    placeholderTextColor={theme.colors.textDisabled}
                    keyboardType="numbers-and-punctuation"
                    maxLength={5}
                    onSubmitEditing={addTime}
                  />
                  <TouchableOpacity
                    style={[styles.save, { paddingHorizontal: 18, paddingVertical: 12 }]}
                    onPress={addTime}
                  >
                    <Ionicons name="add" size={20} color="#FFF" />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <View style={{ gap: theme.spacing.sm }}>
              <Text style={styles.label}>Course</Text>
              <View style={styles.row}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={startDate}
                  onChangeText={setStartDate}
                  placeholder="Start YYYY-MM-DD"
                  placeholderTextColor={theme.colors.textDisabled}
                  maxLength={10}
                />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={endDate}
                  onChangeText={setEndDate}
                  placeholder="End (optional)"
                  placeholderTextColor={theme.colors.textDisabled}
                  maxLength={10}
                />
              </View>
            </View>

            {needsTimes && (
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Reminders</Text>
                <Switch
                  value={reminders}
                  onValueChange={setReminders}
                  trackColor={{ true: theme.colors.primary, false: theme.colors.border }}
                />
              </View>
            )}

            {canTrackStock && (
              <View style={{ gap: theme.spacing.sm }}>
                <Text style={styles.label}>Inventory</Text>
                <View style={styles.row}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    value={stock}
                    onChangeText={setStock}
                    placeholder="In stock"
                    placeholderTextColor={theme.colors.textDisabled}
                    keyboardType="number-pad"
                    maxLength={5}
                  />
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    value={threshold}
                    onChangeText={setThreshold}
                    placeholder="Refill at"
                    placeholderTextColor={theme.colors.textDisabled}
                    keyboardType="number-pad"
                    maxLength={5}
                  />
                </View>
                <Text style={styles.hint}>
                  Stock drops by one each time a dose is marked taken.
                </Text>
              </View>
            )}

            <View style={{ gap: theme.spacing.sm }}>
              <Text style={styles.label}>Expiry date</Text>
              <TextInput
                style={styles.input}
                value={expiryDate}
                onChangeText={setExpiryDate}
                placeholder="YYYY-MM-DD (optional)"
                placeholderTextColor={theme.colors.textDisabled}
                maxLength={10}
              />
              <Text style={styles.hint}>
                You'll be reminded a month before it expires.
              </Text>
            </View>

            {needsTimes && (
              <>
                <View style={{ gap: theme.spacing.sm }}>
                  <Text style={styles.label}>Reminder sound</Text>
                  <View style={styles.chips}>
                    {REMINDER_SOUNDS.map(snd => {
                      const locked = snd.premium && !canTrackStock;
                      return (
                        <TouchableOpacity
                          key={snd.id}
                          style={[styles.chip, soundId === snd.id && styles.chipOn]}
                          onPress={() => { if (!locked) setSoundId(snd.id); }}
                        >
                          <Ionicons
                            name={locked ? 'lock-closed-outline' : 'musical-note-outline'}
                            size={13}
                            color={soundId === snd.id ? theme.colors.primary : theme.colors.textMuted}
                          />
                          <Text style={styles.chipText}>{snd.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                <View style={{ gap: theme.spacing.sm }}>
                  <Text style={styles.label}>Missed-dose alert</Text>
                  <TextInput
                    style={styles.input}
                    value={missedAlert}
                    onChangeText={setMissedAlert}
                    placeholder="Minutes after the dose (blank = off)"
                    placeholderTextColor={theme.colors.textDisabled}
                    keyboardType="number-pad"
                    maxLength={3}
                  />
                </View>
              </>
            )}

            <View style={{ gap: theme.spacing.sm }}>
              <Text style={styles.label}>Notes</Text>
              <TextInput
                style={[styles.input, { minHeight: 64, textAlignVertical: 'top' }]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Take with food, avoid alcohol…"
                placeholderTextColor={theme.colors.textDisabled}
                multiline
                maxLength={300}
              />
            </View>

            <TouchableOpacity
              style={[styles.save, !valid && { opacity: 0.45 }]}
              disabled={!valid}
              onPress={handleSave}
              activeOpacity={0.85}
            >
              <Text style={styles.saveText}>
                {editing ? 'Save changes' : 'Add medicine'}
              </Text>
            </TouchableOpacity>

            {editing && onDelete && (
              <TouchableOpacity style={styles.deleteBtn} onPress={onDelete}>
                <Text style={styles.deleteText}>Delete medicine</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
