/**
 * Weather alerts — a daily morning summary plus condition-based warnings.
 *
 * Two kinds of notification, deliberately kept few so the feature stays
 * welcome rather than noisy:
 *
 *   1. Morning summary (07:00 daily) — today's high/low, condition, and rain
 *      chance. Scheduled as a repeating trigger so it survives app restarts.
 *   2. Condition warning — fired on refresh when today's forecast turns
 *      genuinely notable (heavy rain, storm, extreme heat/cold, high wind).
 *      Deduplicated per day per kind, so re-opening the app can't spam.
 *
 * Everything is Android-only and no-ops safely elsewhere, matching
 * reminderService. Notifee is lazy-required so Jest imports don't explode.
 */

import { Platform } from 'react-native';
import { storage } from './storage';
import { getCurrentWeather, type WeatherSnapshot } from './weatherService';

let notifee: any = null;
let TriggerType: any = null;
let RepeatFrequency: any = null;
let AndroidImportance: any = null;

if (Platform.OS === 'android') {
  try {
    const mod = require('@notifee/react-native');
    notifee = mod.default ?? mod;
    TriggerType = mod.TriggerType;
    RepeatFrequency = mod.RepeatFrequency;
    AndroidImportance = mod.AndroidImportance;
  } catch {
    notifee = null;
  }
}

const ENABLED_KEY = 'thinkora_weather_alerts_enabled';
/** Records "kind:YYYY-MM-DD" strings already sent, so we never repeat one. */
const SENT_KEY = 'thinkora_weather_alerts_sent';

const CHANNEL_ID = 'weather_alerts';
const SUMMARY_NOTIFICATION_ID = 'weather-daily-summary';
/** Local hour for the morning summary. */
const SUMMARY_HOUR = 7;

export type AlertKind = 'rain' | 'storm' | 'heat' | 'cold' | 'wind' | 'snow';

// ─── Settings ─────────────────────────────────────────────────────────────────

/**
 * Whether alerts are on. Defaults to ON for new installs.
 *
 * `null` is the "never chosen" state and is what makes the default safe: a user
 * who explicitly turned alerts off stores `false`, which is preserved. Reading
 * a plain boolean with a `true` fallback would silently re-enable alerts for
 * anyone who had opted out.
 */
export async function isWeatherAlertsEnabled(): Promise<boolean> {
  const stored = await storage.getSetting<boolean | null>(ENABLED_KEY, null);
  if (stored === null || stored === undefined) return true;   // new install
  return stored === true;
}

/**
 * Turns alerts on or off. Returns false when it couldn't be enabled — almost
 * always a denied notification permission, which the caller should surface.
 */
export async function setWeatherAlertsEnabled(enabled: boolean): Promise<boolean> {
  if (!enabled) {
    await storage.setSetting(ENABLED_KEY, false);
    await cancelWeatherAlerts();
    return true;
  }

  if (Platform.OS !== 'android' || !notifee) return false;

  const granted = await requestPermission();
  if (!granted) return false;

  await storage.setSetting(ENABLED_KEY, true);
  await ensureChannel();
  await scheduleDailySummary();
  return true;
}

async function requestPermission(): Promise<boolean> {
  if (!notifee) return false;
  try {
    const settings = await notifee.requestPermission();
    // notifee returns authorizationStatus >= 1 for granted/provisional.
    return (settings?.authorizationStatus ?? 0) >= 1;
  } catch {
    return false;
  }
}

async function ensureChannel(): Promise<void> {
  if (!notifee) return;
  try {
    await notifee.createChannel({
      id: CHANNEL_ID,
      name: 'Weather alerts',
      description: 'Daily forecast summary and severe weather warnings',
      // DEFAULT, not HIGH: weather is informational, and a heads-up banner for
      // every morning summary would feel intrusive.
      importance: AndroidImportance?.DEFAULT ?? 3,
    });
  } catch (err) {
  }
}

