import { Alert, Platform, Share } from 'react-native';
import RNFS from 'react-native-fs';
import { Q } from '@nozbe/watermelondb';
import {
  database,
  doctorVisitsCollection,
  doseLogsCollection,
  familyProfilesCollection,
  medicinesCollection,
} from '../db';
import {
  addDays, dateKey, daysUntilExpiry, dosesForDate, EXPIRY_WARNING_DAYS,
  formatTime, historyToCsv, isDueOn, MEAL_TIMINGS, REMINDER_SOUNDS,
  timestampFor, visitReminderSlots,
} from '../core/medicine';
import type { VisitSlotKey } from '../core/medicine';
import type {
  DoctorVisit, DoseLog, DoseStatus, FamilyProfile, Medicine, ScheduledDose,
} from '../types/medicine';

let notifee: any = null;
let TriggerType: any = null;
try {
  const mod = require('@notifee/react-native');
  notifee = mod.default ?? mod;
  TriggerType = mod.TriggerType;
} catch {
  // Notifications simply don't schedule when the native module is absent.
}

/** Each sound gets its own channel because a channel's sound is fixed at creation. */
const CHANNEL_PREFIX = 'thinkora-medicine';
/** How many days ahead to schedule alarms; Android caps pending intents. */
const SCHEDULE_HORIZON_DAYS = 7;

// ─── Profiles ────────────────────────────────────────────────────────────────

export async function getProfiles(): Promise<FamilyProfile[]> {
  const rows = await familyProfilesCollection.query().fetch();
  return rows.map(r => r.toPlain()).sort((a, b) => {
    if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
    return a.createdAt - b.createdAt;
  });
}

/** Creates the owner profile on first run so medicines always have a home. */
export async function ensureDefaultProfile(): Promise<FamilyProfile> {
  if (defaultProfileRun) return defaultProfileRun;
  defaultProfileRun = doEnsureDefaultProfile().finally(() => { defaultProfileRun = null; });
  return defaultProfileRun;
}

let defaultProfileRun: Promise<FamilyProfile> | null = null;

/** Check-then-write, so concurrent callers must share one promise. */
async function doEnsureDefaultProfile(): Promise<FamilyProfile> {
  const existing = await getProfiles();
  const found = existing.find(p => p.isDefault);
  if (found) return found;

  await database.write(async () => {
    await familyProfilesCollection.create(r => {
      r.name = 'Me';
      r.color = '#6366F1';
      r.icon = 'person-outline';
      r.photoUri = null;
      r.relationship = 'Self';
      r.birthDate = null;
      r.gender = 'unspecified';
      r.bloodGroup = '';
      r.allergies = '';
      r.conditions = '';
      r.emergencyContact = '';
      r.doctorName = '';
      r.doctorPhone = '';
      r.doctorNotes = '';
      r.isDefault = true;
      r.createdAt = Date.now();
    });
  });
  return (await getProfiles()).find(p => p.isDefault)!;
}

const PHOTO_DIR = `${RNFS.DocumentDirectoryPath}/profile-photos`;

/**
 * Copies a picked photo into app storage and returns the durable uri.
 *
 * The picker hands back a cache or `content://` uri that Android is free to
 * reclaim, so a profile has to own its own copy or the avatar silently
 * disappears later.
 */
export async function saveProfilePhoto(uri: string): Promise<string | null> {
  await RNFS.mkdir(PHOTO_DIR).catch(() => { /* already exists */ });
  const path = `${PHOTO_DIR}/profile-${Date.now()}.jpg`;
  // Strip the scheme only for file:// — content:// must stay intact so RNFS can
  // resolve it through the Android content provider.
  const source = uri.startsWith('file://') ? uri.replace('file://', '') : uri;

  try {
    await RNFS.copyFile(source, path);
    return `file://${path}`;
  } catch {
    try {
      const base64 = await RNFS.readFile(source, 'base64');
      await RNFS.writeFile(path, base64, 'base64');
      return `file://${path}`;
    } catch {
      // Keep the original uri rather than dropping the user's choice; it may
      // expire, but a broken image beats no image at all.
      return uri;
    }
  }
}

/** Removes a profile photo file. Guarded so a stray uri can't delete elsewhere. */
export async function deleteProfilePhoto(uri: string | null | undefined): Promise<void> {
  if (!uri || !uri.includes('/profile-photos/')) return;
  try { await RNFS.unlink(uri.replace('file://', '')); } catch { /* already gone */ }
}

/**
 * Deletes photo files no profile references any more.
 *
 * The file is written the moment a photo is picked, so abandoning the editor
 * without saving leaves one behind — and each pick has a unique name, so
 * without this the folder grows on every attempt.
 */
