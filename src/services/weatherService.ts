/**
 * Weather service — fetches current weather for the user's location using
 * Open-Meteo (no API key, free, accurate). Caches the last response in
 * AsyncStorage for 10 minutes so repeat opens are instant.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCurrentLocation } from './locationReminderService';

const CACHE_KEY = '@thinkora/weather_v5';
// Short cache so users always see near-realtime weather. Open-Meteo updates
// `minutely_15` every 15 minutes; 2 min keeps the UI snappy without hammering.
const CACHE_TTL_MS = 2 * 60 * 1000;

export interface WeatherSnapshot {
  /** Temperature in °C, rounded. */
  temperature: number;
  /** "feels like" in °C, rounded. */
  feelsLike: number;
  /** Today's high °C, rounded. */
  highToday: number;
  /** Today's low °C, rounded. */
  lowToday: number;
  /** Wind speed in km/h, rounded (most recent 15-min slot). */
  windKph: number;
  /** Wind gust in km/h, rounded (current). */
  windGustKph: number;
  /** Relative humidity %, current. */
  humidity: number;
  /** Precipitation in mm in the most recent 15-min slot. */
  precipMm: number;
  /** Concise label: e.g. "Clear", "Light rain". */
  condition: string;
  /** Ionicons name suitable for the condition (and time of day). */
  icon: string;
  /** Emoji glyph for the condition, day/night-aware. */
  emoji: string;
  /** Hex accent color tied to the condition (used for glow/ring tints). */
  accent: string;
  /** Whether it's daytime at the user's location. */
  isDay: boolean;
  /** True when wind exceeds ~25 km/h. */
  isWindy: boolean;
  /** Resolved place label, e.g. "Karachi" or "Current location" fallback. */
  locationLabel: string;
  /** Next few hours, starting with the current hour. */
  hourly: HourlySlot[];
  /** Unix ms when fetched. */
  fetchedAt: number;
}

export interface HourlySlot {
  /** Hour timestamp (unix ms, local). */
  ts: number;
  /** Temperature °C, rounded. */
  temperature: number;
  /** Emoji glyph for the slot's weather. */
  emoji: string;
  /** Whether it's daytime at the slot's time. */
  isDay: boolean;
}

interface CacheShape {
  snapshot: WeatherSnapshot;
  lat: number;
  lon: number;
}

/** Open-Meteo WMO weather codes → human label + Ionicons + emoji + accent. */
function decodeWeatherCode(
  code: number,
  isDay: boolean,
): { condition: string; icon: string; emoji: string; accent: string } {
  const sunAccent = '#F59E0B';
  const moonAccent = '#6366F1';
  const cloudAccent = '#94A3B8';
  const rainAccent = '#3B82F6';
  const snowAccent = '#7DD3FC';
  const stormAccent = '#8B5CF6';
  const fogAccent = '#94A3B8';

  if (code === 0)
    return isDay
      ? { condition: 'Clear', icon: 'sunny-outline', emoji: '☀️', accent: sunAccent }
      : { condition: 'Clear', icon: 'moon-outline', emoji: '🌙', accent: moonAccent };
  if (code === 1)
    return isDay
      ? { condition: 'Mostly clear', icon: 'partly-sunny-outline', emoji: '🌤️', accent: sunAccent }
      : { condition: 'Mostly clear', icon: 'cloudy-night-outline', emoji: '🌜', accent: moonAccent };
  if (code === 2)
    return isDay
      ? { condition: 'Partly cloudy', icon: 'partly-sunny-outline', emoji: '⛅', accent: sunAccent }
      : { condition: 'Partly cloudy', icon: 'cloudy-night-outline', emoji: '☁️', accent: moonAccent };
  if (code === 3) return { condition: 'Overcast', icon: 'cloud-outline', emoji: '☁️', accent: cloudAccent };
  if (code === 45 || code === 48) return { condition: 'Foggy', icon: 'cloudy-outline', emoji: '🌫️', accent: fogAccent };
  if (code >= 51 && code <= 57) return { condition: 'Drizzle', icon: 'rainy-outline', emoji: '🌦️', accent: rainAccent };
  if (code >= 61 && code <= 65) return { condition: 'Rainy', icon: 'rainy-outline', emoji: '🌧️', accent: rainAccent };
  if (code === 66 || code === 67) return { condition: 'Freezing rain', icon: 'rainy-outline', emoji: '🌧️', accent: rainAccent };
  if (code >= 71 && code <= 77) return { condition: 'Snow', icon: 'snow-outline', emoji: '❄️', accent: snowAccent };
  if (code >= 80 && code <= 82) return { condition: 'Showers', icon: 'rainy-outline', emoji: '🌧️', accent: rainAccent };
  if (code === 85 || code === 86) return { condition: 'Snow showers', icon: 'snow-outline', emoji: '🌨️', accent: snowAccent };
  if (code >= 95 && code <= 99) return { condition: 'Thunderstorm', icon: 'thunderstorm-outline', emoji: '⛈️', accent: stormAccent };
  return { condition: 'Unknown', icon: 'cloud-outline', emoji: '☁️', accent: cloudAccent };
}

