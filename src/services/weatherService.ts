/**
 * Weather service — fetches current weather for the user's location using
 * Open-Meteo (no API key, free, accurate). Caches the last response in
 * AsyncStorage for 10 minutes so repeat opens are instant.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCurrentLocation } from './locationReminderService';

// v6: added daily[], locality, coordinates. Bumping the key discards
// pre-v6 snapshots, which would otherwise render undefined fields.
const CACHE_KEY = '@thinkora/weather_v6';
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
  /**
   * How the weather actually feels, derived from temperature, humidity and
   * wind rather than the sky-condition code — e.g. "Hot & humid", "Muggy",
   * "Chilly". Null when conditions are unremarkable, so the UI shows nothing
   * rather than a bland "Pleasant".
   */
  feelsLabel: string | null;
  /** Ionicons name suitable for the condition (and time of day). */
  icon: string;
  /** Emoji glyph for the condition, day/night-aware. */
  emoji: string;
  /** Hex accent color tied to the condition (used for glow/ring tints). */
  accent: string;
  /**
   * Family the condition belongs to, used to pick the card's visual treatment.
   * Coarser than `condition` on purpose — "Drizzle", "Rainy" and "Showers"
   * should all render as rain rather than needing three near-identical themes.
   */
  theme: WeatherTheme;
  /** Whether it's daytime at the user's location. */
  isDay: boolean;
  /** True when wind exceeds ~25 km/h. */
  isWindy: boolean;
  /** Resolved place label, e.g. "Karachi" or "Current location" fallback. */
  locationLabel: string;
  /**
   * Finer-grained locality when the geocoder resolves one — a neighbourhood or
   * suburb like "Gulberg" or "Cantt". Null when only the city is known, so the
   * UI can omit the line rather than repeating the city twice.
   */
  localityLabel: string | null;
  /** Nearest street, when the geocoder resolves one. Shown on the detail screen. */
  roadLabel: string | null;
  /** Coordinates the forecast was fetched for, so the UI can show them. */
  latitude: number | null;
  longitude: number | null;
  /** Next few hours, starting with the current hour. */
  hourly: HourlySlot[];
  /** Daily forecast, index 0 = today. Up to 10 days. */
  daily: DailySlot[];
  /** Sunrise/sunset for today as unix ms, when available. */
  sunrise: number | null;
  sunset: number | null;
  /** Max UV index today, or null when unavailable. */
  uvIndex: number | null;
  /** Chance of precipitation today, 0-100. */
  precipChance: number;
  /** Unix ms when fetched. */
  fetchedAt: number;
}

export interface DailySlot {
  /** Local midnight for the day, unix ms. */
  ts: number;
  high: number;
  low: number;
  emoji: string;
  condition: string;
  /** Precipitation probability %, 0-100. */
  precipChance: number;
}

/**
 * Visual family for the weather card. Kept deliberately small: each value
 * needs its own hand-tuned palette and decoration, and near-duplicates would
 * add maintenance cost without the user noticing a difference.
 */
export type WeatherTheme =
  | 'clear-day'
  | 'clear-hot'
  | 'clear-night'
  | 'cloudy'
  | 'cloudy-night'
  | 'overcast'
  | 'rain'
  | 'storm'
  | 'snow'
  | 'fog';

/**
 * Palette + decoration hints for one weather theme.
 *
 * Colours are plain hex so the card can render them as ordinary Views — the
 * gradient is interpolated in JS rather than pulling in a gradient dependency.
 */
export interface WeatherThemeStyle {
  /**
   * Vertical gradient stops, top to bottom — fully opaque on purpose.
   *
   * An earlier version layered translucent colours over the parent surface,
   * which mixed the sky into the host's purple and produced a flat grey-mauve
   * (measured rgb(36,40,82) instead of the intended rgb(20,27,52)). Opaque
   * stops give the palette we actually designed, on any background.
   */
  gradient: string[];
  /** Glow blob tint (sun, moon, storm flash). */
  glowColor: string;
  /** Secondary glow, used for a second light source / horizon warmth. */
  glowColorAlt: string;
  /** Which animated decoration to draw, if any. */
  decoration:
    | 'none'
    | 'rain'
    | 'snow'
    | 'clouds'
    | 'night-clouds'
    | 'stars'
    | 'sunbeam'
    | 'lightning';
  /** Tint for the hourly pills so they read against the new base. */
  pillColor: string;
  /** Tint for the hourly strip's own band, separating it from the hero. */
  stripColor: string;
}

