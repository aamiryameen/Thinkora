/**
 * Holiday service — fetches public holidays for a country from the
 * free Nager.Date API (https://date.nager.at). No API key required.
 *
 * Strategy
 *  • Fetch is keyed by `${countryCode}-${year}` and cached in AsyncStorage
 *    so the calendar works offline once a country/year has been seen.
 *  • Cache TTL is 30 days. Holidays for past/future years are stable, so a
 *    long TTL keeps network usage minimal.
 *  • `getHolidays` always returns immediately from cache when available
 *    and refreshes in the background.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { BUNDLED_COUNTRY_CODES, getBundledHolidays } from './bundledHolidays';

export interface Holiday {
  /** "YYYY-MM-DD" in the country's local date. */
  date: string;
  /** English name (e.g. "Christmas Day"). */
  name: string;
  /** Localized name when provided by the API; falls back to `name`. */
  localName: string;
  /** ISO 3166-1 alpha-2 country code. */
  countryCode: string;
  /** True for fixed-date holidays (e.g. Jan 1); false for moving feasts. */
  fixed: boolean;
  /** True for global holidays (e.g. New Year), false for regional. */
  global: boolean;
  /** Holiday types reported by the API. */
  types: string[];
}

interface CacheEntry {
  fetchedAt: number;
  holidays: Holiday[];
}

const CACHE_PREFIX = '@thinkora/holidays_v1';
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const API_BASE = 'https://date.nager.at/api/v3';

/** Countries shown in the picker. Most use the Nager.Date API; a few
 *  (Pakistan, India, Saudi Arabia, UAE, Bangladesh) are served from a
 *  bundled list because Nager doesn't cover Islamic-calendar holidays.
 *  See `bundledHolidays.ts` for which codes are bundled. */
