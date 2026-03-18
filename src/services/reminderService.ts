import { Platform } from 'react-native';
import { NOTIFICATION_CHANNEL_ID } from '../core/constants';
import type { Reminder, ReminderRepeat } from '../types';

let notifee: typeof import('@notifee/react-native') | null = null;
let TriggerType: { TIMESTAMP: number } | null = null;
let RepeatFrequency: { DAILY: number; WEEKLY: number } | null = null;
if (Platform.OS === 'android') {
  const n = require('@notifee/react-native').default;
  notifee = n;
  TriggerType = n.TriggerType ?? { TIMESTAMP: 1 };
  RepeatFrequency = n.RepeatFrequency ?? { DAILY: 1, WEEKLY: 2 };
}

export async function createNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android' || !notifee) return;
  await notifee.createChannel({
    id: NOTIFICATION_CHANNEL_ID,
    name: 'Note Reminders',
    importance: 4,
    sound: 'default',
    vibration: true,
  });
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android' || !notifee) return false;
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
  if (Platform.OS !== 'android' || !notifee || !reminder.date) return null;
  await createNotificationChannel();
  const repeatFreq = getRepeatFrequency(reminder.repeat);
  const trigger: { type: number; timestamp: number; alarmManager?: boolean; repeatFrequency?: number } = {
    type: TriggerType?.TIMESTAMP ?? 1,
    timestamp: reminder.date,
    alarmManager: true,
  };
  if (repeatFreq !== undefined) trigger.repeatFrequency = repeatFreq;
  const id = await notifee.createTriggerNotification(
    {
      title: reminder.title || 'NotioX Reminder',
      body: reminder.body,
      android: {
        channelId: NOTIFICATION_CHANNEL_ID,
        sound: 'default',
        pressAction: { id: 'default' },
      },
      data: { noteId: reminder.noteId, reminderId: reminder.id },
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
