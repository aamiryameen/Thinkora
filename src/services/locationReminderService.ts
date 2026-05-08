/**
 * Location-Based Reminders — fire when the user enters a geofence.
 *
 * Approach: in-app polling-based geofence (no native background service).
 *  - When the app is in the foreground, poll location every 60s.
 *  - Compare position to active location reminders.
 *  - If within `radiusMeters`, fire a notification + clear the reminder
 *    (or keep it active for repeat use).
 *
 * For true background geofencing, a native module would be needed; this
 * service handles the foreground case and triggers immediately when the
 * app is open, which covers most real-world cases (running an errand
 * with the phone in hand).
 */

import { Platform, PermissionsAndroid } from 'react-native';
import type { Reminder } from '../types';

let Geolocation: any = null;
try {
  Geolocation = require('react-native-geolocation-service').default ?? require('react-native-geolocation-service');
} catch {
  Geolocation = null;
}

let notifee: any = null;
let TriggerType: any = null;
if (Platform.OS === 'android') {
  try {
    const n = require('@notifee/react-native').default;
    const types = require('@notifee/react-native');
    notifee = n;
    TriggerType = types.TriggerType ?? { TIMESTAMP: 0 };
  } catch {}
}

const CHANNEL_LOC = 'thinkora-location';
const FIRED_KEY = '@thinkora/fired_geofences';

let pollHandle: ReturnType<typeof setInterval> | null = null;
let firedSet = new Set<string>();

export async function requestLocationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: 'Location Permission',
        message: 'Thinkora uses your location to fire reminders when you arrive at saved places.',
        buttonPositive: 'Allow',
        buttonNegative: 'Deny',
      },
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

export function isLocationAvailable(): boolean {
  return Geolocation !== null && Platform.OS === 'android';
}

async function ensureChannel(): Promise<void> {
  if (!notifee) return;
  await notifee.createChannel({
    id: CHANNEL_LOC,
    name: 'Location Reminders',
    importance: 4,
    sound: 'default',
    vibration: true,
  });
}

/** Haversine — distance in meters between two lat/lon pairs. */
function haversineMeters(
  lat1: number, lon1: number, lat2: number, lon2: number,
): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

interface Position {
  latitude: number;
  longitude: number;
}

function getPositionPromise(): Promise<Position> {
  return new Promise((resolve, reject) => {
    if (!Geolocation) return reject(new Error('Geolocation unavailable'));
    Geolocation.getCurrentPosition(
      (pos: any) => resolve({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      }),
      (err: any) => reject(new Error(err?.message ?? 'Location error')),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 30000 },
    );
  });
}

/** Get current location once. Returns null on permission/timeout error. */
export async function getCurrentLocation(): Promise<Position | null> {
  if (!Geolocation) return null;
  const ok = await requestLocationPermission();
  if (!ok) return null;
  try {
    return await getPositionPromise();
  } catch {
    return null;
  }
}

async function fireLocationNotification(reminder: Reminder): Promise<void> {
  if (!notifee) return;
  await ensureChannel();
  await notifee.displayNotification({
    title: `📍 ${reminder.title || 'Location Reminder'}`,
    body: reminder.body || `You're near ${reminder.location?.label ?? 'your saved location'}`,
    android: {
      channelId: CHANNEL_LOC,
      importance: 4,
      pressAction: { id: 'default' },
    },
    data: {
      reminderId: reminder.id,
      type: 'location-reminder',
    },
  });
}

/**
 * Start the foreground polling loop. Pass a getter that returns the
 * current array of reminders (so updates are reflected without restart).
 * Auto-stops if no location reminders exist.
 */
export function startLocationWatch(getReminders: () => Reminder[]): void {
  if (pollHandle) return;
  if (!Geolocation) return;

  const tick = async () => {
    const reminders = getReminders().filter(r => r.triggerType === 'location' && r.location);
    if (reminders.length === 0) return;

    try {
      const pos = await getPositionPromise();
      for (const r of reminders) {
        if (!r.location) continue;
        if (firedSet.has(r.id)) continue;
        const d = haversineMeters(pos.latitude, pos.longitude, r.location.latitude, r.location.longitude);
        if (d <= r.location.radiusMeters) {
          await fireLocationNotification(r);
          firedSet.add(r.id);
        }
      }
    } catch {
      // Silent — location may be temporarily unavailable
    }
  };

  // First tick immediately, then every 60s
  tick();
  pollHandle = setInterval(tick, 60000);
}

export function stopLocationWatch(): void {
  if (pollHandle) {
    clearInterval(pollHandle);
    pollHandle = null;
  }
}

/** Reset the "already-fired" set (e.g., when user re-enters the app). */
export function resetFiredGeofences(): void {
  firedSet = new Set();
}
