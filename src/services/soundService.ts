/**
 * Sound Service
 *
 * Manages reminder tunes + ambient background sounds for Pomodoro.
 *
 * Reminder tunes: short (1-2 sec), played by the notification system.
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

export async function getSelectedReminderTune(): Promise<ReminderTune> {
  try {
    const id = await AsyncStorage.getItem(TUNE_KEY);
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
    const tune = REMINDER_TUNES.find(t => t.id === tuneId);
    if (tune) return tune;
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

/**
 * Preview a reminder tune — plays until tune ends or user stops it.
 * Call previewReminderTune() with same id again to stop, or stopPreviewTune().
 */
export function previewReminderTune(tune: ReminderTune): void {
  if (!Sound) return;
  // Stop any existing preview first
  stopPreviewTune();
  const s = new Sound(`${tune.resource}.wav`, Sound.MAIN_BUNDLE, (error: any) => {
    if (error) {
      currentPreview = null;
      currentPreviewId = null;
      return;
    }
    s.setVolume(0.8);
    s.setNumberOfLoops(0); // play once (no loop)
    currentPreview = s;
    currentPreviewId = tune.id;
    s.play(() => {
      // Cleanup when playback finishes
      if (currentPreviewId === tune.id) {
        currentPreview = null;
        currentPreviewId = null;
      }
      s.release();
    });
  });
}

export function stopPreviewTune(): void {
  if (currentPreview) {
    try {
      currentPreview.stop();
      currentPreview.release();
    } catch {}
    currentPreview = null;
    currentPreviewId = null;
  }
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
