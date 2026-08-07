import { Platform, PermissionsAndroid } from 'react-native';
import { NOTIFICATION_CHANNEL_ID } from '../core/constants';
import { getSelectedReminderTune, getTuneForItem } from './soundService';
import type { Reminder, ReminderRepeat } from '../types';

let notifee: typeof import('@notifee/react-native') | null = null;
let TriggerType: { TIMESTAMP: number; INTERVAL: number } | null = null;
let RepeatFrequency: { NONE: number; HOURLY: number; DAILY: number; WEEKLY: number } | null = null;
if (Platform.OS === 'android') {
  const n = require('@notifee/react-native').default;
  const types = require('@notifee/react-native');
  notifee = n;
  TriggerType = types.TriggerType ?? { TIMESTAMP: 0, INTERVAL: 1 };
  RepeatFrequency = types.RepeatFrequency ?? { NONE: -1, HOURLY: 0, DAILY: 1, WEEKLY: 2 };
}

const SNOOZE_CHANNEL_ID = 'thinkora_snooze';
/**
 * Channel ID version. Bump this when the bundled sound assets change so
 * Android recreates the channels with fresh sounds. Android caches a
 * channel's sound at creation time and ignores updates — versioning the ID
 * is the only reliable way to force a refresh.
 */
const CHANNEL_VERSION = 'v2';
const ALARM_CHANNEL_ID = `thinkora_alarm_${CHANNEL_VERSION}`;

const TUNE_RESOURCES: { id: string; resource: string }[] = [
  { id: 'chime',     resource: 'reminder_chime' },
  { id: 'marimba',   resource: 'reminder_marimba' },
  { id: 'ding',      resource: 'reminder_ding' },
  { id: 'bell',      resource: 'reminder_bell' },
  { id: 'pop',       resource: 'reminder_pop' },
  { id: 'soft',      resource: 'reminder_soft' },
  { id: 'xylophone', resource: 'reminder_xylophone' },
  { id: 'digital',   resource: 'reminder_digital' },
  { id: 'classic',   resource: 'reminder_classic' },
  { id: 'twinkle',   resource: 'reminder_twinkle' },
];

/** Channel ID for a specific tune. Defaults to the alarm channel. */
function channelIdForTune(tuneId: string): string {
  if (!tuneId || tuneId === 'alarm') return ALARM_CHANNEL_ID;
  // Custom user-uploaded tunes get their own ad-hoc channel (created on demand).
  if (tuneId.startsWith('custom_')) return `thinkora_alarm_${tuneId}_${CHANNEL_VERSION}`;
  return `thinkora_alarm_${tuneId}_${CHANNEL_VERSION}`;
}

/** Create an ad-hoc notification channel for a custom user-uploaded tune.
 *  Android requires channels to be created before notifications use them, and
 *  channel sounds are immutable once created — so each unique custom tune URI
 *  gets its own channel ID. */
async function ensureCustomChannel(tuneId: string, soundUri: string): Promise<void> {
  if (Platform.OS !== 'android' || !notifee) return;
  await notifee.createChannel({
    id: channelIdForTune(tuneId),
    name: `Alarm — Custom`,
    importance: 4,
    sound: soundUri,
    vibration: true,
    vibrationPattern: [500, 200, 500, 200, 500, 200],
    lights: true,
    lightColor: '#FF0000',
  });
}

let channelsCreated = false;

