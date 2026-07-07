/**
 * Morning Brew — once per morning, between 6 AM and 10 AM, the user gets
 * shown a 30-second start screen. We track the last-seen date here so it
 * never appears twice on the same day.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { dayKey } from './streakService';

const STORAGE_KEY = '@thinkora/morning_brew_v1';

export interface MorningBrewState {
  lastShownDate: string;
  /** Hour the morning window opens (default 6). */
  morningStartHour: number;
  /** Hour the morning window closes (default 10). Past this, brew is not shown. */
  morningEndHour: number;
  /** Whether the user has dismissed the brew permanently. */
  disabled: boolean;
}

const DEFAULT_STATE: MorningBrewState = {
  lastShownDate: '',
  morningStartHour: 6,
  morningEndHour: 10,
  disabled: false,
};

export async function loadBrewState(): Promise<MorningBrewState> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

async function saveBrewState(s: MorningBrewState): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {}
}

/** True if it's morning AND the brew hasn't been shown today AND user
 *  hasn't disabled it. Use this to gate auto-show on app open. */
export async function shouldShowBrewNow(): Promise<boolean> {
  const state = await loadBrewState();
  if (state.disabled) return false;
  if (state.lastShownDate === dayKey()) return false;
  const hour = new Date().getHours();
  return hour >= state.morningStartHour && hour < state.morningEndHour;
}

export async function markBrewShown(): Promise<void> {
  const state = await loadBrewState();
  state.lastShownDate = dayKey();
  await saveBrewState(state);
}

export async function setBrewDisabled(disabled: boolean): Promise<void> {
  const state = await loadBrewState();
  state.disabled = disabled;
  await saveBrewState(state);
}