/** Hand-tuned palettes per theme. Day/night handled by separate entries. */
export const WEATHER_THEMES: Record<WeatherTheme, WeatherThemeStyle> = {
  'clear-day': {
    // Deep zenith to warm horizon, the way a real daytime sky falls off.
    // The horizon is deliberately held back from true pale blue: white text
    // sits over it, and a #BFE4F5 horizon measured only 1.3:1 contrast. These
    // stops keep white legible without needing a heavy scrim that would flatten
    // every other theme.
    gradient: ['#1355A8', '#1E6FD9', '#3B8FD4', '#5AA3C4'],
    glowColor: '#FFD36E',
    glowColorAlt: '#FF9E5E',
    decoration: 'sunbeam',
    pillColor: '#0B3A6622',
    stripColor: '#08284A26',
  },
  'clear-hot': {
    // The reference's sunny card is warm terracotta-to-amber, not blue. A hot
    // day genuinely reads better warm — blue skies say "pleasant" regardless of
    // whether it is 22 or 40 degrees.
    gradient: ['#C2503F', '#D46A44', '#DE8845', '#C9863F'],
    glowColor: '#FFD36E',
    glowColorAlt: '#FFB25E',
    decoration: 'sunbeam',
    pillColor: '#7A2B1F26',
    stripColor: '#5E1F1626',
  },
  'clear-night': {
    // Near-black zenith through indigo to a faint city glow at the horizon.
    gradient: ['#080D1F', '#141B3A', '#25305C', '#3A3F70'],
    glowColor: '#C6D2FF',
    glowColorAlt: '#6F7CC4',
    decoration: 'stars',
    pillColor: '#FFFFFF14',
    stripColor: '#04060F40',
  },
  cloudy: {
    gradient: ['#3A5570', '#54708C', '#7B94AC', '#8FA0AE'],
    glowColor: '#F2F7FB',
    glowColorAlt: '#C3D4E2',
    decoration: 'clouds',
    pillColor: '#12324D22',
    stripColor: '#0D243826',
  },
  'cloudy-night': {
    // Night sky, but lifted from clear-night so drifting cloud reads against it.
    gradient: ['#0C1226', '#182142', '#2A3560', '#3E4874'],
    glowColor: '#AFBCE8',
    glowColorAlt: '#5F6CA8',
    decoration: 'night-clouds',
    pillColor: '#FFFFFF14',
    stripColor: '#060A1840',
  },
  overcast: {
    gradient: ['#2C343E', '#404B58', '#5D6874', '#828C97'],
    glowColor: '#D8E0E7',
    glowColorAlt: '#9EA9B4',
    decoration: 'clouds',
    pillColor: '#FFFFFF16',
    stripColor: '#181D2440',
  },
  rain: {
    gradient: ['#101F31', '#1C3247', '#2A4A66', '#3C627F'],
    glowColor: '#8FC4F0',
    glowColorAlt: '#4A7BA8',
    decoration: 'rain',
    pillColor: '#FFFFFF14',
    stripColor: '#07131F45',
  },
  storm: {
    gradient: ['#0D0B1A', '#1A1730', '#2A2450', '#3D3468'],
    glowColor: '#D3BCFF',
    glowColorAlt: '#7C63C8',
    decoration: 'lightning',
    pillColor: '#FFFFFF16',
    stripColor: '#06041245',
  },
  snow: {
    gradient: ['#3E5D75', '#5C7F9A', '#7F9DB0', '#8BA0AC'],
    glowColor: '#FFFFFF',
    glowColorAlt: '#D6EBF7',
    decoration: 'snow',
    pillColor: '#12384F26',
    stripColor: '#0C263726',
  },
  fog: {
    gradient: ['#454F59', '#5D6871', '#7C868E', '#969EA5'],
    glowColor: '#E8EDF1',
    glowColorAlt: '#B4BDC4',
    decoration: 'clouds',
    pillColor: '#FFFFFF18',
    stripColor: '#242A3040',
  },
};

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
/**
 * Describes how the air feels, which the sky-condition code cannot express:
 * 28 degrees at 92% humidity is "muggy", while 28 degrees at 30% is just warm.
 *
 * Uses apparent temperature (Open-Meteo's heat-index/wind-chill blend) as the
 * base, then names the dominant factor. Returns null in the comfortable middle
 * so the card stays quiet instead of stating the obvious.
 */