export async function pruneOrphanProfilePhotos(): Promise<number> {
  try {
    if (!(await RNFS.exists(PHOTO_DIR))) return 0;

    const referenced = new Set(
      (await getProfiles())
        .map(p => p.photoUri)
        .filter((u): u is string => !!u)
        .map(u => u.replace('file://', '')),
    );

    const files = await RNFS.readDir(PHOTO_DIR);
    let removed = 0;
    for (const file of files) {
      if (referenced.has(file.path)) continue;
      await RNFS.unlink(file.path).catch(() => { /* already gone */ });
      removed++;
    }
    return removed;
  } catch {
    return 0;
  }
}

export type ProfileInput = Omit<FamilyProfile, 'id' | 'isDefault' | 'createdAt'>;

function writeProfile(r: any, input: Partial<ProfileInput>): void {
  if (input.name !== undefined) r.name = input.name;
  if (input.color !== undefined) r.color = input.color;
  if (input.icon !== undefined) r.icon = input.icon;
  if (input.photoUri !== undefined) r.photoUri = input.photoUri;
  if (input.relationship !== undefined) r.relationship = input.relationship;
  if (input.birthDate !== undefined) r.birthDate = input.birthDate;
  if (input.gender !== undefined) r.gender = input.gender;
  if (input.bloodGroup !== undefined) r.bloodGroup = input.bloodGroup;
  if (input.allergies !== undefined) r.allergies = input.allergies;
  if (input.conditions !== undefined) r.conditions = input.conditions;
  if (input.emergencyContact !== undefined) r.emergencyContact = input.emergencyContact;
  if (input.doctorName !== undefined) r.doctorName = input.doctorName;
  if (input.doctorPhone !== undefined) r.doctorPhone = input.doctorPhone;
  if (input.doctorNotes !== undefined) r.doctorNotes = input.doctorNotes;
}

export async function createProfile(input: Partial<ProfileInput> & { name: string }): Promise<void> {
  await database.write(async () => {
    await familyProfilesCollection.create(r => {
      writeProfile(r, {
        color: '#6366F1', icon: 'person-outline', photoUri: null,
        relationship: '', birthDate: null, gender: 'unspecified',
        bloodGroup: '', allergies: '', conditions: '', emergencyContact: '',
        doctorName: '', doctorPhone: '', doctorNotes: '',
        ...input,
      });
      r.isDefault = false;
      r.createdAt = Date.now();
    });
  });
}

export async function updateProfile(
  id: string,
  patch: Partial<ProfileInput>,
): Promise<void> {
  const row = await familyProfilesCollection.find(id).catch(() => null);
  if (!row) return;

  // Read the outgoing photo before the write, so a replaced file can be removed
  // instead of accumulating one orphan per re-pick.
  const previousPhoto = row.photoUri;

  await database.write(async () => {
    await row.update(r => writeProfile(r, patch));
  });

  if (patch.photoUri !== undefined && patch.photoUri !== previousPhoto) {
    await deleteProfilePhoto(previousPhoto);
  }
}

/**
 * Deletes a profile along with its medicines and history.
 *
 * The default profile is protected — removing it would orphan everything with
 * no way to reassign.
 */
export async function deleteProfile(id: string): Promise<boolean> {
  const row = await familyProfilesCollection.find(id).catch(() => null);
  if (!row || row.isDefault) return false;

  const photoUri = row.photoUri;
  const [meds, logs, visits] = await Promise.all([
    medicinesCollection.query(Q.where('profile_id', id)).fetch(),
    doseLogsCollection.query(Q.where('profile_id', id)).fetch(),
    doctorVisitsCollection.query(Q.where('profile_id', id)).fetch(),
  ]);

  await Promise.all(meds.map(m => cancelMedicineReminders(m.id)));
  await Promise.all(visits.map(v => cancelVisitReminder(v.id)));

  await database.write(async () => {
    await database.batch(
      ...logs.map(l => l.prepareDestroyPermanently()),
      ...meds.map(m => m.prepareDestroyPermanently()),
      ...visits.map(v => v.prepareDestroyPermanently()),
      row.prepareDestroyPermanently(),
    );
  });
  await deleteProfilePhoto(photoUri);
  return true;
}

// ─── Medicines ───────────────────────────────────────────────────────────────

export async function getMedicines(): Promise<Medicine[]> {
  const rows = await medicinesCollection.query().fetch();
  return rows.map(r => r.toPlain()).sort((a, b) => a.name.localeCompare(b.name));
}

export type MedicineInput = Omit<Medicine, 'id' | 'createdAt' | 'updatedAt'>;

