/**
 * Share Card Service — captures a styled view as a PNG image and opens
 * the system share sheet so the user can share to WhatsApp, IG, Twitter, etc.
 */

import { Share, Platform } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import RNFS from 'react-native-fs';

export async function shareViewAsCard(viewRef: any, fileName: string = 'thinkora-note'): Promise<void> {
  if (!viewRef) throw new Error('No view to capture');

  // Capture the view as a PNG
  const tmpUri = await captureRef(viewRef, {
    format: 'png',
    quality: 1,
    result: 'tmpfile',
    width: 1080,    // Instagram-story friendly width
  });

  // Move into a stable cache path with a friendly filename
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 50);
  const finalPath = `${RNFS.CachesDirectoryPath}/${safeName}_${Date.now()}.png`;
  try {
    await RNFS.moveFile(tmpUri, finalPath);
  } catch {
    // If move fails, fall back to the tmp uri
    await Share.share({
      url: Platform.OS === 'android' ? `file://${tmpUri}` : tmpUri,
      message: 'Shared from Thinkora',
    });
    return;
  }

  await Share.share({
    url: Platform.OS === 'android' ? `file://${finalPath}` : finalPath,
    message: 'Shared from Thinkora',
  });
}