function describeFeel(
  feelsLike: number,
  humidity: number,
  windKph: number,
): string | null {
  const humid = humidity >= 70;
  const veryHumid = humidity >= 85;

  if (feelsLike >= 40) return veryHumid ? 'Dangerously hot & humid' : 'Dangerously hot';
  if (feelsLike >= 35) return humid ? 'Very hot & humid' : 'Very hot';
  if (feelsLike >= 30) return humid ? 'Hot & humid' : 'Hot';
  if (feelsLike >= 26) return veryHumid ? 'Warm & muggy' : humid ? 'Warm & humid' : 'Warm';
  if (feelsLike >= 18) {
    if (veryHumid) return 'Muggy';
    if (windKph >= 25) return 'Mild & breezy';
    return null;                       // genuinely pleasant — say nothing
  }
  if (feelsLike >= 10) return windKph >= 25 ? 'Cool & breezy' : 'Cool';
  if (feelsLike >= 3) return windKph >= 25 ? 'Cold & windy' : 'Chilly';
  if (feelsLike >= -5) return 'Cold';
  return 'Freezing';
}

/** Rain at or below this (mm, latest 15-min slot) can't justify a storm label. */
export const STORM_MIN_PRECIP_MM = 2.5;
/** Above this, precipitation is reported as showers rather than steady rain. */
const SHOWERS_MIN_PRECIP_MM = 2.5;
/** Below this, a reading counts as dry — sensor and model noise live here. */
const TRACE_PRECIP_MM = 0.1;

/**
 * The WMO code to actually display, reconciling the model's code against the
 * precipitation it reports alongside it.
 *
 * Two corrections, in order:
 *
 * 1. A storm code has to be earned by rainfall. In monsoon season ECMWF fires
 *    deep convection across a grid cell and reports 95-99 while producing only
 *    trace rain — measured at Lahore it returned 95 with 0.2mm, where Google
 *    said "light rain" and GFS, ICON and JMA reported no precipitation at all.
 *    Labelling light drizzle a thunderstorm is the most visible way to be
 *    wrong, so a storm is downgraded to the rain it actually is.
 * 2. Conversely, measured rain outranks a dry-looking code, because a user
 *    watching it rain will not accept "Clear".
 */
export function resolveCurrentCode(code: number, precipMm: number): number {
  // Storms first, on the raw model code: the rain override below rewrites
  // 95 to 61 whenever there's any precipitation, which would hide the
  // over-called storm rather than correct it.
  if (code >= 95) {
    // A storm backed by real rain is returned as-is. Without this the rain
    // override below would rewrite it to showers (80) and destroy the very
    // label the check above exists to protect.
    return precipMm > STORM_MIN_PRECIP_MM ? code
      : precipMm > TRACE_PRECIP_MM ? 61
      : 3;
  }
  if (precipMm > TRACE_PRECIP_MM) {
    return precipMm > SHOWERS_MIN_PRECIP_MM ? 80 : 61;
  }
  return code;
}

/** A whole day totalling less than this can't have been a thunderstorm day. */
const STORM_MIN_DAILY_PRECIP_MM = 2;

/**
 * Same storm sanity-check as `resolveCurrentCode`, for a daily summary.
 *
 * Kept separate because the thresholds aren't comparable: a daily figure is a
 * 24-hour accumulation, so it needs its own floor rather than the 15-min one.
 * A dry-coded day is left alone — a daily total says nothing about *when* it
 * fell, so it can't be used to promote a code the way a live reading can.
 */
export function resolveDailyCode(code: number, precipSumMm: number): number {
  if (code >= 95 && precipSumMm < STORM_MIN_DAILY_PRECIP_MM) {
    return precipSumMm > TRACE_PRECIP_MM ? 61 : 3;
  }
  return code;
}

/**
 * Maps a WMO weather code to a visual theme.
 *
 * Derived separately from decodeWeatherCode so the many condition branches
 * there don't each have to remember to set a theme — a mismatch would show the
 * wrong card art with no type error to catch it.
 */