export async function createMedicine(input: MedicineInput): Promise<string> {
  const now = Date.now();
  let id = '';
  await database.write(async () => {
    const row = await medicinesCollection.create(r => {
      r.profileId = input.profileId;
      r.name = input.name;
      r.dosage = input.dosage;
      r.form = input.form;
      r.category = input.category;
      r.photoUri = input.photoUri;
      r.mealTiming = input.mealTiming;
      r.expiryDate = input.expiryDate;
      r.soundId = input.soundId;
      r.missedAlertMinutes = input.missedAlertMinutes;
      r.color = input.color;
      r.notes = input.notes;
      r.scheduleKind = input.scheduleKind;
      r.timesJson = JSON.stringify(input.times);
      r.weekdaysJson = JSON.stringify(input.weekdays);
      r.intervalDays = input.intervalDays;
      r.startDate = input.startDate;
      r.endDate = input.endDate;
      r.remindersEnabled = input.remindersEnabled;
      r.stockCount = input.stockCount;
      r.refillThreshold = input.refillThreshold;
      r.archived = input.archived;
      r.createdAt = now;
      r.updatedAt = now;
    });
    id = row.id;
  });

  const created = (await getMedicines()).find(m => m.id === id);
  if (created) await scheduleMedicineReminders(created);
  return id;
}

export async function updateMedicine(id: string, patch: Partial<MedicineInput>): Promise<void> {
  const row = await medicinesCollection.find(id).catch(() => null);
  if (!row) return;

  await database.write(async () => {
    await row.update(r => {
      if (patch.profileId !== undefined) r.profileId = patch.profileId;
      if (patch.name !== undefined) r.name = patch.name;
      if (patch.dosage !== undefined) r.dosage = patch.dosage;
      if (patch.form !== undefined) r.form = patch.form;
      if (patch.category !== undefined) r.category = patch.category;
      if (patch.photoUri !== undefined) r.photoUri = patch.photoUri;
      if (patch.mealTiming !== undefined) r.mealTiming = patch.mealTiming;
      if (patch.expiryDate !== undefined) r.expiryDate = patch.expiryDate;
      if (patch.soundId !== undefined) r.soundId = patch.soundId;
      if (patch.missedAlertMinutes !== undefined) r.missedAlertMinutes = patch.missedAlertMinutes;
      if (patch.color !== undefined) r.color = patch.color;
      if (patch.notes !== undefined) r.notes = patch.notes;
      if (patch.scheduleKind !== undefined) r.scheduleKind = patch.scheduleKind;
      if (patch.times !== undefined) r.timesJson = JSON.stringify(patch.times);
      if (patch.weekdays !== undefined) r.weekdaysJson = JSON.stringify(patch.weekdays);
      if (patch.intervalDays !== undefined) r.intervalDays = patch.intervalDays;
      if (patch.startDate !== undefined) r.startDate = patch.startDate;
      if (patch.endDate !== undefined) r.endDate = patch.endDate;
      if (patch.remindersEnabled !== undefined) r.remindersEnabled = patch.remindersEnabled;
      if (patch.stockCount !== undefined) r.stockCount = patch.stockCount;
      if (patch.refillThreshold !== undefined) r.refillThreshold = patch.refillThreshold;
      if (patch.archived !== undefined) r.archived = patch.archived;
      r.updatedAt = Date.now();
    });
  });

  // The schedule may have moved, so drop the old alarms before re-arming.
  await cancelMedicineReminders(id);
  const updated = (await getMedicines()).find(m => m.id === id);
  if (updated) await scheduleMedicineReminders(updated);
}

/** Deletes a medicine and its dose history. */
export async function deleteMedicine(id: string): Promise<void> {
  const row = await medicinesCollection.find(id).catch(() => null);
  if (!row) return;
  const logs = await doseLogsCollection.query(Q.where('medicine_id', id)).fetch();

  await cancelMedicineReminders(id);
  await database.write(async () => {
    await database.batch(
      ...logs.map(l => l.prepareDestroyPermanently()),
      row.prepareDestroyPermanently(),
    );
  });
}

// ─── Dose logs ───────────────────────────────────────────────────────────────

export async function getDoseLogs(): Promise<DoseLog[]> {
  const rows = await doseLogsCollection.query().fetch();
  return rows.map(r => r.toPlain());
}

/**
 * Records a dose outcome, replacing any existing log for the same slot so
 * tapping "taken" then "skipped" leaves one row rather than two.
 *
 * Taking a dose also decrements tracked stock.
 */
