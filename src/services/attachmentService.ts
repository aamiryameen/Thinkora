import { Platform } from 'react-native';

let ImagePicker: typeof import('react-native-image-picker') | null = null;
let DocPicker: { pick: (opts?: { type?: string[] }) => Promise<Array<{ uri: string; name?: string; type?: string }>>; keepLocalCopy: (opts: { files: Array<{ uri: string; fileName: string }>; destination: string }) => Promise<Array<{ status: string; localUri?: string }>> } | null = null;
let RNFS: typeof import('react-native-fs') | null = null;

if (Platform.OS === 'android') {
  ImagePicker = require('react-native-image-picker').default;
  try {
    DocPicker = require('@react-native-documents/picker');
  } catch {
    DocPicker = null;
  }
  RNFS = require('react-native-fs').default;
}

import type { NoteAttachment, AttachmentType } from '../types';
import { generateId } from '../utils/id';

export interface PickImageResult {
  uri: string;
  name?: string;
  type: 'photo' | 'camera';
}

export async function pickImageFromGallery(): Promise<PickImageResult | null> {
  if (Platform.OS !== 'android' || !ImagePicker) return null;
  return new Promise((resolve) => {
    ImagePicker!.launchImageLibrary(
      { mediaType: 'photo', includeBase64: false },
      (res) => {
        if (res.didCancel || res.errorCode || !res.assets?.[0]) {
          resolve(null);
          return;
        }
        const asset = res.assets[0];
        resolve({
          uri: asset.uri ?? '',
          name: asset.fileName ?? undefined,
          type: 'photo',
        });
      }
    );
  });
}

export async function takePhoto(): Promise<PickImageResult | null> {
  if (Platform.OS !== 'android' || !ImagePicker) return null;
  return new Promise((resolve) => {
    ImagePicker!.launchCamera(
      { mediaType: 'photo', saveToPhotos: false },
      (res) => {
        if (res.didCancel || res.errorCode || !res.assets?.[0]) {
          resolve(null);
          return;
        }
        const asset = res.assets[0];
        resolve({
          uri: asset.uri ?? '',
          name: asset.fileName ?? undefined,
          type: 'camera',
        });
      }
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
    const uri = copyResult?.status === 'success' && copyResult.localUri ? copyResult.localUri : file.uri;
    const name = file.name ?? 'document';
    const mime = file.type ?? undefined;
    let type: AttachmentType = 'file';
    if (mime?.startsWith('image/')) type = 'photo';
    else if (mime === 'application/pdf') type = 'pdf';
    else if (mime?.startsWith('audio/')) type = 'file';
    return { uri, name, mimeType: mime, type };
  } catch {
    return null;
  }
}

export async function pickMultipleDocuments(): Promise<
  { uri: string; name: string; mimeType?: string; type: AttachmentType }[]
> {
  if (Platform.OS !== 'android' || !DocPicker) return [];
  try {
    const files = await DocPicker.pick();
    if (files.length === 0) return [];
    const copyResults = await DocPicker.keepLocalCopy({
      files: files.map((f) => ({ uri: f.uri, fileName: f.name ?? 'document' })),
      destination: 'documentDirectory',
    });
    return files.map((file, i) => {
      const res = copyResults[i];
      const uri = res?.status === 'success' && res.localUri ? res.localUri : file.uri;
      const name = file.name ?? 'document';
      const mime = file.type ?? undefined;
      let type: AttachmentType = 'file';
      if (mime?.startsWith('image/')) type = 'photo';
      else if (mime === 'application/pdf') type = 'pdf';
      else if (mime?.startsWith('audio/')) type = 'file';
      return { uri, name, mimeType: mime, type };
    });
  } catch {
    return [];
  }
}

export function attachmentToNoteAttachment(
  item:
    | PickImageResult
    | { uri: string; name: string; mimeType?: string; type: AttachmentType }
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
  const dir = RNFS.CachesDirectory + '/sketches';
  try {
    await RNFS.mkdir(dir);
  } catch {
    // exists
  }
  const path = `${dir}/sketch-${Date.now()}.png`;
  await RNFS.writeFile(path, base64Data, 'base64');
  return path;
}