async function readCache(): Promise<CacheShape | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CacheShape;
  } catch {
    return null;
  }
}

async function writeCache(value: CacheShape): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(value));
  } catch {
    // ignore
  }
}

/** Reverse-geocode via free public services. Tries multiple providers
 *  because Open-Meteo's reverse endpoint sometimes returns no results
 *  for coarse coords. Falls back to "Current location" rather than raw
 *  numeric coords (which look ugly in the UI). */
async function reverseGeocode(lat: number, lon: number, signal?: AbortSignal): Promise<string> {
  // 1. BigDataCloud — free, no key, very reliable for city resolution.
  try {
    const url =
      `https://api.bigdatacloud.net/data/reverse-geocode-client` +
      `?latitude=${lat}&longitude=${lon}&localityLanguage=en`;
    const r = await fetch(url, { signal });
    if (r.ok) {
      const j = await r.json();
      const city = j?.city || j?.locality || j?.principalSubdivision;
      const region = j?.principalSubdivision;
      if (city) {
        return region && region !== city ? `${city}, ${region}` : city;
      }
    }
  } catch {
    // fall through
  }

  // 2. Open-Meteo reverse — secondary fallback.
  try {
    const url =
      `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}` +
      `&count=1&language=en&format=json`;
    const r = await fetch(url, { signal });
    if (r.ok) {
      const j = await r.json();
      const place = j?.results?.[0];
      if (place?.name) {
        return place.admin1 && place.admin1 !== place.name
          ? `${place.name}, ${place.admin1}`
          : place.name;
      }
    }
  } catch {
    // fall through
  }

  return 'Current location';
}

/** Pick the index in `times` whose timestamp is the most recent at-or-before now.
 *  Open-Meteo returns local-timezone ISO strings (no Z) when timezone=auto, so
 *  we compare via Date.parse() which interprets them as UTC and gets the
 *  ordering right regardless. */
function pickLatestSlot(times: string[] | undefined): number {
  if (!times || times.length === 0) return -1;
  const now = Date.now();
  let bestIdx = -1;
  let bestDelta = Number.POSITIVE_INFINITY;
  for (let i = 0; i < times.length; i++) {
    const t = Date.parse(times[i]);
    if (Number.isNaN(t)) continue;
    const delta = now - t;
    if (delta >= 0 && delta < bestDelta) {
      bestDelta = delta;
      bestIdx = i;
    }
  }
  // Fall back to the first slot if none are at-or-before now.
  return bestIdx === -1 ? 0 : bestIdx;
}

