/**
 * Bundled holiday data for countries the Nager.Date API doesn't cover
 * (notably Pakistan, India, Saudi Arabia, UAE, Bangladesh — most Islamic-
 * calendar countries, plus some others where Nager has gaps).
 *
 * Islamic / lunar dates are observation-based and may shift ±1 day on
 * announcement. We use the officially-announced or astronomically-projected
 * dates from each country's gazetted calendar for 2025–2027.
 *
 * Sources
 *  • Pakistan: Cabinet Division Notification of Public Holidays
 *  • India:    Department of Personnel & Training "Gazetted Holidays" list
 *  • Saudi Arabia / UAE: Royal / Federal Authority for Government HR
 *  • Bangladesh: Ministry of Public Administration
 */

import type { Holiday } from './holidayService';

/** Country codes that should be served from the bundled list instead of the API. */
export const BUNDLED_COUNTRY_CODES = new Set(['PK', 'IN', 'SA', 'AE', 'BD']);

interface BundledEntry {
  date: string; // "YYYY-MM-DD"
  name: string;
  localName?: string;
}

const BUNDLED: Record<string, Record<number, BundledEntry[]>> = {
  // ── Pakistan ─────────────────────────────────────────────────────────────
  PK: {
    2025: [
      { date: '2025-02-05', name: 'Kashmir Solidarity Day' },
      { date: '2025-03-23', name: 'Pakistan Day' },
      { date: '2025-03-31', name: 'Eid ul-Fitr', localName: 'Eid-ul-Fitr' },
      { date: '2025-04-01', name: 'Eid ul-Fitr Holiday' },
      { date: '2025-04-02', name: 'Eid ul-Fitr Holiday' },
      { date: '2025-05-01', name: 'Labour Day' },
      { date: '2025-06-07', name: 'Eid ul-Adha', localName: 'Eid-ul-Azha' },
      { date: '2025-06-08', name: 'Eid ul-Adha Holiday' },
      { date: '2025-06-09', name: 'Eid ul-Adha Holiday' },
      { date: '2025-07-06', name: 'Ashura (9th Muharram)' },
      { date: '2025-07-07', name: 'Ashura (10th Muharram)' },
      { date: '2025-08-14', name: 'Independence Day' },
      { date: '2025-09-05', name: 'Eid Milad un-Nabi', localName: 'Eid Milad-un-Nabi' },
      { date: '2025-11-09', name: 'Iqbal Day' },
      { date: '2025-12-25', name: 'Quaid-e-Azam Day / Christmas' },
    ],
    2026: [
      { date: '2026-02-05', name: 'Kashmir Solidarity Day' },
      { date: '2026-03-21', name: 'Eid ul-Fitr', localName: 'Eid-ul-Fitr' },
      { date: '2026-03-22', name: 'Eid ul-Fitr Holiday' },
      { date: '2026-03-23', name: 'Pakistan Day' },
      { date: '2026-05-01', name: 'Labour Day' },
      { date: '2026-05-27', name: 'Eid ul-Adha', localName: 'Eid-ul-Azha' },
      { date: '2026-05-28', name: 'Eid ul-Adha Holiday' },
      { date: '2026-05-29', name: 'Eid ul-Adha Holiday' },
      { date: '2026-06-25', name: 'Ashura (9th Muharram)' },
      { date: '2026-06-26', name: 'Ashura (10th Muharram)' },
      { date: '2026-08-14', name: 'Independence Day' },
      { date: '2026-08-25', name: 'Eid Milad un-Nabi' },
      { date: '2026-11-09', name: 'Iqbal Day' },
      { date: '2026-12-25', name: 'Quaid-e-Azam Day / Christmas' },
    ],
    2027: [
      { date: '2027-02-05', name: 'Kashmir Solidarity Day' },
      { date: '2027-03-10', name: 'Eid ul-Fitr', localName: 'Eid-ul-Fitr' },
      { date: '2027-03-11', name: 'Eid ul-Fitr Holiday' },
      { date: '2027-03-12', name: 'Eid ul-Fitr Holiday' },
      { date: '2027-03-23', name: 'Pakistan Day' },
      { date: '2027-05-01', name: 'Labour Day' },
      { date: '2027-05-17', name: 'Eid ul-Adha', localName: 'Eid-ul-Azha' },
      { date: '2027-05-18', name: 'Eid ul-Adha Holiday' },
      { date: '2027-06-14', name: 'Ashura (9th Muharram)' },
      { date: '2027-06-15', name: 'Ashura (10th Muharram)' },
      { date: '2027-08-14', name: 'Independence Day' },
      { date: '2027-08-15', name: 'Eid Milad un-Nabi' },
      { date: '2027-11-09', name: 'Iqbal Day' },
      { date: '2027-12-25', name: 'Quaid-e-Azam Day / Christmas' },
    ],
  },

  // ── India (DoPT gazetted holidays) ──────────────────────────────────────
  IN: {
    2025: [
      { date: '2025-01-26', name: 'Republic Day' },
      { date: '2025-03-14', name: 'Holi' },
      { date: '2025-03-31', name: 'Eid ul-Fitr' },
      { date: '2025-04-10', name: 'Mahavir Jayanti' },
      { date: '2025-04-18', name: 'Good Friday' },
      { date: '2025-05-12', name: 'Buddha Purnima' },
      { date: '2025-06-07', name: 'Eid ul-Adha (Bakrid)' },
      { date: '2025-07-06', name: 'Muharram' },
      { date: '2025-08-15', name: 'Independence Day' },
      { date: '2025-08-16', name: 'Janmashtami' },
      { date: '2025-09-05', name: 'Milad un-Nabi' },
      { date: '2025-10-02', name: 'Gandhi Jayanti' },
      { date: '2025-10-02', name: 'Dussehra' },
      { date: '2025-10-20', name: 'Diwali' },
      { date: '2025-11-05', name: 'Guru Nanak Jayanti' },
      { date: '2025-12-25', name: 'Christmas Day' },
    ],
    2026: [
      { date: '2026-01-26', name: 'Republic Day' },
      { date: '2026-03-04', name: 'Holi' },
      { date: '2026-03-21', name: 'Eid ul-Fitr' },
      { date: '2026-03-31', name: 'Mahavir Jayanti' },
      { date: '2026-04-03', name: 'Good Friday' },
      { date: '2026-05-01', name: 'Buddha Purnima' },
      { date: '2026-05-27', name: 'Eid ul-Adha (Bakrid)' },
      { date: '2026-06-26', name: 'Muharram' },
      { date: '2026-08-15', name: 'Independence Day' },
      { date: '2026-09-04', name: 'Janmashtami' },
      { date: '2026-08-25', name: 'Milad un-Nabi' },
      { date: '2026-10-02', name: 'Gandhi Jayanti' },
      { date: '2026-10-20', name: 'Dussehra' },
      { date: '2026-11-08', name: 'Diwali' },
      { date: '2026-11-24', name: 'Guru Nanak Jayanti' },
      { date: '2026-12-25', name: 'Christmas Day' },
    ],
    2027: [
      { date: '2027-01-26', name: 'Republic Day' },
      { date: '2027-03-22', name: 'Holi' },
      { date: '2027-03-10', name: 'Eid ul-Fitr' },
      { date: '2027-03-26', name: 'Good Friday' },
      { date: '2027-05-20', name: 'Buddha Purnima' },
      { date: '2027-05-17', name: 'Eid ul-Adha (Bakrid)' },
      { date: '2027-06-15', name: 'Muharram' },
      { date: '2027-08-15', name: 'Independence Day' },
      { date: '2027-08-25', name: 'Janmashtami' },
      { date: '2027-08-15', name: 'Milad un-Nabi' },
      { date: '2027-10-02', name: 'Gandhi Jayanti' },
      { date: '2027-10-09', name: 'Dussehra' },
      { date: '2027-10-28', name: 'Diwali' },
      { date: '2027-11-13', name: 'Guru Nanak Jayanti' },
      { date: '2027-12-25', name: 'Christmas Day' },
    ],
  },

  // ── Saudi Arabia ─────────────────────────────────────────────────────────
  SA: {
    2025: [
      { date: '2025-02-22', name: 'Foundation Day' },
      { date: '2025-03-30', name: 'Eid al-Fitr' },
      { date: '2025-03-31', name: 'Eid al-Fitr Holiday' },
      { date: '2025-04-01', name: 'Eid al-Fitr Holiday' },
      { date: '2025-04-02', name: 'Eid al-Fitr Holiday' },
      { date: '2025-06-05', name: 'Arafat Day' },
      { date: '2025-06-06', name: 'Eid al-Adha' },
      { date: '2025-06-07', name: 'Eid al-Adha Holiday' },
      { date: '2025-06-08', name: 'Eid al-Adha Holiday' },
      { date: '2025-09-23', name: 'National Day' },
    ],
    2026: [
      { date: '2026-02-22', name: 'Foundation Day' },
      { date: '2026-03-20', name: 'Eid al-Fitr' },
      { date: '2026-03-21', name: 'Eid al-Fitr Holiday' },
      { date: '2026-03-22', name: 'Eid al-Fitr Holiday' },
      { date: '2026-05-26', name: 'Arafat Day' },
      { date: '2026-05-27', name: 'Eid al-Adha' },
      { date: '2026-05-28', name: 'Eid al-Adha Holiday' },
      { date: '2026-05-29', name: 'Eid al-Adha Holiday' },
      { date: '2026-09-23', name: 'National Day' },
    ],
    2027: [
      { date: '2027-02-22', name: 'Foundation Day' },
      { date: '2027-03-09', name: 'Eid al-Fitr' },
      { date: '2027-03-10', name: 'Eid al-Fitr Holiday' },
      { date: '2027-05-16', name: 'Arafat Day' },
      { date: '2027-05-17', name: 'Eid al-Adha' },
      { date: '2027-05-18', name: 'Eid al-Adha Holiday' },
      { date: '2027-09-23', name: 'National Day' },
    ],
  },

  // ── United Arab Emirates ─────────────────────────────────────────────────
  AE: {
    2025: [
      { date: '2025-01-01', name: "New Year's Day" },
      { date: '2025-03-30', name: 'Eid al-Fitr' },
      { date: '2025-03-31', name: 'Eid al-Fitr Holiday' },
      { date: '2025-04-01', name: 'Eid al-Fitr Holiday' },
      { date: '2025-06-05', name: 'Arafat Day' },
      { date: '2025-06-06', name: 'Eid al-Adha' },
      { date: '2025-06-07', name: 'Eid al-Adha Holiday' },
      { date: '2025-06-08', name: 'Eid al-Adha Holiday' },
      { date: '2025-06-26', name: 'Islamic New Year' },
      { date: '2025-09-04', name: 'Prophet Muhammad’s Birthday' },
      { date: '2025-12-02', name: 'National Day' },
      { date: '2025-12-03', name: 'National Day Holiday' },
    ],
    2026: [
      { date: '2026-01-01', name: "New Year's Day" },
      { date: '2026-03-20', name: 'Eid al-Fitr' },
      { date: '2026-03-21', name: 'Eid al-Fitr Holiday' },
      { date: '2026-05-26', name: 'Arafat Day' },
      { date: '2026-05-27', name: 'Eid al-Adha' },
      { date: '2026-05-28', name: 'Eid al-Adha Holiday' },
      { date: '2026-05-29', name: 'Eid al-Adha Holiday' },
      { date: '2026-06-16', name: 'Islamic New Year' },
      { date: '2026-08-25', name: 'Prophet Muhammad’s Birthday' },
      { date: '2026-12-02', name: 'National Day' },
      { date: '2026-12-03', name: 'National Day Holiday' },
    ],
    2027: [
      { date: '2027-01-01', name: "New Year's Day" },
      { date: '2027-03-09', name: 'Eid al-Fitr' },
      { date: '2027-03-10', name: 'Eid al-Fitr Holiday' },
      { date: '2027-05-16', name: 'Arafat Day' },
      { date: '2027-05-17', name: 'Eid al-Adha' },
      { date: '2027-05-18', name: 'Eid al-Adha Holiday' },
      { date: '2027-06-06', name: 'Islamic New Year' },
      { date: '2027-08-15', name: 'Prophet Muhammad’s Birthday' },
      { date: '2027-12-02', name: 'National Day' },
      { date: '2027-12-03', name: 'National Day Holiday' },
    ],
  },

  // ── Bangladesh ───────────────────────────────────────────────────────────
  BD: {
    2025: [
      { date: '2025-02-21', name: 'Language Martyrs Day' },
      { date: '2025-03-26', name: 'Independence Day' },
      { date: '2025-03-31', name: 'Eid ul-Fitr' },
      { date: '2025-04-01', name: 'Eid ul-Fitr Holiday' },
      { date: '2025-04-02', name: 'Eid ul-Fitr Holiday' },
      { date: '2025-04-14', name: 'Bengali New Year' },
      { date: '2025-05-01', name: 'May Day' },
      { date: '2025-06-07', name: 'Eid ul-Adha' },
      { date: '2025-06-08', name: 'Eid ul-Adha Holiday' },
      { date: '2025-08-15', name: 'National Mourning Day' },
      { date: '2025-09-05', name: 'Eid-e-Milad-un-Nabi' },
      { date: '2025-12-16', name: 'Victory Day' },
      { date: '2025-12-25', name: 'Christmas Day' },
    ],
    2026: [
      { date: '2026-02-21', name: 'Language Martyrs Day' },
      { date: '2026-03-21', name: 'Eid ul-Fitr' },
      { date: '2026-03-22', name: 'Eid ul-Fitr Holiday' },
      { date: '2026-03-26', name: 'Independence Day' },
      { date: '2026-04-14', name: 'Bengali New Year' },
      { date: '2026-05-01', name: 'May Day' },
      { date: '2026-05-27', name: 'Eid ul-Adha' },
      { date: '2026-05-28', name: 'Eid ul-Adha Holiday' },
      { date: '2026-08-15', name: 'National Mourning Day' },
      { date: '2026-08-25', name: 'Eid-e-Milad-un-Nabi' },
      { date: '2026-12-16', name: 'Victory Day' },
      { date: '2026-12-25', name: 'Christmas Day' },
    ],
    2027: [
      { date: '2027-02-21', name: 'Language Martyrs Day' },
      { date: '2027-03-10', name: 'Eid ul-Fitr' },
      { date: '2027-03-26', name: 'Independence Day' },
      { date: '2027-04-14', name: 'Bengali New Year' },
      { date: '2027-05-01', name: 'May Day' },
      { date: '2027-05-17', name: 'Eid ul-Adha' },
      { date: '2027-08-15', name: 'National Mourning Day' },
      { date: '2027-08-15', name: 'Eid-e-Milad-un-Nabi' },
      { date: '2027-12-16', name: 'Victory Day' },
      { date: '2027-12-25', name: 'Christmas Day' },
    ],
  },
};

export function getBundledHolidays(country: string, year: number): Holiday[] {
  const yearMap = BUNDLED[country];
  if (!yearMap) return [];
  const list = yearMap[year];
  if (!list) return [];
  return list.map((h) => ({
    date: h.date,
    name: h.name,
    localName: h.localName ?? h.name,
    countryCode: country,
    fixed: false,
    global: false,
    types: ['Public'],
  }));
}
