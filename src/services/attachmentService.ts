import { Platform, PermissionsAndroid, Alert } from 'react-native';
import type { NoteAttachment, AttachmentType } from '../types';
import { generateId } from '../utils/id';

// react-native-image-picker v7 uses named exports (no .default)
let launchImageLibrary: typeof import('react-native-image-picker').launchImageLibrary | null = null;
let launchCamera: typeof import('react-native-image-picker').launchCamera | null = null;
let DocPicker: {
  pick: (opts?: { type?: string[] }) => Promise<Array<{ uri: string; name?: string; type?: string }>>;
  keepLocalCopy: (opts: { files: Array<{ uri: string; fileName: string }>; destination: string }) => Promise<Array<{ status: string; localUri?: string }>>;
} | null = null;
let RNFS: {
  CachesDirectory: string;
  mkdir: (path: string) => Promise<void>;
  writeFile: (path: string, data: string, encoding: string) => Promise<void>;
} | null = null;

if (Platform.OS === 'android') {
  try {
    const ip = require('react-native-image-picker');
    launchImageLibrary = ip.launchImageLibrary;
    launchCamera = ip.launchCamera;
  } catch {
    launchImageLibrary = null;
    launchCamera = null;
  }
  try {
    DocPicker = require('@react-native-documents/picker');
  } catch {
    DocPicker = null;
  }
  try {
    const fs = require('react-native-fs');
    // supports both default export and named export
    RNFS = fs.default ?? fs;
  } catch {
    RNFS = null;
  }
}

export interface PickImageResult {
  uri: string;
  name?: string;
  type: 'photo' | 'camera';
}

async function requestCameraPermission(): Promise<boolean> {
  try {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.CAMERA,
      {
        title: 'Camera Permission',
        message: 'This app needs camera access to take photos.',
        buttonPositive: 'Allow',
        buttonNegative: 'Deny',
      },
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

async function requestStoragePermission(): Promise<boolean> {
  try {
    // Android 13+ uses READ_MEDIA_IMAGES, older uses READ_EXTERNAL_STORAGE
    const permission =
      parseInt(Platform.Version as string, 10) >= 33
        ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES
        : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;
    const result = await PermissionsAndroid.request(permission, {
      title: 'Storage Permission',
      message: 'This app needs access to your photos.',
      buttonPositive: 'Allow',
      buttonNegative: 'Deny',
    });
    return result === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

export async function pickImageFromGallery(): Promise<PickImageResult | null> {
  if (Platform.OS !== 'android' || !launchImageLibrary) return null;

  const granted = await requestStoragePermission();
  if (!granted) {
    Alert.alert('Permission Denied', 'Storage permission is required to pick photos.');
    return null;
  }

  return new Promise((resolve) => {
    launchImageLibrary!(
      { mediaType: 'photo', includeBase64: false, quality: 0.8 },
      (res) => {
        if (res.didCancel || res.errorCode || !res.assets?.[0]) {
          resolve(null);
          return;
        }
        const asset = res.assets[0];
        resolve({
          uri: asset.uri ?? '',
          name: asset.fileName ?? `photo_${Date.now()}.jpg`,
          type: 'photo',
        });
      },
    );
  });
}

export async function takePhoto(): Promise<PickImageResult | null> {
  if (Platform.OS !== 'android' || !launchCamera) return null;

  const granted = await requestCameraPermission();
  if (!granted) {
    Alert.alert('Permission Denied', 'Camera permission is required to take photos.');
    return null;
  }

  return new Promise((resolve) => {
    launchCamera!(
      { mediaType: 'photo', saveToPhotos: false, quality: 0.8 },
      (res) => {
        if (res.didCancel || res.errorCode || !res.assets?.[0]) {
          resolve(null);
          return;
        }
        const asset = res.assets[0];
        resolve({
          uri: asset.uri ?? '',
          name: asset.fileName ?? `camera_${Date.now()}.jpg`,
          type: 'camera',
        });
      },
    );
  });
}

export async function pickDocument(): Promise<{
  uri: string;
  name: string;
  mimeType?: string;
  type: AttachmentType;
} | null> {
  if (Platform.OS !== 'android' || !DocPicker) return null;
  try {
    const [file] = await DocPicker.pick();
    if (!file?.uri) return null;
    const [copyResult] = await DocPicker.keepLocalCopy({
      files: [{ uri: file.uri, fileName: file.name ?? 'document' }],
      destination: 'documentDirectory',
    });
    const uri =
      copyResult?.status === 'success' && copyResult.localUri
        ? copyResult.localUri
        : file.uri;
    const name = file.name ?? 'document';
    const mime = file.type ?? undefined;
    let type: AttachmentType = 'file';
    if (mime?.startsWith('image/')) type = 'photo';
    else if (mime === 'application/pdf') type = 'pdf';
    return { uri, name, mimeType: mime, type };
  } catch {
    return null;
  }
}

export function attachmentToNoteAttachment(
  item:
    | PickImageResult
    | { uri: string; name: string; mimeType?: string; type: AttachmentType },
): NoteAttachment {
  const now = Date.now();
  const type: AttachmentType = 'type' in item ? item.type : 'photo';
  return {
    id: generateId(),
    type,
    uri: item.uri,
    name: item.name,
    mimeType: 'mimeType' in item ? item.mimeType : undefined,
    createdAt: now,
  };
}

export function getAttachmentDirectory(): string | null {
  return RNFS?.CachesDirectory ?? null;
}

export async function saveSketchToFile(base64Data: string): Promise<string | null> {
  if (Platform.OS !== 'android' || !RNFS) return null;
  // react-native-signature-canvas returns "data:image/png;base64,<data>"
  const raw = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
  if (!raw) return null;
  // Write directly to CachesDirectory — no subdirectory to avoid mkdir rejection bug
  const path = `${RNFS.CachesDirectory}/sketch-${Date.now()}.png`;
  try {
    await RNFS.writeFile(path, raw, 'base64');
    return `file://${path}`;
  } catch {
    return null;
  }
}