// ─── Daily summary ────────────────────────────────────────────────────────────

/** Next occurrence of SUMMARY_HOUR local time, strictly in the future. */
function nextSummaryTimestamp(now = Date.now()): number {
  const d = new Date(now);
  d.setHours(SUMMARY_HOUR, 0, 0, 0);
  if (d.getTime() <= now) d.setDate(d.getDate() + 1);
  return d.getTime();
}

/**
 * Schedules the repeating 07:00 summary. The body is filled in at fire time by
 * `refreshDailySummaryContent`, because a trigger scheduled today cannot know
 * next week's forecast.
 */
export async function scheduleDailySummary(): Promise<void> {
  if (Platform.OS !== 'android' || !notifee) return;
  if (!(await isWeatherAlertsEnabled())) return;

  await ensureChannel();

  // Use whatever forecast we have cached so the first notification is useful
  // even before the next refresh.
  let body = "Tap to see today's forecast.";
  try {
    const snap = await getCurrentWeather();
    if (snap) body = summaryBody(snap);
  } catch {
    // Keep the generic body.
  }

  try {
    await notifee.createTriggerNotification(
      {
        id: SUMMARY_NOTIFICATION_ID,
        title: 'Today\'s weather',
        body,
        android: {
          channelId: CHANNEL_ID,
          smallIcon: 'ic_launcher',
          pressAction: { id: 'default', launchActivity: 'default' },
        },
        data: { type: 'weather-summary' },
      },
      {
        type: TriggerType?.TIMESTAMP ?? 0,
        timestamp: nextSummaryTimestamp(),
        repeatFrequency: RepeatFrequency?.DAILY ?? 1,
      },
    );
  } catch (err) {
  }
}

function summaryBody(snap: WeatherSnapshot): string {
  const today = snap.daily[0];
  const parts: string[] = [snap.condition];
  if (today) parts.push(`${today.low}° to ${today.high}°`);
  if (snap.precipChance >= 30) parts.push(`${snap.precipChance}% chance of rain`);
  if (snap.feelsLabel) parts.push(snap.feelsLabel.toLowerCase());
  return parts.join(' · ');
}

/** Re-schedules the summary so tomorrow's notification has fresh content. */
export async function refreshDailySummaryContent(): Promise<void> {
  if (!(await isWeatherAlertsEnabled())) return;
  await scheduleDailySummary();
}

/**
 * Called once at app start to honour the on-by-default setting.
 *
 * Alerts being enabled is only half the job — the repeating 07:00 trigger has
 * to actually exist. On a fresh install nothing has scheduled it yet, so this
 * does that setup.
 *
 * Deliberately does NOT request notification permission. Prompting on first
 * launch, before the user has seen what weather alerts are, is the kind of
 * thing people reflexively deny — and a denial is far harder to recover from
 * than an un-asked question. Instead we schedule only when permission has
 * already been granted (Android 12 and below grant it implicitly); otherwise
 * the toggle in the weather detail screen asks in context.
 */
export async function initWeatherAlerts(): Promise<void> {
  if (Platform.OS !== 'android' || !notifee) return;
  if (!(await isWeatherAlertsEnabled())) return;

  try {
    const settings = await notifee.getNotificationSettings();
    const granted = (settings?.authorizationStatus ?? 0) >= 1;
    if (!granted) {
      // Leave the preference as-is; the in-context toggle will prompt later.
      return;
    }
  } catch {
    // If we can't read settings, attempting to schedule is harmless — notifee
    // no-ops when it lacks permission.
  }

  await ensureChannel();
  await scheduleDailySummary();
}

export async function cancelWeatherAlerts(): Promise<void> {
  if (!notifee) return;
  try {
    await notifee.cancelNotification(SUMMARY_NOTIFICATION_ID);
  } catch {
    // Nothing scheduled.
  }
}

// ─── Condition warnings ───────────────────────────────────────────────────────

interface Warning {
  kind: AlertKind;
  title: string;
  body: string;
}

