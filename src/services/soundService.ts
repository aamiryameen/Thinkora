/**
 * Sound Service
 *
 * Manages reminder tunes + ambient background sounds for Pomodoro.
 *
 * Reminder tunes: short samples played by the notification system.
 *   Preview loops the sample for ~4 seconds so users can judge the tone.
 * Ambient sounds: long loops (30 sec), played in-app during focus sessions.
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Lazy-load react-native-sound (it's a native module) ───────
let Sound: any = null;
if (Platform.OS === 'android') {
  try {
    Sound = require('react-native-sound').default;
    Sound.setCategory('Playback');
  } catch {
    Sound = null;
  }
}

// ── Reminder Tunes ─────────────────────────────────────────────

export interface ReminderTune {
  id: string;
  name: string;
  // Raw resource name (without .wav) — used by notifee on Android
  resource: string;
}

export const REMINDER_TUNES: ReminderTune[] = [
  { id: 'alarm', name: 'Alarm (Default)', resource: 'alarm' },
  { id: 'chime', name: 'Chime', resource: 'reminder_chime' },
  { id: 'marimba', name: 'Marimba', resource: 'reminder_marimba' },
  { id: 'ding', name: 'Ding', resource: 'reminder_ding' },
  { id: 'bell', name: 'Bell', resource: 'reminder_bell' },
  { id: 'pop', name: 'Pop', resource: 'reminder_pop' },
  { id: 'soft', name: 'Soft', resource: 'reminder_soft' },
  { id: 'xylophone', name: 'Xylophone', resource: 'reminder_xylophone' },
  { id: 'digital', name: 'Digital', resource: 'reminder_digital' },
  { id: 'classic', name: 'Classic Alarm', resource: 'reminder_classic' },
  { id: 'twinkle', name: 'Twinkle', resource: 'reminder_twinkle' },
];

const TUNE_KEY = '@thinkora/reminder_tune';
const PER_ITEM_TUNE_KEY = '@thinkora/per_item_tunes';
const CUSTOM_TUNES_KEY = '@thinkora/custom_tunes';

// ── Custom user-uploaded tunes ─────────────────────────────────

export interface CustomTune {
  id: string;          // 'custom_<timestamp>'
  name: string;        // user-provided or filename
  uri: string;         // absolute file:// path on device
  addedAt: number;
}

export async function getCustomTunes(): Promise<CustomTune[]> {
  try {
    const raw = await AsyncStorage.getItem(CUSTOM_TUNES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

async function saveCustomTunes(tunes: CustomTune[]): Promise<void> {
  await AsyncStorage.setItem(CUSTOM_TUNES_KEY, JSON.stringify(tunes));
}

export async function addCustomTune(uri: string, name: string): Promise<CustomTune> {
  const tune: CustomTune = {
    id: `custom_${Date.now()}`,
    name,
    uri,
    addedAt: Date.now(),
  };
  const list = await getCustomTunes();
  list.push(tune);
  await saveCustomTunes(list);
  return tune;
}

export async function deleteCustomTune(id: string): Promise<void> {
  const list = await getCustomTunes();
  await saveCustomTunes(list.filter(t => t.id !== id));
}

/** Combined list of built-in + custom tunes for pickers. */
export async function getAllTunes(): Promise<ReminderTune[]> {
  const custom = await getCustomTunes();
  const customAsTunes: ReminderTune[] = custom.map(c => ({
    id: c.id,
    name: c.name,
    resource: c.uri, // file:// URI for sound playback / notifee
  }));
  return [...REMINDER_TUNES, ...customAsTunes];
}

function isCustomTuneId(id: string): boolean {
  return id.startsWith('custom_');
}

export async function getSelectedReminderTune(): Promise<ReminderTune> {
  try {
    const id = await AsyncStorage.getItem(TUNE_KEY);
    if (!id) return REMINDER_TUNES[0];
    if (isCustomTuneId(id)) {
      const custom = (await getCustomTunes()).find(c => c.id === id);
      if (custom) return { id: custom.id, name: custom.name, resource: custom.uri };
    }
    return REMINDER_TUNES.find(t => t.id === id) ?? REMINDER_TUNES[0];
  } catch {
    return REMINDER_TUNES[0];
  }
}

export async function setSelectedReminderTune(id: string): Promise<void> {
  await AsyncStorage.setItem(TUNE_KEY, id);
}

/**
 * Per-item tune overrides — stored as a map of itemId → tuneId.
 * Used for tasks and notes to override the global default tune.
 */