export async function logDose(input: {
  medicineId: string;
  profileId: string;
  date: string;
  scheduledMinutes: number | null;
  status: DoseStatus;
  note?: string;
  /** Epoch ms the snooze expires; only meaningful with status 'snoozed'. */
  snoozedUntil?: number | null;
}): Promise<void> {
  // Narrow in SQL on the indexed medicine_id + date before matching the slot.
  // This runs on every "taken" tap, and dose_logs grows without bound — a full
  // table scan per tap gets slower every month the app is used.
  const existing = (await doseLogsCollection.query(
    Q.where('medicine_id', input.medicineId),
    Q.where('date', input.date),
  ).fetch()).find(
    l => (l.scheduledMinutes ?? null) === input.scheduledMinutes,
  );

  const now = Date.now();
  const medRow = await medicinesCollection.find(input.medicineId).catch(() => null);
  const wasTaken = existing?.status === 'taken';
  const isTaken = input.status === 'taken';

  await database.write(async () => {
    const ops: any[] = [];

    if (existing) {
      ops.push(existing.prepareUpdate(r => {
        r.status = input.status;
        r.takenAt = isTaken ? now : null;
        r.snoozedUntil = input.snoozedUntil ?? null;
        if (input.note !== undefined) r.note = input.note;
      }));
    } else {
      ops.push(doseLogsCollection.prepareCreate(r => {
        r.medicineId = input.medicineId;
        r.profileId = input.profileId;
        r.date = input.date;
        r.scheduledMinutes = input.scheduledMinutes;
        r.status = input.status;
        r.takenAt = isTaken ? now : null;
        r.snoozedUntil = input.snoozedUntil ?? null;
        r.note = input.note ?? '';
        r.createdAt = now;
      }));
    }

    // Only move stock when the taken-ness actually changed, so re-tapping
    // "taken" doesn't decrement twice.
    if (medRow && medRow.stockCount !== null && wasTaken !== isTaken) {
      const delta = isTaken ? -1 : 1;
      ops.push(medRow.prepareUpdate(r => {
        r.stockCount = Math.max(0, (medRow.stockCount ?? 0) + delta);
      }));
    }

    await database.batch(...ops);
  });
}

export async function clearDoseLog(medicineId: string, date: string, minutes: number | null): Promise<void> {
  const row = (await doseLogsCollection.query(
    Q.where('medicine_id', medicineId),
    Q.where('date', date),
  ).fetch()).find(l => (l.scheduledMinutes ?? null) === minutes);
  if (!row) return;
  await database.write(async () => { await row.destroyPermanently(); });
}

export async function adjustStock(medicineId: string, delta: number): Promise<void> {
  const row = await medicinesCollection.find(medicineId).catch(() => null);
  if (!row) return;
  await database.write(async () => {
    await row.update(r => {
      r.stockCount = Math.max(0, (row.stockCount ?? 0) + delta);
    });
  });
}

// ─── Reminders ───────────────────────────────────────────────────────────────

function channelIdFor(soundId: string): string {
  return `${CHANNEL_PREFIX}-${soundId || 'default'}`;
}

/**
 * Creates the channel for a sound.
 *
 * Android fixes a channel's sound at creation, so changing sounds means using a
 * different channel rather than editing the existing one.
 */
async function ensureChannel(soundId = 'default'): Promise<void> {
  if (!notifee) return;
  const sound = REMINDER_SOUNDS.find(s => s.id === soundId) ?? REMINDER_SOUNDS[0];
  try {
    await notifee.createChannel({
      id: channelIdFor(sound.id),
      name: `Medicine — ${sound.label}`,
      importance: 4,
      // 'silent' means no sound at all; the rest fall back to the system default
      // because bundling audio files is out of scope.
      ...(sound.id === 'silent' ? {} : { sound: 'default' }),
      vibration: sound.id !== 'silent',
    });
  } catch { /* channel already exists */ }
}

function notificationId(medicineId: string, date: string, minutes: number): string {
  return `med-${medicineId}-${date}-${minutes}`;
}

/**
 * Schedules alarms for the next week of doses.
 *
 * Android limits pending alarms, so this deliberately does not schedule
 * indefinitely — `rescheduleAllMedicineReminders` tops it up on each launch.
 */