/**
 * Decides whether today's weather is worth interrupting the user for.
 *
 * Thresholds are intentionally conservative: a notification the user didn't
 * need is worse than a missing one, because it teaches them to ignore the
 * channel (or disable it).
 */
export function evaluateWarnings(snap: WeatherSnapshot): Warning[] {
  const out: Warning[] = [];
  const today = snap.daily[0];

  // Storms first — the most actionable, and it supersedes a plain rain alert.
  if (snap.theme === 'storm') {
    out.push({
      kind: 'storm',
      title: 'Thunderstorm expected',
      body: `Storms in ${snap.locationLabel} today. ${snap.precipChance}% chance of precipitation.`,
    });
  } else if (snap.precipChance >= 70) {
    out.push({
      kind: 'rain',
      title: 'Rain likely today',
      body: `${snap.precipChance}% chance of rain in ${snap.locationLabel}. Worth taking an umbrella.`,
    });
  }

  if (snap.theme === 'snow') {
    out.push({
      kind: 'snow',
      title: 'Snow expected',
      body: `Snow forecast for ${snap.locationLabel} today.`,
    });
  }

  // Use apparent temperature: 38C at high humidity is far more dangerous than
  // the dry-bulb number suggests, and that is what people feel.
  if (today && snap.feelsLike >= 40) {
    out.push({
      kind: 'heat',
      title: 'Extreme heat today',
      body: `Feels like ${snap.feelsLike}° in ${snap.locationLabel}. Stay hydrated and avoid midday sun.`,
    });
  } else if (today && today.high >= 38) {
    out.push({
      kind: 'heat',
      title: 'Very hot today',
      body: `Reaching ${today.high}° in ${snap.locationLabel}.`,
    });
  }

  if (today && snap.feelsLike <= 0) {
    out.push({
      kind: 'cold',
      title: 'Freezing conditions',
      body: `Feels like ${snap.feelsLike}° in ${snap.locationLabel}. Dress warmly.`,
    });
  }

  if (snap.windGustKph >= 60) {
    out.push({
      kind: 'wind',
      title: 'Strong winds',
      body: `Gusts up to ${snap.windGustKph} km/h in ${snap.locationLabel}.`,
    });
  }

  return out;
}

function dayKey(ts = Date.now()): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function loadSent(): Promise<string[]> {
  const raw = await storage.getSetting<string[]>(SENT_KEY, []);
  return Array.isArray(raw) ? raw : [];
}

/**
 * Fires any warranted warnings, at most once per kind per day.
 *
 * Safe to call on every weather refresh — the dedupe key is what makes that
 * true, so callers don't need their own throttling.
 */
export async function checkAndNotify(snap: WeatherSnapshot): Promise<AlertKind[]> {
  if (Platform.OS !== 'android' || !notifee) return [];
  if (!(await isWeatherAlertsEnabled())) return [];

  const warnings = evaluateWarnings(snap);
  if (warnings.length === 0) return [];

  const today = dayKey();
  const sent = await loadSent();
  // Drop other days' entries so this list can't grow without bound.
  const sentToday = sent.filter((k) => k.endsWith(today));

  const fired: AlertKind[] = [];
  await ensureChannel();

  for (const warning of warnings) {
    const key = `${warning.kind}:${today}`;
    if (sentToday.includes(key)) continue;

    try {
      await notifee.displayNotification({
        id: `weather-${key}`,
        title: warning.title,
        body: warning.body,
        android: {
          channelId: CHANNEL_ID,
          smallIcon: 'ic_launcher',
          pressAction: { id: 'default', launchActivity: 'default' },
        },
        data: { type: 'weather-alert', kind: warning.kind },
      });
      sentToday.push(key);
      fired.push(warning.kind);
    } catch (err) {
    }
  }

  if (fired.length > 0) {
    await storage.setSetting(SENT_KEY, sentToday);
  }
  return fired;
}