function themeForCode(code: number, isDay: boolean, feelsLike = 20): WeatherTheme {
  if (code >= 95) return 'storm';                       // 95-99 thunderstorm
  if (code >= 85) return 'snow';                        // 85-86 snow showers
  if (code >= 80) return 'rain';                        // 80-82 rain showers
  if (code >= 71 && code <= 77) return 'snow';
  if (code === 66 || code === 67) return 'rain';        // freezing rain
  if (code >= 51 && code <= 65) return 'rain';          // drizzle + rain
  if (code === 45 || code === 48) return 'fog';
  if (code === 3) return 'overcast';
  if (code === 1 || code === 2) {
    // Partly cloudy needs a night variant. The daytime 'cloudy' palette is a
    // light blue-grey, which at 2am reads as an overcast afternoon.
    return isDay ? 'cloudy' : 'cloudy-night';
  }
  // code 0 (and anything unrecognised) falls back to a clear sky, which is the
  // safest default: it reads as "normal" rather than alarming.
  if (!isDay) return 'clear-night';
  // Warm palette above 32C apparent. The reference cards colour by how the
  // weather feels, not just what the sky is doing — a blue "pleasant" sky at
  // 40 degrees actively misinforms.
  return feelsLike >= 32 ? 'clear-hot' : 'clear-day';
}

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
export interface GeocodeResult {
  /** "City, Region" for display. */
  label: string;
  /** Neighbourhood / suburb when available, else null. */
  locality: string | null;
  /** Nearest street name, when the geocoder resolves one. */
  road: string | null;
}

// ─── City search ──────────────────────────────────────────────────────────────

export interface CityResult {
  id: number;
  /** City name, e.g. "Lahore". */
  name: string;
  /** Region/state, when the provider knows one. */
  admin1: string | null;
  country: string;
  countryCode: string | null;
  latitude: number;
  longitude: number;
}

/** Storage key for the user's manually chosen place, if any. */
const SAVED_PLACE_KEY = '@thinkora/weather_place';

export interface SavedPlace {
  name: string;
  latitude: number;
  longitude: number;
}

/**
 * Searches cities by (partial) name via Open-Meteo's geocoding API — no key,
 * handles prefixes, and returns coordinates directly, so a result can be fed
 * straight into the forecast call.
 */
export async function searchCities(
  query: string,
  signal?: AbortSignal,
): Promise<CityResult[]> {
  const q = query.trim();
  // Single characters return mostly noise and burn a request per keystroke.
  if (q.length < 2) return [];

  try {
    const url =
      `https://geocoding-api.open-meteo.com/v1/search` +
      `?name=${encodeURIComponent(q)}&count=10&language=en&format=json`;
    const r = await fetch(url, { signal });
    if (!r.ok) return [];
    const j = await r.json();
    const results: unknown[] = Array.isArray(j?.results) ? j.results : [];
    return results
      .map((raw) => {
        const x = raw as Record<string, any>;
        if (typeof x.latitude !== 'number' || typeof x.longitude !== 'number') return null;
        return {
          id: Number(x.id ?? `${x.latitude}${x.longitude}`),
          name: String(x.name ?? ''),
          admin1: x.admin1 ? String(x.admin1) : null,
          country: String(x.country ?? ''),
          countryCode: x.country_code ? String(x.country_code) : null,
          latitude: x.latitude,
          longitude: x.longitude,
        } as CityResult;
      })
      .filter((c): c is CityResult => c !== null && c.name.length > 0);
  } catch {
    return [];
  }
}

export interface CityPreview {
  temperature: number;
  condition: string;
  emoji: string;
  theme: WeatherTheme;
}

/**
 * Fetches current conditions for several coordinates in ONE request.
 *
 * Open-Meteo accepts comma-separated latitude/longitude lists and returns an
 * array, so N cities cost a single round trip (~0.8s for 5). That is what makes
 * it viable to show a live temperature on every search result rather than a
 * bare place name.
 *
 * Returns a map keyed by array index. Missing entries simply mean "no preview",
 * so the UI degrades to the plain row instead of failing.
 */
