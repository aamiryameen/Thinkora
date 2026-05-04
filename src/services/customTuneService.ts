/**
 * Custom Tune Service — picks an audio file from the user's device and
 * copies it into the app's persistent storage so it survives across app
 * launches and can be referenced by Android notification channels.
 */

import { Platform } from 'react-native';
import RNFS from 'react-native-fs';
import { addCustomTune, type CustomTune } from './soundService';

let pick: any = null;
try {
  pick = require('@react-native-documents/picker').pick;
} catch {
  pick = null;
}

const ACCEPTED_TYPES = [
  'audio/mpeg',     // .mp3
  'audio/mp4',      // .m4a
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
  'audio/aac',
];

/**
 * Open the system file picker, let the user select an audio file,
 * copy it to the app's storage, and register it as a custom tune.
 */
export async function pickAndAddCustomTune(): Promise<CustomTune | null> {
  if (Platform.OS !== 'android' || !pick) {
    throw new Error('Custom tunes are only supported on Android.');
  }

  const result = await pick({
    type: ACCEPTED_TYPES,
    allowMultiSelection: false,
  });

  if (!result || result.length === 0) return null;
  const file = result[0];
  if (!file.uri) throw new Error('No file selected.');

  // Determine destination path in app storage
  const safeName = (file.name ?? `tune_${Date.now()}.mp3`).replace(/[^a-zA-Z0-9._-]/g, '_');
  const destDir = `${RNFS.DocumentDirectoryPath}/custom_tunes`;
  await RNFS.mkdir(destDir).catch(() => {});
  const destPath = `${destDir}/${Date.now()}_${safeName}`;

  // Copy from content:// URI to a stable file:// path
  await RNFS.copyFile(file.uri, destPath);

  const displayName = (file.name ?? 'Custom').replace(/\.[^.]+$/, '');
  return await addCustomTune(`file://${destPath}`, displayName);
}
