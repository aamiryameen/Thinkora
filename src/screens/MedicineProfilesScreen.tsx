import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Image, Modal, ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { useMedicine } from '../context/MedicineContext';
import { MEDICINE_COLORS, describeProfile, isDateKey } from '../core/medicine';
import { pickImageFromGallery, takePhoto } from '../services/attachmentService';
import { saveProfilePhoto } from '../services/medicineService';
import type { FamilyProfile, Gender } from '../types/medicine';

const PROFILE_ICONS = [
  'person-outline', 'woman-outline', 'man-outline', 'happy-outline',
  'body-outline', 'heart-outline', 'paw-outline', 'people-outline',
];

/** Common relationships as one-tap chips; the field stays free text below. */
const RELATIONSHIPS = [
  'Self', 'Mother', 'Father', 'Wife', 'Husband',
  'Son', 'Daughter', 'Brother', 'Sister', 'Grandparent',
];

const GENDERS: { value: Gender; label: string }[] = [
  { value: 'unspecified', label: 'Not set' },
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
];

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export function MedicineProfilesScreen() {
  const nav = useNavigation<any>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const {
    profiles, medicines, visits, activeProfileId, setActiveProfile,
    addProfile, editProfile, removeProfile,
  } = useMedicine();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<FamilyProfile | null>(null);
  const [savingPhoto, setSavingPhoto] = useState(false);

  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const [name, setName] = useState('');
  const [color, setColor] = useState(MEDICINE_COLORS[0]);
  const [icon, setIcon] = useState(PROFILE_ICONS[0]);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [relationship, setRelationship] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState<Gender>('unspecified');
  const [bloodGroup, setBloodGroup] = useState('');
  const [allergies, setAllergies] = useState('');
  const [conditions, setConditions] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [doctorPhone, setDoctorPhone] = useState('');
  const [doctorNotes, setDoctorNotes] = useState('');

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    medicines.forEach(m => {
      if (!m.archived) map.set(m.profileId, (map.get(m.profileId) ?? 0) + 1);
    });
    return map;
  }, [medicines]);

  const visitCounts = useMemo(() => {
    const map = new Map<string, number>();
    visits.forEach(v => {
      if (!v.completed) map.set(v.profileId, (map.get(v.profileId) ?? 0) + 1);
    });
    return map;
  }, [visits]);

  const openForm = useCallback((profile: FamilyProfile | null) => {
    setEditing(profile);
    setName(profile?.name ?? '');
    setColor(profile?.color ?? MEDICINE_COLORS[0]);
    setIcon(profile?.icon ?? PROFILE_ICONS[0]);
    setPhotoUri(profile?.photoUri ?? null);
    setRelationship(profile?.relationship ?? '');
    setBirthDate(profile?.birthDate ?? '');
    setGender(profile?.gender ?? 'unspecified');
    setBloodGroup(profile?.bloodGroup ?? '');
    setAllergies(profile?.allergies ?? '');
    setConditions(profile?.conditions ?? '');
    setEmergencyContact(profile?.emergencyContact ?? '');
    setDoctorName(profile?.doctorName ?? '');
    setDoctorPhone(profile?.doctorPhone ?? '');
    setDoctorNotes(profile?.doctorNotes ?? '');
    setFormOpen(true);
  }, []);

  const choosePhoto = useCallback(() => {
    const attach = async (pick: () => Promise<{ uri: string } | null>) => {
      setSavingPhoto(true);
      try {
        const picked = await pick();
        if (!picked?.uri) return;
        const saved = await saveProfilePhoto(picked.uri);
        // The picker and the file copy both outlive a back-press, so the result
        // may land after this screen is gone.
        if (saved && mountedRef.current) setPhotoUri(saved);
      } finally {
        if (mountedRef.current) setSavingPhoto(false);
      }
    };

    Alert.alert('Profile photo', undefined, [
      { text: 'Take photo', onPress: () => attach(takePhoto) },
      { text: 'Choose from gallery', onPress: () => attach(pickImageFromGallery) },
      ...(photoUri
        ? [{ text: 'Remove photo', style: 'destructive' as const, onPress: () => setPhotoUri(null) }]
        : []),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  }, [photoUri]);

  const save = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) return;

    // Accept only a real calendar date; a partial or impossible one would render
    // as an absurd age rather than simply being left blank.
    const typedBirth = birthDate.trim();
    if (typedBirth && !isDateKey(typedBirth)) {
      Alert.alert('Check the date of birth', 'Enter it as YYYY-MM-DD, or leave it empty.');
      return;
    }
    const cleanBirth = typedBirth || null;

    const payload = {
      name: trimmed,
      color, icon, photoUri,
      relationship: relationship.trim(),
      birthDate: cleanBirth,
      gender,
      bloodGroup: bloodGroup.trim(),
      allergies: allergies.trim(),
      conditions: conditions.trim(),
      emergencyContact: emergencyContact.trim(),
      doctorName: doctorName.trim(),
      doctorPhone: doctorPhone.trim(),
      doctorNotes: doctorNotes.trim(),
    };

    setFormOpen(false);
    if (editing) await editProfile(editing.id, payload);
    else await addProfile(payload);
    setEditing(null);
  }, [
    addProfile, allergies, birthDate, bloodGroup, color, conditions, doctorName,
    doctorNotes, doctorPhone, editProfile, editing, emergencyContact, gender,
    icon, name, photoUri, relationship,
  ]);

  const confirmDelete = useCallback((profile: FamilyProfile) => {
    const count = counts.get(profile.id) ?? 0;
    Alert.alert(
      `Delete ${profile.name}?`,
      count > 0
        ? `${count} medicine${count > 1 ? 's' : ''}, all dose history and appointments for this person will be removed.`
        : 'All appointments for this profile will also be removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            const ok = await removeProfile(profile.id);
            if (!ok) Alert.alert('Cannot delete', 'The main profile has to stay.');
          },
        },
      ],
    );
  }, [counts, removeProfile]);

  const openVisits = useCallback(async (profileId: string) => {
    // Visits are scoped to the active profile, so switch before navigating —
    // otherwise the screen would list someone else's appointments.
    if (profileId !== activeProfileId) await setActiveProfile(profileId);
    nav.navigate('DoctorVisits');
  }, [activeProfileId, nav, setActiveProfile]);

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
    title: {
      ...theme.typography.title, fontSize: 22, fontWeight: '700',
      color: theme.colors.text, flex: 1,
    },
    scroll: { padding: theme.spacing.lg, paddingBottom: 140, gap: theme.spacing.sm },
    card: {
      backgroundColor: theme.colors.cardBg,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.md,
      gap: theme.spacing.sm,
    },
    cardActive: { borderWidth: 2, borderColor: theme.colors.primary },
    row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
    avatar: {
      width: 44, height: 44, borderRadius: 22,
      alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
    },
    avatarImage: { width: '100%', height: '100%' },
    rowName: { ...theme.typography.bodySmall, fontWeight: '700', color: theme.colors.text },
    rowMeta: { ...theme.typography.caption, fontSize: 11, color: theme.colors.textMuted },
    chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    infoChip: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: 8, paddingVertical: 4,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.inputBg,
    },
    infoChipText: {
      ...theme.typography.caption, fontSize: 10, fontWeight: '700',
      color: theme.colors.textSecondary,
    },
    visitsBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingVertical: 9, paddingHorizontal: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      backgroundColor: theme.colors.inputBg,
    },
    visitsText: { ...theme.typography.caption, fontWeight: '700', color: theme.colors.text },
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
    photoWrap: { alignItems: 'center', gap: 6 },
    bigAvatar: {
      width: 78, height: 78, borderRadius: 39,
      alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
    },
    photoHint: { ...theme.typography.caption, fontSize: 11, color: theme.colors.primary, fontWeight: '700' },
    sectionTitle: {
      ...theme.typography.overline, color: theme.colors.textMuted,
      textTransform: 'uppercase', letterSpacing: 1, fontWeight: '800',
      marginTop: theme.spacing.xs,
    },
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
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
    swatch: {
      width: 40, height: 40, borderRadius: 12,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 3, borderColor: 'transparent',
    },
    iconPick: {
      width: 44, height: 44, borderRadius: 12,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: theme.colors.inputBg,
      borderWidth: 2, borderColor: 'transparent',
    },
    pill: {
      paddingHorizontal: 13, paddingVertical: 8,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.inputBg,
      borderWidth: 2, borderColor: 'transparent',
    },
    pillOn: { backgroundColor: theme.colors.primaryLight, borderColor: theme.colors.primary },
    pillText: { ...theme.typography.caption, fontWeight: '700', color: theme.colors.textSecondary },
    pillTextOn: { color: theme.colors.primary },
    save: {
      backgroundColor: theme.colors.primary,
      borderRadius: theme.borderRadius.lg,
      paddingVertical: 15, alignItems: 'center',
    },
    saveText: { ...theme.typography.button, color: '#FFF', fontWeight: '800' },
  }), [insets.bottom, insets.top, theme]);

  const renderAvatar = (p: FamilyProfile) => (
    <View style={[styles.avatar, { backgroundColor: p.color + '25' }]}>
      {p.photoUri ? (
        <Image source={{ uri: p.photoUri }} style={styles.avatarImage} />
      ) : (
        <Ionicons name={p.icon} size={21} color={p.color} />
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => nav.goBack()}>
          <Ionicons name="chevron-back" size={20} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Family</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => openForm(null)}>
          <Ionicons name="add" size={22} color="#FFF" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {profiles.map(p => {
          const count = counts.get(p.id) ?? 0;
          const upcoming = visitCounts.get(p.id) ?? 0;
          const summary = describeProfile(p);
          return (
            <View key={p.id} style={[styles.card, p.id === activeProfileId && styles.cardActive]}>
              <View style={styles.row}>
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, flex: 1 }}
                  onPress={() => setActiveProfile(p.id)}
                  activeOpacity={0.7}
                >
                  {renderAvatar(p)}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowName}>
                      {p.name}{p.isDefault ? ' · main' : ''}
                    </Text>
                    <Text style={styles.rowMeta} numberOfLines={1}>
                      {summary ? `${summary} · ` : ''}
                      {count} medicine{count === 1 ? '' : 's'}
                    </Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => openForm(p)} style={{ padding: 6 }}>
                  <Ionicons name="create-outline" size={18} color={theme.colors.textMuted} />
                </TouchableOpacity>
                {!p.isDefault && (
                  <TouchableOpacity onPress={() => confirmDelete(p)} style={{ padding: 6 }}>
                    <Ionicons name="trash-outline" size={18} color={theme.colors.error} />
                  </TouchableOpacity>
                )}
              </View>

              {(p.bloodGroup || p.allergies || p.conditions || p.emergencyContact) ? (
                <View style={styles.chipsRow}>
                  {p.bloodGroup ? (
                    <View style={styles.infoChip}>
                      <Ionicons name="water-outline" size={11} color={theme.colors.error} />
                      <Text style={styles.infoChipText}>{p.bloodGroup}</Text>
                    </View>
                  ) : null}
                  {p.allergies ? (
                    <View style={styles.infoChip}>
                      <Ionicons name="warning-outline" size={11} color={theme.colors.warning} />
                      <Text style={styles.infoChipText} numberOfLines={1}>{p.allergies}</Text>
                    </View>
                  ) : null}
                  {p.conditions ? (
                    <View style={styles.infoChip}>
                      <Ionicons name="pulse-outline" size={11} color={theme.colors.primary} />
                      <Text style={styles.infoChipText} numberOfLines={1}>{p.conditions}</Text>
                    </View>
                  ) : null}
                  {p.emergencyContact ? (
                    <View style={styles.infoChip}>
                      <Ionicons name="call-outline" size={11} color={theme.colors.success} />
                      <Text style={styles.infoChipText}>{p.emergencyContact}</Text>
                    </View>
                  ) : null}
                </View>
              ) : null}

              <TouchableOpacity style={styles.visitsBtn} onPress={() => openVisits(p.id)}>
                <Text style={styles.visitsText}>
                  Doctor visits{upcoming > 0 ? ` · ${upcoming} upcoming` : ''}
                </Text>
                <Ionicons name="chevron-forward" size={15} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>

      <Modal visible={formOpen} transparent animationType="slide" onRequestClose={() => setFormOpen(false)}>
        <View style={styles.overlay}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setFormOpen(false)} />
          <View style={styles.sheet}>
            <View style={styles.grabber} />
            <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
              <TouchableOpacity
                style={styles.photoWrap}
                onPress={choosePhoto}
                disabled={savingPhoto}
                activeOpacity={0.8}
              >
                <View style={[styles.bigAvatar, { backgroundColor: color }]}>
                  {photoUri ? (
                    <Image source={{ uri: photoUri }} style={styles.avatarImage} />
                  ) : (
                    <Ionicons name={icon} size={34} color="#FFF" />
                  )}
                </View>
                <Text style={styles.photoHint}>
                  {savingPhoto ? 'Saving…' : photoUri ? 'Change photo' : 'Add photo'}
                </Text>
              </TouchableOpacity>

              <View style={{ gap: theme.spacing.sm }}>
                <Text style={styles.label}>Name</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g. Mum, Ali"
                  placeholderTextColor={theme.colors.textDisabled}
                  maxLength={30}
                />
              </View>

              <View style={{ gap: theme.spacing.sm }}>
                <Text style={styles.label}>Relationship</Text>
                <View style={styles.grid}>
                  {RELATIONSHIPS.map(r => {
                    const on = relationship.trim().toLowerCase() === r.toLowerCase();
                    return (
                      <TouchableOpacity
                        key={r}
                        style={[styles.pill, on && styles.pillOn]}
                        onPress={() => setRelationship(on ? '' : r)}
                      >
                        <Text style={[styles.pillText, on && styles.pillTextOn]}>{r}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <TextInput
                  style={styles.input}
                  value={relationship}
                  onChangeText={setRelationship}
                  placeholder="Or type your own"
                  placeholderTextColor={theme.colors.textDisabled}
                  maxLength={30}
                />
              </View>

              <View style={{ gap: theme.spacing.sm }}>
                <Text style={styles.label}>Date of birth</Text>
                <TextInput
                  style={styles.input}
                  value={birthDate}
                  onChangeText={setBirthDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={theme.colors.textDisabled}
                  maxLength={10}
                  keyboardType="numbers-and-punctuation"
                />
              </View>

              <View style={{ gap: theme.spacing.sm }}>
                <Text style={styles.label}>Gender</Text>
                <View style={styles.grid}>
                  {GENDERS.map(g => (
                    <TouchableOpacity
                      key={g.value}
                      style={[styles.pill, gender === g.value && styles.pillOn]}
                      onPress={() => setGender(g.value)}
                    >
                      <Text style={[styles.pillText, gender === g.value && styles.pillTextOn]}>
                        {g.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <Text style={styles.sectionTitle}>Health information</Text>

              <View style={{ gap: theme.spacing.sm }}>
                <Text style={styles.label}>Blood group</Text>
                <View style={styles.grid}>
                  {BLOOD_GROUPS.map(bg => (
                    <TouchableOpacity
                      key={bg}
                      style={[styles.pill, bloodGroup === bg && styles.pillOn]}
                      onPress={() => setBloodGroup(bloodGroup === bg ? '' : bg)}
                    >
                      <Text style={[styles.pillText, bloodGroup === bg && styles.pillTextOn]}>
                        {bg}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={{ gap: theme.spacing.sm }}>
                <Text style={styles.label}>Allergies</Text>
                <TextInput
                  style={[styles.input, { minHeight: 70, textAlignVertical: 'top' }]}
                  value={allergies}
                  onChangeText={setAllergies}
                  placeholder="Penicillin, peanuts…"
                  placeholderTextColor={theme.colors.textDisabled}
                  multiline
                  maxLength={300}
                />
              </View>

              <View style={{ gap: theme.spacing.sm }}>
                <Text style={styles.label}>Medical conditions</Text>
                <TextInput
                  style={[styles.input, { minHeight: 70, textAlignVertical: 'top' }]}
                  value={conditions}
                  onChangeText={setConditions}
                  placeholder="Diabetes, asthma…"
                  placeholderTextColor={theme.colors.textDisabled}
                  multiline
                  maxLength={300}
                />
              </View>

              <View style={{ gap: theme.spacing.sm }}>
                <Text style={styles.label}>Emergency contact</Text>
                <TextInput
                  style={styles.input}
                  value={emergencyContact}
                  onChangeText={setEmergencyContact}
                  placeholder="Name and phone number"
                  placeholderTextColor={theme.colors.textDisabled}
                  maxLength={60}
                />
              </View>

              <Text style={styles.sectionTitle}>Doctor</Text>

              <View style={{ gap: theme.spacing.sm }}>
                <TextInput
                  style={styles.input}
                  value={doctorName}
                  onChangeText={setDoctorName}
                  placeholder="Doctor's name"
                  placeholderTextColor={theme.colors.textDisabled}
                  maxLength={60}
                />
                <TextInput
                  style={styles.input}
                  value={doctorPhone}
                  onChangeText={setDoctorPhone}
                  placeholder="Phone number"
                  placeholderTextColor={theme.colors.textDisabled}
                  keyboardType="phone-pad"
                  maxLength={30}
                />
                <TextInput
                  style={[styles.input, { minHeight: 70, textAlignVertical: 'top' }]}
                  value={doctorNotes}
                  onChangeText={setDoctorNotes}
                  placeholder="Clinic address, notes…"
                  placeholderTextColor={theme.colors.textDisabled}
                  multiline
                  maxLength={400}
                />
              </View>

              <Text style={styles.sectionTitle}>Appearance</Text>

              <View style={{ gap: theme.spacing.sm }}>
                <Text style={styles.label}>Colour</Text>
                <View style={styles.grid}>
                  {MEDICINE_COLORS.map(c => (
                    <TouchableOpacity
                      key={c}
                      style={[styles.swatch, { backgroundColor: c }, c === color && { borderColor: theme.colors.text }]}
                      onPress={() => setColor(c)}
                    >
                      {c === color && <Ionicons name="checkmark" size={18} color="#FFF" />}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={{ gap: theme.spacing.sm }}>
                <Text style={styles.label}>Icon</Text>
                <View style={styles.grid}>
                  {PROFILE_ICONS.map(ic => (
                    <TouchableOpacity
                      key={ic}
                      style={[styles.iconPick, ic === icon && { borderColor: color, backgroundColor: color + '18' }]}
                      onPress={() => setIcon(ic)}
                    >
                      <Ionicons name={ic} size={20} color={ic === icon ? color : theme.colors.textMuted} />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <TouchableOpacity
                style={[styles.save, !name.trim() && { opacity: 0.45 }]}
                disabled={!name.trim()}
                onPress={save}
              >
                <Text style={styles.saveText}>{editing ? 'Save changes' : 'Add person'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
