/**
 * Quick Capture: persistent notification for rapid task/note entry.
 * Uses Notifee on Android to show an ongoing notification.
 */
import { Platform } from 'react-native';

let notifee: any = null;
try { notifee = require('@notifee/react-native').default; } catch {}

const CHANNEL_ID = 'notiox-quick-capture';

export async function showQuickCaptureNotification(): Promise<void> {
  if (Platform.OS !== 'android' || !notifee) return;
  try {
    await notifee.createChannel({
      id: CHANNEL_ID,
      name: 'Quick Capture',
      importance: 3, // DEFAULT
    });
    await notifee.displayNotification({
      id: 'quick-capture',
      title: 'PlanUp — Quick Capture',
      body: 'Tap to quickly add a task or note',
      android: {
        channelId: CHANNEL_ID,
        ongoing: true,
        smallIcon: 'ic_notification',
        pressAction: { id: 'quick-add', launchActivity: 'default' },
        actions: [
          { title: 'Add Task', pressAction: { id: 'add-task', launchActivity: 'default' } },
          { title: 'Add Note', pressAction: { id: 'add-note', launchActivity: 'default' } },
        ],
      },
    });
  } catch {}
}

export async function hideQuickCaptureNotification(): Promise<void> {
  if (Platform.OS !== 'android' || !notifee) return;
  try {
    await notifee.cancelNotification('quick-capture');
  } catch {}
}