export async function scheduleMedicineReminders(medicine: Medicine): Promise<number> {
  if (Platform.OS !== 'android' || !notifee) return 0;
  if (!medicine.remindersEnabled || medicine.archived) return 0;
  if (medicine.scheduleKind === 'as_needed' || medicine.times.length === 0) return 0;

  await ensureChannel(medicine.soundId);

  // The person's name leads the title: with several family members on
  // different schedules, "Time for Vitamin D" doesn't say who it's for.
  const profiles = await getProfiles();
  const owner = profiles.find(p => p.id === medicine.profileId);
  const prefix = owner && !owner.isDefault ? `${owner.name} — ` : '';

  const today = dateKey();
  let scheduled = 0;

  for (let i = 0; i < SCHEDULE_HORIZON_DAYS; i++) {
    const date = addDays(today, i);
    if (!isDueOn(medicine, date)) continue;

    for (const minutes of medicine.times) {
      const fireAt = timestampFor(date, minutes);
      if (fireAt <= Date.now()) continue;

      try {
        await notifee.createTriggerNotification(
          {
            id: notificationId(medicine.id, date, minutes),
            title: `${prefix}Time for ${medicine.name}`,
            body: [
              medicine.dosage ? `Take ${medicine.dosage}` : 'Tap to mark as taken',
              medicine.mealTiming !== 'any'
                ? MEAL_TIMINGS.find(t => t.value === medicine.mealTiming)?.label
                : null,
            ].filter(Boolean).join(' · '),
            android: {
              channelId: channelIdFor(medicine.soundId),
              // Actions let the user respond without opening the app.
              actions: [
                { title: 'Taken', pressAction: { id: 'taken' } },
                { title: 'Snooze', pressAction: { id: 'snooze' } },
              ],
              pressAction: { id: 'default', launchActivity: 'default' },
              importance: 4,
              smallIcon: 'ic_launcher',
              color: medicine.color,
            },
            data: {
              type: 'medicine-dose',
              medicineId: medicine.id,
              // Needed so a notification action can write a log that the UI
              // will actually show — logs are filtered by profile.
              profileId: medicine.profileId,
              date,
              minutes: String(minutes),
            },
          },
          {
            type: TriggerType?.TIMESTAMP ?? 0,
            timestamp: fireAt,
            alarmManager: true,
          },
        );
        scheduled++;
        // Follow-up nag if the dose goes unanswered.
        await scheduleMissedAlert(medicine, date, minutes, prefix);
      } catch {
        // One failed alarm shouldn't abort the rest.
      }
    }
  }

  return scheduled;
}

/**
 * Cancels a medicine's pending alarms.
 *
 * Reads the actual trigger list rather than guessing ids: brute-forcing every
 * possible time would mean thousands of no-op cancels per call.
 */
export async function cancelMedicineReminders(medicineId: string): Promise<void> {
  if (Platform.OS !== 'android' || !notifee) return;
  const prefix = `med-${medicineId}-`;

  try {
    const pending: any[] = await notifee.getTriggerNotificationIds();
    await Promise.all(
      pending
        .filter(id => typeof id === 'string' && id.startsWith(prefix))
        .map(id => notifee.cancelNotification(id).catch(() => {})),
    );
  } catch {
    // Older notifee builds lack getTriggerNotificationIds; the alarms then
    // expire on their own and re-scheduling overwrites them by id anyway.
  }
}

/**
 * Re-arms every medicine's alarms. Call on app start: Android drops pending
 * alarms on reboot and app update, and the rolling horizon needs topping up.
 */
export async function rescheduleAllMedicineReminders(): Promise<number> {
  if (Platform.OS !== 'android' || !notifee) return 0;
  const meds = await getMedicines();
  let total = 0;
  for (const m of meds) total += await scheduleMedicineReminders(m);
  return total;
}

// ─── Doctor report ───────────────────────────────────────────────────────────

export async function exportHistoryCsv(
  doses: ScheduledDose[],
  profileName: string,
): Promise<string | null> {
  if (doses.length === 0) {
    Alert.alert('Nothing to export', 'No dose history for this range yet.');
    return null;
  }

  try {
    const csv = historyToCsv(doses, profileName);
    const dir = Platform.OS === 'android' ? RNFS.DownloadDirectoryPath : RNFS.DocumentDirectoryPath;
    const safeName = profileName.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    const path = `${dir}/thinkora-medicine-${safeName}-${dateKey()}.csv`;
    await RNFS.writeFile(path, csv, 'utf8');

    Alert.alert('Report saved', `Saved to ${path}`, [
      { text: 'Done', style: 'cancel' },
      {
        text: 'Share',
        onPress: () => {
          Share.share({
            title: `Medicine history — ${profileName}`,
            message: csv.length > 100000 ? `Saved to ${path}` : csv,
          }).catch(() => { /* dismissed */ });
        },
      },
    ]);
    return path;
  } catch (e: any) {
    Alert.alert('Export failed', e?.message ?? 'Could not write the file.');
    return null;
  }
}

// ─── Snooze & missed-dose alerts ─────────────────────────────────────────────

/**
 * Snoozes a dose and re-fires the reminder later.
 *
 * The log records the new time so adherence doesn't count it as missed while
 * the snooze is still running.
 */