export async function fetchCityPreviews(
  coords: { latitude: number; longitude: number }[],
  signal?: AbortSignal,
): Promise<Map<number, CityPreview>> {
  const out = new Map<number, CityPreview>();
  if (coords.length === 0) return out;

  try {
    const lats = coords.map((c) => c.latitude).join(',');
    const lons = coords.map((c) => c.longitude).join(',');
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}` +
      // precipitation is needed to sanity-check an over-called storm code, the
      // same way the full fetch does — otherwise a search preview contradicts
      // the card for the very same place.
      `&current=temperature_2m,apparent_temperature,weather_code,is_day,precipitation` +
      `&cell_selection=nearest&timezone=auto`;
    const r = await fetch(url, { signal });
    if (!r.ok) return out;
    const j = await r.json();
    // A single coordinate returns an object, several return an array.
    const list: any[] = Array.isArray(j) ? j : [j];

    list.forEach((entry, i) => {
      const cur = entry?.current;
      if (!cur || typeof cur.temperature_2m !== 'number') return;
      const isDay = cur.is_day === 1;
      const code = resolveCurrentCode(
        Number(cur.weather_code ?? -1),
        Number(cur.precipitation ?? 0),
      );
      const decoded = decodeWeatherCode(code, isDay);
      out.set(i, {
        temperature: Math.round(cur.temperature_2m),
        condition: decoded.condition,
        emoji: decoded.emoji,
        theme: themeForCode(
          code,
          isDay,
          Math.round(Number(cur.apparent_temperature ?? cur.temperature_2m)),
        ),
      });
    });
  } catch {
    // Preview is a nicety — never let it break search.
  }
  return out;
}

/** Reads the manually selected place, or null to use GPS. */
export async function getSavedPlace(): Promise<SavedPlace | null> {
  try {
    const raw = await AsyncStorage.getItem(SAVED_PLACE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    return typeof p?.latitude === 'number' && typeof p?.longitude === 'number' ? p : null;
  } catch {
    return null;
  }
}

/**
 * Pins the forecast to a chosen city, or clears it to fall back to GPS.
 * Clears the weather cache too, so the next read reflects the new place rather
 * than serving the previous location's snapshot.
 */
export async function setSavedPlace(place: SavedPlace | null): Promise<void> {
  try {
    if (place) {
      await AsyncStorage.setItem(SAVED_PLACE_KEY, JSON.stringify(place));
    } else {
      await AsyncStorage.removeItem(SAVED_PLACE_KEY);
    }
    await AsyncStorage.removeItem(CACHE_KEY);
  } catch {
    // Non-fatal: the UI will just keep showing the previous place until reload.
  }
}

/** Formats a search result for display: "Lahore, Punjab, Pakistan". */
export function formatCity(c: CityResult): string {
  return [c.name, c.admin1, c.country].filter(Boolean).join(', ');
}

/**
 * Neighbourhood-level lookup via OpenStreetMap's Nominatim.
 *
 * BigDataCloud only resolves down to a tehsil/district ("Lahore Cantonment
 * Tehsil"), which is not what a user means by "my location". Nominatim returns
 * the actual neighbourhood ("Gulberg", "Rehman Park") plus the street.
 *
 * Kept as an enrichment rather than the primary source: Nominatim's usage policy
 * expects light traffic and it can be slow, so a failure here must never stop
 * the city name from resolving.
 */
async function fetchNeighbourhood(
  lat: number,
  lon: number,
  signal?: AbortSignal,
): Promise<{ locality: string | null; road: string | null }> {
  try {
    const url =
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}` +
      // zoom=16 is the neighbourhood level; deeper returns building numbers.
      `&format=json&zoom=16&addressdetails=1&accept-language=en`;
    const r = await fetch(url, {
      signal,
      // Nominatim requires an identifying User-Agent and rejects requests
      // without one.
      headers: { 'User-Agent': 'Thinkora/1.3 (weather locality)' },
    });
    if (!r.ok) return { locality: null, road: null };
    const j = await r.json();
    const a = j?.address ?? {};
    const locality =
      a.neighbourhood ||
      a.suburb ||
      a.quarter ||
      a.residential ||
      a.city_district ||
      null;
    return { locality, road: a.road ?? null };
  } catch {
    return { locality: null, road: null };
  }
}

