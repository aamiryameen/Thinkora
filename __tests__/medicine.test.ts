import {
  addDays,
  adherence,
  daysBetween,
  daysOfStockLeft,
  describeSchedule,
  dosesForDate,
  dosesPerDay,
  formatTime,
  historyToCsv,
  isDueOn,
  isMissed,
  lowStock,
  nextDose,
  timestampFor,
} from '../src/core/medicine';
import type { DoseLog, Medicine } from '../src/types/medicine';

function med(over: Partial<Medicine> = {}): Medicine {
  return {
    id: 'm1', profileId: 'p1', name: 'Aspirin', dosage: '100 mg', form: 'tablet',
    category: 'other', photoUri: null, mealTiming: 'any', expiryDate: null,
    soundId: 'default', missedAlertMinutes: null,
    color: '#EF4444', notes: '', scheduleKind: 'daily', times: [8 * 60],
    weekdays: [], intervalDays: 1, startDate: '2026-08-01', endDate: null,
    remindersEnabled: true, stockCount: null, refillThreshold: null,
    archived: false, createdAt: 1, updatedAt: 1, ...over,
  };
}

function log(over: Partial<DoseLog> = {}): DoseLog {
  return {
    id: 'l1', medicineId: 'm1', profileId: 'p1', date: '2026-08-03',
    scheduledMinutes: 8 * 60, status: 'taken', takenAt: 1, snoozedUntil: null,
    note: '', createdAt: 1, ...over,
  };
}