export async function snoozeDose(input: {
  medicineId: string;
  profileId: string;
  date: string;
  scheduledMinutes: number | null;
  minutes: number;
}): Promise<void> {
  const until = Date.now() + input.minutes * 60_000;

  await logDose({
    medicineId: input.medicineId,
    profileId: input.profileId,
    date: input.date,
    scheduledMinutes: input.scheduledMinutes,
    status: 'snoozed',
    snoozedUntil: until,
  });

  if (Platform.OS !== 'android' || !notifee) return;
  const medicine = (await getMedicines()).find(m => m.id === input.medicineId);
  if (!medicine) return;

  await ensureChannel(medicine.soundId);
  const owner = (await getProfiles()).find(p => p.id === medicine.profileId);
  const snoozePrefix = owner && !owner.isDefault ? `${owner.name} — ` : '';

  try {
    await notifee.createTriggerNotification(
      {
        id: `med-snooze-${input.medicineId}-${input.date}-${input.scheduledMinutes ?? 'prn'}`,
        title: `${snoozePrefix}${medicine.name} — snoozed reminder`,
        body: medicine.dosage ? `Take ${medicine.dosage}` : 'Tap to mark as taken',
        android: {
          channelId: channelIdFor(medicine.soundId),
          pressAction: { id: 'default', launchActivity: 'default' },
          importance: 4,
          smallIcon: 'ic_launcher',
          color: medicine.color,
        },
        data: {
          type: 'medicine-dose',
          medicineId: input.medicineId,
          profileId: input.profileId,
          date: input.date,
          minutes: String(input.scheduledMinutes ?? ''),
        },
      },
      { type: TriggerType?.TIMESTAMP ?? 0, timestamp: until, alarmManager: true },
    );
  } catch { /* one failed alarm shouldn't break the snooze record */ }
}

/**
 * Schedules a follow-up alert for a dose that may go unanswered.
 *
 * Fired `missedAlertMinutes` after the scheduled time. Whether it is still
 * relevant is checked when it lands — a dose taken in the meantime should not
 * produce a nag.
 */
async function scheduleMissedAlert(
  medicine: Medicine,
  date: string,
  minutes: number,
  namePrefix = '',
): Promise<void> {
  if (Platform.OS !== 'android' || !notifee) return;
  if (medicine.missedAlertMinutes == null) return;

  const fireAt = timestampFor(date, minutes) + medicine.missedAlertMinutes * 60_000;
  if (fireAt <= Date.now()) return;

  try {
    await notifee.createTriggerNotification(
      {
        id: `med-missed-${medicine.id}-${date}-${minutes}`,
        title: `${namePrefix}Missed dose — ${medicine.name}`,
        body: 'This dose has not been marked as taken.',
        android: {
          channelId: channelIdFor(medicine.soundId),
          pressAction: { id: 'default', launchActivity: 'default' },
          importance: 4,
          smallIcon: 'ic_launcher',
          color: medicine.color,
        },
        data: {
          type: 'medicine-missed',
          medicineId: medicine.id,
          profileId: medicine.profileId,
          date,
          minutes: String(minutes),
        },
      },
      { type: TriggerType?.TIMESTAMP ?? 0, timestamp: fireAt, alarmManager: true },
    );
  } catch { /* ignore */ }
}

// ─── Expiry reminders ────────────────────────────────────────────────────────

/**
 * Schedules one notification per expiring medicine.
 *
 * Fires at 9am on the day the warning window opens, or tomorrow morning if
 * that day has already passed.
 */
export async function scheduleExpiryReminders(): Promise<number> {
  if (Platform.OS !== 'android' || !notifee) return 0;
  const meds = await getMedicines();
  let scheduled = 0;

  for (const medicine of meds) {
    if (medicine.archived || !medicine.expiryDate) continue;

    const warnDate = addDays(medicine.expiryDate, -EXPIRY_WARNING_DAYS);
    let fireAt = timestampFor(warnDate, 9 * 60);
    if (fireAt <= Date.now()) {
      // Window already open: remind tomorrow morning instead of never.
      const days = daysUntilExpiry(medicine);
      if (days === null || days < 0) continue;
      fireAt = timestampFor(addDays(dateKey(), 1), 9 * 60);
    }

    await ensureChannel(medicine.soundId);
    try {
      await notifee.createTriggerNotification(
        {
          id: `med-expiry-${medicine.id}`,
          title: `${medicine.name} expires soon`,
          body: `Expiry date ${medicine.expiryDate}. Consider replacing it.`,
          android: {
            channelId: channelIdFor(medicine.soundId),
            pressAction: { id: 'default', launchActivity: 'default' },
            importance: 3,
            smallIcon: 'ic_launcher',
            color: medicine.color,
          },
          data: { type: 'medicine-expiry', medicineId: medicine.id },
        },
        { type: TriggerType?.TIMESTAMP ?? 0, timestamp: fireAt, alarmManager: true },
      );
      scheduled++;
    } catch { /* ignore */ }
  }
  return scheduled;
}

// ─── Import / export ─────────────────────────────────────────────────────────

interface MedicineBackup {
  version: number;
  exportedAt: number;
  profiles: FamilyProfile[];
  medicines: Medicine[];
  logs: DoseLog[];
}