async function reverseGeocode(
  lat: number,
  lon: number,
  signal?: AbortSignal,
): Promise<GeocodeResult> {
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

      // Prefer the finest administrative name available for the locality line.
      // BigDataCloud nests these deepest-last, so walk from the end.
      const admin: unknown[] = Array.isArray(j?.localityInfo?.administrative)
        ? j.localityInfo.administrative
        : [];
      let locality: string | null = null;
      for (let i = admin.length - 1; i >= 0; i--) {
        const name = (admin[i] as { name?: string })?.name;
        // Skip anything that just repeats the city or region.
        if (name && name !== city && name !== region) {
          locality = name;
          break;
        }
      }
      if (!locality && j?.locality && j.locality !== city) {
        locality = j.locality;
      }

      if (city) {
        // Prefer a real neighbourhood over BigDataCloud's tehsil/district,
        // which is what makes this read as "where I am" rather than "which
        // administrative unit I'm in".
        const fine = await fetchNeighbourhood(lat, lon, signal);
        return {
          label: region && region !== city ? `${city}, ${region}` : city,
          locality: fine.locality ?? locality,
          road: fine.road,
        };
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
        return {
          label:
            place.admin1 && place.admin1 !== place.name
              ? `${place.name}, ${place.admin1}`
              : place.name,
          locality: place.admin2 && place.admin2 !== place.name ? place.admin2 : null,
          road: null,
        };
      }
    }
  } catch {
    // fall through
  }

  return { label: 'Current location', locality: null, road: null };
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
): Promise<
  // Place and coordinate fields are the caller's to supply — this function only
  // knows the forecast, not where the user is or what that place is called.
  Omit<
    WeatherSnapshot,
    | 'locationLabel'
    | 'localityLabel'
    | 'roadLabel'
    | 'latitude'
    | 'longitude'
    | 'fetchedAt'
  >
