/**
 * File pickers for the Knowledge Base.
 *
 * Wraps the same native modules attachmentService uses, but copies the picked
 * file into app storage first. That matters here: the picker hands back a
 * transient `content://` URI whose permission is revoked when the app
 * restarts, and Knowledge Base documents need to stay readable for re-indexing.
 */

import { Platform } from 'react-native';
import { SUPPORTED_PICKER_TYPES } from './kbExtractionService';

let DocPicker: {
  pick: (opts?: { type?: string[] }) => Promise<Array<{ uri: string; name?: string | null; type?: string | null }>>;
  keepLocalCopy: (opts: {
    files: Array<{ uri: string; fileName: string }>;
    destination: string;
  }) => Promise<Array<{ status: string; localUri?: string }>>;
} | null = null;

let launchImageLibrary: typeof import('react-native-image-picker').launchImageLibrary | null = null;

if (Platform.OS === 'android') {
  try {
    DocPicker = require('@react-native-documents/picker');
  } catch {
    DocPicker = null;
  }
  try {
    const ip = require('react-native-image-picker');
    launchImageLibrary = ip.launchImageLibrary;
  } catch {
    launchImageLibrary = null;
  }
}

export interface PickedFile {
  uri: string;
  name: string;
  mimeType?: string;
}

/**
 * Picks a document and copies it into the app's document directory.
 * Returns null when the user cancels or the picker is unavailable.
 */
export async function pickKbDocument(): Promise<PickedFile | null> {
  if (!DocPicker) return null;

  try {
    const [file] = await DocPicker.pick({ type: SUPPORTED_PICKER_TYPES });
    if (!file?.uri) return null;

    const name = file.name ?? 'document';

    // Persist a local copy so the file survives the picker's grant expiring.
    let uri = file.uri;
    try {
      const [copy] = await DocPicker.keepLocalCopy({
        files: [{ uri: file.uri, fileName: name }],
        destination: 'documentDirectory',
      });
      if (copy?.status === 'success' && copy.localUri) {
        uri = copy.localUri;
      }
    } catch {
      // Fall back to the original URI; extraction may still succeed now.
    }

    return { uri, name, mimeType: file.type ?? undefined };
  } catch {
    // The picker throws on cancel in some versions.
    return null;
  }
}

/** Picks an image from the gallery for OCR. */
export async function pickKbImage(): Promise<PickedFile | null> {
  if (!launchImageLibrary) return null;

  return new Promise((resolve) => {
    launchImageLibrary!(
      { mediaType: 'photo', selectionLimit: 1, includeBase64: false },
      (response) => {
        if (response.didCancel || response.errorCode || !response.assets?.[0]) {
          resolve(null);
          return;
        }
        const asset = response.assets[0];
        if (!asset.uri) {
          resolve(null);
          return;
        }
        resolve({
          uri: asset.uri,
          name: asset.fileName ?? `image_${Date.now()}.jpg`,
          mimeType: asset.type ?? 'image/jpeg',
        });
      },
    );
  });
}

/** Whether document picking is available on this platform. */
export function isPickerAvailable(): boolean {
  return Platform.OS === 'android' && DocPicker !== null;
}