/** Writes a JSON backup of every profile, medicine and dose log. */
export async function exportMedicineData(): Promise<string | null> {
  try {
    const [profiles, medicines, logs] = await Promise.all([
      getProfiles(), getMedicines(), getDoseLogs(),
    ]);

    const payload: MedicineBackup = {
      version: 1,
      exportedAt: Date.now(),
      profiles, medicines, logs,
    };

    const dir = Platform.OS === 'android'
      ? RNFS.DownloadDirectoryPath
      : RNFS.DocumentDirectoryPath;
    const path = `${dir}/thinkora-medicines-${dateKey()}.json`;
    await RNFS.writeFile(path, JSON.stringify(payload, null, 2), 'utf8');

    Alert.alert('Exported', `Saved to ${path}`, [
      { text: 'Done', style: 'cancel' },
      {
        text: 'Share',
        onPress: () => {
          Share.share({ url: `file://${path}`, title: 'Medicine data' })
            .catch(() => { /* dismissed */ });
        },
      },
    ]);
    return path;
  } catch (e: any) {
    Alert.alert('Export failed', e?.message ?? 'Could not write the file.');
    return null;
  }
}

/**
 * Restores medicines from a JSON backup.
 *
 * Adds to what is already there rather than replacing it — a merge is
 * recoverable by deleting the extras, whereas a wipe is not.
 */
export async function importMedicineData(json: string): Promise<{
  medicines: number; profiles: number;
} | null> {
  try {
    const parsed = JSON.parse(json) as MedicineBackup;
    if (!parsed || !Array.isArray(parsed.medicines)) return null;

    const existingProfiles = await getProfiles();
    const byName = new Map(existingProfiles.map(p => [p.name, p.id]));
    let profilesAdded = 0;

    for (const p of parsed.profiles ?? []) {
      if (p.isDefault || byName.has(p.name)) continue;
      await createProfile({ name: p.name, color: p.color, icon: p.icon });
      profilesAdded++;
    }

    // Re-read so imported profiles can be referenced by name.
    const afterProfiles = await getProfiles();
    const nameToId = new Map(afterProfiles.map(p => [p.name, p.id]));
    const oldIdToName = new Map((parsed.profiles ?? []).map(p => [p.id, p.name]));
    const fallbackId = afterProfiles.find(p => p.isDefault)?.id ?? afterProfiles[0]?.id;
    if (!fallbackId) return null;

    let added = 0;
    for (const m of parsed.medicines) {
      const targetName = oldIdToName.get(m.profileId);
      const profileId = (targetName && nameToId.get(targetName)) || fallbackId;

      await createMedicine({
        profileId,
        name: m.name,
        dosage: m.dosage ?? '',
        form: m.form ?? 'tablet',
        category: m.category ?? 'other',
        color: m.color ?? '#EF4444',
        notes: m.notes ?? '',
        photoUri: null,   // photos are device-local; a copied path would not resolve
        mealTiming: m.mealTiming ?? 'any',
        expiryDate: m.expiryDate ?? null,
        soundId: m.soundId ?? 'default',
        missedAlertMinutes: m.missedAlertMinutes ?? null,
        scheduleKind: m.scheduleKind ?? 'daily',
        times: Array.isArray(m.times) ? m.times : [],
        weekdays: Array.isArray(m.weekdays) ? m.weekdays : [],
        intervalDays: m.intervalDays ?? 1,
        startDate: m.startDate ?? dateKey(),
        endDate: m.endDate ?? null,
        remindersEnabled: m.remindersEnabled ?? true,
        stockCount: m.stockCount ?? null,
        refillThreshold: m.refillThreshold ?? null,
        archived: m.archived ?? false,
      });
      added++;
    }

    return { medicines: added, profiles: profilesAdded };
  } catch {
    return null;
  }
}

// ─── Widget ──────────────────────────────────────────────────────────────────

/** Today's doses in the shape the home widget renders. */
export async function todayWidgetDoses(): Promise<{
  name: string; time: string; taken: boolean;
}[]> {
  try {
    const [medicines, logs] = await Promise.all([getMedicines(), getDoseLogs()]);
    return dosesForDate(medicines, logs, dateKey())
      .filter(d => d.minutes !== null)
      .map(d => ({
        name: d.medicine.name,
        time: String(d.minutes),
        taken: d.status === 'taken',
      }));
  } catch {
    return [];
  }
}

// ─── Doctor visits ───────────────────────────────────────────────────────────

export type VisitInput = Omit<
  DoctorVisit, 'id' | 'createdAt' | 'updatedAt' | 'completed'
>;

export async function getVisits(profileId?: string): Promise<DoctorVisit[]> {
  const rows = await doctorVisitsCollection.query(
    ...(profileId ? [Q.where('profile_id', profileId)] : []),
  ).fetch();
  return rows
    .map(r => r.toPlain())
    // Soonest first, so the next appointment leads the list.
    .sort((a, b) => a.date.localeCompare(b.date) || a.minutes - b.minutes);
}