describe('date helpers', () => {
  it('adds days across a month boundary', () => {
    expect(addDays('2026-08-30', 3)).toBe('2026-09-02');
  });

  it('subtracts days across a year boundary', () => {
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('counts whole days between keys', () => {
    expect(daysBetween('2026-08-01', '2026-08-08')).toBe(7);
    expect(daysBetween('2026-08-08', '2026-08-01')).toBe(-7);
    expect(daysBetween('2026-08-01', '2026-08-01')).toBe(0);
  });

  it('formats 12-hour times with midnight and noon correct', () => {
    expect(formatTime(0)).toBe('12:00 AM');
    expect(formatTime(12 * 60)).toBe('12:00 PM');
    expect(formatTime(8 * 60 + 30)).toBe('8:30 AM');
    expect(formatTime(20 * 60 + 5)).toBe('8:05 PM');
  });

  it('builds a local timestamp at the right clock time', () => {
    const ts = timestampFor('2026-08-03', 9 * 60 + 15);
    const d = new Date(ts);
    expect(d.getHours()).toBe(9);
    expect(d.getMinutes()).toBe(15);
  });
});

describe('isDueOn', () => {
  it('is true every day for a daily medicine', () => {
    expect(isDueOn(med(), '2026-08-03')).toBe(true);
    expect(isDueOn(med(), '2026-08-04')).toBe(true);
  });

  it('is false before the start date', () => {
    expect(isDueOn(med({ startDate: '2026-08-10' }), '2026-08-03')).toBe(false);
  });

  it('is false after the end date, so a finished course never reappears', () => {
    expect(isDueOn(med({ endDate: '2026-08-02' }), '2026-08-03')).toBe(false);
  });

  it('includes the end date itself', () => {
    expect(isDueOn(med({ endDate: '2026-08-03' }), '2026-08-03')).toBe(true);
  });

  it('is false for an archived medicine', () => {
    expect(isDueOn(med({ archived: true }), '2026-08-03')).toBe(false);
  });

  it('matches only the chosen weekdays', () => {
    // 2026-08-03 is a Monday.
    const monday = med({ scheduleKind: 'weekly', weekdays: [1] });
    expect(isDueOn(monday, '2026-08-03')).toBe(true);
    expect(isDueOn(monday, '2026-08-04')).toBe(false);
  });

  it('honours the interval from the start date', () => {
    const everyThird = med({ scheduleKind: 'interval', intervalDays: 3, startDate: '2026-08-01' });
    expect(isDueOn(everyThird, '2026-08-01')).toBe(true);
    expect(isDueOn(everyThird, '2026-08-02')).toBe(false);
    expect(isDueOn(everyThird, '2026-08-04')).toBe(true);
    expect(isDueOn(everyThird, '2026-08-07')).toBe(true);
  });

  it('treats a zero or negative interval as daily rather than dividing by zero', () => {
    expect(isDueOn(med({ scheduleKind: 'interval', intervalDays: 0 }), '2026-08-03')).toBe(true);
  });

  it('is never scheduled for as-needed medicines', () => {
    expect(isDueOn(med({ scheduleKind: 'as_needed' }), '2026-08-03')).toBe(false);
  });
});

describe('dosesForDate', () => {
  it('returns one dose per scheduled time, in order', () => {
    const m = med({ times: [20 * 60, 8 * 60] });
    const doses = dosesForDate([m], [], '2026-08-03');
    expect(doses.map(d => d.minutes)).toEqual([8 * 60, 20 * 60]);
  });

  it('attaches a matching log and its status', () => {
    const doses = dosesForDate([med()], [log({ status: 'taken' })], '2026-08-03');
    expect(doses[0].status).toBe('taken');
    expect(doses[0].log).not.toBeNull();
  });

  it('does not attach a log from a different time', () => {
    const doses = dosesForDate([med()], [log({ scheduledMinutes: 20 * 60 })], '2026-08-03');
    expect(doses[0].status).toBe('pending');
  });

  it('does not attach a log from a different day', () => {
    const doses = dosesForDate([med()], [log({ date: '2026-08-02' })], '2026-08-03');
    expect(doses[0].status).toBe('pending');
  });

  it('includes logged as-needed doses', () => {
    const m = med({ scheduleKind: 'as_needed', times: [] });
    const doses = dosesForDate([m], [log({ scheduledMinutes: null })], '2026-08-03');
    expect(doses).toHaveLength(1);
    expect(doses[0].minutes).toBeNull();
  });

  it('returns nothing for a day with no due medicines', () => {
    expect(dosesForDate([med({ startDate: '2026-09-01' })], [], '2026-08-03')).toEqual([]);
  });
});

describe('isMissed', () => {
  const m = med({ times: [8 * 60] });

  it('is false for a pending dose still in the future', () => {
    const [dose] = dosesForDate([m], [], '2026-08-03');
    expect(isMissed(dose, new Date(2026, 7, 3, 6))).toBe(false);
  });

  it('is true once the scheduled time has passed', () => {
    const [dose] = dosesForDate([m], [], '2026-08-03');
    expect(isMissed(dose, new Date(2026, 7, 3, 10))).toBe(true);
  });

  it('is false for a dose already taken or skipped', () => {
    const [taken] = dosesForDate([m], [log({ status: 'taken' })], '2026-08-03');
    expect(isMissed(taken, new Date(2026, 7, 3, 23))).toBe(false);
    const [skipped] = dosesForDate([m], [log({ status: 'skipped' })], '2026-08-03');
    expect(isMissed(skipped, new Date(2026, 7, 3, 23))).toBe(false);
  });
});

describe('adherence', () => {
  const m = med({ times: [8 * 60], startDate: '2026-08-01' });
  const later = new Date(2026, 7, 4, 23);

  it('counts taken, skipped and missed across the range', () => {
    const logs = [
      log({ id: 'a', date: '2026-08-01', status: 'taken' }),
      log({ id: 'b', date: '2026-08-02', status: 'skipped' }),
      // 08-03 left unlogged -> missed
    ];
    const stats = adherence([m], logs, '2026-08-01', '2026-08-03', later);
    expect(stats).toMatchObject({ taken: 1, skipped: 1, missed: 1, total: 3 });
    expect(stats.rate).toBeCloseTo(1 / 3);
  });

  it('ignores doses whose time has not yet passed', () => {
    // Morning dose already gone, evening dose still upcoming.
    const twice = med({ times: [8 * 60, 20 * 60] });
    const stats = adherence([twice], [], '2026-08-03', '2026-08-03', new Date(2026, 7, 3, 12));
    expect(stats.total).toBe(1);
  });

  it('reports a zero rate rather than NaN for an empty range', () => {
    const stats = adherence([], [], '2026-08-01', '2026-08-03', later);
    expect(stats.total).toBe(0);
    expect(stats.rate).toBe(0);
  });

  it('gives a perfect rate when every dose was taken', () => {
    const logs = [
      log({ id: 'a', date: '2026-08-01' }),
      log({ id: 'b', date: '2026-08-02' }),
    ];
    expect(adherence([m], logs, '2026-08-01', '2026-08-02', later).rate).toBe(1);
  });
});

describe('nextDose', () => {
  it('returns the next pending dose later today', () => {
    const m = med({ times: [8 * 60, 20 * 60] });
    const next = nextDose([m], [], new Date(2026, 7, 3, 12));
    expect(next?.minutes).toBe(20 * 60);
  });

  it('skips doses already taken and rolls to the next day', () => {
    const m = med({ times: [8 * 60, 20 * 60] });
    const logs = [log({ scheduledMinutes: 20 * 60, status: 'taken' })];
    const next = nextDose([m], logs, new Date(2026, 7, 3, 12));
    // Tonight's dose is done, so the next one is tomorrow morning.
    expect(next?.date).toBe('2026-08-04');
    expect(next?.minutes).toBe(8 * 60);
  });

  it('looks ahead to a future day when today is done', () => {
    const m = med({ times: [8 * 60] });
    const next = nextDose([m], [], new Date(2026, 7, 3, 12));
    expect(next?.date).toBe('2026-08-04');
  });

  it('returns null when no medicine is ever due', () => {
    expect(nextDose([med({ scheduleKind: 'as_needed', times: [] })], [], new Date())).toBeNull();
  });
});

describe('inventory', () => {
  it('flags a medicine at or below its threshold', () => {
    const low = med({ stockCount: 5, refillThreshold: 5 });
    const fine = med({ id: 'm2', stockCount: 30, refillThreshold: 5 });
    expect(lowStock([low, fine]).map(m => m.id)).toEqual(['m1']);
  });

  it('ignores medicines without tracking', () => {
    expect(lowStock([med({ stockCount: null, refillThreshold: 5 })])).toEqual([]);
    expect(lowStock([med({ stockCount: 2, refillThreshold: null })])).toEqual([]);
  });

  it('computes doses per day for each schedule kind', () => {
    expect(dosesPerDay(med({ times: [1, 2] }))).toBe(2);
    expect(dosesPerDay(med({ scheduleKind: 'weekly', times: [1], weekdays: [1, 3] }))).toBeCloseTo(2 / 7);
    expect(dosesPerDay(med({ scheduleKind: 'interval', times: [1], intervalDays: 2 }))).toBe(0.5);
    expect(dosesPerDay(med({ scheduleKind: 'as_needed', times: [] }))).toBe(0);
  });

  it('projects days of stock remaining', () => {
    expect(daysOfStockLeft(med({ stockCount: 20, times: [1, 2] }))).toBe(10);
    expect(daysOfStockLeft(med({ stockCount: null }))).toBeNull();
  });

  it('returns null rather than Infinity for an unscheduled medicine', () => {
    expect(daysOfStockLeft(med({ stockCount: 10, scheduleKind: 'as_needed', times: [] }))).toBeNull();
  });
});

describe('describeSchedule', () => {
  it('describes each kind readably', () => {
    expect(describeSchedule(med())).toContain('Daily');
    expect(describeSchedule(med({ scheduleKind: 'weekly', weekdays: [1, 5] }))).toContain('Mon, Fri');
    expect(describeSchedule(med({ scheduleKind: 'interval', intervalDays: 3 }))).toContain('Every 3 days');
    expect(describeSchedule(med({ scheduleKind: 'interval', intervalDays: 1 }))).toContain('Every day');
    expect(describeSchedule(med({ scheduleKind: 'as_needed' }))).toBe('As needed');
  });
});

describe('historyToCsv', () => {
  it('writes a header and one row per dose', () => {
    const doses = dosesForDate([med()], [log()], '2026-08-03');
    const csv = historyToCsv(doses, 'Aamir');
    expect(csv).toContain('Date,Time,Medicine,Dosage,Status,Note');
    expect(csv).toContain('2026-08-03,8:00 AM,Aspirin,100 mg,taken');
  });

  it('escapes commas and quotes in names and notes', () => {
    const doses = dosesForDate(
      [med({ name: 'Vitamin D, high' })],
      [log({ note: 'felt "fine"' })],
      '2026-08-03',
    );
    const csv = historyToCsv(doses, 'X');
    expect(csv).toContain('"Vitamin D, high"');
    expect(csv).toContain('"felt ""fine"""');
  });
});

// ─── v2: monthly, snooze, expiry, analytics ──────────────────────────────────

import {
  adherenceByMedicine, adherenceTrend, daysUntilExpiry, expiringSoon,
  isExpired, isSnoozeActive, missesByTimeOfDay, EXPIRY_WARNING_DAYS,
  MEAL_TIMINGS, MEDICINE_CATEGORIES, REMINDER_SOUNDS,
} from '../src/core/medicine';

describe('monthly schedule', () => {
  it('fires on the same day each month', () => {
    const m = med({ scheduleKind: 'monthly', startDate: '2026-01-15' });
    expect(isDueOn(m, '2026-01-15')).toBe(true);
    expect(isDueOn(m, '2026-02-15')).toBe(true);
    expect(isDueOn(m, '2026-03-15')).toBe(true);
    expect(isDueOn(m, '2026-02-14')).toBe(false);
  });

  it('clamps a 31st course into short months', () => {
    const m = med({ scheduleKind: 'monthly', startDate: '2026-01-31' });
    expect(isDueOn(m, '2026-01-31')).toBe(true);
    // February has 28 days in 2026, so the dose lands on the 28th.
    expect(isDueOn(m, '2026-02-28')).toBe(true);
    expect(isDueOn(m, '2026-03-31')).toBe(true);
  });

  it('respects the start date', () => {
    const m = med({ scheduleKind: 'monthly', startDate: '2026-06-10' });
    expect(isDueOn(m, '2026-05-10')).toBe(false);
  });
});

describe('snooze', () => {
  const m = med({ times: [8 * 60] });
  const later = new Date(2026, 7, 3, 12);

  it('is not missed while the snooze is still running', () => {
    const logs = [log({
      status: 'snoozed',
      snoozedUntil: new Date(2026, 7, 3, 14).getTime(),
      takenAt: null,
    })];
    const [dose] = dosesForDate([m], logs, '2026-08-03');
    expect(isSnoozeActive(dose, later)).toBe(true);
    expect(isMissed(dose, later)).toBe(false);
  });

  it('becomes missed once the snooze expires', () => {
    const logs = [log({
      status: 'snoozed',
      snoozedUntil: new Date(2026, 7, 3, 9).getTime(),
      takenAt: null,
    })];
    const [dose] = dosesForDate([m], logs, '2026-08-03');
    expect(isSnoozeActive(dose, later)).toBe(false);
    expect(isMissed(dose, later)).toBe(true);
  });

  it('never counts a taken dose as missed', () => {
    const [dose] = dosesForDate([m], [log({ status: 'taken' })], '2026-08-03');
    expect(isMissed(dose, later)).toBe(false);
  });
});

describe('expiry', () => {
  const now = new Date(2026, 7, 3);

  it('returns null when no expiry is set', () => {
    expect(daysUntilExpiry(med(), now)).toBeNull();
  });

  it('counts days remaining', () => {
    expect(daysUntilExpiry(med({ expiryDate: '2026-08-13' }), now)).toBe(10);
  });

  it('goes negative once past', () => {
    expect(daysUntilExpiry(med({ expiryDate: '2026-08-01' }), now)).toBe(-2);
    expect(isExpired(med({ expiryDate: '2026-08-01' }), now)).toBe(true);
  });

  it('flags medicines inside the warning window', () => {
    const soon = med({ id: 'soon', expiryDate: '2026-08-20' });
    const far = med({ id: 'far', expiryDate: '2027-01-01' });
    expect(expiringSoon([soon, far], now).map(m => m.id)).toEqual(['soon']);
  });

  it('includes already-expired medicines', () => {
    const gone = med({ id: 'gone', expiryDate: '2026-01-01' });
    expect(expiringSoon([gone], now).map(m => m.id)).toEqual(['gone']);
  });

  it('ignores archived medicines', () => {
    const gone = med({ expiryDate: '2026-01-01', archived: true });
    expect(expiringSoon([gone], now)).toEqual([]);
  });

  it('uses a sane warning window', () => {
    expect(EXPIRY_WARNING_DAYS).toBeGreaterThan(0);
  });
});

describe('adherenceByMedicine', () => {
  const later = new Date(2026, 7, 4, 23);

  it('reports the worst adherence first', () => {
    const good = med({ id: 'good', name: 'Good', times: [8 * 60] });
    const bad = med({ id: 'bad', name: 'Bad', times: [8 * 60] });
    const logs = [
      log({ id: 'a', medicineId: 'good', date: '2026-08-01', status: 'taken' }),
      log({ id: 'b', medicineId: 'good', date: '2026-08-02', status: 'taken' }),
      // 'bad' has no logs at all, so both days count as missed.
    ];
    const rows = adherenceByMedicine([good, bad], logs, '2026-08-01', '2026-08-02', later);
    expect(rows[0].medicineId).toBe('bad');
    expect(rows[0].rate).toBe(0);
    expect(rows[1].rate).toBe(1);
  });

  it('omits medicines with no expected doses in range', () => {
    const future = med({ id: 'future', startDate: '2027-01-01' });
    expect(adherenceByMedicine([future], [], '2026-08-01', '2026-08-02', later)).toEqual([]);
  });

  it('excludes archived medicines', () => {
    const gone = med({ archived: true });
    expect(adherenceByMedicine([gone], [], '2026-08-01', '2026-08-02', later)).toEqual([]);
  });
});

describe('adherenceTrend', () => {
  const later = new Date(2026, 7, 4, 23);

  it('returns one entry per day, oldest first', () => {
    const trend = adherenceTrend([med()], [], '2026-08-01', '2026-08-03', later);
    expect(trend).toHaveLength(3);
    expect(trend[0].date).toBe('2026-08-01');
    expect(trend[2].date).toBe('2026-08-03');
  });

  it('reports a perfect day and a missed day', () => {
    const m = med({ times: [8 * 60] });
    const logs = [log({ date: '2026-08-01', status: 'taken' })];
    const trend = adherenceTrend([m], logs, '2026-08-01', '2026-08-02', later);
    expect(trend[0].rate).toBe(1);
    expect(trend[1].rate).toBe(0);
  });

  it('reports zero rather than NaN for a day with nothing expected', () => {
    const trend = adherenceTrend([], [], '2026-08-01', '2026-08-01', later);
    expect(trend[0].rate).toBe(0);
    expect(trend[0].expected).toBe(0);
  });
});

describe('missesByTimeOfDay', () => {
  const later = new Date(2026, 7, 4, 23);

  it('buckets a missed morning dose', () => {
    const m = med({ times: [8 * 60] });
    const rows = missesByTimeOfDay([m], [], '2026-08-01', '2026-08-01', later);
    expect(rows.find(r => r.label === 'Morning')?.missed).toBe(1);
    expect(rows.find(r => r.label === 'Evening')?.missed).toBe(0);
  });

  it('buckets an after-midnight dose as night, not morning', () => {
    // A 2am dose belongs to the night bucket, which wraps past midnight.
    const m = med({ times: [2 * 60] });
    const rows = missesByTimeOfDay([m], [], '2026-08-01', '2026-08-01', later);
    expect(rows.find(r => r.label === 'Night')?.missed).toBe(1);
    expect(rows.find(r => r.label === 'Morning')?.missed).toBe(0);
  });

  it('always returns all four buckets', () => {
    expect(missesByTimeOfDay([], [], '2026-08-01', '2026-08-01', later)).toHaveLength(4);
  });
});

describe('catalogues', () => {
  it('has unique category, meal and sound ids', () => {
    [MEDICINE_CATEGORIES.map(c => c.value),
      MEAL_TIMINGS.map(t => t.value),
      REMINDER_SOUNDS.map(s => s.id)].forEach(ids => {
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  it('leaves exactly one sound free', () => {
    expect(REMINDER_SOUNDS.filter(s => !s.premium)).toHaveLength(1);
  });
});

// ─── v3: family profiles and doctor visits ───────────────────────────────────

import {
  ageFromBirthDate, describeGender, describeProfile, isDateKey,
  parseTimeInput, visitReminderSlots,
  VISIT_DAY_BEFORE_MINUTES, VISIT_FOLLOW_UP_MINUTES,
} from '../src/core/medicine';
import type { FamilyProfile, Gender } from '../src/types/medicine';

describe('isDateKey', () => {
  it('accepts a real date', () => {
    expect(isDateKey('2026-08-04')).toBe(true);
    expect(isDateKey('2024-02-29')).toBe(true); // leap year
  });

  it('rejects a day that does not exist in that month', () => {
    expect(isDateKey('2026-02-31')).toBe(false);
    expect(isDateKey('2026-04-31')).toBe(false);
    expect(isDateKey('2025-02-29')).toBe(false); // not a leap year
  });

  it('rejects out-of-range months and days', () => {
    expect(isDateKey('2026-13-01')).toBe(false);
    expect(isDateKey('2026-00-10')).toBe(false);
    expect(isDateKey('2026-01-00')).toBe(false);
  });

  it('rejects anything that is not the exact shape', () => {
    ['', '2026-8-4', '2026/08/04', '04-08-2026', 'today', '2026-08'].forEach(v => {
      expect(isDateKey(v)).toBe(false);
    });
  });
});

describe('parseTimeInput', () => {
  it('reads a valid time', () => {
    expect(parseTimeInput('00:00')).toBe(0);
    expect(parseTimeInput('09:30')).toBe(570);
    expect(parseTimeInput('9:30')).toBe(570);
    expect(parseTimeInput('23:59')).toBe(1439);
  });

  it('tolerates surrounding whitespace', () => {
    expect(parseTimeInput('  14:00 ')).toBe(840);
  });

  it('returns null instead of clamping an impossible time', () => {
    expect(parseTimeInput('24:00')).toBeNull();
    expect(parseTimeInput('10:60')).toBeNull();
    expect(parseTimeInput('99:99')).toBeNull();
  });

  it('rejects malformed input', () => {
    ['', '10', '10:5', 'ten', '10:30pm'].forEach(v => {
      expect(parseTimeInput(v)).toBeNull();
    });
  });
});

describe('ageFromBirthDate', () => {
  const now = new Date(2026, 7, 4); // 2026-08-04

  it('counts whole years', () => {
    expect(ageFromBirthDate('1990-08-04', now)).toBe(36);
    expect(ageFromBirthDate('2000-01-01', now)).toBe(26);
  });

  it('does not count a birthday that has not happened yet this year', () => {
    // Same year, later month — still 35, not 36.
    expect(ageFromBirthDate('1990-08-05', now)).toBe(35);
    expect(ageFromBirthDate('1990-12-31', now)).toBe(35);
  });

  it('counts the birthday itself', () => {
    expect(ageFromBirthDate('2020-08-04', now)).toBe(6);
  });

  it('returns null rather than a number for missing or malformed dates', () => {
    expect(ageFromBirthDate(null, now)).toBeNull();
    expect(ageFromBirthDate('', now)).toBeNull();
    expect(ageFromBirthDate('1990-08', now)).toBeNull();
    expect(ageFromBirthDate('not a date', now)).toBeNull();
    expect(ageFromBirthDate('1990-02-31', now)).toBeNull();
  });

  it('returns null for a future birth date instead of a negative age', () => {
    expect(ageFromBirthDate('2030-01-01', now)).toBeNull();
  });

  it('handles a newborn as zero', () => {
    expect(ageFromBirthDate('2026-08-01', now)).toBe(0);
  });
});

describe('describeProfile', () => {
  const now = new Date(2026, 7, 4);
  const base = (over: Partial<FamilyProfile> = {}): FamilyProfile => ({
    id: 'p1', name: 'Ali', color: '#000', icon: 'person-outline',
    photoUri: null, relationship: '', birthDate: null, gender: 'unspecified',
    bloodGroup: '', allergies: '', conditions: '', emergencyContact: '',
    doctorName: '', doctorPhone: '', doctorNotes: '',
    isDefault: false, createdAt: 0, ...over,
  });

  it('joins the parts that are present', () => {
    expect(describeProfile(base({
      relationship: 'Father', birthDate: '1970-01-01', gender: 'male',
    }), now)).toBe('Father · 56 yr · Male');
  });

  it('skips whatever is blank', () => {
    expect(describeProfile(base({ relationship: 'Son' }), now)).toBe('Son');
    expect(describeProfile(base({ birthDate: '2016-01-01' }), now)).toBe('10 yr');
    expect(describeProfile(base(), now)).toBe('');
  });

  it('leaves an unspecified gender out entirely', () => {
    expect(describeProfile(base({ gender: 'unspecified' }), now)).toBe('');
  });

  it('labels every gender value', () => {
    const values: Gender[] = ['male', 'female', 'other'];
    values.forEach(g => expect(describeGender(g)).not.toBe(''));
    expect(describeGender('unspecified')).toBe('');
  });
});

describe('visitReminderSlots', () => {
  const now = new Date(2026, 7, 4, 9); // 2026-08-04 09:00

  const visit = (over: Partial<{ date: string; minutes: number; followUpDate: string | null }> = {}) => ({
    date: '2026-08-20', minutes: 10 * 60, followUpDate: null, ...over,
  });

  it('schedules the day before and the appointment itself', () => {
    const slots = visitReminderSlots(visit(), now);
    expect(slots.map(s => s.key)).toEqual(['day-before', 'at-time']);
  });

  it('puts the day-before reminder at 6pm the previous day', () => {
    const [dayBefore] = visitReminderSlots(visit(), now);
    const d = new Date(dayBefore.at);
    expect(d.getDate()).toBe(19);
    expect(d.getHours() * 60 + d.getMinutes()).toBe(VISIT_DAY_BEFORE_MINUTES);
  });

  it('puts the at-time reminder at the appointment time', () => {
    const [, atTime] = visitReminderSlots(visit({ minutes: 14 * 60 + 30 }), now);
    const d = new Date(atTime.at);
    expect(d.getDate()).toBe(20);
    expect(d.getHours() * 60 + d.getMinutes()).toBe(14 * 60 + 30);
  });

  it('adds a morning slot for a follow-up date', () => {
    const slots = visitReminderSlots(visit({ followUpDate: '2026-09-15' }), now);
    expect(slots.map(s => s.key)).toEqual(['day-before', 'at-time', 'follow-up']);
    const d = new Date(slots[2].at);
    expect(d.getDate()).toBe(15);
    expect(d.getHours() * 60 + d.getMinutes()).toBe(VISIT_FOLLOW_UP_MINUTES);
  });

  it('drops slots already in the past — an alarm behind now never fires', () => {
    expect(visitReminderSlots(visit({ date: '2020-01-01' }), now)).toEqual([]);
  });

  it('keeps only the appointment when the day-before window has passed', () => {
    // Appointment is today at 5pm, so 6pm yesterday is gone but 5pm is not.
    const slots = visitReminderSlots(
      visit({ date: '2026-08-04', minutes: 17 * 60 }), now,
    );
    expect(slots.map(s => s.key)).toEqual(['at-time']);
  });

  it('keeps a future follow-up even when the visit itself has passed', () => {
    const slots = visitReminderSlots(
      visit({ date: '2026-07-01', followUpDate: '2026-10-01' }), now,
    );
    expect(slots.map(s => s.key)).toEqual(['follow-up']);
  });

  it('fires in chronological order', () => {
    const slots = visitReminderSlots(visit({ followUpDate: '2026-09-15' }), now);
    const times = slots.map(s => s.at);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });
});