export const SUPPORTED_COUNTRIES: { code: string; name: string }[] = [
  { code: 'AD', name: 'Andorra' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'AL', name: 'Albania' },
  { code: 'AM', name: 'Armenia' },
  { code: 'AR', name: 'Argentina' },
  { code: 'AT', name: 'Austria' },
  { code: 'AU', name: 'Australia' },
  { code: 'AX', name: 'Åland Islands' },
  { code: 'BA', name: 'Bosnia and Herzegovina' },
  { code: 'BB', name: 'Barbados' },
  { code: 'BD', name: 'Bangladesh' },
  { code: 'BE', name: 'Belgium' },
  { code: 'BG', name: 'Bulgaria' },
  { code: 'BJ', name: 'Benin' },
  { code: 'BO', name: 'Bolivia' },
  { code: 'BR', name: 'Brazil' },
  { code: 'BS', name: 'Bahamas' },
  { code: 'BW', name: 'Botswana' },
  { code: 'BY', name: 'Belarus' },
  { code: 'BZ', name: 'Belize' },
  { code: 'CA', name: 'Canada' },
  { code: 'CD', name: 'DR Congo' },
  { code: 'CG', name: 'Congo' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'CL', name: 'Chile' },
  { code: 'CN', name: 'China' },
  { code: 'CO', name: 'Colombia' },
  { code: 'CR', name: 'Costa Rica' },
  { code: 'CU', name: 'Cuba' },
  { code: 'CY', name: 'Cyprus' },
  { code: 'CZ', name: 'Czechia' },
  { code: 'DE', name: 'Germany' },
  { code: 'DK', name: 'Denmark' },
  { code: 'DO', name: 'Dominican Republic' },
  { code: 'EC', name: 'Ecuador' },
  { code: 'EE', name: 'Estonia' },
  { code: 'EG', name: 'Egypt' },
  { code: 'ES', name: 'Spain' },
  { code: 'FI', name: 'Finland' },
  { code: 'FO', name: 'Faroe Islands' },
  { code: 'FR', name: 'France' },
  { code: 'GA', name: 'Gabon' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'GD', name: 'Grenada' },
  { code: 'GE', name: 'Georgia' },
  { code: 'GG', name: 'Guernsey' },
  { code: 'GH', name: 'Ghana' },
  { code: 'GI', name: 'Gibraltar' },
  { code: 'GL', name: 'Greenland' },
  { code: 'GM', name: 'Gambia' },
  { code: 'GR', name: 'Greece' },
  { code: 'GT', name: 'Guatemala' },
  { code: 'GY', name: 'Guyana' },
  { code: 'HK', name: 'Hong Kong' },
  { code: 'HN', name: 'Honduras' },
  { code: 'HR', name: 'Croatia' },
  { code: 'HT', name: 'Haiti' },
  { code: 'HU', name: 'Hungary' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'IE', name: 'Ireland' },
  { code: 'IM', name: 'Isle of Man' },
  { code: 'IN', name: 'India' },
  { code: 'IS', name: 'Iceland' },
  { code: 'IT', name: 'Italy' },
  { code: 'JE', name: 'Jersey' },
  { code: 'JM', name: 'Jamaica' },
  { code: 'JP', name: 'Japan' },
  { code: 'KE', name: 'Kenya' },
  { code: 'KR', name: 'South Korea' },
  { code: 'KZ', name: 'Kazakhstan' },
  { code: 'LI', name: 'Liechtenstein' },
  { code: 'LS', name: 'Lesotho' },
  { code: 'LT', name: 'Lithuania' },
  { code: 'LU', name: 'Luxembourg' },
  { code: 'LV', name: 'Latvia' },
  { code: 'MA', name: 'Morocco' },
  { code: 'MC', name: 'Monaco' },
  { code: 'MD', name: 'Moldova' },
  { code: 'ME', name: 'Montenegro' },
  { code: 'MG', name: 'Madagascar' },
  { code: 'MK', name: 'North Macedonia' },
  { code: 'MN', name: 'Mongolia' },
  { code: 'MS', name: 'Montserrat' },
  { code: 'MT', name: 'Malta' },
  { code: 'MX', name: 'Mexico' },
  { code: 'MZ', name: 'Mozambique' },
  { code: 'NA', name: 'Namibia' },
  { code: 'NE', name: 'Niger' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'NI', name: 'Nicaragua' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'NO', name: 'Norway' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'PA', name: 'Panama' },
  { code: 'PE', name: 'Peru' },
  { code: 'PG', name: 'Papua New Guinea' },
  { code: 'PH', name: 'Philippines' },
  { code: 'PK', name: 'Pakistan' },
  { code: 'PL', name: 'Poland' },
  { code: 'PR', name: 'Puerto Rico' },
  { code: 'PT', name: 'Portugal' },
  { code: 'PY', name: 'Paraguay' },
  { code: 'RO', name: 'Romania' },
  { code: 'RS', name: 'Serbia' },
  { code: 'RU', name: 'Russia' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'SC', name: 'Seychelles' },
  { code: 'SE', name: 'Sweden' },
  { code: 'SG', name: 'Singapore' },
  { code: 'SI', name: 'Slovenia' },
  { code: 'SJ', name: 'Svalbard and Jan Mayen' },
  { code: 'SK', name: 'Slovakia' },
  { code: 'SM', name: 'San Marino' },
  { code: 'SR', name: 'Suriname' },
  { code: 'SV', name: 'El Salvador' },
  { code: 'TN', name: 'Tunisia' },
  { code: 'TR', name: 'Türkiye' },
  { code: 'UA', name: 'Ukraine' },
  { code: 'UG', name: 'Uganda' },
  { code: 'US', name: 'United States' },
  { code: 'UY', name: 'Uruguay' },
  { code: 'VA', name: 'Vatican City' },
  { code: 'VE', name: 'Venezuela' },
  { code: 'VN', name: 'Vietnam' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'ZW', name: 'Zimbabwe' },
];

const COUNTRY_CODE_SET = new Set(SUPPORTED_COUNTRIES.map((c) => c.code));

/** Resolve a country code label for UI. Returns the code itself if unknown. */
export function countryName(code: string): string {
  return SUPPORTED_COUNTRIES.find((c) => c.code === code)?.name ?? code;
}

/** Best-effort country detection from the device locale.
 *  Uses Intl when available, then falls back to react-native-device-info,
 *  finally `PK`. Always returns a value in `SUPPORTED_COUNTRIES`. */
