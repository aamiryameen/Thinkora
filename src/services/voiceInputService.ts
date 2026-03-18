/**
 * Voice input service using custom native SpeechModule bridge.
 * Uses Android's built-in SpeechRecognizer directly.
 * Supports both old and new React Native architecture.
 */
import { Platform, PermissionsAndroid, Alert, NativeModules, DeviceEventEmitter } from 'react-native';

// NativeEventEmitter doesn't work with RCTDeviceEventEmitter-based modules on new arch.
// Use DeviceEventEmitter directly — works on both old and new architecture.
// Read lazily at call time — NativeModules may not be populated at import time on new arch.
function getSpeechModule(): any {
  return NativeModules?.SpeechModule ?? null;
}

let subscriptions: any[] = [];

export function isVoiceAvailable(): boolean {
  return Platform.OS === 'android' && getSpeechModule() != null;
}

async function requestMicPermission(): Promise<boolean> {
  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      {
        title: 'Microphone Permission',
        message: 'This app needs microphone access for voice input.',
        buttonPositive: 'Allow',
        buttonNegative: 'Deny',
      },
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

export interface VoiceCallbacks {
  onResult: (text: string) => void;
  onPartial?: (text: string) => void;
  onError?: (error: string) => void;
  onStart?: () => void;
  onEnd?: () => void;
}

function removeListeners() {
  subscriptions.forEach(s => {
    try { s.remove(); } catch {}
  });
  subscriptions = [];
}

export async function startVoiceInput(callbacks: VoiceCallbacks): Promise<boolean> {
  const mod = getSpeechModule();

  if (!mod || Platform.OS !== 'android') {
    Alert.alert('Voice Unavailable', 'Voice recognition module not found. Please rebuild the app.');
    return false;
  }

  const allowed = await requestMicPermission();
  if (!allowed) {
    Alert.alert('Permission Denied', 'Microphone permission is required for voice input.');
    return false;
  }

  try {
    removeListeners();

    subscriptions.push(
      DeviceEventEmitter.addListener('onSpeechStart', () => callbacks.onStart?.()),
    );
    subscriptions.push(
      DeviceEventEmitter.addListener('onSpeechEnd', () => callbacks.onEnd?.()),
    );
    subscriptions.push(
      DeviceEventEmitter.addListener('onSpeechResults', (e: any) => {
        const results = e?.value;
        if (results && results.length > 0) {
          callbacks.onResult(results[0]);
        }
      }),
    );
    subscriptions.push(
      DeviceEventEmitter.addListener('onSpeechPartialResults', (e: any) => {
        const results = e?.value;
        if (results && results.length > 0) {
          callbacks.onPartial?.(results[0]);
        }
      }),
    );
    subscriptions.push(
      DeviceEventEmitter.addListener('onSpeechError', (e: any) => {
        callbacks.onError?.(e?.error ?? 'Unknown error');
      }),
    );

    mod.startListening('en-US');
    return true;
  } catch (err: any) {
    Alert.alert('Voice Error', err?.message ?? 'Failed to start voice recognition.');
    return false;
  }
}

export async function stopVoiceInput(): Promise<void> {
  try {
    getSpeechModule()?.stopListening?.();
  } catch {}
  removeListeners();
}

export async function destroyVoiceInput(): Promise<void> {
  try {
    getSpeechModule()?.destroy?.();
  } catch {}
  removeListeners();
}