export async function createNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android' || !notifee) return;
  if (channelsCreated) return; // Idempotent — only run once per app session.

  await notifee.createChannel({
    id: NOTIFICATION_CHANNEL_ID,
    name: 'Reminders',
    importance: 4,
    sound: 'default',
    vibration: true,
  });
  await notifee.createChannel({
    id: SNOOZE_CHANNEL_ID,
    name: 'Snoozed Reminders',
    importance: 4,
    sound: 'default',
    vibration: true,
  });
  // Default alarm channel (used when tune.id === 'alarm' or no tune set)
  await notifee.createChannel({
    id: ALARM_CHANNEL_ID,
    name: 'Task Alarms',
    importance: 4,
    sound: 'alarm',
    vibration: true,
    vibrationPattern: [500, 200, 500, 200, 500, 200],
    lights: true,
    lightColor: '#FF0000',
  });

  // One channel per tune. Android bakes the sound into the channel on
  // creation and ignores later updates, so each tune gets a unique channel.
  for (const t of TUNE_RESOURCES) {
    await notifee.createChannel({
      id: channelIdForTune(t.id),
      name: `Alarm — ${t.id}`,
      importance: 4,
      sound: t.resource,
      vibration: true,
      vibrationPattern: [500, 200, 500, 200, 500, 200],
      lights: true,
      lightColor: '#FF0000',
    });
  }

  // Best-effort cleanup of old un-versioned channels from prior installs
  // so users don't see ghost duplicates in system Notification settings.
  try {
    const oldIds = [
      'thinkora_alarm',
      ...TUNE_RESOURCES.map((t) => `thinkora_alarm_${t.id}`),
    ];
    for (const id of oldIds) {
      // @ts-ignore — deleteChannel exists at runtime on Android
      await notifee.deleteChannel?.(id).catch(() => {});
    }
  } catch {
    // ignore — cleanup is non-critical
  }

  channelsCreated = true;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android' || !notifee) return false;
  // Android 13+ (API 33) requires POST_NOTIFICATIONS runtime permission
  try {
    if (Platform.Version >= 33) {
      const granted = await PermissionsAndroid.request(
        'android.permission.POST_NOTIFICATIONS' as any,
        {
          title: 'Notification Permission',
          message: 'Thinkora needs notification permission to send you reminders and alerts.',
          buttonPositive: 'Allow',
          buttonNegative: 'Deny',
        },
      );
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        console.log('[Notifications] Permission denied by user');
        return false;
      }
    }
  } catch (err) {
    console.log('[Notifications] Permission request error:', err);
  }
  // Also request via notifee for alarm/exact scheduling permissions
  const { authorizationStatus } = await notifee.requestPermission();
  return authorizationStatus >= 1;
}

function getRepeatFrequency(repeat: ReminderRepeat): number | undefined {
  if (!RepeatFrequency) return undefined;
  if (repeat === 'daily') return RepeatFrequency.DAILY;
  if (repeat === 'weekly') return RepeatFrequency.WEEKLY;
  return undefined;
}

export async function scheduleTimeReminder(reminder: Reminder): Promise<string | null> {
  if (Platform.OS !== 'android' || !notifee || !reminder.date) {
    return null;
  }
  await createNotificationChannel();
  const repeatFreq = getRepeatFrequency(reminder.repeat);
  const trigger: { type: number; timestamp: number; alarmManager?: boolean; repeatFrequency?: number } = {
    type: TriggerType?.TIMESTAMP ?? 0,
    timestamp: reminder.date,
    alarmManager: true,
  };
  if (repeatFreq !== undefined) trigger.repeatFrequency = repeatFreq;
  // Per-item tune override if set; otherwise global default tune
  const tune = await getTuneForItem(reminder.id);
  const isCustom = tune.id.startsWith('custom_');
  if (isCustom) {
    // Custom tune: ensure its dedicated channel exists with the user's audio
    await ensureCustomChannel(tune.id, tune.resource);
  }
  const channelId = channelIdForTune(tune.id);
  const id = await notifee.createTriggerNotification(
    {
      id: reminder.id,
      title: reminder.title || 'Thinkora Reminder',
      body: reminder.body,
      android: {
        channelId,
        sound: tune.resource,
        fullScreenAction: { id: 'default' },
        pressAction: { id: 'default' },
        importance: 4,
        actions: [
          { title: 'Snooze 10m', pressAction: { id: 'snooze_10', launchActivity: 'default' } },
          { title: 'Snooze 1h', pressAction: { id: 'snooze_60', launchActivity: 'default' } },
          { title: 'Dismiss', pressAction: { id: 'dismiss' } },
        ],
      },
      data: {
            noteId: reminder.noteId,
            reminderId: reminder.id,
            taskId: reminder.id.startsWith('task-reminder-') ? reminder.noteId : '',
            type: reminder.id.startsWith('task-reminder-') ? 'task-reminder' : 'note-reminder',
          },
    },
    trigger
  );
  return id;
}