async function fetchOpenMeteo(
  lat: number,
  lon: number,
  signal?: AbortSignal,
): Promise<Omit<WeatherSnapshot, 'locationLabel' | 'fetchedAt'>> {
  // Request:
  //  - current: hourly snapshot (temp, humidity, wind, gust, weather code)
  //  - minutely_15: 15-min-resolution precipitation/weather/wind for "rain now"
  //  - daily: today's high/low
  // cell_selection=nearest avoids interpolation that can smooth out localized
  // rain. timezone=auto so all timestamps come back in the user's local time.
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,apparent_temperature,is_day,weather_code,` +
    `relative_humidity_2m,wind_speed_10m,wind_gusts_10m,precipitation` +
    `&minutely_15=weather_code,precipitation,wind_speed_10m` +
    `&hourly=temperature_2m,weather_code,is_day` +
    `&daily=temperature_2m_max,temperature_2m_min` +
    `&forecast_days=2&forecast_minutely_15=4` +
    `&cell_selection=nearest&timezone=auto`;

  const r = await fetch(url, { signal, headers: { 'cache-control': 'no-cache' } });
  if (!r.ok) throw new Error(`Weather API ${r.status}`);
  const j = await r.json();

  const cur = j?.current ?? {};
  const daily = j?.daily ?? {};
  const m15 = j?.minutely_15 ?? {};
  const hourly = j?.hourly ?? {};
  const isDay = cur.is_day === 1;

  // Choose the most recent 15-min slot that's at-or-before now. This replaces
  // hourly weather codes that lag by up to 60 min.
  const slotIdx = pickLatestSlot(m15.time);
  const slotCode = slotIdx >= 0 ? Number(m15.weather_code?.[slotIdx] ?? NaN) : NaN;
  const slotPrecip = slotIdx >= 0 ? Number(m15.precipitation?.[slotIdx] ?? 0) : 0;
  const slotWind = slotIdx >= 0 ? Number(m15.wind_speed_10m?.[slotIdx] ?? NaN) : NaN;

  const hourlyCode = Number(cur.weather_code ?? -1);

  // Decision: prefer the 15-min code if available; otherwise fall back to the
  // hourly current code. Then apply a "rain-now override": if either reading
  // shows actual precipitation > 0.1 mm in the last slot, force a rain code,
  // because users see rain on the ground and won't accept "Clear" labels.
  let effectiveCode = Number.isFinite(slotCode) && slotCode >= 0 ? slotCode : hourlyCode;
  const currentPrecip = Number(cur.precipitation ?? 0);
  if (slotPrecip > 0.1 || currentPrecip > 0.1) {
    // Heavy precip → showers (80–82); otherwise generic rain (61–63).
    effectiveCode = slotPrecip > 2.5 || currentPrecip > 2.5 ? 80 : 61;
  }

  const decoded = decodeWeatherCode(effectiveCode, isDay);

  const windKph = Math.round(
    Number.isFinite(slotWind) ? slotWind : Number(cur.wind_speed_10m ?? 0),
  );
  const windGustKph = Math.round(Number(cur.wind_gusts_10m ?? cur.wind_speed_10m ?? 0));

  // Build the next 6 hourly slots starting from the current hour.
  const hourlySlots: HourlySlot[] = [];
  if (Array.isArray(hourly.time)) {
    const now = Date.now();
    const startIdx = pickLatestSlot(hourly.time);
    for (let i = startIdx; i < hourly.time.length && hourlySlots.length < 6; i++) {
      const ts = Date.parse(hourly.time[i]);
      if (Number.isNaN(ts)) continue;
      // Skip past hours other than the current one
      if (ts < now - 3_600_000) continue;
      const code = Number(hourly.weather_code?.[i] ?? -1);
      const slotIsDay = hourly.is_day?.[i] === 1;
      const dec = decodeWeatherCode(code, slotIsDay);
      hourlySlots.push({
        ts,
        temperature: Math.round(Number(hourly.temperature_2m?.[i] ?? 0)),
        emoji: dec.emoji,
        isDay: slotIsDay,
      });
    }
  }

  return {
    temperature: Math.round(Number(cur.temperature_2m ?? 0)),
    feelsLike: Math.round(Number(cur.apparent_temperature ?? cur.temperature_2m ?? 0)),
    highToday: Math.round(Number(daily.temperature_2m_max?.[0] ?? cur.temperature_2m ?? 0)),
    lowToday: Math.round(Number(daily.temperature_2m_min?.[0] ?? cur.temperature_2m ?? 0)),
    windKph,
    windGustKph,
    humidity: Math.round(Number(cur.relative_humidity_2m ?? 0)),
    precipMm: Math.round(Math.max(slotPrecip, currentPrecip) * 10) / 10,
    hourly: hourlySlots,
    isDay,
    isWindy: windKph >= 25,
    condition: decoded.condition,
    icon: decoded.icon,
    emoji: decoded.emoji,
    accent: decoded.accent,
  };
}

interface FetchOpts {
  /** If true, skip cache and force a network fetch. */
  forceRefresh?: boolean;
  signal?: AbortSignal;
}

/**
 * Returns the current weather snapshot for the user's location, or null if
 * permission was denied or the request failed. Uses a 10-minute cache.
 */
export async function getCurrentWeather(opts: FetchOpts = {}): Promise<WeatherSnapshot | null> {
  const { forceRefresh = false, signal } = opts;

  if (!forceRefresh) {
    const cached = await readCache();
    if (cached && Date.now() - cached.snapshot.fetchedAt < CACHE_TTL_MS) {
      return cached.snapshot;
    }
  }

  const pos = await getCurrentLocation();
  if (!pos) return null;

  try {
    const [weather, label] = await Promise.all([
      fetchOpenMeteo(pos.latitude, pos.longitude, signal),
      reverseGeocode(pos.latitude, pos.longitude, signal),
    ]);
    const snapshot: WeatherSnapshot = {
      ...weather,
      locationLabel: label,
      fetchedAt: Date.now(),
    };
    await writeCache({ snapshot, lat: pos.latitude, lon: pos.longitude });
    return snapshot;
  } catch {
    // On network failure, return stale cache rather than nothing
    const cached = await readCache();
    return cached?.snapshot ?? null;
  }
}
