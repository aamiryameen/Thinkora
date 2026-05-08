/**
 * Smart Notification Timing — learns when the user is most likely to act
 * (open the app, complete tasks) and suggests/uses better times for
 * non-deadline notifications (digest, reflection, idea resurface).
 *
 * Tracks app-open timestamps in a rolling 60-day window and computes
 * the user's preferred morning hour and evening hour.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@thinkora/engagement_log';
const MAX_ENTRIES = 200;

interface EngagementEntry {
  ts: number;       // epoch ms
  type: 'open' | 'complete';
}

async function loadLog(): Promise<EngagementEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

async function saveLog(entries: EngagementEntry[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)));
}

/** Call when app comes to foreground OR when user completes a task. */
export async function logEngagement(type: 'open' | 'complete' = 'open'): Promise<void> {
  const log = await loadLog();
  log.push({ ts: Date.now(), type });
  await saveLog(log);
}

interface TimingProfile {
  /** Hour of day (0-23) the user is most active in the morning. Defaults to 8. */
  morningHour: number;
  /** Hour of day (0-23) the user is most active in the evening. Defaults to 20. */
  eveningHour: number;
  /** Confidence 0..1 — based on sample count. */
  confidence: number;
  /** Number of samples used. */
  sampleCount: number;
}

const DEFAULTS: TimingProfile = {
  morningHour: 8,
  eveningHour: 20,
  confidence: 0,
  sampleCount: 0,
};

/** Compute the user's preferred AM and PM hours for non-urgent reminders. */
export async function getTimingProfile(): Promise<TimingProfile> {
  const log = await loadLog();
  if (log.length < 10) return { ...DEFAULTS, sampleCount: log.length };

  // Bucket by hour, separately for AM (5-11) and PM (16-23)
  const amBuckets = new Array(24).fill(0);
  const pmBuckets = new Array(24).fill(0);
  for (const e of log) {
    const h = new Date(e.ts).getHours();
    if (h >= 5 && h <= 11) amBuckets[h] += 1;
    else if (h >= 16 && h <= 23) pmBuckets[h] += 1;
  }

  const morningHour = pickPeak(amBuckets, 5, 11) ?? DEFAULTS.morningHour;
  const eveningHour = pickPeak(pmBuckets, 16, 23) ?? DEFAULTS.eveningHour;

  return {
    morningHour, eveningHour,
    confidence: Math.min(1, log.length / 60),
    sampleCount: log.length,
  };
}

function pickPeak(buckets: number[], lo: number, hi: number): number | null {
  let best = -1, bestCount = 0;
  for (let h = lo; h <= hi; h++) {
    if (buckets[h] > bestCount) { bestCount = buckets[h]; best = h; }
  }
  return best === -1 || bestCount === 0 ? null : best;
}