function writeVisit(r: any, input: Partial<VisitInput>): void {
  if (input.profileId !== undefined) r.profileId = input.profileId;
  if (input.doctorName !== undefined) r.doctorName = input.doctorName;
  if (input.location !== undefined) r.location = input.location;
  if (input.date !== undefined) r.date = input.date;
  if (input.minutes !== undefined) r.minutes = input.minutes;
  if (input.reason !== undefined) r.reason = input.reason;
  if (input.prescriptionNotes !== undefined) r.prescriptionNotes = input.prescriptionNotes;
  if (input.followUpDate !== undefined) r.followUpDate = input.followUpDate;
  if (input.reminderEnabled !== undefined) r.reminderEnabled = input.reminderEnabled;
  r.updatedAt = Date.now();
}

export async function createVisit(input: VisitInput): Promise<string> {
  const now = Date.now();
  let id = '';
  await database.write(async () => {
    const row = await doctorVisitsCollection.create(r => {
      writeVisit(r, input);
      r.completed = false;
      r.createdAt = now;
    });
    id = row.id;
  });

  const created = (await getVisits()).find(v => v.id === id);
  if (created) await scheduleVisitReminder(created);
  return id;
}

export async function updateVisit(
  id: string,
  patch: Partial<VisitInput> & { completed?: boolean },
): Promise<void> {
  const row = await doctorVisitsCollection.find(id).catch(() => null);
  if (!row) return;

  await database.write(async () => {
    await row.update(r => {
      writeVisit(r, patch);
      if (patch.completed !== undefined) r.completed = patch.completed;
    });
  });

  // The date may have moved, so re-arm rather than leaving a stale alarm.
  await cancelVisitReminder(id);
  const updated = (await getVisits()).find(v => v.id === id);
  if (updated && !updated.completed) await scheduleVisitReminder(updated);
}

export async function deleteVisit(id: string): Promise<void> {
  const row = await doctorVisitsCollection.find(id).catch(() => null);
  if (!row) return;
  await cancelVisitReminder(id);
  await database.write(async () => { await row.destroyPermanently(); });
}

/** Wording for each reminder slot; timing lives in `visitReminderSlots`. */
function visitNotificationText(
  visit: DoctorVisit,
  key: VisitSlotKey,
  prefix: string,
): { title: string; body: string } {
  if (key === 'follow-up') {
    return {
      title: `${prefix}Follow-up due`,
      body: visit.doctorName
        ? `Follow-up with ${visit.doctorName}`
        : 'Follow-up appointment due',
    };
  }
  const title = `${prefix}Doctor visit${visit.doctorName ? ` — ${visit.doctorName}` : ''}`;
  const body = key === 'day-before'
    ? `Tomorrow at ${formatTime(visit.minutes)}`
      + (visit.location ? ` · ${visit.location}` : '')
    : visit.location || 'Appointment now';
  return { title, body };
}

/**
 * Reminds the day before at 6pm, at the appointment time, and on any follow-up
 * date.
 *
 * A same-day-only reminder is too late to rearrange anything, which is what
 * people actually need warning for.
 */
export async function scheduleVisitReminder(visit: DoctorVisit): Promise<void> {
  if (Platform.OS !== 'android' || !notifee) return;
  if (!visit.reminderEnabled || visit.completed) return;

  const slots = visitReminderSlots(visit);
  if (slots.length === 0) return;

  await ensureChannel('default');
  const owner = (await getProfiles()).find(p => p.id === visit.profileId);
  const prefix = owner && !owner.isDefault ? `${owner.name} — ` : '';

  for (const slot of slots) {
    const { title, body } = visitNotificationText(visit, slot.key, prefix);
    try {
      await notifee.createTriggerNotification(
        {
          id: `visit-${visit.id}-${slot.key}`,
          title,
          body,
          android: {
            channelId: channelIdFor('default'),
            pressAction: { id: 'default', launchActivity: 'default' },
            importance: 4,
            smallIcon: 'ic_launcher',
          },
          data: { type: 'doctor-visit', visitId: visit.id, profileId: visit.profileId },
        },
        { type: TriggerType?.TIMESTAMP ?? 0, timestamp: slot.at, alarmManager: true },
      );
    } catch { /* one failed alarm shouldn't stop the others */ }
  }
}

export async function cancelVisitReminder(visitId: string): Promise<void> {
  if (Platform.OS !== 'android' || !notifee) return;
  for (const key of ['day-before', 'at-time', 'follow-up']) {
    try { await notifee.cancelNotification(`visit-${visitId}-${key}`); } catch { /* gone */ }
  }
}

/** Re-arms every future visit reminder. Android drops alarms on reboot. */
export async function rescheduleAllVisitReminders(): Promise<number> {
  if (Platform.OS !== 'android' || !notifee) return 0;
  const visits = await getVisits();
  let count = 0;
  for (const v of visits) {
    if (v.completed) continue;
    await scheduleVisitReminder(v);
    count++;
  }
  return count;
}