async function loadPerItemTunes(): Promise<Record<string, string>> {
  try {
    const raw = await AsyncStorage.getItem(PER_ITEM_TUNE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function savePerItemTunes(map: Record<string, string>): Promise<void> {
  await AsyncStorage.setItem(PER_ITEM_TUNE_KEY, JSON.stringify(map));
}

/**
 * Get tune for a specific item (task/reminder).
 * Falls back to global default if no override exists.
 */
export async function getTuneForItem(itemId: string): Promise<ReminderTune> {
  const map = await loadPerItemTunes();
  const tuneId = map[itemId];
  if (tuneId) {
    if (isCustomTuneId(tuneId)) {
      const custom = (await getCustomTunes()).find(c => c.id === tuneId);
      if (custom) return { id: custom.id, name: custom.name, resource: custom.uri };
    } else {
      const tune = REMINDER_TUNES.find(t => t.id === tuneId);
      if (tune) return tune;
    }
  }
  return getSelectedReminderTune();
}

/**
 * Set tune for a specific item (task/reminder).
 */
export async function setTuneForItem(itemId: string, tuneId: string): Promise<void> {
  const map = await loadPerItemTunes();
  map[itemId] = tuneId;
  await savePerItemTunes(map);
}

/**
 * Remove tune override for an item (falls back to default).
 */
export async function clearTuneForItem(itemId: string): Promise<void> {
  const map = await loadPerItemTunes();
  delete map[itemId];
  await savePerItemTunes(map);
}

/**
 * Synchronous lookup — tune ID only (for UI display).
 */
export async function getTuneIdForItem(itemId: string): Promise<string | null> {
  const map = await loadPerItemTunes();
  return map[itemId] ?? null;
}

// Track current preview so we can stop it
let currentPreview: any = null;
let currentPreviewId: string | null = null;

/** Safety cap for preview playback (ms) so it can never run forever. */
const PREVIEW_MAX_DURATION_MS = 30000;
let previewAutoStopTimer: ReturnType<typeof setTimeout> | null = null;
/** Optional callback fired when the preview stops (for any reason). */
let previewEndCallback: (() => void) | null = null;

/**
 * Preview a reminder tune. Plays at full volume and loops the sample so
 * short alarm clips are clearly audible. Auto-stops after 30s or when the
 * user taps stop. Pass `onEnd` to sync a "playing" UI indicator.
 */
export function previewReminderTune(tune: ReminderTune, onEnd?: () => void): void {
  if (!Sound) return;
  stopPreviewTune();
  previewEndCallback = onEnd ?? null;

  // Custom user-uploaded tunes use absolute file:// paths; built-in use bundle resources.
  const isCustom = isCustomTuneId(tune.id);
  const path = isCustom ? tune.resource : `${tune.resource}.wav`;
  const basePath = isCustom ? '' : Sound.MAIN_BUNDLE;
  const s = new Sound(path, basePath, (error: any) => {
    if (error) {
      console.warn('[Sound] Failed to load tune:', tune.resource, error);
      currentPreview = null;
      currentPreviewId = null;
      const cb = previewEndCallback;
      previewEndCallback = null;
      cb?.();
      return;
    }
    s.setVolume(1.0);
    // Loop so short samples remain audible the whole preview window.
    s.setNumberOfLoops(-1);
    currentPreview = s;
    currentPreviewId = tune.id;
    s.play();

    // Hard cap so a forgotten preview doesn't play forever.
    previewAutoStopTimer = setTimeout(() => {
      if (currentPreviewId === tune.id) {
        stopPreviewTune();
      }
    }, PREVIEW_MAX_DURATION_MS);
  });
}

export function stopPreviewTune(): void {
  if (previewAutoStopTimer) {
    clearTimeout(previewAutoStopTimer);
    previewAutoStopTimer = null;
  }
  if (currentPreview) {
    try {
      currentPreview.stop();
      currentPreview.release();
    } catch {}
    currentPreview = null;
    currentPreviewId = null;
  }
  const cb = previewEndCallback;
  previewEndCallback = null;
  cb?.();
}

export function getCurrentPreviewId(): string | null {
  return currentPreviewId;
}

// ── Ambient Sounds (Pomodoro focus) ────────────────────────────

export interface AmbientSound {
  id: string;
  name: string;
  icon: string;
  resource: string;
  color: string;
}

export const AMBIENT_SOUNDS: AmbientSound[] = [
  { id: 'rain',       name: 'Rain',        icon: 'rainy',         resource: 'ambient_rain',       color: '#4A90D9' },
  { id: 'forest',     name: 'Forest',      icon: 'leaf',          resource: 'ambient_forest',     color: '#10B981' },
  { id: 'cafe',       name: 'Cafe',        icon: 'cafe',          resource: 'ambient_cafe',       color: '#D97706' },
  { id: 'ocean',      name: 'Ocean',       icon: 'water',         resource: 'ambient_ocean',      color: '#0891B2' },
  { id: 'whitenoise', name: 'White Noise', icon: 'radio',         resource: 'ambient_whitenoise', color: '#8E8E93' },
  { id: 'pinknoise',  name: 'Pink Noise',  icon: 'disc',          resource: 'ambient_pinknoise',  color: '#EC4899' },
];

let currentAmbient: any = null;
let currentAmbientId: string | null = null;

/**
 * Play an ambient sound on loop (for Pomodoro focus).
 */
export function playAmbientSound(soundId: string, volume: number = 0.6): void {
  if (!Sound) return;
  stopAmbientSound();

  const ambient = AMBIENT_SOUNDS.find(a => a.id === soundId);
  if (!ambient) return;

  currentAmbient = new Sound(`${ambient.resource}.wav`, Sound.MAIN_BUNDLE, (error: any) => {
    if (error) {
      console.warn('[Sound] Failed to load ambient:', error);
      currentAmbient = null;
      return;
    }
    currentAmbient.setNumberOfLoops(-1); // infinite loop
    currentAmbient.setVolume(volume);
    currentAmbient.play();
    currentAmbientId = soundId;
  });
}

export function stopAmbientSound(): void {
  if (currentAmbient) {
    try {
      currentAmbient.stop();
      currentAmbient.release();
    } catch {}
    currentAmbient = null;
    currentAmbientId = null;
  }
}

export function getCurrentAmbientId(): string | null {
  return currentAmbientId;
}

export function setAmbientVolume(volume: number): void {
  if (currentAmbient) {
    try { currentAmbient.setVolume(volume); } catch {}
  }
}
