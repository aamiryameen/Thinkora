import { Platform, PermissionsAndroid } from 'react-native';
import { NOTIFICATION_CHANNEL_ID } from '../core/constants';
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
const ALARM_CHANNEL_ID = 'thinkora_alarm';

export async function createNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android' || !notifee) return;
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
  // Alarm-style channel with loud sound and persistent vibration
  await notifee.createChannel({
    id: ALARM_CHANNEL_ID,
    name: 'Task Alarms',
    importance: 4, // HIGH — heads-up + sound
    sound: 'alarm',
    vibration: true,
    vibrationPattern: [500, 200, 500, 200, 500, 200],
    lights: true,
    lightColor: '#FF0000',
  });
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
    if (__DEV__) console.log('[Reminder] Skipped:', !notifee ? 'no notifee' : !reminder.date ? 'no date' : 'not android');
    return null;
  }
  if (__DEV__) console.log('[Reminder] Scheduling:', reminder.id, 'at', new Date(reminder.date).toLocaleTimeString());
  await createNotificationChannel();
  const repeatFreq = getRepeatFrequency(reminder.repeat);
  const trigger: { type: number; timestamp: number; alarmManager?: boolean; repeatFrequency?: number } = {
    type: TriggerType?.TIMESTAMP ?? 0,
    timestamp: reminder.date,
    alarmManager: true,
  };
  if (repeatFreq !== undefined) trigger.repeatFrequency = repeatFreq;
  const id = await notifee.createTriggerNotification(
    {
      id: reminder.id,
      title: reminder.title || 'Thinkora Reminder',
      body: reminder.body,
      android: {
        channelId: ALARM_CHANNEL_ID,
        sound: 'alarm',
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
  notifee.onBackgroundEvent(async ({ type, detail }) => {
    const EventType = require('@notifee/react-native').EventType;
    if (type === EventType.ACTION_PRESS) {
      const actionId = detail.pressAction?.id;
      if (actionId === 'dismiss' && detail.notification?.id) {
        await notifee!.cancelNotification(detail.notification.id);
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
