/**
 * Text-to-Speech Service — reads any note aloud.
 *
 * Uses `react-native-tts` if available; gracefully falls back with a
 * user-friendly error otherwise. The package itself can be added in a
 * follow-up native build (`npm i react-native-tts && cd android && ./gradlew clean`).
 */

import { Alert, Platform } from 'react-native';

// Lazy-require so the JS bundle works even if the native module isn't installed.
let TTS: any = null;
try {
  TTS = require('react-native-tts').default ?? require('react-native-tts');
} catch {
  TTS = null;
}

let initialized = false;
let isSpeakingFlag = false;

async function ensureInit(): Promise<boolean> {
  if (!TTS) return false;
  if (initialized) return true;
  try {
    await TTS.getInitStatus().catch(() => {});
    TTS.setDefaultLanguage('en-US');
    TTS.setDefaultRate(0.5);
    TTS.setDefaultPitch(1.0);
    TTS.addEventListener('tts-finish', () => { isSpeakingFlag = false; });
    TTS.addEventListener('tts-cancel', () => { isSpeakingFlag = false; });
    initialized = true;
    return true;
  } catch {
    return false;
  }
}

export function isTtsAvailable(): boolean {
  return TTS !== null && Platform.OS === 'android';
}

/** Strip HTML tags and entities to clean reading text. */
function cleanForSpeech(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '. ')
    .replace(/<\/p>/gi, '. ')
    .replace(/<\/li>/gi, '. ')
    .replace(/<li[^>]*>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, 'and')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export async function speakNote(title: string, body: string): Promise<void> {
  if (!isTtsAvailable()) {
    Alert.alert(
      'Read Aloud Unavailable',
      'Text-to-speech is not available on this build. Please rebuild after running: npm install react-native-tts',
    );
    return;
  }
  const ok = await ensureInit();
  if (!ok) {
    Alert.alert('Read Aloud Failed', 'Could not initialize text-to-speech.');
    return;
  }
  await TTS.stop();
  const text = `${title}. ${cleanForSpeech(body || '')}`.trim();
  if (!text) return;
  isSpeakingFlag = true;
  TTS.speak(text);
}

export async function stopSpeaking(): Promise<void> {
  if (TTS) {
    try { await TTS.stop(); } catch {}
  }
  isSpeakingFlag = false;
}

export function isSpeaking(): boolean {
  return isSpeakingFlag;
}

/** Set reading speed: 0.1 (very slow) → 1.0 (normal) → 2.0 (fast). */
export async function setSpeechRate(rate: number): Promise<void> {
  if (!TTS) return;
  try { await TTS.setDefaultRate(Math.max(0.1, Math.min(2.0, rate))); } catch {}
}