export function detectDeviceCountry(): string {
  try {
    // Intl.Locale().region works on RN 0.72+ with Hermes Intl enabled.
    const intlAny = (globalThis as any).Intl;
    if (intlAny?.Locale) {
      const lang = intlAny.DateTimeFormat?.().resolvedOptions?.()?.locale ?? 'en-US';
      const region = new intlAny.Locale(lang).maximize?.()?.region;
      if (region && COUNTRY_CODE_SET.has(region)) return region;
    }
  } catch {
    // ignore — fall through to device-info
  }
  try {
    const DeviceInfo = require('react-native-device-info').default
      ?? require('react-native-device-info');
    const c = (DeviceInfo.getDeviceCountrySync?.() ?? DeviceInfo.getCountry?.() ?? '') as string;
    const upper = c.toUpperCase();
    if (upper && COUNTRY_CODE_SET.has(upper)) return upper;
  } catch {
    // ignore
  }
  return 'PK';
}

function cacheKey(country: string, year: number): string {
  return `${CACHE_PREFIX}/${country}/${year}`;
}

async function readCache(country: string, year: number): Promise<CacheEntry | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(country, year));
    if (!raw) return null;
    return JSON.parse(raw) as CacheEntry;
  } catch {
    return null;
  }
}

async function writeCache(country: string, year: number, holidays: Holiday[]): Promise<void> {
  const entry: CacheEntry = { fetchedAt: Date.now(), holidays };
  try {
    await AsyncStorage.setItem(cacheKey(country, year), JSON.stringify(entry));
  } catch {
    // non-fatal
  }
}

interface NagerHolidayResponse {
  date: string;
  localName: string;
  name: string;
  countryCode: string;
  fixed: boolean;
  global: boolean;
  types?: string[];
}

async function fetchFromApi(country: string, year: number, signal?: AbortSignal): Promise<Holiday[]> {
  const url = `${API_BASE}/PublicHolidays/${year}/${encodeURIComponent(country)}`;
  const r = await fetch(url, { signal });
  // Nager returns 204 (No Content) for countries it doesn't cover.
  if (r.status === 204) return [];
  if (!r.ok) throw new Error(`Holiday API HTTP ${r.status}`);
  const json = (await r.json()) as NagerHolidayResponse[];
  return json.map((h) => ({
    date: h.date,
    name: h.name,
    localName: h.localName ?? h.name,
    countryCode: h.countryCode,
    fixed: !!h.fixed,
    global: !!h.global,
    types: h.types ?? [],
  }));
}

/**
 * Get holidays for a country/year. Bundled countries (Pakistan, India, Saudi
 * Arabia, UAE, Bangladesh — Nager.Date doesn't cover them) come from the
 * bundled JSON. For everything else: cache-first with a network refresh,
 * falling back to stale cache if the API is unreachable.
 */
export async function getHolidays(country: string, year: number): Promise<Holiday[]> {
  if (BUNDLED_COUNTRY_CODES.has(country)) {
    return getBundledHolidays(country, year);
  }

  const cached = await readCache(country, year);
  const isFresh = cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS;

  if (cached && isFresh) return cached.holidays;

  try {
    const fresh = await fetchFromApi(country, year);
    await writeCache(country, year, fresh);
    return fresh;
  } catch (err) {
    if (cached) return cached.holidays;
    throw err;
  }
}

/** Convenience: get holidays for current + next year, deduped & sorted by date. */
export async function getHolidaysForRange(country: string, fromYear: number, toYear: number): Promise<Holiday[]> {
  const years: number[] = [];
  for (let y = fromYear; y <= toYear; y++) years.push(y);
  const lists = await Promise.all(years.map((y) => getHolidays(country, y).catch(() => [] as Holiday[])));
  const all = lists.flat();
  // Dedup by date+name (some APIs may have duplicates across years)
  const seen = new Set<string>();
  const out: Holiday[] = [];
  for (const h of all) {
    const k = `${h.date}|${h.name}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(h);
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

/** Group holidays by "YYYY-MM-DD" date key for fast calendar lookup. */
export function groupHolidaysByDate(holidays: Holiday[]): Map<string, Holiday[]> {
  const m = new Map<string, Holiday[]>();
  for (const h of holidays) {
    const list = m.get(h.date) ?? [];
    list.push(h);
    m.set(h.date, list);
  }
  return m;
}
