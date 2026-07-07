/**
 * Holiday notification service — schedules a notification at 9 AM the day
 * before each upcoming public holiday for the user's country.
 *
 * Each scheduled notification id is deterministic (`holiday-<country>-<date>`)
 * so re-syncing replaces in place rather than duplicating. Past holidays and
 * notifications past the firing window are skipped/cancelled automatically.
 */

import { Platform } from 'react-native';
import type { Holiday } from './holidayService';

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

const CHANNEL_HOLIDAY = 'thinkora-holiday';
const ID_PREFIX = 'holiday-';

async function ensureChannel(): Promise<void> {
  if (!notifee) return;
  await notifee.createChannel({
    id: CHANNEL_HOLIDAY,
    name: 'Public Holidays',
    importance: 3,
    sound: 'default',
    vibration: true,
  });
}

function notificationId(h: Holiday): string {
  return `${ID_PREFIX}${h.countryCode}-${h.date}`;
}

/** Compute the timestamp 9 AM local time on the day before a "YYYY-MM-DD" date. */
function leadTimeMs(holidayDate: string): number {
  const [y, m, d] = holidayDate.split('-').map((s) => parseInt(s, 10));
  if (!y || !m || !d) return NaN;
  // Day-before at 09:00 local time. Building via the Date constructor in local
  // time avoids UTC offset surprises.
  const t = new Date(y, m - 1, d, 9, 0, 0, 0);
  t.setDate(t.getDate() - 1);
  return t.getTime();
}

/**
 * Sync holiday notifications: schedules an alert for each future holiday and
 * cancels any previously-scheduled holiday notifications that no longer apply
 * (e.g. country changed, holiday list changed, user disabled the feature).
 */
export async function syncHolidayNotifications(
  holidays: Holiday[],
  enabled: boolean,
): Promise<void> {
  if (Platform.OS !== 'android' || !notifee) return;
  await ensureChannel();

  // Find existing holiday notifications so we can cancel stale ones.
  // notifee exposes getTriggerNotificationIds() on Android.
  let existingIds: string[] = [];
  try {
    existingIds = (await notifee.getTriggerNotificationIds?.()) ?? [];
  } catch {
    existingIds = [];
  }
  const oursExisting = new Set(existingIds.filter((id) => id.startsWith(ID_PREFIX)));

  // If disabled, cancel everything we own and bail.
  if (!enabled) {
    for (const id of oursExisting) {
      try { await notifee.cancelNotification(id); } catch {}
    }
    return;
  }

  const now = Date.now();
  const wantedIds = new Set<string>();

  for (const h of holidays) {
    const ts = leadTimeMs(h.date);
    if (!Number.isFinite(ts)) continue;
    if (ts <= now) continue; // skip past holidays

    const id = notificationId(h);
    wantedIds.add(id);

    // If already scheduled, skip — re-creating is idempotent but extra work.
    // notifee replaces by id so we still re-create to handle title changes
    // (e.g. localized name updates after a country switch).
    try {
      await notifee.createTriggerNotification(
        {
          id,
          title: `🎉 ${h.localName || h.name}`,
          body: `Tomorrow is ${h.name} — plan ahead!`,
          android: {
            channelId: CHANNEL_HOLIDAY,
            sound: 'default',
            pressAction: { id: 'default' },
            smallIcon: 'ic_launcher',
          },
          data: {
            type: 'holiday',
            holidayDate: h.date,
            countryCode: h.countryCode,
          },
        },
        {
          type: TriggerType?.TIMESTAMP ?? 0,
          timestamp: ts,
          alarmManager: true,
        },
      );
    } catch {
      // non-fatal — one bad holiday shouldn't break the rest
    }
  }

  // Cancel stale ones we previously scheduled but no longer need.
  for (const id of oursExisting) {
    if (!wantedIds.has(id)) {
      try { await notifee.cancelNotification(id); } catch {}
    }
  }
}

/** Cancel every holiday notification regardless of country. */
export async function cancelAllHolidayNotifications(): Promise<void> {
  if (Platform.OS !== 'android' || !notifee) return;
  try {
    const ids = (await notifee.getTriggerNotificationIds?.()) ?? [];
    for (const id of ids) {
      if (id.startsWith(ID_PREFIX)) {
        try { await notifee.cancelNotification(id); } catch {}
      }
    }
  } catch {
    // ignore
  }
}
