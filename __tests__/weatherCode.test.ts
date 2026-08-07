// AsyncStorage and the location module are imported at weatherService module
// scope; neither has a native binding under Jest, so both are stubbed. Only the
// pure code-resolution helpers are exercised here.
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn(),
}));
jest.mock('../src/services/locationReminderService', () => ({
  getCurrentLocation: jest.fn(),
}));

import {
  resolveCurrentCode, resolveDailyCode, STORM_MIN_PRECIP_MM,
} from '../src/services/weatherService';

const THUNDERSTORM = 95;
const THUNDERSTORM_HAIL = 96;
const OVERCAST = 3;
const RAIN = 61;
const SHOWERS = 80;
const CLEAR = 0;

describe('resolveCurrentCode — storm downgrade', () => {
  it('downgrades a thunderstorm that produced only trace rain', () => {
    // The exact Lahore reading: ECMWF said 95 with 0.2mm while Google said
    // "light rain" and three other models reported no precipitation at all.
    expect(resolveCurrentCode(THUNDERSTORM, 0.2)).toBe(RAIN);
  });

  it('downgrades a dry thunderstorm all the way to overcast', () => {
    expect(resolveCurrentCode(THUNDERSTORM, 0)).toBe(OVERCAST);
    expect(resolveCurrentCode(THUNDERSTORM, 0.1)).toBe(OVERCAST);
  });

  it('downgrades every storm code in the 95-99 range', () => {
    [95, 96, 97, 98, 99].forEach(code => {
      expect(resolveCurrentCode(code, 0.2)).toBe(RAIN);
    });
  });

  it('keeps a thunderstorm that is actually raining hard', () => {
    expect(resolveCurrentCode(THUNDERSTORM, 5)).toBe(THUNDERSTORM);
    expect(resolveCurrentCode(THUNDERSTORM_HAIL, 12)).toBe(THUNDERSTORM_HAIL);
  });

  it('treats the storm threshold as a floor to clear, not to reach', () => {
    // At exactly the threshold the rain has not earned the label.
    expect(resolveCurrentCode(THUNDERSTORM, STORM_MIN_PRECIP_MM)).toBe(RAIN);
    expect(resolveCurrentCode(THUNDERSTORM, STORM_MIN_PRECIP_MM + 0.1))
      .toBe(THUNDERSTORM);
  });
});

describe('resolveCurrentCode — rain override', () => {
  it('reports measured rain even when the code looks dry', () => {
    expect(resolveCurrentCode(CLEAR, 0.5)).toBe(RAIN);
    expect(resolveCurrentCode(OVERCAST, 0.5)).toBe(RAIN);
  });

  it('escalates heavy rain to showers', () => {
    expect(resolveCurrentCode(OVERCAST, 4)).toBe(SHOWERS);
  });

  it('ignores trace precipitation', () => {
    expect(resolveCurrentCode(CLEAR, 0)).toBe(CLEAR);
    expect(resolveCurrentCode(CLEAR, 0.1)).toBe(CLEAR);
  });

  it('leaves a non-storm code alone when it is dry', () => {
    [0, 1, 2, 3, 45, 71].forEach(code => {
      expect(resolveCurrentCode(code, 0)).toBe(code);
    });
  });

  it('does not let the rain override mask an over-called storm', () => {
    // Regression: the rain override rewrites 95 to 61 for any precipitation, so
    // if it ran first the storm check would never see a storm code and a 0.2mm
    // "thunderstorm" would silently pass through as rain-by-accident. Both
    // paths give 61 here, so assert on the dry case where they differ.
    expect(resolveCurrentCode(THUNDERSTORM, 0)).toBe(OVERCAST);
  });
});

describe('resolveDailyCode', () => {
  it('downgrades a storm day that barely rained', () => {
    expect(resolveDailyCode(THUNDERSTORM, 0.5)).toBe(RAIN);
    expect(resolveDailyCode(THUNDERSTORM, 0)).toBe(OVERCAST);
  });

  it('keeps a storm day with a real daily total', () => {
    expect(resolveDailyCode(THUNDERSTORM, 8)).toBe(THUNDERSTORM);
    expect(resolveDailyCode(THUNDERSTORM, 25)).toBe(THUNDERSTORM);
  });

  it('uses a lower floor than the 15-min check, since it spans a whole day', () => {
    // 2mm over 24h is a wet day; 2mm in 15 min is a downpour. The daily code
    // keeps the storm here where resolveCurrentCode would downgrade it.
    expect(resolveDailyCode(THUNDERSTORM, 2.4)).toBe(THUNDERSTORM);
    expect(resolveCurrentCode(THUNDERSTORM, 2.4)).toBe(RAIN);
  });

  it('never promotes a dry-coded day, since a total says nothing about when', () => {
    expect(resolveDailyCode(CLEAR, 30)).toBe(CLEAR);
    expect(resolveDailyCode(OVERCAST, 30)).toBe(OVERCAST);
  });
});
