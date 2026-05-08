/**
 * Always-On Notification Tray — a persistent ongoing notification with
 * today's top task, streak count, and quick-add actions.
 *
 * The user can toggle this in Settings. Disabled by default.
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Task } from '../types';

let notifee: any = null;
let AndroidImportance: any = null;
if (Platform.OS === 'android') {
  try {
    const n = require('@notifee/react-native').default;
    const types = require('@notifee/react-native');
    notifee = n;
    AndroidImportance = types.AndroidImportance ?? { LOW: 2, DEFAULT: 3 };
  } catch {}
}

const CHANNEL_ID = 'thinkora-tray';
const NOTIFICATION_ID = 'thinkora-persistent-tray';
const ENABLED_KEY = '@thinkora/persistent_tray_enabled';

async function ensureChannel(): Promise<void> {
  if (!notifee) return;
  await notifee.createChannel({
    id: CHANNEL_ID,
    name: 'Persistent Quick Actions',
    importance: AndroidImportance?.LOW ?? 2,
    sound: undefined,
    vibration: false,
  });
}

export async function isPersistentTrayEnabled(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(ENABLED_KEY)) === 'true';
  } catch { return false; }
}

export async function setPersistentTrayEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(ENABLED_KEY, enabled ? 'true' : 'false');
  if (!enabled) await hidePersistentTray();
}

interface TrayContext {
  topTask?: Task;
  streakDays: number;
  pendingCount: number;
}

export async function showPersistentTray(ctx: TrayContext): Promise<void> {
  if (!notifee) return;
  if (!(await isPersistentTrayEnabled())) return;

  await ensureChannel();

  const topLine = ctx.topTask
    ? `🎯 ${ctx.topTask.title}`
    : ctx.pendingCount > 0
      ? `${ctx.pendingCount} task${ctx.pendingCount === 1 ? '' : 's'} pending`
      : 'No pending tasks 🎉';
  const subLine = ctx.streakDays > 0
    ? `🔥 ${ctx.streakDays}-day streak`
    : 'Tap to capture a thought';

  await notifee.displayNotification({
    id: NOTIFICATION_ID,
    title: topLine,
    body: subLine,
    android: {
      channelId: CHANNEL_ID,
      ongoing: true,
      autoCancel: false,
      smallIcon: 'ic_launcher',
      importance: AndroidImportance?.LOW ?? 2,
      pressAction: { id: 'default' },
      actions: [
        { title: '+ Note', pressAction: { id: 'tray_new_note', launchActivity: 'default' } },
        { title: '+ Task', pressAction: { id: 'tray_new_task', launchActivity: 'default' } },
        { title: '🍅 Focus', pressAction: { id: 'tray_pomodoro', launchActivity: 'default' } },
      ],
    },
  });
}

export async function hidePersistentTray(): Promise<void> {
  if (!notifee) return;
  try { await notifee.cancelNotification(NOTIFICATION_ID); } catch {}
}

/**
 * Refresh the tray with current data. Call this from AppContext whenever
 * task list, completed count, or streak changes.
 */
export async function refreshPersistentTray(ctx: TrayContext): Promise<void> {
  if (!(await isPersistentTrayEnabled())) return;
  await showPersistentTray(ctx);
}
