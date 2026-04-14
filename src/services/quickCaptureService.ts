/**
 * Quick Capture: persistent notification for rapid task/note entry.
 * Uses Notifee on Android to show an ongoing notification.
 * State (enabled/disabled) is persisted in AsyncStorage.
 */
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

let notifee: any = null;
try { notifee = require('@notifee/react-native').default; } catch {}

const CHANNEL_ID = 'thinkora-quick-capture';
const NOTIF_ID = 'quick-capture';
const STORAGE_KEY = '@thinkora/quick_capture_enabled';

export async function showQuickCaptureNotification(): Promise<void> {
  if (Platform.OS !== 'android' || !notifee) return;
  try {
    await notifee.createChannel({
      id: CHANNEL_ID,
      name: 'Quick Capture',
      importance: 3, // DEFAULT — non-intrusive
    });
    await notifee.displayNotification({
      id: NOTIF_ID,
      title: 'Thinkora — Quick Capture',
      body: 'Tap to quickly add a task or note',
      android: {
        channelId: CHANNEL_ID,
        ongoing: true,
        asForegroundService: false,
        smallIcon: 'ic_notification',
        pressAction: { id: 'default', launchActivity: 'default' },
        actions: [
          {
            title: '+ Task',
            pressAction: {
              id: 'add-task',
              launchActivity: 'default',
              launchActivityFlags: [/* FLAG_ACTIVITY_SINGLE_TOP */ 536870912],
            },
          },
          {
            title: '+ Note',
            pressAction: {
              id: 'add-note',
              launchActivity: 'default',
              launchActivityFlags: [536870912],
            },
          },
        ],
      },
    });
    await AsyncStorage.setItem(STORAGE_KEY, 'true');
  } catch {}
}

export async function hideQuickCaptureNotification(): Promise<void> {
  if (Platform.OS !== 'android' || !notifee) return;
  try {
    await notifee.cancelNotification(NOTIF_ID);
    await AsyncStorage.setItem(STORAGE_KEY, 'false');
  } catch {}
}

/** Call on app start to restore the persistent notification if it was enabled */
export async function restoreQuickCaptureIfEnabled(): Promise<void> {
  if (Platform.OS !== 'android' || !notifee) return;
  try {
    const val = await AsyncStorage.getItem(STORAGE_KEY);
    if (val === 'true') {
      await showQuickCaptureNotification();
    }
  } catch {}
}

export async function isQuickCaptureEnabled(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(STORAGE_KEY);
    return val === 'true';
  } catch {
    return false;
  }
}