/** Snooze: cancel existing notification and schedule a new one N minutes from now */
export async function snoozeReminder(reminder: Reminder, minutes: number): Promise<string | null> {
  if (Platform.OS !== 'android' || !notifee) return null;
  // Cancel existing
  if (reminder.notifeeId) {
    await notifee.cancelNotification(reminder.notifeeId);
  }
  await createNotificationChannel();
  const snoozeTs = Date.now() + minutes * 60 * 1000;
  const trigger = {
    type: TriggerType?.TIMESTAMP ?? 1,
    timestamp: snoozeTs,
    alarmManager: true,
  };
  const id = await notifee.createTriggerNotification(
    {
      title: `⏰ ${reminder.title || 'Reminder'}`,
      body: reminder.body,
      android: {
        channelId: SNOOZE_CHANNEL_ID,
        sound: 'default',
        pressAction: { id: 'default' },
        actions: [
          { title: 'Snooze 10m', pressAction: { id: 'snooze_10', launchActivity: 'default' } },
          { title: 'Dismiss', pressAction: { id: 'dismiss' } },
        ],
      },
      data: { noteId: reminder.noteId, reminderId: reminder.id, snoozed: 'true' },
    },
    trigger
  );
  return id;
}

export async function cancelReminderNotification(notifeeId: string): Promise<void> {
  if (Platform.OS !== 'android' || !notifee) return;
  await notifee.cancelNotification(notifeeId);
}

export async function cancelAllReminders(): Promise<void> {
  if (Platform.OS !== 'android' || !notifee) return;
  await notifee.cancelAllNotifications();
}

export function isReminderServiceAvailable(): boolean {
  return Platform.OS === 'android' && notifee != null;
}

/** Fire an instant test notification to verify notifee is working */
export async function fireTestNotification(title: string, body: string): Promise<void> {
  if (Platform.OS !== 'android' || !notifee) {
    console.log('[Test] notifee not available');
    return;
  }
  await createNotificationChannel();
  await notifee.displayNotification({
    title,
    body,
    android: {
      channelId: ALARM_CHANNEL_ID,
      sound: 'alarm',
      importance: 4,
      pressAction: { id: 'default' },
    },
  });
  console.log('[Test] Notification displayed with alarm sound');
}

/** Register background notification event handler for snooze actions + deep linking */
export function registerNotificationHandlers(): void {
  if (Platform.OS !== 'android' || !notifee) return;
  notifee.onBackgroundEvent(async ({ type, detail }: { type: number; detail: any }) => {
    const EventType = require('@notifee/react-native').EventType;
    if (type === EventType.ACTION_PRESS) {
      const actionId = detail.pressAction?.id;
      if (actionId === 'dismiss' && detail.notification?.id) {
        await notifee!.cancelNotification(detail.notification.id);
        return;
      }
      // Medicine reminders carry Taken / Snooze buttons. Handled here rather
      // than in medicineService because notifee allows only one background
      // event handler for the whole app.
      if (actionId === 'taken' || actionId === 'snooze') {
        const data = detail.notification?.data ?? {};
        if (data.type === 'medicine-dose' && data.medicineId && data.date) {
          const med = require('./medicineService');
          const minutes = data.minutes ? Number(data.minutes) : null;
          const profileId = String(data.profileId ?? '');
          try {
            if (actionId === 'taken') {
              await med.logDose({
                medicineId: String(data.medicineId),
                profileId,
                date: String(data.date),
                scheduledMinutes: Number.isFinite(minutes) ? minutes : null,
                status: 'taken',
              });
            } else {
              await med.snoozeDose({
                medicineId: String(data.medicineId),
                profileId,
                date: String(data.date),
                scheduledMinutes: Number.isFinite(minutes) ? minutes : null,
                minutes: 10,
              });
            }
          } catch { /* the user can still act inside the app */ }
        }
        if (detail.notification?.id) {
          await notifee!.cancelNotification(detail.notification.id);
        }
        return;
      }
      // Deep link on default press action (notification body tap)
      if (actionId === 'default') {
        const { handleNotificationDeepLink } = require('./navigationService');
        handleNotificationDeepLink(detail.notification?.data);
      }
    }
    // Also handle PRESS event (notification body tap without action buttons)
    if (type === EventType.PRESS) {
      const { handleNotificationDeepLink } = require('./navigationService');
      handleNotificationDeepLink(detail.notification?.data);
    }
  });
}