> {
  // Request:
  //  - current: hourly snapshot (temp, humidity, wind, gust, weather code)
  //  - minutely_15: 15-min-resolution precipitation/weather/wind for "rain now"
  //  - daily: today's high/low
  // cell_selection=nearest avoids interpolation that can smooth out localized
  // rain. timezone=auto so all timestamps come back in the user's local time.
  //
  // models=ecmwf_ifs025 rather than Open-Meteo's default `best_match`.
  // `best_match` blends regional models and, when validated against Google and
  // other consumer apps, disagreed on the sky condition — reporting "Overcast"
  // while Google, ECMWF and GFS all reported "Clear". Measured against Google
  // for the same coordinates, ECMWF was closest on every field (temp within
  // 0.4C, humidity within 8%, apparent temp within 0.1C) and matched the
  // condition. ECMWF is also the strongest global model overall, so this
  // reduces the "why doesn't this match my phone's weather app" mismatch.
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&models=ecmwf_ifs025` +
    `&current=temperature_2m,apparent_temperature,is_day,weather_code,` +
    `relative_humidity_2m,wind_speed_10m,wind_gusts_10m,precipitation` +
    `&minutely_15=weather_code,precipitation,wind_speed_10m` +
    // precipitation on both so an over-called storm code is corrected in the
    // forecast rows too, not just the current reading.
    `&hourly=temperature_2m,weather_code,is_day,precipitation` +
    `&daily=temperature_2m_max,temperature_2m_min,weather_code,` +
    `precipitation_probability_max,precipitation_sum,sunrise,sunset,uv_index_max` +
    // 10 days for the detail screen's extended forecast. ECMWF publishes out
    // to 15, but accuracy past ~10 days is poor enough that showing it would
    // be misleading.
    `&forecast_days=10&forecast_minutely_15=4` +
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
  const currentPrecip = Number(cur.precipitation ?? 0);
  const rawCode = Number.isFinite(slotCode) && slotCode >= 0 ? slotCode : hourlyCode;
  const effectiveCode = resolveCurrentCode(
    rawCode,
    Math.max(slotPrecip, currentPrecip),
  );

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
    // 24 hours, not 6: the detail screen shows a full day's scroll. The card
    // slices the first few itself, so a bigger array costs it nothing.
    for (let i = startIdx; i < hourly.time.length && hourlySlots.length < 24; i++) {
      const ts = Date.parse(hourly.time[i]);
      if (Number.isNaN(ts)) continue;
      // Skip past hours other than the current one
      if (ts < now - 3_600_000) continue;
      // Hourly totals accumulate over 60 minutes rather than 15, so the storm
      // floor scales with the window — otherwise every wet hour would clear a
      // 15-min threshold and no over-called storm would ever be caught.
      const code = resolveCurrentCode(
        Number(hourly.weather_code?.[i] ?? -1),
        Number(hourly.precipitation?.[i] ?? 0) / 4,
      );
      const slotIsDay = hourly.is_day?.[i] === 1;
      const dec = decodeWeatherCode(code, slotIsDay);
      hourlySlots.push({
        ts,
        // Kept to one decimal rather than rounded to a whole degree. On a mild
        // night the real spread across five hours can be ~1 degree, and
        // rounding collapses 28.4/28.0/27.7/27.5 into an identical-looking
        // "28, 28, 28, 28" that reads as broken rather than as stable weather.
        temperature: Math.round(Number(hourly.temperature_2m?.[i] ?? 0) * 10) / 10,
        emoji: dec.emoji,
        isDay: slotIsDay,
      });
    }
  }

  const feelsLike = Math.round(Number(cur.apparent_temperature ?? cur.temperature_2m ?? 0));
  const humidity = Math.round(Number(cur.relative_humidity_2m ?? 0));

  // ── Daily forecast ────────────────────────────────────────────────────────
  const dailySlots: DailySlot[] = [];
  if (Array.isArray(daily.time)) {
    for (let i = 0; i < daily.time.length && dailySlots.length < 10; i++) {
      const ts = Date.parse(`${daily.time[i]}T00:00:00`);
      if (Number.isNaN(ts)) continue;
      const dayCode = resolveDailyCode(
        Number(daily.weather_code?.[i] ?? -1),
        Number(daily.precipitation_sum?.[i] ?? 0),
      );
      // Daily summaries always describe daytime, so decode with isDay=true —
      // otherwise a clear day would render with a moon glyph.
      const dayDecoded = decodeWeatherCode(dayCode, true);
      dailySlots.push({
        ts,
        high: Math.round(Number(daily.temperature_2m_max?.[i] ?? 0)),
        low: Math.round(Number(daily.temperature_2m_min?.[i] ?? 0)),
        emoji: dayDecoded.emoji,
        condition: dayDecoded.condition,
        precipChance: Math.round(Number(daily.precipitation_probability_max?.[i] ?? 0)),
      });
    }
  }

  const parseStamp = (v: unknown): number | null => {
    if (typeof v !== 'string') return null;
    const t = Date.parse(v);
    return Number.isNaN(t) ? null : t;
  };

  return {
    temperature: Math.round(Number(cur.temperature_2m ?? 0)),
    feelsLike,
    highToday: Math.round(Number(daily.temperature_2m_max?.[0] ?? cur.temperature_2m ?? 0)),
    lowToday: Math.round(Number(daily.temperature_2m_min?.[0] ?? cur.temperature_2m ?? 0)),
    windKph,
    windGustKph,
    humidity,
    precipMm: Math.round(Math.max(slotPrecip, currentPrecip) * 10) / 10,
    hourly: hourlySlots,
    daily: dailySlots,
    sunrise: parseStamp(daily.sunrise?.[0]),
    sunset: parseStamp(daily.sunset?.[0]),
    uvIndex:
      daily.uv_index_max?.[0] === undefined || daily.uv_index_max?.[0] === null
        ? null
        : Math.round(Number(daily.uv_index_max[0]) * 10) / 10,
    precipChance: Math.round(Number(daily.precipitation_probability_max?.[0] ?? 0)),
    isDay,
    isWindy: windKph >= 25,
    condition: decoded.condition,
    theme: themeForCode(effectiveCode, isDay, feelsLike),
    feelsLabel: describeFeel(feelsLike, humidity, windKph),
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

  // A manually chosen city wins over GPS. This also means the forecast keeps
  // working when location permission is denied — the user can just pick a place.
  const saved = await getSavedPlace();
  const pos = saved
    ? { latitude: saved.latitude, longitude: saved.longitude }
    : await getCurrentLocation();
  if (!pos) return null;

  try {
    const [weather, place] = await Promise.all([
      fetchOpenMeteo(pos.latitude, pos.longitude, signal),
      reverseGeocode(pos.latitude, pos.longitude, signal),
    ]);
    const snapshot: WeatherSnapshot = {
      ...weather,
      // Prefer the name the user picked: a search for "London, Ontario" should
      // not be relabelled by whatever the reverse geocoder calls those coords.
      locationLabel: saved ? saved.name : place.label,
      localityLabel: saved ? null : place.locality,
      roadLabel: saved ? null : place.road,
      latitude: pos.latitude,
      longitude: pos.longitude,
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
